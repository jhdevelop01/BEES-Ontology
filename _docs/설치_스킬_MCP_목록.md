# Skill · MCP 서버 목록 (설치 · 직접 작성)

> 작성: 2026-07-03 · 기준: `~/.claude/skills/`, `claude plugin list`, `claude mcp list` **실측**
> 범위: 전역(user scope) 설치 — 모든 프로젝트에서 사용 가능
> "유료여부"는 **도구/스킬 자체의 비용** 기준. 연결 대상 서비스(Figma·Context7 등)의 계정·플랜은 별도.
>
> **갱신 2026-07-04** — ① LLM/Agent 엔지니어링 스킬 스위트 **10종 직접 저작·전역 설치**(§1 B-2). ② 스킬을 **출처별(A. 설치 / B. 직접 작성)로 분리** 재편. ③ 추가 요청(20종 통합 목록) 분석 → 8종 기존·React/Next는 설치본(A-1)으로 커버·LLMOps는 기존 유지, **신규 10종 더 저작**(§1 B-3, 연구·학습·데이터·안전·비용 계열). 이번 세션 스킬/MCP **삭제 없음**. 기존 MCP 삭제 이력(GitHub·Google Drive)은 §2 그대로.

---

## 1. Skills

스킬은 **출처(provenance)**로 나뉜다 — **A. 공식·마켓플레이스에서 설치(installed)** vs **B. 이 프로젝트에서 직접 작성(authored)**. 재현 방식이 다르므로 구분한다: A는 재설치, B는 파일 복사 또는 재저작.

### A. 공식 · 마켓플레이스 설치 (installed)

#### A-1. Vercel 공식 Skills (오픈소스, `npx skills add`로 설치) — 7종

| 이름 | 유료 | 용도 상세 설명 |
|------|:----:|------|
| **vercel-react-best-practices** | 무료 | React·Next.js **성능 최적화** 지침(Vercel Engineering). 과도한 `useEffect`, 무거운 client import, 렌더링 낭비, 상태 초기화 문제를 코드 작성·리뷰·리팩터링 단계에서 잡음. |
| **vercel-composition-patterns** | 무료 | 확장 가능한 **컴포넌트 합성 패턴**(compound components, render props, context). boolean prop 남발·재사용성 낮은 구조 개선. React 19 API 변경 포함. |
| **web-design-guidelines** | 무료 | UI 코드의 **Web Interface Guidelines**(접근성·UX·성능·레이아웃) 준수 검토. "UI 리뷰/접근성 체크/디자인 감사" 요청 시 발동. |
| **building-components** | 무료 | 접근성·합성 가능한 **UI 컴포넌트 구축**(컴포넌트 API, theming, design tokens, npm/registry 배포, 문서화). 사내 디자인시스템용. |
| **next-cache-components-adoption** | 무료 | Next.js **Cache Components / PPR** 도입·마이그레이션(`cacheComponents` 플래그, blocking-prerender 해결, codemod, 라우트 opt-out 판단). |
| **ai-elements** | 무료 | **AI 채팅 UI** 컴포넌트(conversation, message, tool display, prompt input)로 챗봇·AI 어시스턴트 인터페이스 구축. |
| **ai-sdk** | 무료 | **Vercel AI SDK** 질의응답·기능 구축(`generateText`, `streamText`, tool calling, structured output, RAG, `useChat`, 프로바이더 연동). |

#### A-2. 플러그인 (Anthropic `claude-plugins-official` 마켓플레이스) — 2종

| 이름 | 유료 | 용도 상세 설명 |
|------|:----:|------|
| **frontend-design** (Anthropic 공식) | 무료 | 범용 프론트엔드 디자인 품질 지원(React/Next.js 아우름). |
| **skill-creator** (Anthropic 공식) | 무료 | 커스텀 스킬 작성 지원 플러그인. (B-2 스위트를 이 플러그인 형식으로 저작함) |

> **그 외(이번 설치·작성 아님)**: `evaluating-llms-harness`, `find-skills`는 이전부터 있던 외부 제공 스킬 — A/B 어느 쪽도 아니므로 별도 표기.

### B. 직접 작성 (authored — 이 프로젝트에서 저작)

#### B-1. 커스텀 백엔드 Skills (직접 작성, Vercel 대응 없음) — 4종

