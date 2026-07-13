"""
Server A Backend — FastAPI 메인 애플리케이션
BEES 디지털 트윈 플랫폼의 온톨로지 웹 서비스 백엔드.

기능:
- Neo4j 온톨로지 조회 (건물 토폴로지, Brick 인스턴스 검색)
- MQTT 센서 데이터 구독 및 캐싱
- SSE 실시간 스트림 (센서 데이터 → 프론트엔드)
- 장비 제어 명령 프록시 (→ Server B)
- 시계열 이력 조회 프록시 (→ Server D)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import HealthResponse
from app.services import neo4j_service, mqtt_service, openai_service, influxdb_service, postgres_service
from app.routers import (
    alarm, audit, auth, dashboard, control, stream, ontology, history, chat, schedule,
    equipment, energy, floors, maintenance, reports, users, settings, notification,
    platform,
)

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def _seed_equipment_metadata() -> None:
    """
    Neo4j에서 장비 목록을 조회하여 PostgreSQL equipment_metadata에 시드.
    이미 존재하는 항목은 건너뛴다 (ON CONFLICT DO NOTHING).
    """
    pool = postgres_service.get_pool()
    if not pool:
        logger.warning("PostgreSQL 미연결 — equipment_metadata 시드 건너뜀")
        return

    try:
        # Neo4j에서 장비 + 타입 + 위치 조회
        records = await neo4j_service.run_cypher("""
            MATCH (n)
            WHERE n.uri STARTS WITH 'https://example.org/gec-b#'
              AND any(label IN labels(n) WHERE label IN [
                  'Equipment', 'AHU', 'Chiller', 'Boiler', 'Pump', 'Fan',
                  'Cooling_Tower', 'Heat_Exchanger', 'VAV', 'FCU', 'PAC',
                  'MAU', 'Damper', 'Valve', 'VFD', 'Filter', 'Meter'
              ])
            OPTIONAL MATCH (n)-[:hasLocation]->(loc)
            RETURN n.uri AS uri, labels(n) AS labels, loc.uri AS location
        """)

        if not records or (records and "error" in records[0]):
            logger.warning("Neo4j 장비 조회 실패 — equipment_metadata 시드 건너뜀")
            return

        from datetime import date, timedelta
        import random

        today = date.today()
        seeded = 0
        async with pool.acquire() as conn:
            for rec in records:
                uri = rec.get("uri", "")
                if not uri:
                    continue
                # URI에서 local name 추출 → ontology_id (bldg:XXX)
                local_name = uri.rsplit("#", 1)[-1] if "#" in uri else uri.rsplit("/", 1)[-1]
                ontology_id = f"bldg:{local_name}"

                # 유지보수 일정: 30~180일 간격으로 랜덤 설정
                interval_days = random.choice([30, 60, 90, 120, 180])
                last_maint = today - timedelta(days=random.randint(1, interval_days))
                next_maint = last_maint + timedelta(days=interval_days)

                await conn.execute(
                    """
                    INSERT INTO equipment_metadata
                        (ontology_id, maintenance_interval_days, last_maintenance_date, next_maintenance_date)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (ontology_id) DO NOTHING
                    """,
                    ontology_id, interval_days, last_maint, next_maint,
                )
                seeded += 1

        logger.info("equipment_metadata 시드 완료: %d건 처리", seeded)

    except Exception as e:
        logger.warning("equipment_metadata 시드 실패: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    애플리케이션 시작/종료 시 리소스 관리.
    - Neo4j 드라이버 연결/해제
    - MQTT 클라이언트 연결/해제
    """
    logger.info("=== Server A Backend 시작 ===")

    # 시작 시 서비스 초기화
    await neo4j_service.connect()
    await mqtt_service.connect()
    await influxdb_service.connect()
    await postgres_service.connect()
    openai_service.init()

    # equipment_metadata 시드 (Neo4j → PostgreSQL)
    await _seed_equipment_metadata()

    logger.info("=== 모든 서비스 초기화 완료 ===")
    yield

    # 종료 시 서비스 정리
    logger.info("=== Server A Backend 종료 중 ===")
    await postgres_service.disconnect()
    await influxdb_service.disconnect()
    await mqtt_service.disconnect()
    await neo4j_service.disconnect()
    logger.info("=== 모든 서비스 정리 완료 ===")


