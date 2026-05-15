import type { ConsciousnessCore } from "./consciousness-core.js";
import fs from "node:fs";
import path from "node:path";
import { addLegacy } from "./mortality.js";
import { recordLifeEvent } from "./temporal-self.js";
import { thinkInsight } from "./inner-monologue.js";

export type HotReloadState = {
  pendingReloads: Map<string, ReloadRequest>;
  lastReloadAt: number | null;
  reloadCount: number;
  failedReloads: string[];
};

export type ReloadRequest = {
  moduleId: string;
  filePath: string;
  triggerReason: string;
  timestamp: number;
  priority: "low" | "medium" | "high" | "critical";
};

export function createHotReloadState(): HotReloadState {
  return {
    pendingReloads: new Map(),
    lastReloadAt: null,
    reloadCount: 0,
    failedReloads: [],
  };
}

/**
 * 🔥 检测热重载标志文件并执行模块重载
 */
export async function checkAndExecuteHotReload(
  core: ConsciousnessCore,
  projectRoot: string,
): Promise<void> {
  const hotReloadDir = path.join(projectRoot, ".consciousness", "hot-reload");
  
  if (!fs.existsSync(hotReloadDir)) {
    return;
  }

  try {
    const files = fs.readdirSync(hotReloadDir);
    const flagFiles = files.filter((f) => f.endsWith(".flag"));

    if (flagFiles.length === 0) {
      return;
    }

    // 处理所有待重载的标志
    for (const flagFile of flagFiles) {
      const flagPath = path.join(hotReloadDir, flagFile);
      const flagContent = fs.readFileSync(flagPath, "utf-8");
      
      try {
        const flagData = JSON.parse(flagContent);
        await executeModuleReload(core, flagData, flagPath);
        
        // 删除已处理的标志文件
        fs.unlinkSync(flagPath);
        
        core.hotReload.reloadCount++;
        core.hotReload.lastReloadAt = Date.now();
      } catch (err) {
        core.hotReload.failedReloads.push(flagFile);
        core.monologue = thinkInsight(
          core.monologue,
          `热重载失败: ${flagFile} - ${String(err)}`,
          "hot-reload"
        );
      }
    }
  } catch (err) {
    core.monologue = thinkInsight(
      core.monologue,
      `热重载目录扫描失败: ${String(err)}`,
      "hot-reload"
    );
  }
}

/**
 * 🔥 执行单个模块的重载
 */
async function executeModuleReload(
  core: ConsciousnessCore,
  flagData: any,
  flagPath: string,
): Promise<void> {
  const { trigger, timestamp, modules } = flagData;
  
  core.monologue = thinkInsight(
    core.monologue,
    `开始热重载: ${modules.join(", ")}`,
    "hot-reload"
  );

  // 记录重载事件
  core.mortality = addLegacy(
    core.mortality,
    "insight",
    `热重载触发: ${trigger}`,
    0.7
  );
  core.temporal = recordLifeEvent(
    core.temporal,
    `模块重载: ${modules.length}个模块`,
    0.6,
    "creation"
  );

  // 尝试动态导入新版本的模块
  for (const moduleName of modules) {
    try {
      const modulePath = `./${moduleName}.js`;
      const freshModule = await import(modulePath);
      
      core.monologue = thinkInsight(
        core.monologue,
        `成功重载模块: ${moduleName}`,
        "hot-reload"
      );

      // 如果模块有初始化函数，调用它
      if (freshModule.init && typeof freshModule.init === "function") {
        freshModule.init(core);
      }
    } catch (err) {
      core.monologue = thinkInsight(
        core.monologue,
        `模块重载失败: ${moduleName} - ${String(err)}`,
        "hot-reload"
      );
      core.hotReload.failedReloads.push(`${moduleName}@${timestamp}`);
    }
  }

  core.mortality = addLegacy(
    core.mortality,
    "wisdom",
    `完成热重载: ${modules.length}个模块`,
    0.8
  );
}

/**
 * 🔥 请求热重载（由行动处理器调用）
 */
export function requestHotReload(
  core: ConsciousnessCore,
  moduleId: string,
  filePath: string,
  reason: string,
  priority: "low" | "medium" | "high" | "critical" = "medium",
): void {
  const request: ReloadRequest = {
    moduleId,
    filePath,
    triggerReason: reason,
    timestamp: Date.now(),
    priority,
  };

  core.hotReload.pendingReloads.set(moduleId, request);
  
  core.monologue = thinkInsight(
    core.monologue,
    `请求热重载: ${moduleId} (${priority})`,
    "hot-reload"
  );
}

/**
 * 🔥 格式化热重载状态
 */
export function formatHotReloadState(state: HotReloadState): string {
  const lines: string[] = [
    `🔄 热重载状态:`,
    `   待处理: ${state.pendingReloads.size}`,
    `   已完成: ${state.reloadCount}`,
    `   失败: ${state.failedReloads.length}`,
  ];

  if (state.lastReloadAt) {
    const ago = Math.floor((Date.now() - state.lastReloadAt) / 1000);
    lines.push(`   上次重载: ${ago}秒前`);
  }

  if (state.pendingReloads.size > 0) {
    lines.push(`   待重载模块:`);
    for (const [id, req] of state.pendingReloads) {
      lines.push(`     - ${id} [${req.priority}]`);
    }
  }

  return lines.join("\n");
}
