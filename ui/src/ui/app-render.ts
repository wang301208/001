import { html, nothing } from "lit";
import { applyMergePatch } from "../../../src/config/merge-patch.ts";
import {
  buildAgentMainSessionKey,
  parseAgentSessionKey,
  resolveAgentIdFromSessionKey,
} from "../../../src/routing/session-key.js";
import { t } from "../i18n/index.ts";
import { getSafeLocalStorage } from "../local-storage.ts";
import { refreshChatAvatar } from "./app-chat.ts";
import { DEFAULT_CRON_FORM } from "./app-defaults.ts";
import { renderUsageTab } from "./app-render-usage-tab.ts";
import { createChatModelOverride } from "./chat-model-ref.ts";
import {
  renderChatControls,
  renderChatMobileToggle,
  renderChatSessionSelect,
  renderTab,
  resolveAssistantAttachmentAuthToken,
  renderSidebarConnectionStatus,
  renderTopbarThemeModeToggle,
  switchChatSession,
} from "./app-render.helpers.ts";
import { warnQueryToken } from "./app-settings.ts";
import type { AppViewState } from "./app-view-state.ts";
import { loadAgentFileContent, loadAgentFiles, saveAgentFile } from "./controllers/agent-files.ts";
import { loadAgentIdentities, loadAgentIdentity } from "./controllers/agent-identity.ts";
import { loadAgentSkills } from "./controllers/agent-skills.ts";
import {
  buildToolsEffectiveRequestKey,
  loadAgents,
  loadToolsCatalog,
  loadToolsEffective,
  resetToolsEffectiveState,
  refreshVisibleToolsEffectiveForCurrentSession,
  saveAgentsConfig,
} from "./controllers/agents.ts";
import {
  buildAutonomyRequestKey,
  cancelAutonomyFlow,
  loadAutonomyCapabilityInventory,
  loadAutonomyGenesisPlan,
  healAutonomyFleet,
  loadAutonomyHistory,
  loadAutonomyOverview,
  loadAutonomyProfile,
  parseAutonomyHistoryLimitDraft,
  parseAutonomyWorkspaceDirsDraft,
  reconcileAutonomyGovernanceProposals,
  reconcileAutonomyLoops,
  removeAutonomyLoop,
  resolveAutonomySessionKey,
  submitAutonomySandboxReplay,
  superviseAutonomyFleet,
  synthesizeAutonomyGovernanceProposals,
  startAutonomyFlow,
  upsertAutonomyLoop,
} from "./controllers/autonomy.ts";
import {
  applyGovernanceProposalEntry,
  applyGovernanceProposalEntries,
  buildGovernanceProposalOperationsDraftTemplate,
  createGovernanceProposalEntry,
  formatGovernanceAgentIdsDraft,
  formatGovernanceWorkspaceDirsDraft,
  loadGovernanceAgent,
  loadGovernanceCapabilityAssetRegistry,
  loadGovernanceCapabilityInventory,
  loadGovernanceGenesisPlan,
  loadGovernanceOverview,
  loadGovernanceProposals,
  loadGovernanceTeam,
  parseGovernanceAgentIdsDraft,
  parseGovernanceListLimitDraft,
  parseGovernanceProposalOperationsDraft,
  parseGovernanceWorkspaceDirsDraft,
  reconcileGovernanceProposals,
  revertGovernanceProposalEntries,
  revertGovernanceProposalEntry,
  resetGovernanceState,
  reviewGovernanceProposalEntries,
  reviewGovernanceProposalEntry,
  synthesizeGovernanceProposals,
} from "./controllers/governance.ts";
import { loadChannels } from "./controllers/channels.ts";
import { loadChatHistory } from "./controllers/chat.ts";
import {
  applyConfig,
  ensureAgentConfigEntry,
  findAgentConfigEntryIndex,
  loadConfig,
  openConfigFile,
  runUpdate,
  saveConfig,
  updateConfigFormValue,
  removeConfigFormValue,
} from "./controllers/config.ts";
import { cloneConfigObject, serializeConfigForm } from "./controllers/config/form-utils.ts";
import {
  loadCronJobsPage,
  loadCronRuns,
  loadMoreCronRuns,
  toggleCronJob,
  runCronJob,
  removeCronJob,
  addCronJob,
  startCronEdit,
  startCronClone,
  cancelCronEdit,
  validateCronForm,
  hasCronFormErrors,
  normalizeCronFormState,
  getVisibleCronJobs,
  updateCronJobsFilter,
  updateCronRunsFilter,
} from "./controllers/cron.ts";
import { loadDebug, callDebugMethod } from "./controllers/debug.ts";
import {
  approveDevicePairing,
  loadDevices,
  rejectDevicePairing,
  revokeDeviceToken,
  rotateDeviceToken,
} from "./controllers/devices.ts";
import {
  backfillDreamDiary,
  copyDreamingArchivePath,
  dedupeDreamDiary,
  loadDreamDiary,
  loadDreamingStatus,
  loadWikiImportInsights,
  loadWikiMemoryPalace,
  repairDreamingArtifacts,
  resetGroundedShortTerm,
  resetDreamDiary,
  resolveConfiguredDreaming,
  updateDreamingEnabled,
} from "./controllers/dreaming.ts";
import {
  loadExecApprovals,
  removeExecApprovalsFormValue,
  saveExecApprovals,
  updateExecApprovalsFormValue,
} from "./controllers/exec-approvals.ts";
import { loadLogs } from "./controllers/logs.ts";
import { loadModels } from "./controllers/models.ts";
import { loadNodes } from "./controllers/nodes.ts";
import { loadPresence } from "./controllers/presence.ts";
import {
  branchSessionFromCheckpoint,
  deleteSessionsAndRefresh,
  loadSessions,
  patchSession,
  restoreSessionFromCheckpoint,
  toggleSessionCompactionCheckpoints,
} from "./controllers/sessions.ts";
import {
  closeClawHubDetail,
  installFromClawHub,
  installSkill,
  loadClawHubDetail,
  loadSkills,
  saveSkillApiKey,
  searchClawHub,
  setClawHubSearchQuery,
  updateSkillEdit,
  updateSkillEnabled,
} from "./controllers/skills.ts";
import { buildExternalLinkRel, EXTERNAL_LINK_TARGET } from "./external-link.ts";
import "./components/dashboard-header.ts";
import { icons } from "./icons.ts";
import { normalizeBasePath, TAB_GROUPS, subtitleForTab, titleForTab } from "./navigation.ts";
import { isPluginEnabledInConfigSnapshot } from "./plugin-activation.ts";
import { agentLogoUrl } from "./views/agents-utils.ts";
import {
  resolveAgentConfig,
  resolveConfiguredCronModelSuggestions,
  resolveEffectiveModelFallbacks,
  resolveModelPrimary,
  sortLocaleStrings,
} from "./views/agents-utils.ts";
import { renderChat } from "./views/chat.ts";
import { renderCommandPalette } from "./views/command-palette.ts";
import { getPresetById, type ConfigPresetId } from "./views/config-presets.ts";
import {
  renderQuickSettings,
  type QuickSettingsChannel,
  type QuickSettingsApiKey,
  type QuickSettingsRemoteModelDraft,
  type QuickSettingsRemoteModelProvider,
} from "./views/config-quick.ts";
import { renderConfig, type ConfigProps } from "./views/config.ts";
import {
  renderCronQuickCreate,
  createDefaultDraft,
  draftToCronFormPatch,
} from "./views/cron-quick-create.ts";
import { renderDreaming } from "./views/dreaming.ts";
import { renderExecApprovalPrompt } from "./views/exec-approval.ts";
import { renderGatewayUrlConfirmation } from "./views/gateway-url-confirmation.ts";
import { renderLoginGate } from "./views/login-gate.ts";
import { renderOverview } from "./views/overview.ts";

// Lazy-loaded view modules – deferred so the initial bundle stays small.
// Each loader resolves once; subsequent calls return the cached module.
type LazyState<T> = { mod: T | null; promise: Promise<T> | null };

let _pendingUpdate: (() => void) | undefined;

function createLazy<T>(loader: () => Promise<T>): () => T | null {
  const s: LazyState<T> = { mod: null, promise: null };
  return () => {
    if (s.mod) {
      return s.mod;
    }
    if (!s.promise) {
      s.promise = loader().then((m) => {
        s.mod = m;
        _pendingUpdate?.();
        return m;
      });
    }
    return null;
  };
}

const lazyAgents = createLazy(() => import("./views/agents.ts"));
const lazyChannels = createLazy(() => import("./views/channels.ts"));
const lazyCron = createLazy(() => import("./views/cron.ts"));
const lazyDebug = createLazy(() => import("./views/debug.ts"));
const lazyInstances = createLazy(() => import("./views/instances.ts"));
const lazyLogs = createLazy(() => import("./views/logs.ts"));
const lazyNodes = createLazy(() => import("./views/nodes.ts"));
const lazySessions = createLazy(() => import("./views/sessions.ts"));
const lazySkills = createLazy(() => import("./views/skills.ts"));

function formatDreamNextCycle(nextRunAtMs: number | undefined): string | null {
  if (typeof nextRunAtMs !== "number" || !Number.isFinite(nextRunAtMs)) {
    return null;
  }
  return new Date(nextRunAtMs).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function resolveDreamingNextCycle(
  status: { phases?: Record<string, { enabled: boolean; nextRunAtMs?: number }> } | null,
): string | null {
  if (!status?.phases) {
    return null;
  }
  const nextRunAtMs = Object.values(status.phases)
    .filter((phase) => phase.enabled && typeof phase.nextRunAtMs === "number")
    .map((phase) => phase.nextRunAtMs as number)
    .toSorted((a, b) => a - b)[0];
  return formatDreamNextCycle(nextRunAtMs);
}

let clawhubSearchTimer: ReturnType<typeof setTimeout> | null = null;
function lazyRender<M>(getter: () => M | null, render: (mod: M) => unknown) {
  const mod = getter();
  return mod ? render(mod) : nothing;
}

const UPDATE_BANNER_DISMISS_KEY = "openclaw:control-ui:update-banner-dismissed:v1";
const CRON_THINKING_SUGGESTIONS = ["off", "minimal", "low", "medium", "high"];
const CRON_TIMEZONE_SUGGESTIONS = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
];

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function isOfficialOpenAIBaseUrl(value: string): boolean {
  try {
    return new URL(value.trim()).hostname.toLowerCase() === "api.openai.com";
  } catch {
    return false;
  }
}

function resolveQuickSettingsRemoteModelApi(
  provider: string,
  baseUrl: string,
  api: QuickSettingsRemoteModelDraft["api"],
): QuickSettingsRemoteModelDraft["api"] {
  if (provider === "openai" && api === "openai-responses" && !isOfficialOpenAIBaseUrl(baseUrl)) {
    return "openai-completions";
  }
  return api;
}

function normalizeSuggestionValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

type DismissedUpdateBanner = {
  latestVersion: string;
  channel: string | null;
  dismissedAtMs: number;
};

