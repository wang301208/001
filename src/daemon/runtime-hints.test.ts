import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          ASSISTANT_STATE_DIR: "/tmp/assistant-state",
          ASSISTANT_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "assistant-gateway",
        windowsTaskName: "Assistant Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /tmp/assistant-state/logs/gateway.log",
      "Launchd stderr (if installed): /tmp/assistant-state/logs/gateway.err.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        systemdServiceName: "assistant-gateway",
        windowsTaskName: "Assistant Gateway",
      }),
    ).toEqual(["Logs: journalctl --user -u assistant-gateway.service -n 200 --no-pager"]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        systemdServiceName: "assistant-gateway",
        windowsTaskName: "Assistant Gateway",
      }),
    ).toEqual(['Logs: schtasks /Query /TN "Assistant Gateway" /V /FO LIST']);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "assistant gateway install",
        startCommand: "assistant gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.assistant.gateway.plist",
        systemdServiceName: "assistant-gateway",
        windowsTaskName: "Assistant Gateway",
      }),
    ).toEqual([
      "assistant gateway install",
      "assistant gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.assistant.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "assistant gateway install",
        startCommand: "assistant gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.assistant.gateway.plist",
        systemdServiceName: "assistant-gateway",
        windowsTaskName: "Assistant Gateway",
      }),
    ).toEqual([
      "assistant gateway install",
      "assistant gateway",
      "systemctl --user start assistant-gateway.service",
    ]);
  });
});
