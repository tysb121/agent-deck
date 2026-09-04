/**
 * Orchestration stubs - spawn_session types only (no real logic yet).
 * Locked: spawn_session ALWAYS requires user confirmation before creating the child session.
 * Parent session must not auto-approve child permissions.
 */

import type { BackendId, ShellSession } from '@agent-deck/core';

/** Handoff payload from parent to child session (MVP: task note + short summary). */
export interface SpawnHandoff {
  /** Human-readable task description for the child. */
  taskDescription: string;
  /** Short summary of parent context. */
  summary: string;
  /** Optional absolute paths to attach / highlight. */
  paths?: string[];
}

/**
 * Request to spawn a new session on (possibly) another backend.
 * UI must show a confirmation card before calling any adapter.createSession.
 */
export interface SpawnSessionRequest {
  parentSessionId: string;
  targetBackendId: BackendId;
  workspaceId: string;
  title?: string;
  handoff: SpawnHandoff;
}

export type SpawnSessionConfirmationStatus = 'pending' | 'confirmed' | 'cancelled';

export interface SpawnSessionConfirmation {
  id: string;
  request: SpawnSessionRequest;
  status: SpawnSessionConfirmationStatus;
  createdAt: string;
  resolvedAt?: string;
}

/** Result after user confirms and the shell creates the child session. */
export interface SpawnSessionResult {
  confirmationId: string;
  childSession: ShellSession;
}

/**
 * Placeholder - real orchestrator will:
 * 1) enqueue SpawnSessionConfirmation (pending)
 * 2) wait for UI confirm
 * 3) createSession on target adapter with parentSessionId
 */
export type SpawnSessionHandler = (request: SpawnSessionRequest) => Promise<SpawnSessionConfirmation>;

/** Confirm a pending spawn; returns the created child session result. */
export type ConfirmSpawnSession = (confirmationId: string) => Promise<SpawnSessionResult>;

/** Cancel a pending spawn confirmation. */
export type CancelSpawnSession = (confirmationId: string) => Promise<SpawnSessionConfirmation>;

/**
 * Thin orchestrator surface (types only / future stub).
 * enqueuePending → UI confirm/cancel → createSession on target adapter.
 */
export interface SpawnSessionOrchestrator {
  enqueuePending(request: SpawnSessionRequest): Promise<SpawnSessionConfirmation>;
  confirm(confirmationId: string): Promise<SpawnSessionResult>;
  cancel(confirmationId: string): Promise<SpawnSessionConfirmation>;
  getPending(confirmationId: string): SpawnSessionConfirmation | undefined;
}
