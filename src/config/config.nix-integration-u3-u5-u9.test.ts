import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GATEWAY_PORT,
  resolveConfigPathCandidate,
  resolveGatewayPort,
  resolveIsNixMode,
  resolveStateDir,
} from "./config.js";
import { withTempHome } from "./test-helpers.js";

vi.unmock("../version.js");

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  // Hermetic env: don't inherit process.env because other tests may mutate it.
  return { ...overrides };
}

describe("Nix integration (U3, U5, U9)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("U3: isNixMode env var detection", () => {
    it("isNixMode is false when ASSISTANT_NIX_MODE is not set", () => {
      expect(resolveIsNixMode(envWith({ ASSISTANT_NIX_MODE: undefined }))).toBe(false);
    });

    it("isNixMode is false when ASSISTANT_NIX_MODE is empty", () => {
      expect(resolveIsNixMode(envWith({ ASSISTANT_NIX_MODE: "" }))).toBe(false);
    });

    it("isNixMode is false when ASSISTANT_NIX_MODE is not '1'", () => {
      expect(resolveIsNixMode(envWith({ ASSISTANT_NIX_MODE: "true" }))).toBe(false);
    });

    it("isNixMode is true when ASSISTANT_NIX_MODE=1", () => {
      expect(resolveIsNixMode(envWith({ ASSISTANT_NIX_MODE: "1" }))).toBe(true);
    });
  });

  describe("U5: CONFIG_PATH and STATE_DIR env var overrides", () => {
    it("STATE_DIR defaults to ~/.assistant when env not set", () => {
      expect(resolveStateDir(envWith({ ASSISTANT_STATE_DIR: undefined }))).toMatch(/\.assistant$/);
    });

    it("STATE_DIR respects ASSISTANT_STATE_DIR override", () => {
      expect(resolveStateDir(envWith({ ASSISTANT_STATE_DIR: "/custom/state/dir" }))).toBe(
        path.resolve("/custom/state/dir"),
      );
    });

    it("STATE_DIR respects ASSISTANT_HOME when state override is unset", () => {
      const customHome = path.join(path.sep, "custom", "home");
      expect(
        resolveStateDir(envWith({ ASSISTANT_HOME: customHome, ASSISTANT_STATE_DIR: undefined })),
      ).toBe(path.join(path.resolve(customHome), ".assistant"));
    });

    it("CONFIG_PATH defaults to ASSISTANT_HOME/.assistant/assistant.json", () => {
      const customHome = path.join(path.sep, "custom", "home");
      expect(
        resolveConfigPathCandidate(
          envWith({
            ASSISTANT_HOME: customHome,
            ASSISTANT_CONFIG_PATH: undefined,
            ASSISTANT_STATE_DIR: undefined,
          }),
        ),
      ).toBe(path.join(path.resolve(customHome), ".assistant", "assistant.json"));
    });

    it("CONFIG_PATH defaults to ~/.assistant/assistant.json when env not set", () => {
      expect(
        resolveConfigPathCandidate(
          envWith({ ASSISTANT_CONFIG_PATH: undefined, ASSISTANT_STATE_DIR: undefined }),
        ),
      ).toMatch(/\.assistant[\\/]assistant\.json$/);
    });

    it("CONFIG_PATH respects ASSISTANT_CONFIG_PATH override", () => {
      expect(
        resolveConfigPathCandidate(
          envWith({ ASSISTANT_CONFIG_PATH: "/nix/store/abc/assistant.json" }),
        ),
      ).toBe(path.resolve("/nix/store/abc/assistant.json"));
    });

    it("CONFIG_PATH expands ~ in ASSISTANT_CONFIG_PATH override", async () => {
      await withTempHome(async (home) => {
        expect(
          resolveConfigPathCandidate(
            envWith({ ASSISTANT_HOME: home, ASSISTANT_CONFIG_PATH: "~/.assistant/custom.json" }),
            () => home,
          ),
        ).toBe(path.join(home, ".assistant", "custom.json"));
      });
    });

    it("CONFIG_PATH uses STATE_DIR when only state dir is overridden", () => {
      expect(
        resolveConfigPathCandidate(
          envWith({ ASSISTANT_STATE_DIR: "/custom/state", ASSISTANT_TEST_FAST: "1" }),
          () => path.join(path.sep, "tmp", "assistant-config-home"),
        ),
      ).toBe(path.join(path.resolve("/custom/state"), "assistant.json"));
    });
  });

  describe("U6: gateway port resolution", () => {
    it("uses default when env and config are unset", () => {
      expect(resolveGatewayPort({}, envWith({ ASSISTANT_GATEWAY_PORT: undefined }))).toBe(
        DEFAULT_GATEWAY_PORT,
      );
    });

    it("prefers ASSISTANT_GATEWAY_PORT over config", () => {
      expect(
        resolveGatewayPort(
          { gateway: { port: 19002 } },
          envWith({ ASSISTANT_GATEWAY_PORT: "19001" }),
        ),
      ).toBe(19001);
    });

    it("falls back to config when env is invalid", () => {
      expect(
        resolveGatewayPort(
          { gateway: { port: 19003 } },
          envWith({ ASSISTANT_GATEWAY_PORT: "nope" }),
        ),
      ).toBe(19003);
    });
  });
});
