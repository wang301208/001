import type { AgentAcpBinding, AgentBinding, AgentRouteBinding } from "./types.agents.js";
import type { ZhushouConfig } from "./types.zhushou.js";

export type ConfiguredBindingRule = AgentBinding;

function normalizeBindingType(binding: AgentBinding): "route" | "acp" {
  return binding.type === "acp" ? "acp" : "route";
}

export function isRouteBinding(binding: AgentBinding): binding is AgentRouteBinding {
  return normalizeBindingType(binding) === "route";
}

export function isAcpBinding(binding: AgentBinding): binding is AgentAcpBinding {
  return normalizeBindingType(binding) === "acp";
}

export function listConfiguredBindings(cfg: ZhushouConfig): AgentBinding[] {
  return Array.isArray(cfg.bindings) ? cfg.bindings : [];
}

export function listRouteBindings(cfg: ZhushouConfig): AgentRouteBinding[] {
  return listConfiguredBindings(cfg).filter(isRouteBinding);
}

export function listAcpBindings(cfg: ZhushouConfig): AgentAcpBinding[] {
  return listConfiguredBindings(cfg).filter(isAcpBinding);
}
