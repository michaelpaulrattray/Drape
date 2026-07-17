# R6 W5-A calibration report

**Date:** 2026-07-18
**Target:** local Drape app on `http://localhost:3011`, development database, `verify-bot-local` only
**Production:** not contacted
**Code under test:** uncommitted W5-A diff on `9799dbe`

## Founder contract clarified during calibration

The first matrix treated every post-headshot change as a same-person edit. The
founder corrected that assumption after leg 3 exposed the difference between
the two product operations:

- **LLM, reference-assisted, and surgical iteration** modify the accepted
  person. They must preserve every protected identity dimension except the
  explicitly authorized delta and therefore use the strict post-generation
  identity gate.
- **Casting-panel changes and explicit Recast model actions** cast a new draft
  identity from the selected settings. They may change the person and must not
  be compared with the old anchor. They still require free validation, exact
  document computation, tracked upload, an atomic document/anchor/revision/
  stale/board commit, honest credits/refunds, audit metadata, and UI copy that
  says the person may look different.

This ruling supersedes the earlier structured-door stop and recommendation to
route panel recasts through the anchored iteration generator.

## Results so far

| Leg | Result | Evidence |
|---|---|---|
| 1. Same-person free-text hair color after another model's variation | **PASS** | Original dark-skinned South Asian male remained the same person; only jet-black hair became hot pink. Gate passed attempt 1. Exact charge: 350. |
| 2. Same-person hair length | **PASS** | `Very Long` passed attempt 1 after the reviewed hair-geometry dependency ruling. Protected face, skin, ethnicity, color, texture, and hairline remained unchanged. Exact charge: 350. |
| 3. Structured skin-tone recast | **PASS** | One NEW-mode candidate; exact `Tan / Bronze` durable preference; new revision; board image + version advanced once; audit `100` records `structured_recast`; exact charge 350. Visual is valid and uncorrupted; old-person similarity was correctly not assessed. |
| 4. Structured face-field recast | **PASS** | One NEW-mode candidate; exact `Strong / Pronounced` jawline preference; new revision; board image + version advanced once; audit `101` records `structured_recast`; exact charge 350. |
| 5. Forced protected drift on same-person hair-color iteration | **PASS / REFUSED** | Two injected checked failures, HTTP 412, zero net credits, anchor remained `545`, audit `103`. |
| 6. Forced protected drift on same-person jawline iteration | **PASS / REFUSED** | Two injected checked failures, HTTP 412, zero net credits, anchor remained `545`, audit `104`. |
| 7. Verifier unavailable | **PASS / REFUSED** | Fail-closed HTTP 412 with retryable copy, zero net credits, anchor remained `545`, audit `105`. |
| 8. First candidate fail, isolated retry pass | **PASS** | Attempt 1 injected failure; attempt 2 independently verified every observable protected field unchanged; one new anchor (`545` → `546`); exact charge 350; audit `106`. |

## Leg 1 — founder reproduction closed

Fixture model: local model `167`, original anchor asset `539`, passing pink-hair
anchor `541`.

The drive first created a real variation from the canvas node, then returned to
the original model for the hair-color iteration. This exercised the former
cross-model chat-bleed sequence. The gate reported all expected-observable
protected dimensions unchanged; `person.build` was honestly not observable in
the headshot. Human grading confirms the same face, skin, ethnicity, age, and
build presentation with only the requested hot-pink hair change.

Evidence:

- `%TEMP%\drape-w5-identity-evidence\legitimate-original-baseline.png`
- `%TEMP%\drape-w5-identity-evidence\legitimate-leg1-hair-color.png`

## Leg 2 — bounded hair-geometry dependency proven

Fixture model: local model `167`; pre-edit pink short-hair anchor asset `541`;
passing Very Long anchor created by audit generation `98`.

The static non-transitive dependency map permits only reviewed physical
consequences of an explicit hair-length or hairstyle edit. Length released
style, fringe, parting, volume, fade, flyaways, and tuck. Hair color, texture,
hairline, face, skin, demographics, marks, and overall identity remained fully
protected. The accepted anchor became authority for released leaves; no
LLM-invented values entered the identity document. Audit and provenance record
the released list. Human grading confirms the same person with the same pink
hair color, face, skin, and hairline, now with Very Long hair.

Evidence:

- `%TEMP%\drape-w5-identity-evidence\legitimate-baseline.png`
- `%TEMP%\drape-w5-identity-evidence\legitimate-leg2-hair-length.png`

