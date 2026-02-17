"""
고장 주입 모듈.

6가지 고장 유형을 시뮬레이션에 동적으로 주입하여
장비/센서의 비정상 동작을 재현한다.
엔진의 _generate_value()에서 활성 고장을 확인하고 값을 변조한다.
"""

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("server-c.faults")


# ─────────────────────────────────────────────────────────────
# 고장 유형 정의
# ─────────────────────────────────────────────────────────────

FAULT_TYPES: dict[str, dict] = {
    "stuck_damper": {
        "name": "stuck_damper",
        "display_name": "댐퍼 고착",
        "description": "댐퍼가 특정 위치에 고착되어 풍량이 감소. stuck_position(%) 파라미터 필요.",
        "target": "equipment",
        "params": ["stuck_position"],
    },
    "sensor_stuck": {
        "name": "sensor_stuck",
        "display_name": "센서 고착",
        "description": "센서가 고정값만 반환. fixed_value 파라미터 필요.",
        "target": "sensor",
        "params": ["fixed_value"],
    },
    "sensor_drift": {
        "name": "sensor_drift",
        "display_name": "센서 드리프트",
        "description": "센서값이 시간에 따라 점진적으로 편향. drift_rate(단위/시간) 파라미터 필요.",
        "target": "sensor",
        "params": ["drift_rate"],
    },
    "comm_loss": {
        "name": "comm_loss",
        "display_name": "통신 단절",
        "description": "장비와 통신이 끊겨 센서 데이터 없음, 장비 상태 오프라인.",
        "target": "equipment",
        "params": [],
    },
    "degraded_performance": {
        "name": "degraded_performance",
        "display_name": "성능 저하",
        "description": "장비 성능 저하로 냉난방 출력 감소. capacity_reduction(%) 파라미터 필요.",
        "target": "equipment",
        "params": ["capacity_reduction"],
    },
    "valve_leak": {
        "name": "valve_leak",
        "display_name": "밸브 누설",
        "description": "밸브 누설로 바이패스 유량 발생, 온도 편차 증가. leak_percentage(%) 파라미터 필요.",
        "target": "equipment",
        "params": ["leak_percentage"],
    },
}


# ─────────────────────────────────────────────────────────────
# Fault 데이터 모델
# ─────────────────────────────────────────────────────────────

@dataclass
class ActiveFault:
    """활성 고장 인스턴스."""

    fault_id: str                       # 고유 ID (UUID)
    fault_type: str                     # 고장 유형 (FAULT_TYPES 키)
    target_id: str                      # 대상 장비/센서 ID (bldg:XXX)
    params: dict = field(default_factory=dict)   # 고장 파라미터
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    # 드리프트 고장용 누적값
    drift_accumulated: float = 0.0

    def to_dict(self) -> dict:
        return {
            "fault_id": self.fault_id,
            "fault_type": self.fault_type,
            "target_id": self.target_id,
            "params": self.params,
            "created_at": self.created_at.isoformat(),
            "drift_accumulated": self.drift_accumulated,
            "display_name": FAULT_TYPES.get(self.fault_type, {}).get("display_name", self.fault_type),
        }


# ─────────────────────────────────────────────────────────────
# FaultManager
# ─────────────────────────────────────────────────────────────

