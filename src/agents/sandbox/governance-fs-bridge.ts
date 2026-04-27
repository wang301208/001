import fs from "node:fs/promises";
import path from "node:path";
import { isPathInside } from "../../infra/path-guards.js";
import type { SandboxFsBridgeContext } from "./backend-handle.types.js";
import { buildSandboxFsMounts, resolveSandboxFsPathWithMounts } from "./fs-paths.js";
import type { SandboxFsBridge, SandboxFsStat } from "./fs-bridge.types.js";

type GovernanceFrozenFsBridgeMount = {
  hostRoot: string;
};

export function createGovernanceFrozenSandboxFsBridge(params: {
  sandbox: SandboxFsBridgeContext;
  failureMessage?: string;
}): SandboxFsBridge {
  return new GovernanceFrozenSandboxFsBridge(params);
}

class GovernanceFrozenSandboxFsBridge implements SandboxFsBridge {
  private readonly sandbox: SandboxFsBridgeContext;
  private readonly mounts: ReturnType<typeof buildSandboxFsMounts>;
  private readonly hostMounts: GovernanceFrozenFsBridgeMount[];
  private readonly failureMessage: string;

  constructor(params: { sandbox: SandboxFsBridgeContext; failureMessage?: string }) {
    this.sandbox = params.sandbox;
    this.mounts = buildSandboxFsMounts(this.sandbox);
    this.hostMounts = this.mounts
      .map((mount) => ({ hostRoot: path.resolve(mount.hostRoot) }))
      .toSorted((a, b) => b.hostRoot.length - a.hostRoot.length);
    this.failureMessage =
      params.failureMessage?.trim() || "Sandbox filesystem is frozen by governance policy.";
  }

  resolvePath(params: { filePath: string; cwd?: string }) {
    return this.resolveTarget(params);
  }

  async readFile(params: {
    filePath: string;
    cwd?: string;
    signal?: AbortSignal;
  }): Promise<Buffer> {
    const target = await this.resolveReadableTarget(params);
    return await fs.readFile(target.readHostPath);
  }

  async writeFile(): Promise<void> {
    throw new Error(this.failureMessage);
  }

  async mkdirp(): Promise<void> {
    throw new Error(this.failureMessage);
  }

  async remove(): Promise<void> {
    throw new Error(this.failureMessage);
  }

  async rename(): Promise<void> {
    throw new Error(this.failureMessage);
  }

  async stat(params: {
    filePath: string;
    cwd?: string;
    signal?: AbortSignal;
  }): Promise<SandboxFsStat | null> {
    try {
      const target = await this.resolveReadableTarget(params);
      const stats = await fs.stat(target.readHostPath);
      return {
        type: stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other",
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  private resolveTarget(params: { filePath: string; cwd?: string }) {
    return resolveSandboxFsPathWithMounts({
      filePath: params.filePath,
      cwd: params.cwd ?? this.sandbox.workspaceDir,
      defaultWorkspaceRoot: this.sandbox.workspaceDir,
      defaultContainerRoot: this.sandbox.containerWorkdir,
      mounts: this.mounts,
    });
  }

  private async resolveReadableTarget(params: { filePath: string; cwd?: string }) {
    const target = this.resolveTarget(params);
    const mount = this.findHostMount(target.hostPath);
    if (!mount) {
      throw new Error(`Sandbox path escapes allowed mounts; cannot access: ${target.containerPath}`);
    }
    const stats = await fs.lstat(target.hostPath);
    const readHostPath = await fs.realpath(target.hostPath);
    if (!isPathInside(mount.hostRoot, readHostPath)) {
      throw new Error(`Symlink escapes sandbox mount root: ${target.containerPath}`);
    }
    if (stats.isFile() && stats.nlink > 1) {
      throw new Error(`Hardlinked path is not allowed under sandbox mount root: ${target.containerPath}`);
    }
    return { target, readHostPath };
  }

  private findHostMount(hostPath: string): GovernanceFrozenFsBridgeMount | null {
    const resolvedHostPath = path.resolve(hostPath);
    for (const mount of this.hostMounts) {
      if (isPathInside(mount.hostRoot, resolvedHostPath)) {
        return mount;
      }
    }
    return null;
  }
}
