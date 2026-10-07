/**
 * THE ROADS — how the casting studio works, as DATA the generator validates.
 *
 * Founder order (fable-1357, chat 2026-08-22): *"it needs to be easy for our
 * agent to look at it and fully understand how the entire casting system
 * works"* — and his addendum, *"double check your work against the codebase."*
 *
 * # How this file stays true
 *
 * A hand-written architecture narrative rots. So this file is DATA, and the
 * generator holds it to the source at every run:
 *
 *   - every door id here must exist in the DECLARED set (extracted from
 *     source); an unknown id is an error finding, not a typo that ships;
 *   - every flag here must exist in the declared flag set, same rule;
 *   - every PROCEDURE here must be one `castingV2` exposes, and — the direction
 *     that was missing until #1203 — every procedure it exposes must be named
 *     by some road or carry a reason in `UNMAPPED_ENTRANCES`;
 *   - the RENDER joins each door to its extracted file:line sites, its pinning
 *     tests and the corpus rows that reach it — none of that is written here,
 *     all of it is derived, so the per-door facts cannot drift from the code.
 *
 * ⚠ **THE MAP WAS VALIDATED FORWARD AND NEVER BACKWARD, AND THAT IS HOW THE
 * BIGGEST THING N1 SHIPPED STAYED OFF IT FOR THREE WEEKS (#1203).** Every
 * citation above was held to the source, so nothing this file SAID could be
 * false — and nothing asked whether the file was COMPLETE. Re-imagine
 * (`castingV2.reimagine`, live for every account since 2026-09-24) had no road,
 * no door, no corpus row and no debt line, and `pnpm capability:check` was
 * green throughout, because the roads' ENTRANCES are FILES and `reimagine`
 * lives inside a file road 1 already names. A forward-only check on a
 * hand-written population reports a complete list either way — the four-collector
 * class in `CLAUDE.md`, pointed at prose instead of a regex. The `procedures`
 * field below is the population, derived; `UNMAPPED_ENTRANCES` is the enumerated
 * remainder, and it only shrinks.
 *
 * What IS hand-written is the connective prose (`summary`, `notes`) and the
 * grouping — reviewed like any prose, kept short, and never the only source
 * for a checkable fact. `doorsNote` exists for roads whose doors are not yet
 * in the census's declared set (other entrances): an honest "not yet mapped"
 * beats an invented list.
 *
 * # Reading order for an agent
 *
 * Road 1 is the life of a cast (roll → sheet → refine → sign). Roads 2–4 are
 * the refine entrance in depth — the money model, the walls and gates, and the
 * ink lanes. Roads 5–8 are the other entrances at survey depth with their
 * flags. The LAWS section at the end is the invariants that hold everywhere.
 */

export type Road = {
  id: string;
  title: string;
  /** The entrance's own file(s) — verified to exist at generate time. */
  entrances: string[];
  summary: string;
  /** Declared door ids this road can answer with — validated against source. */
  doors: string[];
  /**
   * THE CALLABLE PROCEDURES A CUSTOMER REACHES THIS ROAD THROUGH — validated
   * both ways against the entrance's own declared set (#1203).
   *
   * Forward: a procedure named here that `castingV2` does not expose is an
   * error. Backward — the half that was missing and let Re-imagine ship
   * unmapped — every procedure the entrance DOES expose must be named by some
   * road, or carry its reason in {@link UNMAPPED_ENTRANCES}.
   *
   * A procedure may appear on more than one road: `castingV2.refine` is one
   * entrance read at three depths, and pretending otherwise would force a
   * false choice about which road owns it.
   */
  procedures: string[];
  /** For roads whose doors are outside the censused entrance: the honest note. */
  doorsNote?: string;
  /** Scope flags gating this road — validated against the declared flag set. */
  flags: string[];
  notes: string[];
};

