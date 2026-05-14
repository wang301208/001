import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSON5 from "json5";
import { ensureOwnerDisplaySecret } from "../agents/owner-display.js";
import { applyRuntimeLegacyConfigMigrations } from "../commands/doctor/shared/runtime-compat-api.js";
import { loadDotEnv } from "../infra/dotenv.js";
import { formatErrorMessage } from "../infra/errors.js";
import { resolveRequiredHomeDir } from "../infra/home-dir.js";
import {
  loadShellEnvFallback,
  resolveShellEnvFallbackTimeoutMs,
  shouldDeferShellEnvFallback,
  shouldEnableShellEnvFallback,
} from "../infra/shell-env.js";
import {
  collectRelevantDoctorPluginIds,
  listPluginDoctorLegacyConfigRules,
} from "../plugins/doctor-contract-registry.js";
import { sanitizeTerminalText } from "../terminal/safe-text.js";
import { isRecord } from "../utils.js";
import { VERSION } from "../version.js";
import { DuplicateAgentDirError, findDuplicateAgentDirs } from "./agent-dirs.js";
import { maintainConfigBackups } from "./backup-rotation.js";
import { restoreEnvVarRefs } from "./env-preserve.js";
import {
  type EnvSubstitutionWarning,
  MissingEnvVarError,
  containsEnvVarReference,
  resolveConfigEnvVars,
} from "./env-substitution.js";
import { applyConfigEnvVars } from "./env-vars.js";
import {
  ConfigIncludeError,
  readConfigIncludeFileWithGuards,
  resolveConfigIncludes,
} from "./includes.js";
import {
  appendConfigAuditRecord,
  appendConfigAuditRecordSync,
  createConfigWriteAuditRecordBase,
  finalizeConfigWriteAuditRecord,
  formatConfigOverwriteLogMessage,
  type ConfigWriteAuditResult,
} from "./io.audit.js";
import { throwInvalidConfig } from "./io.invalid-config.js";
import {
  maybeRecoverSuspiciousConfigRead,
  maybeRecoverSuspiciousConfigReadSync,
} from "./io.observe-recovery.js";
import { persistGeneratedOwnerDisplaySecret } from "./io.owner-display-secret.js";
import {
  collectChangedPaths,
  createMergePatch,
  formatConfigValidationFailure,
  projectSourceOntoRuntimeShape,
  restoreEnvRefsFromMap,
  resolvePersistCandidateForWrite,
  resolveWriteEnvSnapshotForPath,
  unsetPathForWrite,
} from "./io.write-prepare.js";
import { findLegacyConfigIssues } from "./legacy.js";
import { pruneInactiveGatewayAuthCredentials } from "./gateway-auth-cleanup.js";
import {
  asResolvedSourceConfig,
  asRuntimeConfig,
  materializeRuntimeConfig,
} from "./materialize.js";
import { applyMergePatch } from "./merge-patch.js";
import { resolveConfigPath, resolveStateDir } from "./paths.js";
import { applyConfigOverrides } from "./runtime-overrides.js";
import {
  clearRuntimeConfigSnapshot as clearRuntimeConfigSnapshotState,
  finalizeRuntimeSnapshotWrite,
  getRuntimeConfigSnapshot as getRuntimeConfigSnapshotState,
  getRuntimeConfigSourceSnapshot as getRuntimeConfigSourceSnapshotState,
  loadPinnedRuntimeConfig,
  notifyRuntimeConfigWriteListeners,
  registerRuntimeConfigWriteListener,
  resetConfigRuntimeState as resetConfigRuntimeStateState,
  setRuntimeConfigSnapshot as setRuntimeConfigSnapshotState,
  getRuntimeConfigSnapshotRefreshHandler as getRuntimeConfigSnapshotRefreshHandlerState,
  setRuntimeConfigSnapshotRefreshHandler as setRuntimeConfigSnapshotRefreshHandlerState,
  type RuntimeConfigWriteNotification,
} from "./runtime-snapshot.js";
import { resolveShellEnvExpectedKeys } from "./shell-env-expected-keys.js";
import type { ZhushouConfig, ConfigFileSnapshot, LegacyConfigIssue } from "./types.js";
import {
  validateConfigObjectRawWithPlugins,
  validateConfigObjectWithPlugins,
} from "./validation.js";
import { shouldWarnOnTouchedVersion } from "./version.js";

export {
  clearRuntimeConfigSnapshotState as clearRuntimeConfigSnapshot,
  getRuntimeConfigSnapshotState as getRuntimeConfigSnapshot,
  getRuntimeConfigSourceSnapshotState as getRuntimeConfigSourceSnapshot,
  resetConfigRuntimeStateState as resetConfigRuntimeState,
  setRuntimeConfigSnapshotState as setRuntimeConfigSnapshot,
  setRuntimeConfigSnapshotRefreshHandlerState as setRuntimeConfigSnapshotRefreshHandler,
};

// 向后兼容的重导出
export { CircularIncludeError, ConfigIncludeError } from "./includes.js";
export { MissingEnvVarError } from "./env-substitution.js";
export { resolveShellEnvExpectedKeys } from "./shell-env-expected-keys.js";

const CONFIG_HEALTH_STATE_FILENAME = "config-health.json";
const loggedInvalidConfigs = new Set<string>();

type ConfigHealthFingerprint = {
  hash: string;
  bytes: number;
  mtimeMs: number | null;
  ctimeMs: number | null;
  dev: string | null;
  ino: string | null;
  mode: number | null;
  nlink: number | null;
  uid: number | null;
  gid: number | null;
  hasMeta: boolean;
  gatewayMode: string | null;
  observedAt: string;
};

type ConfigHealthEntry = {
  lastKnownGood?: ConfigHealthFingerprint;
  lastObservedSuspiciousSignature?: string | null;
};

type ConfigHealthState = {
  entries?: Record<string, ConfigHealthEntry>;
};

export type ParseConfigJson5Result = { ok: true; parsed: unknown } | { ok: false; error: string };
export type ConfigWriteOptions = {
  /**
   * 读取时的环境变量快照，用于验证 `${VAR}` 还原决策。
   * 若省略，写入回退到当前进程环境。
   */
  envSnapshotForRestore?: Record<string, string | undefined>;
  /**
   * 可选安全检查：仅在写入产生快照的同一配置文件路径时
   * 使用 envSnapshotForRestore。
   */
  expectedConfigPath?: string;
  /**
   * 必须从持久化文件载荷中显式移除的路径，
   * 即使模式/默认规范化会重新引入它们。
   */
  unsetPaths?: string[][];
  /**
   * 内部快速路径，供已持有新鲜配置快照的调用者使用。
   * 避免为准备即时写入而重新读取完整配置。
   */
  baseSnapshot?: ConfigFileSnapshot;
  /**
   * 内部一次性 CLI 快速路径。当无运行时快照处于活动状态时，
   * 完全跳过写入后的运行时快照刷新/重载尾部。
   */
  skipRuntimeSnapshotRefresh?: boolean;
};

export type ReadConfigFileSnapshotForWriteResult = {
  snapshot: ConfigFileSnapshot;
  writeOptions: ConfigWriteOptions;
};

export type ConfigWriteNotification = RuntimeConfigWriteNotification;

export class ConfigRuntimeRefreshError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ConfigRuntimeRefreshError";
  }
}

function hashConfigRaw(raw: string | null): string {
  return crypto
    .createHash("sha256")
    .update(raw ?? "")
    .digest("hex");
}

async function tightenStateDirPermissionsIfNeeded(params: {
  configPath: string;
  env: NodeJS.ProcessEnv;
  homedir: () => string;
  fsModule: typeof fs;
}): Promise<void> {
  if (process.platform === "win32") {
    return;
  }
  const stateDir = resolveStateDir(params.env, params.homedir);
  const configDir = path.dirname(params.configPath);
  if (path.resolve(configDir) !== path.resolve(stateDir)) {
    return;
  }
  try {
    const stat = await params.fsModule.promises.stat(configDir);
    const mode = stat.mode & 0o777;
    if ((mode & 0o077) === 0) {
      return;
    }
    await params.fsModule.promises.chmod(configDir, 0o700);
  } catch {
    // 尽力加固；调用者仍需继续配置写入。
  }
}

export function resolveConfigSnapshotHash(snapshot: {
  hash?: string;
  raw?: string | null;
}): string | null {
  if (typeof snapshot.hash === "string") {
    const trimmed = snapshot.hash.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  if (typeof snapshot.raw !== "string") {
    return null;
  }
  return hashConfigRaw(snapshot.raw);
}

function coerceConfig(value: unknown): ZhushouConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as ZhushouConfig;
}

