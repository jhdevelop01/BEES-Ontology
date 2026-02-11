"""
BEES Platform — Server D 환경 설정
pydantic-settings 기반 환경변수 로딩
"""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Server D 환경 설정 — .env 파일 또는 환경변수에서 로딩"""

    # ── InfluxDB ──
    influxdb_url: str = Field(
        default="http://influxdb:8086",
        description="InfluxDB 접속 URL",
    )
    influxdb_token: str = Field(
        default="bees-dev-token",
        description="InfluxDB 인증 토큰",
    )
    influxdb_org: str = Field(
        default="samsung-gec",
        description="InfluxDB 조직명",
    )
    influxdb_bucket: str = Field(
        default="raw_7d",
        description="InfluxDB 기본 버킷 (원시 데이터, 7일 보존)",
    )

    # ── PostgreSQL ──
    database_url: str = Field(
        default="postgresql://bees:bees2024@postgres:5432/bees_platform",
        description="PostgreSQL 접속 URL (asyncpg)",
    )

    # ── MQTT ──
    mqtt_broker: str = Field(
        default="mosquitto",
        description="MQTT 브로커 호스트명",
    )
    mqtt_port: int = Field(
        default=1883,
        description="MQTT 브로커 포트",
    )
    mqtt_topic: str = Field(
        default="bees/points/#",
        description="MQTT 구독 토픽 패턴",
    )
    mqtt_client_id: str = Field(
        default="server-d-historian",
        description="MQTT 클라이언트 ID",
    )

    # ── 배치 설정 ──
    batch_flush_interval: float = Field(
        default=5.0,
        description="InfluxDB 배치 플러시 간격 (초)",
    )
    batch_flush_size: int = Field(
        default=100,
        description="InfluxDB 배치 플러시 크기 (포인트 수)",
    )

    # ── 서버 ──
    server_host: str = Field(default="0.0.0.0")
    server_port: int = Field(default=8003)
    log_dir: str = Field(
        default="/app/logs",
        description="로그 파일 저장 디렉토리",
    )

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


# 싱글톤 인스턴스
settings = Settings()