export const ROADS: readonly Road[] = [
  {
    id: "life-of-a-cast",
    procedures: [
      "castingV2.config",
      "castingV2.createSession",
      "castingV2.openSessions",
      "castingV2.getSession",
      "castingV2.abandonSession",
      "castingV2.createRoll",
      "castingV2.getRoll",
      "castingV2.follow",
      "castingV2.retry",
      "castingV2.cancel",
      "castingV2.keep",
      "castingV2.discard",
      "castingV2.undo",
      "castingV2.selectVariant",
      "castingV2.variants",
      "castingV2.roster",
      "castingV2.getCast",
      "castingV2.renameCast",
      "castingV2.deleteCast",
    ],
    title: "The life of a cast — roll, sheet, refine, sign",
    entrances: ["server/routes/castingV2.ts"],
    summary:
      "A BRIEF is compiled and a ROLL renders eight candidates onto a SHEET (each an independently refundable slice). "
      + "Opening a candidate gives the panel and REFINE: each paid edit renders a VARIANT anchored on the pristine master, "
      + "with prior edits carried by the composed chain (words + crops). SIGN freezes an identity: five views rendered from "
      + "the anchor, each checked against the signed face, delivered as the package. Deletion sweeps the cast and "
      + "everything minted under it (crops, designs, scans) unconditionally.",
    doors: ["roll.likeness", "roll.not_a_being", "roll.reader_outage", "roll.uninterpretable"],
    doorsNote:
      "THE ROLL ENTRANCE'S WALLS ARE ON THE MAP AS OF #206, AND THERE ARE FOUR OF THEM SINCE #1495 RETIRED `roll.unsupported_cohort` WITH THE TWO-VALUED COHORT QUESTION THAT WAS ITS ONLY SOURCE — declared from `ROLL_REFUSAL_COPY`, entrance-qualified `roll.*`, "
      + "each citing its own throw. They are DECLARED but not DRIVEN: the census sends a sentence at an existing Cast through "
      + "`castingV2.refine`, and these are raised inside `castingV2.createRoll` before a roll row exists, so each carries its "
      + "reason in UNREACHABLE_DOORS instead of a corpus row. A brief-carrying corpus row is the map's next growth ring, and it "
      + "would be free at all four. The SIGN entrance is still outside the declared set entirely (fable-1357 §2).",
    flags: ["CASTING_V2_SCOPE", "CASTING_RETRY_SCOPE", "CASTING_ROLL_ENGINE_SCOPE"],
    notes: [
      "Anchor law: every refine renders from candidate.imageKey (the pristine master), never from a delivered frame — chaining on delivered frames was measured to drift.",
      "THE RETRY BUTTON (`CASTING_RETRY_SCOPE`, #122 shape 1, founder 2026-08-26: 'same prompt, one slice, 20 credits, refunded again on failure'): a tile whose chip reads Didn't finish or Didn't arrive may be rendered again (those two chips said 'Engine error' and 'Didn't arrive' until #1551 rewrote every failure chip into outcome words, 2026-09-30 — the KINDS `engine` and `unknown` did not move, and `RETRYABLE_FAILURE_KINDS` is what the door actually reads) — the FAILED ROW ITSELF goes failed → queued by CAS (`resetCandidateForRetry`, the one transition out of `failed`), one render runs through the roll road's own `dispatchCandidate` with the row's `internalPrompt.prompt` byte for byte, under an operation of its own (`castingV2.retry`, the candidate lock as the double-tap cover). Blocked tiles (kind `content_filter`, chip 'Content filter' until #1551) GET THE SAME BUTTON since his reply #10 (2026-08-26: 'Flip it on for your account, AND widen it to content-filter tiles') — the #93 court measured the filter as a coin per picture (roll 222's text refused 5/8 live, 6/8 passed re-sent unchanged), so a plain Retry is the button that rescues them and promises nothing about softer words; not-a-portrait and not-charged tiles still get none; every refusal (`retryService.ts`: flag off → NOT_FOUND, wrong kind, sheet still casting, cancelled roll, no prompt, no usable recorded price) is free and before the claim. ⚠ **AND THE PRICE IS THE TILE'S OWN SINCE #1601 item 2 (2026-10-01), WHICH IS WHY THIS LIST GREW BY ONE.** His quoted '20 credits' above IS one slice, and a retry used to read it from `CASTING_V2_RETRY_PRICE_CREDITS` at the top of the function — before the row it was charging for was even fetched. That constant is the ROLL slice; it is identical to every live row today (measured: 483 candidate rows, all 20, none NULL or ≤ 0) and it becomes wrong the moment a Follow slice is 200, because the retry would charge the Roll's 150 and then WRITE 150 onto the tile's row through `resetCandidateForRetry` — making the mis-charge its own refund authority, with the ledger reconciling exactly against the wrong number. The charge is `candidate.pointsCost` now, read after the ownership read that already had it, and the sixth refusal is the fail-closed arm for a recorded price a charge cannot be built from (the column is `.default(0).notNull()`, so a future writer that omits it would otherwise buy a free render). ⚠ **AND THAT CONSTANT NO LONGER EXISTS — THIS SENTENCE SAID IT WAS LIVE UNTIL 2026-10-03, READ AT THE CODE.** It read *\"the constant remains the account-level QUOTE that `castingV2.config` hands the client, true of every tile while the two slices agree\"*, and both halves died in #1601 item 1 on 2026-10-01: `CASTING_V2_RETRY_PRICE_CREDITS` is DELETED (`castingCreditCosts.ts` keeps only its obituary, because a price nothing quotes may not sit in that module — invariant 7) and `retryPriceCredits` LEFT the `castingV2.config` response with it. There is no account-level retry quote to be true of anything; the sheet derives a tile's price from the roll row's own total divided by its candidate count, the same derivation the cancel line already used. `followSlicePrice.test.ts` is still the suite and still the right pointer, but WHAT IT HOLDS HAS INVERTED — its tripwire FIRED and was discharged, so it pins the absence (*\"the account-level RETRY quote has left `castingV2.config` entirely\"*, *\"the tile's retry price is derived from the ROLL ROW, not from the config quote\"*) instead of waiting for the day the slices diverge. They diverged on 2026-10-01 and agree again at 200 since #1753. The measurement the old sentence leaned on still holds and is now dated rather than present-tense: read at production 2026-10-02, all 483 candidate rows carry `pointsCost` 20, none NULL or ≤ 0 — nobody has rolled since 2026-09-28, so no live row carries a post-P1 slice yet. Recovery links a crashed retry to its slice through the operation's candidate lock row and fails CLOSED. Off the flag not one line runs; production holds it `all` since 2026-09-24 on his Crew reply #204 ('Turn it on for everyone'), so its live population is every account's refused tiles (it was `users:1` from 2026-08-27, his reply #10, until the switch sitting) — NOT zero, which is what this note said until #206 (the record is `scripts/lib/productionFlagPositions.mts`, which the deploy rite compares to the service on every push). Its refusals are the retry service's own and remain outside the declared door set; the roll entrance's five WALLS joined the map at #206 (doorsNote above).",
      "A roll is eight independently refundable units; a deploy landing mid-roll costs only the undelivered slices (accepted collision class, D-85).",
      "The path/wardrobeLine columns (migration 0051) make the born path a fact of the roll; NULL means cast before the paths existed.",
      "A brief the reader NEVER READ (the deadline fired, the transport or provider failed, no engine configured) is refused FREE before the claim as `reader_outage` at EVERY length (briefCompiler.ts; founder ruling #126 'refuse-free', Crew reply #7 2026-08-26, and 'always' on the length question, reply #9) - it replaced the H30 fallback that charged roll 219 for a sheet cast from the brief's first 80 characters. Only a reply the provider gave that the compiler could not parse still falls back; `reader_outage` is a declared door as of #206 (`roll.reader_outage`) and documented as unreached because no corpus row can carry a brief — this note stays as the road's account of WHY it exists.",
      "THE ROLL'S SUBJECT WALLS ARE THE RULING'S TWO AND NO THIRD (#131 slice C): the reader is asked a four-valued subject question (`SUBJECT_INSTRUCTION`, interpreter.ts), a creature / robot / alien / anime brief CASTS, a real person or a named character refuses FREE before the claim as `likeness` (`LIKENESS_MESSAGE`, briefCompiler.ts) and a subject that is not a being refuses FREE as `not_a_being` (`NOT_A_BEING_MESSAGE`; founder: 'someone asking for an object should be refused like a car'). Both are the reader's judgement taken twice (`cohortWallRetried`). ⚠ THE THIRD WALL IS RETIRED AND THE CLAUSE THAT DESCRIBED IT IS GONE WITH IT (#1495). It read that off the author road a roll still walled as `unsupported_cohort`, then that the two-valued question survived one module out in the INTERPRETER's own `author` option: that option is deleted, the two-valued vocabulary with it, and the raise it fed. There is one subject question in the module now, so there is no off. What the retirement changed for a customer is nothing — `briefCompiler` had passed `author: true` as a literal since #1490 act 1, and all 16 surviving prompt combinations are byte-identical to their `author: true` twins on the previous tree. Both kept walls are declared doors as of #206 — `roll.likeness` and `roll.not_a_being`, the latter the twin of `concept.no_being`.",
    ],
  },
  {
    id: "refine-money",
    procedures: [
      "castingV2.refine",
    ],
    title: "Refine's money model — free before the claim, refunded after it",
    entrances: ["server/castingV2/refineService.ts"],
    summary:
      "Everything before the claim is FREE: ownership and state doors, the interpreter's walls and gates, and every "
      + "cannot-say answer. The claim charges one refine at `CASTING_V2_REFINE_PRICE_CREDITS` — read it there and "
      + "never here; this clause said \"25 credits\" until 2026-10-03, which P1 superseded — and dispatches; a "
      + "failure after it refunds. The census drives "
      + "with the claim door shut, so 'would-render' means the ask passed every free door and reached the money.",
    doors: [
      "candidate_missing", "already_signed", "busy", "refine_limit", "master_missing", "version_missing",
      "history_unreadable", "history_predates_undo", "step_moved", "kind_unserved",
    ],
    flags: ["CASTING_V2_SCOPE", "CASTING_REPAINT_SCOPE", "CASTING_REFINE_DISPATCH_SCOPE"],
    notes: [
      "`busy` is the admit door (a real TOO_MANY_REQUESTS, invariant 6); reaching it in the census reads as would-render.",
      "`refine_limit` is the 24-instruction ceiling — removals are still allowed there; only growth is blocked.",
      "Charge-then-refund where the answer was knowable pre-claim is a defect class this program has closed twice (the mid-chain prune, the dangling-crop transform); the census's ledger arm guards the whole table.",
    ],
  },
  {
    id: "refine-reading",
    procedures: [
      "castingV2.refine",
    ],
    title: "Refine's reading — the interpreter, its walls, and its gates",
    entrances: ["server/castingV2/refineInterpreter.ts", "server/castingV2/refineDelta.ts"],
    summary:
      "The customer's sentence is read by a text model whose OUTPUT is policed by code: values must appear in the "
      + "customer's own words (source containment), facets resolve against the subject cards, and refusals carry their "
      + "own names. Walls refuse the ASK's kind; gates refuse an ask the road cannot serve YET and say what would work. "
      + "An unreadable or empty sentence refuses free — the product never guesses.",
    doors: [
      "empty", "unreadable", "reader_outage",
      "wall_likeness", "wall_content", "wall_stage", "wall_unbacked", "wall_unfileable",
      "gate_ink_document", "gate_ink_uncarried", "gate_ink_unkeepable",
      "gate_ink_coverage_unread", "scope_unknown", "scope_mismatch",
    ],
    flags: ["CASTING_OPEN_LANE_SCOPE", "CASTING_SIDE_PHRASING_SCOPE", "CASTING_INK_WORDS_SCOPE"],
    notes: [
      "wall_stage = PROVABLY the shoot (the lexicon backed the claim); wall_unbacked = the model claimed out-of-scope and the lexicon could not confirm — one wall was two walls wearing one name until census card C1.",
      "gate_ink_document asks 'is there a document for this design'; its answers are the anchor itself, a pointed-at photograph, the delivered crop, and (words road) the delivery about to be minted.",
      "gate_ink_uncarried is a place the product can SEE and cannot KEEP (a covered chest): render would land, the mint could not crop, the tattoo would die on the next edit — his own find-and-crop condition enforced.",
      "item 7a split that gate three ways, because its two reasons only COINCIDED while the product had one outfit: gate_ink_uncarried = a garment is over it; gate_ink_unkeepable = the surface is bare and the road still cannot crop a result there (a shirtless Basics chest); gate_ink_coverage_unread = nobody has read this outfit's coverage, which fails closed and says so in its OWN words rather than borrowing the covering's.",
      "unreadable = a reply CAME BACK and could not be read, and rephrasing is real advice for it; reader_outage = nothing came back at all (the transport threw, the deadline passed, the text account is overdrawn, or no engine is configured), where telling her to rephrase is advice she cannot follow. The roll road has drawn this line since #126; the refine road drew it 2026-08-30.",
      "A tapped rectangle (scope) outranks the words and the memory — the tap is the customer's freshest act; a scope naming nothing the instruction writes refuses free (scope_mismatch).",
    ],
  },
  {
    id: "refine-ink",
    procedures: [
      "castingV2.refine",
    ],
    title: "The ink lanes — add, transform, remove, and the crop that carries",
    entrances: ["server/castingV2/inkPriorAsk.ts", "server/castingV2/inkDeliveryMint.ts", "server/castingV2/refineService.ts"],
    summary:
      "A delivered tattoo is remembered as a CROP row cut from the delivered frame by the placement's own reader word; "
      + "that crop rides every later render as instruction material (upscaled to the legibility floor when small). "
      + "Transforms ride the crop as the source; removals prune the step and recompose (navigate free when the survivor "
      + "already exists, re-render when it does not); the record's names are believed only where a ROW backs them.",
    doors: [
      "noInkToChange", "inkOneChangeAtATime", "whichInkToChange", "inkNotKept", "inkBeyondToday", "unplacedInk",
      "removal_absent", "removal_unnamed", "removal_not_in_brief", "removal_uncheckable", "removal_reread_unmatched",
      "removal_unnameable", "already_original",
    ],
    flags: ["CASTING_INK_STUDIO_SCOPE", "CASTING_INK_TRANSFORM_SCOPE", "CASTING_INK_WORDS_SCOPE", "CASTING_REFERENCE_LIBRARY_SCOPE"],
    notes: [
      "THE ID POINTS AND THE ROW DECIDES: a chain naming a crop with no row is skipped loudly by the carry (the rescue needs the name to stand) and answered free at the transform door (inkNotKept) — never scrubbed, because scrubbing deletes the pointer the minted-loss rescue lives on (C4b, closed not-to-be-built).",
      "free.ink is ONE subject holding every tattoo (the keying work, §10 3b, splits it); the gate skips items warranted only by the prior so a carried tattoo cannot wall a new ask.",
      "Removal of the only edit NAVIGATES free ('That takes it back to the original'); a never-rendered survivor re-renders and charges once — proven at the wire both ways.",
    ],
  },
  {
    id: "sign-views",
    procedures: [
      "castingV2.sign",
      "castingV2.retryView",
      "castingV2.redoPackage",
    ],
    title: "Sign — five views, the identity lock, and what rides into them",
    entrances: ["server/castingV2/signService.ts", "server/castingV2/packageOrchestrator.ts", "server/castingV2/inkViewReferences.ts", "server/castingV2/viewRetryService.ts", "server/castingV2/packageRedoService.ts", "server/castingV2/outfitPlate.ts"],
    summary:
      "Signing renders the package views fresh from the anchor, judges each against the signed face and the wardrobe "
      + "spec, and refunds only the slices that are not her. Delivered tattoo crops ride into the views with the her-own-picture "
      + "sentence (never the mannequin's); every slot gets a disposition line, a moved digest refuses rather than "
      + "paints, and a failure never fails the Sign.",
    doors: [],
    doorsNote:
      "Sign's refusals and dispositions are service-internal (not the refine entrance's declared set); its behaviour is "
      + "pinned by signInkCrops.test.ts and the wire courts rather than census rows. A sign corpus is future work — "
      + "a Sign is the most expensive act in the product and `CASTING_V2_SIGN_PRICE_CREDITS` is the one place to "
      + "read what it costs, so it is recorded from courts and never driven by the census. ⚠ THIS CLAUSE SAID "
      + "\"sign spends ~450 credits\" UNTIL 2026-10-03 and 450 had stopped being any price at all: P1 moved the "
      + "figure (#1601, merged 2026-10-01), and under the two scales this product now quotes it is neither the "
      + "ledger number nor the display one. A price typed into this prose is an unguarded mirror of a constant "
      + "(working law 4) and the generator validates doors, flags and entrances rather than numbers — so the "
      + "constant is NAMED here instead of quoted, which is what the retry note below already does right.",
    flags: ["CASTING_V2_SCOPE"],
    notes: [
      "THE TWO ENGINES, THEIR DATE AND THEIR REASON (#1278 path E, his ruling 2026-09-29 — the disappearing-technology law's clauses 1-3: a model choice carries a date and a reason and is re-asked with a measurement on HIS fixtures). A Sign now uses TWO models because his two courts answered about two different jobs, and he said so in one line: 'Sunburst was only chosen because it was more creative in outfit design. NBP2k was a better quality rersult though.' So — a DELIVERED VIEW renders on NANO BANANA PRO at the `2K` tier (1696x2528), his quality choice; and ONE WARDROBE PLATE per Sign renders on GPT IMAGE 2.5 SUNBURST at `high`, through Sunburst's EDIT door at 3504x2336 WITH HER SIGNED MASTER AS ITS ONE REFERENCE, his creativity choice. ⚠ THE PLATE WAS DRAWN FROM WORDS ALONE FOR ONE DAY AND HIS RULING ENDED IT (#1471, 2026-09-29, verbatim and entire): 'no the plate must reference the master image otherwise it wouldnt be able to invent the outfit correctly'. A plate that cannot see the top she was SIGNED in invents a different one, and the full-length view is then told to take the clothes from the plate — so the product would contradict a picture the customer had already accepted, above the waist, by design. Driven on his own Sifr the day it changed: the words-only plate came back a DIFFERENT WOMAN in a long slit dress; the master-edited plate is HER, wearing the master's own high-neck clasp, its two buckled shoulder straps, its chest graphic and its tattoo sleeve on the correct arm, with one hem and one pair of boots front and back. The plate is therefore HER and not a floating garment — also his word, on the relay's reading that two references which agree on identity cannot fight: 'i agreew tih you'. A BEING WITH NO OUTFIT GETS A PLATE TOO and there is no no-wardrobe gate: for a creature the plate is the lower body invented once — hide, scales, feet — which is what the two full-length views need to agree on, and the view's clause says so in as many words. Measured on cast #58, a signed alien: the plate LANDED rather than being refused, and its panels carry the whole body below the master's crop. The plate is two panels of one outfit — the product's own `frontFull` and `backFull` cameras, taken by name, never invented (his rule 2026-09-27: 'the sheet should copy the exact angles and camera views the current views use not invent new ones') — cut in half in memory and handed to those two views as a reference. NOTHING THE PLATE PAINTS IS EVER DELIVERED OR STORED. This SUPERSEDES #1459, which had put the delivered views on Sunburst's edit door at 2352x3504; it was right on its own question and is superseded inside path E's own PR by his instruction, never reverted separately. THE PRICE AND THE CLOCK, because a finding without them is not decision-grade: the plate is ONE EXTRA RENDER per Sign at ~$0.11-$0.15 of house money, no customer credit, and it runs IN PARALLEL with the three views that do not wear it — so a customer waits the plate's render standing where the full-length pair's would have started, not added to it. Measured through the real doors on his Sifr, 2026-09-29: plate 42.1 s, a delivered view ~29-34 s, six renders for $0.72 settled. Re-measured on the EDIT door the same day (#1471): plate 70.8 s on Sifr and 55.9 s on the creature — slower than the words-only plate, because the door now reads a 2.6 MB master — a delivered view 30-35 s, four renders for $0.43 settled, and the landscape ask survives a portrait reference (3504x2336 asked, 3504x2336 returned, read at the bytes). WHAT THE COURT SHOWED, and it is his defect reproduced and closed: master-only gave a plain midi with white boots at the FRONT and a MINI skirt with BLACK boots at the BACK — two outfits in one package, which is his 'the hem and shoes differ every take' — while master+plate gave one garment, one hem and one pair of boots both ways. His eye on a real Sign's strip is what closes it (law 9). NOTHING NAMES EITHER ENGINE ON A CUSTOMER PATH — no button, no loader, no refusal — and there is no flag: his word was the flip. The paid refine's non-repaint edit is untouched and is still Nano Banana Pro at 1K (`server/castingV2/refineService.ts`).",
      "THE PLATE MOVES THE DELIVERED PICTURE'S SHAPE UNLESS IT IS PINNED, and that was found by driving rather than by reading (#1278, 2026-09-29). Nano Banana Pro reads its output shape off its REFERENCES: measured on the real door, the same view came back 1696x2528 master-only, 1792x2400 with a 3:4 plate panel beside the chest-up anchor, and 1696x2528 again with `aspect_ratio: 2:3` pinned. Unpinned, path E would have shipped a five-view package with two views a different shape from the other three — a thing a customer sees at a glance in a strip of five and no test would have failed. It is pinned ONLY on the two views that carry a plate; the other three compose the request they always did. `aspectRatio` had never been set by any caller on any road before this, so the door's vocabulary was unverified here and the value above is the answer it gave rather than a table's.",
      "A PLATE FAILURE NEVER FAILS THE SIGN and never refunds (his rule, path E). Every fault — a refusal, a timeout, a dropped connection, an unsplittable plate, a credential nobody set — answers 'no plate', and the two full-length views then render master-only, which is byte for byte the request this road sent before path E. The one thing the plate road re-throws is a CANCELLATION, because an abort is the Sign being torn down rather than the plate failing, and the orchestrator catches that in turn: a view that is never ATTEMPTED is the single failure mode on this road with no refund path out of it (its audit row and its charge already exist). The plate is Sign/retry scratch — not a wardrobe card, not a looks card, not an R2 object, not customer-visible — so 'a new wardrobe means a new plate, never a reused one' holds by construction: nothing keeps one.",
      "The `2K` on a signed view's asset row is a TIER, never a pixel count, and #1459 left it alone on purpose. It never was a measurement — Nano Banana Pro answered `2K` with 1696x2528 and Sunburst answers 2352x3504 — it names the SIGNED-VIEW tier, the one the 1K anchor is not, which is the ROLE question `committedPackageAngles` and `unsettledPackageAngles` actually ask. A second label for the honest size would put two strings on one role across a live table whose existing rows cannot be relabelled without a row rewrite, and a reader still testing the old one would count a paid, landed view as never arrived. What carries the honest size instead is the row's own `provenance.engine`, stamped per asset, so a Sunburst row and a Nano Banana Pro row are told apart by the record rather than from memory.",
      "THE CHECK IS CATASTROPHIC-ONLY (#1903, his ruling 2026-10-07 terminal, verbatim: 'i think we ditch the measure and checker i mean it been nothing but problems it should only detect catastropic failure the image engine is excellent and following our prompting'). The judge answers THREE questions and all three are catastrophes he approved by name: `identity` (is it her), `intact` (is the picture a real, complete render rather than blank, corrupted or garbled) and `people` (is there exactly one person in it). EVERY ONE OF THEM REFUSES — refunds the slice and drops the frame — because there is nothing left in this judge that is not catastrophic; `viewConformanceRefuses` is therefore `unjudged !== true && some axis failed`, and `REFUSING_AXIS`, a single axis name, is gone. WHAT IS NOT ASKED, and the absence is the whole of his ruling: the crop, the camera direction, the pose, what is concealed, and the clothing. No framing MEASUREMENT either — `viewFramingGeometry.ts`, the seven per-view bands, the 45 s deadline and `signEngine`'s refusal to build a judge without a segmenter credential are all DELETED, and so is the SPECIFICATION the judge used to be posted (`packageViewExpectation`, which had no other caller). A judge handed a framing sentence answers it, in the note if not in the verdict, so the absence is driven at the wire in both turns rather than asserted at a constant. ⚠ ONE CATASTROPHE IS NOT LEFT TO A MODEL, AND THAT IS THE REPAIR OWED ON PR #1915 — working law 3, a backstop needs a test the model cannot rescue. 'intact' used to be answered ONLY by the vision call, so a frame the judge could not be asked about at all — a provider rejecting a broken image as non-retryable is the measured shape — fell through to 'unjudged', and D-246 DELIVERS an unjudged view and CHARGES for it: catastrophe 2 reached a paying customer by the one road built to protect a view nobody could look at. 'readFrameIntegrity' (judgeFrame.ts) now reads the candidate's own bytes BEFORE the model is called, and a frame that is not a picture is refused and refunded without a model call at all. TWO ARMS, because the measurement says neither would do alone: a STRICT decode (sharp failOn:'truncated') catches a damaged or truncated file, and a NEAR-UNIFORM read catches a blank one. A truncated frame is not quiet but LOUD — a real production view cut in half paints down to the cut and is solid black below, scoring 96.50, the highest variance of anything measured including every real frame — so a variance test reads truncation as the most picture-like thing in the set; and a solid-grey frame is a perfectly valid PNG every decoder accepts, so a strict decode cannot see it. THE THRESHOLD IS MEASURED, NOT CHOSEN, on the whole delivered population rather than a sample: all 93 landed views that still have bytes (8 more had been swept from storage), scored by lowest per-channel standard deviation — the real FLOOR is 24.57, the most picture-like blank built is a soft gradient at 5.79, a flat field 0.00, and the line sits at 12, which is 2.1x above the one and 2.0x under the other. ITS POSITIVE CONTROL IS THE ARM THAT MATTERS on a money path: the strict decode refused 0 of 93 real delivered frames, under both 'truncated' and the stricter 'warning'. Alpha is excluded and that is load-bearing — a fully opaque RGBA frame has an alpha channel of stdev 0.00, so a reader taking the minimum over ALL channels would score every opaque picture at zero and refund the entire product. The anchor is never gated (a different failure with a different owner, already fail-closed by identity refusing on 'unsure'), and 'people' and 'identity' stay model-only: there is no cheap deterministic count of people in a photograph and inventing one would be the approximation the fidelity law forbids. A deterministic refusal is a REFUSAL and not 'unjudged', which is the distinction the whole arm turns on — 'unjudged' delivers. ONE DECLARED ASYMMETRY, and it is the only judgement the ruling did not make: identity refuses on `unsure` as well as `differs` (§I in full, #1229 untouched), and the other two refuse only on `differs`. His list is three things a picture IS; 'I cannot tell whether this picture is broken' is not a detection of a broken picture, and refusing there would re-import the over-refusal he removed. `AXIS_REFUSES_ON_UNSURE` is the one place that rule lives. WHAT IT GIVES BACK AND WHAT IT DOES NOT: the four segmenter reads per Sign at ~1c each stop being bought, and THE WALL CLOCK DOES NOT IMPROVE — the measurement ran in parallel inside the judge's own 23-36 s call, so this removes a cost and not a wait. `falBudget.ts`'s four paths and their sum of 19 are untouched (the reads were on the shared `FAL_CONCURRENCY` courtesy pool). WHY, and it is a measurement rather than an argument — kept from #1612 because his ruling rests on it: read at the production rows, every signed Cast all time, this product had refused 8 views — 5 on wardrobe, 3 on angle, and NOT ONE on identity. So every refusal it had ever made took a picture away for a reason that is not 'it is not her', and four of those eight are the four same-day cards (#1582, #1594, #1595, #1611) where the reading was simply wrong about what it was looking at. #1612 part 2 answered that by letting those two axes DELIVER; #1903 answers it by not asking them, which needs no two-tier rule and no `Unchecked` mark. WHAT #1612 PART 2 LEFT BEHIND ON THE ROWS, AND IT IS NOT HYPOTHETICAL: `viewDeliveredUnchecked` still reads TWO roads into the unchecked mark — `conformanceMethod: unavailable` (nobody looked, D-246) and a RECORDED axis that did not pass. The second road is live HISTORY: part 2 merged on 2026-10-07 and three landed rows carry a failing `angle` axis under a real judge method (assets 383, 389, 391), each owed a free Try again. So the reader iterates the CURRENT axis set PLUS the retired `angle` and `wardrobe` (`RECORDED_CONFORMANCE_AXES`) for as long as the free Try again exists — iterating only the current set would have taken a free retry off three paying views with nothing failing anywhere. A row with no conformance record at all keeps its old answer, which was measured rather than assumed: 20 of 69 landed views have none. FROM HERE ON, NO VIEW IS MARKED: a delivered view has no failing axis to record, because every axis that can fail refuses. The only remaining road to `Unchecked` is `unavailable` — nobody looked at all — which is D-246 and is untouched. The regeneration budget is likewise only ever spent on a catastrophe. ⚠ THIS CLAUSE SAID THE REST OF #1903 WAS NOT BUILT AND HALF OF IT IS BUILT NOW — slice 2, the PAID whole-package redo, landed at 350 display credits and has its own note below. WHAT IS STILL NOT BUILT IS SLICE 3: the `Unchecked` mark and its free Try again are untouched and still live. That is deliberate and it is the order this clause itself prescribed — removing the free offer before the paid redo existed would have left a customer who dislikes a picture with nothing to press — so the redo went first and the mark comes second. THE CUSTOMER SURFACE: a delivered view carries no label and no verdict word — no axis name, no percentage, nothing to interpret. A refused view confesses ONE SENTENCE AND IT IS NOW THE RIGHT ONE PER CATASTROPHE — the repair owed on PR #1915, and it was a customer-visible defect the removal sweep walked past. A single string, 'This view didn't hold the signed likeness', was set for EVERY refusal and reaches the customer verbatim in the room's failed tile and the health dialog, so the day this card gave the judge two more catastrophes a blank frame and a two-person frame both told a paying customer the picture wasn't her. It is now: a damaged frame 'This view came back damaged', a wrong-people frame 'This view didn't come back with your cast alone in it', identity his own sentence unchanged, and a refusal naming no axis the product knows 'This view didn't come out right'. The record is exhaustive over the axis set, so a fourth axis cannot ship without its copy, and when several axes fail the DAMAGE is confessed first — nothing can be recognised in a half-black picture, so an identity-first reading would tell a customer their picture is not them when what actually happened is that it did not render. No axis name, no verdict word, no number reaches her.",
      "Description-stated ink rides the sign THROUGH THE DESCRIPTION even where the waist-up master cannot show it (founder ruling, fable-1356 §4) — the full-length views show arms and legs; a view that delivers it mints its crop as the document going forward.",
      "The wire is inert by ABSENCE OF INPUT, not fenced by flags: a cast with no delivered crop composes yesterday's prompt byte for byte (the empty-is-not-fenced lesson).",
      "The wardrobe judge checks the stored line once the Two Paths land — generator and judge share one owner so they cannot drift.",
      "TRY AGAIN ON ONE VIEW (#1208 slice 2, #1220 slice 2, his rule verbatim 2026-09-25: 'you pay 50 for each view you keep'): a delivered Cast's tile offers ONE button whose price is the whole difference between the two roads — a view that FAILED was refunded, so asking again is a paid view at `CAST_PACKAGE_VIEW_PRICE`; a view that arrived UNJUDGED (D-246, `conformanceMethod: unavailable`) was charged and kept, so asking again is free. The offer is read ONCE, by `castSlotRetryOffer` over the projection the room is shown, and the entrance re-reads that same function before it spends — there is no second opinion about what a tile may ask for. The render is `renderViewAttempts`, the Sign's own attempt loop called rather than copied, so a retried view carries her delivered ink crops, her carried feature words and her snapshotted outfit exactly as the Sign's did. Its money is Sign's pattern under an operation of its own (`castingV2.viewRetry`): charged at dispatch, refunded in full when it does not arrive, and the sweep's fork variable is the retried asset's own `provenance.retryOperationId`. Every refusal is free and before the claim (no offer on the slot, no render source, the anchor object gone) and NOTHING is offered while the package is still building, because the Sign still owns every slot. Like the rest of this road its refusals are service-internal and outside the declared door set.",
      "ASK FOR ALL HER VIEWS AGAIN — THE PAID REDO (#1903 slice 2, his ruling 2026-10-07 verbatim: 'maybe we should allow retry by default incase they didnt like the outfit that was invented or whatever but it costs per retry and regens all views not just one', and his price asked and answered the same sitting: '350'). ONE BUTTON ON THE WHOLE CAST, under the count of what she has, beside the only other whole-Cast action there is. IT NEEDS NO FAULT TO BE FOUND FIRST and that is the feature — every other road to a second render here is a remedy (a failed view was refunded, an unchecked one is owed a free look), and this one answers the question no machine can: is this the person I was trying to cast? So there is no eligibility to compute, no verdict to consult and NO FREE BRANCH; `castPackageRedoOffer` has exactly two refusals, she is still being made and something of hers is already in flight, and both are read off the projection the room is shown. HIS ONE PRICE IS FIVE SLICES AND THE REFUND IS WHY: his card keeps the catastrophic refund rule unchanged and that rule gives back ONE view, so the unit that can fail has to be the unit that is charged — `CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS` per view, five of them, each a whole display number (70), which is the property the Sign's own 3,500 + 5 x 1,000 was chosen for. The total is DERIVED from the view list (`CASTING_V2_PACKAGE_REDO_PRICE_CREDITS`) and the offer prices HER slots rather than today's profile: a package is a historical record, two Casts own a retired `walk`, and quoting the five-view total on a six-view Cast would print one number on the button and charge another at the till. ⚠ THE DECLARED COST OF PER-SLICE, named rather than discovered: in a partial failure the package is briefly MIXED — four views in the new outfit beside one in the old — which is the one thing a redo exists to avoid; the alternative, all-or-nothing, spends house money on renders nobody receives and hands the customer nothing new for a charge they then watch come back. FIVE OPERATIONS, ONE PRESS, UNDER THEIR OWN KIND (`castingV2.packageRedo`): the per-view operation is the unit the sweep already settles correctly, so recovery REUSES the Try again's adjudicator with its own words rather than a second two-hundred-line reading of the same ledger — the fork variable is identical (did a picture land under THIS operation) and only the sentence differs. The five `clientRequestId`s are DERIVED from the press (`derivedClientRequestId`, the RFC name-based shape), so a double press replays the same five operations instead of buying a second package. ALL FIVE ARE CLAIMED BEFORE ANY MONEY MOVES, which is this road's one structural addition: a claim is free, so claiming the whole set first turns 'somebody is already asking for her profile' into a refusal that has charged nothing. It takes THE SAME per-slot lock the Try again takes, so the two roads are mutually exclusive structurally rather than by a read — a cast-level `model:` key would have been the tempting choice for a whole-package operation and would NOT have collided with the per-slot keys at all, leaving two roads free to render one slot concurrently and the later commit to throw away a picture the customer paid for. The whole price is also proved affordable at the admission, because a redo must not be able to buy PART of a package. THE OUTFIT IS ONE FRESH PLATE and this is the OPPOSITE of #1474's rule, deliberately: a single-view retry is dressed by its DELIVERED SIBLING because the outfit of record already exists and a fresh plate would put the one disliked slot in a different outfit from the four kept — a redo is the case where there IS no outfit of record worth keeping, since disliking the invented outfit is the example in his own ruling, so copying the sibling would re-deliver the very thing being redone. His rule behind #1474 is untouched: no plate is stored, no wardrobe card is written, nothing is reused. THE CUSTOMER SURFACE: the price is ON the button (his standing rule, prices on paid buttons) spelled `credits` and never `CR` (#1908), converted through the one converter (#1600); no engine name, no `redo`, no `package`, no axis, and the noun is the one the strip already uses, which is VIEWS. His 2026-09-26 ruling that took the number off the Try again ROW is not in tension with it — that is a muted caption under one picture and this is a deliberate purchase. ⚠ ONE FINDING FOR HIM RATHER THAN A QUIET FIX, and it is arithmetic between two of his own numbers: 350 display for FIVE views is BELOW the 370 he set for a SINGLE paid Try again on #1601, whose stated basis was 'needed to keep every worst case profitable' for one render plus its check. So a customer who dislikes one view pays LESS to replace all five, and the house pays five renders for less than it charges for one. His number ships as he said it; the reading is on the card.",
    ],
  },
  {
    id: "ink-studio",
    procedures: [
      "castingV2.ink.remove",
    ],
    title: "The ink studio — uploads, cuts, and the region road",
    entrances: ["server/castingV2/inkUploadService.ts", "server/castingV2/inkUploadDoor.ts", "server/castingV2/inkReferenceCutter.ts"],
    summary:
      "A customer's tattoo design is stored as OUR COPY under the cast's purge path, capped at 8 per cast. The cutter "
      + "isolates the design from its photograph (zero-RGB below the mask — the person leaves the BYTES, not just the "
      + "alpha); the padded licence stops a photograph of a person riding whole; the region road cuts the SURFACE she "
      + "pointed at with the face taken out; small cuts are enlarged by a faithful super-resolution model, never a "
      + "diffusion one.",
    doors: [],
    doorsNote:
      "The upload door's refusals (placement, size, format, edge, intent, cap) are its own vocabulary, censused via its "
      + "suite rather than the refine corpus. An upload-entrance corpus is future work — it needs bytes fixtures.",
    flags: ["CASTING_INK_STUDIO_SCOPE", "CASTING_INK_CUT_SCOPE", "CASTING_INK_REGION_CROP_SCOPE", "CASTING_INK_REFERENCE_SCOPE"],
    notes: [
      "The licence is a COUNT and never geometry; no percentage floor may ever be added (a floor that excludes the paper admits the man).",
      "The widening tripwire: the studio scope does not widen past users:1 while any upload can reach an engine uncropped.",
    ],
  },
  {
    id: "references",
    procedures: [
      "castingV2.reference.attach",
    ],
    title: "References — attach a picture, take a feature",
    entrances: ["server/castingV2/referenceAttachDoor.ts", "server/castingV2/hairReferenceTake.ts", "server/castingV2/inkReferenceTake.ts"],
    summary:
      "Attach stores the customer's picture unchanged (a copy, ours to purge; the digest means byte identity later) and "
      + "hands back a handle — nothing is read, cut, or charged at attach. A refine carrying the handle routes the take: "
      + "hair colour as words she adopts, style and whole-look as a crop; a pointed-at tattoo documents the design. One "
      + "reference at a time by ruling; the Pinterest-style selector is the road's next build.",
    doors: [],
    doorsNote: "The attach/take doors are their own vocabulary; a reference-attached census state exists in the corpus and is the next fixture to build.",
    flags: ["CASTING_REFERENCE_ATTACH_SCOPE", "CASTING_HAIR_REFERENCE_SCOPE", "CASTING_INK_REFERENCE_SCOPE"],
    notes: [
      "What returns to a caller is the storage KEY, never a URL — the server fetches bytes itself; the address is the only thing between a photograph of a person and a stranger.",
    ],
  },
  {
    id: "panel-scan",
    procedures: [
      "castingV2.facePanel",
      "castingV2.faceScan",
    ],
    title: "The panel and the scan — what a cast shows about itself",
    entrances: ["server/castingV2/facePanel.ts", "server/castingV2/faceScanService.ts"],
    summary:
      "The panel's rows come from the catalogue; content comes from the library and the delivery crops (the chain "
      + "decides, the store looks up). The auto-scan fills empty rows on first look by asking a segmenter where each "
      + "catalogue feature is (closed checklist — it cannot see tattoos or open kinds; cast-born discovery is the queued "
      + "widening); a clean scan is kept in casting_face_scans, geometry only, stencils as objects under the purge path.",
    doors: [],
    doorsNote: "Panel and scan speak in projections, not refusal ids; their guarantees are pinned by their own suites.",
    flags: ["CASTING_FACE_SCAN_SCOPE", "CASTING_SCAN_TABLE_SCOPE"],
    notes: [
      "Discovery mints nothing into a recipe — the panel shows crops the founder's eyes judge; a crop becomes a carry only through the roads built for that.",
    ],
  },
  {
    id: "reimagine",
    title: "Re-imagine — one press turns her own words into a new idea, in her own box",
    entrances: ["server/routes/castingV2.ts", "server/castingV2/reimagine.ts"],
    procedures: ["castingV2.reimagine"],
    summary:
      "Wherever there is a brief box, one press sends the words IN the box through the author and writes the result "
      + "back INTO the box — visible, editable, undoable; casting then uses whatever is in the box, so there is no "
      + "hidden mode a sheet could lie about. Sex, age and species are LOCKED when typed and nothing else is; "
      + "lighting, camera, framing, backdrop and scene are banned in the instruction. One press is at most two text "
      + "calls — a draft, then one re-ask naming the refusal — and a second refusal or a failed call answers "
      + "`nothing`, leaving the box exactly as she typed it. Nothing is charged, nothing is stored, nothing renders.",
    doors: [],
    doorsNote:
      "THIS ROAD DECLARES NO DOOR, AND THAT IS ITS SHAPE RATHER THAN A GAP (#1203). Its three exits are none of the "
      + "four declared shapes the census reads: outside CASTING itself it answers `NOT_FOUND` "
      + "(`captureCastingV2Enabled` in `server/routes/castingV2.ts` — it was the register's capture until "
      + "#1443 retired that flag, and the casting parent was already ANDed inside it, so the population this "
      + "door refuses has not changed) — a DARK door, not a refusal, "
      + "because a code saying 'not yet' advertises a capability; the ceiling is `RATE_LIMITS.reimagine` "
      + "(`server/security/rateLimit.ts`); and every other outcome is the free answer `{ kind: \"nothing\" }` — no "
      + "text engine configured, the author's SECOND draft refused too, or the call threw (both of the last two "
      + "inside `reimagineBrief`, `server/castingV2/reimagine.ts`). The customer reads ONE sentence for all three "
      + "(`Nothing to offer this time — your words stand.`, `client/src/features/castingV2/components/Reimagine.tsx`) "
      + "and that is deliberate: an outage and a refusal ask her for the same next act. ⚠ AND NO CORPUS ROW CAN "
      + "REACH THIS ENTRANCE — the corpus drives `refineCandidate` and nothing else, so #1203's own instruction to "
      + "add 'a corpus row per door' is not something this harness can do; a reimagine corpus needs its own driver, "
      + "and that is the map's next growth ring here.",
    /* `CASTING_CREATIVE_REGISTER_SCOPE` stood beside the parent here until #1443 retired it. */
    flags: ["CASTING_V2_SCOPE"],
    notes: [
      "IT REPLACED THE IMAGINATION METER ENTIRELY (#535, his 'build it', Crew replies #145/#146, 2026-09-06): there is no level, no mode and no setting between the box and the picture except Style, so the #252 lie — a sheet reading 'Max' over words nobody authored — has nothing left to fall out of. The design is `docs/specs/REIMAGINE_DESIGN_2026-09-06.md` §3.",
      "A NEW IDEA, NOT A POLISH, and the locked trio is the whole of what survives verbatim (his decisions 3–4). An earlier reading had every named feature and material surviving; his own rolled courts overturned it at the frames (244 vs 245, '10x better'; 243 vs 246, 'much better') — named colours and materials are PIECES the author may reinvent, and the qualities paragraph beat the keep-every-piece paragraph both times.",
      "THE BOX IS THE FIDELITY CONTROL. `droppedFactIn` is retired for this road on purpose: the result lands in the customer's own box where she reads, edits and undoes it before she spends, so her reading is the check that a fact-survival guard used to be.",
      "AN EDITING INSTRUCTION IN THE BOX ('make her young', '50s') is applied by the SAME press and returns one clean brief (decision 11) — never appended to the sentence, never handled on the way to the engine.",
      "The reader is `about: \"author\"` on the engine, so a census pricing authored prose counts these presses with the roll's author calls rather than missing them.",
    ],
  },
  {
    id: "concept-upload",
    title: "Upload a concept — a picture in, a description of the person out",
    entrances: ["server/routes/castingV2.ts", "server/castingV2/conceptDescribe.ts"],
    procedures: ["castingV2.concept.describe"],
    summary:
      "A picture of a person is read ONCE, inline, and dropped; what comes back is WORDS, which land in her own brief "
      + "box where she reads and edits them before she spends anything. There is no row, no table, no storage write "
      + "and no purge path — which is what makes this road smaller than the attach door beside it rather than a "
      + "variant of it, and why no stranger's photograph ends up at a permanently public URL. Reached from the start "
      + "page, before any cast exists.",
    doors: [
      "concept.no_being", "concept.not_about_the_person", "concept.not_a_casting_note",
      "concept.ran_long", "concept.unreadable", "concept.no_transport",
    ],
    doorsNote:
      "⚠ THIS ROAD'S DOORS REACHED THE MAP BEFORE THE ROAD DID — the six were declared with #192 and every one of them "
      + "is documented-unreachable (the corpus sends sentences, not pictures), while the ENTRANCE they belong to had no "
      + "road until #1203. That is the forward/backward asymmetry in one specimen: the map could prove every door it "
      + "named was real and could not notice it had never named the road. The FLAG and the two byte doors above the "
      + "six are still outside the declared set: `NOT_FOUND` off `captureCastingConceptUploadEnabled`, and the shared "
      + "`referenceAttachBytesRefusal` / `BYTES_NOT_AN_IMAGE_MESSAGE` pair, which are the ink door's own sentences "
      + "reused rather than restated.",
    /* The register sat between these two until #1442 re-parented the child and #1443 retired the flag. */
    flags: ["CASTING_V2_SCOPE", "CASTING_CONCEPT_UPLOAD_SCOPE"],
    notes: [
      "His own order, 2026-08-28 (#185): 'if you have a model already or concept or image you can upload it the image analyzer will analyze and describe it to the authour and cast it with the description ... that way its easy for someone to upload an image and get a prompt to create someone similar without having to type it all out.' Production holds `CASTING_CONCEPT_UPLOAD_SCOPE` at `all` since 2026-09-24 on his Crew reply #202 ('yes, turn it on').",
      "THE FORMAT IS WHAT THE BYTES ARE, never what the payload claimed — the ink door's rule reused. It matters twice here: the picture rides to the describer as a `data:<mime>;base64,` URI, so a JPEG announced as a PNG is a malformed request to the vendor rather than a bad row in our database.",
      "EVERY REFUSAL IS A DIFFERENT SENTENCE ON PURPOSE: 'there is nobody in this picture' and 'the reader did not answer' ask her to do different things, and telling her the wrong one sends her looking for a better photograph of a problem that was ours. They live in `CONCEPT_DESCRIBE_COPY` — exhaustive over the union by type — because composed inline they were invisible to the census: three of this entrance's five refusals could not be seen at all (#192).",
      "`concept.no_being` is the twin of the roll road's `not_a_being`, and it reached the map FIRST while its sibling stayed invisible — the pair is the reason both entrances' copy tables are now the declared source rather than a grep.",
    ],
  },
];

