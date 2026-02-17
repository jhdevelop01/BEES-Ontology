"""
BEES Platform — Server D 데이터 품질 검사기

센서 데이터의 품질을 자동으로 판별한다:
  1. 범위 검사 (센서 유형별 유효 범위)
  2. 변화율 검사 (급격한 변화 감지)
  3. 통계적 이상치 검사 (이동평균 ±3σ)

품질 태그: 'good', 'uncertain', 'bad'
"""

import logging
import time
from collections import deque
from typing import Optional

logger = logging.getLogger("server-d.quality")


class DataQualityChecker:
    """센서 데이터 품질 검사기."""

    # 센서 유형별 유효 범위
    RANGES: dict[str, tuple[float, float]] = {
        "Temperature": (-10, 50),       # °C
        "Humidity": (0, 100),           # %
        "CO2": (300, 5000),             # ppm
        "Pressure": (0, 2000),          # Pa
        "Power": (0, 10000),            # kW
        "Flow": (0, 1000),              # L/s
        "Speed": (0, 100),              # %
        "Damper": (0, 100),             # %
        "Valve": (0, 100),              # %
    }

    # 변화율 제한 (분당 최대 변화량)
    RATE_LIMITS: dict[str, float] = {
        "Temperature": 10.0,    # °C/min
        "Humidity": 20.0,       # %/min
        "CO2": 500.0,          # ppm/min
        "Pressure": 200.0,     # Pa/min
    }

    def __init__(self, window_size: int = 60) -> None:
        """
        Args:
            window_size: 이동평균 계산에 사용할 최근 데이터 수
        """
        self._history: dict[str, deque[tuple[float, float]]] = {}  # point_id → deque of (timestamp, value)
        self._window_size = window_size
        self._stats = {"good": 0, "uncertain": 0, "bad": 0}

    def check(self, point_id: str, value: float, sensor_type: str) -> str:
        """
        데이터 품질 검사를 수행한다.

        Args:
            point_id: 포인트 식별자
            value: 센서 측정값
            sensor_type: 센서 유형 (포인트 이름에서 추출)

        Returns:
            품질 태그: 'good', 'uncertain', 'bad'
        """
        now = time.time()
        quality = "good"

        # 1. 범위 검사
        range_result = self._check_range(value, sensor_type)
        if range_result == "bad":
            self._stats["bad"] += 1
            self._add_history(point_id, now, value)
            return "bad"
        elif range_result == "uncertain":
            quality = "uncertain"

        # 2. 변화율 검사 (이력 데이터가 있을 때)
        rate_result = self._check_rate(point_id, now, value, sensor_type)
        if rate_result == "bad":
            quality = "uncertain"  # 변화율 초과는 uncertain으로 분류
        elif rate_result == "uncertain" and quality == "good":
            quality = "uncertain"

        # 3. 통계적 이상치 검사 (충분한 이력이 있을 때)
        outlier_result = self._check_outlier(point_id, value)
        if outlier_result == "uncertain" and quality == "good":
            quality = "uncertain"

        # 이력에 추가
        self._add_history(point_id, now, value)

        self._stats[quality] += 1
        return quality

    def _check_range(self, value: float, sensor_type: str) -> str:
        """유효 범위 검사."""
        matched_type = self._match_sensor_type(sensor_type)
        if matched_type is None:
            return "good"  # 알 수 없는 유형은 범위 검사 스킵

        low, high = self.RANGES[matched_type]
        if value < low or value > high:
            logger.debug(
                "범위 초과: type=%s, value=%.2f (유효: %.1f~%.1f)",
                matched_type, value, low, high,
            )
            return "bad"

        # 경계 근처(±10%) 확인 → uncertain
        range_width = high - low
        margin = range_width * 0.1
        if value < (low + margin) or value > (high - margin):
            return "uncertain"

        return "good"

    def _check_rate(
        self, point_id: str, now: float, value: float, sensor_type: str
    ) -> str:
        """변화율 검사 — 이전 데이터와의 변화율이 제한을 초과하는지 확인."""
        matched_type = self._match_sensor_type(sensor_type)
        if matched_type is None or matched_type not in self.RATE_LIMITS:
            return "good"

        history = self._history.get(point_id)
        if not history:
            return "good"

        prev_ts, prev_value = history[-1]
        dt_minutes = (now - prev_ts) / 60.0
        if dt_minutes <= 0:
            return "good"

        rate = abs(value - prev_value) / dt_minutes
        limit = self.RATE_LIMITS[matched_type]

        if rate > limit * 2:
            logger.debug(
                "변화율 심각 초과: point=%s, rate=%.2f/min (제한: %.1f/min)",
                point_id, rate, limit,
            )
            return "bad"
        elif rate > limit:
            return "uncertain"

        return "good"

    def _check_outlier(self, point_id: str, value: float) -> str:
        """통계적 이상치 검사 — 이동평균 ±3σ."""
        history = self._history.get(point_id)
        if not history or len(history) < 10:
            return "good"  # 데이터 부족 시 검사 스킵

        values = [v for _, v in history]
        n = len(values)
        mean = sum(values) / n
        variance = sum((v - mean) ** 2 for v in values) / n
        std = variance ** 0.5

        if std == 0:
            return "good"

        z_score = abs(value - mean) / std
        if z_score > 3.0:
            logger.debug(
                "통계 이상치: point=%s, value=%.2f, mean=%.2f, std=%.2f, z=%.1f",
                point_id, value, mean, std, z_score,
            )
            return "uncertain"

        return "good"

    def _match_sensor_type(self, sensor_type: str) -> Optional[str]:
        """센서 유형 문자열에서 알려진 유형과 매칭."""
        sensor_lower = sensor_type.lower()
        for known_type in self.RANGES:
            if known_type.lower() in sensor_lower:
                return known_type
        return None

    def _add_history(self, point_id: str, ts: float, value: float) -> None:
        """이력 데이터에 추가."""
        if point_id not in self._history:
            self._history[point_id] = deque(maxlen=self._window_size)
        self._history[point_id].append((ts, value))

    @property
    def stats(self) -> dict[str, int]:
        """품질 검사 통계."""
        return dict(self._stats)

    def infer_sensor_type(self, point_id: str) -> str:
        """포인트 ID에서 센서 유형을 추론한다."""
        pid = point_id.lower()
        if "temp" in pid:
            return "Temperature"
        elif "humid" in pid or "rh" in pid:
            return "Humidity"
        elif "co2" in pid:
            return "CO2"
        elif "pressure" in pid or "press" in pid:
            return "Pressure"
        elif "power" in pid or "kwh" in pid or "kw" in pid:
            return "Power"
        elif "flow" in pid:
            return "Flow"
        elif "speed" in pid or "freq" in pid:
            return "Speed"
        elif "damper" in pid:
            return "Damper"
        elif "valve" in pid or "vlv" in pid:
            return "Valve"
        return "Unknown"


# 싱글톤 인스턴스
quality_checker = DataQualityChecker()
