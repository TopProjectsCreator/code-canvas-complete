# Code-Driven Feature Priorities

This roadmap is based on what already exists in the codebase (not just README/docs).

## Already implemented (do not re-build)

### 1) Agent autonomy safety controls (already present)
- `useAutonomyMode` already ships with `human`, `full`, and `custom` presets.
- Categories are granular: `codeChanges`, `shell`, `theme`, `git`, `share`, `packages`, `workflows`.
- AI chat auto-applies actions only when the matching category is enabled.

References:
- `src/hooks/useAutonomyMode.ts`
- `src/components/ide/AIChat.tsx`

### 2) Rollback/history safety (already present)
- IDE history captures snapshots for file/template mutations.
- Rollback is exposed in the history sidebar panel.

References:
- `src/components/ide/IDELayout.tsx`
- `src/components/ide/Sidebar.tsx`
- `src/components/ide/HistoryPanel.tsx`

### 3) Collaboration foundations (already present)
- Roles (`viewer`, `editor`, `admin`), comments, reviews, and presence are implemented.
- Realtime subscriptions exist for comments and presence.

Reference:
- `src/hooks/useCollaboration.ts`

## Recommended features to add next

### A. Policy templates + guardrails for autonomy (high)
Build on existing autonomy flags by adding policy templates and enforcement checks:
- Presets like `Safe`, `Balanced`, `Fast` with explicit limits.
- Restrict command/package actions using allow/deny patterns.
- Ask-for-confirmation only for destructive actions (e.g., remove, force, delete).
- “Auto-apply with tests required” option before applying code changes.

Why this is next:
- The feature foundation already exists, so this is low implementation risk and high trust impact.

### B. Durable operation/audit log for AI actions (high)
Today actions execute in UI state; add a persistent operation ledger:
- Record every tool action with actor, args, timestamp, result.
- Link each operation to history snapshots and git commit IDs.
- Add replay/debug view for failed sequences.

Why this is next:
- You already have history and chat step metadata, so this is mostly persistence + UI.

### C. Collaboration UX completion (medium-high)
The backend/data layer is strong; polish team workflows:
- Inline code comments directly in editor gutter.
- “Review request” workflow tied to changed files and review states.
- Presence reliability fixes (shared channel lifecycle; avoid per-update channel creation).

Why this is next:
- Core data model is ready; most work is interaction quality.

### D. Execution profile matrix (medium)
Unify shell/executor complexity into reusable profiles:
- Per-project runtime profile (WebContainer / Wandbox / hybrid / container).
- Capability badges and one-click compatibility checks.
- Persist selected profile in project metadata.

Why this is next:
- Existing execution paths are powerful but can confuse users; profiles simplify onboarding.

### E. MCP/Skills hardening (medium)
MCP and skills CRUD exists; add production readiness:
- Connection test + schema validation when adding MCP servers.
- Skill versioning and import/export.
- Secret management UX improvements for API keys.

Why this is next:
- Moves from “config storage” to “operationally reliable integrations.”

## Suggested implementation order
1. Policy templates + guardrails for autonomy.
2. Durable AI operation/audit log.
3. Collaboration UX completion.
4. Execution profile matrix.
5. MCP/Skills hardening.
