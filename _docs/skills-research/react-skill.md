# Claude Code "React Best Practices Skill" 실재 여부 조사

> 조사일: 2026-07-03 · 환경: Claude Code CLI v2.1.199 (macOS)
> 방법: 실제 CLI 확인 + 로컬 마켓플레이스 캐시 grep + WebSearch/WebFetch. **아무것도 설치하지 않음(조사·검증만).**

## 결론 (요약)

| 질문 | 답 |
|------|----|
| (a) 정확히 "React Best Practices"라는 이름의 스킬이 존재하는가? | **아니오.** 공식·커뮤니티 어디에도 그 정확한 이름의 스킬/플러그인은 없음. |
| (b) 존재 시 마켓플레이스명 + 설치 명령 | 해당 없음 (정확한 이름은 부재). |
| (c) 없으면 대안 | ① 공식 `frontend-design`(React 전용 아님) ② 커뮤니티 `react-patterns`(jezweb) ③ 커스텀 스킬 자작. 상세는 아래. |

블로그들이 부르는 "React Best Practices skill"은 **마케팅성 통칭**이며, 실제 배포 아티팩트 이름이 아니다. 가장 근접한 실물은 커뮤니티 `jezweb/claude-skills`의 **`react-patterns`** 스킬이다.

---

## 1. CLI / 플러그인 시스템 확인 (실측)

```
$ claude --version
2.1.199 (Claude Code)

$ claude plugin marketplace list
Configured marketplaces:
  ❯ claude-plugins-official   (GitHub: anthropics/claude-plugins-official)

$ claude plugin list
Installed plugins:
  ❯ skill-creator@claude-plugins-official  (user scope, enabled)
```

- 플러그인/마켓플레이스 명령 체계: `claude plugin marketplace add|list|remove|update`, `claude plugin install|list|...`.
- 설치 scope 기본값 = **`user`(전역)**. (`claude plugin install -s user|project|local`, 기본 user)
- 세션 내 슬래시 등가물: `/plugin marketplace add ...`, `/plugin install ...`.

## 2. 공식 마켓플레이스(anthropics/claude-plugins-official) 조사

로컬 캐시(`~/.claude/plugins/marketplaces/claude-plugins-official`)의 `marketplace.json`을 직접 파싱 — 200+ 플러그인 전수 확인.

- **`react` / `react-best-practices` 이름의 플러그인·스킬: 없음.**
- 플러그인 디렉터리 전체에서 `iname "*react*"` 스킬 디렉터리: **0건.**
- React와 무관하지 않은 유일한 공식 플러그인:
  - **`frontend-design`** — 스킬 1개(`frontend-design/SKILL.md`). "Create distinctive, production-grade frontend interfaces with high design quality." **디자인 품질 중심이며 React 전용 규칙 세트가 아님.**
  - 참고로 `expo`(React Native), `typescript-lsp` 등은 있으나 "React best practices"와는 다른 목적.

WebFetch로 GitHub 원본 `marketplace.json`도 교차 확인 → React 전용 항목 없음 재확인.

## 3. 커뮤니티 마켓플레이스 조사 (WebSearch)

블로그(Firecrawl, LogRocket, welcomedeveloper 등)가 언급한 "React Best Practices skill"의 실제 출처는 커뮤니티 저장소 **`jezweb/claude-skills`**.

- 저장소: `github.com/jezweb/claude-skills` — "Skills for Claude Code CLI such as full stack dev Cloudflare, React, Tailwind v4, and AI integrations."
- `frontend` 플러그인 안의 React 관련 스킬:
  - **`react-patterns`** — 트리거: "react patterns", "react performance", "reduce re-renders". React 19 성능/구성(composition) 패턴. ← **블로그가 "React Best Practices"라 부르는 실물.**
  - `react-native` (Expo), `shadcn-ui`, `tailwind-theme-builder` 등.
- **`react-best-practices`라는 정확한 이름의 스킬은 이 저장소에도 없음** (WebFetch로 README 확인).

## 4. 대안별 설치 방법 (전역 = user scope)

> ⚠️ 아래는 참고용 명령. 현재까지 **설치는 수행하지 않음.**

### 대안 A — 공식 `frontend-design` (안전, 단 React 전용 아님)
```bash
claude plugin install frontend-design@claude-plugins-official   # 기본 user(전역) scope
```
- 장점: Anthropic 관리, 이미 설정된 공식 마켓플레이스라 추가 등록 불필요.
- 한계: React 훅/리렌더/컴포지션 규칙 특화가 아니라 "프론트엔드 디자인 품질" 중심.

### 대안 B — 커뮤니티 `jezweb` `react-patterns` (React 특화, 3자 신뢰 필요)
```bash
claude plugin marketplace add jezweb/claude-skills   # 1회 등록 (user scope 기본)
claude plugin install frontend@jezweb-skills         # frontend 플러그인(=react-patterns 포함), user(전역)
```
- 마켓플레이스 등록명은 저장소의 `marketplace.json` `name` 필드 기준 **`jezweb-skills`** (install 시 `@jezweb-skills`로 참조).
- 주의: 서드파티 코드 → 설치 전 SKILL.md 내용 검토 권장.

### 대안 C — 커스텀 스킬 자작 (권장, 프로젝트 규칙 반영에 최적)
```bash
claude plugin init react-best-practices   # ~/.claude/skills/react-best-practices/ 에 스캐폴드 (다음 세션 자동 로드, user 전역)
```
- 이후 `SKILL.md`에 팀의 React 규칙(훅 사용, prop 인터페이스, variant 컴포넌트, React 19 패턴 등) 직접 기술.
- 장점: 외부 의존 없음, 프로젝트/팀 컨벤션 정밀 반영, `skill-creator`(이미 설치됨)로 작성·평가 가능.

## 근거 출처
- 로컬 실측: `claude --version`, `claude plugin marketplace list`, `claude plugin list`, `claude plugin install --help`, `marketplace.json` 로컬 파싱/grep.
- [anthropics/claude-plugins-official (marketplace.json)](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json)
- [jezweb/claude-skills README](https://github.com/jezweb/claude-skills/blob/main/README.md)
- [Extend Claude with skills — Claude Code Docs](https://code.claude.com/docs/en/skills)
- [The 5 Claude skills for React (LogRocket)](https://blog.logrocket.com/top-five-claude-skills-for-react/) · [Best Claude Code Skills (Firecrawl)](https://www.firecrawl.dev/blog/best-claude-code-skills)
