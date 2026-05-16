import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";

describe("createAuditChain", () => {
  it("append() 添加审计条目后 getEntries() 返回包含该条目", async () => {
    const { createAuditChain } = await import("./chain.js");
    const chain = createAuditChain();
    const entry = chain.append({
      actor: "user-1",
      action: "login",
      resource: "session",
      outcome: "success",
    });
    const entries = chain.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(entry.id);
    expect(entries[0].actor).toBe("user-1");
  });

  it("verify() 在无篡改时返回 valid: true", async () => {
    const { createAuditChain } = await import("./chain.js");
    const chain = createAuditChain();
    chain.append({ actor: "admin", action: "create", resource: "resource-1", outcome: "success" });
    chain.append({ actor: "admin", action: "update", resource: "resource-1", outcome: "success" });
    const result = chain.verify();
    expect(result.valid).toBe(true);
  });

  it("Merkle Proof: merkleProof() 返回有效 proof 且可验证至根哈希", async () => {
    const { createAuditChain } = await import("./chain.js");
    const chain = createAuditChain();
    const e1 = chain.append({ actor: "user-a", action: "read", resource: "file-1", outcome: "success" });
    const e2 = chain.append({ actor: "user-b", action: "write", resource: "file-2", outcome: "success" });
    const proofResult = chain.merkleProof(e1.id);
    expect(proofResult).not.toBeNull();
    expect(proofResult!.proof).toBeDefined();
    expect(proofResult!.rootHash).toBe(chain.getRootHash());
    const proofResult2 = chain.merkleProof(e2.id);
    expect(proofResult2).not.toBeNull();
    expect(proofResult2!.rootHash).toBe(chain.getRootHash());
  });

  it("链式哈希：每个条目的 previousHash 等于前一个条目的 hash", async () => {
    const { createAuditChain } = await import("./chain.js");
    const chain = createAuditChain();
    const e1 = chain.append({ actor: "user-1", action: "deploy", resource: "app-1", outcome: "success" });
    const e2 = chain.append({ actor: "user-2", action: "rollback", resource: "app-1", outcome: "failure" });
    const e3 = chain.append({ actor: "user-1", action: "deploy", resource: "app-1", outcome: "success" });
    expect(e1.previousHash).toBe("0".repeat(64));
    expect(e2.previousHash).toBe(e1.hash);
    expect(e3.previousHash).toBe(e2.hash);
  });
});
