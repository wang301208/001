import { spawn } from "node:child_process";
import process from "node:process";

type ToolContext = {
  cwd?: string;
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
};

type ApprovalRequest = {
  type: "approval_request";
  prompt: string;
  items: unknown[];
  resumeToken?: string;
} | null;

type ToolEnvelope =
  | {
      protocolVersion: 1;
      ok: true;
      status: "ok" | "needs_approval" | "needs_input" | "cancelled";
      output: unknown[];
      requiresApproval: ApprovalRequest;
      requiresInput?: {
        prompt: string;
        schema?: unknown;
        items?: unknown[];
        resumeToken?: string;
        approvalId?: string;
      } | null;
    }
  | {
      protocolVersion: 1;
      ok: false;
      error: {
        type: string;
        message: string;
      };
    };

function errorEnvelope(type: string, message: string): ToolEnvelope {
  return {
    protocolVersion: 1,
    ok: false,
    error: { type, message },
  };
}

async function runLocalCommand(params: {
  pipeline: string;
  ctx?: ToolContext;
}): Promise<ToolEnvelope> {
  return await new Promise<ToolEnvelope>((resolve) => {
    const child = spawn(params.pipeline, {
      cwd: params.ctx?.cwd ?? process.cwd(),
      env: { ...process.env, ...params.ctx?.env },
      shell: true,
      windowsHide: true,
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;

    const settle = (envelope: ToolEnvelope) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(envelope);
    };

    params.ctx?.signal?.addEventListener("abort", () => {
      child.kill();
      settle(errorEnvelope("aborted", "lobster runtime aborted"));
    });

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      params.ctx?.stdout?.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      params.ctx?.stderr?.write(chunk);
    });
    child.on("error", (error) => {
      settle(errorEnvelope("spawn_error", error.message));
    });
    child.on("close", (code) => {
      settle({
        protocolVersion: 1,
        ok: true,
        status: "ok",
        output: [
          {
            exitCode: code ?? 0,
            stdout: Buffer.concat(stdoutChunks).toString("utf8"),
            stderr: Buffer.concat(stderrChunks).toString("utf8"),
          },
        ],
        requiresApproval: null,
      });
    });
  });
}

export async function runToolRequest(params: {
  pipeline?: string;
  filePath?: string;
  args?: Record<string, unknown>;
  ctx?: ToolContext;
}): Promise<ToolEnvelope> {
  if (params.filePath) {
    return errorEnvelope("unsupported_workflow_file", "workflow file execution is not implemented");
  }
  const pipeline = params.pipeline?.trim();
  if (!pipeline) {
    return errorEnvelope("invalid_pipeline", "pipeline required");
  }
  return await runLocalCommand({ pipeline, ctx: params.ctx });
}

export async function resumeToolRequest(): Promise<ToolEnvelope> {
  return errorEnvelope("unsupported_resume", "resumable approvals are not implemented");
}
