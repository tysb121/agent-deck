#!/usr/bin/env node
/**
 * Loads .env.local, constructs DshBackendAdapter via dynamic tsx/node if built,
 * otherwise just verifies dsh CLI detect path.
 * This file is ESM and uses child_process only (no key print).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.replace(/\r$/, '').trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
const hasKey = Boolean(process.env.DEEPSEEK_API_KEY);
console.log('[adapter-detect] apiKey:', hasKey ? 'present' : 'missing');
const r = spawnSync('npx', ['--yes', '@deepseek-ai/dsh@latest', '-V'], {
  encoding: 'utf8',
  env: process.env,
  cwd: root,
});
console.log('[adapter-detect] dsh version:', (r.stdout || '').trim() || '(none)');
console.log('[adapter-detect] status:', r.status);
process.exit(r.status === 0 && hasKey ? 0 : 1);
