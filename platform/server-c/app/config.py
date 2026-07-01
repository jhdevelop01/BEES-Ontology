"""
Server C 환경 설정 모듈.
pydantic-settings 기반으로 환경변수를 로딩하며, 기본값을 제공한다.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """애플리케이션 설정. 환경변수에서 값을 읽어오며, 기본값을 제공."""

    # Neo4j 연결 정보
    NEO4J_URI: str = "bolt://localhost:7689"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "bees2024"

    # MQTT 브로커 연결 정보
    MQTT_BROKER: str = "localhost"
    MQTT_PORT: int = 1883
    MQTT_CLIENT_ID: str = "server-c-emulator"

    # 시뮬레이션 설정
    SIMULATION_INTERVAL: float = 1.0  # 초
    AUTO_START_SIMULATION: bool = True
    LOG_DIR: str = "/app/logs"

    # 서버 설정
    HOST: str = "0.0.0.0"
    PORT: int = 8002

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
    }


settings = Settings()
