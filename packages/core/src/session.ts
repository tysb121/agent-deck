/** MVP backends; fake adapter may pretend either. */
export type BackendId = 'grok' | 'dsh';

export type SessionStatus = 'idle' | 'running' | 'waiting_permission' | 'error' | 'closed';

/**
 * Locked: one session one backend.
 * Collaboration uses spawn_session (new session), never multi-backend in one session.
 */
export interface ShellSession {
  id: string;
  /** Exactly one backend for this session. */
  backendId: BackendId;
  title: string;
  /** Workspace this session is bound to (multi-root supported). */
  workspaceId: string;
  /** Backend-native session / thread ref, if any. */
  backendSessionRef?: string;
  /** Parent shell session when created via spawn_session. */
  parentSessionId?: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}
