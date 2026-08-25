import { generateQuickPixelizeReviewBundle } from "../dist/src/review/quick-pixelize-review-bundle.js";

const fixturePath = "fixtures/calibration/TEST_HeadPreparationCalibration-UncleA_UIS_v01.fixture.json";
const outputDirectory = "review/phase-2b-1/TEST_QuickPixelizeCalibrationA_UIS_v01";

function configuration(overrides = {}) {
  return {
    schemaVersion: "uis.head-preparation.quick-pixelize-config/1",
    algorithmVersion: "1.0.0",
    alpha: { mode: "clear-at-or-below", threshold: 15 },
    bounds: { mode: "normalized-alpha-content" },
    target: { width: 64, height: 64, fit: "contain" },
    resampling: "nearest-neighbor",
    transparentPadding: { top: 2, right: 2, bottom: 2, left: 2 },
    pngEncoding: {
      colorType: "rgba",
      bitDepth: 8,
      filterType: 0,
      deflateLevel: 9,
      deflateStrategy: 3,
    },
    ...overrides,
  };
}

const bundle = await generateQuickPixelizeReviewBundle({
  id: "TEST_QuickPixelizeCalibrationA_UIS_v01",
  fixturePath,
  referenceConfigurationId: "reference-cleanup-64",
  generatedAt: "2026-08-25T08:30:00.000Z",
  configurations: [
    {
      id: "reference-cleanup-64",
      label: "Reference cleanup at 64 × 64",
      controlledChange: "reference",
      reviewQuestion: "Does the Phase 2A reference preserve identity and readable asymmetry?",
      config: configuration(),
    },
    {
      id: "alpha-preserve-64",
      label: "Preserve low-alpha remnants at 64 × 64",
      controlledChange: "alpha-threshold",
      reviewQuestion: "Does retaining alpha 1–15 introduce visible edge noise compared with the reference?",
      config: configuration({ alpha: { mode: "clear-at-or-below", threshold: 0 } }),
    },
    {
      id: "zero-padding-64",
      label: "Zero configured padding at 64 × 64",
      controlledChange: "transparent-padding",
      reviewQuestion: "Does edge-to-edge fitting feel cramped compared with the two-pixel reference padding?",
      config: configuration({ transparentPadding: { top: 0, right: 0, bottom: 0, left: 0 } }),
    },
    {
      id: "larger-grid-96",
      label: "Larger 96 × 96 review grid",
      controlledChange: "target-grid",
      reviewQuestion: "Does the larger mechanical grid preserve useful detail without changing character geometry?",
      config: configuration({ target: { width: 96, height: 96, fit: "contain" } }),
    },
  ],
}, outputDirectory);

console.log(JSON.stringify({
  bundle: `${outputDirectory}/bundle.json`,
  review: `${outputDirectory}/REVIEW.md`,
  checkerboardReview: `${outputDirectory}/REVIEW.html`,
  results: bundle.results.length,
  goldenStatus: bundle.goldenStatus,
  productionExportAllowed: bundle.productionExportAllowed,
}));
