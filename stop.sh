#!/bin/bash
# BEES 디지털 트윈 플랫폼 — 전체 중지 스크립트
cd "$(dirname "$0")"

echo "🔴 BEES 디지털 트윈 플랫폼 중지"
echo "================================"

# 1. 시뮬레이션 중지
echo ""
echo "[1/3] 시뮬레이션 중지..."
curl -s -X POST http://localhost:8012/simulation/stop >/dev/null 2>&1 && echo "  완료" || echo "  (이미 중지됨)"

# 2. Docker Compose 서비스
echo ""
echo "[2/3] Docker Compose 서비스 중지 (8개)..."
docker compose down

# 3. Neo4j
echo ""
echo "[3/3] Neo4j 중지..."
docker stop neo4j-bees 2>/dev/null && echo "  완료" || echo "  (이미 중지됨)"

echo ""
echo "================================"
echo "모든 서비스가 중지되었습니다."
