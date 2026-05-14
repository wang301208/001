// Manual facade. Keep loader boundary explicit.
type FacadeModule = typeof import("@zhushou/zalo/setup-api.js");
import { isNormalizedSenderAllowed } from "./allow-from.js";
import {
  createLazyFacadeObjectValue,
  loadBundledPluginPublicSurfaceModuleSync,
} from "./facade-loader.js";
import { evaluateSenderGroupAccess } from "./group-access.js";
import { resolveOpenProviderRuntimeGroupPolicy } from "../config/runtime-group-policy.js";

function loadFacadeModule(): FacadeModule {
  return loadBundledPluginPublicSurfaceModuleSync<FacadeModule>({
    dirName: "zalo",
    artifactBasename: "setup-api.js",
  });
}
const ZALO_ALLOW_FROM_PREFIX_RE = /^(zalo|zl):/i;

export const evaluateZaloGroupAccess: FacadeModule["evaluateZaloGroupAccess"] = ((params) =>
  evaluateSenderGroupAccess({
    providerConfigPresent: params.providerConfigPresent,
    configuredGroupPolicy: params.configuredGroupPolicy,
    defaultGroupPolicy: params.defaultGroupPolicy,
    groupAllowFrom: params.groupAllowFrom,
    senderId: params.senderId,
    isSenderAllowed: (senderId, allowFrom) =>
      isNormalizedSenderAllowed({
        senderId,
        allowFrom,
        stripPrefixRe: ZALO_ALLOW_FROM_PREFIX_RE,
      }),
  })) as FacadeModule["evaluateZaloGroupAccess"];
export const resolveZaloRuntimeGroupPolicy: FacadeModule["resolveZaloRuntimeGroupPolicy"] = ((
  params,
) =>
  resolveOpenProviderRuntimeGroupPolicy({
    providerConfigPresent: params.providerConfigPresent,
    groupPolicy: params.groupPolicy,
    defaultGroupPolicy: params.defaultGroupPolicy,
  })) as FacadeModule["resolveZaloRuntimeGroupPolicy"];
export const zaloSetupAdapter: FacadeModule["zaloSetupAdapter"] = createLazyFacadeObjectValue(
  () => loadFacadeModule()["zaloSetupAdapter"] as object,
) as FacadeModule["zaloSetupAdapter"];
export const zaloSetupWizard: FacadeModule["zaloSetupWizard"] = createLazyFacadeObjectValue(
  () => loadFacadeModule()["zaloSetupWizard"] as object,
) as FacadeModule["zaloSetupWizard"];