function hasConfigMeta(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const meta = value.meta;
  return isRecord(meta);
}

function resolveGatewayMode(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  const gateway = value.gateway;
  if (!isRecord(gateway) || typeof gateway.mode !== "string") {
    return null;
  }
  const trimmed = gateway.mode.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function collectEnvRefPaths(value: unknown, path: string, output: Map<string, string>): void {
  if (typeof value === "string") {
    if (containsEnvVarReference(value)) {
      output.set(path, value);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectEnvRefPaths(item, `${path}[${index}]`, output);
    });
    return;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      collectEnvRefPaths(child, childPath, output);
    }
  }
}

function resolveConfigHealthStatePath(env: NodeJS.ProcessEnv, homedir: () => string): string {
  return path.join(resolveStateDir(env, homedir), "logs", CONFIG_HEALTH_STATE_FILENAME);
}

function normalizeStatNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeStatId(value: number | bigint | null | undefined): string | null {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function resolveConfigStatMetadata(
  stat: fs.Stats | null,
): Pick<ConfigHealthFingerprint, "dev" | "ino" | "mode" | "nlink" | "uid" | "gid"> {
  return {
    dev: normalizeStatId(stat?.dev ?? null),
    ino: normalizeStatId(stat?.ino ?? null),
    mode: normalizeStatNumber(stat ? stat.mode & 0o777 : null),
    nlink: normalizeStatNumber(stat?.nlink ?? null),
    uid: normalizeStatNumber(stat?.uid ?? null),
    gid: normalizeStatNumber(stat?.gid ?? null),
  };
}

function resolveConfigWriteSuspiciousReasons(params: {
  existsBefore: boolean;
  previousBytes: number | null;
  nextBytes: number | null;
  hasMetaBefore: boolean;
  gatewayModeBefore: string | null;
  gatewayModeAfter: string | null;
}): string[] {
  const reasons: string[] = [];
  if (!params.existsBefore) {
    return reasons;
  }
  if (
    typeof params.previousBytes === "number" &&
    typeof params.nextBytes === "number" &&
    params.previousBytes >= 512 &&
    params.nextBytes < Math.floor(params.previousBytes * 0.5)
  ) {
    reasons.push(`size-drop:${params.previousBytes}->${params.nextBytes}`);
  }
  if (!params.hasMetaBefore) {
    reasons.push("missing-meta-before-write");
  }
  if (params.gatewayModeBefore && !params.gatewayModeAfter) {
    reasons.push("gateway-mode-removed");
  }
  return reasons;
}

async function readConfigHealthState(deps: Required<ConfigIoDeps>): Promise<ConfigHealthState> {
  try {
    const healthPath = resolveConfigHealthStatePath(deps.env, deps.homedir);
    const raw = await deps.fs.promises.readFile(healthPath, "utf-8");
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? (parsed as ConfigHealthState) : {};
  } catch {
    return {};
  }
}

function readConfigHealthStateSync(deps: Required<ConfigIoDeps>): ConfigHealthState {
  try {
    const healthPath = resolveConfigHealthStatePath(deps.env, deps.homedir);
    const raw = deps.fs.readFileSync(healthPath, "utf-8");
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? (parsed as ConfigHealthState) : {};
  } catch {
    return {};
  }
}

async function writeConfigHealthState(
  deps: Required<ConfigIoDeps>,
  state: ConfigHealthState,
): Promise<void> {
  try {
    const healthPath = resolveConfigHealthStatePath(deps.env, deps.homedir);
    await deps.fs.promises.mkdir(path.dirname(healthPath), { recursive: true, mode: 0o700 });
    await deps.fs.promises.writeFile(healthPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf-8",
      mode: 0o600,
    });
  } catch {
    // 尽力而为
  }
}

function writeConfigHealthStateSync(deps: Required<ConfigIoDeps>, state: ConfigHealthState): void {
  try {
    const healthPath = resolveConfigHealthStatePath(deps.env, deps.homedir);
    deps.fs.mkdirSync(path.dirname(healthPath), { recursive: true, mode: 0o700 });
    deps.fs.writeFileSync(healthPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf-8",
      mode: 0o600,
    });
  } catch {
    // 尽力而为
  }
}

function getConfigHealthEntry(state: ConfigHealthState, configPath: string): ConfigHealthEntry {
  const entries = state.entries;
  if (!entries || !isRecord(entries)) {
    return {};
  }
  const entry = entries[configPath];
  return entry && isRecord(entry) ? entry : {};
}

function setConfigHealthEntry(
  state: ConfigHealthState,
  configPath: string,
  entry: ConfigHealthEntry,
): ConfigHealthState {
  return {
    ...state,
    entries: {
      ...state.entries,
      [configPath]: entry,
    },
  };
}

function isUpdateChannelOnlyRoot(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "update") {
    return false;
  }
  const update = value.update;
  if (!isRecord(update)) {
    return false;
  }
  const updateKeys = Object.keys(update);
  return updateKeys.length === 1 && typeof update.channel === "string";
}

function resolveConfigObserveSuspiciousReasons(params: {
  bytes: number;
  hasMeta: boolean;
  gatewayMode: string | null;
  parsed: unknown;
  lastKnownGood?: ConfigHealthFingerprint;
}): string[] {
  const reasons: string[] = [];
  const baseline = params.lastKnownGood;
  if (!baseline) {
    return reasons;
  }
  if (baseline.bytes >= 512 && params.bytes < Math.floor(baseline.bytes * 0.5)) {
    reasons.push(`size-drop-vs-last-good:${baseline.bytes}->${params.bytes}`);
  }
  if (baseline.hasMeta && !params.hasMeta) {
    reasons.push("missing-meta-vs-last-good");
  }
  if (baseline.gatewayMode && !params.gatewayMode) {
    reasons.push("gateway-mode-missing-vs-last-good");
  }
  if (baseline.gatewayMode && isUpdateChannelOnlyRoot(params.parsed)) {
    reasons.push("update-channel-only-root");
  }
  return reasons;
}

