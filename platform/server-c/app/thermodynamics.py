"""
HVAC 열역학 모델링 모듈.

1차 에너지 밸런스 기반으로 존 온도를 계산한다:
  dT_zone/dt = (UA*(T_out - T_zone) + Q_solar + Q_internal - Q_hvac) / C_thermal

PI 제어기로 설정온도 추종:
  Q_hvac = Kp * error + Ki * integral(error)
"""

import logging
from dataclasses import dataclass, field

logger = logging.getLogger("server-c.thermal")


# ─────────────────────────────────────────────────────────────
# 존별 열역학 파라미터
# ─────────────────────────────────────────────────────────────

@dataclass
class ZoneParams:
    """존별 열역학 파라미터."""

    zone_id: str
    ua_value: float = 500.0         # 열관류율 × 면적 (W/K) — 외피 열손실 계수
    volume: float = 1500.0          # 존 체적 (m³)
    q_internal_max: float = 5000.0  # 최대 내부 발열량 (W) — 재실+조명+기기
    tau: float = 2700.0             # 열적 시정수 (초, 기본 45분)
    setpoint: float = 24.0          # 설정 온도 (°C)

    @property
    def c_thermal(self) -> float:
        """열용량 (J/K) = UA * tau."""
        return self.ua_value * self.tau


# ─────────────────────────────────────────────────────────────
# 기본 존 파라미터 매핑 (층별 규모에 따라 다름)
# ─────────────────────────────────────────────────────────────

# 층 유형별 기본 파라미터
_ZONE_DEFAULTS: dict[str, dict] = {
    "office": {          # 일반 사무 공간 (5F~20F)
        "ua_value": 500.0,
        "volume": 1500.0,
        "q_internal_max": 5000.0,
        "tau": 2700.0,
    },
    "lobby": {           # 로비/저층 (1F~2F)
        "ua_value": 800.0,
        "volume": 3000.0,
        "q_internal_max": 3000.0,
        "tau": 1800.0,
    },
    "mechanical": {      # 기계실 (B1~B2, RF)
        "ua_value": 300.0,
        "volume": 2000.0,
        "q_internal_max": 1000.0,
        "tau": 3600.0,
    },
}


def _guess_zone_type(zone_id: str) -> str:
    """존 ID에서 유형 추정."""
    zone_lower = zone_id.lower()
    if any(k in zone_lower for k in ["b1", "b2", "rf", "rooftop", "mechanical", "basement"]):
        return "mechanical"
    if any(k in zone_lower for k in ["1f", "2f", "lobby", "ground"]):
        return "lobby"
    return "office"


# ─────────────────────────────────────────────────────────────
# ThermalModel
# ─────────────────────────────────────────────────────────────

class ThermalModel:
    """
    존 열역학 모델.

    1차 에너지 밸런스:
      C_thermal * dT/dt = UA*(T_out - T_zone) + Q_solar + Q_internal - Q_hvac

    PI 제어기:
      error = setpoint - T_zone
      Q_hvac = Kp * error + Ki * integral(error)
      Q_hvac는 0 ~ Q_hvac_max 범위로 클리핑
    """

    def __init__(self, zone_id: str, initial_temp: float = 24.0):
        self.zone_id = zone_id
        self.t_zone = initial_temp

        # 존 파라미터 초기화
        zone_type = _guess_zone_type(zone_id)
        defaults = _ZONE_DEFAULTS.get(zone_type, _ZONE_DEFAULTS["office"])

        self.params = ZoneParams(
            zone_id=zone_id,
            ua_value=defaults["ua_value"],
            volume=defaults["volume"],
            q_internal_max=defaults["q_internal_max"],
            tau=defaults["tau"],
        )

        # PI 제어기 상태
        self._integral_error: float = 0.0
        self._kp: float = 2000.0        # 비례 게인 (W/K)
        self._ki: float = 100.0         # 적분 게인 (W/(K·s))
        self._q_hvac_max: float = 30000.0  # 최대 HVAC 출력 (W)

    def step(
        self,
        dt: float,
        outdoor_temp: float,
        occupancy: float,
        hvac_active: bool,
        setpoint: float,
        solar_radiation: float = 0.0,
        solar_factor: float = 1.0,
        capacity_reduction: float = 0.0,
        valve_leak: float = 0.0,
    ) -> float:
        """
        열역학 시뮬레이션 한 스텝 진행.

        Args:
            dt: 시간 간격 (초)
            outdoor_temp: 외기온 (°C)
            occupancy: 재실률 (0.0 ~ 1.0)
            hvac_active: HVAC 가동 여부
            setpoint: 설정 온도 (°C)
            solar_radiation: 태양 복사량 (W/m²)
            solar_factor: 태양 복사 보정 계수
            capacity_reduction: HVAC 성능 저하율 (0.0 ~ 1.0)
            valve_leak: 밸브 누설률 (0.0 ~ 1.0)

        Returns:
            새로운 존 온도 (°C)
        """
        p = self.params

        # ── 열부하 계산 ──

        # 외피 열전달: UA * (T_out - T_zone)
        q_envelope = p.ua_value * (outdoor_temp - self.t_zone)

        # 태양 복사 열획득 (창면적 비율 0.3, 투과율 0.4)
        window_area = 0.3 * (p.volume ** (2.0 / 3.0))  # 체적에서 추정
        q_solar = solar_radiation * solar_factor * window_area * 0.4

        # 내부 발열 (재실률에 비례)
        q_internal = p.q_internal_max * occupancy

        # ── HVAC 출력 (PI 제어기) ──
        q_hvac = 0.0
        if hvac_active:
            error = setpoint - self.t_zone

            # 적분기 업데이트 (anti-windup: ±50K·s 제한)
            self._integral_error += error * dt
            self._integral_error = max(-50.0 * dt, min(50.0 * dt, self._integral_error))

            q_hvac = self._kp * error + self._ki * self._integral_error

            # HVAC 출력 범위 제한
            # 양수: 난방, 음수: 냉방 (부호 반전 — 열 제거)
            max_output = self._q_hvac_max * (1.0 - capacity_reduction)
            q_hvac = max(-max_output, min(max_output, q_hvac))

            # 밸브 누설 효과: HVAC 효율 감소
            if valve_leak > 0:
                q_hvac *= (1.0 - valve_leak * 0.5)

        # ── 에너지 밸런스 ──
        # C * dT/dt = q_envelope + q_solar + q_internal + q_hvac
        # (q_hvac 양수 = 존에 열 공급 = 난방, 음수 = 열 제거 = 냉방)
        c_thermal = p.c_thermal
        dT = (q_envelope + q_solar + q_internal + q_hvac) / c_thermal * dt

        self.t_zone += dT

        # 물리적 범위 제한 (극단적 발산 방지)
        self.t_zone = max(5.0, min(45.0, self.t_zone))

        return round(self.t_zone, 2)

    def reset(self, temp: float = 24.0) -> None:
        """모델 상태 리셋."""
        self.t_zone = temp
        self._integral_error = 0.0
