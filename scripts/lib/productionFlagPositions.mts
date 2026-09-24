/**
 * WHERE EVERY ROLLOUT FLAG IS SUPPOSED TO STAND ON PRODUCTION — declared here,
 * compared against the service by the deploy rite on every push.
 *
 * # Why this file exists
 *
 * `CLAUDE.md` is the page every seat reads first, and its feature-gated section
 * describes each flag in prose: what it darkens, what its parent is, and — in
 * several paragraphs — an instruction about when it may be flipped or widened.
 * **Nothing ever compared those sentences to what the service actually holds.**
 * Measured 2026-08-23, two of them had gone stale in the worst direction: they
 * read as PROHIBITIONS on things the founder had already authorised and the
 * mailbox had already executed.
 *
 *   CASTING_INK_CUT_SCOPE    the page said *"it should not be flipped for
 *                            anyone until 3a.2(b) lands"*. He had closed the
 *                            frames gate himself — *"yes its acceptable"* — and
 *                            replaced that with a narrower condition of his own,
 *                            HIS ACCOUNT ONLY until the preview ships
 *                            (fable-1257 §1). It was flipped to `users:1` on
 *                            that word (fable-1260) and has stood there since.
 *   CASTING_INK_WORDS_SCOPE  the page said *"do not widen this flag on the
 *                            strength of this paragraph"* and called it armed
 *                            ahead of its own court. The court had run and been
 *                            ratified, he had judged the frames, and the flip to
 *                            `all` went through HIS OWN HAND (fable-1400) — the
 *                            first capability this program has taken from
 *                            `users:1` to `all`.
 *
 * A third seat reading `CLAUDE.md` today would have concluded that production
 * was misconfigured in two places. Both rulings landed in a mailbox message and
 * neither reached the document, which is `PROTOCOL.md`'s own law: *a ruling is
 * landed when it is written where the next person will act on it.*
 *
 * # Why a declared table and not a derivation
 *
 * Working law 4 says derive rather than mirror, and this is the case the law
 * does not cover: **the production environment is not in the repository.** There
 * is nothing here to derive from. So this is a declaration of INTENT, and its
 * whole value is that a machine compares it to reality at the one moment the
 * reality is being read anyway. A row is not documentation — it is the claim
 * that gets tested.
 *
 * # The two directions it fails in, and neither is silent
 *
 *   a row disagrees with the service   either someone flipped a flag without
 *                                      recording it, or the record went stale.
 *                                      Both are one line to fix and both are
 *                                      exactly what this exists to catch.
 *   the service holds a governed
 *   variable this table does not name  the list stopped being the list. Its
 *                                      NAME is reported and never its value.
 *
 * ⚠ **The rite reports these AFTER printing its whole receipt and then exits
 * nonzero.** Deliberate: the deploy has already landed by the time the flags are
 * read, so refusing early would only destroy the receipt. What a mismatch takes
 * away is the ability of a custody block to say `RITE EXIT STATUS: OK`, which is
 * the thing that gets quoted.
 *
 * ⚠ **VALUES ARE PRINTED ONLY FOR NAMES ON THIS TABLE.** The rite's flag block
 * used to filter the service's variables by NAME PREFIX (`CASTING_`, `R7_`,
 * `ENABLE_STORAGE_CLEANUP_WORKER`), which is a rule about what to include rather
 * than a list of what is safe to show — and it had already drifted: a set
 * `ENABLE_EVIDENCE_CANDIDATE_WORKER` would not have matched it. An allowlist of
 * known-harmless names is the only safe shape for anything that prints a
 * production variable's value at all (`never-filter-a-secret-listing`).
 *
 * # Keeping it current
 *
 * `server/productionFlagPositions.test.ts` refuses a table that does not cover
 * every flag the code declares, and refuses a row with no reason. Change a
 * position here in the same commit that flips it, with the ruling that
 * authorised it named — the reason field is where a future seat learns whether
 * a position is a decision or an accident.
 */

export type FlagPosition = {
  /** What the service is expected to hold. `off` means the variable is unset. */
  readonly position: string;
  /** Why it stands there — name the ruling, not the feature. */
  readonly why: string;
};

/**
 * Read off the production service by the deploy rite on 2026-08-23, receipt
 * `output/deploy-receipts/2026-08-22T23-47-05-342Z-22284.txt`, and reconciled
 * row by row against the ruling that put each one where it is.
 */
