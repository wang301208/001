import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          ZHUSHOU_STATE_DIR: "/tmp/zhushou-state",
          ZHUSHOU_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "zhushou-gateway",
        windowsTaskName: "Zhushou Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /tmp/zhushou-state/logs/gateway.log",
      "Launchd stderr (if installed): /tmp/zhushou-state/logs/gateway.err.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        systemdServiceName: "zhushou-gateway",
        windowsTaskName: "Zhushou Gateway",
      }),
    ).toEqual(["Logs: journalctl --user -u zhushou-gateway.service -n 200 --no-pager"]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        systemdServiceName: "zhushou-gateway",
        windowsTaskName: "Zhushou Gateway",
      }),
    ).toEqual(['Logs: schtasks /Query /TN "Zhushou Gateway" /V /FO LIST']);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "zhushou gateway install",
        startCommand: "zhushou gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.zhushou.gateway.plist",
        systemdServiceName: "zhushou-gateway",
        windowsTaskName: "Zhushou Gateway",
      }),
    ).toEqual([
      "zhushou gateway install",
      "zhushou gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.zhushou.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "zhushou gateway install",
        startCommand: "zhushou gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.zhushou.gateway.plist",
        systemdServiceName: "zhushou-gateway",
        windowsTaskName: "Zhushou Gateway",
      }),
    ).toEqual([
      "zhushou gateway install",
      "zhushou gateway",
      "systemctl --user start zhushou-gateway.service",
    ]);
  });
});
