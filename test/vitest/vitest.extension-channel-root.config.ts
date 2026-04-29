import { createScopedVitestConfig } from "./vitest.scoped-config.ts";

export function createExtensionChannelRootVitestConfig(
  root: string,
  name: string,
  env: Record<string, string | undefined> = process.env,
) {
  return createScopedVitestConfig([`${root}/**/*.test.ts`], {
    dir: "extensions",
    env,
    name,
    passWithNoTests: true,
  });
}
