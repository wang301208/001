import type { ZhushouConfig } from "../../config/types.zhushou.js";
import type { MsgContext } from "../templating.js";
import { buildCommandTestParams as buildBaseCommandTestParams } from "./commands.test-harness.js";

export function buildCommandTestParams(
  commandBody: string,
  cfg: ZhushouConfig,
  ctxOverrides?: Partial<MsgContext>,
) {
  return buildBaseCommandTestParams(commandBody, cfg, ctxOverrides);
}
