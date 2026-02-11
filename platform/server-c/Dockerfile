# Server C: 가상 건물 에뮬레이터
# python:3.12-slim 기반, uvicorn으로 FastAPI 서빙

FROM python:3.12-slim

# 작업 디렉토리 설정
WORKDIR /app

# 로그 디렉토리 생성
RUN mkdir -p /app/logs

# 의존성 설치 (캐시 활용을 위해 requirements.txt 먼저 복사)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY app/ ./app/

# 환경변수 기본값
ENV NEO4J_URI=bolt://neo4j:7687
ENV NEO4J_USER=neo4j
ENV NEO4J_PASSWORD=bees2024
ENV MQTT_BROKER=mosquitto
ENV MQTT_PORT=1883
ENV LOG_DIR=/app/logs

# 포트 노출
EXPOSE 8002

# uvicorn으로 FastAPI 서빙
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
