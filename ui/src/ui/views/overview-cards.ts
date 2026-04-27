import { html, nothing, type TemplateResult } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { t } from "../../i18n/index.ts";
import { formatCost, formatTokens, formatRelativeTimestamp } from "../format.ts";
import { isMonitoredAuthProvider } from "../model-auth-helpers.ts";
import { formatNextRun } from "../presenter.ts";
import type {
  CronJob,
  CronStatus,
  ModelAuthStatusResult,
  SessionsListResult,
  SessionsUsageResult,
  SkillStatusReport,
  StatusSummary,
} from "../types.ts";

export type OverviewCardsProps = {
  statusSummary: StatusSummary | null;
  usageResult: SessionsUsageResult | null;
  sessionsResult: SessionsListResult | null;
  skillsReport: SkillStatusReport | null;
  cronJobs: CronJob[];
  cronStatus: CronStatus | null;
  modelAuthStatus: ModelAuthStatusResult | null;
  presenceCount: number;
  onNavigate: (tab: string) => void;
  onNavigateToGovernance: () => void;
  onNavigateToAutonomy: () => void;
};

const DIGIT_RUN = /\d{3,}/g;
const HINT_SEPARATOR = " | ";

function blurDigits(value: string): TemplateResult {
  const escaped = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const blurred = escaped.replace(DIGIT_RUN, (match) => `<span class="blur-digits">${match}</span>`);
  return html`${unsafeHTML(blurred)}`;
}

function joinHintParts(parts: Array<string | null | undefined>) {
  return parts.filter((entry): entry is string => Boolean(entry)).join(HINT_SEPARATOR);
}

type StatCard = {
  kind: string;
  label: string;
  value: string | TemplateResult;
  hint: string | TemplateResult;
  onClick: () => void;
};

function renderStatCard(card: StatCard) {
  return html`
    <button class="ov-card" data-kind=${card.kind} @click=${card.onClick}>
      <span class="ov-card__label">${card.label}</span>
      <span class="ov-card__value">${card.value}</span>
      <span class="ov-card__hint">${card.hint}</span>
    </button>
  `;
}

function renderSkeletonCards() {
  return html`
    <section class="ov-cards">
      ${[0, 1, 2, 3].map(
        (index) => html`
          <div class="ov-card" style="cursor: default; animation-delay: ${index * 50}ms">
            <span class="skeleton skeleton-line" style="width: 60px; height: 10px"></span>
            <span class="skeleton skeleton-stat"></span>
            <span class="skeleton skeleton-line skeleton-line--medium" style="height: 12px"></span>
          </div>
        `,
      )}
    </section>
  `;
}

