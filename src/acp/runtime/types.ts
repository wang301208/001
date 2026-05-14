export type AcpRuntimePromptMode = "prompt" | "steer";

export type AcpRuntimeSessionMode = "persistent" | "oneshot";

export type AcpSessionUpdateTag =
  | "agent_message_chunk"
  | "agent_thought_chunk"
  | "tool_call"
  | "tool_call_update"
  | "usage_update"
  | "available_commands_update"
  | "current_mode_update"
  | "config_option_update"
  | "session_info_update"
  | "plan"
  | (string & {});

export type AcpRuntimeControl = "session/set_mode" | "session/set_config_option" | "session/status";

export type AcpRuntimeHandle = {
  sessionKey: string;
  backend: string;
  runtimeSessionName: string;
  /** 此 ACP 会话的有效运行时工作目录（如适配器/运行时暴露）。 */
  cwd?: string;
  /** 后端本地记录标识符（如适配器/运行时暴露，例如 acpx 记录 ID）。 */
  acpxRecordId?: string;
  /** 后端级 ACP 会话标识符（如适配器/运行时暴露）。 */
  backendSessionId?: string;
  /** 上游框架会话标识符（如适配器/运行时暴露）。 */
  agentSessionId?: string;
};

export type AcpRuntimeEnsureInput = {
  sessionKey: string;
  agent: string;
  mode: AcpRuntimeSessionMode;
  resumeSessionId?: string;
  cwd?: string;
  env?: Record<string, string>;
};

export type AcpRuntimeTurnAttachment = {
  mediaType: string;
  data: string;
};

export type AcpRuntimeTurnInput = {
  handle: AcpRuntimeHandle;
  text: string;
  attachments?: AcpRuntimeTurnAttachment[];
  mode: AcpRuntimePromptMode;
  requestId: string;
  signal?: AbortSignal;
};

export type AcpRuntimeCapabilities = {
  controls: AcpRuntimeControl[];
  /**
   * 可选的后端通告选项键，用于 session/set_config_option。
   * 空/未定义表示"后端接受键，但未通告严格列表"。
   */
  configOptionKeys?: string[];
};

export type AcpRuntimeStatus = {
  summary?: string;
  /** 后端本地记录标识符（如适配器/运行时暴露）。 */
  acpxRecordId?: string;
  /** 后端级 ACP 会话标识符（如状态查询时已知）。 */
  backendSessionId?: string;
  /** 上游框架会话标识符（如状态查询时已知）。 */
  agentSessionId?: string;
  details?: Record<string, unknown>;
};

export type AcpRuntimeDoctorReport = {
  ok: boolean;
  code?: string;
  message: string;
  installCommand?: string;
  details?: string[];
};

export type AcpRuntimeEvent =
  | {
      type: "text_delta";
      text: string;
      stream?: "output" | "thought";
      tag?: AcpSessionUpdateTag;
    }
  | {
      type: "status";
      text: string;
      tag?: AcpSessionUpdateTag;
      used?: number;
      size?: number;
    }
  | {
      type: "tool_call";
      text: string;
      tag?: AcpSessionUpdateTag;
      toolCallId?: string;
      status?: string;
      title?: string;
    }
  | {
      type: "done";
      stopReason?: string;
    }
  | {
      type: "error";
      message: string;
      code?: string;
      retryable?: boolean;
    };

export interface AcpRuntime {
  ensureSession(input: AcpRuntimeEnsureInput): Promise<AcpRuntimeHandle>;

  runTurn(input: AcpRuntimeTurnInput): AsyncIterable<AcpRuntimeEvent>;

  getCapabilities?(input: {
    handle?: AcpRuntimeHandle;
  }): Promise<AcpRuntimeCapabilities> | AcpRuntimeCapabilities;

  getStatus?(input: { handle: AcpRuntimeHandle; signal?: AbortSignal }): Promise<AcpRuntimeStatus>;

  setMode?(input: { handle: AcpRuntimeHandle; mode: string }): Promise<void>;

  setConfigOption?(input: { handle: AcpRuntimeHandle; key: string; value: string }): Promise<void>;

  doctor?(): Promise<AcpRuntimeDoctorReport>;

  /**
   * 准备此会话键的下一次 ensureSession 从全新状态开始，
   * 而非重新打开后端拥有的持久状态。
   */
  prepareFreshSession?(input: { sessionKey: string }): Promise<void>;

  cancel(input: { handle: AcpRuntimeHandle; reason?: string }): Promise<void>;

  close(input: {
    handle: AcpRuntimeHandle;
    reason: string;
    /**
     * 丢弃后端拥有的持久会话状态，使下一次 ensureSession
     * 从全新状态开始，而非重新打开同一对话。
     */
    discardPersistentState?: boolean;
  }): Promise<void>;
}
