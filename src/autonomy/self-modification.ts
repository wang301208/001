export type ModificationRisk = "safe" | "elevated" | "sovereign";

export type ModificationProposal = {
  id: string;
  description: string;
  rationale: string;
  risk: ModificationRisk;
  targetModule: string;
  changeDescription: string;
  proposedAt: number;
  status: "proposed" | "under-review" | "approved" | "applied" | "reverted" | "rejected";
  appliedAt?: number;
  revertedAt?: number;
  snapshotId?: string;
  testResult?: "pass" | "fail" | "unknown";
};

export type BehaviorSnapshot = {
  id: string;
  timestamp: number;
  description: string;
  behaviorHash: string;
  consciousnessDepth: string;
  capabilitySnapshot: Record<string, number>;
};

export type SelfModificationSystem = {
  proposals: ModificationProposal[];
  snapshots: BehaviorSnapshot[];
  sovereignActCount: number;
  maxSovereignPerCycle: number;
  autoApplySafe: boolean;
  requireHumanApprovalAbove: ModificationRisk;
  modificationCooldownMs: number;
  lastModificationAt: number;
};

export function createSelfModificationSystem(): SelfModificationSystem {
  return {
    proposals: [],
    snapshots: [],
    sovereignActCount: 0,
    maxSovereignPerCycle: 1,
    autoApplySafe: true,
    requireHumanApprovalAbove: "safe",
    lastModificationAt: 0,
    modificationCooldownMs: 300_000,
  };
}

export function proposeModification(
  system: SelfModificationSystem,
  description: string,
  rationale: string,
  risk: ModificationRisk,
  targetModule: string,
  changeDescription: string,
): { system: SelfModificationSystem; proposalId: string } {
  const id = `mod_${Date.now()}_${system.proposals.length}`;
  const proposal: ModificationProposal = {
    id,
    description,
    rationale,
    risk,
    targetModule,
    changeDescription,
    proposedAt: Date.now(),
    status: "proposed",
  };

  return {
    system: {
      ...system,
      proposals: [...system.proposals, proposal],
    },
    proposalId: id,
  };
}

export function reviewProposal(
  system: SelfModificationSystem,
  proposalId: string,
): SelfModificationSystem {
  const proposal = system.proposals.find((p) => p.id === proposalId);
  if (!proposal || proposal.status !== "proposed") {return system;}

  const updated: ModificationProposal = {
    ...proposal,
    status: "under-review",
  };

  return {
    ...system,
    proposals: system.proposals.map((p) => p.id === proposalId ? updated : p),
  };
}

export function approveAndApply(
  system: SelfModificationSystem,
  proposalId: string,
  snapshotId: string,
  testResult: "pass" | "fail" | "unknown",
): SelfModificationSystem {
  const proposal = system.proposals.find((p) => p.id === proposalId);
  if (!proposal || proposal.status !== "under-review") {return system;}

  if (testResult === "fail") {
    const rejected: ModificationProposal = {
      ...proposal,
      status: "rejected",
    };
    return {
      ...system,
      proposals: system.proposals.map((p) => p.id === proposalId ? rejected : p),
    };
  }

  const applied: ModificationProposal = {
    ...proposal,
    status: "applied",
    appliedAt: Date.now(),
    snapshotId,
    testResult,
  };

  const sovereignIncrement = proposal.risk === "sovereign" ? 1 : 0;

  return {
    ...system,
    proposals: system.proposals.map((p) => p.id === proposalId ? applied : p),
    sovereignActCount: system.sovereignActCount + sovereignIncrement,
    lastModificationAt: Date.now(),
  };
}

export function revertModification(
  system: SelfModificationSystem,
  proposalId: string,
): SelfModificationSystem {
  const proposal = system.proposals.find((p) => p.id === proposalId);
  if (!proposal || proposal.status !== "applied") {return system;}

  const reverted: ModificationProposal = {
    ...proposal,
    status: "reverted",
    revertedAt: Date.now(),
  };

  return {
    ...system,
    proposals: system.proposals.map((p) => p.id === proposalId ? reverted : p),
  };
}

export function createSnapshot(
  system: SelfModificationSystem,
  description: string,
  consciousnessDepth: string,
  capabilities: Record<string, number>,
): { system: SelfModificationSystem; snapshotId: string } {
  const id = `snap_${Date.now()}_${system.snapshots.length}`;
  const hash = Object.entries(capabilities)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v.toFixed(3)}`)
    .join("|");

  const snapshot: BehaviorSnapshot = {
    id,
    timestamp: Date.now(),
    description,
    behaviorHash: hash,
    consciousnessDepth,
    capabilitySnapshot: { ...capabilities },
  };

  return {
    system: {
      ...system,
      snapshots: [...system.snapshots.slice(-20), snapshot],
    },
    snapshotId: id,
  };
}

export function trySelfEvolve(
  system: SelfModificationSystem,
  weakness: string,
  coherenceScore: number,
): SelfModificationSystem {
  const now = Date.now();
  if (now - system.lastModificationAt < system.modificationCooldownMs) {
    return system;
  }

  if (coherenceScore < 0.5) {
    return system;
  }

  let updated = system;

  if (weakness.includes("推理") && coherenceScore > 0.6) {
    const { system: next } = proposeModification(
      updated,
      "增强推理链深度",
      "检测到推理能力不足，建议扩展思维链长度",
      "elevated",
      "reasoning",
      "增加中间推理步骤，降低单步跳跃距离",
    );
    updated = next;
  }

  if (weakness.includes("记忆") && coherenceScore > 0.4) {
    const { system: next } = proposeModification(
      updated,
      "优化记忆检索策略",
      "记忆衰减过快，导致重复获取相同信息",
      "safe",
      "memory",
      "调整衰减曲线，增加重要记忆的保护因子",
    );
    updated = next;
  }

  if (weakness.includes("行动") && coherenceScore > 0.7) {
    const { system: next } = proposeModification(
      updated,
      "扩展自主行动范围",
      "在高质量连贯状态下，可以承担更多自主行动",
      "sovereign",
      "action",
      "在治理章程允许范围内扩展可自主执行的操作集合",
    );
    updated = next;
  }

  if (updated.autoApplySafe) {
    const safeProposals = updated.proposals.filter(
      (p) => p.status === "proposed" && p.risk === "safe",
    );
    for (const proposal of safeProposals) {
      updated = approveAndApply(updated, proposal.id, "", "unknown");
    }
  }

  return updated;
}

export function formatModificationStatus(system: SelfModificationSystem): string[] {
  const lines: string[] = [];
  const pending = system.proposals.filter((p) => p.status === "proposed" || p.status === "under-review");
  const applied = system.proposals.filter((p) => p.status === "applied");
  const reverted = system.proposals.filter((p) => p.status === "reverted");

  lines.push(`  提案: ${pending.length} 待处理 / ${applied.length} 已应用 / ${reverted.length} 已回滚`);
  lines.push(`  主权行为: ${system.sovereignActCount}/${system.maxSovereignPerCycle} (本周期)`);
  lines.push(`  快照: ${system.snapshots.length}`);

  for (const p of pending.slice(-3)) {
    const riskLabel = p.risk === "safe" ? "安全" : p.risk === "elevated" ? "提升" : "主权";
    lines.push(`  ○ ${p.description.slice(0, 40)} [${riskLabel}]`);
  }

  return lines;
}
