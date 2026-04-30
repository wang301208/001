/**
 * Quick Settings view — opinionated card layout for the most common settings.
 * Replaces the raw schema-driven form as the default settings experience.
 *
 * Each card answers a "what do I want to do?" question with status + actions.
 */

import { html, nothing, type TemplateResult } from "lit";
import { icons } from "../icons.ts";
import type { BorderRadiusStop } from "../storage.ts";
import type { ThemeTransitionContext } from "../theme-transition.ts";
import type { ThemeMode, ThemeName } from "../theme.ts";
import { CONFIG_PRESETS, detectActivePreset, type ConfigPresetId } from "./config-presets.ts";

// ── Types ──

export type QuickSettingsChannel = {
  id: string;
  label: string;
  connected: boolean;
  detail?: string;
};

export type QuickSettingsApiKey = {
  provider: string;
  label: string;
  masked?: string;
  isSet: boolean;
};

export type QuickSettingsAutomation = {
  cronJobCount: number;
  skillCount: number;
  mcpServerCount: number;
};

export type QuickSettingsSecurity = {
  gatewayAuth: string;
  execPolicy: string;
  deviceAuth: boolean;
};

export type QuickSettingsRemoteModelApi =
  | "openai-completions"
  | "openai-responses"
  | "anthropic-messages"
  | "google-generative-ai"
  | "ollama"
  | "azure-openai-responses";

export type QuickSettingsRemoteModelProvider = {
  id: string;
  label: string;
  baseUrl: string;
  api: QuickSettingsRemoteModelApi;
};

export type QuickSettingsRemoteModelDraft = {
  provider: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
  api: QuickSettingsRemoteModelApi;
  contextWindow?: number;
  maxTokens?: number;
  reasoning: boolean;
  supportsImages: boolean;
  setDefault: boolean;
};

export type QuickSettingsProps = {
  // Model & Thinking
  currentModel: string;
  thinkingLevel: string;
  fastMode: boolean;
  onModelChange?: () => void;
  onThinkingChange?: (level: string) => void;
  onFastModeToggle?: () => void;

  // Channels
  channels: QuickSettingsChannel[];
  onChannelConfigure?: (channelId: string) => void;

  // API Keys
  apiKeys: QuickSettingsApiKey[];
  onApiKeyChange?: (provider: string) => void;

  // Remote models
  remoteModelProviders: QuickSettingsRemoteModelProvider[];
  remoteModelImporting?: boolean;
  remoteModelImportMessage?: { kind: "success" | "error"; text: string } | null;
  onRemoteModelImport?: (draft: QuickSettingsRemoteModelDraft) => void;

  // Automations
  automation: QuickSettingsAutomation;
  onManageCron?: () => void;
  onBrowseSkills?: () => void;
  onConfigureMcp?: () => void;

  // Security
  security: QuickSettingsSecurity;
  onSecurityConfigure?: () => void;

  // Appearance
  theme: ThemeName;
  themeMode: ThemeMode;
  borderRadius: number;
  setTheme: (theme: ThemeName, context?: ThemeTransitionContext) => void;
  setThemeMode: (mode: ThemeMode, context?: ThemeTransitionContext) => void;
  setBorderRadius: (value: number) => void;

  // Presets
  configObject?: Record<string, unknown>;
  onApplyPreset?: (presetId: ConfigPresetId) => void;

  // Navigation
  onAdvancedSettings?: () => void;

  // Connection
  connected: boolean;
  gatewayUrl: string;
  assistantName: string;
  version: string;
};

// ── Theme options ──

type ThemeOption = { id: ThemeName; label: string };
const THEME_OPTIONS: ThemeOption[] = [
  { id: "claw", label: "Claw" },
  { id: "knot", label: "Knot" },
  { id: "dash", label: "Dash" },
];

const BORDER_RADIUS_STOPS: Array<{ value: BorderRadiusStop; label: string }> = [
  { value: 0, label: "无" },
  { value: 25, label: "轻微" },
  { value: 50, label: "默认" },
  { value: 75, label: "圆润" },
  { value: 100, label: "全圆" },
];

