#!/usr/bin/env bash
set -euo pipefail

NS="${ASSISTANT_NAMESPACE:-assistant}"
APP="${ASSISTANT_APP_LABEL:-assistant}"
OUT_DIR="${ASSISTANT_DEPLOY_FEEDBACK_DIR:-.artifacts/deploy-feedback}"
GATEWAY_PORT="${ASSISTANT_GATEWAY_PORT:-3000}"

mkdir -p "$OUT_DIR"

echo "Collecting Kubernetes rollout, health, and log feedback for namespace ${NS}."

kubectl get deploy,po,svc -n "$NS" -l "app=${APP}" -o wide | tee "$OUT_DIR/resources.txt"
kubectl rollout status "deployment/${APP}" -n "$NS" --timeout=180s | tee "$OUT_DIR/rollout.txt"

pod_name="$(
  kubectl get pods -n "$NS" -l "app=${APP}" \
    -o jsonpath='{.items[0].metadata.name}'
)"

if [[ -z "$pod_name" ]]; then
  echo "No pod found for app=${APP} in namespace ${NS}." >&2
  exit 1
fi

kubectl describe pod "$pod_name" -n "$NS" > "$OUT_DIR/pod-describe.txt"
kubectl logs "$pod_name" -n "$NS" --tail=300 > "$OUT_DIR/pod.log"

kubectl port-forward -n "$NS" "pod/${pod_name}" "${GATEWAY_PORT}:${GATEWAY_PORT}" > "$OUT_DIR/port-forward.log" 2>&1 &
pf_pid="$!"
trap 'kill "$pf_pid" >/dev/null 2>&1 || true' EXIT

for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:${GATEWAY_PORT}/healthz" > "$OUT_DIR/healthz.json"; then
    break
  fi
  sleep 2
done

curl -fsS "http://127.0.0.1:${GATEWAY_PORT}/readyz" > "$OUT_DIR/readyz.json"

echo "Deployment feedback captured in ${OUT_DIR}."
