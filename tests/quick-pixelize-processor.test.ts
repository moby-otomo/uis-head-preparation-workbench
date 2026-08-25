import assert from "node:assert/strict";
import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { QuickPixelizeConfig } from "../src/quick-pixelize/config.js";
import { QuickPixelizeProcessor } from "../src/quick-pixelize/processor.js";
import { Workspace } from "../src/storage/workspace.js";
import { SchemaRegistry } from "../src/validation/schema-registry.js";
import { sha256 } from "../src/domain/hash.js";
import { FIXED_TIME, withTestDirectory } from "./helpers.js";

const CALIBRATION_LEFT = "fixtures/calibration/TEST_HeadPreparationCalibration-UncleA-FacingLeft_UIS_v01.png";

async function loadConfig(): Promise<QuickPixelizeConfig> {
  return JSON.parse(
    await readFile("fixtures/contracts/valid/quick-pixelize-config.json", "utf8"),
  ) as QuickPixelizeConfig;
}

async function setup(directory: string): Promise<{ workspace: Workspace; processor: QuickPixelizeProcessor; sourceId: string }> {
  const workspace = new Workspace(path.join(directory, "workspace"));
  await workspace.initialize();
  const source = await workspace.importSource({
    inputPath: CALIBRATION_LEFT,
    id: "source-calibration-left-v1",
    identity: {
      characterId: "TEST_HeadPreparationCalibration-UncleA",
      displayName: "Workbench Calibration Uncle A",
      canonStatus: "non-canon",
    },
    direction: "facing-left",
    sourceType: "artist-png",
    importedAt: FIXED_TIME,
    importedBy: "phase-2a-test-suite",
  });
  return {
    workspace,
    processor: new QuickPixelizeProcessor(workspace, await SchemaRegistry.create()),
    sourceId: source.id,
  };
}

test("repeated accepted-fixture runs produce identical deterministic candidates", async () => {
  await withTestDirectory("quick-pixelize-determinism", async (directory) => {
    const { workspace, processor, sourceId } = await setup(directory);
    const config = await loadConfig();
    const sourceBefore = await readFile(CALIBRATION_LEFT);
    const first = await processor.process({
      sourceAssetId: sourceId,
      direction: "facing-left",
      config,
      createdAt: FIXED_TIME,
      runId: "run-quick-pixelize-1",
      candidateId: "candidate-quick-pixelize-1",
    });
    const second = await processor.process({
      sourceAssetId: sourceId,
      direction: "facing-left",
      config,
      createdAt: "2026-08-24T01:00:00.000Z",
      runId: "run-quick-pixelize-2",
      candidateId: "candidate-quick-pixelize-2",
    });

    assert.equal(first.processing.outputDescription.pixelDataSha256, second.processing.outputDescription.pixelDataSha256);
    assert.equal(first.processing.outputDescription.encodedSha256, second.processing.outputDescription.encodedSha256);
    assert.equal(first.run.reproducibilityKey, second.run.reproducibilityKey);
    assert.deepEqual(first.run.workflow, second.run.workflow);
    assert.deepEqual(first.processing.sourceBounds, second.processing.sourceBounds);
    assert.deepEqual(first.processing.outputPlacement, second.processing.outputPlacement);
    assert.equal(first.candidate.artifact.path, second.candidate.artifact.path);
    assert.equal(first.run.workflow.id, "quick-pixelize");
    assert.equal(first.run.workflow.version, "1.0.0");
    assert.equal(first.candidate.initialState, "candidate");
    assert.equal(first.candidate.direction, "facing-left");
    assert.equal(first.candidate.sourceAssetId, sourceId);
    assert.equal(first.candidate.preparationRunId, first.run.id);
    assert.deepEqual(await workspace.loadReviewEvents(first.candidate.id), []);
    assert.equal(sha256(await readFile(CALIBRATION_LEFT)), sha256(sourceBefore));
  });
});

test("processor rejects missing or changed direction without creating a run", async () => {
  await withTestDirectory("quick-pixelize-direction", async (directory) => {
    const { workspace, processor, sourceId } = await setup(directory);
    const config = await loadConfig();
    await assert.rejects(
      processor.process({
        sourceAssetId: sourceId,
        direction: "facing-right",
        config,
        createdAt: FIXED_TIME,
      }),
      /direction must match the source/,
    );
    await assert.rejects(
      processor.process({
        sourceAssetId: sourceId,
        direction: undefined,
        config,
        createdAt: FIXED_TIME,
      } as unknown as Parameters<QuickPixelizeProcessor["process"]>[0]),
      /direction must be facing-left or facing-right/,
    );
    await assert.rejects(workspace.loadRun("run-quick-pixelize-1"), /ENOENT/);
  });
});

test("processor fails closed when immutable source content no longer matches its hashes", async () => {
  await withTestDirectory("quick-pixelize-source-hash", async (directory) => {
    const { workspace, processor, sourceId } = await setup(directory);
    const config = await loadConfig();
    const source = await workspace.loadSource(sourceId);
    const objectPath = workspace.resolvePortable(source.artifact.path);
    await chmod(objectPath, 0o644);
    const bytes = await readFile(objectPath);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
    await writeFile(objectPath, bytes);

    await assert.rejects(
      processor.process({ sourceAssetId: sourceId, direction: "facing-left", config, createdAt: FIXED_TIME }),
      /source encoded hash does not match/,
    );
  });
});
