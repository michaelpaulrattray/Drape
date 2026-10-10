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
      "castingV2.editCastPersonaField",
    ],
    title: "Sign — five views, the identity lock, and what rides into them",
    entrances: ["server/castingV2/signService.ts", "server/castingV2/packageOrchestrator.ts", "server/castingV2/inkViewReferences.ts", "server/castingV2/viewRetryService.ts", "server/castingV2/packageRedoService.ts", "server/castingV2/outfitPlate.ts", "server/castingV2/castPersona.ts"],
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
      "WHO SHE IS ON CAMERA AND HOW SHE SOUNDS ARE BORN HERE - N2b (#1242), his brief of 2026-09-25 and his rung word of 2026-10-08 (Desk reply #271, verbatim and entire: 'n2b'). A Sign now derives TWO SHORT LINES about the Cast and writes them onto her row: a PERSONALITY of at most two sentences, camera-visible traits only and shaped as a baseline plus its one exception, and a VOICE of one line of register and delivery. THREE SOURCES, all of them, and the reason is his: 'the brief supplies the register; the picture personalizes' - the roll's own brief text in her words (never `masterPrompt`, which is our composed photography instruction), her correction sentences from the refine she signed, and the SIGNED FRAME itself, which is why two siblings signed from one sheet come out as two different people. ONE TEXT CALL produces both lines, on the same model and road as the conformance judge (the same slug the judge is pinned to, or the interpreter default), filed under its own census word `persona` so 'what does a personality line cost us per Sign' is answerable - the disappearing-technology law's third clause. ⚠ NO STEP IS ADDED TO THE SIGN CEREMONY, and the placement is the whole of it: the read is STARTED the moment the signed frame is in hand and AWAITED AFTER THE SEAL, so it runs beside five 2K renders rather than in front of them and the views never wait on it; awaiting it earlier would add its latency to the first picture she sees. ⚠ A READ THAT FAILS WRITES NOTHING - no lines, no badge, and NO CARD AT ALL on her page rather than an empty one, which is his own rule against a feature that looks broken. The same is true of a deployment with no OpenRouter credential: `castingCastPersonaReader` answers null where the judge throws, because a studio that cannot draft two lines of prose should still deliver five pictures. A reader that throws, a write that throws, and a missing row are each logged and none of them fails the Sign or moves a credit. ⚠ THE BADGE IS DERIVED, NEVER STORED (working law 4): five columns - two of text, one draft stamp, two edit stamps - and `projectCastPersona` answers 'drafted and not since edited'. A stored `isDraft` would outlive the edit meant to clear it and the card would then call her own sentence a draft. TWO EDIT STAMPS AND NOT ONE, because the two lines are two cards: rewriting who she is must not un-badge how she sounds. HER EDIT IS FREE AND IS NOT A GENERATION - no credits, no lock, no operation row, no price on the control; `editCastPersonaField` resolves the Cast owner-scoped AND puts the owner in the update's own predicate (invariant 1), refuses an empty line rather than storing a blank card, and the mint's redraft can never land on a line she has rewritten. ⚠ NOTHING READS THESE TWO LINES TO BUILD A PROMPT ANYWHERE - law 9, the vision read PROPOSES and her eye rules, so they are shown to their owner and to nobody and nothing else until she has seen them. They are CREATIVE CONTENT in `masterPrompt`'s family under his ruling of 2026-07-25: owner-only, on no staff projection. OUT OF SCOPE and deliberately absent: the audio voice asset (the room's player skeleton and its 'arrives with voice' promise are untouched and still true), the personality cards and say-it-your-way doors spec'd for later, and any Cinema-side consumption. ⚠ THE PRICE AND THE CLOCK ARE ON THE PULL REQUEST FROM A DRIVEN MEASUREMENT rather than a list price, which is the same clause the plate note above answers.",
      "THE TWO ENGINES, THEIR DATE AND THEIR REASON (#1278 path E, his ruling 2026-09-29 — the disappearing-technology law's clauses 1-3: a model choice carries a date and a reason and is re-asked with a measurement on HIS fixtures). A Sign now uses TWO models because his two courts answered about two different jobs, and he said so in one line: 'Sunburst was only chosen because it was more creative in outfit design. NBP2k was a better quality rersult though.' So — a DELIVERED VIEW renders on NANO BANANA PRO at the `2K` tier (1696x2528), his quality choice; and ONE WARDROBE PLATE per Sign renders on GPT IMAGE 2.5 SUNBURST at `high`, through Sunburst's EDIT door at 3504x2336 WITH HER SIGNED MASTER AS ITS ONE REFERENCE, his creativity choice. ⚠ THE PLATE WAS DRAWN FROM WORDS ALONE FOR ONE DAY AND HIS RULING ENDED IT (#1471, 2026-09-29, verbatim and entire): 'no the plate must reference the master image otherwise it wouldnt be able to invent the outfit correctly'. A plate that cannot see the top she was SIGNED in invents a different one, and the full-length view is then told to take the clothes from the plate — so the product would contradict a picture the customer had already accepted, above the waist, by design. Driven on his own Sifr the day it changed: the words-only plate came back a DIFFERENT WOMAN in a long slit dress; the master-edited plate is HER, wearing the master's own high-neck clasp, its two buckled shoulder straps, its chest graphic and its tattoo sleeve on the correct arm, with one hem and one pair of boots front and back. The plate is therefore HER and not a floating garment — also his word, on the relay's reading that two references which agree on identity cannot fight: 'i agreew tih you'. A BEING WITH NO OUTFIT GETS A PLATE TOO and there is no no-wardrobe gate: for a creature the plate is the lower body invented once — hide, scales, feet — which is what the two full-length views need to agree on, and the view's clause says so in as many words. Measured on cast #58, a signed alien: the plate LANDED rather than being refused, and its panels carry the whole body below the master's crop. The plate is two panels of one outfit — the product's own `frontFull` and `backFull` cameras, taken by name, never invented (his rule 2026-09-27: 'the sheet should copy the exact angles and camera views the current views use not invent new ones') — cut in half in memory and handed to those two views as a reference. NOTHING THE PLATE PAINTS IS EVER DELIVERED OR STORED. This SUPERSEDES #1459, which had put the delivered views on Sunburst's edit door at 2352x3504; it was right on its own question and is superseded inside path E's own PR by his instruction, never reverted separately. THE PRICE AND THE CLOCK, because a finding without them is not decision-grade: the plate is ONE EXTRA RENDER per Sign at ~$0.11-$0.15 of house money, no customer credit, and it runs IN PARALLEL with the three views that do not wear it — so a customer waits the plate's render standing where the full-length pair's would have started, not added to it. Measured through the real doors on his Sifr, 2026-09-29: plate 42.1 s, a delivered view ~29-34 s, six renders for $0.72 settled. Re-measured on the EDIT door the same day (#1471): plate 70.8 s on Sifr and 55.9 s on the creature — slower than the words-only plate, because the door now reads a 2.6 MB master — a delivered view 30-35 s, four renders for $0.43 settled, and the landscape ask survives a portrait reference (3504x2336 asked, 3504x2336 returned, read at the bytes). WHAT THE COURT SHOWED, and it is his defect reproduced and closed: master-only gave a plain midi with white boots at the FRONT and a MINI skirt with BLACK boots at the BACK — two outfits in one package, which is his 'the hem and shoes differ every take' — while master+plate gave one garment, one hem and one pair of boots both ways. His eye on a real Sign's strip is what closes it (law 9). NOTHING NAMES EITHER ENGINE ON A CUSTOMER PATH — no button, no loader, no refusal — and there is no flag: his word was the flip. The paid refine's non-repaint edit is untouched and is still Nano Banana Pro at 1K (`server/castingV2/refineService.ts`).",
      "THE PLATE MOVES THE DELIVERED PICTURE'S SHAPE UNLESS IT IS PINNED, and that was found by driving rather than by reading (#1278, 2026-09-29). Nano Banana Pro reads its output shape off its REFERENCES: measured on the real door, the same view came back 1696x2528 master-only, 1792x2400 with a 3:4 plate panel beside the chest-up anchor, and 1696x2528 again with `aspect_ratio: 2:3` pinned. Unpinned, path E would have shipped a five-view package with two views a different shape from the other three — a thing a customer sees at a glance in a strip of five and no test would have failed. It is pinned ONLY on the two views that carry a plate; the other three compose the request they always did. `aspectRatio` had never been set by any caller on any road before this, so the door's vocabulary was unverified here and the value above is the answer it gave rather than a table's.",
      "A PLATE FAILURE NEVER FAILS THE SIGN and never refunds (his rule, path E). Every fault — a refusal, a timeout, a dropped connection, an unsplittable plate, a credential nobody set — answers 'no plate', and the two full-length views then render master-only, which is byte for byte the request this road sent before path E. The one thing the plate road re-throws is a CANCELLATION, because an abort is the Sign being torn down rather than the plate failing, and the orchestrator catches that in turn: a view that is never ATTEMPTED is the single failure mode on this road with no refund path out of it (its audit row and its charge already exist). The plate is Sign/retry scratch — not a wardrobe card, not a looks card, not an R2 object, not customer-visible — so 'a new wardrobe means a new plate, never a reused one' holds by construction: nothing keeps one.",
      "The `2K` on a signed view's asset row is a TIER, never a pixel count, and #1459 left it alone on purpose. It never was a measurement — Nano Banana Pro answered `2K` with 1696x2528 and Sunburst answers 2352x3504 — it names the SIGNED-VIEW tier, the one the 1K anchor is not, which is the ROLE question `committedPackageAngles` and `unsettledPackageAngles` actually ask. A second label for the honest size would put two strings on one role across a live table whose existing rows cannot be relabelled without a row rewrite, and a reader still testing the old one would count a paid, landed view as never arrived. What carries the honest size instead is the row's own `provenance.engine`, stamped per asset, so a Sunburst row and a Nano Banana Pro row are told apart by the record rather than from memory.",
      "THE CHECK IS CATASTROPHIC-ONLY (#1903, his ruling 2026-10-07 terminal, verbatim: 'i think we ditch the measure and checker i mean it been nothing but problems it should only detect catastropic failure the image engine is excellent and following our prompting'). The judge answers THREE questions and all three are catastrophes he approved by name: `identity` (is it her), `intact` (is the picture a real, complete render rather than blank, corrupted or garbled) and `people` (is there exactly one person in it). EVERY ONE OF THEM REFUSES — refunds the slice and drops the frame — because there is nothing left in this judge that is not catastrophic; `viewConformanceRefuses` is therefore `unjudged !== true && some axis failed`, and `REFUSING_AXIS`, a single axis name, is gone. WHAT IS NOT ASKED, and the absence is the whole of his ruling: the crop, the camera direction, the pose, what is concealed, and the clothing. No framing MEASUREMENT either — `viewFramingGeometry.ts`, the seven per-view bands, the 45 s deadline and `signEngine`'s refusal to build a judge without a segmenter credential are all DELETED, and so is the SPECIFICATION the judge used to be posted (`packageViewExpectation`, which had no other caller). A judge handed a framing sentence answers it, in the note if not in the verdict, so the absence is driven at the wire in both turns rather than asserted at a constant. ⚠ ONE CATASTROPHE IS NOT LEFT TO A MODEL, AND THAT IS THE REPAIR OWED ON PR #1915 — working law 3, a backstop needs a test the model cannot rescue. 'intact' used to be answered ONLY by the vision call, so a frame the judge could not be asked about at all — a provider rejecting a broken image as non-retryable is the measured shape — fell through to 'unjudged', and D-246 DELIVERS an unjudged view and CHARGES for it: catastrophe 2 reached a paying customer by the one road built to protect a view nobody could look at. 'readFrameIntegrity' (judgeFrame.ts) now reads the candidate's own bytes BEFORE the model is called, and a frame that is not a picture is refused and refunded without a model call at all. TWO ARMS, because the measurement says neither would do alone: a STRICT decode (sharp failOn:'truncated') catches a damaged or truncated file, and a NEAR-UNIFORM read catches a blank one. A truncated frame is not quiet but LOUD — a real production view cut in half paints down to the cut and is solid black below, scoring 96.50, the highest variance of anything measured including every real frame — so a variance test reads truncation as the most picture-like thing in the set; and a solid-grey frame is a perfectly valid PNG every decoder accepts, so a strict decode cannot see it. THE THRESHOLD IS MEASURED, NOT CHOSEN, on the whole delivered population rather than a sample: all 93 landed views that still have bytes (8 more had been swept from storage), scored by lowest per-channel standard deviation — the real FLOOR is 24.57, the most picture-like blank built is a soft gradient at 5.79, a flat field 0.00, and the line sits at 12, which is 2.1x above the one and 2.0x under the other. ITS POSITIVE CONTROL IS THE ARM THAT MATTERS on a money path: the strict decode refused 0 of 93 real delivered frames, under both 'truncated' and the stricter 'warning'. Alpha is excluded and that is load-bearing — a fully opaque RGBA frame has an alpha channel of stdev 0.00, so a reader taking the minimum over ALL channels would score every opaque picture at zero and refund the entire product. The anchor is never gated (a different failure with a different owner, already fail-closed by identity refusing on 'unsure'), and 'people' and 'identity' stay model-only: there is no cheap deterministic count of people in a photograph and inventing one would be the approximation the fidelity law forbids. A deterministic refusal is a REFUSAL and not 'unjudged', which is the distinction the whole arm turns on — 'unjudged' delivers. ONE DECLARED ASYMMETRY, and it is the only judgement the ruling did not make: identity refuses on `unsure` as well as `differs` (§I in full, #1229 untouched), and the other two refuse only on `differs`. His list is three things a picture IS; 'I cannot tell whether this picture is broken' is not a detection of a broken picture, and refusing there would re-import the over-refusal he removed. `AXIS_REFUSES_ON_UNSURE` is the one place that rule lives. WHAT IT GIVES BACK AND WHAT IT DOES NOT: the four segmenter reads per Sign at ~1c each stop being bought, and THE WALL CLOCK DOES NOT IMPROVE — the measurement ran in parallel inside the judge's own 23-36 s call, so this removes a cost and not a wait. `falBudget.ts`'s four paths and their sum of 19 are untouched (the reads were on the shared `FAL_CONCURRENCY` courtesy pool). WHY, and it is a measurement rather than an argument — kept from #1612 because his ruling rests on it: read at the production rows, every signed Cast all time, this product had refused 8 views — 5 on wardrobe, 3 on angle, and NOT ONE on identity. So every refusal it had ever made took a picture away for a reason that is not 'it is not her', and four of those eight are the four same-day cards (#1582, #1594, #1595, #1611) where the reading was simply wrong about what it was looking at. #1612 part 2 answered that by letting those two axes DELIVER; #1903 answers it by not asking them, which needs no two-tier rule and no `Unchecked` mark. ⚠ #1903 IS COMPLETE AND THE UNCHECKED MARK IS GONE — SLICE 3, 2026-10-07's ruling, built once slice 2's paid redo was live. This clause carried a long account of what #1612 part 2 left on the rows: a delivered-unchecked reader with TWO roads into the mark (`conformanceMethod: unavailable`, nobody looked; and a RECORDED axis that did not pass), iterating the retired `angle` and `wardrobe` names 'for as long as the free Try again exists' so that three live rows would keep a free ask. THAT CONDITION IS NOW MET AND ALL OF IT IS DELETED: the reader, both axis lists, the `unjudged` wire field, the room's `Unchecked` word, the free branch in `castSlotRetryOffer`, and the one-free-then-paid accounting on the operation rows (`spentFreeViewRetryFilter`, `listSpentFreeViewRetryAngles`, #1601 item 4). A DELIVERED VIEW NOW CARRIES NO ROW AT ALL — no word, no link, no price — whatever the judge managed to say about it, and the only Try again that remains belongs to a REFUNDED view and is paid. ⚠ THE WITHDRAWAL WAS MEASURED BEFORE IT WAS MADE, BECAUSE IT TAKES A FREE RENDER AWAY FROM ROWS THAT EXIST: read at production 2026-10-08 (`scripts/_1903-unchecked-population-disposable.mts`, read-only), of 119 landed rows carrying a provenance exactly SIX read unchecked — assets 317, 322 and 324 under `unavailable` and 383, 389 and 391 with a failing `angle` — and ALL SIX BELONG TO USER 1. The only other account that has ever cast is the team's own design agent (3 rolls). So no paying stranger loses an offer, and the 44 rows carrying no conformance record at all are untouched exactly as before. WHAT IS NOT RETIRED, and the distinction is the whole of the change: D-246 still DELIVERS and CHARGES for a view nobody could judge, and the judge still RECORDS its verdict on every landed row for diagnosis — what has gone is the customer-facing consequence of reading that record, which was an apology label and a free per-view ask. His remedy is the paid whole-package redo below, which needs no fault found first and re-makes every view together. The regeneration budget is likewise only ever spent on a catastrophe. THE CUSTOMER SURFACE: a delivered view carries no label and no verdict word — no axis name, no percentage, nothing to interpret. A refused view confesses ONE SENTENCE AND IT IS NOW THE RIGHT ONE PER CATASTROPHE — the repair owed on PR #1915, and it was a customer-visible defect the removal sweep walked past. A single string, 'This view didn't hold the signed likeness', was set for EVERY refusal and reaches the customer verbatim in the room's failed tile and the health dialog, so the day this card gave the judge two more catastrophes a blank frame and a two-person frame both told a paying customer the picture wasn't her. ⚠ THE THREE SENTENCES ARE YUNA'S AS OF #1904 (2026-10-08, posted with his 'go with A'), AND 'signed likeness' IS GONE EVERYWHERE — it was a term of art from the pipeline standing on a path a refused customer cannot avoid, which is the disappearing-technology law's own example of the machinery showing through. They are now: a broken frame 'This view came out broken, so we didn't keep it', a wrong-people frame 'This view didn't show just {name}, so we didn't keep it', and identity 'This view didn't clearly look like {name}, so we didn't keep it' — with a refusal naming no axis the product knows still 'This view didn't come out right'. `{name}` is THE CAST'S OWN NAME, threaded from `signService`'s one normalisation of `SignInput.name` into `BuildPackageInput.castName`, or the words 'this character' (`UNNAMED_CAST_IN_COPY`) for a Cast whose owner has not named it — never the KI id, which is the machinery again, and never a pronoun. ⚠ IT NEVER REACHES AN ENGINE OR THE JUDGE: a name in a prompt would pull the picture toward whoever the model thinks that name looks like, so the field exists for the refusal sentence and for nothing else. Each sentence carries NO TERMINAL STOP, measured rather than chosen: every surface that renders a reason supplies its own punctuation (`ViewTabs`'s failed slot composes '{label} failed — {reason}. {money}'), so a sentence shipped with one reads '…we didn't keep it..' on the one surface a Sign's refusal lands on, and taking the stop out of `ViewTabs` instead would break every other reason this road raises. The money half still reads '{N} credits refunded — you weren't charged' (`refundOutcomeText`, one helper, four surfaces); Yuna's '{N} credits returned' is #1940's own founder-ordered card and reaches top-ups and plan changes as well, so folding it in here would ship half of it under another card's name. The record is exhaustive over the axis set, so a fourth axis cannot ship without its copy. WHEN SEVERAL AXES FAIL the order is BROKEN, then WRONG PEOPLE, then NOT HER — his word on #1904 verbatim: 'If several fail, show one line, in this order: broken, then wrong people, then not her.' It was broken → not her → wrong people; `people` moved ahead of `identity` on the same reasoning one step further, because a frame holding two people or nobody has no single face to recognise, so 'didn't show just X' is the true fault and 'didn't clearly look like X' is its symptom. No axis name, no verdict word, no number reaches her.",

      "⚠ THE SHEET IS JUDGED ABOVE THE VIEWS, AND A CATASTROPHE BUYS IT ONE MORE FRAME AT OUR COST — #1904, his ruling 2026-10-08 (terminal), verbatim and entire: 'go with A'. A view cut from a sheet cannot be re-rendered on its own, so when ANY view on a sheet is refused for one of the three catastrophes, `settleSignSheet` re-renders THAT SHEET once — same prompt, same references — and replaces ALL of that sheet's views together, so the views on a sheet always come from one frame and stay consistent with each other. The other sheet is untouched. The new cuts are judged the same way; a view that still fails refunds its own slice through the per-view road exactly as before and shows the sentence above; views that pass are delivered. AT MOST ONE AUTOMATIC RE-RENDER PER SHEET PER SIGN and no loop (`SHEET_MAX_RENDERS`). ⚠ IT CANNOT LIVE IN THE PER-VIEW ATTEMPT LOOP AND THE DECISIVE REASON IS COMMIT ORDERING RATHER THAN A RACE: views commit their asset row as they land, so with a per-view latch `frontFull` could pass and commit a frame-1 panel before `backFull`'s catastrophe triggered the body re-render, and the two delivered views would then come from different frames — which is exactly what his 'replace all of that sheet's views together' forbids, and the only repair from that position is deleting a committed row mid-Sign on a money table. So every judgement for a sheet is made in the coordinator before any view can commit, and `renderViewAttempts` only CONSUMES the settled map. ONE JUDGEMENT PER RENDERED PANEL: `VIEW_JUDGED_ATTEMPTS` would otherwise give a refused slot a second attempt that re-read the SAME settled pixels — one more judge call asking an identical question about an identical picture, and then the slice failed anyway. ⚠ NOT ONE LINE OF CUSTOMER MONEY MOVES THROUGH IT: no charge, no refund, no audit row and no ledger reference; the second frame is ~$0.11 of HOUSE money with no entry anywhere, and a customer who never meets a catastrophe pays exactly what one who does pays. THE CUSTOMER SEES NOTHING in the common case — the slot shows 'being made' a little longer while the sheet re-renders. ⚠ AN `unjudged` PANEL DELIVERS AND MUST NOT BUY A RE-RENDER (D-246 at the spend): an unreachable judge fails every axis closed, so a coordinator asking 'did any axis fail?' would re-render BOTH sheets of EVERY Sign during a judge outage; `viewConformanceRefuses` excludes `unjudged` and the spending decision is held to it. ⚠ AND `judgeUnjudgedOnFailure` MOVED TO `viewConformance.ts` TO SERVE BOTH ROADS — the first draft of the coordinator let a judge fault propagate instead, on the plausible ground that delivering an unlooked-at picture would be dishonest, which is D-246 exactly inverted and on this road would have refunded a whole SHEET rather than one slice. ⚠ A FAULT IN THE FIRST RENDER PROPAGATES AND A FAULT IN THE RE-RENDER DOES NOT, which is the asymmetry this road's money rests on: the first has nothing to deliver, so it reaches each of that sheet's views as an ordinary arrival failure and every slice refunds; the second is ours, bought to rescue one refused slice, so its failure settles the sheet from frame 1 and the views that passed are still delivered — letting it fail the sheet would charge the customer for OUR outage. ⚠ ONE HONEST CONSEQUENCE, said out loud because a customer can feel it: a view that PASSED on frame 1 can fail on frame 2 and refund — replacing a sheet's views together means a good panel is discarded with a bad one, which is inside his ruling and is still a real trade. THE REFUSED FRAMES ARE KEPT (#1492) keyed by SHEET GENERATION — 'view-{angle}-sheet{N}' — because `diagnosticKey` is '…/{userId}/{operationId}/{name}.png' and a bare angle would have the re-render's refusal silently overwrite the first frame's, and the PAIR is the whole diagnostic: it is what says whether the engine drew the same wrong thing twice. The keeper is `.catch`-ed at the call site and that is not belt-and-braces here — it runs between the first judgement and the decision to spend, so a keeper that threw would abort a sheet and turn its paid slices into refunds. A REFUSED PANEL IS NEVER STORED, which is a change and the better direction: the per-view road stored every picture before judging it and dropped the refused ones, and a panel is judged in the coordinator, so there is nothing to orphan rather than something cleaned up.",
      "Description-stated ink rides the sign THROUGH THE DESCRIPTION even where the waist-up master cannot show it (founder ruling, fable-1356 §4) — the full-length views show arms and legs; a view that delivers it mints its crop as the document going forward.",
      "The wire is inert by ABSENCE OF INPUT, not fenced by flags: a cast with no delivered crop composes yesterday's prompt byte for byte (the empty-is-not-fenced lesson).",
      "The wardrobe judge checks the stored line once the Two Paths land — generator and judge share one owner so they cannot drift.",
      "⚠ TRY AGAIN ON ONE VIEW IS RETIRED AS A CUSTOMER DOOR — #2089, his word 2026-10-08 (terminal), verbatim and entire: 'regenerate is the only option'. `castSlotRetryOffer` now answers null for EVERY slot, a refunded one included, so the projection carries no per-view offer, the room draws no 'Refunded · Try again' row under any view (the row's module, viewRetryRow.ts, is deleted), and the ONLY remedy on a signed Cast's package is the whole-set redo below — 'Regenerate · 650 credits'. A view that never arrived still confesses on the empty tile — 'This view didn't arrive' (`FAILED_SLOT_CONFESSION`). ⚠ THAT SENTENCE ENDED IN '— refunded' UNTIL #1968 AND THE REASONING KEPT HERE FOR IT HAS EXPIRED: it read 'true because the Sign still charges each view its own refundable slice', and his word of 2026-10-08 ('make both sign and redo/regenerate 650 credis') makes a Sign one flat charge with no per-view refund at all. So no per-view note claims money now, on either road: a redo never writes a failure marker, and a Sign's marker has nothing to give back. Credits come back only when the whole press delivered nothing, which both roads decide through one shared rule (`server/casting/flatPressCharge.ts`). ⚠ THE ENTRANCE REFUSES A STALE PRESS AT THE SERVER, for free: `castingV2.retryView` re-reads the same function at admission, so a tab left open before the deploy that still shows the row meets PRECONDITION_FAILED before the claim — nothing claimed, nothing charged, nothing rendered — pinned by an arm driving the real offer through `retryCastView` with a refunded slot. ⚠ WHAT IS KEPT, ON PURPOSE: the road behind the admission — claim, render, settle and its recovery sweep — so a Try again already in flight at the deploy still lands or refunds exactly as it was bought; retiring the road itself is its own card. What follows is the road as it was built, kept as the record a `castingV2.viewRetry` row in the database was bought under. TRY AGAIN ON ONE VIEW (#1208 slice 2, #1220 slice 2, his rule verbatim 2026-09-25: 'you pay 50 for each view you keep'): a delivered Cast's tile offers ONE button whose price is the whole difference between the two roads — a view that FAILED was refunded, so asking again is a paid view at `CAST_PACKAGE_VIEW_PRICE`; a view that arrived UNJUDGED (D-246, `conformanceMethod: unavailable`) was charged and kept, so asking again is free. The offer is read ONCE, by `castSlotRetryOffer` over the projection the room is shown, and the entrance re-reads that same function before it spends — there is no second opinion about what a tile may ask for. The render is `renderViewAttempts`, the Sign's own attempt loop called rather than copied, so a retried view carries her delivered ink crops, her carried feature words and her snapshotted outfit exactly as the Sign's did. Its money is Sign's pattern under an operation of its own (`castingV2.viewRetry`): charged at dispatch, refunded in full when it does not arrive, and the sweep's fork variable is the retried asset's own `provenance.retryOperationId`. Every refusal is free and before the claim (no offer on the slot, no render source, the anchor object gone) and NOTHING is offered while the package is still building, because the Sign still owns every slot. Like the rest of this road its refusals are service-internal and outside the declared door set.",
      "ASK FOR ALL HER VIEWS AGAIN — THE PAID REDO (#1903 slice 2, his ruling 2026-10-07 verbatim: 'maybe we should allow retry by default incase they didnt like the outfit that was invented or whatever but it costs per retry and regens all views not just one'). ONE BUTTON ON THE WHOLE CAST, under the count of what she has, beside the only other whole-Cast action there is. IT NEEDS NO FAULT TO BE FOUND FIRST and that is the feature — every other road to a second render here is a remedy (a failed view was refunded, an unchecked one is owed a free look), and this one answers the question no machine can: is this the person I was trying to cast? So there is no eligibility to compute, no verdict to consult and NO FREE BRANCH; `castPackageRedoOffer` has exactly two refusals, she is still being made and something of hers is already in flight, and both are read off the projection the room is shown. ⚠ HIS PRICE IS ONE FLAT NUMBER AND IT WAS A PER-VIEW SLICE UNTIL 2026-10-08. His word on #1968, verbatim: 'on this card make both sign and redo/regenerate 650 credis' — 650 display = 3,250 ledger, declared ONCE as `CASTING_V2_PACKAGE_REDO_PRICE_CREDITS` and served to the client, which converts it. It was 350 display composed of five 350-ledger slices, each refundable on its own; both halves of that are gone, and the same sentence of his governs the Sign on #1968: 'Drop the 700 base + 200 per view split, since views are cut from two sheets and can't be refunded one by one... Credits only come back if the Sign can't be delivered at all.' NO PER-SLOT PRICE SURVIVES, and the absence is a control rather than tidiness: one left standing would keep the slice arithmetic a single division away from being re-added by somebody reading an older comment, so `packageRedoPrice.test.ts` reads the declaring source and refuses the old name's return. The flat price does not depend on how many views she owns, which also closes the thing the slice had to be careful about: a package is a historical record, two live Casts own a retired `walk`, and the old offer multiplied the slice by HER slots so that the button and the till agreed; one number agrees with itself. ⚠ SIX OPERATIONS, ONE PRESS, AND THE PRESS IS THE ONLY ROW THAT CARRIES MONEY. Five slot rows under `castingV2.packageRedo` take the per-slot lock, plan ZERO credits and answer one question each (did a picture land under this operation); the press under `castingV2.packageRedoPress` holds the CAST-LEVEL lock, plans the whole 3,250 and holds the single deduct. A flat price cannot ride one of the five: the recovery sweep refunds an unsettled row's planned credits, so a slot holding the whole price would hand back a whole redo whenever THAT slot was the one left unsettled, with its four siblings delivered. One operation holds exactly one lock key (the lock table is unique on its operation id), which is why the five slot locks need five operations and the press could not simply take them all; its own cast-level key makes a SECOND press refuse at the claim, before a slot is taken or a credit moves. CREDITS COME BACK ONLY WHEN NOTHING WAS DELIVERED, decided by `flatPressRefundOwed` in the live service and by `recoverFlatPressCharge` in the sweep — one rule in one module, because the two readings happen hours apart from different evidence and a disagreement between them pays a customer twice. ONE view delivered is a delivered press: the other slots keep the pictures they already had (a redo never lands a hole) and the house paid for both sheets either way. The sweep's question is answered from the asset rows by `pressViewLanded`, which reads the `pressOperationId` every redone picture carries beside its own `retryOperationId`. The five slot `clientRequestId`s are DERIVED from the press (`derivedClientRequestId`, the RFC name-based shape) and the PRESS is claimed under the customer's own request id, so a double press replays on the press row before a slot is claimed, before the deduct and before a sheet is asked for. ALL SIX ARE CLAIMED BEFORE ANY MONEY MOVES, which is this road's one structural addition: a claim is free, so claiming the whole set first turns 'somebody is already asking for her profile' into a refusal that has charged nothing. It takes THE SAME per-slot lock the Try again takes, so the two roads are mutually exclusive structurally rather than by a read. ⚠ THE PICTURE COMES FROM THE SIGN'S OWN TWO SHEETS, AND IT DID NOT UNTIL THE RELAY'S FINDING ON PR #1924. The road this replaces rendered one wardrobe plate and then five separate per-view requests — about $0.90 of engine time where a Sign costs about $0.22, with front and back free to disagree because nothing cut them from one frame, and with no re-make when a view was refused. #1957 retired that road for the Sign; the redo now runs `signSheetPlan` + `settleSignSheet` exactly as `buildCastPackage` does — two sheets in parallel at quality high, every panel judged before any of them commits, and ONE house-cost re-make of a sheet whose panel met a catastrophe (his #1904 option A, inherited rather than re-implemented). His 650 rests on that being the same road: 'on the two sheets it costs the same as a Sign'. Her tattoos and her carried feature words therefore ride into the SHEETS, once per sheet rather than once per view, which is what makes the views of one redo agree with each other; the master is the reference every time (his card: 'The identity stays fixed across a redo'). THE CUSTOMER SURFACE: the price is ON the button (his standing rule, prices on paid buttons) spelled `credits` and never `CR` (#1908), converted through the one converter (#1600); no engine name, no `redo`, no `package`, no axis, and the noun is the one the strip already uses, which is VIEWS. His 2026-09-26 ruling that took the number off the Try again ROW is not in tension with it — that is a muted caption under one picture and this is a deliberate purchase. ⚠ THE FINDING THIS NOTE USED TO CARRY IS CLOSED BY HIS OWN NUMBER: at 350 display a redo of FIVE views cost LESS than the 370 he set for a single paid Try again, so a customer who disliked one view paid less to replace all five and the house paid five renders for less than it charged for one. At 650 the whole set is dearer than one slot, which is the only ordering that does not reward pressing the bigger button.",
    ],
  },
  {
    id: "persona-reads",
    procedures: [
      "castingV2.draftCastReads",
    ],
    title: "Pick a different read - six ways one cast could carry themselves",
    entrances: ["server/castingV2/castReads.ts"],
    summary:
      "Under the open Personality card, one door offers SIX alternative reads of the same person - each a short label "
      + "plus the exact two sentences it would store - and the one the customer recognises is kept. It is drafted on "
      + "OPEN rather than at Sign, it stores nothing of its own, and keeping a read is the personality edit the "
      + "product already had.",
    doors: [],
    doorsNote:
      "This road has no declared refusal of its own: every failure is the same one, and it is a REFUSAL TO DRAW rather "
      + "than a door - six usable reads or none. The parse drops an unusable entry and then refuses the whole list if "
      + "six did not survive, because a list that is sometimes six and sometimes four is a surface nobody designed. "
      + "The entrance turns that into a SERVICE_UNAVAILABLE the card draws in its own body, not a toast. Its behaviour "
      + "is pinned by castReads.test.ts (whose refusal arms are real replies the measurement produced, pasted) and by "
      + "personaReads2196.test.ts, rather than by census rows: nothing here is the refine entrance's declared set.",
    flags: ["CASTING_V2_SCOPE"],
    notes: [
      "WHAT IT COSTS AND HOW LONG IT TAKES, MEASURED BEFORE ANY OF IT WAS DRAWN - the disappearing-technology law's third clause, which #2196's card made a gate rather than a review note. Driven through the real reader on three of his own production casts: $0.0154 an open and 12.97-15.37 s (mean 13.8 s), at 3,735 prompt tokens and 794 completion tokens an open, filed under its own census word `reads` so the door's cost stays answerable separately from `persona`'s per-Sign one. The rate is the provider's published figure read from its models endpoint, not a remembered number; the books had not posted the day's spend when this landed.",
      "DRAFTED ON OPEN AND NOT AT SIGN, decided on that measurement rather than on a preference. The price is the same either way, so three other things settled it: at Sign EVERY customer pays it whether or not they ever open the door; the six would need somewhere to live, which is a store this road does not have and which the two 'say it your way' cards (#2197, #2205) are already designing for a different fact; and a set drafted at Sign is stale the moment the line underneath it is edited, which is the very thing this door exists to help with. The entrance is a MUTATION and not a query for the same reason - a query is refetched on focus and on reconnect, so a customer who tabbed away would pay again and find six different reads under their cursor.",
      "IT WRITES NOTHING, WHICH IS WHY THE CARD IS SMALL. A read's two sentences ARE a personality line, so Keep is `castingV2.editCastPersonaField` with line personality - the owner already in the statement, the badge already cleared by arithmetic. No column, no migration, no second write path and nothing new to scrub. The three sources it reads from are the Sign's own three (the signed frame, the typed brief, the correction sentences), fetched by `getCastReadsSources` with the owner in the statement and an explicit projection, plus a FOURTH this road adds: the line already on the card, so the six are alternatives to it rather than six guesses that might include it.",
      "THE CRAFT IS THE DRAFTED LINE'S CRAFT, SHARED RATHER THAN RESTATED - the card's own instruction (reuse castPersonaSystemPrompt's rules rather than writing a second copy of them, working law 4). `castPersonaCraftRules` in `castPersona.ts` holds the rest-then-timing shape, the camera-visible rule, the three pronouns, his length ruling and the form example, and EVERY persona instruction composes from it. This road shipped its own second copy for half a day: #2197's server half landed the same extraction on main hours apart, which is two answers to one need, and the one with real customers stands. Only its `where` parameter survived, because the pronoun rule's last clause is the single sentence that cannot be shared verbatim. That instruction is one he courted at #2136 and it drafts a line on every Sign, so the extraction is held BYTE-IDENTICAL by a golden across all three pronoun sets; the comparison was proven able to fail before it was believed, and a failure of it is never 'update the golden'. One phrase is parameterised and only one: the pronoun rule ends 'in either line' for the two-line draft and 'in any of the 6' here.",
      "NO FIXED LIST, APPLIED BEFORE N3 ASKED FOR IT - his ruling of 2026-09-24, verbatim: 'we really cannot be working from fixed lists in a fluid editing application'. His frame's six names are the SHAPE of a label and are deliberately NOT in the instruction: six names shipped as exemplars are six names that would arrive on every cast in the product, which is #2136's measured echo failing in the most visible place available. A suite holds all six of his names OUT of the instruction.",
      "THREE DEFECTS THE MEASUREMENT FOUND, EACH FIXED BEFORE ANYTHING WAS DRAWN, AND THE FIRST COURT RUN RETURNED ZERO USABLE READS OUT OF THREE. (1) The reply field was called `name` while the shared rule says 'Do not use a name' - meaning the performer's - so the reader obeyed the rule and appended name_unused true to all six, which the strict parse refused; the field is `label` now, matching the prose, and the shared line was not touched. (2) The replies kept LOSING THEIR PER-ENTRY BRACES: one arrived as a single object carrying twelve duplicate keys, which JSON.parse collapses to the last pair - valid JSON of the declared shape holding ONE read, with nothing throwing anywhere. That is what put a schema on the wire. (3) Raw end-of-sequence markers reached the stored prose on five of six reads, which a customer would have read on their cast page; they are cut by a POSITIVE rule - keep up to the last sentence end - and never by a denylist, because a denylist only removes the litter somebody has already seen.",
      "THE SHAPE IS ENFORCED BY THE PROVIDER AND NOT HOPED FOR, which is the fidelity law's own sentence about reaching for the dedicated tool. `TextRequest.jsonSchema` is new, opt-in, and nothing already shipped sets it; the schema is DERIVED from the parser's own zod object with z.toJSONSchema, so the thing the provider enforces and the thing the parser checks cannot drift. It was driven before it was wired: under the loose json_object hint the same ask came back fenced, with an invented top-level key and an array of strings where objects were asked for; under the schema, the exact shape, 1.8 s against 2.1 s.",
      "WHAT THE CUSTOMER MEETS, and the disappearing-technology gate answered where they meet it. They must learn nothing: six people described in plain words, and the act is recognising one. The decision has a basis - the six are in front of them beside the cast's own picture, and NOTHING IS PICKED WHEN THE LIST OPENS, because opening pre-picked would be the product choosing and then asking them to confirm (his candidate-count ruling). The technology does not show: the ~14-second wait says what is happening to their cast and never what is doing it, there is no percentage and no countdown, and a refusal says what was refused and what to do. His reassurance keeps its promise and drops its forecast - 'Only the acting changes' is true and kept; 'and only for new takes' is dropped for the third time on this rung, because refining is inert and no prompt builder reads these lines, and a suite holds BOTH of those reasons so the clause comes back in his words the day either becomes false. His design also draws a second row here, 'Say it your way'; it is NOT drawn, because its CLIENT half is not built - #2197's server half landed on main while this was being built, and nothing in the client calls it - and a row that opens onto nothing is the lesser path shipped silently.",
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
    id: "persona-say-it-your-way",
    title: "Say it your way — the customer's own sentence, turned into a cast's personality or voice line",
    entrances: ["server/routes/castingV2.ts", "server/castingV2/castPersonaTranslate.ts"],
    procedures: ["castingV2.translateOwnWords"],
    summary:
      "#2197 (the Personality card) and #2205 (the Voice card), one road for both: the customer types one sentence "
      + "about their cast the way they would say it to a friend, and one press returns the line the card would store "
      + "— his craft note, 'the translation from feeling-words to camera-words is the engine's job, never the "
      + "customer's'. ONE house-paid text call per press under its own census word `persona.translate`, text only, "
      + "on the persona reader's model (`castPersonaModel`), with the Sign's own craft blocks "
      + "(`castPersonaCraftRules`) rather than a second copy. It WRITES NOTHING: Keep this is "
      + "`castingV2.editCastPersonaField` carrying `ownWords`, which stores the line and the sentence in one "
      + "owner-scoped statement (`personalityOwnWords` / `voiceOwnWords`, migration 0079). Free to the customer; "
      + "rewording is bounded by `RATE_LIMITS.castPersonaTranslate`, sixty presses an hour per account.",
    doors: [],
    doorsNote:
      "THIS ROAD DECLARES NO DOOR, on re-imagine's own argument. Outside casting it is `requireCastingV2`'s "
      + "refusal; another account's Cast is `NOT_FOUND` before the engine is asked; the ceiling is "
      + "`RATE_LIMITS.castPersonaTranslate` (`server/security/rateLimit.ts`); and every other outcome is the free "
      + "answer `{ kind: \"nothing\" }` — no text engine configured, the call failed or came back cut off, or the "
      + "line could not be fitted to its cap at a sentence end (`translateCastPersonaOwnWords`, "
      + "`server/castingV2/castPersonaTranslate.ts`). No corpus row can reach it: the corpus drives "
      + "`refineCandidate` only.",
    flags: ["CASTING_V2_SCOPE"],
    notes: [
      "SERVER HALF FIRST, declared: the procedure, the store and Keep this's `ownWords` ship before the client door, on the relay's instruction; the door's box, its stage word and its frames follow in the client PR.",
      "The customer's own sentence is the `masterPrompt` family: on `REFUSING_KEYS` (both columns and the `ownWords` input field), on no staff projection, nulled by the permanent-deletion tombstone, and never written into a log line by this road.",
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
  CAST_PACKAGE_VIEW_PRICE: {
    why:
      "DELETED by #1968 (2026-10-08) with the per-view refund it priced — his word, " +
      "'make both sign and redo/regenerate 650 credis', and the reasoning with it: views are " +
      "cut from two sheets and cannot be refunded one by one. The road sentence naming it is " +
      "the record of what the retired Try again COST, and that is the content rather than an " +
      "incidental mention: a reader meeting a castingV2.viewRetry row in the database, or a " +
      "slot marker carrying a refunded figure, needs to find the slice those numbers came " +
      "from. No new row can carry one; the historical ones do, and the sweep still reads " +
      "their references so a total loss is not paid twice (D-102).",
  },
  listSpentFreeViewRetryAngles: {
    why:
      "DELETED by #1903 slice 3 (2026-10-07) with the free Try again it rationed. It read the " +
      "operation rows for the views whose ONE free ask had been spent (#1601 item 4), so the " +
      "room's link and the till's charge could not disagree. The road sentence naming it is the " +
      "obituary and is the content of the change: a reader asking why a delivered view has no " +
      "offer needs to find the accounting that used to decide its PRICE, and a sentence saying " +
      "only 'there is no free ask' leaves them unable to.",
  },
  spentFreeViewRetryFilter: {
    why:
      "DELETED by #1903 slice 3 (2026-10-07), the condition behind the reader above — a " +
      "castingV2.viewRetry row with plannedCredits = 0 that reached running. The road sentence " +
      "records it because `plannedCredits = 0` was the free/paid DISCRIMINATOR on this road, and " +
      "that is a fact about the rows a later reader will meet in the database long after the " +
      "code is gone: no new row can carry it, and six historical ones do.",
  },
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
      "The customer's own word, and the only word a customer ever saw on an unchecked view " +
      "(viewRetryRow.ts held it as the VALUE of the `unchecked` key until #1903 slice 3, and the " +
      "module itself is deleted by #2089, so no file declares it and the backticked word is the " +
      "copy). The sign-views road quotes it to say what " +
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
