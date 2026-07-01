"""
BEES Platform — Server D: 데이터 수집 서버 (Data Historian)
FastAPI 메인 애플리케이션

포트: 8003
역할:
  - MQTT 구독 (bees/points/#) → InfluxDB 배치 저장
  - REST API: 시계열 데이터 조회, 알람 이력, 감사 로그
  - PostgreSQL 관리 데이터 조회
"""

import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import close_influxdb, close_postgres, init_influxdb, init_postgres
from .downsampling import ensure_downsampling_tasks
from .mqtt_worker import mqtt_worker
from .retention import ensure_buckets
from .routers import admin, devices, health, points, export
from .routers.health import set_start_time

# ─────────────────────────────────────────────
# 로깅 설정
# ─────────────────────────────────────────────

# 로그 디렉토리 생성
os.makedirs(settings.log_dir, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            os.path.join(settings.log_dir, "server-d.log"),
            encoding="utf-8",
        ),
    ],
)
logger = logging.getLogger("server-d")


# ─────────────────────────────────────────────
# FastAPI Lifespan (시작/종료 관리)
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI 수명 주기 관리

    시작:
      1. PostgreSQL 커넥션 풀 초기화
      2. InfluxDB 쿼리 클라이언트 초기화
      3. MQTT 워커 시작 (백그라운드)
    종료:
      1. MQTT 워커 정지 (잔여 버퍼 플러시)
      2. InfluxDB 클라이언트 종료
      3. PostgreSQL 커넥션 풀 종료
    """
    logger.info("=" * 60)
    logger.info("BEES Server D (Data Historian) 시작 중...")
    logger.info("=" * 60)
    set_start_time(time.time())

    # 시작
    try:
        await init_postgres()
        logger.info("PostgreSQL 초기화 완료")
    except Exception as e:
        logger.error("PostgreSQL 초기화 실패 — 서비스 제한 모드: %s", e)

    try:
        init_influxdb()
        logger.info("InfluxDB 초기화 완료")
        # 보존 정책 버킷 확인/생성
        bucket_count = ensure_buckets()
        logger.info("InfluxDB 보존 정책 확인 완료 (신규 버킷: %d개)", bucket_count)

        # 다운샘플링 태스크 확인/등록 (Phase 4)
        task_count = ensure_downsampling_tasks()
        logger.info("다운샘플링 태스크 확인 완료 (신규 태스크: %d개)", task_count)
    except Exception as e:
        logger.error("InfluxDB 초기화 실패 — 서비스 제한 모드: %s", e)

    try:
        await mqtt_worker.start()
        logger.info("MQTT 워커 시작 완료")
    except Exception as e:
        logger.error("MQTT 워커 시작 실패: %s", e)

    logger.info("Server D 시작 완료 — http://%s:%d", settings.server_host, settings.server_port)

    yield  # ← 애플리케이션 실행 중

    # 종료
    logger.info("Server D 종료 중...")
    await mqtt_worker.stop()
    close_influxdb()
    await close_postgres()
    logger.info("Server D 종료 완료")


# ─────────────────────────────────────────────
# FastAPI 앱 생성
# ─────────────────────────────────────────────

app = FastAPI(
    title="BEES Server D — Data Historian",
    description=(
        "삼성물산 GEC B동 디지털 트윈 데이터 수집 서버. "
        "MQTT 센서 데이터를 InfluxDB에 배치 저장하고, "
        "시계열 조회, 데이터 품질 검증, 알람 이력, 감사 로그 API를 제공한다."
    ),
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "시계열", "description": "센서 시계열 데이터 조회/저장"},
        {"name": "관리", "description": "알람 이력, 감사 로그, 데이터 품질"},
        {"name": "헬스", "description": "헬스체크 및 서비스 상태"},
        {"name": "내보내기", "description": "CSV/Excel 데이터 내보내기"},
    ],
)

# ── CORS 미들웨어 ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발 환경 — 운영 시 특정 도메인으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 라우터 등록 ──
app.include_router(points.router)
app.include_router(devices.router)
app.include_router(admin.router)
app.include_router(health.router)
app.include_router(export.router)


# ── 루트 엔드포인트 ──
@app.get("/", tags=["기본"])
async def root():
    """서버 정보 반환"""
    return {
        "service": "BEES Server D — Data Historian",
        "version": "1.0.0",
        "description": "삼성물산 GEC B동 디지털 트윈 데이터 수집 서버",
        "endpoints": {
            "시계열_최신값": "/data/points/{id}/latest",
            "시계열_이력": "/data/points/{id}/history",
            "포인트_현황": "/data/points/summary",
            "단건_저장": "POST /data/points",
            "알람_이력": "/alarm-history",
            "감사_로그": "/audit-log",
            "헬스_체크": "/health",
            "API_문서": "/docs",
        },
        "mqtt_worker": mqtt_worker.stats,
    }
