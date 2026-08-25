import { randomUUID } from "node:crypto";

import { deriveReviewState } from "../domain/lifecycle.js";
import type {
  CandidateAsset,
  CompatibilityProfile,
  SourceAsset,
  ValidationCheck,
  ValidationReport,
} from "../domain/model.js";
import { Workspace } from "../storage/workspace.js";
import { inspectPngBuffer } from "./png.js";
import { SCHEMA_IDS, SchemaRegistry } from "./schema-registry.js";

const VALIDATOR_VERSION = "1.0.0";

interface ValidationOptions {
  id?: string;
  createdAt?: string;
}

function check(layer: ValidationCheck["layer"], code: string, severity: ValidationCheck["severity"], message: string, path?: string): ValidationCheck {
  return { layer, code, severity, message, ...(path ? { path } : {}) };
}

function schemaChecks(registry: SchemaRegistry, schemaId: string, document: unknown): ValidationCheck[] {
  const result = registry.validate(schemaId, document);
  if (result.valid) return [check("schema", "SCHEMA_VALID", "info", "Document satisfies its JSON Schema.")];
  return result.errors.map((error) => check(
    "schema",
    "SCHEMA_INVALID",
    "error",
    `${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
    error.instancePath || "/",
  ));
}

function finishReport(
  subject: ValidationReport["subject"],
  checks: ValidationCheck[],
  compatibilityOutcome: ValidationReport["compatibilityOutcome"],
  options: ValidationOptions,
  compatibilityProfileId?: string,
): ValidationReport {
  const coreFailed = checks.some((item) => item.severity === "error" && item.layer !== "compatibility");
  const compatibilityFailed = checks.some((item) => item.severity === "error" && item.layer === "compatibility");
  const coreOutcome = coreFailed ? "fail" : "pass";
  const outcome = coreFailed || compatibilityFailed
    ? "fail"
    : compatibilityOutcome === "unverified"
      ? "unverified"
      : "pass";
  return {
    schemaVersion: "uis.head-preparation.validation-report/1",
    kind: "validation-report",
    id: options.id ?? `validation-${randomUUID()}`,
    subject,
    outcome,
    coreOutcome,
    compatibilityOutcome,
    ...(compatibilityProfileId ? { compatibilityProfileId } : {}),
    validatorVersion: VALIDATOR_VERSION,
    createdAt: options.createdAt ?? new Date().toISOString(),
    checks,
  };
}

export class Validator {
  constructor(
    private readonly workspace: Workspace,
    private readonly schemas: SchemaRegistry,
  ) {}

  async validateSource(sourceAssetId: string, options: ValidationOptions = {}): Promise<ValidationReport> {
    const checks: ValidationCheck[] = [];
    let source: SourceAsset;
    try {
      source = await this.workspace.loadSource(sourceAssetId);
    } catch (error) {
      checks.push(check("lineage", "SOURCE_RECORD_MISSING", "error", String(error)));
      return finishReport({ kind: "source-asset", id: sourceAssetId }, checks, "not-applicable", options);
    }

    checks.push(...schemaChecks(this.schemas, SCHEMA_IDS.sourceAsset, source));
    await this.validateArtifact(source.artifact, checks);
    await this.validateSourceLineage(source, checks);
    this.validateTestPolicy(source.identity.characterId, source.identity.canonStatus, checks);
    checks.push(check("direction", "DIRECTION_DECLARED", "info", `Direction is explicitly ${source.direction}.`));
    return finishReport({ kind: "source-asset", id: source.id }, checks, "not-applicable", options);
  }

  async validateCandidate(
    candidateAssetId: string,
    profile?: CompatibilityProfile,
    options: ValidationOptions = {},
  ): Promise<ValidationReport> {
    const checks: ValidationCheck[] = [];
    let candidate: CandidateAsset;
    try {
      candidate = await this.workspace.loadCandidate(candidateAssetId);
    } catch (error) {
      checks.push(check("lineage", "CANDIDATE_RECORD_MISSING", "error", String(error)));
      return finishReport({ kind: "candidate-asset", id: candidateAssetId }, checks, profile ? "fail" : "unverified", options, profile?.id);
    }

    checks.push(...schemaChecks(this.schemas, SCHEMA_IDS.candidateAsset, candidate));
    await this.validateArtifact(candidate.artifact, checks);
    await this.validateCandidateLineage(candidate, checks);
    this.validateTestPolicy(candidate.identity.characterId, candidate.identity.canonStatus, checks);

    try {
      const events = await this.workspace.loadReviewEvents(candidate.id);
      const state = deriveReviewState(candidate, events);
      checks.push(check("lifecycle", "LIFECYCLE_VALID", "info", `Review history derives state ${state}.`));
    } catch (error) {
      checks.push(check("lifecycle", "LIFECYCLE_INVALID", "error", String(error)));
    }

    let compatibilityOutcome: ValidationReport["compatibilityOutcome"] = "unverified";
    if (!profile) {
      checks.push(check(
        "compatibility",
        "COMPATIBILITY_PROFILE_UNAVAILABLE",
        "warning",
        "No compatibility profile was supplied; downstream compatibility is unverified.",
      ));
    } else {
      const profileResult = this.schemas.validate(SCHEMA_IDS.compatibilityProfile, profile);
      if (!profileResult.valid) {
        compatibilityOutcome = "fail";
        checks.push(...profileResult.errors.map((error) => check(
          "compatibility",
          "COMPATIBILITY_PROFILE_INVALID",
          "error",
          `${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
        )));
      } else if (!profile.target.supportedDirections.includes(candidate.direction)) {
        compatibilityOutcome = "fail";
        checks.push(check("compatibility", "DIRECTION_UNSUPPORTED_BY_PROFILE", "error", "Candidate direction is unsupported by the profile."));
      } else {
        checks.push(check("compatibility", "PROFILE_DIRECTION_SUPPORTED", "info", "Candidate direction is supported by the target profile."));
        checks.push(check(
          "compatibility",
          "COMPATIBILITY_ADAPTER_NOT_IMPLEMENTED",
          "warning",
          "The Workbench candidate has not been converted into or validated as a downstream cartridge candidate.",
        ));
      }
    }

    return finishReport(
      { kind: "candidate-asset", id: candidate.id },
      checks,
      compatibilityOutcome,
      options,
      profile?.id,
    );
  }

  validateCompatibilityProfile(profile: CompatibilityProfile, options: ValidationOptions = {}): ValidationReport {
    const checks = schemaChecks(this.schemas, SCHEMA_IDS.compatibilityProfile, profile);
    const compatibilityOutcome = checks.some((item) => item.severity === "error") ? "fail" : "pass";
    if (compatibilityOutcome === "pass") {
      checks.push(check("compatibility", "PROFILE_SELF_CONSISTENT", "info", "Compatibility profile is structurally valid."));
    }
    return finishReport(
      { kind: "compatibility-profile", id: profile.id },
      checks,
      compatibilityOutcome,
      options,
      profile.id,
    );
  }

  private async validateArtifact(artifact: CandidateAsset["artifact"], checks: ValidationCheck[]): Promise<void> {
    let buffer: Buffer;
    try {
      buffer = await this.workspace.readArtifact(artifact.path);
    } catch (error) {
      checks.push(check("hash", "ARTIFACT_MISSING", "error", String(error), artifact.path));
      return;
    }
    let description;
    try {
      description = inspectPngBuffer(buffer);
      checks.push(check("binary", "PNG_VALID", "info", "Artifact is a decodable PNG.", artifact.path));
    } catch (error) {
      checks.push(check("binary", "PNG_INVALID", "error", String(error), artifact.path));
      return;
    }
    if (description.encodedSha256 !== artifact.encodedSha256) {
      checks.push(check("hash", "ENCODED_HASH_MISMATCH", "error", "Encoded PNG hash differs from the record.", artifact.path));
    } else {
      checks.push(check("hash", "ENCODED_HASH_MATCH", "info", "Encoded PNG hash matches.", artifact.path));
    }
    if (description.pixelDataSha256 !== artifact.pixelDataSha256) {
      checks.push(check("hash", "PIXEL_HASH_MISMATCH", "error", "Canonical decoded RGBA hash differs from the record.", artifact.path));
    } else {
      checks.push(check("hash", "PIXEL_HASH_MATCH", "info", "Canonical decoded RGBA hash matches.", artifact.path));
    }
    if (description.width !== artifact.width || description.height !== artifact.height) {
      checks.push(check("binary", "DIMENSION_MISMATCH", "error", "PNG dimensions differ from the record.", artifact.path));
    }
  }

  private async validateSourceLineage(source: SourceAsset, checks: ValidationCheck[]): Promise<void> {
    if (!source.supersedesSourceAssetId) {
      checks.push(check("lineage", "SOURCE_ROOT", "info", "Source is a lineage root."));
      return;
    }
    const visited = new Set([source.id]);
    let cursor: SourceAsset = source;
    try {
      while (cursor.supersedesSourceAssetId) {
        if (visited.has(cursor.supersedesSourceAssetId)) throw new Error("source lineage contains a cycle");
        visited.add(cursor.supersedesSourceAssetId);
        const previous = await this.workspace.loadSource(cursor.supersedesSourceAssetId);
        if (previous.identity.characterId !== source.identity.characterId || previous.direction !== source.direction) {
          throw new Error("source replacement lineage changes identity or direction");
        }
        cursor = previous;
      }
      checks.push(check("lineage", "SOURCE_LINEAGE_VALID", "info", "Source replacement lineage is complete and acyclic."));
    } catch (error) {
      checks.push(check("lineage", "SOURCE_LINEAGE_INVALID", "error", String(error)));
    }
  }

  private async validateCandidateLineage(candidate: CandidateAsset, checks: ValidationCheck[]): Promise<void> {
    try {
      const [source, run] = await Promise.all([
        this.workspace.loadSource(candidate.sourceAssetId),
        this.workspace.loadRun(candidate.preparationRunId),
      ]);
      if (run.sourceAssetId !== source.id || run.sourceEncodedSha256 !== source.artifact.encodedSha256) {
        throw new Error("preparation run does not pin the candidate source content");
      }
      if (candidate.identity.characterId !== source.identity.characterId) {
        throw new Error("candidate identity differs from source identity");
      }
      if (candidate.direction !== source.direction) {
        throw new Error("candidate direction differs from source; mirroring is never implicit");
      }
      checks.push(check("lineage", "CANDIDATE_LINEAGE_VALID", "info", "Candidate source and run lineage are consistent."));
      checks.push(check("direction", "DIRECTION_CONSISTENT", "info", "Candidate and source directions match explicitly."));
    } catch (error) {
      checks.push(check("lineage", "CANDIDATE_LINEAGE_INVALID", "error", String(error)));
    }
  }

  private validateTestPolicy(characterId: string, canonStatus: string, checks: ValidationCheck[]): void {
    if (characterId.startsWith("TEST_")) {
      if (canonStatus !== "non-canon") {
        checks.push(check("policy", "TEST_POLICY_VIOLATION", "error", "TEST_ identity is not marked non-canon."));
      } else {
        checks.push(check("policy", "TEST_NON_CANON", "info", "TEST_ identity is explicitly non-canon and production-export blocked."));
      }
    } else {
      checks.push(check("policy", "LOCAL_TEST_POLICY_NOT_APPLICABLE", "info", "Identity does not use the Workbench-local TEST_ prefix."));
    }
  }
}
