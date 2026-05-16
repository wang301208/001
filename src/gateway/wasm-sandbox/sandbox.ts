export type WasmSandboxConfig = {
  maxMemoryBytes?: number;
  timeoutMs?: number;
  allowedImports?: string[];
  fuel?: number;
};

export type WasmSandbox = {
  id: string;
  execute(functionName: string, input: Uint8Array): Promise<Uint8Array>;
  executeJson<T>(functionName: string, input: unknown): Promise<T>;
  getMemoryUsage(): number;
  getExecutionCount(): number;
  terminate(): Promise<void>;
};

export async function createWasmSandbox(
  wasmBytes: ArrayBuffer | WebAssembly.Module,
  config?: WasmSandboxConfig,
): Promise<WasmSandbox> {
  const id = crypto.randomUUID();
  const maxMemory = config?.maxMemoryBytes ?? 16 * 1024 * 1024;
  const timeoutMs = config?.timeoutMs ?? 30_000;
  let executionCount = 0;
  let terminated = false;

  const memory = new WebAssembly.Memory({ initial: 1, maximum: Math.ceil(maxMemory / 65536) });

  const importObject: WebAssembly.ImportObject = {
    env: {
      memory,
      log: (_ptr: number, _len: number) => {},
      abort: () => {
        throw new Error("Wasm sandbox abort triggered");
      },
    },
    wasi_snapshot_preview1: {
      fd_write: () => 0,
      fd_close: () => 0,
      fd_seek: () => 0,
      fd_fdstat_get: () => 0,
      environ_get: () => 0,
      environ_sizes_get: () => 0,
      proc_exit: () => { throw new Error("Wasm process exit"); },
      random_get: (buf: number, len: number) => {
        const view = new Uint8Array(memory.buffer, buf, len);
        crypto.getRandomValues(view);
        return 0;
      },
      clock_time_get: (_id: number, _precision: number, resultPtr: number) => {
        const view = new BigInt64Array(memory.buffer);
        view[resultPtr / 8] = BigInt(Date.now()) * 1_000_000n;
        return 0;
      },
    },
  };

  const module = wasmBytes instanceof WebAssembly.Module
    ? wasmBytes
    : await WebAssembly.compile(wasmBytes);

  const instance = await WebAssembly.instantiate(module, importObject);
  const exports = instance.exports as Record<string, WebAssembly.ExportValue>;

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function allocateAndWrite(data: Uint8Array): number {
    if (!exports.allocate) {
      throw new Error("Wasm module does not export 'allocate' function");
    }
    const ptr = (exports.allocate as (size: number) => number)(data.length);
    const view = new Uint8Array(memory.buffer, ptr, data.length);
    view.set(data);
    return ptr;
  }

  async function execute(functionName: string, input: Uint8Array): Promise<Uint8Array> {
    if (terminated) {throw new Error(`Wasm sandbox ${id} has been terminated`);}
    if (!(functionName in exports)) {throw new Error(`Wasm export '${functionName}' not found`);}

    const fn = exports[functionName];
    if (typeof fn !== "function") {throw new Error(`Wasm export '${functionName}' is not a function`);}

    executionCount++;
    const inputPtr = allocateAndWrite(input);
    const inputLen = input.length;

    const resultPromise = new Promise<{ ptr: number; len: number }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        terminated = true;
        reject(new Error(`Wasm execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const resultPtr = (fn as (ptr: number, len: number) => number)(inputPtr, inputLen);
        clearTimeout(timeout);
        resolve({ ptr: resultPtr, len: 0 });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });

    const result = await resultPromise;
    const outputView = new Uint8Array(memory.buffer, result.ptr, result.len || 1024);
    const end = outputView.indexOf(0);
    return outputView.slice(0, end === -1 ? outputView.length : end);
  }

  async function executeJson<T>(functionName: string, input: unknown): Promise<T> {
    const inputBytes = encoder.encode(JSON.stringify(input));
    const outputBytes = await execute(functionName, inputBytes);
    return JSON.parse(decoder.decode(outputBytes)) as T;
  }

  function getMemoryUsage(): number {
    return memory.buffer.byteLength;
  }

  async function terminate(): Promise<void> {
    terminated = true;
  }

  return {
    id,
    execute,
    executeJson,
    getMemoryUsage,
    getExecutionCount: () => executionCount,
    terminate,
  };
}
