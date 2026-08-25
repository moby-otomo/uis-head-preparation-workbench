import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { assertPortableRelativePath } from "../src/domain/invariants.js";
import { SCHEMA_IDS, SchemaRegistry } from "../src/validation/schema-registry.js";

test("positive and negative schema fixtures behave as declared", async () => {
  const registry = await SchemaRegistry.create();
  const validSource = JSON.parse(await readFile("fixtures/contracts/valid/source-asset.json", "utf8"));
  const validCandidate = JSON.parse(await readFile("fixtures/contracts/valid/candidate-asset.json", "utf8"));
  const invalidSource = JSON.parse(await readFile("fixtures/contracts/invalid/source-missing-direction.json", "utf8"));
  const invalidCandidate = JSON.parse(await readFile("fixtures/contracts/invalid/candidate-absolute-path.json", "utf8"));
  const fixture = JSON.parse(await readFile("fixtures/calibration/TEST_HeadPreparationCalibration-UncleA_UIS_v01.fixture.json", "utf8"));

  assert.equal(registry.validate(SCHEMA_IDS.sourceAsset, validSource).valid, true);
  assert.equal(registry.validate(SCHEMA_IDS.candidateAsset, validCandidate).valid, true);
  assert.equal(registry.validate(SCHEMA_IDS.fixture, fixture).valid, true);
  assert.equal(registry.validate(SCHEMA_IDS.sourceAsset, invalidSource).valid, false);
  assert.equal(registry.validate(SCHEMA_IDS.candidateAsset, invalidCandidate).valid, false);
});

test("absolute, traversal, Windows, and non-canonical paths are rejected", () => {
  for (const unsafe of [
    "/absolute/file.png",
    "../escape.png",
    "objects/../escape.png",
    "C:\\archive\\file.png",
    "objects\\file.png",
    "./objects/file.png",
    "objects//file.png",
  ]) {
    assert.throws(() => assertPortableRelativePath(unsafe), (error: unknown) => error instanceof Error, unsafe);
  }
  assert.doesNotThrow(() => assertPortableRelativePath(path.posix.join("objects", "sha256", "aa", "digest")));
});
