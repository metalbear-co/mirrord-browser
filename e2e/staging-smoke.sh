#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

: "${MIRRORD_BIN:?path to a mirrord binary}"
: "${KUBECONFIG:?kubeconfig pointing at the playground cluster}"

TARGET=${SMOKE_TARGET:-deployment/inventory-service}
NAMESPACE=${SMOKE_NAMESPACE:-shop}
UI_PORT=${SMOKE_UI_PORT:-59281}
SESSION_SECONDS=${SMOKE_SESSION_SECONDS:-240}

banner_file=$(mktemp)
"$MIRRORD_BIN" ui --port "$UI_PORT" >"$banner_file" 2>&1 &
ui_launcher_pid=$!

token=""
for _ in $(seq 1 20); do
    token=$(grep -o 'token=[a-f0-9]*' "$banner_file" | head -1 | cut -d= -f2 || true)
    [ -n "$token" ] && break
    sleep 1
done
pid=$(grep -A1 'Server PID' "$banner_file" | grep -o '[0-9]\+' | head -1 || true)
if [ -z "$token" ]; then
    echo "could not start mirrord ui:"
    cat "$banner_file"
    kill "$ui_launcher_pid" 2>/dev/null || true
    exit 1
fi

cleanup() {
    kill "$session_pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
    kill "$ui_launcher_pid" 2>/dev/null || true
}
trap cleanup EXIT

context_line=""
if [ -n "${SMOKE_CONTEXT:-}" ]; then
    context_line="\"kube_context\": \"${SMOKE_CONTEXT}\","
fi

cat >/tmp/smoke-mirrord.json <<EOF
{
    ${context_line}
    "target": { "path": "${TARGET}", "namespace": "${NAMESPACE}" },
    "feature": { "network": { "incoming": { "mode": "mirror" } } }
}
EOF

"$MIRRORD_BIN" exec -f /tmp/smoke-mirrord.json -- sleep "$SESSION_SECONDS" \
    >/tmp/smoke-session.log 2>&1 &
session_pid=$!

base_url="http://127.0.0.1:${UI_PORT}"
for _ in $(seq 1 30); do
    sessions=$(curl -s -m 5 -H "x-auth-token: ${token}" \
        "${base_url}/api/v2/local/sessions" || echo '[]')
    if [ "$sessions" != "[]" ] && [ -n "$sessions" ]; then
        break
    fi
    if ! kill -0 "$session_pid" 2>/dev/null; then
        echo "mirrord exec exited early:"
        tail -40 /tmp/smoke-session.log
        exit 1
    fi
    sleep 5
done

if [ "$sessions" = "[]" ] || [ -z "$sessions" ]; then
    echo "session never appeared in the monitor API"
    tail -40 /tmp/smoke-session.log
    exit 1
fi
echo "session visible: $(echo "$sessions" | head -c 200)"

export MIRRORD_UI_URL="$base_url"
export MIRRORD_UI_TOKEN="$token"
export MIRRORD_UI_BACKEND="$base_url"

runner=""
if command -v xvfb-run >/dev/null; then
    runner="xvfb-run"
fi
$runner pnpm exec playwright test real-server.spec.ts live-real.spec.ts
