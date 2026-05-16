export type CircuitBreakerState = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private state: CircuitBreakerState = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private readonly failureThreshold = 5,
    private readonly recoveryTimeoutMs = 30_000,
    private readonly halfOpenSuccessThreshold = 3,
  ) {}

  get currentState(): CircuitBreakerState {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.recoveryTimeoutMs) {
        this.state = "half-open";
        this.successCount = 0;
      }
    }
    return this.state;
  }

  get isAvailable(): boolean {
    return this.currentState !== "open";
  }

  recordSuccess(): void {
    this.successCount++;
    if (this.state === "half-open" && this.successCount >= this.halfOpenSuccessThreshold) {
      this.state = "closed";
      this.failureCount = 0;
      this.successCount = 0;
    }
    if (this.state === "closed") {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;
    if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
    }
  }

  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }

  get stats(): { state: CircuitBreakerState; failureCount: number; successCount: number; lastFailureTime: number } {
    return {
      state: this.currentState,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}
