/**
 * Load secrets from repo-root .env.local into process.env.
 * Never log raw values — only whether a key was loaded.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function resolveRepoRoot(): string {
  // electron-vite main: out/main → apps/desktop → apps → repo root
  return join(__dirname, '../../../..');
}

/** Parse KEY=VALUE lines; ignore comments / blanks. Does not print values. */
export function loadEnvLocal(repoRoot = resolveRepoRoot()): {
  loaded: boolean;
  path: string;
  deepseekKeyLoaded: boolean;
} {
  const path = join(repoRoot, '.env.local');
  if (!existsSync(path)) {
    console.info('[agent-deck] .env.local 未找到，跳过密钥加载');
    return { loaded: false, path, deepseekKeyLoaded: false };
  }

  const text = readFileSync(path, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === '') {
      process.env[key] = value;
    }
  }

  const deepseekKeyLoaded = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
  console.info(
    deepseekKeyLoaded
      ? '[agent-deck] 已从 .env.local 加载 DEEPSEEK_API_KEY'
      : '[agent-deck] .env.local 已读，但未找到 DEEPSEEK_API_KEY',
  );
  return { loaded: true, path, deepseekKeyLoaded };
}

export function hasDeepseekApiKey(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

export { resolveRepoRoot };
