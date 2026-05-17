export interface ConnectionLifecycleDeps {
  setConnected: (connected: boolean) => void;
  setWasDisconnected: (value: boolean) => void;
  getWasDisconnected: () => boolean;
  setConnectionStatus: (status: string, durationMs?: number) => void;
  setActivityStatus: (status: string) => void;
  addSystemMessage: (message: string) => void;
  requestRender: () => void;
  onReconnected: () => void;
  onFirstConnected: () => void;
  resolveDisconnectState: (
    reason?: string,
  ) => { connectionStatus: string; activityStatus: string; pairingHint?: string };
  watchdogMs?: number;
}

export interface ConnectionLifecycleHandlers {
  onConnected: () => void;
  onDisconnected: (reason: string) => void;
  onGap: (info: { runId: string; lastDeltaAt: number }) => void;
}

const DEFAULT_WATCHDOG_MS = 30_000;

export class ConnectionLifecycleController {
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogRunId: string | null = null;
  private watchdogMs: number;

  constructor(deps: Pick<ConnectionLifecycleDeps, "watchdogMs">) {
    this.watchdogMs =
      typeof deps.watchdogMs === "number" &&
      Number.isFinite(deps.watchdogMs) &&
      deps.watchdogMs >= 0
        ? Math.floor(deps.watchdogMs)
        : DEFAULT_WATCHDOG_MS;
  }

  createHandlers(deps: ConnectionLifecycleDeps): ConnectionLifecycleHandlers {
    return {
      onConnected: () => {
        deps.setConnected(true);
        const reconnected = deps.getWasDisconnected();
        deps.setWasDisconnected(false);
        deps.setConnectionStatus("已连接");
        if (reconnected) {
          deps.onReconnected();
        } else {
          deps.onFirstConnected();
        }
      },

      onDisconnected: (reason: string) => {
        deps.setConnected(false);
        deps.setWasDisconnected(true);
        const disconnectState = deps.resolveDisconnectState(reason);
        deps.setConnectionStatus(disconnectState.connectionStatus, 5000);
        deps.setActivityStatus(disconnectState.activityStatus);
        if (disconnectState.pairingHint) {
          deps.addSystemMessage(disconnectState.pairingHint);
        }
        deps.requestRender();
      },

      onGap: (info: { runId: string; lastDeltaAt: number }) => {
        deps.setConnectionStatus(
          `事件缺口: 运行 ${info.runId}，最后 delta 于 ${info.lastDeltaAt}`,
          5000,
        );
        deps.requestRender();
      },
    };
  }

  startWatchdog(runId: string): void {
    if (this.watchdogMs <= 0) return;
    this.stopWatchdog();
    this.watchdogRunId = runId;
    this.watchdogTimer = setTimeout(() => {
      this.watchdogTimer = null;
      this.watchdogRunId = null;
    }, this.watchdogMs);
    const maybeUnref = (this.watchdogTimer as unknown as { unref?: () => void }).unref;
    if (typeof maybeUnref === "function") {
      maybeUnref.call(this.watchdogTimer);
    }
  }

  stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    this.watchdogRunId = null;
  }
}
