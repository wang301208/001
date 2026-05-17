import { Key, matchesKey } from "../adapters/index.js";

export interface RouteResult {
  data: string;
  consumed: boolean;
  consumedReason?: string;
}

export class EventRouter {
  private lastBackspaceAt = -1;
  private dedupeWindowMs = 8;

  route(
    data: string,
    ctx: { hasVisibleBtw: boolean; editorTextLength: number },
  ): RouteResult {
    const deduped = this.dedupeBackspace(data);
    if (deduped.length === 0) {
      return { data: "", consumed: true, consumedReason: "backspace-dedup" };
    }
    if (ctx.hasVisibleBtw && ctx.editorTextLength === 0) {
      if (matchesKey(deduped, "enter")) {
        return { data: deduped, consumed: true, consumedReason: "btw-enter" };
      }
    }
    return { data: deduped, consumed: false };
  }

  private dedupeBackspace(data: string): string {
    if (!matchesKey(data, Key.backspace)) {
      return data;
    }
    const now = Date.now();
    if (this.lastBackspaceAt >= 0 && now - this.lastBackspaceAt <= this.dedupeWindowMs) {
      return "";
    }
    this.lastBackspaceAt = now;
    return data;
  }
}
