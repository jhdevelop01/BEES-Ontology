"""
시뮬레이션 엔진 모듈.

EmulatorEngine: AsyncIO 기반 메인 루프로 5초 간격 데이터 생성.
DeviceState: 장비 런타임 상태 관리.
데이터 생성 공식: value = base_value + noise * random(-1,1) + daily_pattern(hour) + equipment_effect + seasonal + drift

Phase 4 추가:
- ScenarioManager: 시나리오별 파라미터(재실률, 외기온, HVAC 모드) 반영
- FaultManager: 고장 주입(센서 고착, 드리프트, 통신 단절 등) 반영
- ThermalModel: Zone_Air_Temperature_Sensor를 1차 에너지 밸런스로 대체
- WeatherProvider: 서울 TMY 기반 외기 조건 제공
"""

import asyncio
import json
import logging
import math
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import paho.mqtt.client as mqtt

from .alarm_checker import AlarmChecker
from .config import settings
from .fault_injection import FaultManager
from .profiles.ahu_5f import AHU_5F_DEVICE, AHU_5F_PROFILES, DataProfile, DeviceProfile
from .profiles.profile_factory import (
    POINT_SPECS,
    create_data_profile,
    create_device_profile,
    seasonal_correction,
    _strip_namespace,
)
from .scenarios import ScenarioManager
from .thermodynamics import ThermalModel
from .weather import WeatherProvider
from . import neo4j_loader

logger = logging.getLogger("server-c.engine")

# 바이너리(상태/알람) 포인트 클래스 — 0 또는 1만 반환
_BINARY_CLASSES: set[str] = {
    "On_Off_Status",
    "Fan_On_Off_Status",
    "Alarm",
}

# 설정값(Setpoint) 포인트 클래스 — 고정값, 노이즈 없음
_SETPOINT_CLASSES: set[str] = {
    "Supply_Air_Temperature_Setpoint",
    "Zone_Air_Temperature_Setpoint",
    "Chilled_Water_Supply_Temperature_Setpoint",
}

# 존 공기 온도 센서 — 열역학 모델 사용
_ZONE_TEMP_CLASS = "Zone_Air_Temperature_Sensor"


# ─────────────────────────────────────────────────────────────
# 장비 런타임 상태
# ─────────────────────────────────────────────────────────────

@dataclass
class DeviceState:
    """장비 런타임 상태. 시뮬레이션 중 변경 가능."""

    device_id: str
    is_active: bool = False         # ON/OFF 상태
    mode: str = "auto"              # 운전 모드: auto, manual, standby
    connected_points: list = field(default_factory=list)

    def to_dict(self) -> dict:
        """직렬화용 딕셔너리 변환."""
        return {
            "device_id": self.device_id,
            "is_active": self.is_active,
            "mode": self.mode,
            "connected_points": self.connected_points,
        }


# ─────────────────────────────────────────────────────────────
# 시뮬레이션 엔진
# ─────────────────────────────────────────────────────────────

