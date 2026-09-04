#!/usr/bin/env bash
# Prefix PATH with repo-local Node 22, then exec the given command.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE22_BIN="${AGENT_DECK_NODE:-$ROOT/.tools/node22/bin/node}"
NODE22_DIR="$(cd "$(dirname "$NODE22_BIN")" && pwd)"
if [[ ! -x "$NODE22_BIN" ]]; then
  echo "with-node22: missing Node 22 binary at $NODE22_BIN" >&2
  echo "Expected: $ROOT/.tools/node22/bin/node (or set AGENT_DECK_NODE)" >&2
  exit 1
fi
export PATH="$NODE22_DIR:$PATH"
exec "$@"
