import type { ZhushouConfig } from "../../config/types.zhushou.js";
import { findNormalizedProviderValue, normalizeProviderId } from "../model-selection.js";
import { resolveProviderIdForAuth } from "../provider-auth-aliases.js";
import {
  evaluateStoredCredentialEligibility,
  type AuthCredentialReasonCode,
} from "./credential-state.js";
import { dedupeProfileIds, listProfilesForProvider } from "./profiles.js";
import type { AuthProfileStore } from "./types.js";
import {
  clearExpiredCooldowns,
  isProfileInCooldown,
  resolveProfileUnusableUntil,
} from "./usage.js";

export type AuthProfileEligibilityReasonCode =
  | AuthCredentialReasonCode
  | "profile_missing"
  | "provider_mismatch"
  | "mode_mismatch";

export type AuthProfileEligibility = {
  eligible: boolean;
  reasonCode: AuthProfileEligibilityReasonCode;
};

export function resolveAuthProfileEligibility(params: {
  cfg?: ZhushouConfig;
  store: AuthProfileStore;
  provider: string;
  profileId: string;
  now?: number;
}): AuthProfileEligibility {
  const providerAuthKey = resolveProviderIdForAuth(params.provider, { config: params.cfg });
  const cred = params.store.profiles[params.profileId];
  if (!cred) {
    return { eligible: false, reasonCode: "profile_missing" };
  }
  if (resolveProviderIdForAuth(cred.provider, { config: params.cfg }) !== providerAuthKey) {
    return { eligible: false, reasonCode: "provider_mismatch" };
  }
  const profileConfig = params.cfg?.auth?.profiles?.[params.profileId];
  if (profileConfig) {
    if (
      resolveProviderIdForAuth(profileConfig.provider, { config: params.cfg }) !== providerAuthKey
    ) {
      return { eligible: false, reasonCode: "provider_mismatch" };
    }
    if (profileConfig.mode !== cred.type) {
      const oauthCompatible = profileConfig.mode === "oauth" && cred.type === "token";
      if (!oauthCompatible) {
        return { eligible: false, reasonCode: "mode_mismatch" };
      }
    }
  }
  const credentialEligibility = evaluateStoredCredentialEligibility({
    credential: cred,
    now: params.now,
  });
  return {
    eligible: credentialEligibility.eligible,
    reasonCode: credentialEligibility.reasonCode,
  };
}