const THINKING_LEVELS = ["off", "low", "medium", "high"];
const THINKING_LEVEL_LABELS: Record<string, string> = {
  off: "关闭",
  low: "低",
  medium: "中",
  high: "高",
};
const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  light: "浅色",
  dark: "深色",
  system: "跟随系统",
};
const REMOTE_MODEL_APIS: Array<{ id: QuickSettingsRemoteModelApi; label: string }> = [
  { id: "openai-completions", label: "OpenAI 兼容 Chat Completions" },
  { id: "openai-responses", label: "OpenAI Responses" },
  { id: "anthropic-messages", label: "Anthropic Messages" },
  { id: "google-generative-ai", label: "Google Generative AI" },
  { id: "ollama", label: "Ollama" },
  { id: "azure-openai-responses", label: "Azure OpenAI Responses" },
];

// ── Card renderers ──

function renderCardHeader(icon: TemplateResult, title: string, action?: TemplateResult) {
  return html`
    <div class="qs-card__header">
      <div class="qs-card__header-left">
        <span class="qs-card__icon">${icon}</span>
        <h3 class="qs-card__title">${title}</h3>
      </div>
      ${action ? action : nothing}
    </div>
  `;
}

function readStringFormField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveNumberFormField(form: FormData, key: string): number | undefined {
  const raw = readStringFormField(form, key);
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function isRemoteModelApi(value: string): value is QuickSettingsRemoteModelApi {
  return REMOTE_MODEL_APIS.some((entry) => entry.id === value);
}

function applyRemoteModelProviderPreset(select: HTMLSelectElement) {
  const selected = select.selectedOptions[0];
  const form = select.form;
  if (!selected || !form) {
    return;
  }
  const baseUrl = selected.dataset.baseUrl ?? "";
  const api = selected.dataset.api ?? "";
  const baseUrlInput = form.elements.namedItem("baseUrl");
  const apiSelect = form.elements.namedItem("api");
  if (baseUrl && baseUrlInput instanceof HTMLInputElement) {
    baseUrlInput.value = baseUrl;
  }
  if (isRemoteModelApi(api) && apiSelect instanceof HTMLSelectElement) {
    apiSelect.value = api;
  }
}

function renderModelCard(props: QuickSettingsProps) {
  return html`
    <div class="qs-card">
      ${renderCardHeader(icons.brain, "模型与思考")}
      <div class="qs-card__body">
        <div class="qs-row">
          <span class="qs-row__label">模型</span>
          <button class="qs-row__value qs-row__value--action" @click=${props.onModelChange}>
            <code>${props.currentModel || "默认"}</code>
            <span class="qs-row__chevron">${icons.chevronRight}</span>
          </button>
        </div>
        <div class="qs-row">
          <span class="qs-row__label">思考</span>
          <div class="qs-segmented">
            ${THINKING_LEVELS.map(
              (level) => html`
                <button
                  class="qs-segmented__btn ${level === props.thinkingLevel
                    ? "qs-segmented__btn--active"
                    : ""}"
                  @click=${() => props.onThinkingChange?.(level)}
                >
                  ${THINKING_LEVEL_LABELS[level] ?? level}
                </button>
              `,
            )}
          </div>
        </div>
        <div class="qs-row">
          <span class="qs-row__label">快速模式</span>
          <label class="qs-toggle">
            <input type="checkbox" .checked=${props.fastMode} @change=${props.onFastModeToggle} />
            <span class="qs-toggle__track"></span>
            <span class="qs-toggle__hint muted"
              >${props.fastMode ? "开启：成本更低，能力较弱" : "关闭"}</span
            >
          </label>
        </div>
      </div>
    </div>
  `;
}

