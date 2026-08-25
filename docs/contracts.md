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

Paths inside records must be portable relative POSIX paths. Absolute paths,
backslashes, traversal segments, and NUL bytes are rejected.

`workflow` exists only on `PreparationRun`. There is no duplicated `approved`
boolean. Current review state is derived from events. Timestamp fields provide
audit provenance but do not enter hashes used to compare deterministic work.

The current Phase 1 runtime can record manual artist-import runs and candidates;
it contains no raster transformation implementation.
