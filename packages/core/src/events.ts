import type { ChatMessage } from './message';
import type { ShellSession } from './session';

/** Tool call lifecycle payload shared by tool.* events. */
export interface ToolCallInfo {
  toolCallId: string;
  name: string;
  /** Opaque / backend-specific status or summary. */
  status?: string;
  inputPreview?: string;
  outputPreview?: string;
}

/** Permission request shown as a modal; reply via requestPermissionReply. */
export interface PermissionRequest {
  requestId: string;
  sessionId: string;
  /** Human-readable description of what is being asked. */
  description: string;
  toolName?: string;
  options?: readonly string[];
}

/** Token / cost usage snapshot (optional fields for sparse backends). */
export interface UsageInfo {
  sessionId: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  /** Opaque backend-specific usage blob. */
  detail?: unknown;
}

/**
 * Unified shell / adapter event stream.
 * Named AdapterEvent in contract re-exports; ShellEvent is the core alias.
 */
export type ShellEvent =
  | { type: 'session.created'; session: ShellSession }
  | { type: 'session.updated'; session: ShellSession }
  | { type: 'message.upsert'; message: ChatMessage }
  | { type: 'message.delta'; sessionId: string; messageId: string; delta: string }
  | { type: 'message.completed'; sessionId: string; messageId: string }
  | { type: 'thought.delta'; sessionId: string; messageId?: string; delta: string }
  | { type: 'tool.started'; sessionId: string; tool: ToolCallInfo }
  | { type: 'tool.updated'; sessionId: string; tool: ToolCallInfo }
  | { type: 'tool.completed'; sessionId: string; tool: ToolCallInfo }
  | { type: 'permission.requested'; permission: PermissionRequest }
  | { type: 'error'; sessionId?: string; message: string; code?: string }
  | { type: 'usage'; usage: UsageInfo };

/** Prefer this name at the adapter boundary; same as ShellEvent. */
export type AdapterEvent = ShellEvent;

export type AdapterEventHandler = (event: AdapterEvent) => void;
