#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function fail(message) {
  process.stderr.write(`[quickstart-smoke] ${message}\n`);
  process.exit(1);
}

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`missing ${relativePath}`);
  }
  return readFileSync(absolutePath, "utf8");
}

function requireIncludes(relativePath, needles) {
  const text = read(relativePath);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      fail(`${relativePath} missing ${needle}`);
    }
  }
}

requireIncludes("README.md", ["pnpm install", "pnpm build", "zhushou onboard", "zhushou tui"]);
requireIncludes("docs/quickstart.md", [
  "pnpm install",
  "pnpm build",
  "zhushou onboard",
  "zhushou tui --message",
]);
requireIncludes("docs/cli.md", ["Ctrl+L", "Ctrl+G", "Ctrl+P", "自然语言直达", "切换模型"]);
requireIncludes("docs/configuration.md", [
  "~/.wang301208/zhushou.json",
  "models.providers",
  "agents.defaults.model",
  "openai-responses",
  "anthropic-messages",
  "google-generative-ai",
  "ollama",
]);

const help = spawnSync(process.execPath, [path.join(root, "zhushou.mjs"), "--help"], {
  cwd: root,
  encoding: "utf8",
});

if (help.status !== 0) {
  fail(`zhushou.mjs --help failed:\n${help.stderr || help.stdout}`);
}

const helpText = `${help.stdout}\n${help.stderr}`;
if (!helpText.includes("Usage: zhushou")) {
  fail("zhushou.mjs --help missing Usage: zhushou");
}

const hasSourceFallbackHelp =
  helpText.includes("Quickstart:") && helpText.includes("pnpm start -- tui");
const hasBuiltCliHelp =
  helpText.includes("Commands:") &&
  helpText.includes("tui") &&
  helpText.includes("models") &&
  helpText.includes("configure");

if (!hasSourceFallbackHelp && !hasBuiltCliHelp) {
  fail("zhushou.mjs --help did not look like source fallback help or built CLI help");
}

process.stdout.write("[quickstart-smoke] ok\n");
