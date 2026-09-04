/** AgentDeck main process. Product target: Windows-first; Linux/macOS ok for local dev. */
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import type { AdapterEvent, BackendAdapter } from '@agent-deck/adapters-contract';
import type { BackendId, ChatMessage, ShellSession, Workspace } from '@agent-deck/core';
import { createAdapterForBackend, listBackendOptions } from './adapters';
import { loadEnvLocal } from './env';

/** Load .env.local before any adapter that needs DEEPSEEK_API_KEY. */
const envInfo = loadEnvLocal();

/** Demo workspace: multi-root + primary (locked product decision). */
const demoWorkspace: Workspace = {
  id: 'ws_demo',
  name: 'AgentDeck 演示',
  roots: [
    { id: 'root_a', path: '/workspace/agent-deck', label: 'agent-deck' },
    { id: 'root_b', path: '/workspace', label: 'workspace' },
  ],
  primaryRootId: 'root_a',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

let mainWindow: BrowserWindow | null = null;
let adapter: BackendAdapter | null = null;
let unsubscribe: (() => void) | null = null;
let session: ShellSession | null = null;
let selectedBackendId: BackendId = envInfo.deepseekKeyLoaded ? 'dsh' : 'grok';
const messages = new Map<string, ChatMessage>();

function broadcast(channel: string, payload: unknown): void {
  mainWindow?.webContents.send(channel, payload);
}

function wireAdapter(next: BackendAdapter): void {
  unsubscribe?.();
  adapter = next;
  unsubscribe = adapter.subscribe((event: AdapterEvent) => {
    if (event.type === 'message.upsert') {
      messages.set(event.message.id, event.message);
      broadcast('chat:message', event.message);
    } else if (event.type === 'message.delta') {
      const prev = messages.get(event.messageId);
      if (!prev) return;
      const updated: ChatMessage = {
        ...prev,
        content: prev.content + event.delta,
        streaming: true,
      };
      messages.set(event.messageId, updated);
      broadcast('chat:message', updated);
    } else if (event.type === 'message.completed') {
      const prev = messages.get(event.messageId);
      if (!prev) return;
      const updated: ChatMessage = { ...prev, streaming: false };
      messages.set(event.messageId, updated);
      broadcast('chat:message', updated);
    } else if (event.type === 'session.updated') {
      session = event.session;
      broadcast('session:updated', event.session);
    } else if (event.type === 'error') {
      broadcast('chat:error', event.message);
    }
  });
}

async function switchBackend(backendId: BackendId, title?: string): Promise<ShellSession> {
  const prev = adapter;
  const next = await createAdapterForBackend(backendId);
  wireAdapter(next);
  selectedBackendId = backendId;
  messages.clear();
  broadcast('chat:cleared', null);
  session = await next.createSession({
    workspace: demoWorkspace,
    title:
      title ??
      (backendId === 'dsh' ? 'dsh 会话' : `演示会话（${backendId}）`),
  });
  broadcast('session:updated', session);
  if (prev) {
    try {
      await prev.dispose();
    } catch {
      /* ignore dispose errors from previous adapter */
    }
  }
  return session;
}

async function ensureSession(): Promise<ShellSession> {
  if (session && adapter) return session;
  return switchBackend(selectedBackendId);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'AgentDeck',
    backgroundColor: '#f4f5f7',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  ipcMain.handle('shell:getBootstrap', async () => {
    const s = await ensureSession();
    return {
      workspace: demoWorkspace,
      session: s,
      messages: Array.from(messages.values()),
      toolsPanel: { docked: 'right' as const, panels: ['终端', '浏览器', '文件'] },
      backends: listBackendOptions(),
      selectedBackendId,
      /** Never include the key itself — only load status. */
      secrets: {
        envLocalLoaded: envInfo.loaded,
        deepseekKeyLoaded: envInfo.deepseekKeyLoaded,
      },
    };
  });

  ipcMain.handle(
    'shell:createSession',
    async (_evt, payload: { backendId: BackendId; title?: string }) => {
      const s = await switchBackend(payload.backendId, payload.title);
      return {
        session: s,
        backends: listBackendOptions(),
        selectedBackendId,
        secrets: {
          envLocalLoaded: envInfo.loaded,
          deepseekKeyLoaded: envInfo.deepseekKeyLoaded,
        },
      };
    },
  );

  ipcMain.handle('shell:sendPrompt', async (_evt, text: string) => {
    const s = await ensureSession();
    if (!adapter) throw new Error('适配器未初始化');
    await adapter.prompt({ sessionId: s.id, text });
    return { ok: true };
  });

  ipcMain.handle('shell:listBackends', async () => listBackendOptions());

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    void adapter?.dispose();
    app.quit();
  }
});
