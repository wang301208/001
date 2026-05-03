import { readStringOrNumberParam, readStringParam } from "zhushou/plugin-sdk/channel-actions";
import type { ZhushouConfig } from "zhushou/plugin-sdk/config-runtime";

export { resolveReactionMessageId } from "zhushou/plugin-sdk/channel-actions";
export { handleWhatsAppAction } from "./action-runtime.js";
export { isWhatsAppGroupJid, normalizeWhatsAppTarget } from "./normalize.js";
export { readStringOrNumberParam, readStringParam, type ZhushouConfig };
