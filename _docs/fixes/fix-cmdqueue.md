# Fix — `/command-queue` 항상 0 반환 버그

## 무엇을
Server B의 `GET /command-queue` 엔드포인트가 항상 모든 필드 0을 반환하던 버그를 수정.
`platform/server-b/app/main.py`의 응답모델 `CommandQueueStatus`와
`platform/server-b/app/command_queue.py`의 `get_status()` 반환 계약을 일치시킴.

## 왜 (근본 원인)
`command_queue.get_status()`가 반환하는 딕셔너리 키와 `CommandQueueStatus` 모델 필드가
사실상 하나도 겹치지 않았다. FastAPI는 `response_model`로 직렬화할 때 모델에 없는 키는
무시하고, 모델 필드는 소스에 없으면 default(=0)로 채운다. 그 결과 전 필드가 0으로 반환됨.

특히 `failed`는 두 쪽에 모두 존재하지만, `get_status()`에서는 **중첩된 `stats` 딕셔너리 안**에
있어(`status["stats"]["failed"]`) 최상위 `failed` 필드와 매칭되지 않았다. 평탄화가 없으면
`failed`조차 default 0.

## 전/후 필드 매핑

### `get_status()` 실제 반환 구조 (command_queue.py, 변경 없음)
```python
{
  "queue_size": int,
  "max_retries": int,
  "ttl_seconds": int,
  "stats": {
    "enqueued": int,
    "succeeded": int,
    "expired": int,
    "failed": int,
  },
}
```

### Before — `CommandQueueStatus` (전혀 매칭 안 됨 → 전부 0)
| 모델 필드 | get_status() 소스 | 매칭 |
|-----------|-------------------|:----:|
| pending    | (없음) | ✗ |
| processing | (없음) | ✗ |
| completed  | (없음) | ✗ |
| failed     | stats.failed (중첩, 평탄화 안 됨) | ✗ |
| total      | (없음) | ✗ |

### After — `CommandQueueStatus` (get_status 계약과 1:1 일치)
| 모델 필드 | get_status() 소스 | 매칭 |
|-----------|-------------------|:----:|
| queue_size   | status.queue_size        | ✓ |
| enqueued     | status.stats.enqueued    | ✓ (평탄화) |
| succeeded    | status.stats.succeeded   | ✓ (평탄화) |
| expired      | status.stats.expired     | ✓ (평탄화) |
| failed       | status.stats.failed      | ✓ (평탄화) |
| max_retries  | status.max_retries       | ✓ |
| ttl_seconds  | status.ttl_seconds       | ✓ |

## 변경 파일
- `platform/server-b/app/main.py`
  - `CommandQueueStatus` 모델 재정의 (구 필드 pending/processing/completed/total 제거,
    실제 계약 필드 7개로 교체)
  - `get_command_queue_status()` 엔드포인트가 `get_status()`의 중첩 `stats`를 평탄화하여
    `CommandQueueStatus`로 명시 반환하도록 수정 (반환 타입도 `dict` → `CommandQueueStatus`)
- `platform/server-b/app/command_queue.py` — **변경 없음** (계약 기준점으로 채택)

## 계약 선택 근거
`get_status()` 쪽을 손대지 않고 응답모델을 실제 데이터에 맞춘 이유:
`get_status()`가 주는 값(queue_size/enqueued/succeeded/expired/failed 등)이 큐의 실제
상태를 정확히 표현하며, 구 모델 필드(pending/processing/completed/total)는 이 큐 구현에
대응하는 실데이터가 없어(예: "processing"이라는 별도 상태 없음) 유지할 실익이 없었다.

## 검증
- `python3 -m py_compile app/main.py app/command_queue.py` → OK
- (docker 재기동/재빌드는 중앙 처리 — 본 작업 범위 외)
