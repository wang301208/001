import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/gateway/server-methods/governance.test.ts"],
  },
});
