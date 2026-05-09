import { vi } from "vitest";
import { installChromeUserDataDirHooks } from "./chrome-user-data-dir.test-harness.js";

const chromeUserDataDir = { dir: "/tmp/assistant" };
installChromeUserDataDirHooks(chromeUserDataDir);

vi.mock("./chrome.js", () => ({
  isChromeCdpReady: vi.fn(async () => true),
  isChromeReachable: vi.fn(async () => true),
  launchAssistantChrome: vi.fn(async () => {
    throw new Error("unexpected launch");
  }),
  resolveAssistantUserDataDir: vi.fn(() => chromeUserDataDir.dir),
  stopAssistantChrome: vi.fn(async () => {}),
}));
