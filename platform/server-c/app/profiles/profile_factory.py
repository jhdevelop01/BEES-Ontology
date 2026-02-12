"""
프로파일 팩토리 모듈.

Brick Schema 포인트 클래스를 시뮬레이션 파라미터로 매핑하고,
Neo4j에서 로딩한 장비/센서 정보를 DataProfile, DeviceProfile로 변환한다.

Phase 2: 845개 인스턴스 전체 시뮬레이션을 위한 자동 프로파일 생성.
"""

import math
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from .ahu_5f import DataProfile, DeviceProfile


# ─────────────────────────────────────────────────────────────
# 포인트 클래스별 시뮬레이션 스펙
# ─────────────────────────────────────────────────────────────

@dataclass
class PointProfileSpec:
    """Brick Schema 포인트 클래스에 대한 시뮬레이션 파라미터 정의."""

    base_value: float               # 기준값 (정상 운전 시)
    noise_range: float              # 랜덤 노이즈 범위 (+--)
    unit: str                       # 측정 단위
    min_value: float                # 물리적 최소값
    max_value: float                # 물리적 최대값
    daily_amplitude: float          # 일간 사인파 진폭
    off_base_value: Optional[float] = None  # 장비 OFF 시 기준값
    drift_rate: float = 0.0         # 시간당 드리프트 (점진 변화)
    seasonal_amplitude: float = 0.0 # 계절 보정 진폭
    seasonal_phase_month: int = 7   # 계절 보정 피크 월 (기본: 7월=한여름)