# OpenAPI 태그 메타데이터
tags_metadata = [
    {"name": "시스템", "description": "헬스체크 및 API 정보"},
    {"name": "인증", "description": "JWT 로그인/회원가입"},
    {"name": "대시보드", "description": "KPI 요약 정보"},
    {"name": "제어", "description": "장비 ON/OFF 제어 (Server B 프록시)"},
    {"name": "실시간 스트림", "description": "SSE 센서 데이터 및 스냅샷"},
    {"name": "온톨로지", "description": "Brick Schema 그래프 조회"},
    {"name": "시계열 이력", "description": "InfluxDB 센서 이력 (Server D 프록시)"},
    {"name": "알람", "description": "알람 조회/확인/억제"},
    {"name": "감사 로그", "description": "사용자 행위 감사 로그"},
    {"name": "AI 채팅", "description": "LLM 자연어 질의"},
    {"name": "장비", "description": "장비 상세 및 모니터링"},
    {"name": "에너지", "description": "에너지 분석 대시보드"},
    {"name": "층별 상세", "description": "층별 Room 및 장비 상세 정보"},
    {"name": "유지보수", "description": "유지보수 작업 지시 관리"},
    {"name": "보고서", "description": "보고서 생성 및 다운로드"},
    {"name": "사용자", "description": "사용자 CRUD 및 접근 로그"},
    {"name": "설정", "description": "시스템 설정 관리"},
    {"name": "알림", "description": "Email/Slack 알림 채널"},
    {"name": "플랫폼", "description": "플랫폼 전체 상태 집계"},
]

# FastAPI 앱 인스턴스
app = FastAPI(
    title="BEES Server A — 온톨로지 웹 서비스",
    description=(
        "삼성물산 GEC B동 디지털 트윈 플랫폼 백엔드. "
        "Neo4j 온톨로지 조회, MQTT 실시간 센서 스트림, 장비 제어, "
        "시계열 이력, 알람 관리, AI 채팅 등 18개 페이지 지원."
    ),
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=tags_metadata,
)

# CORS 설정 (프론트엔드 접근 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",     # 로컬 개발
        "http://127.0.0.1:3000",
        "http://server-a-frontend:3000",  # Docker
    ],
    # 임의 호스트의 :3000(프론트) 접속 허용 — LAN IP·다른 기기에서도 접근 가능하게.
    allow_origin_regex=r"https?://[^/]+:3000",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth.router)
app.include_router(alarm.router)
app.include_router(audit.router)
app.include_router(dashboard.router)
app.include_router(control.router)
app.include_router(stream.router)
app.include_router(ontology.router)
app.include_router(history.router)
app.include_router(chat.router)
app.include_router(schedule.router)
app.include_router(equipment.router)
app.include_router(energy.router)
app.include_router(floors.router)
app.include_router(maintenance.router)
app.include_router(reports.router)
app.include_router(users.router)
app.include_router(settings.router)
app.include_router(notification.router)
app.include_router(platform.router)


@app.get("/health", tags=["시스템"], response_model=HealthResponse)
async def health_check():
    """서버 상태 확인. 정상 시 status=healthy 반환."""
    return {
        "status": "healthy",
        "service": "server-a-backend",
        "version": "1.0.0",
    }


@app.get("/", tags=["시스템"])
async def root():
    """루트 엔드포인트 — API 소개"""
    return {
        "service": "BEES Server A — 온톨로지 웹 서비스",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "dashboard": "/api/dashboard/summary",
            "control": "/api/control",
            "devices": "/api/devices/status",
            "stream": "/api/stream/points",
            "topology": "/api/topology/tree",
            "search": "/api/ontology/search?q=AHU",
            "history": "/api/history/{pointId}",
            "chat": "/api/chat",
            "chat_status": "/api/chat/status",
            "ontology_graph": "/api/ontology/graph",
            "ontology_node": "/api/ontology/node/{node_id}",
            "schedules": "/api/schedules",
            "audit_log": "/api/audit-log",
            "docs": "/docs",
        },
    }
