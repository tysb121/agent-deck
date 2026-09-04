/**
 * Main-process adapter factory: switch by backendId.
 * grok → fake; dsh → @agent-deck/adapters-dsh createDshAdapter.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { BackendAdapter } from '@agent-deck/adapters-contract';
import { createFakeAdapter } from '@agent-deck/adapters-fake';
import type { BackendId } from '@agent-deck/core';
import { hasDeepseekApiKey, resolveRepoRoot } from './env';

export interface BackendOption {
  id: BackendId;
  label: string;
  ready: boolean;
  detail: string;
}

export function isDshPackagePresent(repoRoot = resolveRepoRoot()): boolean {
  return existsSync(join(repoRoot, 'packages/adapters-dsh/package.json'));
}

function resolveDshBin(repoRoot = resolveRepoRoot()): string | undefined {
  const candidates = [
    join(repoRoot, 'scripts/node_modules/.bin/dsh'),
    join(repoRoot, 'node_modules/.bin/dsh'),
    join(repoRoot, 'packages/adapters-dsh/node_modules/.bin/dsh'),
  ];
  return candidates.find((p) => existsSync(p));
}

/** dsh-sdk-client uses DSH_NODE_PATH || process.execPath; under Electron execPath is Electron. */
function resolveNodeBinForDsh(repoRoot = resolveRepoRoot()): string | undefined {
  const candidates = [
    join(repoRoot, '.tools/node22/bin/node'),
    join(repoRoot, '.tools/node/bin/node'),
  ];
  return candidates.find((p) => existsSync(p));
}

export function listBackendOptions(): BackendOption[] {
  const dshReady = isDshPackagePresent();
  const hasKey = hasDeepseekApiKey();
  const bin = resolveDshBin();
  return [
    {
      id: 'grok',
      label: 'Grok（演示 / fake）',
      ready: true,
      detail: '本地假流式',
    },
    {
      id: 'dsh',
      label: 'DeepSeek / dsh',
      ready: dshReady && hasKey,
      detail: !dshReady
        ? '缺少 adapters-dsh 包'
        : !hasKey
          ? '缺少 DEEPSEEK_API_KEY'
          : bin
            ? '真 adapter · 已从 .env.local 加载密钥'
            : '真 adapter · 将用 npx 拉取 dsh',
    },
  ];
}

export async function createAdapterForBackend(
  backendId: BackendId,
): Promise<BackendAdapter> {
  if (backendId === 'grok') {
    return createFakeAdapter({ backendId: 'grok', chunkDelayMs: 35 });
  }

  if (backendId === 'dsh') {
    if (!isDshPackagePresent()) {
      throw new Error('缺少 adapters-dsh 包：packages/adapters-dsh 尚未就绪');
    }
    if (!hasDeepseekApiKey()) {
      throw new Error('未加载 DEEPSEEK_API_KEY（请在仓库根配置 .env.local）');
    }

    const repoRoot = resolveRepoRoot();
    const dshHome = join(repoRoot, '.dsh-home');
    const cwd = join(repoRoot, '.dsh-smoke-workspace');
    mkdirSync(dshHome, { recursive: true });
    mkdirSync(cwd, { recursive: true });

    const nodeBin = resolveNodeBinForDsh(repoRoot);
    if (nodeBin) {
      process.env.DSH_NODE_PATH = nodeBin;
      console.info('[agent-deck] DSH_NODE_PATH 已指向独立 Node（避免 Electron execPath）');
    } else {
      console.warn('[agent-deck] 未找到 .tools/node22；dsh 可能误用 Electron 作为 Node');
    }

    const { createDshAdapter } = await import('@agent-deck/adapters-dsh');
    const dshBin = resolveDshBin(repoRoot);
    console.info(
      dshBin
        ? '[agent-deck] 使用真 dsh adapter（本地 bin + .env.local 密钥）'
        : '[agent-deck] 使用真 dsh adapter（npx fallback + .env.local 密钥）',
    );
    return createDshAdapter({
      apiKey: process.env.DEEPSEEK_API_KEY!,
      dshHome,
      cwd,
      model: 'deepseek-v4-flash',
      provider: 'deepseek-official',
      initializeTimeoutMs: 120_000,
      ...(dshBin ? { dshBin } : {}),
    });
  }

  throw new Error(`未知后端: ${backendId}`);
}