function renderRemoteModelCard(props: QuickSettingsProps) {
  const defaultProvider = props.remoteModelProviders[0];
  const defaultApi = defaultProvider?.api ?? "openai-completions";
  const importing = props.remoteModelImporting === true;
  const message = props.remoteModelImportMessage;

  return html`
    <div class="qs-card qs-card--span-all">
      ${renderCardHeader(
        icons.download,
        "远程模型导入",
        html`<span class="qs-badge">可填写密钥</span>`,
      )}
      <form
        class="qs-card__body qs-form"
        @submit=${(event: SubmitEvent) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget as HTMLFormElement);
          const apiRaw = readStringFormField(form, "api");
          props.onRemoteModelImport?.({
            provider: readStringFormField(form, "provider"),
            modelId: readStringFormField(form, "modelId"),
            baseUrl: readStringFormField(form, "baseUrl"),
            apiKey: readStringFormField(form, "apiKey"),
            api: isRemoteModelApi(apiRaw) ? apiRaw : defaultApi,
            contextWindow: readPositiveNumberFormField(form, "contextWindow"),
            maxTokens: readPositiveNumberFormField(form, "maxTokens"),
            reasoning: form.get("reasoning") === "on",
            supportsImages: form.get("supportsImages") === "on",
            setDefault: form.get("setDefault") === "on",
          });
        }}
        >
        ${message
          ? html`<div class="qs-message qs-message--${message.kind}">${message.text}</div>`
          : nothing}
        <div class="qs-form__grid">
          <label class="qs-field">
            <span class="qs-field__label">提供商</span>
            <select
              class="qs-select"
              name="provider"
              required
              @change=${(event: Event) =>
                applyRemoteModelProviderPreset(event.currentTarget as HTMLSelectElement)}
            >
              ${props.remoteModelProviders.map(
                (provider) => html`
                  <option
                    value=${provider.id}
                    data-base-url=${provider.baseUrl}
                    data-api=${provider.api}
                    ?selected=${provider.id === defaultProvider?.id}
                  >
                    ${provider.label}
                  </option>
                `,
              )}
            </select>
          </label>
          <label class="qs-field">
            <span class="qs-field__label">模型 ID</span>
            <input
              class="qs-input"
              name="modelId"
              placeholder="例如 gpt-5.4 或 anthropic/claude-sonnet-4.6"
              autocomplete="off"
              required
            />
          </label>
          <label class="qs-field">
            <span class="qs-field__label">基础 URL</span>
            <input
              class="qs-input"
              name="baseUrl"
              type="url"
              value=${defaultProvider?.baseUrl ?? "https://api.openai.com/v1"}
              placeholder="https://api.example.com/v1"
              required
            />
          </label>
          <label class="qs-field">
            <span class="qs-field__label">API 协议</span>
            <select class="qs-select" name="api" required>
              ${REMOTE_MODEL_APIS.map(
                (api) => html`
                  <option value=${api.id} ?selected=${api.id === defaultApi}>${api.label}</option>
                `,
              )}
            </select>
          </label>
          <label class="qs-field qs-field--span-2">
            <span class="qs-field__label">API 密钥</span>
            <input
              class="qs-input"
              name="apiKey"
              type="password"
              placeholder="粘贴该提供商的 API Key；留空则保留现有密钥"
              autocomplete="off"
            />
          </label>
          <label class="qs-field">
            <span class="qs-field__label">上下文 Token</span>
            <input class="qs-input" name="contextWindow" type="number" min="1" placeholder="200000" />
          </label>
          <label class="qs-field">
            <span class="qs-field__label">最大输出 Token</span>
            <input class="qs-input" name="maxTokens" type="number" min="1" placeholder="8192" />
          </label>
        </div>
        <div class="qs-check-grid">
          <label class="qs-check">
            <input type="checkbox" name="reasoning" />
            <span>支持推理</span>
          </label>
          <label class="qs-check">
            <input type="checkbox" name="supportsImages" />
            <span>支持图片输入</span>
          </label>
          <label class="qs-check">
            <input type="checkbox" name="setDefault" checked />
            <span>设为默认模型</span>
          </label>
        </div>
        <div class="qs-form__footer">
          <span class="qs-help"
            >注册提供商、端点、模型 ID 和可选 API 密钥。留空密钥会沿用现有 provider 配置。</span
          >
          <button class="btn btn--sm" type="submit" ?disabled=${!props.connected || importing}>
            ${importing ? "正在导入..." : "导入模型"}
          </button>
        </div>
      </form>
    </div>
  `;
}

