import { afterEach, describe, expect, it, vi } from "vitest";
import { captureFullEnv } from "../test-utils/env.js";
import { SUPERVISOR_HINT_ENV_VARS } from "./supervisor-markers.js";

const spawnMock = vi.hoisted(() => vi.fn());
const triggerAssistantRestartMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", async () => {
  const { mockNodeBuiltinModule } = await import("../../test/helpers/node-builtin-mocks.js");
  return mockNodeBuiltinModule(
    () => vi.importActual<typeof import("node:child_process")>("node:child_process"),
    {
      spawn: (...args: unknown[]) => spawnMock(...args),
    },
  );
});

vi.mock("./restart.js", () => ({
  triggerAssistantRestart: (...args: unknown[]) => triggerAssistantRestartMock(...args),
}));

import { restartGatewayProcessWithFreshPid } from "./process-respawn.js";

const originalArgv = [...process.argv];
const originalExecArgv = [...process.execArgv];
const envSnapshot = captureFullEnv();
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");

function setPlatform(platform: string) {
  if (!originalPlatformDescriptor) {
    return;
  }
  Object.defineProperty(process, "platform", {
    ...originalPlatformDescriptor,
    value: platform,
  });
}

function clearSupervisorHints() {
  for (const key of SUPERVISOR_HINT_ENV_VARS) {
    delete process.env[key];
  }
}

function expectAutomaticRestartDisabled() {
  expect(restartGatewayProcessWithFreshPid()).toEqual({
    mode: "disabled",
    detail: "automatic gateway restart disabled",
  });
  expect(triggerAssistantRestartMock).not.toHaveBeenCalled();
  expect(spawnMock).not.toHaveBeenCalled();
}

afterEach(() => {
  envSnapshot.restore();
  process.argv = [...originalArgv];
  process.execArgv = [...originalExecArgv];
  spawnMock.mockClear();
  triggerAssistantRestartMock.mockClear();
  if (originalPlatformDescriptor) {
    Object.defineProperty(process, "platform", originalPlatformDescriptor);
  }
});

describe("restartGatewayProcessWithFreshPid", () => {
  it("always disables automatic gateway restart", () => {
    expectAutomaticRestartDisabled();
  });

  it("does not respawn even when no-respawn is unset on Linux", () => {
    delete process.env.ASSISTANT_NO_RESPAWN;
    clearSupervisorHints();
    setPlatform("linux");
    process.execArgv = ["--import", "tsx"];
    process.argv = ["/usr/local/bin/node", "/repo/dist/index.js", "gateway", "run"];
    spawnMock.mockReturnValue({ pid: 4242, unref: vi.fn() });

    expectAutomaticRestartDisabled();
  });

  it("does not delegate restart to launchd", () => {
    clearSupervisorHints();
    setPlatform("darwin");
    process.env.LAUNCH_JOB_LABEL = "ai.assistant.gateway";
    process.env.ASSISTANT_LAUNCHD_LABEL = "ai.assistant.gateway";
    triggerAssistantRestartMock.mockReturnValue({
      ok: false,
      method: "launchctl",
      detail: "Bootstrap failed: 5: Input/output error",
    });

    expectAutomaticRestartDisabled();
  });

  it("does not delegate restart to systemd", () => {
    clearSupervisorHints();
    setPlatform("linux");
    process.env.INVOCATION_ID = "abc123";
    process.env.ASSISTANT_SYSTEMD_UNIT = "assistant-gateway.service";

    expectAutomaticRestartDisabled();
  });

  it("does not delegate restart to Windows Scheduled Tasks", () => {
    clearSupervisorHints();
    setPlatform("win32");
    process.env.ASSISTANT_SERVICE_MARKER = "assistant";
    process.env.ASSISTANT_SERVICE_KIND = "gateway";
    triggerAssistantRestartMock.mockReturnValue({ ok: true, method: "schtasks" });

    expectAutomaticRestartDisabled();
  });

  it("does not report spawn failures because spawn is never attempted", () => {
    clearSupervisorHints();
    setPlatform("linux");
    spawnMock.mockImplementation(() => {
      throw new Error("spawn failed");
    });

    expectAutomaticRestartDisabled();
  });
});
