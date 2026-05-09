import { resolveApprovalOverGateway } from "assistant/plugin-sdk/approval-gateway-runtime";
import type { ExecApprovalReplyDecision } from "assistant/plugin-sdk/approval-runtime";
import type { AssistantConfig } from "assistant/plugin-sdk/config-runtime";
import { isApprovalNotFoundError } from "assistant/plugin-sdk/error-runtime";

export { isApprovalNotFoundError };

export async function resolveMatrixApproval(params: {
  cfg: AssistantConfig;
  approvalId: string;
  decision: ExecApprovalReplyDecision;
  senderId?: string | null;
  gatewayUrl?: string;
}): Promise<void> {
  await resolveApprovalOverGateway({
    cfg: params.cfg,
    approvalId: params.approvalId,
    decision: params.decision,
    senderId: params.senderId,
    gatewayUrl: params.gatewayUrl,
    clientDisplayName: `Matrix approval (${params.senderId?.trim() || "unknown"})`,
  });
}
