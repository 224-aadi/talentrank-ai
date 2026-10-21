import assert from "node:assert/strict";
import test from "node:test";
import { scoreCandidate } from "../lib/matching.ts";

const score = (jobText: string, resumeText: string) => scoreCandidate({ jobText, resumeText, jobId: "qa", candidateId: "qa", roleTemplate: "auto", hardRules: [] });

test("ordinary words do not imply short programming aliases", () => {
  const result = score("Requirements: build reliable production assemblies and CAD models.", "Experienced mechanical engineer designing production assemblies and CAD models.");
  for (const skill of ["typescript", "react", "machine learning"]) {
    assert.ok(!result.matchedSignals.includes(skill), skill);
    assert.ok(!result.missingSignals.includes(skill), skill);
  }
});

test("mechanical-design evidence outranks an unrelated software resume", () => {
  const job = "Mechanical Design Engineer. Requirements: SolidWorks, AutoCAD, CAD design, GD&T, tolerance analysis, and BOM management. Bachelor's degree and three years of experience.";
  const fit = score(job, "Mechanical design engineer with 6 years of experience. Skills: SolidWorks, AutoCAD, GD&T, tolerance analysis and BOM management. Created CAD assemblies and production drawings. Bachelor degree in mechanical engineering.");
  const unrelated = score(job, "Software developer with 6 years of experience. Skills: React, TypeScript, Node.js and cloud infrastructure. Built web applications. Bachelor degree in computer science.");
  assert.equal(fit.roleFamily, "operations");
  assert.ok(fit.matchedSignals.includes("solidworks"));
  assert.ok(fit.score > unrelated.score + 20);
  assert.ok(!fit.missingSignals.includes("react"));
});
