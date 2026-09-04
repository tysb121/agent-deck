/**
 * DeepSeek Harness (dsh) backend adapter.
 * Maps DeepSeekHarness / wire notifications onto BackendAdapter + ShellEvent.
 *
 * Streaming granularity note:
 * - Prefer incremental text from session.event assistant/chunk (or text deltas).
 * - If only finalResponse is available, emit one message.delta of the full
 *   assistant text then message.completed (coarse "streaming").
 * - Wire has no mid-turn cancel; abort() closes/disposes the harness process.
 */

import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client';
import type { HarnessNotification } from '@deepseek-ai/dsh-sdk-client';
import type {
  AdapterCapabilities,
  AdapterEventHandler,
  BackendAdapter,
  CreateSessionInput,
  PromptInput,
} from '@agent-deck/adapters-contract';
import type { ChatMessage, ShellSession } from '@agent-deck/core';
import { primaryRoot } from '@agent-deck/core';

const require = createRequire(import.meta.url);

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Mask secrets for logs: first 4 + *** + last 2, or *** if too short. */
export function maskSecret(value: string | undefined | null): string {
  if (!value) return '***';
  if (value.length <= 6) return '***';
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

function loadEnvLocal(): void {
  const candidates = [
    resolve(process.cwd(), '.env.local'),
    resolve(fileURLToPath(new URL('../../..', import.meta.url)), '.env.local'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      loadDotenv({ path: p, override: false });
      return;
    }
  }
}

function resolveDshBin(): string | undefined {
  try {
    const pkgJson = require.resolve('@deepseek-ai/dsh/package.json');
    const pkg = require(pkgJson) as { bin?: string | Record<string, string> };
    const binField = pkg.bin;
    const rel =
      typeof binField === 'string'
        ? binField
        : binField && typeof binField === 'object'
          ? binField.dsh
          : undefined;
    if (!rel) return undefined;
    const abs = join(dirname(pkgJson), rel);
    return existsSync(abs) ? abs : undefined;
  } catch {
    return undefined;
  }
}

function repoRootFromPackage(): string {
  return resolve(fileURLToPath(new URL('../../..', import.meta.url)));
}

/**
 * Resolve a real Node binary for @deepseek-ai/dsh-sdk-client.
 * Official SDK (0.1.2-rc.1+) uses: command: process.env.DSH_NODE_PATH || process.execPath
 * Under Electron, process.execPath is Electron itself — set DSH_NODE_PATH.
 *
 * Priority (first existing absolute path wins; call site may prefer options.nodeBin):
 *   process.env.DSH_NODE_PATH → AGENT_DECK_NODE → <repo>/.tools/node22/bin/node → <repo>/.tools/node/bin/node
 */
export function resolveNodeBinForDsh(repoRoot?: string): string | undefined {
  const root = repoRoot ?? repoRootFromPackage();
  const candidates = [
    process.env.DSH_NODE_PATH,
    process.env.AGENT_DECK_NODE,
    join(root, '.tools/node22/bin/node'),
    join(root, '.tools/node/bin/node'),
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const bin = isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
    if (existsSync(bin)) return bin;
  }
  return undefined;
}

/** Prefer options.nodeBin when present on disk, else resolveNodeBinForDsh. */
function resolveNodeBin(optionsNodeBin?: string, repoRoot?: string): string | undefined {
  if (optionsNodeBin) {
    const bin = isAbsolute(optionsNodeBin)
      ? optionsNodeBin
      : resolve(process.cwd(), optionsNodeBin);
    if (existsSync(bin)) return bin;
  }
  return resolveNodeBinForDsh(repoRoot);
}

function extractTextFromUnknown(data: unknown): string {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return '';
  const obj = data as Record<string, unknown>;
  if (typeof obj.text === 'string') return obj.text;
  if (typeof obj.delta === 'string') return obj.delta;
  if (typeof obj.content === 'string') return obj.content;
  if (Array.isArray(obj.content)) {
    return obj.content
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block && typeof block === 'object' && typeof (block as { text?: string }).text === 'string') {
          return (block as { text: string }).text;
        }
        return '';
      })
      .join('');
  }
  if (obj.message && typeof obj.message === 'object') {
    return extractTextFromUnknown(obj.message);
  }
  return '';
}

/**
 * Best-effort parse of session.event payloads for assistant incremental text.
 * Event shapes evolve; we accept assistant/chunk and nested text/content fields.
 */
function assistantDeltaFromSessionEvent(event: unknown): string | null {
  if (!event || typeof event !== 'object') return null;
  const ev = event as Record<string, unknown>;
  const type = typeof ev.type === 'string' ? ev.type : undefined;
  const data = ev.data ?? ev;

  if (type === 'assistant/chunk' || type === 'assistant.chunk') {
    const text = extractTextFromUnknown(data);
    return text || null;
  }
  if (ev.event && typeof ev.event === 'object') {
    return assistantDeltaFromSessionEvent(ev.event);
  }
  return null;
}

