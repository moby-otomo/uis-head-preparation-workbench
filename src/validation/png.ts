import { PNG } from "pngjs";

import { sha256 } from "../domain/hash.js";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export interface PngDescription {
  encodedSha256: string;
  pixelDataSha256: string;
  byteLength: number;
  width: number;
  height: number;
  hasAlphaChannel: boolean;
  hasTransparency: boolean;
}

export function inspectPngBuffer(buffer: Buffer): PngDescription {
  if (buffer.length < 26 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("file is not a PNG");
  }
  const colorType = buffer[25];
  if (colorType === undefined) throw new Error("PNG is missing IHDR colour type");

  let decoded: PNG;
  try {
    decoded = PNG.sync.read(buffer, { skipRescale: false });
  } catch (error) {
    throw new Error(`PNG cannot be decoded: ${error instanceof Error ? error.message : String(error)}`);
  }

  let hasTransparency = false;
  for (let index = 3; index < decoded.data.length; index += 4) {
    if (decoded.data[index] !== 255) {
      hasTransparency = true;
      break;
    }
  }

  return {
    encodedSha256: sha256(buffer),
    pixelDataSha256: sha256(decoded.data),
    byteLength: buffer.byteLength,
    width: decoded.width,
    height: decoded.height,
    hasAlphaChannel: colorType === 4 || colorType === 6,
    hasTransparency,
  };
}
