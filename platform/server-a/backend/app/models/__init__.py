"""
Server A — 공통 Pydantic 응답 모델 (OpenAPI 스키마 자동 생성용)
"""

from .responses import (
    DashboardKPI,
    DashboardSummaryResponse,
    DeviceStatusItem,
    DeviceStatusResponse,
    StreamSnapshotResponse,
    HealthResponse,
)

__all__ = [
    "DashboardKPI",
    "DashboardSummaryResponse",
    "DeviceStatusItem",
    "DeviceStatusResponse",
    "StreamSnapshotResponse",
    "HealthResponse",
]
