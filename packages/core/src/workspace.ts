/** One filesystem root inside a workspace. */
export interface WorkspaceRoot {
  id: string;
  /** Absolute path on disk. */
  path: string;
  label?: string;
}

/**
 * Locked: workspace has 1..N roots + a primary root.
 * CLI adapters that only accept a single cwd should use primaryRootId / primaryRoot().
 */
export interface Workspace {
  id: string;
  name: string;
  roots: WorkspaceRoot[];
  /** Must reference one of roots[].id. */
  primaryRootId: string;
  createdAt: string;
  updatedAt: string;
}

/** Resolve the primary root; throws if primaryRootId is missing from roots. */
export function primaryRoot(workspace: Workspace): WorkspaceRoot {
  const found = workspace.roots.find((r) => r.id === workspace.primaryRootId);
  if (!found) {
    throw new Error(`Workspace ${workspace.id} missing primary root ${workspace.primaryRootId}`);
  }
  return found;
}

/** Extra roots besides primary (empty when only one root or primary is the sole entry). */
export function extraRoots(workspace: Workspace): WorkspaceRoot[] {
  return workspace.roots.filter((r) => r.id !== workspace.primaryRootId);
}
