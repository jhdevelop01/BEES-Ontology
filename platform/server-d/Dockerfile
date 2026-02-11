# BEES Server D — Data Historian
# Python 3.12 기반 FastAPI 서버

FROM python:3.12-slim

# 작업 디렉토리 설정
WORKDIR /app

# 로그 디렉토리 생성 (호스트 마운트 대상)
RUN mkdir -p /app/logs /app/export

# 의존성 설치 (캐시 활용을 위해 requirements.txt 먼저 복사)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY app/ ./app/

# 포트 노출
EXPOSE 8003

# 헬스 체크
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8003/health')" || exit 1

# uvicorn으로 실행
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003", "--log-level", "info"]