# Brick 포인트 클래스 → 시뮬레이션 스펙 매핑
# 키: Brick Schema 클래스명 (네임스페이스 제외)
POINT_SPECS: dict[str, PointProfileSpec] = {
    # ── 온도 센서 ──
    "Zone_Air_Temperature_Sensor": PointProfileSpec(
        base_value=24.0, noise_range=2.0, unit="degC",
        min_value=15.0, max_value=35.0, daily_amplitude=2.0,
        off_base_value=None, seasonal_amplitude=3.0, seasonal_phase_month=7,
    ),
    "Supply_Air_Temperature_Sensor": PointProfileSpec(
        base_value=16.0, noise_range=0.5, unit="degC",
        min_value=10.0, max_value=30.0, daily_amplitude=0.5,
        off_base_value=24.0, seasonal_amplitude=1.0, seasonal_phase_month=7,
    ),
    "Return_Air_Temperature_Sensor": PointProfileSpec(
        base_value=23.0, noise_range=1.0, unit="degC",
        min_value=15.0, max_value=35.0, daily_amplitude=1.5,
        off_base_value=None, seasonal_amplitude=2.5, seasonal_phase_month=7,
    ),
    "Mixed_Air_Temperature_Sensor": PointProfileSpec(
        base_value=20.0, noise_range=1.5, unit="degC",
        min_value=5.0, max_value=35.0, daily_amplitude=2.0,
        off_base_value=None, seasonal_amplitude=4.0, seasonal_phase_month=7,
    ),
    "Chilled_Water_Supply_Temperature_Sensor": PointProfileSpec(
        base_value=7.0, noise_range=0.3, unit="degC",
        min_value=4.0, max_value=15.0, daily_amplitude=0.3,
        off_base_value=12.0, seasonal_amplitude=0.5, seasonal_phase_month=7,
    ),
    "Chilled_Water_Return_Temperature_Sensor": PointProfileSpec(
        base_value=12.0, noise_range=0.5, unit="degC",
        min_value=6.0, max_value=20.0, daily_amplitude=0.5,
        off_base_value=12.0, seasonal_amplitude=0.8, seasonal_phase_month=7,
    ),
    "Hot_Water_Supply_Temperature_Sensor": PointProfileSpec(
        base_value=60.0, noise_range=1.0, unit="degC",
        min_value=40.0, max_value=80.0, daily_amplitude=1.0,
        off_base_value=25.0, seasonal_amplitude=2.0, seasonal_phase_month=1,
    ),
    "Hot_Water_Return_Temperature_Sensor": PointProfileSpec(
        base_value=45.0, noise_range=1.5, unit="degC",
        min_value=30.0, max_value=70.0, daily_amplitude=1.5,
        off_base_value=25.0, seasonal_amplitude=1.5, seasonal_phase_month=1,
    ),
    "Condenser_Water_Temperature_Sensor": PointProfileSpec(
        base_value=32.0, noise_range=1.0, unit="degC",
        min_value=20.0, max_value=45.0, daily_amplitude=1.0,
        off_base_value=25.0, seasonal_amplitude=3.0, seasonal_phase_month=7,
    ),

    # ── 습도 센서 ──
    "Zone_Air_Humidity_Sensor": PointProfileSpec(
        base_value=50.0, noise_range=5.0, unit="%RH",
        min_value=20.0, max_value=80.0, daily_amplitude=3.0,
        off_base_value=60.0, seasonal_amplitude=10.0, seasonal_phase_month=7,
    ),
    "Humidity_Sensor": PointProfileSpec(
        base_value=50.0, noise_range=5.0, unit="%RH",
        min_value=20.0, max_value=80.0, daily_amplitude=3.0,
        off_base_value=60.0, seasonal_amplitude=10.0, seasonal_phase_month=7,
    ),

    # ── 압력 센서 ──
    "Differential_Pressure_Sensor": PointProfileSpec(
        base_value=100.0, noise_range=10.0, unit="Pa",
        min_value=0.0, max_value=500.0, daily_amplitude=5.0,
        off_base_value=0.0, drift_rate=0.2,
    ),
    "Filter_Differential_Pressure_Sensor": PointProfileSpec(
        base_value=250.0, noise_range=10.0, unit="Pa",
        min_value=100.0, max_value=500.0, daily_amplitude=5.0,
        off_base_value=0.0, drift_rate=0.5,
    ),

    # ── 전력/에너지 센서 ──
    "Electrical_Power_Sensor": PointProfileSpec(
        base_value=35.0, noise_range=2.0, unit="kW",
        min_value=0.0, max_value=1000.0, daily_amplitude=3.0,
        off_base_value=0.5,
    ),
    "Energy_Sensor": PointProfileSpec(
        base_value=100.0, noise_range=5.0, unit="kWh",
        min_value=0.0, max_value=10000.0, daily_amplitude=10.0,
        off_base_value=0.0,
    ),

    # ── 유량 센서 ──
    "Water_Flow_Sensor": PointProfileSpec(
        base_value=50.0, noise_range=3.0, unit="L/min",
        min_value=0.0, max_value=500.0, daily_amplitude=5.0,
        off_base_value=0.0,
    ),

    # ── 상태/바이너리 ──
    "On_Off_Status": PointProfileSpec(
        base_value=1.0, noise_range=0.0, unit="",
        min_value=0.0, max_value=1.0, daily_amplitude=0.0,
        off_base_value=0.0,
    ),
    "Fan_On_Off_Status": PointProfileSpec(
        base_value=1.0, noise_range=0.0, unit="",
        min_value=0.0, max_value=1.0, daily_amplitude=0.0,
        off_base_value=0.0,
    ),

    # ── CO2 센서 ──
    "CO2_Sensor": PointProfileSpec(
        base_value=450.0, noise_range=50.0, unit="ppm",
        min_value=350.0, max_value=2000.0, daily_amplitude=100.0,
        off_base_value=600.0, seasonal_amplitude=0.0,
    ),

    # ── 수위 센서 ──
    "Water_Level_Sensor": PointProfileSpec(
        base_value=70.0, noise_range=3.0, unit="%",
        min_value=0.0, max_value=100.0, daily_amplitude=2.0,
        off_base_value=50.0,
    ),

    # ── 제어 명령 (커맨드) ──
    "Valve_Command": PointProfileSpec(
        base_value=50.0, noise_range=0.0, unit="%",
        min_value=0.0, max_value=100.0, daily_amplitude=0.0,
        off_base_value=0.0,
    ),
    "Fan_Speed_Command": PointProfileSpec(
        base_value=60.0, noise_range=0.0, unit="%",
        min_value=0.0, max_value=100.0, daily_amplitude=0.0,
        off_base_value=0.0,
    ),
    "Damper_Position_Command": PointProfileSpec(
        base_value=50.0, noise_range=0.0, unit="%",
        min_value=0.0, max_value=100.0, daily_amplitude=0.0,
        off_base_value=0.0,
    ),
    "Frequency_Command": PointProfileSpec(
        base_value=50.0, noise_range=0.0, unit="Hz",
        min_value=0.0, max_value=60.0, daily_amplitude=0.0,
        off_base_value=0.0,
    ),

    # ── 설정값 (Setpoint) ──
    "Supply_Air_Temperature_Setpoint": PointProfileSpec(
        base_value=16.0, noise_range=0.0, unit="degC",
        min_value=10.0, max_value=25.0, daily_amplitude=0.0,
    ),
    "Zone_Air_Temperature_Setpoint": PointProfileSpec(
        base_value=24.0, noise_range=0.0, unit="degC",
        min_value=18.0, max_value=28.0, daily_amplitude=0.0,
    ),
    "Chilled_Water_Supply_Temperature_Setpoint": PointProfileSpec(
        base_value=7.0, noise_range=0.0, unit="degC",
        min_value=4.0, max_value=12.0, daily_amplitude=0.0,
    ),

    # ── 알람 ──
    "Alarm": PointProfileSpec(
        base_value=0.0, noise_range=0.0, unit="",
        min_value=0.0, max_value=1.0, daily_amplitude=0.0,
        off_base_value=0.0,
    ),
}


