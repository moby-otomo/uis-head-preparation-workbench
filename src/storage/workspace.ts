import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { reproducibilityKey, sha256 } from "../domain/hash.js";
import { assertDirection, assertId, assertIdentity, assertPortableRelativePath } from "../domain/invariants.js";
import { deriveReviewState } from "../domain/lifecycle.js";
import type {
  CandidateAsset,
  Direction,
  Identity,
  PreparationRun,
  ReviewAction,
  ReviewEvent,
  SourceAsset,
  ValidationReport,
  WorkflowDescriptor,
} from "../domain/model.js";
import { inspectPngBuffer } from "../validation/png.js";

interface ImportSourceInput {
  inputPath: string;
  id?: string;
  identity: Identity;
  direction: Direction;
  sourceType: SourceAsset["sourceType"];
  importedAt: string;
  importedBy: string;
  supersedesSourceAssetId?: string;
}

interface CreateRunInput {
  id?: string;
  sourceAssetId: string;
  workflow: WorkflowDescriptor;
  compatibilityProfileId?: string;
  createdAt: string;
}

interface CreateCandidateInput {
  inputPath: string;
  id?: string;
  sourceAssetId: string;
  preparationRunId: string;
  direction: Direction;
  createdAt: string;
}

interface CreateCandidateFromBufferInput extends Omit<CreateCandidateInput, "inputPath"> {
  buffer: Buffer;
}

interface AppendReviewInput {
  id?: string;
  action: ReviewAction;
  actorId: string;
  occurredAt: string;
  reason: string;
  validationReportId?: string;
  replacementCandidateAssetId?: string;
}

export class Workspace {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  async initialize(): Promise<void> {
    await Promise.all([
      "objects/sha256",
      "records/sources",
      "records/runs",
      "records/candidates",
      "events/reviews",
      "reports",
    ].map((relative) => mkdir(path.join(this.root, relative), { recursive: true })));
  }

  resolvePortable(relativePath: string): string {
    assertPortableRelativePath(relativePath);
    const resolved = path.resolve(this.root, ...relativePath.split("/"));
    const boundary = `${this.root}${path.sep}`;
    if (!resolved.startsWith(boundary)) throw new Error("resolved path escapes workspace");
    return resolved;
  }

  async importSource(input: ImportSourceInput): Promise<SourceAsset> {
    assertIdentity(input.identity);
    assertDirection(input.direction);
    const id = input.id ?? `source-${randomUUID()}`;
    assertId(id, "source asset id");
    if (!input.importedBy.trim()) throw new Error("importedBy is required");

    let superseded: SourceAsset | undefined;
    if (input.supersedesSourceAssetId) {
      superseded = await this.loadSource(input.supersedesSourceAssetId);
      if (superseded.identity.characterId !== input.identity.characterId) {
        throw new Error("source replacement must preserve character identity");
      }
      if (superseded.direction !== input.direction) {
        throw new Error("source replacement must preserve direction; mirroring is not replacement");
      }
    }

    const buffer = await readFile(input.inputPath);
    const description = inspectPngBuffer(buffer);
    const objectPath = await this.storeObject(buffer, description.encodedSha256);
    const record: SourceAsset = {
      schemaVersion: "uis.head-preparation.source-asset/1",
      kind: "source-asset",
      id,
      identity: structuredClone(input.identity),
      direction: input.direction,
      sourceType: input.sourceType,
      artifact: { path: objectPath, mediaType: "image/png", ...description },
      importedAt: input.importedAt,
      importedBy: input.importedBy,
      ...(superseded ? { supersedesSourceAssetId: superseded.id } : {}),
    };
    await this.writeExclusiveJson(`records/sources/${id}.json`, record);
    return record;
  }

