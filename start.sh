#!/bin/bash
# BEES 디지털 트윈 플랫폼 — 전체 시작 스크립트
set -e

cd "$(dirname "$0")"

echo "🔵 BEES 디지털 트윈 플랫폼 시작"
echo "================================"

# 1. Neo4j 외부 컨테이너
echo ""
echo "[1/4] Neo4j 시작..."
if docker ps --format '{{.Names}}' | grep -q '^neo4j-bees$'; then
    echo "  이미 실행 중"
else
    docker start neo4j-bees 2>/dev/null || {
        echo "  ⚠ neo4j-bees 컨테이너가 없습니다. history.md 섹션 11.7 참조"
        echo "  Neo4j 없이 계속 진행 (Phase 1 폴백 모드)"
    }
fi

# 2. Docker Compose 서비스
echo ""
echo "[2/4] Docker Compose 서비스 시작 (8개)..."
docker compose up -d

# 3. Neo4j 준비 대기
echo ""
echo "[3/4] Neo4j 준비 대기..."
for i in $(seq 1 15); do
    if curl -s http://localhost:7476 >/dev/null 2>&1; then
        echo "  Neo4j 준비 완료 (${i}초)"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "  ⚠ Neo4j 응답 없음 — Phase 1 폴백 모드로 동작"
    fi
    sleep 1
done

# 4. 시뮬레이션 시작
echo ""
echo "[4/4] 시뮬레이션 시작..."
sleep 3  # Server C 기동 대기
RESULT=$(curl -s -X POST http://localhost:8012/simulation/start 2>/dev/null || echo '{"status":"error"}')
if echo "$RESULT" | grep -q '"started"'; then
    echo "  시뮬레이션 시작됨"
else
    echo "  ⚠ 시뮬레이션 시작 실패 (Server C 미준비 가능). 수동 실행:"
    echo "    curl -X POST http://localhost:8012/simulation/start"
fi

# 5. 상태 확인
echo ""
echo "================================"
echo "서비스 상태:"
docker compose ps --format "  {{.Name}}: {{.Status}}" 2>/dev/null
NEO4J_STATUS=$(docker ps --filter name=neo4j-bees --format "{{.Status}}" 2>/dev/null)
[ -n "$NEO4J_STATUS" ] && echo "  neo4j-bees: $NEO4J_STATUS"

echo ""
sleep 3
SNAP=$(curl -s http://localhost:8010/api/stream/snapshot 2>/dev/null)
if [ -n "$SNAP" ]; then
    echo "데이터 현황:"
    echo "$SNAP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  포인트: {d[\"point_count\"]}개, 디바이스: {d[\"device_count\"]}개')" 2>/dev/null
fi

echo ""
echo "프론트엔드: http://localhost:3000"
echo "================================"
