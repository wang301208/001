import { resolveGlobalSingleton } from "../shared/global-singleton.js";
import { notifyListeners, registerListener } from "../shared/listeners.js";

export type LocalEventBusTopic = string & {};

export type LocalEventBusEvent = {
  eventId: string;
  topic: LocalEventBusTopic;
  ts: number;
  seq: number;
  source: string;
  payload: Record<string, unknown>;
  sessionKey?: string;
  runId?: string;
};

export type LocalEventBusAdapter = {
  kind: string;
  publish: (event: LocalEventBusEvent) => void | Promise<void>;
};

type LocalEventBusState = {
  seq: number;
  listeners: Set<(event: LocalEventBusEvent) => void>;
  adapter?: LocalEventBusAdapter;
};

const LOCAL_EVENT_BUS_STATE_KEY = Symbol.for("openclaw.localEventBus.state");

function getLocalEventBusState(): LocalEventBusState {
  return resolveGlobalSingleton<LocalEventBusState>(LOCAL_EVENT_BUS_STATE_KEY, () => ({
    seq: 0,
    listeners: new Set<(event: LocalEventBusEvent) => void>(),
    adapter: undefined,
  }));
}

export function publishLocalEventBusEvent(params: {
  topic: LocalEventBusTopic;
  source: string;
  payload: Record<string, unknown>;
  eventId?: string;
  ts?: number;
  sessionKey?: string;
  runId?: string;
}): LocalEventBusEvent {
  const state = getLocalEventBusState();
  const event: LocalEventBusEvent = {
    eventId: params.eventId?.trim() || `${Date.now()}-${state.seq + 1}`,
    topic: params.topic,
    ts: params.ts ?? Date.now(),
    seq: state.seq + 1,
    source: params.source,
    payload: params.payload,
    ...(params.sessionKey?.trim() ? { sessionKey: params.sessionKey.trim() } : {}),
    ...(params.runId?.trim() ? { runId: params.runId.trim() } : {}),
  };
  state.seq = event.seq;
  notifyListeners(state.listeners, event);
  void Promise.resolve(state.adapter?.publish(event)).catch(() => undefined);
  return event;
}

export function onLocalEventBusEvent(listener: (event: LocalEventBusEvent) => void): () => void {
  return registerListener(getLocalEventBusState().listeners, listener);
}

export function configureLocalEventBusAdapter(adapter?: LocalEventBusAdapter): void {
  getLocalEventBusState().adapter = adapter;
}

export function resetLocalEventBusForTest(): void {
  const state = getLocalEventBusState();
  state.seq = 0;
  state.listeners.clear();
  state.adapter = undefined;
}
