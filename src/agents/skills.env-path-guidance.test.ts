import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

type GuidanceCase = {
  file: string;
  required?: string[];
  forbidden?: string[];
};

const CASES: GuidanceCase[] = [
  {
    file: "skills/session-logs/SKILL.md",
    required: ["ZHUSHOU_STATE_DIR"],
    forbidden: [
      "for f in ~/.zhushou/agents/<agentId>/sessions/*.jsonl",
      'rg -l "phrase" ~/.zhushou/agents/<agentId>/sessions/*.jsonl',
      "~/.zhushou/agents/<agentId>/sessions/<id>.jsonl",
    ],
  },
  {
    file: "skills/gh-issues/SKILL.md",
    required: ["ZHUSHOU_CONFIG_PATH"],
    forbidden: ["cat ~/.zhushou/zhushou.json"],
  },
  {
    file: "skills/canvas/SKILL.md",
    required: ["ZHUSHOU_CONFIG_PATH"],
    forbidden: ["cat ~/.zhushou/zhushou.json"],
  },
  {
    file: "skills/openai-whisper-api/SKILL.md",
    required: ["ZHUSHOU_CONFIG_PATH"],
  },
  {
    file: "skills/sherpa-onnx-tts/SKILL.md",
    required: [
      "ZHUSHOU_STATE_DIR",
      "ZHUSHOU_CONFIG_PATH",
      'STATE_DIR="${ZHUSHOU_STATE_DIR:-$HOME/.zhushou}"',
    ],
    forbidden: [
      'SHERPA_ONNX_RUNTIME_DIR: "~/.zhushou/tools/sherpa-onnx-tts/runtime"',
      'SHERPA_ONNX_MODEL_DIR: "~/.zhushou/tools/sherpa-onnx-tts/models/vits-piper-en_US-lessac-high"',
      "<state-dir>",
    ],
  },
  {
    file: "skills/coding-agent/SKILL.md",
    required: ["ZHUSHOU_STATE_DIR"],
    forbidden: ["NEVER start Codex in ~/.zhushou/"],
  },
];

describe("bundled skill env-path guidance", () => {
  it.each(CASES)(
    "keeps $file aligned with zhushou env overrides",
    ({ file, required, forbidden }) => {
      const skillPath = path.join(REPO_ROOT, file);
      if (!fs.existsSync(skillPath)) {
        return;
      }
      const content = fs.readFileSync(skillPath, "utf8");
      for (const needle of required ?? []) {
        expect(content).toContain(needle);
      }
      for (const needle of forbidden ?? []) {
        expect(content).not.toContain(needle);
      }
    },
  );
});
