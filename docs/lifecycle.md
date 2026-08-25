# Lifecycle

Source role and review state are separate concepts.

```text
immutable SourceAsset ── PreparationRun ── CandidateAsset
                                             │
                                             ├─ approve ──── approved
                                             ├─ reject ───── rejected
                                             └─ supersede ── superseded

approved ── supersede ── superseded
```

Candidate state starts as `candidate` and current state is obtained by folding
append-only `ReviewEvent` records. Approval requires a human actor and a passing
validation report reference. Invalid transitions fail closed.

Approval does not register a cartridge, allocate a taxonomy number, or enter
canon. The Workbench has no canon transition.

Source replacement never changes an earlier source or object. It creates a new
`SourceAsset` linked by `supersedesSourceAssetId` and requires the same identity
and direction.
