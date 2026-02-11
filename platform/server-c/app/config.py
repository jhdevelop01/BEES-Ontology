"""
Server C 환경 설정 모듈.
환경변수에서 설정값을 로딩하며, 기본값을 제공한다.
"""

import os


class Settings:
    """애플리케이션 설정. 환경변수에서 값을 읽어오며, 기본값을 제공."""

    # Neo4j 연결 정보
    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7689")
    NEO4J_USER: str = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "bees2024")

    # MQTT 브로커 연결 정보
    MQTT_BROKER: str = os.getenv("MQTT_BROKER", "localhost")
    MQTT_PORT: int = int(os.getenv("MQTT_PORT", "1883"))
    MQTT_CLIENT_ID: str = os.getenv("MQTT_CLIENT_ID", "server-c-emulator")

    # 시뮬레이션 설정
    SIMULATION_INTERVAL: float = float(os.getenv("SIMULATION_INTERVAL", "5.0"))  # 초
    LOG_DIR: str = os.getenv("LOG_DIR", "/app/logs")

    # 서버 설정
    HOST: str = os.getenv("SERVER_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("SERVER_PORT", "8002"))


settings = Settings()