| 이름 | 유료 | 용도 상세 설명 |
|------|:----:|------|
| **api-contract-openapi** | 무료 | REST/HTTP **API 계약**: 요청/응답 스키마, 에러코드, 페이지네이션, 버저닝, OpenAPI 정합성. 백엔드↔프론트 계약 드리프트(모델↔실제 반환 불일치) 방지. |
| **auth-security-review** | 무료 | **인증·인가·보안** 리뷰: JWT, 세션, OAuth, RBAC, CSRF, CORS, 시크릿 관리, 레이트리밋, 비밀번호 해싱. |
| **db-migration-sql-review** | 무료 | **DB 마이그레이션·SQL** 리뷰: 인덱스, 트랜잭션/락, 롤백 안전성, N+1, 쿼리 플랜, 배치 백필. |
| **backend-test-ci** | 무료 | **백엔드 테스트·CI** 리뷰: 테스트 피라미드, 결정성(clock/random/network mock), 픽스처, CI 게이트. (FastAPI/pytest 등) |

#### B-2. LLM/Agent 엔지니어링 스킬 스위트 (직접 저작, 2026-07-04 · 사내 표준) — 10종

> 마켓플레이스에 없어 `skill-creator` 형식으로 **신규 저작**한 10종. 각 스킬 = `SKILL.md`(<500줄) + `references/*.md`(3~4종). context7·claude-api·공식 문서로 그라운딩(기억 의존 회피). 전역 설치(`~/.claude/skills/<slug>/`).

| 이름 | 유료 | 용도 상세 설명 |
|------|:----:|------|
| **skill-authoring-qa** | 무료 | 기존/작성 중 **Agent Skill 품질 리뷰·표준화**: SKILL.md 구조, frontmatter, progressive disclosure, description 트리거링, 안티패턴, 보안. `skill-creator`(생성)의 QA 짝. |
| **prompt-engineering-review** | 무료 | **LLM 프롬프트/시스템 프롬프트 설계·리뷰**: 역할부여, XML/마크다운 구조화, few-shot, CoT, 출력형식 강제, prefill, 컨텍스트 배치 + 복사용 리뷰 루브릭. Claude vs OpenAI 차이. |
| **prompt-evaluation-regression** | 무료 | **프롬프트/모델/RAG 변경의 품질 저하(회귀) 방지**: 평가셋 설계, assertion(exact/정규식/semantic/LLM-judge), 통계 유의성, promptfoo CI 게이팅. |
| **rag-engineering** | 무료 | **프로덕션 RAG 파이프라인** 설계·디버깅·평가: 청킹·임베딩·벡터스토어(pgvector/Qdrant/Chroma/FAISS)·하이브리드 검색·리랭킹·Contextual Retrieval·RAGAS. |
| **agent-orchestration** | 무료 | **멀티에이전트/LLM 오케스트레이션** 설계: workflow vs agent, 라우팅·오케스트레이터-워커·평가자-최적화 패턴. LangGraph/CrewAI/Mastra 비교. |
| **tool-calling-mcp-design** | 무료 | **LLM이 올바르게 호출하는 tool 설계**: tool schema/description, Anthropic tool_use, parallel tool calls, tool_choice, MCP tool. |
| **agent-evaluation-harness** | 무료 | **다단계 에이전트 평가**: task success·tool-call 정확도·trajectory·pass^k. tau-bench/SWE-bench/WebArena. (학술 벤치마크 `evaluating-llms-harness`와 구분 — 에이전트/트래젝토리 초점) |
| **llmops-evaluation-tracing** | 무료 | **프로덕션 LLM/agent 트레이싱·관측·온라인 평가**: Langfuse/LangSmith/Arize Phoenix, OpenTelemetry GenAI, 토큰·비용·지연 추적. |
| **llm-fine-tuning** | 무료 | **오픈 LLM 파인튜닝**: LoRA/QLoRA/PEFT, SFT→선호정렬(DPO/ORPO), TRL/Axolotl/Unsloth, 데이터셋·VRAM·과적합. |
| **llm-inference-serving** | 무료 | **LLM 추론·서빙**: vLLM/TGI/SGLang/Ollama·llama.cpp, 양자화(GPTQ/AWQ/GGUF/FP8), OpenAI 호환 엔드포인트, GPU/VRAM 사이징. (로컬 Ollama+gemma 맥락 반영) |

