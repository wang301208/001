import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeZhushouMessageFixture } from "../test-helpers/zhushou-message-fixtures.js";
import { makeModelFallbackCfg } from "../test-helpers/model-fallback-config-fixture.js";
import { makeAttemptResult } from "./run.overflow-compaction.fixture.js";
import {
  loadRunOverflowCompactionHarness,
  MockedFailoverError,
  mockedFormatZhushouErrorText,
  mockedGlobalHookRunner,
  mockedIsFailoverZhushouError,
  mockedIsRateLimitZhushouError,
  mockedRunEmbeddedAttempt,
  overflowBaseRunParams,
  resetRunOverflowCompactionHarnessMocks,
} from "./run.overflow-compaction.harness.js";
import type { EmbeddedRunAttemptResult } from "./run/types.js";

let runEmbeddedPiAgent: typeof import("./run.js").runEmbeddedPiAgent;
const DEEPSEEK_ERROR_MESSAGE = "429 deepseek rate limit";
const DEEPSEEK_ZHUSHOU_MATCHER = expect.objectContaining({
  provider: "deepseek",
  model: "deepseek-chat",
  errorMessage: DEEPSEEK_ERROR_MESSAGE,
});

function isCurrentAttemptZhushou(
  value: unknown,
): value is NonNullable<EmbeddedRunAttemptResult["currentAttemptZhushou"]> {
  return (
    typeof value === "object" &&
    value !== null &&
    "provider" in value &&
    "model" in value &&
    "errorMessage" in value
  );
}

function setupDeepseekFallbackErrorMatchers() {
  mockedIsFailoverZhushouError.mockImplementation((...args: unknown[]) => {
    const zhushou = args[0];
    return isCurrentAttemptZhushou(zhushou) && zhushou.provider === "deepseek";
  });
  mockedIsRateLimitZhushouError.mockImplementation((...args: unknown[]) => {
    const zhushou = args[0];
    return isCurrentAttemptZhushou(zhushou) && zhushou.provider === "deepseek";
  });
}

function captureFormattedZhushou() {
  let lastFormattedZhushou: unknown;
  mockedFormatZhushouErrorText.mockImplementation((...args: unknown[]) => {
    lastFormattedZhushou = args[0];
    if (!isCurrentAttemptZhushou(lastFormattedZhushou)) {
      return String(lastFormattedZhushou);
    }
    return `${lastFormattedZhushou.provider}/${lastFormattedZhushou.model}: ${lastFormattedZhushou.errorMessage}`;
  });
  return () => lastFormattedZhushou;
}

function makeCrossProviderFallbackConfig() {
  return makeModelFallbackCfg({
    agents: {
      defaults: {
        model: {
          primary: "openai-codex/gpt-5.4",
          fallbacks: ["deepseek/deepseek-chat", "google/gemini-2.5-flash"],
        },
      },
    },
  });
}

async function expectDeepseekFallbackError(
  promise: Promise<unknown>,
  getLastFormattedZhushou: () => unknown,
) {
  await expect(promise).rejects.toBeInstanceOf(MockedFailoverError);
  await expect(promise).rejects.toThrow(`deepseek/deepseek-chat: ${DEEPSEEK_ERROR_MESSAGE}`);
  expect(mockedIsRateLimitZhushouError).toHaveBeenCalledWith(DEEPSEEK_ZHUSHOU_MATCHER);
  expect(getLastFormattedZhushou()).toEqual(DEEPSEEK_ZHUSHOU_MATCHER);
}

describe("runEmbeddedPiAgent cross-provider fallback error handling", () => {
  beforeAll(async () => {
    ({ runEmbeddedPiAgent } = await loadRunOverflowCompactionHarness());
  });

  beforeEach(() => {
    resetRunOverflowCompactionHarnessMocks();
    mockedGlobalHookRunner.hasHooks.mockImplementation(() => false);
  });

  it("uses the current attempt zhushou for fallback errors instead of stale session history", async () => {
    setupDeepseekFallbackErrorMatchers();
    const getLastFormattedZhushou = captureFormattedZhushou();
    mockedRunEmbeddedAttempt.mockResolvedValueOnce(
      makeAttemptResult({
        zhushouTexts: [],
        lastZhushou: makeZhushouMessageFixture({
          stopReason: "error",
          errorMessage: "You have hit your ChatGPT usage limit (plus plan).",
          provider: "openai-codex",
          model: "gpt-5.4",
          content: [],
        }),
        currentAttemptZhushou: makeZhushouMessageFixture({
          stopReason: "error",
          errorMessage: DEEPSEEK_ERROR_MESSAGE,
          provider: "deepseek",
          model: "deepseek-chat",
          content: [],
        }),
      }),
    );

    const promise = runEmbeddedPiAgent({
      ...overflowBaseRunParams,
      runId: "run-cross-provider-fallback-error-context",
      config: makeCrossProviderFallbackConfig(),
    });

    await expectDeepseekFallbackError(promise, getLastFormattedZhushou);
  });

  it("falls back to the session zhushou when compaction removes the current attempt slice", async () => {
    setupDeepseekFallbackErrorMatchers();
    const getLastFormattedZhushou = captureFormattedZhushou();
    mockedRunEmbeddedAttempt.mockResolvedValueOnce(
      makeAttemptResult({
        zhushouTexts: [],
        lastZhushou: makeZhushouMessageFixture({
          stopReason: "error",
          errorMessage: DEEPSEEK_ERROR_MESSAGE,
          provider: "deepseek",
          model: "deepseek-chat",
          content: [],
        }),
        currentAttemptZhushou: undefined,
      }),
    );

    const promise = runEmbeddedPiAgent({
      ...overflowBaseRunParams,
      runId: "run-compaction-fallback-error-context",
      config: makeCrossProviderFallbackConfig(),
    });

    await expectDeepseekFallbackError(promise, getLastFormattedZhushou);
  });
});
