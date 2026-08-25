import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PNG } from "pngjs";

import type { QuickPixelizeConfig } from "../src/quick-pixelize/config.js";
import {
  detectContentBounds,
  normalizeAlpha,
  quickPixelize,
  type RgbaImage,
} from "../src/quick-pixelize/engine.js";

function image(width: number, height: number, pixels: readonly (readonly [number, number, number, number])[]): RgbaImage {
  assert.equal(pixels.length, width * height);
  return { width, height, data: Buffer.from(pixels.flat()) };
}

function pngBuffer(source: RgbaImage): Buffer {
  const png = new PNG({ width: source.width, height: source.height, colorType: 6 });
  png.data = Buffer.from(source.data);
  return PNG.sync.write(png);
}

function config(overrides: Partial<QuickPixelizeConfig["target"]> = {}): QuickPixelizeConfig {
  return {
    schemaVersion: "uis.head-preparation.quick-pixelize-config/1",
    algorithmVersion: "1.0.0",
    alpha: { mode: "clear-at-or-below", threshold: 5 },
    bounds: { mode: "normalized-alpha-content" },
    target: { width: 10, height: 10, fit: "contain", ...overrides },
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

test("alpha cleanup clears threshold pixels to transparent black and preserves pixels above it", () => {
  const source = image(3, 1, [
    [90, 80, 70, 0],
    [60, 50, 40, 5],
    [30, 20, 10, 6],
  ]);
  const normalized = normalizeAlpha(source, 5);

  assert.deepEqual([...normalized.image.data], [0, 0, 0, 0, 0, 0, 0, 0, 30, 20, 10, 6]);
  assert.equal(normalized.clearedPixelCount, 2);
  assert.deepEqual(detectContentBounds(normalized.image), { x: 2, y: 0, width: 1, height: 1 });
  assert.deepEqual([...source.data], [90, 80, 70, 0, 60, 50, 40, 5, 30, 20, 10, 6]);
});

test("accepted fixture contains low-alpha material exercised by the cleanup rule", async () => {
  const source = PNG.sync.read(await readFile(
    "fixtures/calibration/TEST_HeadPreparationCalibration-UncleA-FacingLeft_UIS_v01.png",
  ));
  const lowAlphaOffsets: number[] = [];
  for (let offset = 0; offset < source.data.length; offset += 4) {
    const alpha = source.data[offset + 3];
    if (alpha !== undefined && alpha > 0 && alpha <= 15) lowAlphaOffsets.push(offset);
  }
  assert.ok(lowAlphaOffsets.length >= 871, "accepted fixture must retain its documented low-alpha remnants");

  const normalized = normalizeAlpha(
    { width: source.width, height: source.height, data: Buffer.from(source.data) },
    15,
  );
  for (const offset of lowAlphaOffsets) {
    assert.deepEqual([...normalized.image.data.subarray(offset, offset + 4)], [0, 0, 0, 0]);
  }
});

test("content bounds are deterministic, threshold-aware, and include source boundaries", () => {
  const source = image(4, 3, [
    [1, 2, 3, 255], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    [0, 0, 0, 0], [9, 9, 9, 4], [0, 0, 0, 0], [0, 0, 0, 0],
    [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [4, 5, 6, 255],
  ]);
  const normalized = normalizeAlpha(source, 5).image;
  assert.deepEqual(detectContentBounds(normalized), { x: 0, y: 0, width: 4, height: 3 });
  assert.deepEqual(detectContentBounds(normalized), detectContentBounds(normalized));
});

test("transparent sources fail clearly after alpha normalization", () => {
  const transparent = image(2, 2, Array.from({ length: 4 }, () => [10, 20, 30, 5] as const));
  assert.throws(
    () => quickPixelize(pngBuffer(transparent), config()),
    /no visible content after alpha normalization/,
  );
});

test("invalid PNG input fails without selecting a fallback decoder or algorithm", () => {
  assert.throws(
    () => quickPixelize(Buffer.from("not-a-png"), config()),
    /Quick Pixelize source PNG cannot be decoded/,
  );
});

test("contain scaling preserves aspect, pads deterministically, and does not mirror", () => {
  const source = image(4, 2, [
    [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 0, 255],
    [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 0, 255],
  ]);
  const result = quickPixelize(pngBuffer(source), config());
  const output = PNG.sync.read(result.outputPng);

  assert.deepEqual(result.outputPlacement, { x: 1, y: 3, width: 8, height: 4 });
  assert.equal(output.width, 10);
  assert.equal(output.height, 10);
  const row = [...output.data.subarray((3 * output.width + 1) * 4, (3 * output.width + 9) * 4)];
  assert.deepEqual(row, [
    255, 0, 0, 255, 255, 0, 0, 255,
    0, 255, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 0, 0, 255, 255,
    255, 255, 0, 255, 255, 255, 0, 255,
  ]);
  assert.deepEqual([...output.data.subarray(0, 4)], [0, 0, 0, 0]);
});
