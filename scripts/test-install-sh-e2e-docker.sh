#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${ZHUSHOU_INSTALL_E2E_IMAGE:-zhushou-install-e2e:local}"
INSTALL_URL="${ZHUSHOU_INSTALL_URL:-https://zhushou.bot/install.sh}"

OPENAI_API_KEY="${OPENAI_API_KEY:-}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
ANTHROPIC_API_TOKEN="${ANTHROPIC_API_TOKEN:-}"
ZHUSHOU_E2E_MODELS="${ZHUSHOU_E2E_MODELS:-}"

echo "==> Build image: $IMAGE_NAME"
docker build \
  -t "$IMAGE_NAME" \
  -f "$ROOT_DIR/scripts/docker/install-sh-e2e/Dockerfile" \
  "$ROOT_DIR/scripts/docker"

echo "==> Run E2E installer test"
docker run --rm \
  -e ZHUSHOU_INSTALL_URL="$INSTALL_URL" \
  -e ZHUSHOU_INSTALL_TAG="${ZHUSHOU_INSTALL_TAG:-latest}" \
  -e ZHUSHOU_E2E_MODELS="$ZHUSHOU_E2E_MODELS" \
  -e ZHUSHOU_INSTALL_E2E_PREVIOUS="${ZHUSHOU_INSTALL_E2E_PREVIOUS:-}" \
  -e ZHUSHOU_INSTALL_E2E_SKIP_PREVIOUS="${ZHUSHOU_INSTALL_E2E_SKIP_PREVIOUS:-0}" \
  -e ZHUSHOU_NO_ONBOARD=1 \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -e ANTHROPIC_API_TOKEN="$ANTHROPIC_API_TOKEN" \
  "$IMAGE_NAME"
