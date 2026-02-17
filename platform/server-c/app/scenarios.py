"""
시나리오 관리 모듈.

7가지 프리셋 시나리오를 통해 시뮬레이션 환경(재실률, 외기온, HVAC 모드)을
동적으로 변경할 수 있다. 시나리오 파라미터는 엔진의 _generate_value()에서 참조된다.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("server-c.scenarios")


# ─────────────────────────────────────────────────────────────
# 시나리오 데이터 모델
# ─────────────────────────────────────────────────────────────

@dataclass
class ScenarioParams:
    """시나리오 파라미터 정의."""

    name: str                           # 시나리오 ID
    display_name: str                   # 표시명 (한국어)
    description: str                    # 설명
    occupancy: float = 0.7              # 재실률 (0.0 ~ 1.0)
    outdoor_temp_min: float = 15.0      # 외기온 최소 (°C)
    outdoor_temp_max: float = 25.0      # 외기온 최대 (°C)
    hvac_mode: str = "auto"             # HVAC 모드: auto, cooling, heating, max_cooling, max_ventilation, eco
    solar_factor: float = 1.0           # 태양 복사 보정 계수 (0.0 ~ 2.0)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "occupancy": self.occupancy,
            "outdoor_temp_min": self.outdoor_temp_min,
            "outdoor_temp_max": self.outdoor_temp_max,
            "hvac_mode": self.hvac_mode,
            "solar_factor": self.solar_factor,
        }


# ─────────────────────────────────────────────────────────────
# 프리셋 시나리오 7종
# ─────────────────────────────────────────────────────────────

PRESET_SCENARIOS: dict[str, ScenarioParams] = {
    "normal": ScenarioParams(
        name="normal",
        display_name="일반 운전",
        description="일반 업무 시간 운전. 재실률 70%, 쾌적 외기온, 자동 HVAC.",
        occupancy=0.7,
        outdoor_temp_min=15.0,
        outdoor_temp_max=25.0,
        hvac_mode="auto",
        solar_factor=1.0,
    ),
    "emergency": ScenarioParams(
        name="emergency",
        display_name="비상 상황",
        description="화재/가스 등 비상 상황. 전원 재실, 최대 환기 모드.",
        occupancy=1.0,
        outdoor_temp_min=15.0,
        outdoor_temp_max=25.0,
        hvac_mode="max_ventilation",
        solar_factor=1.0,
    ),
    "peak_load": ScenarioParams(
        name="peak_load",
        display_name="피크 부하",
        description="한여름 피크 냉방 부하. 만실, 외기 35°C, 최대 냉방.",
        occupancy=1.0,
        outdoor_temp_min=33.0,
        outdoor_temp_max=37.0,
        hvac_mode="max_cooling",
        solar_factor=1.5,
    ),
    "summer": ScenarioParams(
        name="summer",
        display_name="여름철",
        description="서울 여름 운전. 일반 재실률, 외기 28~32°C, 냉방 모드.",
        occupancy=0.7,
        outdoor_temp_min=28.0,
        outdoor_temp_max=32.0,
        hvac_mode="cooling",
        solar_factor=1.3,
    ),
    "winter": ScenarioParams(
        name="winter",
        display_name="겨울철",
        description="서울 겨울 운전. 일반 재실률, 외기 -5~5°C, 난방 모드.",
        occupancy=0.7,
        outdoor_temp_min=-5.0,
        outdoor_temp_max=5.0,
        hvac_mode="heating",
        solar_factor=0.5,
    ),
    "night_weekend": ScenarioParams(
        name="night_weekend",
        display_name="야간/주말",
        description="비근무 시간. 최소 재실, 에코 모드 절전 운전.",
        occupancy=0.05,
        outdoor_temp_min=15.0,
        outdoor_temp_max=25.0,
        hvac_mode="eco",
        solar_factor=0.3,
    ),
    "custom": ScenarioParams(
        name="custom",
        display_name="사용자 정의",
        description="사용자가 직접 파라미터를 설정하는 커스텀 시나리오.",
        occupancy=0.7,
        outdoor_temp_min=15.0,
        outdoor_temp_max=25.0,
        hvac_mode="auto",
        solar_factor=1.0,
    ),
}


# ─────────────────────────────────────────────────────────────
# ScenarioManager
# ─────────────────────────────────────────────────────────────

class ScenarioManager:
    """
    시나리오 관리자.

    활성 시나리오의 파라미터를 관리하며,
    엔진에서 데이터 생성 시 참조할 수 있는 인터페이스를 제공한다.
    """

    def __init__(self):
        self._active: ScenarioParams = PRESET_SCENARIOS["normal"]
        self._activated_at: datetime = datetime.now(timezone.utc)
        self._custom_scenarios: dict[str, ScenarioParams] = {}

    @property
    def active(self) -> ScenarioParams:
        """현재 활성 시나리오."""
        return self._active

    @property
    def occupancy(self) -> float:
        return self._active.occupancy

    @property
    def outdoor_temp_range(self) -> tuple[float, float]:
        return (self._active.outdoor_temp_min, self._active.outdoor_temp_max)

    @property
    def hvac_mode(self) -> str:
        return self._active.hvac_mode

    @property
    def solar_factor(self) -> float:
        return self._active.solar_factor

    def list_scenarios(self) -> list[dict]:
        """전체 시나리오 목록 반환 (프리셋 + 커스텀)."""
        result = []
        for scenario in PRESET_SCENARIOS.values():
            info = scenario.to_dict()
            info["is_active"] = (scenario.name == self._active.name)
            info["type"] = "preset"
            result.append(info)
        for scenario in self._custom_scenarios.values():
            info = scenario.to_dict()
            info["is_active"] = (scenario.name == self._active.name)
            info["type"] = "custom"
            result.append(info)
        return result

    def get_scenario(self, name: str) -> Optional[dict]:
        """특정 시나리오 상세 조회."""
        scenario = PRESET_SCENARIOS.get(name) or self._custom_scenarios.get(name)
        if scenario is None:
            return None
        info = scenario.to_dict()
        info["is_active"] = (scenario.name == self._active.name)
        return info

    def get_active(self) -> dict:
        """현재 활성 시나리오 정보."""
        info = self._active.to_dict()
        info["activated_at"] = self._activated_at.isoformat()
        return info

    def load_scenario(self, name: str) -> dict:
        """프리셋 또는 커스텀 시나리오를 활성화."""
        scenario = PRESET_SCENARIOS.get(name) or self._custom_scenarios.get(name)
        if scenario is None:
            available = list(PRESET_SCENARIOS.keys()) + list(self._custom_scenarios.keys())
            return {
                "success": False,
                "error": f"시나리오를 찾을 수 없습니다: {name}. 사용 가능: {available}",
            }

        self._active = scenario
        self._activated_at = datetime.now(timezone.utc)
        logger.info(f"시나리오 로드: {name} ({scenario.display_name})")
        return {
            "success": True,
            "scenario": self.get_active(),
        }

    def create_custom(
        self,
        name: str,
        display_name: str = "사용자 정의",
        description: str = "",
        occupancy: float = 0.7,
        outdoor_temp_min: float = 15.0,
        outdoor_temp_max: float = 25.0,
        hvac_mode: str = "auto",
        solar_factor: float = 1.0,
    ) -> dict:
        """사용자 정의 시나리오 생성 및 즉시 활성화."""
        # 프리셋 이름 충돌 검사
        if name in PRESET_SCENARIOS:
            return {
                "success": False,
                "error": f"프리셋 시나리오 이름과 충돌합니다: {name}",
            }

        # 파라미터 범위 검증
        occupancy = max(0.0, min(1.0, occupancy))
        solar_factor = max(0.0, min(2.0, solar_factor))

        valid_modes = {"auto", "cooling", "heating", "max_cooling", "max_ventilation", "eco"}
        if hvac_mode not in valid_modes:
            return {
                "success": False,
                "error": f"유효하지 않은 HVAC 모드: {hvac_mode}. 허용: {valid_modes}",
            }

        scenario = ScenarioParams(
            name=name,
            display_name=display_name,
            description=description or f"커스텀 시나리오: {name}",
            occupancy=occupancy,
            outdoor_temp_min=outdoor_temp_min,
            outdoor_temp_max=outdoor_temp_max,
            hvac_mode=hvac_mode,
            solar_factor=solar_factor,
        )

        self._custom_scenarios[name] = scenario
        self._active = scenario
        self._activated_at = datetime.now(timezone.utc)

        logger.info(
            f"커스텀 시나리오 생성 및 활성화: {name} "
            f"(재실={occupancy}, 외기={outdoor_temp_min}~{outdoor_temp_max}°C, "
            f"HVAC={hvac_mode})"
        )
        return {
            "success": True,
            "scenario": self.get_active(),
        }
