import type {
  TuiState,
  TuiStateKey,
  TuiStateChangeEntry,
  TuiStateListener,
} from "./tui-state.js";

type ComputedRegistry = Map<string, (state: TuiState) => unknown>;
type ListenerRegistry = Map<TuiStateKey, Set<TuiStateListener>>;

export class TuiStore {
  private _state: TuiState;
  private _listeners: ListenerRegistry = new Map();
  private _computed: ComputedRegistry = new Map();
  private _debugEnabled = false;
  private _changeLog: TuiStateChangeEntry[] = [];

  constructor(initialState: TuiState) {
    this._state = { ...initialState };
  }

  get<K extends TuiStateKey>(key: K): TuiState[K] {
    return this._state[key];
  }

  set<K extends TuiStateKey>(key: K, value: TuiState[K], reason?: string): void {
    const prevValue = this._state[key];
    if (Object.is(prevValue, value)) return;
    this._state[key] = value;
    if (this._debugEnabled) {
      this._changeLog.push({
        key,
        prevValue,
        nextValue: value,
        reason,
        timestamp: Date.now(),
      });
    }
    const listeners = this._listeners.get(key);
    if (listeners) {
      for (const listener of listeners) {
        listener(prevValue, value);
      }
    }
  }

  subscribe(key: TuiStateKey, listener: TuiStateListener): () => void {
    let set = this._listeners.get(key);
    if (!set) {
      set = new Set();
      this._listeners.set(key, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) {
        this._listeners.delete(key);
      }
    };
  }

  snapshot(): Readonly<TuiState> {
    return { ...this._state };
  }

  registerComputed<V>(key: string, compute: (state: TuiState) => V): void {
    this._computed.set(key, compute as (state: TuiState) => unknown);
  }

  getComputed<V>(key: string): V | undefined {
    const compute = this._computed.get(key);
    if (!compute) return undefined;
    return compute(this._state) as V;
  }

  enableDebug(enabled: boolean): void {
    this._debugEnabled = enabled;
    if (!enabled) {
      this._changeLog.length = 0;
    }
  }

  getChangeLog(): ReadonlyArray<TuiStateChangeEntry> {
    return this._changeLog;
  }
}
