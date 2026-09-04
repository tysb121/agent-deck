<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  NButton,
  NConfigProvider,
  NDropdown,
  NInput,
  NTag,
  lightTheme,
} from "naive-ui";
import type { BackendId, ChatMessage, ShellSession, Workspace } from "@agent-deck/core";

interface BackendOption {
  id: BackendId;
  label: string;
  ready: boolean;
  detail: string;
}

/** Session row for left list (flat + indented children). */
interface SessionRow {
  session: ShellSession;
  /** Indent level: 0 = top, 1+ = child of spawn_session. */
  depth: number;
  /** Placeholder rows are not yet real sessions. */
  placeholder?: boolean;
}

interface ToolItem {
  id: string;
  label: string;
  shortcut: string;
}

const TOOL_ITEMS: ToolItem[] = [
  { id: "terminal", label: "终端", shortcut: "Ctrl+`" },
  { id: "browser", label: "浏览器", shortcut: "Ctrl+T" },
  { id: "files", label: "文件", shortcut: "Ctrl+P" },
];

const SUGGESTIONS = [
  { id: "explore", icon: "◎", title: "探索并理解代码", hint: "梳理目录结构与关键模块" },
  { id: "build", icon: "◇", title: "实现一个小功能", hint: "从需求到可运行改动" },
  { id: "fix", icon: "△", title: "排查一个问题", hint: "定位错误并给出修复建议" },
] as const;

/** Demo sessions under workspace (IA fake data). */
const DEMO_SESSIONS: ShellSession[] = [
  {
    id: "sess_demo_1",
    backendId: "grok",
    title: "梳理工作区结构与入口",
    workspaceId: "ws_demo",
    status: "idle",
    createdAt: "2026-09-04T00:00:00.000Z",
    updatedAt: "2026-09-04T00:00:00.000Z",
  },
  {
    id: "sess_demo_2",
    backendId: "dsh",
    title: "补齐桌面浅色信息架构",
    workspaceId: "ws_demo",
    status: "idle",
    createdAt: "2026-09-04T00:00:00.000Z",
    updatedAt: "2026-09-04T00:00:00.000Z",
  },
];

const workspace = ref<Workspace | null>(null);
const session = ref<ShellSession | null>(null);
const sessionRows = ref<SessionRow[]>([]);
const messages = ref<ChatMessage[]>([]);
const activeTool = ref<string>("terminal");
const prompt = ref("");
const sending = ref(false);
const creating = ref(false);
const backends = ref<BackendOption[]>([]);
const selectedBackendId = ref<BackendId>("dsh");
const statusHint = ref("");
const errorHint = ref("");
const secrets = ref({ envLocalLoaded: false, deepseekKeyLoaded: false });

let offMsg: (() => void) | undefined;
let offSession: (() => void) | undefined;
let offCleared: (() => void) | undefined;
let offError: (() => void) | undefined;

const sortedMessages = computed(() =>
  [...messages.value].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
);

const backendId = computed(() => session.value?.backendId ?? selectedBackendId.value);

const selectedBackendMeta = computed(
  () => backends.value.find((b) => b.id === selectedBackendId.value) ?? null,
);

const primaryRootLabel = computed(() => {
  const ws = workspace.value;
  if (!ws) return "工作区";
  const root = ws.roots.find((r) => r.id === ws.primaryRootId) ?? ws.roots[0];
  return root?.label ?? root?.path ?? ws.name;
});

const workspaceShort = computed(() => {
  const label = primaryRootLabel.value;
  return label.length > 14 ? `${label.slice(0, 12)}…` : label;
});

const emptyHeroTitle = computed(
  () => `你想让我们在 ${workspaceShort.value} 做什么？`,
);

const backendDropdownOptions = computed(() =>
  backends.value.map((b) => ({
    label: b.ready ? b.label : `${b.label} · ${b.detail}`,
    key: b.id,
  })),
);

const backendTriggerLabel = computed(() => {
  const meta = selectedBackendMeta.value;
  if (!meta) return String(selectedBackendId.value);
  return meta.label;
});

function backendBadgeTone(id: string): "info" | "success" | "default" {
  if (id === "grok") return "info";
  if (id === "dsh") return "success";
  return "default";
}

function upsertMessage(msg: ChatMessage): void {
  const idx = messages.value.findIndex((m) => m.id === msg.id);
  if (idx >= 0) {
    messages.value[idx] = msg;
  } else {
    messages.value.push(msg);
  }
}

