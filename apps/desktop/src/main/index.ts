/** AgentDeck main process. Product target: Windows-first; Linux/macOS ok for local dev. */
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { createFakeAdapter } from '@agent-deck/adapters-fake';
import type { AdapterEvent } from '@agent-deck/adapters-contract';
import type { ChatMessage, ShellSession, Workspace } from '@agent-deck/core';

/** Demo workspace: multi-root + primary (locked product decision). */
const demoWorkspace: Workspace = {
  id: 'ws_demo',
  name: 'AgentDeck Demo',
  roots: [
    { id: 'root_a', path: '/workspace/agent-deck', label: 'agent-deck' },
    { id: 'root_b', path: '/workspace', label: 'workspace' },
  ],
  primaryRootId: 'root_a',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const adapter = createFakeAdapter({ backendId: 'grok', chunkDelayMs: 35 });

let mainWindow: BrowserWindow | null = null;
let session: ShellSession | null = null;
const messages = new Map<string, ChatMessage>();

function broadcast(channel: string, payload: unknown): void {
  mainWindow?.webContents.send(channel, payload);
}

adapter.subscribe((event: AdapterEvent) => {
  if (event.type === 'message.upsert') {
    messages.set(event.message.id, event.message);
    broadcast('chat:message', event.message);
  } else if (event.type === 'message.delta') {
    const prev = messages.get(event.messageId);
    if (!prev) return;
    const next: ChatMessage = {
      ...prev,
      content: prev.content + event.delta,
      streaming: true,
    };
    messages.set(event.messageId, next);
    broadcast('chat:message', next);
  } else if (event.type === 'message.completed') {
    const prev = messages.get(event.messageId);
    if (!prev) return;
    const next: ChatMessage = { ...prev, streaming: false };
    messages.set(event.messageId, next);
    broadcast('chat:message', next);
  } else if (event.type === 'session.updated') {
    session = event.session;
    broadcast('session:updated', event.session);
  } else if (event.type === 'error') {
    broadcast('chat:error', event.message);
  }
});

async function ensureSession(): Promise<ShellSession> {
  if (session) return session;
  session = await adapter.createSession({
    workspace: demoWorkspace,
    title: 'Demo session (fake grok)',
  });
  return session;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'AgentDeck',
    backgroundColor: '#0f1115',
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
      toolsPanel: { docked: 'right' as const, panels: ['files', 'diff', 'terminal'] },
    };
  });

  ipcMain.handle('shell:sendPrompt', async (_evt, text: string) => {
    const s = await ensureSession();
    await adapter.prompt({ sessionId: s.id, text });
    return { ok: true };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    adapter.dispose();
    app.quit();
  }
});
