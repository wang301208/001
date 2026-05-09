import { describe, expect, it } from "vitest";
import { isAssistantManagedMatrixDevice, summarizeMatrixDeviceHealth } from "./device-health.js";

describe("matrix device health", () => {
  it("detects 助手-managed device names", () => {
    expect(isAssistantManagedMatrixDevice("Assistant Gateway")).toBe(true);
    expect(isAssistantManagedMatrixDevice("助手 Debug")).toBe(true);
    expect(isAssistantManagedMatrixDevice("Element iPhone")).toBe(false);
    expect(isAssistantManagedMatrixDevice(null)).toBe(false);
  });

  it("summarizes stale 助手-managed devices separately from the current device", () => {
    const summary = summarizeMatrixDeviceHealth([
      {
        deviceId: "du314Zpw3A",
        displayName: "Assistant Gateway",
        current: true,
      },
      {
        deviceId: "BritdXC6iL",
        displayName: "Assistant Gateway",
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
    expect(summary.currentAssistantDevices).toEqual([
      expect.objectContaining({ deviceId: "du314Zpw3A" }),
    ]);
    expect(summary.staleAssistantDevices).toEqual([
      expect.objectContaining({ deviceId: "BritdXC6iL" }),
      expect.objectContaining({ deviceId: "G6NJU9cTgs" }),
    ]);
  });
});
