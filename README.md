# AgentDeck

Unified desktop shell for coding agents (Electron + TypeScript + Vue 3 Composition API + electron-vite).

**Product target:** Windows-first. This scaffold runs on Linux for local development.

> **权威决策表**：[`notes/DECISIONS.md`](notes/DECISIONS.md)（已定决策以该表为准）。架构摘要见 `ARCHITECTURE.md` / `docs/ARCHITECTURE.md`。

## Locked decisions

摘要如下（完整表见 [`notes/DECISIONS.md`](notes/DECISIONS.md)；类型与脚手架已对齐）：

- One session ↔ one backend
- Workspace: 1..N roots + primary
- MVP backends: `grok` | `dsh` (fake adapter for UI demo)
- `spawn_session` requires user confirmation (types only in this scaffold)
- UI: three regions + dockable tools placeholder
- Renderer: Vue 3 + TypeScript (Composition API)
- Protocols: Grok → ACP; dsh → official SDK
- MVP platform: Windows-first

## Prerequisites

- Node.js >= 20
- pnpm 9 (enable via Corepack if missing):

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

## Install

```bash
cd /workspace/agent-deck
pnpm install
```

## Run (desktop)

```bash
pnpm --filter @agent-deck/desktop dev
# or from root:
pnpm dev
```

Build only:

```bash
pnpm --filter @agent-deck/desktop build
```

## Monorepo layout

```
apps/desktop              Electron main + Vue 3 renderer (three-pane UI)
packages/core             Session / Workspace types
packages/adapters-contract BackendAdapter interface + capability flags
packages/adapters-fake    Fake streaming adapter for UI demo
packages/orchestration    spawn_session types stub
notes/                   DECISIONS.md 等决策笔记（权威）
docs/                    文档副本（含 ARCHITECTURE.md）
```

## Notes

- No git remote / GitHub setup in this scaffold.
- Fake adapter pretends backends `grok` | `dsh` and streams a demo assistant message into the middle pane.

## UI stack note

Renderer uses **Vue 3 + TypeScript (Composition API)** with SFCs (`App.vue`).
Three-pane shell layout / session list / message stream are **hand-written**; common controls use **Naive UI** (`n-button`, `n-input`, `n-tag`, `n-tabs`, etc.). Do not introduce Element Plus or React.

## This box notes

If `pnpm` is not on PATH (`corepack enable` may need root), use:

```bash
corepack pnpm install
corepack pnpm --filter @agent-deck/desktop dev
corepack pnpm --filter @agent-deck/desktop build
```

## Desktop details

See also: `apps/desktop/README.md`.
