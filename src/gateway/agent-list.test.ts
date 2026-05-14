import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import { withStateDirEnv } from "../test-helpers/state-dir-env.js";
import { listGatewayAgentsBasic } from "./agent-list.js";

describe("listGatewayAgentsBasic", () => {
  test("keeps explicit agents.list scope over disk-only agents while allowing charter agents", async () => {
    await withStateDirEnv("zhushou-agent-basic-", async ({ stateDir }) => {
      fs.mkdirSync(path.join(stateDir, "agents", "main"), { recursive: true });
      fs.mkdirSync(path.join(stateDir, "agents", "codex"), { recursive: true });

      const cfg = {
        session: { mainKey: "main" },
        agents: { list: [{ id: "main", default: true }] },
      } as ZhushouConfig;

      const { agents } = listGatewayAgentsBasic(cfg);
      const founder = agents.find((agent) => agent.id === "founder");
      expect(agents.map((agent) => agent.id)).toContain("main");
      expect(agents.map((agent) => agent.id)).toContain("founder");
      expect(agents.map((agent) => agent.id)).not.toContain("codex");
      expect(founder?.name).toBeTruthy();
      expect(founder?.configured).toBe(false);
      expect(founder?.governance).toMatchObject({
        charterDeclared: true,
        charterLayer: founder?.charterLayer,
        charterTitle: founder?.charterTitle,
      });
      expect(founder?.governanceContract).toMatchObject({
        agentId: "founder",
        charterDeclared: true,
        charterLayer: founder?.charterLayer,
        charterTitle: founder?.charterTitle,
      });
    });
  });

  test("does not append charter agents before agents.list is enabled", async () => {
    await withStateDirEnv("zhushou-agent-basic-", async ({ stateDir }) => {
      fs.mkdirSync(path.join(stateDir, "agents", "main"), { recursive: true });
      fs.mkdirSync(path.join(stateDir, "agents", "codex"), { recursive: true });

      const cfg = {
        session: { mainKey: "main" },
      } as ZhushouConfig;

      const { agents } = listGatewayAgentsBasic(cfg);
      expect(agents.map((agent) => agent.id)).toContain("main");
      expect(agents.map((agent) => agent.id)).toContain("codex");
      expect(agents.map((agent) => agent.id)).not.toContain("founder");
      expect(agents[0]?.governanceContract).toMatchObject({
        agentId: "main",
        charterDeclared: false,
      });
    });
  });
});