class FaultManager:
    """
    고장 주입 관리자.

    활성 고장 목록을 관리하며, 엔진에서 센서값 생성 시
    고장 효과를 적용할 수 있는 인터페이스를 제공한다.
    """

    def __init__(self):
        # {fault_id: ActiveFault}
        self._active_faults: dict[str, ActiveFault] = {}
        # 빠른 조회용 인덱스: {target_id: [fault_id, ...]}
        self._target_index: dict[str, list[str]] = {}

    def inject(self, fault_type: str, target_id: str, params: dict = None) -> dict:
        """
        고장 주입.

        Args:
            fault_type: 고장 유형 (FAULT_TYPES 키)
            target_id: 대상 장비/센서 ID
            params: 고장 파라미터 (유형별 상이)

        Returns:
            성공/실패 결과 딕셔너리
        """
        params = params or {}

        # 유형 유효성 검증
        if fault_type not in FAULT_TYPES:
            return {
                "success": False,
                "error": f"알 수 없는 고장 유형: {fault_type}. 사용 가능: {list(FAULT_TYPES.keys())}",
            }

        # 필수 파라미터 검증
        type_info = FAULT_TYPES[fault_type]
        for req_param in type_info["params"]:
            if req_param not in params:
                return {
                    "success": False,
                    "error": f"필수 파라미터 누락: {req_param}. 필요: {type_info['params']}",
                }

        # 동일 대상에 같은 유형 중복 방지
        for existing in self._active_faults.values():
            if existing.fault_type == fault_type and existing.target_id == target_id:
                return {
                    "success": False,
                    "error": f"이미 동일 고장이 활성 상태: {fault_type} → {target_id} (ID: {existing.fault_id})",
                }

        fault_id = str(uuid.uuid4())[:8]
        fault = ActiveFault(
            fault_id=fault_id,
            fault_type=fault_type,
            target_id=target_id,
            params=params,
        )

        self._active_faults[fault_id] = fault
        self._target_index.setdefault(target_id, []).append(fault_id)

        logger.info(
            f"고장 주입: {fault_type} → {target_id} (ID: {fault_id}, params: {params})"
        )
        return {
            "success": True,
            "fault": fault.to_dict(),
        }

    def clear(self, fault_id: str) -> dict:
        """고장 해제."""
        fault = self._active_faults.pop(fault_id, None)
        if fault is None:
            return {
                "success": False,
                "error": f"활성 고장을 찾을 수 없습니다: {fault_id}",
            }

        # 인덱스에서 제거
        target_faults = self._target_index.get(fault.target_id, [])
        if fault_id in target_faults:
            target_faults.remove(fault_id)
        if not target_faults:
            self._target_index.pop(fault.target_id, None)

        logger.info(f"고장 해제: {fault.fault_type} → {fault.target_id} (ID: {fault_id})")
        return {
            "success": True,
            "cleared": fault.to_dict(),
        }

    def get_active_faults(self) -> list[dict]:
        """전체 활성 고장 목록."""
        return [f.to_dict() for f in self._active_faults.values()]

    def get_faults_for_target(self, target_id: str) -> list[ActiveFault]:
        """특정 대상의 활성 고장 목록 (엔진 내부용)."""
        fault_ids = self._target_index.get(target_id, [])
        return [self._active_faults[fid] for fid in fault_ids if fid in self._active_faults]

    def has_comm_loss(self, equipment_id: str) -> bool:
        """장비가 통신 단절 고장 상태인지 확인."""
        for fault in self.get_faults_for_target(equipment_id):
            if fault.fault_type == "comm_loss":
                return True
        return False

    def get_sensor_stuck_value(self, point_id: str) -> Optional[float]:
        """센서 고착 고장의 고정값 반환 (없으면 None)."""
        for fault in self.get_faults_for_target(point_id):
            if fault.fault_type == "sensor_stuck":
                return fault.params.get("fixed_value")
        return None

    def get_sensor_drift(self, point_id: str, dt_hours: float) -> float:
        """센서 드리프트 고장의 누적 편향값 반환 (없으면 0)."""
        total_drift = 0.0
        for fault in self.get_faults_for_target(point_id):
            if fault.fault_type == "sensor_drift":
                drift_rate = fault.params.get("drift_rate", 0.0)
                fault.drift_accumulated += drift_rate * dt_hours
                total_drift += fault.drift_accumulated
        return total_drift

    def get_capacity_reduction(self, equipment_id: str) -> float:
        """장비 성능 저하율 반환 (0.0 ~ 1.0, 없으면 0)."""
        for fault in self.get_faults_for_target(equipment_id):
            if fault.fault_type == "degraded_performance":
                return fault.params.get("capacity_reduction", 0.0) / 100.0
        return 0.0

    def get_valve_leak(self, equipment_id: str) -> float:
        """밸브 누설률 반환 (0.0 ~ 1.0, 없으면 0)."""
        for fault in self.get_faults_for_target(equipment_id):
            if fault.fault_type == "valve_leak":
                return fault.params.get("leak_percentage", 0.0) / 100.0
        return 0.0

    def get_stuck_damper_position(self, equipment_id: str) -> Optional[float]:
        """댐퍼 고착 위치 반환 (없으면 None)."""
        for fault in self.get_faults_for_target(equipment_id):
            if fault.fault_type == "stuck_damper":
                return fault.params.get("stuck_position", 50.0)
        return None

    @property
    def active_count(self) -> int:
        return len(self._active_faults)
