# Claude Code "Next.js Skill" 실재 여부 조사

> 조사일: 2026-07-03 · 방법: 실제 `claude plugin` CLI 실측 + 로컬 마켓플레이스 캐시 검사 + WebSearch/WebFetch. **아무것도 설치하지 않음(조사·검증만).**

## 결론 요약

| 항목 | 결과 |
|------|------|
| (a) 정확히 "Next.js Skill" 이름의 **공식** 스킬 존재? | **아니오.** Anthropic 공식 마켓플레이스에 Next.js 전용 스킬/플러그인 없음 |
| (b) 공식 마켓플레이스명 + 설치 명령 | 해당 없음 (공식 항목 부재) |
| (c) 대안 | ① 커뮤니티 마켓플레이스(비공식) 또는 ② 커스텀 스킬 직접 작성 (권장) |

---

## 1. CLI 실측 결과

현재 이 머신에 **설정된 마켓플레이스는 공식 1개뿐**이다.

```
$ claude plugin marketplace list
Configured marketplaces:
  ❯ claude-plugins-official
    Source: GitHub (anthropics/claude-plugins-official)

$ claude plugin list
Installed plugins:
  ❯ skill-creator@claude-plugins-official   (user scope, enabled)
```

CLI 명령 체계 (참고):
- `claude plugin marketplace add <URL|path|GitHub repo>` — 마켓플레이스 추가
- `claude plugin install <plugin>@<marketplace> [-s user|project|local]` — 설치 (기본 scope=user)
- `claude plugin init <name>` — `~/.claude/skills/<name>/`에 **커스텀 스킬 스캐폴딩** (다음 세션에 `<name>@skills-dir`로 자동 로드)

## 2. 공식 마켓플레이스 실제 내용 (로컬 캐시 `~/.claude/plugins/marketplaces/claude-plugins-official`)

포함된 플러그인 (약 40개 + external_plugins) — **Next.js 전용 항목 없음**:
- 언어 LSP: typescript-lsp, pyright-lsp, gopls-lsp, rust-analyzer-lsp, ruby-lsp, php-lsp, swift-lsp, csharp-lsp, clangd-lsp, lua-lsp, jdtls/kotlin-lsp
- 개발/워크플로우: feature-dev, code-review, pr-review-toolkit, code-modernization, code-simplifier, commit-commands, plugin-dev, mcp-server-dev, agent-sdk-dev, skill-creator, hookify, ralph-loop 등
- 디자인/프론트: **frontend-design** (Next.js 전용 아님, 범용 프론트 디자인)
- external_plugins(MCP): github, gitlab, linear, playwright, firebase, laravel-boost, context7, serena 등

`grep -ri "next"` 로 걸린 파일들은 모두 무관한 문맥("next step" 등) 또는 참조 문서 언급일 뿐, **Next.js 스킬 정의(SKILL.md)는 존재하지 않음.**

`anthropics/skills` 저장소(document-skills, example-skills, claude-api)에도 Next.js 항목 없음 (WebFetch 확인).

## 3. 근접 대안 (모두 비공식 커뮤니티 / 검증 링크)

> ⚠️ 아래는 Anthropic 공식이 아님. 설치 전 신뢰성/라이선스 검토 필요.

### 대안 A — `laguagu/claude-code-nextjs-skills` (스킬 모음)
- https://github.com/laguagu/claude-code-nextjs-skills
- 포함 스킬: `ai-app`, `nextjs-shadcn`, `nextjs-chatbot`, `shadcn`, `frontend-design`, `chrome-devtools`, `ai-sdk-6`, `postgres-semantic-search`, `next-best-practices`, `skill-creator`, `handoff`
- **설치 방식**: `claude plugin marketplace add` 명령 **미제공**. 저장소의 스킬 폴더를 `~/.claude/skills/`(전역) 또는 `.claude/skills/`(프로젝트)로 **복사/심링크**하는 수동 방식.

### 대안 B — `rdimascio/nextjs-marketplace` (플러그인 마켓플레이스 형태)
- https://github.com/rdimascio/nextjs-marketplace
- 10개 플러그인 (App Router Essentials, Server Components Pro, Server Actions Toolkit, Data Fetching Patterns, Metadata & SEO, API Routes Pro, Middleware Auth, Image & Performance, Deployment Optimizer, i18n) / 30+ 커맨드 / 35+ 스킬
- **설치 방식**: README는 `cp -r plugins/* .../.claude/plugins/` 수동 복사만 안내. 표준 `marketplace add` 명령 미제공.

### 대안 C (권장) — 커스텀 스킬 직접 작성
공식/검증된 Next.js 스킬이 없고 위 커뮤니티 리소스는 표준 설치 경로를 제공하지 않으므로, **직접 커스텀 스킬을 만드는 것이 가장 안전·명확**하다.

```bash
# 전역(user) 스킬 스캐폴딩 → ~/.claude/skills/nextjs/
claude plugin init nextjs
# 또는 이미 설치된 skill-creator@claude-plugins-official 플러그인 활용
```
- `claude plugin init <name>` 은 `~/.claude/skills/<name>/`에 생성 → **모든 프로젝트에 전역 적용**, 다음 세션에 `<name>@skills-dir`로 자동 로드.
- 내용 작성은 `skill-creator` 스킬(이미 설치됨)로 지원 가능.

---

## 전역(user) 설치 방법 정리

| 목표 | 명령 |
|------|------|
| 공식 마켓플레이스의 플러그인을 전역 설치 | `claude plugin install <plugin>@claude-plugins-official -s user` (단, Next.js 전용 항목 없음) |
| 커스텀 Next.js 스킬 전역 생성 | `claude plugin init nextjs` → `~/.claude/skills/nextjs/SKILL.md` 편집 |
| 커뮤니티 스킬 폴더 전역 배치 | 해당 repo의 스킬 폴더를 `~/.claude/skills/`로 복사/심링크 |

## 참고 출처
- 공식 마켓플레이스: https://github.com/anthropics/claude-plugins-official
- anthropics/skills marketplace.json: https://github.com/anthropics/skills/blob/main/.claude-plugin/marketplace.json
- 커뮤니티 A: https://github.com/laguagu/claude-code-nextjs-skills
- 커뮤니티 B: https://github.com/rdimascio/nextjs-marketplace
- 로컬 실측: `claude plugin marketplace list` / `claude plugin list` / `~/.claude/plugins/marketplaces/`
