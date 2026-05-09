#!/usr/bin/env bash
set -euo pipefail

cd /repo

export ASSISTANT_STATE_DIR="/tmp/assistant-test"
export ASSISTANT_CONFIG_PATH="${ASSISTANT_STATE_DIR}/assistant.json"

echo "==> Build"
if ! pnpm build >/tmp/assistant-cleanup-build.log 2>&1; then
  cat /tmp/assistant-cleanup-build.log
  exit 1
fi

echo "==> Seed state"
mkdir -p "${ASSISTANT_STATE_DIR}/credentials"
mkdir -p "${ASSISTANT_STATE_DIR}/agents/main/sessions"
echo '{}' >"${ASSISTANT_CONFIG_PATH}"
echo 'creds' >"${ASSISTANT_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${ASSISTANT_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
if ! pnpm assistant reset --scope config+creds+sessions --yes --non-interactive >/tmp/assistant-cleanup-reset.log 2>&1; then
  cat /tmp/assistant-cleanup-reset.log
  exit 1
fi

test ! -f "${ASSISTANT_CONFIG_PATH}"
test ! -d "${ASSISTANT_STATE_DIR}/credentials"
test ! -d "${ASSISTANT_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${ASSISTANT_STATE_DIR}/credentials"
echo '{}' >"${ASSISTANT_CONFIG_PATH}"

echo "==> Uninstall (state only)"
if ! pnpm assistant uninstall --state --yes --non-interactive >/tmp/assistant-cleanup-uninstall.log 2>&1; then
  cat /tmp/assistant-cleanup-uninstall.log
  exit 1
fi

test ! -d "${ASSISTANT_STATE_DIR}"

echo "OK"