/**
 * PROCEDURES NO ROAD ACCOUNTS FOR — the enumerated remainder, and it only
 * shrinks (`UNREACHABLE_DOORS`' rule, pointed at entrances instead of doors).
 *
 * A `castingV2` procedure that no road names is an ERROR unless its id is a key
 * here with a written reason. A key that a road HAS since taken, or that the
 * entrance no longer exposes, is also an error — so the line has to be deleted
 * rather than left to read as a standing excuse.
 *
 * ⚠ IT IS EMPTY TODAY AND THAT IS THE POINT, not a reason to delete it. #1203
 * found TWO unmapped entrances (`castingV2.reimagine` and
 * `castingV2.concept.describe`) and both earned real roads, because the code to
 * describe them was there to be read. The next one may not be — a half-built
 * entrance, or one whose behaviour nobody has measured — and an honest "not yet
 * mapped, because X" beats either an invented road or a silent hole.
 */
export const UNMAPPED_ENTRANCES: Readonly<Record<string, string>> = {};

/**
 * THE BACKTICKED NAMES IN THE PROSE THAT THE TREE DOES NOT DECLARE — each with
 * its own reason (#1821, 2026-10-03).
 *
 * # What this closes
 *
 * The generator held every DOOR, FLAG, PROCEDURE and ENTRANCE in this file to
 * the source and refused to generate on a bad one. **It held no identifier in
 * the prose to anything.** So a backticked symbol in a `summary` or a `notes`
 * line was an unguarded mirror of the tree — working law 4 — and the cost was
 * measured rather than imagined: `CASTING_V2_RETRY_PRICE_CREDITS` was asserted
 * in the PRESENT TENSE as the live account-level retry quote for two days after
 * #1601 item 1 deleted it, on the map whose own header calls it *"the map an
 * agent reads to understand how the casting studio works"*, during his pricing
 * week. An agent quoting it would have told him a wrong price. That is law 7c's
 * own failure shape, in the artifact law 7c sends you to.
 *
 * # Why this list is SIX lines and not fifteen
 *
 * ⚠ **THE CARD PROPOSED "an enumerated exception list for door ids and
 * historical names" AND THAT WOULD HAVE BEEN THE DRIFT IT WAS GUARDING
 * AGAINST.** A door id is already a derived set in this very module's
 * generator; a module name is `git`'s to answer. Hand-listing either is a
 * second list shadowing a source of truth, and it rots in exactly the way the
 * stale symbol above rotted.
 *
 * So the exemptions are DERIVED and only the unmechanical remainder is written
 * here. Measured on the day it landed: **57 distinct backticked bare
 * identifiers in the road prose — 49 declarations, 1 door id, 1 module, and
 * these 6.** A list of six is a list a writer reads; a list of fifteen is a
 * list a writer appends to.
 *
 * # What earns a line
 *
 * Not "the check is inconvenient". A name belongs here when it is REAL prose
 * about something that is deliberately not a TypeScript declaration — a word
 * the customer reads, a token a log is grepped for, a wire code, or a symbol
 * whose DEATH is the sentence's content. The last of those is the valuable
 * kind, and it is the same argument `server/testing/suitePointers.ts` makes for
 * its own enumerated absences: a paragraph explaining that something died is
 * worthless without naming what died, and a guard that indicts it teaches
 * people to delete the history instead.
 *
 * ⚠ **An entry ROTS IN TWO DIRECTIONS and both redden.** If the tree starts
 * declaring the name, the excuse is now wrong and the line goes; if no road
 * says the name any more, the line is dead weight nobody can audit. Neither is
 * left to a reader to notice.
 */
