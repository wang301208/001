import { resolveApprovalOverGateway } from "zhushou/plugin-sdk/approval-gateway-runtime";
import type { ExecApprovalReplyDecision } from "zhushou/plugin-sdk/approval-runtime";
import type { ZhushouConfig } from "zhushou/plugin-sdk/config-runtime";
import { isApprovalNotFoundError } from "zhushou/plugin-sdk/error-runtime";

export { isApprovalNotFoundError };

export async function resolveMatrixApproval(params: {
  cfg: ZhushouConfig;
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
