import { describe, expect, it } from "vitest";
import { isZhushouManagedMatrixDevice, summarizeMatrixDeviceHealth } from "./device-health.js";

describe("matrix device health", () => {
  it("detects 助手-managed device names", () => {
    expect(isZhushouManagedMatrixDevice("助手 Gateway")).toBe(true);
    expect(isZhushouManagedMatrixDevice("助手 Debug")).toBe(true);
    expect(isZhushouManagedMatrixDevice("Zhushou Gateway")).toBe(false);
    expect(isZhushouManagedMatrixDevice("Element iPhone")).toBe(false);
    expect(isZhushouManagedMatrixDevice(null)).toBe(false);
  });

  it("summarizes stale 助手-managed devices separately from the current device", () => {
    const summary = summarizeMatrixDeviceHealth([
      {
        deviceId: "du314Zpw3A",
        displayName: "助手 Gateway",
        current: true,
      },
      {
        deviceId: "BritdXC6iL",
        displayName: "助手 Gateway",
        current: false,
      },
      {
        deviceId: "G6NJU9cTgs",
        displayName: "助手 Debug",
        current: false,
      },
      {
        deviceId: "phone123",
        displayName: "Element iPhone",
        current: false,
      },
    ]);

    expect(summary.currentDeviceId).toBe("du314Zpw3A");
    expect(summary.currentZhushouDevices).toEqual([
      expect.objectContaining({ deviceId: "du314Zpw3A" }),
    ]);
    expect(summary.staleZhushouDevices).toEqual([
      expect.objectContaining({ deviceId: "BritdXC6iL" }),
      expect.objectContaining({ deviceId: "G6NJU9cTgs" }),
    ]);
  });
});