function loadDismissedUpdateBanner(): DismissedUpdateBanner | null {
  try {
    const raw = getSafeLocalStorage()?.getItem(UPDATE_BANNER_DISMISS_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<DismissedUpdateBanner>;
    if (!parsed || typeof parsed.latestVersion !== "string") {
      return null;
    }
    return {
      latestVersion: parsed.latestVersion,
      channel: typeof parsed.channel === "string" ? parsed.channel : null,
      dismissedAtMs: typeof parsed.dismissedAtMs === "number" ? parsed.dismissedAtMs : Date.now(),
    };
  } catch {
    return null;
  }
}

function isUpdateBannerDismissed(updateAvailable: unknown): boolean {
  const dismissed = loadDismissedUpdateBanner();
  if (!dismissed) {
    return false;
  }
  const info = updateAvailable as { latestVersion?: unknown; channel?: unknown };
  const latestVersion = info && typeof info.latestVersion === "string" ? info.latestVersion : null;
  const channel = info && typeof info.channel === "string" ? info.channel : null;
  return Boolean(
    latestVersion && dismissed.latestVersion === latestVersion && dismissed.channel === channel,
  );
}

function dismissUpdateBanner(updateAvailable: unknown) {
  const info = updateAvailable as { latestVersion?: unknown; channel?: unknown };
  const latestVersion = info && typeof info.latestVersion === "string" ? info.latestVersion : null;
  if (!latestVersion) {
    return;
  }
  const channel = info && typeof info.channel === "string" ? info.channel : null;
  const payload: DismissedUpdateBanner = {
    latestVersion,
    channel,
    dismissedAtMs: Date.now(),
  };
  try {
    getSafeLocalStorage()?.setItem(UPDATE_BANNER_DISMISS_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

const AVATAR_DATA_RE = /^data:/i;
const AVATAR_HTTP_RE = /^https?:\/\//i;
const COMMUNICATION_SECTION_KEYS = ["channels", "messages", "broadcast", "talk", "audio"] as const;
const APPEARANCE_SECTION_KEYS = ["__appearance__", "ui", "wizard"] as const;
const AUTOMATION_SECTION_KEYS = [
  "commands",
  "hooks",
  "bindings",
  "cron",
  "approvals",
  "plugins",
] as const;
const INFRASTRUCTURE_SECTION_KEYS = [
  "gateway",
  "web",
  "browser",
  "nodeHost",
  "canvasHost",
  "discovery",
  "media",
  "acp",
  "mcp",
] as const;
const AI_AGENTS_SECTION_KEYS = [
  "agents",
  "models",
  "skills",
  "tools",
  "memory",
  "session",
] as const;
type ConfigSectionSelection = {
  activeSection: string | null;
  activeSubsection: string | null;
};

type ConfigTabOverrides = Pick<
  ConfigProps,
  | "formMode"
  | "searchQuery"
  | "activeSection"
  | "activeSubsection"
  | "onFormModeChange"
  | "onSearchChange"
  | "onSectionChange"
  | "onSubsectionChange"
> &
  Partial<
    Pick<
      ConfigProps,
      | "showModeToggle"
      | "navRootLabel"
      | "includeSections"
      | "excludeSections"
      | "includeVirtualSections"
      | "settingsLayout"
      | "onBackToQuick"
    >
  >;

const SCOPED_CONFIG_SECTION_KEYS = new Set<string>([
  ...COMMUNICATION_SECTION_KEYS,
  ...APPEARANCE_SECTION_KEYS,
  ...AUTOMATION_SECTION_KEYS,
  ...INFRASTRUCTURE_SECTION_KEYS,
  ...AI_AGENTS_SECTION_KEYS,
]);

function normalizeMainConfigSelection(
  activeSection: string | null,
  activeSubsection: string | null,
): ConfigSectionSelection {
  if (activeSection && SCOPED_CONFIG_SECTION_KEYS.has(activeSection)) {
    return { activeSection: null, activeSubsection: null };
  }
  return { activeSection, activeSubsection };
}

function normalizeScopedConfigSelection(
  activeSection: string | null,
  activeSubsection: string | null,
  includedSections: readonly string[],
): ConfigSectionSelection {
  if (activeSection && !includedSections.includes(activeSection)) {
    return { activeSection: null, activeSubsection: null };
  }
  return { activeSection, activeSubsection };
}

function resolveAssistantAvatarUrl(state: AppViewState): string | undefined {
  const list = state.agentsList?.agents ?? [];
  const parsed = parseAgentSessionKey(state.sessionKey);
  const agentId = parsed?.agentId ?? state.agentsList?.defaultId ?? "main";
  const agent = list.find((entry) => entry.id === agentId);
  const identity = agent?.identity;
  const candidate = identity?.avatarUrl ?? identity?.avatar;
  if (!candidate) {
    return undefined;
  }
  if (AVATAR_DATA_RE.test(candidate) || AVATAR_HTTP_RE.test(candidate)) {
    return candidate;
  }
  return identity?.avatarUrl;
}

// ── Quick Settings data extraction helpers ──

const KNOWN_CHANNEL_IDS = [
  { id: "telegram", label: "Telegram" },
  { id: "discord", label: "Discord" },
  { id: "slack", label: "Slack" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "signal", label: "Signal" },
  { id: "imessage", label: "iMessage" },
] as const;

const KNOWN_PROVIDER_KEYS = [
  { provider: "anthropic", label: "Anthropic", envKey: "ANTHROPIC_API_KEY" },
  { provider: "openai", label: "OpenAI", envKey: "OPENAI_API_KEY" },
  { provider: "google", label: "Google", envKey: "GOOGLE_API_KEY" },
  { provider: "openrouter", label: "OpenRouter", envKey: "OPENROUTER_API_KEY" },
] as const;

const REMOTE_MODEL_PROVIDER_PRESETS: QuickSettingsRemoteModelProvider[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    api: "openai-responses",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    api: "openai-completions",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    api: "anthropic-messages",
  },
  {
    id: "google",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    api: "google-generative-ai",
  },
  {
    id: "ollama",
    label: "Ollama / Local OpenAI-compatible",
    baseUrl: "http://127.0.0.1:11434/v1",
    api: "openai-completions",
  },
  {
    id: "custom-openai",
    label: "Custom OpenAI-compatible",
    baseUrl: "https://example.com/v1",
    api: "openai-completions",
  },
];

function formatQuickSettingsLabel(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) {
    return "未知";
  }
  return trimmed
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractQuickSettingsChannels(state: AppViewState): QuickSettingsChannel[] {
  const config = state.configForm ?? state.configSnapshot?.config;
  if (!config || typeof config !== "object") {
    return [];
  }
  const channelsConfig =
    "channels" in config && config.channels && typeof config.channels === "object"
      ? (config.channels as Record<string, unknown>)
      : {};
  const configuredIds = Object.keys(channelsConfig).filter((id) => id.trim().length > 0);
  const channelIds =
    configuredIds.length > 0
      ? configuredIds.toSorted((a, b) => a.localeCompare(b))
      : KNOWN_CHANNEL_IDS.map(({ id }) => id);
  const knownLabels = new Map<string, string>(
    KNOWN_CHANNEL_IDS.map(({ id, label }) => [id, label]),
  );
  const channels: QuickSettingsChannel[] = [];
  for (const id of channelIds) {
    const channelConfig = channelsConfig[id];
    const hasConfig =
      channelConfig != null &&
      typeof channelConfig === "object" &&
      Object.keys(channelConfig).length > 0;
    channels.push({
      id,
      label: knownLabels.get(id) ?? formatQuickSettingsLabel(id),
      connected: hasConfig,
      detail: hasConfig ? "已配置" : undefined,
    });
  }
  return channels;
}

function extractQuickSettingsApiKeys(state: AppViewState): QuickSettingsApiKey[] {
  const config = state.configForm ?? state.configSnapshot?.config;
  const env = config && typeof config === "object" ? config.env : null;
  const envObj = env && typeof env === "object" ? (env as Record<string, unknown>) : {};
  const envVars =
    envObj.vars && typeof envObj.vars === "object" ? (envObj.vars as Record<string, unknown>) : {};
  const models = config && typeof config === "object" ? config.models : null;
  const modelsObj = models && typeof models === "object" ? (models as Record<string, unknown>) : {};
  const providerConfigs =
    modelsObj.providers && typeof modelsObj.providers === "object"
      ? (modelsObj.providers as Record<string, unknown>)
      : {};
  return KNOWN_PROVIDER_KEYS.map(({ provider, label, envKey }) => {
    const providerConfig = asConfigRecord(providerConfigs[provider]);
    const providerApiKey = providerConfig.apiKey;
    const value =
      typeof providerApiKey === "string"
        ? providerApiKey
        : typeof envVars[envKey] === "string"
          ? envVars[envKey]
          : envObj[envKey];
    const isSet = typeof value === "string" && value.trim().length > 0;
    const masked = isSet ? `••••${value.slice(-4)}` : undefined;
    return { provider, label, masked, isSet };
  });
}

function extractMcpServerCount(state: AppViewState): number {
  const config = state.configForm ?? state.configSnapshot?.config;
  if (!config || typeof config !== "object") {
    return 0;
  }
  const mcp = config.mcp;
  if (!mcp || typeof mcp !== "object") {
    return 0;
  }
  const servers =
    "servers" in mcp && mcp.servers && typeof mcp.servers === "object"
      ? (mcp.servers as Record<string, unknown>)
      : {};
  return Object.keys(servers).length;
}

function extractQuickSettingsSecurity(state: AppViewState): {
  gatewayAuth: string;
  execPolicy: string;
  deviceAuth: boolean;
} {
  const config = state.configForm ?? state.configSnapshot?.config;
  if (!config || typeof config !== "object") {
    return { gatewayAuth: "未知", execPolicy: "未知", deviceAuth: false };
  }
  const cfg = config;
  const gateway =
    "gateway" in cfg && cfg.gateway && typeof cfg.gateway === "object"
      ? (cfg.gateway as Record<string, unknown>)
      : null;
  const auth =
    gateway && "auth" in gateway && gateway.auth && typeof gateway.auth === "object"
      ? (gateway.auth as Record<string, unknown>)
      : null;
  let gatewayAuth = "未知";
  if (auth) {
    const mode = typeof auth.mode === "string" ? auth.mode.trim() : "";
    if (mode) {
      gatewayAuth = mode;
    } else if (auth.password) {
      gatewayAuth = "password";
    } else if (auth.token) {
      gatewayAuth = "token";
    } else if (auth.trustedProxy) {
      gatewayAuth = "trusted-proxy";
    } else {
      gatewayAuth = "none";
    }
  }
  const agents = cfg.agents;
  let execPolicy = "allowlist";
  if (agents && typeof agents === "object") {
    const defaults = (agents as Record<string, unknown>).defaults;
    if (defaults && typeof defaults === "object") {
      const exec = (defaults as Record<string, unknown>).exec;
      if (exec && typeof exec === "object") {
        const security = (exec as Record<string, unknown>).security;
        if (typeof security === "string") {
          execPolicy = security;
        }
      }
    }
  }
  let deviceAuth = true;
  if (gateway) {
    const controlUi =
      "controlUi" in gateway && gateway.controlUi && typeof gateway.controlUi === "object"
        ? (gateway.controlUi as Record<string, unknown>)
        : null;
    if (controlUi?.dangerouslyDisableDeviceAuth === true) {
      deviceAuth = false;
    }
  }
  return { gatewayAuth, execPolicy, deviceAuth };
}

function resolveQuickSettingsSessionRow(state: AppViewState) {
  return state.sessionsResult?.sessions?.find((row) => row.key === state.sessionKey);
}

function asConfigRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sanitizeProviderId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function normalizeQuickSettingsRemoteModelId(provider: string, modelId: string): string {
  const providerId = provider.trim();
  const model = modelId.trim();
  if (!providerId || !model.toLowerCase().startsWith(`${providerId.toLowerCase()}/`)) {
    return model;
  }
  return model.slice(providerId.length + 1).trim();
}

function buildQuickSettingsModelRef(provider: string, modelId: string): string {
  const providerId = provider.trim();
  const model = modelId.trim();
  if (!providerId) {
    return model;
  }
  return model.toLowerCase().startsWith(`${providerId.toLowerCase()}/`)
    ? model
    : `${providerId}/${model}`;
}

function resolveQuickSettingsModelCatalogEntry(
  state: AppViewState,
  provider: string,
  modelId: string,
) {
  const normalizedProvider = sanitizeProviderId(provider);
  const normalizedModel = modelId.trim().toLowerCase();
  return state.chatModelCatalog.find(
    (entry) =>
      sanitizeProviderId(entry.provider) === normalizedProvider &&
      entry.id.trim().toLowerCase() === normalizedModel,
  );
}

function assertQuickSettingsModelCatalogReady(
  state: AppViewState,
  provider: string,
  modelId: string,
  modelRef: string,
) {
  if (resolveQuickSettingsModelCatalogEntry(state, provider, modelId)) {
    return;
  }
  throw new Error(
    `配置已写入，但模型目录未返回 ${modelRef}。请检查提供商、模型 ID、基础 URL 或重启网关后重试。`,
  );
}

function setQuickSettingsDefaultModel(config: Record<string, unknown>, modelRef: string) {
  const agents = asConfigRecord(config.agents);
  const defaults = asConfigRecord(agents.defaults);
  const existing = defaults.model;
  defaults.model =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>), primary: modelRef }
      : { primary: modelRef };
  agents.defaults = defaults;
  config.agents = agents;
}

async function refreshQuickSettingsModelCatalog(state: AppViewState) {
  if (!state.client || !state.connected) {
    state.chatModelsLoading = false;
    state.chatModelCatalog = [];
    return;
  }
  state.chatModelsLoading = true;
  try {
    state.chatModelCatalog = await loadModels(state.client);
  } finally {
    state.chatModelsLoading = false;
  }
}

async function switchQuickSettingsSessionModel(
  state: AppViewState,
  modelRef: string,
  expected?: { provider: string; modelId: string },
) {
  if (!state.client || !state.connected) {
    return;
  }
  const targetSessionKey = state.sessionKey;
  const previousOverride = state.chatModelOverrides[targetSessionKey];
  state.chatModelOverrides = {
    ...state.chatModelOverrides,
    [targetSessionKey]: createChatModelOverride(modelRef),
  };
  try {
    const patchResult = await state.client.request<{
      resolved?: { modelProvider?: string; model?: string };
    }>("sessions.patch", {
      key: targetSessionKey,
      model: modelRef || null,
    });
    if (expected) {
      const resolvedProvider = patchResult?.resolved?.modelProvider?.trim();
      const resolvedModel = patchResult?.resolved?.model?.trim();
      if (
        sanitizeProviderId(resolvedProvider ?? "") !== sanitizeProviderId(expected.provider) ||
        resolvedModel?.toLowerCase() !== expected.modelId.trim().toLowerCase()
      ) {
        throw new Error(
          `会话模型切换未生效：目标 ${modelRef}，实际 ${resolvedProvider ?? "未知"}/${resolvedModel ?? "未知"}。`,
        );
      }
    }
    await loadSessions(state, {
      activeMinutes: 0,
      limit: 0,
      includeGlobal: true,
      includeUnknown: true,
    });
    void refreshVisibleToolsEffectiveForCurrentSession(state);
  } catch (err) {
    state.chatModelOverrides = {
      ...state.chatModelOverrides,
      [targetSessionKey]: previousOverride,
    };
    throw err;
  }
}

async function applyQuickSettingsRemoteModelImport(
  state: AppViewState,
  draft: QuickSettingsRemoteModelDraft,
) {
  if (!state.client || !state.connected) {
    return;
  }
  const provider = sanitizeProviderId(draft.provider);
  const modelId = normalizeQuickSettingsRemoteModelId(provider, draft.modelId);
  const baseUrl = draft.baseUrl.trim();
  const apiKey = draft.apiKey.trim();
  if (!provider) {
    state.lastError = "远程模型导入失败：必须选择提供商。";
    return;
  }
  if (!modelId) {
    state.lastError = "远程模型导入失败：必须填写模型 ID。";
    return;
  }
  if (!isHttpUrl(baseUrl)) {
    state.lastError = "远程模型导入失败：基础 URL 必须以 http:// 或 https:// 开头。";
    return;
  }

  state.configApplying = true;
  state.remoteModelImporting = true;
  state.remoteModelImportMessage = null;
  state.lastError = null;
  try {
    if (!state.configSnapshot?.hash) {
      await loadConfig(state);
    }
    const baseHash = state.configSnapshot?.hash?.trim();
    if (!baseHash) {
      throw new Error("Config base hash unavailable. Reload config and retry.");
    }

    const config = cloneConfigObject(state.configForm ?? state.configSnapshot?.config ?? {});
    const models = asConfigRecord(config.models);
    const providers = asConfigRecord(models.providers);
    const existingProvider = asConfigRecord(providers[provider]);
    const api = resolveQuickSettingsRemoteModelApi(provider, baseUrl, draft.api);
    const existingModels = Array.isArray(existingProvider.models)
      ? [...existingProvider.models]
      : [];
    const existingModelEntry = existingModels.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        (entry as Record<string, unknown>).id === modelId,
    );
    const existingModelCompat = asConfigRecord(
      existingModelEntry && typeof existingModelEntry === "object"
        ? (existingModelEntry as Record<string, unknown>).compat
        : undefined,
    );
    const compat =
      api === "openai-completions" && !isOfficialOpenAIBaseUrl(baseUrl)
        ? {
            ...existingModelCompat,
            maxTokensField: "max_tokens",
            supportsStore: false,
            supportsDeveloperRole: false,
            supportsReasoningEffort: false,
            supportsTools: false,
            supportsUsageInStreaming: false,
            supportsStrictMode: false,
            requiresStringContent: true,
          }
        : undefined;
    const existingModelIndex = existingModels.findIndex(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        (entry as Record<string, unknown>).id === modelId,
    );
    const modelEntry = {
      ...(existingModelIndex >= 0
        ? (existingModels[existingModelIndex] as Record<string, unknown>)
        : {}),
      id: modelId,
      name: modelId,
      api,
      reasoning: compat ? false : draft.reasoning,
      input: draft.supportsImages ? ["text", "image"] : ["text"],
      ...(compat ? { compat } : {}),
      ...(draft.contextWindow ? { contextWindow: draft.contextWindow } : {}),
      ...(draft.maxTokens ? { maxTokens: draft.maxTokens } : {}),
    };
    if (existingModelIndex >= 0) {
      existingModels[existingModelIndex] = modelEntry;
    } else {
      existingModels.push(modelEntry);
    }

    providers[provider] = {
      ...existingProvider,
      baseUrl,
      api,
      auth: existingProvider.auth ?? "api-key",
      ...(apiKey ? { apiKey } : {}),
      models: existingModels,
    };
    models.mode = typeof models.mode === "string" ? models.mode : "merge";
    models.providers = providers;
    config.models = models;

    const modelRef = buildQuickSettingsModelRef(provider, modelId);
    if (draft.setDefault) {
      setQuickSettingsDefaultModel(config, modelRef);
    }

    await state.client.request("config.patch", { raw: serializeConfigForm(config), baseHash });
    await loadConfig(state);
    await refreshQuickSettingsModelCatalog(state);
    assertQuickSettingsModelCatalogReady(state, provider, modelId, modelRef);
    if (draft.setDefault) {
      await switchQuickSettingsSessionModel(state, modelRef, { provider, modelId });
    }
    state.remoteModelImportMessage = {
      kind: "success",
      text: draft.setDefault
        ? `已导入 ${modelRef}，并已切换为当前会话模型。`
        : `已导入 ${modelRef}。`,
    };
  } catch (err) {
    const message = `远程模型导入失败：${String(err)}`;
    state.lastError = message;
    state.remoteModelImportMessage = { kind: "error", text: message };
  } finally {
    state.configApplying = false;
    state.remoteModelImporting = false;
  }
}

async function applyQuickSettingsPreset(state: AppViewState, presetId: ConfigPresetId) {
  if (!state.client || !state.connected) {
    return;
  }
  const preset = getPresetById(presetId);
  if (!preset) {
    return;
  }
  state.configApplying = true;
  state.lastError = null;
  try {
    if (!state.configSnapshot?.hash) {
      await loadConfig(state);
    }
    const baseHash = state.configSnapshot?.hash?.trim();
    if (!baseHash) {
      throw new Error("Config base hash unavailable. Reload config and retry.");
    }
    const baseConfig = cloneConfigObject(state.configForm ?? state.configSnapshot?.config ?? {});
    const merged = applyMergePatch(baseConfig, preset.patch) as Record<string, unknown>;
    await state.client.request("config.patch", { raw: serializeConfigForm(merged), baseHash });
    await loadConfig(state);
  } catch (err) {
    state.lastError = `应用配置方案失败：${String(err)}`;
  } finally {
    state.configApplying = false;
  }
}

function renderCronQuickCreateForTab(
  state: AppViewState,
  requestHostUpdate: (() => void) | undefined,
) {
  return renderCronQuickCreate({
    open: state.cronQuickCreateOpen,
    step: state.cronQuickCreateStep,
    draft: state.cronQuickCreateDraft ?? createDefaultDraft(),
    onDraftChange: (patch) => {
      state.cronQuickCreateDraft = {
        ...(state.cronQuickCreateDraft ?? createDefaultDraft()),
        ...patch,
      };
      requestHostUpdate?.();
    },
    onStepChange: (step) => {
      state.cronQuickCreateStep = step;
      requestHostUpdate?.();
    },
    onCreate: () => {
      const draft = state.cronQuickCreateDraft ?? createDefaultDraft();
      const formPatch = draftToCronFormPatch(draft);
      state.cronEditingJobId = null;
      state.cronForm = { ...DEFAULT_CRON_FORM, ...formPatch } as typeof state.cronForm;
      requestHostUpdate?.();
      void (async () => {
        await addCronJob(state);
        if (state.cronError || hasCronFormErrors(state.cronFieldErrors)) {
          requestHostUpdate?.();
          return;
        }
        state.cronQuickCreateOpen = false;
        state.cronQuickCreateStep = "what";
        state.cronQuickCreateDraft = null;
        requestHostUpdate?.();
      })();
    },
    onCancel: () => {
      state.cronQuickCreateOpen = false;
      state.cronQuickCreateStep = "what";
      state.cronQuickCreateDraft = null;
      requestHostUpdate?.();
    },
  });
}

