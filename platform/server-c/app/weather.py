"""
기상 데이터 제공 모듈.

서울 TMY(Typical Meteorological Year) 월별 데이터를 기반으로
시간대별 외기온, 습도, 태양 복사량을 생성한다.
사인파 모델: 최저 06시, 최고 15시.
"""

import math
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

logger = logging.getLogger("server-c.weather")


# ─────────────────────────────────────────────────────────────
# 서울 TMY 월별 데이터
# ─────────────────────────────────────────────────────────────

@dataclass
class MonthlyClimate:
    """월별 기후 데이터."""
    avg_temp: float         # 월 평균 기온 (°C)
    diurnal_range: float    # 일교차 (°C) — 일 최고~최저 온도차
    avg_humidity: float     # 월 평균 상대습도 (%)
    solar_peak: float       # 태양 복사 피크 (W/m²)


# 서울 TMY 데이터 (기상청 30년 평년값 기반)
SEOUL_TMY: dict[int, MonthlyClimate] = {
    1:  MonthlyClimate(avg_temp=-2.4,  diurnal_range=8.5,  avg_humidity=55.0, solar_peak=350),
    2:  MonthlyClimate(avg_temp=0.4,   diurnal_range=9.0,  avg_humidity=55.0, solar_peak=450),
    3:  MonthlyClimate(avg_temp=5.7,   diurnal_range=10.0, avg_humidity=55.0, solar_peak=550),
    4:  MonthlyClimate(avg_temp=12.5,  diurnal_range=11.0, avg_humidity=55.0, solar_peak=650),
    5:  MonthlyClimate(avg_temp=17.8,  diurnal_range=11.0, avg_humidity=60.0, solar_peak=750),
    6:  MonthlyClimate(avg_temp=22.2,  diurnal_range=9.0,  avg_humidity=68.0, solar_peak=700),
    7:  MonthlyClimate(avg_temp=24.9,  diurnal_range=7.5,  avg_humidity=78.0, solar_peak=600),
    8:  MonthlyClimate(avg_temp=25.7,  diurnal_range=8.0,  avg_humidity=75.0, solar_peak=620),
    9:  MonthlyClimate(avg_temp=21.2,  diurnal_range=9.5,  avg_humidity=65.0, solar_peak=580),
    10: MonthlyClimate(avg_temp=14.8,  diurnal_range=10.5, avg_humidity=58.0, solar_peak=500),
    11: MonthlyClimate(avg_temp=7.2,   diurnal_range=9.5,  avg_humidity=57.0, solar_peak=380),
    12: MonthlyClimate(avg_temp=0.4,   diurnal_range=8.5,  avg_humidity=56.0, solar_peak=320),
}


# ─────────────────────────────────────────────────────────────
# WeatherProvider
# ─────────────────────────────────────────────────────────────

class WeatherProvider:
    """
    서울 TMY 기반 시간별 기상 데이터 제공.

    사인파 모델로 일 중 변화를 생성한다:
    - 외기온: 06시 최저, 15시 최고
    - 태양 복사: 06시~18시 사인파, 야간=0
    - 습도: 06시 최고, 15시 최저 (온도와 반대)
    """

    def __init__(self):
        self._override_temp: float | None = None  # 시나리오에서 외기온 강제 설정 시

    def set_temp_override(self, temp_min: float, temp_max: float) -> None:
        """시나리오에 의한 외기온 오버라이드 설정."""
        self._override_temp = (temp_min + temp_max) / 2.0
        self._override_range = temp_max - temp_min

    def clear_temp_override(self) -> None:
        """외기온 오버라이드 해제."""
        self._override_temp = None

    def get_current_conditions(self, now: datetime = None) -> dict:
        """
        현재 기상 조건 반환.

        Args:
            now: 현재 시각 (None이면 UTC now)

        Returns:
            {outdoor_temp, humidity, solar_radiation}
        """
        if now is None:
            now = datetime.now(timezone.utc)

        month = now.month
        hour = now.hour + now.minute / 60.0
        climate = SEOUL_TMY.get(month, SEOUL_TMY[1])

        # ── 외기온 계산 ──
        if self._override_temp is not None:
            # 시나리오 오버라이드
            avg_temp = self._override_temp
            diurnal_range = getattr(self, '_override_range', climate.diurnal_range)
        else:
            avg_temp = climate.avg_temp
            diurnal_range = climate.diurnal_range

        # 사인파: 최저 06시 → 최고 15시
        # sin 위상: 15시에 +1 → phase shift = 15 - 6 = 9
        temp_variation = (diurnal_range / 2.0) * math.sin(
            2 * math.pi * (hour - 6.0) / 24.0
        )
        outdoor_temp = round(avg_temp + temp_variation, 1)

        # ── 태양 복사 계산 ──
        # 일출(06시) ~ 일몰(18시) 사인파, 정오(12시)에 피크
        if 6.0 <= hour <= 18.0:
            solar_fraction = math.sin(math.pi * (hour - 6.0) / 12.0)
            solar_radiation = round(climate.solar_peak * solar_fraction, 0)
        else:
            solar_radiation = 0.0

        # ── 습도 계산 ──
        # 온도와 반대 패턴: 06시 최고, 15시 최저
        humidity_variation = 8.0 * math.sin(
            2 * math.pi * (hour - 6.0) / 24.0
        )
        humidity = round(climate.avg_humidity - humidity_variation, 1)
        humidity = max(20.0, min(95.0, humidity))

        return {
            "outdoor_temp": outdoor_temp,
            "humidity": humidity,
            "solar_radiation": solar_radiation,
            "month": month,
            "hour": round(hour, 1),
        }
