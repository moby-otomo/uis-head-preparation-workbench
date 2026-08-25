import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PNG } from "pngjs";

import type { Direction, ImageArtifact } from "../src/domain/model.js";
import { inspectPngBuffer } from "../src/validation/png.js";
import { SCHEMA_IDS, SchemaRegistry } from "../src/validation/schema-registry.js";

interface FixtureSource {
  direction: Direction;
  originalFilename: string;
  provenance: {
    kind: "artist-authored" | "mirror-derived";
    sourceDirection?: Direction;
    pixelExactToCurrentSource?: boolean;
  };
  artifact: ImageArtifact;
}

interface CalibrationFixture {
  artifactStatus: "available";
  directions: Direction[];
  sourceArtifacts: FixtureSource[];
  requiredVisualTraits: string[];
  intentionalOmissions: string[];
  productionExportAllowed: false;
}

test("accepted calibration PNGs are frozen, portable, and provenance-complete", async () => {
  const manifestPath = "fixtures/calibration/TEST_HeadPreparationCalibration-UncleA_UIS_v01.fixture.json";
  const document = JSON.parse(await readFile(manifestPath, "utf8")) as CalibrationFixture;
  const schemas = await SchemaRegistry.create();

  assert.equal(schemas.validate(SCHEMA_IDS.fixture, document).valid, true);
  assert.equal(document.artifactStatus, "available");
  assert.deepEqual(document.directions, ["facing-left", "facing-right"]);
  assert.equal(document.productionExportAllowed, false);
  assert.ok(document.requiredVisualTraits.includes("mouth"));
  assert.equal(document.requiredVisualTraits.includes("nose"), false);
  assert.ok(document.intentionalOmissions.some((item) => item.startsWith("nose omitted")));

  for (const source of document.sourceArtifacts) {
    const buffer = await readFile(source.artifact.path);
    const actual = inspectPngBuffer(buffer);
    assert.deepEqual({ mediaType: "image/png", ...actual }, {
      mediaType: source.artifact.mediaType,
      encodedSha256: source.artifact.encodedSha256,
      pixelDataSha256: source.artifact.pixelDataSha256,
      byteLength: source.artifact.byteLength,
      width: source.artifact.width,
      height: source.artifact.height,
      hasAlphaChannel: source.artifact.hasAlphaChannel,
      hasTransparency: source.artifact.hasTransparency,
    });
  }

  const left = document.sourceArtifacts.find((source) => source.direction === "facing-left");
  const right = document.sourceArtifacts.find((source) => source.direction === "facing-right");
  assert.ok(left);
  assert.ok(right);
  assert.equal(left.provenance.kind, "artist-authored");
  assert.deepEqual(right.provenance, {
    kind: "mirror-derived",
    sourceDirection: "facing-left",
    pixelExactToCurrentSource: false,
  });

  const leftImage = PNG.sync.read(await readFile(left.artifact.path));
  const rightImage = PNG.sync.read(await readFile(right.artifact.path));
  let differentPixels = 0;
  for (let y = 0; y < leftImage.height; y += 1) {
    for (let x = 0; x < leftImage.width; x += 1) {
      const leftOffset = (y * leftImage.width + x) * 4;
      const rightOffset = (y * rightImage.width + (rightImage.width - 1 - x)) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        if (leftImage.data[leftOffset + channel] !== rightImage.data[rightOffset + channel]) {
          differentPixels += 1;
          break;
        }
      }
    }
  }
  assert.ok(differentPixels > 0, "mirror-derived provenance must not claim current pixel-exact equivalence");
});
