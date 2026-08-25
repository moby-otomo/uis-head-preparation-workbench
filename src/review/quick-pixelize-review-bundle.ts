import { constants as fsConstants } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { canonicalJson } from "../domain/hash.js";
import { assertId } from "../domain/invariants.js";
import type { Direction, Identity, ImageArtifact } from "../domain/model.js";
import {
  QUICK_PIXELIZE_ALGORITHM_IDENTITY,
  QUICK_PIXELIZE_ALGORITHM_VERSION,
  QUICK_PIXELIZE_WORKFLOW_ID,
  type QuickPixelizeConfig,
} from "../quick-pixelize/config.js";
import { QuickPixelizeProcessor } from "../quick-pixelize/processor.js";
import { Workspace } from "../storage/workspace.js";
import { inspectPngBuffer } from "../validation/png.js";
import { SCHEMA_IDS, SchemaRegistry } from "../validation/schema-registry.js";
import type { ContentBounds, OutputPlacement } from "../quick-pixelize/engine.js";

type ControlledChange = "reference" | "alpha-threshold" | "transparent-padding" | "target-grid";

interface FixtureSource {
  direction: Direction;
  provenance: {
    kind: "artist-authored" | "mirror-derived";
    sourceDirection?: Direction;
    pixelExactToCurrentSource?: boolean;
  };
  artifact: ImageArtifact;
}

interface CalibrationFixture {
  schemaVersion: "uis.head-preparation.fixture/1";
  kind: "fixture";
  id: string;
  identity: Identity;
  artifactStatus: "available";
  sourceArtifacts: FixtureSource[];
  productionExportAllowed: false;
}

export interface ReviewConfiguration {
  id: string;
  label: string;
  controlledChange: ControlledChange;
  reviewQuestion: string;
  config: QuickPixelizeConfig;
}

export interface QuickPixelizeReviewPlan {
  id: string;
  fixturePath: string;
  referenceConfigurationId: string;
  configurations: ReviewConfiguration[];
  generatedAt: string;
}

interface ReviewSource {
  direction: Direction;
  repositoryPath: string;
  provenance: FixtureSource["provenance"];
  artifact: ImageArtifact;
  sourceAssetRecordPath: string;
}

interface ReviewResult {
  configurationId: string;
  direction: Direction;
  preparationRunRecordPath: string;
  candidateAssetRecordPath: string;
  reviewPngPath: string;
  artifact: ImageArtifact;
  sourceBounds: ContentBounds;
  outputPlacement: OutputPlacement;
  clearedPixelCount: number;
}

export interface QuickPixelizeReviewBundle {
  schemaVersion: "uis.head-preparation.quick-pixelize-review-bundle/1";
  kind: "quick-pixelize-review-bundle";
  id: string;
  fixtureId: string;
  canonStatus: "non-canon";
  goldenStatus: "not-frozen";
  productionExportAllowed: false;
  algorithm: {
    id: typeof QUICK_PIXELIZE_WORKFLOW_ID;
    version: typeof QUICK_PIXELIZE_ALGORITHM_VERSION;
    identity: typeof QUICK_PIXELIZE_ALGORITHM_IDENTITY;
  };
  referenceConfigurationId: string;
  configurations: ReviewConfiguration[];
  sources: ReviewSource[];
  workspaceRoot: "workspace";
  results: ReviewResult[];
  generatedAt: string;
}

