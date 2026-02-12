"""
Server A Backend 환경설정
모든 환경변수를 중앙 관리한다.
"""

import os
from dotenv import load_dotenv

load_dotenv()


# Neo4j 그래프 DB
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7689")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "bees2024")

# MQTT 브로커
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))

# Server B (BAS Adapter)
SERVER_B_URL = os.getenv("SERVER_B_URL", "http://localhost:8001")

# Server D (Data Historian)
SERVER_D_URL = os.getenv("SERVER_D_URL", "http://localhost:8003")

# InfluxDB (직접 연결 — 선택적, Server D 경유 가능)
INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "bees-dev-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "samsung-gec")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "raw_7d")

# PostgreSQL
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://bees:bees2024@localhost:5432/bees_platform",
)

# OpenAI LLM
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
