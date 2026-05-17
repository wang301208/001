#!/usr/bin/env node
import { ProcessTerminal } from "../node_modules/@mariozechner/pi-tui/dist/terminal.js";
import { matchesKey, isKittyProtocolActive } from "../node_modules/@mariozechner/pi-tui/dist/keys.js";

const term = new ProcessTerminal();
let count = 0;
let enterDetected = false;

process.stdout.write("\x1b[2J\x1b[H");
console.log("=== TUI Enter 键实时诊断 ===");
console.log("Kitty protocol (before start):", isKittyProtocolActive());
console.log("请按 Enter 键测试...");
console.log("---");

term.start((data) => {
  count++;
  const hex = Array.from(data).map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join(" ");
  const parsed = (() => { try { return matchesKey(data, "enter") ? "enter" : "other"; } catch { return "?"; } })();
  const isEnter = parsed === "enter";
  console.log(`[${count}] hex=${hex} parsed=${parsed}`);

  if (isEnter) {
    enterDetected = true;
    console.log(">>> ENTER 已捕获! 提交功能应正常工作。");
  }

  if (count >= 10 && enterDetected) {
    console.log("\n--- 诊断完成: Enter 键工作正常 ---");
    setTimeout(() => { term.stop(); process.exit(0); }, 100);
  }
}, () => {});

setTimeout(() => {
  console.log(`\n--- 超时 (10s)。共 ${count} 键，Enter ${enterDetected ? "已" : "未"} 检测 ---`);
  console.log("Kitty protocol (after start):", isKittyProtocolActive());
  term.stop();
  process.exit(0);
}, 10000);
