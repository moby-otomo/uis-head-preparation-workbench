import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { assertProductionExportEligible, deriveReviewState } from "../src/domain/lifecycle.js";
import { SchemaRegistry } from "../src/validation/schema-registry.js";
import { Validator } from "../src/validation/validator.js";
import { createCandidateScenario, FIXED_TIME, withTestDirectory, writeSyntheticPng } from "./helpers.js";

test("candidate starts candidate and approval is an explicit append-only human event", async () => {
  await withTestDirectory("candidate-approval", async (directory) => {
    const { workspace, candidate } = await createCandidateScenario(directory);
    assert.equal(candidate.initialState, "candidate");
    assert.equal(deriveReviewState(candidate, []), "candidate");

    const validator = new Validator(workspace, await SchemaRegistry.create());
    const report = await validator.validateCandidate(candidate.id, undefined, {
      id: "validation-candidate-left-v1",
      createdAt: FIXED_TIME,
    });
    assert.equal(report.coreOutcome, "pass");
    assert.equal(report.compatibilityOutcome, "unverified");
    await workspace.saveValidationReport(report);
    const approval = await workspace.appendReviewEvent(candidate.id, {
      id: "review-approve-left-v1",
      action: "approve",
      actorId: "owner-test",
      occurredAt: FIXED_TIME,
      reason: "Synthetic lifecycle approval test.",
      validationReportId: report.id,
    });

    assert.equal(deriveReviewState(candidate, [approval]), "approved");
    await assert.rejects(
      workspace.appendReviewEvent(candidate.id, {
        id: "review-approve-left-v2",
        action: "approve",
        actorId: "owner-test",
        occurredAt: FIXED_TIME,
        reason: "Duplicate approval must fail.",
        validationReportId: report.id,
      }),
      /cannot approve.*approved state/,
    );
    assert.throws(() => assertProductionExportEligible(candidate, "approved", "pass"), /blocked from production\/canon export/);
  });
});

test("rejected candidates cannot be approved and supersession requires same direction", async () => {
  await withTestDirectory("invalid-transitions", async (directory) => {
    const { workspace, candidate, source, inputPath } = await createCandidateScenario(directory);
    const rejection = await workspace.appendReviewEvent(candidate.id, {
      id: "review-reject-left-v1",
      action: "reject",
      actorId: "owner-test",
      occurredAt: FIXED_TIME,
      reason: "Rejected for lifecycle test.",
    });
    assert.equal(deriveReviewState(candidate, [rejection]), "rejected");

    const validator = new Validator(workspace, await SchemaRegistry.create());
    const report = await validator.validateCandidate(candidate.id, undefined, {
      id: "validation-rejected-left-v1",
      createdAt: FIXED_TIME,
    });
    await workspace.saveValidationReport(report);
    await assert.rejects(
      workspace.appendReviewEvent(candidate.id, {
        id: "review-invalid-approval",
        action: "approve",
        actorId: "owner-test",
        occurredAt: FIXED_TIME,
        reason: "Must fail.",
        validationReportId: report.id,
      }),
      /cannot approve.*rejected state/,
    );

    const rightPath = path.join(directory, "input", "right.png");
    await writeSyntheticPng(rightPath, [70, 90, 110, 0]);
    const rightSource = await workspace.importSource({
      inputPath: rightPath,
      id: "source-right-v1",
      identity: source.identity,
      direction: "facing-right",
      sourceType: "synthetic-test-png",
      importedAt: FIXED_TIME,
      importedBy: "test-suite",
    });
    const rightRun = await workspace.createPreparationRun({
      id: "run-right-v1",
      sourceAssetId: rightSource.id,
      workflow: { id: "artist-import", version: "1.0.0", deterministic: true, parameters: {} },
      createdAt: FIXED_TIME,
    });
    const rightCandidate = await workspace.createCandidate({
      inputPath,
      id: "candidate-right-v1",
      sourceAssetId: rightSource.id,
      preparationRunId: rightRun.id,
      direction: "facing-right",
      createdAt: FIXED_TIME,
    });
    await assert.rejects(
      workspace.appendReviewEvent(candidate.id, {
        id: "review-invalid-supersession",
        action: "supersede",
        actorId: "owner-test",
        occurredAt: FIXED_TIME,
        reason: "Wrong-direction replacement must fail.",
        replacementCandidateAssetId: rightCandidate.id,
      }),
      /preserve identity and direction/,
    );
  });
});

test("candidate creation rejects implicit direction change", async () => {
  await withTestDirectory("no-mirroring", async (directory) => {
    const { workspace, source, inputPath } = await createCandidateScenario(directory);
    const run = await workspace.createPreparationRun({
      id: "run-no-mirror",
      sourceAssetId: source.id,
      workflow: { id: "artist-import", version: "1.0.0", deterministic: true, parameters: {} },
      createdAt: FIXED_TIME,
    });
    await assert.rejects(
      workspace.createCandidate({
        inputPath,
        id: "candidate-illicit-mirror",
        sourceAssetId: source.id,
        preparationRunId: run.id,
        direction: "facing-right",
        createdAt: FIXED_TIME,
      }),
      /silent mirroring is forbidden/,
    );
  });
});