  async createPreparationRun(input: CreateRunInput): Promise<PreparationRun> {
    const source = await this.loadSource(input.sourceAssetId);
    const id = input.id ?? `run-${randomUUID()}`;
    assertId(id, "preparation run id");
    assertId(input.workflow.id, "workflow id");
    if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(input.workflow.version)) {
      throw new Error("workflow version must be semantic x.y.z");
    }
    if (input.compatibilityProfileId) assertId(input.compatibilityProfileId, "compatibility profile id");
    const keyInput = {
      sourceEncodedSha256: source.artifact.encodedSha256,
      workflow: input.workflow,
      ...(input.compatibilityProfileId ? { compatibilityProfileId: input.compatibilityProfileId } : {}),
    };
    const record: PreparationRun = {
      schemaVersion: "uis.head-preparation.run/1",
      kind: "preparation-run",
      id,
      sourceAssetId: source.id,
      sourceEncodedSha256: source.artifact.encodedSha256,
      workflow: structuredClone(input.workflow),
      ...(input.compatibilityProfileId ? { compatibilityProfileId: input.compatibilityProfileId } : {}),
      reproducibilityKey: reproducibilityKey(keyInput),
      createdAt: input.createdAt,
    };
    await this.writeExclusiveJson(`records/runs/${id}.json`, record);
    return record;
  }

  async createCandidate(input: CreateCandidateInput): Promise<CandidateAsset> {
    const buffer = await readFile(input.inputPath);
    return this.createCandidateFromBuffer({
      buffer,
      ...(input.id ? { id: input.id } : {}),
      sourceAssetId: input.sourceAssetId,
      preparationRunId: input.preparationRunId,
      direction: input.direction,
      createdAt: input.createdAt,
    });
  }

  async createCandidateFromBuffer(input: CreateCandidateFromBufferInput): Promise<CandidateAsset> {
    assertDirection(input.direction);
    const source = await this.loadSource(input.sourceAssetId);
    const run = await this.loadRun(input.preparationRunId);
    if (run.sourceAssetId !== source.id) throw new Error("preparation run references another source");
    if (input.direction !== source.direction) {
      throw new Error("candidate direction must match its source; silent mirroring is forbidden");
    }
    const id = input.id ?? `candidate-${randomUUID()}`;
    assertId(id, "candidate id");
    const buffer = Buffer.from(input.buffer);
    const description = inspectPngBuffer(buffer);
    const objectPath = await this.storeObject(buffer, description.encodedSha256);
    const record: CandidateAsset = {
      schemaVersion: "uis.head-preparation.candidate-asset/1",
      kind: "candidate-asset",
      id,
      identity: structuredClone(source.identity),
      direction: input.direction,
      sourceAssetId: source.id,
      preparationRunId: run.id,
      artifact: { path: objectPath, mediaType: "image/png", ...description },
      initialState: "candidate",
      createdAt: input.createdAt,
    };
    await this.writeExclusiveJson(`records/candidates/${id}.json`, record);
    return record;
  }

  async appendReviewEvent(candidateAssetId: string, input: AppendReviewInput): Promise<ReviewEvent> {
    const candidate = await this.loadCandidate(candidateAssetId);
    const events = await this.loadReviewEvents(candidate.id);
    deriveReviewState(candidate, events);
    const sequence = events.length + 1;
    const id = input.id ?? `review-${randomUUID()}`;
    assertId(id, "review event id");
    if (!input.actorId.trim() || !input.reason.trim()) throw new Error("human actor and reason are required");

    if (input.action === "approve") {
      if (!input.validationReportId) throw new Error("approval requires a validation report");
      const report = await this.loadValidationReport(input.validationReportId);
      if (report.subject.kind !== "candidate-asset" || report.subject.id !== candidate.id) {
        throw new Error("approval validation report targets another subject");
      }
      if (report.coreOutcome !== "pass") throw new Error("approval requires passing core validation");
    }
    if (input.action === "supersede") {
      if (!input.replacementCandidateAssetId) throw new Error("supersession requires a replacement candidate");
      const replacement = await this.loadCandidate(input.replacementCandidateAssetId);
      if (replacement.id === candidate.id) throw new Error("candidate cannot supersede itself");
      if (replacement.identity.characterId !== candidate.identity.characterId || replacement.direction !== candidate.direction) {
        throw new Error("replacement candidate must preserve identity and direction");
      }
    }

    const event: ReviewEvent = {
      schemaVersion: "uis.head-preparation.review-event/1",
      kind: "review-event",
      id,
      candidateAssetId: candidate.id,
      sequence,
      action: input.action,
      actor: { kind: "human", id: input.actorId },
      occurredAt: input.occurredAt,
      reason: input.reason,
      ...(input.validationReportId ? { validationReportId: input.validationReportId } : {}),
      ...(input.replacementCandidateAssetId ? { replacementCandidateAssetId: input.replacementCandidateAssetId } : {}),
    };
    deriveReviewState(candidate, [...events, event]);
    await this.writeExclusiveJson(`events/reviews/${candidate.id}/${String(sequence).padStart(6, "0")}-${id}.json`, event);
    return event;
  }

  async saveValidationReport(report: ValidationReport): Promise<void> {
    await this.writeExclusiveJson(`reports/${report.id}.json`, report);
  }

  async loadSource(id: string): Promise<SourceAsset> {
    return this.loadJson<SourceAsset>(`records/sources/${id}.json`);
  }

  async loadRun(id: string): Promise<PreparationRun> {
    return this.loadJson<PreparationRun>(`records/runs/${id}.json`);
  }

  async loadCandidate(id: string): Promise<CandidateAsset> {
    return this.loadJson<CandidateAsset>(`records/candidates/${id}.json`);
  }

  async loadValidationReport(id: string): Promise<ValidationReport> {
    return this.loadJson<ValidationReport>(`reports/${id}.json`);
  }

  async loadReviewEvents(candidateId: string): Promise<ReviewEvent[]> {
    const directory = this.resolvePortable(`events/reviews/${candidateId}`);
    let files: string[];
    try {
      files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    return Promise.all(files.map((file) => this.loadJson<ReviewEvent>(`events/reviews/${candidateId}/${file}`)));
  }

  async readArtifact(relativePath: string): Promise<Buffer> {
    return readFile(this.resolvePortable(relativePath));
  }

  private async storeObject(buffer: Buffer, digest: string): Promise<string> {
    if (sha256(buffer) !== digest) throw new Error("object digest changed before storage");
    const relativePath = `objects/sha256/${digest.slice(0, 2)}/${digest}`;
    const destination = this.resolvePortable(relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    try {
      await writeFile(destination, buffer, { flag: "wx", mode: 0o444 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const stored = await readFile(destination);
    if (sha256(stored) !== digest) throw new Error("content-addressed object hash mismatch");
    return relativePath;
  }

  private async writeExclusiveJson(relativePath: string, value: unknown): Promise<void> {
    const destination = this.resolvePortable(relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  }

  private async loadJson<T>(relativePath: string): Promise<T> {
    return JSON.parse(await readFile(this.resolvePortable(relativePath), "utf8")) as T;
  }
}
