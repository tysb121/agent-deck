/** @agent-deck/core - shared session / workspace / message / event types */

export type { BackendId, SessionStatus, ShellSession } from './session';
export type { Workspace, WorkspaceRoot } from './workspace';
export { primaryRoot, extraRoots } from './workspace';
export type { MessageRole, ChatMessage } from './message';
export type {
  ShellEvent,
  AdapterEvent,
  AdapterEventHandler,
  ToolCallInfo,
  PermissionRequest,
  UsageInfo,
} from './events';