function renderChannelsCard(props: QuickSettingsProps) {
  const connectedCount = props.channels.filter((c) => c.connected).length;
  const badge =
    connectedCount > 0
      ? html`<span class="qs-badge qs-badge--ok">${connectedCount} 个已连接</span>`
      : undefined;

  return html`
    <div class="qs-card">
      ${renderCardHeader(icons.send, "通信渠道", badge)}
      <div class="qs-card__body">
        ${props.channels.length === 0
          ? html`<div class="qs-empty muted">尚未配置通信渠道</div>`
          : props.channels.map(
              (ch) => html`
                <div class="qs-row">
                  <span class="qs-row__label">
                    <span class="qs-status-dot ${ch.connected ? "qs-status-dot--ok" : ""}"></span>
                    ${ch.label}
                  </span>
                  <span class="qs-row__value">
                    ${ch.connected
                      ? html`<span class="muted">${ch.detail ?? "已连接"}</span>`
                      : html`<button
                          class="qs-link-btn"
                          @click=${() => props.onChannelConfigure?.(ch.id)}
                        >
                          连接 →
                        </button>`}
                  </span>
                </div>
              `,
            )}
      </div>
    </div>
  `;
}

function renderApiKeysCard(props: QuickSettingsProps) {
  return html`
    <div class="qs-card">
      ${renderCardHeader(icons.plug, "API 密钥")}
      <div class="qs-card__body">
        ${props.apiKeys.length === 0
          ? html`<div class="qs-empty muted">尚未配置 API 密钥</div>`
          : props.apiKeys.map(
              (key) => html`
                <div class="qs-row">
                  <span class="qs-row__label">${key.label}</span>
                  <span class="qs-row__value">
                    ${key.isSet
                      ? html`
                          <code class="qs-masked">${key.masked ?? "••••••••"}</code>
                          <button
                            class="qs-link-btn"
                            @click=${() => props.onApiKeyChange?.(key.provider)}
                          >
                            更改
                          </button>
                        `
                      : html`<button
                          class="qs-link-btn"
                          @click=${() => props.onApiKeyChange?.(key.provider)}
                        >
                          添加 →
                        </button>`}
                  </span>
                </div>
              `,
            )}
      </div>
    </div>
  `;
}

function renderAutomationsCard(props: QuickSettingsProps) {
  const { cronJobCount, skillCount, mcpServerCount } = props.automation;

  return html`
    <div class="qs-card">
      ${renderCardHeader(icons.zap, "自动化")}
      <div class="qs-card__body">
        <div class="qs-row">
          <span class="qs-row__label">${cronJobCount} 个计划任务</span>
          <button class="qs-link-btn" @click=${props.onManageCron}>管理 →</button>
        </div>
        <div class="qs-row">
          <span class="qs-row__label">${skillCount} 个技能已安装</span>
          <button class="qs-link-btn" @click=${props.onBrowseSkills}>浏览 →</button>
        </div>
        <div class="qs-row">
          <span class="qs-row__label">${mcpServerCount} 个 MCP 服务器</span>
          <button class="qs-link-btn" @click=${props.onConfigureMcp}>配置 →</button>
        </div>
      </div>
    </div>
  `;
}

function renderSecurityCard(props: QuickSettingsProps) {
  const { gatewayAuth, execPolicy, deviceAuth } = props.security;

  return html`
    <div class="qs-card">
      ${renderCardHeader(
        icons.eye,
        "安全",
        html`<button class="qs-link-btn" @click=${props.onSecurityConfigure}>配置 →</button>`,
      )}
      <div class="qs-card__body">
        <div class="qs-row">
          <span class="qs-row__label">网关认证</span>
          <span class="qs-row__value">
            <span class="qs-badge ${gatewayAuth !== "none" ? "qs-badge--ok" : "qs-badge--warn"}"
              >${gatewayAuth}</span
            >
          </span>
        </div>
        <div class="qs-row">
          <span class="qs-row__label">执行策略</span>
          <span class="qs-row__value"><span class="qs-badge">${execPolicy}</span></span>
        </div>
        <div class="qs-row">
          <span class="qs-row__label">设备认证</span>
          <span class="qs-row__value">
            <span class="qs-badge ${deviceAuth ? "qs-badge--ok" : "qs-badge--warn"}"
              >${deviceAuth ? "已启用" : "已禁用"}</span
            >
          </span>
        </div>
      </div>
    </div>
  `;
}

