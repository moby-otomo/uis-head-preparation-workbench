import assert from "node:assert/strict";
import test from "node:test";

import { createCandidateScenario, withTestDirectory } from "./helpers.js";

test("timestamps and record IDs do not change deterministic reproducibility keys", async () => {
  await withTestDirectory("reproducibility", async (directory) => {
    const { workspace, source } = await createCandidateScenario(directory);
    const workflow = {
      id: "artist-import",
      version: "1.0.0",
      deterministic: true,
      parameters: { alpha: "preserve", nested: { b: 2, a: 1 } },
    };
    const first = await workspace.createPreparationRun({
      id: "run-repro-first",
      sourceAssetId: source.id,
      workflow,
      createdAt: "2026-08-24T00:00:00.000Z",
    });
    const second = await workspace.createPreparationRun({
      id: "run-repro-second",
      sourceAssetId: source.id,
      workflow: {
        ...workflow,
        parameters: { nested: { a: 1, b: 2 }, alpha: "preserve" },
      },
      createdAt: "2026-08-25T00:00:00.000Z",
    });
    assert.equal(first.reproducibilityKey, second.reproducibilityKey);
    assert.equal(first.sourceEncodedSha256, source.artifact.encodedSha256);
    assert.notEqual(source.artifact.encodedSha256, source.artifact.pixelDataSha256);
  });
});