export function renderOverviewCards(props: OverviewCardsProps) {
  const dataLoaded =
    props.usageResult != null ||
    props.sessionsResult != null ||
    props.skillsReport != null ||
    props.statusSummary != null;
  if (!dataLoaded) {
    return renderSkeletonCards();
  }

  const totals = props.usageResult?.totals;
  const totalCost = formatCost(totals?.totalCost);
  const totalTokens = formatTokens(totals?.totalTokens);
  const totalMessages = totals ? String(props.usageResult?.aggregates?.messages?.total ?? 0) : "0";
  const sessionCount = props.sessionsResult?.count ?? null;

  const skills = props.skillsReport?.skills ?? [];
  const enabledSkills = skills.filter((entry) => !entry.disabled).length;
  const blockedSkills = skills.filter((entry) => entry.blockedByAllowlist).length;
  const totalSkills = skills.length;

  const cronEnabled = props.cronStatus?.enabled ?? null;
  const cronNext = props.cronStatus?.nextWakeAtMs ?? null;
  const cronJobCount = props.cronJobs.length;
  const failedCronCount = props.cronJobs.filter((job) => job.state?.lastStatus === "error").length;

  const cronValue =
    cronEnabled == null
      ? t("common.na")
      : cronEnabled
        ? `${cronJobCount} jobs`
        : t("common.disabled");
  const cronHint =
    failedCronCount > 0
      ? html`<span class="danger">${failedCronCount} failed</span>`
      : cronNext
        ? t("overview.stats.cronNext", { time: formatNextRun(cronNext) })
        : "";

  const cards: StatCard[] = [
    {
      kind: "cost",
      label: t("overview.cards.cost"),
      value: totalCost,
      hint: `${totalTokens} tokens${HINT_SEPARATOR}${totalMessages} msgs`,
      onClick: () => props.onNavigate("usage"),
    },
    {
      kind: "sessions",
      label: t("overview.stats.sessions"),
      value: String(sessionCount ?? t("common.na")),
      hint: t("overview.stats.sessionsHint"),
      onClick: () => props.onNavigate("sessions"),
    },
    {
      kind: "skills",
      label: t("overview.cards.skills"),
      value: `${enabledSkills}/${totalSkills}`,
      hint: blockedSkills > 0 ? `${blockedSkills} blocked` : `${enabledSkills} active`,
      onClick: () => props.onNavigate("skills"),
    },
    {
      kind: "cron",
      label: t("overview.stats.cron"),
      value: cronValue,
      hint: cronHint,
      onClick: () => props.onNavigate("cron"),
    },
  ];

  const authLoading = props.modelAuthStatus === null;
  const authProviders = props.modelAuthStatus?.providers ?? [];
  const monitoredProviders = authProviders.filter(isMonitoredAuthProvider);
  if (authLoading) {
    cards.push({
      kind: "auth",
      label: t("overview.cards.modelAuth"),
      value: t("common.na"),
      hint: "",
      onClick: () => props.onNavigate("overview"),
    });
  } else if (monitoredProviders.length > 0) {
    const expired = monitoredProviders.filter(
      (provider) => provider.status === "expired" || provider.status === "missing",
    ).length;
    const expiring = monitoredProviders.filter((provider) => provider.status === "expiring").length;
    const authValue =
      expired > 0
        ? html`<span class="danger"
            >${t("overview.cards.modelAuthExpired", { count: String(expired) })}</span
          >`
        : expiring > 0
          ? html`<span class="warn"
              >${t("overview.cards.modelAuthExpiring", { count: String(expiring) })}</span
            >`
          : t("overview.cards.modelAuthOk", { count: String(monitoredProviders.length) });

    const formatReset = (resetAt: number | undefined, pctLeft: number): string | null => {
      if (!resetAt || !Number.isFinite(resetAt) || pctLeft >= 25) {
        return null;
      }
      const date = new Date(resetAt);
      if (Number.isNaN(date.getTime())) {
        return null;
      }
      const withinADay = resetAt - Date.now() < 24 * 60 * 60 * 1000;
      return withinADay
        ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
        : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };

    const hintParts = monitoredProviders
      .map((provider) => {
        const segments: string[] = [];
        for (const windowUsage of provider.usage?.windows ?? []) {
          const pctLeft = Math.max(0, Math.min(100, Math.round(100 - windowUsage.usedPercent)));
          const prefix = windowUsage.label?.trim() ? `${windowUsage.label.trim()} ` : "";
          const pctLabel = t("overview.cards.modelAuthUsageLeft", { pct: String(pctLeft) });
          const resetLabel = formatReset(windowUsage.resetAt, pctLeft);
          segments.push(resetLabel ? `${prefix}${pctLabel} (${resetLabel})` : `${prefix}${pctLabel}`);
        }
        if (
          provider.expiry &&
          Number.isFinite(provider.expiry.at) &&
          provider.status !== "static" &&
          provider.expiry.label &&
          provider.expiry.label !== "unknown"
        ) {
          segments.push(t("overview.cards.modelAuthExpiresIn", { when: provider.expiry.label }));
        }
        return segments.length > 0 ? `${provider.displayName}: ${segments.join(", ")}` : null;
      })
      .filter((entry): entry is string => entry !== null)
      .slice(0, 2);
    const authHint =
      hintParts.join(HINT_SEPARATOR) ||
      t("overview.cards.modelAuthProviders", { count: String(monitoredProviders.length) });

    cards.push({
      kind: "auth",
      label: t("overview.cards.modelAuth"),
      value: authValue,
      hint: authHint,
      onClick: () => props.onNavigate("overview"),
    });
  }

  const governance = props.statusSummary?.governance;
  if (governance) {
    const critical = governance.findingSummary.critical;
    const warn = governance.findingSummary.warn;
    const pending = governance.proposalSummary.pending;
    const team = governance.teamSummary;
    const governanceValue = governance.freezeActive
      ? html`<span class="danger">Freeze</span>`
      : critical > 0
        ? html`<span class="danger">${critical} critical</span>`
        : (team?.missingMemberCount ?? 0) > 0
          ? html`<span class="warn">${team?.missingMemberCount} missing</span>`
          : pending > 0
            ? html`<span class="warn">${pending} pending</span>`
            : (team?.freezeActiveMemberCount ?? 0) > 0
              ? html`<span class="warn">${team?.freezeActiveMemberCount} frozen</span>`
              : `${governance.capabilitySummary.criticalGapCount} gaps`;
    const teamHint = !team
      ? null
      : !team.declared
        ? `team ${team.teamId} undeclared`
        : team.missingMemberCount > 0
          ? `${team.missingMemberCount} missing member${team.missingMemberCount === 1 ? "" : "s"}`
          : team.freezeActiveMemberCount > 0
            ? `${team.freezeActiveMemberCount}/${team.memberCount} frozen members`
            : joinHintParts([
                `${team.memberCount} members`,
                `${team.runtimeHookCount} hooks`,
                team.effectiveToolDenyCount > 0
                  ? `${team.effectiveToolDenyCount} ${team.effectiveToolDenyCount === 1 ? "deny" : "denies"}`
                  : null,
              ]);
    const governanceHint = joinHintParts([
      pending > 0 ? `${pending} pending` : null,
      critical > 0 || warn > 0 ? `${critical} critical, ${warn} warn` : null,
      teamHint,
      governance.freezeActive && governance.freezeReasonCode
        ? governance.freezeReasonCode
        : governance.genesisSummary.blockerCount > 0
          ? `${governance.genesisSummary.blockerCount} blocker${governance.genesisSummary.blockerCount === 1 ? "" : "s"}`
          : `observed ${formatRelativeTimestamp(governance.observedAt)}`,
    ]);
    cards.push({
      kind: "governance",
      label: "Governance",
      value: governanceValue,
      hint: governanceHint,
      onClick: props.onNavigateToGovernance,
    });
  }

  const autonomy = props.statusSummary?.autonomy;
  if (autonomy) {
    const fleet = autonomy.fleetSummary;
    const fleetPressure = fleet.drift + fleet.missingLoop;
    const autonomyValue =
      fleetPressure > 0
        ? html`<span class="warn">${fleetPressure} drift</span>`
        : `${fleet.healthy}/${fleet.totalProfiles} healthy`;
    const autonomyHint = joinHintParts([
      `${fleet.activeFlows} active`,
      fleet.missingLoop > 0 ? `${fleet.missingLoop} missing loops` : null,
      autonomy.capabilitySummary.criticalGapCount > 0
        ? `${autonomy.capabilitySummary.criticalGapCount} critical gaps`
        : `observed ${formatRelativeTimestamp(autonomy.observedAt)}`,
    ]);
    cards.push({
      kind: "autonomy",
      label: "Autonomy",
      value: autonomyValue,
      hint: autonomyHint,
      onClick: props.onNavigateToAutonomy,
    });
  }

  const sessions = props.sessionsResult?.sessions.slice(0, 5) ?? [];

  return html`
    <section class="ov-cards">${cards.map((card) => renderStatCard(card))}</section>

    ${sessions.length > 0
      ? html`
          <section class="ov-recent">
            <h3 class="ov-recent__title">${t("overview.cards.recentSessions")}</h3>
            <ul class="ov-recent__list">
              ${sessions.map(
                (session) => html`
                  <li class="ov-recent__row">
                    <span class="ov-recent__key"
                      >${blurDigits(session.displayName || session.label || session.key)}</span
                    >
                    <span class="ov-recent__model">${session.model ?? ""}</span>
                    <span class="ov-recent__time"
                      >${session.updatedAt ? formatRelativeTimestamp(session.updatedAt) : ""}</span
                    >
                  </li>
                `,
              )}
            </ul>
          </section>
        `
      : nothing}
  `;
}
