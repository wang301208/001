import { describe, expect, it } from "vitest";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#zhushou",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#zhushou",
      rawTarget: "#zhushou",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "zhushou-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "zhushou-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "zhushou-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "zhushou-bot",
      rawTarget: "zhushou-bot",
    });
  });
});
