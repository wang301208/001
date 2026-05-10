import { beforeEach, describe, expect, it, vi } from "vitest";

const loadConfigMock = vi.fn(() => ({}));
const resolveDefaultAgentIdMock = vi.fn(() => "main");
const resolveAgentWorkspaceDirMock = vi.fn(() => "/tmp/workspace");
const mergeWorkspaceSkillsMock = vi.fn();

vi.mock("../../config/config.js", () => ({
  loadConfig: () => loadConfigMock(),
  writeConfigFile: vi.fn(),
}));

vi.mock("../../agents/agent-scope.js", () => ({
  listAgentIds: vi.fn(() => ["main"]),
  resolveDefaultAgentId: () => resolveDefaultAgentIdMock(),
  resolveAgentWorkspaceDir: () => resolveAgentWorkspaceDirMock(),
}));

vi.mock("../../agents/skills-clawhub.js", () => ({
  installSkillFromClawHub: vi.fn(),
  updateSkillsFromClawHub: vi.fn(),
  searchSkillsFromClawHub: vi.fn(),
}));

vi.mock("../../agents/skills-install.js", () => ({
  installSkill: vi.fn(),
}));

vi.mock("../../agents/skills.js", () => ({
  loadWorkspaceSkillEntries: vi.fn(() => []),
  mergeWorkspaceSkills: (...args: unknown[]) => mergeWorkspaceSkillsMock(...args),
}));

const { skillsHandlers } = await import("./skills.js");

function callHandler(method: string, params: Record<string, unknown>) {
  let ok: boolean | null = null;
  let response: unknown;
  let error: unknown;
  const result = skillsHandlers[method]({
    params,
    req: {} as never,
    client: null as never,
    isWebchatConnect: () => false,
    context: {} as never,
    respond: (success: boolean, res: unknown, err: unknown) => {
      ok = success;
      response = res;
      error = err;
    },
  });
  return Promise.resolve(result).then(() => ({ ok, response, error }));
}

describe("skills.merge handler", () => {
  beforeEach(() => {
    loadConfigMock.mockReset();
    resolveDefaultAgentIdMock.mockReset();
    resolveAgentWorkspaceDirMock.mockReset();
    mergeWorkspaceSkillsMock.mockReset();

    loadConfigMock.mockReturnValue({});
    resolveDefaultAgentIdMock.mockReturnValue("main");
    resolveAgentWorkspaceDirMock.mockReturnValue("/tmp/workspace");
    mergeWorkspaceSkillsMock.mockResolvedValue({
      ok: true,
      targetSkillName: "merged",
      targetDir: "/tmp/workspace/skills/merged",
      sourceSkills: ["alpha", "beta"],
      mergedFiles: ["SKILL.md"],
      deduplicatedFiles: ["scripts/shared.js"],
      conflicts: [],
    });
  });

  it("merges source skills through RPC", async () => {
    const { ok, response, error } = await callHandler("skills.merge", {
      sources: ["alpha", "beta"],
      name: "merged",
      description: "Merged workflow",
      conflictStrategy: "fail",
      overwrite: true,
    });

    expect(mergeWorkspaceSkillsMock).toHaveBeenCalledWith({
      workspaceDir: "/tmp/workspace",
      sourceSkillNames: ["alpha", "beta"],
      targetName: "merged",
      description: "Merged workflow",
      conflictStrategy: "fail",
      overwrite: true,
      config: {},
    });
    expect(ok).toBe(true);
    expect(error).toBeUndefined();
    expect(response).toMatchObject({
      ok: true,
      targetSkillName: "merged",
      sourceSkills: ["alpha", "beta"],
    });
  });

  it("rejects requests with fewer than two source skills", async () => {
    const { ok, error } = await callHandler("skills.merge", {
      sources: ["alpha"],
      name: "merged",
    });

    expect(ok).toBe(false);
    expect(error).toMatchObject({ code: "INVALID_REQUEST" });
    expect(mergeWorkspaceSkillsMock).not.toHaveBeenCalled();
  });
});