class EmulatorEngine:
    """
    가상 건물 에뮬레이터 엔진.

    - AsyncIO 메인 루프로 지정 간격마다 센서 데이터 생성
    - MQTT로 센서 데이터 및 장비 상태 발행
    - REST API를 통한 장비 제어 명령 수신
    - Phase 4: 시나리오, 고장 주입, 열역학 모델 통합
    """

    def __init__(self):
        # 시뮬레이션 상태
        self._running: bool = False
        self._task: Optional[asyncio.Task] = None
        self._start_time: Optional[datetime] = None
        self._tick_count: int = 0

        # 장비 상태 레지스트리
        self._devices: dict[str, DeviceState] = {}

        # 데이터 프로파일 레지스트리
        self._profiles: dict[str, DataProfile] = {}

        # 최신 센서값 캐시 (REST 조회용)
        self._latest_values: dict[str, dict] = {}

        # 필터 차압 드리프트 누적값 (시뮬레이션 시작 후 경과 시간 기반)
        self._drift_accumulator: dict[str, float] = {}

        # MQTT 클라이언트
        self._mqtt_client: Optional[mqtt.Client] = None
        self._mqtt_connected: bool = False

        # 알람 체커 (Phase 3)
        self._alarm_checker = AlarmChecker()

        # Neo4j 로딩 상태 (Phase 2)
        self._neo4j_loaded: bool = False

        # Phase 4: 시나리오 관리자
        self.scenario_manager = ScenarioManager()

        # Phase 4: 고장 주입 관리자
        self.fault_manager = FaultManager()

        # Phase 4: 기상 데이터 제공자
        self.weather_provider = WeatherProvider()

        # Phase 4: 존별 열역학 모델 {point_id: ThermalModel}
        self._thermal_models: dict[str, ThermalModel] = {}

    # ─────────────── 초기화 ───────────────

    async def initialize_from_neo4j(self) -> dict:
        """
        Neo4j에서 장비/센서를 자동 로딩하여 프로파일을 생성.

        Phase 2: 845개 인스턴스 전체를 Neo4j에서 로딩.
        Neo4j 연결 실패 또는 장비 없으면 Phase 1 MVP (AHU_5F) 폴백.

        Returns:
            로딩 결과 딕셔너리: {mode, device_count, point_count, skipped_points}
        """
        equipment_list = await neo4j_loader.load_equipment_from_neo4j()

        if not equipment_list:
            # Phase 1 폴백: AHU_5F 하드코딩
            logger.info("Neo4j 로딩 실패 — Phase 1 MVP 폴백 (AHU_5F)")
            self._register_device(AHU_5F_DEVICE)
            for profile in AHU_5F_PROFILES:
                self._register_profile(profile)
            self._neo4j_loaded = False
            return {
                "mode": "fallback_ahu_5f",
                "device_count": len(self._devices),
                "point_count": len(self._profiles),
                "skipped_points": 0,
            }

        # Neo4j에서 로딩 성공 — 프로파일 자동 생성
        skipped_points = 0

        for eq_id, eq_class, loc_id, points in equipment_list:
            # 포인트 ID 목록 추출
            point_ids = [pt_id for pt_id, _ in points]

            # DeviceProfile 생성 및 등록
            device_profile = create_device_profile(
                equipment_id=eq_id,
                brick_class=f"brick:{eq_class}",
                location_id=loc_id,
                connected_point_ids=point_ids,
            )
            self._register_device(device_profile)

            # 각 포인트에 대해 DataProfile 생성 및 등록
            for pt_id, pt_class in points:
                data_profile = create_data_profile(
                    point_id=pt_id,
                    brick_class=f"brick:{pt_class}",
                    equipment_id=eq_id,
                    equipment_class=f"brick:{eq_class}",
                )
                if data_profile:
                    self._register_profile(data_profile)

                    # Phase 4: Zone_Air_Temperature_Sensor는 열역학 모델 초기화
                    if _strip_namespace(f"brick:{pt_class}") == _ZONE_TEMP_CLASS:
                        zone_id = loc_id if loc_id != "unknown" else pt_id
                        self._thermal_models[pt_id] = ThermalModel(
                            zone_id=zone_id, initial_temp=24.0
                        )
                        logger.debug(f"열역학 모델 초기화: {pt_id} (zone: {zone_id})")
                else:
                    skipped_points += 1
                    logger.debug(
                        f"프로파일 스펙 없음 (스킵): {pt_id} ({pt_class})"
                    )

        self._neo4j_loaded = True

        # ── 가상 Zone 센서 포인트 추가 (B4F~3F, 1F: 공조 온도 센서 미정의 층) ──
        self._inject_virtual_zone_points()

        result = {
            "mode": "neo4j_full",
            "device_count": len(self._devices),
            "point_count": len(self._profiles),
            "skipped_points": skipped_points,
            "thermal_models": len(self._thermal_models),
        }
        logger.info(
            f"Neo4j 기반 프로파일 생성 완료: "
            f"장비 {result['device_count']}개, "
            f"포인트 {result['point_count']}개, "
            f"스킵 {skipped_points}개, "
            f"열역학 모델 {len(self._thermal_models)}개"
        )
        return result

    def _inject_virtual_zone_points(self) -> None:
        """공조 온도 센서가 없는 층(B4F~3F, 1F)에 가상 Zone 온도/습도/CO2 포인트 추가."""
        # AHU_UFAD가 없는 층: (floor_code, base_temp, base_co2)
        _VIRTUAL_FLOORS: list[tuple[str, float, float]] = [
            ("B4F", 18.0, 800.0),   # 주차장 — 환기 부족, CO2 높음
            ("B3F", 18.5, 750.0),   # 주차장
            ("B2F", 20.0, 650.0),   # 주차장/기계실
            ("B1F", 22.0, 550.0),   # 기계실/MDF
            ("1F", 22.0, 500.0),    # 로비 — 출입문 환기
            ("2F", 23.0, 480.0),    # 포디움 사무실
            ("3F", 23.0, 480.0),    # 포디움 사무실
        ]
        count = 0
        for floor_code, base_temp, base_co2 in _VIRTUAL_FLOORS:
            # Zone_Temp_{floor}
            temp_id = f"bldg:Zone_Temp_{floor_code}"
            if temp_id not in self._profiles:
                temp_profile = DataProfile(
                    point_id=temp_id,
                    brick_class="brick:Zone_Air_Temperature_Sensor",
                    base_value=base_temp,
                    noise_range=1.5,
                    unit="degC",
                    min_value=10.0,
                    max_value=35.0,
                    daily_amplitude=2.0,
                    equipment_dependency=f"bldg:Floor_{floor_code}",
                    off_base_value=None,
                )
                self._register_profile(temp_profile)
                count += 1

            # Zone_Humidity_{floor}
            hum_id = f"bldg:Zone_Humidity_{floor_code}"
            if hum_id not in self._profiles:
                hum_profile = DataProfile(
                    point_id=hum_id,
                    brick_class="brick:Zone_Air_Humidity_Sensor",
                    base_value=50.0,
                    noise_range=5.0,
                    unit="%RH",
                    min_value=20.0,
                    max_value=80.0,
                    daily_amplitude=3.0,
                    equipment_dependency=f"bldg:Floor_{floor_code}",
                    off_base_value=None,
                )
                self._register_profile(hum_profile)
                count += 1

            # Zone_CO2_{floor}
            co2_id = f"bldg:Zone_CO2_{floor_code}"
            if co2_id not in self._profiles:
                co2_profile = DataProfile(
                    point_id=co2_id,
                    brick_class="brick:CO2_Sensor",
                    base_value=base_co2,
                    noise_range=50.0,
                    unit="ppm",
                    min_value=350.0,
                    max_value=2000.0,
                    daily_amplitude=80.0,
                    equipment_dependency=f"bldg:Floor_{floor_code}",
                    off_base_value=None,
                )
                self._register_profile(co2_profile)
                count += 1

        if count > 0:
            logger.info(f"가상 Zone 센서 포인트 {count}개 추가 (B4F~3F, 1F)")

    def _register_device(self, device_profile: DeviceProfile) -> None:
        """장비를 레지스트리에 등록."""
        state = DeviceState(
            device_id=device_profile.device_id,
            is_active=False,
            mode="auto",
            connected_points=device_profile.connected_points,
        )
        self._devices[device_profile.device_id] = state
        logger.info(f"장비 등록: {device_profile.device_id} ({device_profile.brick_class})")

    def _register_profile(self, profile: DataProfile) -> None:
        """센서 프로파일을 레지스트리에 등록."""
        self._profiles[profile.point_id] = profile
        self._drift_accumulator[profile.point_id] = 0.0
        logger.info(f"센서 프로파일 등록: {profile.point_id} ({profile.brick_class})")

    # ─────────────── MQTT ───────────────

    def _setup_mqtt(self) -> None:
        """MQTT 클라이언트 초기화 및 브로커 연결."""
        try:
            self._mqtt_client = mqtt.Client(
                client_id=settings.MQTT_CLIENT_ID,
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            )
            self._mqtt_client.on_connect = self._on_mqtt_connect
            self._mqtt_client.on_disconnect = self._on_mqtt_disconnect

            self._mqtt_client.connect_async(
                settings.MQTT_BROKER,
                settings.MQTT_PORT,
            )
            self._mqtt_client.loop_start()
            logger.info(f"MQTT 브로커 연결 시도: {settings.MQTT_BROKER}:{settings.MQTT_PORT}")
        except Exception as e:
            logger.warning(f"MQTT 연결 실패 (시뮬레이션은 계속 진행): {e}")
            self._mqtt_connected = False

    def _on_mqtt_connect(self, client, userdata, flags, rc, properties=None) -> None:
        """MQTT 연결 성공 콜백."""
        if rc == 0:
            self._mqtt_connected = True
            logger.info("MQTT 브로커 연결 성공")
        else:
            self._mqtt_connected = False
            logger.warning(f"MQTT 연결 실패, 코드: {rc}")

    def _on_mqtt_disconnect(self, client, userdata, flags, rc, properties=None) -> None:
        """MQTT 연결 해제 콜백."""
        self._mqtt_connected = False
        logger.warning(f"MQTT 연결 해제, 코드: {rc}")

    def _publish_mqtt(self, topic: str, payload: dict) -> None:
        """MQTT 토픽에 JSON 페이로드 발행."""
        if self._mqtt_client and self._mqtt_connected:
            try:
                msg = json.dumps(payload, ensure_ascii=False)
                self._mqtt_client.publish(topic, msg, qos=0)
                logger.debug(f"MQTT 발행: {topic} → {msg[:100]}")
            except Exception as e:
                logger.warning(f"MQTT 발행 실패 ({topic}): {e}")
        else:
            logger.debug(f"MQTT 미연결 — 발행 건너뜀: {topic}")

    # ─────────────── 데이터 생성 ───────────────

    def _daily_pattern(self, hour: float, amplitude: float) -> float:
        """
        일간 사인파 패턴 생성.
        14시(오후 2시)에 최대, 02시(새벽 2시)에 최소.
        """
        # sin 함수: 14시에 피크 → phase shift = (14 - 6) = 8시간
        return amplitude * math.sin(2 * math.pi * (hour - 6) / 24)

    def _equipment_effect(self, profile: DataProfile) -> float:
        """
        장비 상태에 따른 값 보정.
        장비 OFF 시: off_base_value 사용, ON 시: base_value 사용.
        """
        device = self._devices.get(profile.equipment_dependency)
        if device and not device.is_active and profile.off_base_value is not None:
            # 장비 OFF → off_base_value와 base_value의 차이를 보정값으로 반환
            return profile.off_base_value - profile.base_value
        return 0.0

    def _apply_scenario_effects(self, profile: DataProfile, base_value: float) -> float:
        """시나리오 파라미터에 따른 값 보정."""
        class_name = _strip_namespace(profile.brick_class)
        scenario = self.scenario_manager.active

        # 재실률이 CO2에 영향
        if "CO2" in class_name:
            # 재실률 높으면 CO2 증가 (기본 0.7 대비 비례)
            occupancy_factor = scenario.occupancy / 0.7
            return base_value * occupancy_factor

        # 재실률이 내부 발열에 영향 → 전력 센서 반영
        if "Power" in class_name:
            occupancy_factor = 0.3 + 0.7 * scenario.occupancy
            return base_value * occupancy_factor

        # HVAC 모드가 급기온도에 영향
        if "Supply_Air_Temperature" in class_name and class_name not in _SETPOINT_CLASSES:
            if scenario.hvac_mode == "max_cooling":
                return base_value - 2.0   # 급기온 낮춤
            elif scenario.hvac_mode == "heating":
                return base_value + 6.0   # 급기온 높임 (난방)
            elif scenario.hvac_mode == "eco":
                return base_value + 2.0   # 에코 → 약간 높은 급기온
            elif scenario.hvac_mode == "max_ventilation":
                # 최대 환기 → 외기온에 근접
                outdoor = self.weather_provider.get_current_conditions()["outdoor_temp"]
                return (base_value + outdoor) / 2.0

        # HVAC 모드가 팬속도에 영향
        if "Fan_Speed" in class_name:
            if scenario.hvac_mode == "max_ventilation":
                return 95.0
            elif scenario.hvac_mode == "max_cooling":
                return 90.0
            elif scenario.hvac_mode == "eco":
                return 30.0

        return base_value

    def _generate_value(self, profile: DataProfile, now: datetime) -> Optional[float]:
        """
        센서 데이터 생성 공식:
        value = base_value + noise * random(-1, 1) + daily_pattern(hour) + equipment_effect + seasonal + drift

        Phase 4 추가:
        - 시나리오 파라미터 반영 (재실률, 외기온, HVAC 모드)
        - 고장 주입 효과 반영 (센서 고착, 드리프트, 통신 단절 등)
        - Zone_Air_Temperature_Sensor는 열역학 모델 사용

        특수 처리:
        - 바이너리 클래스 (On_Off_Status, Fan_On_Off_Status, Alarm): 0.0 또는 1.0
        - Setpoint 클래스: 고정 base_value (노이즈/일간패턴 없음)

        Returns:
            생성된 센서값. 통신 단절 시 None 반환.
        """
        class_name = _strip_namespace(profile.brick_class)

        # ── Phase 4: 통신 단절 고장 확인 ──
        if self.fault_manager.has_comm_loss(profile.equipment_dependency):
            return None

        # ── Phase 4: 센서 고착 고장 확인 ──
        stuck_value = self.fault_manager.get_sensor_stuck_value(profile.point_id)
        if stuck_value is not None:
            return stuck_value

        # ── 바이너리 포인트 (상태/알람) ──
        if class_name in _BINARY_CLASSES:
            device = self._devices.get(profile.equipment_dependency)
            if device and device.is_active:
                return 1.0
            return 0.0

        # ── Setpoint (설정값) — 고정값 ──
        if class_name in _SETPOINT_CLASSES:
            return profile.base_value

        # ── Phase 4: Zone_Air_Temperature_Sensor → 열역학 모델 ──
        if class_name == _ZONE_TEMP_CLASS and profile.point_id in self._thermal_models:
            return self._generate_thermal_value(profile, now)

        # ── 일반 센서 데이터 생성 ──
        hour = now.hour + now.minute / 60.0

        # 기본값 + 시나리오 보정
        base = self._apply_scenario_effects(profile, profile.base_value)

        # 랜덤 노이즈
        noise = profile.noise_range * random.uniform(-1, 1)

        # 일간 패턴
        daily = self._daily_pattern(hour, profile.daily_amplitude)

        # 장비 효과
        eq_effect = self._equipment_effect(profile)

        # 계절 보정 (서울 기후)
        from .profiles.profile_factory import _find_spec
        spec = _find_spec(profile.brick_class)
        seasonal = 0.0
        if spec and spec.seasonal_amplitude > 0:
            seasonal = seasonal_correction(
                now, spec.seasonal_amplitude, spec.seasonal_phase_month
            )

        # 드리프트 (점진 변화, 예: 필터 오염)
        drift = self._drift_accumulator.get(profile.point_id, 0.0)

        # Phase 4: 고장 주입 드리프트
        fault_drift = self.fault_manager.get_sensor_drift(
            profile.point_id, settings.SIMULATION_INTERVAL / 3600.0
        )

        # Phase 4: 장비 성능 저하 효과
        capacity_reduction = self.fault_manager.get_capacity_reduction(profile.equipment_dependency)
        degraded_effect = 0.0
        if capacity_reduction > 0 and "Temperature" in class_name:
            # 성능 저하 → HVAC 출력 감소 → 실온이 외기 방향으로 이동
            weather = self.weather_provider.get_current_conditions(now)
            outdoor_temp = weather["outdoor_temp"]
            degraded_effect = capacity_reduction * (outdoor_temp - profile.base_value) * 0.3

        # Phase 4: 밸브 누설 효과
        valve_leak = self.fault_manager.get_valve_leak(profile.equipment_dependency)
        leak_effect = 0.0
        if valve_leak > 0 and "Temperature" in class_name:
            leak_effect = valve_leak * random.uniform(-2.0, 2.0)

        # 최종값 계산
        value = base + noise + daily + eq_effect + seasonal + drift + fault_drift + degraded_effect + leak_effect

        # 물리적 범위 클리핑
        value = max(profile.min_value, min(profile.max_value, value))

        return round(value, 2)

    def _generate_thermal_value(self, profile: DataProfile, now: datetime) -> float:
        """Zone_Air_Temperature_Sensor를 열역학 모델로 생성."""
        model = self._thermal_models[profile.point_id]
        scenario = self.scenario_manager.active

        # 기상 조건 가져오기
        weather = self.weather_provider.get_current_conditions(now)
        outdoor_temp = weather["outdoor_temp"]

        # 장비 상태 확인
        device = self._devices.get(profile.equipment_dependency)
        hvac_active = device.is_active if device else False

        # 시나리오에 따른 설정온도
        setpoint = profile.base_value  # 기본 24°C
        if scenario.hvac_mode == "eco":
            setpoint += 2.0  # 에코 → 설정온도 높임 (냉방 절감)
        elif scenario.hvac_mode == "max_cooling":
            setpoint -= 2.0  # 최대 냉방 → 설정온도 낮춤

        # Phase 4: 고장 효과
        capacity_reduction = self.fault_manager.get_capacity_reduction(profile.equipment_dependency)
        valve_leak = self.fault_manager.get_valve_leak(profile.equipment_dependency)

        # 열역학 모델 스텝
        new_temp = model.step(
            dt=settings.SIMULATION_INTERVAL,
            outdoor_temp=outdoor_temp,
            occupancy=scenario.occupancy,
            hvac_active=hvac_active,
            setpoint=setpoint,
            solar_radiation=weather["solar_radiation"],
            solar_factor=scenario.solar_factor,
            capacity_reduction=capacity_reduction,
            valve_leak=valve_leak,
        )

        # 약간의 노이즈 추가 (센서 정밀도 한계)
        noise = random.uniform(-0.15, 0.15)
        value = new_temp + noise

        # 물리적 범위 클리핑
        value = max(profile.min_value, min(profile.max_value, value))

        return round(value, 2)

    def _update_drift(self, profile: DataProfile, interval_seconds: float) -> None:
        """드리프트 누적값 업데이트 (시간 경과에 따른 점진 변화)."""
        if profile.drift_rate != 0.0:
            # 장비 ON일 때만 드리프트 누적
            device = self._devices.get(profile.equipment_dependency)
            if device and device.is_active:
                hours_elapsed = interval_seconds / 3600.0
                self._drift_accumulator[profile.point_id] += (
                    profile.drift_rate * hours_elapsed
                )

    # ─────────────── 메인 루프 ───────────────

    async def _simulation_loop(self) -> None:
        """AsyncIO 시뮬레이션 메인 루프. 설정된 간격마다 데이터 생성 및 발행."""
        logger.info(
            f"시뮬레이션 루프 시작 (간격: {settings.SIMULATION_INTERVAL}초)"
        )

        # Phase 4: 시나리오에 따른 외기온 오버라이드 적용
        scenario = self.scenario_manager.active
        self.weather_provider.set_temp_override(
            scenario.outdoor_temp_min, scenario.outdoor_temp_max
        )

        while self._running:
            try:
                now = datetime.now(timezone.utc)
                self._tick_count += 1

                # Phase 4: 시나리오 변경 감지 시 기상 오버라이드 업데이트
                current_scenario = self.scenario_manager.active
                if current_scenario.name != scenario.name:
                    scenario = current_scenario
                    self.weather_provider.set_temp_override(
                        scenario.outdoor_temp_min, scenario.outdoor_temp_max
                    )
                    logger.info(f"시나리오 변경 감지: {scenario.name}")

                # 모든 센서 프로파일에 대해 데이터 생성
                for point_id, profile in self._profiles.items():

                    # Phase 4: 통신 단절 장비의 포인트는 건너뜀
                    if self.fault_manager.has_comm_loss(profile.equipment_dependency):
                        # 통신 단절 시 quality=bad로 발행
                        payload = {
                            "value": None,
                            "ts": now.isoformat(),
                            "unit": profile.unit,
                            "quality": "comm_loss",
                        }
                        self._latest_values[point_id] = payload
                        topic = f"bees/points/{point_id}"
                        self._publish_mqtt(topic, payload)
                        continue

                    # 값 생성
                    value = self._generate_value(profile, now)

                    if value is None:
                        continue

                    # 드리프트 업데이트
                    self._update_drift(profile, settings.SIMULATION_INTERVAL)

                    # MQTT 페이로드 구성
                    payload = {
                        "value": value,
                        "ts": now.isoformat(),
                        "unit": profile.unit,
                        "quality": "good",
                    }

                    # 최신값 캐시 업데이트
                    self._latest_values[point_id] = payload

                    # MQTT 발행: bees/points/{point_id}
                    topic = f"bees/points/{point_id}"
                    self._publish_mqtt(topic, payload)

                    # 알람 체크 (Phase 3)
                    alarms = self._alarm_checker.check(
                        point_id=point_id,
                        value=value,
                        brick_class=profile.brick_class,
                        equipment_id=profile.equipment_dependency,
                        now=now,
                        ref_value=profile.max_value,  # 전력 알람: 설계 정격 대비 비율 판정용
                    )
                    for alarm in alarms:
                        alarm_topic = f"bees/alarms/{alarm['severity']}"
                        self._publish_mqtt(alarm_topic, alarm)

                # 장비 상태 발행
                for device_id, device in self._devices.items():
                    # Phase 4: 통신 단절 장비는 offline 상태로 발행
                    if self.fault_manager.has_comm_loss(device_id):
                        state_payload = {
                            "is_active": False,
                            "mode": "offline",
                            "ts": now.isoformat(),
                            "comm_loss": True,
                        }
                    else:
                        state_payload = {
                            "is_active": device.is_active,
                            "mode": device.mode,
                            "ts": now.isoformat(),
                        }
                    topic = f"bees/devices/{device_id}/state"
                    self._publish_mqtt(topic, state_payload)

                logger.debug(
                    f"Tick #{self._tick_count}: {len(self._profiles)}개 센서 데이터 생성 완료"
                )

            except Exception as e:
                logger.error(f"시뮬레이션 루프 오류: {e}", exc_info=True)

            # 다음 틱까지 대기
            await asyncio.sleep(settings.SIMULATION_INTERVAL)

    # ─────────────── 공개 API ───────────────

    async def start(self) -> dict:
        """시뮬레이션 시작."""
        if self._running:
            return {"status": "already_running", "message": "시뮬레이션이 이미 실행 중입니다."}

        self._running = True
        self._start_time = datetime.now(timezone.utc)
        self._tick_count = 0

        # 드리프트 초기화
        for point_id in self._drift_accumulator:
            self._drift_accumulator[point_id] = 0.0

        # 열역학 모델 리셋
        for model in self._thermal_models.values():
            model.reset()

        # MQTT 연결
        self._setup_mqtt()

        # 전체 장비 활성화 (시뮬레이션 시작 = 모든 장비 가동)
        activated = 0
        for device in self._devices.values():
            device.is_active = True
            device.mode = "auto"
            activated += 1
        logger.info(f"시뮬레이션 시작 — 전체 장비 활성화: {activated}대")

        # AsyncIO 태스크 시작
        self._task = asyncio.create_task(self._simulation_loop())

        return {"status": "started", "message": f"시뮬레이션이 시작되었습니다. ({activated}대 장비 가동)"}

    async def stop(self) -> dict:
        """시뮬레이션 중지."""
        if not self._running:
            return {"status": "already_stopped", "message": "시뮬레이션이 이미 중지 상태입니다."}

        self._running = False

        # 태스크 취소
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        # 전체 장비 비활성화 (시뮬레이션 정지 = 모든 장비 정지)
        deactivated = 0
        now = datetime.now(timezone.utc)
        for device_id, device in self._devices.items():
            device.is_active = False
            device.mode = "standby"
            deactivated += 1
            # 최종 비활성 상태를 MQTT로 발행 (Server A에 즉시 반영)
            if self._mqtt_connected and self._mqtt_client:
                state_payload = {
                    "is_active": False,
                    "mode": "standby",
                    "ts": now.isoformat(),
                }
                topic = f"bees/devices/{device_id}/state"
                self._publish_mqtt(topic, state_payload)
        logger.info(f"시뮬레이션 정지 — 전체 장비 비활성화: {deactivated}대")

        # MQTT 연결 해제
        if self._mqtt_client:
            self._mqtt_client.loop_stop()
            self._mqtt_client.disconnect()
            self._mqtt_connected = False

        return {"status": "stopped", "message": f"시뮬레이션이 중지되었습니다. ({deactivated}대 장비 정지)"}

    def get_status(self) -> dict:
        """시뮬레이션 상태 조회."""
        uptime_seconds = None
        if self._start_time and self._running:
            uptime_seconds = (
                datetime.now(timezone.utc) - self._start_time
            ).total_seconds()

        return {
            "status": "running" if self._running else "stopped",
            "start_time": self._start_time.isoformat() if self._start_time else None,
            "uptime_seconds": round(uptime_seconds, 1) if uptime_seconds else None,
            "tick_count": self._tick_count,
            "interval_seconds": settings.SIMULATION_INTERVAL,
            "mqtt_connected": self._mqtt_connected,
            "device_count": len(self._devices),
            "point_count": len(self._profiles),
            "neo4j_loaded": self._neo4j_loaded,
            "alarm_total": self._alarm_checker.total_alarms,
            "alarm_suppressed": self._alarm_checker.suppressed_count,
            "active_scenario": self.scenario_manager.active.name,
            "active_faults": self.fault_manager.active_count,
            "thermal_models": len(self._thermal_models),
        }

    def get_all_devices(self) -> list[dict]:
        """전체 장비 상태 목록 반환."""
        result = []
        for device_id, device in self._devices.items():
            device_info = device.to_dict()
            # 연결된 센서의 최신값도 포함
            points_data = {}
            for point_id in device.connected_points:
                if point_id in self._latest_values:
                    points_data[point_id] = self._latest_values[point_id]
            device_info["latest_points"] = points_data
            result.append(device_info)
        return result

    def get_device(self, device_id: str) -> Optional[dict]:
        """특정 장비 상태 + 센서값 반환."""
        device = self._devices.get(device_id)
        if not device:
            return None

        device_info = device.to_dict()
        points_data = {}
        for point_id in device.connected_points:
            if point_id in self._latest_values:
                points_data[point_id] = self._latest_values[point_id]
        device_info["latest_points"] = points_data
        return device_info

    def execute_command(self, device_id: str, command: str, params: dict = None) -> dict:
        """
        장비 제어 명령 실행.
        - ON: 장비 활성화
        - OFF: 장비 비활성화
        - mode: 운전 모드 변경 (params.mode 필요)
        """
        device = self._devices.get(device_id)
        if not device:
            return {
                "success": False,
                "error": f"장비를 찾을 수 없습니다: {device_id}",
            }

        params = params or {}
        command_upper = command.upper()

        if command_upper == "ON":
            device.is_active = True
            logger.info(f"장비 ON: {device_id}")
            return {
                "success": True,
                "device_id": device_id,
                "command": "ON",
                "state": device.to_dict(),
            }

        elif command_upper == "OFF":
            device.is_active = False
            logger.info(f"장비 OFF: {device_id}")
            return {
                "success": True,
                "device_id": device_id,
                "command": "OFF",
                "state": device.to_dict(),
            }

        elif command_upper == "MODE":
            new_mode = params.get("mode", "auto")
            if new_mode not in ("auto", "manual", "standby"):
                return {
                    "success": False,
                    "error": f"유효하지 않은 모드: {new_mode}. 허용: auto, manual, standby",
                }
            device.mode = new_mode
            logger.info(f"장비 모드 변경: {device_id} → {new_mode}")
            return {
                "success": True,
                "device_id": device_id,
                "command": "MODE",
                "mode": new_mode,
                "state": device.to_dict(),
            }

        else:
            return {
                "success": False,
                "error": f"알 수 없는 명령: {command}. 허용: ON, OFF, MODE",
            }
