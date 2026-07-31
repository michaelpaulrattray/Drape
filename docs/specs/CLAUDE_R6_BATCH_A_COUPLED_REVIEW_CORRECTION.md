# Claude correction prompt — R6 Batch A-coupled angle preservation

Do not stage or commit yet. Codex review found one important V14 defect in the otherwise sound Batch A-coupled implementation.

## Finding

The new exhaustive map correctly separates close views from full-body views, but it collapses the close trio to the existing `HEADSHOT` value. In the real iteration prompt, `HEADSHOT` expands to:

> `STRAIGHT-ON HEADSHOT. CLOSE UP FACIAL PORTRAIT.`

Therefore `sideClose` and `threeQuarter` are now explicitly told to become straight-on. The current integration test asserts this shared `HEADSHOT` directive and therefore locks in the defect instead of detecting it.

The body trio has the same, weaker ambiguity: `FULL_BODY` controls crop but does not explicitly preserve front/walk-side/back orientation.

This is inside Batch A-coupled, not Batch C. The plan says **per-angle framing**, and V14 exists because lifting the allowlist must not give any canonical view a wrong framing instruction.

## Required correction

Preserve the good work already completed, but make iteration framing carry both crop and canonical orientation through to the actual image-model prompt.

The actual prompt must distinguish all six views:

- `frontClose`: close portrait; preserve straight-on/front orientation.
- `sideClose`: close portrait; preserve the exact side-profile orientation from the source; never instruct straight-on.
- `threeQuarter`: close portrait; preserve the exact three-quarter orientation from the source; never instruct straight-on or full profile.
- `frontFull`: full body; preserve front-facing orientation.
- `sideFull`: full body; preserve the side/walk orientation and pose represented by the source.
- `backFull`: full body; preserve rear/back-facing orientation; never instruct front-facing.

Use one typed, exhaustive `CanonicalViewAngle` mapping. A future seventh canonical angle must fail compilation/tests rather than silently inherit a default. It is acceptable for the mapping to contain a crop class plus an angle-preservation directive, or for the typed canonical angle to travel alongside the existing crop class. Choose the narrowest design that reaches the real iteration prompt without changing unrelated generation paths.

Do not solve this by asking Gemini to generate a new pose. This remains an edit of the selected source asset: preserve its camera angle, crop class, pose and field of view except where the user's explicit allowed edit necessarily changes them.

## Test corrections

Replace the binary prompt assertions with exact six-angle integration coverage over the real prompt construction.

Prove at minimum:

1. Each canonical angle reaches the correct close/full crop instruction.
2. Each receives its own orientation-preservation instruction.
3. `sideClose` and `threeQuarter` do not receive `STRAIGHT-ON HEADSHOT`.
4. `sideClose` receives no front-facing or three-quarter instruction.
5. `threeQuarter` receives no straight-on or full-profile instruction.
6. `backFull` receives no front-facing instruction.
7. `sideFull` receives no front-facing or rear-facing instruction.
8. The router passes the complete typed framing/orientation value to the real iteration path for every canonical angle.
9. Non-canonical stored view types still fail before generation records, deductions and image calls.
10. The no-allowlist and masked-edit regressions remain green.

Avoid tests that merely prove all close views receive the same `HEADSHOT` token; that is the defect.

## Boundaries and verification

All original Batch A-coupled boundaries remain binding: no Batch C, composer/canon, propagation, masked re-enablement, identity-policy implementation, schema/migration, paid generation, staging, commit, push or deploy.

After correcting it, run:

- the six-angle framing/prompt tests;
- typed-door and masked regressions;
- affected casting/client suites;
- `pnpm check`;
- full `pnpm test`;
- `git diff --check`.

Codex's independent full-suite run reached 1,850 passes with one unrelated `pathB-hardening.test.ts` import timeout; that isolated file immediately passed 22/22 on rerun. Record the final run honestly if the same known timing flake occurs.

Self-review the complete diff and explicitly challenge this correction with concrete prompt/code evidence if you disagree. Otherwise implement it, leave everything unstaged and uncommitted, provide the revised handoff, and stop.
