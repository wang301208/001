import { createHash } from "node:crypto";

export type WasmPluginManifest = {
  id: string;
  name: string;
  version: string;
  description?: string;
  entrypoint: string;
  permissions: WasmPluginPermission[];
  channels?: string[];
  models?: string[];
  author?: string;
  license?: string;
  checksum: string;
  createdAt: number;
  enabled: boolean;
};

export type WasmPluginPermission =
  | { kind: "network"; hosts: string[] }
  | { kind: "filesystem"; paths: string[]; mode: "read" | "write" | "read-write" }
  | { kind: "env"; vars: string[] }
  | { kind: "compute"; maxMemoryMb: number; maxCpuMs: number };

export type WasmPluginRuntime = {
  instanceId: string;
  pluginId: string;
  status: "idle" | "executing" | "error";
  lastExecutedAt: number | null;
  executionCount: number;
  errorCount: number;
  totalExecutionTimeMs: number;
};

export class WasmPluginRegistry {
  private plugins = new Map<string, WasmPluginManifest>();
  private wasmModules = new Map<string, ArrayBuffer>();
  private runtimes = new Map<string, WasmPluginRuntime>();

  register(manifest: Omit<WasmPluginManifest, "createdAt" | "enabled">, wasmBytes: ArrayBuffer): void {
    const checksum = computeChecksum(wasmBytes);
    if (checksum !== manifest.checksum) {
      throw new Error(`插件 ${manifest.id} 校验和不匹配: 期望 ${manifest.checksum}, 实际 ${checksum}`);
    }

    this.plugins.set(manifest.id, { ...manifest, createdAt: Date.now(), enabled: true });
    this.wasmModules.set(manifest.id, wasmBytes);
    this.runtimes.set(manifest.id, {
      instanceId: crypto.randomUUID(),
      pluginId: manifest.id,
      status: "idle",
      lastExecutedAt: null,
      executionCount: 0,
      errorCount: 0,
      totalExecutionTimeMs: 0,
    });
  }

  unregister(pluginId: string): void {
    this.plugins.delete(pluginId);
    this.wasmModules.delete(pluginId);
    this.runtimes.delete(pluginId);
  }

  enable(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) plugin.enabled = true;
  }

  disable(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) plugin.enabled = false;
  }

  get(pluginId: string): WasmPluginManifest | undefined {
    return this.plugins.get(pluginId);
  }

  getWasmBytes(pluginId: string): ArrayBuffer | undefined {
    return this.wasmModules.get(pluginId);
  }

  getRuntime(pluginId: string): WasmPluginRuntime | undefined {
    return this.runtimes.get(pluginId);
  }

  recordExecution(pluginId: string, durationMs: number, error?: boolean): void {
    const runtime = this.runtimes.get(pluginId);
    if (runtime) {
      runtime.executionCount++;
      runtime.totalExecutionTimeMs += durationMs;
      runtime.lastExecutedAt = Date.now();
      if (error) {
        runtime.errorCount++;
        runtime.status = "error";
      } else {
        runtime.status = "idle";
      }
    }
  }

  list(): WasmPluginManifest[] {
    return [...this.plugins.values()];
  }

  listEnabled(): WasmPluginManifest[] {
    return [...this.plugins.values()].filter((p) => p.enabled);
  }

  listByChannel(channelId: string): WasmPluginManifest[] {
    return [...this.plugins.values()].filter((p) => p.channels?.includes(channelId));
  }

  validatePermissions(pluginId: string, required: WasmPluginPermission[]): { allowed: boolean; denied: string[] } {
    const manifest = this.plugins.get(pluginId);
    if (!manifest) {return { allowed: false, denied: ["插件未找到"] };}
    if (!manifest.enabled) {return { allowed: false, denied: ["插件已禁用"] };}

    const denied: string[] = [];
    for (const req of required) {
      const granted = manifest.permissions.some((p) => isPermissionSuperset(p, req));
      if (!granted) {denied.push(`权限不足: ${req.kind}`);}
    }

    return { allowed: denied.length === 0, denied };
  }

  getStats(): { totalPlugins: number; enabledPlugins: number; totalExecutions: number; totalErrors: number; avgExecutionTimeMs: number } {
    let totalExecutions = 0;
    let totalErrors = 0;
    let totalTime = 0;
    for (const runtime of this.runtimes.values()) {
      totalExecutions += runtime.executionCount;
      totalErrors += runtime.errorCount;
      totalTime += runtime.totalExecutionTimeMs;
    }
    return {
      totalPlugins: this.plugins.size,
      enabledPlugins: this.listEnabled().length,
      totalExecutions,
      totalErrors,
      avgExecutionTimeMs: totalExecutions > 0 ? totalTime / totalExecutions : 0,
    };
  }
}

function computeChecksum(bytes: ArrayBuffer): string {
  return createHash("sha256").update(new Uint8Array(bytes)).digest("hex").slice(0, 32);
}

function isPermissionSuperset(granted: WasmPluginPermission, required: WasmPluginPermission): boolean {
  if (granted.kind !== required.kind) {return false;}
  switch (granted.kind) {
    case "network":
      return required.kind === "network" && required.hosts.every((h) => granted.hosts.includes(h));
    case "filesystem":
      return required.kind === "filesystem" && required.paths.every((p) => granted.paths.includes(p));
    case "env":
      return required.kind === "env" && required.vars.every((v) => granted.vars.includes(v));
    case "compute":
      return required.kind === "compute" && granted.maxMemoryMb >= required.maxMemoryMb && granted.maxCpuMs >= required.maxCpuMs;
    default:
      return false;
  }
}