export interface DshAdapterOptions {
  /** Workspace cwd fallback when session workspace primary root is unavailable. */
  cwd?: string;
  /** Isolated DSH_HOME (default: <repo>/.dsh-home). */
  dshHome?: string;
  /** Model id (default deepseek-v4-flash). */
  model?: string;
  /** Provider route (default deepseek-official). */
  provider?: string;
  /** Absolute path override for dsh bin. */
  dshBin?: string;
  /** Absolute Node binary; sets DSH_NODE_PATH for SDK (Electron-safe). */
  nodeBin?: string;
  /** API key; defaults to process.env.DEEPSEEK_API_KEY after loading .env.local. */
  apiKey?: string;
  /** Max output tokens. */
  maxTokens?: number;
  /** Initialize handshake timeout ms. */
  initializeTimeoutMs?: number;
}

interface SessionState {
  session: ShellSession;
  cwd: string;
  harness?: DeepSeekHarness;
  /** Native harness session id (may differ from shell session id). */
  harnessSessionId?: string;
  abortRequested?: boolean;
}

export class DshBackendAdapter implements BackendAdapter {
  readonly backendId = 'dsh' as const;
  readonly capabilities: AdapterCapabilities = {
    flags: ['prompt', 'streaming', 'abort'] as const,
    supportsExtraRoots: false,
  };

  private handlers = new Set<AdapterEventHandler>();
  private sessions = new Map<string, SessionState>();
  private readonly options: DshAdapterOptions;
  private disposed = false;

  constructor(options: DshAdapterOptions = {}) {
    loadEnvLocal();
    this.options = options;
  }

  private get apiKey(): string | undefined {
    return this.options.apiKey ?? process.env.DEEPSEEK_API_KEY;
  }

  private get dshHome(): string {
    const raw =
      this.options.dshHome ??
      resolve(fileURLToPath(new URL('../../..', import.meta.url)), '.dsh-home');
    return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
  }

  private get model(): string {
    return this.options.model ?? 'deepseek-v4-flash';
  }

  private get provider(): string {
    return this.options.provider ?? 'deepseek-official';
  }

  async detect(): Promise<{ ok: boolean; detail?: string }> {
    loadEnvLocal();
    const key = this.apiKey;
    const hasKey = Boolean(key && key.length > 0);
    const dshBin = this.options.dshBin ?? resolveDshBin();
    const nodeBin = resolveNodeBin(this.options.nodeBin, repoRootFromPackage());
    const parts: string[] = [];
    parts.push(hasKey ? `DEEPSEEK_API_KEY=${maskSecret(key)}` : 'DEEPSEEK_API_KEY=missing');
    parts.push(dshBin ? 'dshBin=ok' : 'dshBin=unresolved');
    parts.push(`model=${this.model}`);
    parts.push(`dshHome=${this.dshHome}`);
    parts.push(`node=${process.version}`);
    parts.push(nodeBin ? `DSH_NODE_PATH=ok (${nodeBin})` : 'DSH_NODE_PATH=missing');
    const ok = hasKey && Boolean(dshBin);
    return { ok, detail: parts.join('; ') };
  }

