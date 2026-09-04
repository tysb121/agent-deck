<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { ChatMessage, ShellSession, Workspace } from "@agent-deck/core";

/** Session row for left list (flat + indented children). */
interface SessionRow {
  session: ShellSession;
  /** Indent level: 0 = top, 1+ = child of spawn_session. */
  depth: number;
  /** Placeholder rows are not yet real sessions. */
  placeholder?: boolean;
}

const workspace = ref<Workspace | null>(null);
const session = ref<ShellSession | null>(null);
const sessionRows = ref<SessionRow[]>([]);
const messages = ref<ChatMessage[]>([]);
const tools = ref<string[]>([]);
const activeTool = ref("files");
const prompt = ref("");
const sending = ref(false);

let offMsg: (() => void) | undefined;
let offSession: (() => void) | undefined;

const sortedMessages = computed(() =>
  [...messages.value].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
);

const backendId = computed(() => session.value?.backendId ?? "grok");

function backendTagType(id: string): "info" | "success" | "default" {
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
  if (!active) {
    sessionRows.value = [];
    return;
  }
  // Flat list + child indent placeholder (spawn_session UI TBD).
  const childPlaceholder: ShellSession = {
    id: "sess_child_placeholder",
    backendId: "dsh",
    title: "Child session (spawn placeholder)",
    workspaceId: active.workspaceId,
    parentSessionId: active.id,
    status: "idle",
    createdAt: active.createdAt,
    updatedAt: active.updatedAt,
  };
  sessionRows.value = [
    { session: active, depth: 0 },
    { session: childPlaceholder, depth: 1, placeholder: true },
  ];
}

async function onSubmit(): Promise<void> {
  const text = prompt.value.trim();
  if (!text || sending.value) return;
  sending.value = true;
  prompt.value = "";
  try {
    await window.agentDeck.sendPrompt(text);
  } finally {
    sending.value = false;
  }
}

onMounted(async () => {
  const data = await window.agentDeck.getBootstrap();
  workspace.value = data.workspace;
  session.value = data.session;
  rebuildSessionRows(data.session);
  tools.value = data.toolsPanel.panels;
  messages.value = [...data.messages];
  if (tools.value.length > 0 && !tools.value.includes(activeTool.value)) {
    activeTool.value = tools.value[0]!;
  }
  offMsg = window.agentDeck.onChatMessage((msg) => upsertMessage(msg));
  offSession = window.agentDeck.onSessionUpdated((s) => {
    session.value = s;
    rebuildSessionRows(s);
  });
});

onUnmounted(() => {
  offMsg?.();
  offSession?.();
});
</script>

<template>
  <div class="shell">
    <!-- Left: workspace + sessions (badge + child indent placeholder) -->
    <aside class="pane left">
      <div class="workspace">
        <h1>{{ workspace?.name ?? "Workspace" }}</h1>
        <ul class="roots">
          <li v-for="r in workspace?.roots ?? []" :key="r.id">
            {{ r.label ?? r.path }}
            <span v-if="r.id === workspace?.primaryRootId" class="primary-tag">primary</span>
          </li>
        </ul>
      </div>
      <div class="pane-header">Sessions</div>
      <ul class="session-list">
        <li
          v-for="row in sessionRows"
          :key="row.session.id"
          :class="{
            child: row.depth > 0,
            placeholder: row.placeholder,
            active: row.session.id === session?.id,
          }"
          :style="{ paddingLeft: 10 + row.depth * 14 + 'px' }"
        >
          <div class="title">{{ row.session.title }}</div>
          <n-tag
            size="small"
            round
            :bordered="false"
            :type="backendTagType(row.session.backendId)"
          >
            {{ row.session.backendId }}
          </n-tag>
          <span v-if="row.placeholder" class="placeholder-tag">indent placeholder</span>
        </li>
      </ul>
    </aside>

    <!-- Middle: chat + composer (fake adapter stream) -->
    <main class="pane chat">
      <div class="pane-header">Chat · one session / one backend · {{ backendId }}</div>
      <div class="messages">
        <div
          v-if="sortedMessages.length === 0"
          class="bubble assistant"
        >
          <div class="meta">system</div>
          Send a message to stream a fake assistant reply (Vue 3 renderer).
        </div>
        <div
          v-for="m in sortedMessages"
          :key="m.id"
          class="bubble"
          :class="m.role"
        >
          <div class="meta">{{ m.role }}{{ m.streaming ? " …" : "" }}</div>
          {{ m.content }}
        </div>
      </div>
      <form class="composer" @submit.prevent="onSubmit">
        <n-input
          v-model:value="prompt"
          type="textarea"
          placeholder="Message fake adapter…"
          :disabled="sending"
          :autosize="{ minRows: 1, maxRows: 4 }"
        />
        <n-button
          type="primary"
          attr-type="submit"
          :disabled="sending || !prompt.trim()"
          :loading="sending"
        >
          Send
        </n-button>
      </form>
    </main>

    <!-- Right: dockable tools placeholder -->
    <aside class="pane tools">
      <div class="pane-header">Tools (dockable placeholder)</div>
      <div class="tools-tabs-wrap">
        <n-tabs v-model:value="activeTool" type="segment" size="small" animated>
          <n-tab-pane v-for="t in tools" :key="t" :name="t" :tab="t">
            <div class="hint">Right dock · panels are placeholders for files / diff / terminal</div>
            <div class="tool-body">
              Active: <strong>{{ t }}</strong><br />
              Multi-root workspace with primary root. spawn_session confirmation UI TBD.
            </div>
          </n-tab-pane>
        </n-tabs>
      </div>
    </aside>
  </div>
</template>
