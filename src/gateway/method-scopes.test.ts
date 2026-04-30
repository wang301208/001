import { afterEach, describe, expect, it } from "vitest";
import { createEmptyPluginRegistry } from "../plugins/registry-empty.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import {
  authorizeOperatorScopesForMethod,
  isGatewayMethodClassified,
  resolveLeastPrivilegeOperatorScopesForMethod,
} from "./method-scopes.js";
import { listGatewayMethods } from "./server-methods-list.js";
import { coreGatewayHandlers } from "./server-methods.js";

const RESERVED_ADMIN_PLUGIN_METHOD = "config.plugin.inspect";

function setPluginGatewayMethodScope(method: string, scope: "operator.read" | "operator.write") {
  const registry = createEmptyPluginRegistry();
  registry.gatewayMethodScopes = {
    [method]: scope,
  };
  setActivePluginRegistry(registry);
}

afterEach(() => {
  setActivePluginRegistry(createEmptyPluginRegistry());
});

describe("method scope resolution", () => {
  it.each([
    ["sessions.resolve", ["operator.read"]],
    ["config.schema.lookup", ["operator.read"]],
    ["autonomy.list", ["operator.read"]],
    ["autonomy.overview", ["operator.read"]],
    ["autonomy.capability.inventory", ["operator.read"]],
    ["autonomy.genesis.plan", ["operator.read"]],
    ["governance.capability.inventory", ["operator.read"]],
    ["governance.capability.assetRegistry", ["operator.read"]],
    ["governance.team", ["operator.read"]],
    ["governance.genesis.plan", ["operator.read"]],
    ["governance.proposals.synthesize", ["operator.admin"]],
    ["governance.proposals.reconcile", ["operator.admin"]],
    ["autonomy.loop.show", ["operator.read"]],
    ["sessions.create", ["operator.write"]],
    ["sessions.send", ["operator.write"]],
    ["sessions.abort", ["operator.write"]],
    ["sessions.messages.subscribe", ["operator.read"]],
    ["sessions.messages.unsubscribe", ["operator.read"]],
    ["node.pair.approve", ["operator.pairing"]],
    ["poll", ["operator.write"]],
    ["autonomy.start", ["operator.admin"]],
    ["autonomy.heal", ["operator.admin"]],
    ["autonomy.supervise", ["operator.admin"]],
    ["autonomy.activate", ["operator.admin"]],
    ["autonomy.loop.upsert", ["operator.admin"]],
    ["autonomy.loop.reconcile", ["operator.admin"]],
    ["autonomy.loop.remove", ["operator.admin"]],
    ["config.patch", ["operator.admin"]],
    ["wizard.start", ["operator.admin"]],
    ["update.run", ["operator.admin"]],
  ])("resolves least-privilege scopes for %s", (method, expected) => {
    expect(resolveLeastPrivilegeOperatorScopesForMethod(method)).toEqual(expected);
  });

  it("leaves node-only pending drain outside operator scopes", () => {
    expect(resolveLeastPrivilegeOperatorScopesForMethod("node.pending.drain")).toEqual([]);
  });

  it("returns empty scopes for unknown methods", () => {
    expect(resolveLeastPrivilegeOperatorScopesForMethod("totally.unknown.method")).toEqual([]);
  });

  it("reads plugin-registered gateway method scopes from the active plugin registry", () => {
    const registry = createEmptyPluginRegistry();
    registry.gatewayMethodScopes = {
      "browser.request": "operator.write",
    };
    setActivePluginRegistry(registry);

    expect(resolveLeastPrivilegeOperatorScopesForMethod("browser.request")).toEqual([
      "operator.write",
    ]);
  });

  it("keeps reserved admin namespaces admin-only even if a plugin scope is narrower", () => {
    setPluginGatewayMethodScope(RESERVED_ADMIN_PLUGIN_METHOD, "operator.read");

    expect(resolveLeastPrivilegeOperatorScopesForMethod(RESERVED_ADMIN_PLUGIN_METHOD)).toEqual([
      "operator.admin",
    ]);
  });
});

