import type { ZhushouConfig } from "../config/types.zhushou.js";
import { PRODUCT_NAME } from "./assistant-constants.js";

export type WizardTemplate = {
  id: string;
  name: string;
  description: string;
  /** Partial config that this template applies on top of a base config. */
  config: Partial<ZhushouConfig>;
};

/**
 * Built-in one-click initialization templates.
 *
 * Each template targets a common deployment scenario.
 * Apply with `applyTemplate(baseConfig, template)`.
 */
export const WIZARD_TEMPLATES: readonly WizardTemplate[] = [
  {
    id: "minimal",
    name: "最小化（本地回环）",
    description: "纯本地 loopback 网关，Token 认证，无 Tailscale。最低资源占用，适合单机个人使用。",
    config: {
      ui: { assistant: { name: PRODUCT_NAME } },
      gateway: {
        mode: "local",
        bind: "loopback",
        auth: { mode: "token" },
        tailscale: { mode: "off", resetOnExit: false },
      },
    },
  },
  {
    id: "lan",
    name: "局域网共享",
    description: "绑定至 0.0.0.0，局域网内可访问。强制 Token 认证以保护接入。",
    config: {
      ui: { assistant: { name: PRODUCT_NAME } },
      gateway: {
        mode: "local",
        bind: "lan",
        auth: { mode: "token" },
        tailscale: { mode: "off", resetOnExit: false },
      },
    },
  },
  {
    id: "tailscale-serve",
    name: "Tailscale Serve（内网穿透）",
    description:
      "通过 Tailscale Serve 将网关暴露至 Tailnet。需已安装并登录 Tailscale，gateway.bind 强制为 loopback。",
    config: {
      ui: { assistant: { name: PRODUCT_NAME } },
      gateway: {
        mode: "local",
        bind: "loopback",
        auth: { mode: "token" },
        tailscale: { mode: "serve", resetOnExit: true },
      },
    },
  },
  {
    id: "tailscale-funnel",
    name: "Tailscale Funnel（公网访问）",
    description:
      "通过 Tailscale Funnel 将网关公开至公网。必须使用密码认证（funnel 要求）。请确保了解安全风险。",
    config: {
      ui: { assistant: { name: PRODUCT_NAME } },
      gateway: {
        mode: "local",
        bind: "loopback",
        auth: { mode: "password" },
        tailscale: { mode: "funnel", resetOnExit: true },
      },
    },
  },
  {
    id: "remote-gateway",
    name: "远程网关（仅客户端）",
    description: "本机作为远程网关的客户端，不在本地启动网关服务。",
    config: {
      ui: { assistant: { name: PRODUCT_NAME } },
      gateway: {
        mode: "remote",
      },
    },
  },
];

/**
 * Find a template by ID. Returns `undefined` if not found.
 */
export function findTemplate(id: string): WizardTemplate | undefined {
  return WIZARD_TEMPLATES.find((t) => t.id === id);
}

/**
 * Deep-merge a template's config onto a base config.
 * Template values take precedence over existing base values for matching paths,
 * but do not delete unrelated keys.
 */
export function applyTemplate(base: ZhushouConfig, template: WizardTemplate): ZhushouConfig {
  return deepMerge(base, template.config) as ZhushouConfig;
}

function deepMerge(target: unknown, source: unknown): unknown {
  if (source === null || source === undefined) {
    return target;
  }
  if (target === null || target === undefined) {
    return structuredClone(source);
  }
  if (typeof source !== "object" || Array.isArray(source)) {
    return structuredClone(source);
  }
  if (typeof target !== "object" || Array.isArray(target)) {
    return structuredClone(source);
  }

  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  for (const [key, val] of Object.entries(source as Record<string, unknown>)) {
    result[key] = deepMerge(result[key], val);
  }
  return result;
}

/**
 * Format a list of templates for display in a wizard select prompt.
 */
export function templateSelectOptions(): Array<{ value: string; label: string; hint: string }> {
  return [
    ...WIZARD_TEMPLATES.map((t) => ({
      value: t.id,
      label: t.name,
      hint: t.description,
    })),
    {
      value: "__skip__",
      label: "跳过（手动配置）",
      hint: "不应用模板，逐项手动配置",
    },
  ];
}
