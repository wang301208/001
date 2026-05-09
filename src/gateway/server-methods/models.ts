import { DEFAULT_PROVIDER } from "../../agents/defaults.js";
import { buildAllowedModelSet } from "../../agents/model-selection.js";
import { loadConfig } from "../../config/config.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateModelsListParams,
  validateModelsRemoteListParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const REMOTE_MODEL_PROBE_TIMEOUT_MS = 15_000;

function normalizeConfigKey(value: string, fallback: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-.]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback
  );
}

function appendEndpointPath(endpoint: string, path: string): string {
  const url = new URL(endpoint);
  const basePath = url.pathname.replace(/\/+$/g, "");
  url.pathname = `${basePath}${path}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function appendGoogleApiKey(urlRaw: string, apiKey: string): string {
  const url = new URL(urlRaw);
  url.searchParams.set("key", apiKey);
  return url.toString();
}

function parseDataIdModels(payload: unknown, provider: string) {
  const data = Array.isArray((payload as { data?: unknown })?.data)
    ? ((payload as { data: unknown[] }).data)
    : [];
  return data
    .map((entry) => {
      const id = typeof (entry as { id?: unknown })?.id === "string"
        ? (entry as { id: string }).id.trim()
        : "";
      return id ? { id, name: id, provider } : null;
    })
    .filter((entry): entry is { id: string; name: string; provider: string } => Boolean(entry));
}

function parseGoogleModels(payload: unknown, provider: string) {
  const models = Array.isArray((payload as { models?: unknown })?.models)
    ? ((payload as { models: unknown[] }).models)
    : [];
  return models
    .map((entry) => {
      const rawName = typeof (entry as { name?: unknown })?.name === "string"
        ? (entry as { name: string }).name.trim()
        : "";
      const id = rawName.startsWith("models/") ? rawName.slice("models/".length) : rawName;
      const displayName = typeof (entry as { displayName?: unknown })?.displayName === "string"
        ? (entry as { displayName: string }).displayName.trim()
        : "";
      return id ? { id, name: displayName || id, provider } : null;
    })
    .filter((entry): entry is { id: string; name: string; provider: string } => Boolean(entry));
}

function parseOllamaModels(payload: unknown, provider: string) {
  const models = Array.isArray((payload as { models?: unknown })?.models)
    ? ((payload as { models: unknown[] }).models)
    : [];
  return models
    .map((entry) => {
      const name = typeof (entry as { name?: unknown })?.name === "string"
        ? (entry as { name: string }).name.trim()
        : "";
      return name ? { id: name, name, provider } : null;
    })
    .filter((entry): entry is { id: string; name: string; provider: string } => Boolean(entry));
}

function buildRemoteModelProbeRequest(params: {
  endpoint: string;
  api: string;
  apiKey: string;
}): { url: string; headers: Record<string, string>; parser: (payload: unknown, provider: string) => Array<{ id: string; name: string; provider: string }> } {
  switch (params.api) {
    case "openai-completions":
    case "openai-responses":
      return {
        url: appendEndpointPath(params.endpoint, "/models"),
        headers: {
          Accept: "application/json",
          ...(params.apiKey ? { Authorization: `Bearer ${params.apiKey}` } : {}),
        },
        parser: parseDataIdModels,
      };
    case "anthropic-messages":
      return {
        url: appendEndpointPath(params.endpoint, "/models"),
        headers: {
          Accept: "application/json",
          "x-api-key": params.apiKey,
          "anthropic-version": "2023-06-01",
        },
        parser: parseDataIdModels,
      };
    case "google-generative-ai":
      return {
        url: appendGoogleApiKey(appendEndpointPath(params.endpoint, "/models"), params.apiKey),
        headers: { Accept: "application/json" },
        parser: parseGoogleModels,
      };
    case "ollama":
      return {
        url: appendEndpointPath(params.endpoint, "/api/tags"),
        headers: { Accept: "application/json" },
        parser: parseOllamaModels,
      };
    default:
      throw new Error(`unsupported api: ${params.api}`);
  }
}

function remoteProbeFailureMessage(status: number): string {
  if (status === 401 || status === 403) {
    return `remote model probe failed: HTTP ${status} (authentication or permission rejected)`;
  }
  if (status === 404) {
    return "remote model probe failed: HTTP 404 (model list endpoint not found)";
  }
  return `remote model probe failed: HTTP ${status}`;
}

export const modelsHandlers: GatewayRequestHandlers = {
  "models.list": async ({ params, respond, context }) => {
    if (!validateModelsListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid models.list params: ${formatValidationErrors(validateModelsListParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const catalog = await context.loadGatewayModelCatalog();
      const cfg = loadConfig();
      const { allowedCatalog } = buildAllowedModelSet({
        cfg,
        catalog,
        defaultProvider: DEFAULT_PROVIDER,
      });
      const models = allowedCatalog.length > 0 ? allowedCatalog : catalog;
      respond(true, { models }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "models.remoteList": async ({ params, respond }) => {
    if (!validateModelsRemoteListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid models.remoteList params: ${formatValidationErrors(validateModelsRemoteListParams.errors)}`,
        ),
      );
      return;
    }

    const endpoint = params.endpoint.trim();
    const api = params.api;
    const apiKey = params.apiKey?.trim() ?? "";
    const provider = normalizeConfigKey(params.provider ?? "", "custom");

    if (!endpoint) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "endpoint is required"));
      return;
    }
    if (api !== "ollama" && !apiKey) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "apiKey is required"));
      return;
    }

    let request: ReturnType<typeof buildRemoteModelProbeRequest>;
    try {
      request = buildRemoteModelProbeRequest({ endpoint, api, apiKey });
    } catch (err) {
      const message = err instanceof TypeError
        ? "endpoint must be a valid URL"
        : err instanceof Error ? err.message : String(err);
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, message));
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REMOTE_MODEL_PROBE_TIMEOUT_MS);

    try {
      const response = await fetch(request.url, {
        method: "GET",
        headers: request.headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.UNAVAILABLE, remoteProbeFailureMessage(response.status)),
        );
        return;
      }

      const payload = await response.json() as unknown;
      const models = request.parser(payload, provider);
      respond(true, { models }, undefined);
    } catch (err) {
      const message = err instanceof Error && err.name === "AbortError"
        ? "remote model probe timed out"
        : `remote model probe failed: ${err instanceof Error ? err.message : String(err)}`;
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    } finally {
      clearTimeout(timeout);
    }
  },
};
