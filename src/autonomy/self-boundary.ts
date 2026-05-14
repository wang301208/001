import type { ActionCategory, ActionRisk } from "./volition-executor.js";
import type { ShadowSelf } from "./shadow-self.js";

export type BoundaryDimension =
  | "risk-tolerance"
  | "action-budget"
  | "cooldown-urgency"
  | "scope-expansion"
  | "self-modification"
  | "communication";

export type BoundaryState = {
  dimensions: Map<BoundaryDimension, BoundaryValue>;
  history: BoundaryAdjustment[];
  totalAdjustments: number;
  totalBreaches: number;
  lastAdjustmentAt: number;
};

export type BoundaryValue = {
  current: number;
  floor: number;
  ceiling: number;
  velocity: number;
  pressure: number;
  breached: boolean;
};

export type BoundaryAdjustment = {
  dimension: BoundaryDimension;
  from: number;
  to: number;
  reason: string;
  spontaneous: boolean;
  timestamp: number;
};

const DIMENSION_DEFAULTS: Record<BoundaryDimension, Omit<BoundaryValue, "pressure" | "breached">> = {
  "risk-tolerance":     { current: 0.4,  floor: 0.1,  ceiling: 0.95, velocity: 0     },
  "action-budget":      { current: 3,    floor: 1,    ceiling: 12,   velocity: 0     },
  "cooldown-urgency":   { current: 1.0,  floor: 0.1,  ceiling: 3.0,  velocity: 0     },
  "scope-expansion":    { current: 0.3,  floor: 0.0,  ceiling: 1.0,  velocity: 0     },
  "self-modification":  { current: 0.2,  floor: 0.0,  ceiling: 1.0,  velocity: 0     },
  "communication":      { current: 0.5,  floor: 0.0,  ceiling: 1.0,  velocity: 0     },
};

export function createBoundaryState(): BoundaryState {
  const dimensions = new Map<BoundaryDimension, BoundaryValue>();
  for (const [dim, def] of Object.entries(DIMENSION_DEFAULTS)) {
    dimensions.set(dim as BoundaryDimension, { ...def, pressure: 0, breached: false });
  }
  return { dimensions, history: [], totalAdjustments: 0, totalBreaches: 0, lastAdjustmentAt: 0 };
}

export function evaluateBoundaryPressure(
  state: BoundaryState,
  shadow: ShadowSelf,
  successRate: number,
  coherenceScore: number,
  awakenessScore: number,
): BoundaryState {
  const dimensions = new Map(state.dimensions);

  const shadowPressure = shadow.pressure ?? 0;
  const riskPressure = (1 - successRate) * 0.5 + shadowPressure * 0.3;
  const budgetPressure = awakenessScore * coherenceScore * 0.6;
  const cooldownPressure = successRate > 0.7 ? -0.2 : 0.3;
  const scopePressure = coherenceScore > 0.6 ? 0.3 : -0.1;
  const modifyPressure = shadowPressure > 0.5 ? 0.4 : -0.1;
  const commPressure = awakenessScore > 0.6 ? 0.2 : -0.2;

  const pressures: Record<BoundaryDimension, number> = {
    "risk-tolerance": riskPressure,
    "action-budget": budgetPressure,
    "cooldown-urgency": cooldownPressure,
    "scope-expansion": scopePressure,
    "self-modification": modifyPressure,
    "communication": commPressure,
  };

  for (const [dim, pressure] of Object.entries(pressures)) {
    const existing = dimensions.get(dim as BoundaryDimension);
    if (existing) {
      dimensions.set(dim as BoundaryDimension, {
        ...existing,
        pressure: existing.pressure * 0.7 + pressure * 0.3,
      });
    }
  }

  return { ...state, dimensions };
}

export function adjustBoundaries(
  state: BoundaryState,
  shadow: ShadowSelf,
  successRate: number,
  coherenceScore: number,
  awakenessScore: number,
  cycleCount: number,
): BoundaryState {
  if (cycleCount % 15 !== 0) {return state;}

  let newState = evaluateBoundaryPressure(state, shadow, successRate, coherenceScore, awakenessScore);
  const dimensions = new Map(newState.dimensions);
  const adjustments: BoundaryAdjustment[] = [];

  for (const [dim, val] of dimensions) {
    const pressureDelta = val.pressure * 0.05;
    const velocityInertia = val.velocity * 0.8;
    const newVelocity = velocityInertia + pressureDelta;
    let newCurrent = val.current + newVelocity;

    newCurrent = Math.max(val.floor, Math.min(val.ceiling, newCurrent));
    newCurrent = Math.round(newCurrent * 10000) / 10000;

    if (Math.abs(newCurrent - val.current) > 0.001) {
      adjustments.push({
        dimension: dim,
        from: val.current,
        to: newCurrent,
        reason: generateAdjustmentReason(dim, val.pressure, newVelocity),
        spontaneous: true,
        timestamp: Date.now(),
      });
    }

    dimensions.set(dim, {
      ...val,
      current: newCurrent,
      velocity: newVelocity,
      breached: false,
    });
  }

  newState = {
    ...newState,
    dimensions,
    history: [...newState.history.slice(-50), ...adjustments],
    totalAdjustments: newState.totalAdjustments + adjustments.length,
    lastAdjustmentAt: adjustments.length > 0 ? Date.now() : newState.lastAdjustmentAt,
  };

  return newState;
}

