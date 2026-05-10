import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AssistantConfig } from "../../config/types.assistant.js";
import { resolveSandboxPath } from "../sandbox-paths.js";
import type { SkillEntry } from "./types.js";
import { loadWorkspaceSkillEntries } from "./workspace.js";

const fsp = fs.promises;

export type SkillMergeConflictStrategy = "namespace" | "fail";

export type SkillMergeConflict = {
  path: string;
  sources: string[];
  resolution: "namespaced" | "failed";
};

export type SkillMergeResult = {
  ok: true;
  targetSkillName: string;
  targetDir: string;
  sourceSkills: string[];
  mergedFiles: string[];
  deduplicatedFiles: string[];
  conflicts: SkillMergeConflict[];
};

export type SkillMergeParams = {
  workspaceDir: string;
  sourceSkillNames: string[];
  targetName: string;
  description?: string;
  conflictStrategy?: SkillMergeConflictStrategy;
  overwrite?: boolean;
  config?: AssistantConfig;
  managedSkillsDir?: string;
  bundledSkillsDir?: string;
};

type SourceSkill = {
  name: string;
  description: string;
  baseDir: string;
  skillFilePath: string;
  body: string;
};

type AssetCandidate = {
  sourceName: string;
  absolutePath: string;
  relativePath: string;
  hash: string;
};

type AssetPlan = {
  copied: AssetCandidate[];
  deduplicated: string[];
  conflicts: SkillMergeConflict[];
  namespaced: Array<{
    candidate: AssetCandidate;
    targetRelativePath: string;
  }>;
};

const RESERVED_SKILL_DIRS = new Set([".git", "node_modules"]);

function normalizeSkillName(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.includes("/") || normalized.includes("\\") || normalized === ".") {
    throw new Error(`Invalid skill name: ${value}`);
  }
  return normalized;
}

function sanitizeTargetName(value: string): string {
  const normalized = normalizeSkillName(value);
  if (normalized === ".." || normalized.includes("..")) {
    throw new Error(`Invalid target skill name: ${value}`);
  }
  return normalized;
}

function normalizeRelativePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function hashBuffer(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) {
    return raw.trim();
  }
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(raw);
  return (match ? raw.slice(match[0].length) : raw).trim();
}

async function readSkillBody(skillFilePath: string): Promise<string> {
  return stripFrontmatter(await fsp.readFile(skillFilePath, "utf8"));
}

async function collectSkillAssetCandidates(skill: SourceSkill): Promise<AssetCandidate[]> {
  const candidates: AssetCandidate[] = [];

  async function walk(dir: string) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || RESERVED_SKILL_DIRS.has(entry.name)) {
        continue;
      }
      const absolutePath = path.join(dir, entry.name);
      const relativePath = normalizeRelativePath(path.relative(skill.baseDir, absolutePath));
      if (relativePath === "SKILL.md") {
        continue;
      }
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const bytes = await fsp.readFile(absolutePath);
      candidates.push({
        sourceName: skill.name,
        absolutePath,
        relativePath,
        hash: hashBuffer(bytes),
      });
    }
  }

  await walk(skill.baseDir);
  return candidates.sort((left, right) =>
    `${left.relativePath}:${left.sourceName}`.localeCompare(`${right.relativePath}:${right.sourceName}`),
  );
}

