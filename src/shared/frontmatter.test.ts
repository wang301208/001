import { describe, expect, it, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  applyZhushouManifestInstallCommonFields,
  getFrontmatterString,
  normalizeStringList,
  parseFrontmatterBool,
  parseZhushouManifestInstallBase,
  resolveZhushouManifestBlock,
  resolveZhushouManifestInstall,
  resolveZhushouManifestOs,
  resolveZhushouManifestRequires,
} from "./frontmatter.js";

describe("shared/frontmatter", () => {
  test("normalizeStringList handles strings, arrays, and non-list values", () => {
    expect(normalizeStringList("a, b,,c")).toEqual(["a", "b", "c"]);
    expect(normalizeStringList([" a ", "", "b", 42])).toEqual(["a", "b", "42"]);
    expect(normalizeStringList(null)).toEqual([]);
  });

  test("getFrontmatterString extracts strings only", () => {
    expect(getFrontmatterString({ a: "b" }, "a")).toBe("b");
    expect(getFrontmatterString({ a: 1 }, "a")).toBeUndefined();
  });

  test("parseFrontmatterBool respects explicit values and fallback", () => {
    expect(parseFrontmatterBool("true", false)).toBe(true);
    expect(parseFrontmatterBool("false", true)).toBe(false);
    expect(parseFrontmatterBool(undefined, true)).toBe(true);
    expect(parseFrontmatterBool("maybe", false)).toBe(false);
  });

  test("resolveZhushouManifestBlock reads current manifest keys and custom metadata fields", () => {
    expect(
      resolveZhushouManifestBlock({
        frontmatter: {
          metadata: "{ zhushou: { foo: 1, bar: 'baz' } }",
        },
      }),
    ).toEqual({ foo: 1, bar: "baz" });

    expect(
      resolveZhushouManifestBlock({
        frontmatter: {
          pluginMeta: "{ zhushou: { foo: 2 } }",
        },
        key: "pluginMeta",
      }),
    ).toEqual({ foo: 2 });
  });

  test("resolveZhushouManifestBlock returns undefined for invalid input", () => {
    expect(resolveZhushouManifestBlock({ frontmatter: {} })).toBeUndefined();
    expect(
      resolveZhushouManifestBlock({ frontmatter: { metadata: "not-json5" } }),
    ).toBeUndefined();
    expect(resolveZhushouManifestBlock({ frontmatter: { metadata: "123" } })).toBeUndefined();
    expect(resolveZhushouManifestBlock({ frontmatter: { metadata: "[]" } })).toBeUndefined();
    expect(
      resolveZhushouManifestBlock({ frontmatter: { metadata: "{ nope: { a: 1 } }" } }),
    ).toBeUndefined();
  });

  test("does not keep unknown manifest compatibility keys", () => {
    expect(fs.existsSync(path.join(process.cwd(), "src", "compat", "project-names.ts"))).toBe(
      false,
    );
    expect(
      resolveZhushouManifestBlock({
        frontmatter: {
          metadata: "{ unknownManifest: { foo: 1 } }",
        },
      }),
    ).toBeUndefined();
    expect(
      resolveZhushouManifestBlock({
        frontmatter: {
          metadata: "{ legacyManifest: { foo: 1 } }",
        },
      }),
    ).toBeUndefined();
  });

  it("normalizes manifest requirement and os lists", () => {
    expect(
      resolveZhushouManifestRequires({
        requires: {
          bins: "bun, node",
          anyBins: [" ffmpeg ", ""],
          env: ["ZHUSHOU_TOKEN", " ZHUSHOU_URL "],
          config: null,
        },
      }),
    ).toEqual({
      bins: ["bun", "node"],
      anyBins: ["ffmpeg"],
      env: ["ZHUSHOU_TOKEN", "ZHUSHOU_URL"],
      config: [],
    });
    expect(resolveZhushouManifestRequires({})).toBeUndefined();
    expect(resolveZhushouManifestOs({ os: [" darwin ", "linux", ""] })).toEqual([
      "darwin",
      "linux",
    ]);
  });

  it("parses and applies install common fields", () => {
    const parsed = parseZhushouManifestInstallBase(
      {
        type: " Brew ",
        id: "brew.git",
        label: "Git",
        bins: [" git ", "git"],
      },
      ["brew", "npm"],
    );

    expect(parsed).toEqual({
      raw: {
        type: " Brew ",
        id: "brew.git",
        label: "Git",
        bins: [" git ", "git"],
      },
      kind: "brew",
      id: "brew.git",
      label: "Git",
      bins: ["git", "git"],
    });
    expect(parseZhushouManifestInstallBase({ kind: "bad" }, ["brew"])).toBeUndefined();
    expect(
      applyZhushouManifestInstallCommonFields<{
        extra: boolean;
        id?: string;
        label?: string;
        bins?: string[];
      }>({ extra: true }, parsed!),
    ).toEqual({
      extra: true,
      id: "brew.git",
      label: "Git",
      bins: ["git", "git"],
    });
  });

  it("prefers explicit kind, ignores invalid common fields, and leaves missing ones untouched", () => {
    const parsed = parseZhushouManifestInstallBase(
      {
        kind: " npm ",
        type: "brew",
        id: 42,
        label: null,
        bins: [" ", ""],
      },
      ["brew", "npm"],
    );

    expect(parsed).toEqual({
      raw: {
        kind: " npm ",
        type: "brew",
        id: 42,
        label: null,
        bins: [" ", ""],
      },
      kind: "npm",
    });
    expect(
      applyZhushouManifestInstallCommonFields(
        { id: "keep", label: "Keep", bins: ["bun"] },
        parsed!,
      ),
    ).toEqual({
      id: "keep",
      label: "Keep",
      bins: ["bun"],
    });
  });

  it("maps install entries through the parser and filters rejected specs", () => {
    expect(
      resolveZhushouManifestInstall(
        {
          install: [{ id: "keep" }, { id: "drop" }, "bad"],
        },
        (entry) => {
          if (
            typeof entry === "object" &&
            entry !== null &&
            (entry as { id?: string }).id === "keep"
          ) {
            return { id: "keep" };
          }
          return undefined;
        },
      ),
    ).toEqual([{ id: "keep" }]);
  });
});
