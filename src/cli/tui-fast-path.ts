import {
  consumeRootOptionToken,
  FLAG_TERMINATOR,
  isValueToken,
} from "../infra/cli-root-options.js";
import type { TuiOptions } from "../tui/tui-types.js";
import { resolveCliArgvInvocation } from "./argv-invocation.js";
import { parseTimeoutMs } from "./parse-timeout.js";

function findExplicitTuiArgs(argv: string[]): string[] | null {
  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg || arg === FLAG_TERMINATOR) {
      break;
    }
    const consumed = consumeRootOptionToken(args, index);
    if (consumed > 0) {
      index += consumed - 1;
      continue;
    }
    if (arg === "tui") {
      return args.slice(index + 1);
    }
    return null;
  }
  return null;
}

function readTuiOptionValue(args: string[], index: number, flag: string): [string, number] | null {
  const arg = args[index];
  if (arg === flag) {
    const next = args[index + 1];
    return isValueToken(next) ? [next, 2] : null;
  }
  if (arg?.startsWith(`${flag}=`)) {
    const value = arg.slice(flag.length + 1);
    return value ? [value, 1] : null;
  }
  return null;
}

export function resolveExplicitTuiFastPathOptions(argv: string[]): TuiOptions | null {
  const invocation = resolveCliArgvInvocation(argv);
  if (invocation.hasHelpOrVersion || invocation.primary !== "tui") {
    return null;
  }
  const args = findExplicitTuiArgs(argv);
  if (!args) {
    return null;
  }

  const options: TuiOptions = {};
  const valueFlags = new Set([
    "--url",
    "--token",
    "--password",
    "--session",
    "--thinking",
    "--message",
    "--timeout-ms",
    "--history-limit",
  ]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg || arg === FLAG_TERMINATOR) {
      return null;
    }
    if (arg === "--deliver") {
      options.deliver = true;
      continue;
    }

    const flag = arg.includes("=") ? arg.slice(0, arg.indexOf("=")) : arg;
    if (!valueFlags.has(flag)) {
      return null;
    }
    const read = readTuiOptionValue(args, index, flag);
    if (!read) {
      return null;
    }
    const [value, consumed] = read;
    index += consumed - 1;
    switch (flag) {
      case "--url":
        options.url = value;
        break;
      case "--token":
        options.token = value;
        break;
      case "--password":
        options.password = value;
        break;
      case "--session":
        options.session = value;
        break;
      case "--thinking":
        options.thinking = value;
        break;
      case "--message":
        options.message = value;
        break;
      case "--timeout-ms": {
        const timeoutMs = parseTimeoutMs(value);
        if (timeoutMs === undefined) {
          return null;
        }
        options.timeoutMs = timeoutMs;
        break;
      }
      case "--history-limit": {
        const historyLimit = Number.parseInt(value, 10);
        options.historyLimit = Number.isNaN(historyLimit) ? undefined : historyLimit;
        break;
      }
    }
  }

  return options;
}
