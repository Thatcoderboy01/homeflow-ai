#!/usr/bin/env bash
# End-to-end smoke test against a RUNNING stack (npm run dev). Uses the seeded demo household.
# Requires: curl, python3. Exits non-zero on failure.
set -euo pipefail
API="${API_URL:-http://localhost:4000/api/v1}"
json() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }

echo "1. health";   curl -fsS "$API/health" | json 'd["status"], d["ai"]'
BEFORE=$(curl -fsS "$API/tasks" | json 'len(d["tasks"])')
echo "2. plan (changes nothing)"
PLAN=$(curl -fsS -X POST "$API/agent/plan" -H 'content-type: application/json' -d '{"message":"Guests are coming on Sunday. Help me prepare."}')
ID=$(echo "$PLAN" | json 'd["approval"]["id"]')
[ "$(curl -fsS "$API/tasks" | json 'len(d["tasks"])')" = "$BEFORE" ] || { echo "FAIL: planning changed data"; exit 1; }
echo "3. approve (executes via MCP)"
curl -fsS -X POST "$API/approvals/$ID/approve" | json 'd["approval"]["status"], d["executedNow"]'
echo "4. approve again (must not execute twice)"
[ "$(curl -fsS -X POST "$API/approvals/$ID/approve" | json 'd["executedNow"]')" = "False" ] || { echo "FAIL: executed twice"; exit 1; }
AFTER=$(curl -fsS "$API/tasks" | json 'len(d["tasks"])')
echo "tasks: $BEFORE -> $AFTER"; [ "$AFTER" -gt "$BEFORE" ] || { echo "FAIL: no tasks created"; exit 1; }
echo "SMOKE TEST PASSED"
