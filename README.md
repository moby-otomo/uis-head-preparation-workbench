# UIS Head Preparation Workbench

Deterministic preparation and validation of artist-created head assets for the
Moby Otomo / Uncles in Space character pipeline.

The Workbench is an independent upstream tool:

```text
Artist source head
      ↓
Head Preparation Workbench
      ↓
Workbench-native Prepared Head Candidate
      ↓
future explicit compatibility/export adapter
      ↓
UIS Helmeted-Head Cartridge Candidate
      ↓
Character Switchboard
```

Phase 1 establishes contracts, immutable source storage, append-only review
events, validation, synthetic fixtures, and a versioned description of the
current downstream compatibility target. Phase 2A adds the deterministic
mechanical Quick Pixelize core. It does **not** add artistic palette work, AI
Pixel Adapt, cartridge export, Switchboard execution, a GUI, or canon
registration.

## Governing rules

- Source bytes are immutable. Replacement creates a new source record.
- Every prepared output begins as a candidate.
- Approval is an explicit human review event.
- `Approved != Canon`; this repository allocates no taxonomy numbers.
- Direction is `facing-left` or `facing-right`; silent mirroring is forbidden.
- `TEST_` is a Workbench-local non-canon convention, not a UIS-wide reservation.
- The core works without a compatibility profile.
- Missing downstream evidence is `unverified`, never implicitly compatible.

## Development

Requirements: the Node.js version declared in `.nvmrc` and npm.

```sh
npm ci
npm run check
```

Useful commands:

```sh
npm run build
npm run typecheck
npm run lint
npm test
```

Tests use only repository-owned synthetic data and temporary directories under
`.tmp-tests/`. They require no network, production archive, Switchboard, API
key, or production image.

## Repository map

- `schemas/v1/` — authoritative JSON Schema contracts.
- `src/domain/` — compatibility-independent domain rules.
- `src/quick-pixelize/` — versioned deterministic Phase 2A raster processing.
- `src/storage/` — content-addressed immutable source/candidate storage.
- `src/validation/` — schema, PNG, integrity, policy, and compatibility checks.
- `compatibility/profiles/` — versioned downstream target descriptions.
- `fixtures/` — synthetic and contract-only non-canon fixtures.
- `docs/` — architecture, lifecycle, contracts, and compatibility decisions.

See [architecture](docs/architecture.md), [lifecycle](docs/lifecycle.md),
[contracts](docs/contracts.md), [Quick Pixelize Phase 2A](docs/quick-pixelize-phase-2a.md),
and [compatibility](docs/compatibility.md).

The calibration strategy is incremental: the accepted Fixture A pair covers
basic flat-colour head geometry, including eyes, eyebrows, mouth, and mild
eyebrow asymmetry. The artist intentionally omits noses. Facing Left is the
primary artist-authored source; Facing Right is a declared mirror-derived
technical companion. A later Fixture B will cover glasses, hair, facial hair,
shading, and more complex asymmetry.
