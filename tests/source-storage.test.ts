import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { Direction } from "../src/domain/model.js";
import { Workspace } from "../src/storage/workspace.js";
import { FIXED_TIME, withTestDirectory, writeSyntheticPng } from "./helpers.js";

test("source import preserves artist bytes and deduplicates identical content", async () => {
  await withTestDirectory("immutable-source", async (directory) => {
    const workspace = new Workspace(path.join(directory, "workspace"));
    await workspace.initialize();
    const inputPath = path.join(directory, "input", "uncle.png");
    await writeSyntheticPng(inputPath);
    const beforeBytes = await readFile(inputPath);
    const beforeStat = await stat(inputPath);
    const common = {
      inputPath,
      identity: { characterId: "TEST_Immutable", displayName: "Immutable Uncle", canonStatus: "non-canon" as const },
      direction: "facing-left" as const,
      sourceType: "synthetic-test-png" as const,
      importedAt: FIXED_TIME,
      importedBy: "test-suite",
    };

    const first = await workspace.importSource({ ...common, id: "source-immutable-1" });
    const second = await workspace.importSource({ ...common, id: "source-immutable-2" });

    assert.deepEqual(await readFile(inputPath), beforeBytes);
    assert.equal((await stat(inputPath)).mtimeMs, beforeStat.mtimeMs);
    assert.equal(first.artifact.path, second.artifact.path);
    assert.equal(first.artifact.encodedSha256, second.artifact.encodedSha256);
    assert.deepEqual(await workspace.readArtifact(first.artifact.path), beforeBytes);
  });
});

test("source replacement is additive lineage and cannot change direction", async () => {
  await withTestDirectory("source-replacement", async (directory) => {
    const workspace = new Workspace(path.join(directory, "workspace"));
    await workspace.initialize();
    const firstPath = path.join(directory, "input", "v1.png");
    const secondPath = path.join(directory, "input", "v2.png");
    await writeSyntheticPng(firstPath, [220, 170, 140, 0]);
    await writeSyntheticPng(secondPath, [80, 120, 160, 0]);
    const base = {
      identity: { characterId: "TEST_Replacement", displayName: "Replacement Uncle", canonStatus: "non-canon" as const },
      direction: "facing-left" as const,
      sourceType: "synthetic-test-png" as const,
      importedAt: FIXED_TIME,
      importedBy: "test-suite",
    };
    const first = await workspace.importSource({ ...base, inputPath: firstPath, id: "source-replacement-v1" });
    const oldObject = await workspace.readArtifact(first.artifact.path);
    const replacement = await workspace.importSource({
      ...base,
      inputPath: secondPath,
      id: "source-replacement-v2",
      supersedesSourceAssetId: first.id,
    });

    assert.equal(replacement.supersedesSourceAssetId, first.id);
    assert.notEqual(replacement.artifact.path, first.artifact.path);
    assert.deepEqual(await workspace.readArtifact(first.artifact.path), oldObject);

    await assert.rejects(
      workspace.importSource({
        ...base,
        inputPath: secondPath,
        id: "source-invalid-direction",
        direction: "facing-right",
        supersedesSourceAssetId: first.id,
      }),
      /preserve direction/,
    );
  });
});

test("source import requires an explicit production-facing direction", async () => {
  await withTestDirectory("required-direction", async (directory) => {
    const workspace = new Workspace(path.join(directory, "workspace"));
    await workspace.initialize();
    const inputPath = path.join(directory, "input.png");
    await writeSyntheticPng(inputPath);
    await assert.rejects(
      workspace.importSource({
        inputPath,
        id: "source-no-direction",
        identity: { characterId: "TEST_NoDirection", displayName: "No Direction", canonStatus: "non-canon" },
        direction: undefined as unknown as Direction,
        sourceType: "synthetic-test-png",
        importedAt: FIXED_TIME,
        importedBy: "test-suite",
      }),
      /direction must be facing-left or facing-right/,
    );
  });
});
