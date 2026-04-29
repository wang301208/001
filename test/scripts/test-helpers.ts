import { execFileSync } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach } from "vitest";

function resolveGitInstallRoot(): string | null {
  try {
    const gitExecPath = execFileSync("git", ["--exec-path"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return path.resolve(gitExecPath, "..", "..", "..");
  } catch {
    return null;
  }
}

export function normalizePathForBash(value: string): string {
  return process.platform === "win32" ? value.replace(/\\/g, "/") : value;
}

export function resolveBashExecutable(): string {
  if (process.platform !== "win32") {
    return "/bin/bash";
  }

  const gitRoot = resolveGitInstallRoot();
  const candidates = [
    process.env.OPENCLAW_TEST_BASH,
    gitRoot ? path.join(gitRoot, "bin", "bash.exe") : null,
    gitRoot ? path.join(gitRoot, "usr", "bin", "bash.exe") : null,
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "bash";
}

export function resolveBashScriptInvocation(scriptPath: string, args: string[] = []) {
  return {
    command: resolveBashExecutable(),
    args: ["--noprofile", "--norc", normalizePathForBash(scriptPath), ...args],
  };
}

export function createScriptTestHarness() {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        fs.rmSync(dir, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 50,
        });
      }
    }
  });

  function createTempDir(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  async function createTempDirAsync(prefix: string): Promise<string> {
    const dir = await fsPromises.mkdtemp(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  function trackTempDir(dir: string): string {
    tempDirs.push(dir);
    return dir;
  }

  return {
    createTempDir,
    createTempDirAsync,
    trackTempDir,
  };
}
