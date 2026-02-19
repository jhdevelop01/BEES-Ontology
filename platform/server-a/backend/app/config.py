"""
Server A Backend 환경설정
pydantic-settings 기반으로 모든 환경변수를 중앙 관리한다.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """애플리케이션 설정. 환경변수에서 값을 읽어오며, 기본값을 제공."""

    # Neo4j 그래프 DB
    NEO4J_URI: str = "bolt://localhost:7689"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "bees2024"

    # MQTT 브로커
    MQTT_BROKER: str = "localhost"
    MQTT_PORT: int = 1883

    # Server B (BAS Adapter)
    SERVER_B_URL: str = "http://localhost:8001"

    # Server C (에뮬레이터)
    SERVER_C_URL: str = "http://localhost:8002"

    # Server D (Data Historian)
    SERVER_D_URL: str = "http://localhost:8003"

    # InfluxDB (직접 연결 — 선택적, Server D 경유 가능)
    INFLUXDB_URL: str = "http://localhost:8086"
    INFLUXDB_TOKEN: str = "bees-dev-token"
    INFLUXDB_ORG: str = "samsung-gec"
    INFLUXDB_BUCKET: str = "raw_7d"

    # PostgreSQL
    DATABASE_URL: str = "postgresql://bees:bees2024@localhost:5432/bees_platform"

    # OpenAI LLM
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"

    # JWT 인증
    JWT_SECRET: str = "bees-dev-secret-key-change-in-production"

    # Email 알림 (SMTP)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True

    # Slack 알림
    SLACK_WEBHOOK_URL: str = ""

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
    }


_settings = Settings()

# ── 모듈 레벨 변수 (하위 호환) ──
# 기존 코드가 `from app.config import MQTT_BROKER` 형태로 사용하므로 유지
NEO4J_URI = _settings.NEO4J_URI
NEO4J_USER = _settings.NEO4J_USER
NEO4J_PASSWORD = _settings.NEO4J_PASSWORD

MQTT_BROKER = _settings.MQTT_BROKER
MQTT_PORT = _settings.MQTT_PORT

SERVER_B_URL = _settings.SERVER_B_URL
SERVER_C_URL = _settings.SERVER_C_URL
SERVER_D_URL = _settings.SERVER_D_URL

INFLUXDB_URL = _settings.INFLUXDB_URL
INFLUXDB_TOKEN = _settings.INFLUXDB_TOKEN
INFLUXDB_ORG = _settings.INFLUXDB_ORG
INFLUXDB_BUCKET = _settings.INFLUXDB_BUCKET

DATABASE_URL = _settings.DATABASE_URL

OPENAI_API_KEY = _settings.OPENAI_API_KEY
OPENAI_MODEL = _settings.OPENAI_MODEL

JWT_SECRET = _settings.JWT_SECRET

SMTP_HOST = _settings.SMTP_HOST
SMTP_PORT = _settings.SMTP_PORT
SMTP_USER = _settings.SMTP_USER
SMTP_PASSWORD = _settings.SMTP_PASSWORD
SMTP_FROM = _settings.SMTP_FROM
SMTP_USE_TLS = _settings.SMTP_USE_TLS

SLACK_WEBHOOK_URL = _settings.SLACK_WEBHOOK_URL
