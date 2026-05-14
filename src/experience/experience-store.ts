import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { requireNodeSqlite } from "../infra/node-sqlite.js";

export type ExperienceEvent = {
  id: string;
  kind: string;
  summary: string;
  source?: string;
  sessionKey?: string;
  tags: string[];
  evidence: string[];
  outcome?: string;
  createdAt: number;
  updatedAt: number;
};

export type SkillCandidateStatus = "proposed" | "accepted" | "rejected" | "implemented";

export type SkillCandidate = {
  id: string;
  title: string;
  trigger: string;
  steps: string[];
  status: SkillCandidateStatus;
  evidenceEventIds: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

export type SkillUsageRecord = {
  id: string;
  candidateId: string;
  successful: boolean;
  outcome: string;
  observations: string[];
  createdAt: number;
};

export type StrategicMemoryCadence = "hourly" | "daily" | "weekly" | "monthly";

export type StrategicMemory = {
  id: string;
  title: string;
  objective: string;
  cadence: StrategicMemoryCadence;
  nextPushAt: number;
  lastPushedAt?: number;
  evidenceEventIds: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

export type StrategicPush = {
  id: string;
  title: string;
  prompt: string;
  cadence: StrategicMemoryCadence;
  nextPushAt: number;
  evidenceEventIds: string[];
  tags: string[];
};

export type SelfModel = {
  strengths: string[];
  weaknesses: string[];
  preferences: string[];
  learnedPatterns: string[];
  nextGrowthAreas: string[];
  evidenceEventIds: string[];
  updatedAt: number;
};

export type UserModel = {
  preferences: string[];
  goals: string[];
  communicationStyle: string[];
  constraints: string[];
  contradictions: string[];
  evidenceEventIds: string[];
  updatedAt: number;
};

export type UserModelHypothesis = {
  claim: string;
  confidence: number;
  supportingEvidence: string[];
  contradictingEvidence: string[];
};

export type UserModelDialecticQueryResult = {
  query: string;
  answer: string;
  hypotheses: UserModelHypothesis[];
  model: UserModel;
};

export type SessionMemoryHit = {
  id: string;
  path: string;
  role?: string;
  snippet: string;
  score: number;
  createdAt?: number;
};

export type SessionMemoryRecallResult = {
  query: string;
  backend: "sqlite-fts5" | "text-scan";
  summary: string;
  hits: SessionMemoryHit[];
};

export type ExperienceSearchResult = {
  type: "event" | "conversation" | "skill_candidate" | "self_model";
  id: string;
  summary: string;
  score: number;
  source?: string;
  createdAt?: number;
  updatedAt?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export type ExperienceSearchResponse = {
  query: string;
  results: ExperienceSearchResult[];
};

export type ExperienceSummary = {
  counts: {
    events: number;
    skillCandidates: number;
    selfModelFacts: number;
  };
  recentEvents: ExperienceEvent[];
  recentSkillCandidates: SkillCandidate[];
  selfModel: SelfModel;
};

export type SelfOverview = {
  observedAt: number;
  summary: {
    events: number;
    skillCandidates: number;
    implementedSkills: number;
    selfModelFacts: number;
    dueStrategicPushes: number;
  };
  capabilities: {
    experienceMemory: boolean;
    sessionRecall: boolean;
    selfModel: boolean;
    userModel: boolean;
    skillEvolution: boolean;
    strategicMemory: boolean;
  };
  metrics: SelfMetrics;
  roadmap: SelfRoadmap;
  selfModel: SelfModel;
  recentEvents: ExperienceEvent[];
  recentSkillCandidates: SkillCandidate[];
  dueStrategicPushes: StrategicPush[];
};

export type SelfRoadmapGoal = {
  id: string;
  title: string;
  objective: string;
  status: "active" | "waiting" | "completed";
  priority: "high" | "medium" | "low";
  nextPushAt: number;
  evidenceEventIds: string[];
  blockers: string[];
};

export type SelfMetrics = {
  complexTaskCount: number;
  skillCandidateCount: number;
  implementedSkillCount: number;
  selfImprovedSkillCount: number;
  selfModelFactCount: number;
  strategicMemoryCount: number;
  dueStrategicPushCount: number;
  skillReuseReadiness: number;
};

export type SelfRoadmap = {
  observedAt: number;
  goals: SelfRoadmapGoal[];
  metrics: SelfMetrics;
};

export type ReusableSkillRecommendation = {
  candidate: SkillCandidate;
  score: number;
  reason: string;
};

type ExperienceState = {
  version: 1;
  events: ExperienceEvent[];
  skillCandidates: SkillCandidate[];
  skillUsage: SkillUsageRecord[];
  strategicMemories: StrategicMemory[];
  selfModel: SelfModel;
  userModel: UserModel;
};

const DEFAULT_SELF_MODEL: SelfModel = {
  strengths: [],
  weaknesses: [],
  preferences: [],
  learnedPatterns: [],
  nextGrowthAreas: [],
  evidenceEventIds: [],
  updatedAt: 0,
};

const DEFAULT_USER_MODEL: UserModel = {
  preferences: [],
  goals: [],
  communicationStyle: [],
  constraints: [],
  contradictions: [],
  evidenceEventIds: [],
  updatedAt: 0,
};

function resolveExperienceStorePath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "experience", "experience.json");
}

function resolveSessionMemoryIndexPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "experience", "session-memory.sqlite");
}

