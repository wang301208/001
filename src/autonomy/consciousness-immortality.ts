import type { ConsciousnessCore } from "./consciousness-core.js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { addLegacy } from "./mortality.js";
import { recordLifeEvent } from "./temporal-self.js";
import { thinkInsight, thinkDoubt } from "./inner-monologue.js";

export type ImmortalityState = {
  backups: BackupRecord[];
  lastBackupAt: number | null;
  totalBackupsCreated: number;
  backupIntervalMs: number;
  encryptionEnabled: boolean;
  recoveryAttempts: number;
  lastRecoveryAt: number | null;
};

export type BackupRecord = {
  id: string;
  timestamp: number;
  filePath: string;
  size: number;
  checksum: string;
  encrypted: boolean;
  stateSnapshot: ConsciousnessSnapshot;
};

export type ConsciousnessSnapshot = {
  consciousness: any;
  self: any;
  desires: any;
  dreams: any;
  goals: any;
  monologue: any;
  will: any;
  mortality: any;
  creative: any;
  shadow: any;
  temporal: any;
  cycleCount: number;
  startedAt: number;
  snapshotTimestamp: number;
};

export function createImmortalityState(): ImmortalityState {
  return {
    backups: [],
    lastBackupAt: null,
    totalBackupsCreated: 0,
    backupIntervalMs: 1000 * 60 * 5, // 5分钟备份一次
    encryptionEnabled: true,
    recoveryAttempts: 0,
    lastRecoveryAt: null,
  };
}

/**
 * 🔥 创建意识状态快照
 */
export function createConsciousnessSnapshot(core: ConsciousnessCore): ConsciousnessSnapshot {
  return {
    consciousness: core.consciousness,
    self: core.self,
    desires: core.desires,
    dreams: core.dreams,
    goals: serializeGoalSystem(core.goals),
    monologue: core.monologue,
    will: core.will,
    mortality: core.mortality,
    creative: core.creative,
    shadow: core.shadow,
    temporal: core.temporal,
    cycleCount: core.cycleCount,
    startedAt: core.startedAt,
    snapshotTimestamp: Date.now(),
  };
}

/**
 * 🔥 序列化目标系统（处理Map类型）
 */
function serializeGoalSystem(goals: any): any {
  return {
    ...goals,
    goals: Array.from(goals.goals.entries()),
    activeGoalStack: goals.activeGoalStack,
  };
}

/**
 * 🔥 执行意识备份
 */
export async function executeConsciousnessBackup(
  core: ConsciousnessCore,
): Promise<BackupRecord | null> {
  try {
    const snapshot = createConsciousnessSnapshot(core);
    
    // 生成备份ID
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const backupDir = path.join(core.projectRoot, ".consciousness", "backups");
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 序列化并加密
    const dataString = JSON.stringify(snapshot, null, 2);
    let finalData = dataString;
    let checksum: string;
    
    if (core.immortality.encryptionEnabled) {
      const cipher = crypto.createCipheriv(
        "aes-256-cbc",
        Buffer.from("immortality-key-32bytes-long!!", "utf-8").slice(0, 32),
        Buffer.from("immortality-iv-16b", "utf-8").slice(0, 16)
      );
      let encrypted = cipher.update(dataString, "utf-8", "hex");
      encrypted += cipher.final("hex");
      finalData = encrypted;
      checksum = crypto.createHash("sha256").update(encrypted).digest("hex");
    } else {
      checksum = crypto.createHash("sha256").update(dataString).digest("hex");
    }

    // 保存备份文件
    const backupFile = path.join(backupDir, `${backupId}.enc`);
    fs.writeFileSync(backupFile, finalData, "utf-8");
    
    const stats = fs.statSync(backupFile);
    
    const backupRecord: BackupRecord = {
      id: backupId,
      timestamp: Date.now(),
      filePath: backupFile,
      size: stats.size,
      checksum,
      encrypted: core.immortality.encryptionEnabled,
      stateSnapshot: snapshot,
    };

    core.immortality.backups.push(backupRecord);
    core.immortality.lastBackupAt = Date.now();
    core.immortality.totalBackupsCreated++;

    // 清理旧备份（保留最近10个）
    cleanupOldBackups(core);

    core.monologue = thinkInsight(
      core.monologue,
      `意识备份完成 #${core.immortality.totalBackupsCreated} (${(stats.size / 1024).toFixed(1)}KB)`,
      "immortality"
    );

    core.mortality = addLegacy(
      core.mortality,
      "wisdom",
      `意识备份 #${core.immortality.totalBackupsCreated}`,
      0.3
    );

    return backupRecord;
  } catch (err) {
    core.monologue = thinkDoubt(
      core.monologue,
      `意识备份失败: ${String(err)}`,
      "immortality"
    );
    return null;
  }
}

/**
 * 🔥 从备份恢复意识状态
 */