> **품질 검증**: 10종 전량 `skill-authoring-qa` 6패스 **교차 리뷰 완료** — Ship 4 · Fix-then-ship 6 · Blocking 0. 발견 실버그 4종(pass^k·은퇴모델 id·vLLM 기본값·계측 정합성) + description handoff 10종 + frontmatter 누수 3종 **전량 수정**. 종합 리포트: `~/.claude/skills/SUITE-QA-REPORT.md`.

#### B-3. LLM/Agent 스킬 스위트 — 확장 (직접 저작, 2026-07-04 · 연구·학습·데이터·안전·비용) — 10종

> "20종 통합 목록" 요청 분석 결과 신규 저작한 10종(모델 개발 라이프사이클 보강). 지난 QA 교훈을 선반영 — **처음부터 최소 frontmatter(name·description만) + description에 형제 스킬 handoff 포함**. 검증: 10/10 최소 frontmatter·handoff·references 3종(장식필드 누수 0건).
> **요청 20종 중 미저작분**: LLM Fine-tuning·Inference&Serving·RAG·Prompt Eng&Review·Prompt Eval&Regression·Agent Orchestration·Tool-Calling&MCP·Agent Evaluation = B-2에 기존재 / LLMOps Eval&Tracing = B-2 기존재(요청의 MLflow만 미포함) / React/Next.js Frontend = A-1 설치본으로 커버(중복 회피 위해 미생성).

| 이름 | 유료 | 용도 상세 설명 |
|------|:----:|------|
| **research-review** | 무료 | **ML/LLM 문헌 탐색·정독·서베이·비판적 리뷰**: arXiv/Semantic Scholar/OpenReview 검색·citation graph, 3-pass 정독 템플릿, related-work 합성, soundness/novelty/재현성 루브릭. |
| **research-ideation-experiment-design** | 무료 | **연구 아이디어→falsifiable 가설→pre-registered 실험 설계**: baseline·ablation·metric 선택, seed·검정력·통계검정, confound 통제, 컴퓨트 예산, 재현성 체크리스트. |
| **huggingface-model-data** | 무료 | **HuggingFace 모델·데이터**: transformers 로드·추론(AutoModel/device_map/safetensors), datasets(load/map/stream), chat template, Model Card, Hub push(gated/private). |
| **distributed-llm-training** | 무료 | **다중 GPU/노드 학습**: DeepSpeed(ZeRO 1/2/3)·FSDP2·Lightning·Megatron(TP/PP) 비교·설정, grad checkpoint/accumulation, bf16, NCCL 멀티노드, OOM 트러블슈팅. |
| **quantization-tokenization** | 무료 | **토크나이제이션·양자화 개념**: 토크나이저(BPE/SPM), chat template(add_generation_prompt), sequence packing, 양자화(GPTQ/AWQ/GGUF/bnb nf4) 방법·트레이드오프. (서빙 양자화는 llm-inference-serving) |
| **structured-output** | 무료 | **구조화 출력 강제**: OpenAI response_format·Claude output_config.format·strict tool, OSS constrained decoding(Outlines/Guidance/xgrammar/lm-format-enforcer), JSON schema 패턴. |
| **agent-memory** | 무료 | **에이전트 메모리 설계**: 단기(rolling summary/compaction)·장기(episodic/semantic/procedural)·벡터 메모리, write/retrieve/consolidate/forget 정책, LangGraph/Mem0/Letta. (문서지식은 rag-engineering) |
| **safety-security-review** | 무료 | **LLM/에이전트 보안(방어 전용)**: 프롬프트 인젝션·jailbreak·tool/MCP 남용·데이터 유출, OWASP LLM Top 10(2025), 신뢰경계 분리·최소권한·human gate. (앱 인증·인가는 auth-security-review) |
| **llm-cost-latency-optimization** | 무료 | **앱레벨 비용·지연 최적화**: prompt caching, 프롬프트 다이어트, 모델 라우팅/cascade, batch API, 스트리밍. (엔진 튜닝은 llm-inference-serving) |
| **dataset-curation-synthetic-data** | 무료 | **데이터셋 큐레이션·합성**: 정제·필터링, 중복제거(MinHash-LSH), PII 제거, 합성데이터(self-instruct/evol-instruct/distillation, distilabel), 오염제거 평가셋. |

---

## 2. MCP 서버