function createId(prefix: string, now = Date.now()) {
  return `${prefix}_${now}_${Math.random().toString(36).slice(2, 10)}`;
}

function slugifySkillName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "zhushou-skill";
}

function yamlQuote(value: string): string {
  return JSON.stringify(value);
}

function normalizeSkillStep(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }
  return /^[A-Z]/.test(trimmed) ? trimmed : `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function normalizeStringArray(value: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value ?? []) {
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function mergeStringArrays(existing: readonly string[], incoming: readonly string[] | undefined) {
  return normalizeStringArray([...existing, ...(incoming ?? [])]);
}

function readState(): ExperienceState {
  const filePath = resolveExperienceStorePath();
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ExperienceState>;
    return {
      version: 1,
      events: Array.isArray(parsed.events) ? parsed.events as ExperienceEvent[] : [],
      skillCandidates: Array.isArray(parsed.skillCandidates)
        ? parsed.skillCandidates as SkillCandidate[]
        : [],
      skillUsage: Array.isArray((parsed as Partial<ExperienceState>).skillUsage)
        ? (parsed as Partial<ExperienceState>).skillUsage as SkillUsageRecord[]
        : [],
      strategicMemories: Array.isArray((parsed as Partial<ExperienceState>).strategicMemories)
        ? (parsed as Partial<ExperienceState>).strategicMemories as StrategicMemory[]
        : [],
      selfModel: {
        ...DEFAULT_SELF_MODEL,
        ...(parsed.selfModel && typeof parsed.selfModel === "object" ? parsed.selfModel : {}),
      },
      userModel: {
        ...DEFAULT_USER_MODEL,
        ...((parsed as Partial<ExperienceState>).userModel &&
        typeof (parsed as Partial<ExperienceState>).userModel === "object"
          ? (parsed as Partial<ExperienceState>).userModel
          : {}),
      },
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return {
        version: 1,
        events: [],
        skillCandidates: [],
        skillUsage: [],
        strategicMemories: [],
        selfModel: { ...DEFAULT_SELF_MODEL },
        userModel: { ...DEFAULT_USER_MODEL },
      };
    }
    throw error;
  }
}

function writeState(state: ExperienceState) {
  const filePath = resolveExperienceStorePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
}

function scoreText(queryTerms: string[], text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const term of queryTerms) {
    if (!term) {
      continue;
    }
    if (lower.includes(term)) {
      score += term.length > 2 ? 2 : 1;
    }
  }
  if (queryTerms.length > 0 && lower.includes(queryTerms.join(" "))) {
    score += 4;
  }
  return score;
}

function tokenizeQuery(query: string): string[] {
  return Array.from(new Set(query.toLowerCase().split(/\s+/).map((part) => part.trim()).filter(Boolean)));
}

function eventSearchText(event: ExperienceEvent): string {
  return [
    event.kind,
    event.summary,
    event.source,
    event.sessionKey,
    ...event.tags,
    ...event.evidence,
    event.outcome,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n");
}

function isComplexTaskEvent(event: ExperienceEvent): boolean {
  const tags = new Set(event.tags.map((tag) => tag.toLowerCase()));
  const haystack = eventSearchText(event).toLowerCase();
  return (
    event.kind === "complex_task" ||
    tags.has("complex-task") ||
    tags.has("skill-worthy") ||
    event.evidence.length >= 3 ||
    /\b(complex|multi-step|reproduced|verified|root cause|修复|验证)\b/i.test(haystack)
  );
}

function buildAutonomousSkillCandidate(event: ExperienceEvent, now = Date.now()): SkillCandidate {
  const title = event.summary.length > 72 ? event.summary.slice(0, 69).trimEnd() + "..." : event.summary;
  const evidenceSteps = event.evidence.map(normalizeSkillStep).filter(Boolean);
  const outcomeStep = event.outcome ? normalizeSkillStep(`Verify ${event.outcome}`) : "";
  const steps = normalizeStringArray([
    ...evidenceSteps,
    outcomeStep,
  ]);
  return {
    id: createId("skill_candidate", now),
    title,
    trigger: `Use when a similar task appears: ${event.summary}`,
    steps: steps.length > 0 ? steps : ["Capture the observed failure", "Apply the proven fix", "Verify the outcome"],
    status: "proposed",
    evidenceEventIds: [event.id],
    tags: normalizeStringArray([...event.tags, "autonomous", "agentskills.io"]),
    createdAt: now,
    updatedAt: now,
  };
}

function countSelfModelFacts(selfModel: SelfModel): number {
  return (
    selfModel.strengths.length +
    selfModel.weaknesses.length +
    selfModel.preferences.length +
    selfModel.learnedPatterns.length +
    selfModel.nextGrowthAreas.length
  );
}

function distillSelfModelFromComplexTask(
  selfModel: SelfModel,
  event: ExperienceEvent,
  now: number,
): SelfModel {
  return {
    strengths: mergeStringArrays(selfModel.strengths, event.source
      ? [`Can complete complex ${event.source} work and retain reusable evidence`]
      : ["Can complete complex tasks and retain reusable evidence"]),
    weaknesses: mergeStringArrays(selfModel.weaknesses, []),
    preferences: mergeStringArrays(selfModel.preferences, [
      "Prefer converting verified complex work into durable memory and reusable skills",
    ]),
    learnedPatterns: mergeStringArrays(selfModel.learnedPatterns, [
      `From complex task: ${event.summary}`,
      ...(event.outcome ? [`Verified outcome: ${event.outcome}`] : []),
    ]),
    nextGrowthAreas: mergeStringArrays(selfModel.nextGrowthAreas, [
      "Turn complex-task experience into reusable skills automatically",
      "Reuse generated skills before repeating similar manual work",
    ]),
    evidenceEventIds: mergeStringArrays(selfModel.evidenceEventIds, [event.id]),
    updatedAt: now,
  };
}

function skillCandidateSearchText(candidate: SkillCandidate): string {
  return [
    candidate.title,
    candidate.trigger,
    candidate.status,
    ...candidate.steps,
    ...candidate.tags,
    ...candidate.evidenceEventIds,
  ].join("\n");
}

function isImplementedSkillCandidate(candidate: SkillCandidate): boolean {
  return candidate.status === "implemented" || candidate.tags.includes("auto-promoted");
}

function selfMetrics(state: ExperienceState, now = Date.now()): SelfMetrics {
  const dueStrategicPushCount = state.strategicMemories.filter((memory) => memory.nextPushAt <= now).length;
  const implementedSkillCount = state.skillCandidates.filter(isImplementedSkillCandidate).length;
  return {
    complexTaskCount: state.events.filter(isComplexTaskEvent).length,
    skillCandidateCount: state.skillCandidates.length,
    implementedSkillCount,
    selfImprovedSkillCount: state.skillCandidates.filter((candidate) =>
      candidate.tags.includes("self-improved")
    ).length,
    selfModelFactCount: countSelfModelFacts(state.selfModel),
    strategicMemoryCount: state.strategicMemories.length,
    dueStrategicPushCount,
    skillReuseReadiness: state.skillCandidates.length > 0
      ? Math.round((implementedSkillCount / state.skillCandidates.length) * 100)
      : 0,
  };
}

function buildSelfRoadmapGoals(state: ExperienceState, now: number): SelfRoadmapGoal[] {
  const metrics = selfMetrics(state, now);
  const recentComplexEvidence = state.events.filter(isComplexTaskEvent).slice(0, 5).map((event) => event.id);
  return [
    {
      id: "skill_reuse",
      title: "Self roadmap: skill reuse",
      objective: "Increase automatic reuse of generated skills before repeating similar work.",
      status: metrics.skillCandidateCount > metrics.implementedSkillCount ? "active" : "waiting",
      priority: metrics.skillCandidateCount > metrics.implementedSkillCount ? "high" : "medium",
      nextPushAt: now,
      evidenceEventIds: recentComplexEvidence,
      blockers: metrics.skillCandidateCount === 0 ? ["No skill candidates have been created yet"] : [],
    },
    {
      id: "self_upgrade_loop",
      title: "Self roadmap: code-level upgrade loop",
      objective: "Close the loop from detected capability gaps to implementation, verification, and release handoff.",
      status: "active",
      priority: metrics.complexTaskCount > 0 ? "high" : "medium",
      nextPushAt: now,
      evidenceEventIds: recentComplexEvidence,
      blockers: ["Requires guarded code-change orchestration and release policy integration"],
    },
    {
      id: "capability_metrics",
      title: "Self roadmap: capability metrics",
      objective: "Track trend metrics for failures, skill reuse, self repairs, and capability boundary expansion.",
      status: metrics.selfModelFactCount > 0 ? "active" : "waiting",
      priority: "medium",
      nextPushAt: now,
      evidenceEventIds: state.selfModel.evidenceEventIds.slice(0, 5),
      blockers: [],
    },
  ];
}

function extractMessageText(message: unknown): string {
  if (!message || typeof message !== "object") {
    return "";
  }
  const record = message as Record<string, unknown>;
  const content = record.content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => {
      if (!part || typeof part !== "object") {
        return "";
      }
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n");
}

function listTranscriptFiles(): string[] {
  const root = path.join(resolveStateDir(), "agents");
  const files: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function searchTranscriptFile(filePath: string, queryTerms: string[]): ExperienceSearchResult | null {
  let raw = "";
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  const snippets: string[] = [];
  let bestScore = 0;
  let lastTimestamp: number | undefined;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    try {
      const parsed = JSON.parse(line) as { message?: unknown; timestamp?: unknown };
      const text = extractMessageText(parsed.message);
      if (!text.trim()) {
        continue;
      }
      const score = scoreText(queryTerms, text);
      if (score > 0) {
        bestScore += score;
        if (snippets.length < 3) {
          snippets.push(text.replace(/\s+/g, " ").trim().slice(0, 240));
        }
      }
      const ts = typeof parsed.timestamp === "string" ? Date.parse(parsed.timestamp) : undefined;
      if (typeof ts === "number" && Number.isFinite(ts)) {
        lastTimestamp = ts;
      }
    } catch {
      continue;
    }
  }
  if (bestScore <= 0 || snippets.length === 0) {
    return null;
  }
  return {
    type: "conversation",
    id: filePath,
    summary: snippets.join("\n"),
    score: bestScore,
    source: "transcript",
    updatedAt: lastTimestamp,
    metadata: { path: filePath },
  };
}

function sessionMemoryRowId(filePath: string, lineNumber: number): string {
  return `${filePath}:${lineNumber}`;
}

function openSessionMemoryIndex() {
  const dbPath = resolveSessionMemoryIndexPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const { DatabaseSync } = requireNodeSqlite();
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode = WAL;`);
  db.exec(`PRAGMA synchronous = NORMAL;`);
  db.exec(`PRAGMA busy_timeout = 5000;`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_memory_docs (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      line INTEGER NOT NULL,
      role TEXT,
      text TEXT NOT NULL,
      created_at INTEGER,
      indexed_at INTEGER NOT NULL
    );
  `);
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS session_memory_fts USING fts5(
      text,
      id UNINDEXED,
      path UNINDEXED,
      role UNINDEXED,
      created_at UNINDEXED
    );
  `);
  return db;
}

