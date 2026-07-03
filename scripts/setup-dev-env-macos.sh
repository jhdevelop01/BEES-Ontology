#!/usr/bin/env bash
# ============================================================================
# 개발환경 재현 스크립트 (macOS)
# 새 맥에서 1회 실행 → 전역(user) 개발환경 구성:
#   nvm+node, npm CLI(tsc/eslint/prettier/vite/pnpm/playwright), VS Code,
#   Claude Code MCP 서버 4종, frontend-design 플러그인, Vercel 스킬 7종 + 커스텀 스킬 4종
#
# 사용:  bash setup-dev-env-macos.sh
# 재실행 안전(idempotent): 이미 있는 항목은 건너뜀.
# ============================================================================
set -uo pipefail

NODE_VERSION="24.12.0"          # 고정 node 버전 (환경변수로 덮어쓰기 가능: NODE_VERSION=22.11.0 bash ...)
SKILLS_DIR="$HOME/.claude/skills"

log()  { printf '\033[36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[32m  ✔ %s\033[0m\n' "$*"; }
warn() { printf '\033[33m  ! %s\033[0m\n' "$*"; }

# ── 1. Homebrew ──────────────────────────────────────────────────────────
log "1. Homebrew 확인"
if ! command -v brew >/dev/null 2>&1; then
  warn "Homebrew 미설치 → 설치"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Apple Silicon PATH
  [ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
fi
ok "brew $(brew --version | head -1)"

# ── 2. nvm + node ────────────────────────────────────────────────────────
log "2. nvm + node ${NODE_VERSION}"
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  warn "nvm 미설치 → 설치"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
. "$NVM_DIR/nvm.sh"
nvm install "$NODE_VERSION"
nvm alias default "$NODE_VERSION"   # 기본 버전 고정(전역 도구가 이 버전에 종속되므로)
nvm use default
ok "node $(node --version) / npm $(npm --version)"

# ── 3. npm 전역 CLI 도구 ──────────────────────────────────────────────────
log "3. npm 전역 CLI (typescript/eslint/prettier/vite/pnpm/playwright)"
npm install -g typescript eslint prettier vite playwright pnpm
ok "CLI 도구 설치 완료"

# ── 4. Playwright 브라우저 ────────────────────────────────────────────────
log "4. Playwright 브라우저 바이너리"
playwright install
ok "chromium/firefox/webkit 설치"

# ── 5. VS Code ────────────────────────────────────────────────────────────
log "5. VS Code"
if [ ! -d "/Applications/Visual Studio Code.app" ]; then
  brew install --cask visual-studio-code
fi
# code CLI 전역 링크
CODE_BIN="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
[ -x "$CODE_BIN" ] && ln -sf "$CODE_BIN" /opt/homebrew/bin/code
command -v code >/dev/null 2>&1 && ok "code $(code --version | head -1)" || warn "code CLI 미연결(VS Code 내 'Install code in PATH')"

# ── 6. Google Chrome (Chrome DevTools MCP용, 선택) ─────────────────────────
log "6. Google Chrome (Chrome DevTools MCP용)"
if [ ! -d "/Applications/Google Chrome.app" ]; then
  brew install --cask google-chrome || warn "Chrome 설치 실패(수동 설치 가능)"
fi
ok "Chrome 확인"

# ── 7. Claude Code CLI 확인 (MCP/스킬 설치에 필수) ─────────────────────────
log "7. Claude Code CLI"
if ! command -v claude >/dev/null 2>&1; then
  warn "Claude Code(claude) 미설치 → 공식 안내: https://docs.claude.com/claude-code"
  warn "설치 후 이 스크립트를 다시 실행하면 MCP/스킬 단계가 진행됩니다."
  echo "  (npm 방식 예: npm install -g @anthropic-ai/claude-code)"
  HAS_CLAUDE=0
else
  ok "claude 확인"; HAS_CLAUDE=1
fi

# ── 8. MCP 서버 (user 스코프 = 전역) ──────────────────────────────────────
add_mcp() {  # $1=name, 나머지=command
  local name="$1"; shift
  if [ "$HAS_CLAUDE" != "1" ]; then return; fi
  claude mcp add "$name" -s user -- "$@" >/dev/null 2>&1 && ok "MCP $name 등록" || warn "MCP $name 이미 있음/건너뜀"
}
log "8. MCP 서버 등록 (전역)"
add_mcp playwright          npx -y @playwright/mcp@latest
add_mcp context7            npx -y @upstash/context7-mcp
add_mcp chrome-devtools     npx    chrome-devtools-mcp@latest
add_mcp sequential-thinking npx -y @modelcontextprotocol/server-sequential-thinking

# ── 9. 플러그인 ────────────────────────────────────────────────────────────
log "9. frontend-design 플러그인"
[ "$HAS_CLAUDE" = "1" ] && { claude plugin install frontend-design@claude-plugins-official -s user >/dev/null 2>&1 && ok "frontend-design 설치" || warn "이미 있음/건너뜀"; }

# ── 10. Vercel 공식 스킬 7종 (전역) ───────────────────────────────────────
add_skill() {  # $1=repo, $2=skill
  npx -y skills add "$1" --skill "$2" -g -a claude-code -y >/dev/null 2>&1 && ok "skill $2" || warn "skill $2 실패(수동 확인)"
}
log "10. Vercel 스킬 7종"
add_skill vercel-labs/agent-skills vercel-react-best-practices
add_skill vercel-labs/agent-skills vercel-composition-patterns
add_skill vercel-labs/agent-skills web-design-guidelines
add_skill vercel/components.build  building-components
add_skill vercel/next.js           next-cache-components-adoption
add_skill vercel/ai                ai-sdk
add_skill vercel/ai-elements       ai-elements

# ── 11. 커스텀 백엔드 스킬 4종 (파일 임베드) ──────────────────────────────
log "11. 커스텀 백엔드 스킬 4종"
mkdir -p "$SKILLS_DIR"

write_skill() { mkdir -p "$SKILLS_DIR/$1"; cat > "$SKILLS_DIR/$1/SKILL.md"; ok "custom skill $1"; }

write_skill api-contract-openapi <<'SKILL_EOF'
---
name: api-contract-openapi
description: Use when designing, reviewing, or documenting REST/HTTP APIs — endpoint schemas, request/response shapes, error codes, pagination, versioning, and OpenAPI specs. Keeps backend and frontend contracts in sync.
---

# API Contract & OpenAPI

## Contract-first
- Define request/response schemas explicitly (Pydantic / TypeScript types / OpenAPI). The schema **is** the contract between backend and frontend.
- Version the API (`/v1` path or header). Never repurpose an existing field's meaning — add new fields, don't overload old ones.

## Requests & responses
- Pick one response shape convention (envelope vs bare resource) and apply it everywhere.
- Typed, stable error responses: machine-readable `code` + human `message`. Never leak stack traces.
- Correct HTTP status codes: 400 validation, 401 unauthenticated, 403 forbidden, 404 missing, 409 conflict, 422 semantic, 2xx success, 5xx server.

## Pagination & filtering
- Cursor pagination for large/live datasets; offset for small. Always cap page size and document defaults/limits.

## OpenAPI / spec fidelity
- Keep an OpenAPI (Swagger) spec. FastAPI generates it — keep `response_model` **accurate to what the code actually returns**.
- Guard against contract drift: "model declares fields X, handler returns keys Y" silently serializes to defaults — a real, hard-to-see bug class. Verify model ↔ return shape match.

## Review checklist (flag these)
- Untyped `dict`/`any` passthrough; nullable-incorrect fields.
- Response model that doesn't match the handler's actual return.
- Missing per-endpoint auth declaration.
- Breaking changes not versioned; undocumented error codes.
SKILL_EOF

write_skill db-migration-sql-review <<'SKILL_EOF'
---
name: db-migration-sql-review
description: Use when writing or reviewing database migrations and SQL — indexes, transactions, locking, rollback safety, N+1 queries, and query plans. For production databases (PostgreSQL and similar).
---

# Database Migration & SQL Review

## Migration safety
- Every migration reversible (down) or explicitly flagged irreversible.
- **Additive first** on live tables: add nullable column / new table → backfill → enforce `NOT NULL` / drop old. Never one destructive step on a populated table.
- Avoid long locks: `CREATE INDEX CONCURRENTLY` (Postgres) on large tables; don't rewrite big tables in a single transaction.
- Backfill in **batches**, not one giant `UPDATE` (lock contention + WAL/replication bloat).

## Indexes
- Index columns in `WHERE` / `JOIN` / `ORDER BY`. Composite order: equality columns first, range/sort last.
- Leading-wildcard `LIKE '%x%'` cannot use a btree index — flag it (prefix `'x%'` can).
- Don't over-index (write amplification); drop unused indexes.

## Queries
- Detect N+1 (per-row query in a loop) → batch, join, or eager-load.
- `EXPLAIN (ANALYZE)` suspect queries; watch for seq scans on large tables and bad row estimates.
- **Always parameterize** — never string-concatenate user input (SQL injection).

## Transactions & locking
- Keep transactions short; never hold a lock across a network/API call.
- Set isolation level deliberately when it matters; prevent deadlocks with consistent lock ordering.

## Review checklist (flag these)
- Reversible? Lock impact at production row counts? Backfill batched? Indexes for new query patterns? All inputs parameterized?
SKILL_EOF

write_skill auth-security-review <<'SKILL_EOF'
---
name: auth-security-review
description: Use when implementing or reviewing authentication, authorization, and application security — JWT, sessions, OAuth, RBAC, CSRF, CORS, secret handling, rate limiting, and password hashing.
---

# Auth & Security Review

## Authentication
- Hash passwords with bcrypt/argon2 — never plaintext or bare MD5/SHA. Never log credentials or tokens.
- JWT: verify signature **and** expiry server-side; short-lived access + refresh tokens. Derive the user from the verified token — never from a client-supplied `userId`/role in the request body.
- Secrets in env/secret manager, never in code or repo. No hardcoded default secret in production (fail startup if the default is detected).

## Authorization
- Default-deny; enforce authz on **every** protected endpoint.
- Check role **and** resource ownership server-side — never rely on the client hiding a control.
- Least privilege / RBAC.

## Web surface
- CORS: explicit origin allowlist — never `*` combined with credentials.
- CSRF protection for cookie-based sessions.
- Validate/sanitize all input; output-encode to prevent injection/XSS.

## Operational
- Rate-limit auth and expensive/AI endpoints (brute-force + cost-abuse protection).
- Generic auth-failure messages (don't reveal which factor failed).
- Audit-log security-relevant actions with the real actor + client IP.

## Review checklist (flag these)
- Endpoints missing an auth dependency (default-open).
- `userId`/role read from request body instead of the token.
- Hardcoded/default secrets; secrets appearing in logs.
- `CORS *` with credentials; missing rate limit on auth/AI routes.
SKILL_EOF

write_skill backend-test-ci <<'SKILL_EOF'
---
name: backend-test-ci
description: Use when writing or reviewing backend tests and CI — unit/integration/e2e coverage, mocks, fixtures, seed data, and CI gates. Framework-aware (FastAPI/pytest, NestJS, Spring Boot, Django/DRF).
---

# Backend Test & CI Review

## Test pyramid
- Many fast unit tests, fewer integration, few e2e — don't invert it.
- Test behavior and contracts, not implementation internals.

## Practices
- **Deterministic**: no reliance on real time / network / randomness. Inject the clock, seed randomness, mock external services.
- Fixtures/factories for data; isolate tests (fresh DB or per-test transaction rollback).
- Integration tests hit a **real ephemeral/containerized DB** (not mocks) for query correctness.
- Cover error paths and edge cases, not only the happy path.

## CI gates
- Every PR runs lint + type-check + tests; block merge on failure.
- Keep the suite fast (parallelize; no `sleep`-based waits). Fail fast.
- Treat coverage as a signal, not a number to game.

## Framework notes
- FastAPI: `httpx.AsyncClient` / `TestClient` + pytest; override auth/DB dependencies; apply migrations to a test DB, roll back per test.

## Review checklist (flag these)
- New endpoint/logic without tests.
- Error paths uncovered.
- External deps not mocked/contained (flaky).
- No CI gate on the change; flaky risks from time/random/network.
SKILL_EOF

# ── 완료 ───────────────────────────────────────────────────────────────────
echo
log "완료! 전역 개발환경 재현됨."
echo "  - node: $(node --version) (default 고정)"
echo "  - CLI: tsc/eslint/prettier/vite/pnpm/playwright"
echo "  - MCP: playwright/context7/chrome-devtools/sequential-thinking (user 스코프)"
echo "  - 스킬: ~/.claude/skills/ (Vercel 7 + 커스텀 4)"
echo
echo "확인:  claude mcp list   /   ls ~/.claude/skills"
[ "${HAS_CLAUDE:-0}" != "1" ] && warn "Claude Code 미설치라 MCP/플러그인 단계 건너뜀 — claude 설치 후 재실행하세요."
echo "참고: 계정 연동 MCP(Figma/Google Drive)는 claude.ai 로그인으로 자동 연결(스크립트 대상 아님)."
