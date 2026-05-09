import { resolveApprovalOverGateway } from "assistant/plugin-sdk/approval-gateway-runtime";
import type { AssistantConfig } from "assistant/plugin-sdk/config-runtime";
import type { ExecApprovalReplyDecision } from "assistant/plugin-sdk/infra-runtime";

export type ResolveTelegramExecApprovalParams = {
  cfg: AssistantConfig;
  approvalId: string;
  decision: ExecApprovalReplyDecision;
  senderId?: string | null;
  allowPluginFallback?: boolean;
  gatewayUrl?: string;
};

export async function resolveTelegramExecApproval(
  params: ResolveTelegramExecApprovalParams,
): Promise<void> {
  await resolveApprovalOverGateway({
    cfg: params.cfg,
    approvalId: params.approvalId,
    decision: params.decision,
    senderId: params.senderId,
    gatewayUrl: params.gatewayUrl,
    allowPluginFallback: params.allowPluginFallback,
    clientDisplayName: `Telegram approval (${params.senderId?.trim() || "unknown"})`,
  });
}
