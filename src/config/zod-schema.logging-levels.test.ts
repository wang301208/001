import { describe, expect, it } from "vitest";
import { ZhushouSchema } from "./zod-schema.js";

describe("ZhushouSchema logging levels", () => {
  it("accepts valid logging level values for level and consoleLevel", () => {
    expect(() =>
      ZhushouSchema.parse({
        logging: {
          level: "debug",
          consoleLevel: "warn",
        },
      }),
    ).not.toThrow();
  });

  it("rejects invalid logging level values", () => {
    expect(() =>
      ZhushouSchema.parse({
        logging: {
          level: "loud",
        },
      }),
    ).toThrow();
    expect(() =>
      ZhushouSchema.parse({
        logging: {
          consoleLevel: "verbose",
        },
      }),
    ).toThrow();
  });
});
