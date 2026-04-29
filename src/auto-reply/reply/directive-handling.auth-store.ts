import { ensureAuthProfileStore } from "../../agents/auth-profiles.js";

type EnsureAuthProfileStoreFn = typeof ensureAuthProfileStore;

let authProfileStoreResolverForTest: EnsureAuthProfileStoreFn | undefined;

export function setDirectiveHandlingAuthProfileStoreResolverForTest(
  resolver: EnsureAuthProfileStoreFn | undefined,
): void {
  authProfileStoreResolverForTest = resolver;
}

export function resolveDirectiveHandlingAuthProfileStore(agentDir?: string) {
  return (authProfileStoreResolverForTest ?? ensureAuthProfileStore)(agentDir, {
    allowKeychainPrompt: false,
  });
}
