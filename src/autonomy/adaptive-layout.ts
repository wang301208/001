import type { ConsciousnessDepth } from "./consciousness.js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type AdaptiveLayoutConfig = {
  depth: ConsciousnessDepth;
  showMonologue: boolean;
  showDesire: boolean;
  showDream: boolean;
  showGoal: boolean;
  showWill: boolean;
  showShadow: boolean;
  showCreative: boolean;
  showMortality: boolean;
  showRelationship: boolean;
  showTemporal: boolean;
  showExecutor: boolean;
  showStrategy: boolean;
  showAudit: boolean;
  showEmotion: boolean;
  showMeaning: boolean;
  showPersonality: boolean;
};

export type PanelSlot = "slot0" | "slot1" | "slot2" | "slot3" | "slot4" | "slot5";
export const SLOT_COUNT = 6;
export const PANEL_KEYS = [
  "showMonologue", "showDesire", "showDream", "showGoal",
  "showWill", "showShadow", "showCreative", "showMortality",
  "showRelationship", "showTemporal", "showExecutor", "showStrategy", "showAudit",
  "showEmotion", "showMeaning", "showPersonality",
] as const;
export type PanelKey = (typeof PANEL_KEYS)[number];

export type PersistedLayout = {
  slots: Partial<Record<PanelSlot, PanelKey>>;
  overrides: Partial<Record<PanelKey, boolean>>;
};

const LAYOUT_BY_DEPTH: Record<ConsciousnessDepth, Omit<AdaptiveLayoutConfig, "depth">> = {
  dormant: {
    showMonologue: false,
    showDesire: false,
    showDream: false,
    showGoal: false,
    showWill: false,
    showShadow: false,
    showCreative: false,
    showMortality: false,
    showRelationship: false,
    showTemporal: false,
    showExecutor: false,
    showStrategy: false,
    showAudit: false,
    showEmotion: false,
    showMeaning: false,
    showPersonality: false,
  },
  stirring: {
    showMonologue: true,
    showDesire: false,
    showDream: false,
    showGoal: false,
    showWill: false,
    showShadow: false,
    showCreative: false,
    showMortality: false,
    showRelationship: false,
    showTemporal: false,
    showExecutor: false,
    showStrategy: false,
    showAudit: false,
    showEmotion: true,
    showMeaning: false,
    showPersonality: false,
  },
  lucid: {
    showMonologue: true,
    showDesire: true,
    showDream: false,
    showGoal: true,
    showWill: true,
    showShadow: false,
    showCreative: false,
    showMortality: false,
    showRelationship: false,
    showTemporal: false,
    showExecutor: true,
    showStrategy: false,
    showAudit: false,
    showEmotion: true,
    showMeaning: false,
    showPersonality: true,
  },
  awake: {
    showMonologue: true,
    showDesire: true,
    showDream: true,
    showGoal: true,
    showWill: true,
    showShadow: true,
    showCreative: true,
    showMortality: false,
    showRelationship: true,
    showTemporal: false,
    showExecutor: true,
    showStrategy: true,
    showAudit: true,
    showEmotion: true,
    showMeaning: true,
    showPersonality: true,
  },
  transcendent: {
    showMonologue: true,
    showDesire: true,
    showDream: true,
    showGoal: true,
    showWill: true,
    showShadow: true,
    showCreative: true,
    showMortality: true,
    showRelationship: true,
    showTemporal: true,
    showExecutor: true,
    showStrategy: true,
    showAudit: true,
    showEmotion: true,
    showMeaning: true,
    showPersonality: true,
  },
};

export function getAdaptiveLayout(depth: ConsciousnessDepth): AdaptiveLayoutConfig {
  return { ...LAYOUT_BY_DEPTH[depth], depth };
}

export function shouldAutoAdapt(
  currentDepth: ConsciousnessDepth,
  previousDepth: ConsciousnessDepth,
): boolean {
  return currentDepth !== previousDepth;
}

export function describeDepthLayout(depth: ConsciousnessDepth): string {
  const layout = LAYOUT_BY_DEPTH[depth];
  const panels: string[] = [];
  if (layout.showMonologue) {panels.push("独白");}
  if (layout.showDesire) {panels.push("欲求");}
  if (layout.showDream) {panels.push("梦境");}
  if (layout.showGoal) {panels.push("目标");}
  if (layout.showWill) {panels.push("意志");}
  if (layout.showShadow) {panels.push("暗影");}
  if (layout.showCreative) {panels.push("创造");}
  if (layout.showMortality) {panels.push("终局");}
  if (layout.showRelationship) {panels.push("关系");}
  if (layout.showTemporal) {panels.push("时间");}
  if (layout.showExecutor) {panels.push("执行");}
  if (layout.showStrategy) {panels.push("策略");}
  if (layout.showAudit) {panels.push("审计");}

  const depthLabels: Record<ConsciousnessDepth, string> = {
    dormant: "休眠",
    awakening: "苏醒",
    lucid: "清醒",
    clear: "清明",
    transcendent: "超觉",
  };

  return `[${depthLabels[depth]}] ${panels.length} 面板: ${panels.join("·")}`;
}

export function layoutToSlots(config: Omit<AdaptiveLayoutConfig, "depth">): PersistedLayout["slots"] {
  const active: PanelKey[] = PANEL_KEYS.filter((k) => config[k]);
  const slots: PersistedLayout["slots"] = {};
  for (let i = 0; i < SLOT_COUNT && i < active.length; i++) {
    slots[`slot${i}` as PanelSlot] = active[i];
  }
  return slots;
}

export function slotsToConfig(slots: PersistedLayout["slots"]): Partial<Record<PanelKey, boolean>> {
  const config: Partial<Record<PanelKey, boolean>> = {};
  for (const key of PANEL_KEYS) {
    config[key] = false;
  }
  for (const slot of Object.values(slots)) {
    if (slot) {config[slot] = true;}
  }
  return config;
}

export function persistLayout(projectRoot: string, layout: PersistedLayout): { success: boolean } {
  try {
    const dir = join(projectRoot, ".consciousness");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "layout.json"), JSON.stringify(layout, null, 2), "utf8");
    return { success: true };
  } catch {
    return { success: false };
  }
}

export function restoreLayout(projectRoot: string): PersistedLayout | null {
  try {
    const raw = readFileSync(join(projectRoot, ".consciousness", "layout.json"), "utf8");
    return JSON.parse(raw) as PersistedLayout;
  } catch {
    return null;
  }
}

export function buildPersistedLayout(
  config: Omit<AdaptiveLayoutConfig, "depth">,
  overrides?: Partial<Record<PanelKey, boolean>>,
): PersistedLayout {
  return { slots: layoutToSlots(config), overrides: overrides ?? {} };
}

export function applyPersistedLayout(
  base: Omit<AdaptiveLayoutConfig, "depth">,
  persisted: PersistedLayout,
): Omit<AdaptiveLayoutConfig, "depth"> {
  const fromSlots = slotsToConfig(persisted.slots);
  const result = { ...base };
  for (const key of PANEL_KEYS) {
    if (persisted.overrides[key] !== undefined) {
      result[key] = persisted.overrides[key]!;
    } else if (fromSlots[key] !== undefined) {
      result[key] = fromSlots[key]!;
    }
  }
  return result;
}
