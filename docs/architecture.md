# Architecture

The Workbench is a small TypeScript modular monolith. JSON files and PNGs are
portable domain records; no database or external production archive is needed.

## Boundaries

`domain` defines direction, lineage, preparation, review, reproducibility, and
policy. `storage` implements a content-addressed object store and append-only
records. `validation` checks schemas, images, hashes, lineage, lifecycle, local
test policy, and optional compatibility profiles. `quick-pixelize` contains the
versioned deterministic raster engine and the small processor that connects it
to existing runs and candidates.

The core candidate is an artist-head preparation result. It is deliberately not
a Switchboard cartridge. A future adapter must explicitly convert one or more
approved Workbench candidates into a paired, full-canvas cartridge candidate.

## Storage model

```text
workspace/
  objects/sha256/ab/<digest>
  records/sources/<id>.json
  records/runs/<id>.json
  records/candidates/<id>.json
  events/reviews/<candidate-id>/<sequence>-<event-id>.json
  reports/<id>.json
```

Objects are deduplicated by encoded SHA-256. Records are written with exclusive
creation. Replacing a source creates a new record with `supersedesSourceAssetId`.
The original path supplied by the artist is read but never edited.

## Determinism

Encoded byte hashes, canonical decoded RGBA hashes, and reproducibility keys are
separate. A reproducibility key hashes canonical JSON containing source content,
workflow ID/version/parameters, and an optional compatibility profile ID. It
excludes timestamps and record IDs.

Quick Pixelize uses the existing separation: the source encoded hash pins the
input, the candidate artifact records encoded and decoded-pixel hashes, and the
run reproducibility key identifies the input/configuration/algorithm tuple.
The engine writes a metadata-free PNG with explicit encoder settings. Canonical
decoded RGBA identity is the cross-environment image guarantee; encoded equality
is guaranteed for the repository's pinned Node and `pngjs` versions.

Phase 2B-1 review bundles are a presentation and evidence layer over those same
records. A bundle contains a repository-local Workspace with immutable sources,
runs, candidates, and content-addressed objects, plus friendly PNG copies and
static Markdown/HTML review sheets. The presentation copies must hash-match
their candidates. Bundle contracts force non-canon, non-exportable, and
not-frozen status; they create no review event.

An accepted mechanical golden is stored separately from its historical review
bundle. Its manifest pins source hashes, exact configuration bytes and canonical
configuration identity, algorithm version, review candidate lineage, and both
encoded and decoded output hashes. Mechanical acceptance does not change the
candidate lifecycle and therefore does not fabricate an `approve` review event.

## Deferred modules

Artistic palette normalization, sophisticated reduction, outline
reinterpretation, AI providers, a cartridge exporter, chassis preview, GUI,
Switchboard execution, archive writing, production promotion, and canon
registration remain deferred after Phase 2A.
