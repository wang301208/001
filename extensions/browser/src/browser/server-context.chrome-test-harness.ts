import { vi } from "vitest";
import { installChromeUserDataDirHooks } from "./chrome-user-data-dir.test-harness.js";

const chromeUserDataDir = { dir: "/tmp/zhushou" };
installChromeUserDataDirHooks(chromeUserDataDir);

vi.mock("./chrome.js", () => ({
  isChromeCdpReady: vi.fn(async () => true),
  isChromeReachable: vi.fn(async () => true),
  launchZhushouChrome: vi.fn(async () => {
    throw new Error("unexpected launch");
  }),
  resolveZhushouUserDataDir: vi.fn(() => chromeUserDataDir.dir),
  stopZhushouChrome: vi.fn(async () => {}),
}));
