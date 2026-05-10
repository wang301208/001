import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { businessTaskHandlers } from "./business-tasks.js";
import { listSkillCandidates, searchExperience } from "../../experience/experience-store.js";

const mocks = vi.hoisted(() => ({
  startManagedFlow: vi.fn(() => ({ flow: { id: "flow-1" } })),
}));

vi.mock("../../plugins/runtime/runtime-taskflow.js", () => ({
  createRuntimeTaskFlow: () => ({ kind: "taskflow-runtime" }),
}));

vi.mock("../../plugins/runtime/runtime-autonomy.js", () => ({
  createRuntimeAutonomy: () => ({
    bindSession: () => ({
      startManagedFlow: mocks.startManagedFlow,
    }),
  }),
}));

async function invoke(method: keyof typeof businessTaskHandlers, params: Record<string, unknown>) {
  const respond = vi.fn();
  await businessTaskHandlers[method]({
    params,
    respond: respond as never,
    context: { cron: {} } as never,
    client: null,
    req: { type: "req", id: "req-1", method },
    isWebchatConnect: () => false,
  });
  return respond;
}

describe("business task handlers", () => {
  let stateDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    stateDir = mkdtempSync(path.join(os.tmpdir(), "business-tasks-"));
    process.env.ASSISTANT_STATE_DIR = stateDir;
  });

  afterEach(() => {
    delete process.env.ASSISTANT_STATE_DIR;
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("creates, lists, updates, and deletes persisted business tasks", async () => {
    const createRespond = await invoke("business.tasks.create", {
      agentId: "main",
      name: "处理工单",
      goal: "分析并关闭业务工单",
      duration: "long",
      priority: "high",
      group: "ai",
      business: {
        domain: "ops",
        accessMode: "api",
        object: "INC-001",
      },
    });
    const createCall = createRespond.mock.calls[0];
    expect(createCall?.[0]).toBe(true);
    expect(createCall?.[1]).toEqual(expect.objectContaining({ autonomyStarted: true }));
    expect(mocks.startManagedFlow).toHaveBeenCalledWith(expect.objectContaining({ agentId: "main" }));
    const taskId = createCall?.[1]?.task?.id;
    expect(taskId).toMatch(/^bt_/);

    const listRespond = await invoke("business.tasks.list", {});
    expect(listRespond.mock.calls[0]?.[1]?.tasks).toHaveLength(1);

    const updateRespond = await invoke("business.tasks.update", {
      id: taskId,
      status: "completed",
      progress: 100,
    });
    expect(updateRespond.mock.calls[0]?.[1]?.task).toEqual(expect.objectContaining({
      id: taskId,
      status: "completed",
      progress: 100,
    }));

    const deleteRespond = await invoke("business.tasks.delete", { id: taskId });
    expect(deleteRespond.mock.calls[0]?.[0]).toBe(true);

    const finalListRespond = await invoke("business.tasks.list", {});
    expect(finalListRespond.mock.calls[0]?.[1]?.tasks).toHaveLength(0);
  });

  it("normalizes create defaults and passes business context into the autonomy goal", async () => {
    const createRespond = await invoke("business.tasks.create", {
      agentId: "  ",
      name: "业务接入巡检",
      goal: "确认业务接入链路",
      duration: "invalid",
      priority: "invalid",
      group: "",
      business: {
        domain: "ops",
        domainLabel: "运维业务",
        accessMode: "api",
        accessModeLabel: "API 接入",
        object: "INC-002",
        acceptanceCriteria: "后端持久化且自治流程启动",
        payload: { ticketId: "INC-002" },
      },
    });

    expect(createRespond.mock.calls[0]?.[0]).toBe(true);
    const task = createRespond.mock.calls[0]?.[1]?.task;
    expect(task).toEqual(expect.objectContaining({
      agentId: "main",
      duration: "short",
      priority: "medium",
      group: "ai",
      business: expect.objectContaining({
        domain: "ops",
        domainLabel: "运维业务",
        accessMode: "api",
        accessModeLabel: "API 接入",
        object: "INC-002",
        acceptanceCriteria: "后端持久化且自治流程启动",
        payload: { ticketId: "INC-002" },
      }),
    }));
    expect(mocks.startManagedFlow).toHaveBeenCalledWith(expect.objectContaining({
      agentId: "main",
      goal: expect.stringContaining("业务域：运维业务"),
    }));
    expect(mocks.startManagedFlow).toHaveBeenCalledWith(expect.objectContaining({
      goal: expect.stringContaining("接入方式：API 接入"),
    }));
    expect(mocks.startManagedFlow).toHaveBeenCalledWith(expect.objectContaining({
      goal: expect.stringContaining("业务对象：INC-002"),
    }));
    expect(mocks.startManagedFlow).toHaveBeenCalledWith(expect.objectContaining({
      goal: expect.stringContaining("验收标准：后端持久化且自治流程启动"),
    }));
  });

  it("rejects incomplete create requests", async () => {
    const missingName = await invoke("business.tasks.create", {
      goal: "missing name",
    });
    expect(missingName.mock.calls[0]?.[0]).toBe(false);
    expect(missingName.mock.calls[0]?.[2]).toEqual(expect.objectContaining({
      code: "INVALID_REQUEST",
      message: "name and goal are required",
    }));

    const missingGoal = await invoke("business.tasks.create", {
      name: "missing goal",
    });
    expect(missingGoal.mock.calls[0]?.[0]).toBe(false);
    expect(missingGoal.mock.calls[0]?.[2]).toEqual(expect.objectContaining({
      code: "INVALID_REQUEST",
      message: "name and goal are required",
    }));
  });

  it("filters and limits listed business tasks", async () => {
    const first = await invoke("business.tasks.create", {
      agentId: "main",
      name: "first",
      goal: "first goal",
      duration: "short",
      priority: "low",
      group: "ai",
    });
    const second = await invoke("business.tasks.create", {
      agentId: "main",
      name: "second",
      goal: "second goal",
      duration: "long",
      priority: "high",
      group: "ops",
    });
    const firstId = first.mock.calls[0]?.[1]?.task?.id;
    const secondId = second.mock.calls[0]?.[1]?.task?.id;

    await invoke("business.tasks.update", {
      id: firstId,
      status: "completed",
      progress: 100,
    });

    const completed = await invoke("business.tasks.list", { status: "completed" });
    expect(completed.mock.calls[0]?.[1]?.tasks).toEqual([
      expect.objectContaining({ id: firstId, status: "completed" }),
    ]);

    const limited = await invoke("business.tasks.list", { limit: 1 });
    expect(limited.mock.calls[0]?.[1]?.tasks).toHaveLength(1);
    expect(limited.mock.calls[0]?.[1]?.tasks[0]).toEqual(expect.objectContaining({ id: secondId }));
  });

  it("captures terminal business task outcomes into self experience and skill candidates", async () => {
    const createRespond = await invoke("business.tasks.create", {
      agentId: "main",
      name: "Self roadmap skill reuse",
      goal: "Convert repeated fixes into reusable autonomous skills",
      duration: "long",
      priority: "high",
      group: "self-roadmap",
      business: {
        domain: "self",
        accessMode: "autonomous",
        object: "skill_reuse",
        acceptanceCriteria: "Result is persisted into self experience",
        payload: { selfRoadmapGoalId: "skill_reuse" },
      },
    });
    const taskId = createRespond.mock.calls[0]?.[1]?.task?.id;

    await invoke("business.tasks.update", {
      id: taskId,
      status: "completed",
      progress: 100,
    });

    expect(searchExperience({ query: "Self roadmap skill reuse" }).results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "event",
          summary: expect.stringContaining("Self roadmap skill reuse"),
          tags: expect.arrayContaining(["business-task", "self-roadmap", "completed"]),
        }),
      ]),
    );
    expect(listSkillCandidates({ limit: 1 })).toEqual([
      expect.objectContaining({
        title: expect.stringContaining("Self roadmap skill reuse"),
        tags: expect.arrayContaining(["business-task", "autonomous"]),
      }),
    ]);
  });

  it("records autonomous code-change contracts as self-code experience evidence", async () => {
    const createRespond = await invoke("business.tasks.create", {
      agentId: "main",
      name: "Self code upgrade",
      goal: "Implement a bounded source change with verification",
      duration: "long",
      priority: "high",
      group: "self-code-upgrade",
      business: {
        domain: "self-code",
        accessMode: "autonomous-code-change",
        object: "self_upgrade_loop",
        payload: {
          selfRoadmapGoalId: "self_upgrade_loop",
          codeChangeContract: {
            strategy: "test-first",
            allowedPaths: ["src/"],
            verificationCommands: ["pnpm tsgo"],
            deliverables: ["implementation patch", "fresh verification output"],
          },
        },
      },
    });
    const taskId = createRespond.mock.calls[0]?.[1]?.task?.id;

    await invoke("business.tasks.update", {
      id: taskId,
      status: "completed",
      progress: 100,
    });

    expect(searchExperience({ query: "test-first pnpm tsgo" }).results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "event",
          summary: expect.stringContaining("Self code upgrade"),
          tags: expect.arrayContaining([
            "business-task",
            "self-code-upgrade",
            "self-code",
            "autonomous-code-change",
            "completed",
          ]),
        }),
      ]),
    );
  });

  it("clamps progress and rejects unknown update or delete ids", async () => {
    const createRespond = await invoke("business.tasks.create", {
      agentId: "main",
      name: "progress task",
      goal: "verify progress",
    });
    const taskId = createRespond.mock.calls[0]?.[1]?.task?.id;

    const overProgress = await invoke("business.tasks.update", {
      id: taskId,
      progress: 150,
    });
    expect(overProgress.mock.calls[0]?.[1]?.task).toEqual(expect.objectContaining({
      progress: 100,
    }));

    const underProgress = await invoke("business.tasks.update", {
      id: taskId,
      progress: -20,
    });
    expect(underProgress.mock.calls[0]?.[1]?.task).toEqual(expect.objectContaining({
      progress: 0,
    }));

    const unknownUpdate = await invoke("business.tasks.update", {
      id: "missing",
      status: "completed",
    });
    expect(unknownUpdate.mock.calls[0]?.[0]).toBe(false);
    expect(unknownUpdate.mock.calls[0]?.[2]).toEqual(expect.objectContaining({
      code: "INVALID_REQUEST",
      message: "unknown business task: missing",
    }));

    const unknownDelete = await invoke("business.tasks.delete", { id: "missing" });
    expect(unknownDelete.mock.calls[0]?.[0]).toBe(false);
    expect(unknownDelete.mock.calls[0]?.[2]).toEqual(expect.objectContaining({
      code: "INVALID_REQUEST",
      message: "unknown business task: missing",
    }));
  });

  it("persists a failed task when autonomy startup fails", async () => {
    mocks.startManagedFlow.mockImplementationOnce(() => {
      throw new Error("autonomy unavailable");
    });

    const createRespond = await invoke("business.tasks.create", {
      agentId: "main",
      name: "failing autonomy",
      goal: "verify failure branch",
    });

    expect(createRespond.mock.calls[0]?.[0]).toBe(true);
    expect(createRespond.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      autonomyStarted: false,
      error: "autonomy unavailable",
      task: expect.objectContaining({
        status: "failed",
        progress: 100,
        error: "autonomy unavailable",
        completedAt: expect.any(Number),
      }),
    }));
  });
});
