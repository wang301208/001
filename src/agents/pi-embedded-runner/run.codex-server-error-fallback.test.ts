import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeZhushouMessageFixture } from "../test-helpers/zhushou-message-fixtures.js";
import { makeModelFallbackCfg } from "../test-helpers/model-fallback-config-fixture.js";
import { makeAttemptResult } from "./run.overflow-compaction.fixture.js";
import {
  loadRunOverflowCompactionHarness,
  MockedFailoverError,
  mockedClassifyFailoverReason,
  mockedFormatZhushouErrorText,
  mockedGlobalHookRunner,
  mockedIsFailoverZhushouError,
  mockedRunEmbeddedAttempt,
  overflowBaseRunParams,
  resetRunOverflowCompactionHarnessMocks,
} from "./run.overflow-compaction.harness.js";

let runEmbeddedPiAgent: typeof import("./run.js").runEmbeddedPiAgent;

describe("runEmbeddedPiAgent Codex server_error fallback handoff", () => {
  beforeAll(async () => {
    ({ runEmbeddedPiAgent } = await loadRunOverflowCompactionHarness());
  });

  beforeEach(() => {
    resetRunOverflowCompactionHarnessMocks();
    mockedGlobalHookRunner.hasHooks.mockImplementation(() => false);
  });

  it("throws FailoverError for Codex server_error when model fallbacks are configured", async () => {
    const rawCodexError =
      'Codex error: {"type":"error","error":{"type":"server_error","code":"server_error","message":"An error occurred while processing your request."},"sequence_number":2}';

    mockedClassifyFailoverReason.mockReturnValue("timeout");
    mockedIsFailoverZhushouError.mockReturnValue(true);
    mockedFormatZhushouErrorText.mockReturnValue(
      "LLM error server_error: An error occurred while processing your request.",
    );
    const currentAttemptZhushou = makeZhushouMessageFixture({
      stopReason: "error",
      errorMessage: rawCodexError,
      provider: "openai-codex",
      model: "gpt-5.4",
    });
    mockedRunEmbeddedAttempt.mockResolvedValueOnce(
      makeAttemptResult({
        zhushouTexts: [],
        lastZhushou: currentAttemptZhushou,
        currentAttemptZhushou,
      }),
    );

    const promise = runEmbeddedPiAgent({
      ...overflowBaseRunParams,
      runId: "run-codex-server-error-fallback",
      config: makeModelFallbackCfg({
        agents: {
          defaults: {
            model: {
              primary: "openai-codex/gpt-5.4",
              fallbacks: ["anthropic/claude-opus-4-6"],
            },
          },
        },
      }),
    });

    await expect(promise).rejects.toBeInstanceOf(MockedFailoverError);
    await expect(promise).rejects.toThrow(
      "LLM error server_error: An error occurred while processing your request.",
    );
  });
});