export function resolveAuthProfileOrder(params: {
  cfg?: ZhushouConfig;
  store: AuthProfileStore;
  provider: string;
  preferredProfile?: string;
}): string[] {
  const { cfg, store, provider, preferredProfile } = params;
  const providerKey = normalizeProviderId(provider);
  const providerAuthKey = resolveProviderIdForAuth(provider, { config: cfg });
  const now = Date.now();

  // 清除自上次检查以来已过期的冷却，使配置文件
  // 获得新的错误计数，且在下一次瞬态故障时
  // 不会被立即重新惩罚。参见 #3604。
  clearExpiredCooldowns(store, now);
  const storedOrder = findNormalizedProviderValue(store.order, providerKey);
  const configuredOrder = findNormalizedProviderValue(cfg?.auth?.order, providerKey);
  const explicitOrder = storedOrder ?? configuredOrder;
  const explicitProfiles = cfg?.auth?.profiles
    ? Object.entries(cfg.auth.profiles)
        .filter(
          ([, profile]) =>
            resolveProviderIdForAuth(profile.provider, { config: cfg }) === providerAuthKey,
        )
        .map(([profileId]) => profileId)
    : [];
  const baseOrder =
    explicitOrder ??
    (explicitProfiles.length > 0 ? explicitProfiles : listProfilesForProvider(store, provider));
  if (baseOrder.length === 0) {
    return [];
  }

  const isValidProfile = (profileId: string): boolean =>
    resolveAuthProfileEligibility({
      cfg,
      store,
      provider,
      profileId,
      now,
    }).eligible;
  let filtered = baseOrder.filter(isValidProfile);

  // 修复配置/存储配置文件 ID 偏移（来自较旧的安装流程）：
  // 如果已配置的配置文件 ID 不再存在于 auth-profiles.json 中，
  // 扫描该提供者的已存储凭据并使用任何有效条目。
  const allBaseProfilesMissing = baseOrder.every((profileId) => !store.profiles[profileId]);
  if (filtered.length === 0 && explicitProfiles.length > 0 && allBaseProfilesMissing) {
    const storeProfiles = listProfilesForProvider(store, provider);
    filtered = storeProfiles.filter(isValidProfile);
  }

  const deduped = dedupeProfileIds(filtered);

  // 如果用户指定了显式顺序（存储覆盖或配置），完全尊重它，
  // 但仍应用冷却排序，以避免重复选择
  // 已知故障/限速的密钥作为首选候选。
  if (explicitOrder && explicitOrder.length > 0) {
    // ...但仍遵守冷却跟踪，以避免重复选择
    // 已知故障/限速的密钥作为首选候选。
    const available: string[] = [];
    const inCooldown: Array<{ profileId: string; cooldownUntil: number }> = [];

    for (const profileId of deduped) {
      if (isProfileInCooldown(store, profileId)) {
        const cooldownUntil =
          resolveProfileUnusableUntil(store.usageStats?.[profileId] ?? {}) ?? now;
        inCooldown.push({ profileId, cooldownUntil });
      } else {
        available.push(profileId);
      }
    }

    const cooldownSorted = inCooldown
      .toSorted((a, b) => a.cooldownUntil - b.cooldownUntil)
      .map((entry) => entry.profileId);

    const ordered = [...available, ...cooldownSorted];

    // 如果指定了 preferredProfile，仍将其放在首位
    if (preferredProfile && ordered.includes(preferredProfile)) {
      return [preferredProfile, ...ordered.filter((e) => e !== preferredProfile)];
    }
    return ordered;
  }

  // 否则使用轮转轮询：按 lastUsed 排序（最旧的优先）
  // preferredProfile 如果指定则排在最前（用于显式用户选择）
  // lastGood 不被优先 — 那会破坏轮转轮询
  const sorted = orderProfilesByMode(deduped, store);

  if (preferredProfile && sorted.includes(preferredProfile)) {
    return [preferredProfile, ...sorted.filter((e) => e !== preferredProfile)];
  }

  return sorted;
}

function orderProfilesByMode(order: string[], store: AuthProfileStore): string[] {
  const now = Date.now();

  // 划分为可用和在冷却中
  const available: string[] = [];
  const inCooldown: string[] = [];

  for (const profileId of order) {
    if (isProfileInCooldown(store, profileId)) {
      inCooldown.push(profileId);
    } else {
      available.push(profileId);
    }
  }

  // 按类型偏好排序可用配置文件，然后按 lastUsed 排序（最旧优先 = 类型内轮转轮询）
  const scored = available.map((profileId) => {
    const type = store.profiles[profileId]?.type;
    const typeScore = type === "oauth" ? 0 : type === "token" ? 1 : type === "api_key" ? 2 : 3;
    const lastUsed = store.usageStats?.[profileId]?.lastUsed ?? 0;
    return { profileId, typeScore, lastUsed };
  });

  // 主排序：类型偏好（oauth > token > api_key）。
  // 次排序：lastUsed（最旧优先，类型内轮转轮询）。
  const sorted = scored
    .toSorted((a, b) => {
      // 首先按类型（oauth > token > api_key）
      if (a.typeScore !== b.typeScore) {
        return a.typeScore - b.typeScore;
      }
      // 然后按 lastUsed（最旧优先）
      return a.lastUsed - b.lastUsed;
    })
    .map((entry) => entry.profileId);

  // 在末尾追加冷却中的配置文件（按冷却到期排序，最早到期优先）
  const cooldownSorted = inCooldown
    .map((profileId) => ({
      profileId,
      cooldownUntil: resolveProfileUnusableUntil(store.usageStats?.[profileId] ?? {}) ?? now,
    }))
    .toSorted((a, b) => a.cooldownUntil - b.cooldownUntil)
    .map((entry) => entry.profileId);

  return [...sorted, ...cooldownSorted];
}