  async createSession(input: CreateSessionInput): Promise<ShellSession> {
    if (this.disposed) {
      throw new Error('DshBackendAdapter disposed');
    }
    const root = primaryRoot(input.workspace);
    const now = new Date().toISOString();
    const session: ShellSession = {
      id: uid('sess'),
      backendId: 'dsh',
      title: input.title ?? 'DSH session',
      workspaceId: input.workspace.id,
      ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}),
      status: 'idle',
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, {
      session,
      cwd: root.path,
    });
    this.emit({ type: 'session.created', session: { ...session } });
    this.emit({ type: 'session.updated', session: { ...session } });
    return session;
  }

  async prompt(input: PromptInput): Promise<void> {
    const state = this.sessions.get(input.sessionId);
    if (!state) {
      this.emit({ type: 'error', sessionId: input.sessionId, message: 'Unknown session' });
      return;
    }

    const userMsg: ChatMessage = {
      id: uid('msg'),
      sessionId: state.session.id,
      role: 'user',
      content: input.text,
      createdAt: new Date().toISOString(),
    };
    this.emit({ type: 'message.upsert', message: userMsg });

    const assistantId = uid('msg');
    const started: ChatMessage = {
      id: assistantId,
      sessionId: state.session.id,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      streaming: true,
    };
    this.emit({ type: 'message.upsert', message: started });

    state.session.status = 'running';
    state.session.updatedAt = new Date().toISOString();
    this.emit({ type: 'session.updated', session: { ...state.session } });
    state.abortRequested = false;

    try {
      const harness = await this.ensureHarness(state);
      let streamed = '';
      let sawChunk = false;

      const onNotification = (notification: HarnessNotification) => {
        if (state.abortRequested) return;
        if (notification.method !== 'session.event') return;
        const params = notification.params as {
          sessionId?: string;
          event?: unknown;
        };
        const delta = assistantDeltaFromSessionEvent(params.event ?? params);
        if (delta) {
          sawChunk = true;
          streamed += delta;
          this.emit({
            type: 'message.delta',
            sessionId: state.session.id,
            messageId: assistantId,
            delta,
          });
        }
      };

      const runOpts: { sessionId?: string; onNotification: typeof onNotification } = {
        onNotification,
      };
      if (state.harnessSessionId) {
        runOpts.sessionId = state.harnessSessionId;
      }

      const result = await harness.run(input.text, runOpts);
      state.harnessSessionId = result.sessionId;
      state.session.backendSessionRef = result.sessionId;

      if (state.abortRequested) {
        this.emit({
          type: 'error',
          sessionId: state.session.id,
          message: 'Aborted (runtime closed; wire has no mid-turn cancel)',
          code: 'aborted',
        });
      } else {
        const finalText = result.finalResponse ?? '';
        if (!sawChunk) {
          // Coarse streaming: one delta with the full final response.
          if (finalText) {
            this.emit({
              type: 'message.delta',
              sessionId: state.session.id,
              messageId: assistantId,
              delta: finalText,
            });
            streamed = finalText;
          }
        } else if (finalText && finalText.length > streamed.length) {
          const rest = finalText.slice(streamed.length);
          if (rest) {
            this.emit({
              type: 'message.delta',
              sessionId: state.session.id,
              messageId: assistantId,
              delta: rest,
            });
          }
        }
        this.emit({
          type: 'message.completed',
          sessionId: state.session.id,
          messageId: assistantId,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit({
        type: 'error',
        sessionId: state.session.id,
        message: `dsh prompt failed: ${message}`,
        code: 'dsh_prompt_error',
      });
      state.session.status = 'error';
      state.session.updatedAt = new Date().toISOString();
      this.emit({ type: 'session.updated', session: { ...state.session } });
      return;
    }

    state.session.status = 'idle';
    state.session.updatedAt = new Date().toISOString();
    this.emit({ type: 'session.updated', session: { ...state.session } });
  }

  subscribe(handler: AdapterEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Abort limitation: SDK/wire has no prompt-cancel method.
   * We mark the session aborted and close the harness subprocess.
   */
  async abort(sessionId: string): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    state.abortRequested = true;
    if (state.harness) {
      try {
        await state.harness.close();
      } catch {
        // ignore teardown races
      }
      delete state.harness;
    }
    state.session.status = 'idle';
    state.session.updatedAt = new Date().toISOString();
    this.emit({ type: 'session.updated', session: { ...state.session } });
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    for (const state of this.sessions.values()) {
      if (state.harness) {
        try {
          await state.harness.close();
        } catch {
          // ignore
        }
        delete state.harness;
      }
    }
    this.sessions.clear();
    this.handlers.clear();
  }

  private async ensureHarness(state: SessionState): Promise<DeepSeekHarness> {
    if (state.harness) return state.harness;

    loadEnvLocal();
    const key = this.apiKey;
    if (!key) {
      throw new Error('DEEPSEEK_API_KEY missing (load .env.local or pass apiKey)');
    }

    mkdirSync(this.dshHome, { recursive: true });
    const cwd = this.options.cwd ?? state.cwd;

    // Official SDK reads process.env.DSH_NODE_PATH || process.execPath.
    // Set before constructing DeepSeekHarness; also pass via harness env.
    const nodeBin = resolveNodeBin(this.options.nodeBin, repoRootFromPackage());
    if (nodeBin) {
      process.env.DSH_NODE_PATH = nodeBin;
    }

    const harnessEnv: NodeJS.ProcessEnv = {
      ...process.env,
      DEEPSEEK_API_KEY: key,
      DSH_HOME: this.dshHome,
    };
    if (nodeBin) {
      harnessEnv.DSH_NODE_PATH = nodeBin;
    }

    const harnessOpts: ConstructorParameters<typeof DeepSeekHarness>[0] = {
      profile: 'sdk',
      dshHome: this.dshHome,
      cwd,
      provider: this.provider,
      model: this.model,
      maxTokens: this.options.maxTokens ?? 49_152,
      initializeTimeoutMs: this.options.initializeTimeoutMs ?? 60_000,
      env: harnessEnv,
    };
    if (this.options.dshBin) {
      harnessOpts!.dshBin = this.options.dshBin;
    }

    const harness = new DeepSeekHarness(harnessOpts);
    state.harness = harness;
    return harness;
  }

  private emit(event: Parameters<AdapterEventHandler>[0]): void {
    for (const h of this.handlers) {
      try {
        h(event);
      } catch {
        // subscriber errors must not break the adapter
      }
    }
  }
}

export function createDshAdapter(options?: DshAdapterOptions): BackendAdapter {
  return new DshBackendAdapter(options);
}
