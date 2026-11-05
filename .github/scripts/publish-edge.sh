#!/usr/bin/env bash
set -euo pipefail

ZIP="$1"
NOTES="$2"
API="${EDGE_API_BASE:-https://api.addons.microsoftedge.microsoft.com}/v1/products/${EDGE_PRODUCT_ID}"
POLL_INTERVAL="${EDGE_POLL_INTERVAL:-5}"
POLL_ATTEMPTS="${EDGE_POLL_ATTEMPTS:-60}"
AUTH=(-H "Authorization: ApiKey ${EDGE_API_KEY}" -H "X-ClientID: ${EDGE_CLIENT_ID}")

operation_id() {
    local location
    location=$(grep -i '^location:' "$1" | tail -1 | cut -d' ' -f2- | tr -d '\r')
    if [ -z "$location" ]; then
        echo "::error::No Location header in Edge Add-ons response" >&2
        exit 1
    fi
    basename "$location"
}

wait_for() {
    local url="$1" what="$2" body status
    for _ in $(seq "$POLL_ATTEMPTS"); do
        body=$(curl -sS --fail-with-body "${AUTH[@]}" "$url")
        status=$(jq -r '.status // empty' <<<"$body")
        case "$status" in
            Succeeded)
                echo "$what succeeded: $(jq -r '.message // ""' <<<"$body")"
                return 0
                ;;
            InProgress) sleep "$POLL_INTERVAL" ;;
            *)
                echo "::error::$what failed: $body"
                exit 1
                ;;
        esac
    done
    echo "::error::$what still in progress after $POLL_ATTEMPTS checks"
    exit 1
}

headers=$(mktemp)

echo "Uploading package..."
curl -sS --fail-with-body -D "$headers" -o /dev/null "${AUTH[@]}" \
    -H "Content-Type: application/zip" \
    -X POST -T "$ZIP" \
    "$API/submissions/draft/package"
upload_op=$(operation_id "$headers")
wait_for "$API/submissions/draft/package/operations/$upload_op" "Upload"

echo "Submitting for review..."
curl -sS --fail-with-body -D "$headers" -o /dev/null "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -X POST -d "$(jq -n --arg notes "$NOTES" '{notes: $notes}')" \
    "$API/submissions"
publish_op=$(operation_id "$headers")
wait_for "$API/submissions/operations/$publish_op" "Submission"
