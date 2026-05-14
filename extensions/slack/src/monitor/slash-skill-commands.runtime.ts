import { listSkillCommandsForAgents as listSkillCommandsForAgentsImpl } from "zhushou/plugin-sdk/command-auth";

type ListSkillCommandsForAgents =
  typeof import("zhushou/plugin-sdk/command-auth").listSkillCommandsForAgents;

export function listSkillCommandsForAgents(
  ...args: Parameters<ListSkillCommandsForAgents>
): ReturnType<ListSkillCommandsForAgents> {
  return listSkillCommandsForAgentsImpl(...args);
}
