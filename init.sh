#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

MODE="${1:-quick}"

echo "=== [1/3] Dependencias ==="
if [ ! -d "node_modules" ]; then
  echo "→ node_modules no existe, instalando..."
  pnpm install --frozen-lockfile
else
  echo "→ OK"
fi

echo ""
echo "=== [2/3] Lint ==="
pnpm lint --max-warnings=0
echo "→ OK"

echo ""
echo "=== [3/3] Type-check ==="
pnpm type-check
echo "→ OK"

if [ "$MODE" = "full" ]; then
  echo ""
  echo "=== [+] Build ==="
  pnpm build
  echo "→ OK"
fi

echo ""
if [ "$MODE" = "full" ]; then
  echo "✓ Verificación completa pasó."
else
  echo "✓ Verificación rápida pasó. (usa './init.sh full' para incluir build)"
fi
