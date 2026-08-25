export const QUICK_PIXELIZE_WORKFLOW_ID = "quick-pixelize" as const;
export const QUICK_PIXELIZE_ALGORITHM_VERSION = "1.0.0" as const;
export const QUICK_PIXELIZE_ALGORITHM_IDENTITY =
  `${QUICK_PIXELIZE_WORKFLOW_ID}/${QUICK_PIXELIZE_ALGORITHM_VERSION}` as const;

export interface QuickPixelizeConfig {
  schemaVersion: "uis.head-preparation.quick-pixelize-config/1";
  algorithmVersion: typeof QUICK_PIXELIZE_ALGORITHM_VERSION;
  alpha: {
    mode: "clear-at-or-below";
    threshold: number;
  };
  bounds: {
    mode: "normalized-alpha-content";
  };
  target: {
    width: number;
    height: number;
    fit: "contain";
  };
  resampling: "nearest-neighbor";
  transparentPadding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  pngEncoding: {
    colorType: "rgba";
    bitDepth: 8;
    filterType: 0;
    deflateLevel: 9;
    deflateStrategy: 3;
  };
}

const MAX_OUTPUT_PIXELS = 16_777_216;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertInteger(value: unknown, label: string, minimum: number, maximum?: number): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (maximum !== undefined && (value as number) > maximum)) {
    throw new Error(`${label} must be an integer from ${minimum}${maximum === undefined ? "" : ` to ${maximum}`}`);
  }
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} contains missing or unsupported fields`);
  }
}

export function assertQuickPixelizeConfig(value: unknown): asserts value is QuickPixelizeConfig {
  if (!isRecord(value)) throw new Error("Quick Pixelize configuration must be an object");
  assertExactKeys(value, [
    "schemaVersion",
    "algorithmVersion",
    "alpha",
    "bounds",
    "target",
    "resampling",
    "transparentPadding",
    "pngEncoding",
  ], "Quick Pixelize configuration");
  if (value.schemaVersion !== "uis.head-preparation.quick-pixelize-config/1") {
    throw new Error("unsupported Quick Pixelize configuration schema version");
  }
  if (value.algorithmVersion !== QUICK_PIXELIZE_ALGORITHM_VERSION) {
    throw new Error("unsupported Quick Pixelize algorithm version");
  }

  if (!isRecord(value.alpha)) throw new Error("alpha policy must be an object");
  assertExactKeys(value.alpha, ["mode", "threshold"], "alpha policy");
  if (value.alpha.mode !== "clear-at-or-below") throw new Error("unsupported alpha policy");
  assertInteger(value.alpha.threshold, "alpha threshold", 0, 254);

  if (!isRecord(value.bounds)) throw new Error("bounds policy must be an object");
  assertExactKeys(value.bounds, ["mode"], "bounds policy");
  if (value.bounds.mode !== "normalized-alpha-content") throw new Error("unsupported content-bound policy");

  if (!isRecord(value.target)) throw new Error("target must be an object");
  assertExactKeys(value.target, ["width", "height", "fit"], "target");
  assertInteger(value.target.width, "target width", 1);
  assertInteger(value.target.height, "target height", 1);
  if (value.target.fit !== "contain") throw new Error("unsupported target fit policy");
  if (value.target.width * value.target.height > MAX_OUTPUT_PIXELS) {
    throw new Error(`target exceeds the ${MAX_OUTPUT_PIXELS}-pixel processing safety limit`);
  }

  if (value.resampling !== "nearest-neighbor") throw new Error("unsupported resampling configuration");

  if (!isRecord(value.transparentPadding)) throw new Error("transparent padding must be an object");
  assertExactKeys(value.transparentPadding, ["top", "right", "bottom", "left"], "transparent padding");
  assertInteger(value.transparentPadding.top, "top padding", 0);
  assertInteger(value.transparentPadding.right, "right padding", 0);
  assertInteger(value.transparentPadding.bottom, "bottom padding", 0);
  assertInteger(value.transparentPadding.left, "left padding", 0);
  if (value.transparentPadding.left + value.transparentPadding.right >= value.target.width) {
    throw new Error("horizontal padding leaves no target content region");
  }
  if (value.transparentPadding.top + value.transparentPadding.bottom >= value.target.height) {
    throw new Error("vertical padding leaves no target content region");
  }

  if (!isRecord(value.pngEncoding)) throw new Error("PNG encoding policy must be an object");
  assertExactKeys(
    value.pngEncoding,
    ["colorType", "bitDepth", "filterType", "deflateLevel", "deflateStrategy"],
    "PNG encoding policy",
  );
  if (
    value.pngEncoding.colorType !== "rgba"
    || value.pngEncoding.bitDepth !== 8
    || value.pngEncoding.filterType !== 0
    || value.pngEncoding.deflateLevel !== 9
    || value.pngEncoding.deflateStrategy !== 3
  ) {
    throw new Error("unsupported deterministic PNG encoding configuration");
  }
}
