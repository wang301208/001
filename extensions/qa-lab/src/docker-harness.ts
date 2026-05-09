import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { seedQaAgentWorkspace } from "./qa-agent-workspace.js";
import {
  createQaChannelGatewayConfig,
  QA_CHANNEL_REQUIRED_PLUGIN_IDS,
} from "./qa-channel-transport.js";
import { buildQaGatewayConfig } from "./qa-gateway-config.js";

const QA_LAB_INTERNAL_PORT = 43123;

function toPosixRelative(fromDir: string, toPath: string): string {
  return path.relative(fromDir, toPath).split(path.sep).join("/");
}

function renderImageBlock(params: {
  outputDir: string;
  repoRoot: string;
  imageName: string;
  usePrebuiltImage: boolean;
}) {
  if (params.usePrebuiltImage) {
    return `    image: ${params.imageName}\n`;
  }
  const context = toPosixRelative(params.outputDir, params.repoRoot) || ".";
  return `    build:\n      context: ${context}\n      dockerfile: Dockerfile\n      args:\n        ASSISTANT_EXTENSIONS: "qa-channel qa-lab"\n`;
}

function renderCompose(params: {
  outputDir: string;
  repoRoot: string;
  imageName: string;
  usePrebuiltImage: boolean;
  gatewayPort: number;
  qaLabPort: number;
  gatewayToken: string;
  includeQaLabApi: boolean;
}) {
  const imageBlock = renderImageBlock(params);
  const repoMount = toPosixRelative(params.outputDir, params.repoRoot) || ".";

  return `services:
  qa-mock-openai:
${imageBlock}    pull_policy: never
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - fetch("http://127.0.0.1:44080/healthz").then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 3s
    command:
      - node
      - dist/index.js
      - qa
      - mock-openai
      - --host
      - "0.0.0.0"
      - --port
      - "44080"
${
  params.includeQaLabApi
    ? `  qa-lab:
${imageBlock}    pull_policy: never
    ports:
      - "${params.qaLabPort}:${QA_LAB_INTERNAL_PORT}"
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - fetch("http://127.0.0.1:${QA_LAB_INTERNAL_PORT}/healthz").then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 5s
    environment:
      ASSISTANT_SKIP_GMAIL_WATCHER: "1"
      ASSISTANT_SKIP_BROWSER_CONTROL_SERVER: "1"
      ASSISTANT_SKIP_CANVAS_HOST: "1"
      ASSISTANT_PROFILE: ""
    command:
      - node
      - dist/index.js
      - qa
      - api
      - --host
      - "0.0.0.0"
      - --port
      - "${QA_LAB_INTERNAL_PORT}"
      - --advertise-host
      - "127.0.0.1"
      - --advertise-port
      - "${params.qaLabPort}"
      - --auto-kickoff-target
      - direct
      - --send-kickoff-on-start
      - --embedded-gateway
      - disabled
    depends_on:
      qa-mock-openai:
        condition: service_healthy
`
    : ""
}  assistant-qa-gateway:
${imageBlock}    pull_policy: never
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ports:
      - "${params.gatewayPort}:18789"
    environment:
      ASSISTANT_CONFIG_PATH: /tmp/assistant/assistant.json
      ASSISTANT_STATE_DIR: /tmp/assistant/state
      ASSISTANT_NO_RESPAWN: "1"
      ASSISTANT_SKIP_GMAIL_WATCHER: "1"
      ASSISTANT_SKIP_BROWSER_CONTROL_SERVER: "1"
      ASSISTANT_SKIP_CANVAS_HOST: "1"
      ASSISTANT_PROFILE: ""
    volumes:
      - ./state:/opt/assistant-scaffold:ro
      - ${repoMount}:/opt/assistant-repo:ro
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - fetch("http://127.0.0.1:18789/healthz").then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 15s
    depends_on:
${
  params.includeQaLabApi
    ? `      qa-lab:
        condition: service_healthy
`
    : ""
}      qa-mock-openai:
        condition: service_healthy
    command:
      - sh
      - -lc
      - mkdir -p /tmp/assistant/workspace /tmp/assistant/state && cp /opt/assistant-scaffold/assistant.json /tmp/assistant/assistant.json && cp -R /opt/assistant-scaffold/seed-workspace/. /tmp/assistant/workspace/ && ln -snf /opt/assistant-repo /tmp/assistant/workspace/repo && exec node dist/index.js gateway run --port 18789 --bind lan --allow-unconfigured
`;
}

function renderEnvExample(params: {
  gatewayPort: number;
  qaLabPort: number;
  gatewayToken: string;
  providerBaseUrl: string;
  qaBusBaseUrl: string;
  includeQaLabApi: boolean;
}) {
  return `# QA Docker harness example env
ASSISTANT_GATEWAY_TOKEN=${params.gatewayToken}
QA_GATEWAY_PORT=${params.gatewayPort}
QA_BUS_BASE_URL=${params.qaBusBaseUrl}
QA_PROVIDER_BASE_URL=${params.providerBaseUrl}
${params.includeQaLabApi ? `QA_LAB_URL=http://127.0.0.1:${params.qaLabPort}\n` : ""}`;
}

