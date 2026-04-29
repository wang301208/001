import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MINIMAX_DEFAULT_MODEL_ID,
  MINIMAX_DEFAULT_MODEL_REF,
  MINIMAX_TEXT_MODEL_REFS,
} from "../plugin-sdk/minimax.js";

const repoRoot = path.resolve(import.meta.dirname, "../..");

type DocCase = {
  file: string;
  assertContent: (content: string) => void;
};

const DOC_CASES: DocCase[] = [
  {
    file: "docs/help/testing.md",
    assertContent: (content) => {
      expect(content).toContain("MiniMax M2.7");
      expect(content).toContain(MINIMAX_DEFAULT_MODEL_REF);
    },
  },
  {
    file: "docs/help/faq.md",
    assertContent: (content) => {
      expect(content).toContain(`Unknown model: ${MINIMAX_DEFAULT_MODEL_REF}`);
      for (const modelRef of MINIMAX_TEXT_MODEL_REFS.slice(3)) {
        expect(content).toContain(modelRef);
      }
    },
  },
  {
    file: "docs/providers/minimax.md",
    assertContent: (content) => {
      expect(content).toContain(MINIMAX_DEFAULT_MODEL_ID);
      expect(content).toContain(MINIMAX_DEFAULT_MODEL_REF);
      for (const modelRef of MINIMAX_TEXT_MODEL_REFS.slice(3)) {
        expect(content).toContain(modelRef);
      }
      expect(content).not.toContain("(unreleased at the time of writing)");
    },
  },
];

describe("MiniMax docs sync", () => {
  it.each(DOC_CASES)(
    "keeps $file aligned with shared MiniMax ids when bundled",
    ({ file, assertContent }) => {
      const docPath = path.join(repoRoot, file);
      if (!fs.existsSync(docPath)) {
        return;
      }
      const content = fs.readFileSync(docPath, "utf8");
      assertContent(content);
    }
  );
});
