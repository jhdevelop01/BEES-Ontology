"""
AHU_5F 장비 및 연결 센서 5개의 데이터 생성 프로파일.

Phase 1 MVP: 단일 장비(AHU_5F)와 5개 센서만 시뮬레이션.
각 센서는 Brick Schema 클래스 기반으로 현실적인 데이터를 생성한다.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class DataProfile:
    """센서 데이터 생성 프로파일 정의."""

    point_id: str               # 온톨로지 포인트 ID (예: "bldg:Zone_Air_Temp_5F_Interior")
    brick_class: str            # Brick Schema 클래스명
    base_value: float           # 기준값 (정상 운전 시)
    noise_range: float          # 랜덤 노이즈 범위 (±)
    unit: str                   # 측정 단위
    min_value: float            # 물리적 최소값
    max_value: float            # 물리적 최대값
    daily_amplitude: float      # 일간 사인파 진폭
    equipment_dependency: str   # 의존 장비 ID (장비 상태에 따른 값 변경)
    off_base_value: Optional[float] = None  # 장비 OFF 시 기준값 (None이면 base_value 유지)
    drift_rate: float = 0.0     # 시간당 드리프트 (점진 변화, Pa/hour 등)


@dataclass
class DeviceProfile:
    """장비 프로파일 정의."""

    device_id: str              # 온톨로지 장비 ID
    brick_class: str            # Brick Schema 클래스명
    location: str               # 설치 위치
    connected_points: list = field(default_factory=list)  # 연결된 센서 ID 목록


# ─────────────────────────────────────────────────────────────
# AHU_5F 장비 프로파일
# ─────────────────────────────────────────────────────────────

AHU_5F_DEVICE = DeviceProfile(
    device_id="bldg:AHU_5F",
    brick_class="brick:AHU",
    location="bldg:Floor_5F",
    connected_points=[
        "bldg:Zone_Air_Temp_5F_Interior",
        "bldg:Zone_Air_Humidity_5F_Interior",
        "bldg:Supply_Air_Temp_AHU_5F",
        "bldg:Filter_DP_AHU_5F",
        "bldg:Power_AHU_5F",
    ],
)


# ─────────────────────────────────────────────────────────────
# 연결 센서 5개 프로파일
# ─────────────────────────────────────────────────────────────

AHU_5F_PROFILES: list[DataProfile] = [
    # 1) 존 공기 온도 센서 — 24°C 기준, ±2°C 노이즈, 일간 사인파
    DataProfile(
        point_id="bldg:Zone_Air_Temp_5F_Interior",
        brick_class="brick:Zone_Air_Temperature_Sensor",
        base_value=24.0,
        noise_range=2.0,
        unit="degC",
        min_value=15.0,
        max_value=35.0,
        daily_amplitude=2.0,          # 낮 +2°C, 새벽 -2°C
        equipment_dependency="bldg:AHU_5F",
        off_base_value=None,          # AHU OFF → 외기 수렴 (engine에서 처리)
    ),

    # 2) 존 공기 습도 센서 — 50% 기준, ±5% 노이즈
    DataProfile(
        point_id="bldg:Zone_Air_Humidity_5F_Interior",
        brick_class="brick:Zone_Air_Humidity_Sensor",
        base_value=50.0,
        noise_range=5.0,
        unit="%RH",
        min_value=20.0,
        max_value=80.0,
        daily_amplitude=3.0,          # 일간 소폭 변동
        equipment_dependency="bldg:AHU_5F",
        off_base_value=60.0,          # AHU OFF → 습도 상승
    ),

    # 3) 급기 온도 센서 — 16°C 기준, AHU ON/OFF 의존
    DataProfile(
        point_id="bldg:Supply_Air_Temp_AHU_5F",
        brick_class="brick:Supply_Air_Temperature_Sensor",
        base_value=16.0,
        noise_range=0.5,
        unit="degC",
        min_value=10.0,
        max_value=30.0,
        daily_amplitude=0.5,          # AHU ON 시 안정적
        equipment_dependency="bldg:AHU_5F",
        off_base_value=24.0,          # AHU OFF → 외기 수렴 (실온 근접)
    ),

    # 4) 필터 차압 센서 — 250Pa 기준, 점진 증가 (오염 시뮬레이션)
    DataProfile(
        point_id="bldg:Filter_DP_AHU_5F",
        brick_class="brick:Filter_Differential_Pressure_Sensor",
        base_value=250.0,
        noise_range=10.0,
        unit="Pa",
        min_value=100.0,
        max_value=500.0,
        daily_amplitude=5.0,          # 일간 미세 변동
        equipment_dependency="bldg:AHU_5F",
        off_base_value=0.0,           # AHU OFF → 차압 없음
        drift_rate=0.5,               # 시간당 0.5Pa 증가 (필터 오염)
    ),

    # 5) 전력 센서 — ON시 35kW, OFF시 0.5kW (대기전력)
    DataProfile(
        point_id="bldg:Power_AHU_5F",
        brick_class="brick:Electrical_Power_Sensor",
        base_value=35.0,
        noise_range=2.0,
        unit="kW",
        min_value=0.0,
        max_value=50.0,
        daily_amplitude=3.0,          # 부하에 따른 변동
        equipment_dependency="bldg:AHU_5F",
        off_base_value=0.5,           # AHU OFF → 대기전력만
    ),
]