function renderReadme(params: {
  gatewayPort: number;
  qaLabPort: number;
  usePrebuiltImage: boolean;
  includeQaLabApi: boolean;
}) {
  return `# QA Docker Harness

Generated scaffold for the Docker-backed QA lane.

Files:

- \`docker-compose.qa.yml\`
- \`.env.example\`
- \`state/assistant.json\`

Suggested flow:

1. Build the prebaked image once:
   - \`docker build -t assistant:qa-local-prebaked --build-arg ASSISTANT_EXTENSIONS="qa-channel qa-lab" -f Dockerfile .\`
2. Start the stack:
   - \`docker compose -f docker-compose.qa.yml up${params.usePrebuiltImage ? "" : " --build"} -d\`
3. QA Lab API:
   - \`${params.includeQaLabApi ? `http://127.0.0.1:${params.qaLabPort}` : "not published in this scaffold"}\`
4. Browser frontends are removed from this project. Use \`assistant --tui\` for interactive work.
5. The repo-backed kickoff task auto-injects on startup when the QA API service is enabled.

Gateway:

- health: \`http://127.0.0.1:${params.gatewayPort}/healthz\`
- Mock OpenAI: internal \`http://qa-mock-openai:44080/v1\`

The gateway runs with in-process restarts inside Docker so restart actions do not
kill the container by detaching a replacement child.
`;
}

export async function writeQaDockerHarnessFiles(params: {
  outputDir: string;
  repoRoot: string;
  gatewayPort?: number;
  qaLabPort?: number;
  gatewayToken?: string;
  providerBaseUrl?: string;
  qaBusBaseUrl?: string;
  imageName?: string;
  usePrebuiltImage?: boolean;
  includeQaLabApi?: boolean;
}) {
  const gatewayPort = params.gatewayPort ?? 18789;
  const qaLabPort = params.qaLabPort ?? 43124;
  const gatewayToken = params.gatewayToken ?? `qa-token-${randomUUID()}`;
  const providerBaseUrl = params.providerBaseUrl ?? "http://qa-mock-openai:44080/v1";
  const qaBusBaseUrl = params.qaBusBaseUrl ?? "http://qa-lab:43123";
  const imageName = params.imageName ?? "assistant:qa-local-prebaked";
  const usePrebuiltImage = params.usePrebuiltImage ?? false;
  const includeQaLabApi = params.includeQaLabApi ?? true;

  await fs.mkdir(path.join(params.outputDir, "state", "seed-workspace"), { recursive: true });
  await seedQaAgentWorkspace({
    workspaceDir: path.join(params.outputDir, "state", "seed-workspace"),
    repoRoot: params.repoRoot,
  });

  const config = buildQaGatewayConfig({
    bind: "lan",
    gatewayPort: 18789,
    gatewayToken,
    providerBaseUrl,
    workspaceDir: "/tmp/assistant/workspace",
    transportPluginIds: QA_CHANNEL_REQUIRED_PLUGIN_IDS,
    transportConfig: createQaChannelGatewayConfig({
      baseUrl: qaBusBaseUrl,
    }),
  });

  const files = [
    path.join(params.outputDir, "docker-compose.qa.yml"),
    path.join(params.outputDir, ".env.example"),
    path.join(params.outputDir, "README.md"),
    path.join(params.outputDir, "state", "assistant.json"),
  ];

  await Promise.all([
    fs.writeFile(
      path.join(params.outputDir, "docker-compose.qa.yml"),
      renderCompose({
        outputDir: params.outputDir,
        repoRoot: params.repoRoot,
        imageName,
        usePrebuiltImage,
        gatewayPort,
        qaLabPort,
        gatewayToken,
        includeQaLabApi,
      }),
      "utf8",
    ),
    fs.writeFile(
      path.join(params.outputDir, ".env.example"),
      renderEnvExample({
        gatewayPort,
        qaLabPort,
        gatewayToken,
        providerBaseUrl,
        qaBusBaseUrl,
        includeQaLabApi,
      }),
      "utf8",
    ),
    fs.writeFile(
      path.join(params.outputDir, "README.md"),
      renderReadme({
        gatewayPort,
        qaLabPort,
        usePrebuiltImage,
        includeQaLabApi,
      }),
      "utf8",
    ),
    fs.writeFile(
      path.join(params.outputDir, "state", "assistant.json"),
      `${JSON.stringify(config, null, 2)}\n`,
      "utf8",
    ),
  ]);

  return {
    outputDir: params.outputDir,
    imageName,
    files: [
      ...files,
      path.join(params.outputDir, "state", "seed-workspace", "IDENTITY.md"),
      path.join(params.outputDir, "state", "seed-workspace", "QA_KICKOFF_TASK.md"),
      path.join(params.outputDir, "state", "seed-workspace", "QA_SCENARIO_PLAN.md"),
      path.join(params.outputDir, "state", "seed-workspace", "QA_SCENARIOS.md"),
    ],
  };
}

export async function buildQaDockerHarnessImage(
  params: {
    repoRoot: string;
    imageName?: string;
  },
  deps?: {
    runCommand?: (
      command: string,
      args: string[],
      cwd: string,
    ) => Promise<{ stdout: string; stderr: string }>;
  },
) {
  const imageName = params.imageName ?? "assistant:qa-local-prebaked";
  const runCommand =
    deps?.runCommand ??
    (async (command: string, args: string[], cwd: string) => {
      const { execFile } = await import("node:child_process");
      return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        execFile(command, args, { cwd }, (error, stdout, stderr) => {
          if (error) {
            reject(error);
            return;
          }
          resolve({ stdout, stderr });
        });
      });
    });

  await runCommand(
    "docker",
    [
      "build",
      "-t",
      imageName,
      "--build-arg",
      "ASSISTANT_EXTENSIONS=qa-channel qa-lab",
      "-f",
      "Dockerfile",
      ".",
    ],
    params.repoRoot,
  );

  return { imageName };
}
