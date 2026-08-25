# Compatibility

## Primary target

The current documented target is owner-approved atomic Helmeted-Head Cartridge
v1, not the legacy identity-only `HEAD-IDENTITY` / `VISOR-FG` architecture.

The profile `uis-helmeted-head-cartridge-v1` records:

- `HELMETED-HEAD-CARTRIDGE` atomic ownership;
- `facing-left` and `facing-right`;
- a 1536×1920 canvas with top-left coordinates and registration at `(0,0)`;
- `BODY-CHASSIS → HELMETED-HEAD-CARTRIDGE` assembly;
- paired-direction export, no cross-direction pairing, no mirroring;
- current schema/version identifiers and filename templates;
- full-canvas registered RGBA PNG downstream representation.

These are profile values, never global Workbench constants. Core candidates may
use another convenient canvas and remain useful with no profile loaded.

Phase 1 validates the profile and can confirm that a candidate direction is in
scope. It cannot claim cartridge compatibility because the explicit adapter is
not implemented. That check returns `unverified`.

## Immutable evidence

The profile was documented from the current external UIS style/platform and
Switchboard contracts, the approved cartridge pack/record/registry, current
schemas, and executable preparation/validation tools. Those external files,
their embedded paths, and whole-record hashes are not copied or used at runtime.

## Compatibility history

The approved legacy platform used `BODY-CHASSIS → HEAD-IDENTITY → VISOR-FG` and
the optional identity-head preparation contract. It remains relevant for replay
and future optional adapters, but it is not the primary Workbench architecture.

## Unresolved adapter decisions

- how an approved Workbench head is composed with helmet, visor, collar rim, and
  earpiece artwork;
- how artistic registration maps into the atomic cartridge before full-canvas
  origin registration;
- how paired directions are gathered when Workbench candidates are reviewed
  independently;
- how portable outputs are imported into path-bound production provenance;
- production promotion and registry update behavior.