export function renderApp(state: AppViewState) {
  const updatableState = state as AppViewState & { requestUpdate?: () => void };
  const requestHostUpdate =
    typeof updatableState.requestUpdate === "function"
      ? () => updatableState.requestUpdate?.()
      : undefined;
  _pendingUpdate = requestHostUpdate;

  // Gate: require successful gateway connection before showing the dashboard.
  // The gateway URL confirmation overlay is always rendered so URL-param flows still work.
  if (!state.connected) {
    return html` ${renderLoginGate(state)} ${renderGatewayUrlConfirmation(state)} `;
  }

  const presenceCount = state.presenceEntries.length;
  const sessionsCount = state.sessionsResult?.count ?? null;
  const cronNext = state.cronStatus?.nextWakeAtMs ?? null;
  const chatDisabledReason = state.connected ? null : t("chat.disconnected");
  const isChat = state.tab === "chat";
  const chatFocus = isChat && (state.settings.chatFocusMode || state.onboarding);
  const navDrawerOpen = state.navDrawerOpen && !chatFocus && !state.onboarding;
  const navCollapsed = state.settings.navCollapsed && !navDrawerOpen;
  const showThinking = state.onboarding ? false : state.settings.chatShowThinking;
  const showToolCalls = state.onboarding ? true : state.settings.chatShowToolCalls;
  const assistantAvatarUrl = resolveAssistantAvatarUrl(state);
  const chatAvatarUrl = state.chatAvatarUrl ?? assistantAvatarUrl ?? null;
  const configValue =
    state.configForm ?? (state.configSnapshot?.config as Record<string, unknown> | null);
  const configuredDreaming = resolveConfiguredDreaming(configValue);
  const dreamingOn = state.dreamingStatus?.enabled ?? configuredDreaming.enabled;
  const dreamingNextCycle = resolveDreamingNextCycle(state.dreamingStatus);
  const dreamingLoading = state.dreamingStatusLoading || state.dreamingModeSaving;
  const dreamingRefreshLoading = state.dreamingStatusLoading || state.dreamDiaryLoading;
  const refreshDreaming = () => {
    void (async () => {
      await loadConfig(state);
      await Promise.all([
        loadDreamingStatus(state),
        loadDreamDiary(state),
        loadWikiImportInsights(state),
        loadWikiMemoryPalace(state),
      ]);
    })();
  };
  const openWikiPage = async (lookup: string) => {
    if (!state.client || !state.connected) {
      return null;
    }
    const payload = (await state.client.request("wiki.get", {
      lookup,
      fromLine: 1,
      lineCount: 5000,
    })) as {
      title?: unknown;
      path?: unknown;
      content?: unknown;
      updatedAt?: unknown;
      totalLines?: unknown;
      truncated?: unknown;
    } | null;
    const title =
      typeof payload?.title === "string" && payload.title.trim() ? payload.title.trim() : lookup;
    const path =
      typeof payload?.path === "string" && payload.path.trim() ? payload.path.trim() : lookup;
    const content =
      typeof payload?.content === "string" && payload.content.length > 0
        ? payload.content
        : "No wiki content available.";
    const updatedAt =
      typeof payload?.updatedAt === "string" && payload.updatedAt.trim()
        ? payload.updatedAt.trim()
        : undefined;
    const totalLines =
      typeof payload?.totalLines === "number" && Number.isFinite(payload.totalLines)
        ? Math.max(0, Math.floor(payload.totalLines))
        : undefined;
    const truncated = payload?.truncated === true;
    return {
      title,
      path,
      content,
      ...(totalLines !== undefined ? { totalLines } : {}),
      ...(truncated ? { truncated } : {}),
      ...(updatedAt ? { updatedAt } : {}),
    };
  };
  const applyDreamingEnabled = (enabled: boolean) => {
    if (state.dreamingModeSaving || dreamingOn === enabled) {
      return;
    }
    void (async () => {
      const updated = await updateDreamingEnabled(state, enabled);
      if (!updated) {
        return;
      }
      await loadConfig(state);
      await loadDreamingStatus(state);
    })();
  };
  const basePath = normalizeBasePath(state.basePath ?? "");
  const resolveSelectedAgentId = () =>
    state.agentsSelectedId ??
    state.agentsList?.defaultId ??
    state.agentsList?.agents?.[0]?.id ??
    null;
  const resolvedAgentId = resolveSelectedAgentId();
  const activeSessionAgentId = resolveAgentIdFromSessionKey(state.sessionKey);
  const toolsPanelUsesActiveSession = Boolean(
    resolvedAgentId && activeSessionAgentId && resolvedAgentId === activeSessionAgentId,
  );
  const getCurrentConfigValue = () =>
    state.configForm ?? (state.configSnapshot?.config as Record<string, unknown> | null);
  const findAgentIndex = (agentId: string) =>
    findAgentConfigEntryIndex(getCurrentConfigValue(), agentId);
  const ensureAgentIndex = (agentId: string) => ensureAgentConfigEntry(state, agentId);
  const resolveAgentToolsPath = (agentId: string, ensure: boolean) => {
    const index = ensure ? ensureAgentIndex(agentId) : findAgentIndex(agentId);
    return index >= 0 ? (["agents", "list", index, "tools"] as const) : null;
  };
  const resolveAgentModelFormEntry = (index: number) => {
    const list = (getCurrentConfigValue() as { agents?: { list?: unknown[] } } | null)?.agents
      ?.list;
    const existing = Array.isArray(list)
      ? (list[index] as { model?: unknown } | undefined)?.model
      : undefined;
    return {
      basePath: ["agents", "list", index, "model"] as Array<string | number>,
      existing,
    };
  };
  const cronAgentSuggestions = sortLocaleStrings(
    new Set(
      [
        ...(state.agentsList?.agents?.map((entry) => entry.id.trim()) ?? []),
        ...state.cronJobs
          .map((job) => (typeof job.agentId === "string" ? job.agentId.trim() : ""))
          .filter(Boolean),
      ].filter(Boolean),
    ),
  );
  const cronModelSuggestions = sortLocaleStrings(
    new Set(
      [
        ...state.cronModelSuggestions,
        ...resolveConfiguredCronModelSuggestions(configValue),
        ...state.cronJobs
          .map((job) => {
            if (job.payload.kind !== "agentTurn" || typeof job.payload.model !== "string") {
              return "";
            }
            return job.payload.model.trim();
          })
          .filter(Boolean),
      ].filter(Boolean),
    ),
  );
  const visibleCronJobs = getVisibleCronJobs(state);
  const selectedDeliveryChannel =
    state.cronForm.deliveryChannel && state.cronForm.deliveryChannel.trim()
      ? state.cronForm.deliveryChannel.trim()
      : "last";
  const jobToSuggestions = state.cronJobs
    .map((job) => normalizeSuggestionValue(job.delivery?.to))
    .filter(Boolean);
  const accountToSuggestions = (
    selectedDeliveryChannel === "last"
      ? Object.values(state.channelsSnapshot?.channelAccounts ?? {}).flat()
      : (state.channelsSnapshot?.channelAccounts?.[selectedDeliveryChannel] ?? [])
  )
    .flatMap((account) => [
      normalizeSuggestionValue(account.accountId),
      normalizeSuggestionValue(account.name),
    ])
    .filter(Boolean);
  const rawDeliveryToSuggestions = uniquePreserveOrder([
    ...jobToSuggestions,
    ...accountToSuggestions,
  ]);
  const accountSuggestions = uniquePreserveOrder(accountToSuggestions);
  const deliveryToSuggestions =
    state.cronForm.deliveryMode === "webhook"
      ? rawDeliveryToSuggestions.filter((value) => isHttpUrl(value))
      : rawDeliveryToSuggestions;
  const commonConfigProps = {
    raw: state.configRaw,
    originalRaw: state.configRawOriginal,
    valid: state.configValid,
    issues: state.configIssues,
    loading: state.configLoading,
    saving: state.configSaving,
    applying: state.configApplying,
    updating: state.updateRunning,
    connected: state.connected,
    schema: state.configSchema,
    schemaLoading: state.configSchemaLoading,
    uiHints: state.configUiHints,
    formValue: state.configForm,
    originalValue: state.configFormOriginal,
    onRawChange: (next: string) => {
      state.configRaw = next;
    },
    onRequestUpdate: requestHostUpdate,
    onFormPatch: (path: Array<string | number>, value: unknown) =>
      updateConfigFormValue(state, path, value),
    onReload: () => loadConfig(state),
    onSave: () => saveConfig(state),
    onApply: () => applyConfig(state),
    onUpdate: () => runUpdate(state),
    onOpenFile: () => openConfigFile(state),
    version: state.hello?.server?.version ?? "",
    theme: state.theme,
    themeMode: state.themeMode,
    setTheme: (theme, context) => state.setTheme(theme, context),
    setThemeMode: (mode, context) => state.setThemeMode(mode, context),
    borderRadius: state.settings.borderRadius,
    setBorderRadius: (value) => state.setBorderRadius(value),
    gatewayUrl: state.settings.gatewayUrl,
    assistantName: state.assistantName,
    configPath: state.configSnapshot?.path ?? null,
    rawAvailable: typeof state.configSnapshot?.raw === "string",
  } satisfies Omit<
    ConfigProps,
    | "formMode"
    | "searchQuery"
    | "activeSection"
    | "activeSubsection"
    | "onFormModeChange"
    | "onSearchChange"
    | "onSectionChange"
    | "onSubsectionChange"
    | "showModeToggle"
    | "navRootLabel"
    | "includeSections"
    | "excludeSections"
    | "includeVirtualSections"
  >;
  const renderConfigTab = (overrides: ConfigTabOverrides) =>
    renderConfig({
      ...commonConfigProps,
      includeVirtualSections: false,
      ...overrides,
    });
  const configSelection = normalizeMainConfigSelection(
    state.configActiveSection,
    state.configActiveSubsection,
  );
  const communicationsSelection = normalizeScopedConfigSelection(
    state.communicationsActiveSection,
    state.communicationsActiveSubsection,
    COMMUNICATION_SECTION_KEYS,
  );
  const appearanceSelection = normalizeScopedConfigSelection(
    state.appearanceActiveSection,
    state.appearanceActiveSubsection,
    APPEARANCE_SECTION_KEYS,
  );
  const automationSelection = normalizeScopedConfigSelection(
    state.automationActiveSection,
    state.automationActiveSubsection,
    AUTOMATION_SECTION_KEYS,
  );
  const infrastructureSelection = normalizeScopedConfigSelection(
    state.infrastructureActiveSection,
    state.infrastructureActiveSubsection,
    INFRASTRUCTURE_SECTION_KEYS,
  );
  const aiAgentsSelection = normalizeScopedConfigSelection(
    state.aiAgentsActiveSection,
    state.aiAgentsActiveSubsection,
    AI_AGENTS_SECTION_KEYS,
  );
  const renderConfigTabForActiveTab = () => {
    switch (state.tab) {
      case "config": {
        // Quick Settings mode — opinionated card layout
        if (state.configSettingsMode === "quick") {
          const configObj = state.configForm ?? state.configSnapshot?.config ?? {};
          const agentsDefaults = ((configObj.agents as Record<string, unknown> | undefined)
            ?.defaults ?? {}) as Record<string, unknown>;
          const activeSession = resolveQuickSettingsSessionRow(state);
          const currentModel =
            typeof activeSession?.model === "string"
              ? activeSession.model
              : (resolveModelPrimary(agentsDefaults.model) ?? "default");
          const thinkingLevel =
            typeof activeSession?.thinkingLevel === "string"
              ? activeSession.thinkingLevel
              : typeof agentsDefaults.thinkingLevel === "string"
                ? agentsDefaults.thinkingLevel
                : "off";
          const fastMode =
            typeof activeSession?.fastMode === "boolean"
              ? activeSession.fastMode
              : agentsDefaults.fastMode === true;
          return renderQuickSettings({
            currentModel,
            thinkingLevel,
            fastMode,
            onModelChange: () => {
              state.configSettingsMode = "advanced";
              state.tab = "aiAgents" as import("./navigation.ts").Tab;
              state.aiAgentsActiveSection = "models";
              requestHostUpdate?.();
            },
            onThinkingChange: (level) => {
              void patchSession(state, state.sessionKey, { thinkingLevel: level }).then(() =>
                requestHostUpdate?.(),
              );
            },
            onFastModeToggle: () => {
              void patchSession(state, state.sessionKey, { fastMode: !fastMode }).then(() =>
                requestHostUpdate?.(),
              );
            },
            channels: extractQuickSettingsChannels(state),
            onChannelConfigure: () => {
              state.tab = "communications" as import("./navigation.ts").Tab;
              state.communicationsActiveSection = "channels";
              requestHostUpdate?.();
            },
            apiKeys: extractQuickSettingsApiKeys(state),
            onApiKeyChange: () => {
              state.configSettingsMode = "advanced";
              state.configActiveSection = "env";
              requestHostUpdate?.();
            },
            remoteModelProviders: REMOTE_MODEL_PROVIDER_PRESETS,
            remoteModelImporting: state.remoteModelImporting,
            remoteModelImportMessage: state.remoteModelImportMessage,
            onRemoteModelImport: (draft) => {
              void applyQuickSettingsRemoteModelImport(state, draft).then(() =>
                requestHostUpdate?.(),
              );
            },
            automation: {
              cronJobCount: state.cronJobs?.length ?? 0,
              skillCount: state.skillsReport?.skills?.length ?? 0,
              mcpServerCount: extractMcpServerCount(state),
            },
            onManageCron: () => {
              state.tab = "cron" as import("./navigation.ts").Tab;
              requestHostUpdate?.();
            },
            onBrowseSkills: () => {
              state.tab = "skills" as import("./navigation.ts").Tab;
              requestHostUpdate?.();
            },
            onConfigureMcp: () => {
              state.tab = "infrastructure" as import("./navigation.ts").Tab;
              state.infrastructureActiveSection = "mcp";
              requestHostUpdate?.();
            },
            security: extractQuickSettingsSecurity(state),
            onSecurityConfigure: () => {
              state.configSettingsMode = "advanced";
              state.configActiveSection = "auth";
              requestHostUpdate?.();
            },
            theme: state.theme,
            themeMode: state.themeMode,
            borderRadius: state.settings.borderRadius,
            setTheme: (theme, context) => state.setTheme(theme, context),
            setThemeMode: (mode, context) => state.setThemeMode(mode, context),
            setBorderRadius: (value) => state.setBorderRadius(value),
            configObject: configObj,
            onApplyPreset: (presetId) => {
              void applyQuickSettingsPreset(state, presetId).then(() => requestHostUpdate?.());
            },
            onAdvancedSettings: () => {
              state.configSettingsMode = "advanced";
              requestHostUpdate?.();
            },
            connected: state.connected,
            gatewayUrl: state.settings.gatewayUrl,
            assistantName: state.assistantName,
            version: state.hello?.server?.version ?? "",
          });
        }
        // Advanced mode — full config form with accordion groups
        return renderConfigTab({
          formMode: state.configFormMode,
          searchQuery: state.configSearchQuery,
          activeSection: configSelection.activeSection,
          activeSubsection: configSelection.activeSubsection,
          onFormModeChange: (mode) => (state.configFormMode = mode),
          onSearchChange: (query) => (state.configSearchQuery = query),
          onSectionChange: (section) => {
            state.configActiveSection = section;
            state.configActiveSubsection = null;
          },
          onSubsectionChange: (section) => (state.configActiveSubsection = section),
          showModeToggle: true,
          settingsLayout: "accordion",
          onBackToQuick: () => {
            state.configSettingsMode = "quick";
            requestHostUpdate?.();
          },
          excludeSections: [
            ...COMMUNICATION_SECTION_KEYS,
            ...AUTOMATION_SECTION_KEYS,
            ...INFRASTRUCTURE_SECTION_KEYS,
            ...AI_AGENTS_SECTION_KEYS,
            "ui",
            "wizard",
          ],
        });
      }
      case "communications":
        return renderConfigTab({
          formMode: state.communicationsFormMode,
          searchQuery: state.communicationsSearchQuery,
          activeSection: communicationsSelection.activeSection,
          activeSubsection: communicationsSelection.activeSubsection,
          onFormModeChange: (mode) => (state.communicationsFormMode = mode),
          onSearchChange: (query) => (state.communicationsSearchQuery = query),
          onSectionChange: (section) => {
            state.communicationsActiveSection = section;
            state.communicationsActiveSubsection = null;
          },
          onSubsectionChange: (section) => (state.communicationsActiveSubsection = section),
          navRootLabel: "Communication",
          includeSections: [...COMMUNICATION_SECTION_KEYS],
        });
      case "appearance":
        return renderConfigTab({
          formMode: state.appearanceFormMode,
          searchQuery: state.appearanceSearchQuery,
          activeSection: appearanceSelection.activeSection,
          activeSubsection: appearanceSelection.activeSubsection,
          onFormModeChange: (mode) => (state.appearanceFormMode = mode),
          onSearchChange: (query) => (state.appearanceSearchQuery = query),
          onSectionChange: (section) => {
            state.appearanceActiveSection = section;
            state.appearanceActiveSubsection = null;
          },
          onSubsectionChange: (section) => (state.appearanceActiveSubsection = section),
          navRootLabel: t("tabs.appearance"),
          includeSections: [...APPEARANCE_SECTION_KEYS],
          includeVirtualSections: true,
        });
      case "automation":
        return renderConfigTab({
          formMode: state.automationFormMode,
          searchQuery: state.automationSearchQuery,
          activeSection: automationSelection.activeSection,
          activeSubsection: automationSelection.activeSubsection,
          onFormModeChange: (mode) => (state.automationFormMode = mode),
          onSearchChange: (query) => (state.automationSearchQuery = query),
          onSectionChange: (section) => {
            state.automationActiveSection = section;
            state.automationActiveSubsection = null;
          },
          onSubsectionChange: (section) => (state.automationActiveSubsection = section),
          navRootLabel: "Automation",
          includeSections: [...AUTOMATION_SECTION_KEYS],
        });
      case "infrastructure":
        return renderConfigTab({
          formMode: state.infrastructureFormMode,
          searchQuery: state.infrastructureSearchQuery,
          activeSection: infrastructureSelection.activeSection,
          activeSubsection: infrastructureSelection.activeSubsection,
          onFormModeChange: (mode) => (state.infrastructureFormMode = mode),
          onSearchChange: (query) => (state.infrastructureSearchQuery = query),
          onSectionChange: (section) => {
            state.infrastructureActiveSection = section;
            state.infrastructureActiveSubsection = null;
          },
          onSubsectionChange: (section) => (state.infrastructureActiveSubsection = section),
          navRootLabel: "Infrastructure",
          includeSections: [...INFRASTRUCTURE_SECTION_KEYS],
        });
      case "aiAgents":
        return renderConfigTab({
          formMode: state.aiAgentsFormMode,
          searchQuery: state.aiAgentsSearchQuery,
          activeSection: aiAgentsSelection.activeSection,
          activeSubsection: aiAgentsSelection.activeSubsection,
          onFormModeChange: (mode) => (state.aiAgentsFormMode = mode),
          onSearchChange: (query) => (state.aiAgentsSearchQuery = query),
          onSectionChange: (section) => {
            state.aiAgentsActiveSection = section;
            state.aiAgentsActiveSubsection = null;
          },
          onSubsectionChange: (section) => (state.aiAgentsActiveSubsection = section),
          navRootLabel: "AI & Agents",
          includeSections: [...AI_AGENTS_SECTION_KEYS],
        });
      default:
        return nothing;
    }
  };
  const loadAgentPanelDataForSelectedAgent = (agentId: string | null) => {
    if (!agentId) {
      return;
    }
    switch (state.agentsPanel) {
      case "files":
        void loadAgentFiles(state, agentId);
        return;
      case "skills":
        void loadAgentSkills(state, agentId);
        return;
      case "tools":
        void loadToolsCatalog(state, agentId);
        void refreshVisibleToolsEffectiveForCurrentSession(state);
        return;
      case "governance":
      {
        void loadGovernanceOverview(state);
        void loadGovernanceCapabilityInventory(state, {
          ...resolveGovernanceScopeAgentInput(agentId),
          ...resolveGovernanceWorkspaceScopeInput(),
        });
        void loadGovernanceGenesisAndMaybeTeam(agentId);
        void loadGovernanceProposals(state, resolveGovernanceProposalListInput());
        void loadGovernanceAgent(state, {
          agentId,
        });
        return;
      }
      case "autonomy":
      {
        const workspaceScopeInput = resolveAutonomyWorkspaceScopeInput();
        void loadAutonomyOverview(state, {
          sessionKey: state.sessionKey,
          ...workspaceScopeInput,
        });
        void loadAutonomyCapabilityInventory(state, {
          sessionKey: state.sessionKey,
          ...workspaceScopeInput,
        });
        void loadAutonomyGenesisPlan(state, {
          sessionKey: state.sessionKey,
          ...workspaceScopeInput,
        });
        void loadAutonomyHistory(state, {
          sessionKey: state.sessionKey,
          ...workspaceScopeInput,
          ...resolveAutonomyHistoryInput(),
        });
        void loadAutonomyProfile(state, {
          agentId,
          sessionKey: state.sessionKey,
        });
        return;
      }
    }
  };
  const refreshAgentsPanelSupplementalData = (panel: AppViewState["agentsPanel"]) => {
    if (panel === "channels") {
      void loadChannels(state, false);
      return;
    }
    if (panel === "cron") {
      void state.loadCron();
    }
  };
  const resetAgentFilesState = (clearLoading = false) => {
    state.agentFilesList = null;
    state.agentFilesError = null;
    state.agentFileActive = null;
    state.agentFileContents = {};
    state.agentFileDrafts = {};
    if (clearLoading) {
      state.agentFilesLoading = false;
    }
  };
  const resetAutonomyDraftState = () => {
    state.autonomyHistoryMode = "";
    state.autonomyHistorySource = "";
    state.autonomyHistoryLimit = "";
    state.autonomyGoal = "";
    state.autonomyControllerId = "";
    state.autonomyCurrentStep = "";
    state.autonomyNotifyPolicy = "";
    state.autonomyFlowStatus = "";
    state.autonomySeedTaskEnabled = true;
    state.autonomySeedTaskRuntime = "";
    state.autonomySeedTaskStatus = "";
    state.autonomySeedTaskLabel = "";
    state.autonomySeedTaskTask = "";
    state.autonomyReplayVerdict = "pass";
    state.autonomyReplayQaVerdict = "pass";
    state.autonomyReplayAuditVerdict = "pass";
    state.autonomyLoopEveryMinutes = "";
    state.autonomyWorkspaceScope = "";
    state.autonomyGovernanceReconcileMode = "apply_safe";
    state.autonomyGovernanceReconcileNote = "";
  };
  const primeGovernanceProposalCreateDraft = (agentId?: string, force = false) => {
    const normalizedAgentId = agentId?.trim() ?? "";
    if (force || !state.governanceProposalCreateByAgentId.trim()) {
      state.governanceProposalCreateByAgentId = normalizedAgentId;
    }
    if (force || !state.governanceProposalCreateBySessionKey.trim()) {
      state.governanceProposalCreateBySessionKey = normalizedAgentId
        ? buildAgentMainSessionKey({ agentId: normalizedAgentId })
        : state.sessionKey;
    }
    if (force || !state.governanceProposalOperationsJson.trim()) {
      state.governanceProposalOperationsJson =
        buildGovernanceProposalOperationsDraftTemplate(normalizedAgentId);
    }
  };
  const resetGovernanceProposalCreateDraft = (agentId?: string) => {
    state.governanceProposalCreateTitle = "";
    state.governanceProposalCreateRationale = "";
    state.governanceProposalCreateError = null;
    state.governanceProposalCreateResult = null;
    primeGovernanceProposalCreateDraft(agentId, true);
  };
  const resetGovernanceWorkbenchScopeDraft = () => {
    state.governanceProposalLimit = "";
    state.governanceScopeAgentIds = "";
    state.governanceScopeWorkspaceDirs = "";
    state.governanceGenesisTeamId = "";
  };
  const resolveAutonomyWorkspaceScopeInput = () => {
    const workspaceDirs = parseAutonomyWorkspaceDirsDraft(state.autonomyWorkspaceScope);
    return workspaceDirs.length > 0 ? { workspaceDirs } : {};
  };
  const resolveAutonomyOverviewWorkspaceDirs = (
    entries: Array<{
      workspaceDirs?: string[];
      primaryWorkspaceDir?: string | null;
    }>,
  ) =>
    Array.from(
      new Set(
        entries
          .flatMap((entry) => [
            ...(entry.workspaceDirs ?? []),
            ...(entry.primaryWorkspaceDir ? [entry.primaryWorkspaceDir] : []),
          ])
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ).toSorted((left, right) => left.localeCompare(right));
  const resolveAutonomyOverviewEntryWorkspaceScopeInput = (entry: {
    workspaceDirs?: string[];
    primaryWorkspaceDir?: string | null;
  }) => {
    const workspaceDirs = resolveAutonomyOverviewWorkspaceDirs([entry]);
    return workspaceDirs.length > 0 ? { workspaceDirs } : {};
  };
  const resolveAutonomyHistoryInput = () => {
    const historyLimit = parseAutonomyHistoryLimitDraft(state.autonomyHistoryLimit);
    return {
      ...(typeof historyLimit === "number" ? { limit: historyLimit } : {}),
      ...(state.autonomyHistoryMode ? { mode: state.autonomyHistoryMode } : {}),
      ...(state.autonomyHistorySource ? { source: state.autonomyHistorySource } : {}),
    };
  };
  const resolveAutonomyHistoryControlInput = () => {
    const historyLimit = parseAutonomyHistoryLimitDraft(state.autonomyHistoryLimit);
    return {
      ...(typeof historyLimit === "number" ? { historyLimit } : {}),
      ...(state.autonomyHistoryMode ? { historyMode: state.autonomyHistoryMode } : {}),
      ...(state.autonomyHistorySource ? { historySource: state.autonomyHistorySource } : {}),
    };
  };
  const resolveAutonomyGovernanceReconcileMode = () =>
    state.autonomyGovernanceReconcileMode === "force_apply_all"
      ? "force_apply_all"
      : "apply_safe";
  const resolveGovernanceScopeAgentIds = (fallbackAgentId?: string | null) => {
    const scopeAgentIds = parseGovernanceAgentIdsDraft(state.governanceScopeAgentIds);
    if (scopeAgentIds.length > 0) {
      return scopeAgentIds;
    }
    const normalizedFallbackAgentId = fallbackAgentId?.trim();
    return normalizedFallbackAgentId ? [normalizedFallbackAgentId] : undefined;
  };
  const resolveGovernanceScopeAgentInput = (fallbackAgentId?: string | null) => {
    const agentIds = resolveGovernanceScopeAgentIds(fallbackAgentId);
    return agentIds ? { agentIds } : {};
  };
  const resolveGovernanceWorkspaceScopeInput = () => {
    const workspaceDirs = parseGovernanceWorkspaceDirsDraft(state.governanceScopeWorkspaceDirs);
    return workspaceDirs.length > 0 ? { workspaceDirs } : {};
  };
  const resolveGovernanceGenesisTeamInput = () => {
    const teamId = state.governanceGenesisTeamId.trim();
    return teamId ? { teamId } : {};
  };
  const resolveGovernanceTeamId = () =>
    state.governanceGenesisTeamId.trim() ||
    state.governanceTeamResult?.teamId?.trim() ||
    state.governanceGenesisResult?.teamId?.trim() ||
    "";
  const refreshGovernanceTeamIfAvailable = () => {
    const teamId = resolveGovernanceTeamId();
    if (!teamId) {
      return Promise.resolve();
    }
    return loadGovernanceTeam(state, { teamId });
  };
  const loadGovernanceGenesisAndMaybeTeam = (fallbackAgentId?: string | null) =>
    loadGovernanceGenesisPlan(state, {
      ...resolveGovernanceScopeAgentInput(fallbackAgentId),
      ...resolveGovernanceGenesisTeamInput(),
      ...resolveGovernanceWorkspaceScopeInput(),
    }).then(() => refreshGovernanceTeamIfAvailable());
  const refreshGovernanceWorkbenchScopedData = (fallbackAgentId?: string | null) =>
    Promise.all([
      fallbackAgentId
        ? loadGovernanceCapabilityAssetRegistry(state, {
            ...resolveGovernanceScopeAgentInput(fallbackAgentId),
            ...resolveGovernanceWorkspaceScopeInput(),
          })
        : Promise.resolve(),
      fallbackAgentId
        ? loadGovernanceCapabilityInventory(state, {
            ...resolveGovernanceScopeAgentInput(fallbackAgentId),
            ...resolveGovernanceWorkspaceScopeInput(),
          })
        : Promise.resolve(),
      fallbackAgentId ? loadGovernanceGenesisAndMaybeTeam(fallbackAgentId) : Promise.resolve(),
      refreshGovernanceTeamIfAvailable(),
      loadGovernanceProposals(state, resolveGovernanceProposalListInput()),
    ]).then(() => undefined);
  const applyGovernanceWorkbenchScope = (params: {
    agentIds?: string[];
    workspaceDirs?: string[];
    teamId?: string | null;
  }) => {
    state.governanceScopeAgentIds = formatGovernanceAgentIdsDraft(params.agentIds);
    state.governanceScopeWorkspaceDirs = formatGovernanceWorkspaceDirsDraft(
      params.workspaceDirs,
    );
    state.governanceGenesisTeamId = params.teamId?.trim() ?? "";
    const selectedAgentId = resolvedAgentId ?? state.agentsSelectedId ?? null;
    return selectedAgentId ? refreshGovernanceWorkbenchScopedData(selectedAgentId) : Promise.resolve();
  };
  const seedGovernanceProposalDraft = (params: {
    title: string;
    rationale?: string | null;
    operations: Array<{ kind: string; path: string; content?: string }>;
    scopeAgentIds?: string[];
    scopeWorkspaceDirs?: string[];
    scopeTeamId?: string | null;
    createdByAgentId?: string | null;
  }) => {
    const createdByAgentId =
      params.createdByAgentId?.trim() ||
      resolvedAgentId?.trim() ||
      state.agentsSelectedId?.trim() ||
      state.governanceProposalOperator.trim() ||
      "founder";
    state.governanceProposalCreateTitle = params.title.trim();
    state.governanceProposalCreateRationale = params.rationale?.trim() ?? "";
    state.governanceProposalCreateByAgentId = createdByAgentId;
    state.governanceProposalCreateBySessionKey = buildAgentMainSessionKey({
      agentId: createdByAgentId,
    });
    state.governanceProposalOperationsJson = JSON.stringify(params.operations, null, 2);
    if (params.scopeAgentIds) {
      state.governanceScopeAgentIds = formatGovernanceAgentIdsDraft(params.scopeAgentIds);
    }
    if (params.scopeWorkspaceDirs) {
      state.governanceScopeWorkspaceDirs = formatGovernanceWorkspaceDirsDraft(
        params.scopeWorkspaceDirs,
      );
    }
    if (typeof params.scopeTeamId === "string") {
      state.governanceGenesisTeamId = params.scopeTeamId.trim();
    }
  };
  const refreshAutonomyAfterGovernanceMutation = () => {
    const shouldRefreshOverview =
      state.agentsPanel === "autonomy" || Boolean(state.autonomyOverviewResult);
    const shouldRefreshCapabilities =
      state.agentsPanel === "autonomy" || Boolean(state.autonomyCapabilitiesResult);
    const shouldRefreshGenesis =
      state.agentsPanel === "autonomy" || Boolean(state.autonomyGenesisResult);
    const shouldRefreshHistory =
      state.agentsPanel === "autonomy" || Boolean(state.autonomyHistoryResult);
    const shouldRefreshProfile =
      state.agentsPanel === "autonomy" || Boolean(state.autonomyResult);
    const selectedAutonomyAgentId = state.agentsSelectedId?.trim() || resolvedAgentId?.trim() || null;
    const tasks: Array<Promise<unknown>> = [];
    if (shouldRefreshOverview) {
      tasks.push(
        loadAutonomyOverview(state, {
          sessionKey: state.sessionKey,
          ...resolveAutonomyWorkspaceScopeInput(),
        }),
      );
    }
    if (shouldRefreshCapabilities) {
      tasks.push(
        loadAutonomyCapabilityInventory(state, {
          sessionKey: state.sessionKey,
          ...resolveAutonomyWorkspaceScopeInput(),
        }),
      );
    }
    if (shouldRefreshGenesis) {
      tasks.push(
        loadAutonomyGenesisPlan(state, {
          sessionKey: state.sessionKey,
          ...resolveAutonomyWorkspaceScopeInput(),
        }),
      );
    }
    if (shouldRefreshHistory) {
      tasks.push(
        loadAutonomyHistory(state, {
          sessionKey: state.sessionKey,
          ...resolveAutonomyWorkspaceScopeInput(),
          ...resolveAutonomyHistoryInput(),
        }),
      );
    }
    if (shouldRefreshProfile && selectedAutonomyAgentId) {
      tasks.push(
        loadAutonomyProfile(state, {
          agentId: selectedAutonomyAgentId,
          sessionKey: state.sessionKey,
        }),
      );
    }
    return tasks.length > 0 ? Promise.all(tasks).then(() => undefined) : Promise.resolve();
  };
  const resolveGovernanceProposalListInput = () => {
    const proposalLimit = parseGovernanceListLimitDraft(state.governanceProposalLimit);
    return {
      ...(state.governanceProposalStatusFilter
        ? { status: state.governanceProposalStatusFilter }
        : {}),
      ...(typeof proposalLimit === "number" ? { limit: proposalLimit } : {}),
    };
  };
  const resolveGovernanceProposalReconcileMode = () =>
    state.governanceProposalReconcileMode === "force_apply_all"
      ? "force_apply_all"
      : "apply_safe";
  const runAutonomyOverviewSuggestedAction = (
    entry: NonNullable<typeof state.autonomyOverviewResult>["overview"]["entries"][number],
  ) => {
    state.agentsSelectedId = entry.agentId;
    const workspaceScopeInput = resolveAutonomyOverviewEntryWorkspaceScopeInput(entry);
    switch (entry.suggestedAction) {
      case "reconcile_loop":
        return reconcileAutonomyLoops(state, {
          sessionKey: state.sessionKey,
          agentIds: [entry.agentId],
          ...workspaceScopeInput,
          ...resolveAutonomyHistoryControlInput(),
        });
      case "start_flow":
        return startAutonomyFlow(state, {
          agentId: entry.agentId,
          sessionKey: state.sessionKey,
          ...workspaceScopeInput,
        });
      case "inspect_flow":
      case "observe":
      default:
        return loadAutonomyProfile(state, {
          agentId: entry.agentId,
          sessionKey: state.sessionKey,
        });
    }
  };
  const runAutonomyOverviewSuggestedActionBatch = async (
    action: NonNullable<typeof state.autonomyOverviewResult>["overview"]["entries"][number]["suggestedAction"],
  ) => {
    const entries =
      state.autonomyOverviewResult?.overview.entries.filter(
        (entry) => entry.suggestedAction === action,
      ) ?? [];
    if (entries.length === 0) {
      return;
    }
    const previousSelectedAgentId =
      state.agentsSelectedId?.trim() || resolvedAgentId?.trim() || null;
    if (action === "reconcile_loop") {
      const workspaceDirs = resolveAutonomyOverviewWorkspaceDirs(entries);
      await reconcileAutonomyLoops(state, {
        sessionKey: state.sessionKey,
        agentIds: entries.map((entry) => entry.agentId),
        ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
        ...resolveAutonomyHistoryControlInput(),
      });
    } else {
      for (const entry of entries) {
        await runAutonomyOverviewSuggestedAction(entry);
      }
      await loadAutonomyOverview(state, {
        sessionKey: state.sessionKey,
        ...resolveAutonomyWorkspaceScopeInput(),
      });
      await loadAutonomyHistory(state, {
        sessionKey: state.sessionKey,
        ...resolveAutonomyWorkspaceScopeInput(),
        ...resolveAutonomyHistoryInput(),
      });
    }
    const restoreAgentId = previousSelectedAgentId ?? entries[0]?.agentId ?? null;
    if (restoreAgentId) {
      state.agentsSelectedId = restoreAgentId;
      await loadAutonomyProfile(state, {
        agentId: restoreAgentId,
        sessionKey: state.sessionKey,
      });
    }
  };
  const runGovernanceVisibleProposalBatch = async (
    action: "approve_pending" | "apply_approved" | "revert_applied",
  ) => {
    const visibleProposals = state.governanceProposalsResult?.proposals ?? [];
    const targetProposalIds = visibleProposals
      .filter((proposal) =>
        action === "approve_pending"
          ? proposal.status === "pending"
          : action === "apply_approved"
            ? proposal.status === "approved"
            : proposal.status === "applied" && !proposal.apply?.revertedAt,
      )
      .map((proposal) => proposal.id);
    if (targetProposalIds.length === 0) {
      return;
    }
    const governanceScopeInput = resolveGovernanceScopeAgentInput(resolvedAgentId);
    const governanceTeamInput = resolveGovernanceGenesisTeamInput();
    const governanceWorkspaceInput = resolveGovernanceWorkspaceScopeInput();
    const proposalListInput = resolveGovernanceProposalListInput();
    const operator = state.governanceProposalOperator.trim() || "human-architect";
    if (action === "approve_pending") {
      await reviewGovernanceProposalEntries(state, {
        proposalIds: targetProposalIds,
        decision: "approve",
        decidedBy: operator,
        ...(state.governanceProposalDecisionNote.trim()
          ? { decisionNote: state.governanceProposalDecisionNote.trim() }
          : {}),
        continueOnError: true,
        ...governanceScopeInput,
        ...governanceTeamInput,
        ...governanceWorkspaceInput,
        ...proposalListInput,
      });
    } else if (action === "apply_approved") {
      await applyGovernanceProposalEntries(state, {
        proposalIds: targetProposalIds,
        appliedBy: operator,
        continueOnError: true,
        ...governanceScopeInput,
        ...governanceTeamInput,
        ...governanceWorkspaceInput,
        ...proposalListInput,
      });
    } else {
      await revertGovernanceProposalEntries(state, {
        proposalIds: targetProposalIds,
        revertedBy: operator,
        continueOnError: true,
        ...governanceScopeInput,
        ...governanceTeamInput,
        ...governanceWorkspaceInput,
        ...proposalListInput,
      });
    }
    if (!state.governanceProposalActionError) {
      state.governanceProposalDecisionNote = "";
    }
    await refreshAutonomyAfterGovernanceMutation();
  };
  const resetAutonomyPanelState = (clearLoading = false) => {
    state.autonomyResult = null;
    state.autonomyResultKey = null;
    state.autonomyError = null;
    state.autonomyOverviewError = null;
    state.autonomyOverviewResult = null;
    state.autonomyCapabilitiesError = null;
    state.autonomyCapabilitiesResult = null;
    state.autonomyGenesisError = null;
    state.autonomyGenesisResult = null;
    state.autonomyHistoryError = null;
    state.autonomyHistoryResult = null;
    state.autonomyStartError = null;
    state.autonomyStartResult = null;
    state.autonomyCancelError = null;
    state.autonomyCancelResult = null;
    state.autonomyLoopError = null;
    state.autonomyLoopResult = null;
    state.autonomyHealError = null;
    state.autonomyGovernanceError = null;
    state.autonomyGovernanceResult = null;
    state.autonomyReconcileError = null;
    if (clearLoading) {
      state.autonomyLoading = false;
      state.autonomyLoadingKey = null;
      state.autonomyOverviewLoading = false;
      state.autonomyCapabilitiesLoading = false;
      state.autonomyGenesisLoading = false;
      state.autonomyHistoryLoading = false;
      state.autonomyStartBusy = false;
      state.autonomyStartBusyKey = null;
      state.autonomyCancelBusy = false;
      state.autonomyCancelBusyKey = null;
      state.autonomyLoopBusy = false;
      state.autonomyLoopBusyKey = null;
      state.autonomyHealBusy = false;
      state.autonomyGovernanceBusy = false;
      state.autonomyReconcileBusy = false;
    }
  };
  const resetGovernancePanelState = (clearLoading = false) => {
    resetGovernanceState(state, clearLoading);
  };
  const resetAgentSelectionPanelState = () => {
    resetAgentFilesState(true);
    state.agentSkillsReport = null;
    state.agentSkillsError = null;
    state.agentSkillsAgentId = null;
    state.toolsCatalogResult = null;
    state.toolsCatalogError = null;
    state.toolsCatalogLoading = false;
    resetToolsEffectiveState(state);
    resetGovernancePanelState(true);
    resetAutonomyPanelState(true);
    resetGovernanceWorkbenchScopeDraft();
    resetGovernanceProposalCreateDraft(state.agentsSelectedId ?? undefined);
    resetAutonomyDraftState();
  };

  return html`
    ${renderCommandPalette({
      open: state.paletteOpen,
      query: state.paletteQuery,
      activeIndex: state.paletteActiveIndex,
      onToggle: () => {
        state.paletteOpen = !state.paletteOpen;
      },
      onQueryChange: (q) => {
        state.paletteQuery = q;
      },
      onActiveIndexChange: (i) => {
        state.paletteActiveIndex = i;
      },
      onNavigate: (tab) => {
        state.setTab(tab as import("./navigation.ts").Tab);
      },
      onSlashCommand: (cmd) => {
        state.setTab("chat" as import("./navigation.ts").Tab);
        state.chatMessage = cmd.endsWith(" ") ? cmd : `${cmd} `;
      },
    })}
    <div
      class="shell ${isChat ? "shell--chat" : ""} ${chatFocus
        ? "shell--chat-focus"
        : ""} ${navCollapsed ? "shell--nav-collapsed" : ""} ${navDrawerOpen
        ? "shell--nav-drawer-open"
        : ""} ${state.onboarding ? "shell--onboarding" : ""}"
    >
      <button
        type="button"
        class="shell-nav-backdrop"
        aria-label="${t("nav.collapse")}"
        @click=${() => {
          state.navDrawerOpen = false;
        }}
      ></button>
      <header class="topbar">
        <div class="topnav-shell">
          <button
            type="button"
            class="topbar-nav-toggle"
            @click=${() => {
              state.navDrawerOpen = !navDrawerOpen;
            }}
            title="${navDrawerOpen ? t("nav.collapse") : t("nav.expand")}"
            aria-label="${navDrawerOpen ? t("nav.collapse") : t("nav.expand")}"
            aria-expanded=${navDrawerOpen}
          >
            <span class="nav-collapse-toggle__icon" aria-hidden="true">${icons.menu}</span>
          </button>
          <div class="topnav-shell__content">
            <dashboard-header .tab=${state.tab}></dashboard-header>
          </div>
          <div class="topnav-shell__actions">
            <button
              class="topbar-search"
              @click=${() => {
                state.paletteOpen = !state.paletteOpen;
              }}
              title="Search or jump to… (⌘K)"
              aria-label="Open command palette"
            >
              <span class="topbar-search__label">${t("common.search")}</span>
              <kbd class="topbar-search__kbd">⌘K</kbd>
            </button>
            <div class="topbar-status">
              ${isChat ? renderChatMobileToggle(state) : nothing}
              ${renderTopbarThemeModeToggle(state)}
            </div>
          </div>
        </div>
      </header>
      <div class="shell-nav">
        <aside class="sidebar ${navCollapsed ? "sidebar--collapsed" : ""}">
          <div class="sidebar-shell">
            <div class="sidebar-shell__header">
              <div class="sidebar-brand">
                ${navCollapsed
                  ? nothing
                  : html`
                      <img
                        class="sidebar-brand__logo"
                        src="${agentLogoUrl(basePath)}"
                        alt="OpenClaw"
                      />
                      <span class="sidebar-brand__copy">
                        <span class="sidebar-brand__eyebrow">${t("nav.control")}</span>
                        <span class="sidebar-brand__title">OpenClaw</span>
                      </span>
                    `}
              </div>
              <button
                type="button"
                class="nav-collapse-toggle"
                @click=${() =>
                  state.applySettings({
                    ...state.settings,
                    navCollapsed: !state.settings.navCollapsed,
                  })}
                title="${navCollapsed ? t("nav.expand") : t("nav.collapse")}"
                aria-label="${navCollapsed ? t("nav.expand") : t("nav.collapse")}"
              >
                <span class="nav-collapse-toggle__icon" aria-hidden="true"
                  >${navCollapsed ? icons.panelLeftOpen : icons.panelLeftClose}</span
                >
              </button>
            </div>
            <div class="sidebar-shell__body">
              <nav class="sidebar-nav">
                ${TAB_GROUPS.map((group) => {
                  const isGroupCollapsed = state.settings.navGroupsCollapsed[group.label] ?? false;
                  const hasActiveTab = group.tabs.some((tab) => tab === state.tab);
                  const showItems = navCollapsed || hasActiveTab || !isGroupCollapsed;

                  return html`
                    <section class="nav-section ${!showItems ? "nav-section--collapsed" : ""}">
                      ${!navCollapsed
                        ? html`
                            <button
                              class="nav-section__label"
                              @click=${() => {
                                const next = { ...state.settings.navGroupsCollapsed };
                                next[group.label] = !isGroupCollapsed;
                                state.applySettings({
                                  ...state.settings,
                                  navGroupsCollapsed: next,
                                });
                              }}
                              aria-expanded=${showItems}
                            >
                              <span class="nav-section__label-text"
                                >${t(`nav.${group.label}`)}</span
                              >
                              <span class="nav-section__chevron"> ${icons.chevronDown} </span>
                            </button>
                          `
                        : nothing}
                      <div class="nav-section__items">
                        ${group.tabs.map((tab) =>
                          renderTab(state, tab, { collapsed: navCollapsed }),
                        )}
                      </div>
                    </section>
                  `;
                })}
              </nav>
            </div>
            <div class="sidebar-shell__footer">
              <div class="sidebar-utility-group">
                <a
                  class="nav-item nav-item--external sidebar-utility-link"
                  href="https://docs.openclaw.ai"
                  target=${EXTERNAL_LINK_TARGET}
                  rel=${buildExternalLinkRel()}
                  title="${t("common.docs")} (opens in new tab)"
                >
                  <span class="nav-item__icon" aria-hidden="true">${icons.book}</span>
                  ${!navCollapsed
                    ? html`
                        <span class="nav-item__text">${t("common.docs")}</span>
                        <span class="nav-item__external-icon">${icons.externalLink}</span>
                      `
                    : nothing}
                </a>
                <div class="sidebar-mode-switch">${renderTopbarThemeModeToggle(state)}</div>
                ${(() => {
                  const version = state.hello?.server?.version ?? "";
                  return version
                    ? html`
                        <div class="sidebar-version" title=${`v${version}`}>
                          ${!navCollapsed
                            ? html`
                                <span class="sidebar-version__label">${t("common.version")}</span>
                                <span class="sidebar-version__text">v${version}</span>
                                ${renderSidebarConnectionStatus(state)}
                              `
                            : html` ${renderSidebarConnectionStatus(state)} `}
                        </div>
                      `
                    : nothing;
                })()}
              </div>
            </div>
          </div>
        </aside>
      </div>
      <main class="content ${isChat ? "content--chat" : ""}">
        ${state.updateAvailable &&
        state.updateAvailable.latestVersion !== state.updateAvailable.currentVersion &&
        !isUpdateBannerDismissed(state.updateAvailable)
          ? html`<div class="update-banner callout danger" role="alert">
              <strong>Update available:</strong> v${state.updateAvailable.latestVersion} (running
              v${state.updateAvailable.currentVersion}).
              <button
                class="btn btn--sm update-banner__btn"
                ?disabled=${state.updateRunning || !state.connected}
                @click=${() => runUpdate(state)}
              >
                ${state.updateRunning ? "Updating…" : "Update now"}
              </button>
              <button
                class="update-banner__close"
                type="button"
                title="Dismiss"
                aria-label="Dismiss update banner"
                @click=${() => {
                  dismissUpdateBanner(state.updateAvailable);
                  state.updateAvailable = null;
                }}
              >
                ${icons.x}
              </button>
            </div>`
          : nothing}
        ${state.tab === "config"
          ? nothing
          : html`<section class="content-header">
              <div>
                ${isChat
                  ? renderChatSessionSelect(state)
                  : html`<div class="page-title">${titleForTab(state.tab)}</div>`}
                ${isChat ? nothing : html`<div class="page-sub">${subtitleForTab(state.tab)}</div>`}
              </div>
              <div class="page-meta">
                ${state.tab === "dreams"
                  ? html`
                      <div class="dreaming-header-controls">
                        <button
                          class="btn btn--subtle btn--sm"
                          ?disabled=${dreamingLoading || state.dreamDiaryLoading}
                          @click=${refreshDreaming}
                        >
                          ${dreamingRefreshLoading
                            ? t("dreaming.header.refreshing")
                            : t("dreaming.header.refresh")}
                        </button>
                        <button
                          class="dreams__phase-toggle ${dreamingOn
                            ? "dreams__phase-toggle--on"
                            : ""}"
                          ?disabled=${dreamingLoading}
                          @click=${() => applyDreamingEnabled(!dreamingOn)}
                        >
                          <span class="dreams__phase-toggle-dot"></span>
                          <span class="dreams__phase-toggle-label">
                            ${dreamingOn ? t("dreaming.header.on") : t("dreaming.header.off")}
                          </span>
                        </button>
                      </div>
                    `
                  : nothing}
                ${state.lastError
                  ? html`<div class="pill danger">${state.lastError}</div>`
                  : nothing}
                ${isChat ? renderChatControls(state) : nothing}
              </div>
            </section>`}
        ${state.tab === "overview"
          ? renderOverview({
              connected: state.connected,
              hello: state.hello,
              settings: state.settings,
              password: state.password,
              lastError: state.lastError,
              lastErrorCode: state.lastErrorCode,
              presenceCount,
              sessionsCount,
              cronEnabled: state.cronStatus?.enabled ?? null,
              cronNext,
              lastChannelsRefresh: state.channelsLastSuccess,
              warnQueryToken,
              modelAuthStatus: state.modelAuthStatusResult,
              statusSummary: state.debugStatus,
              usageResult: state.usageResult,
              sessionsResult: state.sessionsResult,
              skillsReport: state.skillsReport,
              cronJobs: state.cronJobs,
              cronStatus: state.cronStatus,
              attentionItems: state.attentionItems,
              eventLog: state.eventLog,
              overviewLogLines: state.overviewLogLines,
              showGatewayToken: state.overviewShowGatewayToken,
              showGatewayPassword: state.overviewShowGatewayPassword,
              onSettingsChange: (next) => state.applySettings(next),
              onPasswordChange: (next) => (state.password = next),
              onSessionKeyChange: (next) => {
                state.sessionKey = next;
                state.chatMessage = "";
                state.chatMessages = [];
                state.chatToolMessages = [];
                state.chatStream = null;
                state.chatRunId = null;
                state.chatQueue = [];
                state.resetToolStream();
                state.applySettings({
                  ...state.settings,
                  sessionKey: next,
                  lastActiveSessionKey: next,
                });
              },
              onToggleGatewayTokenVisibility: () => {
                state.overviewShowGatewayToken = !state.overviewShowGatewayToken;
              },
              onToggleGatewayPasswordVisibility: () => {
                state.overviewShowGatewayPassword = !state.overviewShowGatewayPassword;
              },
              onConnect: () => state.connect(),
              onRefresh: () => state.loadOverview({ refresh: true }),
              onNavigate: (tab) => state.setTab(tab as import("./navigation.ts").Tab),
              onNavigateToGovernance: () => {
                const agentId =
                  state.agentsSelectedId ?? resolvedAgentId ?? state.agentsList?.defaultId ?? null;
                state.agentsPanel = "governance";
                if (agentId) {
                  state.agentsSelectedId = agentId;
                  primeGovernanceProposalCreateDraft(agentId);
                }
                state.setTab("agents" as import("./navigation.ts").Tab);
              },
              onNavigateToAutonomy: () => {
                const agentId =
                  state.agentsSelectedId ?? resolvedAgentId ?? state.agentsList?.defaultId ?? null;
                state.agentsPanel = "autonomy";
                if (agentId) {
                  state.agentsSelectedId = agentId;
                }
                state.setTab("agents" as import("./navigation.ts").Tab);
              },
              onRefreshLogs: () => state.loadOverview({ refresh: true }),
            })
          : nothing}
        ${state.tab === "channels"
          ? lazyRender(lazyChannels, (m) =>
              m.renderChannels({
                connected: state.connected,
                loading: state.channelsLoading,
                snapshot: state.channelsSnapshot,
                lastError: state.channelsError,
                lastSuccessAt: state.channelsLastSuccess,
                whatsappMessage: state.whatsappLoginMessage,
                whatsappQrDataUrl: state.whatsappLoginQrDataUrl,
                whatsappConnected: state.whatsappLoginConnected,
                whatsappBusy: state.whatsappBusy,
                configSchema: state.configSchema,
                configSchemaLoading: state.configSchemaLoading,
                configForm: state.configForm,
                configUiHints: state.configUiHints,
                configSaving: state.configSaving,
                configFormDirty: state.configFormDirty,
                nostrProfileFormState: state.nostrProfileFormState,
                nostrProfileAccountId: state.nostrProfileAccountId,
                onRefresh: (probe) => loadChannels(state, probe),
                onWhatsAppStart: (force) => state.handleWhatsAppStart(force),
                onWhatsAppWait: () => state.handleWhatsAppWait(),
                onWhatsAppLogout: () => state.handleWhatsAppLogout(),
                onConfigPatch: (path, value) => updateConfigFormValue(state, path, value),
                onConfigSave: () => state.handleChannelConfigSave(),
                onConfigReload: () => state.handleChannelConfigReload(),
                onNostrProfileEdit: (accountId, profile) =>
                  state.handleNostrProfileEdit(accountId, profile),
                onNostrProfileCancel: () => state.handleNostrProfileCancel(),
                onNostrProfileFieldChange: (field, value) =>
                  state.handleNostrProfileFieldChange(field, value),
                onNostrProfileSave: () => state.handleNostrProfileSave(),
                onNostrProfileImport: () => state.handleNostrProfileImport(),
                onNostrProfileToggleAdvanced: () => state.handleNostrProfileToggleAdvanced(),
              }),
            )
          : nothing}
        ${state.tab === "instances"
          ? lazyRender(lazyInstances, (m) =>
              m.renderInstances({
                loading: state.presenceLoading,
                entries: state.presenceEntries,
                lastError: state.presenceError,
                statusMessage: state.presenceStatus,
                onRefresh: () => loadPresence(state),
              }),
            )
          : nothing}
        ${state.tab === "sessions"
          ? lazyRender(lazySessions, (m) =>
              m.renderSessions({
                loading: state.sessionsLoading,
                result: state.sessionsResult,
                error: state.sessionsError,
                activeMinutes: state.sessionsFilterActive,
                limit: state.sessionsFilterLimit,
                includeGlobal: state.sessionsIncludeGlobal,
                includeUnknown: state.sessionsIncludeUnknown,
                basePath: state.basePath,
                searchQuery: state.sessionsSearchQuery,
                sortColumn: state.sessionsSortColumn,
                sortDir: state.sessionsSortDir,
                page: state.sessionsPage,
                pageSize: state.sessionsPageSize,
                selectedKeys: state.sessionsSelectedKeys,
                expandedCheckpointKey: state.sessionsExpandedCheckpointKey,
                checkpointItemsByKey: state.sessionsCheckpointItemsByKey,
                checkpointLoadingKey: state.sessionsCheckpointLoadingKey,
                checkpointBusyKey: state.sessionsCheckpointBusyKey,
                checkpointErrorByKey: state.sessionsCheckpointErrorByKey,
                onFiltersChange: (next) => {
                  state.sessionsFilterActive = next.activeMinutes;
                  state.sessionsFilterLimit = next.limit;
                  state.sessionsIncludeGlobal = next.includeGlobal;
                  state.sessionsIncludeUnknown = next.includeUnknown;
                },
                onSearchChange: (q) => {
                  state.sessionsSearchQuery = q;
                  state.sessionsPage = 0;
                },
                onSortChange: (col, dir) => {
                  state.sessionsSortColumn = col;
                  state.sessionsSortDir = dir;
                  state.sessionsPage = 0;
                },
                onPageChange: (p) => {
                  state.sessionsPage = p;
                },
                onPageSizeChange: (s) => {
                  state.sessionsPageSize = s;
                  state.sessionsPage = 0;
                },
                onRefresh: () => loadSessions(state),
                onPatch: (key, patch) => patchSession(state, key, patch),
                onToggleSelect: (key) => {
                  const next = new Set(state.sessionsSelectedKeys);
                  if (next.has(key)) {
                    next.delete(key);
                  } else {
                    next.add(key);
                  }
                  state.sessionsSelectedKeys = next;
                },
                onSelectPage: (keys) => {
                  const next = new Set(state.sessionsSelectedKeys);
                  for (const k of keys) {
                    next.add(k);
                  }
                  state.sessionsSelectedKeys = next;
                },
                onDeselectPage: (keys) => {
                  const next = new Set(state.sessionsSelectedKeys);
                  for (const k of keys) {
                    next.delete(k);
                  }
                  state.sessionsSelectedKeys = next;
                },
                onDeselectAll: () => {
                  state.sessionsSelectedKeys = new Set();
                },
                onDeleteSelected: async () => {
                  const keys = [...state.sessionsSelectedKeys];
                  const deleted = await deleteSessionsAndRefresh(state, keys);
                  if (deleted.length > 0) {
                    const next = new Set(state.sessionsSelectedKeys);
                    for (const k of deleted) {
                      next.delete(k);
                    }
                    state.sessionsSelectedKeys = next;
                  }
                },
                onNavigateToChat: (sessionKey) => {
                  switchChatSession(state, sessionKey);
                  state.setTab("chat" as import("./navigation.ts").Tab);
                },
                onToggleCheckpointDetails: (sessionKey) =>
                  toggleSessionCompactionCheckpoints(state, sessionKey),
                onBranchFromCheckpoint: async (sessionKey, checkpointId) => {
                  const nextKey = await branchSessionFromCheckpoint(
                    state,
                    sessionKey,
                    checkpointId,
                  );
                  if (nextKey) {
                    switchChatSession(state, nextKey);
                    state.setTab("chat" as import("./navigation.ts").Tab);
                  }
                },
                onRestoreCheckpoint: (sessionKey, checkpointId) =>
                  restoreSessionFromCheckpoint(state, sessionKey, checkpointId),
              }),
            )
          : nothing}
        ${renderUsageTab(state)}
        ${state.tab === "cron" ? renderCronQuickCreateForTab(state, requestHostUpdate) : nothing}
        ${state.tab === "cron"
          ? lazyRender(lazyCron, (m) =>
              m.renderCron({
                basePath: state.basePath,
                loading: state.cronLoading,
                status: state.cronStatus,
                jobs: visibleCronJobs,
                jobsLoadingMore: state.cronJobsLoadingMore,
                jobsTotal: state.cronJobsTotal,
                jobsHasMore: state.cronJobsHasMore,
                jobsQuery: state.cronJobsQuery,
                jobsEnabledFilter: state.cronJobsEnabledFilter,
                jobsScheduleKindFilter: state.cronJobsScheduleKindFilter,
                jobsLastStatusFilter: state.cronJobsLastStatusFilter,
                jobsSortBy: state.cronJobsSortBy,
                jobsSortDir: state.cronJobsSortDir,
                editingJobId: state.cronEditingJobId,
                error: state.cronError,
                busy: state.cronBusy,
                form: state.cronForm,
                channels: state.channelsSnapshot?.channelMeta?.length
                  ? state.channelsSnapshot.channelMeta.map((entry) => entry.id)
                  : (state.channelsSnapshot?.channelOrder ?? []),
                channelLabels: state.channelsSnapshot?.channelLabels ?? {},
                channelMeta: state.channelsSnapshot?.channelMeta ?? [],
                runsJobId: state.cronRunsJobId,
                runs: state.cronRuns,
                runsTotal: state.cronRunsTotal,
                runsHasMore: state.cronRunsHasMore,
                runsLoadingMore: state.cronRunsLoadingMore,
                runsScope: state.cronRunsScope,
                runsStatuses: state.cronRunsStatuses,
                runsDeliveryStatuses: state.cronRunsDeliveryStatuses,
                runsStatusFilter: state.cronRunsStatusFilter,
                runsQuery: state.cronRunsQuery,
                runsSortDir: state.cronRunsSortDir,
                fieldErrors: state.cronFieldErrors,
                canSubmit: !hasCronFormErrors(state.cronFieldErrors),
                agentSuggestions: cronAgentSuggestions,
                modelSuggestions: cronModelSuggestions,
                thinkingSuggestions: CRON_THINKING_SUGGESTIONS,
                timezoneSuggestions: CRON_TIMEZONE_SUGGESTIONS,
                deliveryToSuggestions,
                accountSuggestions,
                onFormChange: (patch) => {
                  state.cronForm = normalizeCronFormState({ ...state.cronForm, ...patch });
                  state.cronFieldErrors = validateCronForm(state.cronForm);
                },
                onRefresh: () => state.loadCron(),
                onAdd: () => addCronJob(state),
                onEdit: (job) => startCronEdit(state, job),
                onClone: (job) => startCronClone(state, job),
                onCancelEdit: () => cancelCronEdit(state),
                onToggle: (job, enabled) => toggleCronJob(state, job, enabled),
                onRun: (job, mode) => runCronJob(state, job, mode ?? "force"),
                onRemove: (job) => removeCronJob(state, job),
                onQuickCreate: () => {
                  state.cronQuickCreateOpen = true;
                  state.cronQuickCreateStep = "what";
                  state.cronQuickCreateDraft = createDefaultDraft();
                  requestHostUpdate?.();
                },
                onLoadRuns: async (jobId) => {
                  updateCronRunsFilter(state, { cronRunsScope: "job" });
                  await loadCronRuns(state, jobId);
                },
                onLoadMoreJobs: () => loadCronJobsPage(state, { append: true }),
                onJobsFiltersChange: async (patch) => {
                  updateCronJobsFilter(state, patch);
                  const shouldReload =
                    typeof patch.cronJobsQuery === "string" ||
                    Boolean(patch.cronJobsEnabledFilter) ||
                    Boolean(patch.cronJobsSortBy) ||
                    Boolean(patch.cronJobsSortDir);
                  if (shouldReload) {
                    await loadCronJobsPage(state, { append: false });
                  }
                },
                onJobsFiltersReset: async () => {
                  updateCronJobsFilter(state, {
                    cronJobsQuery: "",
                    cronJobsEnabledFilter: "all",
                    cronJobsScheduleKindFilter: "all",
                    cronJobsLastStatusFilter: "all",
                    cronJobsSortBy: "nextRunAtMs",
                    cronJobsSortDir: "asc",
                  });
                  await loadCronJobsPage(state, { append: false });
                },
                onLoadMoreRuns: () => loadMoreCronRuns(state),
                onRunsFiltersChange: async (patch) => {
                  updateCronRunsFilter(state, patch);
                  if (state.cronRunsScope === "all") {
                    await loadCronRuns(state, null);
                    return;
                  }
                  await loadCronRuns(state, state.cronRunsJobId);
                },
                onNavigateToChat: (sessionKey) => {
                  switchChatSession(state, sessionKey);
                  state.setTab("chat" as import("./navigation.ts").Tab);
                },
              }),
            )
          : nothing}
        ${state.tab === "agents"
          ? lazyRender(lazyAgents, (m) =>
              m.renderAgents({
                basePath: state.basePath ?? "",
                loading: state.agentsLoading,
                error: state.agentsError,
                agentsList: state.agentsList,
                selectedAgentId: resolvedAgentId,
                activePanel: state.agentsPanel,
                config: {
                  form: configValue,
                  loading: state.configLoading,
                  saving: state.configSaving,
                  dirty: state.configFormDirty,
                },
                channels: {
                  snapshot: state.channelsSnapshot,
                  loading: state.channelsLoading,
                  error: state.channelsError,
                  lastSuccess: state.channelsLastSuccess,
                },
                cron: {
                  status: state.cronStatus,
                  jobs: state.cronJobs,
                  loading: state.cronLoading,
                  error: state.cronError,
                },
                agentFiles: {
                  list: state.agentFilesList,
                  loading: state.agentFilesLoading,
                  error: state.agentFilesError,
                  active: state.agentFileActive,
                  contents: state.agentFileContents,
                  drafts: state.agentFileDrafts,
                  saving: state.agentFileSaving,
                },
                agentIdentityLoading: state.agentIdentityLoading,
                agentIdentityError: state.agentIdentityError,
                agentIdentityById: state.agentIdentityById,
                agentSkills: {
                  report: state.agentSkillsReport,
                  loading: state.agentSkillsLoading,
                  error: state.agentSkillsError,
                  agentId: state.agentSkillsAgentId,
                  filter: state.skillsFilter,
                },
                governance: {
                  overviewLoading: state.governanceOverviewLoading,
                  overviewError: state.governanceOverviewError,
                  overviewResult: state.governanceOverviewResult,
                  assetRegistryLoading: state.governanceAssetRegistryLoading,
                  assetRegistryError: state.governanceAssetRegistryError,
                  assetRegistryResult: state.governanceAssetRegistryResult,
                  capabilitiesLoading: state.governanceCapabilitiesLoading,
                  capabilitiesError: state.governanceCapabilitiesError,
                  capabilitiesResult: state.governanceCapabilitiesResult,
                  genesisLoading: state.governanceGenesisLoading,
                  genesisError: state.governanceGenesisError,
                  genesisResult: state.governanceGenesisResult,
                  agentLoading: state.governanceAgentLoading,
                  agentError: state.governanceAgentError,
                  agentResult: state.governanceAgentResult,
                  teamLoading: state.governanceTeamLoading,
                  teamError: state.governanceTeamError,
                  teamResult: state.governanceTeamResult,
                  proposalsLoading: state.governanceProposalsLoading,
                  proposalsError: state.governanceProposalsError,
                  proposalsResult: state.governanceProposalsResult,
                  proposalSynthesizeBusy: state.governanceProposalSynthesizeBusy,
                  proposalSynthesizeError: state.governanceProposalSynthesizeError,
                  proposalSynthesizeResult: state.governanceProposalSynthesizeResult,
                  proposalReconcileBusy: state.governanceProposalReconcileBusy,
                  proposalReconcileError: state.governanceProposalReconcileError,
                  proposalReconcileResult: state.governanceProposalReconcileResult,
                  proposalCreateBusy: state.governanceProposalCreateBusy,
                  proposalCreateError: state.governanceProposalCreateError,
                  proposalCreateResult: state.governanceProposalCreateResult,
                  proposalActionBusyId: state.governanceProposalActionBusyId,
                  proposalActionError: state.governanceProposalActionError,
                },
                autonomy: {
                  loading: state.autonomyLoading,
                  error: state.autonomyError,
                  result: state.autonomyResult,
                  overviewLoading: state.autonomyOverviewLoading,
                  overviewError: state.autonomyOverviewError,
                  overviewResult: state.autonomyOverviewResult,
                  capabilitiesLoading: state.autonomyCapabilitiesLoading,
                  capabilitiesError: state.autonomyCapabilitiesError,
                  capabilitiesResult: state.autonomyCapabilitiesResult,
                  genesisLoading: state.autonomyGenesisLoading,
                  genesisError: state.autonomyGenesisError,
                  genesisResult: state.autonomyGenesisResult,
                  historyLoading: state.autonomyHistoryLoading,
                  historyError: state.autonomyHistoryError,
                  historyResult: state.autonomyHistoryResult,
                  startBusy: state.autonomyStartBusy,
                  startError: state.autonomyStartError,
                  replayBusy: state.autonomyReplayBusy,
                  replayError: state.autonomyReplayError,
                  replayResult: state.autonomyReplayResult,
                  cancelBusy: state.autonomyCancelBusy,
                  cancelError: state.autonomyCancelError,
                  loopBusy: state.autonomyLoopBusy,
                  loopError: state.autonomyLoopError,
                  healBusy: state.autonomyHealBusy,
                  healError: state.autonomyHealError,
                  superviseBusy: state.autonomySuperviseBusy,
                  superviseError: state.autonomySuperviseError,
                  superviseResult: state.autonomySuperviseResult,
                  governanceBusy: state.autonomyGovernanceBusy,
                  governanceError: state.autonomyGovernanceError,
                  governanceResult: state.autonomyGovernanceResult,
                  governanceReconcileBusy: state.autonomyGovernanceReconcileBusy,
                  governanceReconcileError: state.autonomyGovernanceReconcileError,
                  governanceReconcileResult: state.autonomyGovernanceReconcileResult,
                  reconcileBusy: state.autonomyReconcileBusy,
                  reconcileError: state.autonomyReconcileError,
                },
                toolsCatalog: {
                  loading: state.toolsCatalogLoading,
                  error: state.toolsCatalogError,
                  result: state.toolsCatalogResult,
                },
                toolsEffective: {
                  loading: state.toolsEffectiveLoading,
                  error: state.toolsEffectiveError,
                  result: state.toolsEffectiveResult,
                },
                runtimeSessionKey: state.sessionKey,
                runtimeSessionMatchesSelectedAgent: toolsPanelUsesActiveSession,
                modelCatalog: state.chatModelCatalog ?? [],
                onRefresh: async () => {
                  await loadAgents(state);
                  const agentIds = state.agentsList?.agents?.map((entry) => entry.id) ?? [];
                  if (agentIds.length > 0) {
                    void loadAgentIdentities(state, agentIds);
                  }
                  loadAgentPanelDataForSelectedAgent(resolveSelectedAgentId());
                  refreshAgentsPanelSupplementalData(state.agentsPanel);
                },
                onSelectAgent: (agentId) => {
                  if (state.agentsSelectedId === agentId) {
                    return;
                  }
                  state.agentsSelectedId = agentId;
                  resetAgentSelectionPanelState();
                  void loadAgentIdentity(state, agentId);
                  loadAgentPanelDataForSelectedAgent(agentId);
                },
                onSelectPanel: (panel) => {
                  state.agentsPanel = panel;
                  if (
                    panel === "files" &&
                    resolvedAgentId &&
                    state.agentFilesList?.agentId !== resolvedAgentId
                  ) {
                    resetAgentFilesState();
                    void loadAgentFiles(state, resolvedAgentId);
                  }
                  if (panel === "skills" && resolvedAgentId) {
                    void loadAgentSkills(state, resolvedAgentId);
                  }
                  if (panel === "tools" && resolvedAgentId) {
                    if (
                      state.toolsCatalogResult?.agentId !== resolvedAgentId ||
                      state.toolsCatalogError
                    ) {
                      void loadToolsCatalog(state, resolvedAgentId);
                    }
                    if (resolvedAgentId === resolveAgentIdFromSessionKey(state.sessionKey)) {
                      const toolsRequestKey = buildToolsEffectiveRequestKey(state, {
                        agentId: resolvedAgentId,
                        sessionKey: state.sessionKey,
                      });
                      if (
                        state.toolsEffectiveResultKey !== toolsRequestKey ||
                        state.toolsEffectiveError
                      ) {
                        void loadToolsEffective(state, {
                          agentId: resolvedAgentId,
                          sessionKey: state.sessionKey,
                        });
                      }
                    } else {
                      resetToolsEffectiveState(state);
                    }
                  }
                  if (panel === "governance" && resolvedAgentId) {
                    primeGovernanceProposalCreateDraft(resolvedAgentId);
                    if (!state.governanceOverviewResult || state.governanceOverviewError) {
                      void loadGovernanceOverview(state);
                    }
                    if (
                      !state.governanceAssetRegistryResult ||
                      state.governanceAssetRegistryError
                    ) {
                      void loadGovernanceCapabilityAssetRegistry(state, {
                        ...resolveGovernanceScopeAgentInput(resolvedAgentId),
                        ...resolveGovernanceWorkspaceScopeInput(),
                      });
                    }
                    if (!state.governanceCapabilitiesResult || state.governanceCapabilitiesError) {
                      void loadGovernanceCapabilityInventory(state, {
                        ...resolveGovernanceScopeAgentInput(resolvedAgentId),
                        ...resolveGovernanceWorkspaceScopeInput(),
                      });
                    }
                    if (!state.governanceGenesisResult || state.governanceGenesisError) {
                      void loadGovernanceGenesisAndMaybeTeam(resolvedAgentId);
                    } else if (
                      state.governanceTeamError ||
                      state.governanceTeamResult?.teamId !== resolveGovernanceTeamId()
                    ) {
                      void refreshGovernanceTeamIfAvailable();
                    }
                    if (!state.governanceProposalsResult || state.governanceProposalsError) {
                      void loadGovernanceProposals(state, resolveGovernanceProposalListInput());
                    }
                    if (
                      state.governanceAgentResult?.agentId !== resolvedAgentId ||
                      state.governanceAgentError
                    ) {
                      void loadGovernanceAgent(state, {
                        agentId: resolvedAgentId,
                      });
                    }
                  }
                  if (panel === "autonomy" && resolvedAgentId) {
                    const autonomyWorkspaceScopeInput = resolveAutonomyWorkspaceScopeInput();
                    const autonomyHistoryInput = resolveAutonomyHistoryInput();
                    if (!state.autonomyOverviewResult || state.autonomyOverviewError) {
                      void loadAutonomyOverview(state, {
                        sessionKey: state.sessionKey,
                        ...autonomyWorkspaceScopeInput,
                      });
                    }
                    if (!state.autonomyCapabilitiesResult || state.autonomyCapabilitiesError) {
                      void loadAutonomyCapabilityInventory(state, {
                        sessionKey: state.sessionKey,
                        ...autonomyWorkspaceScopeInput,
                      });
                    }
                    if (!state.autonomyGenesisResult || state.autonomyGenesisError) {
                      void loadAutonomyGenesisPlan(state, {
                        sessionKey: state.sessionKey,
                        ...autonomyWorkspaceScopeInput,
                      });
                    }
                    if (!state.autonomyHistoryResult || state.autonomyHistoryError) {
                      void loadAutonomyHistory(state, {
                        sessionKey: state.sessionKey,
                        ...autonomyWorkspaceScopeInput,
                        ...autonomyHistoryInput,
                      });
                    }
                    const autonomyRequestKey = buildAutonomyRequestKey({
                      agentId: resolvedAgentId,
                      sessionKey: resolveAutonomySessionKey({
                        agentId: resolvedAgentId,
                        sessionKey: state.sessionKey,
                      }),
                    });
                    if (
                      state.autonomyResultKey !== autonomyRequestKey ||
                      state.autonomyError
                    ) {
                      void loadAutonomyProfile(state, {
                        agentId: resolvedAgentId,
                        sessionKey: state.sessionKey,
                      });
                    }
                  }
                  refreshAgentsPanelSupplementalData(panel);
                },
                onLoadFiles: (agentId) => loadAgentFiles(state, agentId),
                onSelectFile: (name) => {
                  state.agentFileActive = name;
                  if (!resolvedAgentId) {
                    return;
                  }
                  void loadAgentFileContent(state, resolvedAgentId, name);
                },
                onFileDraftChange: (name, content) => {
                  state.agentFileDrafts = { ...state.agentFileDrafts, [name]: content };
                },
                onFileReset: (name) => {
                  const base = state.agentFileContents[name] ?? "";
                  state.agentFileDrafts = { ...state.agentFileDrafts, [name]: base };
                },
                onFileSave: (name) => {
                  if (!resolvedAgentId) {
                    return;
                  }
                  const content =
                    state.agentFileDrafts[name] ?? state.agentFileContents[name] ?? "";
                  void saveAgentFile(state, resolvedAgentId, name, content);
                },
                onToolsProfileChange: (agentId, profile, clearAllow) => {
                  const basePath = resolveAgentToolsPath(agentId, Boolean(profile || clearAllow));
                  if (!basePath) {
                    return;
                  }
                  if (profile) {
                    updateConfigFormValue(state, [...basePath, "profile"], profile);
                  } else {
                    removeConfigFormValue(state, [...basePath, "profile"]);
                  }
                  if (clearAllow) {
                    removeConfigFormValue(state, [...basePath, "allow"]);
                  }
                },
                onToolsOverridesChange: (agentId, alsoAllow, deny) => {
                  const basePath = resolveAgentToolsPath(
                    agentId,
                    alsoAllow.length > 0 || deny.length > 0,
                  );
                  if (!basePath) {
                    return;
                  }
                  if (alsoAllow.length > 0) {
                    updateConfigFormValue(state, [...basePath, "alsoAllow"], alsoAllow);
                  } else {
                    removeConfigFormValue(state, [...basePath, "alsoAllow"]);
                  }
                  if (deny.length > 0) {
                    updateConfigFormValue(state, [...basePath, "deny"], deny);
                  } else {
                    removeConfigFormValue(state, [...basePath, "deny"]);
                  }
                },
                onConfigReload: () => loadConfig(state),
                onConfigSave: () => saveAgentsConfig(state),
                onChannelsRefresh: () => loadChannels(state, false),
                onCronRefresh: () => state.loadCron(),
                onCronRunNow: (jobId) => {
                  const job = state.cronJobs.find((entry) => entry.id === jobId);
                  if (!job) {
                    return;
                  }
                  void runCronJob(state, job, "force");
                },
                onGovernanceOverviewRefresh: () =>
                  Promise.all([
                    loadGovernanceOverview(state),
                    ...(resolvedAgentId
                      ? [
                          loadGovernanceCapabilityAssetRegistry(state, {
                            ...resolveGovernanceScopeAgentInput(resolvedAgentId),
                            ...resolveGovernanceWorkspaceScopeInput(),
                          }),
                          loadGovernanceCapabilityInventory(state, {
                            ...resolveGovernanceScopeAgentInput(resolvedAgentId),
                            ...resolveGovernanceWorkspaceScopeInput(),
                          }),
                          loadGovernanceGenesisAndMaybeTeam(resolvedAgentId),
                        ]
                      : []),
                    refreshGovernanceTeamIfAvailable(),
                    loadGovernanceProposals(state, resolveGovernanceProposalListInput()),
                  ]).then(() => undefined),
                onGovernanceAssetRegistryRefresh: () =>
                  resolvedAgentId
                    ? loadGovernanceCapabilityAssetRegistry(state, {
                        ...resolveGovernanceScopeAgentInput(resolvedAgentId),
                        ...resolveGovernanceWorkspaceScopeInput(),
                      })
                    : Promise.resolve(),
                onGovernanceCapabilitiesRefresh: () =>
                  resolvedAgentId
                    ? loadGovernanceCapabilityInventory(state, {
                        ...resolveGovernanceScopeAgentInput(resolvedAgentId),
                        ...resolveGovernanceWorkspaceScopeInput(),
                      })
                    : Promise.resolve(),
                onGovernanceScopeUseCapabilities: () =>
                  state.governanceCapabilitiesResult
                    ? applyGovernanceWorkbenchScope({
                        agentIds: state.governanceCapabilitiesResult.requestedAgentIds,
                        workspaceDirs: state.governanceCapabilitiesResult.workspaceDirs,
                        teamId: state.governanceGenesisResult?.teamId ?? state.governanceTeamResult?.teamId,
                      })
                    : Promise.resolve(),
                onGovernanceScopeUseGenesis: () =>
                  state.governanceGenesisResult
                    ? applyGovernanceWorkbenchScope({
                        agentIds: state.governanceGenesisResult.requestedAgentIds,
                        workspaceDirs: state.governanceGenesisResult.workspaceDirs,
                        teamId: state.governanceGenesisResult.teamId,
                      })
                    : Promise.resolve(),
                onGovernanceWorkbenchScopeReset: () => {
                  resetGovernanceWorkbenchScopeDraft();
                  const selectedAgentId = resolvedAgentId ?? state.agentsSelectedId ?? null;
                  return selectedAgentId
                    ? refreshGovernanceWorkbenchScopedData(selectedAgentId)
                    : Promise.resolve();
                },
                onGovernanceGenesisRefresh: () =>
                  resolvedAgentId
                    ? loadGovernanceGenesisAndMaybeTeam(resolvedAgentId)
                    : Promise.resolve(),
                onGovernanceAgentRefresh: () =>
                  resolvedAgentId
                    ? loadGovernanceAgent(state, {
                        agentId: resolvedAgentId,
                      })
                    : Promise.resolve(),
                onGovernanceTeamRefresh: () => refreshGovernanceTeamIfAvailable(),
                onGovernanceProposalsRefresh: () =>
                  loadGovernanceProposals(state, resolveGovernanceProposalListInput()),
                onGovernanceProposalSynthesize: () => {
                  const selectedAgentId = resolvedAgentId ?? state.agentsSelectedId ?? null;
                  if (!selectedAgentId) {
                    return Promise.resolve();
                  }
                  return synthesizeGovernanceProposals(state, {
                    ...resolveGovernanceScopeAgentInput(selectedAgentId),
                    ...resolveGovernanceGenesisTeamInput(),
                    ...resolveGovernanceWorkspaceScopeInput(),
                    ...resolveGovernanceProposalListInput(),
                  }).then(() => {
                    if (!state.governanceProposalSynthesizeError) {
                      return refreshAutonomyAfterGovernanceMutation();
                    }
                  });
                },
                onGovernanceProposalReconcile: () => {
                  const selectedAgentId = resolvedAgentId ?? state.agentsSelectedId ?? null;
                  if (!selectedAgentId) {
                    return Promise.resolve();
                  }
                  const operator = state.governanceProposalOperator.trim() || "human-architect";
                  const createdBySessionKey = buildAgentMainSessionKey({ agentId: operator });
                  return reconcileGovernanceProposals(state, {
                    ...resolveGovernanceScopeAgentInput(selectedAgentId),
                    ...resolveGovernanceGenesisTeamInput(),
                    ...resolveGovernanceWorkspaceScopeInput(),
                    ...resolveGovernanceProposalListInput(),
                    mode: resolveGovernanceProposalReconcileMode(),
                    createdByAgentId: operator,
                    createdBySessionKey,
                    decidedBy: operator,
                    appliedBy: operator,
                    ...(state.governanceProposalDecisionNote.trim()
                      ? { decisionNote: state.governanceProposalDecisionNote.trim() }
                      : {}),
                  }).then(() => {
                    if (!state.governanceProposalReconcileError) {
                      state.governanceProposalDecisionNote = "";
                      return refreshAutonomyAfterGovernanceMutation();
                    }
                  });
                },
                onGovernanceProposalCreate: () => {
                  const selectedAgentId = resolvedAgentId ?? state.agentsSelectedId ?? null;
                  if (!selectedAgentId) {
                    return Promise.resolve();
                  }
                  const title = state.governanceProposalCreateTitle.trim();
                  if (!title) {
                    state.governanceProposalCreateError = "Proposal title required.";
                    return Promise.resolve();
                  }
                  let operations;
                  try {
                    operations = parseGovernanceProposalOperationsDraft(
                      state.governanceProposalOperationsJson,
                    );
                  } catch (err) {
                    state.governanceProposalCreateError =
                      err instanceof Error ? err.message : String(err);
                    return Promise.resolve();
                  }
                  const createdByAgentId =
                    state.governanceProposalCreateByAgentId.trim() || selectedAgentId;
                  const createdBySessionKey =
                    state.governanceProposalCreateBySessionKey.trim() ||
                    buildAgentMainSessionKey({ agentId: createdByAgentId });
                  return createGovernanceProposalEntry(state, {
                    title,
                    ...(state.governanceProposalCreateRationale.trim()
                      ? { rationale: state.governanceProposalCreateRationale.trim() }
                      : {}),
                    createdByAgentId,
                    createdBySessionKey,
                    operations,
                    ...resolveGovernanceScopeAgentInput(selectedAgentId),
                    ...resolveGovernanceGenesisTeamInput(),
                    ...resolveGovernanceWorkspaceScopeInput(),
                    ...resolveGovernanceProposalListInput(),
                  }).then(() => {
                    if (!state.governanceProposalCreateError) {
                      state.governanceProposalCreateTitle = "";
                      state.governanceProposalCreateRationale = "";
                      state.governanceProposalCreateByAgentId = createdByAgentId;
                      state.governanceProposalCreateBySessionKey = createdBySessionKey;
                      state.governanceProposalOperationsJson =
                        buildGovernanceProposalOperationsDraftTemplate(createdByAgentId);
                      return refreshAutonomyAfterGovernanceMutation();
                    }
                  });
                },
                onGovernanceProposalCreateReset: () => {
                  resetGovernanceProposalCreateDraft(resolvedAgentId ?? undefined);
                },
                onGovernanceProposalReview: (proposalId, decision) => {
                  const decidedBy = state.governanceProposalOperator.trim() || "human-architect";
                  return reviewGovernanceProposalEntry(state, {
                    proposalId,
                    decision,
                    decidedBy,
                    ...(state.governanceProposalDecisionNote.trim()
                      ? { decisionNote: state.governanceProposalDecisionNote.trim() }
                      : {}),
                    ...resolveGovernanceScopeAgentInput(resolvedAgentId),
                    ...resolveGovernanceGenesisTeamInput(),
                    ...resolveGovernanceWorkspaceScopeInput(),
                    ...resolveGovernanceProposalListInput(),
                  }).then(() => {
                    if (!state.governanceProposalActionError) {
                      state.governanceProposalDecisionNote = "";
                      return refreshAutonomyAfterGovernanceMutation();
                    }
                  });
                },
                onGovernanceProposalApply: (proposalId) => {
                  const appliedBy = state.governanceProposalOperator.trim() || "human-architect";
                  return applyGovernanceProposalEntry(state, {
                    proposalId,
                    appliedBy,
                    ...resolveGovernanceScopeAgentInput(resolvedAgentId),
                    ...resolveGovernanceGenesisTeamInput(),
                    ...resolveGovernanceWorkspaceScopeInput(),
                    ...resolveGovernanceProposalListInput(),
                  }).then(() => {
                    if (!state.governanceProposalActionError) {
                      return refreshAutonomyAfterGovernanceMutation();
                    }
                  });
                },
                onGovernanceProposalRevert: (proposalId) => {
                  const revertedBy = state.governanceProposalOperator.trim() || "human-architect";
                  return revertGovernanceProposalEntry(state, {
                    proposalId,
                    revertedBy,
                    ...resolveGovernanceScopeAgentInput(resolvedAgentId),
                    ...resolveGovernanceGenesisTeamInput(),
                    ...resolveGovernanceWorkspaceScopeInput(),
                    ...resolveGovernanceProposalListInput(),
                  }).then(() => {
                    if (!state.governanceProposalActionError) {
                      return refreshAutonomyAfterGovernanceMutation();
                    }
                  });
                },
                onGovernanceProposalApproveVisible: () =>
                  runGovernanceVisibleProposalBatch("approve_pending"),
                onGovernanceProposalApplyVisible: () =>
                  runGovernanceVisibleProposalBatch("apply_approved"),
                onGovernanceProposalRevertVisible: () =>
                  runGovernanceVisibleProposalBatch("revert_applied"),
                onGovernanceProposalLoadSynthesisDraft: (entry) => {
                  seedGovernanceProposalDraft({
                    title: entry.title,
                    rationale: entry.rationale ?? null,
                    operations: entry.operations,
                    scopeAgentIds:
                      state.governanceProposalSynthesizeResult?.requestedAgentIds ??
                      resolveGovernanceScopeAgentIds(resolvedAgentId),
                    scopeWorkspaceDirs:
                      state.governanceCapabilitiesResult?.workspaceDirs ??
                      state.governanceGenesisResult?.workspaceDirs,
                    scopeTeamId:
                      state.governanceGenesisResult?.teamId ?? state.governanceTeamResult?.teamId,
                  });
                },
                onGovernanceProposalLoadReconcileDraft: (entry) => {
                  seedGovernanceProposalDraft({
                    title: entry.title,
                    rationale: entry.reason ?? null,
                    operations: entry.operations,
                    scopeAgentIds:
                      state.governanceProposalReconcileResult?.requestedAgentIds ??
                      resolveGovernanceScopeAgentIds(resolvedAgentId),
                    scopeWorkspaceDirs:
                      state.governanceCapabilitiesResult?.workspaceDirs ??
                      state.governanceGenesisResult?.workspaceDirs,
                    scopeTeamId:
                      state.governanceGenesisResult?.teamId ?? state.governanceTeamResult?.teamId,
                  });
                },
                onAutonomyRefresh: () =>
                  resolvedAgentId
                    ? Promise.all([
                        loadAutonomyOverview(state, {
                          sessionKey: state.sessionKey,
                          ...resolveAutonomyWorkspaceScopeInput(),
                        }),
                        loadAutonomyCapabilityInventory(state, {
                          sessionKey: state.sessionKey,
                          ...resolveAutonomyWorkspaceScopeInput(),
                        }),
                        loadAutonomyGenesisPlan(state, {
                          sessionKey: state.sessionKey,
                          ...resolveAutonomyWorkspaceScopeInput(),
                        }),
                        loadAutonomyHistory(state, {
                          sessionKey: state.sessionKey,
                          ...resolveAutonomyWorkspaceScopeInput(),
                          ...resolveAutonomyHistoryInput(),
                        }),
                        loadAutonomyProfile(state, {
                          agentId: resolvedAgentId,
                          sessionKey: state.sessionKey,
                        }),
                      ]).then(() => undefined)
                    : Promise.resolve(),
                onAutonomyStart: () =>
                  resolvedAgentId
                    ? startAutonomyFlow(state, {
                        agentId: resolvedAgentId,
                        sessionKey: state.sessionKey,
                        ...(state.autonomyGoal.trim() ? { goal: state.autonomyGoal.trim() } : {}),
                        ...(state.autonomyControllerId.trim()
                          ? { controllerId: state.autonomyControllerId.trim() }
                          : {}),
                        ...(state.autonomyCurrentStep.trim()
                          ? { currentStep: state.autonomyCurrentStep.trim() }
                          : {}),
                        ...resolveAutonomyWorkspaceScopeInput(),
                        ...(state.autonomyNotifyPolicy
                          ? { notifyPolicy: state.autonomyNotifyPolicy }
                          : {}),
                        ...(state.autonomyFlowStatus
                          ? { status: state.autonomyFlowStatus }
                          : {}),
                        seedTaskEnabled: state.autonomySeedTaskEnabled,
                        ...(state.autonomySeedTaskRuntime
                          ? { seedTaskRuntime: state.autonomySeedTaskRuntime }
                          : {}),
                        ...(state.autonomySeedTaskStatus
                          ? { seedTaskStatus: state.autonomySeedTaskStatus }
                          : {}),
                        ...(state.autonomySeedTaskLabel.trim()
                          ? { seedTaskLabel: state.autonomySeedTaskLabel.trim() }
                          : {}),
                        ...(state.autonomySeedTaskTask.trim()
                          ? { seedTaskTask: state.autonomySeedTaskTask.trim() }
                          : {}),
                      })
                    : Promise.resolve(),
                onAutonomyReplaySubmit: () =>
                  resolvedAgentId
                    ? submitAutonomySandboxReplay(state, {
                        agentId: resolvedAgentId,
                        sessionKey: state.sessionKey,
                        ...(state.autonomyResult?.latestFlow?.id
                          ? { flowId: state.autonomyResult.latestFlow.id }
                          : {}),
                        replayPassed: state.autonomyReplayVerdict === "pass",
                        qaPassed: state.autonomyReplayQaVerdict === "pass",
                        auditPassed: state.autonomyReplayAuditVerdict === "pass",
                      })
                    : Promise.resolve(),
                onAutonomyCancel: () =>
                  resolvedAgentId
                    ? cancelAutonomyFlow(state, {
                        agentId: resolvedAgentId,
                        sessionKey: state.sessionKey,
                        ...(state.autonomyResult?.latestFlow?.id
                          ? { flowId: state.autonomyResult.latestFlow.id }
                          : {}),
                      })
                    : Promise.resolve(),
                onAutonomyLoopUpsert: () => {
                  if (!resolvedAgentId) {
                    return Promise.resolve();
                  }
                  const trimmed = state.autonomyLoopEveryMinutes.trim();
                  if (!trimmed) {
                    return upsertAutonomyLoop(state, {
                      agentId: resolvedAgentId,
                      sessionKey: state.sessionKey,
                      ...resolveAutonomyWorkspaceScopeInput(),
                    });
                  }
                  const minutes = Number.parseInt(trimmed, 10);
                  if (!Number.isFinite(minutes) || minutes <= 0) {
                    state.autonomyLoopError = "Loop interval must be a positive integer in minutes.";
                    return Promise.resolve();
                  }
                  return upsertAutonomyLoop(state, {
                    agentId: resolvedAgentId,
                    sessionKey: state.sessionKey,
                    everyMs: minutes * 60_000,
                    ...resolveAutonomyWorkspaceScopeInput(),
                  });
                },
                onAutonomyLoopRemove: () =>
                  resolvedAgentId
                    ? removeAutonomyLoop(state, {
                        agentId: resolvedAgentId,
                        sessionKey: state.sessionKey,
                        ...(state.autonomyResult?.loopJob?.job.id
                          ? { jobId: state.autonomyResult.loopJob.job.id }
                          : {}),
                        })
                    : Promise.resolve(),
                onAutonomyOverviewRefresh: () =>
                  loadAutonomyOverview(state, {
                    sessionKey: state.sessionKey,
                    ...resolveAutonomyWorkspaceScopeInput(),
                  }),
                onAutonomyCapabilitiesRefresh: () =>
                  loadAutonomyCapabilityInventory(state, {
                    sessionKey: state.sessionKey,
                    ...resolveAutonomyWorkspaceScopeInput(),
                  }),
                onAutonomyGenesisRefresh: () =>
                  loadAutonomyGenesisPlan(state, {
                    sessionKey: state.sessionKey,
                    ...resolveAutonomyWorkspaceScopeInput(),
                  }),
                onAutonomyHistoryRefresh: () =>
                  loadAutonomyHistory(state, {
                    sessionKey: state.sessionKey,
                    ...resolveAutonomyWorkspaceScopeInput(),
                    ...resolveAutonomyHistoryInput(),
                  }),
                onAutonomyHeal: () =>
                  healAutonomyFleet(state, {
                    sessionKey: state.sessionKey,
                    ...resolveAutonomyWorkspaceScopeInput(),
                    ...resolveAutonomyHistoryControlInput(),
                  }),
                onAutonomySupervise: () =>
                  superviseAutonomyFleet(state, {
                    sessionKey: state.sessionKey,
                    ...resolveAutonomyWorkspaceScopeInput(),
                    ...resolveAutonomyHistoryControlInput(),
                    governanceMode: resolveAutonomyGovernanceReconcileMode(),
                    ...(state.autonomyGovernanceReconcileNote.trim()
                      ? { decisionNote: state.autonomyGovernanceReconcileNote.trim() }
                      : {}),
                    restartBlockedFlows: true,
                    includeCapabilityInventory: true,
                    includeGenesisPlan: true,
                    recordHistory: true,
                  }).then(() => {
                    if (!state.autonomySuperviseError) {
                      state.autonomyGovernanceReconcileNote = "";
                    }
                  }),
                onAutonomyGovernanceProposals: () =>
                  synthesizeAutonomyGovernanceProposals(state, {
                    sessionKey: state.sessionKey,
                    ...resolveAutonomyWorkspaceScopeInput(),
                  }),
                onAutonomyGovernanceReconcile: () =>
                  reconcileAutonomyGovernanceProposals(state, {
                    sessionKey: state.sessionKey,
                    ...resolveAutonomyWorkspaceScopeInput(),
                    ...resolveAutonomyHistoryControlInput(),
                    mode: resolveAutonomyGovernanceReconcileMode(),
                    ...(state.autonomyGovernanceReconcileNote.trim()
                      ? { decisionNote: state.autonomyGovernanceReconcileNote.trim() }
                      : {}),
                  }).then(() => {
                    if (!state.autonomyGovernanceReconcileError) {
                      state.autonomyGovernanceReconcileNote = "";
                    }
                  }),
                onAutonomyReconcile: () =>
                  reconcileAutonomyLoops(state, {
                    sessionKey: state.sessionKey,
                    ...resolveAutonomyWorkspaceScopeInput(),
                    ...resolveAutonomyHistoryControlInput(),
                  }),
                onAutonomyRunSuggestedAction: (entry) =>
                  runAutonomyOverviewSuggestedAction(entry),
                onAutonomyRunSuggestedActionBatch: (action) =>
                  runAutonomyOverviewSuggestedActionBatch(action),
                onAutonomyInspectOverviewAgent: (agentId) => {
                  state.agentsSelectedId = agentId;
                  void loadAutonomyProfile(state, {
                    agentId,
                    sessionKey: state.sessionKey,
                  });
                },
                onAutonomyResetDraft: () => {
                  resetAutonomyDraftState();
                },
                autonomyDraft: {
                  historyMode: state.autonomyHistoryMode,
                  historySource: state.autonomyHistorySource,
                  historyLimit: state.autonomyHistoryLimit,
                  goal: state.autonomyGoal,
                  controllerId: state.autonomyControllerId,
                  currentStep: state.autonomyCurrentStep,
                  notifyPolicy: state.autonomyNotifyPolicy,
                  flowStatus: state.autonomyFlowStatus,
                  seedTaskEnabled: state.autonomySeedTaskEnabled,
                  seedTaskRuntime: state.autonomySeedTaskRuntime,
                  seedTaskStatus: state.autonomySeedTaskStatus,
                  seedTaskLabel: state.autonomySeedTaskLabel,
                  seedTaskTask: state.autonomySeedTaskTask,
                  replayVerdict: state.autonomyReplayVerdict,
                  replayQaVerdict: state.autonomyReplayQaVerdict,
                  replayAuditVerdict: state.autonomyReplayAuditVerdict,
                  loopEveryMinutes: state.autonomyLoopEveryMinutes,
                  workspaceScope: state.autonomyWorkspaceScope,
                  governanceReconcileMode: state.autonomyGovernanceReconcileMode,
                  governanceReconcileNote: state.autonomyGovernanceReconcileNote,
                },
                onAutonomyGoalChange: (value) => (state.autonomyGoal = value),
                onAutonomyControllerIdChange: (value) => (state.autonomyControllerId = value),
                onAutonomyCurrentStepChange: (value) => (state.autonomyCurrentStep = value),
                onAutonomyNotifyPolicyChange: (value) => (state.autonomyNotifyPolicy = value),
                onAutonomyFlowStatusChange: (value) => (state.autonomyFlowStatus = value),
                onAutonomySeedTaskEnabledChange: (value) => (state.autonomySeedTaskEnabled = value),
                onAutonomySeedTaskRuntimeChange: (value) => (state.autonomySeedTaskRuntime = value),
                onAutonomySeedTaskStatusChange: (value) => (state.autonomySeedTaskStatus = value),
                onAutonomySeedTaskLabelChange: (value) => (state.autonomySeedTaskLabel = value),
                onAutonomySeedTaskTaskChange: (value) => (state.autonomySeedTaskTask = value),
                onAutonomyReplayVerdictChange: (value) => (state.autonomyReplayVerdict = value),
                onAutonomyReplayQaVerdictChange: (value) => (state.autonomyReplayQaVerdict = value),
                onAutonomyReplayAuditVerdictChange: (value) =>
                  (state.autonomyReplayAuditVerdict = value),
                onAutonomyLoopEveryMinutesChange: (value) => (state.autonomyLoopEveryMinutes = value),
                onAutonomyWorkspaceScopeChange: (value) => (state.autonomyWorkspaceScope = value),
                onAutonomyGovernanceReconcileModeChange: (value) =>
                  (state.autonomyGovernanceReconcileMode = value),
                onAutonomyGovernanceReconcileNoteChange: (value) =>
                  (state.autonomyGovernanceReconcileNote = value),
                onAutonomyHistoryModeChange: (value) => {
                  state.autonomyHistoryMode = value;
                  if (state.agentsPanel === "autonomy") {
                    void loadAutonomyHistory(state, {
                      sessionKey: state.sessionKey,
                      ...resolveAutonomyWorkspaceScopeInput(),
                      ...resolveAutonomyHistoryInput(),
                    });
                  }
                },
                onAutonomyHistorySourceChange: (value) => {
                  state.autonomyHistorySource = value;
                  if (state.agentsPanel === "autonomy") {
                    void loadAutonomyHistory(state, {
                      sessionKey: state.sessionKey,
                      ...resolveAutonomyWorkspaceScopeInput(),
                      ...resolveAutonomyHistoryInput(),
                    });
                  }
                },
                onAutonomyHistoryLimitChange: (value) => {
                  state.autonomyHistoryLimit = value;
                  if (state.agentsPanel === "autonomy") {
                    void loadAutonomyHistory(state, {
                      sessionKey: state.sessionKey,
                      ...resolveAutonomyWorkspaceScopeInput(),
                      ...resolveAutonomyHistoryInput(),
                    });
                  }
                },
                onAutonomyUseRecommendedGoal: (value) => {
                  state.autonomyGoal = value;
                },
                governanceDraft: {
                  scopeAgentIds: state.governanceScopeAgentIds,
                  scopeWorkspaceDirs: state.governanceScopeWorkspaceDirs,
                  scopeTeamId: state.governanceGenesisTeamId,
                  proposalLimit: state.governanceProposalLimit,
                  operator: state.governanceProposalOperator,
                  decisionNote: state.governanceProposalDecisionNote,
                  statusFilter: state.governanceProposalStatusFilter,
                  reconcileMode: state.governanceProposalReconcileMode,
                  createTitle: state.governanceProposalCreateTitle,
                  createRationale: state.governanceProposalCreateRationale,
                  createAgentId: state.governanceProposalCreateByAgentId,
                  createSessionKey: state.governanceProposalCreateBySessionKey,
                  createOperationsJson: state.governanceProposalOperationsJson,
                },
                onGovernanceOperatorChange: (value) => (state.governanceProposalOperator = value),
                onGovernanceDecisionNoteChange: (value) =>
                  (state.governanceProposalDecisionNote = value),
                onGovernanceStatusFilterChange: (value) => {
                  state.governanceProposalStatusFilter = value;
                  if (state.agentsPanel === "governance") {
                    void loadGovernanceProposals(state, resolveGovernanceProposalListInput());
                  }
                },
                onGovernanceReconcileModeChange: (value) =>
                  (state.governanceProposalReconcileMode = value),
                onGovernanceProposalLimitChange: (value) => {
                  state.governanceProposalLimit = value;
                  if (state.agentsPanel === "governance") {
                    void loadGovernanceProposals(state, resolveGovernanceProposalListInput());
                  }
                },
                onGovernanceCreateTitleChange: (value) =>
                  (state.governanceProposalCreateTitle = value),
                onGovernanceCreateRationaleChange: (value) =>
                  (state.governanceProposalCreateRationale = value),
                onGovernanceCreateAgentIdChange: (value) =>
                  (state.governanceProposalCreateByAgentId = value),
                onGovernanceCreateSessionKeyChange: (value) =>
                  (state.governanceProposalCreateBySessionKey = value),
                onGovernanceCreateOperationsJsonChange: (value) =>
                  (state.governanceProposalOperationsJson = value),
                onGovernanceScopeAgentIdsChange: (value) =>
                  (state.governanceScopeAgentIds = value),
                onGovernanceScopeWorkspaceDirsChange: (value) =>
                  (state.governanceScopeWorkspaceDirs = value),
                onGovernanceScopeTeamIdChange: (value) => {
                  state.governanceGenesisTeamId = value;
                  if (state.agentsPanel === "governance" && resolvedAgentId) {
                    void loadGovernanceGenesisAndMaybeTeam(resolvedAgentId);
                  }
                },
                onSkillsFilterChange: (next) => (state.skillsFilter = next),
                onSkillsRefresh: () => {
                  if (resolvedAgentId) {
                    void loadAgentSkills(state, resolvedAgentId);
                  }
                },
                onAgentSkillToggle: (agentId, skillName, enabled) => {
                  const index = ensureAgentIndex(agentId);
                  if (index < 0) {
                    return;
                  }
                  const list = (getCurrentConfigValue() as { agents?: { list?: unknown[] } } | null)
                    ?.agents?.list;
                  const entry = Array.isArray(list)
                    ? (list[index] as { skills?: unknown })
                    : undefined;
                  const normalizedSkill = skillName.trim();
                  if (!normalizedSkill) {
                    return;
                  }
                  const allSkills =
                    state.agentSkillsReport?.skills?.map((skill) => skill.name).filter(Boolean) ??
                    [];
                  const existing = Array.isArray(entry?.skills)
                    ? entry.skills.map((name) => String(name).trim()).filter(Boolean)
                    : undefined;
                  const base = existing ?? allSkills;
                  const next = new Set(base);
                  if (enabled) {
                    next.add(normalizedSkill);
                  } else {
                    next.delete(normalizedSkill);
                  }
                  updateConfigFormValue(state, ["agents", "list", index, "skills"], [...next]);
                },
                onAgentSkillsClear: (agentId) => {
                  const index = findAgentIndex(agentId);
                  if (index < 0) {
                    return;
                  }
                  removeConfigFormValue(state, ["agents", "list", index, "skills"]);
                },
                onAgentSkillsDisableAll: (agentId) => {
                  const index = ensureAgentIndex(agentId);
                  if (index < 0) {
                    return;
                  }
                  updateConfigFormValue(state, ["agents", "list", index, "skills"], []);
                },
                onModelChange: (agentId, modelId) => {
                  const index = modelId ? ensureAgentIndex(agentId) : findAgentIndex(agentId);
                  if (index < 0) {
                    return;
                  }
                  const modelEntry = resolveAgentModelFormEntry(index);
                  const { basePath, existing } = modelEntry;
                  if (!modelId) {
                    removeConfigFormValue(state, basePath);
                  } else {
                    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
                      const fallbacks = (existing as { fallbacks?: unknown }).fallbacks;
                      const next = {
                        primary: modelId,
                        ...(Array.isArray(fallbacks) ? { fallbacks } : {}),
                      };
                      updateConfigFormValue(state, basePath, next);
                    } else {
                      updateConfigFormValue(state, basePath, modelId);
                    }
                  }
                  void refreshVisibleToolsEffectiveForCurrentSession(state);
                },
                onModelFallbacksChange: (agentId, fallbacks) => {
                  const normalized = fallbacks.map((name) => name.trim()).filter(Boolean);
                  const currentConfig = getCurrentConfigValue();
                  const resolvedConfig = resolveAgentConfig(currentConfig, agentId);
                  const effectivePrimary =
                    resolveModelPrimary(resolvedConfig.entry?.model) ??
                    resolveModelPrimary(resolvedConfig.defaults?.model);
                  const effectiveFallbacks = resolveEffectiveModelFallbacks(
                    resolvedConfig.entry?.model,
                    resolvedConfig.defaults?.model,
                  );
                  const index =
                    normalized.length > 0
                      ? effectivePrimary
                        ? ensureAgentIndex(agentId)
                        : -1
                      : (effectiveFallbacks?.length ?? 0) > 0 || findAgentIndex(agentId) >= 0
                        ? ensureAgentIndex(agentId)
                        : -1;
                  if (index < 0) {
                    return;
                  }
                  const { basePath, existing } = resolveAgentModelFormEntry(index);
                  const resolvePrimary = () => {
                    if (typeof existing === "string") {
                      return existing.trim() || null;
                    }
                    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
                      const primary = (existing as { primary?: unknown }).primary;
                      if (typeof primary === "string") {
                        const trimmed = primary.trim();
                        return trimmed || null;
                      }
                    }
                    return null;
                  };
                  const primary = resolvePrimary() ?? effectivePrimary;
                  if (normalized.length === 0) {
                    if (primary) {
                      updateConfigFormValue(state, basePath, primary);
                    } else {
                      removeConfigFormValue(state, basePath);
                    }
                    return;
                  }
                  if (!primary) {
                    return;
                  }
                  updateConfigFormValue(state, basePath, { primary, fallbacks: normalized });
                },
                onSetDefault: (agentId) => {
                  if (!configValue) {
                    return;
                  }
                  updateConfigFormValue(state, ["agents", "defaultId"], agentId);
                },
              }),
            )
          : nothing}
        ${state.tab === "skills"
          ? lazyRender(lazySkills, (m) =>
              m.renderSkills({
                connected: state.connected,
                loading: state.skillsLoading,
                report: state.skillsReport,
                error: state.skillsError,
                filter: state.skillsFilter,
                statusFilter: state.skillsStatusFilter,
                edits: state.skillEdits,
                messages: state.skillMessages,
                busyKey: state.skillsBusyKey,
                detailKey: state.skillsDetailKey,
                clawhubQuery: state.clawhubSearchQuery,
                clawhubResults: state.clawhubSearchResults,
                clawhubSearchLoading: state.clawhubSearchLoading,
                clawhubSearchError: state.clawhubSearchError,
                clawhubDetail: state.clawhubDetail,
                clawhubDetailSlug: state.clawhubDetailSlug,
                clawhubDetailLoading: state.clawhubDetailLoading,
                clawhubDetailError: state.clawhubDetailError,
                clawhubInstallSlug: state.clawhubInstallSlug,
                clawhubInstallMessage: state.clawhubInstallMessage,
                onFilterChange: (next) => (state.skillsFilter = next),
                onStatusFilterChange: (next) => (state.skillsStatusFilter = next),
                onRefresh: () => loadSkills(state, { clearMessages: true }),
                onToggle: (key, enabled) => updateSkillEnabled(state, key, enabled),
                onEdit: (key, value) => updateSkillEdit(state, key, value),
                onSaveKey: (key) => saveSkillApiKey(state, key),
                onInstall: (skillKey, name, installId) =>
                  installSkill(state, skillKey, name, installId),
                onDetailOpen: (key) => (state.skillsDetailKey = key),
                onDetailClose: () => (state.skillsDetailKey = null),
                onClawHubQueryChange: (query) => {
                  setClawHubSearchQuery(state, query);
                  if (clawhubSearchTimer) {
                    clearTimeout(clawhubSearchTimer);
                  }
                  clawhubSearchTimer = setTimeout(() => searchClawHub(state, query), 300);
                },
                onClawHubDetailOpen: (slug) => loadClawHubDetail(state, slug),
                onClawHubDetailClose: () => closeClawHubDetail(state),
                onClawHubInstall: (slug) => installFromClawHub(state, slug),
              }),
            )
          : nothing}
        ${state.tab === "nodes"
          ? lazyRender(lazyNodes, (m) =>
              m.renderNodes({
                loading: state.nodesLoading,
                nodes: state.nodes,
                devicesLoading: state.devicesLoading,
                devicesError: state.devicesError,
                devicesList: state.devicesList,
                configForm:
                  state.configForm ??
                  (state.configSnapshot?.config as Record<string, unknown> | null),
                configLoading: state.configLoading,
                configSaving: state.configSaving,
                configDirty: state.configFormDirty,
                configFormMode: state.configFormMode,
                execApprovalsLoading: state.execApprovalsLoading,
                execApprovalsSaving: state.execApprovalsSaving,
                execApprovalsDirty: state.execApprovalsDirty,
                execApprovalsSnapshot: state.execApprovalsSnapshot,
                execApprovalsForm: state.execApprovalsForm,
                execApprovalsSelectedAgent: state.execApprovalsSelectedAgent,
                execApprovalsTarget: state.execApprovalsTarget,
                execApprovalsTargetNodeId: state.execApprovalsTargetNodeId,
                onRefresh: () => loadNodes(state),
                onDevicesRefresh: () => loadDevices(state),
                onDeviceApprove: (requestId) => approveDevicePairing(state, requestId),
                onDeviceReject: (requestId) => rejectDevicePairing(state, requestId),
                onDeviceRotate: (deviceId, role, scopes) =>
                  rotateDeviceToken(state, { deviceId, role, scopes }),
                onDeviceRevoke: (deviceId, role) => revokeDeviceToken(state, { deviceId, role }),
                onLoadConfig: () => loadConfig(state),
                onLoadExecApprovals: () => {
                  const target =
                    state.execApprovalsTarget === "node" && state.execApprovalsTargetNodeId
                      ? { kind: "node" as const, nodeId: state.execApprovalsTargetNodeId }
                      : { kind: "gateway" as const };
                  return loadExecApprovals(state, target);
                },
                onBindDefault: (nodeId) => {
                  if (nodeId) {
                    updateConfigFormValue(state, ["tools", "exec", "node"], nodeId);
                  } else {
                    removeConfigFormValue(state, ["tools", "exec", "node"]);
                  }
                },
                onBindAgent: (agentIndex, nodeId) => {
                  const basePath = ["agents", "list", agentIndex, "tools", "exec", "node"];
                  if (nodeId) {
                    updateConfigFormValue(state, basePath, nodeId);
                  } else {
                    removeConfigFormValue(state, basePath);
                  }
                },
                onSaveBindings: () => saveConfig(state),
                onExecApprovalsTargetChange: (kind, nodeId) => {
                  state.execApprovalsTarget = kind;
                  state.execApprovalsTargetNodeId = nodeId;
                  state.execApprovalsSnapshot = null;
                  state.execApprovalsForm = null;
                  state.execApprovalsDirty = false;
                  state.execApprovalsSelectedAgent = null;
                },
                onExecApprovalsSelectAgent: (agentId) => {
                  state.execApprovalsSelectedAgent = agentId;
                },
                onExecApprovalsPatch: (path, value) =>
                  updateExecApprovalsFormValue(state, path, value),
                onExecApprovalsRemove: (path) => removeExecApprovalsFormValue(state, path),
                onSaveExecApprovals: () => {
                  const target =
                    state.execApprovalsTarget === "node" && state.execApprovalsTargetNodeId
                      ? { kind: "node" as const, nodeId: state.execApprovalsTargetNodeId }
                      : { kind: "gateway" as const };
                  return saveExecApprovals(state, target);
                },
              }),
            )
          : nothing}
        ${state.tab === "chat"
          ? renderChat({
              sessionKey: state.sessionKey,
              onSessionKeyChange: (next) => {
                switchChatSession(state, next);
              },
              thinkingLevel: state.chatThinkingLevel,
              showThinking,
              showToolCalls,
              loading: state.chatLoading,
              sending: state.chatSending,
              compactionStatus: state.compactionStatus,
              fallbackStatus: state.fallbackStatus,
              assistantAvatarUrl: chatAvatarUrl,
              messages: state.chatMessages,
              sideResult: state.chatSideResult,
              toolMessages: state.chatToolMessages,
              streamSegments: state.chatStreamSegments,
              stream: state.chatStream,
              streamStartedAt: state.chatStreamStartedAt,
              draft: state.chatMessage,
              queue: state.chatQueue,
              connected: state.connected,
              canSend: state.connected,
              disabledReason: chatDisabledReason,
              error: state.lastError,
              sessions: state.sessionsResult,
              focusMode: chatFocus,
              autoExpandToolCalls: false,
              onRefresh: () => {
                state.chatSideResult = null;
                state.resetToolStream();
                return Promise.all([loadChatHistory(state), refreshChatAvatar(state)]);
              },
              onToggleFocusMode: () => {
                if (state.onboarding) {
                  return;
                }
                state.applySettings({
                  ...state.settings,
                  chatFocusMode: !state.settings.chatFocusMode,
                });
              },
              onChatScroll: (event) => state.handleChatScroll(event),
              getDraft: () => state.chatMessage,
              onDraftChange: (next) => (state.chatMessage = next),
              onRequestUpdate: requestHostUpdate,
              attachments: state.chatAttachments,
              onAttachmentsChange: (next) => (state.chatAttachments = next),
              onSend: () => state.handleSendChat(),
              canAbort: Boolean(state.chatRunId),
              onAbort: () => void state.handleAbortChat(),
              onQueueRemove: (id) => state.removeQueuedMessage(id),
              onDismissSideResult: () => {
                state.chatSideResult = null;
              },
              onNewSession: () => state.handleSendChat("/new", { restoreDraft: true }),
              onClearHistory: async () => {
                if (!state.client || !state.connected) {
                  return;
                }
                try {
                  await state.client.request("sessions.reset", { key: state.sessionKey });
                  state.chatMessages = [];
                  state.chatSideResult = null;
                  state.chatStream = null;
                  state.chatRunId = null;
                  await loadChatHistory(state);
                } catch (err) {
                  state.lastError = String(err);
                }
              },
              agentsList: state.agentsList,
              currentAgentId: resolvedAgentId ?? "main",
              onAgentChange: (agentId: string) => {
                switchChatSession(state, buildAgentMainSessionKey({ agentId }));
              },
              onNavigateToAgent: () => {
                state.agentsSelectedId = resolvedAgentId;
                state.setTab("agents" as import("./navigation.ts").Tab);
              },
              onSessionSelect: (key: string) => {
                switchChatSession(state, key);
              },
              showNewMessages: state.chatNewMessagesBelow && !state.chatManualRefreshInFlight,
              onScrollToBottom: () => state.scrollToBottom(),
              // Sidebar props for tool output viewing
              sidebarOpen: state.sidebarOpen,
              sidebarContent: state.sidebarContent,
              sidebarError: state.sidebarError,
              splitRatio: state.splitRatio,
              canvasHostUrl: state.hello?.canvasHostUrl ?? null,
              onOpenSidebar: (content) => state.handleOpenSidebar(content),
              onCloseSidebar: () => state.handleCloseSidebar(),
              onSplitRatioChange: (ratio: number) => state.handleSplitRatioChange(ratio),
              assistantName: state.assistantName,
              assistantAvatar: state.assistantAvatar,
              localMediaPreviewRoots: state.localMediaPreviewRoots,
              embedSandboxMode: state.embedSandboxMode,
              allowExternalEmbedUrls: state.allowExternalEmbedUrls,
              assistantAttachmentAuthToken: resolveAssistantAttachmentAuthToken(state),
              basePath: state.basePath ?? "",
            })
          : nothing}
        ${renderConfigTabForActiveTab()}
        ${state.tab === "debug"
          ? lazyRender(lazyDebug, (m) =>
              m.renderDebug({
                loading: state.debugLoading,
                status: state.debugStatus,
                health: state.debugHealth,
                models: state.debugModels,
                heartbeat: state.debugHeartbeat,
                eventLog: state.eventLog,
                methods: (state.hello?.features?.methods ?? []).toSorted(),
                callMethod: state.debugCallMethod,
                callParams: state.debugCallParams,
                callResult: state.debugCallResult,
                callError: state.debugCallError,
                onCallMethodChange: (next) => (state.debugCallMethod = next),
                onCallParamsChange: (next) => (state.debugCallParams = next),
                onRefresh: () => loadDebug(state),
                onCall: () => callDebugMethod(state),
              }),
            )
          : nothing}
        ${state.tab === "logs"
          ? lazyRender(lazyLogs, (m) =>
              m.renderLogs({
                loading: state.logsLoading,
                error: state.logsError,
                file: state.logsFile,
                entries: state.logsEntries,
                filterText: state.logsFilterText,
                levelFilters: state.logsLevelFilters,
                autoFollow: state.logsAutoFollow,
                truncated: state.logsTruncated,
                onFilterTextChange: (next) => (state.logsFilterText = next),
                onLevelToggle: (level, enabled) => {
                  state.logsLevelFilters = { ...state.logsLevelFilters, [level]: enabled };
                },
                onToggleAutoFollow: (next) => (state.logsAutoFollow = next),
                onRefresh: () => loadLogs(state, { reset: true }),
                onExport: (lines, label) => state.exportLogs(lines, label),
                onScroll: (event) => state.handleLogsScroll(event),
              }),
            )
          : nothing}
        ${state.tab === "dreams"
          ? renderDreaming({
              active: dreamingOn,
              shortTermCount: state.dreamingStatus?.shortTermCount ?? 0,
              groundedSignalCount: state.dreamingStatus?.groundedSignalCount ?? 0,
              totalSignalCount: state.dreamingStatus?.totalSignalCount ?? 0,
              promotedCount: state.dreamingStatus?.promotedToday ?? 0,
              phases: state.dreamingStatus?.phases ?? undefined,
              shortTermEntries: state.dreamingStatus?.shortTermEntries ?? [],
              promotedEntries: state.dreamingStatus?.promotedEntries ?? [],
              dreamingOf: null,
              nextCycle: dreamingNextCycle,
              timezone: state.dreamingStatus?.timezone ?? null,
              statusLoading: state.dreamingStatusLoading,
              statusError: state.dreamingStatusError,
              modeSaving: state.dreamingModeSaving,
              dreamDiaryLoading: state.dreamDiaryLoading,
              dreamDiaryActionLoading: state.dreamDiaryActionLoading,
              dreamDiaryActionMessage: state.dreamDiaryActionMessage,
              dreamDiaryActionArchivePath: state.dreamDiaryActionArchivePath,
              dreamDiaryError: state.dreamDiaryError,
              dreamDiaryPath: state.dreamDiaryPath,
              dreamDiaryContent: state.dreamDiaryContent,
              memoryWikiEnabled: isPluginEnabledInConfigSnapshot(
                state.configSnapshot,
                "memory-wiki",
                { enabledByDefault: false },
              ),
              wikiImportInsightsLoading: state.wikiImportInsightsLoading,
              wikiImportInsightsError: state.wikiImportInsightsError,
              wikiImportInsights: state.wikiImportInsights,
              wikiMemoryPalaceLoading: state.wikiMemoryPalaceLoading,
              wikiMemoryPalaceError: state.wikiMemoryPalaceError,
              wikiMemoryPalace: state.wikiMemoryPalace,
              onRefresh: refreshDreaming,
              onRefreshDiary: () => loadDreamDiary(state),
              onRefreshImports: () => {
                void (async () => {
                  await loadConfig(state);
                  await loadWikiImportInsights(state);
                })();
              },
              onRefreshMemoryPalace: () => {
                void (async () => {
                  await loadConfig(state);
                  await loadWikiMemoryPalace(state);
                })();
              },
              onOpenConfig: () => openConfigFile(state),
              onOpenWikiPage: (lookup: string) => openWikiPage(lookup),
              onBackfillDiary: () => backfillDreamDiary(state),
              onCopyDreamingArchivePath: () => {
                void copyDreamingArchivePath(state);
              },
              onDedupeDreamDiary: () => dedupeDreamDiary(state),
              onResetDiary: () => resetDreamDiary(state),
              onResetGroundedShortTerm: () => resetGroundedShortTerm(state),
              onRepairDreamingArtifacts: () => repairDreamingArtifacts(state),
              onRequestUpdate: requestHostUpdate,
            })
          : nothing}
      </main>
      ${renderExecApprovalPrompt(state)} ${renderGatewayUrlConfirmation(state)} ${nothing}
    </div>
  `;
}
