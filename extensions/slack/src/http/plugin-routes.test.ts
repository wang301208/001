import { describe, expect, it, vi } from "vitest";
import { createTestPluginApi } from "../../../../test/helpers/plugins/plugin-api.js";
import type { AssistantConfig, AssistantPluginApi } from "../runtime-api.js";
import { registerSlackPluginHttpRoutes } from "./plugin-routes.js";

function createApi(config: AssistantConfig, registerHttpRoute = vi.fn()): AssistantPluginApi {
  return createTestPluginApi({
    id: "slack",
    config,
    registerHttpRoute,
  }) as AssistantPluginApi;
}

describe("registerSlackPluginHttpRoutes", () => {
  it("registers account webhook paths without resolving unresolved token refs", () => {
    const registerHttpRoute = vi.fn();
    const cfg: AssistantConfig = {
      channels: {
        slack: {
          accounts: {
            default: {
              webhookPath: "/hooks/default",
              botToken: {
                source: "env",
                provider: "default",
                id: "SLACK_BOT_TOKEN",
              } as unknown as string,
            },
            ops: {
              webhookPath: "hooks/ops",
              botToken: {
                source: "env",
                provider: "default",
                id: "SLACK_OPS_BOT_TOKEN",
              } as unknown as string,
            },
          },
        },
      },
    };
    const api = createApi(cfg, registerHttpRoute);

    expect(() => registerSlackPluginHttpRoutes(api)).not.toThrow();

    const paths = registerHttpRoute.mock.calls
      .map((call) => (call[0] as { path: string }).path)
      .toSorted();
    expect(paths).toEqual(["/hooks/default", "/hooks/ops"]);
  });

  it("falls back to the default slack webhook path", () => {
    const registerHttpRoute = vi.fn();
    const api = createApi({}, registerHttpRoute);

    registerSlackPluginHttpRoutes(api);

    const paths = registerHttpRoute.mock.calls
      .map((call) => (call[0] as { path: string }).path)
      .toSorted();
    expect(paths).toEqual(["/slack/events"]);
  });
});
