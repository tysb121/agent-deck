/**
 * @agent-deck/adapters-contract
 * BackendAdapter interface + capability flags.
 * One session one backend — adapters never multiplex backends inside a session.
 */

import type {
  AdapterEventHandler,
  BackendId,
  ShellSession,
  Workspace,
} from '@agent-deck/core';

export type {
  AdapterEvent,
  AdapterEventHandler,
  ShellEvent,
  PermissionRequest,
  ToolCallInfo,
  UsageInfo,
} from '@agent-deck/core';

export type AdapterCapability =
  | 'prompt'
  | 'streaming'
  | 'resume'
  | 'abort'
  | 'permissions'
  | 'tools'
  | 'spawn_session';

export interface AdapterCapabilities {
  /** Which features this backend exposes to the shell. */
  flags: readonly AdapterCapability[];
  /** CLI/SDK 是否除 primary 外还能消费额外 workspace roots */
  supportsExtraRoots: boolean;
}

export interface CreateSessionInput {
  workspace: Workspace;
  title?: string;
  parentSessionId?: string;
}

export interface PromptInput {
  sessionId: string;
  text: string;
}

/** Reply to a permission.requested event (optional adapter method). */
export interface PermissionReplyInput {
  sessionId: string;
  requestId: string;
  /** Chosen option id / label, e.g. allow | deny | allow_always */
  decision: string;
}

export interface BackendAdapter {
  readonly backendId: BackendId;
  readonly capabilities: AdapterCapabilities;

  /** Detect whether the local CLI / SDK for this backend is available. */
  detect(): Promise<{ ok: boolean; detail?: string }>;

  createSession(input: CreateSessionInput): Promise<ShellSession>;

  prompt(input: PromptInput): Promise<void>;

  subscribe(handler: AdapterEventHandler): () => void;

  resume?(sessionId: string): Promise<void>;

  abort?(sessionId: string): Promise<void>;

  /** Optional: answer a permission.requested event. */
  requestPermissionReply?(input: PermissionReplyInput): Promise<void>;

  dispose(): Promise<void> | void;
}
