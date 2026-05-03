import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { resetLocalEventBusForTest } from "./local-event-bus.js";
import { appendAuditFact, listAuditFacts, summarizeAuditStream } from "./audit-stream.js";

describe("audit-stream", () => {
  beforeEach(() => {
    resetLocalEventBusForTest();
  });

  test("appends and lists audit facts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "zhushou-audit-stream-"));
    const filePath = path.join(root, "facts.jsonl");
    try {
      const fact = await appendAuditFact({
        filePath,
        fact: {
          domain: "governance",
          action: "proposal.created",
          actor: {
            type: "agent",
            id: "founder",
          },
          refs: {
            proposalId: "gpr-1",
          },
          summary: "created proposal gpr-1",
        },
      });

      const listed = await listAuditFacts({
        filePath,
      });

      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({
        eventId: fact.eventId,
        domain: "governance",
        action: "proposal.created",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("summarizes recent audit activity", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "zhushou-audit-stream-summary-"));
    const filePath = path.join(root, "facts.jsonl");
    try {
      await appendAuditFact({
        filePath,
        fact: {
          domain: "task",
          action: "task.upserted",
          actor: {
            type: "runtime",
            id: "task-registry",
          },
        },
      });
      await appendAuditFact({
        filePath,
        fact: {
          domain: "autonomy",
          action: "fleet.history.recorded",
          actor: {
            type: "runtime",
            id: "autonomy",
          },
        },
      });

      const summary = await summarizeAuditStream({
        filePath,
      });

      expect(summary.total).toBe(2);
      expect(summary.domains).toEqual(["autonomy", "task"]);
      expect(summary.latestTs).toBeTypeOf("number");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
