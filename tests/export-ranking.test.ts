import assert from "node:assert/strict";
import test from "node:test";
import { rankExportCandidates } from "../lib/export-ranking.ts";

test("archive CSV ranks by score and confidence rather than upload order", () => {
  const rows = ["low", "unranked", "high", "tie", "zero"].map(id => ({ candidate: { id, name: id } }));
  const matches = new Map([
    ["low", { score: 40, confidence: 90 }],
    ["high", { score: 95, confidence: 95 }],
    ["tie", { score: 95, confidence: 80 }],
    ["zero", { score: 0, confidence: 10 }],
  ]);
  assert.deepEqual(rankExportCandidates(rows, matches).map(row => row.candidate.id), ["high", "tie", "low", "zero", "unranked"]);
  assert.equal(rows[0].candidate.id, "low", "the original pool is not mutated");
});
