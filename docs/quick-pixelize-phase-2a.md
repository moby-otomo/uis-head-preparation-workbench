# Quick Pixelize Phase 2A

Phase 2A is a deterministic mechanical preparation core governed by “change
the representation, not the character.” It consumes an immutable `SourceAsset`,
creates a `PreparationRun`, and stores its output as a new `CandidateAsset`.
It does not approve, mirror, export, register, or modify a source.

## Version and configuration

The algorithm identity is `quick-pixelize/1.0.0`. Its machine-readable contract
is `uis.head-preparation.quick-pixelize-config/1`. Output-affecting behavior may
not change under that algorithm version.

The configuration contains only:

- an explicit algorithm version;
- alpha cleanup threshold and mode;
- normalized-alpha content-bound mode;
- explicit output width, height, and `contain` fit;
- nearest-neighbour resampling;
- per-edge transparent padding; and
- fixed 8-bit RGBA PNG encoding parameters.

Output dimensions are caller-supplied Workbench parameters. They are not a
global UIS head size and are not inferred from a compatibility profile.

## Alpha and bounds policy

`clear-at-or-below` turns every pixel whose alpha is less than or equal to the
configured threshold into canonical transparent black `(0,0,0,0)`. Pixels above
the threshold retain all four decoded channel values. This rule removes known
low-alpha remnants reproducibly without claiming an artistic UIS requirement.
It runs on a decoded copy and never changes source bytes.

Content bounds are the smallest inclusive rectangle containing pixels with
nonzero alpha after cleanup. Thus the alpha threshold is also the content
threshold. Boundary-touching pixels are included and never silently cropped.
An entirely transparent normalized image fails.

## Scaling and encoding

The content rectangle is fitted inside the target region remaining after
explicit padding. Integer dimensions are calculated with integer products and
flooring; the limiting axis fills the region and the other axis retains the
source ratio subject only to unavoidable pixel-grid quantization. Odd leftover
space is assigned to the right or bottom by floor-centering the placement.

Sampling is nearest-neighbour with source coordinates selected by integer
flooring. There is no warp, mirror, reconstruction, or hidden correction. The
output exterior and unused padding are transparent black.

PNG output is metadata-free 8-bit RGBA using filter type `0`, deflate level `9`,
and deflate strategy `3`. Identical validated source bytes and configuration
produce identical decoded pixels and reproducibility keys. Tests also require
encoded-byte equality under the pinned Node and `pngjs` versions. Decoded RGBA
hash identity remains authoritative across environments because zlib or encoder
implementations outside the pinned environment may encode identical pixels
differently.

Targets above 16,777,216 pixels fail as a processing safety limit. Padding that
leaves no content region and unsupported configuration values also fail rather
than falling back.

## Exclusions

Phase 2A does not implement palette normalization or reduction, outline or
artistic cleanup, preview UI, opposite-head generation, AI, compatibility
export, Switchboard assembly, archive writing, production promotion, or canon
registration.
