# Fix: Server D `/data/points/summary` record_count=0 문제

## 문제
`platform/server-d/app/routers/points.py`의 `get_points_summary()`에서 각 포인트의
`record_count`가 하드코딩 `0`으로 반환됨 (기존 주석: "개별 카운트는 비용이 크므로 생략").
`total_records`(전체 합계)만 정상 집계되고 있었음.

## 원인
포인트별 카운트를 구하려면 N+1 쿼리(포인트마다 1회)가 되어 비용이 크다는 판단으로,
개별 카운트를 생략하고 `record_count=0` 고정. 전체 합계는 `count() → group() → sum()`
단일 쿼리로만 계산.

## 해결
포인트별 카운트를 **`group(columns:["point_id"])` 후 `count()`** 하는 **단일 grouped 쿼리**로
한 번에 구해 `dict[point_id -> count]` 맵을 만들고, 각 `PointSummaryItem.record_count`에 매핑.
N+1 없이 1회 쿼리로 포인트별 카운트 + 전체 합계(`total_records`)를 동시에 확보.

### 변경 요지
- `count_flux`: `count() |> group() |> sum()` (전체 합계만) →
  `group(columns:["point_id"]) |> count()` (포인트별 카운트)
- 카운트 결과를 `count_map`으로 수집하면서 `total_records`는 각 카운트 누적 합으로 계산
- `record_count=0` → `record_count=count_map.get(pid, 0)`
- 카운트 쿼리 실패 시 `count_map` 빈 상태 유지 → 기존처럼 `record_count`는 0으로 안전 폴백
  (`total_records`도 0), 이벤트 루프 블로킹 방지 위해 `run_influx_query`(executor 오프로드) 사용
- 조회 범위는 기존과 동일(`-7d`)

## 변경 파일
- `platform/server-d/app/routers/points.py` — `get_points_summary()` (약 56~91행 영역)

## 검증
```
python3 -m py_compile platform/server-d/app/routers/points.py  # OK
```

## 비고
- git 커밋 / docker 재기동·재빌드는 수행하지 않음 (범위 밖).
- 다른 서버 파일 변경 없음.
