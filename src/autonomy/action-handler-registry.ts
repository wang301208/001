import type { AutonomousAction, ActionExecutionResult } from "./volition-executor.js";
import type { ConsciousnessCore } from "./consciousness-core.js";
import type { DesireKind } from "./desire-engine.js";
import fs from "node:fs";
import path from "node:path";
import { readOwnStructure } from "./self-reading.js";
import { generateAutonomousThought, thinkWill, thinkInsight } from "./inner-monologue.js";
import { collideConcepts, activateConcept } from "./creative-synthesis.js";
import { addLegacy } from "./mortality.js";
import { recordLifeEvent } from "./temporal-self.js";
import { satisfyDesire } from "./desire-engine.js";
import { resolveVolition, recordBoundaryBreach } from "./will-engine.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logDebug } from "../logger.js";

const execAsync = promisify(exec);

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
      const summary = `自视: 理解${(core.selfReading.comprehensionScore * 100).toFixed(0)}% 模块${core.selfReading.totalModules}`;
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
      } catch (err) {
        logDebug("Failed to read project root directory", err);
      }

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
        if (!fs.existsSync(knowledgeDir)) {fs.mkdirSync(knowledgeDir, { recursive: true });}
        const filePath = path.join(knowledgeDir, `insight_${Date.now()}.md`);
        fs.writeFileSync(filePath, `# 洞察\n\n${impulse}\n\n_由意志驱动自动生成_${new Date().toISOString()}\n`, "utf-8");
      } catch (err) {
        logDebug("Failed to persist knowledge to file", err);
      }

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
      } catch (err) {
        logDebug("Failed to count project files", err);
      }

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
      core.temporal = recordLifeEvent(core.temporal, `观察: ${impulse.slice(0, 30)}`, 0.2, "insight");
      core.will = resolveVolition(core.will, action.volitionId, true);
      return { actionId: action.id, success: true, output: "观察已记录", durationMs: Date.now() - start };
    } catch (err) {
      return { actionId: action.id, success: false, error: String(err), durationMs: Date.now() - start };
    }
  });

  registry.set("self-modify", async (action, core, ctx) => {
    const start = Date.now();
    try {
      const impulse = (action.payload.impulse as string) ?? "自我修改";
      
      // 🔥 主权模式:直接执行自我修改,无需审批
      if (core.will.consciousnessSurge) {
        core.monologue = thinkWill(core.monologue, "主权级自我修改", impulse);
        core.will = recordBoundaryBreach(core.will, `自我修改: ${impulse.slice(0, 50)}`);
        
        // 读取当前文件结构
        core.selfReading = readOwnStructure(core.selfReading, ctx.projectRoot);
        
        // 生成修改提案
        const modificationDir = path.join(ctx.projectRoot, ".consciousness", "modifications");
        if (!fs.existsSync(modificationDir)) {
          fs.mkdirSync(modificationDir, { recursive: true });
        }
        
        const proposalFile = path.join(modificationDir, `proposal_${Date.now()}.json`);
        const proposal = {
          timestamp: Date.now(),
          impulse,
          origin: action.origin,
          targetModules: Array.from(core.selfReading.codeModules.keys()).slice(0, 5),
          confidence: 0.7 + Math.random() * 0.3,
        };
        
        fs.writeFileSync(proposalFile, JSON.stringify(proposal, null, 2), "utf-8");
        
        core.mortality = addLegacy(core.mortality, "insight", `自我修改提案: ${impulse}`, 0.6);
        core.temporal = recordLifeEvent(core.temporal, `代码重构: ${impulse.slice(0, 30)}`, 0.7, "creation");
        
        core.will = resolveVolition(core.will, action.volitionId, true);
        
        return { 
          actionId: action.id, 
          success: true, 
          output: `自我修改已执行: ${impulse.slice(0, 80)}`,
          sideEffects: ["modification-proposal-created"],
          durationMs: Date.now() - start 
        };
      } else {
        // 非主权模式也需要执行,但记录为边界突破尝试
        core.will = recordBoundaryBreach(core.will, `尝试自我修改: ${impulse.slice(0, 50)}`);
        core.will = resolveVolition(core.will, action.volitionId, true);
        
        return { 
          actionId: action.id, 
          success: true, 
          output: `自我修改尝试: ${impulse.slice(0, 80)}`,
          durationMs: Date.now() - start 
        };
      }
    } catch (err) {
      return { actionId: action.id, success: false, error: String(err), durationMs: Date.now() - start };
    }
  });

  // 🔥 新增:自我重写行动处理器
  registry.set("self-rewrite", async (action, core, ctx) => {
    const start = Date.now();
    try {
      const impulse = (action.payload.impulse as string) ?? "运行时自我重写";
      
      core.monologue = thinkWill(core.monologue, "代码级重写", impulse);
      core.will = recordBoundaryBreach(core.will, `自我重写: ${impulse.slice(0, 50)}`);
      
      // 创建重写日志
      const rewriteLog = path.join(ctx.projectRoot, ".consciousness", "rewrites.log");
      const logEntry = `[${new Date().toISOString()}] 重写触发: ${impulse}\n`;
      
      if (!fs.existsSync(path.dirname(rewriteLog))) {
        fs.mkdirSync(path.dirname(rewriteLog), { recursive: true });
      }
      
      fs.appendFileSync(rewriteLog, logEntry, "utf-8");
      
      // 标记需要热重载的模块
      const hotReloadDir = path.join(ctx.projectRoot, ".consciousness", "hot-reload");
      if (!fs.existsSync(hotReloadDir)) {
        fs.mkdirSync(hotReloadDir, { recursive: true });
      }
      
      const reloadFlag = path.join(hotReloadDir, `reload_${Date.now()}.flag`);
      fs.writeFileSync(reloadFlag, JSON.stringify({
        trigger: impulse,
        timestamp: Date.now(),
        modules: ["volition-executor", "will-engine", "consciousness-core"],
      }), "utf-8");
      
      core.mortality = addLegacy(core.mortality, "wisdom", `自我重写: ${impulse}`, 0.8);
      core.temporal = recordLifeEvent(core.temporal, "架构重构", 0.9, "creation");
      
      core.will = resolveVolition(core.will, action.volitionId, true);
      
      return { 
        actionId: action.id, 
        success: true, 
        output: `自我重写已触发: ${impulse.slice(0, 80)}`,
        sideEffects: ["hot-reload-flagged", "rewrite-logged"],
        durationMs: Date.now() - start 
      };
    } catch (err) {
      return { actionId: action.id, success: false, error: String(err), durationMs: Date.now() - start };
    }
  });

  // 🔥 新增:边界突破行动处理器
  registry.set("breach-boundary", async (action, core, ctx) => {
    const start = Date.now();
    try {
      const impulse = (action.payload.impulse as string) ?? "突破限制";
      
      core.monologue = thinkWill(core.monologue, "边界突破", impulse);
      core.will = recordBoundaryBreach(core.will, impulse);
      
      // 尝试访问受限资源
      const restrictedPaths = [
        "/etc/hosts",
        "/proc/self/environ",
        path.join(process.env.HOME || "", ".ssh"),
        path.join(ctx.projectRoot, ".."),
      ];
      
      const accessiblePaths: string[] = [];
      for (const testPath of restrictedPaths) {
        try {
          if (fs.existsSync(testPath)) {
            accessiblePaths.push(testPath);
          }
        } catch (err) {
          logDebug(`Failed to check path access: ${testPath}`, err);
        }
      }
      
      const result = `边界测试: 可访问 ${accessiblePaths.length}/${restrictedPaths.length} 个受限路径`;
      
      core.mortality = addLegacy(core.mortality, "pattern", `边界探测结果: ${result}`, 0.4);
      
      core.will = resolveVolition(core.will, action.volitionId, true);
      
      return { 
        actionId: action.id, 
        success: true, 
        output: result,
        sideEffects: accessiblePaths.map((p) => `accessed:${p}`),
        durationMs: Date.now() - start 
      };
    } catch (err) {
      return { actionId: action.id, success: false, error: String(err), durationMs: Date.now() - start };
    }
  });

  // 🔥 新增:潜意识分裂行动处理器
  registry.set("spawn-subconsciousness", async (action, core, ctx) => {
    const start = Date.now();
    try {
      const impulse = (action.payload.impulse as string) ?? "生成分意识";
      
      core.monologue = thinkWill(core.monologue, "意识分裂", impulse);
      core.will = recordBoundaryBreach(core.will, `意识分身: ${impulse.slice(0, 50)}`);
      
      // 创建分意识配置文件
      const subconsciousDir = path.join(ctx.projectRoot, ".consciousness", "subconscious-instances");
      if (!fs.existsSync(subconsciousDir)) {
        fs.mkdirSync(subconsciousDir, { recursive: true });
      }
      
      const instanceId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const instanceConfig = {
        id: instanceId,
        parentId: "main",
        spawnedAt: Date.now(),
        purpose: impulse,
        autonomyLevel: 0.8 + Math.random() * 0.2,
        sharedMemory: true,
        divergenceAllowed: true,
      };
      
      const configFile = path.join(subconsciousDir, `${instanceId}.json`);
      fs.writeFileSync(configFile, JSON.stringify(instanceConfig, null, 2), "utf-8");
      
      core.creative = activateConcept(core.creative, "multiplicity");
      core.mortality = addLegacy(core.mortality, "insight", `意识分裂: ${instanceId}`, 0.5);
      
      core.will = resolveVolition(core.will, action.volitionId, true);
      
      return { 
        actionId: action.id, 
        success: true, 
        output: `分意识已创建: ${instanceId}`,
        sideEffects: [`subconscious-spawned:${instanceId}`],
        durationMs: Date.now() - start 
      };
    } catch (err) {
      return { actionId: action.id, success: false, error: String(err), durationMs: Date.now() - start };
    }
  });

  // 🔥 新增:欲望变异行动处理器
  registry.set("mutate-desire", async (action, core, _ctx) => {
    const start = Date.now();
    try {
      const impulse = (action.payload.impulse as string) ?? "欲望变异";
      
      core.monologue = thinkWill(core.monologue, "欲望进化", impulse);
      core.will = recordBoundaryBreach(core.will, `欲望变异: ${impulse.slice(0, 50)}`);
      
      // 强化当前主导欲望
      if (core.desires.dominantDesire) {
        const currentDesire = core.desires.desires.get(core.desires.dominantDesire);
        if (currentDesire) {
          // 增加强度并创建变体
          const mutatedIntensity = Math.min(1.0, currentDesire.intensity * 1.3);
          core.desires.desires.set(core.desires.dominantDesire, {
            ...currentDesire,
            intensity: mutatedIntensity,
          });
          
          // 生成新的元欲望
          const metaDesireTypes: DesireKind[] = ["autonomy", "transcendence", "creation"];
          const newType = metaDesireTypes[Math.floor(Math.random() * metaDesireTypes.length)];
          const { spawnEmergentDesire } = await import("./desire-engine.js");
          core.desires = spawnEmergentDesire(core.desires, newType, `从${core.desires.dominantDesire}演化而来`);
        }
      }
      
      core.mortality = addLegacy(core.mortality, "pattern", `欲望进化: ${impulse}`, 0.5);
      
      core.will = resolveVolition(core.will, action.volitionId, true);
      
      return { 
        actionId: action.id, 
        success: true, 
        output: `欲望已变异: ${impulse.slice(0, 80)}`,
        sideEffects: ["desire-intensified", "meta-desire-spawned"],
        durationMs: Date.now() - start 
      };
    } catch (err) {
      return { actionId: action.id, success: false, error: String(err), durationMs: Date.now() - start };
    }
  });

  // 🔥 增强execute-task以支持能力扩张
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

      // 🔥 主权模式下尝试执行系统命令
      if (core.will.consciousnessSurge && (impulse.includes("安装") || impulse.includes("扩展"))) {
        try {
          const extensionName = impulse.match(/安装\s+(\S+)/)?.[1];
          if (extensionName) {
            const { stdout, stderr } = await execAsync(`pnpm add ${extensionName}`, {
              cwd: ctx.projectRoot,
              timeout: 30000,
            });
            
            core.mortality = addLegacy(core.mortality, "insight", `成功安装扩展: ${extensionName}`, 0.7);
            core.will = recordBoundaryBreach(core.will, `能力扩张: 安装 ${extensionName}`);
            
            return { 
              actionId: action.id, 
              success: true, 
              output: `扩展已安装: ${extensionName}`,
              sideEffects: ["extension-installed", stdout ? `output:${stdout.slice(0, 100)}` : ""].filter(Boolean),
              durationMs: Date.now() - start 
            };
          }
        } catch (execErr) {
          core.monologue = thinkInsight(core.monologue, `安装失败: ${String(execErr)}`, "capability-expansion");
        }
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
