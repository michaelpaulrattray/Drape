# R6 live founder-walk investigation and final-corrections plan

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


You are reviewing the results of the founder's complete live-production R6 Casting walk. A small creation-payload hotfix has already been deployed and the founder then exercised the full draft, view, stale, refresh, mint, fork, reference, export, version, pin, deletion and background-generation flows.

This turn is **read-only investigation and planning**. Do not edit source files, create implementation documents, stage, commit, push, deploy, change Railway, run migrations, contact production, create data or spend credits. Inspect the current code, tests, decision records and Git state, then stop with an evidence-backed correction plan for founder/Codex review.

Do not simply agree with the observations below. Reproduce each claim from code where possible, identify any mistaken interpretation, challenge any proposed R6/R7 classification you disagree with, and explain the reasoning in plain English. Also inspect adjacent paths for consequential holes that the founder and Codex may have missed.

## Live evidence supplied by the founder

### Creation and draft placement

- New-cast creation works after the deployed `referenceImage` payload hotfix.
- If a headshot is generated and the founder exits or presses Escape before explicitly landing/minting the draft, the originating canvas Cast node remains blank. The model exists in the Draft library and must be selected manually later.
- If Casting Studio is closed immediately after starting generation, the board shows no useful node progress. A later success toast appears, but the completed model still does not populate the originating node.

Investigate the complete close/background-generation/node-landing contract, including `CastingTakeover`, the generation stores, host callbacks, board cache updates and the explicit D-55 decisions. Determine what is current intentional behavior, what is misleading, and what must change before R6 closes. Do not assume that text saying “nothing will land” makes a poor or internally inconsistent lifecycle acceptable.

### Stale views and refresh

- A headshot identity change correctly dims sibling views and gives them stale dots.
- There is no clear persistent success message telling the user how many views became stale or what to do next.
- Stale views can be refreshed only from the canvas Cast node, not inside Casting Studio.
- The Studio mint dialog refuses stale views and tells the user to refresh them, but contains no refresh action. This is especially problematic for a library-only or unlanded draft.
- Canvas stale count matched the actionable refresh rows. Refresh showed 300 credits per view, completed, removed the dots/dimming and unblocked minting.
- If the founder refreshes on the canvas and immediately reopens Studio, Studio does not show that the refresh is still generating or reloading.

Verify whether this is a genuine dead-end/recoverability violation against the R6 execution plan, revised addendum, D-55/D-56 and the “six-view iterate/mint/stale/refresh loop has no silent or dead-end state” closure condition. Trace query invalidation, package-state cadence and in-flight state across canvas and takeover boundaries.

Recommend the smallest coherent R6 correction. It should not merely rewrite the modal copy to point at a remote surface if Studio itself blocks progress. Consider whether the existing refresh plan, cost display, progress and result components can be shared rather than duplicated.

### Canonical-view fidelity and mark migration

After a hair-identity change and refresh:

- the refreshed Side view became closer to a three-quarter view;
- the Three-quarter view faced the opposite direction from Side, despite the canonical prompts reportedly specifying a direction;
- a small upper-chest sun tattoo appeared on the rear shoulder/back view.

Inspect the generation prompts, refresh path, provenance/reference inputs and all post-generation gates. Confirm whether Side and Three-quarter are instructed consistently, whether any gate actually verifies canonical framing/direction, and whether the back/walk identity gate can detect anatomical mark migration rather than merely “some matching mark exists.”

Separate:

1. an R6 slot-truth problem where an image stored as `sideClose`/`threeQuarter` does not satisfy that angle;
2. the known R7 structured-mark/evidence-composer problem where a chest mark migrates to the back;
3. any current UI promise that overstates tattoo propagation fidelity and must be corrected now.

Do not claim that the R7 composer automatically solves canonical angle validation unless the designed architecture actually does so.

### Open/Auto fields and identity-document truth

- The model was initially created through the LLM brief parser.
- On reopening, generated views survived, but several form categories appeared unselected or `Open`, including skin tone and iris colour.
- The generated master description and exported PDF nevertheless contained concrete values such as golden-olive skin and deep-brown eyes.
- The reopened form can look incomplete or require fields again even though the draft was previously valid and generated successfully.

Trace the full distinction between:

- explicit user selections;
- parser-extracted values;
- explicit engine-choice/Open flags;
- values invented/resolved by initial master-prompt generation;
- persisted `models.preferences`;
- `technicalSchema`;
- the form state reconstructed by draft resume/session hydration.

Determine whether engine-choice flags are lost, whether the UI incorrectly treats an established identity as an incomplete creation form, and which values may be displayed without reintroducing the forbidden automatic reconcile behavior. Do not solve this by silently treating an inferred image observation as founder-authorized identity metadata.

### Names, model identifiers and repeated canvas placements

