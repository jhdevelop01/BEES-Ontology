# BEES AI 채팅 — 용어 통일 감사 + LLM 답변 정확도 개선 리서치

> **작성일**: 2026.02.24
> **대상**: platform/server-a/backend/app/services/openai_service.py 및 관련 프론트엔드/백엔드

---

## Part 1: 용어 통일 감사 결과

### 발견된 불일치

#### 1. ko.json 내부 — statusWarning 이중 번역
| 위치 | 키 | 값 | 사용처 |
|------|-----|-----|--------|
| 260줄 (topology 섹션) | `statusWarning` | **"경고"** | 토폴로지 페이지 |
| 731줄 (floors 섹션) | `statusWarning` | **"주의"** | 층별 현황 페이지 |

같은 `statusWarning` 키가 페이지별로 다르게 번역됨. 사용자가 토폴로지에서는 "경고", 층별 현황에서는 "주의"를 봄.

#### 2. 알람 심각도 5단계 vs 실제 2단계
| UI 정의 (ko.json) | 실제 MQTT 발행 (Server C) |
|-------------------|--------------------------|
| critical: "위험" | critical ✓ |
| major: "주의" | — (미사용) |
| warning: "경고" | warning ✓ |
| minor: "경미" | — (미사용) |
| info: "정보" | — (미사용) |

MQTT/PostgreSQL에는 `critical`/`warning` 2단계만 사용하는데, UI에 5단계가 정의되어 있음.

#### 3. LLM 프롬프트 ↔ UI 용어
| 개념 | LLM 프롬프트 (v4) | 층별 현황 UI | 토폴로지 UI |
|------|-------------------|-------------|------------|
| critical 상태 | "위험" | "위험" | "위험" |
| warning 상태 | **"주의"** | **"주의"** | **"경고"** |
| normal 상태 | "정상" | "정상" | "정상" |

v4 프롬프트는 층별 현황 UI("주의")와 일치하지만, 토폴로지 UI("경고")와는 불일치.

### 권장 조치
1. ko.json의 `statusWarning`을 한 가지로 통일 ("주의" 또는 "경고" 중 선택)
2. 사용하지 않는 알람 심각도(major/minor/info)를 UI에서 제거하거나, Server C에서 발행하도록 확장

---

## Part 2: LLM 답변 정확도 개선 방안

### A. 현재 시스템 분석

| 항목 | 현황 |
|------|------|
| SYSTEM_PROMPT | ~6,000자, ~1,500-3,000 토큰 (GPT-4o 128K의 ~2%) |
| 도구 수 | 12개 (OpenAI 권장 20개 미만 — 적합) |
| 도구 호출 제한 | max_iterations = 5 |
| 세션 관리 | Stateless, 최근 10개 이력만 전달 |
| 결과 전달 | JSON 원본 그대로 (요약/압축 없음) |

### B. 즉시 적용 가능한 개선 (1~2일)

#### B1. 도구 Description 강화 (기대효과: 도구 선택 정확도 5~10% 향상)

현재: "무엇을 하는지"만 기술
개선: "언제 사용해야 하는지" + "다른 도구와의 구분" 추가

```python
# 개선 전
"description": "특정 층의 장비 목록을 조회합니다."

# 개선 후
"description": (
    "특정 층에 설치된 장비 목록을 조회합니다 (Neo4j 온톨로지). "
    "사용 시점: '5층에 어떤 장비가 있어?', '지하2층 장비 목록' 등 특정 층의 장비 구성을 알고 싶을 때. "
    "장비의 센서값이 필요하면 이 도구로 장비를 찾은 후 get_realtime_sensor_data를 사용하세요. "
    "전 층 온도/습도 비교는 get_floor_environment를 사용하세요."
)
```

#### B2. 시스템 프롬프트 구조 재배치

현재: 필수 규칙이 프롬프트 끝에 위치 → LLM recency bias로 무시 가능

개선 구조:
```
1. [역할 및 범위]
2. [필수 규칙] ← 현재 끝에 있는 것을 앞으로 이동
3. [대시보드 판정 기준]
4. [질문 유형별 도구 선택 가이드] ← 신규 추가
5. [복합 질문 처리 전략 + Few-shot 예시]
6. [건물 구조/시스템] — 참조 정보
7. [응답 형식]
```

#### B3. 질문 유형별 도구 선택 가이드 테이블 추가

```
## 질문 유형별 도구 선택 가이드
- "~층에 뭐가 있어?" → get_equipment_on_floor
- "온도/습도 비교, 가장 높은/낮은 층" → get_floor_environment
- "대시보드에서 위험/주의 이유" → get_floor_environment + get_alarm_history (2개 필수)
- "특정 장비 센서값" → get_realtime_sensor_data
- "어제 온도 추이" → get_point_history
- "알람 이력" → get_alarm_history
- "냉방 시스템 구성" → get_system_info
- "에너지 흐름" → get_energy_flow
- "장비가 어디에 있어?" → query_building_ontology (hasLocation Cypher)
```

