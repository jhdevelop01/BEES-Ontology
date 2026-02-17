"""
Server A — Pydantic 응답 모델

OpenAPI 문서에 정확한 JSON 스키마를 노출하기 위한 응답 모델 정의.
"""

from typing import Any, Optional

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────
# 대시보드
# ─────────────────────────────────────────────

class DashboardKPI(BaseModel):
    """대시보드 KPI 지표."""
    active_devices: int = Field(..., description="활성 장비 수")
    total_devices: int = Field(..., description="전체 장비 수")
    avg_temperature: float = Field(..., description="평균 온도 (°C)")
    alarm_count: int = Field(..., description="활성 알람 수")
    simulation_status: str = Field(..., description="시뮬레이션 상태 (running/stopped)")


class DashboardSummaryResponse(BaseModel):
    """대시보드 KPI 요약 응답."""
    kpi: DashboardKPI
    devices: list[dict[str, Any]] = Field(default_factory=list, description="최근 장비 상태 (최대 10건)")
    recent_points: list[dict[str, Any]] = Field(default_factory=list, description="최근 센서값 (최대 10건)")
    timestamp: float = Field(..., description="응답 생성 시각 (Unix epoch)")


# ─────────────────────────────────────────────
# 장비 상태
# ─────────────────────────────────────────────

class DeviceStatusItem(BaseModel):
    """개별 장비 상태."""
    device_id: str = Field(..., description="장비 ID")
    name: str = Field("", description="장비명")
    is_active: bool = Field(False, description="활성 여부")
    mode: str = Field("standby", description="운전 모드")
    type: str = Field("Equipment", description="장비 유형")
    location: str = Field("", description="위치")
    ts: Optional[float] = Field(None, description="마지막 업데이트 시각")


class DeviceStatusResponse(BaseModel):
    """전체 장비 ON/OFF 상태 응답."""
    devices: list[dict[str, Any]] = Field(default_factory=list, description="장비 목록")
    total: int = Field(..., description="전체 장비 수")
    active: int = Field(..., description="활성 장비 수")


# ─────────────────────────────────────────────
# SSE 스냅샷
# ─────────────────────────────────────────────

class StreamSnapshotResponse(BaseModel):
    """센서 데이터 스냅샷 응답."""
    points: dict[str, Any] = Field(default_factory=dict, description="포인트 캐시 (point_id → 값)")
    devices: dict[str, Any] = Field(default_factory=dict, description="장비 캐시 (device_id → 상태)")
    point_count: int = Field(..., description="포인트 수")
    device_count: int = Field(..., description="장비 수")
    timestamp: float = Field(..., description="스냅샷 시각 (Unix epoch)")


# ─────────────────────────────────────────────
# 헬스체크
# ─────────────────────────────────────────────

class HealthResponse(BaseModel):
    """헬스체크 응답."""
    status: str = Field("healthy", description="서비스 상태")
    service: str = Field("server-a-backend", description="서비스명")
    version: str = Field("1.0.0", description="버전")
