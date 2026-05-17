import { describe, it, expect } from "vitest";
import { TuiStore } from "../state/tui-store.js";
import type { TuiState } from "../state/tui-state.js";

function createTestStore(overrides?: Partial<TuiState>): TuiStore {
  const defaults: TuiState = {
    agentDefaultId: "",
    sessionMainKey: "",
    sessionScope: "per-sender",
    agents: [],
    currentAgentId: "",
    currentSessionKey: "",
    currentSessionId: null,
    activeChatRunId: null,
    pendingOptimisticUserMessage: false,
    historyLoaded: false,
    sessionInfo: {} as TuiState["sessionInfo"],
    initialSessionApplied: false,
    isConnected: false,
    autoMessageSent: false,
    toolsExpanded: false,
    showThinking: false,
    connectionStatus: "",
    activityStatus: "idle",
    queuedMessages: [],
    governanceStatus: null,
    showGovernancePanel: false,
    lastCtrlCAt: 0,
    exitRequested: false,
  };
  return new TuiStore({ ...defaults, ...overrides } as TuiState);
}

describe("state/tui-store", () => {
  it("gets initial values", () => {
    const store = createTestStore({ isConnected: true });
    expect(store.get("isConnected")).toBe(true);
    expect(store.get("exitRequested")).toBe(false);
  });

  it("sets and gets values", () => {
    const store = createTestStore();
    store.set("isConnected", true);
    expect(store.get("isConnected")).toBe(true);
  });

  it("notifies subscribers on change", () => {
    const store = createTestStore();
    const changes: boolean[] = [];
    const unsub = store.subscribe("isConnected", (prev, next) => {
      changes.push(prev, next);
    });
    store.set("isConnected", true);
    expect(changes).toEqual([false, true]);
    unsub();
  });

  it("does not notify when value unchanged", () => {
    const store = createTestStore({ isConnected: true });
    let callCount = 0;
    store.subscribe("isConnected", () => { callCount++; });
    store.set("isConnected", true);
    expect(callCount).toBe(0);
  });

  it("unsubscribes correctly", () => {
    const store = createTestStore();
    let callCount = 0;
    const unsub = store.subscribe("isConnected", () => { callCount++; });
    unsub();
    store.set("isConnected", true);
    expect(callCount).toBe(0);
  });

  it("snapshot returns current state", () => {
    const store = createTestStore();
    store.set("activityStatus", "streaming");
    const snap = store.snapshot();
    expect(snap.activityStatus).toBe("streaming");
  });

  it("records changes in debug mode", () => {
    const store = createTestStore();
    store.enableDebug(true);
    store.set("activeChatRunId", "run-1", "chat-start");
    store.set("activeChatRunId", null, "chat-end");
    const log = store.getChangeLog();
    expect(log.length).toBeGreaterThanOrEqual(2);
    store.enableDebug(false);
  });

  it("handles multiple subscribers on same key", () => {
    const store = createTestStore();
    const results: number[] = [];
    store.subscribe("lastCtrlCAt", () => { results.push(1); });
    store.subscribe("lastCtrlCAt", () => { results.push(2); });
    store.set("lastCtrlCAt", Date.now());
    expect(results).toEqual([1, 2]);
  });
});
