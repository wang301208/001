import path from "node:path";
import { resolveZhushouPackageRootSync } from "../infra/zhushou-root.js";

export function resolveGovernanceCharterDir(options: {
  charterDir?: string;
  cwd?: string;
  argv1?: string;
  moduleUrl?: string;
} = {}): string {
  if (options.charterDir?.trim()) {
    return path.resolve(options.charterDir);
  }

  const packageRoot = resolveZhushouPackageRootSync({
    moduleUrl: options.moduleUrl ?? import.meta.url,
    argv1: options.argv1 ?? process.argv[1],
    cwd: options.cwd ?? process.cwd(),
  });
  const root = packageRoot ?? process.cwd();
  return path.join(root, "governance", "charter");
}
