# Contracts

JSON Schema Draft 2020-12 files in `schemas/v1/` are authoritative.

| Record | Purpose |
|---|---|
| `SourceAsset` | Immutable artist input, direction, identity, provenance, and content hashes |
| `PreparationRun` | Workflow ID/version/parameters and deterministic reproducibility key |
| `CandidateAsset` | Prepared PNG lineage and mandatory initial candidate state |
| `ReviewEvent` | Append-only human approval, rejection, or supersession |
| `ValidationReport` | Machine-readable layered results and compatibility outcome |
| `Fixture` | Workbench-local synthetic/non-canon calibration contract |
| `CompatibilityProfile` | Versioned downstream constraints outside the core model |
| `QuickPixelizeConfig` | Versioned deterministic mechanical raster parameters |

Paths inside records must be portable relative POSIX paths. Absolute paths,
backslashes, traversal segments, and NUL bytes are rejected.

`workflow` exists only on `PreparationRun`. There is no duplicated `approved`
boolean. Current review state is derived from events. Timestamp fields provide
audit provenance but do not enter hashes used to compare deterministic work.

Quick Pixelize configuration is validated by
`schemas/v1/quick-pixelize-config.schema.json`. A successful processing call
records it under the existing `PreparationRun.workflow.parameters`; it does not
create a parallel run or candidate contract. Workflow fields express the
algorithm identity as `id: quick-pixelize` and `version: 1.0.0`, conceptually
`quick-pixelize/1.0.0`.