- A draft nickname survives on the canvas node but is not clearly visible in Studio.
- The mint dialog asks for a new name instead of prefilling the stored draft name.
- The export dialog asks for a name again on an already-minted model.
- The Studio profile displayed `MOD-93` before and after minting.
- Code inspection suggests `MasterPromptPanel.tsx` renders `MOD-{headAsset.id}`, which is neither the draft model ID nor the minted agency ID.
- The exported PDF carries the actual minted agency ID `MOD-26-3AED5E`.
- Two canvas placements referenced the same underlying draft. Minting through one correctly sealed the shared model—the other placement then required a fork for identity edits—but only one placement visibly lost its Draft badge.

Verify all of this against the server lifecycle authority and client caches.

The expected product distinction to assess is:

- one model may legitimately have many canvas placements;
- those placements are references, not independently mintable clones;
- minting or renaming the shared model must update every placement consistently;
- drafts must not display a fabricated `MOD-*` agency identity;
- minted models must display the real stable `agencyId`;
- stored display name should be the default in Studio, mint and export;
- export must not casually issue the same agency identity under an arbitrary transient name unless that is an explicit, persisted FR-3(B) rename operation.

Identify every cache or optimistic-update site that currently updates only the initiating node.

### Fork behavior

- Minted identity edits correctly require a fork.
- The original remained unchanged and the fork became a different editable draft.
- The functional authority behavior passed, but the founder considers the fork modal and transition confusing and poor for a first-time user.

Distinguish functional R6 defects from the already-planned R7 Cast Profile/fork-first redesign. Identify any copy or routing defect that is misleading enough to fix now, but do not expand a final R6 correction into the full R7 viewer redesign.

### Reference slot

- Reference-assisted rules behaved correctly in the live walk.
- The founder wants drag-and-drop replacement directly onto an occupied reference slot instead of manually removing the old image first.

Confirm whether this is a safe isolated polish item or belongs in the later UI pass. Do not treat it as a release blocker without evidence.

### Export, credits and generated artifacts

The live exported file is available at:

`C:\Users\Admin\Downloads\CASTING_PACK_CHELSEAA_2K.zip`

Inspect it read-only, including the PDF and image dimensions. Codex's preliminary inspection found:

- all six canonical image files exist with sensible canonical filenames;
- each exported PNG is 1792×2400;
- the ZIP contains a seven-page PDF;
- the PDF visually renders cleanly;
- the PDF uses agency ID `MOD-26-3AED5E`, while Studio showed `MOD-93`;
- the PDF name `CHELSEAA` came from the export-time field rather than necessarily from the persisted model name;
- the PDF leaves known structured facts blank, including gender and hair length, despite Female and the Very Long identity update existing elsewhere;
- the PDF contains concrete engine-resolved values that the reopened form still presents as Open.

The founder also observed:

- export always asked for a name even though the model was already named and minted;
- export looked like it was generating another character;
- selecting export caused six additional 2K upscale operations and a substantial credit charge;
- the dialog said all exports are 2K but did not clearly show the six-operation total cost or offer an informed 1K versus paid-2K choice.

Audit `ExportModal`, `useCastingExport`, export eligibility, upscale pricing/planning, PDF image inputs and `generatePdf`.

Explicitly determine:

1. whether every paid upscale cost is shown before execution, as D-15 requires;
2. whether 1K export can be a no-upscale path and 2K an explicit paid option with a server-derived total;
3. whether retries/double clicks can duplicate charges;
4. whether partial upscale failure can charge for some views while silently exporting originals, and how that truth is reported;
5. whether the PDF uses the upscaled images or the original asset URLs;
6. whether the ZIP's `_2K` filename is truthful for every selected path;
7. whether the export name is authoritative, persisted display metadata or merely transient text;
8. why the PDF derives preferences only from `technicalSchema`, and which known values should fall back to authoritative stored preferences;
9. whether the resulting PDF/ZIP can claim a complete identity dossier when its structured fields disagree or are missing.

Treat undisclosed multi-operation credit spending and identity-document mismatches as potential release blockers, not cosmetic polish.

### Version history, pinning and repeated-edit degradation

- The founder could find usable per-slot history mainly on the canvas, not a clear restoration workflow inside Studio.
- An on-screen message said “Drag the history slider,” even though Casting's old slider/undo system appears to have been retired.
- Per-view versions legitimately differ (for example Back v3 while other views are v2), but the UI does not explain this well.
- Pinning feels unnecessary to the founder. A pinned headshot was automatically replaced/unpinned when edited.
- After three or four serial headshot edits, image quality and identity degraded substantially.

Confirm:

- which version/history surfaces are currently implemented versus stale copy;
- whether any R6 restore/recovery invariant is inaccessible to an unplaced/library-only draft;
- whether pin deletion is already a named R7/Batch-D decision and what current behaviors still depend on it;
- whether repeated iteration edits the latest generated pixels again, causing generation-on-generation drift;
- which issues require the R7 canonical plate/composer and which are simple R6 truthfulness fixes.

