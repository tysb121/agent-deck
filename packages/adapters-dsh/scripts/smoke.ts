/**
 * Headless smoke: createDshAdapter → createSession → prompt via official SDK.
 * Loads .env.local; never prints raw secrets.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { createDshAdapter, maskSecret } from '../src/index.ts';
import type { Workspace } from '@agent-deck/core';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const envPath = resolve(repoRoot, '.env.local');
if (existsSync(envPath)) {
  loadDotenv({ path: envPath });
}

const key = process.env.DEEPSEEK_API_KEY;
console.log('[smoke] DEEPSEEK_API_KEY=', maskSecret(key));
console.log('[smoke] node=', process.version);
console.log('[smoke] cwd=', process.cwd());

if (!key) {
  console.error('[smoke] FAIL: DEEPSEEK_API_KEY missing');
  process.exit(1);
}

const demoRoot = resolve(repoRoot, '.dsh-smoke-workspace');
mkdirSync(demoRoot, { recursive: true });
const dshHome = resolve(repoRoot, '.dsh-home');
mkdirSync(dshHome, { recursive: true });

const now = new Date().toISOString();
const workspace: Workspace = {
  id: 'ws_smoke',
  name: 'dsh-smoke',
  roots: [{ id: 'root1', path: demoRoot, label: 'demo' }],
  primaryRootId: 'root1',
  createdAt: now,
  updatedAt: now,
};

const adapter = createDshAdapter({
  dshHome,
  cwd: demoRoot,
  model: 'deepseek-v4-flash',
  provider: 'deepseek-official',
  initializeTimeoutMs: 120_000,
});

const events: { type: string; summary: string }[] = [];
const unsub = adapter.subscribe((ev) => {
  let summary = '';
  switch (ev.type) {
    case 'session.created':
    case 'session.updated':
      summary = `id=${ev.session.id} status=${ev.session.status}`;
      break;
    case 'message.upsert':
      summary = `role=${ev.message.role} id=${ev.message.id} streaming=${Boolean(ev.message.streaming)} len=${ev.message.content.length}`;
      break;
    case 'message.delta':
      summary = `msg=${ev.messageId} deltaLen=${ev.delta.length} preview=${JSON.stringify(ev.delta.slice(0, 80))}`;
      break;
    case 'message.completed':
      summary = `msg=${ev.messageId}`;
      break;
    case 'error':
      summary = `code=${ev.code ?? ''} msg=${ev.message.slice(0, 300)}`;
      break;
    default:
      summary = '(other)';
  }
  events.push({ type: ev.type, summary });
  console.log(`[event] ${ev.type} | ${summary}`);
});

const detect = await adapter.detect();
console.log('[smoke] detect=', detect);

if (!detect.ok) {
  console.error('[smoke] FAIL: detect not ok');
  unsub();
  await adapter.dispose();
  process.exit(1);
}

try {
  const session = await adapter.createSession({
    workspace,
    title: 'smoke',
  });
  console.log('[smoke] session=', session.id);

  await adapter.prompt({
    sessionId: session.id,
    text: '用一句话介绍你自己',
  });

  const deltas = events.filter((e) => e.type === 'message.delta');
  const completed = events.filter((e) => e.type === 'message.completed');
  const errors = events.filter((e) => e.type === 'error');

  console.log('[smoke] eventTypes=', events.map((e) => e.type).join(','));
  console.log('[smoke] deltaCount=', deltas.length);
  console.log('[smoke] completedCount=', completed.length);
  console.log('[smoke] errorCount=', errors.length);

  if (errors.length > 0 || completed.length === 0) {
    console.error('[smoke] FAIL');
    process.exitCode = 1;
  } else {
    console.log('[smoke] OK');
  }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[smoke] FAIL exception:', msg.slice(0, 500));
  process.exitCode = 1;
} finally {
  unsub();
  await adapter.dispose();
}
