# Quick Pixelize Phase 2B-1 Human Review

This bundle is Workbench-local, explicitly non-canon, and blocked from production export. All outputs are review candidates. **No output is approved or frozen as a golden.**

- Algorithm: `quick-pixelize/1.0.0`
- Reference configuration: `reference-cleanup-64`
- Source fixture: `TEST_HeadPreparationCalibration-UncleA_UIS_v01`

Compare identity preservation, low-alpha cleanup, framing, and pixel-grid legibility. Do not interpret the target dimensions as UIS production requirements.

## Reference cleanup at 64 × 64

Controlled change: `reference`

Review question: Does the Phase 2A reference preserve identity and readable asymmetry?

| Direction | Accepted source | Non-canon review candidate | Decoded-pixel SHA-256 |
|---|---|---|---|
| facing-left | ![Accepted source](../../../fixtures/calibration/TEST_HeadPreparationCalibration-UncleA-FacingLeft_UIS_v01.png) | ![Review candidate](outputs/reference-cleanup-64-facing-left.png) | `dd8b29f3fc0b43ede24dd72c5559ed12de4b071249ed3e77f1a6e83913079edb` |
| facing-right | ![Accepted source](../../../fixtures/calibration/TEST_HeadPreparationCalibration-UncleA-FacingRight-MirrorDerived_UIS_v01.png) | ![Review candidate](outputs/reference-cleanup-64-facing-right.png) | `143d0a46805be283e389179def57334d6f2417095de9daa3027e63c2593e855f` |

## Preserve low-alpha remnants at 64 × 64

Controlled change: `alpha-threshold`

Review question: Does retaining alpha 1–15 introduce visible edge noise compared with the reference?

| Direction | Accepted source | Non-canon review candidate | Decoded-pixel SHA-256 |
|---|---|---|---|
| facing-left | ![Accepted source](../../../fixtures/calibration/TEST_HeadPreparationCalibration-UncleA-FacingLeft_UIS_v01.png) | ![Review candidate](outputs/alpha-preserve-64-facing-left.png) | `efc2eb1c96dff841d2593cc7deec610602e401debf578be828d74ff6eebebd49` |
| facing-right | ![Accepted source](../../../fixtures/calibration/TEST_HeadPreparationCalibration-UncleA-FacingRight-MirrorDerived_UIS_v01.png) | ![Review candidate](outputs/alpha-preserve-64-facing-right.png) | `0c8f88f9be0ca21b60385b08e7cecfa2da20750a858b13bc3ab28d5f093376ef` |

## Zero configured padding at 64 × 64

Controlled change: `transparent-padding`

Review question: Does edge-to-edge fitting feel cramped compared with the two-pixel reference padding?

| Direction | Accepted source | Non-canon review candidate | Decoded-pixel SHA-256 |
|---|---|---|---|
| facing-left | ![Accepted source](../../../fixtures/calibration/TEST_HeadPreparationCalibration-UncleA-FacingLeft_UIS_v01.png) | ![Review candidate](outputs/zero-padding-64-facing-left.png) | `ed7377adba2b47b5a42cc8931576880b0d60e531844b48e88950b42a14891a7c` |
| facing-right | ![Accepted source](../../../fixtures/calibration/TEST_HeadPreparationCalibration-UncleA-FacingRight-MirrorDerived_UIS_v01.png) | ![Review candidate](outputs/zero-padding-64-facing-right.png) | `6a67ee439c7bde0e63b0c362a3cb1d5757cb34b7ca9e5d951f01ed9703dabe49` |

## Larger 96 × 96 review grid

Controlled change: `target-grid`

Review question: Does the larger mechanical grid preserve useful detail without changing character geometry?

| Direction | Accepted source | Non-canon review candidate | Decoded-pixel SHA-256 |
|---|---|---|---|
| facing-left | ![Accepted source](../../../fixtures/calibration/TEST_HeadPreparationCalibration-UncleA-FacingLeft_UIS_v01.png) | ![Review candidate](outputs/larger-grid-96-facing-left.png) | `bebb6784a661640cec1976e1a7b192bfb28d8bb372f54176099340f11032ae6e` |
| facing-right | ![Accepted source](../../../fixtures/calibration/TEST_HeadPreparationCalibration-UncleA-FacingRight-MirrorDerived_UIS_v01.png) | ![Review candidate](outputs/larger-grid-96-facing-right.png) | `66601b9e5c37047fa6924ee91ac63833ebd7f2712928c4b43e7915a5261672ac` |
