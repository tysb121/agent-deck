#!/usr/bin/env node
/**
 * DeepSeek dsh headless smoke test.
 * Loads DEEPSEEK_API_KEY from .env.local (never prints secrets).
 */
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const TIMEOUT_MS = Number(process.env.DSH_SMOKE_TIMEOUT_MS || 120000);
const PROMPT = process.env.DSH_SMOKE_PROMPT || '用一句话介绍你自己';

function loadEnvLocal() {
  const envPath = resolve(root, '.env.local');
  if (!existsSync(envPath)) {
    console.error('[smoke] missing .env.local');
    process.exit(2);
  }
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\n/)) {
    const t = line.replace(/\r$/, '').trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env) || process.env[k] === '') process.env[k] = v;
  }
}

function mask(s) {
  return String(s)
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***MASKED***')
    .replace(/(DEEPSEEK_API_KEY=)\S+/gi, '$1***MASKED***')
    .replace(/(Bearer\s+)\S+/gi, '$1***MASKED***');
}

function findDshBin() {
  const candidates = [
    resolve(root, 'node_modules', '.bin', 'dsh'),
    resolve(root, 'packages', 'adapters-dsh', 'node_modules', '.bin', 'dsh'),
    resolve(root, 'scripts', 'node_modules', '.bin', 'dsh'),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

loadEnvLocal();
const key = process.env.DEEPSEEK_API_KEY || '';
if (!key) {
  console.error('[smoke] DEEPSEEK_API_KEY not set');
  process.exit(2);
}
console.log('[smoke] DEEPSEEK_API_KEY: present (len=' + key.length + ', masked)');
console.log('[smoke] node:', process.version);
console.log('[smoke] prompt:', PROMPT);
console.log('[smoke] timeout_ms:', TIMEOUT_MS);

const dshBin = findDshBin();
const args = dshBin
  ? ['--profile', 'headless', PROMPT]
  : ['--yes', '@deepseek-ai/dsh@latest', '--profile', 'headless', PROMPT];
const cmd = dshBin || 'npx';
console.log('[smoke] cmd:', cmd, args.join(' '));

const child = spawn(cmd, args, {
  cwd: root,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (d) => { const t = d.toString(); stdout += t; process.stdout.write(mask(t)); });
child.stderr.on('data', (d) => { const t = d.toString(); stderr += t; process.stderr.write(mask(t)); });

const timer = setTimeout(() => {
  console.error('[smoke] TIMEOUT after ' + TIMEOUT_MS + 'ms');
  child.kill('SIGKILL');
}, TIMEOUT_MS);

child.on('close', (code, signal) => {
  clearTimeout(timer);
  console.log('[smoke] exit_code:', code);
  console.log('[smoke] signal:', signal);
  console.log('[smoke] stdout_chars:', stdout.length);
  console.log('[smoke] stderr_chars:', stderr.length);
  process.exit(code === 0 ? 0 : (code ?? 1));
});
