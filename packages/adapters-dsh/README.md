# @agent-deck/adapters-dsh

DeepSeek Harness (`dsh`) BackendAdapter for AgentDeck via official `@deepseek-ai/dsh-sdk-client`.

## Transport

- `DeepSeekHarness` (`profile: sdk`) over stdio JSON-RPC
- Maps `session.event` / `session.status` onto ShellEvent (`message.*`, `session.*`, `error`)

## Requirements

- Node.js `^22.19 || >=24` (`engines` aligned with dsh; **system Node 20 throws** `cannot create effect on inactive context` inside harness Cordis)
- Local Node in this repo: `.tools/node22` (v22.19.0; `.tools/` is gitignored)
- `DEEPSEEK_API_KEY` in env or project `.env.local` (gitignored)
- Matching `@deepseek-ai/dsh` runtime (resolved by the SDK client)

### Electron / `DSH_NODE_PATH`

Official `@deepseek-ai/dsh-sdk-client@0.1.2-rc.1` already spawns with:

`command: process.env.DSH_NODE_PATH || process.execPath`

Under Electron, `process.execPath` is the Electron binary (not Node), so `DSH_NODE_PATH` must point at a real Node. This adapter sets it automatically before creating `DeepSeekHarness` (and also passes it in the harness `env`), preferring:

1. `options.nodeBin`
2. existing `process.env.DSH_NODE_PATH`
3. `process.env.AGENT_DECK_NODE`
4. `<repo>/.tools/node22/bin/node`
5. `<repo>/.tools/node/bin/node`

(first path that exists wins). Desktop may still pre-set `process.env.DSH_NODE_PATH` as a belt-and-suspenders; no need to patch `node_modules`.

## Copy-paste startup (smoke + desktop)

```bash
cd /workspace/agent-deck
export PATH="/workspace/agent-deck/.tools/node22/bin:$PATH"
node -v   # expect v22.19.0
set -a; source .env.local; set +a
# smoke
pnpm --filter @agent-deck/adapters-dsh smoke
# desktop
pnpm --filter @agent-deck/desktop dev
```

Or use the PATH wrapper:

```bash
cd /workspace/agent-deck
./scripts/with-node22.sh pnpm --filter @agent-deck/adapters-dsh smoke
./scripts/with-node22.sh pnpm --filter @agent-deck/desktop dev
```

## Smoke (direct)

```bash
set -a; source .env.local; set +a
node --import tsx packages/adapters-dsh/scripts/smoke.ts
```

## Security

Never commit `.env` / `.env.local` or paste API keys into README/logs.
