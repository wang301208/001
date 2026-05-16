export class GatewayError {
  readonly _tag = "GatewayError";
  constructor(readonly reason: string, readonly cause?: unknown) {}
}

export class ModelError {
  readonly _tag = "ModelError";
  constructor(
    readonly reason: string,
    readonly modelId: string,
    readonly retryable: boolean,
    readonly cause?: unknown,
  ) {}
}

export class ChannelError {
  readonly _tag = "ChannelError";
  constructor(
    readonly reason: string,
    readonly channelId: string,
    readonly recoverable: boolean,
    readonly cause?: unknown,
  ) {}
}

export class SessionError {
  readonly _tag = "SessionError";
  constructor(
    readonly reason: string,
    readonly sessionKey: string,
    readonly cause?: unknown,
  ) {}
}