describe("operator scope authorization", () => {
  it.each([
    ["health", ["operator.read"], { allowed: true }],
    ["health", ["operator.write"], { allowed: true }],
    ["autonomy.show", ["operator.read"], { allowed: true }],
    ["autonomy.overview", ["operator.read"], { allowed: true }],
    ["autonomy.capability.inventory", ["operator.read"], { allowed: true }],
    ["autonomy.genesis.plan", ["operator.read"], { allowed: true }],
    ["governance.capability.inventory", ["operator.read"], { allowed: true }],
    ["governance.capability.assetRegistry", ["operator.read"], { allowed: true }],
    ["governance.team", ["operator.read"], { allowed: true }],
    ["governance.genesis.plan", ["operator.read"], { allowed: true }],
    ["governance.proposals.synthesize", ["operator.admin"], { allowed: true }],
    ["governance.proposals.reconcile", ["operator.admin"], { allowed: true }],
    ["autonomy.loop.show", ["operator.read"], { allowed: true }],
    ["autonomy.heal", ["operator.admin"], { allowed: true }],
    ["autonomy.supervise", ["operator.admin"], { allowed: true }],
    ["autonomy.activate", ["operator.admin"], { allowed: true }],
    ["config.schema.lookup", ["operator.read"], { allowed: true }],
    ["config.patch", ["operator.admin"], { allowed: true }],
  ])("authorizes %s for scopes %j", (method, scopes, expected) => {
    expect(authorizeOperatorScopesForMethod(method, scopes)).toEqual(expected);
  });

  it("requires operator.write for write methods", () => {
    expect(authorizeOperatorScopesForMethod("send", ["operator.read"])).toEqual({
      allowed: false,
      missingScope: "operator.write",
    });
  });

  it("requires pairing scope for node pairing approvals", () => {
    expect(authorizeOperatorScopesForMethod("node.pair.approve", ["operator.pairing"])).toEqual({
      allowed: true,
    });
    expect(authorizeOperatorScopesForMethod("node.pair.approve", ["operator.write"])).toEqual({
      allowed: false,
      missingScope: "operator.pairing",
    });
  });

  it.each(["exec.approval.get", "exec.approval.list", "exec.approval.resolve"])(
    "requires approvals scope for %s",
    (method) => {
      expect(authorizeOperatorScopesForMethod(method, ["operator.write"])).toEqual({
        allowed: false,
        missingScope: "operator.approvals",
      });
      expect(authorizeOperatorScopesForMethod(method, ["operator.approvals"])).toEqual({
        allowed: true,
      });
    },
  );

  it.each([
    "plugin.approval.list",
    "plugin.approval.request",
    "plugin.approval.waitDecision",
    "plugin.approval.resolve",
  ])("requires approvals scope for %s", (method) => {
    expect(authorizeOperatorScopesForMethod(method, ["operator.write"])).toEqual({
      allowed: false,
      missingScope: "operator.approvals",
    });
    expect(authorizeOperatorScopesForMethod(method, ["operator.approvals"])).toEqual({
      allowed: true,
    });
  });

  it("requires admin for unknown methods", () => {
    expect(authorizeOperatorScopesForMethod("unknown.method", ["operator.read"])).toEqual({
      allowed: false,
      missingScope: "operator.admin",
    });
  });

  it("requires admin for reserved admin namespaces even if a plugin registered a narrower scope", () => {
    setPluginGatewayMethodScope(RESERVED_ADMIN_PLUGIN_METHOD, "operator.read");

    expect(
      authorizeOperatorScopesForMethod(RESERVED_ADMIN_PLUGIN_METHOD, ["operator.read"]),
    ).toEqual({
      allowed: false,
      missingScope: "operator.admin",
    });
  });
});

describe("plugin approval method registration", () => {
  it("lists all plugin approval methods", () => {
    const methods = listGatewayMethods();
    expect(methods).toContain("plugin.approval.list");
    expect(methods).toContain("plugin.approval.request");
    expect(methods).toContain("plugin.approval.waitDecision");
    expect(methods).toContain("plugin.approval.resolve");
  });

  it("lists capability inventory and genesis plan methods", () => {
    const methods = listGatewayMethods();
    expect(methods).toContain("autonomy.capability.inventory");
    expect(methods).toContain("autonomy.genesis.plan");
    expect(methods).toContain("governance.capability.inventory");
    expect(methods).toContain("governance.capability.assetRegistry");
    expect(methods).toContain("governance.team");
    expect(methods).toContain("governance.genesis.plan");
    expect(methods).toContain("governance.proposals.synthesize");
    expect(methods).toContain("governance.proposals.reconcile");
    expect(methods).toContain("autonomy.governance.reconcile");
    expect(methods).toContain("autonomy.supervise");
    expect(methods).toContain("autonomy.activate");
  });

  it("classifies plugin approval methods", () => {
    expect(isGatewayMethodClassified("plugin.approval.list")).toBe(true);
    expect(isGatewayMethodClassified("plugin.approval.request")).toBe(true);
    expect(isGatewayMethodClassified("plugin.approval.waitDecision")).toBe(true);
    expect(isGatewayMethodClassified("plugin.approval.resolve")).toBe(true);
  });
});

describe("core gateway method classification", () => {
  it("treats node-role methods as classified even without operator scopes", () => {
    expect(isGatewayMethodClassified("node.pending.drain")).toBe(true);
    expect(isGatewayMethodClassified("node.pending.pull")).toBe(true);
  });

  it("classifies every exposed core gateway handler method", () => {
    const unclassified = Object.keys(coreGatewayHandlers).filter(
      (method) => !isGatewayMethodClassified(method),
    );
    expect(unclassified).toEqual([]);
  });

  it("classifies every listed gateway method name", () => {
    const unclassified = listGatewayMethods().filter(
      (method) => !isGatewayMethodClassified(method),
    );
    expect(unclassified).toEqual([]);
  });
});

describe("CLI default operator scopes", () => {
  it("includes operator.talk.secrets for node-role device pairing approvals", async () => {
    const { CLI_DEFAULT_OPERATOR_SCOPES } = await import("./method-scopes.js");
    expect(CLI_DEFAULT_OPERATOR_SCOPES).toContain("operator.talk.secrets");
  });
});
