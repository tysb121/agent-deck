import { contextBridge, ipcRenderer } from 'electron';
import type { BackendId, ChatMessage, ShellSession, Workspace } from '@agent-deck/core';

export interface BackendOption {
  id: BackendId;
  label: string;
  ready: boolean;
  detail: string;
}

export interface BootstrapPayload {
  workspace: Workspace;
  session: ShellSession;
  messages: ChatMessage[];
  toolsPanel: { docked: 'right'; panels: string[] };
  backends: BackendOption[];
  selectedBackendId: BackendId;
  secrets: { envLocalLoaded: boolean; deepseekKeyLoaded: boolean };
}

export interface CreateSessionResult {
  session: ShellSession;
  backends: BackendOption[];
  selectedBackendId: BackendId;
  secrets: { envLocalLoaded: boolean; deepseekKeyLoaded: boolean };
}

const api = {
  getBootstrap: (): Promise<BootstrapPayload> => ipcRenderer.invoke('shell:getBootstrap'),
  createSession: (payload: {
    backendId: BackendId;
    title?: string;
  }): Promise<CreateSessionResult> => ipcRenderer.invoke('shell:createSession', payload),
  listBackends: (): Promise<BackendOption[]> => ipcRenderer.invoke('shell:listBackends'),
  sendPrompt: (text: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('shell:sendPrompt', text),
  onChatMessage: (cb: (msg: ChatMessage) => void): (() => void) => {
    const listener = (_evt: unknown, msg: ChatMessage) => cb(msg);
    ipcRenderer.on('chat:message', listener);
    return () => {
      ipcRenderer.removeListener('chat:message', listener);
    };
  },
  onChatCleared: (cb: () => void): (() => void) => {
    const listener = () => cb();
    ipcRenderer.on('chat:cleared', listener);
    return () => {
      ipcRenderer.removeListener('chat:cleared', listener);
    };
  },
  onChatError: (cb: (message: string) => void): (() => void) => {
    const listener = (_evt: unknown, message: string) => cb(message);
    ipcRenderer.on('chat:error', listener);
    return () => {
      ipcRenderer.removeListener('chat:error', listener);
    };
  },
  onSessionUpdated: (cb: (s: ShellSession) => void): (() => void) => {
    const listener = (_evt: unknown, s: ShellSession) => cb(s);
    ipcRenderer.on('session:updated', listener);
    return () => {
      ipcRenderer.removeListener('session:updated', listener);
    };
  },
};

contextBridge.exposeInMainWorld('agentDeck', api);

export type AgentDeckApi = typeof api;
