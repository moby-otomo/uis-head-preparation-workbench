import assert from "node:assert/strict";
import { chmod, readFile, writeFile } from "node:fs/promises";
import test from "node:test";

import type { CompatibilityProfile } from "../src/domain/model.js";
import { assertProductionExportEligible } from "../src/domain/lifecycle.js";
import { SCHEMA_IDS, SchemaRegistry } from "../src/validation/schema-registry.js";
import { Validator } from "../src/validation/validator.js";
import { createCandidateScenario, FIXED_TIME, withTestDirectory } from "./helpers.js";

test("hash tampering is detected and failure reports remain machine-readable", async () => {
  await withTestDirectory("tamper-detection", async (directory) => {
    const { workspace, source } = await createCandidateScenario(directory);
    const objectPath = workspace.resolvePortable(source.artifact.path);
    await chmod(objectPath, 0o644);
    const bytes = await readFile(objectPath);
    const tampered = Buffer.from(bytes);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 1;
    await writeFile(objectPath, tampered);

    const schemas = await SchemaRegistry.create();
    const report = await new Validator(workspace, schemas).validateSource(source.id, {
      id: "validation-tampered-source",
      createdAt: FIXED_TIME,
    });
    assert.equal(report.outcome, "fail");
    assert.equal(report.coreOutcome, "fail");
    assert.ok(report.checks.some((item) => item.code === "ENCODED_HASH_MISMATCH" || item.code === "PNG_INVALID"));
    const roundTrip = JSON.parse(JSON.stringify(report));
    assert.equal(schemas.validate(SCHEMA_IDS.validationReport, roundTrip).valid, true);
  });
});

test("valid Workbench candidate remains compatibility-unverified until an adapter exists", async () => {
  await withTestDirectory("compatibility-unverified", async (directory) => {
    const { workspace, candidate } = await createCandidateScenario(directory);
    const schemas = await SchemaRegistry.create();
    const profile = JSON.parse(
      await readFile("compatibility/profiles/uis-helmeted-head-cartridge-v1.json", "utf8"),
    ) as CompatibilityProfile;
    const validator = new Validator(workspace, schemas);
    const profileReport = validator.validateCompatibilityProfile(profile, {
      id: "validation-profile-v1",
      createdAt: FIXED_TIME,
    });
    assert.equal(profileReport.outcome, "pass");
    const report = await validator.validateCandidate(candidate.id, profile, {
      id: "validation-candidate-profile-v1",
      createdAt: FIXED_TIME,
    });
    assert.equal(report.coreOutcome, "pass");
    assert.equal(report.compatibilityOutcome, "unverified");
    assert.equal(report.outcome, "unverified");
    assert.ok(report.checks.some((item) => item.code === "COMPATIBILITY_ADAPTER_NOT_IMPLEMENTED"));
    assert.equal(schemas.validate(SCHEMA_IDS.validationReport, report).valid, true);
    const productionCandidate = {
      ...candidate,
      identity: { ...candidate.identity, characterId: "TAXO_Example", canonStatus: "production-unspecified" as const },
    };
    assert.throws(
      () => assertProductionExportEligible(productionCandidate, "approved", report.compatibilityOutcome),
      /requires explicitly passing compatibility validation/,
    );
  });
});
