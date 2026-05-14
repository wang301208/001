import { describe, expect, it, vi } from "vitest";
import {
  createSubscribedSessionHarness,
  emitZhushouLifecycleErrorAndEnd,
  findLifecycleErrorAgentEvent,
} from "./pi-embedded-subscribe.e2e-harness.js";

describe("subscribeEmbeddedPiSession lifecycle billing errors", () => {
  function createAgentEventHarness(options?: { runId?: string; sessionKey?: string }) {
    const onAgentEvent = vi.fn();
    const { emit } = createSubscribedSessionHarness({
      runId: options?.runId ?? "run",
      sessionKey: options?.sessionKey,
      onAgentEvent,
    });
    return { emit, onAgentEvent };
  }

  it("includes provider and model context in lifecycle billing errors", () => {
    const { emit, onAgentEvent } = createAgentEventHarness({
      runId: "run-billing-error",
      sessionKey: "test-session",
    });

    emitZhushouLifecycleErrorAndEnd({
      emit,
      errorMessage: "insufficient credits",
      provider: "Anthropic",
      model: "claude-3-5-sonnet",
    });

    const lifecycleError = findLifecycleErrorAgentEvent(onAgentEvent.mock.calls);
    expect(lifecycleError).toBeDefined();
    expect(lifecycleError?.data?.error).toContain("Anthropic (claude-3-5-sonnet)");
  });
});
