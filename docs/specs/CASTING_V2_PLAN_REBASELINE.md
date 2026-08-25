# Casting V2 — Plan Rebaseline (M8–M14 against reality)

**Status: AWAITING FOUNDER COUNTERSIGN.** Ordered by the founder (issue #40,
2026-08-25, verbatim): *"we have been focusing on casts/prompting and
refining/editing and signing casts so far we have not moved into voice or
anything i know m12 of the plan we have most already implemented alot of that
maybe the plan needs a revision?"* — written by the Fable seat as a planning
shift, no code. **Until the founder countersigns this document,
`.agents/foreman/PROGRAM.md`'s current-focus mechanism governs unchanged.**
Once countersigned, this ladder supersedes
`CASTING_V2_ARCHITECTURE_PLAN.md` **§K from M8 onward** — and only §K; the
original plan stays untouched as the historical record, and its M0–M7 rows
(plus M2b, M4a) remain the accurate record of what was built and closed.

Every verdict below is cited at code, schema, flag-position rows, or register
rows read this shift (2026-08-25) — never asserted from memory (law 7b).

---

## 1. The name collision, stated once

The plan's ladder and the program's practice both used the name **"M8"** for
different things. The plan's M8 is **Takes** (presentation-only generations off
a signed snapshot, migration 0019). The working sessions reused "M8" for the
**refine arc** — which is largely the plan's **M12** (identity revision) built
early, then expanded far beyond it: repaint (D-241), the reference library,
the ink studio, references, born ink, the framing trim, brief fidelity. The
cleanest proof that the ladder and the product diverged is one file:

> `server/casting/operationContract.ts:36-51` — the operation-kind registry
> holds exactly `castingV2.roll`, `castingV2.sign`, `castingV2.refine`.

The plan's M8/M12 kinds (`castingV2.take`, `castingV2.revision`, §G) were
never written; the kind that carries most of the last month's work
(`castingV2.refine`) appears nowhere in the original ladder. This document
therefore **retires the M-names for all remaining work** (M14 keeps its name
as the terminus everyone knows) and gives the remaining rungs fresh names
(§4), so no future session can inherit the collision.

## 2. The audit — every original milestone M8–M14, plus the three that gate them

