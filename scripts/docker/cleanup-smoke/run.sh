#!/usr/bin/env bash
set -euo pipefail

cd /repo

export ZHUSHOU_STATE_DIR="/tmp/zhushou-test"
export ZHUSHOU_CONFIG_PATH="${ZHUSHOU_STATE_DIR}/zhushou.json"

echo "==> Build"
if ! pnpm build >/tmp/zhushou-cleanup-build.log 2>&1; then
  cat /tmp/zhushou-cleanup-build.log
  exit 1
fi

echo "==> Seed state"
mkdir -p "${ZHUSHOU_STATE_DIR}/credentials"
mkdir -p "${ZHUSHOU_STATE_DIR}/agents/main/sessions"
echo '{}' >"${ZHUSHOU_CONFIG_PATH}"
echo 'creds' >"${ZHUSHOU_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${ZHUSHOU_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
if ! pnpm zhushou reset --scope config+creds+sessions --yes --non-interactive >/tmp/zhushou-cleanup-reset.log 2>&1; then
  cat /tmp/zhushou-cleanup-reset.log
  exit 1
fi

test ! -f "${ZHUSHOU_CONFIG_PATH}"
test ! -d "${ZHUSHOU_STATE_DIR}/credentials"
test ! -d "${ZHUSHOU_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${ZHUSHOU_STATE_DIR}/credentials"
echo '{}' >"${ZHUSHOU_CONFIG_PATH}"

echo "==> Uninstall (state only)"
if ! pnpm zhushou uninstall --state --yes --non-interactive >/tmp/zhushou-cleanup-uninstall.log 2>&1; then
  cat /tmp/zhushou-cleanup-uninstall.log
  exit 1
fi

test ! -d "${ZHUSHOU_STATE_DIR}"

echo "OK"
