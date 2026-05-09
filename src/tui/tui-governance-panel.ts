export interface GovernanceStatus {
  sovereigntyBoundary: boolean;
  activeAgents: Array<{
    id: string;
    name?: string;
    role?: string;
    status: "active" | "inactive" | "frozen";
  }>;
  evolutionProjects: Array<{
    id: string;
    title?: string;
    status: "proposed" | "running" | "completed" | "failed";
    progress?: number;
  }>;
  sandboxExperiments: Array<{
    id: string;
    title?: string;
    status: "running" | "observing" | "completed" | "failed";
  }>;
  freezeActive: boolean;
  freezeStatus?: {
    active?: boolean;
    reason?: string;
    activatedAt?: number;
    affectedSubsystems?: string[];
  };
}

export function renderGovernancePanel(governanceStatus: GovernanceStatus | null): string[] {
  const lines: string[] = [
    "",
    "+--------------------------------------------------+",
    "| Governance Status                               |",
    "+--------------------------------------------------+",
    "",
  ];

  if (!governanceStatus) {
    lines.push("  Loading governance status...", "");
    return lines;
  }

  if (governanceStatus.freezeActive) {
    const freezeStatus = governanceStatus.freezeStatus;
    const affectedSubsystems = freezeStatus?.affectedSubsystems ?? [];
    lines.push("  [FROZEN]");
    lines.push(`     Reason: ${freezeStatus?.reason || "unknown"}`);
    if (freezeStatus?.activatedAt) {
      lines.push(`     Activated: ${new Date(freezeStatus.activatedAt).toLocaleString()}`);
    }
    if (affectedSubsystems.length > 0) {
      lines.push(`     Affected: ${affectedSubsystems.join(", ")}`);
    }
    lines.push("");
  } else {
    lines.push("  OK system running", "");
  }

  lines.push(`  Sovereignty boundary: ${governanceStatus.sovereigntyBoundary ? "OK" : "ERROR"}`, "");

  lines.push(`  Active agents: ${governanceStatus.activeAgents.length}`);
  const activeCount = governanceStatus.activeAgents.filter((agent) => agent.status === "active").length;
  const frozenCount = governanceStatus.activeAgents.filter((agent) => agent.status === "frozen").length;
  if (activeCount > 0 || frozenCount > 0) {
    lines.push(`     active: ${activeCount}`);
    if (frozenCount > 0) {
      lines.push(`     frozen: ${frozenCount}`);
    }
  }
  lines.push("");

  lines.push(`  Evolution projects: ${governanceStatus.evolutionProjects.length}`);
  const runningProjects = governanceStatus.evolutionProjects.filter(
    (project) => project.status === "running",
  );
  const completedProjects = governanceStatus.evolutionProjects.filter(
    (project) => project.status === "completed",
  );
  if (runningProjects.length > 0 || completedProjects.length > 0) {
    lines.push(`     running: ${runningProjects.length}`);
    lines.push(`     completed: ${completedProjects.length}`);
  }
  lines.push("");

  lines.push(`  Sandbox experiments: ${governanceStatus.sandboxExperiments.length}`);
  const runningExperiments = governanceStatus.sandboxExperiments.filter(
    (experiment) => experiment.status === "running",
  );
  const observingExperiments = governanceStatus.sandboxExperiments.filter(
    (experiment) => experiment.status === "observing",
  );
  if (runningExperiments.length > 0 || observingExperiments.length > 0) {
    lines.push(`     running: ${runningExperiments.length}`);
    lines.push(`     observing: ${observingExperiments.length}`);
  }
  lines.push("");

  return lines;
}

export function getGovernanceSummary(governanceStatus: GovernanceStatus | null): string {
  if (!governanceStatus) {
    return "governance loading";
  }
  if (governanceStatus.freezeActive) {
    return "governance frozen";
  }
  return [
    "governance",
    `agents:${governanceStatus.activeAgents.length}`,
    `projects:${governanceStatus.evolutionProjects.length}`,
    `experiments:${governanceStatus.sandboxExperiments.length}`,
  ].join(" ");
}