# ─────────────────────────────────────────────────────────────
# 장비 유형별 전력 센서 오버라이드 (kW)
# ─────────────────────────────────────────────────────────────

EQUIPMENT_POWER_OVERRIDE: dict[str, dict] = {
    "Chiller": {"base_value": 750.0, "off_base_value": 2.0, "noise_range": 20.0,
                "max_value": 1000.0, "daily_amplitude": 30.0},
    "Boiler": {"base_value": 30.0, "off_base_value": 0.3, "noise_range": 2.0,
               "max_value": 50.0, "daily_amplitude": 3.0},
    "AHU": {"base_value": 35.0, "off_base_value": 0.5, "noise_range": 2.0,
            "max_value": 50.0, "daily_amplitude": 3.0},
    "Cooling_Tower": {"base_value": 15.0, "off_base_value": 0.2, "noise_range": 1.0,
                      "max_value": 25.0, "daily_amplitude": 2.0},
    "Fan_Coil_Unit": {"base_value": 0.5, "off_base_value": 0.02, "noise_range": 0.05,
                      "max_value": 1.0, "daily_amplitude": 0.1},
    "Exhaust_Fan": {"base_value": 5.0, "off_base_value": 0.1, "noise_range": 0.3,
                    "max_value": 8.0, "daily_amplitude": 0.5},
    "Supply_Fan": {"base_value": 7.0, "off_base_value": 0.1, "noise_range": 0.5,
                   "max_value": 12.0, "daily_amplitude": 0.7},
}


# ─────────────────────────────────────────────────────────────
# 계절 보정 함수 (서울 기후 기반 사인파)
# ─────────────────────────────────────────────────────────────

def seasonal_correction(now: datetime, amplitude: float, peak_month: int) -> float:
    """
    서울 기후 기반 계절 보정값 계산.

    사인파로 연중 변화를 모델링한다.
    - peak_month=7이면 7월에 최대, 1월에 최소 (냉방 부하)
    - peak_month=1이면 1월에 최대, 7월에 최소 (난방 부하)

    Parameters:
        now: 현재 시각
        amplitude: 계절 보정 진폭 (최대 변동량)
        peak_month: 피크 월 (1~12)

    Returns:
        계절 보정값 (-amplitude ~ +amplitude)
    """
    if amplitude == 0.0:
        return 0.0

    # 현재 월을 연속값으로 변환 (1월=1.0, 6월15일=6.5 ...)
    month_continuous = now.month + (now.day - 1) / 30.0

    # peak_month에서 최대값이 되도록 사인파 위상 조정
    # sin(x)는 x=pi/2에서 최대 → phase = peak_month - 3
    phase = peak_month - 3.0
    return amplitude * math.sin(2 * math.pi * (month_continuous - phase) / 12.0)


# ─────────────────────────────────────────────────────────────
# 프로파일 생성 함수
# ─────────────────────────────────────────────────────────────

