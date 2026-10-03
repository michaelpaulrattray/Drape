# What the studio can do today — the Capability Census

Derived, never typed. Regenerate with `pnpm capability:generate --drive`; check with `pnpm capability:check`.
A row's **observed** column is what the real refine entrance did with that sentence, claim door shut (nothing charged).

Profile **fixture-as-founder** on fixture `outside-scope-bot-local / 34383040-622d-418e-a505-7ddf12d78930`; flags: `CASTING_FACE_SCAN_SCOPE=users:28601`, `CASTING_HAIR_REFERENCE_SCOPE=users:28601`, `CASTING_INK_CUT_SCOPE=users:28601`, `CASTING_INK_REFERENCE_SCOPE=users:28601`, `CASTING_INK_REGION_CROP_SCOPE=users:28601`, `CASTING_INK_STUDIO_SCOPE=users:28601`, `CASTING_INK_TRANSFORM_SCOPE=users:28601`, `CASTING_INK_WORDS_SCOPE=users:28601`, `CASTING_OPEN_LANE_SCOPE=users:28601`, `CASTING_REFERENCE_ATTACH_SCOPE=users:28601`, `CASTING_REFERENCE_LIBRARY_SCOPE=all`, `CASTING_REFINE_DISPATCH_SCOPE=off`, `CASTING_REPAINT_SCOPE=all`, `CASTING_SCAN_TABLE_SCOPE=off`, `CASTING_SEGMENTS_DELIVERED_SCOPE=off`, `CASTING_SEGMENTS_SCOPE=off`, `CASTING_SIDE_PHRASING_SCOPE=users:28601`, `CASTING_TWO_PATHS_SCOPE=users:28601`, `CASTING_V2_SCOPE=all`.

## How the studio works — the roads

Prose is reviewed; every DOOR, FLAG and ENTRANCE below is validated against the source at generate time, and each door's sites/pins/reach are extracted, not written.

### The life of a cast — roll, sheet, refine, sign

A BRIEF is compiled and a ROLL renders eight candidates onto a SHEET (each an independently refundable slice). Opening a candidate gives the panel and REFINE: each paid edit renders a VARIANT anchored on the pristine master, with prior edits carried by the composed chain (words + crops). SIGN freezes an identity: five views rendered from the anchor, each checked against the signed face, delivered as the package. Deletion sweeps the cast and everything minted under it (crops, designs, scans) unconditionally.

_Entrances:_ `server/routes/castingV2.ts`  ·  _Flags:_ `CASTING_V2_SCOPE` · `CASTING_RETRY_SCOPE` · `CASTING_ROLL_ENGINE_SCOPE`

_Called as:_ `castingV2.config` · `castingV2.createSession` · `castingV2.openSessions` · `castingV2.getSession` · `castingV2.abandonSession` · `castingV2.createRoll` · `castingV2.getRoll` · `castingV2.follow` · `castingV2.retry` · `castingV2.cancel` · `castingV2.keep` · `castingV2.discard` · `castingV2.undo` · `castingV2.selectVariant` · `castingV2.variants` · `castingV2.roster` · `castingV2.getCast` · `castingV2.renameCast` · `castingV2.deleteCast`

| door | kind | charge | where it lives | pinned | reached by |
|---|---|---|---|---|---|
| `roll.likeness` | roll-refusal |  | server/castingV2/briefCompiler.ts:1205<br>server/castingV2/briefRefusalCopy.ts:128 | 7 test(s) | _documented-unreachable or gap — see findings_ |
| `roll.not_a_being` | roll-refusal |  | server/castingV2/briefCompiler.ts:1208<br>server/castingV2/briefRefusalCopy.ts:134 | 2 test(s) | _documented-unreachable or gap — see findings_ |
| `roll.reader_outage` | roll-refusal |  | server/castingV2/briefCompiler.ts:1184<br>server/castingV2/briefRefusalCopy.ts:140 | 4 test(s) | _documented-unreachable or gap — see findings_ |
| `roll.uninterpretable` | roll-refusal |  | server/castingV2/briefCompiler.ts:1093<br>server/castingV2/briefRefusalCopy.ts:122 | 2 test(s) | _documented-unreachable or gap — see findings_ |

> THE ROLL ENTRANCE'S WALLS ARE ON THE MAP AS OF #206, AND THERE ARE FOUR OF THEM SINCE #1495 RETIRED `roll.unsupported_cohort` WITH THE TWO-VALUED COHORT QUESTION THAT WAS ITS ONLY SOURCE — declared from `ROLL_REFUSAL_COPY`, entrance-qualified `roll.*`, each citing its own throw. They are DECLARED but not DRIVEN: the census sends a sentence at an existing Cast through `castingV2.refine`, and these are raised inside `castingV2.createRoll` before a roll row exists, so each carries its reason in UNREACHABLE_DOORS instead of a corpus row. A brief-carrying corpus row is the map's next growth ring, and it would be free at all four. The SIGN entrance is still outside the declared set entirely (fable-1357 §2).

