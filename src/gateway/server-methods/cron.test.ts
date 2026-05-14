import { describe, expect, it, vi } from "vitest";
import { cronHandlers } from "./cron.js";
import type { GatewayRequestContext } from "./types.js";

const hoisted = vi.hoisted(() => ({
  runtimeState: {
    observedAt: 1,
    summary: {
      units: 1,
      enabled: 1,
      started: 1,
      running: 0,
      failed: 0,
      disabled: 0,
    },
    units: [
      {
        id: "core.cron",
        name: "Cron scheduler",
        category: "core",
        status: "idle",
        enabled: true,
        started: true,
        running: false,
      },
    ],
  },
}));

vi.mock("../server-runtime-services.js", () => ({
  getGatewayAutomationRuntimeState: () => hoisted.runtimeState,
}));

describe("cron gateway handlers", () => {
  it("returns a degraded cron.status snapshot instead of blocking the control plane", async () => {
    const respond = vi.fn();
    let releaseStatus!: () => void;
    const slowStatus = new Promise((resolve) => {
      releaseStatus = () => resolve({
        enabled: true,
        storePath: "/tmp/zhushou-cron.json",
        jobs: 1,
        nextWakeAtMs: null,
      });
    });
    const handlerPromise = cronHandlers["cron.status"]({
      req: { type: "req", id: "req-1", method: "cron.status" },
      params: {},
      respond,
      context: {
        cronStorePath: "/tmp/zhushou-cron.json",
        cron: {
          status: vi.fn(() => slowStatus),
        },
      } as unknown as GatewayRequestContext,
      client: null,
      isWebchatConnect: () => false,
    });

    await handlerPromise;
    releaseStatus();

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        degraded: true,
        enabled: true,
        jobs: 0,
        nextWakeAtMs: null,
        reason: expect.stringMatching(/^cron-/),
        storePath: "/tmp/zhushou-cron.json",
      }),
      undefined,
    );
  });

  it("returns immediately while cron is starting without touching the scheduler status", async () => {
    hoisted.runtimeState.units[0] = {
      ...hoisted.runtimeState.units[0],
      status: "starting",
    };
    const respond = vi.fn();
    const status = vi.fn(() => {
      throw new Error("cron.status should not be called while cron is starting");
    });

    await cronHandlers["cron.status"]({
      req: { type: "req", id: "req-1", method: "cron.status" },
      params: {},
      respond,
      context: {
        cronStorePath: "/tmp/zhushou-cron.json",
        cron: {
          status,
        },
      } as unknown as GatewayRequestContext,
      client: null,
      isWebchatConnect: () => false,
    });

    expect(status).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        degraded: true,
        reason: "cron-starting",
        storePath: "/tmp/zhushou-cron.json",
      }),
      undefined,
    );
  });
});
