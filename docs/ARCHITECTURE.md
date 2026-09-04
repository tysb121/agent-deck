# AgentDeck — 架构说明（v0.2）

> 状态：脚手架已落地（Electron + Vue 3 桌面壳可跑）；业务适配仍在推进。  
> 日期：2026-09-04  
> 产品名：**AgentDeck**  
> **权威决策表**：[`notes/DECISIONS.md`](notes/DECISIONS.md)（冲突以该表为准；本文只做架构摘要）

---

## 1. 目标与非目标

### 目标

- 提供**统一桌面 GUI**，让用户在已订阅的多家 coding agent 之间切换，而不反复换终端/应用。
- **不重写**各家 agent loop；壳通过 adapter **调用本机已安装 CLI** 的机器协议。
- **一会话绑定一个后端**：该会话的模型、斜杠命令、工具与权限语义，全部归属该后端。
- 支持**跨后端协作**：会话 A（如 Grok）可请求壳**新建**会话 B（如 dsh）执行任务，而不是在同一会话里混用多个 agent。
- MVP **先自用**；架构**预留以后分发**（鉴权/品牌/合规可收紧）。

### 非目标（至少 MVP 不做）

- Fork 或改造 dsh / 任一官方产品面作为「万能前端」。
- 用 PTY 刮全屏 TUI 当主集成路径。
- 壳代持或共享各家订阅登录，伪装成官方客户端。
- 一个会话内同时驱动多个 agent。
- 默认自动多跳派活（A→B→C）或父会话代批子会话权限。

---

## 2. 已锁定决策（摘要）

完整条目见 [`notes/DECISIONS.md`](notes/DECISIONS.md)。此处只列架构相关摘要：

| 项 | 决定 |
|----|------|
| 产品名 | **AgentDeck** |
| 产品边界 | 先自用；鉴权/品牌/adapter 按可分发预留 |
| 壳底座 | **独立仓库**；dsh 只是 backends 之一 |
| 技术栈 | **Electron + TypeScript + Vue 3（Composition API）+ electron-vite** |
| MVP 平台 | **Windows-first**（本机 Linux 可开发调试） |
| MVP 后端 | **Grok** + **dsh**；Claude / Codex / Pi 后挂 |
| 协议 | **Grok → ACP**（`grok agent` stdio）；**dsh → 官方 SDK**（可 spike ACP） |
| 会话模型 | 一会话一后端 |
| 协作默认 | `spawn_session` **需用户确认**；子会话**各自**批权限 |
| 工作区 | **多 root** + 一个 **primary**；单 cwd CLI 降级用 primary |
| 文件树 | 多 root 时按仓库 **分节 / 分 Tab** |
| UI 骨架 | Codex 风格 **三区**（左会话 / 中聊天 / 右工具）+ 可停靠工具 |
| UI 组件 | 壳布局手写；通用控件 **Naive UI**（不用 Element Plus） |

---

## 3. 逻辑架构

壳分为 **Renderer（UI）** 与 **Main（控制面）** 两层，通过 Electron IPC 通信。UI 只消费统一会话/消息/权限模型；各后端差异全部封在 adapter 内。

```
UI (Vue 3)
  → IPC
  → Session Hub / Orchestrator / Adapter Host
  → grok agent (ACP) / dsh (官方 SDK；ACP 可 spike)
```

---

## 4. 仓库骨架（对齐现状）

```
apps/desktop                 Electron main + Vue 3 renderer（electron-vite）
packages/core                Session / Workspace 等核心类型
packages/adapters-contract   BackendAdapter 接口 + capability flags
packages/adapters-fake       Fake streaming adapter（UI 演示）
packages/orchestration       spawn_session 等协作类型桩
notes/                       决策与 UI 笔记（含 DECISIONS.md）
docs/                        文档副本（含本架构说明）
```


启动：

```bash
pnpm install
pnpm dev
```

---

## 5. 核心抽象

- **BackendAdapter**：detect / createSession / prompt / subscribe / resume / abort / requestPermissionReply / dispose
- **Events**：session.*、message.*、thought.delta、tool.*、permission.requested、error、usage
- **ShellSession**：id、backendId、工作区 refs、title、backendSessionRef、parentSessionId?、时间戳、status
- **Workspace**：多 roots + primary；文件树按 root 分节 / 分 Tab

---

## 6. MVP 适配

- **Grok**：grok agent stdio + **ACP**；权限不默认 always-approve；鉴权走本机 ~/.grok
- **dsh**：默认 **官方 SDK**；不以嵌 dsh Web 作主 UI；可 spike ACP
- **Later**：Claude / Codex / Pi

---

## 7. 协作

- spawn_session 需确认卡；handoff 默认 = 任务说明 + 短摘要，可选附带 paths
- 父会话不代批子会话权限；子会话各自弹权限

---

## 8–10. 鉴权 / 权限 / 风险

- 自用走本机登录；分发再收紧
- 权限按会话弹；不默认 YOLO
- 风险：协议漂移、双源索引、CLI 未装、Windows 路径/进程差异、派活幻觉、各家 ToS

---

## 11. 里程碑

M0 审稿定名（已完成）→ M1 fake adapter（脚手架已落地）→ M2 Grok ACP → M3 dsh SDK → M4 spawn → M5 打磨后挂

---

## 12. 仍可继续聊

以下**未锁死**（产品名 / Vue 3 / Windows-first / 三区 UI 骨架等已锁定，见 DECISIONS）：

- 新建工作区 / 会话的具体点击流
- 右栏默认打开哪些面板
- 多 root 时 CLI 降级的用户可见文案
- dsh 适配最终走 SDK 主路径还是 ACP 并行（当前默认 SDK，ACP 可 spike）
- Handoff 文案细节；壳会话索引 MVP 先 JSON（接口按 DB 设计）

---

## 13. 修订

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1 | 2026-09-04 | 首稿（Unified Agent Shell 讨论稿） |
| v0.2 | 2026-09-04 | 对齐 DECISIONS：AgentDeck、Vue3、Windows-first、多 root、Grok ACP / dsh SDK；修重复章节；状态改为脚手架已落地 |