Verdicts: **done** · **partial** · **unbuilt** · **superseded** (the product
goal was met by a different build, or the founder's direction moved).

| Original | What the plan said | Verdict | Evidence (read this shift) |
|---|---|---|---|
| **M5b — Klieg public rebrand** (gates old M13 scope→all) | Domain cutover, OAuth redirect, Resend domain, Stripe copy — founder-executed | **partial / HELD** | V2 surfaces carry Klieg branding (`client/src/pages/CastingV2.tsx`, `CastingFoundation.tsx` — the only two client files containing "Klieg"); the public cutover items are founder-credential work with no repo artifact to read, and the standing record (founder queue, 2026-08) holds the rebrand as **held**. Unverified beyond that, and said so. |
| **M7b — Home vision skeleton** | Rebuild Home to `02-home.md`: greeting, unified composer, Quick Start, On the Wire | **unbuilt** | `client/src/pages/Home.tsx` contains none of the skeleton's anatomy (grep for composer/greeting/Quick Start/wire: zero hits); PROGRAM.md's closed list is "M0–M7 (plus M2b, M4a)" — M7b is not in it. The design north star (`docs/specs/Casting-ui-ux-design/`) now owns this surface. |
| **S0 — Security hygiene** (gates old M13 with M5b) | Approval gate on the API + staff image boundary | **done** | `protectedProcedure` = `requireUser` + `requireApproved` since 2026-07-30 (CLAUDE.md, access-control section); guarded by `server/approvalGate.test.ts` and `server/staffImageBoundary.test.ts` — both present and in the suite. |
| **M8 — Takes** (migration 0019) | takeService + identity gate + room Takes grid | **unbuilt** | No `server/castingV2/takeService.ts`; `casting_takes` absent from `drizzle/schema.ts` (grep: 0 hits); no `castingV2.take` operation kind. The design direction exists and is founder-endorsed but is not a build order: `CASTING_TAKES_DESIGN.md`, issue **#18**. |
| **M8b — Voice** (migration 0019b) | VoiceEngine (ElevenLabs), voice design, audition card | **unbuilt** | The `VoiceEngine` interface exists as a stub (`server/providers/types.ts:535` — `designVoice`/`synthesizeAudition`) with **zero implementations and zero callers**; `cast_voices` absent from schema; no ELEVENLABS reference outside that types file. The M3 voice-transport verification the milestone depends on was never run. |
| **M9 — Cohorts beyond photoreal** | Anime + humanlike-fantasy cohort adapters in a `server/castingV2/cohorts/` registry | **unbuilt as specified; direction superseded** | No `cohorts/` directory exists. Non-human briefs meet the `unsupported_cohort` wall (`server/castingV2/briefCompiler.ts:244,950`); the founder's own cyborg brief refuses ~1 in 7 (**#25**), the cohort-wall double check awaits countersign (**#20**), fantastical anatomy goes through `CASTING_OPEN_LANE_SCOPE` instead of a cohort adapter. The successor architecture is named in `CREATIVE_REGISTER_DESIGN.md` §5: *"the creative register is, deliberately, the first seam of the cohort-module architecture the creative-casts program needs anyway."* M9's goal survives; its shape belongs to the register era (**#16**, **#22**). |
| **M10 — Canvas + Wardrobe entries** | CastPicker "Cast new" → V2 session with board origin; wardrobe picker reads signed Casts | **partial** | Server half scaffolded: `CASTING_SESSION_ORIGINS = ["roster","canvas","wardrobe"]` (`drizzle/schema.ts:1952`) and the projection carries `originType` (`server/castingV2/rollProjection.ts:161`). Client half not re-pointed: the boards surface still imports the **legacy** casting feature (`BoardPage.tsx:51` → `@/features/casting/pendingCastRegistry`; `CastNode.tsx:46` → `@/features/casting/components/SlotVersionHistory`), and wardrobe's navigation has no V2 route (grep of `overlayNavigation.ts`: 0 hits). |
| **M11 — Cutover plumbing** | `/studio?tool=casting*` deep-link redirects, mixed-deploy verification, disposal list | **unbuilt** | No `tool=casting` redirect exists anywhere in `server/` or `client/src/App.tsx` (grep: 0 hits). Legacy `/studio` is still a first-class route (`App.tsx:55`, "Classic Drape Studio (fallback)"). |
| **M12 — Identity revision ceremony** (migration 0020) | Focused editor; classify (take\|revision\|fork); affected-view derivation; atomic commit over **package views** post-Sign | **superseded (goal met by a different build); unbuilt as specified** | The product goal — natural-language identity edits including permanent marks — shipped as the **refine arc on pre-Sign candidates**: `server/castingV2/refineService.ts`, `recipeAssembler.ts`, `repaintRender.ts` all present; `CASTING_REPAINT_SCOPE=all` on production (`scripts/lib/productionFlagPositions.mts`); the ink studio, references, transforms and removal documented flag-by-flag in CLAUDE.md. The **post-Sign package-revision ceremony as specified does not exist**: no `castingV2.revision` kind, no intent classifier, no affected-view derivation over package views — and the sign-mint that would make a born tattoo a picture (7b-ii) is *"not designed and not started"* (CLAUDE.md, `CASTING_BORN_INK_SCOPE`). Whether a post-Sign revision product is still wanted is a founder question (§6). |
| **M13 — Cutover & observation** | scope→all gated on M5b + S0; 14-day observation window, legacy frozen; disposal list executed | **partial / overtaken** | The scope IS all: `CASTING_V2_SCOPE: { position: "all" }` (`scripts/lib/productionFlagPositions.mts:90`, verified against the live service by the deploy rite, receipt 2026-08-25T05:14Z, debt register). But it widened by the ratchet, not by the M13 ceremony: no observation-window record exists, legacy was never frozen (still routed, `App.tsx:55`), and the founder-approved dev-era draft disposal never ran. The **approval gate** (S0, done) is what actually bounds public exposure today — every account still needs a beta code and admin approval. |
| **M14 — Repository & infrastructure retirement** | Execute the Retirement Register; Atlas is deletion authority | **unbuilt — correctly** | Legacy client present (`client/src/features/casting/` — 20 entries; `server/routes/generation/castingImaging.ts` present). Issue **#29** holds it, explicitly parked in PROGRAM.md as *"the FINISH LINE, not a task."* Its missing instrument now exists: the Atlas retirement views were blind to re-exports and dynamic imports until `d614320f` (CLAUDE.md, Architecture Atlas section), and the un-wiring differ (`scripts/diff-importer-count-across-time.mts`) can now see path-three deaths. A retirement verdict read before that commit must be re-taken. |

**One sentence of summary for the founder:** of the plan's remaining ladder,
one milestone is done (S0), two are half-done (M10, M13 — each overtaken
rather than abandoned), four were never started (M7b, M8, M8b, M11), and two
were superseded by better-shaped work the ladder never named (M9 by the
register direction, M12 by the refine arc).

## 3. What the register era built that the ladder never named

The month between M7's close and today produced, in rough order of size: the
**refine arc** (repaint/recipe/reference library, `CASTING_REPAINT_SCOPE=all`),
the **ink family** (six flags), the **reading/geometry family** (five flags),
**brief fidelity and born ink**, the **framing trim**, the **two paths**, and
the flag-governance machinery itself (`productionFlagPositions.mts`, the
capability atlas, the deploy rite's conformance arms). The honest census of
its debts is not restated here — it lives, derived rather than remembered, in:

- `CASTING_V2_ROLLOUT_DEBT_REGISTER.md` — the 32 governed flags: 6 at `all`,
  21 at `users:1`, 5 at `off`, each with a recommendation;
- `CASTING_V2_SWEEP2_WORK_ITEM_LIST.md` — the sixteen unflagged work items
  (#16–#31) the flag census could not see;
- the GitHub queue, which is the system of record for all of it.

The rebaselined ladder below absorbs these by reference, not by copying —
a second list shadowing the queue would drift from it (working law 4).

## 4. The remaining ladder — rungs N1–N8 (v2: N3 expanded and N4 Takes added on the founder's pre-sign review)

Fresh names (N for "new ladder"), because both "M" and "R" are taken by
history. Small, independently reviewable, in the original plan's style: each
rung states scope, gate, rollback. **THE MILESTONE GATE applies at every
boundary** — completing a rung never authorizes the next; each close runs the
milestone-close review, ships a completion card with a test-drive list, and
the focus clears until the founder's word.

**N1 — The creative register** *(CONFIRMED current focus — founder's word,
Desk, 2026-08-25 19:17)*. Per `CREATIVE_REGISTER_DESIGN.md` §5: the court
(§3, a **spending court — its price goes on a Desk card and waits for his
word before any paid arm fires**) → the register built dark behind
`CASTING_CREATIVE_REGISTER_SCOPE` (`users:1`, parent `CASTING_V2_SCOPE`) →
a flagged roll of his cyborg brief → his eye on both bars (conviction +
spread). Rides with it, same population: **#25** (his brief refused ~1 in 7)
and **#20** (the cohort wall's double check, court already run, awaiting
countersign) — the same wall from two directions. Gate: his eye. Rollback:
scope off = byte-identical product (the design's own constraint).

**N2 — The ratchet clears** *(the flags go home)*. Work the debt register's
own recommendations to a terminal state per flag: the three that widen on a
word alone (`CASTING_SCAN_TABLE_SCOPE` #1, `CASTING_SIDE_PHRASING_SCOPE`,
`CASTING_REFINE_DISPATCH_SCOPE`) batched onto one Desk card; **court E1**
(#4) to unblock `CASTING_BRIEF_FIDELITY_SCOPE`; the framing-trim rolls (#11 —
rolls, not a build); the ink-cut preview 3a.2(b) (#10) and the region-crop
founder sitting; 7a-bis's number (#19); the face-scan cost model (**#38**,
already a standing exception) feeding `CASTING_FACE_SCAN_SCOPE`'s READ; and
the **two-paths retire-or-fold question** put to the founder (§6). Gate:
every `users:1` flag either widened, retired, or holding on a **named,
owned** blocker — the register re-read says so. Rollback: per-flag, minutes.

**N3 — The refine era completes: the feature panel + studio surfaces**
*(amended on the founder's pre-sign review, 2026-08-25, verbatim: "the
refine era still isnt over e.g we have the auto analyzing all features on a
cast cropping them creating bounding boxes and putting them in the feature
panel so they become editable the pinterest style selector on references, we
settings modal for casts")*: the feature-panel arc — the auto-scan prefill,
the panel's absent state, open-kind properties, and removal universality
(**#23**, the four designs the first draft had shelved) — plus the
Pinterest-style reference selector (**#14**, countersigned) and the settings
modal (**#15**, six founder rulings), against the design north star and the
placeholder law (PROGRAM.md). Gate: evidence pack (both themes) + copy audit
before his eyes, per the UI milestone contract. Rollback: routes/flags off.

**N4 — Takes** *(scheduled by the founder's word on the same review: "takes
actually has a solid use case that i designed with another agent" —
`CASTING_TAKES_DESIGN.md`, #18)*: built per its design, dark behind its
flag; the design's own founder gates on PRICING stand. ⚠ **Two excavated
preconditions bind this rung (2026-08-25, on #18)**: **D-117's ablation gate
runs BEFORE any conditioning default is wired** — the design's
composite-plate default is exactly the kind of default D-117 forbids choosing
by intuition — with D-118's single selector authority riding it; and the
**digitals-bank joint decision** (roadmap §8b, filed by the founder "so the
M8 designer inherits the connection") is owed at this rung's design review.
Placed before the cutover arc, as the original plan intended for M8. Gate:
D-117's gate verdict + pricing rulings + his eye on the shipped surface.
Rollback: flag off.

**N5 — Entries converge** *(original M10 finished)*: canvas Cast-new and the
wardrobe picker re-pointed at V2 sessions/casts; the boards surface stops
importing `@/features/casting/*`. This is the last *product* prerequisite of
retirement — legacy stops receiving new sessions from any door. Gate:
founder drives canvas→cast→sign→board landing. Rollback: picker routes back.

**N6 — Cutover plumbing** *(original M11)*: `/studio?tool=casting*`
redirects, mixed-deploy verification, the founder-approved disposal list for
dev-era drafts (list only — execution is N7). Gate: founder approves the
list. Rollback: redirects off.

**N7 — Observation done right** *(original M13's unfinished half)*: legacy
frozen (routes redirect, code untouched), the disposal list executed through
`executeFinalCastDeletion`, and a **14-day observation window** on V2-only
use. Note what this is NOT: scope widening — `CASTING_V2_SCOPE` is already
`all`. It is the deliberate freeze-and-watch the ceremony always meant.
Gate: window closes on production evidence + founder sign-off — **the point
of no return that authorizes N8.** Rollback: unfreeze legacy any time inside
the window.

**N8 — Retirement (keeps the name M14)** *(#29)*: execute the Retirement
Register per §L.R with the Atlas as deletion authority — noting the Atlas's
edge graph is only trustworthy for this purpose since `d614320f`, and the
un-wiring differ runs over the retirement window before the sitting closes
(the path-three-death sweep, CLAUDE.md law 7). Gate: founder reviews the
Register diff + the post-deletion Atlas. Rollback: git revert of pure
removals.

**The unscheduled shelf** (explicitly not on the ladder; each enters only by
the founder naming it as a focus — as Takes and #23 just did, on his
pre-sign review): Voice (old M8b — see §6), the Film Engine (#17),
creative-casts research (#22, gated on N1's own Phase-A sheet), any-feature
discovery (#30, gated per §5c), born-ink discovery (#31, coupled to the
`NOTES_MAX` census re-read), the two unacted evaluations (#24), the R7
evidence family (#6, parked by ruling), and the post-program backlog from
the original plan (pre-made roster, reference-shaped casting,
upload-a-person). Engineering
health (#7, #8, #26, #27, #28, toolbelt #32–35) rides the patrol clocks as
maintenance, not the ladder.

## 5. Founder gates, enumerated

N1: court price card before spend; his eye on both bars (the milestone
gate). N2: the widening words; the two-paths ruling; E1's verdict read.
N3: evidence pack + copy audit. N4: the Takes pricing rulings + his eye.
N5: canvas drive. N6: disposal-list approval. N7: observation sign-off —
point of no return. N8: Register diff + post-deletion Atlas. Plus, standing: every rung boundary clears the focus
and waits for his word (THE MILESTONE GATE, PROGRAM.md).

## 6. What this rebaseline does NOT decide — founder questions on the record

1. **Takes and Voice: before or after retirement?** ⚠ **HALF-ANSWERED on the
   founder's pre-sign review (2026-08-25): Takes is SCHEDULED — his verbatim
   "takes actually has a solid use case that i designed with another agent"
   — now rung N4.** Voice remains the open half: transport never verified,
   nothing depends on it; recommendation unchanged (**after** — the shelf,
   entered by his word). His call.
2. **Is a post-Sign revision product still wanted** (the real M12), now that
   the refine arc serves identity edits pre-Sign? The sign-mint (7b-ii) is
   the first concrete piece if yes. Recommendation: fold into the shelf until
   a customer need names it.
3. **Two paths: retire or fold** (`CASTING_TWO_PATHS_SCOPE`) — the debt
   register's own finding 3: if every cast is born on a register selected
   from the brief, a user-facing Wardrobe/Basics toggle is a second control
   over the same axis. Not a seat's decision.
4. **M5b's remaining public-rebrand items** — founder-credential work; the
   record holds it as held. It stops gating anything in this ladder (the old
   M13 gate it served is overtaken), but it still gates the *brand* under
   which launch marketing happens.

---

*Written by the Foreman's Fable seat, shift foreman-2, 2026-08-25, under
issue #40. Supersedes `CASTING_V2_ARCHITECTURE_PLAN.md` §K from M8 onward
upon countersign; until then it governs nothing.*
