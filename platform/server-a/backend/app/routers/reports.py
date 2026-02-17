"""
보고서 API 라우터

엔드포인트:
  GET  /api/reports/presets         — 보고서 프리셋 목록
  POST /api/reports/generate        — 보고서 생성
  GET  /api/reports/{id}/download   — 보고서 다운로드 (CSV/JSON)
  GET  /api/reports/history         — 보고서 생성 이력
"""

import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.report_service import generate_report, get_presets, get_report, get_report_history

logger = logging.getLogger("server-a.reports")
router = APIRouter(prefix="/api/reports", tags=["보고서"])


# ── Pydantic 스키마 ──────────────────────────────────────────────────────

class ReportPeriod(BaseModel):
    """보고서 기간."""
    start: str = Field(..., description="시작 일시 (ISO 8601 또는 상대: -7d)")
    end: str = Field(default="now", description="종료 일시")


class ReportGenerateRequest(BaseModel):
    """보고서 생성 요청."""
    preset_id: Optional[str] = Field(default=None, description="프리셋 ID (energy_monthly, maintenance_status, comfort, alarm_summary)")
    custom: Optional[dict[str, Any]] = Field(default=None, description="사용자 정의 설정 (metrics, equipment_ids 등)")
    period: ReportPeriod = Field(..., description="보고서 기간")
    format: str = Field(default="json", description="출력 형식 (csv, json)")


# ── API 엔드포인트 ────────────────────────────────────────────────────────

@router.get("/presets")
async def list_presets() -> list[dict[str, Any]]:
    """보고서 프리셋 목록 조회."""
    return get_presets()


@router.post("/generate")
async def generate(req: ReportGenerateRequest) -> dict[str, Any]:
    """보고서 생성."""
    if not req.preset_id and not req.custom:
        raise HTTPException(status_code=400, detail="preset_id 또는 custom 설정이 필요합니다")

    result = await generate_report(
        preset_id=req.preset_id,
        custom=req.custom,
        period_start=req.period.start,
        period_end=req.period.end,
        fmt=req.format,
    )

    # CSV인 경우 download_url 포함
    if req.format == "csv":
        result["download_url"] = f"/api/reports/{result['report_id']}/download"

    return {
        "report_id": result["report_id"],
        "status": result["status"],
        "download_url": result.get("download_url"),
        "generated_at": result["generated_at"],
        "data": result.get("data"),
    }


@router.get("/{report_id}/download")
async def download_report(report_id: str):
    """보고서 다운로드 (CSV 또는 JSON 스트림)."""
    report = get_report(report_id)
    if report is None:
        raise HTTPException(status_code=404, detail=f"보고서 {report_id} 없음")

    if report.get("csv_content"):
        return StreamingResponse(
            iter([report["csv_content"]]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=report_{report_id}.csv"},
        )

    # JSON 형식
    import json
    content = json.dumps(report.get("data", {}), ensure_ascii=False, indent=2)
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=report_{report_id}.json"},
    )


@router.get("/history")
async def list_report_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """보고서 생성 이력 조회."""
    return get_report_history(page=page, limit=limit)
