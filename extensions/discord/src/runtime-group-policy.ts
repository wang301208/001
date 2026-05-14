// Keep this shim tiny so api.ts can expose the runtime-group helper
// without pulling monitor/provider.ts into extension startup.
export { resolveOpenProviderRuntimeGroupPolicy as resolveDiscordRuntimeGroupPolicy } from "zhushou/plugin-sdk/runtime-group-policy";