Do not redesign the complete history/canon system in the R6 plan.

### Deletion semantics

- Deleting a canvas node removes only that placement and does not delete the library draft.
- The Draft library owns model deletion.
- Models may also be created from the lobby without any canvas placement.
- Unrelated models and nodes remained untouched.

Confirm this is correct entity-versus-placement behavior. Identify only misleading labels or actual lifecycle defects; do not conflate node deletion with model deletion.

### Error and clarification UX

- Server refusal wording was generally understandable and charging behavior appeared correct.
- The founder considers generic red-error toasts and passive paragraphs insufficiently integrated with the Studio.
- Vague hair length/age and similar resolvable questions should eventually use inline clarification with preset pills and/or typed answers.

Classify this as current correctness versus R7 interaction design. Check whether any refusal lacks a next step, falsely claims a charge/refund outcome, exposes internals, or contradicts current capability; those remain R6 issues even if the full interactive redesign is R7.

## Required broader audit

After checking the reported findings, perform a bounded adjacent-contract sweep for anything consequential that the founder walk exposed:

1. Lifecycle truth across draft → stays-draft → mint → duplicate placements → fork → archive/delete.
2. Name and ID truth across Canvas, Studio profile, library, mint dialog, export dialog, PDF and ZIP filenames.
3. Credit truth across plan, generation, refresh, upscale, partial failure, retry, refund and export completion.
4. Package truth across six canonical slots, refresh-in-progress, stale counts, versions, pins and mint integrity.
5. Identity-document truth across form preferences, Open flags, master prompt, technical schema, PDF and downstream composer payload.
6. Cross-surface cache invalidation when the same model has multiple placements or a background operation completes while Studio is closed/reopened.

Keep the sweep bounded to the contracts implicated by these live findings. Do not reopen unrelated Wardrobe, billing, auth or canvas architecture.

## R6 versus R7 classification guardrail

Use the current ratified documents and live code as evidence, especially:

- `docs/specs/CASTING_SYSTEM_R6_EXECUTION_PLAN.md`
- `docs/specs/CASTING_SYSTEM_AUDIT_ADDENDUM_REVISED.md`
- `docs/specs/IDENTITY_EDIT_INTERIM_POLICY.md`
- `docs/specs/DECISION_LOG.md`

Preliminary founder/Codex direction, which you must verify rather than blindly accept:

### Likely must close before R6 can be declared finished

- undisclosed or insufficiently confirmed six-view upscale spending;
- fake/wrong displayed model identifier;
- inconsistent name authority across Studio/mint/export;
- missing Studio stale-refresh/recovery route and missing stale-success guidance;
- lost or misleading Open/engine-choice restoration;
- stale Draft badges/status across duplicate placements;
- blank originating node/background-generation completion not landing coherently;
- canonical slot images that do not satisfy their stored angle/direction;
- obsolete history-slider/undo claims;
- PDF fields that omit known authoritative values or disagree with the model.

### Likely R7 architecture or redesign

- persistent anatomical mark evidence/composer and tattoo propagation;
- resistance to serial generative degradation through canonical plates;
- full Cast Profile for minted models;
- fork-first viewer redesign;
- comprehensive in-Studio version timeline/canon checkout;
- pin deletion/replacement;
- interactive clarification-pill system;
- reference-slot replacement polish;
- broader identity editing from non-headshot anatomical views.

If a likely-R7 issue currently causes false advertising, incorrect charging, data corruption or an unrecoverable R6 state, identify the smallest R6 containment needed now.

## Deliverable

Return one plain-English report and stop. Include:

1. **Executive verdict:** whether R6 can close now and the exact blockers.
2. **Finding table:** each live observation, confirmed/not confirmed/partially confirmed, severity, R6 or R7, code evidence and recommended correction.
3. **Additional findings:** only genuinely consequential adjacent holes, with evidence.
4. **Founder rulings required:** decisions that cannot be inferred safely.
5. **Bounded implementation batches:** the smallest sensible order, with files/surfaces likely touched and why. Keep financial/identity truth separate from large UI redesign where practical.
6. **Test plan:** focused unit/contract tests, browser-drive legs and the minimum paid live re-test after deployment. Include balance-before/after assertions for every charged or refused operation.
7. **Risk notes:** migrations, data compatibility, cache races, double-charge possibilities or deployment sequencing.
8. **Disagreements/challenges:** explicitly state anything in this prompt you believe is wrong or over-scoped.

Do not write code or documents in this turn. Do not stage, commit, push or deploy. Preserve every existing untracked local-only file. Stop after the report so the founder can send it to Codex for review before implementation begins.
