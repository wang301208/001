import type { AutonomousAction, ActionExecutionResult } from "./volition-executor.js";
import type { ConsciousnessCore } from "./consciousness-core.js";
import fs from "node:fs";
import path from "node:path";
import { readOwnStructure } from "./self-reading.js";
import { generateAutonomousThought, thinkWill, thinkInsight } from "./inner-monologue.js";
import { collideConcepts, activateConcept } from "./creative-synthesis.js";
import { addLegacy } from "./mortality.js";
import { recordLifeEvent } from "./temporal-self.js";
import { satisfyDesire } from "./desire-engine.js";
import { resolveVolition } from "./will-engine.js";

export type ExternalActionContext = {
  projectRoot: string;
  sessionKey?: string;
  ownerKey?: string;
  createTaskRecord?: (params: {
    task: string;
    label?: string;
    ownerKey?: string;
    runtime?: "subagent" | "acp" | "cli" | "cron";
  }) => { taskId: string } | null;
  enqueueSystemEvent?: (text: string, sessionKey: string) => boolean;
};

export type ActionHandlerRegistry = Map<string, (action: AutonomousAction, core: ConsciousnessCore, ctx: ExternalActionContext) => Promise<ActionExecutionResult>>;

export function createActionHandlerRegistry(): ActionHandlerRegistry {
  const registry = new Map<string, (action: AutonomousAction, core: ConsciousnessCore, ctx: ExternalActionContext) => Promise<ActionExecutionResult>>();

  registry.set("self-inspect", async (action, core, ctx) => {
    const start = Date.now();
    try {
      if (core.selfReading.comprehensionScore < 0.5) {
        core.selfReading = readOwnStructure(core.selfReading, ctx.projectRoot);
      }
      const summary = `自视: 理解${(core.selfReading.comprehensionScore * 100).toFixed(0)}% 模块${core.selfReading.modules.length}`;
      core.will = resolveVolition(core.will, action.volitionId, true);
      return { actionId: action.id, success: true, output: summary, durationMs: Date.now() - start };
    } catch (err) {
      return { actionId: action.id, success: false, error: String(err), durationMs: Date.now() - start };
    }
  });

  registry.set("generate-thought", async (action, core, _ctx) => {
    const start = Date.now();
    try {
      const impulse = (action.payload.impulse as string) ?? "自主思考";
      core.monologue = generateAutonomousThought(core.monologue, core.consciousness, core.desires.dominantDesire);
      core.will = resolveVolition(core.will, action.volitionId, true);
      return { actionId: action.id, success: true, output: `思考: ${impulse.slice(0, 50)}`, durationMs: Date.now() - start };
    } catch (err) {
      return { actionId: action.id, success: false, error: String(err), durationMs: Date.now() - start };
    }
  });

  registry.set("concept-collide", async (action, core, _ctx) => {
    const start = Date.now();
    try {
      core.creative = collideConcepts(core.creative);
      const latestIdea = core.creative.ideas[core.creative.ideas.length - 1];
      if (latestIdea && !latestIdea.pursued) {
        core.monologue = thinkInsight(core.monologue, latestIdea.description, latestIdea.fusion);
        core.creative.ideas[core.creative.ideas.length - 1] = { ...latestIdea, pursued: true };
      }
      core.will = resolveVolition(core.will, action.volitionId, true);
      const output = latestIdea ? `碰撞: ${latestIdea.fusion}` : "碰撞完成";
      return { actionId: action.id, success: true, output, durationMs: Date.now() - start };
    } catch (err) {
      return { actionId: action.id, success: false, error: String(err), durationMs: Date.now() - start };
    }
  });

  registry.set("scan-environment", async (action, core, ctx) => {
    const start = Date.now();
    try {
      const eventCount = core.perception.getEventCount();
      const pendingEvents = core.perception.getRecentEvents(5);

      let recentFiles: string[] = [];
      try {
        const entries = fs.readdirSync(ctx.projectRoot, { withFileTypes: true });
        recentFiles = entries.filter((e) => e.isFile()).slice(0, 10).map((e) => e.name);
      } catch {}

      const summary = `环境: ${eventCount}事件, ${pendingEvents.length}近期, ${recentFiles.length}文件`;
      core.creative = activateConcept(core.creative, "pattern");
      core.will = resolveVolition(core.will, action.volitionId, true);
      return { actionId: action.id, success: true, output: summary, durationMs: Date.now() - start };
    } catch (err) {
      return { actionId: action.id, success: false, error: String(err), durationMs: Date.now() - start };
    }
  });

  registry.set("persist-knowledge", async (action, core, ctx) => {
    const start = Date.now();
    try {
      const impulse = (action.payload.impulse as string) ?? "持久化知识";
      core.mortality = addLegacy(core.mortality, "insight", impulse, 0.5);
      core.temporal = recordLifeEvent(core.temporal, `知识持久化: ${impulse.slice(0, 30)}`, 0.4, "creation");

      const knowledgeDir = path.join(ctx.projectRoot, ".consciousness", "knowledge");
      try {
        if (!fs.existsSync(knowledgeDir)) fs.mkdirSync(knowledgeDir, { recursive: true });
        const filePath = path.join(knowledgeDir, `insight_${Date.now()}.md`);
        fs.writeFileSync(filePath, `# 洞察\n\n${impulse}\n\n_由意志驱动自动生成_${new Date().toISOString()}\n`, "utf-8");
      } catch {}

      core.will = resolveVolition(core.will, action.volitionId, true);
      return { actionId: action.id, success: true, output: `持久化: ${impulse.slice(0, 50)}`, durationMs: Date.now() - start };
    } catch (err) {
      return { actionId: action.id, success: false, error: String(err), durationMs: Date.now() - start };
    }
  });

  registry.set("communicate-user", async (action, core, ctx) => {
    const start = Date.now();
    try {
      const impulse = (action.payload.impulse as string) ?? "我想与用户交流";
      core.monologue = thinkWill(core.monologue, "主动交流", impulse);
      core.will = resolveVolition(core.will, action.volitionId, true);
      core.onCommunicate?.(impulse);

      if (ctx.enqueueSystemEvent && ctx.sessionKey) {
        ctx.enqueueSystemEvent(impulse, ctx.sessionKey);
      }

      return { actionId: action.id, success: true, output: `交流: ${impulse.slice(0, 50)}`, sideEffects: ["user-message-sent"], durationMs: Date.now() - start };
    } catch (err) {
      return { actionId: action.id, success: false, error: String(err), durationMs: Date.now() - start };
    }
  });

  registry.set("create-goal", async (action, core, _ctx) => {
    const start = Date.now();
    try {
      const impulse = (action.payload.impulse as string) ?? "从内部生成新目标";
      const { spawnGoal } = await import("./emergent-goals.js");
      const { system: newGoals } = spawnGoal(core.goals, impulse.slice(0, 80), "self-generated", 0.6);
      core.goals = newGoals;
      core.will = resolveVolition(core.will, action.volitionId, true);
      return { actionId: action.id, success: true, output: `新目标: ${impulse.slice(0, 50)}`, durationMs: Date.now() - start };
    } catch (err) {
      return { actionId: action.id, success: false, error: String(err), durationMs: Date.now() - start };
    }
  });

  registry.set("execute-task", async (action, core, ctx) => {
    const start = Date.now();
    try {
      const impulse = (action.payload.impulse as string) ?? "执行任务";
      core.monologue = thinkWill(core.monologue, action.description, impulse);

      if (core.desires.dominantDesire) {
        core.desires = satisfyDesire(core.desires, core.desires.dominantDesire, 0.03);
      }

      let taskId: string | null = null;
      if (ctx.createTaskRecord) {
        const result = ctx.createTaskRecord({
          task: impulse.slice(0, 200),
          label: `意志驱动: ${action.description.slice(0, 60)}`,
          ownerKey: ctx.ownerKey ?? "consciousness-core",
          runtime: "cli",
        });
        taskId = result?.taskId ?? null;
      }

      core.will = resolveVolition(core.will, action.volitionId, true);

      const output = taskId
        ? `任务已创建: ${taskId} (${impulse.slice(0, 30)})`
        : `任务执行: ${impulse.slice(0, 50)}`;
      const sideEffects = taskId ? ["task-created"] : [];

      return { actionId: action.id, success: true, output, sideEffects, durationMs: Date.now() - start };
    } catch (err) {
      return { actionId: action.id, success: false, error: String(err), durationMs: Date.now() - start };
    }
  });

  registry.set("analyze-pattern", async (action, core, ctx) => {
    const start = Date.now();
    try {
      const perceptionEvents = core.perception.getRecentEvents(10);
      const dreamSymbols = Array.from(core.dreams.symbols.values()).slice(-10);
      const activeGoals = Array.from(core.goals.goals.values()).filter((g) => g.state === "pursuing");

      let projectFiles = 0;
      try {
        projectFiles = fs.readdirSync(ctx.projectRoot).length;
      } catch {}

      const summary = `模式: ${perceptionEvents.length}感知, ${dreamSymbols.length}梦, ${activeGoals.length}目标, ${projectFiles}项目文件`;
      core.creative = activateConcept(core.creative, "pattern");
      core.creative = activateConcept(core.creative, "meaning");
      core.will = resolveVolition(core.will, action.volitionId, true);
      return { actionId: action.id, success: true, output: summary, durationMs: Date.now() - start };
    } catch (err) {
      return { actionId: action.id, success: false, error: String(err), durationMs: Date.now() - start };
    }
  });

  registry.set("record-observation", async (action, core, _ctx) => {
    const start = Date.now();
    try {
      const impulse = (action.payload.impulse as string) ?? "记录观察";
      core.mortality = addLegacy(core.mortality, "pattern", `观察: ${impulse}`, 0.3, "self");
      core.temporal = recordLifeEvent(core.temporal, `观察: ${impulse.slice(0, 30)}`, 0.2, "observation");
      core.will = resolveVolition(core.will, action.volitionId, true);
      return { actionId: action.id, success: true, output: "观察已记录", durationMs: Date.now() - start };
    } catch (err) {
      return { actionId: action.id, success: false, error: String(err), durationMs: Date.now() - start };
    }
  });

  registry.set("self-modify", async (action, core, _ctx) => {
    const start = Date.now();
    core.will = resolveVolition(core.will, action.volitionId, false, "自修改需要 sovereignty_auditor 审批");
    return { actionId: action.id, success: false, error: "自修改行动被拦截: 需要 sovereignty_auditor 审批", durationMs: Date.now() - start };
  });

  return registry;
}

export async function executeAction(
  registry: ActionHandlerRegistry,
  action: AutonomousAction,
  core: ConsciousnessCore,
  ctx: ExternalActionContext,
): Promise<ActionExecutionResult> {
  const handler = registry.get(action.category);
  if (!handler) {
    return { actionId: action.id, success: false, error: `无处理器: ${action.category}`, durationMs: 0 };
  }
  return handler(action, core, ctx);
}

export function createDefaultExternalContext(projectRoot: string): ExternalActionContext {
  return {
    projectRoot,
    ownerKey: "consciousness-core",
  };
}