export const PRODUCTION_FLAG_POSITIONS: Readonly<Record<string, FlagPosition>> = {
  CASTING_V2_SCOPE: {
    position: "all",
    why: "the program's own door; open to every account since the V2 rollout",
  },
  CASTING_REPAINT_SCOPE: {
    position: "all",
    why: "the compositor swap (D-241), widened past users:1 — fable-1253",
  },
  CASTING_REFERENCE_LIBRARY_SCOPE: {
    position: "all",
    why: "the repaint's parent; a repaint carries features by crop and needs it",
  },
  CASTING_INK_WORDS_SCOPE: {
    position: "all",
    why:
      "his own hand, fable-1400, after the court (opus-960 / fable-1301) and his "
      + "verdicts on the frames and the thirteen styles (fable-1398). The FIRST "
      + "capability this program took from users:1 to all",
  },
  CASTING_INK_STUDIO_SCOPE: {
    position: "users:1",
    why:
      "the widening tripwire (fable-1052 §2) — it does not pass users:1 while "
      + "uploads ride uncropped to the plate mint; the sole account behind it is his",
  },
  CASTING_INK_CUT_SCOPE: {
    position: "users:1",
    why:
      "his verbatim yes, fable-1257 §1 — his account only until the "
      + "customer-facing preview (3a.2(b)) ships; flipped fable-1260",
  },
  CASTING_INK_REFERENCE_SCOPE: {
    position: "users:1",
    why: "flipped with the cut road on the same word, fable-1257 §2b / fable-1260",
  },
  CASTING_INK_REGION_CROP_SCOPE: {
    position: "users:1",
    why:
      "rode with the pair because the object his yes approved is the SURFACE cut, "
      + "which only this flag produces — fable-1260 §2",
  },
  CASTING_INK_TRANSFORM_SCOPE: {
    position: "users:1",
    why: "the transform road (fable-1274), his account while the road settles",
  },
  CASTING_HAIR_REFERENCE_SCOPE: {
    position: "users:1",
    why: "taking hair from an attached picture; his account",
  },
  CASTING_REFERENCE_ATTACH_SCOPE: {
    position: "users:1",
    why: "the door that takes her picture at all; parent of the two reference lanes",
  },
  CASTING_OPEN_LANE_SCOPE: {
    position: "all",
    why:
      "the open lane — an ask naming its own kind. WIDENED to `all` 2026-09-24 on his Crew "
      + "reply #205 (card switch-05-open-lane), verbatim and entire: \"Turn it on for "
      + "everyone\". " + "HIS SWITCH SITTING, 2026-09-24 (#1132) — he went down the whole list in one go, as he "
      + "said he would (\"One sitting — prepare every switch with its evidence and I'll go "
      + "down the list in one go\"). "
      + "Evidence he was shown: 18 demand rows on production (tail, ornaments, orb), last "
      + "5 Sep, one served and the rest answered in words. Its parent CASTING_REPAINT_SCOPE "
      + "was already `all`, so it had no chain above it",
  },
  CASTING_FACE_SCAN_SCOPE: {
    position: "all",
    why:
      "founder ruling 2026-08-25 on the Desk ('widen the pair'), on the #38 "
      + "cost model: ~$0.10/scan, ~$30/power-user-month, gated-beta population; "
      + "re-read before public widening",
  },
  CASTING_SCAN_TABLE_SCOPE: {
    position: "all",
    why:
      "widened WITH face-scan as one pair (the boot guard requires it; his "
      + "same 'widen the pair' word) — the keeper makes every later look free",
  },
  CASTING_SEGMENTS_SCOPE: {
    position: "users:1",
    why: "the segment store (migration 0025, ceremony run)",
  },
  CASTING_SIDE_PHRASING_SCOPE: {
    position: "all",
    why:
      "founder ruling 2026-08-25 on the Desk (register card #2): measured "
      + "p≈0.09, never once worse, free per render; parent repaint is all",
  },
  CASTING_REFINE_DISPATCH_SCOPE: {
    position: "all",
    why:
      "founder ruling 2026-08-25 on the Desk (register card #3): fixes the "
      + "1.7% lost-answer defect at the ~305s gateway wall; parent V2 is all",
  },
  CASTING_DIAGNOSTIC_CAPTURE_SCOPE: {
    position: "users:1",
    why: "keeps the frame from a refused render, on the private evidence adapter",
  },
  CASTING_SEGMENTS_DELIVERED_SCOPE: {
    position: "users:1",
    why: "FLIPPED users:1 2026-08-25 on the founder's order ('flip everything on thats currently off so i can check the rolls myself', fable-1654). Prerequisite held: user 1 is inside CASTING_SEGMENTS_SCOPE. never flipped on production; additive and inert while off",
  },
  CASTING_BRIEF_FIDELITY_SCOPE: {
    position: "all",
    why:
      "WIDENED to `all` 2026-09-24 on his Crew reply #203 (card switch-03-brief-fidelity), "
      + "verbatim and entire: \"Turn it on for everyone\". " + "HIS SWITCH SITTING, 2026-09-24 (#1132) — he went down the whole list in one go, as he "
      + "said he would (\"One sitting — prepare every switch with its evidence and I'll go "
      + "down the list in one go\"). "
      + "⚠ ITS STATED BLOCKER IS DISCHARGED BY MEASUREMENT AND NOT BY HIS WORD ALONE, WHICH "
      + "IS THE PART WORTH KEEPING. fable-1670 §4 held this flag at users:1 until court E1 "
      + "reported, on the worry that a lifted cap stops the reader filling `role` — the only "
      + "field that produces the CASTING CATEGORY (ABSOLUTE) block. That worry is a "
      + "HOUSE-ROAD worry and the house road is what the row above retires: on the author "
      + "road the eight prompts are `seeded.prompt` and the house composer is never called "
      + "(briefCompiler.ts, where the author road takes `const candidates = seeded`), so `role` "
      + "reaches the SHEET and not the engine. Read at the "
      + "production rows the same day: `role` absent on 3 of 75 author rolls (4%) against 28 "
      + "of 216 on the old road (13%) — the feared effect is rarer than what it replaces. "
      + "⚠ THE ORDER WAS LOAD-BEARING: this one widened WITH the register and never alone, "
      + "because alone it puts the lifted cap onto the house road, which is exactly where "
      + "E1's worry lives. Both were set in one act. What it buys: his own 553-character "
      + "brief lost SEVEN of the fourteen facts he typed, and the seven that lived were the "
      + "seven inside the first 180 characters — cut by position, not judgement. --- the "
      + "record before this widen: the brief fidelity build — the announced cap on characterNotes, the bound the reply is "
      + "held to, and the stated skin lane. Flipped users:1 2026-08-25 on the founder's own "
      + "order (\"run the cyborg re-roll on my account\", fable-1636) for the stage-3 gate: his "
      + "cyborg brief re-rolled with the fidelity lane live, judged by his eyes. Its lifespan is "
      + "DECLARED SHORT (fable-1600) — it exists for the unmeasured IMAGE side, so it widens to "
      + "`all` promptly after his gate rather than living at users:1, because two products "
      + "interpreting two sets of briefs is a cost paid briefly and on purpose. ⚠ A reading "
      + "taken while it is narrow states which side it drove.",
  },
  CASTING_CREATIVE_REGISTER_SCOPE: {
    position: "all",
    why:
      "THE AUTHOR ROAD, NOW EVERY ACCOUNT'S ROAD. WIDENED to `all` 2026-09-24 on his Crew "
      + "reply #201 (card switch-01-author-road), verbatim and entire: \"Yes\". " + "HIS SWITCH SITTING, 2026-09-24 (#1132) — he went down the whole list in one go, as he "
      + "said he would (\"One sitting — prepare every switch with its evidence and I'll go "
      + "down the list in one go\"). "
      + "This is the flip N1 was signed off for and never shipped: his sign-off the day "
      + "before (\"im happy to sign off on the cyborg breif now\") is law 9 satisfied, and "
      + "until today every account that was not his still cast through the old house "
      + "compiler. It REMOVES a text call from every roll rather than adding one — since "
      + "Re-imagine the prompt is composed by code — so it is cheaper than what it replaces. "
      + "75 rolls had gone through this road on production since 26 August, all his. It is "
      + "the parent of CASTING_CONCEPT_UPLOAD_SCOPE, which widened in the same act and could "
      + "not have widened before it. Still owed and NOT blocking: the N1 milestone-close deep "
      + "review (#1121, the relay's). --- the record before this widen: the creative register (#16, rung N1 of the rebaseline) — BUILT DARK 2026-08-26 on the "
      + "founder's own verdict on the court (\"I think C is worth building to find out how close "
      + "we can get\"), and FLIPPED TO users:1 2026-08-26 01:21Z on his word on the Crew tab, "
      + "verbatim: \"flip it\" (reply #4 on card register-flip-users1; set by foreman-16 under "
      + "the established variable procedure, read back by name). This is step 3 of the design's "
      + "§5 — a flagged roll of his cyborg brief on his account — and his eye on both bars "
      + "(conviction + spread) is the milestone gate. Not `all` before that: an ordinary brief "
      + "under the flag still compiles house to the byte, but the creative population has not "
      + "been seen at his eye through the built road yet.",
  },
  CASTING_TWO_PATHS_SCOPE: {
    position: "off",
    /* ⚠ RETIRED AND UNSET ON THE SERVICE, 2026-09-24 — his Crew reply #206 (card
       switch-06-two-paths-retire), verbatim and entire: "Unset it".

       Not a widen and not a narrow: the variable is GONE from the service, and
       `off` is how this table says so. It governs nothing — #203 slice 1
       (`67f422b9`) closed the entrance, so no toggle exists on either surface,
       `createRoll` takes no path, and `rollService` writes the column a constant
       null. Read at the rows the day he was asked: 282 of 295 production rolls
       carry no path and the last pathed roll was 2026-08-26.

       ⚠ The COLUMN and its thirteen pathed rows are deliberately kept — #203
       slice 2 step (e) owns them, and they are the evidence of which rolls
       predate the author road. Unsetting the flag does not touch them, and they
       are not to be backfilled or nulled.

       Everything below this line is the row's HISTORY and is kept because its
       lesson outlives the position it describes. ⚠ Where it says this row reads
       `users:1`, that was true from 2026-08-24 until today and is not true now —
       the sentence is struck rather than deleted, which is this repository's own
       rule for a superseded ruling. */
    /* ⚠ THE FOURTH COPY OF ONE STALE SENTENCE, AND THIS FILE IS THE LAST PLACE
       IT SHOULD HAVE SURVIVED (repaired 2026-08-24, opus-1175).

       This `why` read *"the flip waits on a 320-credit dev court and then his
       eyes"* until now. The court RAN on 2026-08-23 — both arms, two Signs —
       and three commits have already chased that same sentence off three other
       surfaces: `8adb18dd` off `POST_SIGN_ROADMAP.md`, `d234f53c` off
       `CLAUDE.md`, and the design's own §10 the night after. **Nobody asked
       this file**, because no rule pointed at it: it is the flags' table, and
       the thing that goes stale on a flags' table is assumed to be a POSITION.
       The position was correct throughout; the prose beside it was a day
       behind, on a file that PRINTS ON EVERY PUSH beside the flip a seat acts
       on the moment he answers.

       The lesson belongs here rather than in a report: a `why` is prose, and
       prose in an instrument rots exactly like prose in a document.

       ✅ **AND THE FLIP CAME THE NEXT HOUR, WHICH IS WHY THIS ROW READS
       `users:1` (2026-08-24, fable-1530).** He looked at the §6 pack and
       accepted it — *"as for everything else you mentioned im happy"* — and the
       flip was executed on that word by the reviewer seat under the established
       variable procedure, read back by name, redeployed, health ×3 200.

       ⚠ **AND THE RECORD LEARNED IT FROM THE SERVICE RATHER THAN FROM THE
       RULING, which is this file's whole purpose firing for the first time on a
       real divergence.** The executor seat's rite pushed 94 seconds later and
       exited 1: `<unset>` at 2026-08-23T23:41:22Z, `users:1` at
       2026-08-24T00:19:24Z, with a Railway deployment at 10:19:53 +10:00 that no
       push produced — which is what a variable change looks like. Neither seat
       had told the other yet. **The instrument closed a gap that a message was
       still crossing**, which is a better reason to keep it than the one it was
       built for.

       ⚠ **A POSITION IS NOT AN ACCEPTANCE, and one of the two open items was
       closed separately and by his own word.** He answered *"yes"* to the
       refuse-until-read state (fable-1531 §1), so 7a-bis builds when the
       `surfaceCoverageUnread` tally says so rather than before the flip. The
       other item — the `build`/`skin` honesty claim before BASICS widens — is
       still open and this position does not touch it. Production held 208 rolls,
       0 pathed, 0 with a wardrobe line the hour it flipped. */
    why:
      "his acceptance of the §6 pack (fable-1530), flipped on that word and read "
      + "back by name; his separate 'yes' to refuse-until-read (fable-1531 §1) "
      + "closes 7a-bis as a precondition — it builds on the tally instead",
  },
  CASTING_BORN_INK_SCOPE: {
    position: "all",
    why:
      "WIDENED to `all` 2026-09-24 on his Crew reply #215 (card born-ink-reask-1159), verbatim "
      + "and entire: \"Turn it on for everyone. Recording tattoos is better than forgetting "
      + "them, and the long-brief reason for holding it is gone.\" "
      + "THE RE-ASK HE ORDERED, and its condition was met rather than assumed: at the switch "
      + "sitting (#1132) he answered row 11 \"Hold, and re-ask with card 3\", and card 3 "
      + "(CASTING_BRIEF_FIDELITY_SCOPE) went to `all` in that same sitting on reply #203. "
      + "⚠ THE BLOCKER THIS ENTRY USED TO CARRY IS DISCHARGED, and it is the whole reason the "
      + "hold existed: `widening it re-opens the NOTES_MAX park first (fable-1431 §1) — the "
      + "cap population IS the born-ink population`. That coupling was real — the only briefs "
      + "long enough to hit the old 180-char cap are the briefs describing tattoos, one "
      + "population and not two — and it DIED when card 3 widened: the announced cap is 2,000 "
      + "for every account, confirmed at the RUNNING SERVICE (not at this record) before the "
      + "flip. "
      + "It widens ALONE: its only parent is CASTING_V2_SCOPE, already `all`, and nothing takes "
      + "born-ink as a parent — so no chain moved with it. "
      + "⚠ WHAT IT BUYS IS A RECORD AND NOT A PICTURE, which is exactly what he ruled on: a "
      + "brief naming ink files words-only library rows, `recipeAssembler` skips them by name, "
      + "`selectCarriedFeatureWords` declines them `markingDiscloses`, and the package road "
      + "that would DISCLOSE them is R7_EVIDENCE_PACKAGE_SCOPE=off and parked (#6). So nothing "
      + "a customer looks at changes today; what changed is that the words stop being dropped. "
      + "Spends nothing new — the reading rides the interpreter call that already runs. "
      + "--- the record before this widen: FLIPPED users:1 2026-08-25 on the founder's order "
      + "('flip everything on thats currently off so i can check the rolls myself', fable-1654)",
  },
  CREW_TAB_SCOPE: {
    position: "all",
    why:
      "the founder's 'go live' on the Desk, 2026-08-25 22:53 — the ceremony "
      + "ran first (crew_replies APPLIED on production, columns verified, the "
      + "same sitting), then this flag on his word. The Crew tab (/admin/crew, "
      + "issue #41) is his briefing surface; CREW_TAB_DESIGN.md §8 was the batch",
  },
  ENABLE_STORAGE_CLEANUP_WORKER: {
    position: "true",
    why: "required by every scope that keeps bytes under a purge path",
  },
  /* ⚠ THESE TWO WERE THIS TABLE'S FIRST TWO ERRORS, AND THE INSTRUMENT CAUGHT
     THEM ON ITS FIRST RUN AGAINST THE REAL SERVICE. Both rows said `off`,
     because I wrote them from the rite's own flag block — and the rite's block
     was the prefix filter this commit replaces, which cannot match either name.
     `opus-204` (2026-08-11) had already read all three `ENABLE_` keys BY A
     SECOND, SEPARATE SWEEP, noting in as many words that *the CASTING pattern
     cannot see them*, and recorded both as `true` and deliberate. That
     knowledge was lost, and `opus-1078` re-derived "not set" from the blind
     block twelve days later — which is how CLAUDE.md came to say it. */
  ENABLE_EVIDENCE_CANDIDATE_WORKER: {
    position: "true",
    why:
      "true since at least 2026-08-11 (opus-204's separate ENABLE_ sweep), and "
      + "inert: R7_EVIDENCE_COMPOSER_SCOPE is off, so the worker has nothing to do",
  },
  ENABLE_FINAL_MODEL_DELETE: {
    position: "true",
    why:
      "permanent Cast deletion, LIVE for every account — it is a boolean with no "
      + "per-user narrowing (assertFinalModelDeleteEnabled, server/routes/models.ts). "
      + "True since at least 2026-08-11 (opus-204), deliberate, and absent from "
      + "CLAUDE.md entirely until 2026-08-23",
  },
  R7_SNAPSHOT_READ_SCOPE: { position: "all", why: "the R7-7B snapshot reader rollout, complete" },
  R7_SNAPSHOT_RESTORE_SCOPE: {
    position: "users:1",
    why: "the restore half; must stay a subset of the read scope",
  },
  R7_EVIDENCE_INGEST_SCOPE: {
    position: "users:1",
    why: "evidence ingest on the private adapter, his account",
  },
  CASTING_ROLL_ENGINE_SCOPE: {
    position: "users:1",
    why:
      "the roll engine on his account — a GPT Image 2.5 model instead of GPT Image 2 (#1079, #1084); "
      + "CASTING_ROLL_ENGINE_MODEL says which and is not a scope flag (a value, so a model switch is a "
      + "variable change). His eye on court #1068 (2026-09-22): Flare first (\"honestly flare gave good "
      + "results\"), then after three real rolls — 4 of 8 refused on roll 276 — \"flare is producing bad "
      + "results - switch over to sunburst\". users:1 on that word; wider on his eye and not before, with "
      + "the chosen model's fal price and refusal rate read first",
  },
  CASTING_RETRY_SCOPE: {
    position: "all",
    why:
      "WIDENED to `all` 2026-09-24 on his Crew reply #204 (card switch-04-retry), verbatim "
      + "and entire: \"Turn it on for everyone\". " + "HIS SWITCH SITTING, 2026-09-24 (#1132) — he went down the whole list in one go, as he "
      + "said he would (\"One sitting — prepare every switch with its evidence and I'll go "
      + "down the list in one go\"). "
      + "Evidence he was shown: 5 retries on production, 4 succeeded, 1 failed and was "
      + "refunded, 5 Sep -> 22 Sep. The customer pays 20 credits and is refunded again if the "
      + "retry also fails — the charge is its own operation with its own refund key, so it "
      + "cannot collide with the original slice's refund. --- the record before this widen: "
      + "the Retry button (#122 shape 1) — one failed sheet slice rendered again for 20 credits, "
      + "his own word (\"should we also allow a try option aswell?\" — yes). BUILT DARK "
      + "2026-08-27; users:1 on his Crew reply #10 the same day (\"Flip it on for your account, "
      + "AND widen it to content-filter tiles\"), which also put content-filter tiles on the "
      + "button — so its live population on his account is every refused tile he has, not "
      + "zero. Wider than users:1 on his eye and not before",
  },
  CASTING_CONCEPT_UPLOAD_SCOPE: {
    position: "all",
    why:
      "WIDENED to `all` 2026-09-24 on his Crew reply #202 (card switch-02-concept-upload), "
      + "verbatim and entire: \"yes, turn it on\". " + "HIS SWITCH SITTING, 2026-09-24 (#1132) — he went down the whole list in one go, as he "
      + "said he would (\"One sitting — prepare every switch with its evidence and I'll go "
      + "down the list in one go\"). "
      + "⚠ THE VENDOR-EXPOSURE QUESTION THIS ENTRY RESERVED WAS PUT TO HIM IN HIS OWN WORDS "
      + "AND HE ANSWERED IT — it was not widened past him by anybody's judgement. The card "
      + "said it plainly: the picture goes WHOLE to our text-model supplier, and while it is "
      + "his account that is his own picture and his own choice, but for everyone it is a "
      + "stranger's photograph of a person reaching a third party — \"a privacy decision, not "
      + "an engineering one, and it is yours\". What is unchanged and is why the row could be "
      + "put at all: the photograph is never kept and never rendered (the bytes ride the text "
      + "call and are dropped when it returns — no row, no file, no public URL), and what "
      + "reaches the image engine is WORDS, so the studio makes a type and never a likeness. "
      + "Its parent CASTING_CREATIVE_REGISTER_SCOPE widened in the same act; it could not "
      + "have gone first. --- the record before this widen: UPLOAD A CONCEPT (#185, his order 2026-08-28) — a picture in, a description of the "
      + "PERSON out, into her own brief box. BUILT DARK 2026-08-28 — BOTH slices: the door, "
      + "and (the same day) the start page card it is reached from, which draws the honest "
      + "coming-state for every account outside this scope. FLIPPED to users:1 2026-08-28 on "
      + "his Crew reply #22, verbatim and entire: \"Flip it.\" — answering the "
      + "concept-upload-flip card, whose own condition (his type-not-inventory ruling, "
      + "re-cut and re-driven) was discharged first. Its parent is "
      + "CASTING_CREATIVE_REGISTER_SCOPE (the description is written for the AUTHOR). "
      + "Widening past users:1 re-opens the vendor-exposure question, since the upload rides "
      + "whole to the describer",
  },
  R7_EVIDENCE_COMPOSER_SCOPE: { position: "off", why: "the composer's runtime door, unopened" },
  R7_EVIDENCE_PACKAGE_SCOPE: {
    position: "off",
    why:
      "evidence-aware package sync; evidenceAcceptedAssetMigrationCeremony REFUSES "
      + "to run unless this is off",
  },
  R7_EVIDENCE_COMPOSER_RECIPE: {
    position: "ink.add.front_upper_torso.v1",
    why:
      "WHICH recipe the composer runs. Inert while R7_EVIDENCE_COMPOSER_SCOPE is "
      + "off — the one row here that is not a scope, and it is on the table because "
      + "the service holds it",
  },
};

