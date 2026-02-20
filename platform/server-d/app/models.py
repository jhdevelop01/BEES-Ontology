"""
BEES Platform — Server D Pydantic 모델 (요청/응답 스키마)
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────
# InfluxDB 시계열 데이터 모델
# ─────────────────────────────────────────────

class PointData(BaseModel):
    """MQTT로 수신되는 센서 데이터 포맷"""
    value: float = Field(..., description="센서 측정값")
    ts: Optional[str] = Field(None, description="타임스탬프 (ISO 8601). 없으면 서버 시각 사용")
    unit: Optional[str] = Field(None, description="단위 (degC, %, ppm, kW 등)")
    quality: str = Field(default="good", description="데이터 품질 (good/uncertain/bad)")


class PointWrite(BaseModel):
    """REST API를 통한 단건 저장 요청"""
    point_id: str = Field(..., description="포인트 ID (예: bldg:Zone_Air_Temp_5F)")
    value: float = Field(..., description="센서 측정값")
    ts: Optional[str] = Field(None, description="타임스탬프 (ISO 8601)")
    unit: Optional[str] = Field(None, description="단위")
    quality: str = Field(default="good", description="데이터 품질")


class PointLatest(BaseModel):
    """포인트 최신값 응답"""
    point_id: str
    value: float
    time: str
    unit: Optional[str] = None
    quality: Optional[str] = None


class PointRecord(BaseModel):
    """시계열 조회 응답 — 개별 레코드"""
    time: str
    value: float
    quality: Optional[str] = None


class PointHistory(BaseModel):
    """시계열 조회 응답"""
    point_id: str
    records: list[PointRecord]
    count: int
    aggregation: Optional[str] = None


class PointSummaryItem(BaseModel):
    """개별 포인트 현황"""
    point_id: str
    last_value: Optional[float] = None
    last_time: Optional[str] = None
    unit: Optional[str] = None
    record_count: int = 0


class PointSummary(BaseModel):
    """전체 포인트 현황 응답"""
    total_points: int
    total_records: int = 0
    points: list[PointSummaryItem]


# ─────────────────────────────────────────────
# PostgreSQL 관리 데이터 모델
# ─────────────────────────────────────────────

class AlarmHistoryItem(BaseModel):
    """알람 이력 아이템"""
    id: int
    equipment_id: str
    alarm_type: str
    severity: str
    message: str
    threshold_value: Optional[float] = None
    actual_value: Optional[float] = None
    onset_at: str
    cleared_at: Optional[str] = None
    acknowledged_at: Optional[str] = None
    acknowledged_by: Optional[int] = None
    suppressed: bool = False
    notes: Optional[str] = None


class AlarmHistoryResponse(BaseModel):
    """알람 이력 조회 응답"""
    total: int
    items: list[AlarmHistoryItem]


class AuditLogItem(BaseModel):
    """감사 로그 아이템"""
    id: int
    user_id: Optional[int] = None
    action: str
    target_equipment: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    source: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: str


class AuditLogResponse(BaseModel):
    """감사 로그 조회 응답"""
    total: int
    items: list[AuditLogItem]


# ─────────────────────────────────────────────
# 헬스 체크
# ─────────────────────────────────────────────

class PipelineStats(BaseModel):
    """MQTT 파이프라인 통계"""
    mqtt_connected: bool = False
    messages_received: int = 0
    points_written: int = 0
    alarms_saved: int = 0
    errors: int = 0
    buffer_size: int = 0


class HealthCheck(BaseModel):
    """헬스 체크 응답"""
    status: str = "ok"
    service: str = "server-d"
    version: str = "1.0.0"
    influxdb: str = "unknown"
    postgres: str = "unknown"
    mqtt: str = "unknown"
    uptime_seconds: float = 0.0
    pipeline: Optional[PipelineStats] = None