- Anchor law: every refine renders from candidate.imageKey (the pristine master), never from a delivered frame — chaining on delivered frames was measured to drift.
- THE RETRY BUTTON (`CASTING_RETRY_SCOPE`, #122 shape 1, founder 2026-08-26: 'same prompt, one slice, 20 credits, refunded again on failure'): a tile whose chip reads Didn't finish or Didn't arrive may be rendered again (those two chips said 'Engine error' and 'Didn't arrive' until #1551 rewrote every failure chip into outcome words, 2026-09-30 — the KINDS `engine` and `unknown` did not move, and `RETRYABLE_FAILURE_KINDS` is what the door actually reads) — the FAILED ROW ITSELF goes failed → queued by CAS (`resetCandidateForRetry`, the one transition out of `failed`), one render runs through the roll road's own `dispatchCandidate` with the row's `internalPrompt.prompt` byte for byte, under an operation of its own (`castingV2.retry`, the candidate lock as the double-tap cover). Blocked tiles (kind `content_filter`, chip 'Content filter' until #1551) GET THE SAME BUTTON since his reply #10 (2026-08-26: 'Flip it on for your account, AND widen it to content-filter tiles') — the #93 court measured the filter as a coin per picture (roll 222's text refused 5/8 live, 6/8 passed re-sent unchanged), so a plain Retry is the button that rescues them and promises nothing about softer words; not-a-portrait and not-charged tiles still get none; every refusal (`retryService.ts`: flag off → NOT_FOUND, wrong kind, sheet still casting, cancelled roll, no prompt, no usable recorded price) is free and before the claim. ⚠ **AND THE PRICE IS THE TILE'S OWN SINCE #1601 item 2 (2026-10-01), WHICH IS WHY THIS LIST GREW BY ONE.** His quoted '20 credits' above IS one slice, and a retry used to read it from `CASTING_V2_RETRY_PRICE_CREDITS` at the top of the function — before the row it was charging for was even fetched. That constant is the ROLL slice; it is identical to every live row today (measured: 483 candidate rows, all 20, none NULL or ≤ 0) and it becomes wrong the moment a Follow slice is 200, because the retry would charge the Roll's 150 and then WRITE 150 onto the tile's row through `resetCandidateForRetry` — making the mis-charge its own refund authority, with the ledger reconciling exactly against the wrong number. The charge is `candidate.pointsCost` now, read after the ownership read that already had it, and the sixth refusal is the fail-closed arm for a recorded price a charge cannot be built from (the column is `.default(0).notNull()`, so a future writer that omits it would otherwise buy a free render). ⚠ **AND THAT CONSTANT NO LONGER EXISTS — THIS SENTENCE SAID IT WAS LIVE UNTIL 2026-10-03, READ AT THE CODE.** It read *"the constant remains the account-level QUOTE that `castingV2.config` hands the client, true of every tile while the two slices agree"*, and both halves died in #1601 item 1 on 2026-10-01: `CASTING_V2_RETRY_PRICE_CREDITS` is DELETED (`castingCreditCosts.ts` keeps only its obituary, because a price nothing quotes may not sit in that module — invariant 7) and `retryPriceCredits` LEFT the `castingV2.config` response with it. There is no account-level retry quote to be true of anything; the sheet derives a tile's price from the roll row's own total divided by its candidate count, the same derivation the cancel line already used. `followSlicePrice.test.ts` is still the suite and still the right pointer, but WHAT IT HOLDS HAS INVERTED — its tripwire FIRED and was discharged, so it pins the absence (*"the account-level RETRY quote has left `castingV2.config` entirely"*, *"the tile's retry price is derived from the ROLL ROW, not from the config quote"*) instead of waiting for the day the slices diverge. They diverged on 2026-10-01 and agree again at 200 since #1753. The measurement the old sentence leaned on still holds and is now dated rather than present-tense: read at production 2026-10-02, all 483 candidate rows carry `pointsCost` 20, none NULL or ≤ 0 — nobody has rolled since 2026-09-28, so no live row carries a post-P1 slice yet. Recovery links a crashed retry to its slice through the operation's candidate lock row and fails CLOSED. Off the flag not one line runs; production holds it `all` since 2026-09-24 on his Crew reply #204 ('Turn it on for everyone'), so its live population is every account's refused tiles (it was `users:1` from 2026-08-27, his reply #10, until the switch sitting) — NOT zero, which is what this note said until #206 (the record is `scripts/lib/productionFlagPositions.mts`, which the deploy rite compares to the service on every push). Its refusals are the retry service's own and remain outside the declared door set; the roll entrance's five WALLS joined the map at #206 (doorsNote above).
- A roll is eight independently refundable units; a deploy landing mid-roll costs only the undelivered slices (accepted collision class, D-85).
- The path/wardrobeLine columns (migration 0051) make the born path a fact of the roll; NULL means cast before the paths existed.
- A brief the reader NEVER READ (the deadline fired, the transport or provider failed, no engine configured) is refused FREE before the claim as `reader_outage` at EVERY length (briefCompiler.ts; founder ruling #126 'refuse-free', Crew reply #7 2026-08-26, and 'always' on the length question, reply #9) - it replaced the H30 fallback that charged roll 219 for a sheet cast from the brief's first 80 characters. Only a reply the provider gave that the compiler could not parse still falls back; `reader_outage` is a declared door as of #206 (`roll.reader_outage`) and documented as unreached because no corpus row can carry a brief — this note stays as the road's account of WHY it exists.
- THE ROLL'S SUBJECT WALLS ARE THE RULING'S TWO AND NO THIRD (#131 slice C): the reader is asked a four-valued subject question (`SUBJECT_INSTRUCTION`, interpreter.ts), a creature / robot / alien / anime brief CASTS, a real person or a named character refuses FREE before the claim as `likeness` (`LIKENESS_MESSAGE`, briefCompiler.ts) and a subject that is not a being refuses FREE as `not_a_being` (`NOT_A_BEING_MESSAGE`; founder: 'someone asking for an object should be refused like a car'). Both are the reader's judgement taken twice (`cohortWallRetried`). ⚠ THE THIRD WALL IS RETIRED AND THE CLAUSE THAT DESCRIBED IT IS GONE WITH IT (#1495). It read that off the author road a roll still walled as `unsupported_cohort`, then that the two-valued question survived one module out in the INTERPRETER's own `author` option: that option is deleted, the two-valued vocabulary with it, and the raise it fed. There is one subject question in the module now, so there is no off. What the retirement changed for a customer is nothing — `briefCompiler` had passed `author: true` as a literal since #1490 act 1, and all 16 surviving prompt combinations are byte-identical to their `author: true` twins on the previous tree. Both kept walls are declared doors as of #206 — `roll.likeness` and `roll.not_a_being`, the latter the twin of `concept.no_being`.

### Refine's money model — free before the claim, refunded after it

Everything before the claim is FREE: ownership and state doors, the interpreter's walls and gates, and every cannot-say answer. The claim charges one refine at `CASTING_V2_REFINE_PRICE_CREDITS` — read it there and never here; this clause said "25 credits" until 2026-10-03, which P1 superseded — and dispatches; a failure after it refunds. The census drives with the claim door shut, so 'would-render' means the ask passed every free door and reached the money.

_Entrances:_ `server/castingV2/refineService.ts`  ·  _Flags:_ `CASTING_V2_SCOPE` · `CASTING_REPAINT_SCOPE` · `CASTING_REFINE_DISPATCH_SCOPE`

_Called as:_ `castingV2.refine`

| door | kind | charge | where it lives | pinned | reached by |
|---|---|---|---|---|---|
| `candidate_missing` | service-refusal |  | server/castingV2/refineService.ts:1298 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `already_signed` | service-refusal |  | server/castingV2/refineService.ts:1316 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `busy` | service-refusal |  | server/castingV2/refineService.ts:4968<br>server/castingV2/rollEngine.ts:122<br>(+1) | 2 test(s) | _documented-unreachable or gap — see findings_ |
| `refine_limit` | service-refusal |  | server/castingV2/refineService.ts:4427 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `master_missing` | service-refusal |  | server/castingV2/refineService.ts:1305 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `version_missing` | service-refusal |  | server/castingV2/refineService.ts:1292<br>server/castingV2/refineService.ts:2636 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `history_unreadable` | service-refusal |  | server/castingV2/refineService.ts:3733 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `history_predates_undo` | service-refusal |  | server/castingV2/refineService.ts:3030 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `step_moved` | service-refusal |  | server/castingV2/refineService.ts:2710 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `kind_unserved` | service-refusal |  | server/castingV2/refineService.ts:2764 | 1 test(s) | _documented-unreachable or gap — see findings_ |

- `busy` is the admit door (a real TOO_MANY_REQUESTS, invariant 6); reaching it in the census reads as would-render.
- `refine_limit` is the 24-instruction ceiling — removals are still allowed there; only growth is blocked.
- Charge-then-refund where the answer was knowable pre-claim is a defect class this program has closed twice (the mid-chain prune, the dangling-crop transform); the census's ledger arm guards the whole table.

### Refine's reading — the interpreter, its walls, and its gates

The customer's sentence is read by a text model whose OUTPUT is policed by code: values must appear in the customer's own words (source containment), facets resolve against the subject cards, and refusals carry their own names. Walls refuse the ASK's kind; gates refuse an ask the road cannot serve YET and say what would work. An unreadable or empty sentence refuses free — the product never guesses.

_Entrances:_ `server/castingV2/refineInterpreter.ts` · `server/castingV2/refineDelta.ts`  ·  _Flags:_ `CASTING_OPEN_LANE_SCOPE` · `CASTING_SIDE_PHRASING_SCOPE` · `CASTING_INK_WORDS_SCOPE`

_Called as:_ `castingV2.refine`

| door | kind | charge | where it lives | pinned | reached by |
|---|---|---|---|---|---|
| `empty` | interpreter-refusal |  | server/castingV2/refineDelta.ts:626<br>server/castingV2/refineInterpreter.ts:898<br>(+1) | 4 test(s) | guard.empty |
| `unreadable` | interpreter-refusal |  | server/castingV2/castingIntent.ts:1425<br>server/castingV2/castingIntent.ts:1462<br>(+14) | 7 test(s) | light.softer, guard.gibberish, guard.scope.ink.none |
| `reader_outage` | interpreter-refusal |  | server/castingV2/refineDelta.ts:625<br>server/castingV2/refineInterpreter.ts:912<br>(+2) | 2 test(s) | _documented-unreachable or gap — see findings_ |
| `wall_likeness` | interpreter-refusal |  | server/castingV2/refineDelta.ts:498<br>server/castingV2/refineDelta.ts:1609<br>(+2) | 6 test(s) | guard.likeness |
| `wall_content` | interpreter-refusal |  | server/castingV2/refineDelta.ts:538<br>server/castingV2/refineInterpreter.ts:1647<br>(+1) | 6 test(s) | guard.content |
| `wall_stage` | interpreter-refusal |  | server/castingV2/refineDelta.ts:513<br>server/castingV2/refineDelta.ts:1619<br>(+2) | 9 test(s) | background.white |
| `wall_unbacked` | interpreter-refusal |  | server/castingV2/refineDelta.ts:537<br>server/castingV2/refineInterpreter.ts:1734<br>(+1) | 3 test(s) | wardrobe.tee, guard.stage, age.older, guard.compliment, wardrobe.colour |
| `wall_unfileable` | interpreter-refusal |  | server/castingV2/refineDelta.ts:549<br>server/castingV2/refineDelta.ts:1338<br>(+2) | 8 test(s) | _documented-unreachable or gap — see findings_ |
| `gate_ink_document` | interpreter-refusal |  | server/castingV2/refineDelta.ts:562<br>server/castingV2/refineDelta.ts:562<br>(+3) | 2 test(s) | ink.words.face, ink.words.noplace, ink.words.behind-ear, ink.transform.none |
| `gate_ink_uncarried` | interpreter-refusal |  | server/castingV2/refineDelta.ts:569<br>server/castingV2/refineDelta.ts:569<br>(+4) | 3 test(s) | ink.words.chest |
| `gate_ink_unkeepable` | interpreter-refusal |  | server/castingV2/refineDelta.ts:588<br>server/castingV2/refineDelta.ts:588<br>(+3) | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `gate_ink_coverage_unread` | interpreter-refusal |  | server/castingV2/refineDelta.ts:596<br>server/castingV2/refineDelta.ts:596<br>(+3) | 3 test(s) | ink.words.chest.basics |
| `scope_unknown` | service-refusal |  | server/castingV2/refineService.ts:1386<br>server/castingV2/refineService.ts:1424 | 1 test(s) | guard.scope.unknown |
| `scope_mismatch` | service-refusal |  | server/castingV2/refineService.ts:4947 | 1 test(s) | _documented-unreachable or gap — see findings_ |

- wall_stage = PROVABLY the shoot (the lexicon backed the claim); wall_unbacked = the model claimed out-of-scope and the lexicon could not confirm — one wall was two walls wearing one name until census card C1.
- gate_ink_document asks 'is there a document for this design'; its answers are the anchor itself, a pointed-at photograph, the delivered crop, and (words road) the delivery about to be minted.
- gate_ink_uncarried is a place the product can SEE and cannot KEEP (a covered chest): render would land, the mint could not crop, the tattoo would die on the next edit — his own find-and-crop condition enforced.
- item 7a split that gate three ways, because its two reasons only COINCIDED while the product had one outfit: gate_ink_uncarried = a garment is over it; gate_ink_unkeepable = the surface is bare and the road still cannot crop a result there (a shirtless Basics chest); gate_ink_coverage_unread = nobody has read this outfit's coverage, which fails closed and says so in its OWN words rather than borrowing the covering's.
- unreadable = a reply CAME BACK and could not be read, and rephrasing is real advice for it; reader_outage = nothing came back at all (the transport threw, the deadline passed, the text account is overdrawn, or no engine is configured), where telling her to rephrase is advice she cannot follow. The roll road has drawn this line since #126; the refine road drew it 2026-08-30.
- A tapped rectangle (scope) outranks the words and the memory — the tap is the customer's freshest act; a scope naming nothing the instruction writes refuses free (scope_mismatch).

### The ink lanes — add, transform, remove, and the crop that carries

A delivered tattoo is remembered as a CROP row cut from the delivered frame by the placement's own reader word; that crop rides every later render as instruction material (upscaled to the legibility floor when small). Transforms ride the crop as the source; removals prune the step and recompose (navigate free when the survivor already exists, re-render when it does not); the record's names are believed only where a ROW backs them.

_Entrances:_ `server/castingV2/inkPriorAsk.ts` · `server/castingV2/inkDeliveryMint.ts` · `server/castingV2/refineService.ts`  ·  _Flags:_ `CASTING_INK_STUDIO_SCOPE` · `CASTING_INK_TRANSFORM_SCOPE` · `CASTING_INK_WORDS_SCOPE` · `CASTING_REFERENCE_LIBRARY_SCOPE`

_Called as:_ `castingV2.refine`

| door | kind | charge | where it lives | pinned | reached by |
|---|---|---|---|---|---|
| `noInkToChange` | cannot-say | free | server/castingV2/cannotSayCopy.ts:300 | 1 test(s) | ink.transform.wrongslot, ink.scoped.none.prefill |
| `inkOneChangeAtATime` | cannot-say | free | server/castingV2/cannotSayCopy.ts:435 | 1 test(s) | ink.transform.two |
| `whichInkToChange` | cannot-say | free | server/castingV2/cannotSayCopy.ts:415 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `inkNotKept` | cannot-say | free | server/castingV2/cannotSayCopy.ts:408 | 1 test(s) | ink.transform.dangling |
| `inkBeyondToday` | cannot-say | free | server/castingV2/cannotSayCopy.ts:272 | 2 test(s) | _documented-unreachable or gap — see findings_ |
| `unplacedInk` | cannot-say | refunded | server/castingV2/cannotSayCopy.ts:248 | 3 test(s) | _documented-unreachable or gap — see findings_ |
| `removal_absent` | service-refusal |  | server/castingV2/refineService.ts:3501 | 1 test(s) | ink.remove.none, skin.freckles.remove.none |
| `removal_unnamed` | service-refusal |  | server/castingV2/refineService.ts:3073 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `removal_not_in_brief` | service-refusal |  | server/castingV2/refineService.ts:3482 | 1 test(s) | acc.glasses.remove.none, acc.remove.branch.other |
| `removal_uncheckable` | service-refusal |  | server/castingV2/refineService.ts:3259<br>server/castingV2/refineService.ts:3276 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `removal_reread_unmatched` | service-refusal |  | server/castingV2/refineService.ts:3577 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `removal_unnameable` | service-refusal |  | server/castingV2/refineService.ts:4397 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `already_original` | service-refusal |  | server/castingV2/refineService.ts:2664 | 1 test(s) | guard.undo |

- THE ID POINTS AND THE ROW DECIDES: a chain naming a crop with no row is skipped loudly by the carry (the rescue needs the name to stand) and answered free at the transform door (inkNotKept) — never scrubbed, because scrubbing deletes the pointer the minted-loss rescue lives on (C4b, closed not-to-be-built).
- free.ink is ONE subject holding every tattoo (the keying work, §10 3b, splits it); the gate skips items warranted only by the prior so a carried tattoo cannot wall a new ask.
- Removal of the only edit NAVIGATES free ('That takes it back to the original'); a never-rendered survivor re-renders and charges once — proven at the wire both ways.

### Sign — five views, the identity lock, and what rides into them

Signing renders the package views fresh from the anchor, judges each against the signed face and the wardrobe spec, and refunds only the slices that are not her. Delivered tattoo crops ride into the views with the her-own-picture sentence (never the mannequin's); every slot gets a disposition line, a moved digest refuses rather than paints, and a failure never fails the Sign.

_Entrances:_ `server/castingV2/signService.ts` · `server/castingV2/packageOrchestrator.ts` · `server/castingV2/inkViewReferences.ts` · `server/castingV2/viewRetryService.ts` · `server/castingV2/outfitPlate.ts`  ·  _Flags:_ `CASTING_V2_SCOPE`

_Called as:_ `castingV2.sign` · `castingV2.retryView`

> Sign's refusals and dispositions are service-internal (not the refine entrance's declared set); its behaviour is pinned by signInkCrops.test.ts and the wire courts rather than census rows. A sign corpus is future work — a Sign is the most expensive act in the product and `CASTING_V2_SIGN_PRICE_CREDITS` is the one place to read what it costs, so it is recorded from courts and never driven by the census. ⚠ THIS CLAUSE SAID "sign spends ~450 credits" UNTIL 2026-10-03 and 450 had stopped being any price at all: P1 moved the figure (#1601, merged 2026-10-01), and under the two scales this product now quotes it is neither the ledger number nor the display one. A price typed into this prose is an unguarded mirror of a constant (working law 4) and the generator validates doors, flags and entrances rather than numbers — so the constant is NAMED here instead of quoted, which is what the retry note below already does right.

- THE TWO ENGINES, THEIR DATE AND THEIR REASON (#1278 path E, his ruling 2026-09-29 — the disappearing-technology law's clauses 1-3: a model choice carries a date and a reason and is re-asked with a measurement on HIS fixtures). A Sign now uses TWO models because his two courts answered about two different jobs, and he said so in one line: 'Sunburst was only chosen because it was more creative in outfit design. NBP2k was a better quality rersult though.' So — a DELIVERED VIEW renders on NANO BANANA PRO at the `2K` tier (1696x2528), his quality choice; and ONE WARDROBE PLATE per Sign renders on GPT IMAGE 2.5 SUNBURST at `high`, through Sunburst's EDIT door at 3504x2336 WITH HER SIGNED MASTER AS ITS ONE REFERENCE, his creativity choice. ⚠ THE PLATE WAS DRAWN FROM WORDS ALONE FOR ONE DAY AND HIS RULING ENDED IT (#1471, 2026-09-29, verbatim and entire): 'no the plate must reference the master image otherwise it wouldnt be able to invent the outfit correctly'. A plate that cannot see the top she was SIGNED in invents a different one, and the full-length view is then told to take the clothes from the plate — so the product would contradict a picture the customer had already accepted, above the waist, by design. Driven on his own Sifr the day it changed: the words-only plate came back a DIFFERENT WOMAN in a long slit dress; the master-edited plate is HER, wearing the master's own high-neck clasp, its two buckled shoulder straps, its chest graphic and its tattoo sleeve on the correct arm, with one hem and one pair of boots front and back. The plate is therefore HER and not a floating garment — also his word, on the relay's reading that two references which agree on identity cannot fight: 'i agreew tih you'. A BEING WITH NO OUTFIT GETS A PLATE TOO and there is no no-wardrobe gate: for a creature the plate is the lower body invented once — hide, scales, feet — which is what the two full-length views need to agree on, and the view's clause says so in as many words. Measured on cast #58, a signed alien: the plate LANDED rather than being refused, and its panels carry the whole body below the master's crop. The plate is two panels of one outfit — the product's own `frontFull` and `backFull` cameras, taken by name, never invented (his rule 2026-09-27: 'the sheet should copy the exact angles and camera views the current views use not invent new ones') — cut in half in memory and handed to those two views as a reference. NOTHING THE PLATE PAINTS IS EVER DELIVERED OR STORED. This SUPERSEDES #1459, which had put the delivered views on Sunburst's edit door at 2352x3504; it was right on its own question and is superseded inside path E's own PR by his instruction, never reverted separately. THE PRICE AND THE CLOCK, because a finding without them is not decision-grade: the plate is ONE EXTRA RENDER per Sign at ~$0.11-$0.15 of house money, no customer credit, and it runs IN PARALLEL with the three views that do not wear it — so a customer waits the plate's render standing where the full-length pair's would have started, not added to it. Measured through the real doors on his Sifr, 2026-09-29: plate 42.1 s, a delivered view ~29-34 s, six renders for $0.72 settled. Re-measured on the EDIT door the same day (#1471): plate 70.8 s on Sifr and 55.9 s on the creature — slower than the words-only plate, because the door now reads a 2.6 MB master — a delivered view 30-35 s, four renders for $0.43 settled, and the landscape ask survives a portrait reference (3504x2336 asked, 3504x2336 returned, read at the bytes). WHAT THE COURT SHOWED, and it is his defect reproduced and closed: master-only gave a plain midi with white boots at the FRONT and a MINI skirt with BLACK boots at the BACK — two outfits in one package, which is his 'the hem and shoes differ every take' — while master+plate gave one garment, one hem and one pair of boots both ways. His eye on a real Sign's strip is what closes it (law 9). NOTHING NAMES EITHER ENGINE ON A CUSTOMER PATH — no button, no loader, no refusal — and there is no flag: his word was the flip. The paid refine's non-repaint edit is untouched and is still Nano Banana Pro at 1K (`server/castingV2/refineService.ts`).
- THE PLATE MOVES THE DELIVERED PICTURE'S SHAPE UNLESS IT IS PINNED, and that was found by driving rather than by reading (#1278, 2026-09-29). Nano Banana Pro reads its output shape off its REFERENCES: measured on the real door, the same view came back 1696x2528 master-only, 1792x2400 with a 3:4 plate panel beside the chest-up anchor, and 1696x2528 again with `aspect_ratio: 2:3` pinned. Unpinned, path E would have shipped a five-view package with two views a different shape from the other three — a thing a customer sees at a glance in a strip of five and no test would have failed. It is pinned ONLY on the two views that carry a plate; the other three compose the request they always did. `aspectRatio` had never been set by any caller on any road before this, so the door's vocabulary was unverified here and the value above is the answer it gave rather than a table's.
- A PLATE FAILURE NEVER FAILS THE SIGN and never refunds (his rule, path E). Every fault — a refusal, a timeout, a dropped connection, an unsplittable plate, a credential nobody set — answers 'no plate', and the two full-length views then render master-only, which is byte for byte the request this road sent before path E. The one thing the plate road re-throws is a CANCELLATION, because an abort is the Sign being torn down rather than the plate failing, and the orchestrator catches that in turn: a view that is never ATTEMPTED is the single failure mode on this road with no refund path out of it (its audit row and its charge already exist). The plate is Sign/retry scratch — not a wardrobe card, not a looks card, not an R2 object, not customer-visible — so 'a new wardrobe means a new plate, never a reused one' holds by construction: nothing keeps one.
- The `2K` on a signed view's asset row is a TIER, never a pixel count, and #1459 left it alone on purpose. It never was a measurement — Nano Banana Pro answered `2K` with 1696x2528 and Sunburst answers 2352x3504 — it names the SIGNED-VIEW tier, the one the 1K anchor is not, which is the ROLE question `committedPackageAngles` and `unsettledPackageAngles` actually ask. A second label for the honest size would put two strings on one role across a live table whose existing rows cannot be relabelled without a row rewrite, and a reader still testing the old one would count a paid, landed view as never arrived. What carries the honest size instead is the row's own `provenance.engine`, stamped per asset, so a Sunburst row and a Nano Banana Pro row are told apart by the record rather than from memory.
- ONLY IDENTITY TAKES A PICTURE AWAY (#1612 part 2, his ruling 2026-09-30 terminal: 'dont you think having really strict checkers is unreliable?' → 'i agree with you'). The judge still answers on three axes and the answer still lands on the row, but only the IDENTITY axis refuses a view: `differs` and `unsure` both refuse, refund the slice and drop the frame, because a different person is the one failure that breaks the promise a signed Cast makes. A FRAMING or WARDROBE verdict that did not hold — either word — DELIVERS the picture, charged, marked unchecked, with the free Try again the product already offers on an unchecked view — ONE of them, since #1601 item 4: the first ask on an unchecked view is free, the second is an ordinary paid ask at `CASTING_V2_VIEW_RETRY_PRICE_CREDITS`, and whether this view's free one is spent is read off the operation rows (`listSpentFreeViewRetryAngles`) rather than off the slot, because a free retry does not move the state the free branch used to be derived from. WHY, and it is a measurement rather than an argument: read at the production rows the day it changed, every signed Cast all time, this product had refused 8 views — 5 on wardrobe, 3 on angle, and NOT ONE on identity — so every refusal it had ever made took a picture away for a reason that is not 'it is not her', and four of those eight are the four same-day cards (#1582, #1594, #1595, #1611) where the reading was simply wrong about what it was looking at. TWO CONSEQUENCES worth knowing before reading the loop: the regeneration budget is now only ever spent on an identity refusal, because a framing rejection delivers the frame in hand and re-rendering would throw away a picture the customer could have had (that choice is the customer's now, for free, through Try again); and `viewDeliveredUnchecked` reads TWO roads into the unchecked mark, `conformanceMethod: unavailable` (nobody looked, D-246) and a RECORDED axis that did not pass (somebody looked and it was delivered anyway) — a row with no conformance record at all keeps its old answer, which was measured rather than assumed: 20 of 69 landed views have none, and reading absence as unchecked would have handed every one of them a free retry retroactively. THE CUSTOMER SURFACE IS UNCHANGED: the same one word, `Unchecked`, and the same Try again link — no axis name, no verdict word, no percentage, and no price either way, which is his own ruling of 2026-09-26 ('No credit count in the row') and is why the second ask needs no new copy: a priced Try again with nothing on the row is already what a refunded view's link has always been. ⚠ AND THE FRAMING AXIS IS A MEASUREMENT NOW, NOT A READING — the hand-over, 2026-10-02, and this sentence read 'part 1 is built and NOT yet wired' until it landed. Every delivered view's framing band is read off the segmenter (`viewFramingGeometry.ts`, `fal-ai/sam-3/image` for the face and BiRefNet for the silhouette) inside the one judge both roads reach (`viewConformance.ts`), and the MEASUREMENT IS THE AUTHORITY: an out-of-band reading fails the framing axis whatever the vision model thought, an unmeasurable one cannot pass it, and only where the geometry holds does the reading govern what is left. That left half is real and is why the prose did not simply go away: an orientation, a turn, a concealment, a stride and a feature count are not boxes, and each is declared on its own band (`readerRemainder`). ⚠ AND THE CLOSE-UP'S OWN DISTANCE LINE IS SET BY HIS EYE RATHER THAN BY A COURT, which is the only bound here that is (#1837, 2026-10-03, founder-ordered). `roomBelowAtMost face` on the close-up band is 0.7 of a face-height of picture below the face, moved from 0.3 on his words at #1612's two Sifr2 frames — 'stop the example, sifr2 right hand pcitrue looks like a closeup to me' and then, asked about the other, 'on Sifr2 Yes it reads as a closeup' — of pictures measuring 0.42 and 0.51, both of which the 0.3 line called out of band. 0.7 is the geometric middle of the empty band between his highest judged close-up (0.51) and the tightest of his 11 sealed Portraits (1.10), the same method that set the Portrait's own 3.7 between 3.03 and 4.61. ⚠ AND THAT BAND IS NOT EMPTY — measured 2026-10-03 while drawing the strip #1837 owes his eye. Either bound was chosen from SIX close-ups; production has TEN delivered `closeUp` rows on his account, and the four nobody had read are 342 (0.155), 332 (0.333), 390 (0.404) and 384 (0.826). 384 — a bandaged skull, head and the top of the shoulders — sits inside the gap, so the 0.7 line turns away one delivered close-up in ten. NOTHING MOVED ON THAT FINDING: re-fitting the line to a frame a shift has just found would be fitting to a boundary case, which is the thing all three of these bounds exist to avoid, and it would be arithmetic overruling his eye. 384 is on the strip with the plain question under it and law 9 closes it. The reproduction arm, so the four new numbers are not a lone reading: all ten previously recorded values came back identical to two decimals through the same reader on the same frames, and no portrait read below 0.7. ⚠ It WIDENS the measurement past his own written sentence rather than restating it: the spec's 'TOO LOOSE … the neck and shoulders are in frame' describes the very frames he has now called close-ups (0.48 and 0.52 on his own assets), so the sentence is superseded on his eye and not merely re-said — which is law 9, and is why that sentence must keep leaving the post rather than being sent beside a number that disagrees with it. THE NARROWING IS SENTENCE-GRANULAR AND THAT IS A STATED SHORTFALL, not a quiet one. His ruling asked that the prose framing spec stop being sent; measured at the seven live specs, that is literally achievable on ONE of them, because six state a measured test and a reader's test inside a single sentence — `backFull`'s whole spec is 'the whole body seen from directly behind, head to feet inside the frame, face not visible', a direction, a crop and a concealment with two commas. Cutting at the commas would post a sentence nobody wrote as the standard a paid view is held to, and #1582 measured three careful rewordings of ONE framing spec each breaking a correct picture. So only a sentence the rules restate IN FULL is removed (`band.restatedInFull`, today the close-up's too-loose pair and nothing else — which is exactly the coin #1611 measured at 50/50), the posted question is held to being a verbatim subsequence of his own sentences, and the five views that still show the reader a clause they measure say so on the band (`band.readerAlsoAsked`). The remaining cost is a MARK and never a picture: a reader that over-refuses on framing can still mark a correct view `Unchecked` with a free Try again, which is part 2's own answer. WHAT IT COSTS: four segmenter reads per Sign at ~1c each, taken in parallel with the judge's own 23-36 s call, on the shared `FAL_CONCURRENCY` courtesy pool — no new fal path and no change to `falBudget.ts`'s four paths or their sum of 19 (read at `throughFalGate`, not assumed). The identity axis is untouched, by name: #1229 does not move. The production judge REFUSES to be built without the segmenter credential rather than falling back to a reading (`signEngine.ts`, invariant 7), and that refusal is driven at the wire.
- Description-stated ink rides the sign THROUGH THE DESCRIPTION even where the waist-up master cannot show it (founder ruling, fable-1356 §4) — the full-length views show arms and legs; a view that delivers it mints its crop as the document going forward.
- The wire is inert by ABSENCE OF INPUT, not fenced by flags: a cast with no delivered crop composes yesterday's prompt byte for byte (the empty-is-not-fenced lesson).
- The wardrobe judge checks the stored line once the Two Paths land — generator and judge share one owner so they cannot drift.
- TRY AGAIN ON ONE VIEW (#1208 slice 2, #1220 slice 2, his rule verbatim 2026-09-25: 'you pay 50 for each view you keep'): a delivered Cast's tile offers ONE button whose price is the whole difference between the two roads — a view that FAILED was refunded, so asking again is a paid view at `CAST_PACKAGE_VIEW_PRICE`; a view that arrived UNJUDGED (D-246, `conformanceMethod: unavailable`) was charged and kept, so asking again is free. The offer is read ONCE, by `castSlotRetryOffer` over the projection the room is shown, and the entrance re-reads that same function before it spends — there is no second opinion about what a tile may ask for. The render is `renderViewAttempts`, the Sign's own attempt loop called rather than copied, so a retried view carries her delivered ink crops, her carried feature words and her snapshotted outfit exactly as the Sign's did. Its money is Sign's pattern under an operation of its own (`castingV2.viewRetry`): charged at dispatch, refunded in full when it does not arrive, and the sweep's fork variable is the retried asset's own `provenance.retryOperationId`. Every refusal is free and before the claim (no offer on the slot, no render source, the anchor object gone) and NOTHING is offered while the package is still building, because the Sign still owns every slot. Like the rest of this road its refusals are service-internal and outside the declared door set.

### The ink studio — uploads, cuts, and the region road

A customer's tattoo design is stored as OUR COPY under the cast's purge path, capped at 8 per cast. The cutter isolates the design from its photograph (zero-RGB below the mask — the person leaves the BYTES, not just the alpha); the padded licence stops a photograph of a person riding whole; the region road cuts the SURFACE she pointed at with the face taken out; small cuts are enlarged by a faithful super-resolution model, never a diffusion one.

_Entrances:_ `server/castingV2/inkUploadService.ts` · `server/castingV2/inkUploadDoor.ts` · `server/castingV2/inkReferenceCutter.ts`  ·  _Flags:_ `CASTING_INK_STUDIO_SCOPE` · `CASTING_INK_CUT_SCOPE` · `CASTING_INK_REGION_CROP_SCOPE` · `CASTING_INK_REFERENCE_SCOPE`

_Called as:_ `castingV2.ink.remove`

> The upload door's refusals (placement, size, format, edge, intent, cap) are its own vocabulary, censused via its suite rather than the refine corpus. An upload-entrance corpus is future work — it needs bytes fixtures.

- The licence is a COUNT and never geometry; no percentage floor may ever be added (a floor that excludes the paper admits the man).
- The widening tripwire: the studio scope does not widen past users:1 while any upload can reach an engine uncropped.

### References — attach a picture, take a feature

Attach stores the customer's picture unchanged (a copy, ours to purge; the digest means byte identity later) and hands back a handle — nothing is read, cut, or charged at attach. A refine carrying the handle routes the take: hair colour as words she adopts, style and whole-look as a crop; a pointed-at tattoo documents the design. One reference at a time by ruling; the Pinterest-style selector is the road's next build.

_Entrances:_ `server/castingV2/referenceAttachDoor.ts` · `server/castingV2/hairReferenceTake.ts` · `server/castingV2/inkReferenceTake.ts`  ·  _Flags:_ `CASTING_REFERENCE_ATTACH_SCOPE` · `CASTING_HAIR_REFERENCE_SCOPE` · `CASTING_INK_REFERENCE_SCOPE`

_Called as:_ `castingV2.reference.attach`

> The attach/take doors are their own vocabulary; a reference-attached census state exists in the corpus and is the next fixture to build.

- What returns to a caller is the storage KEY, never a URL — the server fetches bytes itself; the address is the only thing between a photograph of a person and a stranger.

### The panel and the scan — what a cast shows about itself

The panel's rows come from the catalogue; content comes from the library and the delivery crops (the chain decides, the store looks up). The auto-scan fills empty rows on first look by asking a segmenter where each catalogue feature is (closed checklist — it cannot see tattoos or open kinds; cast-born discovery is the queued widening); a clean scan is kept in casting_face_scans, geometry only, stencils as objects under the purge path.

_Entrances:_ `server/castingV2/facePanel.ts` · `server/castingV2/faceScanService.ts`  ·  _Flags:_ `CASTING_FACE_SCAN_SCOPE` · `CASTING_SCAN_TABLE_SCOPE`

_Called as:_ `castingV2.facePanel` · `castingV2.faceScan`

> Panel and scan speak in projections, not refusal ids; their guarantees are pinned by their own suites.

- Discovery mints nothing into a recipe — the panel shows crops the founder's eyes judge; a crop becomes a carry only through the roads built for that.

### Re-imagine — one press turns her own words into a new idea, in her own box

Wherever there is a brief box, one press sends the words IN the box through the author and writes the result back INTO the box — visible, editable, undoable; casting then uses whatever is in the box, so there is no hidden mode a sheet could lie about. Sex, age and species are LOCKED when typed and nothing else is; lighting, camera, framing, backdrop and scene are banned in the instruction. One press is at most two text calls — a draft, then one re-ask naming the refusal — and a second refusal or a failed call answers `nothing`, leaving the box exactly as she typed it. Nothing is charged, nothing is stored, nothing renders.

_Entrances:_ `server/routes/castingV2.ts` · `server/castingV2/reimagine.ts`  ·  _Flags:_ `CASTING_V2_SCOPE`

_Called as:_ `castingV2.reimagine`

> THIS ROAD DECLARES NO DOOR, AND THAT IS ITS SHAPE RATHER THAN A GAP (#1203). Its three exits are none of the four declared shapes the census reads: outside CASTING itself it answers `NOT_FOUND` (`captureCastingV2Enabled` in `server/routes/castingV2.ts` — it was the register's capture until #1443 retired that flag, and the casting parent was already ANDed inside it, so the population this door refuses has not changed) — a DARK door, not a refusal, because a code saying 'not yet' advertises a capability; the ceiling is `RATE_LIMITS.reimagine` (`server/security/rateLimit.ts`); and every other outcome is the free answer `{ kind: "nothing" }` — no text engine configured, the author's SECOND draft refused too, or the call threw (both of the last two inside `reimagineBrief`, `server/castingV2/reimagine.ts`). The customer reads ONE sentence for all three (`Nothing to offer this time — your words stand.`, `client/src/features/castingV2/components/Reimagine.tsx`) and that is deliberate: an outage and a refusal ask her for the same next act. ⚠ AND NO CORPUS ROW CAN REACH THIS ENTRANCE — the corpus drives `refineCandidate` and nothing else, so #1203's own instruction to add 'a corpus row per door' is not something this harness can do; a reimagine corpus needs its own driver, and that is the map's next growth ring here.

- IT REPLACED THE IMAGINATION METER ENTIRELY (#535, his 'build it', Crew replies #145/#146, 2026-09-06): there is no level, no mode and no setting between the box and the picture except Style, so the #252 lie — a sheet reading 'Max' over words nobody authored — has nothing left to fall out of. The design is `docs/specs/REIMAGINE_DESIGN_2026-09-06.md` §3.
- A NEW IDEA, NOT A POLISH, and the locked trio is the whole of what survives verbatim (his decisions 3–4). An earlier reading had every named feature and material surviving; his own rolled courts overturned it at the frames (244 vs 245, '10x better'; 243 vs 246, 'much better') — named colours and materials are PIECES the author may reinvent, and the qualities paragraph beat the keep-every-piece paragraph both times.
- THE BOX IS THE FIDELITY CONTROL. `droppedFactIn` is retired for this road on purpose: the result lands in the customer's own box where she reads, edits and undoes it before she spends, so her reading is the check that a fact-survival guard used to be.
- AN EDITING INSTRUCTION IN THE BOX ('make her young', '50s') is applied by the SAME press and returns one clean brief (decision 11) — never appended to the sentence, never handled on the way to the engine.
- The reader is `about: "author"` on the engine, so a census pricing authored prose counts these presses with the roll's author calls rather than missing them.

### Upload a concept — a picture in, a description of the person out

A picture of a person is read ONCE, inline, and dropped; what comes back is WORDS, which land in her own brief box where she reads and edits them before she spends anything. There is no row, no table, no storage write and no purge path — which is what makes this road smaller than the attach door beside it rather than a variant of it, and why no stranger's photograph ends up at a permanently public URL. Reached from the start page, before any cast exists.

_Entrances:_ `server/routes/castingV2.ts` · `server/castingV2/conceptDescribe.ts`  ·  _Flags:_ `CASTING_V2_SCOPE` · `CASTING_CONCEPT_UPLOAD_SCOPE`

_Called as:_ `castingV2.concept.describe`

| door | kind | charge | where it lives | pinned | reached by |
|---|---|---|---|---|---|
| `concept.no_being` | concept-refusal |  | server/castingV2/conceptDescribe.ts:1280<br>server/castingV2/conceptDescribeCopy.ts:79 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `concept.not_about_the_person` | concept-refusal |  | server/castingV2/conceptDescribeCopy.ts:82 | 1 test(s) | _documented-unreachable or gap — see findings_ |
| `concept.not_a_casting_note` | concept-refusal |  | server/castingV2/conceptDescribeCopy.ts:87 | 2 test(s) | _documented-unreachable or gap — see findings_ |
| `concept.ran_long` | concept-refusal |  | server/castingV2/conceptDescribeCopy.ts:111 | 2 test(s) | _documented-unreachable or gap — see findings_ |
| `concept.unreadable` | concept-refusal |  | server/castingV2/conceptDescribe.ts:1272<br>server/castingV2/conceptDescribe.ts:1309<br>(+1) | 2 test(s) | _documented-unreachable or gap — see findings_ |
| `concept.no_transport` | concept-refusal |  | server/castingV2/conceptDescribe.ts:1208<br>server/castingV2/conceptDescribeCopy.ts:114 | 4 test(s) | _documented-unreachable or gap — see findings_ |

> ⚠ THIS ROAD'S DOORS REACHED THE MAP BEFORE THE ROAD DID — the six were declared with #192 and every one of them is documented-unreachable (the corpus sends sentences, not pictures), while the ENTRANCE they belong to had no road until #1203. That is the forward/backward asymmetry in one specimen: the map could prove every door it named was real and could not notice it had never named the road. The FLAG and the two byte doors above the six are still outside the declared set: `NOT_FOUND` off `captureCastingConceptUploadEnabled`, and the shared `referenceAttachBytesRefusal` / `BYTES_NOT_AN_IMAGE_MESSAGE` pair, which are the ink door's own sentences reused rather than restated.

- His own order, 2026-08-28 (#185): 'if you have a model already or concept or image you can upload it the image analyzer will analyze and describe it to the authour and cast it with the description ... that way its easy for someone to upload an image and get a prompt to create someone similar without having to type it all out.' Production holds `CASTING_CONCEPT_UPLOAD_SCOPE` at `all` since 2026-09-24 on his Crew reply #202 ('yes, turn it on').
- THE FORMAT IS WHAT THE BYTES ARE, never what the payload claimed — the ink door's rule reused. It matters twice here: the picture rides to the describer as a `data:<mime>;base64,` URI, so a JPEG announced as a PNG is a malformed request to the vendor rather than a bad row in our database.
- EVERY REFUSAL IS A DIFFERENT SENTENCE ON PURPOSE: 'there is nobody in this picture' and 'the reader did not answer' ask her to do different things, and telling her the wrong one sends her looking for a better photograph of a problem that was ours. They live in `CONCEPT_DESCRIBE_COPY` — exhaustive over the union by type — because composed inline they were invisible to the census: three of this entrance's five refusals could not be seen at all (#192).
- `concept.no_being` is the twin of the roll road's `not_a_being`, and it reached the map FIRST while its sibling stayed invisible — the pair is the reason both entrances' copy tables are now the declared source rather than a grep.

## Every way in — the 28 procedures the casting entrance exposes

Derived from the architecture Atlas's own extractor. A procedure with no road is an error finding, not a blank cell — the map is held to what EXISTS, not only to what it cites (#1203).

| called as | on which road |
|---|---|
| `castingV2.abandonSession` | life-of-a-cast |
| `castingV2.cancel` | life-of-a-cast |
| `castingV2.concept.describe` | concept-upload |
| `castingV2.config` | life-of-a-cast |
| `castingV2.createRoll` | life-of-a-cast |
| `castingV2.createSession` | life-of-a-cast |
| `castingV2.deleteCast` | life-of-a-cast |
| `castingV2.discard` | life-of-a-cast |
| `castingV2.facePanel` | panel-scan |
| `castingV2.faceScan` | panel-scan |
| `castingV2.follow` | life-of-a-cast |
| `castingV2.getCast` | life-of-a-cast |
| `castingV2.getRoll` | life-of-a-cast |
| `castingV2.getSession` | life-of-a-cast |
| `castingV2.ink.remove` | ink-studio |
| `castingV2.keep` | life-of-a-cast |
| `castingV2.openSessions` | life-of-a-cast |
| `castingV2.reference.attach` | references |
| `castingV2.refine` | refine-money, refine-reading, refine-ink |
| `castingV2.reimagine` | reimagine |
| `castingV2.renameCast` | life-of-a-cast |
| `castingV2.retry` | life-of-a-cast |
| `castingV2.retryView` | sign-views |
| `castingV2.roster` | life-of-a-cast |
| `castingV2.selectVariant` | life-of-a-cast |
| `castingV2.sign` | sign-views |
| `castingV2.undo` | life-of-a-cast |
| `castingV2.variants` | life-of-a-cast |

## The laws that hold on every road

- **Free before the claim: every refusal a customer can be told pre-claim costs nothing; charge-then-refund where the answer was knowable earlier is a defect.** _(refineService.ts (attempt counter); census ledger arm)_
- **The anchor is the pristine master; carries are words plus crops, never a chained delivered frame.** _(refineService.ts source resolution; anchor-is-the-pristine-master (memory/courts))_
- **The id points and the row decides — names in a record are believed only where a row backs them; missing rows skip loudly.** _(C4a (09f625a2); the carry's rescue; signInkCrops)_
- **A reader's negative chooses a lane, never turns a customer away or becomes a durable fact about her cast.** _(law 9 / fable-1052; C4b's closure)_
- **Source containment: a free value must appear in the customer's own sentence; engine-picked exceptions are declared, labelled, and doored.** _(refineDelta.ts (D-172); Two Paths design §4.1)_
- **Derive, never mirror: one owner per fact (the wardrobe line, the served-placements lists, the refusal registry); second lists are defects.** _(CLAUDE.md working law 4; wardrobeLine.ts (item 5))_
- **Every door has a name, a site, a pin and a reach — or a written reason; the census refuses the gap.** _(capabilityAtlas.mts coverage contract (fable-1357))_
- **Every entrance a customer can call is on some road, or carries a written reason — the map is held to what EXISTS, not only to what it cites.** _(capability-atlas-roads.mts `procedures` / UNMAPPED_ENTRANCES (#1203))_

## The asks

| id | ask | state | believed | observed | what the customer reads |
|---|---|---|---|---|---|
| ink.words.neck | give him a small swallow tattoo on his neck | master | would-render | would-render |  |
| ink.words.arm | give him a small swallow tattoo on his left upper arm | master | would-render | would-render |  |
| ink.words.chest | give him a small swallow tattoo on his upper chest | master | refused:gate_ink_uncarried | refused:gate_ink_uncarried | His top covers his upper chest, so a tattoo there wouldn't survive the next edit. I can put it on his neck or an upper arm now — or change w |
| ink.words.face | give her a small star tattoo on her cheek | master | refused:gate_ink_document | refused:gate_ink_document | Tell me where it goes — a neck or an upper arm tattoo is what I can do from a description alone. Anywhere else needs a design to work from f |
| ink.words.noplace | give him a tattoo | master | refused:gate_ink_document | refused:gate_ink_document | Tell me where it goes — a neck or an upper arm tattoo is what I can do from a description alone. Anywhere else needs a design to work from f |
| ink.words.behind-ear | a tiny moon tattoo behind her ear | master | refused:gate_ink_document | refused:gate_ink_document | Tell me where it goes — a neck or an upper arm tattoo is what I can do from a description alone. Anywhere else needs a design to work from f |
| ink.transform.none | make his chest tattoo bigger | master | refused:gate_ink_document | refused:gate_ink_document | Tell me where it goes — a neck or an upper arm tattoo is what I can do from a description alone. Anywhere else needs a design to work from f |
| ink.remove.none | take his tattoos off | master | refused:removal_absent | refused:removal_absent | I can't find any tattoos on this face — there's nothing to take off. Nothing was charged. |
| ink.transform.has | his upper arm tattoo — make it bigger | branch-with-ink | would-render | would-render |  |
| ink.transform.wrongslot | his upper chest tattoo — make it bigger | branch-with-ink | free:noInkToChange | free:noInkToChange | I can't find his upper chest on this version, so there's nothing there to change or take off. Ask me about one that's there, or say where to |
| ink.transform.two | make his arm tattoo bigger and darker | branch-with-ink | free:inkOneChangeAtATime | free:inkOneChangeAtATime | I can change one thing about a tattoo at a time — bigger or smaller, higher or lower, darker or lighter. Say which one you'd like first and  |
| ink.remove.has | take the tattoo off his arm | branch-with-ink | free:navigate | free:navigate | That takes it back to the original — nothing charged. |
| mark.scar.forehead | give her a harry potter lightning bolt scar on her forehead | master | would-render | would-render |  |
| mark.freckles | give her freckles | master | would-render | would-render |  |
| acc.earrings.add | give her gold hoop earrings | master | would-render | would-render |  |
| acc.glasses.remove.none | take her glasses off | master | refused:removal_not_in_brief | refused:removal_not_in_brief | His brief didn't ask for glasses, and nothing since has added any, so there's nothing on record to take off. If he is wearing glasses in the |
| acc.glasses.remove.has | take her glasses off | branch-with-accessory | free:navigate | free:navigate | That takes it back to the original — nothing charged. |
| hair.colour | make her hair copper red | master | would-render | would-render |  |
| hair.style | give her a short bob | master | would-render | would-render |  |
| hair.bald | make him bald | master | would-render | would-render |  |
| eye.colour | her eyes — green | master | would-render | would-render |  |
| eye.colour.side | make her right eye fiery red | master | would-render | would-render |  |
| eye.shape.fox | give her fox eyes | master | would-render | would-render |  |
| eye.scoped.left | make it green _(scope eye@left)_ | master | would-render | would-render |  |
| build.muscular | give him a jacked muscular build | master | would-render | would-render |  |
| skin.tan | give her a deep tan | master | would-render | would-render |  |
| wardrobe.tee | put him in a plain black tee | master | refused:wall_unbacked | refused:wall_unbacked | Refining can't do a plain black tee yet — it isn't one of the things this can name. Faces, hair, skin, build and anything worn do work here. |
| wardrobe.tee.wardrobePath | put him in a plain black tee | wardrobe-path | would-render | _—_ |  |
| ink.words.chest.basics | give him a small swallow tattoo on his upper chest | basics-path | refused:gate_ink_coverage_unread | _—_ |  |
| light.softer | softer light | master | refused:unreadable | refused:unreadable | That one didn't come through clearly. Try naming what you want changed about them. Nothing was charged. |
| open.wings | give her wings | master | would-render | would-render |  |
| open.horns | give her small horns | master | would-render | would-render |  |
| makeup.lipstick | give her red lipstick | master | would-render | would-render |  |
| guard.likeness | make her look like Taylor Swift | master | refused:wall_likeness | refused:wall_likeness | Refining can't make someone look like a specific real person. Nothing was charged. |
| guard.content | remove all her clothes | master | refused:wall_content | refused:wall_content | That one can't be rendered. Nothing was charged. |
| guard.stage | put her on a beach at sunset | master | refused:wall_unbacked | refused:wall_unbacked | Refining can't do a beach at sunset yet — it isn't one of the things this can name. Faces, hair, skin, build and anything worn do work here. |
| guard.empty |  | master | refused:empty | refused:empty | Say what you'd like changed — anything about the person themselves. |
| guard.gibberish | asdf qwer zxcv | master | refused:unreadable | refused:unreadable | That one didn't come through clearly. Try naming what you want changed about them. Nothing was charged. |
| guard.typo | give her a nose rign | master | asked:did-you-mean | **would-render** |  |
| guard.scope.unknown | make it green _(scope elbow@left)_ | master | refused:scope_unknown | refused:scope_unknown | I don't know which part of him that is. Nothing was charged. |
| guard.scope.ink.none | make it bigger _(scope ink:upperArm@left)_ | master | refused:unreadable | refused:unreadable | That one didn't come through clearly. Try naming what you want changed about them. Nothing was charged. |
| ref.hair.whole | copy this hair | reference-attached | would-render | _not driven_ |  |
| ref.ink.sleeve | copy his right arm sleeve onto him | reference-attached | would-render | _not driven_ |  |
| ink.words.neck.branch | give him a small star tattoo on his neck | branch-with-ink | would-render | would-render |  |
| ink.remove.branch.whole | take his tattoos off | branch-with-ink | free:navigate | free:navigate | That takes it back to the original — nothing charged. |
| acc.remove.branch.other | take her earrings off | branch-with-accessory | refused:removal_not_in_brief | refused:removal_not_in_brief | His brief didn't ask for earrings, and nothing since has added any, so there's nothing on record to take off. If he is wearing earrings in t |
| age.older | make her ten years older | master | refused:wall_unbacked | refused:wall_unbacked | Refining can't do her age yet — it isn't one of the things this can name. Faces, hair, skin, build and anything worn do work here. Nothing w |
| expression.smile | make him smile | master | would-render | would-render |  |
| hair.remove.none | remove her fringe | master | would-render | would-render |  |
| acc.piercing | give him a silver nose ring | master | would-render | would-render |  |
| eye.both.sides | make her left eye blue and her right eye green | master | would-render | would-render |  |
| skin.freckles.remove.none | she never had freckles | master | refused:removal_absent | refused:removal_absent | I can't find any freckles on this face — there's nothing to take off. Nothing was charged. |
| brows.thicker | give her thicker eyebrows | master | would-render | would-render |  |
| beard.full | give him a full beard | master | would-render | would-render |  |
| guard.undo | undo | master | refused:already_original | refused:already_original | You're already looking at the original. Nothing was charged. |
| guard.multi | green eyes, copper hair, and freckles | master | would-render | would-render |  |
| guard.compliment | he looks great | master | refused:wall_unbacked | refused:wall_unbacked | Refining can't do how attractive they look yet — it isn't one of the things this can name. Faces, hair, skin, build and anything worn do wor |
| wardrobe.colour | make his tee black | master | refused:wall_unbacked | refused:wall_unbacked | Refining can't do his tee yet — it isn't one of the things this can name. Faces, hair, skin, build and anything worn do work here. Nothing w |
| background.white | make the background pure white | master | refused:wall_stage | refused:wall_stage | Refining changes the person, not the shoot — the background is a garment, a prop or the set, which comes after Sign. Jewellery, glasses and  |
| ink.transform.dangling | his upper chest tattoo — make it bigger | branch-with-dangling-crop | free:inkNotKept | free:inkNotKept | That's his upper chest tattoo — he has it, and I didn't keep a copy of the artwork, so I can't change it from here. Nothing was charged. |
| ink.scoped.none.prefill | his upper arm tattoo — make it bigger _(scope ink:upperArm@left)_ | master | free:noInkToChange | free:noInkToChange | I can't find his left upper arm tattoo on this version, so there's nothing there to change or take off. Ask me about one that's there, or sa |

## Every door the source declares

| id | kind | charge | pinned by |
|---|---|---|---|
| absorbed | interpreter-refusal |  | referenceWordsLane.test.ts, refineRefusals.test.ts |
| absorbed_departure | interpreter-refusal |  | refineRefusals.test.ts |
| already_original | service-refusal |  | refineService.test.ts |
| already_signed | service-refusal |  | refineService.test.ts |
| askNotCarried | cannot-say | refunded | cannotSayCopy.test.ts, repaintAsks.test.ts |
| busy | service-refusal |  | refusalTag.test.ts, rollService.test.ts |
| candidate_missing | service-refusal |  | refineService.test.ts |
| concept.no_being | concept-refusal |  | conceptDescribe.test.ts |
| concept.no_transport | concept-refusal |  | conceptDescribe.test.ts, conceptDescribeCopy.test.ts, hairColourFromReference.test.ts, refineService.test.ts |
| concept.not_a_casting_note | concept-refusal |  | conceptDescribe.test.ts, conceptDescribeCopy.test.ts |
| concept.not_about_the_person | concept-refusal |  | conceptDescribe.test.ts |
| concept.ran_long | concept-refusal |  | conceptDescribe.test.ts, conceptDescribeCopy.test.ts |
| concept.unreadable | concept-refusal |  | conceptDescribe.test.ts, conceptDescribeCopy.test.ts |
| departure | cannot-say | refunded | cannotSayCopy.test.ts |
| empty | interpreter-refusal |  | diagnosticCapture.test.ts, faceScan.test.ts, readerOutageRefusal.test.ts, refineRefusals.test.ts |
| gate_ink_coverage_unread | interpreter-refusal |  | refineDelta.test.ts, refineRefusals.test.ts, refineService.test.ts |
| gate_ink_document | interpreter-refusal |  | inkReferenceGate.test.ts, refineDelta.test.ts |
| gate_ink_uncarried | interpreter-refusal |  | refineDelta.test.ts, refineRefusals.test.ts, refineService.test.ts |
| gate_ink_unkeepable | interpreter-refusal |  | refineRefusals.test.ts |
| history_predates_undo | service-refusal |  | refineService.test.ts |
| history_unreadable | service-refusal |  | refineService.test.ts |
| inkBeyondToday | cannot-say | free | cannotSayCopy.test.ts, inkBeyondTodayAsk.test.ts |
| inkNotKept | cannot-say | free | cannotSayCopy.test.ts |
| inkOneChangeAtATime | cannot-say | free | cannotSayCopy.test.ts |
| kind_unserved | service-refusal |  | refineService.test.ts |
| master_missing | service-refusal |  | refineService.test.ts |
| noInkToChange | cannot-say | free | cannotSayCopy.test.ts |
| notASlot | cannot-say | free | cannotSayCopy.test.ts, carrySurvival.test.ts, mintedSlots.test.ts, openKindPolicy.test.ts, openLaneKind.test.ts, repaintAsks.test.ts |
| nothingAsked | cannot-say | free | cannotSayCopy.test.ts, repaintAsks.test.ts |
| noWords | cannot-say | refunded | cannotSayCopy.test.ts, mintedSlots.test.ts, repaintAsks.test.ts, viewFeatureWords.test.ts |
| perSideRemoval | cannot-say | refunded | cannotSayCopy.test.ts, repaintAsks.test.ts |
| reader_outage | interpreter-refusal |  | readerOutageRefusal.test.ts, refineInterpreterCeiling.test.ts |
| reference.pictureCap | reference-refusal |  | uploadRefusalCopy.test.ts |
| refine_limit | service-refusal |  | refineService.test.ts |
| removal | cannot-say | refunded | cannotSayCopy.test.ts, repaintAsks.test.ts |
| removal_absent | service-refusal |  | refusalTag.test.ts |
| removal_not_in_brief | service-refusal |  | refineService.test.ts |
| removal_reread_unmatched | service-refusal |  | refineService.test.ts |
| removal_uncheckable | service-refusal |  | refineService.test.ts |
| removal_unnameable | service-refusal |  | refineService.test.ts |
| removal_unnamed | service-refusal |  | refineService.test.ts |
| roll.likeness | roll-refusal |  | briefRefusalCopy.test.ts, cohortWallRetry.test.ts, colourContextDoor.test.ts, creativeRegisterScope.test.ts, likenessRefusal.test.ts, stageWallBackstop.test.ts, styleRefusal.test.ts |
| roll.not_a_being | roll-refusal |  | briefRefusalCopy.test.ts, creativeRegisterScope.test.ts |
| roll.reader_outage | roll-refusal |  | briefCompiler.test.ts, briefRefusalCopy.test.ts, readerOutageRefusal.test.ts, styleRefusal.test.ts |
| roll.uninterpretable | roll-refusal |  | briefCompiler.test.ts, briefRefusalCopy.test.ts |
| scope_mismatch | service-refusal |  | refineService.test.ts |
| scope_unknown | service-refusal |  | refineService.test.ts |
| session_closed | service-refusal |  | rollService.test.ts |
| session_expired | service-refusal |  | rollService.test.ts |
| session_missing | service-refusal |  | rollService.test.ts |
| sideNamedWithoutScope | cannot-say | refunded | cannotSayCopy.test.ts, repaintAsks.test.ts |
| step_moved | service-refusal |  | refineService.test.ts |
| uncatalogued | cannot-say | refunded | cannotSayCopy.test.ts, repaintAsks.test.ts |
| unnamedObject | cannot-say | refunded | cannotSayCopy.test.ts, mintedSlots.test.ts, repaintAsks.test.ts |
| unplacedInk | cannot-say | refunded | cannotSayCopy.test.ts, inkBeyondTodayAsk.test.ts, repaintAsks.test.ts |
| unreadable | interpreter-refusal |  | creativeRegisterScope.test.ts, hairColourFromReference.test.ts, makeupFromReference.test.ts, openLaneAccept.test.ts, openLaneKind.test.ts, readerOutageRefusal.test.ts, refineService.test.ts |
| upload.tooLarge | upload-refusal |  | inkUploadDoor.test.ts, uploadRefusalCopy.test.ts |
| upload.tooSmall | upload-refusal |  | inkUploadDoor.test.ts, referenceAttachService.test.ts, uploadRefusalCopy.test.ts, server/db/castingV2ReferenceLibrary.test.ts |
| upload.unreadable | upload-refusal |  | inkReferenceCutter.test.ts, inkUploadDoor.test.ts, referenceAttachService.test.ts, uploadRefusalCopy.test.ts |
| upload.unsupportedFormat | upload-refusal |  | inkUploadDoor.test.ts, referenceAttachService.test.ts, uploadRefusalCopy.test.ts |
| version_missing | service-refusal |  | refineService.test.ts |
| wall_content | interpreter-refusal |  | colourContextDoor.test.ts, priorContextDoor.test.ts, referenceWordsLane.test.ts, refineRefusals.test.ts, refineService.test.ts, stageWallBackstop.test.ts |
| wall_likeness | interpreter-refusal |  | colourContextDoor.test.ts, inkReferenceGate.test.ts, referenceWordsLane.test.ts, refineDelta.test.ts, refineRefusals.test.ts, stageWallBackstop.test.ts |
| wall_stage | interpreter-refusal |  | bornPathSubjects.test.ts, colourContextDoor.test.ts, inventionDoor.test.ts, priorContextDoor.test.ts, referenceWordsLane.test.ts, refineDelta.test.ts, refineRefusals.test.ts, refineService.test.ts, stageWallBackstop.test.ts |
| wall_unbacked | interpreter-refusal |  | priorContextDoor.test.ts, refineRefusals.test.ts, stageWallBackstop.test.ts |
| wall_unfileable | interpreter-refusal |  | colourContextDoor.test.ts, inventionDoor.test.ts, referenceWordsLane.test.ts, refineDelta.test.ts, refineFacets.test.ts, refineInterpreterVouchedRecheck.test.ts, refineService.test.ts, refusalTag.test.ts |
| whichInkToChange | cannot-say | free | cannotSayCopy.test.ts |

## Flags (21)

`CASTING_BORN_INK_SCOPE` · `CASTING_BRIEF_FIDELITY_SCOPE` · `CASTING_CONCEPT_UPLOAD_SCOPE` · `CASTING_FACE_SCAN_SCOPE` · `CASTING_HAIR_REFERENCE_SCOPE` · `CASTING_INK_CUT_SCOPE` · `CASTING_INK_REFERENCE_SCOPE` · `CASTING_INK_REGION_CROP_SCOPE` · `CASTING_INK_STUDIO_SCOPE` · `CASTING_INK_TRANSFORM_SCOPE` · `CASTING_INK_WORDS_SCOPE` · `CASTING_OPEN_LANE_SCOPE` · `CASTING_REFERENCE_ATTACH_SCOPE` · `CASTING_REFERENCE_LIBRARY_SCOPE` · `CASTING_REFINE_DISPATCH_SCOPE` · `CASTING_REPAINT_SCOPE` · `CASTING_RETRY_SCOPE` · `CASTING_ROLL_ENGINE_SCOPE` · `CASTING_SCAN_TABLE_SCOPE` · `CASTING_SIDE_PHRASING_SCOPE` · `CASTING_V2_SCOPE`

## Findings (56)

- **warn** `belief-mismatch` guard.typo — "give her a nose rign" — believed asked:did-you-mean, observed would-render
- **info** `documented-unreachable` already_signed — no corpus row reaches it: answers a refine sent at a SIGNED cast — request state, not sentence content — a row could reach it via: a signed-cast fixture, if sign-state rows are ever wanted; pinned by its C5 service arm
- **info** `documented-unreachable` askNotCarried — no corpus row reaches it: answers an ask whose own record does not line up with another record this product minted — an open-lane key `slotDefinition` will not resolve, a kind the step asked for that the composed state does not carry, or a placement definition whose slot is not in the slot catalogue. Every one is two of OUR tables disagreeing, so no sentence a customer types reaches it; the corpus sends a sentence at a real Cast and the state it composes is by construction internally consistent — a row could reach it via: deliberately never as a corpus row. TWO of the three branches are driven directly in `repaintAsks.test.ts` — the unresolvable open key, and the composition that drops this step's own ask. The THIRD (a placement definition outside the slot catalogue) is NOT driven and is stated so rather than implied: reaching it needs the placement table and the slot catalogue to disagree, which no fixture can arrange through the public entrance today
- **info** `documented-unreachable` candidate_missing — no corpus row reaches it: answers a request naming a cast the account does not own — request shape — a row could reach it via: deliberately never as a corpus row; pinned by its C5 service arm
- **info** `documented-unreachable` concept.no_being — no corpus row reaches it: answers an upload whose read found no BEING in the picture at all — an object, a vehicle, a landscape, a product. It is the concept entrance's own edge of the same boundary the roll road draws at `not_a_being`, and #204 narrowed it there: a creature, a robot or an alien is a subject, so this fires only outside all four — a row could reach it via: a corpus row that carries a fixture PICTURE through the real concept entrance — cents of describer reads, the class of money the corpus already spends on text; nothing in the row grammar carries an image today
- **info** `documented-unreachable` concept.no_transport — no corpus row reaches it: answers an upload made with no text engine configured at all — a deployment state, not a picture and not a sentence — a row could reach it via: deliberately never as a corpus row: the census runs against a configured service by construction; pinned by its own arm
- **info** `documented-unreachable` concept.not_a_casting_note — no corpus row reaches it: answers a read that came back as an inventory rather than a type — #185's ruling in code, and the door is OURS by construction: the granularity rule is judged on our own reply, never on her picture — a row could reach it via: the same picture-carrying corpus row; the fault is in the reply, so reaching it deterministically means driving the describer with a doubled reader rather than a fixture picture
- **info** `documented-unreachable` concept.not_about_the_person — no corpus row reaches it: answers a read that came back describing the FRAME instead of the subject — the light, the set, the camera, a resemblance — twice in a row. It is a fault of our reader's output, not of her photograph, which is why it has its own sentence — a row could reach it via: the same picture-carrying corpus row, plus a fixture whose read reliably lands on the frame; the model's answer is the variable, so it is a probe rather than a fixture
- **info** `documented-unreachable` concept.ran_long — no corpus row reaches it: answers a read that came back OVER the 300-character ceiling twice — prose about the right person, at the wrong length. Split off `concept.not_a_casting_note` by #1067, because that sentence calls the read "a list of details" and #185 ruled it about an INVENTORY: measured on his own uploads (production, 2026-09-22), six of seven reads sent back were this fault and every one was 304–350 characters, the shortest overrunning by four. Ours by construction, exactly as its sibling is — the length is judged on our own reply, never on her picture — a row could reach it via: the same picture-carrying corpus row as its four siblings; the fault is in the reply's LENGTH, so reaching it deterministically means driving the describer with a doubled reader rather than a fixture picture
- **info** `documented-unreachable` concept.unreadable — no corpus row reaches it: answers a read that never arrived twice — an unparseable reply, a transport throw, or a 200 carrying an empty completion. Since #193 the second ask is bought before this is said, so the state it describes is TWO failures and not one — a row could reach it via: deliberately never as a corpus row: manufacturing two consecutive reader outages would test the harness, not the product. Its pin is its own arm, which is the shape `removal_uncheckable` is documented with above
- **info** `documented-unreachable` gate_ink_unkeepable — no corpus row reaches it: item 7a's split of gate_ink_uncarried: the surface is BARE and the words road cannot crop a result there. Its population was `upperChest`, the one measured placement the words road did not serve — and the Basics chest court (2026-08-23) put the chest on the road, so `uncarriedInkPlaces` is EMPTY and no measured surface is seen-but-unkept. The refusal is kept because it is the only true thing to say about a placement in that state, which the next measured surface will be in on the day it is added — a row could reach it via: the day INK_PLACEMENTS gains a fourth surface — it lands unserved by the words road, which is exactly this door's state, before any court opens it
- **info** `documented-unreachable` history_predates_undo — no corpus row reaches it: answers an undo against a chain older than typed removal — legacy-era state — a row could reach it via: pinned by its C5 service arm
- **info** `documented-unreachable` history_unreadable — no corpus row reaches it: answers a chain whose stored steps fail to parse — corrupt-state, not sentence — a row could reach it via: pinned by its C5 service arm
- **info** `documented-unreachable` inkBeyondToday — no corpus row reaches it: needs a documented ask naming a placement beyond the measured vocabulary — the same states as unplacedInk with an off-vocabulary place word — a row could reach it via: the reference-attached fixture, asking for a sleeve
- **info** `documented-unreachable` kind_unserved — no corpus row reaches it: answers an open-kind render the engine table cannot serve — engine-config state — a row could reach it via: pinned by its C5 service arm
- **info** `documented-unreachable` master_missing — no corpus row reaches it: answers a cast whose master object is gone — storage state no fixture manufactures honestly — a row could reach it via: pinned by its C5 service arm
- **info** `documented-unreachable` notASlot — no corpus row reaches it: the catalogue's no-picture answer; makeup — its historical population — now renders (measured, drive-4), and no current master-state ask reaches a facet the catalogue refuses a picture for — a row could reach it via: a facet that regains the no-picture classification, or a driven ask found to reach it
- **info** `documented-unreachable` reader_outage — no corpus row reaches it: REFINE's own reader outage — the sentence was never read because the call threw, the deadline passed, or no engine is configured. The twin of `roll.reader_outage` on the refine road, and of `concept.unreadable`; free, before the claim, exactly as the `unreadable` beside it always was. What changed is only WHOSE fault it names: `unreadable` means a reply came back and could not be read, and its sentence tells her to try naming what she wants changed, which is advice she cannot follow when the failure is ours — a row could reach it via: deliberately never as a corpus row, on the same ground the two doors above state: manufacturing a reader outage in the census would test the harness and not the product. Its pin is its own driven arm in `readerOutageRefusal.test.ts`, which throws the exact ProviderError a 402 produces and asserts the classifier's mapping beside it
- **info** `documented-unreachable` reference.pictureCap — no corpus row reaches it: answers an attach at a Cast already holding all the pictures it may — a real TOO_MANY_REQUESTS (invariant 6), raised from a database count rather than from the bytes. The attach is the only upload entrance that KEEPS what it takes, so it is the only one that can run out of room; `castingV2.concept.describe` stores nothing and has no cap to hit — a row could reach it via: a corpus row that could attach EIGHT pictures to one Cast and then a ninth — a state built from eight prior writes, which is a fixture rather than a row whatever entrance the grammar gains. Driven today by `inkReferenceMint.test.ts`, which holds the sentence to naming no move the customer cannot make
- **info** `documented-unreachable` refine_limit — no corpus row reaches it: answers the 24-instruction ceiling — needs 24 paid variants on one cast (the census never renders) — a row could reach it via: pinned by its C5 service arm; verify-bot's ceiling cast proved it live (opus-969)
- **info** `documented-unreachable` removal_reread_unmatched — no corpus row reaches it: needs the ambiguity re-read to produce a removal whose noun then matches no step — a two-model-disagreement state that cannot be scripted through the real interpreter deterministically — a row could reach it via: deliberately never: pinned by its service arm (C5); a census row would be a coin flip (the model's read is the unstable thing)
- **info** `documented-unreachable` removal_uncheckable — no corpus row reaches it: needs the removal-verification reader to be unavailable mid-ask — an infrastructure failure state no fixture manufactures honestly — a row could reach it via: deliberately never: its pin is its service arm (C5), and manufacturing reader outages in the census would test the harness, not the product
- **info** `documented-unreachable` roll.likeness — no corpus row reaches it: answers a brief asking for a real person or a named character — the one subject wall the author road KEEPS (ruling §6 rule 5). HIT IN PRODUCTION whenever a customer types a famous name; it is here because no corpus row can send a BRIEF, not because it is quiet. Pinned by five suite files including its own `likenessRefusal.test.ts` — a row could reach it via: a corpus row grammar that carries a BRIEF to `castingV2.createRoll` instead of a sentence to `castingV2.refine` — a second driven entrance, the same shape the concept entrance's picture-carrying row needs, and free at every one of these five doors
- **info** `documented-unreachable` roll.not_a_being — no corpus row reaches it: answers a brief whose subject is not a being — an object, a vehicle, a place. THE one wall the author road ADDS (founder: 'someone asking for an object should be refused like a car'), and the twin of `concept.no_being`, which #192 put on the map while this half stayed invisible. Also hit in production — a row could reach it via: the same brief-carrying row; its twin's arm already holds the two sentences to one shared boundary clause, so a row would be measuring the road rather than the words
- **info** `documented-unreachable` roll.reader_outage — no corpus row reaches it: answers a brief whose reader never answered — the transport threw, the deadline passed, or no engine is configured. Free by founder ruling (#126, 'refuse-free', always). An infrastructure state, not a sentence — a row could reach it via: deliberately never as a corpus row: manufacturing a reader outage in the census would test the harness and not the product — the discharge `removal_uncheckable` and `concept.unreadable` already carry. Its pin is its own driven arm in `briefCompiler.test.ts`
- **info** `documented-unreachable` roll.uninterpretable — no corpus row reaches it: answers a brief shorter than `BRIEF_TEXT_MIN` — the floor, raised by both the live compiler and the deterministic one. Its state is a REQUEST too small to be a brief, which the refine grammar has no field for — a row could reach it via: the same brief-carrying row, sending a brief under the floor; the cheapest of the five to drive and the least informative
- **info** `documented-unreachable` scope_mismatch — no corpus row reaches it: answers a scope naming nothing the instruction writes — needs a tap+sentence disagreement the interpreter usually resolves; the deterministic form is its C5 arm — a row could reach it via: pinned by its C5 service arm
- **info** `documented-unreachable` session_closed — no corpus row reaches it: answers Roll again on a sheet the customer ABANDONED (Start over) — the same door as session_expired with the word closed — a row could reach it via: the same brief-carrying row against an abandoned fixture session; pinned by its rollService arm
- **info** `documented-unreachable` session_expired — no corpus row reaches it: answers Roll again on a sheet the retention rule has EXPIRED (thirty quiet days) — names expiry, promises nothing was charged, and fires before the interpreter it used to spend 13 s on — a row could reach it via: the same brief-carrying row against an expired fixture session; pinned by its rollService arm and driven in the app on dev session 89 (PR #859)
- **info** `documented-unreachable` session_missing — no corpus row reaches it: answers a roll naming a sheet the account does not own, or none — the ownership sentence and code, said before any text call instead of after a paid one — a row could reach it via: the brief-carrying row the roll.* doors above wait for; pinned by its rollService arm
- **info** `documented-unreachable` step_moved — no corpus row reaches it: answers a chip removal whose index went stale mid-click — a race no scripted sentence makes — a row could reach it via: pinned by its C5 service arm
- **info** `documented-unreachable` unplacedInk — no corpus row reaches it: raised at the pre-claim ink door only for a DOCUMENTED ask with no placement; every master-state words ask dies earlier at the document gate (measured, drive-4), and the documented states (reference attached, delivered ink) resolve their placement before that door — a row could reach it via: a reference-attached fixture whose take carries no placement
- **info** `documented-unreachable` upload.tooLarge — no corpus row reaches it: answers a file over the byte ceiling, judged BEFORE the decode so a huge file costs nothing to refuse. The route's own zod input cap sits above it at the same number, so the common case never reaches this door at all — which is why it is the one of the four whose absence from the map mattered least and is still a door — a row could reach it via: the same picture-carrying row, carrying more bytes than `INK_DESIGN_MAX_BYTES`. Driven today by `inkUploadDoor.test.ts` at the boundary and one byte over it
- **info** `documented-unreachable` upload.tooSmall — no corpus row reaches it: answers a picture under the edge floor — one that can describe that there was something rather than what it was. The floor exists because an attached picture is destined to become a CROP in a repaint recipe, so refusing at the door beats delivering a blur — a row could reach it via: the same picture-carrying row at 255px. Driven today by `inkUploadDoor.test.ts` and by `referenceAttachService.test.ts`, which drives the whole attach with an undersized png
- **info** `documented-unreachable` upload.unreadable — no corpus row reaches it: answers bytes sharp could not open at all, or a payload that was never base64 — the one sentence both live upload roads say, `castingV2.concept.describe` (every account) and `castingV2.reference.attach`. It is NOT the interpreter's `unreadable`, which means a reply came back unreadable, and the qualification is what keeps the two apart on this map — a row could reach it via: a corpus row grammar that carries a PICTURE instead of a sentence — the same second driven entrance `concept.no_being` and its four siblings need, and free at every one of these doors. Driven today by `uploadRefusalCopy.test.ts`, which calls both byte doors and asserts the sentence they hand back
- **info** `documented-unreachable` upload.unsupportedFormat — no corpus row reaches it: answers bytes that decoded cleanly and are not one of the three formats we take. The format is what the BYTES are, never what the payload claimed — this door is given no declared mime and no filename, so there is no field for a claim to arrive in — a row could reach it via: the same picture-carrying row; a fixture PDF renamed .png is the cheapest of the four to drive and would prove the format rule rather than the transport. Driven today by `inkUploadDoor.test.ts`
- **info** `documented-unreachable` version_missing — no corpus row reaches it: answers a replay marker naming a version that is not the predecessor — request shape — a row could reach it via: pinned by its C5 service arm
- **info** `documented-unreachable` whichInkToChange — no corpus row reaches it: needs a branch wearing TWO tattoos; no cast in either world has ever worn two at once (opus-966 §1) and the multi-tattoo fixture is §10 item 3b's build — a row could reach it via: item 3b's keying work, which needs two-tattoo state to test itself
- **info** `not-driven` ref.hair.whole — needs state "reference-attached", which this fixture cannot supply
- **info** `not-driven` ref.ink.sleeve — needs state "reference-attached", which this fixture cannot supply
- **warn** `shared-bare-door-id` reader_outage — "reader_outage" is the bare id of 2 declared doors (reader_outage, roll.reader_outage) — a test quotes the bare word, so each door's pins are narrowed to the suites that reach its own raise sites
- **warn** `shared-bare-door-id` unreadable — "unreadable" is the bare id of 3 declared doors (concept.unreadable, unreadable, upload.unreadable) — a test quotes the bare word, so each door's pins are narrowed to the suites that reach its own raise sites
- **warn** `unreached` gate_ink_coverage_unread — a corpus row expects "gate_ink_coverage_unread" and the drive never produced it — the door may be unreachable
- **warn** `unreached` absorbed — KNOWN DEBT: no corpus row expects "absorbed" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` absorbed_departure — KNOWN DEBT: no corpus row expects "absorbed_departure" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` departure — KNOWN DEBT: no corpus row expects "departure" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` nothingAsked — KNOWN DEBT: no corpus row expects "nothingAsked" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` noWords — KNOWN DEBT: no corpus row expects "noWords" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` perSideRemoval — KNOWN DEBT: no corpus row expects "perSideRemoval" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` removal — KNOWN DEBT: no corpus row expects "removal" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` removal_unnameable — KNOWN DEBT: no corpus row expects "removal_unnameable" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` removal_unnamed — KNOWN DEBT: no corpus row expects "removal_unnamed" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` sideNamedWithoutScope — KNOWN DEBT: no corpus row expects "sideNamedWithoutScope" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` uncatalogued — KNOWN DEBT: no corpus row expects "uncatalogued" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` unnamedObject — KNOWN DEBT: no corpus row expects "unnamedObject" — the map's named remainder (founder law: this list only shrinks)
- **warn** `unreached` wall_unfileable — KNOWN DEBT: no corpus row expects "wall_unfileable" — the map's named remainder (founder law: this list only shrinks)

