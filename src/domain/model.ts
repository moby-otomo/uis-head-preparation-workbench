export const DIRECTIONS = ["facing-left", "facing-right"] as const;

export type Direction = (typeof DIRECTIONS)[number];
export type CanonStatus = "non-canon" | "production-unspecified";
export type ReviewState = "candidate" | "approved" | "rejected" | "superseded";
export type ReviewAction = "approve" | "reject" | "supersede";

export interface Identity {
  characterId: string;
  displayName: string;
  canonStatus: CanonStatus;
}

export interface ImageArtifact {
  path: string;
  mediaType: "image/png";
  encodedSha256: string;
  pixelDataSha256: string;
  byteLength: number;
  width: number;
  height: number;
  hasAlphaChannel: boolean;
  hasTransparency: boolean;
}

export interface SourceAsset {
  schemaVersion: "uis.head-preparation.source-asset/1";
  kind: "source-asset";
  id: string;
  identity: Identity;
  direction: Direction;
  sourceType: "artist-png" | "synthetic-test-png";
  artifact: ImageArtifact;
  importedAt: string;
  importedBy: string;
  supersedesSourceAssetId?: string;
}

export interface WorkflowDescriptor {
  id: string;
  version: string;
  deterministic: boolean;
  parameters: Record<string, unknown>;
}

export interface PreparationRun {
  schemaVersion: "uis.head-preparation.run/1";
  kind: "preparation-run";
  id: string;
  sourceAssetId: string;
  sourceEncodedSha256: string;
  workflow: WorkflowDescriptor;
  compatibilityProfileId?: string;
  reproducibilityKey: string;
  createdAt: string;
}

export interface CandidateAsset {
  schemaVersion: "uis.head-preparation.candidate-asset/1";
  kind: "candidate-asset";
  id: string;
  identity: Identity;
  direction: Direction;
  sourceAssetId: string;
  preparationRunId: string;
  artifact: ImageArtifact;
  initialState: "candidate";
  createdAt: string;
}

export interface ReviewEvent {
  schemaVersion: "uis.head-preparation.review-event/1";
  kind: "review-event";
  id: string;
  candidateAssetId: string;
  sequence: number;
  action: ReviewAction;
  actor: { kind: "human"; id: string };
  occurredAt: string;
  reason: string;
  validationReportId?: string;
  replacementCandidateAssetId?: string;
}

export type ValidationLayer =
  | "schema"
  | "binary"
  | "hash"
  | "lineage"
  | "direction"
  | "lifecycle"
  | "policy"
  | "compatibility";

export interface ValidationCheck {
  layer: ValidationLayer;
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  path?: string;
}

export interface ValidationReport {
  schemaVersion: "uis.head-preparation.validation-report/1";
  kind: "validation-report";
  id: string;
  subject: {
    kind: "source-asset" | "candidate-asset" | "compatibility-profile";
    id: string;
  };
  outcome: "pass" | "fail" | "unverified";
  coreOutcome: "pass" | "fail";
  compatibilityOutcome: "pass" | "fail" | "unverified" | "not-applicable";
  compatibilityProfileId?: string;
  validatorVersion: string;
  createdAt: string;
  checks: ValidationCheck[];
}

export interface CompatibilityProfile {
  schemaVersion: "uis.head-preparation.compatibility-profile/1";
  kind: "compatibility-profile";
  id: string;
  profileVersion: number;
  target: {
    architecture: string;
    moduleType: string;
    supportedDirections: Direction[];
    canvas: { width: number; height: number };
    coordinateSystem: { origin: string; xAxis: string; yAxis: string };
    registeredCanvasAnchor: { x: number; y: number; unit: string };
    layerOrder: string[];
    representation: {
      mediaType: string;
      colorModel: string;
      registration: string;
      automaticScalingAllowed: boolean;
    };
    pairing: {
      pairedDirectionsRequired: boolean;
      crossDirectionPairingAllowed: boolean;
      silentMirroringAllowed: boolean;
    };
    downstreamSchemas: Record<string, string>;
    identifierPattern: string;
    naming: Record<string, unknown>;
  };
  evidence: {
    authority: string;
    runtimeDependency: boolean;
    externalVerification: "not-performed-by-phase-1-runtime" | "verified-by-adapter";
  };
}