export const UNDECLARED_PROSE_NAMES: Readonly<Record<string, { readonly why: string }>> = {
  packageViewExpectation: {
    why:
      "DELETED by #1903 (2026-10-07) — his ruling removed the framing and wardrobe axes, so the " +
      "judge is posted no specification at all and this function, whose only caller was " +
      "viewConformance.ts, had nothing left to answer. The road sentence naming it is the " +
      "obituary: it records WHAT stopped being sent, which is the content of the change. A " +
      "sentence that said only 'the judge sees no spec' would leave a later reader unable to " +
      "find what the spec used to be.",
  },
  REFUSING_AXIS: {
    why:
      "DELETED by #1903 (2026-10-07). It named the ONE axis that refused under #1612 part 2; " +
      "every axis the judge still has is a catastrophe he approved, so all of them refuse and a " +
      "single-axis constant had nothing to mean. The road sentence records its death because " +
      "'which axis refuses' is the question the previous rule was entirely about — the shape of " +
      "the change is not readable without the name that is gone.",
  },
  unsure: {
    why:
      "A VERDICT WORD the judge answers with, never a declaration — one of three in " +
      "AXIS_VERDICTS ('matches' / 'differs' / 'unsure'), which is where it is declared as a " +
      "string literal. The road sentence has to quote it because #1903's one declared asymmetry " +
      "IS about this word: identity refuses on it and the two catastrophe axes do not.",
  },
  CASTING_V2_RETRY_PRICE_CREDITS: {
    why:
      "DELETED by #1601 item 1 (2026-10-01) — a price nothing quotes may not sit in " +
      "castingCreditCosts.ts, which keeps only its obituary (invariant 7). The road sentence " +
      "naming it is that obituary and is in the PAST TENSE: it records that the constant was " +
      "the ROLL slice, that charging it would have made a mis-charge its own refund authority " +
      "through resetCandidateForRetry, and that a tile's price is the candidate row's own now. " +
      "⚠ THIS IS THE SPECIMEN THIS WHOLE CHECK EXISTS FOR — the same sentence asserted the " +
      "constant as LIVE until 2026-10-03, and nothing anywhere disagreed.",
  },
  unsupported_cohort: {
    why:
      "The brief wall RETIRED by #1495 (2026-09-30). The road sentence is the account of its " +
      "retirement — it names the wall a roll used to be stopped by, then the two-valued " +
      "author option that outlived it one module out and died too. Naming the dead wall is the " +
      "sentence's whole content; it is also the specimen capabilityAtlas.mts's own wrapped-raise " +
      "paragraph is written about, in the past tense, for the same reason.",
  },
  droppedFactIn: {
    why:
      "RETIRED for the Re-imagine road on purpose (#535) — reimagine.ts:50 carries the " +
      "retirement and the reason: the result lands in the customer's own box where she reads, " +
      "edits and undoes it before she spends, so her reading is the check a fact-survival guard " +
      "used to be. The road sentence says 'is retired for this road on purpose', which is a " +
      "design decision that cannot be recorded without the name.",
  },
  cohortWallRetried: {
    why:
      "A LOG-LINE TOKEN by design, never a declaration. interpreter.ts puts it in one string " +
      "'so the count is one grep' and prints the invocation — grep cohortWallRetried <the " +
      "service log> — in its own docblock. A word whose purpose is to be greppable in an " +
      "operator's terminal is exactly the kind of name that is not a symbol.",
  },
  NOT_FOUND: {
    why:
      "A tRPC error CODE on the wire, not a symbol this tree declares — it comes from " +
      "@trpc/server's own code set. The two doorsNote lines using it say what a door answers a " +
      "caller WITH, which is the wire's vocabulary and the right one for a map of entrances.",
  },
  Unchecked: {
    why:
      "The customer's own word, and the only word a customer ever sees on an unchecked view " +
      "(viewRetryRow.ts holds it as the VALUE of the `unchecked` key, so the declared name is " +
      "the key and the backticked word is the copy). The sign-views road quotes it to say what " +
      "the surface reads — no axis name, no verdict word, no percentage — which is the " +
      "disappearing-technology law being described, in the customer's vocabulary.",
  },
};

