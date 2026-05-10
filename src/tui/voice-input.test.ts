import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { captureVoiceInput, getVoiceInputSetupHint } from "./voice-input.js";

function createMockVoiceProcess(params: { stdout?: string; stderr?: string; code?: number }) {
  return () => {
    const proc = new EventEmitter() as EventEmitter & {
      stdout: PassThrough;
      stderr: PassThrough;
      kill: () => boolean;
    };
    proc.stdout = new PassThrough();
    proc.stderr = new PassThrough();
    proc.kill = () => true;
    queueMicrotask(() => {
      if (params.stdout) {
        proc.stdout.write(params.stdout);
      }
      if (params.stderr) {
        proc.stderr.write(params.stderr);
      }
      proc.emit("exit", params.code ?? 0, null);
    });
    return proc;
  };
}

describe("captureVoiceInput", () => {
  it("returns setup guidance when no voice command is configured", async () => {
    const result = await captureVoiceInput({ command: "" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected voice input setup failure");
    }
    expect(result.message).toContain("未配置");
    expect(result.setupHint).toContain("ASSISTANT_TUI_STT_COMMAND");
  });

  it("returns stdout transcript from the configured command", async () => {
    const result = await captureVoiceInput({
      command: "mock-stt",
      spawnProcess: createMockVoiceProcess({ stdout: "打开设置\n" }) as never,
    });

    expect(result).toEqual({ ok: true, text: "打开设置", source: "mock-stt" });
  });

  it("reports command failures instead of pretending voice is available", async () => {
    const result = await captureVoiceInput({
      command: "mock-stt",
      spawnProcess: createMockVoiceProcess({ stderr: "microphone unavailable", code: 1 }) as never,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected voice input command failure");
    }
    expect(result.message).toContain("microphone unavailable");
    expect(result.setupHint).toBe(getVoiceInputSetupHint());
  });
});
