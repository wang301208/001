import type { AgentEventPayload } from "../infra/agent-events.js";

export function resolveZhushouStreamDeltaText(evt: AgentEventPayload): string {
  const delta = evt.data.delta;
  const text = evt.data.text;
  return typeof delta === "string" ? delta : typeof text === "string" ? text : "";
}
