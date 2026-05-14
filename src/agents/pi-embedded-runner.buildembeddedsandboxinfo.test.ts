import { describe, expect, it } from "vitest";
import { buildEmbeddedSandboxInfo } from "./pi-embedded-runner.js";
import { resolveEmbeddedFullAccessState } from "./pi-embedded-runner/sandbox-info.js";
import type { SandboxContext } from "./sandbox.js";

function createSandboxContext(overrides?: Partial<SandboxContext>): SandboxContext {
  const base = {
    enabled: true,
    backendId: "docker",
    sessionKey: "session:test",
    workspaceDir: "/tmp/zhushou-sandbox",
    agentWorkspaceDir: "/tmp/zhushou-workspace",
    workspaceAccess: "none",
    runtimeId: "zhushou-sbx-test",
    runtimeLabel: "zhushou-sbx-test",
    containerName: "zhushou-sbx-test",
    containerWorkdir: "/workspace",
    docker: {
      image: "zhushou-sandbox:bookworm-slim",
      containerPrefix: "zhushou-sbx-",
      workdir: "/workspace",
      readOnlyRoot: true,
      tmpfs: ["/tmp"],
      network: "none",
      user: "1000:1000",
      capDrop: ["ALL"],
      env: { LANG: "C.UTF-8" },
    },
    tools: {
      allow: ["exec"],
      deny: ["browser"],
    },
    browserAllowHostControl: true,
    browser: {
      bridgeUrl: "http://localhost:9222",
      noVncUrl: "http://localhost:6080",
      containerName: "zhushou-sbx-browser-test",
    },
  } satisfies SandboxContext;
  return { ...base, ...overrides };
}

describe("buildEmbeddedSandboxInfo", () => {
  it("returns undefined when sandbox is missing", () => {
    expect(buildEmbeddedSandboxInfo()).toBeUndefined();
  });

  it("maps sandbox context into prompt info", () => {
    const sandbox = createSandboxContext();

    expect(buildEmbeddedSandboxInfo(sandbox)).toEqual({
      enabled: true,
      workspaceDir: "/tmp/zhushou-sandbox",
      containerWorkspaceDir: "/workspace",
      workspaceAccess: "none",
      agentWorkspaceMount: undefined,
      browserBridgeUrl: "http://localhost:9222",
      hostBrowserAllowed: true,
    });
  });

  it("includes elevated info when allowed", () => {
    const sandbox = createSandboxContext({
      browserAllowHostControl: false,
      browser: undefined,
    });

    expect(
      buildEmbeddedSandboxInfo(sandbox, {
        enabled: true,
        allowed: true,
        defaultLevel: "on",
      }),
    ).toEqual({
      enabled: true,
      workspaceDir: "/tmp/zhushou-sandbox",
      containerWorkspaceDir: "/workspace",
      workspaceAccess: "none",
      agentWorkspaceMount: undefined,
      hostBrowserAllowed: false,
      elevated: {
        allowed: true,
        defaultLevel: "on",
        fullAccessAvailable: true,
      },
    });
  });

  it("keeps full-access unavailability truth when provided", () => {
    const sandbox = createSandboxContext();

    expect(
      buildEmbeddedSandboxInfo(sandbox, {
        enabled: true,
        allowed: true,
        defaultLevel: "full",
        fullAccessAvailable: false,
        fullAccessBlockedReason: "runtime",
      }),
    ).toEqual({
      enabled: true,
      workspaceDir: "/tmp/zhushou-sandbox",
      containerWorkspaceDir: "/workspace",
      workspaceAccess: "none",
      agentWorkspaceMount: undefined,
      browserBridgeUrl: "http://localhost:9222",
      hostBrowserAllowed: true,
      elevated: {
        allowed: true,
        defaultLevel: "full",
        fullAccessAvailable: false,
        fullAccessBlockedReason: "runtime",
      },
    });
  });

  it("includes governance freeze details when sandbox governance is active", () => {
    const sandbox = createSandboxContext({
      governance: {
        frozen: true,
        message: "Sandbox runtime is frozen by governance policy because charter audit failed.",
      },
    });

    expect(buildEmbeddedSandboxInfo(sandbox)).toEqual({
      enabled: true,
      workspaceDir: "/tmp/zhushou-sandbox",
      containerWorkspaceDir: "/workspace",
      workspaceAccess: "none",
      agentWorkspaceMount: undefined,
      browserBridgeUrl: "http://localhost:9222",
      hostBrowserAllowed: true,
      governanceFrozen: true,
      governanceMessage:
        "Sandbox runtime is frozen by governance policy because charter audit failed.",
    });
  });
});

describe("resolveEmbeddedFullAccessState", () => {
  it("treats direct host runs with allowed elevation as full-access available", () => {
    expect(
      resolveEmbeddedFullAccessState({
        execElevated: {
          enabled: true,
          allowed: true,
          defaultLevel: "full",
        },
      }),
    ).toEqual({ available: true });
  });

  it("keeps explicit runtime blocks even when host exec is allowed", () => {
    expect(
      resolveEmbeddedFullAccessState({
        execElevated: {
          enabled: true,
          allowed: true,
          defaultLevel: "full",
          fullAccessAvailable: false,
          fullAccessBlockedReason: "runtime",
        },
      }),
    ).toEqual({
      available: false,
      blockedReason: "runtime",
    });
  });
});
