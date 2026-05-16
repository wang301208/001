export type DiscoveredEnvironment = {
  runtime: "node" | "bun" | "deno";
  runtimeVersion: string;
  platform: "linux" | "darwin" | "win32" | "other";
  arch: string;
  isDocker: boolean;
  isKubernetes: boolean;
  isFlyIo: boolean;
  isRender: boolean;
  isTermux: boolean;
  hasGpu: boolean;
  availableMemoryMb: number;
  cpuCores: number;
  network: {
    isLoopback: boolean;
    publicIp?: string;
    region?: string;
  };
  envVars: {
    hasOpenAiKey: boolean;
    hasAnthropicKey: boolean;
    hasGoogleKey: boolean;
    hasAwsKey: boolean;
    hasOllama: boolean;
    hasLmStudio: boolean;
    port?: number;
    bindHost?: string;
  };
};

export async function discoverEnvironment(): Promise<DiscoveredEnvironment> {
  const runtime = detectRuntime();
  const runtimeVersion = detectRuntimeVersion(runtime);

  return {
    runtime,
    runtimeVersion,
    platform: detectPlatform(),
    arch: process.arch,
    isDocker: await isRunningInDocker(),
    isKubernetes: isRunningInK8s(),
    isFlyIo: isRunningOnFlyIo(),
    isRender: isRunningOnRender(),
    isTermux: isRunningInTermux(),
    hasGpu: await detectGpu(),
    availableMemoryMb: estimateAvailableMemory(),
    cpuCores: detectCpuCores(),
    network: {
      isLoopback: true,
      publicIp: process.env.FLY_PUBLIC_IP ?? undefined,
      region: process.env.FLY_REGION ?? process.env.RENDER_REGION ?? undefined,
    },
    envVars: {
      hasOpenAiKey: hasEnvKey("OPENAI_API_KEY", "OPENROUTER_API_KEY"),
      hasAnthropicKey: hasEnvKey("ANTHROPIC_API_KEY", "CLAUDE_API_KEY"),
      hasGoogleKey: hasEnvKey("GOOGLE_API_KEY", "GEMINI_API_KEY"),
      hasAwsKey: hasEnvKey("AWS_ACCESS_KEY_ID", "AWS_REGION"),
      hasOllama: await isServiceReachable(process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"),
      hasLmStudio: await isServiceReachable(process.env.LMSTUDIO_BASE_URL ?? "http://localhost:1234"),
      port: parseEnvNumber("ZHUSHOU_PORT", "PORT"),
      bindHost: process.env.ZHUSHOU_BIND ?? process.env.HOST ?? undefined,
    },
  };
}

function detectRuntime(): DiscoveredEnvironment["runtime"] {
  if (typeof (globalThis as any).Bun !== "undefined") {return "bun";}
  if (typeof (globalThis as any).Deno !== "undefined") {return "deno";}
  return "node";
}

function detectRuntimeVersion(runtime: string): string {
  if (runtime === "bun") {return (globalThis as any).Bun?.version ?? "unknown";}
  if (runtime === "deno") {return (globalThis as any).Deno?.version?.deno ?? "unknown";}
  return process.version;
}

function detectPlatform(): DiscoveredEnvironment["platform"] {
  switch (process.platform) {
    case "linux": return "linux";
    case "darwin": return "darwin";
    case "win32": return "win32";
    default: return "other";
  }
}

async function isRunningInDocker(): Promise<boolean> {
  try {
    const { readFile } = await import("node:fs/promises");
    const cgroup = await readFile("/proc/1/cgroup", "utf8");
    return cgroup.includes("docker") || cgroup.includes("containerd");
  } catch {
    return !!process.env.DOCKER || !!process.env.container;
  }
}

function isRunningInK8s(): boolean {
  return !!process.env.KUBERNETES_SERVICE_HOST || !!process.env.K8S;
}

function isRunningOnFlyIo(): boolean {
  return !!process.env.FLY_APP_NAME;
}

function isRunningOnRender(): boolean {
  return !!process.env.RENDER;
}

function isRunningInTermux(): boolean {
  return !!process.env.TERMUX_VERSION || !!process.env.PREFIX?.includes("com.termux");
}

async function detectGpu(): Promise<boolean> {
  if (process.env.NVIDIA_VISIBLE_DEVICES && process.env.NVIDIA_VISIBLE_DEVICES !== "void") {return true;}
  try {
    const { execFile } = await import("node:child_process/promises");
    await execFile("nvidia-smi", ["--query-gpu=name", "--format=csv,noheader"], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function estimateAvailableMemory(): number {
  const limit = process.env.FLY_VM_MEMORY_MB ?? process.env.RENDER_MEMORY_MB;
  if (limit) {return parseInt(limit, 10);}
  return Math.floor((process.memoryUsage().heapLimit ?? 512 * 1024 * 1024) / (1024 * 1024));
}

function detectCpuCores(): number {
  return typeof navigator !== "undefined" && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : 1;
}

function hasEnvKey(...keys: string[]): boolean {
  return keys.some((k) => process.env[k] && process.env[k]!.length > 0);
}

function parseEnvNumber(...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = process.env[k];
    if (v) {
      const n = parseInt(v, 10);
      if (!isNaN(n)) {return n;}
    }
  }
  return undefined;
}

async function isServiceReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(timeout);
    return resp.ok || resp.status === 405;
  } catch {
    return false;
  }
}