function rebuildSessionRows(active: ShellSession | null): void {
  const rows: SessionRow[] = [];
  if (active) {
    rows.push({ session: active, depth: 0 });
    const childPlaceholder: ShellSession = {
      id: "sess_child_placeholder",
      backendId: active.backendId,
      title: "子会话（spawn 占位）",
      workspaceId: active.workspaceId,
      parentSessionId: active.id,
      status: "idle",
      createdAt: active.createdAt,
      updatedAt: active.updatedAt,
    };
    rows.push({ session: childPlaceholder, depth: 1, placeholder: true });
  }
  for (const demo of DEMO_SESSIONS) {
    if (active && demo.id === active.id) continue;
    rows.push({ session: demo, depth: 0, placeholder: true });
  }
  sessionRows.value = rows;
}

function applySecrets(s: { envLocalLoaded: boolean; deepseekKeyLoaded: boolean }): void {
  secrets.value = s;
  if (s.deepseekKeyLoaded) {
    statusHint.value = "密钥已加载";
  } else if (s.envLocalLoaded) {
    statusHint.value = ".env.local 已读";
  } else {
    statusHint.value = "未找到 .env.local";
  }
}

function onBackendSelect(key: string | number): void {
  selectedBackendId.value = key as BackendId;
}

async function onCreateSession(): Promise<void> {
  if (creating.value) return;
  const meta = selectedBackendMeta.value;
  if (meta && !meta.ready && meta.id === "dsh") {
    errorHint.value = meta.detail || "dsh 后端尚未就绪";
    return;
  }
  creating.value = true;
  errorHint.value = "";
  try {
    const title =
      selectedBackendId.value === "dsh" ? "dsh 会话" : `演示会话（${selectedBackendId.value}）`;
    const result = await window.agentDeck.createSession({
      backendId: selectedBackendId.value,
      title,
    });
    session.value = result.session;
    backends.value = result.backends;
    selectedBackendId.value = result.selectedBackendId;
    applySecrets(result.secrets);
    rebuildSessionRows(result.session);
    messages.value = [];
  } catch (err) {
    errorHint.value = err instanceof Error ? err.message : String(err);
  } finally {
    creating.value = false;
  }
}

async function onSubmit(): Promise<void> {
  const text = prompt.value.trim();
  if (!text || sending.value) return;
  sending.value = true;
  prompt.value = "";
  errorHint.value = "";
  try {
    await window.agentDeck.sendPrompt(text);
  } catch (err) {
    errorHint.value = err instanceof Error ? err.message : String(err);
  } finally {
    sending.value = false;
  }
}

function applySuggestion(hint: string): void {
  prompt.value = hint;
}

function onSelectTool(id: string): void {
  activeTool.value = id;
}

onMounted(async () => {
  try {
    const data = await window.agentDeck.getBootstrap();
    workspace.value = data.workspace;
    session.value = data.session;
    backends.value = data.backends;
    selectedBackendId.value = data.selectedBackendId;
    applySecrets(data.secrets);
    rebuildSessionRows(data.session);
    activeTool.value = "terminal";
    messages.value = [...data.messages];
  } catch (err) {
    errorHint.value = err instanceof Error ? err.message : String(err);
  }
  offMsg = window.agentDeck.onChatMessage((msg) => upsertMessage(msg));
  offCleared = window.agentDeck.onChatCleared(() => {
    messages.value = [];
  });
  offError = window.agentDeck.onChatError((message) => {
    errorHint.value = message;
  });
  offSession = window.agentDeck.onSessionUpdated((s) => {
    session.value = s;
    selectedBackendId.value = s.backendId;
    rebuildSessionRows(s);
  });
});

onUnmounted(() => {
  offMsg?.();
  offSession?.();
  offCleared?.();
  offError?.();
});
</script>

