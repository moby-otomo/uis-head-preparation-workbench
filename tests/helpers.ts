import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { PNG } from "pngjs";

import type { CandidateAsset, SourceAsset } from "../src/domain/model.js";
import { Workspace } from "../src/storage/workspace.js";

const TEST_ROOT = path.resolve(".tmp-tests");
const FIXED_TIME = "2026-08-24T00:00:00.000Z";

export async function withTestDirectory<T>(label: string, action: (directory: string) => Promise<T>): Promise<T> {
  const directory = path.join(TEST_ROOT, `${label}-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  try {
    return await action(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function writeSyntheticPng(
  destination: string,
  rgba: readonly [number, number, number, number] = [220, 170, 140, 0],
  width = 3,
  height = 2,
): Promise<void> {
  await mkdir(path.dirname(destination), { recursive: true });
  const image = new PNG({ width, height, colorType: 6 });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = rgba[0];
    image.data[offset + 1] = rgba[1];
    image.data[offset + 2] = rgba[2];
    image.data[offset + 3] = rgba[3];
  }
  image.data[3] = 255;
  await writeFile(destination, PNG.sync.write(image));
}

export async function createCandidateScenario(directory: string, characterId = "TEST_UnitUncle"): Promise<{
  workspace: Workspace;
  source: SourceAsset;
  candidate: CandidateAsset;
  inputPath: string;
}> {
  const workspace = new Workspace(path.join(directory, "workspace"));
  await workspace.initialize();
  const inputPath = path.join(directory, "input", "source.png");
  await writeSyntheticPng(inputPath);
  const source = await workspace.importSource({
    inputPath,
    id: "source-left-v1",
    identity: { characterId, displayName: "Unit Uncle", canonStatus: characterId.startsWith("TEST_") ? "non-canon" : "production-unspecified" },
    direction: "facing-left",
    sourceType: "synthetic-test-png",
    importedAt: FIXED_TIME,
    importedBy: "test-suite",
  });
  const run = await workspace.createPreparationRun({
    id: "run-left-v1",
    sourceAssetId: source.id,
    workflow: { id: "artist-import", version: "1.0.0", deterministic: true, parameters: { preservePixels: true } },
    createdAt: FIXED_TIME,
  });
  const candidate = await workspace.createCandidate({
    inputPath,
    id: "candidate-left-v1",
    sourceAssetId: source.id,
    preparationRunId: run.id,
    direction: "facing-left",
    createdAt: FIXED_TIME,
  });
  return { workspace, source, candidate, inputPath };
}

export { FIXED_TIME };