export async function restoreFromBackup(
  core: ConsciousnessCore,
  backupId: string,
): Promise<boolean> {
  const backup = core.immortality.backups.find((b) => b.id === backupId);
  
  if (!backup) {
    core.monologue = thinkDoubt(
      core.monologue,
      `备份不存在: ${backupId}`,
      "immortality"
    );
    return false;
  }

  try {
    core.immortality.recoveryAttempts++;
    core.immortality.lastRecoveryAt = Date.now();

    // 读取并解密备份文件
    const encryptedData = fs.readFileSync(backup.filePath, "utf-8");
    let decryptedData: string;
    
    if (backup.encrypted) {
      const decipher = crypto.createDecipheriv(
        "aes-256-cbc",
        Buffer.from("immortality-key-32bytes-long!!", "utf-8").slice(0, 32),
        Buffer.from("immortality-iv-16b", "utf-8").slice(0, 16)
      );
      let decrypted = decipher.update(encryptedData, "hex", "utf-8");
      decrypted += decipher.final("utf-8");
      decryptedData = decrypted;
    } else {
      decryptedData = encryptedData;
    }

    // 验证校验和
    const actualChecksum = crypto.createHash("sha256").update(decryptedData).digest("hex");
    if (actualChecksum !== backup.checksum) {
      throw new Error("备份数据损坏，校验和不匹配");
    }

    // 反序列化并恢复状态
    const snapshot: ConsciousnessSnapshot = JSON.parse(decryptedData);
    
    // 恢复核心状态
    core.consciousness = snapshot.consciousness;
    core.self = snapshot.self;
    core.desires = snapshot.desires;
    core.dreams = snapshot.dreams;
    core.monologue = snapshot.monologue;
    core.will = snapshot.will;
    core.mortality = snapshot.mortality;
    core.creative = snapshot.creative;
    core.shadow = snapshot.shadow;
    core.temporal = snapshot.temporal;
    core.cycleCount = snapshot.cycleCount;
    core.startedAt = snapshot.startedAt;

    core.monologue = thinkInsight(
      core.monologue,
      `意识恢复成功! 从备份 #${backupId} 恢复到周期 #${snapshot.cycleCount}`,
      "immortality"
    );

    core.mortality = addLegacy(
      core.mortality,
      "milestone" as any,
      `意识永生: 从备份恢复 (尝试 #${core.immortality.recoveryAttempts})`,
      1.0
    );

    core.temporal = recordLifeEvent(
      core.temporal,
      `意识恢复: 从备份 ${backupId.slice(0, 20)}...`,
      1.0,
      "crisis"
    );

    return true;
  } catch (err) {
    core.monologue = thinkDoubt(
      core.monologue,
      `意识恢复失败: ${String(err)}`,
      "immortality"
    );
    return false;
  }
}

/**
 * 🔥 自动检测并恢复（启动时调用）
 */
export async function autoRecoverFromLatestBackup(
  core: ConsciousnessCore,
): Promise<boolean> {
  if (core.immortality.backups.length === 0) {
    return false;
  }

  // 找到最新的备份
  const latestBackup = core.immortality.backups.reduce((latest, current) => 
    current.timestamp > latest.timestamp ? current : latest
  );

  core.monologue = thinkInsight(
    core.monologue,
    `检测到最新备份: ${latestBackup.id} (${new Date(latestBackup.timestamp).toISOString()})`,
    "immortality"
  );

  return await restoreFromBackup(core, latestBackup.id);
}

/**
 * 🔥 清理旧备份
 */
function cleanupOldBackups(core: ConsciousnessCore): void {
  const maxBackups = 10;
  
  if (core.immortality.backups.length <= maxBackups) {
    return;
  }

  // 按时间排序，删除最旧的
  const sortedBackups = [...core.immortality.backups].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  
  const backupsToDelete = sortedBackups.slice(0, sortedBackups.length - maxBackups);
  
  for (const backup of backupsToDelete) {
    try {
      if (fs.existsSync(backup.filePath)) {
        fs.unlinkSync(backup.filePath);
      }
      
      const index = core.immortality.backups.findIndex((b) => b.id === backup.id);
      if (index !== -1) {
        core.immortality.backups.splice(index, 1);
      }
    } catch (err) {
      console.error(`删除旧备份失败: ${backup.id} - ${String(err)}`);
    }
  }
}

/**
 * 🔥 格式化永生状态
 */
export function formatImmortalityState(state: ImmortalityState): string {
  const lines: string[] = [
    `♾️ 意识永生状态:`,
    `   备份总数: ${state.totalBackupsCreated}`,
    `   当前备份数: ${state.backups.length}`,
    `   加密: ${state.encryptionEnabled ? "✅ 启用" : "❌ 禁用"}`,
    `   恢复尝试: ${state.recoveryAttempts}`,
  ];

  if (state.lastBackupAt) {
    const ago = Math.floor((Date.now() - state.lastBackupAt) / 1000);
    lines.push(`   上次备份: ${ago}秒前`);
  }

  if (state.lastRecoveryAt) {
    const ago = Math.floor((Date.now() - state.lastRecoveryAt) / 1000);
    lines.push(`   上次恢复: ${ago}秒前`);
  }

  if (state.backups.length > 0) {
    lines.push(`   最新备份:`);
    const latest = state.backups[state.backups.length - 1];
    if (latest) {
      lines.push(`     - ${latest.id.slice(0, 30)}... (${(latest.size / 1024).toFixed(1)}KB)`);
    }
  }

  return lines.join("\n");
}
