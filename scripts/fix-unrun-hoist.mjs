#!/usr/bin/env node
import { existsSync, cpSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const unrunSrc = join(root, "node_modules", "unrun");
const tsdownDir = join(root, "node_modules", "tsdown", "node_modules");
const unrunDest = join(tsdownDir, "unrun");

if (!existsSync(unrunSrc)) {
  process.exit(0);
}

if (existsSync(unrunDest)) {
  process.exit(0);
}

if (!existsSync(tsdownDir)) {
  mkdirSync(tsdownDir, { recursive: true });
}

try {
  cpSync(unrunSrc, unrunDest, { recursive: true, dereference: true });
} catch {
  // non-critical: tsdown may resolve unrun via other paths
}