async function assertDirectoryAbsent(directory: string): Promise<void> {
  try {
    await stat(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error("review bundle output directory already exists; bundles are never overwritten");
}

function normalizeControlledValue(
  config: QuickPixelizeConfig,
  reference: QuickPixelizeConfig,
  controlledChange: ControlledChange,
): QuickPixelizeConfig {
  const normalized = structuredClone(config);
  if (controlledChange === "alpha-threshold") normalized.alpha.threshold = reference.alpha.threshold;
  if (controlledChange === "transparent-padding") {
    normalized.transparentPadding = structuredClone(reference.transparentPadding);
  }
  if (controlledChange === "target-grid") normalized.target = structuredClone(reference.target);
  return normalized;
}

function validateControlledConfigurations(
  configurations: ReviewConfiguration[],
  referenceConfigurationId: string,
  schemas: SchemaRegistry,
): void {
  if (configurations.length < 2) throw new Error("review comparison requires at least two configurations");
  const ids = new Set<string>();
  for (const configuration of configurations) {
    assertId(configuration.id, "review configuration id");
    if (ids.has(configuration.id)) throw new Error("review configuration IDs must be unique");
    ids.add(configuration.id);
    if (!configuration.label.trim() || !configuration.reviewQuestion.trim()) {
      throw new Error("review configuration label and question are required");
    }
    const schemaResult = schemas.validate(SCHEMA_IDS.quickPixelizeConfig, configuration.config);
    if (!schemaResult.valid) throw new Error(`review configuration ${configuration.id} is invalid`);
  }
  const reference = configurations.find((configuration) => configuration.id === referenceConfigurationId);
  if (!reference) throw new Error("reference configuration is missing");
  if (reference.controlledChange !== "reference") throw new Error("reference configuration must declare reference change type");

  for (const configuration of configurations) {
    if (configuration === reference) continue;
    if (configuration.controlledChange === "reference") throw new Error("only one configuration may be the reference");
    const normalized = normalizeControlledValue(configuration.config, reference.config, configuration.controlledChange);
    if (canonicalJson(normalized) !== canonicalJson(reference.config)) {
      throw new Error(`${configuration.id} changes fields outside its declared controlled variable`);
    }
    if (canonicalJson(configuration.config) === canonicalJson(reference.config)) {
      throw new Error(`${configuration.id} does not actually change its declared controlled variable`);
    }
  }
}

async function loadFixture(fixturePath: string, schemas: SchemaRegistry): Promise<CalibrationFixture> {
  const document = JSON.parse(await readFile(fixturePath, "utf8")) as CalibrationFixture;
  const result = schemas.validate(SCHEMA_IDS.fixture, document);
  if (!result.valid) throw new Error("review source fixture does not satisfy the Fixture contract");
  if (!document.id.startsWith("TEST_") || document.identity.canonStatus !== "non-canon") {
    throw new Error("review source fixture must be explicitly TEST_ and non-canon");
  }
  if (document.productionExportAllowed !== false || document.artifactStatus !== "available") {
    throw new Error("review source fixture must be available and production-export blocked");
  }
  return document;
}

function portable(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function markdownForBundle(bundle: QuickPixelizeReviewBundle, outputDirectory: string): string {
  const configurationSections = bundle.configurations.map((configuration) => {
    const rows = bundle.results
      .filter((result) => result.configurationId === configuration.id)
      .map((result) => {
        const source = bundle.sources.find((item) => item.direction === result.direction);
        if (!source) throw new Error("review result has no matching source");
        const sourceLink = portable(path.relative(outputDirectory, path.resolve(source.repositoryPath)));
        return `| ${result.direction} | ![Accepted source](${sourceLink}) | ![Review candidate](${result.reviewPngPath}) | \`${result.artifact.pixelDataSha256}\` |`;
      })
      .join("\n");
    return `## ${configuration.label}\n\n` +
      `Controlled change: \`${configuration.controlledChange}\`\n\n` +
      `Review question: ${configuration.reviewQuestion}\n\n` +
      `| Direction | Accepted source | Non-canon review candidate | Decoded-pixel SHA-256 |\n` +
      `|---|---|---|---|\n${rows}`;
  }).join("\n\n");

  return `# Quick Pixelize Phase 2B-1 Human Review\n\n` +
    `This bundle is Workbench-local, explicitly non-canon, and blocked from production export. ` +
    `All outputs are review candidates. **No output is approved or frozen as a golden.**\n\n` +
    `- Algorithm: \`${bundle.algorithm.identity}\`\n` +
    `- Reference configuration: \`${bundle.referenceConfigurationId}\`\n` +
    `- Source fixture: \`${bundle.fixtureId}\`\n\n` +
    `Compare identity preservation, low-alpha cleanup, framing, and pixel-grid legibility. ` +
    `Do not interpret the target dimensions as UIS production requirements.\n\n` +
    `${configurationSections}\n`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function htmlForBundle(bundle: QuickPixelizeReviewBundle, outputDirectory: string): string {
  const sections = bundle.configurations.map((configuration) => {
    const comparisons = bundle.results
      .filter((result) => result.configurationId === configuration.id)
      .map((result) => {
        const source = bundle.sources.find((item) => item.direction === result.direction);
        if (!source) throw new Error("review result has no matching source");
        const sourceLink = portable(path.relative(outputDirectory, path.resolve(source.repositoryPath)));
        return `<article><h3>${escapeHtml(result.direction)}</h3><div class="pair">` +
          `<figure><div class="checker source"><img src="${escapeHtml(sourceLink)}" alt="Accepted source"></div><figcaption>Accepted source</figcaption></figure>` +
          `<figure><div class="checker candidate"><img src="${escapeHtml(result.reviewPngPath)}" alt="Non-canon review candidate"></div><figcaption>Review candidate · ${result.artifact.width} × ${result.artifact.height}</figcaption></figure>` +
          `</div><code>${result.artifact.pixelDataSha256}</code></article>`;
      }).join("\n");
    return `<section><h2>${escapeHtml(configuration.label)}</h2>` +
      `<p><strong>Controlled change:</strong> ${escapeHtml(configuration.controlledChange)}<br>` +
      `<strong>Review question:</strong> ${escapeHtml(configuration.reviewQuestion)}</p>${comparisons}</section>`;
  }).join("\n");

  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>Quick Pixelize Phase 2B-1 Review</title>` +
    `<style>body{font:16px system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#202124}` +
    `.warning{padding:1rem;border:2px solid #9b1c1c;background:#fff1f1;font-weight:700}` +
    `section{border-top:1px solid #bbb;margin-top:2rem;padding-top:1rem}article{margin:1.5rem 0}` +
    `.pair{display:flex;gap:1.5rem;flex-wrap:wrap}figure{margin:0;text-align:center}` +
    `.checker{display:flex;align-items:center;justify-content:center;width:300px;height:300px;` +
    `background-color:#ddd;background-image:linear-gradient(45deg,#aaa 25%,transparent 25%),linear-gradient(-45deg,#aaa 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#aaa 75%),linear-gradient(-45deg,transparent 75%,#aaa 75%);` +
    `background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}` +
    `.source img{max-width:100%;max-height:100%}.candidate img{width:256px;height:256px;object-fit:contain;image-rendering:pixelated}` +
    `figcaption{margin-top:.4rem}code{font-size:.75rem;word-break:break-all}</style></head><body>` +
    `<h1>Quick Pixelize Phase 2B-1 Human Review</h1>` +
    `<p class="warning">NON-CANON REVIEW ONLY · NOT APPROVED · NOT A FROZEN GOLDEN · PRODUCTION EXPORT BLOCKED</p>` +
    `<p>Algorithm: <code>${bundle.algorithm.identity}</code><br>Reference: <code>${escapeHtml(bundle.referenceConfigurationId)}</code><br>` +
    `Fixture: <code>${escapeHtml(bundle.fixtureId)}</code></p>` +
    `<p>The checkerboard is presentation-only. It exposes transparency without changing any candidate PNG.</p>${sections}</body></html>\n`;
}

export async function generateQuickPixelizeReviewBundle(
  plan: QuickPixelizeReviewPlan,
  outputDirectory: string,
  schemas?: SchemaRegistry,
): Promise<QuickPixelizeReviewBundle> {
  const activeSchemas = schemas ?? await SchemaRegistry.create();
  assertId(plan.id, "review bundle id");
  if (!plan.id.startsWith("TEST_")) throw new Error("review bundle ID must use the Workbench-local TEST_ convention");
  validateControlledConfigurations(plan.configurations, plan.referenceConfigurationId, activeSchemas);
  const fixture = await loadFixture(plan.fixturePath, activeSchemas);
  const absoluteOutput = path.resolve(outputDirectory);
  await assertDirectoryAbsent(absoluteOutput);
  await mkdir(path.dirname(absoluteOutput), { recursive: true });
  await mkdir(absoluteOutput);
  const workspace = new Workspace(path.join(absoluteOutput, "workspace"));
  await workspace.initialize();
  const processor = new QuickPixelizeProcessor(workspace, activeSchemas);
  const sources: ReviewSource[] = [];
  const sourceIds = new Map<Direction, string>();

  for (const fixtureSource of fixture.sourceArtifacts) {
    const sourceId = `source-${fixtureSource.direction}`;
    const source = await workspace.importSource({
      inputPath: fixtureSource.artifact.path,
      id: sourceId,
      identity: fixture.identity,
      direction: fixtureSource.direction,
      sourceType: fixtureSource.provenance.kind === "artist-authored" ? "artist-png" : "synthetic-test-png",
      importedAt: plan.generatedAt,
      importedBy: "phase-2b-1-review-generator",
    });
    if (
      source.artifact.encodedSha256 !== fixtureSource.artifact.encodedSha256
      || source.artifact.pixelDataSha256 !== fixtureSource.artifact.pixelDataSha256
    ) {
      throw new Error("review source does not match frozen fixture hashes");
    }
    sourceIds.set(source.direction, source.id);
    sources.push({
      direction: source.direction,
      repositoryPath: fixtureSource.artifact.path,
      provenance: structuredClone(fixtureSource.provenance),
      artifact: structuredClone(fixtureSource.artifact),
      sourceAssetRecordPath: `workspace/records/sources/${source.id}.json`,
    });
  }

  const results: ReviewResult[] = [];
  await mkdir(path.join(absoluteOutput, "configs"));
  for (const configuration of plan.configurations) {
    await writeFile(
      path.join(absoluteOutput, "configs", `${configuration.id}.json`),
      `${JSON.stringify(configuration.config, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    for (const source of sources) {
      const sourceAssetId = sourceIds.get(source.direction);
      if (!sourceAssetId) throw new Error("review direction has no imported source");
      const suffix = `${configuration.id}-${source.direction}`;
      const processed = await processor.process({
        sourceAssetId,
        direction: source.direction,
        config: configuration.config,
        createdAt: plan.generatedAt,
        runId: `run-${suffix}`,
        candidateId: `candidate-${suffix}`,
      });
      const reviewPngPath = `outputs/${configuration.id}-${source.direction}.png`;
      const reviewPngAbsolute = path.join(absoluteOutput, ...reviewPngPath.split("/"));
      await mkdir(path.dirname(reviewPngAbsolute), { recursive: true });
      await copyFile(
        workspace.resolvePortable(processed.candidate.artifact.path),
        reviewPngAbsolute,
        fsConstants.COPYFILE_EXCL,
      );
      const reviewDescription = inspectPngBuffer(await readFile(reviewPngAbsolute));
      if (
        reviewDescription.encodedSha256 !== processed.candidate.artifact.encodedSha256
        || reviewDescription.pixelDataSha256 !== processed.candidate.artifact.pixelDataSha256
      ) {
        throw new Error("review presentation PNG differs from its CandidateAsset");
      }
      results.push({
        configurationId: configuration.id,
        direction: source.direction,
        preparationRunRecordPath: `workspace/records/runs/${processed.run.id}.json`,
        candidateAssetRecordPath: `workspace/records/candidates/${processed.candidate.id}.json`,
        reviewPngPath,
        artifact: structuredClone(processed.candidate.artifact),
        sourceBounds: processed.processing.sourceBounds,
        outputPlacement: processed.processing.outputPlacement,
        clearedPixelCount: processed.processing.clearedPixelCount,
      });
    }
  }

  const bundle: QuickPixelizeReviewBundle = {
    schemaVersion: "uis.head-preparation.quick-pixelize-review-bundle/1",
    kind: "quick-pixelize-review-bundle",
    id: plan.id,
    fixtureId: fixture.id,
    canonStatus: "non-canon",
    goldenStatus: "not-frozen",
    productionExportAllowed: false,
    algorithm: {
      id: QUICK_PIXELIZE_WORKFLOW_ID,
      version: QUICK_PIXELIZE_ALGORITHM_VERSION,
      identity: QUICK_PIXELIZE_ALGORITHM_IDENTITY,
    },
    referenceConfigurationId: plan.referenceConfigurationId,
    configurations: structuredClone(plan.configurations),
    sources,
    workspaceRoot: "workspace",
    results,
    generatedAt: plan.generatedAt,
  };
  const validation = activeSchemas.validate(SCHEMA_IDS.quickPixelizeReviewBundle, bundle);
  if (!validation.valid) {
    throw new Error(`generated review bundle is invalid: ${JSON.stringify(validation.errors)}`);
  }
  await writeFile(path.join(absoluteOutput, "bundle.json"), `${JSON.stringify(bundle, null, 2)}\n`, { flag: "wx" });
  await writeFile(path.join(absoluteOutput, "REVIEW.md"), markdownForBundle(bundle, absoluteOutput), { flag: "wx" });
  await writeFile(path.join(absoluteOutput, "REVIEW.html"), htmlForBundle(bundle, absoluteOutput), { flag: "wx" });
  return bundle;
}
