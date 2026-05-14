import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectMarkerLineWithGateway, findExtraGatewayServices } from "./inspect.js";

const { execSchtasksMock } = vi.hoisted(() => ({
  execSchtasksMock: vi.fn(),
}));

vi.mock("./schtasks-exec.js", () => ({
  execSchtasks: (...args: unknown[]) => execSchtasksMock(...args),
}));

// Real content from the zhushou-gateway.service unit file (the canonical gateway unit).
const GATEWAY_SERVICE_CONTENTS = `\
[Unit]
Description=Zhushou Gateway (v2026.3.8)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/node /home/zhushou/.npm-global/lib/node_modules/zhushou/dist/entry.js gateway --port 18789
Environment=ZHUSHOU_SERVICE_MARKER=zhushou
Environment=ZHUSHOU_SERVICE_KIND=gateway
Environment=ZHUSHOU_SERVICE_VERSION=2026.3.8

[Install]
WantedBy=default.target
`;

// Real content from the zhushou-test.service unit file (a non-gateway zhushou service).
const TEST_SERVICE_CONTENTS = `\
[Unit]
Description=助手 test service
After=default.target

[Service]
Type=simple
ExecStart=/bin/sh -c 'while true; do sleep 60; done'

[Install]
WantedBy=default.target
`;

const UNRELATED_GATEWAY_CONTENTS = `\
[Unit]
Description=Unrelated Gateway
[Service]
ExecStart=/usr/bin/node /opt/other-tool/dist/entry.js gateway --port 18789
Environment=HOME=/home/other-tool
`;

describe("detectMarkerLineWithGateway", () => {
  it("returns null for zhushou-test.service (zhushou only in description, no gateway on same line)", () => {
    expect(detectMarkerLineWithGateway(TEST_SERVICE_CONTENTS)).toBeNull();
  });

  it("returns zhushou for the canonical gateway unit (ExecStart has both zhushou and gateway)", () => {
    expect(detectMarkerLineWithGateway(GATEWAY_SERVICE_CONTENTS)).toBe("zhushou");
  });

  it("ignores unrelated gateway units", () => {
    expect(detectMarkerLineWithGateway(UNRELATED_GATEWAY_CONTENTS)).toBeNull();
  });

  it("handles line continuations — marker and gateway split across physical lines", () => {
    const contents = `[Service]\nExecStart=/usr/bin/node /opt/zhushou/dist/entry.js \\\n  gateway --port 18789\n`;
    expect(detectMarkerLineWithGateway(contents)).toBe("zhushou");
  });
});

describe("findExtraGatewayServices (linux / scanSystemdDir) — real filesystem", () => {
  // These tests write real .service files to a temp dir and call findExtraGatewayServices
  // with that dir as HOME. No platform mocking or fs mocking needed.
  // Only runs on Linux/macOS where the linux branch of findExtraGatewayServices is active.
  const isLinux = process.platform === "linux";

  it.skipIf(!isLinux)("does not report zhushou-test.service as a gateway service", async () => {
    const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "zhushou-test-"));
    const systemdDir = path.join(tmpHome, ".config", "systemd", "user");
    try {
      await fs.mkdir(systemdDir, { recursive: true });
      await fs.writeFile(path.join(systemdDir, "zhushou-test.service"), TEST_SERVICE_CONTENTS);
      const result = await findExtraGatewayServices({ HOME: tmpHome });
      expect(result).toEqual([]);
    } finally {
      await fs.rm(tmpHome, { recursive: true, force: true });
    }
  });

  it.skipIf(!isLinux)(
    "does not report the canonical zhushou-gateway.service as an extra service",
    async () => {
      const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "zhushou-test-"));
      const systemdDir = path.join(tmpHome, ".config", "systemd", "user");
      try {
        await fs.mkdir(systemdDir, { recursive: true });
        await fs.writeFile(
          path.join(systemdDir, "zhushou-gateway.service"),
          GATEWAY_SERVICE_CONTENTS,
        );
        const result = await findExtraGatewayServices({ HOME: tmpHome });
        expect(result).toEqual([]);
      } finally {
        await fs.rm(tmpHome, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(!isLinux)(
    "ignores unrelated gateway services",
    async () => {
      const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "zhushou-test-"));
      const systemdDir = path.join(tmpHome, ".config", "systemd", "user");
      const unitPath = path.join(systemdDir, "other-gateway.service");
      try {
        await fs.mkdir(systemdDir, { recursive: true });
        await fs.writeFile(unitPath, UNRELATED_GATEWAY_CONTENTS);
        const result = await findExtraGatewayServices({ HOME: tmpHome });
        expect(result).toEqual([]);
      } finally {
        await fs.rm(tmpHome, { recursive: true, force: true });
      }
    },
  );
});

describe("findExtraGatewayServices (win32)", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });
    execSchtasksMock.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: originalPlatform,
    });
  });

  it("skips schtasks queries unless deep mode is enabled", async () => {
    const result = await findExtraGatewayServices({});
    expect(result).toEqual([]);
    expect(execSchtasksMock).not.toHaveBeenCalled();
  });

  it("returns empty results when schtasks query fails", async () => {
    execSchtasksMock.mockResolvedValueOnce({
      code: 1,
      stdout: "",
      stderr: "error",
    });

    const result = await findExtraGatewayServices({}, { deep: true });
    expect(result).toEqual([]);
  });

  it("ignores pre-rebrand marker tasks from schtasks output", async () => {
    execSchtasksMock.mockResolvedValueOnce({
      code: 0,
      stdout: [
        "TaskName: Zhushou Gateway",
        "Task To Run: C:\\Program Files\\助手\\zhushou.exe gateway run",
        "",
        "TaskName: Other Gateway",
        "Task To Run: C:\\other-tool\\other-tool.exe run",
        "",
        "TaskName: Other Task",
        "Task To Run: C:\\tools\\helper.exe",
        "",
      ].join("\n"),
      stderr: "",
    });

    const result = await findExtraGatewayServices({}, { deep: true });
    expect(result).toEqual([]);
  });
});
