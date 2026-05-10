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
    "| 治理状态                                         |",
    "+--------------------------------------------------+",
    "",
  ];

  if (!governanceStatus) {
    lines.push("  正在加载治理状态...", "");
    return lines;
  }

  if (governanceStatus.freezeActive) {
    const freezeStatus = governanceStatus.freezeStatus;
    const affectedSubsystems = freezeStatus?.affectedSubsystems ?? [];
    lines.push("  [已冻结]");
    lines.push(`     原因: ${freezeStatus?.reason || "未知"}`);
    if (freezeStatus?.activatedAt) {
      lines.push(`     激活时间: ${new Date(freezeStatus.activatedAt).toLocaleString()}`);
    }
    if (affectedSubsystems.length > 0) {
      lines.push(`     影响范围: ${affectedSubsystems.join(", ")}`);
    }
    lines.push("");
  } else {
    lines.push("  正常运行", "");
  }

  lines.push(`  主权边界: ${governanceStatus.sovereigntyBoundary ? "正常" : "错误"}`, "");

  lines.push(`  活跃代理: ${governanceStatus.activeAgents.length}`);
  const activeCount = governanceStatus.activeAgents.filter((agent) => agent.status === "active").length;
  const frozenCount = governanceStatus.activeAgents.filter((agent) => agent.status === "frozen").length;
  if (activeCount > 0 || frozenCount > 0) {
    lines.push(`     活跃: ${activeCount}`);
    if (frozenCount > 0) {
      lines.push(`     冻结: ${frozenCount}`);
    }
  }
  lines.push("");

  lines.push(`  进化项目: ${governanceStatus.evolutionProjects.length}`);
  const runningProjects = governanceStatus.evolutionProjects.filter(
    (project) => project.status === "running",
  );
  const completedProjects = governanceStatus.evolutionProjects.filter(
    (project) => project.status === "completed",
  );
  if (runningProjects.length > 0 || completedProjects.length > 0) {
    lines.push(`     运行中: ${runningProjects.length}`);
    lines.push(`     已完成: ${completedProjects.length}`);
  }
  lines.push("");

  lines.push(`  沙箱实验: ${governanceStatus.sandboxExperiments.length}`);
  const runningExperiments = governanceStatus.sandboxExperiments.filter(
    (experiment) => experiment.status === "running",
  );
  const observingExperiments = governanceStatus.sandboxExperiments.filter(
    (experiment) => experiment.status === "observing",
  );
  if (runningExperiments.length > 0 || observingExperiments.length > 0) {
    lines.push(`     运行中: ${runningExperiments.length}`);
    lines.push(`     观察中: ${observingExperiments.length}`);
  }
  lines.push("");

  return lines;
}

export function getGovernanceSummary(governanceStatus: GovernanceStatus | null): string {
  if (!governanceStatus) {
    return "治理加载中";
  }
  if (governanceStatus.freezeActive) {
    return "治理已冻结";
  }
  return [
    "治理",
    `代理:${governanceStatus.activeAgents.length}`,
    `项目:${governanceStatus.evolutionProjects.length}`,
    `实验:${governanceStatus.sandboxExperiments.length}`,
  ].join(" ");
}