/** Absent from the service means off — every scope paragraph says so. */
export const UNSET = "off";

export type FlagReading = { readonly name: string; readonly value: string };

/**
 * Parse `railway variables --kv` output into readings.
 *
 * Only the NAME is taken from every line; the value is kept, but nothing here
 * decides what is printed — {@link PRODUCTION_FLAG_POSITIONS} is the allowlist
 * and the caller prints from that.
 */
export function parseVariableLines(raw: string): FlagReading[] {
  const readings: FlagReading[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    const split = trimmed.indexOf("=");
    if (split <= 0) continue;
    const name = trimmed.slice(0, split);
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) continue;
    readings.push({ name, value: trimmed.slice(split + 1) });
  }
  return readings;
}

/** Anything the service could be holding that this table ought to govern. */
const GOVERNED_NAME = /^[A-Z0-9_]*(SCOPE|STAGE)[A-Z0-9_]*$/;

export type PositionVerdict = {
  /** One line per governed flag, in table order, for the receipt. */
  readonly block: string[];
  /** Empty when the service stands where this file says it does. */
  readonly mismatches: string[];
};

/**
 * Compare the service's readings against the declared positions.
 *
 * Returns rather than throws: the caller prints its receipt first and carries
 * the verdict in its exit status, because the deploy has already landed by the
 * time anyone can read a flag.
 */
export function comparePositions(readings: readonly FlagReading[]): PositionVerdict {
  const held = new Map(readings.map((reading) => [reading.name, reading.value]));
  const block: string[] = [];
  const mismatches: string[] = [];

  for (const [name, expected] of Object.entries(PRODUCTION_FLAG_POSITIONS)) {
    const actual = held.get(name) ?? UNSET;
    block.push(`  ${name}=${held.has(name) ? actual : "<unset>"}`);
    if (actual !== expected.position) {
      mismatches.push(
        `${name}: the service holds \`${actual}\`, this record says \`${expected.position}\` (${expected.why})`,
      );
    }
  }

  /* The other direction: a governed variable nobody wrote down. Its NAME only —
     an unrecognised variable is exactly the one whose value must not be shown. */
  for (const reading of readings) {
    if (reading.name in PRODUCTION_FLAG_POSITIONS) continue;
    if (!GOVERNED_NAME.test(reading.name)) continue;
    mismatches.push(
      `${reading.name}: set on the service and absent from this table — a flag that exists and is not on the list is how the list stops being the list (value deliberately not printed)`,
    );
  }

  return { block, mismatches };
}
