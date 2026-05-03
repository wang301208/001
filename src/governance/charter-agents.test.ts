import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildGovernanceCharterAgentPrompt,
  loadGovernanceCharterOrganization,
  resolveGovernanceCharterCollaborationPolicy,
  resolveGovernanceCharterDeclaredCollaborators,
  resolveGovernanceCharterAgentRuntimeProfile,
} from "./charter-agents.js";

async function createTempCharterRoot(): Promise<{ root: string; charterDir: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "zhushou-charter-agents-"));
  const charterDir = path.join(root, "governance", "charter");
  await mkdir(path.join(charterDir, "agents"), { recursive: true });
  await mkdir(path.join(charterDir, "evolution"), { recursive: true });
  return { root, charterDir };
}

describe("governance charter agents", () => {
  it("loads agent blueprints and expands collaborator teams", async () => {
    const { root, charterDir } = await createTempCharterRoot();
    try {
      await writeFile(
        path.join(charterDir, "agents", "founder.yaml"),
        [
          "version: 1",
          "agent:",
          '  id: "founder"',
          '  title: "Founder"',
          '  layer: "evolution"',
          "mission:",
          '  primary: "Redesign the organization safely."',
          "jurisdiction:",
          "  can_decide:",
          '    - "propose_new_agent_roles"',
          "  cannot_decide:",
          '    - "rewrite_constitution"',
          "authority:",
          '  level: "high"',
          "  mutation_scope:",
          "    allow:",
          '      - "agent_blueprints_in_sandbox"',
          "    deny:",
          '      - "constitution"',
          "required_counterparties:",
          "  works_with:",
          '    - "genesis_team"',
          '    - "strategist"',
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "agents", "strategist.yaml"),
        ['version: 1', "agent:", '  id: "strategist"', '  title: "Strategist"'].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "agents", "sentinel.yaml"),
        ['version: 1', "agent:", '  id: "sentinel"', '  title: "Sentinel"'].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "agents", "qa.yaml"),
        ['version: 1', "agent:", '  id: "qa"', '  title: "QA"'].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "evolution", "genesis-team.yaml"),
        [
          "version: 1",
          "team:",
          '  id: "genesis_team"',
          '  title: "Genesis Team"',
          "members:",
          '  - "sentinel"',
          '  - "qa"',
        ].join("\n"),
        "utf8",
      );

      const organization = loadGovernanceCharterOrganization({ charterDir });
      expect(organization.discovered).toBe(true);
      expect(organization.agents.map((entry) => entry.id)).toEqual(["founder", "qa", "sentinel", "strategist"]);
      expect(resolveGovernanceCharterDeclaredCollaborators("founder", { charterDir })).toEqual([
        "qa",
        "sentinel",
        "strategist",
      ]);
      expect(resolveGovernanceCharterCollaborationPolicy("founder", { charterDir })).toEqual({
        requesterAgentId: "founder",
        charterDeclared: true,
        collaboratorAgentIds: ["qa", "sentinel", "strategist"],
        allowedAgentIds: ["founder", "qa", "sentinel", "strategist"],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("builds a prompt block from a charter role", async () => {
    const { root, charterDir } = await createTempCharterRoot();
    try {
      await writeFile(
        path.join(charterDir, "agents", "executor.yaml"),
        [
          "version: 1",
          "agent:",
          '  id: "executor"',
          '  title: "Executor"',
          '  layer: "execution"',
          "mission:",
          '  primary: "Turn goals into delivered outcomes."',
          "jurisdiction:",
          "  can_decide:",
          '    - "decompose_goal"',
          '    - "create_task_graph"',
          "  cannot_decide:",
          '    - "rewrite_constitution"',
          "authority:",
          '  level: "high"',
          "  mutation_scope:",
          "    allow:",
          '      - "task_records"',
          "    deny:",
          '      - "constitution"',
          "  network_scope:",
          '    default: "policy-derived"',
          "  resource_budget:",
          '    tokens: "high"',
          '    parallelism: "high"',
          '    runtime: "continuous"',
          "required_counterparties:",
          "  works_with:",
          '    - "qa"',
          "runtime_mapping:",
          "  intended_project_hooks:",
          '    - "src/tasks/task-registry.ts"',
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "agents", "qa.yaml"),
        ['version: 1', "agent:", '  id: "qa"', '  title: "QA"'].join("\n"),
        "utf8",
      );

      const prompt = buildGovernanceCharterAgentPrompt("executor", { charterDir });

      expect(prompt).toContain("## Organizational Charter");
      expect(prompt).toContain("Charter role: Executor (executor)");
      expect(prompt).toContain("Layer: execution");
      expect(prompt).toContain("Mission: Turn goals into delivered outcomes.");
      expect(prompt).toContain("You may decide: decompose_goal, create_task_graph");
      expect(prompt).toContain("You must not decide: rewrite_constitution");
      expect(prompt).toContain("Never mutate: constitution");
      expect(prompt).toContain("Network posture: policy-derived");
      expect(prompt).toContain("Resource budget: tokens=high, parallelism=high, runtime=continuous");
      expect(prompt).toContain("Project hooks: src/tasks/task-registry.ts");
      expect(prompt).toContain("Declared collaborators: qa");
      expect(prompt).toContain(
        "Coordination boundary: use agents_list/sessions_spawn only within the declared collaborator graph",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("builds a runtime profile from charter resource and collaborator hints", async () => {
    const { root, charterDir } = await createTempCharterRoot();
    try {
      await writeFile(
        path.join(charterDir, "agents", "founder.yaml"),
        [
          "version: 1",
          "agent:",
          '  id: "founder"',
          '  title: "Founder"',
          '  layer: "evolution"',
          "authority:",
          "  network_scope:",
          '    default: "internal_only"',
          "  resource_budget:",
          '    tokens: "high"',
          '    runtime: "long-running"',
          "required_counterparties:",
          "  works_with:",
          '    - "librarian"',
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "agents", "librarian.yaml"),
        ['version: 1', "agent:", '  id: "librarian"', '  title: "Librarian"'].join("\n"),
        "utf8",
      );

      const profile = resolveGovernanceCharterAgentRuntimeProfile("founder", { charterDir });

      expect(profile?.name).toBe("Founder");
      expect(profile?.identity?.name).toBe("Founder");
      expect(profile?.subagents?.allowAgents).toEqual(["librarian"]);
      expect(profile?.subagents?.requireAgentId).toBe(true);
      expect(profile?.embeddedPi?.executionContract).toBe("strict-agentic");
      expect(profile?.tools?.deny).toEqual(["web_fetch", "web_search"]);
      expect(profile?.tools?.elevated?.enabled).toBe(false);
      expect(profile?.contextLimits?.memoryGetMaxChars).toBe(24_000);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
