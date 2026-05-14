export function missingTargetMessage(provider: string, hint?: string): string {
  return `向 ${provider} 发送需要目标${formatTargetHint(hint)}`;
}

export function missingTargetError(provider: string, hint?: string): Error {
  return new Error(missingTargetMessage(provider, hint));
}

export function ambiguousTargetMessage(provider: string, raw: string, hint?: string): string {
  return `${provider} 的目标 "${raw}" 不明确。请提供唯一名称或显式 ID。${formatTargetHint(hint, true)}`;
}

export function ambiguousTargetError(provider: string, raw: string, hint?: string): Error {
  return new Error(ambiguousTargetMessage(provider, raw, hint));
}

export function unknownTargetMessage(provider: string, raw: string, hint?: string): string {
  return `${provider} 的未知目标 "${raw}"。${formatTargetHint(hint, true)}`;
}

export function unknownTargetError(provider: string, raw: string, hint?: string): Error {
  return new Error(unknownTargetMessage(provider, raw, hint));
}

function formatTargetHint(hint?: string, withLabel = false): string {
  const normalized = hint?.trim();
  if (!normalized) {
    return "";
  }
  return withLabel ? ` 提示：${normalized}` : ` ${normalized}`;
}
