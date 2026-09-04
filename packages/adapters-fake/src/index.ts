/**
 * Fake backend adapter - emits streamed assistant messages for UI demo.
 * Can pretend to be either MVP backend: grok | dsh.
 */

import type {
  AdapterCapabilities,
  AdapterEventHandler,
  BackendAdapter,
  CreateSessionInput,
  PromptInput,
} from '@agent-deck/adapters-contract';
import type { BackendId, ChatMessage, ShellSession } from '@agent-deck/core';

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface FakeAdapterOptions {
  /** Pretend backend id for badges / session binding. Default: grok */
  backendId?: BackendId;
  /** Delay between streamed chunks (ms). */
  chunkDelayMs?: number;
}

export class FakeBackendAdapter implements BackendAdapter {
  readonly backendId: BackendId;
  readonly capabilities: AdapterCapabilities = {
    flags: ['prompt', 'streaming', 'abort'] as const,
    supportsExtraRoots: true,
  };

  private handlers = new Set<AdapterEventHandler>();
  private sessions = new Map<string, ShellSession>();
  private chunkDelayMs: number;
  private timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(options: FakeAdapterOptions = {}) {
    this.backendId = options.backendId ?? 'grok';
    this.chunkDelayMs = options.chunkDelayMs ?? 40;
  }

  async detect(): Promise<{ ok: boolean; detail?: string }> {
    return { ok: true, detail: `fake://${this.backendId}` };
  }

  async createSession(input: CreateSessionInput): Promise<ShellSession> {
    const now = new Date().toISOString();
    const session: ShellSession = {
      id: uid('sess'),
      backendId: this.backendId,
      title: input.title ?? `Fake ${this.backendId} session`,
      workspaceId: input.workspace.id,
      ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}),
      status: 'idle',
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    this.emit({ type: 'session.created', session });
    this.emit({ type: 'session.updated', session });
    return session;
  }

  async prompt(input: PromptInput): Promise<void> {
    const session = this.sessions.get(input.sessionId);
    if (!session) {
      this.emit({ type: 'error', sessionId: input.sessionId, message: 'Unknown session' });
      return;
    }

    const userMsg: ChatMessage = {
      id: uid('msg'),
      sessionId: session.id,
      role: 'user',
      content: input.text,
      createdAt: new Date().toISOString(),
    };
    this.emit({ type: 'message.upsert', message: userMsg });

    const assistantId = uid('msg');
    const started: ChatMessage = {
      id: assistantId,
      sessionId: session.id,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      streaming: true,
    };
    this.emit({ type: 'message.upsert', message: started });

    const reply =
      `Hello from FakeAdapter (${this.backendId}). ` +
      `You said: "${input.text}". ` +
      `This is a streamed demo message for the AgentDeck three-pane UI.`;

    const chunks = reply.match(/.{1,12}/g) ?? [reply];
    let i = 0;

    const tick = () => {
      if (i >= chunks.length) {
        this.emit({ type: 'message.completed', sessionId: session.id, messageId: assistantId });
        session.status = 'idle';
        session.updatedAt = new Date().toISOString();
        this.emit({ type: 'session.updated', session: { ...session } });
        return;
      }
      const delta = chunks[i] ?? '';
      i += 1;
      this.emit({
        type: 'message.delta',
        sessionId: session.id,
        messageId: assistantId,
        delta,
      });
      const t = setTimeout(tick, this.chunkDelayMs);
      this.timers.add(t);
    };

    session.status = 'running';
    session.updatedAt = new Date().toISOString();
    this.emit({ type: 'session.updated', session: { ...session } });
    tick();
  }

  subscribe(handler: AdapterEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  async abort(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.status = 'idle';
    session.updatedAt = new Date().toISOString();
    this.emit({ type: 'session.updated', session: { ...session } });
  }

  dispose(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.handlers.clear();
    this.sessions.clear();
  }

  private emit(event: Parameters<AdapterEventHandler>[0]): void {
    for (const h of this.handlers) h(event);
  }
}

export function createFakeAdapter(options?: FakeAdapterOptions): BackendAdapter {
  return new FakeBackendAdapter(options);
}
