# fix-doc — 헬스체크 경로 문서 정정

## 문제
`CLAUDE.md`가 Server A 헬스 확인을 명시하지 않아 `/api/health`로 오인될 소지가 있었다.
실제 경로는 존재하지 않는 `/api/health`가 아니라:
- **Server A 개별 헬스**: `GET /health` (`platform/server-a/backend/app/main.py:201`)
- **플랫폼 통합 헬스**: `GET /api/platform/health` (`routers/platform.py`, prefix `/api/platform` + `@router.get("/health")`, line 118)

`/api/health`는 404.

## 조사 결과
- `grep`으로 확인: `CLAUDE.md`에는 `/api/health` 문자열이 존재하지 않음 (케이스 2 — 암시적 오표기).
- 따라서 정확한 헬스 경로를 명시하는 라인을 "기동 방법" 섹션(데이터 확인 curl 인접)에 추가하는 방식으로 정정.

## 변경 내역
파일: `CLAUDE.md` — "### 기동 방법" 코드블록

추가된 2줄:
```bash
curl -s http://localhost:8010/health                     # Server A 헬스 확인 (경로: /health, NOT /api/health)
curl -s http://localhost:8010/api/platform/health        # 플랫폼 통합 상태 (Server A~D + 인프라 집계)
```

## 범위 준수
- 문서(`CLAUDE.md`)만 수정, 코드 파일 무수정.
- git 커밋 없음.
