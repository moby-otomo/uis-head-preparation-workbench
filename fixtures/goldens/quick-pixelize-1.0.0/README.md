# Quick Pixelize 1.0.0 Mechanical Regression Goldens

The owner explicitly accepted the `reference-cleanup-64` outputs for both
accepted calibration directions as the mechanical regression baseline for
`quick-pixelize/1.0.0`.

This acceptance means only that future executions with the frozen source bytes,
configuration, and algorithm version must reproduce the same encoded PNG bytes
and decoded RGBA pixels. It is not artistic UIS approval, a production head-size
standard, production-export eligibility, canon registration, or taxonomy
allocation.

| Direction | Frozen mechanical golden |
|---|---|
| facing-left | ![Facing-left mechanical golden](TEST_QuickPixelizeCalibrationA-ReferenceCleanup64-FacingLeft_MechanicalGolden_v01.png) |
| facing-right | ![Facing-right mechanical golden](TEST_QuickPixelizeCalibrationA-ReferenceCleanup64-FacingRight_MechanicalGolden_v01.png) |

The exact configuration and all source, review-candidate, encoded-byte, and
decoded-pixel hashes are recorded in
`TEST_QuickPixelizeCalibrationA_MechanicalGoldenSet_v01.json`.

The `alpha-preserve-64`, `zero-padding-64`, and `larger-grid-96` outputs remain
comparison evidence in the Phase 2B-1 review bundle. They are not goldens.
