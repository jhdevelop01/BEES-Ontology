"""
시뮬레이션 엔진 모듈.

EmulatorEngine: AsyncIO 기반 메인 루프로 5초 간격 데이터 생성.
DeviceState: 장비 런타임 상태 관리.
데이터 생성 공식: value = base_value + noise * random(-1,1) + daily_pattern(hour) + equipment_effect + seasonal + drift
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

from .config import settings
from .profiles.ahu_5f import AHU_5F_DEVICE, AHU_5F_PROFILES, DataProfile, DeviceProfile
from .profiles.profile_factory import (
    POINT_SPECS,
    create_data_profile,
    create_device_profile,
    seasonal_correction,
    _strip_namespace,
)
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

        # Neo4j 로딩 상태 (Phase 2)
        self._neo4j_loaded: bool = False

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
                else:
                    skipped_points += 1
                    logger.debug(
                        f"프로파일 스펙 없음 (스킵): {pt_id} ({pt_class})"
                    )

        self._neo4j_loaded = True
        result = {
            "mode": "neo4j_full",
            "device_count": len(self._devices),
            "point_count": len(self._profiles),
            "skipped_points": skipped_points,
        }
        logger.info(
            f"Neo4j 기반 프로파일 생성 완료: "
            f"장비 {result['device_count']}개, "
            f"포인트 {result['point_count']}개, "
            f"스킵 {skipped_points}개"
        )
        return result

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

    def _generate_value(self, profile: DataProfile, now: datetime) -> float:
        """
        센서 데이터 생성 공식:
        value = base_value + noise * random(-1, 1) + daily_pattern(hour) + equipment_effect + seasonal + drift

        특수 처리:
        - 바이너리 클래스 (On_Off_Status, Fan_On_Off_Status, Alarm): 0.0 또는 1.0
        - Setpoint 클래스: 고정 base_value (노이즈/일간패턴 없음)
        """
        class_name = _strip_namespace(profile.brick_class)

        # ── 바이너리 포인트 (상태/알람) ──
        if class_name in _BINARY_CLASSES:
            device = self._devices.get(profile.equipment_dependency)
            if device and device.is_active:
                return 1.0
            return 0.0

        # ── Setpoint (설정값) — 고정값 ──
        if class_name in _SETPOINT_CLASSES:
            return profile.base_value

        # ── 일반 센서 데이터 생성 ──
        hour = now.hour + now.minute / 60.0

        # 기본값 + 랜덤 노이즈
        noise = profile.noise_range * random.uniform(-1, 1)

        # 일간 패턴
        daily = self._daily_pattern(hour, profile.daily_amplitude)

        # 장비 효과
        eq_effect = self._equipment_effect(profile)

        # 계절 보정 (서울 기후)
        spec = None
        from .profiles.profile_factory import _find_spec
        spec = _find_spec(profile.brick_class)
        seasonal = 0.0
        if spec and spec.seasonal_amplitude > 0:
            seasonal = seasonal_correction(
                now, spec.seasonal_amplitude, spec.seasonal_phase_month
            )

        # 드리프트 (점진 변화, 예: 필터 오염)
        drift = self._drift_accumulator.get(profile.point_id, 0.0)

        # 최종값 계산
        value = profile.base_value + noise + daily + eq_effect + seasonal + drift

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

        while self._running:
            try:
                now = datetime.now(timezone.utc)
                self._tick_count += 1

                # 모든 센서 프로파일에 대해 데이터 생성
                for point_id, profile in self._profiles.items():
                    # 값 생성
                    value = self._generate_value(profile, now)

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

                # 장비 상태 발행
                for device_id, device in self._devices.items():
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

        # MQTT 연결
        self._setup_mqtt()

        # AsyncIO 태스크 시작
        self._task = asyncio.create_task(self._simulation_loop())

        logger.info("시뮬레이션 시작")
        return {"status": "started", "message": "시뮬레이션이 시작되었습니다."}

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

        # MQTT 연결 해제
        if self._mqtt_client:
            self._mqtt_client.loop_stop()
            self._mqtt_client.disconnect()
            self._mqtt_connected = False

        logger.info("시뮬레이션 중지")
        return {"status": "stopped", "message": "시뮬레이션이 중지되었습니다."}

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