async function readConfigFingerprintForPath(
  deps: Required<ConfigIoDeps>,
  targetPath: string,
): Promise<ConfigHealthFingerprint | null> {
  try {
    const raw = await deps.fs.promises.readFile(targetPath, "utf-8");
    const stat = await deps.fs.promises.stat(targetPath).catch(() => null);
    const parsedRes = parseConfigJson5(raw, deps.json5);
    const parsed = parsedRes.ok ? parsedRes.parsed : {};
    return {
      hash: hashConfigRaw(raw),
      bytes: Buffer.byteLength(raw, "utf-8"),
      mtimeMs: stat?.mtimeMs ?? null,
      ctimeMs: stat?.ctimeMs ?? null,
      ...resolveConfigStatMetadata(stat),
      hasMeta: hasConfigMeta(parsed),
      gatewayMode: resolveGatewayMode(parsed),
      observedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function readConfigFingerprintForPathSync(
  deps: Required<ConfigIoDeps>,
  targetPath: string,
): ConfigHealthFingerprint | null {
  try {
    const raw = deps.fs.readFileSync(targetPath, "utf-8");
    const stat = deps.fs.statSync(targetPath, { throwIfNoEntry: false }) ?? null;
    const parsedRes = parseConfigJson5(raw, deps.json5);
    const parsed = parsedRes.ok ? parsedRes.parsed : {};
    return {
      hash: hashConfigRaw(raw),
      bytes: Buffer.byteLength(raw, "utf-8"),
      mtimeMs: stat?.mtimeMs ?? null,
      ctimeMs: stat?.ctimeMs ?? null,
      ...resolveConfigStatMetadata(stat),
      hasMeta: hasConfigMeta(parsed),
      gatewayMode: resolveGatewayMode(parsed),
      observedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function formatConfigArtifactTimestamp(ts: string): string {
  return ts.replaceAll(":", "-").replaceAll(".", "-");
}

async function persistClobberedConfigSnapshot(params: {
  deps: Required<ConfigIoDeps>;
  configPath: string;
  raw: string;
  observedAt: string;
}): Promise<string | null> {
  const targetPath = `${params.configPath}.clobbered.${formatConfigArtifactTimestamp(params.observedAt)}`;
  try {
    await params.deps.fs.promises.writeFile(targetPath, params.raw, {
      encoding: "utf-8",
      mode: 0o600,
      flag: "wx",
    });
    return targetPath;
  } catch {
    return null;
  }
}

function persistClobberedConfigSnapshotSync(params: {
  deps: Required<ConfigIoDeps>;
  configPath: string;
  raw: string;
  observedAt: string;
}): string | null {
  const targetPath = `${params.configPath}.clobbered.${formatConfigArtifactTimestamp(params.observedAt)}`;
  try {
    params.deps.fs.writeFileSync(targetPath, params.raw, {
      encoding: "utf-8",
      mode: 0o600,
      flag: "wx",
    });
    return targetPath;
  } catch {
    return null;
  }
}

function sameFingerprint(
  left: ConfigHealthFingerprint | undefined,
  right: ConfigHealthFingerprint,
): boolean {
  if (!left) {
    return false;
  }
  return (
    left.hash === right.hash &&
    left.bytes === right.bytes &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.uid === right.uid &&
    left.gid === right.gid &&
    left.hasMeta === right.hasMeta &&
    left.gatewayMode === right.gatewayMode
  );
}

async function observeConfigSnapshot(
  deps: Required<ConfigIoDeps>,
  snapshot: ConfigFileSnapshot,
): Promise<void> {
  if (!snapshot.exists || typeof snapshot.raw !== "string") {
    return;
  }

  const stat = await deps.fs.promises.stat(snapshot.path).catch(() => null);
  const now = new Date().toISOString();
  const current: ConfigHealthFingerprint = {
    hash: resolveConfigSnapshotHash(snapshot) ?? hashConfigRaw(snapshot.raw),
    bytes: Buffer.byteLength(snapshot.raw, "utf-8"),
    mtimeMs: stat?.mtimeMs ?? null,
    ctimeMs: stat?.ctimeMs ?? null,
    ...resolveConfigStatMetadata(stat),
    hasMeta: hasConfigMeta(snapshot.parsed),
    gatewayMode: resolveGatewayMode(snapshot.resolved),
    observedAt: now,
  };

  let healthState = await readConfigHealthState(deps);
  const entry = getConfigHealthEntry(healthState, snapshot.path);
  const backupBaseline =
    entry.lastKnownGood ??
    (await readConfigFingerprintForPath(deps, `${snapshot.path}.bak`)) ??
    undefined;
  const suspicious = resolveConfigObserveSuspiciousReasons({
    bytes: current.bytes,
    hasMeta: current.hasMeta,
    gatewayMode: current.gatewayMode,
    parsed: snapshot.parsed,
    lastKnownGood: backupBaseline,
  });

  if (suspicious.length === 0) {
    if (snapshot.valid) {
      const nextEntry: ConfigHealthEntry = {
        lastKnownGood: current,
        lastObservedSuspiciousSignature: null,
      };
      if (
        !sameFingerprint(entry.lastKnownGood, current) ||
        entry.lastObservedSuspiciousSignature !== null
      ) {
        healthState = setConfigHealthEntry(healthState, snapshot.path, nextEntry);
        await writeConfigHealthState(deps, healthState);
      }
    }
    return;
  }

  const suspiciousSignature = `${current.hash}:${suspicious.join(",")}`;
  if (entry.lastObservedSuspiciousSignature === suspiciousSignature) {
    return;
  }

  const backup =
    (backupBaseline?.hash ? backupBaseline : null) ??
    (await readConfigFingerprintForPath(deps, `${snapshot.path}.bak`));
  const clobberedPath = await persistClobberedConfigSnapshot({
    deps,
    configPath: snapshot.path,
    raw: snapshot.raw,
    observedAt: now,
  });

  deps.logger.warn(`Config observe anomaly: ${snapshot.path} (${suspicious.join(", ")})`);
  await appendConfigAuditRecord({
    fs: deps.fs,
    env: deps.env,
    homedir: deps.homedir,
    record: {
      ts: now,
      source: "config-io",
      event: "config.observe",
      phase: "read",
      configPath: snapshot.path,
      pid: process.pid,
      ppid: process.ppid,
      cwd: process.cwd(),
      argv: process.argv.slice(0, 8),
      execArgv: process.execArgv.slice(0, 8),
      exists: true,
      valid: snapshot.valid,
      hash: current.hash,
      bytes: current.bytes,
      mtimeMs: current.mtimeMs,
      ctimeMs: current.ctimeMs,
      dev: current.dev,
      ino: current.ino,
      mode: current.mode,
      nlink: current.nlink,
      uid: current.uid,
      gid: current.gid,
      hasMeta: current.hasMeta,
      gatewayMode: current.gatewayMode,
      suspicious,
      lastKnownGoodHash: entry.lastKnownGood?.hash ?? null,
      lastKnownGoodBytes: entry.lastKnownGood?.bytes ?? null,
      lastKnownGoodMtimeMs: entry.lastKnownGood?.mtimeMs ?? null,
      lastKnownGoodCtimeMs: entry.lastKnownGood?.ctimeMs ?? null,
      lastKnownGoodDev: entry.lastKnownGood?.dev ?? null,
      lastKnownGoodIno: entry.lastKnownGood?.ino ?? null,
      lastKnownGoodMode: entry.lastKnownGood?.mode ?? null,
      lastKnownGoodNlink: entry.lastKnownGood?.nlink ?? null,
      lastKnownGoodUid: entry.lastKnownGood?.uid ?? null,
      lastKnownGoodGid: entry.lastKnownGood?.gid ?? null,
      lastKnownGoodGatewayMode: entry.lastKnownGood?.gatewayMode ?? null,
      backupHash: backup?.hash ?? null,
      backupBytes: backup?.bytes ?? null,
      backupMtimeMs: backup?.mtimeMs ?? null,
      backupCtimeMs: backup?.ctimeMs ?? null,
      backupDev: backup?.dev ?? null,
      backupIno: backup?.ino ?? null,
      backupMode: backup?.mode ?? null,
      backupNlink: backup?.nlink ?? null,
      backupUid: backup?.uid ?? null,
      backupGid: backup?.gid ?? null,
      backupGatewayMode: backup?.gatewayMode ?? null,
      clobberedPath,
      restoredFromBackup: false,
      restoredBackupPath: null,
    },
  });

  healthState = setConfigHealthEntry(healthState, snapshot.path, {
    ...entry,
    lastObservedSuspiciousSignature: suspiciousSignature,
  });
  await writeConfigHealthState(deps, healthState);
}

function observeConfigSnapshotSync(
  deps: Required<ConfigIoDeps>,
  snapshot: ConfigFileSnapshot,
): void {
  if (!snapshot.exists || typeof snapshot.raw !== "string") {
    return;
  }

  const stat = deps.fs.statSync(snapshot.path, { throwIfNoEntry: false }) ?? null;
  const now = new Date().toISOString();
  const current: ConfigHealthFingerprint = {
    hash: resolveConfigSnapshotHash(snapshot) ?? hashConfigRaw(snapshot.raw),
    bytes: Buffer.byteLength(snapshot.raw, "utf-8"),
    mtimeMs: stat?.mtimeMs ?? null,
    ctimeMs: stat?.ctimeMs ?? null,
    ...resolveConfigStatMetadata(stat),
    hasMeta: hasConfigMeta(snapshot.parsed),
    gatewayMode: resolveGatewayMode(snapshot.resolved),
    observedAt: now,
  };

  let healthState = readConfigHealthStateSync(deps);
  const entry = getConfigHealthEntry(healthState, snapshot.path);
  const backupBaseline =
    entry.lastKnownGood ??
    readConfigFingerprintForPathSync(deps, `${snapshot.path}.bak`) ??
    undefined;
  const suspicious = resolveConfigObserveSuspiciousReasons({
    bytes: current.bytes,
    hasMeta: current.hasMeta,
    gatewayMode: current.gatewayMode,
    parsed: snapshot.parsed,
    lastKnownGood: backupBaseline,
  });

  if (suspicious.length === 0) {
    if (snapshot.valid) {
      const nextEntry: ConfigHealthEntry = {
        lastKnownGood: current,
        lastObservedSuspiciousSignature: null,
      };
      if (
        !sameFingerprint(entry.lastKnownGood, current) ||
        entry.lastObservedSuspiciousSignature !== null
      ) {
        healthState = setConfigHealthEntry(healthState, snapshot.path, nextEntry);
        writeConfigHealthStateSync(deps, healthState);
      }
    }
    return;
  }

  const suspiciousSignature = `${current.hash}:${suspicious.join(",")}`;
  if (entry.lastObservedSuspiciousSignature === suspiciousSignature) {
    return;
  }

  const backup =
    (backupBaseline?.hash ? backupBaseline : null) ??
    readConfigFingerprintForPathSync(deps, `${snapshot.path}.bak`);
  const clobberedPath = persistClobberedConfigSnapshotSync({
    deps,
    configPath: snapshot.path,
    raw: snapshot.raw,
    observedAt: now,
  });

  deps.logger.warn(`Config observe anomaly: ${snapshot.path} (${suspicious.join(", ")})`);
  appendConfigAuditRecordSync({
    fs: deps.fs,
    env: deps.env,
    homedir: deps.homedir,
    record: {
      ts: now,
      source: "config-io",
      event: "config.observe",
      phase: "read",
      configPath: snapshot.path,
      pid: process.pid,
      ppid: process.ppid,
      cwd: process.cwd(),
      argv: process.argv.slice(0, 8),
      execArgv: process.execArgv.slice(0, 8),
      exists: true,
      valid: snapshot.valid,
      hash: current.hash,
      bytes: current.bytes,
      mtimeMs: current.mtimeMs,
      ctimeMs: current.ctimeMs,
      dev: current.dev,
      ino: current.ino,
      mode: current.mode,
      nlink: current.nlink,
      uid: current.uid,
      gid: current.gid,
      hasMeta: current.hasMeta,
      gatewayMode: current.gatewayMode,
      suspicious,
      lastKnownGoodHash: entry.lastKnownGood?.hash ?? null,
      lastKnownGoodBytes: entry.lastKnownGood?.bytes ?? null,
      lastKnownGoodMtimeMs: entry.lastKnownGood?.mtimeMs ?? null,
      lastKnownGoodCtimeMs: entry.lastKnownGood?.ctimeMs ?? null,
      lastKnownGoodDev: entry.lastKnownGood?.dev ?? null,
      lastKnownGoodIno: entry.lastKnownGood?.ino ?? null,
      lastKnownGoodMode: entry.lastKnownGood?.mode ?? null,
      lastKnownGoodNlink: entry.lastKnownGood?.nlink ?? null,
      lastKnownGoodUid: entry.lastKnownGood?.uid ?? null,
      lastKnownGoodGid: entry.lastKnownGood?.gid ?? null,
      lastKnownGoodGatewayMode: entry.lastKnownGood?.gatewayMode ?? null,
      backupHash: backup?.hash ?? null,
      backupBytes: backup?.bytes ?? null,
      backupMtimeMs: backup?.mtimeMs ?? null,
      backupCtimeMs: backup?.ctimeMs ?? null,
      backupDev: backup?.dev ?? null,
      backupIno: backup?.ino ?? null,
      backupMode: backup?.mode ?? null,
      backupNlink: backup?.nlink ?? null,
      backupUid: backup?.uid ?? null,
      backupGid: backup?.gid ?? null,
      backupGatewayMode: backup?.gatewayMode ?? null,
      clobberedPath,
      restoredFromBackup: false,
      restoredBackupPath: null,
    },
  });

  healthState = setConfigHealthEntry(healthState, snapshot.path, {
    ...entry,
    lastObservedSuspiciousSignature: suspiciousSignature,
  });
  writeConfigHealthStateSync(deps, healthState);
}

export type ConfigIoDeps = {
  fs?: typeof fs;
  json5?: typeof JSON5;
  env?: NodeJS.ProcessEnv;
  homedir?: () => string;
  configPath?: string;
  logger?: Pick<typeof console, "error" | "warn">;
};

function warnOnConfigMiskeys(raw: unknown, logger: Pick<typeof console, "warn">): void {
  if (!raw || typeof raw !== "object") {
    return;
  }
  const gateway = (raw as Record<string, unknown>).gateway;
  if (!gateway || typeof gateway !== "object") {
    return;
  }
  if ("token" in (gateway as Record<string, unknown>)) {
    logger.warn(
      'Config uses "gateway.token". This key is ignored; use "gateway.auth.token" instead.',
    );
  }
}

function stampConfigVersion(cfg: ZhushouConfig): ZhushouConfig {
  const now = new Date().toISOString();
  return {
    ...cfg,
    meta: {
      ...cfg.meta,
      lastTouchedVersion: VERSION,
      lastTouchedAt: now,
    },
  };
}

function warnIfConfigFromFuture(cfg: ZhushouConfig, logger: Pick<typeof console, "warn">): void {
  const touched = cfg.meta?.lastTouchedVersion;
  if (!touched) {
    return;
  }
  if (shouldWarnOnTouchedVersion(VERSION, touched)) {
    logger.warn(
      `Config was last written by a newer 助手 (${touched}); current version is ${VERSION}.`,
    );
  }
}

function resolveConfigPathForDeps(deps: Required<ConfigIoDeps>): string {
  if (deps.configPath) {
    return deps.configPath;
  }
  return resolveConfigPath(deps.env, resolveStateDir(deps.env, deps.homedir));
}

function normalizeDeps(overrides: ConfigIoDeps = {}): Required<ConfigIoDeps> {
  return {
    fs: overrides.fs ?? fs,
    json5: overrides.json5 ?? JSON5,
    env: overrides.env ?? process.env,
    homedir:
      overrides.homedir ?? (() => resolveRequiredHomeDir(overrides.env ?? process.env, os.homedir)),
    configPath: overrides.configPath ?? "",
    logger: overrides.logger ?? console,
  };
}

function maybeLoadDotEnvForConfig(env: NodeJS.ProcessEnv): void {
  // 仅为真实进程环境加载 dotenv。使用注入 env 对象的
  // 调用者（测试/诊断）应保持隔离。
  if (env !== process.env) {
    return;
  }
  loadDotEnv({ quiet: true });
}

export function parseConfigJson5(
  raw: string,
  json5: { parse: (value: string) => unknown } = JSON5,
): ParseConfigJson5Result {
  try {
    return { ok: true, parsed: json5.parse(raw) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

type ConfigReadResolution = {
  resolvedConfigRaw: unknown;
  envSnapshotForRestore: Record<string, string | undefined>;
  envWarnings: EnvSubstitutionWarning[];
};

type LegacyMigrationResolution = {
  effectiveConfigRaw: unknown;
  sourceLegacyIssues: LegacyConfigIssue[];
};

function resolveConfigIncludesForRead(
  parsed: unknown,
  configPath: string,
  deps: Required<ConfigIoDeps>,
): unknown {
  return resolveConfigIncludes(parsed, configPath, {
    readFile: (candidate) => deps.fs.readFileSync(candidate, "utf-8"),
    readFileWithGuards: ({ includePath, resolvedPath, rootRealDir }) =>
      readConfigIncludeFileWithGuards({
        includePath,
        resolvedPath,
        rootRealDir,
        ioFs: deps.fs,
      }),
    parseJson: (raw) => deps.json5.parse(raw),
  });
}

function resolveConfigForRead(
  resolvedIncludes: unknown,
  env: NodeJS.ProcessEnv,
): ConfigReadResolution {
  // 在替换前将 config.env 应用到 process.env，以便 ${VAR} 可引用配置定义的变量。
  if (resolvedIncludes && typeof resolvedIncludes === "object" && "env" in resolvedIncludes) {
    applyConfigEnvVars(resolvedIncludes as ZhushouConfig, env);
  }

  // 将缺失的环境变量引用收集为警告而非抛出异常，
  // 以免非关键配置段中未设置的变量导致网关崩溃。
  const envWarnings: EnvSubstitutionWarning[] = [];
  return {
    resolvedConfigRaw: resolveConfigEnvVars(resolvedIncludes, env, {
      onMissing: (w) => envWarnings.push(w),
    }),
    // 替换后捕获环境变量快照，用于写入时 ${VAR} 还原。
    envSnapshotForRestore: { ...env } as Record<string, string | undefined>,
    envWarnings,
  };
}

function resolveLegacyConfigForRead(
  resolvedConfigRaw: unknown,
  sourceRaw: unknown,
): LegacyMigrationResolution {
  const pluginIds = collectRelevantDoctorPluginIds(resolvedConfigRaw);
  const sourceLegacyIssues = findLegacyConfigIssues(
    resolvedConfigRaw,
    sourceRaw,
    listPluginDoctorLegacyConfigRules({ pluginIds }),
  );
  if (!resolvedConfigRaw || typeof resolvedConfigRaw !== "object") {
    return { effectiveConfigRaw: resolvedConfigRaw, sourceLegacyIssues };
  }
  const compat = applyRuntimeLegacyConfigMigrations(resolvedConfigRaw);
  return {
    effectiveConfigRaw: compat.next ?? resolvedConfigRaw,
    sourceLegacyIssues,
  };
}

type ReadConfigFileSnapshotInternalResult = {
  snapshot: ConfigFileSnapshot;
  envSnapshotForRestore?: Record<string, string | undefined>;
};

function createConfigFileSnapshot(params: {
  path: string;
  exists: boolean;
  raw: string | null;
  parsed: unknown;
  sourceConfig: ZhushouConfig;
  valid: boolean;
  runtimeConfig: ZhushouConfig;
  hash?: string;
  issues: ConfigFileSnapshot["issues"];
  warnings: ConfigFileSnapshot["warnings"];
  legacyIssues: LegacyConfigIssue[];
}): ConfigFileSnapshot {
  const sourceConfig = asResolvedSourceConfig(params.sourceConfig);
  const runtimeConfig = asRuntimeConfig(params.runtimeConfig);
  return {
    path: params.path,
    exists: params.exists,
    raw: params.raw,
    parsed: params.parsed,
    sourceConfig,
    resolved: sourceConfig,
    valid: params.valid,
    runtimeConfig,
    config: runtimeConfig,
    hash: params.hash,
    issues: params.issues,
    warnings: params.warnings,
    legacyIssues: params.legacyIssues,
  };
}

async function finalizeReadConfigSnapshotInternalResult(
  deps: Required<ConfigIoDeps>,
  result: ReadConfigFileSnapshotInternalResult,
): Promise<ReadConfigFileSnapshotInternalResult> {
  await observeConfigSnapshot(deps, result.snapshot);
  return result;
}

export function createConfigIO(overrides: ConfigIoDeps = {}) {
  const deps = normalizeDeps(overrides);
  const configPath = resolveConfigPathForDeps(deps);

  function observeLoadConfigSnapshot(snapshot: ConfigFileSnapshot): ConfigFileSnapshot {
    observeConfigSnapshotSync(deps, snapshot);
    return snapshot;
  }

  function finalizeLoadedRuntimeConfig(cfg: ZhushouConfig): ZhushouConfig {
    const duplicates = findDuplicateAgentDirs(cfg, {
      env: deps.env,
      homedir: deps.homedir,
    });
    if (duplicates.length > 0) {
      throw new DuplicateAgentDirError(duplicates);
    }

    applyConfigEnvVars(cfg, deps.env);

    const enabled = shouldEnableShellEnvFallback(deps.env) || cfg.env?.shellEnv?.enabled === true;
    if (enabled && !shouldDeferShellEnvFallback(deps.env)) {
      loadShellEnvFallback({
        enabled: true,
        env: deps.env,
        expectedKeys: resolveShellEnvExpectedKeys(deps.env),
        logger: deps.logger,
        timeoutMs: cfg.env?.shellEnv?.timeoutMs ?? resolveShellEnvFallbackTimeoutMs(deps.env),
      });
    }

    const pendingSecret = AUTO_OWNER_DISPLAY_SECRET_BY_PATH.get(configPath);
    const ownerDisplaySecretResolution = ensureOwnerDisplaySecret(
      cfg,
      () => pendingSecret ?? crypto.randomBytes(32).toString("hex"),
    );
    const cfgWithOwnerDisplaySecret = persistGeneratedOwnerDisplaySecret({
      config: ownerDisplaySecretResolution.config,
      configPath,
      generatedSecret: ownerDisplaySecretResolution.generatedSecret,
      logger: deps.logger,
      state: {
        pendingByPath: AUTO_OWNER_DISPLAY_SECRET_BY_PATH,
        persistInFlight: AUTO_OWNER_DISPLAY_SECRET_PERSIST_IN_FLIGHT,
        persistWarned: AUTO_OWNER_DISPLAY_SECRET_PERSIST_WARNED,
      },
      persistConfig: (nextConfig, options) => writeConfigFile(nextConfig, options),
    });

    return applyConfigOverrides(cfgWithOwnerDisplaySecret);
  }

  function loadConfig(): ZhushouConfig {
    try {
      maybeLoadDotEnvForConfig(deps.env);
      if (!deps.fs.existsSync(configPath)) {
        if (shouldEnableShellEnvFallback(deps.env) && !shouldDeferShellEnvFallback(deps.env)) {
          loadShellEnvFallback({
            enabled: true,
            env: deps.env,
            expectedKeys: resolveShellEnvExpectedKeys(deps.env),
            logger: deps.logger,
            timeoutMs: resolveShellEnvFallbackTimeoutMs(deps.env),
          });
        }
        return {};
      }
      const raw = deps.fs.readFileSync(configPath, "utf-8");
      const parsed = deps.json5.parse(raw);
      const recovered = maybeRecoverSuspiciousConfigReadSync({
        deps,
        configPath,
        raw,
        parsed,
      });
      const effectiveRaw = recovered.raw;
      const effectiveParsed = recovered.parsed;
      const hash = hashConfigRaw(effectiveRaw);
      const readResolution = resolveConfigForRead(
        resolveConfigIncludesForRead(effectiveParsed, configPath, deps),
        deps.env,
      );
      const resolvedConfig = readResolution.resolvedConfigRaw;
      const legacyResolution = resolveLegacyConfigForRead(resolvedConfig, effectiveParsed);
      const effectiveConfigRaw = legacyResolution.effectiveConfigRaw;
      for (const w of readResolution.envWarnings) {
        deps.logger.warn(
          `Config (${configPath}): missing env var "${w.varName}" at ${w.configPath} - feature using this value will be unavailable`,
        );
      }
      warnOnConfigMiskeys(effectiveConfigRaw, deps.logger);
      if (typeof effectiveConfigRaw !== "object" || effectiveConfigRaw === null) {
        observeLoadConfigSnapshot({
          ...createConfigFileSnapshot({
            path: configPath,
            exists: true,
            raw: effectiveRaw,
            parsed: effectiveParsed,
            sourceConfig: {},
            valid: true,
            runtimeConfig: {},
            hash,
            issues: [],
            warnings: [],
            legacyIssues: legacyResolution.sourceLegacyIssues,
          }),
        });
        return {};
      }
      const preValidationDuplicates = findDuplicateAgentDirs(effectiveConfigRaw as ZhushouConfig, {
        env: deps.env,
        homedir: deps.homedir,
      });
      if (preValidationDuplicates.length > 0) {
        throw new DuplicateAgentDirError(preValidationDuplicates);
      }
      const validated = validateConfigObjectWithPlugins(effectiveConfigRaw, { env: deps.env });
      if (!validated.ok) {
        observeLoadConfigSnapshot({
          ...createConfigFileSnapshot({
            path: configPath,
            exists: true,
            raw: effectiveRaw,
            parsed: effectiveParsed,
            sourceConfig: coerceConfig(effectiveConfigRaw),
            valid: false,
            runtimeConfig: coerceConfig(effectiveConfigRaw),
            hash,
            issues: validated.issues,
            warnings: validated.warnings,
            legacyIssues: legacyResolution.sourceLegacyIssues,
          }),
        });
        throwInvalidConfig({
          configPath,
          issues: validated.issues,
          logger: deps.logger,
          loggedConfigPaths: loggedInvalidConfigs,
        });
      }
      if (validated.warnings.length > 0) {
        const details = validated.warnings
          .map(
            (iss) =>
              `- ${sanitizeTerminalText(iss.path || "<root>")}: ${sanitizeTerminalText(iss.message)}`,
          )
          .join("\n");
        deps.logger.warn(`Config warnings:\\n${details}`);
      }
      warnIfConfigFromFuture(validated.config, deps.logger);
      const cfg = materializeRuntimeConfig(validated.config, "load");
      observeLoadConfigSnapshot({
        ...createConfigFileSnapshot({
          path: configPath,
          exists: true,
          raw: effectiveRaw,
          parsed: effectiveParsed,
          sourceConfig: coerceConfig(effectiveConfigRaw),
          valid: true,
          runtimeConfig: cfg,
          hash,
          issues: [],
          warnings: validated.warnings,
          legacyIssues: legacyResolution.sourceLegacyIssues,
        }),
      });
      return finalizeLoadedRuntimeConfig(cfg);
    } catch (err) {
      if (err instanceof DuplicateAgentDirError) {
        deps.logger.error(err.message);
        throw err;
      }
      const error = err as { code?: string };
      if (error?.code === "INVALID_CONFIG") {
        // 失败关闭，使无效配置不能静默回退到宽松默认值。
        throw err;
      }
      deps.logger.error(`Failed to read config at ${configPath}`, err);
      throw err;
    }
  }

  async function readConfigFileSnapshotInternal(): Promise<ReadConfigFileSnapshotInternalResult> {
    maybeLoadDotEnvForConfig(deps.env);
    const exists = deps.fs.existsSync(configPath);
    if (!exists) {
      const hash = hashConfigRaw(null);
      const config = {};
      const legacyIssues: LegacyConfigIssue[] = [];
      return await finalizeReadConfigSnapshotInternalResult(deps, {
        snapshot: createConfigFileSnapshot({
          path: configPath,
          exists: false,
          raw: null,
          parsed: {},
          sourceConfig: {},
          valid: true,
          runtimeConfig: config,
          hash,
          issues: [],
          warnings: [],
          legacyIssues,
        }),
      });
    }

    try {
      const raw = deps.fs.readFileSync(configPath, "utf-8");
      const rawHash = hashConfigRaw(raw);
      const parsedRes = parseConfigJson5(raw, deps.json5);
      if (!parsedRes.ok) {
        return await finalizeReadConfigSnapshotInternalResult(deps, {
          snapshot: createConfigFileSnapshot({
            path: configPath,
            exists: true,
            raw,
            parsed: {},
            sourceConfig: {},
            valid: false,
            runtimeConfig: {},
            hash: rawHash,
            issues: [{ path: "", message: `JSON5 parse failed: ${parsedRes.error}` }],
            warnings: [],
            legacyIssues: [],
          }),
        });
      }

      // Resolve $include directives
      const recovered = await maybeRecoverSuspiciousConfigRead({
        deps,
        configPath,
        raw,
        parsed: parsedRes.parsed,
      });
      const effectiveRaw = recovered.raw;
      const effectiveParsed = recovered.parsed;
      const hash = hashConfigRaw(effectiveRaw);

      let resolved: unknown;
      try {
        resolved = resolveConfigIncludesForRead(effectiveParsed, configPath, deps);
      } catch (err) {
        const message =
          err instanceof ConfigIncludeError
            ? err.message
            : `Include resolution failed: ${String(err)}`;
        return await finalizeReadConfigSnapshotInternalResult(deps, {
          snapshot: createConfigFileSnapshot({
            path: configPath,
            exists: true,
            raw: effectiveRaw,
            parsed: effectiveParsed,
            // 读取修复生效时，保留恢复的根文件载荷。
            sourceConfig: coerceConfig(effectiveParsed),
            valid: false,
            runtimeConfig: coerceConfig(effectiveParsed),
            hash,
            issues: [{ path: "", message }],
            warnings: [],
            legacyIssues: [],
          }),
        });
      }

      const readResolution = resolveConfigForRead(resolved, deps.env);

      // 将缺失的环境变量引用转为配置警告而非致命错误。
      // 这允许网关在降级模式下启动，当非关键配置段
      // 引用未设置的环境变量时（如可选的提供方 API 密钥）。
      const envVarWarnings = readResolution.envWarnings.map((w) => ({
        path: w.configPath,
        message: `Missing env var "${w.varName}" - feature using this value will be unavailable`,
      }));

      const resolvedConfigRaw = readResolution.resolvedConfigRaw;
      const legacyResolution = resolveLegacyConfigForRead(resolvedConfigRaw, effectiveParsed);
      const effectiveConfigRaw = legacyResolution.effectiveConfigRaw;
      const validated = validateConfigObjectWithPlugins(effectiveConfigRaw, { env: deps.env });
      if (!validated.ok) {
        return await finalizeReadConfigSnapshotInternalResult(deps, {
          snapshot: createConfigFileSnapshot({
            path: configPath,
            exists: true,
            raw: effectiveRaw,
            parsed: effectiveParsed,
            sourceConfig: coerceConfig(effectiveConfigRaw),
            valid: false,
            runtimeConfig: coerceConfig(effectiveConfigRaw),
            hash,
            issues: validated.issues,
            warnings: [...validated.warnings, ...envVarWarnings],
            legacyIssues: legacyResolution.sourceLegacyIssues,
          }),
        });
      }

      warnIfConfigFromFuture(validated.config, deps.logger);
      const snapshotConfig = materializeRuntimeConfig(validated.config, "snapshot");
      return await finalizeReadConfigSnapshotInternalResult(deps, {
        snapshot: createConfigFileSnapshot({
          path: configPath,
          exists: true,
          raw: effectiveRaw,
          parsed: effectiveParsed,
          // 使用 resolvedConfigRaw（在 $include 和 ${ENV} 替换后，但在运行时默认值之前）
          // 进行配置 set/unset 操作（issue #6070）
          sourceConfig: coerceConfig(effectiveConfigRaw),
          valid: true,
          runtimeConfig: snapshotConfig,
          hash,
          issues: [],
          warnings: [...validated.warnings, ...envVarWarnings],
          legacyIssues: legacyResolution.sourceLegacyIssues,
        }),
        envSnapshotForRestore: readResolution.envSnapshotForRestore,
      });
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      let message: string;
      if (nodeErr?.code === "EACCES") {
        // 权限拒绝 — 常见于 Docker/容器部署中，配置文件
        // 归 root 所有但网关以非 root 用户运行。
        const uid = process.getuid?.();
        const uidHint = typeof uid === "number" ? String(uid) : "$(id -u)";
        message = [
          `read failed: ${String(err)}`,
          ``,
          `Config file is not readable by the current process. If running in a container`,
          `or 1-click deployment, fix ownership with:`,
          `  chown ${uidHint} "${configPath}"`,
          `Then restart the gateway.`,
        ].join("\n");
        deps.logger.error(message);
      } else {
        message = `read failed: ${String(err)}`;
      }
      return await finalizeReadConfigSnapshotInternalResult(deps, {
        snapshot: createConfigFileSnapshot({
          path: configPath,
          exists: true,
          raw: null,
          parsed: {},
          sourceConfig: {},
          valid: false,
          runtimeConfig: {},
          hash: hashConfigRaw(null),
          issues: [{ path: "", message }],
          warnings: [],
          legacyIssues: [],
        }),
      });
    }
  }

  async function readConfigFileSnapshot(): Promise<ConfigFileSnapshot> {
    const result = await readConfigFileSnapshotInternal();
    return result.snapshot;
  }

  async function readConfigFileSnapshotForWrite(): Promise<ReadConfigFileSnapshotForWriteResult> {
    const result = await readConfigFileSnapshotInternal();
    return {
      snapshot: result.snapshot,
      writeOptions: {
        envSnapshotForRestore: result.envSnapshotForRestore,
        expectedConfigPath: configPath,
      },
    };
  }

  async function readBestEffortConfig(): Promise<ZhushouConfig> {
    const result = await readConfigFileSnapshotInternal();
    if (!result.snapshot.valid) {
      return result.snapshot.config;
    }
    return finalizeLoadedRuntimeConfig(
      materializeRuntimeConfig(result.snapshot.sourceConfig, "load"),
    );
  }

  async function readSourceConfigBestEffort(): Promise<ZhushouConfig> {
    maybeLoadDotEnvForConfig(deps.env);
    const exists = deps.fs.existsSync(configPath);
    if (!exists) {
      return {};
    }

    try {
      const raw = deps.fs.readFileSync(configPath, "utf-8");
      const parsedRes = parseConfigJson5(raw, deps.json5);
      if (!parsedRes.ok) {
        return {};
      }

      const recovered = await maybeRecoverSuspiciousConfigRead({
        deps,
        configPath,
        raw,
        parsed: parsedRes.parsed,
      });

      let resolved: unknown;
      try {
        resolved = resolveConfigIncludesForRead(recovered.parsed, configPath, deps);
      } catch {
        return coerceConfig(recovered.parsed);
      }

      const readResolution = resolveConfigForRead(resolved, deps.env);
      const legacyResolution = resolveLegacyConfigForRead(
        readResolution.resolvedConfigRaw,
        recovered.parsed,
      );
      return coerceConfig(legacyResolution.effectiveConfigRaw);
    } catch {
      return {};
    }
  }

  async function writeConfigFile(
    cfg: ZhushouConfig,
    options: ConfigWriteOptions = {},
  ): Promise<{ persistedHash: string }> {
    clearConfigCache();
    let persistCandidate: unknown = cfg;
    const snapshot = options.baseSnapshot ?? (await readConfigFileSnapshotInternal()).snapshot;
    let envRefMap: Map<string, string> | null = null;
    let changedPaths: Set<string> | null = null;
    if (snapshot.valid && snapshot.exists) {
      persistCandidate = resolvePersistCandidateForWrite({
        runtimeConfig: snapshot.config,
        sourceConfig: snapshot.resolved,
        nextConfig: cfg,
      });
      try {
        const resolvedIncludes = resolveConfigIncludes(snapshot.parsed, configPath, {
          readFile: (candidate) => deps.fs.readFileSync(candidate, "utf-8"),
          readFileWithGuards: ({ includePath, resolvedPath, rootRealDir }) =>
            readConfigIncludeFileWithGuards({
              includePath,
              resolvedPath,
              rootRealDir,
              ioFs: deps.fs,
            }),
          parseJson: (raw) => deps.json5.parse(raw),
        });
        const collected = new Map<string, string>();
        collectEnvRefPaths(resolvedIncludes, "", collected);
        if (collected.size > 0) {
          envRefMap = collected;
          changedPaths = new Set<string>();
          collectChangedPaths(snapshot.config, cfg, "", changedPaths);
        }
      } catch {
        envRefMap = null;
      }
    }

    const validated = validateConfigObjectRawWithPlugins(persistCandidate, { env: deps.env });
    if (!validated.ok) {
      const issue = validated.issues[0];
      const pathLabel = issue?.path ? issue.path : "<root>";
      const issueMessage = issue?.message ?? "invalid";
      throw new Error(formatConfigValidationFailure(pathLabel, issueMessage));
    }
    if (validated.warnings.length > 0) {
      const details = validated.warnings
        .map((warning) => `- ${warning.path}: ${warning.message}`)
        .join("\n");
      deps.logger.warn(`Config warnings:\n${details}`);
    }

    // 还原在配置加载期间解析的 ${VAR} 环境变量引用。
    // 读取当前文件（替换前）并还原所有解析值
    // 与传入配置匹配的引用 — 以免在调用者未更改时
    // 用 "sk-ant-..." 覆盖 "${ANTHROPIC_API_KEY}"。
    //
    // 仅使用根文件的解析内容（无 $include 解析），以避免
    // 将被包含文件的值拉入根配置的回写中。
    // 使用 persistCandidate（验证前的合并补丁值）而非
    // validated.config，因为插件/通道 AJV 验证可能注入
    // 模式默认值（如 enrichGroupParticipantsFromContacts），这些
    // 不应持久化到磁盘（issue #56772）。
    // 应用旧版 web-search 规范化，以便迁移结果仍然
    // 被持久化，即使我们绕过了 validated.config。
    let cfgToWrite = persistCandidate as ZhushouConfig;
    try {
      if (deps.fs.existsSync(configPath)) {
        const currentRaw = await deps.fs.promises.readFile(configPath, "utf-8");
        const parsedRes = parseConfigJson5(currentRaw, deps.json5);
        if (parsedRes.ok) {
          // 使用配置加载时的环境变量快照（如可用），以避免
          // 加载与写入之间环境变量变化的 TOCTOU 问题。若
          // 无快照则回退到实时环境变量（如首次写入前未加载）。
          const envForRestore = options.envSnapshotForRestore ?? deps.env;
          cfgToWrite = restoreEnvVarRefs(
            cfgToWrite,
            parsedRes.parsed,
            envForRestore,
          ) as ZhushouConfig;
        }
      }
    } catch {
      // 如果读取当前文件失败，原样写入 cfg（不还原环境变量）
    }

    const dir = path.dirname(configPath);
    await deps.fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
    await tightenStateDirPermissionsIfNeeded({
      configPath,
      env: deps.env,
      homedir: deps.homedir,
      fsModule: deps.fs,
    });
    const outputConfigBase =
      envRefMap && changedPaths
        ? (restoreEnvRefsFromMap(cfgToWrite, "", envRefMap, changedPaths) as ZhushouConfig)
        : cfgToWrite;
    let outputConfig = structuredClone(outputConfigBase);
    pruneInactiveGatewayAuthCredentials(outputConfig as Record<string, unknown>);
    if (options.unsetPaths?.length) {
      for (const unsetPath of options.unsetPaths) {
        if (!Array.isArray(unsetPath) || unsetPath.length === 0) {
          continue;
        }
        const unsetResult = unsetPathForWrite(outputConfig, unsetPath);
        if (unsetResult.changed) {
          outputConfig = unsetResult.next;
        }
      }
    }
    // 写入时不要应用运行时默认值 — 用户配置应仅包含
    // 显式设置的值。运行时默认值在加载时应用（issue #6070）。
    const stampedOutputConfig = stampConfigVersion(outputConfig);
    const json = JSON.stringify(stampedOutputConfig, null, 2).trimEnd().concat("\n");
    const nextHash = hashConfigRaw(json);
    const previousHash = resolveConfigSnapshotHash(snapshot);
    const changedPathCount = changedPaths?.size;
    const previousBytes =
      typeof snapshot.raw === "string" ? Buffer.byteLength(snapshot.raw, "utf-8") : null;
    const nextBytes = Buffer.byteLength(json, "utf-8");
    const previousStat = snapshot.exists
      ? await deps.fs.promises.stat(configPath).catch(() => null)
      : null;
    const hasMetaBefore = hasConfigMeta(snapshot.parsed);
    const hasMetaAfter = hasConfigMeta(stampedOutputConfig);
    const gatewayModeBefore = resolveGatewayMode(snapshot.resolved);
    const gatewayModeAfter = resolveGatewayMode(stampedOutputConfig);
    const suspiciousReasons = resolveConfigWriteSuspiciousReasons({
      existsBefore: snapshot.exists,
      previousBytes,
      nextBytes,
      hasMetaBefore,
      gatewayModeBefore,
      gatewayModeAfter,
    });
    const logConfigOverwrite = () => {
      if (!snapshot.exists) {
        return;
      }
      const isVitest = deps.env.VITEST === "true";
      const shouldLogInVitest = deps.env.ZHUSHOU_TEST_CONFIG_OVERWRITE_LOG === "1";
      if (isVitest && !shouldLogInVitest) {
        return;
      }
      deps.logger.warn(
        formatConfigOverwriteLogMessage({
          configPath,
          previousHash: previousHash ?? null,
          nextHash,
          changedPathCount,
        }),
      );
    };
    const logConfigWriteAnomalies = () => {
      if (suspiciousReasons.length === 0) {
        return;
      }
      // 测试常写入最小配置（缺 meta 等）；除非请求，否则保持输出静默。
      const isVitest = deps.env.VITEST === "true";
      const shouldLogInVitest = deps.env.ZHUSHOU_TEST_CONFIG_WRITE_ANOMALY_LOG === "1";
      if (isVitest && !shouldLogInVitest) {
        return;
      }
      deps.logger.warn(`Config write anomaly: ${configPath} (${suspiciousReasons.join(", ")})`);
    };
    const previousMetadata = resolveConfigStatMetadata(previousStat);
    const auditRecordBase = createConfigWriteAuditRecordBase({
      configPath,
      env: deps.env,
      existsBefore: snapshot.exists,
      previousHash: previousHash ?? null,
      nextHash,
      previousBytes,
      nextBytes,
      previousMetadata,
      changedPathCount,
      hasMetaBefore,
      hasMetaAfter,
      gatewayModeBefore,
      gatewayModeAfter,
      suspicious: suspiciousReasons,
    });
    const appendWriteAudit = async (
      result: ConfigWriteAuditResult,
      err?: unknown,
      nextStat?: fs.Stats | null,
    ) => {
      await appendConfigAuditRecord({
        fs: deps.fs,
        env: deps.env,
        homedir: deps.homedir,
        record: finalizeConfigWriteAuditRecord({
          base: auditRecordBase,
          result,
          err,
          nextMetadata: resolveConfigStatMetadata(nextStat ?? null),
        }),
      });
    };

    const tmp = path.join(
      dir,
      `${path.basename(configPath)}.${process.pid}.${crypto.randomUUID()}.tmp`,
    );

    try {
      await deps.fs.promises.writeFile(tmp, json, {
        encoding: "utf-8",
        mode: 0o600,
      });

      if (deps.fs.existsSync(configPath)) {
        await maintainConfigBackups(configPath, deps.fs.promises);
      }

      try {
        await deps.fs.promises.rename(tmp, configPath);
      } catch (err) {
        const code = (err as { code?: string }).code;
        // Windows 不支持在目标存在时通过 rename 进行原子替换。
        if (code === "EPERM" || code === "EEXIST") {
          await deps.fs.promises.copyFile(tmp, configPath);
          await deps.fs.promises.chmod(configPath, 0o600).catch(() => {
            // best-effort
          });
          await deps.fs.promises.unlink(tmp).catch(() => {
            // best-effort
          });
          logConfigOverwrite();
          logConfigWriteAnomalies();
          await appendWriteAudit(
            "copy-fallback",
            undefined,
            await deps.fs.promises.stat(configPath).catch(() => null),
          );
          return { persistedHash: nextHash };
        }
        await deps.fs.promises.unlink(tmp).catch(() => {
          // best-effort
        });
        throw err;
      }
      logConfigOverwrite();
      logConfigWriteAnomalies();
      await appendWriteAudit(
        "rename",
        undefined,
        await deps.fs.promises.stat(configPath).catch(() => null),
      );
      return { persistedHash: nextHash };
    } catch (err) {
      await appendWriteAudit("failed", err);
      throw err;
    }
  }

  return {
    configPath,
    loadConfig,
    readBestEffortConfig,
    readSourceConfigBestEffort,
    readConfigFileSnapshot,
    readConfigFileSnapshotForWrite,
    writeConfigFile,
  };
}

// 注意：这些封装函数故意不在模块作用域缓存解析的配置路径。
// `ZHUSHOU_CONFIG_PATH`（及相关变量）预期在模块导入后设置仍可工作
// （测试、一次性脚本等）。
const AUTO_OWNER_DISPLAY_SECRET_BY_PATH = new Map<string, string>();
const AUTO_OWNER_DISPLAY_SECRET_PERSIST_IN_FLIGHT = new Set<string>();
const AUTO_OWNER_DISPLAY_SECRET_PERSIST_WARNED = new Set<string>();
export function clearConfigCache(): void {
  // 兼容垫片：运行时快照现在是唯一的进程内缓存。
}

export function registerConfigWriteListener(
  listener: (event: ConfigWriteNotification) => void,
): () => void {
  return registerRuntimeConfigWriteListener(listener);
}

function isCompatibleTopLevelRuntimeProjectionShape(params: {
  runtimeSnapshot: ZhushouConfig;
  candidate: ZhushouConfig;
}): boolean {
  const runtime = params.runtimeSnapshot as Record<string, unknown>;
  const candidate = params.candidate as Record<string, unknown>;
  for (const key of Object.keys(runtime)) {
    if (!Object.hasOwn(candidate, key)) {
      return false;
    }
    const runtimeValue = runtime[key];
    const candidateValue = candidate[key];
    const runtimeType = Array.isArray(runtimeValue)
      ? "array"
      : runtimeValue === null
        ? "null"
        : typeof runtimeValue;
    const candidateType = Array.isArray(candidateValue)
      ? "array"
      : candidateValue === null
        ? "null"
        : typeof candidateValue;
    if (runtimeType !== candidateType) {
      return false;
    }
  }
  return true;
}

export function projectConfigOntoRuntimeSourceSnapshot(config: ZhushouConfig): ZhushouConfig {
  const runtimeConfigSnapshot = getRuntimeConfigSnapshotState();
  const runtimeConfigSourceSnapshot = getRuntimeConfigSourceSnapshotState();
  if (!runtimeConfigSnapshot || !runtimeConfigSourceSnapshot) {
    return config;
  }
  if (config === runtimeConfigSnapshot) {
    return runtimeConfigSourceSnapshot;
  }
  // 此投影预期调用者传入从活动运行时快照派生的配置对象
  // （如带定向编辑的浅/深拷贝）。
  // 对于结构不相关的配置，跳过投影以避免意外的
  // 合并补丁删除或将解析值重新引入源引用。
  if (
    !isCompatibleTopLevelRuntimeProjectionShape({
      runtimeSnapshot: runtimeConfigSnapshot,
      candidate: config,
    })
  ) {
    return config;
  }
  const projectedSource = coerceConfig(
    projectSourceOntoRuntimeShape(runtimeConfigSourceSnapshot, runtimeConfigSnapshot),
  );
  const runtimePatch = createMergePatch(runtimeConfigSnapshot, config);
  return coerceConfig(applyMergePatch(projectedSource, runtimePatch));
}

export function loadConfig(): ZhushouConfig {
  // 首次成功加载成为进程快照。长期运行时应
  // 通过显式重载/观察器路径交换此快照，而非
  // 在热代码路径上重新解析 zhushou.json。
  return loadPinnedRuntimeConfig(() => createConfigIO().loadConfig());
}

export function getRuntimeConfig(): ZhushouConfig {
  return loadConfig();
}

export async function readBestEffortConfig(): Promise<ZhushouConfig> {
  return await createConfigIO().readBestEffortConfig();
}

export async function readSourceConfigBestEffort(): Promise<ZhushouConfig> {
  return await createConfigIO().readSourceConfigBestEffort();
}

export async function readConfigFileSnapshot(): Promise<ConfigFileSnapshot> {
  return await createConfigIO().readConfigFileSnapshot();
}

export async function readSourceConfigSnapshot(): Promise<ConfigFileSnapshot> {
  return await readConfigFileSnapshot();
}

export async function readConfigFileSnapshotForWrite(): Promise<ReadConfigFileSnapshotForWriteResult> {
  return await createConfigIO().readConfigFileSnapshotForWrite();
}

export async function readSourceConfigSnapshotForWrite(): Promise<ReadConfigFileSnapshotForWriteResult> {
  return await readConfigFileSnapshotForWrite();
}

export async function writeConfigFile(
  cfg: ZhushouConfig,
  options: ConfigWriteOptions = {},
): Promise<void> {
  const io = createConfigIO();
  let nextCfg = cfg;
  const runtimeConfigSnapshot = getRuntimeConfigSnapshotState();
  const runtimeConfigSourceSnapshot = getRuntimeConfigSourceSnapshotState();
  const hadRuntimeSnapshot = Boolean(runtimeConfigSnapshot);
  const hadBothSnapshots = Boolean(runtimeConfigSnapshot && runtimeConfigSourceSnapshot);
  if (hadBothSnapshots) {
    const runtimePatch = createMergePatch(runtimeConfigSnapshot!, cfg);
    nextCfg = coerceConfig(applyMergePatch(runtimeConfigSourceSnapshot!, runtimePatch));
  }
  const writeResult = await io.writeConfigFile(nextCfg, {
    envSnapshotForRestore: resolveWriteEnvSnapshotForPath({
      actualConfigPath: io.configPath,
      expectedConfigPath: options.expectedConfigPath,
      envSnapshotForRestore: options.envSnapshotForRestore,
    }),
    unsetPaths: options.unsetPaths,
    skipRuntimeSnapshotRefresh: options.skipRuntimeSnapshotRefresh,
  });
  if (
    options.skipRuntimeSnapshotRefresh &&
    !hadRuntimeSnapshot &&
    !getRuntimeConfigSnapshotRefreshHandlerState()
  ) {
    return;
  }
  const notifyCommittedWrite = () => {
    const currentRuntimeConfig = getRuntimeConfigSnapshotState();
    if (!currentRuntimeConfig) {
      return;
    }
    notifyRuntimeConfigWriteListeners({
      configPath: io.configPath,
      sourceConfig: nextCfg,
      runtimeConfig: currentRuntimeConfig,
      persistedHash: writeResult.persistedHash,
      writtenAtMs: Date.now(),
    });
  };
  // Keep the last-known-good runtime snapshot active until the specialized refresh path
  // succeeds, so concurrent readers do not observe unresolved SecretRefs mid-refresh.
  await finalizeRuntimeSnapshotWrite({
    nextSourceConfig: nextCfg,
    hadRuntimeSnapshot,
    hadBothSnapshots,
    loadFreshConfig: () => io.loadConfig(),
    notifyCommittedWrite,
    formatRefreshError: (error) => formatErrorMessage(error),
    createRefreshError: (detail, cause) =>
      new ConfigRuntimeRefreshError(
        `Config was written to ${io.configPath}, but runtime snapshot refresh failed: ${detail}`,
        { cause },
      ),
  });
}
