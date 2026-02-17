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

from app.services import neo4j_service, mqtt_service, openai_service, influxdb_service, postgres_service
from app.routers import (
    alarm, audit, auth, dashboard, control, stream, ontology, history, chat, schedule,
    equipment, energy, maintenance, reports, users, settings, notification,
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


# FastAPI 앱 인스턴스
app = FastAPI(
    title="BEES Server A — 온톨로지 웹 서비스",
    description="삼성물산 GEC B동 디지털 트윈 플랫폼 백엔드",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 설정 (프론트엔드 접근 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",     # 로컬 개발
        "http://127.0.0.1:3000",
        "http://server-a-frontend:3000",  # Docker
    ],
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
app.include_router(maintenance.router)
app.include_router(reports.router)
app.include_router(users.router)
app.include_router(settings.router)
app.include_router(notification.router)


@app.get("/health", tags=["시스템"])
async def health_check():
    """헬스체크 엔드포인트"""
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
