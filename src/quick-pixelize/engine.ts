import { PNG } from "pngjs";

import type { PngDescription } from "../validation/png.js";
import { inspectPngBuffer } from "../validation/png.js";
import { assertQuickPixelizeConfig, type QuickPixelizeConfig } from "./config.js";

export interface RgbaImage {
  width: number;
  height: number;
  data: Buffer;
}

export interface ContentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OutputPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QuickPixelizeResult {
  outputPng: Buffer;
  outputDescription: PngDescription;
  sourceBounds: ContentBounds;
  outputPlacement: OutputPlacement;
  clearedPixelCount: number;
}

export interface AlphaNormalizationResult {
  image: RgbaImage;
  clearedPixelCount: number;
}

function assertRgbaImage(image: RgbaImage): void {
  if (!Number.isSafeInteger(image.width) || image.width < 1 || !Number.isSafeInteger(image.height) || image.height < 1) {
    throw new Error("RGBA image dimensions must be positive integers");
  }
  if (image.data.length !== image.width * image.height * 4) {
    throw new Error("RGBA pixel buffer length does not match its dimensions");
  }
}

export function normalizeAlpha(image: RgbaImage, threshold: number): AlphaNormalizationResult {
  assertRgbaImage(image);
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 254) {
    throw new Error("alpha threshold must be an integer from 0 to 254");
  }
  const data = Buffer.from(image.data);
  let clearedPixelCount = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const alpha = data[offset + 3];
    if (alpha === undefined) throw new Error("RGBA pixel is missing alpha data");
    if (alpha <= threshold) {
      if (data[offset] !== 0 || data[offset + 1] !== 0 || data[offset + 2] !== 0 || alpha !== 0) {
        clearedPixelCount += 1;
      }
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }
  }
  return { image: { width: image.width, height: image.height, data }, clearedPixelCount };
}

export function detectContentBounds(image: RgbaImage): ContentBounds {
  assertRgbaImage(image);
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];
      if (alpha !== undefined && alpha > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < 0 || maxY < 0) throw new Error("source has no visible content after alpha normalization");
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function calculateContainPlacement(bounds: ContentBounds, config: QuickPixelizeConfig): OutputPlacement {
  assertQuickPixelizeConfig(config);
  const innerWidth = config.target.width - config.transparentPadding.left - config.transparentPadding.right;
  const innerHeight = config.target.height - config.transparentPadding.top - config.transparentPadding.bottom;
  let width: number;
  let height: number;
  if (innerWidth * bounds.height <= innerHeight * bounds.width) {
    width = innerWidth;
    height = Math.max(1, Math.floor((bounds.height * innerWidth) / bounds.width));
  } else {
    height = innerHeight;
    width = Math.max(1, Math.floor((bounds.width * innerHeight) / bounds.height));
  }
  return {
    x: config.transparentPadding.left + Math.floor((innerWidth - width) / 2),
    y: config.transparentPadding.top + Math.floor((innerHeight - height) / 2),
    width,
    height,
  };
}

function nearestNeighborInto(
  source: RgbaImage,
  bounds: ContentBounds,
  target: RgbaImage,
  placement: OutputPlacement,
): void {
  for (let targetY = 0; targetY < placement.height; targetY += 1) {
    const sourceY = bounds.y + Math.floor((targetY * bounds.height) / placement.height);
    for (let targetX = 0; targetX < placement.width; targetX += 1) {
      const sourceX = bounds.x + Math.floor((targetX * bounds.width) / placement.width);
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      const targetOffset = ((placement.y + targetY) * target.width + placement.x + targetX) * 4;
      source.data.copy(target.data, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
}

function decodePng(sourcePng: Buffer): RgbaImage {
  try {
    const decoded = PNG.sync.read(sourcePng, { skipRescale: false });
    return { width: decoded.width, height: decoded.height, data: Buffer.from(decoded.data) };
  } catch (error) {
    throw new Error(`Quick Pixelize source PNG cannot be decoded: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function encodePng(image: RgbaImage, config: QuickPixelizeConfig): Buffer {
  const png = new PNG({
    width: image.width,
    height: image.height,
    colorType: 6,
    inputColorType: 6,
    inputHasAlpha: true,
    bitDepth: config.pngEncoding.bitDepth,
  });
  png.data = Buffer.from(image.data);
  return PNG.sync.write(png, {
    colorType: 6,
    inputColorType: 6,
    inputHasAlpha: true,
    bitDepth: config.pngEncoding.bitDepth,
    filterType: config.pngEncoding.filterType,
    deflateLevel: config.pngEncoding.deflateLevel,
    deflateStrategy: config.pngEncoding.deflateStrategy,
  });
}

export function quickPixelize(sourcePng: Buffer, config: QuickPixelizeConfig): QuickPixelizeResult {
  assertQuickPixelizeConfig(config);
  const source = decodePng(sourcePng);
  const normalized = normalizeAlpha(source, config.alpha.threshold);
  const sourceBounds = detectContentBounds(normalized.image);
  const outputPlacement = calculateContainPlacement(sourceBounds, config);
  const outputImage: RgbaImage = {
    width: config.target.width,
    height: config.target.height,
    data: Buffer.alloc(config.target.width * config.target.height * 4),
  };
  nearestNeighborInto(normalized.image, sourceBounds, outputImage, outputPlacement);
  const outputPng = encodePng(outputImage, config);
  return {
    outputPng,
    outputDescription: inspectPngBuffer(outputPng),
    sourceBounds,
    outputPlacement,
    clearedPixelCount: normalized.clearedPixelCount,
  };
}
