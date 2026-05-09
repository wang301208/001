import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("development delivery pipeline assets", () => {
  it("defines a remote CI workflow for checks, build, tests, and Docker smoke", () => {
    const workflow = readRepoFile(".github/workflows/ci.yml");

    expect(workflow).toContain("pnpm check");
    expect(workflow).toContain("pnpm build");
    expect(workflow).toContain("pnpm test");
    expect(workflow).toContain("docker build -t assistant:ci .");
    expect(workflow).not.toContain("pnpm --dir web build");
    expect(workflow).not.toContain("web/Dockerfile");
  });

  it("defines release/CD stages for release checks, image publication, npm publication, deploy, and feedback", () => {
    const workflow = readRepoFile(".github/workflows/release-cd.yml");

    expect(workflow).toContain("pnpm release:check");
    expect(workflow).toContain("docker/build-push-action");
    expect(workflow).toContain("bash scripts/assistant-npm-publish.sh --publish");
    expect(workflow).toContain("bash scripts/k8s/deploy.sh");
    expect(workflow).toContain("bash scripts/ci/post-deploy-feedback.sh");
  });

  it("keeps branch, PR, and ownership policy documents in the repository", () => {
    expect(existsSync(join(repoRoot, "CODEOWNERS"))).toBe(true);
    expect(existsSync(join(repoRoot, ".github/pull_request_template.md"))).toBe(true);
    expect(existsSync(join(repoRoot, "docs/branch-policy.md"))).toBe(true);
  });

  it("ships deployable monitoring and deployment feedback assets", () => {
    const kustomization = readRepoFile("scripts/k8s/manifests/kustomization.yaml");
    const deploy = readRepoFile("scripts/k8s/deploy.sh");
    const feedback = readRepoFile("scripts/ci/post-deploy-feedback.sh");

    expect(kustomization).toContain("monitoring/k8s/prometheus.yaml");
    expect(kustomization).toContain("monitoring/k8s/otel-collector.yaml");
    expect(kustomization).toContain("monitoring/k8s/grafana.yaml");
    expect(deploy).toContain("kubectl set image deployment/assistant gateway=");
    expect(feedback).toContain("kubectl logs");
    expect(feedback).toContain("/healthz");
    expect(feedback).toContain("/readyz");
    expect(readRepoFile("src/gateway/server-http.ts")).toContain("assistant_gateway_up");
    expect(existsSync(join(repoRoot, "monitoring/prometheus/prometheus.yml"))).toBe(true);
    expect(existsSync(join(repoRoot, "monitoring/prometheus/assistant-alerts.yml"))).toBe(true);
    expect(existsSync(join(repoRoot, "monitoring/grafana/dashboards/assistant-overview.json"))).toBe(true);
    expect(existsSync(join(repoRoot, "monitoring/otel/otel-collector.yml"))).toBe(true);
  });
});