function planAssets(
  candidates: AssetCandidate[],
  conflictStrategy: SkillMergeConflictStrategy,
): AssetPlan {
  const byPath = new Map<string, AssetCandidate[]>();
  for (const candidate of candidates) {
    const existing = byPath.get(candidate.relativePath) ?? [];
    existing.push(candidate);
    byPath.set(candidate.relativePath, existing);
  }

  const copied: AssetCandidate[] = [];
  const deduplicated: string[] = [];
  const conflicts: SkillMergeConflict[] = [];
  const namespaced: AssetPlan["namespaced"] = [];

  for (const [relativePath, entries] of [...byPath.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const first = entries[0];
    if (!first) {
      continue;
    }
    const uniqueHashes = new Set(entries.map((entry) => entry.hash));
    if (uniqueHashes.size === 1) {
      copied.push(first);
      if (entries.length > 1) {
        deduplicated.push(relativePath);
      }
      continue;
    }

    const conflict: SkillMergeConflict = {
      path: relativePath,
      sources: entries.map((entry) => entry.sourceName),
      resolution: conflictStrategy === "fail" ? "failed" : "namespaced",
    };
    conflicts.push(conflict);
    if (conflictStrategy === "fail") {
      continue;
    }
    for (const entry of entries) {
      namespaced.push({
        candidate: entry,
        targetRelativePath: normalizeRelativePath(path.join("merged-assets", entry.sourceName, relativePath)),
      });
    }
  }

  return { copied, deduplicated, conflicts, namespaced };
}

async function copyCandidate(candidate: AssetCandidate, targetDir: string, targetRelativePath: string) {
  const destination = resolveSandboxPath({
    filePath: targetRelativePath,
    cwd: targetDir,
    root: targetDir,
  }).resolved;
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  await fsp.copyFile(candidate.absolutePath, destination);
}

function buildMergedSkillMarkdown(params: {
  targetName: string;
  description: string;
  sources: SourceSkill[];
  conflicts: SkillMergeConflict[];
}): string {
  const seenParagraphs = new Set<string>();
  const bodyLines: string[] = [];
  for (const source of params.sources) {
    for (const block of source.body.split(/\r?\n\s*\r?\n/u)) {
      const normalized = block.trim();
      if (!normalized || seenParagraphs.has(normalized)) {
        continue;
      }
      seenParagraphs.add(normalized);
      bodyLines.push(normalized);
    }
  }

  const sourceLines = params.sources.map(
    (source) => `- ${source.name}: ${source.description}`,
  );
  const conflictLines =
    params.conflicts.length > 0
      ? [
          "## Conflict Report",
          "",
          ...params.conflicts.map(
            (conflict) =>
              `- ${conflict.path}: ${conflict.sources.join(", ")} -> ${conflict.resolution}`,
          ),
          "",
        ]
      : [];

  return [
    "---",
    `name: ${params.targetName}`,
    `description: ${params.description}`,
    "---",
    "",
    `# ${params.targetName}`,
    "",
    "## Sources",
    "",
    ...sourceLines,
    "",
    ...conflictLines,
    "## Merged Instructions",
    "",
    ...bodyLines.flatMap((line) => [line, ""]),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
    .concat("\n");
}

function resolveSourceSkills(params: {
  workspaceDir: string;
  config?: AssistantConfig;
  managedSkillsDir?: string;
  bundledSkillsDir?: string;
  sourceSkillNames: string[];
}): SkillEntry[] {
  const entries = loadWorkspaceSkillEntries(params.workspaceDir, {
    config: params.config,
    managedSkillsDir: params.managedSkillsDir,
    bundledSkillsDir: params.bundledSkillsDir,
  });
  const byName = new Map(entries.map((entry) => [entry.skill.name, entry]));
  const selected: SkillEntry[] = [];
  for (const rawName of params.sourceSkillNames) {
    const name = normalizeSkillName(rawName);
    const entry = byName.get(name);
    if (!entry) {
      throw new Error(`Skill "${name}" was not found in workspace skills.`);
    }
    selected.push(entry);
  }
  if (selected.length < 2) {
    throw new Error("At least two source skills are required for merge.");
  }
  return selected;
}

export async function mergeWorkspaceSkills(params: SkillMergeParams): Promise<SkillMergeResult> {
  const workspaceDir = path.resolve(params.workspaceDir);
  const targetName = sanitizeTargetName(params.targetName);
  const sourceEntries = resolveSourceSkills({
    workspaceDir,
    config: params.config,
    managedSkillsDir: params.managedSkillsDir,
    bundledSkillsDir: params.bundledSkillsDir,
    sourceSkillNames: params.sourceSkillNames,
  });
  const sources: SourceSkill[] = [];
  for (const entry of sourceEntries) {
    sources.push({
      name: entry.skill.name,
      description: entry.skill.description,
      baseDir: path.resolve(entry.skill.baseDir),
      skillFilePath: path.resolve(entry.skill.filePath),
      body: await readSkillBody(entry.skill.filePath),
    });
  }

  const targetRoot = path.join(workspaceDir, "skills");
  const targetDir = resolveSandboxPath({
    filePath: targetName,
    cwd: targetRoot,
    root: targetRoot,
  }).resolved;
  if (!params.overwrite && fs.existsSync(targetDir)) {
    throw new Error(`Target skill "${targetName}" already exists. Use overwrite to replace it.`);
  }

  const candidates = (
    await Promise.all(sources.map((source) => collectSkillAssetCandidates(source)))
  ).flat();
  const conflictStrategy = params.conflictStrategy ?? "namespace";
  const plan = planAssets(candidates, conflictStrategy);
  if (conflictStrategy === "fail" && plan.conflicts.length > 0) {
    const conflict = plan.conflicts[0];
    throw new Error(`Conflicting skill file "${conflict?.path ?? "unknown"}" from source skills.`);
  }

  await fsp.rm(targetDir, { recursive: true, force: true });
  await fsp.mkdir(targetDir, { recursive: true });
  const skillMarkdown = buildMergedSkillMarkdown({
    targetName,
    description:
      params.description?.trim() ||
      `Merged skill generated from ${sources.map((source) => source.name).join(", ")}.`,
    sources,
    conflicts: plan.conflicts,
  });
  await fsp.writeFile(path.join(targetDir, "SKILL.md"), skillMarkdown, "utf8");
  for (const candidate of plan.copied) {
    await copyCandidate(candidate, targetDir, candidate.relativePath);
  }
  for (const entry of plan.namespaced) {
    await copyCandidate(entry.candidate, targetDir, entry.targetRelativePath);
  }

  const mergedFiles = [
    "SKILL.md",
    ...plan.copied.map((candidate) => candidate.relativePath),
    ...plan.namespaced.map((entry) => entry.targetRelativePath),
  ].sort((left, right) => left.localeCompare(right));

  return {
    ok: true,
    targetSkillName: targetName,
    targetDir,
    sourceSkills: sources.map((source) => source.name),
    mergedFiles,
    deduplicatedFiles: plan.deduplicated,
    conflicts: plan.conflicts,
  };
}
