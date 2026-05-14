import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  captureExperienceEvent,
  captureStrategicMemory,
  createSkillCandidate,
  exportSkillCandidateAsAgentSkill,
  getSelfModel,
  getSelfOverview,
  getSelfRoadmap,
  listDueStrategicPushes,
  advanceStrategicMemoryPush,
  listSkillCandidates,
  recommendReusableSkills,
  queryUserModelDialectic,
  recallSessionMemory,
  recordSkillUsage,
  searchExperience,
  advanceSelfRoadmap,
  updateUserModel,
  updateSelfModel,
} from "./experience-store.js";

describe("experience store", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "zhushou-experience-"));
    process.env.ZHUSHOU_STATE_DIR = stateDir;
  });

  afterEach(() => {
    delete process.env.ZHUSHOU_STATE_DIR;
    fs.rmSync(stateDir, { recursive: true, force: true });
  });

  it("captures experience events and searches them after reload", () => {
    const event = captureExperienceEvent({
      kind: "lesson",
      summary: "Remote model detection must only run after a user provides an endpoint.",
      source: "tui",
      tags: ["models", "settings"],
      evidence: ["settings page showed a stale model count"],
      outcome: "deferred remote probing until explicit user input",
    });

    expect(event.id).toMatch(/^exp_/);
    expect(event.summary).toContain("Remote model detection");

    const results = searchExperience({ query: "remote probing", limit: 5 });

    expect(results.results).toEqual([
      expect.objectContaining({
        type: "event",
        id: event.id,
        summary: event.summary,
      }),
    ]);
  });

  it("searches past transcript text stored under the local state directory", () => {
    const sessionsDir = path.join(stateDir, "agents", "main", "sessions");
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.writeFileSync(
      path.join(sessionsDir, "session-1.jsonl"),
      [
        JSON.stringify({ type: "session", id: "session-1" }),
        JSON.stringify({
          id: "msg-1",
          message: {
            role: "user",
            content: [{ type: "text", text: "Please remember the Kubernetes deploy lesson." }],
          },
        }),
      ].join("\n"),
      "utf8",
    );

    const results = searchExperience({ query: "Kubernetes deploy", limit: 5 });

    expect(results.results).toEqual([
      expect.objectContaining({
        type: "conversation",
        id: expect.stringContaining("session-1.jsonl"),
        summary: expect.stringContaining("Kubernetes deploy lesson"),
      }),
    ]);
  });

  it("recalls sessions through a persisted FTS5 index and returns a summary", () => {
    const sessionsDir = path.join(stateDir, "agents", "main", "sessions");
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.writeFileSync(
      path.join(sessionsDir, "session-fts.jsonl"),
      [
        JSON.stringify({
          id: "msg-1",
          timestamp: "2026-05-01T10:00:00.000Z",
          message: {
            role: "user",
            content: [{ type: "text", text: "The deployment checklist must validate migrations first." }],
          },
        }),
        JSON.stringify({
          id: "msg-2",
          timestamp: "2026-05-01T10:01:00.000Z",
          message: {
            role: "assistant",
            content: "We should convert that checklist into a reusable rollout skill.",
          },
        }),
      ].join("\n"),
      "utf8",
    );

    const recall = recallSessionMemory({
      query: "deployment checklist migrations",
      limit: 3,
      summarizeWith: ({ hits }) => `LLM summary: ${hits.map((hit) => hit.snippet).join(" ")}`,
    });

    expect(recall.backend).toBe("sqlite-fts5");
    expect(recall.summary).toContain("LLM summary:");
    expect(recall.hits).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: expect.stringContaining("session-fts.jsonl"),
        snippet: expect.stringContaining("deployment checklist"),
      }),
    ]));
  });

  it("creates persistent skill candidates from repeated experience", () => {
    const candidate = createSkillCandidate({
      title: "Remote model setup guard",
      trigger: "When the user configures a remote provider endpoint",
      steps: [
        "Validate endpoint before probing",
        "Use provider-specific model list protocol",
        "Report actionable auth or network errors",
      ],
      evidenceEventIds: ["exp_1"],
      tags: ["models"],
    });

    expect(candidate.id).toMatch(/^skill_candidate_/);
    expect(candidate.status).toBe("proposed");

    expect(listSkillCandidates({ status: "proposed" })).toEqual([
      expect.objectContaining({
        id: candidate.id,
        title: "Remote model setup guard",
      }),
    ]);
  });

  it("autonomously creates an agentskills.io-compatible skill after a complex task", () => {
    const event = captureExperienceEvent({
      kind: "complex_task",
      summary: "Repair gateway model configuration sync after timeout failures",
      source: "tui",
      tags: ["complex-task", "gateway", "models"],
      evidence: [
        "Reproduced request timed out: config.patch",
        "Separated save from remote model probing",
        "Verified provider-specific validation paths",
      ],
      outcome: "Settings save no longer blocks on remote probing",
    });

    const candidates = listSkillCandidates({ status: "proposed" });
    expect(candidates).toEqual([
      expect.objectContaining({
        title: expect.stringContaining("Repair gateway model configuration"),
        evidenceEventIds: [event.id],
        steps: expect.arrayContaining([
          expect.stringContaining("Reproduced request timed out"),
          expect.stringContaining("Verify Settings save no longer"),
        ]),
      }),
    ]);

    const exported = exportSkillCandidateAsAgentSkill({ candidateId: candidates[0].id });
    expect(path.basename(exported.directory)).toBe(exported.name);
    expect(exported.content).toContain(`name: ${exported.name}`);
    expect(exported.content).toContain('description: "Use when');
    expect(fs.readFileSync(exported.skillPath, "utf8")).toBe(exported.content);
  });

  it("distills complex task outcomes into the persistent self model", () => {
    const event = captureExperienceEvent({
      kind: "complex_task",
      summary: "Stabilize autonomous backend automation after gateway startup",
      source: "backend-automation",
      tags: ["complex-task", "self", "automation"],
      evidence: [
        "Startup automation scanned skills and memory artifacts",
        "Supervisor history exposed backend automation runs",
      ],
      outcome: "Backend self-maintenance continued without manual prompts",
    });

    const selfModel = getSelfModel();

    expect(selfModel.learnedPatterns).toEqual(expect.arrayContaining([
      expect.stringContaining("Stabilize autonomous backend automation"),
    ]));
    expect(selfModel.nextGrowthAreas).toEqual(expect.arrayContaining([
      expect.stringContaining("Turn complex-task experience into reusable skills"),
    ]));
    expect(selfModel.evidenceEventIds).toContain(event.id);
  });

  it("improves a skill candidate from usage observations", () => {
    const candidate = createSkillCandidate({
      title: "Gateway timeout triage",
      trigger: "When gateway RPC calls time out",
      steps: ["Check gateway process health"],
      tags: ["gateway"],
    });

    const result = recordSkillUsage({
      candidateId: candidate.id,
      successful: true,
      outcome: "Recovered by checking pending config.patch operations first",
      observations: ["Inspect pending config.patch operations before restarting services"],
    });

    expect(result.candidate.steps).toContain("Inspect pending config.patch operations before restarting services");
    expect(result.candidate.tags).toContain("self-improved");
    expect(result.usage.outcome).toContain("Recovered");
  });

  it("auto-promotes repeatedly successful skill candidates into generated skills", () => {
    const candidate = createSkillCandidate({
      title: "Startup automation regression check",
      trigger: "When validating gateway startup self-maintenance",
      steps: ["Run startup automation smoke checks"],
      tags: ["automation"],
    });

    recordSkillUsage({
      candidateId: candidate.id,
      successful: true,
      outcome: "First successful reuse",
      observations: ["Check backend automation history after startup"],
    });
    const promoted = recordSkillUsage({
      candidateId: candidate.id,
      successful: true,
      outcome: "Second successful reuse",
      observations: ["Verify skill is exported after stable reuse"],
    });

    expect(promoted.candidate.status).toBe("implemented");
    expect(promoted.candidate.tags).toEqual(expect.arrayContaining([
      "self-improved",
      "auto-promoted",
      "agentskills.io",
    ]));

    const generated = path.join(stateDir, "skills", "generated");
    const skillFiles = fs.readdirSync(generated, { recursive: true }).map(String);
    expect(skillFiles).toEqual(expect.arrayContaining([expect.stringContaining("SKILL.md")]));
  });

  it("summarizes the full self subsystem in one overview", () => {
    captureExperienceEvent({
      kind: "complex_task",
      summary: "Repair self status aggregation",
      tags: ["complex-task", "self"],
      evidence: ["Added overview tests"],
      outcome: "Self overview reports memory and skills",
    });
    captureStrategicMemory({
      title: "Self improvement cadence",
      objective: "Review self overview gaps periodically",
      nextPushAt: 1,
    });

    const overview = getSelfOverview({ now: 2, limit: 5 });

    expect(overview.summary.events).toBe(1);
    expect(overview.summary.skillCandidates).toBe(1);
    expect(overview.summary.selfModelFacts).toBeGreaterThan(0);
    expect(overview.summary.dueStrategicPushes).toBe(1);
    expect(overview.capabilities).toEqual(expect.objectContaining({
      experienceMemory: true,
      selfModel: true,
      skillEvolution: true,
      strategicMemory: true,
    }));
    expect(overview.recentEvents[0]?.summary).toContain("Repair self status");
  });

  it("maintains a long-horizon self roadmap and autonomous metrics", () => {
    captureExperienceEvent({
      kind: "complex_task",
      summary: "Improve automatic skill reuse for repeated gateway failures",
      tags: ["complex-task", "self-roadmap"],
      evidence: ["Observed repeated gateway failures", "Created reusable triage steps"],
      outcome: "Skill reuse should reduce repeated manual work",
    });

    const roadmap = getSelfRoadmap({ now: 10 });

    expect(roadmap.goals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "skill_reuse",
        status: "active",
        priority: "high",
      }),
    ]));
    expect(roadmap.metrics.complexTaskCount).toBe(1);
    expect(roadmap.metrics.skillCandidateCount).toBe(1);
    expect(roadmap.metrics.selfModelFactCount).toBeGreaterThan(0);

    const overview = getSelfOverview({ now: 10 });
    expect(overview.roadmap.goals).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "skill_reuse" }),
    ]));
    expect(overview.metrics.complexTaskCount).toBe(1);
  });

  it("recommends reusable implemented skills for similar future work", () => {
    const candidate = createSkillCandidate({
      title: "Gateway failure triage",
      trigger: "Use when gateway failures repeat during startup",
      steps: ["Check backend automation history", "Inspect gateway logs"],
      tags: ["gateway", "startup"],
    });
    recordSkillUsage({
      candidateId: candidate.id,
      successful: true,
      outcome: "Resolved startup gateway failure",
      observations: ["Check backend automation history first"],
    });
    recordSkillUsage({
      candidateId: candidate.id,
      successful: true,
      outcome: "Resolved repeated gateway startup failure",
      observations: ["Inspect gateway logs second"],
    });

    const recommendations = recommendReusableSkills({
      goal: "Repair repeated gateway startup failure and inspect automation history",
      limit: 3,
    });

    expect(recommendations).toEqual([
      expect.objectContaining({
        candidate: expect.objectContaining({
          title: "Gateway failure triage",
          status: "implemented",
        }),
        score: expect.any(Number),
        reason: expect.stringContaining("matched"),
      }),
    ]);
  });

  it("advances due self roadmap goals into strategic memory", () => {
    captureExperienceEvent({
      kind: "complex_task",
      summary: "Strengthen self roadmap automation",
      tags: ["complex-task", "self-roadmap"],
      evidence: ["Roadmap gap identified"],
      outcome: "Roadmap should push itself forward",
    });

    const advanced = advanceSelfRoadmap({ now: 1_000 });
    const pushes = listDueStrategicPushes({ now: 1_000 });

    expect(advanced.createdStrategicMemories).toBeGreaterThan(0);
    expect(pushes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: expect.stringContaining("Self roadmap"),
        prompt: expect.stringContaining("skill reuse"),
      }),
    ]));
  });

  it("keeps strategic memories due for periodic pushing", () => {
    const memory = captureStrategicMemory({
      title: "Weekly capability expansion",
      objective: "Review repeated failures and propose one new skill",
      cadence: "weekly",
      nextPushAt: 1_000,
      evidenceEventIds: ["exp_strategy"],
    });

    expect(listDueStrategicPushes({ now: 999 })).toEqual([]);
    expect(listDueStrategicPushes({ now: 1_500 })).toEqual([
      expect.objectContaining({
        id: memory.id,
        prompt: expect.stringContaining("Review repeated failures"),
      }),
    ]);

    const advanced = advanceStrategicMemoryPush({ id: memory.id, pushedAt: 1_500 });
    expect(advanced.lastPushedAt).toBe(1_500);
    expect(advanced.nextPushAt).toBe(1_500 + 7 * 24 * 60 * 60 * 1_000);
    expect(listDueStrategicPushes({ now: 1_501 })).toEqual([]);
  });

  it("queries a Honcho-style dialectic user model with support and contradiction", () => {
    const support = captureExperienceEvent({
      kind: "user_signal",
      summary: "User repeatedly asks for direct execution without long explanations.",
      tags: ["user-model"],
      evidence: ["继续高风险强推", "不要再浪费时间"],
    });
    const contradiction = captureExperienceEvent({
      kind: "user_signal",
      summary: "User also requests detailed architecture analysis for major design questions.",
      tags: ["user-model"],
      evidence: ["请详细解析AI智能体"],
    });
    updateUserModel({
      preferences: ["Prefers direct execution for implementation tasks"],
      goals: ["Wants autonomous agent capabilities to keep improving over time"],
      contradictions: ["May request detailed analysis before implementation on architecture topics"],
      evidenceEventIds: [support.id, contradiction.id],
    });

    const result = queryUserModelDialectic({ query: "implementation communication preference" });

    expect(result.answer).toContain("Prefers direct execution");
    expect(result.hypotheses[0]).toEqual(expect.objectContaining({
      claim: "Prefers direct execution for implementation tasks",
      supportingEvidence: expect.arrayContaining([
        expect.stringContaining("direct execution"),
      ]),
      contradictingEvidence: expect.arrayContaining([
        expect.stringContaining("detailed analysis"),
      ]),
    }));
  });

  it("merges self model updates across sessions without dropping previous knowledge", () => {
    updateSelfModel({
      strengths: ["TUI-first workflows"],
      weaknesses: ["Needs stronger transcript recall"],
      evidenceEventIds: ["exp_a"],
    });
    const updated = updateSelfModel({
      strengths: ["Gateway RPC integration"],
      learnedPatterns: ["Defer remote probes until explicit configuration exists"],
      evidenceEventIds: ["exp_b"],
    });

    expect(updated.strengths).toEqual(["TUI-first workflows", "Gateway RPC integration"]);
    expect(updated.weaknesses).toEqual(["Needs stronger transcript recall"]);
    expect(updated.learnedPatterns).toEqual([
      "Defer remote probes until explicit configuration exists",
    ]);
    expect(updated.evidenceEventIds).toEqual(["exp_a", "exp_b"]);
    expect(getSelfModel()).toEqual(updated);
  });
});