/**
 * THE LAWS — invariants that hold across every road. Each cites where it is
 * enforced or proven; the render carries them as the map's closing section.
 */
export const LAWS: ReadonlyArray<{ law: string; where: string }> = [
  { law: "Free before the claim: every refusal a customer can be told pre-claim costs nothing; charge-then-refund where the answer was knowable earlier is a defect.", where: "refineService.ts (attempt counter); census ledger arm" },
  { law: "The anchor is the pristine master; carries are words plus crops, never a chained delivered frame.", where: "refineService.ts source resolution; anchor-is-the-pristine-master (memory/courts)" },
  { law: "The id points and the row decides — names in a record are believed only where a row backs them; missing rows skip loudly.", where: "C4a (09f625a2); the carry's rescue; signInkCrops" },
  { law: "A reader's negative chooses a lane, never turns a customer away or becomes a durable fact about her cast.", where: "law 9 / fable-1052; C4b's closure" },
  { law: "Source containment: a free value must appear in the customer's own sentence; engine-picked exceptions are declared, labelled, and doored.", where: "refineDelta.ts (D-172); Two Paths design §4.1" },
  { law: "Derive, never mirror: one owner per fact (the wardrobe line, the served-placements lists, the refusal registry); second lists are defects.", where: "CLAUDE.md working law 4; wardrobeLine.ts (item 5)" },
  { law: "Every door has a name, a site, a pin and a reach — or a written reason; the census refuses the gap.", where: "capabilityAtlas.mts coverage contract (fable-1357)" },
  { law: "Every entrance a customer can call is on some road, or carries a written reason — the map is held to what EXISTS, not only to what it cites.", where: "capability-atlas-roads.mts `procedures` / UNMAPPED_ENTRANCES (#1203)" },
];
