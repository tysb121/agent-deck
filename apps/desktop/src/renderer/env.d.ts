/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

import type { ChatMessage, ShellSession, Workspace } from "@agent-deck/core";

export interface AgentDeckApi {
  getBootstrap: () => Promise<{
    workspace: Workspace;
    session: ShellSession;
    messages: ChatMessage[];
    toolsPanel: { docked: "right"; panels: string[] };
  }>;
  sendPrompt: (text: string) => Promise<{ ok: boolean }>;
  onChatMessage: (cb: (msg: ChatMessage) => void) => () => void;
  onSessionUpdated: (cb: (s: ShellSession) => void) => () => void;
}

declare global {
  interface Window {
    agentDeck: AgentDeckApi;
  }
}

export {};
