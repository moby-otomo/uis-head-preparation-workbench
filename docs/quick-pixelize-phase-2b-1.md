# Quick Pixelize Phase 2B-1 Review Bundle

Phase 2B-1 generated a repository-owned human-review bundle without automatically
approving or freezing any output. It uses the accepted non-canon calibration
pair and `quick-pixelize/1.0.0` only.

## Controlled comparison

The comparison starts with the Phase 2A example configuration and changes one
declared variable group at a time:

| Configuration | Target | Alpha threshold | Padding | Controlled change |
|---|---:|---:|---:|---|
| `reference-cleanup-64` | 64 × 64 | 15 | 2 each edge | reference |
| `alpha-preserve-64` | 64 × 64 | 0 | 2 each edge | alpha threshold only |
| `zero-padding-64` | 64 × 64 | 15 | 0 each edge | padding only |
| `larger-grid-96` | 96 × 96 | 15 | 2 each edge | target grid only |

These values are review experiments, not UIS production requirements. Both
accepted directions are processed independently from their declared sources;
the generator performs no mirroring.

## Bundle contents

The generated bundle contains:

- the four exact machine-readable configurations;
- eight friendly review PNGs;
- immutable Phase 1 `SourceAsset`, `PreparationRun`, and `CandidateAsset`
  records in a local content-addressed Workspace;
- source provenance, bounds, placement, and hash evidence in `bundle.json`;
- a Markdown review sheet; and
- a static checkerboard HTML sheet that enlarges pixels without modifying the
  candidate PNGs.

The bundle schema requires Workbench-local `TEST_` identity,
`canonStatus: non-canon`, `goldenStatus: not-frozen`, and
`productionExportAllowed: false`. Generation fails if the destination already
exists. This prevents silent regeneration or overwrite of review evidence.

## Human review boundary

Reviewers may compare identity preservation, eyebrow asymmetry, alpha remnants,
framing, and grid legibility. Review does not itself append an approval event.
If a configuration is later selected for a permanent mechanical regression
golden, that must be a separate explicit action. Artistic UIS production
approval remains distinct.

## Mechanical baseline acceptance

After human review, the owner explicitly accepted `reference-cleanup-64` for
both directions as the `quick-pixelize/1.0.0` mechanical regression baseline.
The exact configuration and PNGs are frozen under
`fixtures/goldens/quick-pixelize-1.0.0/`. The golden-set manifest records source,
configuration, review lineage, encoded-byte, and decoded-pixel hashes.

The historical review bundle remains `not-frozen`: presence in that bundle does
not confer golden status. The golden-set manifest selects only the reference
pair. `alpha-preserve-64`, `zero-padding-64`, and `larger-grid-96` remain review
evidence.

Mechanical acceptance requires exact deterministic reproduction. It does not
append an asset approval event and does not imply artistic approval, a UIS
production head-size standard, production export eligibility, canon, or a
taxonomy number.
