import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { canonicalJson, sha256 } from "../src/domain/hash.js";
import type { CandidateAsset, Direction, ImageArtifact, PreparationRun } from "../src/domain/model.js";
import type { QuickPixelizeConfig } from "../src/quick-pixelize/config.js";
import { QUICK_PIXELIZE_ALGORITHM_IDENTITY } from "../src/quick-pixelize/config.js";
import { quickPixelize } from "../src/quick-pixelize/engine.js";
import { Workspace } from "../src/storage/workspace.js";
import { inspectPngBuffer } from "../src/validation/png.js";
import { SCHEMA_IDS, SchemaRegistry } from "../src/validation/schema-registry.js";

const GOLDEN_ROOT = "fixtures/goldens/quick-pixelize-1.0.0";
const MANIFEST_PATH = `${GOLDEN_ROOT}/TEST_QuickPixelizeCalibrationA_MechanicalGoldenSet_v01.json`;

interface GoldenEntry {
  direction: Direction;
  source: { path: string; encodedSha256: string; pixelDataSha256: string };
  reviewEvidence: {
    candidateAssetId: string;
    candidateAssetRecordPath: string;
    preparationRunId: string;
    preparationRunRecordPath: string;
  };
  artifact: ImageArtifact;
}

interface GoldenManifest {
  goldenStatus: "frozen-mechanical-regression";
  acceptanceScope: "quick-pixelize-mechanical-regression-only";
  canonStatus: "non-canon";
  artisticApproval: false;
  productionHeadSizeStandard: false;
  productionExportAllowed: false;
  taxonomyAllocated: false;
  algorithm: { identity: string };
  configuration: {
    id: "reference-cleanup-64";
    path: string;
    encodedSha256: string;
    canonicalSha256: string;
    value: QuickPixelizeConfig;
  };
  comparisonEvidence: {
    reviewBundleId: string;
    reviewBundlePath: string;
    preservedNonGoldenConfigurationIds: string[];
  };
  goldens: GoldenEntry[];
}

