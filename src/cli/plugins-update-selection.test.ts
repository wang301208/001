import { describe, expect, it } from "vitest";
import type { PluginInstallRecord } from "../config/types.plugins.js";
import { resolvePluginUpdateSelection } from "./plugins-update-selection.js";

function createNpmInstall(params: {
  spec: string;
  installPath?: string;
  resolvedName?: string;
}): PluginInstallRecord {
  return {
    source: "npm",
    spec: params.spec,
    installPath: params.installPath ?? "/tmp/plugin",
    ...(params.resolvedName ? { resolvedName: params.resolvedName } : {}),
  };
}

describe("resolvePluginUpdateSelection", () => {
  it("maps an explicit unscoped npm dist-tag update to the tracked plugin id", () => {
    expect(
      resolvePluginUpdateSelection({
        installs: {
          "assistant-codex-app-server": createNpmInstall({
            spec: "assistant-codex-app-server",
            installPath: "/tmp/assistant-codex-app-server",
            resolvedName: "assistant-codex-app-server",
          }),
        },
        rawId: "assistant-codex-app-server@beta",
      }),
    ).toEqual({
      pluginIds: ["assistant-codex-app-server"],
      specOverrides: {
        "assistant-codex-app-server": "assistant-codex-app-server@beta",
      },
    });
  });

  it("maps an explicit scoped npm dist-tag update to the tracked plugin id", () => {
    expect(
      resolvePluginUpdateSelection({
        installs: {
          "voice-call": createNpmInstall({
            spec: "@assistant/voice-call",
            installPath: "/tmp/voice-call",
            resolvedName: "@assistant/voice-call",
          }),
        },
        rawId: "@assistant/voice-call@beta",
      }),
    ).toEqual({
      pluginIds: ["voice-call"],
      specOverrides: {
        "voice-call": "@assistant/voice-call@beta",
      },
    });
  });

  it("maps an explicit npm version update to the tracked plugin id", () => {
    expect(
      resolvePluginUpdateSelection({
        installs: {
          "assistant-codex-app-server": createNpmInstall({
            spec: "assistant-codex-app-server",
            installPath: "/tmp/assistant-codex-app-server",
            resolvedName: "assistant-codex-app-server",
          }),
        },
        rawId: "assistant-codex-app-server@0.2.0-beta.4",
      }),
    ).toEqual({
      pluginIds: ["assistant-codex-app-server"],
      specOverrides: {
        "assistant-codex-app-server": "assistant-codex-app-server@0.2.0-beta.4",
      },
    });
  });

  it("keeps recorded npm tags when update is invoked by plugin id", () => {
    expect(
      resolvePluginUpdateSelection({
        installs: {
          "assistant-codex-app-server": createNpmInstall({
            spec: "assistant-codex-app-server@beta",
            installPath: "/tmp/assistant-codex-app-server",
            resolvedName: "assistant-codex-app-server",
          }),
        },
        rawId: "assistant-codex-app-server",
      }),
    ).toEqual({
      pluginIds: ["assistant-codex-app-server"],
    });
  });
});
