import { contextBridge, ipcRenderer } from 'electron';
import type { ChatMessage, ShellSession, Workspace } from '@agent-deck/core';

export interface BootstrapPayload {
  workspace: Workspace;
  session: ShellSession;
  messages: ChatMessage[];
  toolsPanel: { docked: 'right'; panels: string[] };
}

const api = {
  getBootstrap: (): Promise<BootstrapPayload> => ipcRenderer.invoke('shell:getBootstrap'),
  sendPrompt: (text: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('shell:sendPrompt', text),
  onChatMessage: (cb: (msg: ChatMessage) => void): (() => void) => {
    const listener = (_evt: unknown, msg: ChatMessage) => cb(msg);
    ipcRenderer.on('chat:message', listener);
    return () => { ipcRenderer.removeListener('chat:message', listener); };
  },
  onSessionUpdated: (cb: (s: ShellSession) => void): (() => void) => {
    const listener = (_evt: unknown, s: ShellSession) => cb(s);
    ipcRenderer.on('session:updated', listener);
    return () => { ipcRenderer.removeListener('session:updated', listener); };
  },
};

contextBridge.exposeInMainWorld('agentDeck', api);

export type AgentDeckApi = typeof api;
