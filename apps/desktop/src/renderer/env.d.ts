/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

import type { BackendId, ChatMessage, ShellSession, Workspace } from "@agent-deck/core";

export interface BackendOption {
  id: BackendId;
  label: string;
  ready: boolean;
  detail: string;
}

export interface AgentDeckApi {
  getBootstrap: () => Promise<{
    workspace: Workspace;
    session: ShellSession;
    messages: ChatMessage[];
    toolsPanel: { docked: "right"; panels: string[] };
    backends: BackendOption[];
    selectedBackendId: BackendId;
    secrets: { envLocalLoaded: boolean; deepseekKeyLoaded: boolean };
  }>;
  createSession: (payload: {
    backendId: BackendId;
    title?: string;
  }) => Promise<{
    session: ShellSession;
    backends: BackendOption[];
    selectedBackendId: BackendId;
    secrets: { envLocalLoaded: boolean; deepseekKeyLoaded: boolean };
  }>;
  listBackends: () => Promise<BackendOption[]>;
  sendPrompt: (text: string) => Promise<{ ok: boolean }>;
  onChatMessage: (cb: (msg: ChatMessage) => void) => () => void;
  onChatCleared: (cb: () => void) => () => void;
  onChatError: (cb: (message: string) => void) => () => void;
  onSessionUpdated: (cb: (s: ShellSession) => void) => () => void;
}

declare global {
  interface Window {
    agentDeck: AgentDeckApi;
  }
}

export {};
