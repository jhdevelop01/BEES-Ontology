"""
Server B (BAS Adapter) 환경 설정 모듈.
환경변수에서 설정값을 로딩하며, 기본값을 제공한다.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """애플리케이션 설정. 환경변수에서 값을 읽어오며, 기본값을 제공."""

    # Server C (가상 건물 에뮬레이터) 연결 정보
    SERVER_C_URL: str = "http://server-c:8002"

    # MQTT 브로커 연결 정보
    MQTT_BROKER: str = "mosquitto"
    MQTT_PORT: int = 1883
    MQTT_CLIENT_ID: str = "server-b-adapter"

    # PostgreSQL 연결 정보 (감사 로그 저장용)
    DATABASE_URL: str = "postgresql://bees:bees2024@postgres:5432/bees_platform"

    # Server B 자체 설정
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    LOG_DIR: str = "/app/logs"

    # Server C 호출 타임아웃 (초)
    SERVER_C_TIMEOUT: float = 5.0

    # 감사 로그 조회 기본 제한
    AUDIT_LOG_LIMIT: int = 100

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
    }


settings = Settings()
