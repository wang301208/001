import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayRequestHandlerOptions } from "./types.js";
import { modelsHandlers } from "./models.js";

const originalFetch = globalThis.fetch;

function createOptions(
  params: Record<string, unknown>,
): GatewayRequestHandlerOptions & { respond: ReturnType<typeof vi.fn> } {
  const respond = vi.fn();
  return {
    req: { type: "req", id: "req-1", method: "models.remoteList", params },
    params,
    client: null,
    isWebchatConnect: () => false,
    respond,
    context: {} as unknown,
  } as unknown as GatewayRequestHandlerOptions & { respond: ReturnType<typeof vi.fn> };
}

describe("models.remoteList", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it("fetches OpenAI-compatible /models from the provided remote endpoint", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "remote-gpt", object: "model" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const opts = createOptions({
      provider: "Custom OpenAI",
      endpoint: "https://models.example.test/v1",
      apiKey: "sk-test",
      api: "openai-completions",
    });

    await modelsHandlers["models.remoteList"](opts);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://models.example.test/v1/models",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test",
        }),
      }),
    );
    expect(opts.respond).toHaveBeenCalledWith(
      true,
      {
        models: [{ id: "remote-gpt", name: "remote-gpt", provider: "custom-openai" }],
      },
      undefined,
    );
  });

  it("fetches Ollama /api/tags from the provided remote endpoint", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [{ name: "llama3.1:8b" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const opts = createOptions({
      provider: "Ollama Lab",
      endpoint: "http://127.0.0.1:11434",
      api: "ollama",
    });

    await modelsHandlers["models.remoteList"](opts);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/tags",
      expect.objectContaining({ method: "GET" }),
    );
    expect(opts.respond).toHaveBeenCalledWith(
      true,
      {
        models: [{ id: "llama3.1:8b", name: "llama3.1:8b", provider: "ollama-lab" }],
      },
      undefined,
    );
  });

  it("fetches Anthropic /models from the provided remote endpoint", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "claude-sonnet-4-6" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const opts = createOptions({
      provider: "Anthropic",
      endpoint: "https://api.anthropic.com/v1",
      apiKey: "sk-ant-test",
      api: "anthropic-messages",
    });

    await modelsHandlers["models.remoteList"](opts);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/models",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "x-api-key": "sk-ant-test",
          "anthropic-version": expect.any(String),
        }),
      }),
    );
    expect(opts.respond).toHaveBeenCalledWith(
      true,
      {
        models: [{ id: "claude-sonnet-4-6", name: "claude-sonnet-4-6", provider: "anthropic" }],
      },
      undefined,
    );
  });

  it("fetches Google Gemini /models from the provided remote endpoint", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [{ name: "models/gemini-2.5-pro", displayName: "Gemini 2.5 Pro" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const opts = createOptions({
      provider: "Google",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "google-test",
      api: "google-generative-ai",
    });

    await modelsHandlers["models.remoteList"](opts);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models?key=google-test",
      expect.objectContaining({ method: "GET" }),
    );
    expect(opts.respond).toHaveBeenCalledWith(
      true,
      {
        models: [{ id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google" }],
      },
      undefined,
    );
  });

  it("rejects unsupported remote API types", async () => {
    const opts = createOptions({
      endpoint: "https://models.example.test/v1",
      apiKey: "sk-test",
      api: "unknown-api",
    });

    await modelsHandlers["models.remoteList"](opts);

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("invalid models.remoteList params"),
      }),
    );
  });

  it("rejects incomplete remote probe params without falling back to the local model catalog", async () => {
    const opts = createOptions({
      endpoint: "",
      api: "openai-completions",
    });

    await modelsHandlers["models.remoteList"](opts);

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("endpoint"),
      }),
    );
  });
});