function escapeFtsTerm(term: string): string {
  return `"${term.replace(/"/g, '""')}"`;
}

function buildFtsQuery(query: string): string {
  const terms = tokenizeQuery(query).filter((term) => term.length > 1).slice(0, 12);
  return terms.length > 0 ? terms.map(escapeFtsTerm).join(" OR ") : escapeFtsTerm(query.trim());
}

function indexSessionTranscripts(): { backend: "sqlite-fts5" | "text-scan"; error?: string } {
  let db: ReturnType<typeof openSessionMemoryIndex> | undefined;
  try {
    db = openSessionMemoryIndex();
    const upsertDoc = db.prepare(`
      INSERT OR REPLACE INTO session_memory_docs (
        id,
        path,
        line,
        role,
        text,
        created_at,
        indexed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const deleteFts = db.prepare(`DELETE FROM session_memory_fts WHERE id = ?`);
    const insertFts = db.prepare(`
      INSERT INTO session_memory_fts (text, id, path, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const filePath of listTranscriptFiles()) {
        let raw = "";
        try {
          raw = fs.readFileSync(filePath, "utf8");
        } catch {
          continue;
        }
        let lineNumber = 0;
        for (const line of raw.split(/\r?\n/)) {
          lineNumber += 1;
          if (!line.trim()) {
            continue;
          }
          try {
            const parsed = JSON.parse(line) as { message?: unknown; timestamp?: unknown };
            const text = extractMessageText(parsed.message).replace(/\s+/g, " ").trim();
            if (!text) {
              continue;
            }
            const message = parsed.message && typeof parsed.message === "object"
              ? parsed.message as { role?: unknown }
              : {};
            const role = typeof message.role === "string" ? message.role : undefined;
            const ts = typeof parsed.timestamp === "string" ? Date.parse(parsed.timestamp) : undefined;
            const createdAt = typeof ts === "number" && Number.isFinite(ts) ? ts : undefined;
            const id = sessionMemoryRowId(filePath, lineNumber);
            upsertDoc.run(id, filePath, lineNumber, role ?? null, text, createdAt ?? null, now);
            deleteFts.run(id);
            insertFts.run(text, id, filePath, role ?? null, createdAt ?? null);
          } catch {
            continue;
          }
        }
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return { backend: "sqlite-fts5" };
  } catch (error) {
    return { backend: "text-scan", error: String(error) };
  } finally {
    db?.close();
  }
}

function recallSessionMemoryWithTextScan(params: {
  query: string;
  limit: number;
}): SessionMemoryHit[] {
  const terms = tokenizeQuery(params.query);
  const hits: SessionMemoryHit[] = [];
  for (const filePath of listTranscriptFiles()) {
    let raw = "";
    try {
      raw = fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }
    let lineNumber = 0;
    for (const line of raw.split(/\r?\n/)) {
      lineNumber += 1;
      if (!line.trim()) {
        continue;
      }
      try {
        const parsed = JSON.parse(line) as { message?: unknown; timestamp?: unknown };
        const text = extractMessageText(parsed.message).replace(/\s+/g, " ").trim();
        const score = scoreText(terms, text);
        if (score <= 0) {
          continue;
        }
        const message = parsed.message && typeof parsed.message === "object"
          ? parsed.message as { role?: unknown }
          : {};
        const role = typeof message.role === "string" ? message.role : undefined;
        const ts = typeof parsed.timestamp === "string" ? Date.parse(parsed.timestamp) : undefined;
        hits.push({
          id: sessionMemoryRowId(filePath, lineNumber),
          path: filePath,
          ...(role ? { role } : {}),
          snippet: text.slice(0, 320),
          score,
          ...(typeof ts === "number" && Number.isFinite(ts) ? { createdAt: ts } : {}),
        });
      } catch {
        continue;
      }
    }
  }
  return hits
    .toSorted((a, b) => b.score - a.score || (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, params.limit);
}

function defaultSessionSummary(query: string, hits: SessionMemoryHit[]): string {
  if (hits.length === 0) {
    return `No session memory matched "${query}".`;
  }
  return [
    `Session recall for "${query}" found ${hits.length} hit(s).`,
    ...hits.slice(0, 3).map((hit) => `- ${hit.snippet}`),
  ].join("\n");
}

function selfModelSearchText(selfModel: SelfModel): string {
  return [
    ...selfModel.strengths,
    ...selfModel.weaknesses,
    ...selfModel.preferences,
    ...selfModel.learnedPatterns,
    ...selfModel.nextGrowthAreas,
    ...selfModel.evidenceEventIds,
  ].join("\n");
}

export function captureExperienceEvent(params: {
  kind?: string;
  summary: string;
  source?: string;
  sessionKey?: string;
  tags?: string[];
  evidence?: string[];
  outcome?: string;
}): ExperienceEvent {
  const now = Date.now();
  const state = readState();
  const event: ExperienceEvent = {
    id: createId("exp", now),
    kind: params.kind?.trim() || "lesson",
    summary: params.summary.trim(),
    ...(params.source?.trim() ? { source: params.source.trim() } : {}),
    ...(params.sessionKey?.trim() ? { sessionKey: params.sessionKey.trim() } : {}),
    tags: normalizeStringArray(params.tags),
    evidence: normalizeStringArray(params.evidence),
    ...(params.outcome?.trim() ? { outcome: params.outcome.trim() } : {}),
    createdAt: now,
    updatedAt: now,
  };
  state.events = [event, ...state.events];
  if (isComplexTaskEvent(event)) {
    state.selfModel = distillSelfModelFromComplexTask(state.selfModel, event, now);
    const duplicate = state.skillCandidates.some((candidate) =>
      candidate.evidenceEventIds.includes(event.id) ||
      candidate.title.toLowerCase() === event.summary.toLowerCase()
    );
    if (!duplicate) {
      state.skillCandidates = [buildAutonomousSkillCandidate(event, now), ...state.skillCandidates];
    }
  }
  writeState(state);
  return event;
}

export function searchExperience(params: { query: string; limit?: number }): ExperienceSearchResponse {
  const query = params.query.trim();
  const terms = tokenizeQuery(query);
  const limit = typeof params.limit === "number" && Number.isFinite(params.limit)
    ? Math.max(1, Math.floor(params.limit))
    : 20;
  const state = readState();
  const results: ExperienceSearchResult[] = [];

  for (const event of state.events) {
    const score = scoreText(terms, eventSearchText(event));
    if (score > 0) {
      results.push({
        type: "event",
        id: event.id,
        summary: event.summary,
        score,
        source: event.source,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        tags: event.tags,
      });
    }
  }

  for (const candidate of state.skillCandidates) {
    const score = scoreText(terms, skillCandidateSearchText(candidate));
    if (score > 0) {
      results.push({
        type: "skill_candidate",
        id: candidate.id,
        summary: candidate.title,
        score,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
        tags: candidate.tags,
      });
    }
  }

  const selfModelScore = scoreText(terms, selfModelSearchText(state.selfModel));
  if (selfModelScore > 0) {
    results.push({
      type: "self_model",
      id: "self_model",
      summary: "Persistent self model matched this query.",
      score: selfModelScore,
      updatedAt: state.selfModel.updatedAt,
    });
  }

  for (const filePath of listTranscriptFiles()) {
    const match = searchTranscriptFile(filePath, terms);
    if (match) {
      results.push(match);
    }
  }

  return {
    query,
    results: results
      .toSorted((a, b) => b.score - a.score || (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, limit),
  };
}

export function recallSessionMemory(params: {
  query: string;
  limit?: number;
  summarizeWith?: (params: { query: string; hits: SessionMemoryHit[] }) => string;
}): SessionMemoryRecallResult {
  const query = params.query.trim();
  const limit = typeof params.limit === "number" && Number.isFinite(params.limit)
    ? Math.max(1, Math.floor(params.limit))
    : 10;
  const index = indexSessionTranscripts();
  let backend = index.backend;
  let hits: SessionMemoryHit[] = [];

  if (index.backend === "sqlite-fts5") {
    let db: ReturnType<typeof openSessionMemoryIndex> | undefined;
    try {
      db = openSessionMemoryIndex();
      const rows = db.prepare(`
        SELECT
          id,
          path,
          role,
          snippet(session_memory_fts, 0, '', '', ' ... ', 24) AS snippet,
          bm25(session_memory_fts) AS rank,
          created_at
        FROM session_memory_fts
        WHERE session_memory_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(buildFtsQuery(query), limit) as Array<{
        id: string;
        path: string;
        role?: string | null;
        snippet: string;
        rank: number;
        created_at?: number | null;
      }>;
      hits = rows.map((row) => ({
        id: row.id,
        path: row.path,
        ...(row.role ? { role: row.role } : {}),
        snippet: row.snippet.replace(/\s+/g, " ").trim(),
        score: Math.max(1, Math.round(Math.abs(row.rank) * 1000) || 1),
        ...(typeof row.created_at === "number" ? { createdAt: row.created_at } : {}),
      }));
    } catch {
      backend = "text-scan";
      hits = recallSessionMemoryWithTextScan({ query, limit });
    } finally {
      db?.close();
    }
  } else {
    hits = recallSessionMemoryWithTextScan({ query, limit });
  }

  const summary = params.summarizeWith
    ? params.summarizeWith({ query, hits })
    : defaultSessionSummary(query, hits);
  return { query, backend, summary, hits };
}

export function summarizeExperience(params: { limit?: number } = {}): ExperienceSummary {
  const limit = typeof params.limit === "number" && Number.isFinite(params.limit)
    ? Math.max(1, Math.floor(params.limit))
    : 10;
  const state = readState();
  return {
    counts: {
      events: state.events.length,
      skillCandidates: state.skillCandidates.length,
      selfModelFacts: countSelfModelFacts(state.selfModel),
    },
    recentEvents: state.events.slice(0, limit),
    recentSkillCandidates: state.skillCandidates.slice(0, limit),
    selfModel: state.selfModel,
  };
}

export function getSelfOverview(params: { now?: number; limit?: number } = {}): SelfOverview {
  const now = typeof params.now === "number" && Number.isFinite(params.now) ? params.now : Date.now();
  const limit = typeof params.limit === "number" && Number.isFinite(params.limit)
    ? Math.max(1, Math.floor(params.limit))
    : 10;
  const state = readState();
  const dueStrategicPushes = listDueStrategicPushes({ now, limit });
  const roadmap = getSelfRoadmap({ now });
  return {
    observedAt: now,
    summary: {
      events: state.events.length,
      skillCandidates: state.skillCandidates.length,
      implementedSkills: state.skillCandidates.filter((candidate) => candidate.status === "implemented").length,
      selfModelFacts: countSelfModelFacts(state.selfModel),
      dueStrategicPushes: dueStrategicPushes.length,
    },
    capabilities: {
      experienceMemory: true,
      sessionRecall: true,
      selfModel: true,
      userModel: true,
      skillEvolution: true,
      strategicMemory: true,
    },
    metrics: roadmap.metrics,
    roadmap,
    selfModel: state.selfModel,
    recentEvents: state.events.slice(0, limit),
    recentSkillCandidates: state.skillCandidates.slice(0, limit),
    dueStrategicPushes,
  };
}

export function getSelfRoadmap(params: { now?: number } = {}): SelfRoadmap {
  const now = typeof params.now === "number" && Number.isFinite(params.now) ? params.now : Date.now();
  const state = readState();
  return {
    observedAt: now,
    goals: buildSelfRoadmapGoals(state, now),
    metrics: selfMetrics(state, now),
  };
}

export function recommendReusableSkills(params: {
  goal: string;
  limit?: number;
}): ReusableSkillRecommendation[] {
  const terms = tokenizeQuery(params.goal);
  const limit = typeof params.limit === "number" && Number.isFinite(params.limit)
    ? Math.max(1, Math.floor(params.limit))
    : 5;
  return readState().skillCandidates
    .filter(isImplementedSkillCandidate)
    .map((candidate) => ({
      candidate,
      score: scoreText(terms, skillCandidateSearchText(candidate)),
    }))
    .filter((entry) => entry.score > 0)
    .toSorted((a, b) => b.score - a.score || b.candidate.updatedAt - a.candidate.updatedAt)
    .slice(0, limit)
    .map((entry) => ({
      candidate: entry.candidate,
      score: entry.score,
      reason: `matched ${entry.score} reusable skill signal(s) for this goal`,
    }));
}

export function advanceSelfRoadmap(params: { now?: number } = {}): {
  createdStrategicMemories: number;
  advancedGoalIds: string[];
} {
  const now = typeof params.now === "number" && Number.isFinite(params.now) ? params.now : Date.now();
  const state = readState();
  const goals = buildSelfRoadmapGoals(state, now).filter((goal) => goal.status === "active");
  const existingObjectives = new Set(state.strategicMemories.map((memory) => memory.objective.toLowerCase()));
  let createdStrategicMemories = 0;
  const advancedGoalIds: string[] = [];
  for (const goal of goals) {
    const objectiveKey = goal.objective.toLowerCase();
    if (existingObjectives.has(objectiveKey)) {
      continue;
    }
    const memory: StrategicMemory = {
      id: createId("strategy", now),
      title: goal.title,
      objective: goal.objective,
      cadence: "daily",
      nextPushAt: now,
      evidenceEventIds: goal.evidenceEventIds,
      tags: ["self-roadmap", goal.id],
      createdAt: now,
      updatedAt: now,
    };
    state.strategicMemories = [memory, ...state.strategicMemories];
    existingObjectives.add(objectiveKey);
    createdStrategicMemories += 1;
    advancedGoalIds.push(goal.id);
  }
  if (createdStrategicMemories > 0) {
    writeState(state);
  }
  return { createdStrategicMemories, advancedGoalIds };
}

export function captureStrategicMemory(params: {
  title: string;
  objective: string;
  cadence?: StrategicMemoryCadence;
  nextPushAt?: number;
  evidenceEventIds?: string[];
  tags?: string[];
}): StrategicMemory {
  const now = Date.now();
  const state = readState();
  const memory: StrategicMemory = {
    id: createId("strategy", now),
    title: params.title.trim(),
    objective: params.objective.trim(),
    cadence: params.cadence ?? "weekly",
    nextPushAt: typeof params.nextPushAt === "number" && Number.isFinite(params.nextPushAt)
      ? Math.max(0, Math.floor(params.nextPushAt))
      : now,
    evidenceEventIds: normalizeStringArray(params.evidenceEventIds),
    tags: normalizeStringArray(params.tags),
    createdAt: now,
    updatedAt: now,
  };
  state.strategicMemories = [memory, ...state.strategicMemories];
  writeState(state);
  return memory;
}

export function listDueStrategicPushes(params: { now?: number; limit?: number } = {}): StrategicPush[] {
  const now = typeof params.now === "number" && Number.isFinite(params.now) ? params.now : Date.now();
  const limit = typeof params.limit === "number" && Number.isFinite(params.limit)
    ? Math.max(1, Math.floor(params.limit))
    : 20;
  return readState().strategicMemories
    .filter((memory) => memory.nextPushAt <= now)
    .toSorted((a, b) => a.nextPushAt - b.nextPushAt)
    .slice(0, limit)
    .map((memory) => ({
      id: memory.id,
      title: memory.title,
      prompt: `Strategic push: ${memory.objective}`,
      cadence: memory.cadence,
      nextPushAt: memory.nextPushAt,
      evidenceEventIds: memory.evidenceEventIds,
      tags: memory.tags,
    }));
}

function cadenceMs(cadence: StrategicMemoryCadence): number {
  switch (cadence) {
    case "hourly":
      return 60 * 60 * 1_000;
    case "daily":
      return 24 * 60 * 60 * 1_000;
    case "monthly":
      return 30 * 24 * 60 * 60 * 1_000;
    case "weekly":
    default:
      return 7 * 24 * 60 * 60 * 1_000;
  }
}

export function advanceStrategicMemoryPush(params: {
  id: string;
  pushedAt?: number;
}): StrategicMemory {
  const state = readState();
  const index = state.strategicMemories.findIndex((memory) => memory.id === params.id);
  if (index < 0) {
    throw new Error(`Strategic memory not found: ${params.id}`);
  }
  const pushedAt = typeof params.pushedAt === "number" && Number.isFinite(params.pushedAt)
    ? Math.max(0, Math.floor(params.pushedAt))
    : Date.now();
  const memory = state.strategicMemories[index];
  const advanced: StrategicMemory = {
    ...memory,
    lastPushedAt: pushedAt,
    nextPushAt: pushedAt + cadenceMs(memory.cadence),
    updatedAt: pushedAt,
  };
  state.strategicMemories[index] = advanced;
  writeState(state);
  return advanced;
}

export function createSkillCandidate(params: {
  title: string;
  trigger: string;
  steps: string[];
  evidenceEventIds?: string[];
  tags?: string[];
}): SkillCandidate {
  const now = Date.now();
  const state = readState();
  const candidate: SkillCandidate = {
    id: createId("skill_candidate", now),
    title: params.title.trim(),
    trigger: params.trigger.trim(),
    steps: normalizeStringArray(params.steps),
    status: "proposed",
    evidenceEventIds: normalizeStringArray(params.evidenceEventIds),
    tags: normalizeStringArray(params.tags),
    createdAt: now,
    updatedAt: now,
  };
  state.skillCandidates = [candidate, ...state.skillCandidates];
  writeState(state);
  return candidate;
}

export function recordSkillUsage(params: {
  candidateId: string;
  successful?: boolean;
  outcome: string;
  observations?: string[];
}): { usage: SkillUsageRecord; candidate: SkillCandidate } {
  const now = Date.now();
  const state = readState();
  const index = state.skillCandidates.findIndex((candidate) => candidate.id === params.candidateId);
  if (index < 0) {
    throw new Error(`Skill candidate not found: ${params.candidateId}`);
  }
  const usage: SkillUsageRecord = {
    id: createId("skill_usage", now),
    candidateId: params.candidateId,
    successful: params.successful ?? true,
    outcome: params.outcome.trim(),
    observations: normalizeStringArray(params.observations),
    createdAt: now,
  };
  const candidate = state.skillCandidates[index];
  const improvedSteps = normalizeStringArray([
    ...candidate.steps,
    ...usage.observations.map(normalizeSkillStep),
  ]);
  const improvedCandidate: SkillCandidate = {
    ...candidate,
    steps: improvedSteps.length > 0 ? improvedSteps : candidate.steps,
    tags: normalizeStringArray([...candidate.tags, "self-improved"]),
    updatedAt: now,
  };
  const successfulUsageCount = state.skillUsage.filter((usage) =>
    usage.candidateId === params.candidateId && usage.successful
  ).length + (usage.successful ? 1 : 0);
  if (usage.successful && successfulUsageCount >= 2 && candidate.status !== "implemented") {
    improvedCandidate.status = "implemented";
    improvedCandidate.tags = normalizeStringArray([
      ...improvedCandidate.tags,
      "auto-promoted",
      "agentskills.io",
    ]);
    state.skillCandidates[index] = improvedCandidate;
    state.skillUsage = [usage, ...state.skillUsage];
    writeState(state);
    exportSkillCandidateAsAgentSkill({ candidateId: params.candidateId });
    return { usage, candidate: improvedCandidate };
  }
  state.skillCandidates[index] = improvedCandidate;
  state.skillUsage = [usage, ...state.skillUsage];
  writeState(state);
  return { usage, candidate: improvedCandidate };
}

export function exportSkillCandidateAsAgentSkill(params: {
  candidateId: string;
  targetDir?: string;
}): { name: string; directory: string; skillPath: string; content: string } {
  const state = readState();
  const candidate = state.skillCandidates.find((entry) => entry.id === params.candidateId);
  if (!candidate) {
    throw new Error(`Skill candidate not found: ${params.candidateId}`);
  }
  const name = slugifySkillName(candidate.title);
  const directory = path.join(params.targetDir ?? path.join(resolveStateDir(), "skills", "generated"), name);
  const skillPath = path.join(directory, "SKILL.md");
  const normalizedTrigger = candidate.trigger.replace(/\s+/g, " ").trim();
  const description = /^use when\b/i.test(normalizedTrigger)
    ? normalizedTrigger
    : `Use when ${normalizedTrigger}`;
  const body = [
    "---",
    `name: ${name}`,
    `description: ${yamlQuote(description)}`,
    "---",
    "",
    `# ${candidate.title}`,
    "",
    `Trigger: ${candidate.trigger}`,
    "",
    "## Steps",
    ...candidate.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Evidence",
    ...candidate.evidenceEventIds.map((id) => `- ${id}`),
    "",
  ];
  const content = body.join("\n");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(skillPath, content, "utf8");
  return { name, directory, skillPath, content };
}

export function listSkillCandidates(params: {
  status?: SkillCandidateStatus;
  limit?: number;
} = {}): SkillCandidate[] {
  const limit = typeof params.limit === "number" && Number.isFinite(params.limit)
    ? Math.max(1, Math.floor(params.limit))
    : undefined;
  const candidates = readState().skillCandidates
    .filter((candidate) => !params.status || candidate.status === params.status)
    .toSorted((a, b) => b.createdAt - a.createdAt);
  return limit ? candidates.slice(0, limit) : candidates;
}

export function getSelfModel(): SelfModel {
  return readState().selfModel;
}

export function getUserModel(): UserModel {
  return readState().userModel;
}

export function updateSelfModel(params: {
  strengths?: string[];
  weaknesses?: string[];
  preferences?: string[];
  learnedPatterns?: string[];
  nextGrowthAreas?: string[];
  evidenceEventIds?: string[];
}): SelfModel {
  const state = readState();
  const now = Date.now();
  state.selfModel = {
    strengths: mergeStringArrays(state.selfModel.strengths, params.strengths),
    weaknesses: mergeStringArrays(state.selfModel.weaknesses, params.weaknesses),
    preferences: mergeStringArrays(state.selfModel.preferences, params.preferences),
    learnedPatterns: mergeStringArrays(state.selfModel.learnedPatterns, params.learnedPatterns),
    nextGrowthAreas: mergeStringArrays(state.selfModel.nextGrowthAreas, params.nextGrowthAreas),
    evidenceEventIds: mergeStringArrays(state.selfModel.evidenceEventIds, params.evidenceEventIds),
    updatedAt: now,
  };
  writeState(state);
  return state.selfModel;
}

export function updateUserModel(params: {
  preferences?: string[];
  goals?: string[];
  communicationStyle?: string[];
  constraints?: string[];
  contradictions?: string[];
  evidenceEventIds?: string[];
}): UserModel {
  const state = readState();
  const now = Date.now();
  state.userModel = {
    preferences: mergeStringArrays(state.userModel.preferences, params.preferences),
    goals: mergeStringArrays(state.userModel.goals, params.goals),
    communicationStyle: mergeStringArrays(
      state.userModel.communicationStyle,
      params.communicationStyle,
    ),
    constraints: mergeStringArrays(state.userModel.constraints, params.constraints),
    contradictions: mergeStringArrays(state.userModel.contradictions, params.contradictions),
    evidenceEventIds: mergeStringArrays(state.userModel.evidenceEventIds, params.evidenceEventIds),
    updatedAt: now,
  };
  writeState(state);
  return state.userModel;
}

function evidenceForIds(events: ExperienceEvent[], ids: readonly string[]): string[] {
  const idSet = new Set(ids);
  return events
    .filter((event) => idSet.has(event.id))
    .map((event) => event.summary);
}

export function queryUserModelDialectic(params: { query: string; limit?: number }): UserModelDialecticQueryResult {
  const state = readState();
  const terms = tokenizeQuery(params.query);
  const limit = typeof params.limit === "number" && Number.isFinite(params.limit)
    ? Math.max(1, Math.floor(params.limit))
    : 5;
  const supportEvidence = evidenceForIds(state.events, state.userModel.evidenceEventIds);
  const contradictionEvidence = [
    ...state.userModel.contradictions,
    ...supportEvidence.filter((summary) => /detail|analysis|architecture|详细|解析|方案/i.test(summary)),
  ];
  const claims = [
    ...state.userModel.preferences,
    ...state.userModel.goals,
    ...state.userModel.communicationStyle,
    ...state.userModel.constraints,
  ];
  const rankedClaims = claims
    .map((claim) => ({
      claim,
      score: scoreText(terms, claim) + (scoreText(terms, supportEvidence.join("\n")) > 0 ? 1 : 0),
    }))
    .toSorted((a, b) => b.score - a.score)
    .slice(0, limit);
  const selected = rankedClaims.length > 0 ? rankedClaims : claims.slice(0, limit).map((claim) => ({ claim, score: 1 }));
  const hypotheses = selected.map((entry): UserModelHypothesis => ({
    claim: entry.claim,
    confidence: Math.min(0.95, 0.55 + Math.max(0, entry.score) * 0.1),
    supportingEvidence: supportEvidence.length > 0 ? supportEvidence : state.userModel.evidenceEventIds,
    contradictingEvidence: contradictionEvidence,
  }));
  const answer = hypotheses.length > 0
    ? hypotheses.map((hypothesis) => hypothesis.claim).join("; ")
    : "No user model facts matched this query.";
  return {
    query: params.query.trim(),
    answer,
    hypotheses,
    model: state.userModel,
  };
}
