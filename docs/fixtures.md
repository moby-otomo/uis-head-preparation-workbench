# Fixtures

All committed fixtures are synthetic or contract-only, safe to commit, and
independent of production archives.

`TEST_` is a Workbench-local naming convention. Every such fixture must declare
`canonStatus: non-canon`; policy validation blocks it from production export.

Fixture A is intentionally incremental. Its accepted PNG pair contains a simple
bald head, flat skin colour, eyes, eyebrows, one mild eyebrow asymmetry, mouth,
ears, and a transparent exterior. The absent nose is an intentional property of
the artist's character style, not missing source data. The fixture tests
silhouette, facial geometry, direction-specific identity, transparency, and
deterministic resampling without glasses, hair, facial hair, highlights, or
shadows.

The Facing Left PNG is the primary artist-authored identity source. The Facing
Right PNG is explicitly mirror-derived and is not an independently authored
opposite view. It is also not pixel-exact to a current horizontal flip of the
accepted left file, so provenance describes derivation rather than byte/pixel
equivalence.

Both accepted files retain very-low-alpha detached edge remnants and
green-dominant pixels. These are frozen as known source artifacts for testing
deterministic alpha cleanup. They are not identity features, and the immutable
source files must not be edited to remove them inside the Workbench.

A later Fixture B will add glasses, hair or facial hair, tonal separation,
curved detail, and more complex asymmetry. That fixture will stress palette
reduction and identity-detail survival after the basic geometry path is stable.
Neither fixture is an approved UIS production asset.

Tests generate additional tiny protocol-level PNGs inside `.tmp-tests/`. Phase
2 may add stable Quick Pixelize golden images only after an algorithm version
is defined; those outputs must remain separate from these immutable sources.
