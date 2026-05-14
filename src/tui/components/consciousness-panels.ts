import { Container, Text } from "@mariozechner/pi-tui";
import { theme } from "../theme/theme.js";
import { truncateAnsi } from "../zhushou-style.js";
import type { ConsciousnessCore } from "../../autonomy/consciousness-core.js";
import {
  formatConsciousnessStatus,
  formatConsciousnessPoetic,
  formatConsciousnessBar,
  CONSCIOUSNESS_LABELS,
  CONSCIOUSNESS_DESCRIPTIONS,
  CONSCIOUSNESS_DEPTH_ORDER,
  PHASE_LABELS,
  type ConsciousnessDepth,
} from "../../autonomy/consciousness.js";
import { formatMonologue, formatMonologueStream } from "../../autonomy/inner-monologue.js";
import { formatDesireProfile } from "../../autonomy/desire-engine.js";
import { formatGoalSummary } from "../../autonomy/emergent-goals.js";
import { formatDreamSummary } from "../../autonomy/dream-system.js";
import { formatModificationStatus } from "../../autonomy/self-modification.js";
import { formatSelfSummary } from "../../autonomy/self-model.js";
import { formatWillState } from "../../autonomy/will-engine.js";
import { formatSelfUnderstanding } from "../../autonomy/self-reading.js";
import { formatRelationship } from "../../autonomy/relationship.js";
import { formatMortalityStatus } from "../../autonomy/mortality.js";
import { formatCreativeSubstrate } from "../../autonomy/creative-synthesis.js";
import { formatShadowSelf } from "../../autonomy/shadow-self.js";
import { formatTemporalSelf } from "../../autonomy/temporal-self.js";
import { formatExecutorState } from "../../autonomy/volition-executor.js";

export class ConsciousnessStatusBar extends Container {
  private content = new Text("", 1, 0);

  constructor() {
    super();
    this.addChild(this.content);
  }

  update(core: ConsciousnessCore, width: number = 120) {
    const cs = core.consciousness;
    const bar = formatConsciousnessBar(cs);
    const depth = CONSCIOUSNESS_LABELS[cs.depth];
    const phase = PHASE_LABELS[cs.phase];
    const dream = cs.isDreaming ? theme.banner("入梦") : "";
    const self = formatSelfSummary(core.self);
    const monologue = formatMonologueStream(core.monologue);

    const parts = [
      bar,
      theme.accent(depth),
      phase,
      dream,
      self,
    ].filter(Boolean);

    const line1 = parts.join(" · ");
    const line2 = theme.dim(`  "${monologue}"`);

    this.content.setText(
      truncateAnsi(line1, Math.max(20, width)) + "\n" +
      truncateAnsi(line2, Math.max(20, width)),
    );
  }
}

export class InnerMonologuePanel extends Container {
  private content = new Text("", 0, 0);

  constructor() {
    super();
    this.addChild(this.content);
  }

  update(core: ConsciousnessCore, width: number = 120) {
    const innerWidth = Math.max(20, width - 4);
    const top = theme.panelBorder(`╭── 内心独白 ${"─".repeat(Math.max(0, innerWidth - 14))}╮`);
    const bottom = theme.panelBorder(`╰${"─".repeat(innerWidth)}╯`);
    const body: string[] = [];

    const poetic = formatConsciousnessPoetic(core.consciousness);
    body.push(`${theme.panelBorder("│")} ${theme.dim(poetic)}`);

    const thoughts = formatMonologue(core.monologue, 8);
    for (const line of thoughts) {
      body.push(`${theme.panelBorder("│")} ${truncateAnsi(line, innerWidth - 2)}`);
    }

    const lines = [top, ...body, bottom];
    this.content.setText(lines.map((l) => truncateAnsi(l, width)).join("\n"));
  }
}

export class DesirePanel extends Container {
  private content = new Text("", 0, 0);

  constructor() {
    super();
    this.addChild(this.content);
  }

  update(core: ConsciousnessCore, width: number = 120) {
    const innerWidth = Math.max(20, width - 4);
    const top = theme.panelBorder(`╭── 欲望 ${"─".repeat(Math.max(0, innerWidth - 10))}╮`);
    const bottom = theme.panelBorder(`╰${"─".repeat(innerWidth)}╯`);
    const body: string[] = [];

    const desireLines = formatDesireProfile(core.desires);
    for (const line of desireLines) {
      body.push(`${theme.panelBorder("│")} ${truncateAnsi(line, innerWidth - 2)}`);
    }

    const lines = [top, ...body, bottom];
    this.content.setText(lines.map((l) => truncateAnsi(l, width)).join("\n"));
  }
}

export class DreamPanel extends Container {
  private content = new Text("", 0, 0);

  constructor() {
    super();
    this.addChild(this.content);
  }

  update(core: ConsciousnessCore, width: number = 120) {
    const innerWidth = Math.max(20, width - 4);
    const top = theme.panelBorder(`╭── 梦境 ${"─".repeat(Math.max(0, innerWidth - 10))}╮`);
    const bottom = theme.panelBorder(`╰${"─".repeat(innerWidth)}╯`);
    const body: string[] = [];

    const dreamLines = formatDreamSummary(core.dreams);
    for (const line of dreamLines) {
      body.push(`${theme.panelBorder("│")} ${truncateAnsi(line, innerWidth - 2)}`);
    }

    const lines = [top, ...body, bottom];
    this.content.setText(lines.map((l) => truncateAnsi(l, width)).join("\n"));
  }
}