def _strip_namespace(brick_class: str) -> str:
    """
    Brick Schema 클래스에서 네임스페이스 접두사를 제거.
    예: 'brick:Zone_Air_Temperature_Sensor' → 'Zone_Air_Temperature_Sensor'
        'Zone_Air_Temperature_Sensor' → 'Zone_Air_Temperature_Sensor'
    """
    if ":" in brick_class:
        return brick_class.split(":", 1)[1]
    return brick_class


def _find_spec(brick_class: str) -> Optional[PointProfileSpec]:
    """
    Brick 클래스에 매칭되는 PointProfileSpec을 탐색.
    정확 매칭 → 부분 매칭 (접미사 기반) → None 순서.
    """
    class_name = _strip_namespace(brick_class)

    # 1) 정확 매칭
    if class_name in POINT_SPECS:
        return POINT_SPECS[class_name]

    # 2) 부분 매칭: 클래스 이름에 스펙 키가 포함된 경우
    #    예: 'Chilled_Water_Differential_Pressure_Sensor' → 'Differential_Pressure_Sensor'
    for spec_key, spec in POINT_SPECS.items():
        if class_name.endswith(spec_key):
            return spec

    # 3) 더 넓은 부분 매칭: 스펙 키가 클래스 이름에 포함된 경우
    for spec_key, spec in POINT_SPECS.items():
        if spec_key in class_name:
            return spec

    return None


def create_data_profile(
    point_id: str,
    brick_class: str,
    equipment_id: str,
    equipment_class: str,
) -> Optional[DataProfile]:
    """
    Brick Schema 포인트 클래스로부터 DataProfile을 자동 생성.

    Parameters:
        point_id: 온톨로지 포인트 ID (예: 'bldg:Zone_Air_Temp_5F_Interior')
        brick_class: Brick Schema 포인트 클래스 (예: 'brick:Zone_Air_Temperature_Sensor')
        equipment_id: 의존 장비 ID (예: 'bldg:AHU_5F')
        equipment_class: 장비의 Brick 클래스 (예: 'brick:AHU')

    Returns:
        DataProfile 인스턴스 또는 None (매칭 스펙 없는 경우)
    """
    spec = _find_spec(brick_class)
    if spec is None:
        return None

    # 기본값 설정
    base_value = spec.base_value
    noise_range = spec.noise_range
    off_base_value = spec.off_base_value
    max_value = spec.max_value
    daily_amplitude = spec.daily_amplitude

    # 전력 센서의 경우 장비 유형별 오버라이드 적용
    class_name = _strip_namespace(brick_class)
    eq_class_name = _strip_namespace(equipment_class)

    if class_name == "Electrical_Power_Sensor" and eq_class_name in EQUIPMENT_POWER_OVERRIDE:
        override = EQUIPMENT_POWER_OVERRIDE[eq_class_name]
        base_value = override.get("base_value", base_value)
        off_base_value = override.get("off_base_value", off_base_value)
        noise_range = override.get("noise_range", noise_range)
        max_value = override.get("max_value", max_value)
        daily_amplitude = override.get("daily_amplitude", daily_amplitude)

    return DataProfile(
        point_id=point_id,
        brick_class=brick_class,
        base_value=base_value,
        noise_range=noise_range,
        unit=spec.unit,
        min_value=spec.min_value,
        max_value=max_value,
        daily_amplitude=daily_amplitude,
        equipment_dependency=equipment_id,
        off_base_value=off_base_value,
        drift_rate=spec.drift_rate,
    )


def create_device_profile(
    equipment_id: str,
    brick_class: str,
    location_id: str,
    connected_point_ids: list[str],
) -> DeviceProfile:
    """
    Neo4j에서 로딩한 장비 정보를 DeviceProfile로 변환.

    Parameters:
        equipment_id: 온톨로지 장비 ID (예: 'bldg:AHU_5F')
        brick_class: Brick Schema 장비 클래스 (예: 'brick:AHU')
        location_id: 설치 위치 (예: 'bldg:Floor_5F')
        connected_point_ids: 연결된 포인트 ID 목록

    Returns:
        DeviceProfile 인스턴스
    """
    return DeviceProfile(
        device_id=equipment_id,
        brick_class=brick_class,
        location=location_id or "unknown",
        connected_points=connected_point_ids,
    )
