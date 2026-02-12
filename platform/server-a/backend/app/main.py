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

from app.services import neo4j_service, mqtt_service, openai_service, influxdb_service
from app.routers import dashboard, control, stream, ontology, history, chat

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


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
    openai_service.init()

    logger.info("=== 모든 서비스 초기화 완료 ===")
    yield

    # 종료 시 서비스 정리
    logger.info("=== Server A Backend 종료 중 ===")
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
app.include_router(dashboard.router)
app.include_router(control.router)
app.include_router(stream.router)
app.include_router(ontology.router)
app.include_router(history.router)
app.include_router(chat.router)


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
            "docs": "/docs",
        },
    }
