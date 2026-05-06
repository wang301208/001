import { describe, expect, it } from "vitest";

import { buildGovernanceProposalCreateInput } from "../../web/src/utils/governance-proposal-form";

describe("governance proposal form contract", () => {
  it("builds a backend-compatible write operation from the create form", () => {
    const result = buildGovernanceProposalCreateInput({
      title: "  Update charter policy  ",
      description: "  Keep the policy explicit.  ",
      type: "evolution",
      operationKind: "write",
      operationPath: " governance/charter/policies/access.yaml ",
      operationContent: "enabled: true\n",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        title: "Update charter policy",
        description: "Keep the policy explicit.",
        type: "evolution",
        operations: [
          {
            kind: "write",
            path: "policies/access.yaml",
            content: "enabled: true\n",
          },
        ],
      },
    });
  });

  it("builds delete operations without content", () => {
    const result = buildGovernanceProposalCreateInput({
      title: "Remove obsolete charter file",
      description: "",
      type: "cleanup",
      operationKind: "delete",
      operationPath: "agents/obsolete.yaml",
      operationContent: "ignored",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        title: "Remove obsolete charter file",
        type: "cleanup",
        operations: [{ kind: "delete", path: "agents/obsolete.yaml" }],
      },
    });
  });

  it("rejects missing operation path and missing write content before sending to the gateway", () => {
    expect(
      buildGovernanceProposalCreateInput({
        title: "Incomplete",
        description: "",
        type: "evolution",
        operationKind: "write",
        operationPath: "",
        operationContent: "content",
      }),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("path"),
    });

    expect(
      buildGovernanceProposalCreateInput({
        title: "Incomplete",
        description: "",
        type: "evolution",
        operationKind: "write",
        operationPath: "constitution.yaml",
        operationContent: "",
      }),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("content"),
    });
  });
});