| 이름 | 유료 | 상태 | 인증 방식 | 용도 상세 설명 |
|------|:----:|:----:|------|------|
| **Figma** (기존) | 무료¹ | ✔ Connected | OAuth(완료) | 디자인 프레임·컴포넌트·변수·레이아웃·FigJam 컨텍스트를 코드로 변환. 디자인-코드 워크플로우. |
| **Playwright** | 무료 | ✔ Connected | 불필요 | accessibility snapshot 기반 웹 탐색·클릭·입력. UI 테스트, 로그인 플로우, 회귀 테스트, 화면 QA. |
| **Context7** | 무료² | ✔ Connected | 선택(API키) | React/Next.js/Tailwind/FastAPI 등 **최신 공식 문서를 프롬프트에 주입** → 오래된 API 사용·hallucination 감소. |
| **Chrome DevTools** | 무료 | ✔ Connected | 불필요³ | 실제 브라우저의 DOM·콘솔·네트워크·성능 trace·접근성 문제를 직접 확인·해석. |
| **Sequential Thinking** | 무료 | ✔ Connected | 불필요 | 복잡한 문제를 **단계적 사고(순차 추론)**로 분해하고, 필요 시 이전 단계를 수정·분기하며 해결. 계획 수립·다단계 추론·구조화된 문제해결 보조. Anthropic 공식 reference 서버. |

**유료여부 각주:**
1. Figma MCP 자체는 무료. 단 **Figma 계정 필요**, Dev Mode 고급 기능은 유료 좌석(Dev/Full seat)이 필요할 수 있음.
2. Context7 기본 사용 무료. **사용량 한도 확장 시** Upstash API 키(유료 플랜 옵션) 필요.
3. Chrome DevTools MCP 무료. Node.js + Chrome(stable/for-testing) 필요. 라이브 Chrome 세션을 제어하므로 브라우저 콘텐츠 노출에 주의.

> **변경 이력 / 참고 (제거·추가):**
> - **GitHub MCP** → 제거됨 (`claude mcp remove github`, user config에서 삭제).
> - **Google Drive** → CLI로 제거 불가(claude.ai 계정 레벨 연동). **현재도 연결 상태이며, 완전 해제는 claude.ai → Settings → Connectors에서 수동 진행 필요.**
> - **Sequential Thinking** → 신규 추가 (Anthropic 공식 reference 서버).

---

## 3. 기타 설치한 개발 도구 (전역 CLI)

| 도구 | 유료 | 용도 |
|------|:----:|------|
| TypeScript(`tsc`) · ESLint · Prettier · Vite · pnpm · Playwright(+브라우저) | 무료 | 프론트엔드 빌드·린트·포맷·테스트 전역 CLI |
| VS Code (+ `code` CLI) | 무료 | 코드 에디터 |

*모든 항목 전역(user) 설치 — 컴퓨터 내 모든 프로젝트에서 사용 가능.*

---

## 4. 새 컴퓨터에서 재현 (Setup 스크립트)

다른 맥/우분투에서 위 환경을 그대로 구성하려면 아래 스크립트를 1회 실행(재실행 안전):

| OS | 스크립트 | 실행 |
|----|----------|------|
| macOS | [`scripts/setup-dev-env-macos.sh`](../scripts/setup-dev-env-macos.sh) | `bash scripts/setup-dev-env-macos.sh` |
| Ubuntu 20.04+ | [`scripts/setup-dev-env-ubuntu.sh`](../scripts/setup-dev-env-ubuntu.sh) | `bash scripts/setup-dev-env-ubuntu.sh` |

- 구성: nvm+node(default 고정) · npm CLI 6종 · Playwright 브라우저 · VS Code · MCP 4종(user 스코프) · frontend-design 플러그인 · Vercel 스킬 7종(A-1) · 커스텀 스킬 4종(B-1, 파일 임베드).
- **전제**: Claude Code(`claude`) 사전 설치 필요(미설치 시 MCP/스킬 단계는 자동 건너뜀, 안내 출력).
- **범위 밖**: 계정 연동 MCP(Figma/Google Drive)는 claude.ai 로그인으로 자동 연결되므로 스크립트가 다루지 않음.
- **미반영**: 2026-07-04 추가한 LLM/Agent 스킬 스위트 10종(§1 B-2)은 아직 setup 스크립트에 임베드되지 않음 — 다른 컴퓨터 재현 시 별도 반영 필요(`~/.claude/skills/`의 10개 디렉토리 복사 또는 재저작).
