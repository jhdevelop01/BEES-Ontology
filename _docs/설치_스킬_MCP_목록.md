# 설치한 Skill · MCP 서버 목록

> 작성: 2026-07-03 · 기준: `~/.claude/skills/`, `claude plugin list`, `claude mcp list` **실측**
> 범위: 전역(user scope) 설치 — 모든 프로젝트에서 사용 가능
> "유료여부"는 **도구/스킬 자체의 비용** 기준. 연결 대상 서비스(Figma·Context7 등)의 계정·플랜은 별도.

---

## 1. Skills

### 1-1. Vercel 공식 Skills (오픈소스, `npx skills add`로 설치)

| 이름 | 유료 | 용도 상세 설명 |
|------|:----:|------|
| **vercel-react-best-practices** | 무료 | React·Next.js **성능 최적화** 지침(Vercel Engineering). 과도한 `useEffect`, 무거운 client import, 렌더링 낭비, 상태 초기화 문제를 코드 작성·리뷰·리팩터링 단계에서 잡음. |
| **vercel-composition-patterns** | 무료 | 확장 가능한 **컴포넌트 합성 패턴**(compound components, render props, context). boolean prop 남발·재사용성 낮은 구조 개선. React 19 API 변경 포함. |
| **web-design-guidelines** | 무료 | UI 코드의 **Web Interface Guidelines**(접근성·UX·성능·레이아웃) 준수 검토. "UI 리뷰/접근성 체크/디자인 감사" 요청 시 발동. |
| **building-components** | 무료 | 접근성·합성 가능한 **UI 컴포넌트 구축**(컴포넌트 API, theming, design tokens, npm/registry 배포, 문서화). 사내 디자인시스템용. |
| **next-cache-components-adoption** | 무료 | Next.js **Cache Components / PPR** 도입·마이그레이션(`cacheComponents` 플래그, blocking-prerender 해결, codemod, 라우트 opt-out 판단). |
| **ai-elements** | 무료 | **AI 채팅 UI** 컴포넌트(conversation, message, tool display, prompt input)로 챗봇·AI 어시스턴트 인터페이스 구축. |
| **ai-sdk** | 무료 | **Vercel AI SDK** 질의응답·기능 구축(`generateText`, `streamText`, tool calling, structured output, RAG, `useChat`, 프로바이더 연동). |

### 1-2. 커스텀 Skills (직접 작성, 백엔드 — Vercel 대응 없음)

| 이름 | 유료 | 용도 상세 설명 |
|------|:----:|------|
| **api-contract-openapi** | 무료 | REST/HTTP **API 계약**: 요청/응답 스키마, 에러코드, 페이지네이션, 버저닝, OpenAPI 정합성. 백엔드↔프론트 계약 드리프트(모델↔실제 반환 불일치) 방지. |
| **auth-security-review** | 무료 | **인증·인가·보안** 리뷰: JWT, 세션, OAuth, RBAC, CSRF, CORS, 시크릿 관리, 레이트리밋, 비밀번호 해싱. |
| **db-migration-sql-review** | 무료 | **DB 마이그레이션·SQL** 리뷰: 인덱스, 트랜잭션/락, 롤백 안전성, N+1, 쿼리 플랜, 배치 백필. |
| **backend-test-ci** | 무료 | **백엔드 테스트·CI** 리뷰: 테스트 피라미드, 결정성(clock/random/network mock), 픽스처, CI 게이트. (FastAPI/pytest 등) |

### 1-3. 플러그인 형태 Skill

| 이름 | 유료 | 용도 상세 설명 |
|------|:----:|------|
| **frontend-design** (Anthropic 공식) | 무료 | 범용 프론트엔드 디자인 품질 지원(React/Next.js 아우름). `claude-plugins-official` 마켓플레이스. |
| **skill-creator** (Anthropic 공식, 기존) | 무료 | 커스텀 스킬 작성 지원 플러그인. |

> **참고(이번 설치 아님)**: `evaluating-llms-harness`, `find-skills`는 이전부터 있던 스킬.

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

---

## 3. 기타 설치한 개발 도구 (전역 CLI)

| 도구 | 유료 | 용도 |
|------|:----:|------|
| TypeScript(`tsc`) · ESLint · Prettier · Vite · pnpm · Playwright(+브라우저) | 무료 | 프론트엔드 빌드·린트·포맷·테스트 전역 CLI |
| VS Code (+ `code` CLI) | 무료 | 코드 에디터 |

*모든 항목 전역(user) 설치 — 컴퓨터 내 모든 프로젝트에서 사용 가능.*