#### B4. Few-shot 도구 호출 패턴 예시 추가 (기대효과: 10~15% 정확도 향상)

```
## 도구 호출 패턴 예시

예시 1 - "대시보드에서 7층이 위험으로 나오는데 왜 그래?"
  → 1단계: get_floor_environment() 호출하여 7층 온도 확인
  → 2단계: get_alarm_history(equipment_id="7F") 호출하여 알람 확인
  → 답변: 온도를 판정 기준에 대입하여 "18°C 미만이므로 위험(temp_extreme)" 설명

예시 2 - "냉동기가 공급하는 장비 목록 알려줘"
  → get_energy_flow(equipment_name="Chiller_1", direction="feeds") 호출
  → 결과의 feeds_to 목록을 나열

예시 3 - "어제 5층 온도가 어땠어?"
  → get_point_history(point_id="bldg:AHU_1_RAT", start="-24h") 호출
  → 시간대별 온도 추이와 min/max/avg 통계 제공
```

### C. 중기 적용 (3~5일)

#### C1. 도구 결과에 판정 미리 계산 (판정 오류 근본 해결)

get_floor_environment 결과에 대시보드와 동일한 판정 로직을 서버에서 미리 수행:

```python
def _classify_floor_status(temp, co2=None):
    if temp is not None:
        if temp > 28 or temp < 18:
            return "위험", "temp_extreme"
        if temp > 26 or temp < 20:
            return "주의", "temp_deviation"
    if co2 and co2 > 1000:
        return "주의", "co2_high"
    return "정상", "normal"

# 결과에 추가
floor_data["dashboard_status"] = "위험"
floor_data["status_reason"] = "temp_extreme"
floor_data["near_boundary"] = abs(temp - 18) < 1  # 경계값 근처 플래그
```

LLM이 판정 기준을 직접 적용할 필요 없어지므로 판정 오류가 구조적으로 불가능해짐.

#### C2. 대시보드 컨텍스트 선제 주입 (시점 차이 문제 근본 해결)

프론트엔드에서 채팅 요청 시 대시보드 현재 상태를 함께 전달:

```typescript
// 프론트엔드
const res = await sendChatMessage(msg, history, {
  dashboard_context: {
    floor_status: { "2F": { status: "위험", temp: 17.9 }, ... },
    timestamp: new Date().toISOString(),
  }
});
```

```python
# 백엔드 — 시스템 메시지에 주입
if dashboard_context:
    context = f"[대시보드 현재 상태] {json.dumps(dashboard_context)}"
    messages.append({"role": "system", "content": context})
```

이렇게 하면 LLM이 "대시보드에 표시된 값"과 "API 조회한 값" 모두 참조 가능.

#### C3. 답변 검증 후처리 파이프라인

LLM 답변에서 온도-판정 조합을 추출하여 코드로 검증:

```python
def _validate_response(response_text, tool_results):
    temp_mentions = re.findall(r'(\d+\.?\d*)\s*°?C?.*(위험|주의|정상)', response_text)
    for temp_str, status in temp_mentions:
        expected = _classify_floor_status(float(temp_str))[0]
        if status != expected:
            response_text += f"\n(참고: {temp_str}°C는 판정 기준상 '{expected}'입니다.)"
    return response_text
```

### D. 장기 검토

| 방안 | 도입 조건 | 현재 필요성 |
|------|----------|-----------|
| RAG/벡터 검색 | 도구 30개+ 또는 프롬프트 10K+ 토큰 | 불필요 (현재 12개/3K) |
| Fine-tuning | 프롬프트 최적화 후에도 반복 오류 | 불필요 (프롬프트 개선 여지 충분) |

### E. 발생했던 5가지 문제별 해결 매핑

| 문제 | 즉시 해결 | 중기 해결 |
|------|----------|----------|
| 1. 알람 이력만 조회 (온도 누락) | B1 description 강화 + B3 도구 가이드 + B4 Few-shot | — |
| 2. 판정 기준 반대 해석 | B4 Few-shot 예시 | C1 판정 미리 계산 |
| 3. 용어 불일치 (경고/주의) | ko.json 통일 | — |
| 4. 경계값 시점 차이 미안내 | B4 Few-shot + 프롬프트 강조 | C1 near_boundary 플래그 |
| 5. 시뮬레이션 데이터 변동 | — | C2 대시보드 컨텍스트 주입 |

### 참고 자료
- OpenAI Function Calling Guide: https://platform.openai.com/docs/guides/function-calling
- OpenAI Cookbook (o3/o4-mini): https://developers.openai.com/cookbook/examples/o-series/
- LangChain Few-shot Tool Calling: https://blog.langchain.com/few-shot-prompting-to-improve-tool-calling-performance/
- Prompt Engineering Guide: https://www.promptingguide.ai/applications/function_calling