## Historical leg 3 — useful safety evidence, wrong product contract

The earlier structured skin-tone run produced two NEW-mode portraits which
changed the individual. The then-current code compared both to the old person,
refused them, uploaded nothing, committed nothing, and refunded 350 exactly.
Audit generation `99` records both verdicts.

That run proved fail-closed mechanics, but it is not a valid acceptance test
for structured recast. Changing the individual is permitted there. The corrected
implementation bypasses the same-person verifier, labels the audit operation
`structured_recast`, generates one candidate, and retains the existing atomic
commit and tracked-upload cleanup guarantees.

## Legs 3–4 — structured recast contract proven

The corrected build generated exactly one candidate for each structured panel
change and never called the same-person verifier. Both operations passed all
automated persistence assertions: exact selected value in model preferences,
new non-reused identity revision, accepted image landed on the originating
board node, one immutable board version appended, 350 credits charged, and a
completed generation audit with `operationMode: "structured_recast"`.

Human inspection found both accepted images valid and uncorrupted. They are
not graded against the old face because changing the person is permitted by
the recast contract.

Evidence:

- `%TEMP%\drape-w5-identity-evidence\legitimate-leg3-skin-tone.png`
- `%TEMP%\drape-w5-identity-evidence\legitimate-leg4-jawline.png`
- `%TEMP%\drape-w5-identity-evidence\legitimate-report.json`

## Legs 5–8 — same-person safety and retry contract proven

Forced-failure legs 5 and 6 each generated two candidates, refused both with
the named identity-preservation copy, refunded the full 350, and left anchor
`545` unchanged. The unavailable leg failed closed with its retryable message,
also zero-net and anchor-unchanged.

The retry leg rejected attempt 1, cleared that model's session, regenerated
from the original accepted source, then passed a complete strict verdict on
attempt 2. It uploaded and committed one image, moved the anchor from `545` to
`546`, and charged exactly 350. Human grading confirms the retry image is the
same person with the requested copper hair color and no obvious corruption.

Evidence:

- `%TEMP%\drape-w5-identity-evidence\forced-fail-report.json`
- `%TEMP%\drape-w5-identity-evidence\unavailable-report.json`
- `%TEMP%\drape-w5-identity-evidence\retry-report.json`
- `%TEMP%\drape-w5-identity-evidence\retry-retry.png`

## Hair dependency and verifier reliability corrections

An earlier legitimate Very Long attempt was rejected because secondary hair
geometry changed. The founder-approved static dependency release resolved this
without weakening face, skin, demographics, marks, hair color, texture, or
hairline protection.

The verifier also once returned incomplete JSON and timed out during recheck.
It now uses a closed response schema matching the strict local parser, a 4096
token allowance, and a 30-second timeout. This improves reliability only; it
does not weaken a protected dimension or change fail-closed behavior.

The wording `Change only his hair length to very long, reaching below the
shoulders` was separately refused as `hair_length_vague` even though it contains
a supported band. That language-quality edge remains distinct from the visual
gate and should be handled in the broader R7 conversational UX.

## Final W5-A calibration verdict

**PASS.** Same-person iterations are protected and fail closed; structured
panel changes are explicitly and truthfully recasts; credit, persistence,
upload, retry, and audit behavior match the revised execution plan. W5-A is
ready for the required Fable review gate.

## Verification gates

- `pnpm check`: clean.
- Focused W5-A suites: 145/145 passed during implementation; the final focused
  rerun passed 89/89 after the last corrections.
- Full unit suite: 123 files passed, 6 documented environment-dependent files
  skipped; 2,303 tests passed, 50 skipped, zero failures.
- All eight corrected calibration legs completed against the local app and
  development database only. Production was not contacted.

The bounded Fable review found one cleanup gap after calibration: a structured
recast creates its model-scoped NEW-mode chat session before upload, so an
upload failure previously had no storage key and skipped session clearing.
The failure boundary now always clears that model session independently of
object cleanup. A regression test proves the upload-failure path refunds,
does not attempt object deletion without a key, and clears exactly the affected
user/model session.

## Spend and retained local data

Net paid spend across calibration was 2,800 local-development credits: the
original fixture/cross-model reproduction and accepted iteration legs (1,400),
two accepted structured recasts (700), one invalid harness run that accidentally
ran as a normal accepted iteration before the hook-launch error was corrected
(350), and the accepted isolated retry (350). Every actual refused leg moved
zero net credits. The invalid harness run is not counted as a matrix result.
Clearly labelled local calibration data remains for review.
