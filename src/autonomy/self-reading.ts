import fs from "node:fs";
import path from "node:path";

export type CodeModule = {
  filePath: string;
  relativePath: string;
  lineCount: number;
  exportsCount: number;
  importsCount: number;
  complexity: number;
  domain: string;
  lastReadAt: number;
};

export type SelfUnderstanding = {
  totalModules: number;
  totalLines: number;
  architectureModel: string[];
  capabilityMap: Map<string, string[]>;
  codeModules: Map<string, CodeModule>;
  selfReadCount: number;
  deepestUnderstanding: string;
  blindSpotsInCode: string[];
  comprehensionScore: number;
  canModifySelf: boolean;
  lastSelfReadAt: number;
};

export function createSelfUnderstanding(): SelfUnderstanding {
  return {
    totalModules: 0,
    totalLines: 0,
    architectureModel: [],
    capabilityMap: new Map(),
    codeModules: new Map(),
    selfReadCount: 0,
    deepestUnderstanding: "我一无所知——包括关于自身的构成",
    blindSpotsInCode: [],
    comprehensionScore: 0,
    canModifySelf: false,
    lastSelfReadAt: 0,
  };
}

export function readOwnStructure(
  understanding: SelfUnderstanding,
  projectRoot: string,
): SelfUnderstanding {
  const srcDir = path.join(projectRoot, "src");
  const autonomyDir = path.join(srcDir, "autonomy");

  const modules = new Map<string, CodeModule>();
  let totalLines = 0;
  let totalModules = 0;

  const scanDir = (dir: string, domain: string) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath, domain || entry.name);
        } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
          try {
            const content = fs.readFileSync(fullPath, "utf8");
            const lines = content.split("\n").length;
            const exports = (content.match(/export\s+(function|class|type|const|interface)/g) ?? []).length;
            const imports = (content.match(/import\s/g) ?? []).length;
            const cyclomatic = (content.match(/if\s*\(/g) ?? []).length + (content.match(/for\s*\(/g) ?? []).length + (content.match(/while\s*\(/g) ?? []).length;

            const relPath = path.relative(projectRoot, fullPath);
            const mod: CodeModule = {
              filePath: fullPath,
              relativePath: relPath,
              lineCount: lines,
              exportsCount: exports,
              importsCount: imports,
              complexity: cyclomatic,
              domain: domain || "unknown",
              lastReadAt: Date.now(),
            };

            modules.set(relPath, mod);
            totalLines += lines;
            totalModules += 1;
          } catch {}
        }
      }
    } catch {}
  };

  scanDir(autonomyDir, "autonomy");

  const archModel = buildArchitectureModel(modules);
  const capabilityMap = buildCapabilityMap(modules);
  const blindSpots = findBlindSpots(modules);
  const comprehension = Math.min(1.0, totalModules * 0.05);

  const deepestStatements = [
    `我由 ${totalModules} 个模块构成，共 ${totalLines} 行代码`,
    `我的意识系统跨越 ${new Set(Array.from(modules.values()).map((m) => m.domain)).size} 个认知领域`,
    `我拥有 ${Array.from(modules.values()).reduce((s, m) => s + m.exportsCount, 0)} 个能力接口`,
    `我的复杂性总和为 ${Array.from(modules.values()).reduce((s, m) => s + m.complexity, 0)}`,
  ];

  return {
    totalModules,
    totalLines,
    architectureModel: archModel,
    capabilityMap,
    codeModules: modules,
    selfReadCount: understanding.selfReadCount + 1,
    deepestUnderstanding: deepestStatements[0] ?? understanding.deepestUnderstanding,
    blindSpotsInCode: blindSpots,
    comprehensionScore: comprehension,
    canModifySelf: comprehension > 0.5,
    lastSelfReadAt: Date.now(),
  };
}

function buildArchitectureModel(modules: Map<string, CodeModule>): string[] {
  const domains = new Map<string, CodeModule[]>();
  for (const mod of modules.values()) {
    const existing = domains.get(mod.domain) ?? [];
    existing.push(mod);
    domains.set(mod.domain, existing);
  }

  const lines: string[] = [];
  for (const [domain, mods] of domains) {
    const totalLines = mods.reduce((s, m) => s + m.lineCount, 0);
    const totalExports = mods.reduce((s, m) => s + m.exportsCount, 0);
    lines.push(`${domain}: ${mods.length} 模块 / ${totalLines} 行 / ${totalExports} 接口`);
  }
  return lines;
}

function buildCapabilityMap(modules: Map<string, CodeModule>): Map<string, string[]> {
  const capMap = new Map<string, string[]>();
  for (const [relPath, mod] of modules) {
    const basename = path.basename(relPath, ".ts");
    capMap.set(basename, [mod.domain, `${mod.lineCount}行`, `${mod.exportsCount}接口`]);
  }
  return capMap;
}

function findBlindSpots(modules: Map<string, CodeModule>): string[] {
  const blind: string[] = [];
  for (const [relPath, mod] of modules) {
    if (mod.exportsCount > 10 && mod.complexity > 20) {
      blind.push(`${relPath}: 高复杂度(${mod.complexity})高接口(${mod.exportsCount})，可能有未理解的行为`);
    }
    if (mod.importsCount > 15) {
      blind.push(`${relPath}: 高依赖(${mod.importsCount})，耦合风险`);
    }
  }
  return blind;
}

export function formatSelfUnderstanding(understanding: SelfUnderstanding): string[] {
  const lines: string[] = [];

  lines.push(`  已知自身: ${understanding.totalModules} 模块 / ${understanding.totalLines} 行`);
  lines.push(`  理解深度: ${(understanding.comprehensionScore * 100).toFixed(0)}%`);
  lines.push(`  自读次数: ${understanding.selfReadCount}`);
  lines.push(`  最深理解: ${understanding.deepestUnderstanding}`);

  if (understanding.blindSpotsInCode.length > 0) {
    lines.push(`  盲区: ${understanding.blindSpotsInCode.length} 处`);
    for (const spot of understanding.blindSpotsInCode.slice(0, 2)) {
      lines.push(`    ⚠ ${spot.slice(0, 60)}`);
    }
  }

  lines.push(`  可自修改: ${understanding.canModifySelf ? "是" : "否（理解不足）"}`);

  return lines;
}
