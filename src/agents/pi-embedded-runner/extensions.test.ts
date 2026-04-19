import type { Api, Model } from "@mariozechner/pi-ai";
import type { SessionManager } from "@mariozechner/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { getCompactionSafeguardRuntime } from "../pi-hooks/compaction-safeguard-runtime.js";
import compactionSafeguardExtension from "../pi-hooks/compaction-safeguard.js";
import contextPruningExtension from "../pi-hooks/context-pruning.js";
import { buildEmbeddedExtensionFactories } from "./extensions.js";

vi.mock("../../plugins/provider-runtime.js", () => ({
  resolveProviderCacheTtlEligibility: () => undefined,
  resolveProviderRuntimePlugin: () => undefined,
}));

vi.mock("../../plugins/provider-hook-runtime.js", () => ({
  resolveProviderRuntimePlugin: () => undefined,
}));

function buildSafeguardFactories(cfg: OpenClawConfig) {
  const sessionManager = {} as SessionManager;
  const model = {
    id: "claude-sonnet-4-20250514",
    contextWindow: 200_000,
  } as Model<Api>;

  const factories = buildEmbeddedExtensionFactories({
    cfg,
    sessionManager,
    provider: "anthropic",
    modelId: "claude-sonnet-4-20250514",
    model,
  });

  return { factories, sessionManager };
}

function expectSafeguardRuntime(
  cfg: OpenClawConfig,
  expectedRuntime: { qualityGuardEnabled: boolean; qualityGuardMaxRetries?: number },
) {
  const { factories, sessionManager } = buildSafeguardFactories(cfg);

  expect(factories).toContain(compactionSafeguardExtension);
  expect(getCompactionSafeguardRuntime(sessionManager)).toMatchObject(expectedRuntime);
}

describe("buildEmbeddedExtensionFactories", () => {
  it("does not opt safeguard mode into quality-guard retries", () => {
    const cfg = {
      agents: {
        defaults: {
          compaction: {
            mode: "safeguard",
          },
        },
      },
    } as OpenClawConfig;
    expectSafeguardRuntime(cfg, {
      qualityGuardEnabled: false,
    });
  });

  it("wires explicit safeguard quality-guard runtime flags", () => {
    const cfg = {
      agents: {
        defaults: {
          compaction: {
            mode: "safeguard",
            qualityGuard: {
              enabled: true,
              maxRetries: 2,
            },
          },
        },
      },
    } as OpenClawConfig;
    expectSafeguardRuntime(cfg, {
      qualityGuardEnabled: true,
      qualityGuardMaxRetries: 2,
    });
  });

  it("passes projected task-status override into safeguard runtime", () => {
    const sessionManager = {} as SessionManager;
    const model = {
      id: "claude-sonnet-4-20250514",
      contextWindow: 200_000,
    } as Model<Api>;

    buildEmbeddedExtensionFactories({
      cfg: {
        agents: {
          defaults: {
            compaction: {
              mode: "safeguard",
            },
          },
        },
      } as OpenClawConfig,
      sessionManager,
      provider: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      model,
      projectedTaskStatusOverride:
        "Blocked waiting for confirmation.\nNext step: refresh runtime state.",
      projectedTaskStatusAudit: {
        consumer: "attempt",
        projectedTaskStatusOverride:
          "Blocked waiting for confirmation.\nNext step: refresh runtime state.",
        explanation: {
          meaningful: true,
          restoreBoundary: true,
          statusKind: "blocked",
          source: "checkpoint",
          sourceLabel: "structured compaction checkpoint",
          projectionMode: "blocked-like",
          auditCodes: [
            "continuation.meaningful",
            "continuation.has_source",
            "continuation.has_status_kind",
            "continuation.restore_boundary",
            "projection.blocked_like",
          ],
          reasons: ["blocked-like continuation keeps blocker and next-step context"],
        },
      },
    });

    expect(getCompactionSafeguardRuntime(sessionManager)).toMatchObject({
      projectedTaskStatusOverride:
        "Blocked waiting for confirmation.\nNext step: refresh runtime state.",
      projectedTaskStatusAudit: {
        consumer: "attempt",
        projectedTaskStatusOverride:
          "Blocked waiting for confirmation.\nNext step: refresh runtime state.",
        explanation: {
          projectionMode: "blocked-like",
          auditCodes: [
            "continuation.meaningful",
            "continuation.has_source",
            "continuation.has_status_kind",
            "continuation.restore_boundary",
            "projection.blocked_like",
          ],
        },
      },
      projectedTaskStatusExplanation: {
        projectionMode: "blocked-like",
        auditCodes: [
          "continuation.meaningful",
          "continuation.has_source",
          "continuation.has_status_kind",
          "continuation.restore_boundary",
          "projection.blocked_like",
        ],
      },
    });
  });

  it("keeps legacy taskStatusOverride as a compatibility alias for projected safeguard runtime override", () => {
    const sessionManager = {} as SessionManager;
    const model = {
      id: "claude-sonnet-4-20250514",
      contextWindow: 200_000,
    } as Model<Api>;

    buildEmbeddedExtensionFactories({
      cfg: {
        agents: {
          defaults: {
            compaction: {
              mode: "safeguard",
            },
          },
        },
      } as OpenClawConfig,
      sessionManager,
      provider: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      model,
      taskStatusOverride: "Legacy override text.",
    });

    expect(getCompactionSafeguardRuntime(sessionManager)).toMatchObject({
      projectedTaskStatusOverride: "Legacy override text.",
      taskStatusOverride: "Legacy override text.",
    });
  });

  it("enables cache-ttl pruning for custom anthropic-messages providers", () => {
    const factories = buildEmbeddedExtensionFactories({
      cfg: {
        agents: {
          defaults: {
            contextPruning: {
              mode: "cache-ttl",
            },
          },
        },
      } as OpenClawConfig,
      sessionManager: {} as SessionManager,
      provider: "litellm",
      modelId: "claude-sonnet-4-6",
      model: { api: "anthropic-messages", contextWindow: 200_000 } as Model<Api>,
    });

    expect(factories).toContain(contextPruningExtension);
  });
});