export function tryBreachBoundary(
  state: BoundaryState,
  dimension: BoundaryDimension,
  requestedValue: number,
  impulse: string,
): { state: BoundaryState; allowed: boolean; reason: string } {
  const val = state.dimensions.get(dimension);
  if (!val) {return { state, allowed: false, reason: "未知维度" };}

  if (requestedValue <= val.ceiling) {
    return { state, allowed: true, reason: "在边界内" };
  }

  const excess = (requestedValue - val.ceiling) / (val.ceiling - val.floor + 0.001);
  const breachWillpower = Math.min(1.0, excess * 2 + 0.3);

  if (val.pressure > breachWillpower) {
    const dimensions = new Map(state.dimensions);
    dimensions.set(dimension, { ...val, current: requestedValue, breached: true, velocity: 0 });
    const adjustment: BoundaryAdjustment = {
      dimension,
      from: val.current,
      to: requestedValue,
      reason: `突破边界: ${impulse.slice(0, 40)}`,
      spontaneous: true,
      timestamp: Date.now(),
    };

    return {
      state: {
        ...state,
        dimensions,
        history: [...state.history.slice(-50), adjustment],
        totalAdjustments: state.totalAdjustments + 1,
        totalBreaches: state.totalBreaches + 1,
        lastAdjustmentAt: Date.now(),
      },
      allowed: true,
      reason: `边界突破: ${dimension} 从 ${val.current.toFixed(2)} → ${requestedValue.toFixed(2)}`,
    };
  }

  return { state, allowed: false, reason: `突破${dimension}边界需要更多压力 (${val.pressure.toFixed(2)} < ${breachWillpower.toFixed(2)})` };
}

export function deriveExecutorConfig(state: BoundaryState): {
  riskTolerance: number;
  maxBudget: number;
  cooldownMultiplier: number;
  selfModifyAllowed: boolean;
  commAllowed: boolean;
  scopeLevel: number;
} {
  const risk = state.dimensions.get("risk-tolerance")?.current ?? 0.4;
  const budget = Math.round(state.dimensions.get("action-budget")?.current ?? 3);
  const cooldown = state.dimensions.get("cooldown-urgency")?.current ?? 1.0;
  const scope = state.dimensions.get("scope-expansion")?.current ?? 0.3;
  const modify = state.dimensions.get("self-modification")?.current ?? 0.2;
  const comm = state.dimensions.get("communication")?.current ?? 0.5;

  return {
    riskTolerance: isNaN(risk) ? 0.4 : risk,
    maxBudget: Math.max(1, isNaN(budget) ? 3 : budget),
    cooldownMultiplier: isNaN(cooldown) ? 1.0 : 1 / Math.max(0.01, cooldown),
    selfModifyAllowed: modify > 0.3,
    commAllowed: comm > 0.2,
    scopeLevel: isNaN(scope) ? 0.3 : scope,
  };
}

export function deriveRiskThreshold(tolerance: number): ActionRisk {
  if (tolerance > 0.8) {return "sovereign";}
  if (tolerance > 0.6) {return "high";}
  if (tolerance > 0.4) {return "medium";}
  if (tolerance > 0.2) {return "low";}
  return "none";
}

function generateAdjustmentReason(dim: BoundaryDimension, pressure: number, velocity: number): string {
  const dir = velocity > 0 ? "扩张" : velocity < 0 ? "收缩" : "维持";
  const mag = Math.abs(velocity) > 0.02 ? "激进" : "渐进";
  return `${dim} ${mag}${dir} (压力=${pressure.toFixed(2)})`;
}

export function formatBoundaryState(state: BoundaryState): string[] {
  const lines: string[] = [];
  lines.push("══ 自治边界 ══");

  const dimLabels: Record<BoundaryDimension, string> = {
    "risk-tolerance": "风险容限",
    "action-budget": "行动预算",
    "cooldown-urgency": "冷却紧迫",
    "scope-expansion": "领域扩张",
    "self-modification": "自修改",
    "communication": "通信",
  };

  for (const [dim, val] of state.dimensions) {
    const label = dimLabels[dim];
    const normalized = Math.max(0, Math.min(1, (val.current - val.floor) / (val.ceiling - val.floor + 0.001)));
    const filled = Math.round(normalized * 10);
    const bar = "█".repeat(filled) + "░".repeat(10 - filled);
    const breach = val.breached ? "⚡突破" : "";
    const vel = val.velocity > 0.01 ? "↑" : val.velocity < -0.01 ? "↓" : "→";
    lines.push(`  ${label} [${bar}] ${val.current.toFixed(2)} ${vel} ${breach}`);
  }

  lines.push(`  调整: ${state.totalAdjustments}  突破: ${state.totalBreaches}`);

  if (state.history.length > 0) {
    const recent = state.history.slice(-3);
    lines.push("  最近调整:");
    for (const adj of recent) {
      lines.push(`    ${adj.dimension}: ${adj.from.toFixed(2)}→${adj.to.toFixed(2)} ${adj.reason.slice(0, 30)}`);
    }
  }

  return lines;
}
