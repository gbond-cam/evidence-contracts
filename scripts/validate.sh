#!/usr/bin/env bash
# validate.sh — Validate the Evidence Ingestion API contract.
# Runs Spectral lint then validates each example against its JSON Schema.
# Requires Node.js >= 18 and `npm install` to have been run.
#
# Usage:
#   ./scripts/validate.sh           # warnings are informational
#   ./scripts/validate.sh --strict  # warnings are treated as errors

set -euo pipefail

STRICT=false
if [[ "${1:-}" == "--strict" ]]; then
  STRICT=true
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── Colour helpers ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC}"; }
fail() { echo -e "${RED}FAIL${NC}"; }

# ── 1. Spectral lint ────────────────────────────────────────────────────────
echo -e "\n${CYAN}==> Spectral lint: openapi/evidence-ingestion.v1.yaml${NC}"
SPECTRAL_ARGS=(lint openapi/evidence-ingestion.v1.yaml --ruleset tools/spectral.yaml --format pretty)
if [[ "$STRICT" == "true" ]]; then
  SPECTRAL_ARGS+=(--fail-severity warn)
fi
npx spectral "${SPECTRAL_ARGS[@]}"

# ── 2. Example validation ───────────────────────────────────────────────────
echo -e "\n${CYAN}==> Validating examples against schemas${NC}"

declare -A EXAMPLE_SCHEMA_MAP=(
  ["examples/ingestion-pull.example.json"]="schemas/ingestion-request.1.0.schema.json"
  ["examples/ingestion-push-inline.example.json"]="schemas/ingestion-request.1.0.schema.json"
  ["examples/ingestion-reference-sharepoint.example.json"]="schemas/ingestion-request.1.0.schema.json"
  ["examples/content-complete.example.json"]="schemas/ingestion-status.1.0.schema.json"
)

ALL_PASSED=true
for EXAMPLE in "${!EXAMPLE_SCHEMA_MAP[@]}"; do
  SCHEMA="${EXAMPLE_SCHEMA_MAP[$EXAMPLE]}"
  TMP=$(mktemp /tmp/evidence-example-XXXXXX.json)

  # Extract the "value" node from the example wrapper
  node -e "
    const fs = require('fs');
    const obj = JSON.parse(fs.readFileSync('$EXAMPLE', 'utf8'));
    fs.writeFileSync('$TMP', JSON.stringify(obj.value, null, 2));
  "

  printf "  Checking %-55s against %-45s ... " "$EXAMPLE" "$SCHEMA"
  if npx ajv validate -s "$SCHEMA" -d "$TMP" --spec=draft2020 > /dev/null 2>&1; then
    pass
  else
    fail
    npx ajv validate -s "$SCHEMA" -d "$TMP" --spec=draft2020 || true
    ALL_PASSED=false
  fi

  rm -f "$TMP"
done

if [[ "$ALL_PASSED" == "false" ]]; then
  echo -e "\n${RED}==> One or more example validations failed.${NC}"
  exit 1
fi

echo -e "\n${GREEN}==> All checks passed.${NC}"