function renderAppearanceCard(props: QuickSettingsProps) {
  return html`
    <div class="qs-card">
      ${renderCardHeader(icons.spark, "外观")}
      <div class="qs-card__body">
        <div class="qs-row">
          <span class="qs-row__label">主题</span>
          <div class="qs-segmented">
            ${THEME_OPTIONS.map(
              (opt) => html`
                <button
                  class="qs-segmented__btn ${opt.id === props.theme
                    ? "qs-segmented__btn--active"
                    : ""}"
                  @click=${(e: Event) => {
                    if (opt.id !== props.theme) {
                      props.setTheme(opt.id, {
                        element: (e.currentTarget as HTMLElement) ?? undefined,
                      });
                    }
                  }}
                >
                  ${opt.label}
                </button>
              `,
            )}
          </div>
        </div>
        <div class="qs-row">
          <span class="qs-row__label">模式</span>
          <div class="qs-segmented">
            ${(["light", "dark", "system"] as ThemeMode[]).map(
              (mode) => html`
                <button
                  class="qs-segmented__btn ${mode === props.themeMode
                    ? "qs-segmented__btn--active"
                    : ""}"
                  @click=${(e: Event) => {
                    if (mode !== props.themeMode) {
                      props.setThemeMode(mode, {
                        element: (e.currentTarget as HTMLElement) ?? undefined,
                      });
                    }
                  }}
                >
                  ${THEME_MODE_LABELS[mode]}
                </button>
              `,
            )}
          </div>
        </div>
        <div class="qs-row">
          <span class="qs-row__label">圆角</span>
          <div class="qs-segmented">
            ${BORDER_RADIUS_STOPS.map(
              (stop) => html`
                <button
                  class="qs-segmented__btn qs-segmented__btn--compact ${stop.value ===
                  props.borderRadius
                    ? "qs-segmented__btn--active"
                    : ""}"
                  @click=${() => props.setBorderRadius(stop.value)}
                >
                  ${stop.label}
                </button>
              `,
            )}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPresetsCard(props: QuickSettingsProps) {
  const activePreset = props.configObject ? detectActivePreset(props.configObject) : "personal";

  return html`
    <div class="qs-card qs-card--span-all">
      ${renderCardHeader(icons.zap, "配置方案")}
      <div class="qs-card__body qs-presets-grid">
        ${CONFIG_PRESETS.map(
          (preset) => html`
            <button
              class="qs-preset ${preset.id === activePreset ? "qs-preset--active" : ""}"
              @click=${() => props.onApplyPreset?.(preset.id)}
            >
              <span class="qs-preset__icon">${preset.icon}</span>
              <span class="qs-preset__label">${preset.label}</span>
              <span class="qs-preset__desc muted">${preset.description}</span>
            </button>
          `,
        )}
      </div>
    </div>
  `;
}

function renderConnectionFooter(props: QuickSettingsProps) {
  return html`
    <div class="qs-footer">
      <div class="qs-footer__row">
        <span class="qs-status-dot ${props.connected ? "qs-status-dot--ok" : ""}"></span>
        <span class="muted">${props.connected ? "已连接" : "离线"}</span>
        ${props.assistantName ? html`<span class="muted">· ${props.assistantName}</span>` : nothing}
        ${props.version ? html`<span class="muted">· v${props.version}</span>` : nothing}
      </div>
    </div>
  `;
}

// ── Main render ──

export function renderQuickSettings(props: QuickSettingsProps) {
  return html`
    <div class="qs-container">
      <div class="qs-header">
        <h2 class="qs-header__title">${icons.settings} 设置</h2>
        <button class="btn btn--sm" @click=${props.onAdvancedSettings}>
          高级设置 ${icons.chevronRight}
        </button>
      </div>

      <div class="qs-grid">
        ${renderModelCard(props)} ${renderChannelsCard(props)} ${renderApiKeysCard(props)}
        ${renderRemoteModelCard(props)} ${renderAutomationsCard(props)} ${renderSecurityCard(props)}
        ${renderAppearanceCard(props)} ${renderPresetsCard(props)}
      </div>

      ${renderConnectionFooter(props)}
    </div>
  `;
}