test("accepted Quick Pixelize 1.0.0 mechanical goldens reproduce exactly", async () => {
  const schemas = await SchemaRegistry.create();
  const manifestDocument = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const manifest = manifestDocument as GoldenManifest;

  assert.equal(schemas.validate(SCHEMA_IDS.quickPixelizeMechanicalGoldenSet, manifestDocument).valid, true);
  assert.equal(manifest.algorithm.identity, QUICK_PIXELIZE_ALGORITHM_IDENTITY);
  assert.equal(manifest.goldenStatus, "frozen-mechanical-regression");
  assert.equal(manifest.acceptanceScope, "quick-pixelize-mechanical-regression-only");
  assert.equal(manifest.artisticApproval, false);
  assert.equal(manifest.productionHeadSizeStandard, false);
  assert.equal(manifest.canonStatus, "non-canon");
  assert.equal(manifest.productionExportAllowed, false);
  assert.equal(manifest.taxonomyAllocated, false);
  assert.deepEqual(manifest.goldens.map((entry) => entry.direction), ["facing-left", "facing-right"]);

  const configBytes = await readFile(manifest.configuration.path);
  const frozenConfig = JSON.parse(configBytes.toString("utf8")) as QuickPixelizeConfig;
  const reviewConfigBytes = await readFile(
    "review/phase-2b-1/TEST_QuickPixelizeCalibrationA_UIS_v01/configs/reference-cleanup-64.json",
  );
  assert.equal(sha256(configBytes), manifest.configuration.encodedSha256);
  assert.equal(sha256(canonicalJson(frozenConfig)), manifest.configuration.canonicalSha256);
  assert.deepEqual(frozenConfig, manifest.configuration.value);
  assert.deepEqual(configBytes, reviewConfigBytes);

  for (const entry of manifest.goldens) {
    const sourceBytes = await readFile(entry.source.path);
    const sourceDescription = inspectPngBuffer(sourceBytes);
    assert.equal(sourceDescription.encodedSha256, entry.source.encodedSha256);
    assert.equal(sourceDescription.pixelDataSha256, entry.source.pixelDataSha256);

    const goldenBytes = await readFile(entry.artifact.path);
    const goldenDescription = inspectPngBuffer(goldenBytes);
    assert.deepEqual({ mediaType: "image/png", ...goldenDescription }, {
      mediaType: entry.artifact.mediaType,
      encodedSha256: entry.artifact.encodedSha256,
      pixelDataSha256: entry.artifact.pixelDataSha256,
      byteLength: entry.artifact.byteLength,
      width: entry.artifact.width,
      height: entry.artifact.height,
      hasAlphaChannel: entry.artifact.hasAlphaChannel,
      hasTransparency: entry.artifact.hasTransparency,
    });

    const reproduction = quickPixelize(sourceBytes, frozenConfig);
    assert.deepEqual(reproduction.outputPng, goldenBytes);
    assert.equal(reproduction.outputDescription.encodedSha256, entry.artifact.encodedSha256);
    assert.equal(reproduction.outputDescription.pixelDataSha256, entry.artifact.pixelDataSha256);

    const candidate = JSON.parse(await readFile(entry.reviewEvidence.candidateAssetRecordPath, "utf8")) as CandidateAsset;
    const run = JSON.parse(await readFile(entry.reviewEvidence.preparationRunRecordPath, "utf8")) as PreparationRun;
    assert.equal(candidate.id, entry.reviewEvidence.candidateAssetId);
    assert.equal(run.id, entry.reviewEvidence.preparationRunId);
    assert.equal(candidate.preparationRunId, run.id);
    assert.equal(candidate.direction, entry.direction);
    assert.equal(candidate.initialState, "candidate");
    assert.equal(candidate.artifact.encodedSha256, entry.artifact.encodedSha256);
    assert.equal(candidate.artifact.pixelDataSha256, entry.artifact.pixelDataSha256);
    assert.equal(run.workflow.id, "quick-pixelize");
    assert.equal(run.workflow.version, "1.0.0");

    const workspaceRoot = path.dirname(path.dirname(path.dirname(entry.reviewEvidence.candidateAssetRecordPath)));
    const workspace = new Workspace(workspaceRoot);
    assert.deepEqual(await workspace.loadReviewEvents(candidate.id), []);
  }
});

test("unselected Phase 2B-1 configurations remain comparison evidence, not goldens", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as GoldenManifest;
  const reviewBundle = JSON.parse(await readFile(manifest.comparisonEvidence.reviewBundlePath, "utf8")) as {
    id: string;
    goldenStatus: string;
    productionExportAllowed: boolean;
    configurations: Array<{ id: string }>;
  };

  assert.equal(reviewBundle.id, manifest.comparisonEvidence.reviewBundleId);
  assert.equal(reviewBundle.goldenStatus, "not-frozen");
  assert.equal(reviewBundle.productionExportAllowed, false);
  assert.deepEqual(manifest.comparisonEvidence.preservedNonGoldenConfigurationIds, [
    "alpha-preserve-64",
    "zero-padding-64",
    "larger-grid-96",
  ]);
  const availableIds = new Set(reviewBundle.configurations.map((configuration) => configuration.id));
  for (const id of manifest.comparisonEvidence.preservedNonGoldenConfigurationIds) assert.equal(availableIds.has(id), true);
  assert.equal(manifest.configuration.id, "reference-cleanup-64");
});

test("mechanical golden schema rejects artistic, sizing, canon, and export promotion", async () => {
  const schemas = await SchemaRegistry.create();
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));

  for (const mutation of [
    { artisticApproval: true },
    { productionHeadSizeStandard: true },
    { canonStatus: "production-unspecified" },
    { productionExportAllowed: true },
    { taxonomyAllocated: true },
  ]) {
    assert.equal(schemas.validate(SCHEMA_IDS.quickPixelizeMechanicalGoldenSet, { ...manifest, ...mutation }).valid, false);
  }
});
