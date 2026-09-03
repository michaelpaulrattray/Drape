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


> **Amendment 2026-08-26 (founder, verbatim: "do it - add the minimal settings modal to N1"):** the settings modal's MINIMAL first version — style selector (photoreal only) + imagination slider — moves from N3 into N1 as the creative register's last slice before its milestone gate. The FULL modal (advanced framing/lighting/background settings, the other art styles) stays in N3. Context: the Prompt Author ruling (`PROMPT_AUTHOR_RULING_2026-08-26.md`) made the modal the author road's control surface.

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
| **M8b — Voice** (migration 0019b) | VoiceEngine (TWO engines, split by voice kind — see the 2026-09-03 amendment in §6), voice design, audition card | **unbuilt** | The `VoiceEngine` interface exists as a stub (`server/providers/types.ts:535` — `designVoice`/`synthesizeAudition`) with **zero implementations and zero callers**; `cast_voices` absent from schema; no ELEVENLABS reference outside that types file. The M3 voice-transport verification the milestone depends on was never run. |
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

> ✅ **COUNTERSIGNED — THE GOVERNING LADDER.** The founder signed on the Desk,
> 2026-08-25 21:38, his word: *"signed"* — after his own pre-sign review
> amended it (v2) and the excavation hardened it (v3/v4). N1–N8 governs;
> PROGRAM.md points here; the original plan's §K ladder is historical.

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
placeholder law (PROGRAM.md). Joined on the founder's Lost&Found verdicts
(2026-08-25): **the honest loader** (#55 — real stage names, no invented
percentages ever, the D-169 mock to his eyes before build), **outfit-card
thumbnails** (#61, same cutter machinery), and the **words-only-sale honest
sentence** (#65(1), his ruling: "honest sentence"). Gate: evidence pack
(both themes) + copy audit before his eyes, per the UI milestone contract.
Rollback: routes/flags off.

⚠ **AMENDMENT 2026-08-30 — THE LOOKALIKE READER (#246) IS FIXED AT THIS RUNG,
BY THE FOUNDER'S OWN WORD.** He ruled it twice in one sitting, on both of the
#246 eye items, verbatim and identically: *"You are correct - add a note to N3
in the plan so we can fix this at that milestone as it contains of the image
analyzing and bounding box tech and design."* This is that note.

**The finding**, measured over three sittings on three words (`tusks`, `hair`,
`eyebrows`) and looked at in the frames rather than inferred: asked where a
feature is on a picture that does not contain it, the region reader does not
answer empty — it outlines the nearest lookalike, stably, and **at a pixel
count that BEATS the real feature when the feature is genuinely there** (absent
`eyebrows` 6,714 px against real brows at 3,878 and 6,084). It fails UPWARD,
which is the direction that gets written down as a finding rather than
distrusted as a null.

**Where it lands**, derived at the code and re-derivable on demand
(`docs/specs/ABSENT_IS_ANSWER_CALLSITE_CENSUS.md`,
`scripts/_shift114-absent-callsites-disposable.mts`): **28 production call
sites in 10 modules; 16 of them, in 5 modules, live on production.** Two belong
to THIS rung and are the reason he placed the fix here:

- **`faceScan.ts` — `CASTING_FACE_SCAN_SCOPE = all`, EVERY ACCOUNT, and the
  floor is ZERO for every anatomical word.** `detectionFloorFor` returns 0 for
  any question the born-worn catalogue does not name, and states its premise
  outright: *"Anatomy — eyes, ears, hair — has no accessory court and needs
  none … any pixels at all are the region answering."* That premise is exactly
  what the three sittings disproved. The panel asks **12 questions** and
  `hair`, `eyebrows` and `horns` are three of them — the first two are measured,
  and the third is the floating rectangle he reported himself.
- **`carriedGeometry.ts` — ungated, and no floor at all.** It is the repair for
  that same floating-rectangle complaint, and a substitution reproduces the
  defect with fresh geometry that looks trustworthy.

**Why it is a panel problem and not only a reader problem.** The panel's boxes
are tap targets: `faceScan` → box → `scannedFaceData` → `faceRows` →
`<FaceRegions onAsk={askRefine}>`, the paid refine. `FaceRegions`' own docblock
already states the promise the substitution breaks — *"a rectangle over the
wrong pixels is a promise that clicking there edits that thing."* So the
bounding-box work this rung owns cannot be designed as though the reader's
answer were trustworthy about ABSENCE; the absent case is a first-class state
of the panel, not an error path.

⚠ **ONE PLACE IS NOT COVERED BY THIS RUNG AND MUST NOT BE FORGOTTEN BEHIND IT.**
`refineService.ts:8611` is the DEPARTURE GATE — it decides the **refund** on a
paid removal — and it reads the same reader with `departureFloorFor`, measured
for glasses and earrings and **zero for everything else**. A substitution there
means a render that correctly removed the thing is declared a failure: money
conserved, the customer's correct picture discarded. It is a money-path fix on
the refine road, not a panel fix, and this amendment records it here only so
that closing N3 is never read as closing #246. Nine of the panel's twelve words
are still unmeasured.

**Not repaired now, by his word.** #246 stays open and carries the census.

⚠ **AMENDMENT 2026-09-03 — THE READER ALREADY ANSWERS "IS IT THERE"; WE ASK FOR
THE ANSWER AND THROW IT AWAY.** Filed on the founder's question at this rung —
*"are we using the best possible models for this?"* — and the answer measured at
the code rather than reasoned about: **the model is right and its use is not.**

**SAM 3 (`fal-ai/sam-3/image`) ships a separate PRESENCE HEAD**, built to
decouple *recognition* from *localisation* precisely so a named concept that is
absent can be reported absent rather than located anyway. It is the published
reason SAM 3 beats OWLv2 on open-vocabulary concepts, and the documented
weakness of its main rival, Grounding DINO, is exactly the failure the #246
amendment above measured on our own frames. **So the segmenter is not the
defect. Swapping it would carry the defect across.**

**What the code does** (`server/castingV2/falRegionReader.ts:540`): the request
sends `include_scores: true` — **we ask for the scores** — and the handler then
reads `json.masks`, maps them to URLs, and returns the mask. ⚠ **No score is
read anywhere in the module.** A grep for `.score` / `confidence` over
`falRegionReader.ts` returns only prose in docblocks.

**And the floor beneath it is zero for exactly the words that fail.**
`detectionFloorFor` returns 0 for any anatomical question, on its own stated
premise: *"Anatomy — eyes, ears, hair — has no accessory court and needs none …
any pixels at all are the region answering."* That premise is what the three
sittings disproved.

**So the chain is:** the model reports low presence → the reader discards it →
a zero floor declares any pixels an answer → **a tap target lands on the wrong
face.** Each link is individually reasonable and the chain is the bug
(*chain proven link by link*).

⚠ **THIS IS A MEASUREMENT THIS RUNG OWES ITSELF BEFORE IT DESIGNS THE PANEL, not
a fix to schedule after it.** The absent case is already a first-class panel
state by the amendment above; whether it is *detectable* changes what that state
can promise. **Read the scores on the three measured words (`tusks`, `hair`,
`eyebrows`) against frames that do and do not hold them, and quote the numbers.**
Two outcomes and both are worth having:

- **The scores separate cleanly** → absence becomes a solved input, the panel's
  absent state is honest rather than defensive, and the departure gate's
  `zero for everything else` gains a real floor to use.
- **They do not separate** → that is a finding of the same weight, known BEFORE
  the panel is drawn rather than after, and the design proceeds on the
  assumption it must today.

⚠ **It costs nothing to take.** No new model, no new call, no added latency —
the numbers are already inside a response this product pays for on every one of
a scan's twenty calls. **A signal bought and discarded is the cheapest finding
available to this rung.**

**Bounded, so it cannot become a model-swap project:** read what SAM 3 already
returns. **Do not add a second segmenter, a verifier pass, or a VLM confirmation
step** — each is a real option and each is a separate decision with its own
latency and money, and none of them may be chosen before the free signal has
been read. Card: **#475**.

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

   ⚠ **AMENDMENT 2026-09-03 — THE ENGINE SPLIT, on his ruling.** Asked whether
   a cheaper or better model had overtaken the spec's vendor, he answered with a
   split rather than a swap, verbatim: *"for now we are sticking with elevenlabs
   voice design for any creative style voices like monsters or sci-fi types and
   inworld for human voices these are the best model mixes at the moment for
   voice design i think."*

   **So the design intent is TWO engines, chosen by what is being voiced:**

   | voice kind | engine |
   |---|---|
   | creature, monster, sci-fi, anything non-human | **ElevenLabs Voice Design** |
   | human | **Inworld Voice Design** |

   ⚠ **THIS IS A DESIGN INTENT, NOT A COMMITMENT, AND HIS OWN "i think" IS PART
   OF THE RULING.** Nothing is built — the interface has zero implementations and
   zero callers, `cast_voices` is absent from the schema, and the transport was
   never verified — **so there is nothing to migrate and no decision to reverse.**
   The row above named one vendor for a year and that was read back as a choice;
   this amendment exists so the SPLIT is not read the same way.

   ⚠ **THE DISAPPEARING-TECHNOLOGY LAW BINDS THIS ROW** (`CLAUDE.md`, 2026-09-03),
   and three of its clauses apply directly:

   - **Clause 1 — "best" has an expiry.** Voice is not scheduled; any vendor
     reading taken today expires before it is built. **Re-ask at build time.**
   - **Clause 2 — re-asked with a MEASUREMENT, never a leaderboard.** The TTS
     leaderboard that prompted this question ranks *reading text in an existing
     voice*, which is **not the job** — voice design invents a voice from a
     description. ⚠ **The court is his own standing method: design the same three
     voices for three real casts on each candidate and listen.** An Elo cannot
     say which one sounds like HIS cast.
   - **Clause 5 — the customer never picks the vendor.** ⚠ **The split is routed
     from the CAST, not asked as a question**: a creature cast reaches one engine
     and a human cast the other, and neither name appears on the path. **If a
     control exists it chooses a VOICE ("creature" / "human", or the audition
     previews themselves), never a supplier.** A customer designing a monster's
     voice has no basis for choosing between two vendors and should never be
     handed that decision.

   **Kept as the open question it is:** whether the split survives a real court
   at build time, and whether one engine by then does both well enough that two
   integrations are not worth their cost. **His “for now” is doing real work in
   that sentence.**
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
