# AgentDeck 已定决策总表

> 权威来源：本文件。`ARCHITECTURE.md` / `README.md` 只做摘要，冲突以本表为准。  
> 更新日期：2026-09-04  
> 草稿路径：`/workspace/agent-deck/` · repo 名 `agent-deck`

| # | 主题 | 决定 |
|---|------|------|
| 1 | 产品名 | **AgentDeck**（原讨论名 Unified Agent Shell） |
| 2 | 产品边界 | 先自用；架构预留以后分发（鉴权 / 品牌 / 合规可收紧） |
| 3 | 壳底座 | **独立仓库**；不改、不 fork dsh；dsh 只是 backends 之一 |
| 4 | 技术栈 | **Electron** + **TypeScript**；桌面构建用 **electron-vite** |
| 5 | 渲染层 | **Vue 3** + TypeScript（**Composition API**，SFC） |
| 6 | MVP 平台 | **Windows-first**（本机 Linux 可开发调试；分发目标以 Windows 为主） |
| 7 | MVP 后端 | **Grok** + **dsh**；Claude / Codex / Pi 后挂 |
| 8 | 协议 | **Grok → ACP**（`grok agent` stdio）；**dsh → 官方 SDK**（可 spike ACP，不以嵌 dsh Web 作主 UI） |
| 9 | 会话模型 | **一会话一后端**；模型 / 斜杠命令 / 工具 / 权限语义归属该后端 |
| 10 | 跨后端协作 | 用 `spawn_session` **新建**另一会话；禁止同一会话内混驱多 agent |
| 11 | 协作确认 | `spawn_session` **需用户确认**；子会话**各自**批权限（父不代批） |
| 12 | Handoff | 默认：任务说明 + 短摘要；可选附带 paths |
| 13 | 壳会话存储 | 接口按 DB 设计；MVP 先 **JSON** |
| 14 | 工作区 | **多文件夹（多 root）** + 一个 **primary**；单 cwd CLI 降级用 primary |
| 15 | 文件树 | 多 root 时按仓库 **分节 / 分 Tab** |
| 16 | UI 骨架 | Codex 风格 **三区**（左会话 / 中聊天 / 右工具）+ 可停靠工具；浮层：权限、spawn 确认 |
| 17 | 左栏会话 | 扁平列表 + 后端徽章；spawn 出的子会话缩进显示 |
| 18 | UI 组件库 | 壳布局**手写**；通用控件用 **Naive UI**（对话框/菜单/树/tabs）；**不用 Element Plus** |
| 19 | 壳事件模型 | 统一 **ShellEvent**（contract 侧亦称 AdapterEvent）；流式完成态为 `message.completed`（非 message.done） |

## 仍可继续聊（未锁死）

- 新建工作区 / 会话的具体点击流
- 右栏默认打开哪些面板
- 多 root 时 CLI 降级的用户可见文案
- dsh 适配最终走 SDK 主路径还是 ACP 并行（当前默认 SDK，ACP 可 spike）

## 修订

| 日期 | 说明 |
|------|------|
| 2026-09-04 | 首版总表（含产品名、Vue3、多 root、分 Tab、Windows-first、Grok ACP / dsh SDK） |
| 2026-09-04 | 补 UI：Naive UI（非 Element Plus）；ShellEvent / message.completed |