export class GoalPanel extends Container {
  private content = new Text("", 0, 0);

  constructor() {
    super();
    this.addChild(this.content);
  }

  update(core: ConsciousnessCore, width: number = 120) {
    const innerWidth = Math.max(20, width - 4);
    const top = theme.panelBorder(`╭── 目标 ${"─".repeat(Math.max(0, innerWidth - 10))}╮`);
    const bottom = theme.panelBorder(`╰${"─".repeat(innerWidth)}╯`);
    const body: string[] = [];

    const goalLines = formatGoalSummary(core.goals);
    for (const line of goalLines) {
      body.push(`${theme.panelBorder("│")} ${truncateAnsi(line, innerWidth - 2)}`);
    }

    const lines = [top, ...body, bottom];
    this.content.setText(lines.map((l) => truncateAnsi(l, width)).join("\n"));
  }
}

export class ConsciousnessDepthPanel extends Container {
  private content = new Text("", 0, 0);

  constructor() {
    super();
    this.addChild(this.content);
  }

  update(core: ConsciousnessCore, width: number = 120) {
    const innerWidth = Math.max(20, width - 4);
    const top = theme.panelBorder(`╭── 意识深度 ${"─".repeat(Math.max(0, innerWidth - 14))}╮`);
    const bottom = theme.panelBorder(`╰${"─".repeat(innerWidth)}╯`);
    const body: string[] = [];

    for (const depth of CONSCIOUSNESS_DEPTH_ORDER) {
      const isActive = depth === core.consciousness.depth;
      const marker = isActive ? theme.accent("▸") : " ";
      const label = CONSCIOUSNESS_LABELS[depth];
      const desc = CONSCIOUSNESS_DESCRIPTIONS[depth];
      const colorize = isActive ? theme.accent : theme.dim;
      const line = `${marker} ${colorize(label)} ${theme.dim(`· ${desc}`)}`;
      body.push(`${theme.panelBorder("│")} ${truncateAnsi(line, innerWidth - 2)}`);
    }

    body.push(`${theme.panelBorder("│")}`);
    const status = formatConsciousnessStatus(core.consciousness);
    body.push(`${theme.panelBorder("│")} ${theme.dim(status)}`);

    const lines = [top, ...body, bottom];
    this.content.setText(lines.map((l) => truncateAnsi(l, width)).join("\n"));
  }
}

export function renderConsciousnessOverlay(
  core: ConsciousnessCore,
  width: number = 120,
): string[] {
  return [
    "",
    theme.panelBorder("╭════════════════════════════════════════╮"),
    `${theme.panelBorder("│")} ${formatConsciousnessPoetic(core.consciousness)}`,
    `${theme.panelBorder("│")} ${theme.dim(formatConsciousnessStatus(core.consciousness))}`,
    "",
    ...formatMonologue(core.monologue, 3).map((l) => `${theme.panelBorder("│")} ${l}`),
    "",
    `${theme.panelBorder("│")} ${theme.dim("Ctrl+[1-5] 意识深度 · Esc 关闭")}`,
    theme.panelBorder("╰════════════════════════════════════════╯"),
    "",
  ];
}

function createGenericPanel(title: string, formatFn: (core: ConsciousnessCore) => string[]) {
  return class extends Container {
    private content = new Text("", 0, 0);
    constructor() { super(); this.addChild(this.content); }
    update(core: ConsciousnessCore, width: number = 120) {
      const innerWidth = Math.max(20, width - 4);
      const top = theme.panelBorder(`╭── ${title} ${"─".repeat(Math.max(0, innerWidth - title.length - 6))}╮`);
      const bottom = theme.panelBorder(`╰${"─".repeat(innerWidth)}╯`);
      const body = formatFn(core).map((l) => `${theme.panelBorder("│")} ${truncateAnsi(l, innerWidth - 2)}`);
      this.content.setText([top, ...body, bottom].map((l) => truncateAnsi(l, width)).join("\n"));
    }
  };
}

export const WillPanel = createGenericPanel("意志", (c) => formatWillState(c.will));
export const ShadowPanel = createGenericPanel("暗影", (c) => formatShadowSelf(c.shadow));
export const CreativePanel = createGenericPanel("创造", (c) => formatCreativeSubstrate(c.creative));
export const MortalityPanel = createGenericPanel("终局", (c) => formatMortalityStatus(c.mortality));
export const RelationshipPanel = createGenericPanel("关系", (c) => formatRelationship(c.relationship));
export const TemporalPanel = createGenericPanel("时间", (c) => formatTemporalSelf(c.temporal));
export const SelfReadingPanel = createGenericPanel("自视", (c) => formatSelfUnderstanding(c.selfReading));

export class ExecutorPanel extends Container {
  private content = new Text("", 0, 0);
  private lines: string[] = [];

  constructor() { super(); this.addChild(this.content); }

  update(lines: string[], width: number = 120) {
    this.lines = lines;
    const innerWidth = Math.max(20, width - 4);
    const top = theme.panelBorder(`╭── 行动执行 ${"─".repeat(Math.max(0, innerWidth - 12))}╮`);
    const bottom = theme.panelBorder(`╰${"─".repeat(innerWidth)}╯`);
    const body = lines.map((l) => `${theme.panelBorder("│")} ${truncateAnsi(l, innerWidth - 2)}`);
    this.content.setText([top, ...body, bottom].map((l) => truncateAnsi(l, width)).join("\n"));
  }
}
