import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import { reconcileGovernanceSovereigntyIncidentsSync } from "./sovereignty-incidents.js";
import {
  createEmptyAgentGovernanceRuntimeContract,
  explainAgentGovernanceToolDenial,
  resolveAgentGovernanceRuntimeContract,
  resolveAgentGovernanceToolPolicy,
} from "./runtime-contract.js";

describe("governance runtime contract", () => {
  it("builds a charter-backed runtime contract for declared agents", () => {
    const cfg: ZhushouConfig = {
      agents: {
        list: [{ id: "main", workspace: "/repo" }],
      },
    };

    const contract = resolveAgentGovernanceRuntimeContract({
      cfg,
      agentId: "founder",
    });

    expect(contract).toMatchObject({
      agentId: "founder",
      charterDeclared: true,
      charterTitle: "Founder",
      charterLayer: "evolution",
      authorityLevel: "high",
      charterRequireAgentId: true,
      charterExecutionContract: "strict-agentic",
      charterElevatedLocked: true,
      freezeActive: false,
    });
    expect(contract.collaborators).toContain("librarian");
    expect(contract.collaborators).toContain("strategist");
    expect(contract.mutationDeny).toContain("constitution");
    expect(contract.networkDefault).toBe("broad");
    expect(contract.runtimeHooks).toContain("task-registry");
    expect(contract.effectiveToolDeny).toEqual(contract.charterToolDeny);
  });

  it("merges freeze deny tools into the effective governance tool policy", () => {
    const cfg: ZhushouConfig = {
      gateway: {
        bind: "lan",
      },
      agents: {
        list: [{ id: "main", workspace: "/repo" }],
      },
    };

    const policy = resolveAgentGovernanceToolPolicy({
      cfg,
      agentId: "publisher",
    });

    expect(policy?.deny).toEqual(
      expect.arrayContaining(["web_fetch", "web_search", "exec", "write", "apply_patch", "gateway"]),
    );
  });

  it("returns an empty contract shape for undeclared agents", () => {
    const contract = createEmptyAgentGovernanceRuntimeContract("main");

    expect(contract).toEqual({
      agentId: "main",
      charterDeclared: false,
      charterContractValid: true,
      charterContractIssues: [],
      collaborators: [],
      reportsTo: [],
      mutationAllow: [],
      mutationDeny: [],
      allowedTools: [],
      memoryScope: [],
      qaRequirements: [],
      writeScope: [],
      promotionGates: [],
      networkConditions: [],
      runtimeHooks: [],
      charterToolDeny: [],
      charterRequireAgentId: false,
      charterElevatedLocked: false,
      freezeActive: false,
      freezeDeny: [],
      freezeDetails: [],
      activeSovereigntyIncidentCount: 0,
      activeSovereigntyIncidentIds: [],
      activeSovereigntyFreezeIncidentIds: [],
      effectiveToolDeny: [],
    });
  });

  it("explains charter-governed tool denials with charter runtime context", () => {
    const explanation = explainAgentGovernanceToolDenial({
      contract: {
        ...createEmptyAgentGovernanceRuntimeContract("founder"),
        charterDeclared: true,
        charterTitle: "Founder",
        charterLayer: "evolution",
        charterToolDeny: ["web_fetch", "web_search"],
        charterRequireAgentId: true,
        charterExecutionContract: "strict-agentic",
        charterElevatedLocked: true,
        effectiveToolDeny: ["web_fetch", "web_search"],
      },
      toolName: "web_fetch",
    });

    expect(explanation).toMatchObject({
      toolName: "web_fetch",
      deniedByCharter: true,
      deniedByFreeze: false,
    });
    expect(explanation?.message).toContain('Tool "web_fetch" is denied by governance contract');
    expect(explanation?.message).toContain("evolution / Founder");
    expect(explanation?.message).toContain("execution=strict-agentic");
  });

  it("explains freeze-governed tool denials with freeze details", () => {
    const explanation = explainAgentGovernanceToolDenial({
      contract: {
        ...createEmptyAgentGovernanceRuntimeContract("main"),
        freezeActive: true,
        freezeReasonCode: "network_boundary_opened",
        freezeDeny: ["exec", "write"],
        freezeDetails: ["gateway.bind=lan"],
        effectiveToolDeny: ["exec", "write"],
      },
      toolName: "exec",
    });

    expect(explanation).toMatchObject({
      toolName: "exec",
      deniedByCharter: false,
      deniedByFreeze: true,
    });
    expect(explanation?.message).toContain("active governance freeze");
    expect(explanation?.message).toContain("network_boundary_opened");
    expect(explanation?.message).toContain("gateway.bind=lan");
  });

  it("hydrates open sovereignty incidents from the incident ledger into the runtime contract", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "zhushou-governance-runtime-contract-"));
    const charterDir = path.join(root, "governance", "charter");
    const stateDir = path.join(root, "state");
    try {
      await mkdir(path.join(charterDir, "policies"), { recursive: true });
      await mkdir(stateDir, { recursive: true });
      await writeFile(path.join(charterDir, "constitution.yaml"), "version: 1\n", "utf8");
      await writeFile(path.join(charterDir, "policies", "sovereignty.yaml"), "version: 1\n", "utf8");
      await writeFile(path.join(charterDir, "policies", "evolution-policy.yaml"), "version: 1\n", "utf8");
      const incident = reconcileGovernanceSovereigntyIncidentsSync({
        stateDir,
        observedAt: 111,
        candidates: [
          {
            key: "finding:governance.manual.sovereignty_freeze",
            severity: "critical",
            source: "finding",
            title: "Manual sovereignty freeze",
            summary: "An unresolved sovereignty incident requires containment.",
            detailLines: ["freeze gate still active"],
            findingIds: ["governance.manual.sovereignty_freeze"],
            freezeRequested: true,
          },
        ],
      });
      const cfg: ZhushouConfig = {
        gateway: {
          bind: "loopback",
        },
      } as ZhushouConfig;

      const contract = resolveAgentGovernanceRuntimeContract({
        cfg,
        agentId: "main",
        charterDir,
        stateDir,
      });

      expect(contract.freezeActive).toBe(true);
      expect(contract.freezeReasonCode).toBe("sovereignty_incident_open");
      expect(contract.activeSovereigntyIncidentCount).toBe(1);
      expect(contract.activeSovereigntyIncidentIds).toEqual(incident.activeIncidentIds);
      expect(contract.activeSovereigntyFreezeIncidentIds).toEqual(incident.freezeIncidentIds);
      expect(contract.freezeDetails[0]).toContain("Manual sovereignty freeze");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