<template>
  <n-config-provider :theme="lightTheme">
    <div class="shell">
      <!-- 左：品牌 + 工作区下挂会话（后端仅小徽章） -->
      <aside class="pane left">
        <div class="brand-row">
          <div class="brand">
            <span class="brand-name">AgentDeck</span>
            <span class="brand-chevron">▾</span>
          </div>
          <button
            class="icon-btn"
            type="button"
            title="新对话"
            :disabled="creating"
            @click="onCreateSession"
          >
            {{ creating ? "…" : "+" }}
          </button>
        </div>

        <nav class="nav-list" aria-label="快捷">
          <button class="nav-item" type="button" @click="onCreateSession">
            <span class="nav-ico">＋</span>
            <span>新对话</span>
          </button>
        </nav>

        <div class="section-label">工作区</div>
        <div class="workspace-block">
          <div class="workspace-head">
            <span class="folder-ico">📁</span>
            <span class="workspace-name">{{ primaryRootLabel }}</span>
            <n-tag
              size="tiny"
              round
              :bordered="false"
              :type="backendBadgeTone(backendId)"
              class="backend-mini"
            >
              {{ backendId }}
            </n-tag>
          </div>
          <ul class="session-list">
            <li
              v-for="row in sessionRows"
              :key="row.session.id"
              :class="{
                child: row.depth > 0,
                placeholder: row.placeholder,
                active: row.session.id === session?.id && !row.placeholder,
              }"
              :style="{ paddingLeft: 10 + row.depth * 12 + 'px' }"
            >
              <span class="dot" aria-hidden="true" />
              <div class="session-body">
                <div class="title">{{ row.session.title }}</div>
                <div class="session-meta">
                  <n-tag
                    size="tiny"
                    round
                    :bordered="false"
                    :type="backendBadgeTone(row.session.backendId)"
                  >
                    {{ row.session.backendId }}
                  </n-tag>
                  <span v-if="row.placeholder && row.depth > 0" class="muted-tiny">占位</span>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <div class="left-footer">
          <span class="muted-tiny">{{ statusHint }}</span>
        </div>
      </aside>

      <!-- 中：空态大标题 + 建议卡 + 底部大圆角 composer（后端下拉在此） -->
      <main class="pane chat">
        <div class="chat-top">
          <span class="muted-tiny">对话 · 一会话一后端</span>
          <span class="host-chip">AgentDeck</span>
        </div>

        <div v-if="errorHint" class="error-banner">{{ errorHint }}</div>

        <div class="messages">
          <div v-if="sortedMessages.length === 0" class="empty-hero">
            <div class="empty-glyph" aria-hidden="true">☁</div>
            <h2>{{ emptyHeroTitle }}</h2>
            <div class="suggest-row">
              <button
                v-for="s in SUGGESTIONS"
                :key="s.id"
                type="button"
                class="suggest-card"
                @click="applySuggestion(s.hint)"
              >
                <span class="suggest-ico">{{ s.icon }}</span>
                <span class="suggest-title">{{ s.title }}</span>
                <span class="suggest-hint">{{ s.hint }}</span>
              </button>
            </div>
          </div>
          <div
            v-for="m in sortedMessages"
            :key="m.id"
            class="bubble"
            :class="m.role"
          >
            <div class="meta">
              {{
                m.role === "user" ? "用户" : m.role === "assistant" ? "助手" : m.role
              }}{{ m.streaming ? " …" : "" }}
            </div>
            {{ m.content }}
          </div>
        </div>

        <div class="composer-wrap">
          <div class="composer-shell">
            <div class="composer-badges">
              <span class="pill">{{ primaryRootLabel }}</span>
              <span class="pill">本地</span>
              <span class="pill muted">{{ backendId }}</span>
            </div>
            <form class="composer" @submit.prevent="onSubmit">
              <n-input
                v-model:value="prompt"
                type="textarea"
                placeholder="随心输入…"
                :disabled="sending"
                :autosize="{ minRows: 2, maxRows: 5 }"
                :bordered="false"
              />
              <div class="composer-toolbar">
                <div class="toolbar-left">
                  <button
                    class="ghost-btn"
                    type="button"
                    title="新对话"
                    :disabled="creating"
                    @click="onCreateSession"
                  >
                    ＋ 新对话
                  </button>
                </div>
                <div class="toolbar-right">
                  <n-dropdown
                    trigger="click"
                    :options="backendDropdownOptions"
                    @select="onBackendSelect"
                  >
                    <button class="backend-trigger" type="button">
                      {{ backendTriggerLabel }}
                      <span class="chev">▾</span>
                    </button>
                  </n-dropdown>
                  <n-button
                    type="primary"
                    attr-type="submit"
                    circle
                    size="small"
                    :disabled="sending || !prompt.trim()"
                    :loading="sending"
                    title="发送"
                  >
                    ↑
                  </n-button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>

      <!-- 右：扁平工具列表（终端 / 浏览器 / 文件；无审查） -->
      <aside class="pane tools">
        <div class="tools-top">
          <span class="section-label tight">工具</span>
        </div>
        <ul class="tool-list">
          <li
            v-for="t in TOOL_ITEMS"
            :key="t.id"
            :class="{ active: activeTool === t.id }"
            @click="onSelectTool(t.id)"
          >
            <span class="tool-label">{{ t.label }}</span>
            <span class="tool-shortcut">{{ t.shortcut }}</span>
          </li>
        </ul>
        <div class="tool-panel-hint">
          <template v-if="activeTool === 'terminal'">终端占位 · 功能暂未实现</template>
          <template v-else-if="activeTool === 'browser'">浏览器占位 · 功能暂未实现</template>
          <template v-else>文件占位 · 功能暂未实现</template>
        </div>
      </aside>
    </div>
  </n-config-provider>
</template>
