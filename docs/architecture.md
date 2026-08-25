# Architecture

The Workbench is a small TypeScript modular monolith. JSON files and PNGs are
portable domain records; no database or external production archive is needed.

## Boundaries

`domain` defines direction, lineage, preparation, review, reproducibility, and
policy. `storage` implements a content-addressed object store and append-only
records. `validation` checks schemas, images, hashes, lineage, lifecycle, local
test policy, and optional compatibility profiles.

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

## Deferred modules

Quick Pixelize, AI providers, a cartridge exporter, chassis preview, GUI,
Switchboard execution, archive writing, production promotion, and canon
registration are outside Phase 1.
