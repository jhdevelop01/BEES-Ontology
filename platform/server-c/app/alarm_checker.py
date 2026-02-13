"""
알람 체커 모듈.

센서값 임계값 초과 시 알람을 생성하고 중복 알람을 5분간 억제한다.
severity 결정: threshold 초과 10% → warning, 20% → critical.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("server-c.alarm")


@dataclass
class AlarmThreshold:
    """센서 카테고리별 알람 임계값."""
    high: Optional[float] = None
    low: Optional[float] = None


# ─────────────────────────────────────────────────────────────
# 센서 카테고리별 임계값
# ─────────────────────────────────────────────────────────────

ALARM_THRESHOLDS: dict[str, AlarmThreshold] = {
    "Temperature":            AlarmThreshold(high=30.0, low=15.0),
    "Humidity":               AlarmThreshold(high=70.0, low=25.0),
    "CO2":                    AlarmThreshold(high=1000.0),
    "Differential_Pressure":  AlarmThreshold(high=450.0),
    "Power":                  AlarmThreshold(high=100.0),
}

# Brick 포인트 클래스 → 알람 카테고리 매핑
# 수온 센서(Chilled/Hot/Condenser Water)는 운전 범위가 완전히 달라 제외
_SENSOR_CATEGORY: dict[str, str] = {
    # 공기 온도 센서
    "Zone_Air_Temperature_Sensor":   "Temperature",
    "Supply_Air_Temperature_Sensor": "Temperature",
    "Return_Air_Temperature_Sensor": "Temperature",
    "Mixed_Air_Temperature_Sensor":  "Temperature",
    # 습도
    "Zone_Air_Humidity_Sensor": "Humidity",
    "Humidity_Sensor":          "Humidity",
    # CO2
    "CO2_Sensor": "CO2",
    # 차압
    "Differential_Pressure_Sensor":        "Differential_Pressure",
    "Filter_Differential_Pressure_Sensor": "Differential_Pressure",
    # 전력
    "Electrical_Power_Sensor": "Power",
}

# 중복 알람 억제 시간 (초)
_SUPPRESS_SECONDS = 300  # 5분


# ─────────────────────────────────────────────────────────────
# 유틸리티
# ─────────────────────────────────────────────────────────────

def _strip_ns(brick_class: str) -> str:
    """네임스페이스 접두사 제거. 'brick:Foo' → 'Foo'."""
    return brick_class.split(":", 1)[1] if ":" in brick_class else brick_class


def _match_category(brick_class: str) -> Optional[str]:
    """Brick 포인트 클래스 → 알람 카테고리. 정확+부분 매칭."""
    name = _strip_ns(brick_class)
    # 정확 매칭
    if name in _SENSOR_CATEGORY:
        return _SENSOR_CATEGORY[name]
    # 부분 매칭 (접미사)
    for key, cat in _SENSOR_CATEGORY.items():
        if name.endswith(key):
            return cat
    # 부분 매칭 (포함)
    for key, cat in _SENSOR_CATEGORY.items():
        if key in name:
            return cat
    return None


# ─────────────────────────────────────────────────────────────
# AlarmChecker
# ─────────────────────────────────────────────────────────────

class AlarmChecker:
    """
    센서값 임계값 초과 시 알람 생성.

    severity 기준:
      - threshold 초과 10% → warning
      - threshold 초과 20% → critical
    중복 알람: 같은 포인트+알람타입 조합은 5분 내 재발행 억제.
    """

    def __init__(self):
        # {point_id: {alarm_type: last_alarm_datetime}}
        self._suppression: dict[str, dict[str, datetime]] = {}
        # 통계
        self.total_alarms: int = 0
        self.suppressed_count: int = 0

    def check(
        self,
        point_id: str,
        value: float,
        brick_class: str,
        equipment_id: str,
        now: Optional[datetime] = None,
    ) -> list[dict]:
        """
        센서값을 임계값과 비교하여 알람 생성.

        Args:
            point_id: 포인트 ID (예: 'bldg:Zone_Air_Temp_5F')
            value: 현재 센서값
            brick_class: Brick 포인트 클래스 (예: 'brick:Zone_Air_Temperature_Sensor')
            equipment_id: 장비 ID (예: 'bldg:AHU_5F')
            now: 현재 시각 (None이면 UTC now)

        Returns:
            알람 딕셔너리 리스트. 비어있으면 정상 범위.
        """
        if now is None:
            now = datetime.now(timezone.utc)

        category = _match_category(brick_class)
        if category is None:
            return []

        threshold = ALARM_THRESHOLDS.get(category)
        if threshold is None:
            return []

        alarms: list[dict] = []

        # ── High 임계값 체크 ──
        if threshold.high is not None:
            sev = self._severity_high(value, threshold.high)
            if sev:
                alarm_type = f"high_{category.lower()}"
                if self._is_suppressed(point_id, alarm_type, now):
                    self.suppressed_count += 1
                else:
                    self._record(point_id, alarm_type, now)
                    self.total_alarms += 1
                    alarms.append(self._make_alarm(
                        equipment_id, point_id, alarm_type,
                        sev, value, threshold.high, now,
                    ))

        # ── Low 임계값 체크 ──
        if threshold.low is not None:
            sev = self._severity_low(value, threshold.low)
            if sev:
                alarm_type = f"low_{category.lower()}"
                if self._is_suppressed(point_id, alarm_type, now):
                    self.suppressed_count += 1
                else:
                    self._record(point_id, alarm_type, now)
                    self.total_alarms += 1
                    alarms.append(self._make_alarm(
                        equipment_id, point_id, alarm_type,
                        sev, value, threshold.low, now,
                    ))

        return alarms

    # ── severity 판정 ──

    @staticmethod
    def _severity_high(value: float, threshold: float) -> Optional[str]:
        """High 임계값: 20% 초과→critical, 10% 초과→warning."""
        if value >= threshold * 1.2:
            return "critical"
        if value >= threshold * 1.1:
            return "warning"
        return None

    @staticmethod
    def _severity_low(value: float, threshold: float) -> Optional[str]:
        """Low 임계값: 20% 미달→critical, 10% 미달→warning."""
        if value <= threshold * 0.8:
            return "critical"
        if value <= threshold * 0.9:
            return "warning"
        return None

    # ── 중복 억제 ──

    def _is_suppressed(self, point_id: str, alarm_type: str, now: datetime) -> bool:
        """같은 포인트+알람타입 5분 내 재발행 억제."""
        last = self._suppression.get(point_id, {}).get(alarm_type)
        if last is None:
            return False
        return (now - last).total_seconds() < _SUPPRESS_SECONDS

    def _record(self, point_id: str, alarm_type: str, now: datetime) -> None:
        """알람 발생 시각 기록."""
        self._suppression.setdefault(point_id, {})[alarm_type] = now

    # ── 페이로드 생성 ──

    @staticmethod
    def _make_alarm(
        equipment: str, point_id: str, alarm_type: str,
        severity: str, value: float, threshold: float, now: datetime,
    ) -> dict:
        """알람 MQTT 페이로드 생성."""
        alarm = {
            "equipment": equipment,
            "point_id": point_id,
            "alarm_type": alarm_type,
            "severity": severity,
            "value": value,
            "threshold": threshold,
            "ts": now.isoformat(),
        }
        logger.info(
            f"알람 발생: {point_id} {alarm_type} "
            f"(값={value}, 임계값={threshold}, 심각도={severity})"
        )
        return alarm
