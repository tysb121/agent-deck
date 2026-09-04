# AgentDeck

统一桌面壳：Electron + Vue 3，接入多家 coding agent CLI（不重写 agent）。

- 产品目标：Windows 优先
- 仓库：https://github.com/tysb121/agent-deck
- 讨论/决策文档只留本地，不上本仓

## 开发

```bash
pnpm install
pnpm dev
```

需要 Node.js >= 20、pnpm 9。

## 说明

渲染层为 Vue 3 + TypeScript；三区壳手写，通用控件用 Naive UI。
