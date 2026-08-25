import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { QuickPixelizeConfig } from "../src/quick-pixelize/config.js";
import {
  generateQuickPixelizeReviewBundle,
  type QuickPixelizeReviewPlan,
} from "../src/review/quick-pixelize-review-bundle.js";
import { Workspace } from "../src/storage/workspace.js";
import { inspectPngBuffer } from "../src/validation/png.js";
import { SCHEMA_IDS, SchemaRegistry } from "../src/validation/schema-registry.js";
import { withTestDirectory } from "./helpers.js";

const FIXTURE_PATH = "fixtures/calibration/TEST_HeadPreparationCalibration-UncleA_UIS_v01.fixture.json";

function config(alphaThreshold = 15): QuickPixelizeConfig {
  return {
    schemaVersion: "uis.head-preparation.quick-pixelize-config/1",
    algorithmVersion: "1.0.0",
    alpha: { mode: "clear-at-or-below", threshold: alphaThreshold },
    bounds: { mode: "normalized-alpha-content" },
    target: { width: 32, height: 32, fit: "contain" },
    resampling: "nearest-neighbor",
    transparentPadding: { top: 1, right: 1, bottom: 1, left: 1 },
    pngEncoding: {
      colorType: "rgba",
      bitDepth: 8,
      filterType: 0,
      deflateLevel: 9,
      deflateStrategy: 3,
    },
  };
}

function plan(): QuickPixelizeReviewPlan {
  return {
    id: "TEST_ReviewBundleUnit",
    fixturePath: FIXTURE_PATH,
    referenceConfigurationId: "reference",
    generatedAt: "2026-08-25T08:30:00.000Z",
    configurations: [
      {
        id: "reference",
        label: "Reference",
        controlledChange: "reference",
        reviewQuestion: "Is identity preserved?",
        config: config(),
      },
      {
        id: "alpha-zero",
        label: "Alpha zero",
        controlledChange: "alpha-threshold",
        reviewQuestion: "Are low-alpha remnants visible?",
        config: config(0),
      },
    ],
  };
}

test("review bundle generates non-canon candidates and preserves Phase 1 records", async () => {
  await withTestDirectory("phase-2b-1-review", async (directory) => {
    const output = path.join(directory, "review-bundle");
    const schemas = await SchemaRegistry.create();
    const sourceFixtureBefore = await readFile(FIXTURE_PATH);
    const bundle = await generateQuickPixelizeReviewBundle(plan(), output, schemas);

    assert.equal(schemas.validate(SCHEMA_IDS.quickPixelizeReviewBundle, bundle).valid, true);
    assert.equal(bundle.canonStatus, "non-canon");
    assert.equal(bundle.goldenStatus, "not-frozen");
    assert.equal(bundle.productionExportAllowed, false);
    assert.equal(bundle.algorithm.identity, "quick-pixelize/1.0.0");
    assert.equal(bundle.results.length, 4);
    assert.deepEqual(new Set(bundle.results.map((result) => result.direction)), new Set(["facing-left", "facing-right"]));

    const workspace = new Workspace(path.join(output, bundle.workspaceRoot));
    for (const result of bundle.results) {
      const candidate = JSON.parse(
        await readFile(path.join(output, result.candidateAssetRecordPath), "utf8"),
      );
      const run = JSON.parse(
        await readFile(path.join(output, result.preparationRunRecordPath), "utf8"),
      );
      assert.equal(schemas.validate(SCHEMA_IDS.candidateAsset, candidate).valid, true);
      assert.equal(schemas.validate(SCHEMA_IDS.preparationRun, run).valid, true);
      assert.equal(candidate.initialState, "candidate");
      assert.equal(candidate.direction, result.direction);
      assert.equal(run.workflow.id, "quick-pixelize");
      assert.deepEqual(await workspace.loadReviewEvents(candidate.id), []);

      const reviewPng = inspectPngBuffer(await readFile(path.join(output, result.reviewPngPath)));
      assert.equal(reviewPng.encodedSha256, result.artifact.encodedSha256);
      assert.equal(reviewPng.pixelDataSha256, result.artifact.pixelDataSha256);
    }

    assert.deepEqual(await readFile(FIXTURE_PATH), sourceFixtureBefore);
    assert.match(await readFile(path.join(output, "REVIEW.md"), "utf8"), /No output is approved or frozen as a golden/);
    assert.match(await readFile(path.join(output, "REVIEW.html"), "utf8"), /NOT A FROZEN GOLDEN/);
    await assert.rejects(
      generateQuickPixelizeReviewBundle(plan(), output, schemas),
      /output directory already exists/,
    );
  });
});

test("review manifest schema rejects golden or export claims", async () => {
  await withTestDirectory("phase-2b-1-policy", async (directory) => {
    const schemas = await SchemaRegistry.create();
    const bundle = await generateQuickPixelizeReviewBundle(plan(), path.join(directory, "bundle"), schemas);
    assert.equal(schemas.validate(SCHEMA_IDS.quickPixelizeReviewBundle, { ...bundle, goldenStatus: "frozen" }).valid, false);
    assert.equal(schemas.validate(SCHEMA_IDS.quickPixelizeReviewBundle, { ...bundle, productionExportAllowed: true }).valid, false);
  });
});

test("controlled comparisons reject configuration scope creep", async () => {
  await withTestDirectory("phase-2b-1-control", async (directory) => {
    const invalidPlan = plan();
    const comparison = invalidPlan.configurations[1];
    assert.ok(comparison);
    comparison.config.target = { width: 64, height: 64, fit: "contain" };
    await assert.rejects(
      generateQuickPixelizeReviewBundle(invalidPlan, path.join(directory, "bundle")),
      /changes fields outside its declared controlled variable/,
    );
  });
});
