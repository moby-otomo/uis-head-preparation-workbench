import { sha256 } from "../domain/hash.js";
import { assertDirection } from "../domain/invariants.js";
import type { CandidateAsset, Direction, PreparationRun } from "../domain/model.js";
import { Workspace } from "../storage/workspace.js";
import { inspectPngBuffer } from "../validation/png.js";
import { SCHEMA_IDS, SchemaRegistry } from "../validation/schema-registry.js";
import {
  QUICK_PIXELIZE_ALGORITHM_VERSION,
  QUICK_PIXELIZE_WORKFLOW_ID,
  type QuickPixelizeConfig,
} from "./config.js";
import { quickPixelize, type QuickPixelizeResult } from "./engine.js";

export interface ProcessQuickPixelizeInput {
  sourceAssetId: string;
  direction: Direction;
  config: QuickPixelizeConfig;
  createdAt: string;
  runId?: string;
  candidateId?: string;
  compatibilityProfileId?: string;
}

export interface ProcessQuickPixelizeResult {
  run: PreparationRun;
  candidate: CandidateAsset;
  processing: QuickPixelizeResult;
}

function assertPinnedSource(
  expected: { encodedSha256: string; pixelDataSha256: string },
  buffer: Buffer,
): void {
  if (sha256(buffer) !== expected.encodedSha256) {
    throw new Error("source encoded hash does not match its immutable SourceAsset record");
  }
  const actual = inspectPngBuffer(buffer);
  if (actual.pixelDataSha256 !== expected.pixelDataSha256) {
    throw new Error("source decoded-pixel hash does not match its immutable SourceAsset record");
  }
}

export class QuickPixelizeProcessor {
  constructor(
    private readonly workspace: Workspace,
    private readonly schemas: SchemaRegistry,
  ) {}

  async process(input: ProcessQuickPixelizeInput): Promise<ProcessQuickPixelizeResult> {
    assertDirection(input.direction);
    const configResult = this.schemas.validate(SCHEMA_IDS.quickPixelizeConfig, input.config);
    if (!configResult.valid) {
      const details = configResult.errors
        .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
        .join("; ");
      throw new Error(`invalid Quick Pixelize configuration: ${details}`);
    }
    if (input.config.algorithmVersion !== QUICK_PIXELIZE_ALGORITHM_VERSION) {
      throw new Error("configuration algorithm version does not match this Quick Pixelize adapter");
    }

    const source = await this.workspace.loadSource(input.sourceAssetId);
    if (source.direction !== input.direction) {
      throw new Error("Quick Pixelize direction must match the source; mirroring is never implicit");
    }
    const sourceBuffer = await this.workspace.readArtifact(source.artifact.path);
    assertPinnedSource(source.artifact, sourceBuffer);
    const sourceHashBeforeProcessing = sha256(sourceBuffer);
    const processing = quickPixelize(sourceBuffer, input.config);

    const sourceBufferAfterProcessing = await this.workspace.readArtifact(source.artifact.path);
    assertPinnedSource(source.artifact, sourceBufferAfterProcessing);
    if (sha256(sourceBufferAfterProcessing) !== sourceHashBeforeProcessing) {
      throw new Error("source mutated during Quick Pixelize processing");
    }

    const run = await this.workspace.createPreparationRun({
      ...(input.runId ? { id: input.runId } : {}),
      sourceAssetId: source.id,
      workflow: {
        id: QUICK_PIXELIZE_WORKFLOW_ID,
        version: QUICK_PIXELIZE_ALGORITHM_VERSION,
        deterministic: true,
        parameters: { quickPixelizeConfig: structuredClone(input.config) },
      },
      ...(input.compatibilityProfileId ? { compatibilityProfileId: input.compatibilityProfileId } : {}),
      createdAt: input.createdAt,
    });
    const candidate = await this.workspace.createCandidateFromBuffer({
      buffer: processing.outputPng,
      ...(input.candidateId ? { id: input.candidateId } : {}),
      sourceAssetId: source.id,
      preparationRunId: run.id,
      direction: input.direction,
      createdAt: input.createdAt,
    });
    return { run, candidate, processing };
  }
}
