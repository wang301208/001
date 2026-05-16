import type { Context } from "hono";
import type { GatewayHonoEnv } from "./app.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

type NodeHttpHandler = (req: IncomingMessage, res: ServerResponse, opts: Record<string, unknown>) => Promise<boolean>;

export async function createHonoToNodeAdapter(
  c: Context<GatewayHonoEnv>,
  handler: NodeHttpHandler,
  opts: Record<string, unknown>,
): Promise<Response> {
  const url = new URL(c.req.url);
  const method = c.req.method;
  const rawHeaders = c.req.raw.headers;

  const bodyBuffer = method !== "GET" && method !== "HEAD" ? await c.req.arrayBuffer() : null;

  const req = buildIncomingMessage(method, url.pathname + url.search, rawHeaders, bodyBuffer);
  const { res, responsePromise } = buildServerResponse();

  const handled = await handler(req, res, opts);

  if (!handled) {
    return c.json({ ok: false, error: { message: "请求未被处理", type: "unhandled" } }, 404);
  }

  return responsePromise;
}

function buildIncomingMessage(
  method: string,
  url: string,
  headers: Headers,
  body: ArrayBuffer | null,
): IncomingMessage {
  const headersObj: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of headers.entries()) {
    const existing = headersObj[key.toLowerCase()];
    if (existing !== undefined) {
      headersObj[key.toLowerCase()] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      headersObj[key.toLowerCase()] = value;
    }
  }

  const readable = new Readable({
    read() {
      if (body && body.byteLength > 0) {
        this.push(Buffer.from(body));
      }
      this.push(null);
    },
  }) as IncomingMessage;

  Object.defineProperties(readable, {
    method: { value: method, configurable: true },
    url: { value: url, configurable: true },
    headers: { value: headersObj, configurable: true },
    httpVersion: { value: "1.1", configurable: true },
    httpVersionMajor: { value: 1, configurable: true },
    httpVersionMinor: { value: 1, configurable: true },
  });

  return readable;
}

function buildServerResponse(): {
  res: ServerResponse;
  responsePromise: Promise<Response>;
} {
  const chunks: Uint8Array[] = [];
  let statusCode = 200;
  const resHeaders: Record<string, string | string[]> = {};
  let headersSent = false;
  let finished = false;
  let resolveResponse: ((value: Response) => void) | null = null;

  const responsePromise = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });

  function flushToResponse(): void {
    if (finished) return;
    finished = true;
    headersSent = true;

    const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const c of chunks) {
      combined.set(c, offset);
      offset += c.byteLength;
    }

    const webHeaders = new Headers();
    for (const [key, value] of Object.entries(resHeaders)) {
      webHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    resolveResponse?.(
      new Response(combined.byteLength > 0 ? combined : null, {
        status: statusCode,
        headers: webHeaders,
      }),
    );
  }

  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(v: number) {
      statusCode = v;
    },
    get headersSent() {
      return headersSent;
    },
    get finished() {
      return finished;
    },
    get writableEnded() {
      return finished;
    },
    setHeader(name: string, value: string | number | readonly string[]): ServerResponse {
      resHeaders[name.toLowerCase()] = Array.isArray(value) ? value.map(String) : String(value);
      return res as unknown as ServerResponse;
    },
    getHeader(name: string): string | string[] | undefined {
      return resHeaders[name.toLowerCase()];
    },
    removeHeader(name: string): void {
      delete resHeaders[name.toLowerCase()];
    },
    writeHead(code: number, hdrs?: Record<string, string | string[]> | string[]): ServerResponse {
      statusCode = code;
      headersSent = true;
      if (hdrs && !Array.isArray(hdrs)) {
        for (const [key, value] of Object.entries(hdrs)) {
          resHeaders[key.toLowerCase()] = value;
        }
      }
      return res as unknown as ServerResponse;
    },
    write(chunk: unknown, ..._args: unknown[]): boolean {
      if (chunk instanceof Uint8Array) {
        chunks.push(chunk);
      } else if (typeof chunk === "string") {
        chunks.push(new TextEncoder().encode(chunk));
      } else if (Buffer.isBuffer(chunk)) {
        chunks.push(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      }
      return true;
    },
    end(chunk?: unknown, ..._args: unknown[]): ServerResponse {
      if (chunk !== undefined && chunk !== null) {
        res.write(chunk);
      }
      flushToResponse();
      return res as unknown as ServerResponse;
    },
    on(_event: string, _cb: (...args: unknown[]) => void): ServerResponse {
      return res as unknown as ServerResponse;
    },
    emit(_event: string, ..._args: unknown[]): boolean {
      return true;
    },
    once(_event: string, _cb: (...args: unknown[]) => void): ServerResponse {
      return res as unknown as ServerResponse;
    },
    removeListener(_event: string, _cb: (...args: unknown[]) => void): ServerResponse {
      return res as unknown as ServerResponse;
    },
    destroy(_error?: Error): void {
      flushToResponse();
    },
  } as unknown as ServerResponse;

  return { res, responsePromise };
}
