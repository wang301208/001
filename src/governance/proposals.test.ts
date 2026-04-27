import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyGovernanceProposal,
  applyGovernanceProposals,
  createGovernanceProposal,
  listGovernanceProposals,
  resolveGovernanceProposalApplyLedgerPath,
  resolveGovernanceProposalStorageDir,
  revertGovernanceProposalApply,
  revertGovernanceProposalApplies,
  reviewGovernanceProposal,
  reviewGovernanceProposals,
  summarizeGovernanceProposalLedger,
} from "./proposals.js";

async function createTempGovernanceRoot(): Promise<{
  root: string;
  charterDir: string;
  stateDir: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openclaw-governance-proposals-"));
  const charterDir = path.join(root, "governance", "charter");
  const stateDir = path.join(root, "state");
  await mkdir(path.join(charterDir, "agents"), { recursive: true });
  await mkdir(path.join(charterDir, "policies"), { recursive: true });
  return {
    root,
    charterDir,
    stateDir,
  };
}

describe("governance proposals", () => {
  it("creates, reviews, applies, and persists charter mutations", async () => {
    const { root, charterDir, stateDir } = await createTempGovernanceRoot();
    try {
      await writeFile(
        path.join(charterDir, "agents", "founder.yaml"),
        'version: 0\nagent:\n  id: "legacy-founder"\n',
        "utf8",
      );
      await writeFile(path.join(charterDir, "policies", "legacy.yaml"), "legacy: true\n", "utf8");

      const created = await createGovernanceProposal({
        proposalId: "gpr-flow-001",
        title: "Create founder charter",
        rationale: "Seed the governance agent blueprint.",
        createdByAgentId: "founder",
        createdBySessionKey: "agent:founder:main",
        charterDir,
        stateDir,
        now: 100,
        operations: [
          {
            kind: "write",
            path: "agents/founder.yaml",
            content: 'version: 1\nagent:\n  id: "founder"\n',
          },
          {
            kind: "delete",
            path: "governance/charter/policies/legacy.yaml",
          },
        ],
      });

      expect(created.storageDir).toBe(resolveGovernanceProposalStorageDir({ stateDir }));
      expect(created.proposal.status).toBe("pending");
      expect(created.proposal.operations).toEqual([
        {
          kind: "write",
          path: "agents/founder.yaml",
          content: 'version: 1\nagent:\n  id: "founder"\n',
        },
        {
          kind: "delete",
          path: "policies/legacy.yaml",
        },
      ]);

      const reviewed = await reviewGovernanceProposal({
        proposalId: created.proposal.id,
        decision: "approve",
        decidedBy: "architect",
        decisionNote: "Apply immediately.",
        stateDir,
        now: 200,
      });

      expect(reviewed.proposal.status).toBe("approved");
      expect(reviewed.proposal.review).toEqual({
        decision: "approve",
        decidedAt: 200,
        decidedBy: "architect",
        decidedByType: "human",
        decisionNote: "Apply immediately.",
      });
      expect(reviewed.proposal.classification.level).toBe("elevated");

      const applied = await applyGovernanceProposal({
        proposalId: created.proposal.id,
        appliedBy: "architect",
        charterDir,
        stateDir,
        now: 300,
      });

      expect(applied.charterDir).toBe(charterDir);
      expect(applied.ledgerPath).toBe(
        resolveGovernanceProposalApplyLedgerPath(created.proposal.id, { stateDir }),
      );
      expect(applied.proposal.status).toBe("applied");
      expect(applied.writtenPaths).toEqual([
        "governance/charter/agents/founder.yaml",
        "governance/charter/policies/legacy.yaml",
      ]);
      expect(applied.proposal.apply).toEqual({
        appliedAt: 300,
        appliedBy: "architect",
        appliedByType: "human",
        writtenPaths: [
          "governance/charter/agents/founder.yaml",
          "governance/charter/policies/legacy.yaml",
        ],
        ledgerPath: applied.ledgerPath,
      });

      await expect(readFile(path.join(charterDir, "policies", "legacy.yaml"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(readFile(path.join(charterDir, "agents", "founder.yaml"), "utf8")).resolves.toContain(
        'id: "founder"',
      );
      await expect(readFile(applied.ledgerPath, "utf8")).resolves.toContain('"status": "applied"');
      const applyLedger = JSON.parse(await readFile(applied.ledgerPath, "utf8")) as {
        snapshots: Array<{
          path: string;
          repoRelativePath: string;
          existedBefore: boolean;
          previousContent?: string;
        }>;
      };
      expect(applyLedger.snapshots).toMatchObject([
        {
          path: "agents/founder.yaml",
          repoRelativePath: "governance/charter/agents/founder.yaml",
          existedBefore: true,
          previousContent: 'version: 0\nagent:\n  id: "legacy-founder"\n',
        },
        {
          path: "policies/legacy.yaml",
          repoRelativePath: "governance/charter/policies/legacy.yaml",
          existedBefore: true,
          previousContent: "legacy: true\n",
        },
      ]);

      const listed = await listGovernanceProposals({
        stateDir,
      });
      expect(listed.summary).toMatchObject({
        total: 1,
        pending: 0,
        approved: 0,
        rejected: 0,
        applied: 1,
        latestCreatedAt: 100,
        latestUpdatedAt: 300,
      });
      expect(listed.proposals).toHaveLength(1);
      expect(listed.proposals[0]?.status).toBe("applied");

      const ledger = summarizeGovernanceProposalLedger({
        stateDir,
      });
      expect(ledger).toMatchObject({
        total: 1,
        applied: 1,
        latestUpdatedAt: 300,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reverts an applied proposal using the saved pre-state ledger", async () => {
    const { root, charterDir, stateDir } = await createTempGovernanceRoot();
    try {
      await writeFile(path.join(charterDir, "agents", "founder.yaml"), "legacy: founder\n", "utf8");
      await writeFile(path.join(charterDir, "policies", "legacy.yaml"), "legacy: true\n", "utf8");

      const created = await createGovernanceProposal({
        proposalId: "gpr-revert-001",
        title: "Mutate founder charter",
        charterDir,
        stateDir,
        now: 100,
        operations: [
          {
            kind: "write",
            path: "agents/founder.yaml",
            content: "legacy: replaced\n",
          },
          {
            kind: "delete",
            path: "policies/legacy.yaml",
          },
        ],
      });
      await reviewGovernanceProposal({
        proposalId: created.proposal.id,
        decision: "approve",
        decidedBy: "architect",
        stateDir,
        now: 200,
      });
      const applied = await applyGovernanceProposal({
        proposalId: created.proposal.id,
        appliedBy: "architect",
        charterDir,
        stateDir,
        now: 300,
      });

      const reverted = await revertGovernanceProposalApply({
        proposalId: created.proposal.id,
        revertedBy: "architect",
        charterDir,
        stateDir,
        now: 400,
      });

      expect(reverted.charterDir).toBe(charterDir);
      expect(reverted.ledgerPath).toBe(applied.ledgerPath);
      expect(reverted.restoredPaths).toEqual([
        "governance/charter/agents/founder.yaml",
        "governance/charter/policies/legacy.yaml",
      ]);
      expect(reverted.proposal.status).toBe("approved");
      expect(reverted.proposal.apply).toEqual({
        appliedAt: 300,
        appliedBy: "architect",
        appliedByType: "human",
        writtenPaths: [
          "governance/charter/agents/founder.yaml",
          "governance/charter/policies/legacy.yaml",
        ],
        ledgerPath: applied.ledgerPath,
        revertedAt: 400,
        revertedBy: "architect",
        restoredPaths: [
          "governance/charter/agents/founder.yaml",
          "governance/charter/policies/legacy.yaml",
        ],
      });
      await expect(readFile(path.join(charterDir, "agents", "founder.yaml"), "utf8")).resolves.toBe(
        "legacy: founder\n",
      );
      await expect(readFile(path.join(charterDir, "policies", "legacy.yaml"), "utf8")).resolves.toBe(
        "legacy: true\n",
      );
      await expect(readFile(applied.ledgerPath, "utf8")).resolves.toContain('"status": "reverted"');

      const listed = await listGovernanceProposals({
        stateDir,
      });
      expect(listed.summary).toMatchObject({
        total: 1,
        pending: 0,
        approved: 1,
        rejected: 0,
        applied: 0,
        latestUpdatedAt: 400,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects charter path traversal", async () => {
    const { root, charterDir, stateDir } = await createTempGovernanceRoot();
    try {
      await expect(
        createGovernanceProposal({
          proposalId: "gpr-invalid-path",
          title: "Escape charter root",
          charterDir,
          stateDir,
          operations: [
            {
              kind: "write",
              path: "../outside.yaml",
              content: "nope\n",
            },
          ],
        }),
      ).rejects.toThrow(/within governance\/charter/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("classifies sovereign mutations and blocks agent self-approval", async () => {
    const { root, charterDir, stateDir } = await createTempGovernanceRoot();
    try {
      const created = await createGovernanceProposal({
        proposalId: "gpr-sovereign-001",
        title: "Rewrite constitution",
        charterDir,
        stateDir,
        now: 10,
        operations: [
          {
            kind: "write",
            path: "constitution.yaml",
            content: "version: 2\n",
          },
        ],
      });

      expect(created.proposal.classification).toMatchObject({
        level: "sovereign",
        requiresHumanSovereignApproval: true,
        touchedPaths: ["constitution.yaml"],
      });
      await expect(
        reviewGovernanceProposal({
          proposalId: created.proposal.id,
          decision: "approve",
          decidedBy: "founder",
          decidedByType: "agent",
          stateDir,
          now: 20,
        }),
      ).rejects.toThrow(/human sovereign approval/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("allows sovereign mutations after explicit human approval", async () => {
    const { root, charterDir, stateDir } = await createTempGovernanceRoot();
    try {
      await writeFile(path.join(charterDir, "constitution.yaml"), "version: 1\n", "utf8");

      const created = await createGovernanceProposal({
        proposalId: "gpr-sovereign-002",
        title: "Amend constitution",
        charterDir,
        stateDir,
        now: 10,
        operations: [
          {
            kind: "write",
            path: "constitution.yaml",
            content: "version: 2\n",
          },
        ],
      });

      await reviewGovernanceProposal({
        proposalId: created.proposal.id,
        decision: "approve",
        decidedBy: "architect",
        stateDir,
        now: 20,
      });
      const applied = await applyGovernanceProposal({
        proposalId: created.proposal.id,
        appliedBy: "architect",
        charterDir,
        stateDir,
        now: 30,
      });

      expect(applied.proposal.classification.level).toBe("sovereign");
      await expect(readFile(path.join(charterDir, "constitution.yaml"), "utf8")).resolves.toBe(
        "version: 2\n",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("summarizes mixed proposal states", async () => {
    const { root, charterDir, stateDir } = await createTempGovernanceRoot();
    try {
      const pending = await createGovernanceProposal({
        proposalId: "gpr-pending",
        title: "Pending proposal",
        charterDir,
        stateDir,
        now: 10,
        operations: [
          {
            kind: "write",
            path: "agents/pending.yaml",
            content: "pending: true\n",
          },
        ],
      });
      const approved = await createGovernanceProposal({
        proposalId: "gpr-approved",
        title: "Approved proposal",
        charterDir,
        stateDir,
        now: 20,
        operations: [
          {
            kind: "write",
            path: "agents/approved.yaml",
            content: "approved: true\n",
          },
        ],
      });
      await reviewGovernanceProposal({
        proposalId: approved.proposal.id,
        decision: "approve",
        decidedBy: "architect",
        stateDir,
        now: 30,
      });
      const rejected = await createGovernanceProposal({
        proposalId: "gpr-rejected",
        title: "Rejected proposal",
        charterDir,
        stateDir,
        now: 40,
        operations: [
          {
            kind: "write",
            path: "agents/rejected.yaml",
            content: "rejected: true\n",
          },
        ],
      });
      await reviewGovernanceProposal({
        proposalId: rejected.proposal.id,
        decision: "reject",
        decidedBy: "architect",
        stateDir,
        now: 50,
      });
      await reviewGovernanceProposal({
        proposalId: pending.proposal.id,
        decision: "approve",
        decidedBy: "architect",
        stateDir,
        now: 60,
      });
      await applyGovernanceProposal({
        proposalId: pending.proposal.id,
        appliedBy: "architect",
        charterDir,
        stateDir,
        now: 70,
      });

      const ledger = summarizeGovernanceProposalLedger({
        stateDir,
      });

      expect(ledger).toMatchObject({
        total: 3,
        pending: 0,
        approved: 1,
        rejected: 1,
        applied: 1,
        latestCreatedAt: 40,
        latestUpdatedAt: 70,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reviews proposals in bulk from a status selection", async () => {
    const { root, charterDir, stateDir } = await createTempGovernanceRoot();
    try {
      const first = await createGovernanceProposal({
        proposalId: "gpr-bulk-review-1",
        title: "First pending proposal",
        charterDir,
        stateDir,
        now: 10,
        operations: [
          {
            kind: "write",
            path: "agents/bulk-review-1.yaml",
            content: "first: true\n",
          },
        ],
      });
      const second = await createGovernanceProposal({
        proposalId: "gpr-bulk-review-2",
        title: "Second pending proposal",
        charterDir,
        stateDir,
        now: 20,
        operations: [
          {
            kind: "write",
            path: "agents/bulk-review-2.yaml",
            content: "second: true\n",
          },
        ],
      });
      const alreadyApproved = await createGovernanceProposal({
        proposalId: "gpr-bulk-review-3",
        title: "Already approved proposal",
        charterDir,
        stateDir,
        now: 30,
        operations: [
          {
            kind: "write",
            path: "agents/bulk-review-3.yaml",
            content: "third: true\n",
          },
        ],
      });
      await reviewGovernanceProposal({
        proposalId: alreadyApproved.proposal.id,
        decision: "approve",
        decidedBy: "architect",
        stateDir,
        now: 40,
      });

      const result = await reviewGovernanceProposals({
        status: "pending",
        decision: "approve",
        decidedBy: "architect",
        stateDir,
        now: 50,
      });

      expect(result.selection).toMatchObject({
        status: "pending",
      });
      expect(result.selection.matchedProposalIds).toEqual([
        second.proposal.id,
        first.proposal.id,
      ]);
      expect(result.reviewedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.stoppedEarly).toBe(false);
      expect(result.entries).toEqual([
        {
          proposalId: second.proposal.id,
          ok: true,
          title: "Second pending proposal",
          statusBefore: "pending",
          statusAfter: "approved",
        },
        {
          proposalId: first.proposal.id,
          ok: true,
          title: "First pending proposal",
          statusBefore: "pending",
          statusAfter: "approved",
        },
      ]);

      const listed = await listGovernanceProposals({ stateDir });
      expect(listed.summary).toMatchObject({
        total: 3,
        pending: 0,
        approved: 3,
        rejected: 0,
        applied: 0,
        latestUpdatedAt: 50,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("applies and reverts proposals in bulk while recording failures", async () => {
    const { root, charterDir, stateDir } = await createTempGovernanceRoot();
    try {
      const approved = await createGovernanceProposal({
        proposalId: "gpr-bulk-apply-approved",
        title: "Approved proposal",
        charterDir,
        stateDir,
        now: 10,
        operations: [
          {
            kind: "write",
            path: "agents/bulk-apply-approved.yaml",
            content: "approved: true\n",
          },
        ],
      });
      await reviewGovernanceProposal({
        proposalId: approved.proposal.id,
        decision: "approve",
        decidedBy: "architect",
        stateDir,
        now: 20,
      });

      const pending = await createGovernanceProposal({
        proposalId: "gpr-bulk-apply-pending",
        title: "Pending proposal",
        charterDir,
        stateDir,
        now: 30,
        operations: [
          {
            kind: "write",
            path: "agents/bulk-apply-pending.yaml",
            content: "pending: true\n",
          },
        ],
      });

      const alreadyApplied = await createGovernanceProposal({
        proposalId: "gpr-bulk-apply-applied",
        title: "Already applied proposal",
        charterDir,
        stateDir,
        now: 40,
        operations: [
          {
            kind: "write",
            path: "agents/bulk-apply-applied.yaml",
            content: "applied: true\n",
          },
        ],
      });
      await reviewGovernanceProposal({
        proposalId: alreadyApplied.proposal.id,
        decision: "approve",
        decidedBy: "architect",
        stateDir,
        now: 50,
      });
      await applyGovernanceProposal({
        proposalId: alreadyApplied.proposal.id,
        appliedBy: "architect",
        charterDir,
        stateDir,
        now: 60,
      });

      const appliedMany = await applyGovernanceProposals({
        proposalIds: [approved.proposal.id, pending.proposal.id, "gpr-bulk-apply-missing"],
        appliedBy: "architect",
        charterDir,
        stateDir,
        now: 70,
      });

      expect(appliedMany.selection).toEqual({
        proposalIds: [
          approved.proposal.id,
          pending.proposal.id,
          "gpr-bulk-apply-missing",
        ],
        matchedProposalIds: [
          approved.proposal.id,
          pending.proposal.id,
          "gpr-bulk-apply-missing",
        ],
      });
      expect(appliedMany.appliedCount).toBe(1);
      expect(appliedMany.failedCount).toBe(2);
      expect(appliedMany.stoppedEarly).toBe(false);
      expect(appliedMany.entries).toEqual([
        {
          proposalId: approved.proposal.id,
          ok: true,
          title: "Approved proposal",
          statusBefore: "approved",
          statusAfter: "applied",
          ledgerPath: resolveGovernanceProposalApplyLedgerPath(approved.proposal.id, { stateDir }),
          writtenPaths: ["governance/charter/agents/bulk-apply-approved.yaml"],
        },
        {
          proposalId: pending.proposal.id,
          ok: false,
          title: "Pending proposal",
          statusBefore: "pending",
          statusAfter: "pending",
          reason: `Governance proposal must be approved before apply: ${pending.proposal.id}`,
        },
        {
          proposalId: "gpr-bulk-apply-missing",
          ok: false,
          reason: expect.any(String),
        },
      ]);
      expect(appliedMany.entries[2]?.reason).toContain("ENOENT");
      expect(await readFile(path.join(charterDir, "agents", "bulk-apply-approved.yaml"), "utf8")).toBe(
        "approved: true\n",
      );

      const revertedMany = await revertGovernanceProposalApplies({
        status: "applied",
        revertedBy: "architect",
        charterDir,
        stateDir,
        now: 80,
      });

      expect(revertedMany.selection).toMatchObject({
        status: "applied",
      });
      expect(revertedMany.revertedCount).toBe(2);
      expect(revertedMany.failedCount).toBe(0);
      expect(revertedMany.stoppedEarly).toBe(false);
      expect(revertedMany.entries).toEqual([
        {
          proposalId: approved.proposal.id,
          ok: true,
          title: "Approved proposal",
          statusBefore: "applied",
          statusAfter: "approved",
          ledgerPath: resolveGovernanceProposalApplyLedgerPath(approved.proposal.id, { stateDir }),
          restoredPaths: ["governance/charter/agents/bulk-apply-approved.yaml"],
        },
        {
          proposalId: alreadyApplied.proposal.id,
          ok: true,
          title: "Already applied proposal",
          statusBefore: "applied",
          statusAfter: "approved",
          ledgerPath: resolveGovernanceProposalApplyLedgerPath(alreadyApplied.proposal.id, {
            stateDir,
          }),
          restoredPaths: ["governance/charter/agents/bulk-apply-applied.yaml"],
        },
      ]);

      const listed = await listGovernanceProposals({ stateDir });
      expect(listed.summary).toMatchObject({
        total: 3,
        pending: 1,
        approved: 2,
        rejected: 0,
        applied: 0,
        latestUpdatedAt: 80,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
