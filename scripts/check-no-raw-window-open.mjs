#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import ts from "typescript";
import {
  collectTypeScriptFiles,
  resolveRepoRoot,
  runAsScript,
  toLine,
  unwrapExpression,
} from "./lib/ts-guard-utils.mjs";

const repoRoot = resolveRepoRoot(import.meta.url);
const removedUiSourceDir = path.join(repoRoot, "ui", "src", "ui");

function asPropertyAccess(expression) {
  if (ts.isPropertyAccessExpression(expression)) {
    return expression;
  }
  if (typeof ts.isPropertyAccessChain === "function" && ts.isPropertyAccessChain(expression)) {
    return expression;
  }
  return null;
}

function isRawWindowOpenCall(expression) {
  const propertyAccess = asPropertyAccess(unwrapExpression(expression));
  if (!propertyAccess || propertyAccess.name.text !== "open") {
    return false;
  }

  const receiver = unwrapExpression(propertyAccess.expression);
  return (
    ts.isIdentifier(receiver) && (receiver.text === "window" || receiver.text === "globalThis")
  );
}

export function findRawWindowOpenLines(content, fileName = "source.ts") {
  const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
  const lines = [];

  const visit = (node) => {
    if (ts.isCallExpression(node) && isRawWindowOpenCall(node.expression)) {
      lines.push(toLine(sourceFile, node.expression));
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return lines;
}

export async function main() {
  const files = await collectTypeScriptFiles(removedUiSourceDir, {
    extraTestSuffixes: [".browser.test.ts", ".node.test.ts"],
    ignoreMissing: true,
  });
  const violations = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    for (const line of findRawWindowOpenLines(content, filePath)) {
      const relPath = path.relative(repoRoot, filePath);
      violations.push(`${relPath}:${line}`);
    }
  }

  if (violations.length === 0) {
    return;
  }

  console.error("Found raw window.open usage in removed UI source:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error("Project frontends are removed; do not add browser window-opening code.");
  process.exit(1);
}

runAsScript(import.meta.url, main);
