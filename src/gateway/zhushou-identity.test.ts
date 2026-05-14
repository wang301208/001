import { describe, expect, it } from "vitest";
import type { ZhushouConfig } from "../config/config.js";
import { DEFAULT_ZHUSHOU_IDENTITY, resolveZhushouIdentity } from "./zhushou-identity.js";

describe("resolveZhushouIdentity avatar normalization", () => {
  it("drops sentence-like avatar placeholders", () => {
    const cfg: ZhushouConfig = {
      ui: {
        zhushou: {
          avatar: "workspace-relative path, http(s) URL, or data URI",
        },
      },
    };

    expect(resolveZhushouIdentity({ cfg, workspaceDir: "" }).avatar).toBe(
      DEFAULT_ZHUSHOU_IDENTITY.avatar,
    );
  });

  it("keeps short text avatars", () => {
    const cfg: ZhushouConfig = {
      ui: {
        zhushou: {
          avatar: "PS",
        },
      },
    };

    expect(resolveZhushouIdentity({ cfg, workspaceDir: "" }).avatar).toBe("PS");
  });

  it("keeps path avatars", () => {
    const cfg: ZhushouConfig = {
      ui: {
        zhushou: {
          avatar: "avatars/zhushou.png",
        },
      },
    };

    expect(resolveZhushouIdentity({ cfg, workspaceDir: "" }).avatar).toBe("avatars/zhushou.png");
  });
});
