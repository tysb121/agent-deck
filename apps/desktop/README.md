# @agent-deck/desktop

AgentDeck desktop shell (Electron + electron-vite + Vue 3 + TypeScript).

**Product target:** Windows-first; Linux box development is OK.

## UI stack

- **Shell layout:** handwritten three-pane grid (left / middle / right) - keep custom, not a component-library layout.
- **Generic controls:** Naive UI (n-button, n-input, n-tag, n-tabs / n-tab-pane).
- **Not used:** Element Plus, React.

## Three panes

- Left: workspace (multi-root + primary) + sessions (backend n-tag; child session indent placeholder)
- Middle: chat + composer (n-input textarea + n-button; fake adapter streaming reply)
- Right: dockable tools placeholder (n-tabs for files / diff / terminal)

## Start

From monorepo root /workspace/agent-deck, use workspace filter scripts for install, dev, typecheck, and build.
If the package manager is missing from PATH, enable Corepack first.
No display? typecheck/build is enough.

Main uses @agent-deck/adapters-fake: Send once -> IPC shell:sendPrompt -> streamed message events -> middle pane.

No React. No Element Plus. No git remote.

## Notes (zh)

- 启动: filter @agent-deck/desktop dev
- 三区壳手写；通用控件用 Naive UI（不用 Element Plus）
- 假流式: fake adapter
- 产品目标 Windows-first；当前 Linux box 开发即可
