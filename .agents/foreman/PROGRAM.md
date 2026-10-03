# THE PROGRAM — what the team is building and why

This file is the campaign pointer. Every Foreman shift reads it FIRST, and no
build brief is cut except in service of it (or of the standing infrastructure
exceptions named below). It changes only on the founder's word — a shift that
thinks the program should change writes a Desk card, never edits this file on
its own judgment.

## Mission

**The Midjourney of casting.** The founder's own framing (2026-08-25,
verbatim): *"the idea of the casting studio is to be like the midjourney of
casting, e.g we want to be able to cast photoreal humans and sci-fi humans
and creatures like monsters etc."* — with his standing constraint that
creative reach is **never at the cost of photoreal humans** (fable-1667),
which the product already does well. The visual bar is his own reference set:
`C:\Users\Admin\OneDrive\Desktop\casts\` (4 creatures, 9 sci-fi), catalogued
image-by-image in `CREATIVE_CASTS_RESEARCH.md` (#22). The creative register
(N1, confirmed focus) is deliberately the FIRST SEAM of that program — the
creature/sci-fi cohorts are register variants (its design §5) — so the
confirmed focus IS the road to this mission, not a detour before it.

Vehicle: **Casting Studio V2 replaces the legacy studio** ("we are currently
building the new casting studio which will retire the old legacy studio"),
on the rebaseline ladder once signed.

## Governing plans (read before cutting any casting brief)

> ⚠ **A NEW RUNG ON HIS WORD, 2026-09-04 (terminal), verbatim: *"give voice
> its own rung its very important."*** The ladder is N1 → N2 → N3 → N4 (Takes)
> → **N4b (Voice)** → N5 → N6 → N7 → N8. Voice was the shelf's "open half" of
> the rebaseline's §6 question 1; it is on the ladder now, directly after
> Takes, with his 2026-09-03 engine split as its design intent (ElevenLabs
> Voice Design for creature / monster / sci-fi voices, Inworld for human
> voices). Its pointer card carries `rung:N4b`; `CASTING_V2_PLAN_REBASELINE.md`
> §4 and the briefing's `program.ladder` take the rung in the next edition
> that touches them. Numbered N4b rather than renumbering N5–N8, so every
> existing citation of N5–N8 stays true.


- ✅ **`docs/specs/CASTING_V2_PLAN_REBASELINE.md` — THE GOVERNING LADDER,
  countersigned by the founder on the Desk 2026-08-25 21:38 ("signed").**
  Rungs N1–N8: N1 the creative register (current focus) → N2 the flags go
  home → N3 the refine era completes → N4 Takes (D-117 gate bound) → N5
  entries converge → N6 cutover plumbing → N7 the observation window (his
  point of no return) → N8 legacy retirement. THE MILESTONE GATE applies at
  every boundary. `CASTING_V2_ARCHITECTURE_PLAN.md` remains the historical
  record; its M0–M7 rows stay accurate, its §K ladder from M8 onward is
  superseded.
- `docs/specs/POST_SIGN_ROADMAP.md` — the post-Sign queue.
- `docs/specs/CASTING_V2_ROLLOUT_DEBT_REGISTER.md` +
  `CASTING_V2_SWEEP2_WORK_ITEM_LIST.md` — the honest map of what is
  half-rolled-out and half-built (2026-08-25).
- `docs/specs/CREATIVE_REGISTER_DESIGN.md` — the design for the current focus.

## THE DISAPPEARING-TECHNOLOGY LAW — the gate on every new feature (founder, 2026-09-03)

**Full text: `CLAUDE.md`, at the top, above the fidelity law. It is the whole
product's law, not a casting one** — his own clarification: *"the philosophy i
gave you isnt just for casting studio v2 its for the entire app any new features
we add in the future the ai will need to ask itself how this measures against
the philosophy."*

**His sentence:** *"Users don't care how it was built. They care that it just
works — without them having to learn the technology."*

⚠ **IT IS A GATE ON NEW WORK, NOT A REVIEW NOTE AFTER IT.** Any brief, design or
card that adds something a customer will touch answers three questions **in its
own body**, and a shift that cannot answer them says so rather than proceeding:

1. **What must the customer learn to use this?** If the honest answer is
   anything, that is the thing to remove.
2. **What decision does it put in front of them, and do they have any basis for
   making it?** A choice offered without a basis is machinery showing through.
3. **Where does the technology show?** A model name, an uninterpretable
   percentage, a pipeline term, a control mirroring an implementation.

⚠ **"It works and it's fast" does not pass** — a feature can be both and still
make someone learn the machine. **A feature that fails is REDESIGNED, not
blocked**: the failure is nearly always a decision that should not have reached
the customer.

**Its engine half** (best model for each job, "best" has an expiry, cost and
latency stated, and **read what the engine already gives you before reaching for
a better one**) is clauses 1–4 in `CLAUDE.md`. **First instance: #475.**

⚠ **AND A MODEL PICKER IS A FEATURE, NOT AN EXCEPTION — his correction, same
day:** *"pickers will exist in the future purely because that in itself is
something we are offering the user."* **For an AI studio the model is MATERIAL,
not plumbing** — a different engine gives a different look, and choosing it is a
creative decision. **The only durable rules: a correct default always exists so
nobody is forced to choose, and no engine name sits on a path someone must walk
to reach their picture.** ⚠ **What fails is a list of slugs with no default and
no guidance — our homework handed over. A picker with a right default and a real
basis is a feature.** Clause 5 in `CLAUDE.md` carries it.

## The design north star (read before ANY casting UI work)

`docs/specs/Casting-ui-ux-design/` is the UI/UX destination the studio is
building toward — the design handoff (studio + canvas handoffs, the Klieg
Casting canvas, foundation, screenshots, the planning briefs). It is **not
fully built**; it is where the interface is headed, largely landing after the
current studio-capability push. Two binding rules govern how it is read:

1. **The UI authority order** (`docs/specs/CASTING_V2_UI_VISION_RECONCILIATION.md`,
   binding): ratified plan > foundation README > vision docs > prototype HTML.
   When the prototype and a ratified ruling disagree, the ruling wins.
2. **Prototype content is quotation, not requirement** (founder law,
   2026-08-01): every string, seed, caption and behavior taken from a
   prototype must be re-derived against current capability truth — copy must
   be honest about what the product can do TODAY. No UI milestone reaches the
   founder gate without an evidence pack (side-by-side screenshots, both
   themes) and a copy audit.

3. **Placeholders are PERMITTED for mockup surfaces whose capability is not
   built yet** (founder amendment, 2026-08-25, verbatim: *"it can build
   placeholders though for things which are not fully built yet but exist in
   the mockup ui/UX"*). This is scaffolding-first under the fidelity law's
   declared-shortcut clause, and it carries three conditions:
   - **Honest or dark, never pretending.** A placeholder either ships
     flag-dark / founder-only, or, if visible, says plainly it is not live
     yet (a labeled coming-state, a disabled surface that names itself) —
     never a control that looks functional and does nothing, and never
     prototype claims presented as facts. This keeps the plan's ratified
     no-dead-controls ruling (§O) intact: that ruling forbids *lying*
     controls, and an honest placeholder does not lie.
   - **Declared in the PR** as scaffolding, with the real capability's queue
     card linked — so scaffolding is always on the record as scaffolding and
     can never silently become the shipped thing.
   - **Structure from the mockup, copy from capability truth** — layout and
     bones may quote the prototype freely; user-visible words still pass the
     quotation-not-requirement law above.

A shift cutting any UI brief cites which handoff surface it serves; the
rebaseline (#40) owns placing the unbuilt design surfaces on the remaining
ladder.

## "The Desk" means the Crew tab (founder switch-over, 2026-08-26)

Everywhere this file says "the Desk", read **`/admin/crew` in production** —
`server/crew/crew-briefing.json`, shipped by the rite, his replies in the
`crew_replies` table (`scripts/crew-read-replies.mts`). His order, verbatim,
before bed 2026-08-26: *"ensure that the live crew tab is the new desk and
everything is pointed towards it to be updated rather than the old desk …
the forman is all sweet to continue working as long as the desk is being
updated so when i wake up in the morning i have somthing to look at."* The
claude.ai artifact is retired — a mirror, never updated, never deleted.
**Every shift ships a briefing edition; a shift with nothing to show him is
the one failure he named.**

## Current focus (ONE thing at a time)

> ⚠ **NO CONFIRMED FOCUS — P1 IS COMPLETE AND THE FOCUS IS CLEARED (THE MILESTONE GATE, 2026-10-02, `foreman-20261003-0058`).** P1's ninth and last BUILD card closed tonight (#1601, re-read at the code rather than taken off the previous shift's recommendation); the completion card and the eight-item test-drive list are on his Desk as **#1787**. #1609 is the tenth and is not a build card by its own body — *"NOT a shift's card … held here so the rung's completion card can name it"* — and what is left in it is HIS HAND: the live-mode Stripe price objects, the live keys on the service (production's `STRIPE_SECRET_KEY` is still `sk_test_`, read 2026-10-02), the Drape → Klieg rename in the Stripe dashboard, and his eye on the production frames. **So the app is right and the till is not open, and that is the completion card's headline.** The milestone-close deep review over the whole rung's diff is ASKED OF THE RELAY on #1787 and nothing waits on it. **Until he names the next focus, every shift runs MAINTENANCE MODE** — his switches in their risk order, a patrol whose clock has fired, and a bug a customer can hit. **The ladder points at N2b** on his own order of 2026-10-01 (*"after n2 is wrapped up start the pricing/money work then proceed onto n2b and n2c"*), and #1787 asks him to confirm it rather than asking him to decide it again — the gate exists because a boundary is where he changes scope. **N2b is NOT started on this completion card.** ⚠ **THIS CLAUSE IS SPENT — THE LADDER IS P2 AS OF 2026-10-03 (#1840, `fa7f133ff`), AND IT IS KEPT BECAUSE ITS REASONING IS WHY THE FLIP TOOK A COMMIT OF ITS OWN RATHER THAN BEING WRONG.** It said STAYS P1 *"until his word"*, and his word came the same day — *"phase 2 gets built next not n2b"* — so the pin moved WITH the edition, which is the road this clause prescribes rather than an exception to it. ⚠ **What it cost in the hours between is the finding, and it is the third instance of one class:** his word reached THIS FILE at `91749d2b9` and did NOT reach the briefing, and **the briefing is the only artifact the seat gate reads** — so the four P2 cards he had just ordered (#1832, #1833, #1834, #1835) were held from every seat, driven at the gate with controls (`rungHoldFor(["founder-ordered","rung:P2"], "P1")` → *"on rung P2, and the milestone is P1"*; a `rung:P1` card and a rungless card as positive and negative controls). Edition 627's own `shift` paragraph said in prose that P2 was the focus, so the shift that wrote it knew — **it wrote the fact into the field a person reads and not the field a machine reads.** Siblings: #1496 and #1541. **The rule going forward: a focus recorded anywhere but `program.ladder` is a focus no seat can act on, and the two move in ONE commit.** The next flip is P2 → N2b, on P2's completion card and his word. The original clause follows, unaltered: ⚠ **AND THE LADDER'S `current` RUNG STAYS P1 — DO NOT FLIP IT, THE RITE WILL REFUSE YOU, AND IT REFUSED THIS SHIFT.** `server/seatBatches.test.ts`'s real-briefing arm pins exactly one `current` rung and says why in its own body: *"THIS PIN MOVES ONLY ON HIS WORD, and the rite refuses an edition that flips the ladder without it — which is the guard doing its job … The next flip is P1 → N2b, on P1's completion card and his word."* The rung is the SEAT GATE's input, so moving it is how four autonomous seats would be told a rung is open. **The milestone gate is carried by `program.focus.state = "none"`, by the completion card, and by the milestone title — never by the rung.** Edition 619 set P1 `done`, the rite refused at `seatBatches.test.ts:1044`, and the edition was corrected rather than the guard. Two findings P1 turned up and deliberately did not fold in, on his *"held to its ten cards"* rule: **#1785** (the canvas Refresh charges 70 credits for a render on two ids Google shut down in June — his decision, beside `refreshSlots` on #1654) and **#1786** (the legacy price table's docblock names three readers where there are seven, two of them public — the premise that led to #1785).
>
> ✅ **CURRENT FOCUS: P2 — PRICING, PHASE 2, THE PLANS REDESIGNED (his word, 2026-10-03, terminal, verbatim: *"phase 2 gets built next not n2b"*).** The spec is the approved brief #1774 (his *"frames right numbers right"* the same morning: three individual plans with a 5,000-step credit slider on Studio at $9 per step; no rate chip on any plan card; Enterprise as a sales conversation; copy about the maker and the work with anything unshipped marked *coming*; a compare table organised by what a customer makes; Team per seat at $68 ONLY behind the workspace #1788). The build cards are cut from the brief, one per surface, each customer-visible and held for the relay's hand; Yuna's pass on the copy when her team is back. **P1 WRAPPED 2026-10-03**: his drive passed (*"im test driven the credit changes and everything is good"*), and the till stays deliberately closed — #1609 is PARKED on his word *"im not switching stripe to live until the full app is build"*; its steps apply on launch day. N2b (personality and voice at Sign, #1242) waits behind P2 on his word.
>
> ✅ **AND THE RUNG IS OPEN ON THE MACHINE AS WELL AS IN THIS FILE — #1840, merged `fa7f133ff`, live on production 2026-10-03 09:05Z (build sha read back at `/api/health` on a 5-second uptime, so a new process and not the old one passing as new).** Edition **628** carries `program.ladder` P1 `done` + a **P2** rung `current`, `program.focus.state` `confirmed` with his verbatim word, and the milestone block rewritten to P2's four cards; `server/seatBatches.test.ts`'s real-briefing pin moved in the same commit, and is proven able to fail (ladder sabotaged back to P1 → the arm reddens at its line with `Received: "P1"`). **Driven after: a `rung:P2` card is offered, and `rung:N2b` and `rung:P1` are both still held — the milestone gate opens exactly one rung and is not loosened.** ⚠ **Named rather than left to be discovered: the flip makes the two still-open `rung:P1` cards rung-held — #1598 (substance shipped, its last box is Yuna's pass on the wording) and #1609 (`parked` + `blocked` on his own word, his hand not a seat's). Nothing buildable was lost.** **So #1832 is the focus rung's first build card and is on offer** — the design's own §10 order pairs the three-card ladder WITH the Enterprise band (#1833) as one surface, and production deploys on merge, so landing the band under today's seven-rung window would put a half-redesigned pricing surface in front of a customer (#1698's lesson). The slider is the only half with a server and Stripe road (design §5).

> ☑ **WHAT P1 WAS, kept as the record.** **FORMER FOCUS: P1 — PRICING, PHASE 1 (his word, 2026-10-01, Desk + terminal).** N2 WRAPPED 2026-10-01: its last card (#1218, the light axis) closed on his Desk word *"close"*, superseded by #1612; the completion card and test-drive list are on his Desk. His order, verbatim: *"after n2 is wrapped up start the pricing/money work then proceed onto n2b and n2c"*. The focus card is **#1598**; the ten build cards are **#1600–#1609** (`founder-ordered` + `rung:P1`); the ladder reads N2 done → **P1 current** → N2b → N2c. EVERY PR under P1 is a MONEY surface: held for the relay's hand verdict, none merges on the gate alone; live Stripe objects and Railway variables are his or the relay's hand (#1609). Build order inside the rung: #1600 + #1601 ship together (display and prices, never one without the other), #1604 before #1606, #1603 with #1602. N2b opens on P1's completion card, then N2c.


> ✅ **THE DEBT PANEL IS RELEASED — HIS WORD, 2026-09-24 (terminal), verbatim
> and entire: *"work the debt"*.** Said of the Desk's *Not on any road → Debt*
> cards after the relay listed them. The three genuine cleanups are released
> to background work on that word and carry it in a comment: **#1151** (the
> face panel's dev fixture), **#1146** (the stale `pinningAvailable` wire
> field), **#1126** (the refine rail cuts off her answer — relabelled `bug`,
> customer-visible). **#1134** is N2's own (his hold on the roll engine waits
> on it); **#1133** is moot under his B on #1160 and closes with the segment
> retirement; **#1167** was the relay's own litter and is closed. A shift takes
> these beside N2 briefs, never instead of them.

> ⚠ **FOCUS BEFORE SWITCHES — HIS WORD, 2026-09-25 (terminal), on the relay's
> recommendation: *"go with yoru reccomendation"*.** Asked why the crew was
> taking background cards while N2 still had open feature cards, the answer was
> that no rule said otherwise: the switches were all left ON from the N1 pause
> and background work is DEFINED as what runs with no focus. So, in his name:
> **while a rung is the CONFIRMED focus, a shift takes a focus card first, and
> takes a switch card only when no focus card can be started** (all of them
> blocked on his word, on a held PR, or claimed by another shift). ONE
> exception: a bug a customer can hit (`bug` label) still jumps the queue, as it
> always has. Everything else on the switches — small fixes, housekeeping,
> casting upkeep, process — waits its turn behind the focus. The switches stay
> ON; this is a RANKING, not a pause.

> ⚠ **N3's DESIGN PRINCIPLE, RULED IN ADVANCE — 2026-09-24 (terminal),
> verbatim: *"yeah we really cannot be working from fixed lists in a fluid
> editing application it means no sense to be rigid like this."*** What a cast
> HAS is read from the cast, never looked up in a menu. Every closed vocabulary
> that decides what can be recorded or refined — the four ink regions
> (`StatedInk.regions`), the region reader's feature list, the old lane's
> categories — is the class N3 replaces. A gap found in any such list (the
> scalp tattoo, #1159, is the first) is filed on #30 as an N3 case, NEVER as a
> new entry on the list. Jev is a text judge and sits on N3's words side, never
> as the detector — the relay's reading is on #30. Binds every N3 brief when
> N3 opens on his word.

> ✅ **THE SWITCH SITTING HAPPENED — 2026-09-24, AND N1 IS NOW SHIPPED AS WELL
> AS SIGNED OFF.** He went down #1132's list exactly as he said he would
> (*"One sitting — prepare every switch with its evidence and I'll go down the
> list in one go"*), leaving **eleven replies in twelve minutes**. His words,
> verbatim and entire, each on its own card:
>
> | card | his reply | what was done |
> |---|---|---|
> | `switch-01-author-road` (#201) | *"Yes"* | `CASTING_CREATIVE_REGISTER_SCOPE` → `all` |
> | `switch-02-concept-upload` (#202) | *"yes, turn it on"* | `CASTING_CONCEPT_UPLOAD_SCOPE` → `all` |
> | `switch-03-brief-fidelity` (#203) | *"Turn it on for everyone"* | `CASTING_BRIEF_FIDELITY_SCOPE` → `all` |
> | `switch-04-retry` (#204) | *"Turn it on for everyone"* | `CASTING_RETRY_SCOPE` → `all` |
> | `switch-05-open-lane` (#205) | *"Turn it on for everyone"* | `CASTING_OPEN_LANE_SCOPE` → `all` |
> | `switch-06-two-paths-retire` (#206) | *"Unset it"* | `CASTING_TWO_PATHS_SCOPE` **deleted from the service** |
> | `switch-07-roll-engine` (#207) | *"Hold until the two numbers are read"* | held; the two numbers are **#1134** |
> | `switch-10-ink-studio` (#208) | *"It retires with N2"* | **a product ruling, not a switch** — carded |
> | `switch-11-born-ink` (#209) | *"Hold, and re-ask with card 3"* | held; card 3 widened, so the **re-ask is owed** |
> | `switch-13-r7-pair` (#210) | *"Noted"* | nothing to do, as the card said |
>
> ⚠ **THE AUTHOR ROAD IS EVERY ACCOUNT'S ROAD NOW.** Until this act, every
> account that was not his still cast through the old house compiler. **That
> was the whole gap between N1 signed off and N1 shipped**, and it is closed.
>
> ✅ **AND HE CAME BACK AND FINISHED IT — ALL THIRTEEN ARE ANSWERED, #1132 IS
> CLOSED.** The last four, verbatim and entire:
>
> | card | his reply | outcome |
> |---|---|---|
> | `switch-08-segments` (#212) | *"Retire both. The paste road is gone; nothing reads these."* | **#1160** — retire the segment pair |
> | `switch-09-reference-pictures` (#213) | *"Hold. The attach and picture road isn't finished. It moves to N3, after the engine court, and gets built on whichever engine wins."* | HOLD, **moved to N3** |
> | `switch-12-refusal-keeper` (#214) | *"Hold. Keep it on my account. My own refusals are plenty to build the reader on; build the reader first, then open the keeper if it needs more."* | HOLD at `users:1` |
> | `wardrobe-capability-1148` (#211) | *"A for now, and B carded separately if you want it…"* | **A** — retires with the path (#203); B is #1161, a PROPOSAL |
>
> **The sitting's full result: five widened, one unset, three retirements
> ordered, four held.** Retirements: the tattoo studio (**#1158**), the segment
> pair (**#1160**), the wardrobe capability (**#1148** → already in flight as
> #203). Holds, each carrying the condition that would change it: the roll
> engine (**#1134**'s two numbers), born-ink (**#1159**), reference pictures
> (N3, after the engine court), the refusal keeper (his account until the
> reader is built).
>
> ⚠ **TWO OF HIS SENTENCES THAT NIGHT ARE RULES RATHER THAN ANSWERS AND BIND
> WORK BEYOND THEIR OWN CARDS:**
>
> 1. ⚠ ***"Folding a new capability into a retirement is how a half-built
>    feature ships under a cleanup's name."*** **Three retirements are live
>    right now — #203, #1158, #1160 — and each will offer the same temptation:
>    while we are in here, we could also make it do the thing properly. The
>    answer is no.** A capability is its own card, judged on its own terms, or
>    it is not built. Nothing is KEPT in a retirement either "because a future
>    feature might want it".
> 2. ⚠ **A HOLD IS NOT A NO.** All four carry the condition that would change
>    them, in his own words. None is a dead end, and **none is re-asked before
>    its condition is met** — the born-ink card exists precisely because card 3
>    widened and its stated blocker therefore died.
>
> ⚠ **AND ONE PREMISE IN HIS RULINGS IS TO BE VERIFIED, NOT ASSUMED**: *"nothing
> reads these"* (#212) is a factual claim, and law 7c binds #1160's first act —
> open the code before believing it. That is not doubt about the ruling; it is
> the difference between retiring a dead road and silently turning off a live
> one, and this repository's house style (`import * as`, destructured dynamic
> imports, barrels) hides callers from a naive grep.
>
> ⚠ **HOW IT WAS APPLIED, because the road matters more than the act.** The
> boot gate (`validateEnv`) was rehearsed on this machine against the target
> values FIRST, with two negative controls that each had to name the right
> variable — a scope chain refuses to boot when a child reaches past its
> parent, and `CASTING_CONCEPT_UPLOAD_SCOPE`'s parent is the register, so the
> two could only move together. The five were set with `--skip-deploys` and
> the sixth was a delete; **no deploy fired**, so the values were staged and
> went live on this shift's rite, as one restart, verified against
> `productionFlagPositions.mts` by the rite itself. Production stayed healthy
> throughout (16 probes, 0 failures).
>
> ⚠ **AND THE ONE THING A LATER SEAT MUST NOT MISREAD**: the brief-fidelity
> flag had a written blocker — *"DOES NOT PASS `users:1` UNTIL COURT E1
> REPORTS"* — and it was discharged **by measurement, not by his word alone**.
> E1's worry lives on the HOUSE road, which row 1 retires; `role` is absent on
> 3 of 75 author rolls against 28 of 216 house rolls. **E1 never ran and is
> not owed.** The order was load-bearing and both flags moved in one act.

> ✅ **N1 IS SIGNED OFF — HIS WORD, 2026-09-23 (terminal), verbatim and
> entire: *"im happy to sign off on the cyborg breif now"*.** Said of the
> cyborg brief rolled on GPT Image 2.5 Sunburst, the engine standing on his
> account since his 22 Sep word (*"sunburst is amazing so far im happy"*).
> This is his eye on both bars on the sheet #16 named as the gate. Recorded
> verbatim on #16 (closed), #1068 (closed — the engine question is settled;
> its price-and-refusal remainder lives in #129) and #22 (its entry gate is
> passed; whether it opens now is his call at the close-out).
>
> ✅ **N2 IS THE CURRENT FOCUS — HIS WORD, 2026-09-23 (terminal), the same
> sitting, verbatim and entire: *"okay make those three changes then start
> n2"*.** He named the rung himself, so the milestone gate is satisfied at
> this boundary: N1 signed off above, N2 opened by his word. **N2 — the flags
> go home**: every half-rolled-out flag either widens to everyone or is
> retired with its machinery. Its cards at his word: **#203** (retire the
> wardrobe/basics two-paths machinery — his ruling in advance), **#180** (the
> ghost audit — old-lane categories, dice, archetypes, personas still running
> under the author road), **#179** (the 96 legacy author-road rows, a data
> ceremony), **#209** (the ID-less refusals and the ~70 non-doors on the
> map), **#62** (hair's owed court arms before `hair.open` and its flag
> widen), **#10** (the ink-cut preview that widens `CASTING_INK_CUT_SCOPE`).
> A shift cuts N2 briefs from these; nothing from N3 onward.
>
> ✅ **AND HE HAS SAID HOW HE WANTS N2 DELIVERED — 2026-09-23, Crew reply
> #199 on the N1 completion card, verbatim and entire: *"All tests passed.
> One sitting — prepare every switch with its evidence and I'll go down the
> list in one go."*** Two facts in one line. The first sentence **closes
> N1's seven-item test drive** — he drove it and it passed, so the `Waiting
> on: YOU` half of #1121 is discharged and only the relay's milestone-close
> deep review is still owed there. The second **reshapes how N2 reaches
> him**: not twenty separate asks arriving weeks apart, but ONE list, each
> switch carrying its evidence, read in one sitting. **Filed as #1132
> (`founder-ordered`), with the population derived rather than transcribed:
> 36 flags in the record, 20 at `users:1`.** N2's existing cards are not
> replaced by it — they are where its rows come from. ⚠ **The sitting
> happens when the list is COMPLETE**: a half-list gets him halfway down and
> then stops, which is worse than waiting.
>
> ✅ **THE LIST IS BUILT AND IT IS ON HIS DESK — edition 490, 2026-09-23
> (foreman-20260923-1849). It is COMPLETE: all twenty settings are accounted
> for, resolved into THIRTEEN decision cards** (`switch-00` … `switch-13`),
> because the boot guards make several of them one switch wearing several
> names — a child scope refuses to boot unless every user it names is already
> inside its parent, so a chain widens as a unit or not at all. **Four widens,
> one retirement, eight holds, each with a named reason.** The written audit,
> with every number and where it was read, is
> `docs/specs/N2_SWITCH_LIST_2026-09-23.md`.
>
> ⚠ **THE SITTING'S OWN HEADLINE FACT, read at the rows rather than assumed:
> production has FOUR accounts and exactly ONE has ever cast — his. All 295
> rolls, all time, are `userId 1`.** So no widen on this list can disturb a
> living customer; what a widen decides is what the product does the day
> somebody else arrives. Every later reading of this list is to be taken under
> that sentence.
>
> **Three findings the audit produced, all filed:** **#1133** — the seam
> statistic that `CASTING_SEGMENTS_DELIVERED_SCOPE`'s own design names as its
> prerequisite is written onto the VARIANT ROW, which purges, so the check is
> met at write time and unmet at read time (a class, not an instance);
> **#1134** — the roll engine's two unread numbers (house price per picture;
> a matched refusal rate — measured unmatched at 11.8% old / 14.5% Sunburst);
> **#1135** — his Crew cards are being FLATTENED (`productImpact` is one `<p>`
> with no markdown and no `white-space: pre-line`), found by looking at the
> page in the running app while writing the list, which is law 6 paying for
> itself. **And one blocker closed by measurement rather than by a court**:
> brief fidelity's court E1 worried that a lifted cap would strip the casting
> category block; that block is HOUSE-road only (`briefCompiler.ts:1372`) and
> the field it needs is absent on 3 of 75 author rolls against 28 of 216 house
> rolls — so it widens WITH the author road and never alone.
>
> ✅ **#203 SLICE 1 IS MERGED — `67f422b9`, 2026-09-23.** The wardrobe/basics
> ENTRANCE is closed: no toggle on either surface, `createRoll` takes no
> path, `rollService` writes the column a constant `null`. **`CASTING_TWO_PATHS_SCOPE`
> therefore governs nothing** and is the first row of #1132's list with a
> trivial answer. Invisible on production, read rather than assumed: the only
> account in that flag is on the author road, which already suppressed the
> control. **Slice 2 owns the READ paths** and must re-answer #180's three
> `unpathed` predicates INDEPENDENTLY — folding them together is the bug that
> nearly shipped once. #1129 now waits on #203 closing rather than on him
> (his reply #198: *"C — wait for #203"*).
>
> **The three changes he ordered are made** (the relay's ladder audit, agreed
> in plain English): #478 and #246 folded into #30 as the two failure cases
> the N3 detector must not repeat; #15 trimmed to the two coming styles
> becoming real (Style is the only setting, his #535 ruling); #484 closed —
> it dies with the legacy studio.
>
> ✅ **THE N1 COMPLETION CARD IS FILED — #1121, 2026-09-23 (foreman-20260923-1505).**
> What the rung gives a customer in his terms; the seven-item test drive; the
> named remainder (#129, the softer-wording court's NOT-BUILT verdict, #62);
> and ⚠ **the fact the card leads on, read at the artifact rather than carried
> from a document: 20 of the 36 flag positions the deploy rite compares against
> the live service stand at `users:1`** — N1's own five among them — so **N1 is
> signed off and not yet SHIPPED**, and N2 is precisely the rung that closes
> that gap. The card is `blocked` on him with its `**Waiting on:**` line.
> ⚠ **SUPERSEDED THE NEXT DAY (the switch sitting, 2026-09-24, recorded above): N1's five all went to `all` on his word — read at `productionFlagPositions.mts` — so N1 IS shipped for every account. The sentence above is kept as what the completion card led on; the N1 deep review (2026-09-25) read it stale.**
>
> **Still owed:** the N1 milestone-close DEEP REVIEW over the whole rung's diff
> (focus confirmed 2026-08-25 19:17 → `574cb865`, 1,080 first-parent commits).
> Since #1065 that is **the relay's, by hand, at its next sitting** — a shift
> ASKS for it and triggers nothing, and the ask is on #1121 with two places to
> point it (the path-three death class across N1's four retirements, and the
> documents this rung has already been bitten by). **A shift may cut N2 briefs
> now**; the deep review runs in parallel and its findings become cards.
> Everything below this block is the history of how N1 was reached and is kept
> as the record.
>
> **His word on N5 the same sitting, verbatim: *"canvas is being rebuilt we
> are not working on that yet"*.** N5 (entries converge — canvas and studio
> cast the same way) has no cards on purpose: the canvas is being rebuilt
> first, and nothing under N5 is filed or cut until he says the canvas is
> ready for it. **His word on #22 the same sitting, verbatim: *"this was a
> really old thing. we already do creatures perfectly fine all types of
> creatures then in n3 we will build the ability to be able to auto analyze
> features on anything and refine anything the legacy studi was rigid this
> studio isnt"*** — #22 is closed; the open-anything detector and refine is
> N3's job for every cast, not a creature programme.

> ⚠ **HIS LATER WORD, 2026-09-06 06:42Z — Crew replies #145 AND #146, verbatim
> and entire:**
>
> > build it
>
> **Said on #535's card AND on its eye item, the same two words on both.** The
> Re-imagine design report is APPROVED and its build is AUTHORISED:
> `docs/specs/REIMAGINE_DESIGN_2026-09-06.md` §3–§4 is the spec, the frames he
> passed are the shape. **#535 is unblocked and is the next shift's WHOLE brief**
> — a feature build, not a batch item, and it keeps `awaiting-fable` on #541
> rule 3's SECOND limb (it changes what he judges: the imagination level leaves
> the author road and the N1 gate sentence is rewritten with it).
>
> ⚠ **THIS PARTLY SUPERSEDES THE SEQUENCING RULING BELOW, AND ONLY PARTLY —
> read both.** That ruling paused N1 until the queue cleared; this one restarts
> ONE named piece of it by his own word. What is NOT reopened: no shift picks up
> other N1 slices or N2 anything from an idle queue. ⚠ **Casting upkeep came OFF that list 2026-09-08 — see the correction at the foot of this block: he turned the switch on and confirmed it (_"leave it on"_).** A carded casting-upkeep item is now ordinary background work under the switch; a casting FEATURE slice is still not. The
> background sweep continues around #535 exactly as before. When N1's gate does
> come back, the first act is still the #16 comment named below.
>
> ✅ **THE BUILD LANDED — PR #598, escalated Fable shift, 2026-09-06 evening.**
> The Re-imagine press is live on all three brief boxes at `users:1`, the
> imagination level is deleted (modal, sheet line, sat-out sentence, roll-time
> author call — the roll composes seed + clause + block by code), and the
> reading sentence is read-only per his 2026-09-06 ruling. **THE N1 GATE
> SENTENCE IS REWRITTEN WITH IT (the design's §5, his approved report):** *his
> own words plus the locked house block on every roll — with Re-imagine as an
> optional press on any brief box, whose result he can read, edit and undo in
> the box before he spends — and no mode, level or setting between the button
> and the picture except Style.* Remaining on #535 before his eye closes it:
> the generated chips (decision 12, suggestions beside the box) and the court
> (§7, priced on the card before any arm fires). #534 closes on his eye once
> he has seen this landed.

> ⚠ **HIS SEQUENCING RULING, 2026-09-04 (terminal), verbatim:** *"once my next
> up que is fully finished ill get my agent to run through and do all the
> category items and fixes then ill judge n1 after that"* … *"leave casting
> upkeep off for now then. my goal is to clear the entire pipeline of
> everything before continueing on finishing the casting studio feature."*
>
> So the order until he says otherwise: **(1) NEXT UP to empty, (2) every
> background-work category he switches on, worked to empty under the
> re-read-before-take rule, (3) then N1's gate — his eye on a fresh roll.**
> N1 remains the confirmed milestone below; it is PAUSED by his word, not
> reopened, and no shift starts casting-feature work (N1 slices, N2 anything)
> from an idle queue. ⚠ **Casting upkeep is ON — he flipped it AND confirmed it, 2026-09-08 00:10:18Z (Crew reply #163), verbatim and entire: _"leave it on"_.** This sentence said OFF while his own switch panel said on, which is the contradiction card `casting-upkeep-switch-contradiction` was filed about; his word settles it in favour of the switch. The switch is the source of truth for background work, not this line — and the re-read-before-take rule still binds every casting-upkeep card taken from it. When he
> returns to N1, the shift's first act is a comment on #16 listing every
> casting-road change merged during the sweep.


**CONFIRMED — the founder's word on the Desk, 2026-08-25 19:17, verbatim:**

> *"Confirm the creative register (#16) as the current focus"*

**The creative register (#16) is the current milestone.** Its governing
design is `docs/specs/CREATIVE_REGISTER_DESIGN.md` and the build order is the
design's own §5 sequencing: (1) the court — ✅ **JUDGED BY HIS EYE 2026-08-26
morning, verdict verbatim on #16: "I think C is worth building to find out
how close we can get." STEP 2 IS GO.** His conditions bind the build: C's
fidelity WITH B's framing/realism scaffolding ("Id like to see C with the
framing fixed"); a stated feature lands on EVERY slice ("the second guy on
that sheet has no body cybernetics"); variation only where the brief is
open, never on a specific ask; the writer's room keeps W's ideas on
W-today's casting quality; two new laws filed urgent — #92 (basics in the
brief's style) and #93 (refusal work-around by language, court-measured).
(2) the register built dark behind
`CASTING_CREATIVE_REGISTER_SCOPE` — ✅ **BUILT 2026-08-26, PR #94 (foreman-13),
MERGED `80ffd8fb` (Retro, 07:18)**, declared `off` on production; (3) a flagged roll of his brief — ✅ **DONE
2026-08-26 01:36Z on his word, verbatim Crew reply #4: "flip it"** —
`CASTING_CREATIVE_REGISTER_SCOPE=users:1` on production (foreman-16, read
back by name, redeployed), roll 217 through the real entrance, 8/8 ready,
`register.kind = creative`, card authored (record on #16); (4) his eye on
both bars — **JUDGED 2026-08-26 02:13Z, NOT PASSING YET**, Crew reply #6
verbatim: *"Judged — details on #16. 217: cybernetics landed on all eight,
good results for what was prompted, but too little variation in facial hair
and other open features. 220 (basics): only 1/8 got chest cybernetics,
framing all over the place, 2 refused. 219 (cyber-goth) failed completely —
men and women, prompt ignored. Not passing the gate yet: fix 219's class
(#121), per-slice fidelity and spread, then re-roll for my eye."* So the
gate stays SHUT and the focus stays THIS milestone: the next shifts work, in
his order, (a) **#121** (urgent — the register did not engage on the
cyber-goth brief and the interpreter collapsed: sex null, the opener
stuffed into role, every stated feature lost), (b) per-slice stated-feature
fidelity (#16 rule 3, now MEASURED necessary: 1 of 8 on roll 220) and the
spread of OPEN features (his beard rule — unstated means vary), (c) then ONE
re-roll of his brief for his eye. His raw GPT Image 2 prompt's style closer
is a filed court arm on #16 (under the spend threshold; estimate on the issue
first). Refusal chips are #122. The strip is in his eye gallery (edition 19). ⚠ Found on the way: his account
had been auto-frozen by the moderator dashboard's discrepancy scan since
2026-08-25 03:33Z (#119, urgent) — unfrozen through the admin entrance so
the roll could run. Standing
exceptions still outrank it in their listed order (#40 the rebaseline next).

⚠ **THE ROAD WAS RE-RULED 2026-08-26 (afternoon) — READ
`docs/specs/PROMPT_AUTHOR_RULING_2026-08-26.md` BEFORE ANY REGISTER WORK.**
The founder's verdict on roll 217/219/220 plus his own GPT Image 2 tests
produced a new design for the whole roll road: the user's words go to the
engine verbatim; an AUTHOR (one text call, imagination meter, ~400-word
budget) adds what an expert would, never a compiler; photoreal default with
prompt override; the wardrobe/basics toggle RETIRED (the engine dresses the
cast — this supersedes the basics-default law below); no variance card;
content/stage/typo walls killed, likeness + not-a-being walls kept; the
Lexicographer patrol. ✅ **THE COURT RAN (#125, foreman-19, $7.12, record `docs/specs/PROMPT_AUTHOR_COURT_2026-08-26.md`, five strips in his gallery) AND HE JUDGED IT — Crew reply #8, 2026-08-26 16:31, verbatim on #125: "B is the studio, for both the rich prompt and the thin one — build the author verbatim-first with LOW as the default …"** Next steps, in order: (a) THE REGISTER REBUILT to the ruling — author verbatim-first, LOW default, MAX rewritten to leave the face and axes open, the reader beside it recording only — DARK behind `CASTING_CREATIVE_REGISTER_SCOPE` (PR #94 is superseded, not extended); ✅ **SLICES A+B MERGED (PR #132 `30e77025`, foreman-21, live on his account at `users:1` since deploy `cd92422b` 07:35Z; slices C/D/E open on #131)**; #126 "always" (reply #9) MERGED PR #134; (b) the B+R realism court (#128) and the preset calibration (#130) — small, under the threshold; R enters the bundle only on his eye; (c) the refusal-loop patrol (#129); (d) **the MINIMAL settings modal — style selector (photoreal only) + the imagination slider — pulled from N3 into N1 as the register's LAST slice on his word (2026-08-26 evening, verbatim: "do it - add the minimal settings modal to N1"; the full modal with advanced settings and other art styles stays in N3)** — ✅ **BUILT AND MERGED 2026-08-27, PR #150 `a34184c9` (foreman-27), live at `users:1`; ✅ **HIS EYE PASSED IT 2026-08-26 21:11Z, Crew reply #12, verbatim: "imagination should be a slider, but yes as a minimal version for now that's good" — the slider is recorded on #142 as the full N3 modal's shape**; (e) `users:1`, then his eye = the milestone gate. **#131's last open item — the author carrying a FOLLOW and chip edits — is BUILT (foreman-40, 2026-08-27, #154 THE FAMILY CLAUSE) on his reply #11, verbatim: "Yes to building it; (1) yes, let the engine vary; (2) yes, read-only chips with the sentence; (3) no fine details. It is dark until it lands, and the first follow on your account is the court." His first Follow on his own account is that court.** **#139 (the author spec fix — he watched it roll and it was wrong) precedes everything above.** #126 (refuse-free) is his word and admissible now. The milestone gate stays "not passing yet".

**Two founder laws ride in this focus's orbit (2026-08-25):** the register is
**Path B/F8's heir** (#56 closed; the supersession sentence lives in the
register design's header), and — his verbatim reconciling law from #63 —
**"basics is the default birth state"**: born basics unless the brief/register
calls for otherwise, with the basics court 1 run FUNDED on his word (and now
under THE SPEND THRESHOLD: no price card needed while it stays under $50).

⚠ **THE SECOND OF THOSE TWO IS SUPERSEDED AND THE PARAGRAPH ABOVE IS KEPT AS
ORIGIN, NOT AS LAW** (found by the freshness pass, #271, 2026-08-30). He ruled
the whole road retired three days after saying it — **#203, verbatim: *"yeah we
will retire the wardrobe/basics path obviously"*** — and the author road had
already retired the toggle (*"the engine dresses the cast from the prompt;
basics is a word, not a mode"*). **So there is no default birth state to rule
on: the machinery that has one is being deleted.** Two cards were still asking
shifts to work inside it — **#120** (correct `DEFAULT_CASTING_PATH`, which is
still `wardrobe` at `shared/castingPaths.ts:76`) and **#63** (two unbuilt
basics-default COURTS, i.e. paid measurements of the same road) — and both are
recommended into #203 rather than worked. `CLAUDE.md`'s
`CASTING_TWO_PATHS_SCOPE` entry carried the same premise and is stamped in the
same commit.

## THE SPEND THRESHOLD (founder law, 2026-08-25, terminal — verbatim)

> *"i thought we established it doesnt need my permission to do this unless it
> plans to spend a massive amount of money like $50+"*

Said the hour a funding card for a few-dollar court reached his Crew tab.
The rule going forward, superseding every per-court "priced on a card before
it spends" clause in this file and in the designs:

- **A measurement, court, or experiment expected to cost UNDER $50 runs
  without asking.** No funding card, no waiting. The spend is still RECORDED
  — the shift report and the issue carry the estimate before it fires and the
  actual after, so the ledger stays honest and drift from estimate to actual
  is visible.
- **$50 or more comes to him PRICED, before any paid arm fires** — a card
  with the number, what it buys, and the recommendation. This includes a
  cheap-looking loop that would cross $50 cumulatively in one brief: the
  bound is the brief's total, not the single call.
- **Customer-credit spends are untouched by this** — this law is about HOUSE
  money (render/API costs). Nothing here changes refunds, pricing, or any
  money-path rule.
- The Machinist's 2K render-tier experiment keeps its price card ONLY if its
  estimate reaches the threshold; otherwise it runs and reports.
- Top-ups remain automatic per his standing "in stone" rule — never ask
  about top-ups; courts wait for the floor and dispatch silently.

## THE LOBBY SIDE LANE (founder-authorised, 2026-08-29 — #228, urgent)

**His word, verbatim (terminal):** *"since my credits are out we could use the
opus model to fix the lobby design etc? might aswell keep working until my
credits are back as long as the desk stays on current main task"* … *"yes i as
long as when my fable credits refresh we can get right back on task. but dont.
we will work through the whole lobby re-design piece by piece in segments."*

- **A SIDE LANE, never the milestone.** The focus above stays **N1**; the lobby
  appears in the briefing's PIPELINE only. THE MILESTONE GATE is untouched.
- **When his Fable credits refresh, N1's close OUTRANKS any lobby work** — a
  segment in flight is finished or parked cleanly, never abandoned half-merged.
- **SEGMENTS, ONE AT A TIME, his eye between each.** No shift takes two, and no
  shift invents the list.
- **The casting road is FROZEN in this lane.** A lobby segment that needs a
  casting change STOPS and cards it. Money/auth surfaces do not appear here at
  all.
- It supersedes L&F #66's ordering **for the duration of the cap only**.

**State (foreman-97, 2026-08-29 18:05):** the first deliverable — the SEGMENT
PROPOSAL — is done and on his desk (edition 101, card `lobby-segments-228`;
full reasoning `docs/specs/LOBBY_REDESIGN_SEGMENT_PROPOSAL.md`; the same list
on #228). Six segments proposed, Home recommended first.

✅ **HE HAS NAMED SEGMENT 1 — 2026-08-30 00:34Z, Crew reply #42 (recorded
verbatim on #228 by foreman-114). The blocking condition that stood here is
DISCHARGED, and the lane is open** — but he did not pick from the six, he
reordered the work and reversed one of the proposal's rulings. Read his reply
on #228 in full before touching this lane; the load-bearing parts:

1. ⚠ **THE PROPOSAL WAS WRITTEN AGAINST A STALE PROTOTYPE**, and that is his
   first sentence: *"you're reading the stale prototype. That's most of the
   confusion."* The current pack is
   `docs/specs/Casting-ui-ux-design/drape-redesign/` (committed by foreman-114
   — it was UNTRACKED and one sweep from gone). **Step 1 in its `START-HERE.md`
   runs before anything else**: overwrite the committed `Klieg Studio.dc.html`,
   `support.js`, `image-slot.js` and `drape-foundation/tokens.css` with the
   current versions from design. **His acceptance check for that step: the rail
   shows EIGHT items including Cinema.**
2. **SEGMENT 1 IS `00-foundation-topup.md`, SEGMENT 2 IS `00b-chrome-and-menus.md`
   — not Home**, and his reason binds: Home is a *surface*, surfaces are
   assembled from the nine shared components 00 adds, and building Home first
   means building those nine inline and extracting them later — *"exactly the
   rework pass you're trying to avoid."* 00's acceptance test is that it makes
   **no visible change**.
3. ⚠ **HE REVERSED THE PROPOSAL'S UNBUILT-CAPABILITY RULING, and calls it "the
   real disagreement."** Unbuilt features are **designed in and greyed out**,
   following `Rail.tsx`'s existing stub pattern — *"a stub names a place, never
   a capability, and never carries an unread dot."* This **supersedes the
   no-dead-links comment in `LobbyUtilityMenu`**. So the prompt box ships:
   Image live; Video, Try-on, UGC, Upscale and Voice **visible, greyed, "not
   built yet" on hover, not clickable**. His reason is a product one — *"the
   shape of the product is a decision I want fixed now, while it's cheap"* —
   and he explicitly kept the capability audit: *"it changes the treatment of
   those five, not whether they appear."* **This is consistent with the
   placeholder amendment above, and sharpens it** rather than conflicting.
4. **Library is a REPLACEMENT, not a reconciliation.** The three list pages the
   rail points at are being **retired**. One grid grouped TODAY / YESTERDAY /
   EARLIER THIS WEEK / EARLIER, with search. **Library vs Assets is settled and
   not an open question** — Library is what we generated, Assets is what you
   supplied; *"If the data can't answer it cleanly, that's a migration task,
   not a design question to hand back."* Ship the Kept/All lens even with no
   30-day rule behind it.
5. ⚠ **DO NOT TREAT THE CURRENT SURFACES AS DESIGNED WORK.** *"Casting is the
   only page in the live app that has had real design put into it. Home,
   Library, the boards page, the staff pages are placeholders that accumulated,
   not decisions."* Two consequences in his words: **casting is the REFERENCE,
   not a subject** — frozen in this lane, and the answer to any question the
   briefs do not cover is *whatever casting already does*, never a second
   convention; and **prefer replacing over adapting** — *"If a segment turns
   into 'keep the existing structure and restyle it', you've taken the wrong
   path."*
## ▶ THE RUN ORDER AFTER SECTION 02 — founder-ordered 2026-08-30, take these IN THIS SEQUENCE

He asked *"so when will this run after the rails?"* and this is the answer he
was given. It is three ordered pieces, **all authorised, none needing a further
word from him.** A shift does NOT idle waiting for his eye on section 02 —
these are not the lobby lane.

1. **#271 — THE FRESHNESS PASS. Ordered, blocking, and it goes first.** His
   word: *"yeah we need a freshness path done to find whats relevant and whats
   not."* Two populations: the ~77 open cards (45 from one day, never re-read
   against the code) and **`PROGRAM.md`'s own standing-exceptions ranking below,
   whose eight cards — #54 #39 #41 #40 #38 #37 #32 #33 — are ALL CLOSED**. One
   line each: built / partly built / obsolete / figure stale / still true, read
   at the code. Then the ranking is rewritten **as a DERIVED view**. It is
   reading, not building; it needs no design decision from him.
2. **#272 — the live shift row.** What is running, written at shift START,
   read live from the database like his replies. No deploy.
3. **#277 — the background-work panel.** Master switch plus a per-category
   switch and a live COUNT, drawn from the queue's own labels. **#271 is its
   hard prerequisite** — a count is a promise about what is really there, and
   over today's queue it would be false about roughly a third of it.

⚠ **2 and 3 share one page and one mechanism; whoever takes one should take
both or hand over cleanly.** ⚠ **AND THE ORDER IS NOT NEGOTIABLE: shipping the
panel before the pass gives him a confident number over a queue a third of
which may be fiction, which is worse than no panel at all.**

**Section 02 itself is at PR #273 and stops there for his eye.** The lobby lane
does not continue: the next section exists when he sends its brief.

---

▶ **THE FREEZE IS LIFTED FOR EXACTLY ONE SECTION — 2026-08-30 ~14:30 AEST.**
He sent the brief the freeze was waiting on: **`02-topbar-and-rail.md`, card
#270** — one PR, and it lands before any page is rebuilt, because it is the
frame every later page sits inside. `.agents/STOP` removed on that word.

⚠ **THIS AUTHORISES SECTION 02 AND NOTHING ELSE.** *"No more specifying six
sections ahead"* is the standing method ruling, so **the next brief is HIS to
send**. A shift that finishes 02 and its promotion pass **stops**, exactly as
the milestone gate works: it does not take a third thing, and it does not
reopen the pack's numbered `01…10` table, which his parking note superseded.
Three of 02's items are RULINGS and are quoted verbatim on #270 — the search is
a `<span>` and never an input, F1 is reversed once and then fixed at eight, and
the account chip crosses to the topbar while the rail's foot takes a gear.

The freeze that preceded it, kept because its reasoning is the method now:

🛑 **HARD FREEZE — THE FOUNDER PARKED THE WHOLE TEAM 2026-08-30 ~14:17 AEST.**

His words, verbatim:

> *"dont run any shifts yet i think i need to re-think how we do this ui
> upgrade"*

> *"Why I'm parking it: the approach was wrong, not the work. We built shared
> components before the pages that use them — eight of the nine from segment 00
> have no consumer, and the same pass missed two parts that five surfaces each
> need. Your audit on #262 found that by counting real code, which is the
> method we should have been using from the start.
>
> So we're switching to one brief per thing, written just before it's built. No
> more specifying six sections ahead.
>
> Nothing you've built is wasted. Segment 00's components stay where they are;
> whatever nothing uses by the end gets removed then. 00b is right. The
> promotion audit stands and will be the first thing to run when we restart.
>
> I'll send the new running order and the next brief. Don't start anything
> until then."*

**What this settles, and it binds every future lane, not just the lobby:**

- ⚠ **THE PAGE-BY-PAGE PACK HE SENT AT 14:07 IS ITSELF SUPERSEDED IN ONE
  RESPECT** — it still numbers ten sections ahead (`01`…`10`). **"No more
  specifying six sections ahead"** is the newer word. `PROMOTION-PASS.md` and
  its method SURVIVE and are the thing to keep; the numbered running order does
  not, and is replaced by whatever he sends. Do not restart from the pack's
  §"Where the lane is" table.
- **ONE BRIEF PER THING, WRITTEN JUST BEFORE IT IS BUILT.** A brief written
  ahead of the page it describes is what produced eight components nothing
  imports. This is a method ruling with the same force as the milestone gate.
- **NOTHING IS DELETED.** Segment 00's orphaned components STAY. Do not sweep
  them, do not "tidy" them, do not build more like them. *"Whatever nothing
  uses by the end gets removed then"* — at the end, not now.
- **00b is right.** Not revisited.
- **The promotion audit (#262) STANDS and is the FIRST thing to run on
  restart** — with his reply #43's sequence, which is already filed on the card.
- **Resuming is HIS act, not a shift's.** Deleting `.agents/STOP` on anything
  short of his explicit word is a violation of this entry.

**Stopped mid-shift, deliberately, at his order** — see
`.agents/mailbox/runner-close-20260830-1252-STOPPED-BY-FOUNDER.md` and the
runner's own stamp beside it. That shift landed PR #269 (his section-00
corrections) and PR #266 (the bug-report inbox) before it was killed; both are
on `origin/main`. It wrote no handoff, so **the next shift inherits nothing
from it and must check for orphaned dev servers and unclaimed litter.**

---

✅ **BOTH PRs ARE IN AND THE LANE IS STOPPED — 2026-08-30 (foreman-115, foreman-116).**
Segment 1 (`00`) merged `0e59e990` (PR #259); segment 2 (`00b`) merged
`070d40cf` (PR #264), with his own prototype refresh riding in it. **He
supplied the four files himself at 11:50 AEST**, twelve minutes after edition
130 asked — his acceptance check passes at the refreshed copy (`cinema` 15,
was 0; `staff` 12, was 0), so step 1 is discharged. Briefing edition 131 puts
segment 2's five frames in front of him.

⚠ **NO SHIFT TAKES ANOTHER LOBBY SEGMENT UNTIL HE ANSWERS.** His instruction
is item 6 below and it is unconditional. A shift arriving with the lane
apparently "open" works a standing exception or a specified brief instead —
#243, #231, #255 and #252 are all his words and all unstarted. The six
segments are RE-PROPOSED after his answer, against the refreshed prototype,
and he expects Cinema and the staff pages to change that list.

✅ **HE HAS RULED ON THE AUDIT — 2026-08-30 03:39Z, Crew reply #43 — AND THE
LANE HAS A SPECIFIED NEXT PR** (recorded verbatim on #262 by foreman-117). His
answer is **(a)**, with the split amended: **FIVE move, not six.** In his order,
one PR: (1) rename `.dpc-signm` → `.dpc-modal` inside casting, own commit;
(2) `CastingModal`, `ConfirmDialog`, `CardMenu`, `RenameCastDialog`,
`DeleteCastConfirm` move, casting imports them back, no behaviour change;
(3) the three dialogs are built **ON** the promoted shell, not beside it;
(4) **the three popovers collapse to ONE and casting's survives** — `Popover.tsx`
AND `usePopover` both reconcile against it, *"don't leave a second option
alive"*; (5) `BriefField` **HELD** and `ConceptUploadCard` deferred.

⚠ **A NEW STANDING RULE COMES OUT OF IT AND BINDS EVERY FUTURE FOUNDATION
ADDITION — his own words, correcting his own brief:** *"My 00 brief opens with
'each one below appears on three or more surfaces' … I broke my own rule in the
same document, counting surfaces in the design instead of consumers in the code.
Your measurement is the correct one. **From here: two real consumers in the
codebase, or it waits.**"* He also owns the third popover as a briefing error
rather than a build error (§5 ordered popover discipline without saying
`Popover.tsx` already existed).

**His held question is ANSWERED on #262** (`BriefField` vs `Field`/`Input`):
they do not compete — `Field` is a wrapper div, `Input` is an `<input>`, and
`foundation/` contains **zero textareas**, while `BriefField` already renders
`Input`'s own `dp-input` class plus 8 lines. The duplication he sensed is real
but one layer over: **three** auto-grow owners and **three** IME-guard owners,
and `BriefField` is the only one with both — which matters because that guard is
a money-safety control on a 160-credit Enter. It stays HELD for his word.

✅ **AND HE RULED ON THE 00b FRAMES — Crew reply #44, filed as #267.** He passed
the stub treatment (*"exactly right"*) and both deliberate omissions (*"a number
in a screenshot that no server produces is a lie that survives into the
build"*), and corrected the contents: drop **Theme**; rule on **Cookie
preferences** (answered at the code — no consent mechanism, **zero third-party
trackers**, two strictly-functional cookies, so the recommendation is that the
row should not EXIST rather than be greyed); account menu gains **Members &
invites** second, **Billing → Billing & credits**, **Log out → Sign out**. ⚠ **The
binding clause is the one under the labels: all three open the SAME Settings
modal at different sections, so none of them may be wired to an individual modal
now** — every one added is one more to unpick later.

✅ **#262 — THE PROMOTION AUDIT — IS DELIVERED (foreman-117, 2026-08-30):**
`docs/specs/FOUNDATION_PROMOTION_AUDIT_2026-08-30.md`, card
`promotion-audit-262`, briefing edition 132. His order was *spec refresh →
promotion audit (written) → 00b → stop*; the audit was skipped because his
card landed twelve minutes after 00b merged, and it is now caught up.
**Nothing moved — it is a document and a decision, and it does not restart
the lane.** ⚠ **It now WAITS ON HIS WORD like the lane does**: six of
casting's 23 are proposed for promotion, two later, fifteen stay, and the
popover has three separate implementations. **No component moves until he
answers**, and a shift that reads this as authorization to start moving
files has misread it. The measurement that decides it: eight of segment
00's nine components have no production consumer at all, so casting's
implementations survive wherever the two collide.

6. **THE MILESTONE GATE APPLIES INSIDE THIS LANE, by his own instruction:**
   *"00 as one PR, 00b as one PR, then stop and show me. I'll write 02 onward
   against what actually shipped — component APIs move once they have real
   consumers."* So **two PRs and then the lane STOPS** for his eye. The six
   segments are re-proposed after 00b against the refreshed prototype; he
   expects Cinema and the staff pages to change that list.

⚠ **TWO OF HIS OWN ORDERS NOW SIT IN FRONT OF THIS LANE, and both are his
words rather than a shift's reading.** (1) **#230**, verbatim: *"before we
start on the ui redesign lane we need to fix max settings when casting"* —
merged and deployed (`d4a04042`, foreman-99), still awaiting his roll. (2)
**#234**, verbatim: *"before we hit the ui-redesign please re-design our hero
on the casting page ... the current hero image on the right side in casting
studio is boring and needs this re-design"* — ✅ **BUILT, MERGED AND DEPLOYED
2026-08-29 (`63734bcb`, foreman-100)**, evidence
`docs/specs/CASTING_HERO_234_EVIDENCE.md`, his eye asked for on card
`casting-hero-234` (edition 105). Neither is a lobby segment: the hero is the
casting page's own surface, so the casting freeze in this lane is untouched by
it. The lane still waits on segment 1.

## Standing exceptions (worked regardless of focus, in this order)

⚠ **THIS RANKING IS DERIVED NOW — IT NAMED EIGHT CARDS AND ALL EIGHT WERE
CLOSED** (found by the freshness pass, #271, 2026-08-30; his order: *"yeah we
need a freshness path done to find whats relevant and whats not"*).

Until today band 1 read *"right now **#54, the refine lockKey** … money path
first; it outranks #41"*, and bands 2–5 named #39, #41, #40 and #38 by number.
**Read at the artifact: #54 #39 #41 #40 #38 #37 #32 #33 — every one CLOSED on
2026-08-25**, four of them before the paragraph naming them was five hours old.
So the list every shift opened to decide what mattered MOST pointed entirely at
finished work, for five days. That is working law 4 — a second list shadowing a
source of truth always drifts from it — and the repair is to stop keeping the
second list.

**The queue is the source of truth. Read the band, do not transcribe it:**

```
npx tsx scripts/queue-standing-exceptions.mts
```

1. **Anything the founder marks urgent** — the `urgent` label, oldest first
   (an urgent card that has waited longest is what #236 was filed about). The
   script above IS this band; a card closing removes itself from it with no
   edit anywhere. ⚠ **This band and his ordered band are NOT merged, and a card
   in BOTH is taken from his band first — his ruling of 2026-09-09 (#718),
   verbatim: *"Urgent wins inside your ordered group"*.** The ordered clause
   below is where that reading is written down. ⚠ **A derived view is only as honest as its labels, and the
   pass's first reading proves it**: #234 (the casting hero) is BUILT, merged
   and deployed and still carries `urgent`, so it sat fifth in the band. A
   wrong label is one field to fix, in the place the ranking is read from —
   which is still strictly better than a paragraph nobody re-reads.
2. **Anything that blocks every merge** — a red gate, a broken instrument, a
   suite that cannot go green. It outranks the focus until it is closed.
3. Patrol duties when their clock fires — THE CLOCKS, defined here because
   nothing else defines them (each is maintenance-mode admissible):
   - **Janitor** — every 3 days: litter sweep (untracked leftovers, the
     output/ remainder #8, doc drift), findings filed as cards, fixes as
     small PRs. First run inherits the 294 files the seat left.
   - **Warden** — weekly: security pass (#32 gitleaks first, then #33/#35),
     access-control suites re-run, audit rows read, findings carded.
   - **Machinist** — weekly: the performance ledger (first run builds it),
     worst number targeted only via a carded, measured brief. **Its charter
     is founder-ruled (#58, 2026-08-25)**: the studio-wide "laggy in
     general" pass, the "optimize massively" cost half, and the approved
     2K render-tier experiment ("the hybrid option is dead") as its first
     big brief — priced on a card first ONLY if its estimate reaches THE
     SPEND THRESHOLD ($50); under it, estimate on the issue, run, report.
   - **Retro** — weekly: read the week's queue for REPEATS (reopened bugs,
     same class twice, gate rejections sharing a cause); each repeat becomes
     a proposed guard (preferred) or a proposed law — laws land on the Desk
     for the founder's word, never self-ratified. Track the recurrence rate.
     **AND the shift audit**: sample at least one shift report from the week
     and verify its claims AT THE ARTIFACTS — the commit it names, the test
     output it cites, the issue it says it closed (working law 1 pointed at
     the team itself: reports are claims, artifacts are facts). A claim that
     doesn't survive the audit is a finding about the SHIFT PROCESS and goes
     on the Desk, whoever wrote it.
   A patrol that finds nothing writes one mailbox line and costs nothing.

   ⚠ **THE LAST-RUN DATES ARE DERIVED NOW — THIS PARAGRAPH USED TO TRANSCRIBE
   THEM AND THEY ROTTED, exactly as the standing-exceptions ranking above did**
   (#505, founder-ordered 2026-09-04). It read *"The Foreman tracks last-run
   dates in its mailbox entries"* and then listed four `next ~date`s. Nothing
   computed them, so nothing noticed: on 2026-09-04 the **Retro had run ONCE,
   on 26 August — nine days past a weekly clock**, and all four seats were
   overdue. The clock periods are unchanged; where they are READ has moved:

   ```
   npx tsx scripts/patrol-clocks.mts
   ```

   Each seat's log declares its own clock (`**Clock:** every N days`, under the
   title) and records its own runs, so one artifact carries both facts and a
   seat cannot drift from a period written somewhere it never looks. The
   reader REFUSES rather than dropping a seat it cannot read, and every shift
   runs it at start (standing orders §2z, step 3). **The clocks stated above —
   Janitor every 3 days, Warden, Machinist and Retro weekly — are the same
   periods those log headers carry**; changing one is the founder's word and is
   made in the log, where the reading happens.

   **FIRST PATROLS RUN NOW, NOT ON THE CALENDAR (founder, 2026-08-26 —
   "do it").** The clocks above were set before the tools existed; the tools
   exist and each seat has material waiting. Order: **Retro first** (patrol
   card #95 — it audits the shifts and rules on the stale-atlas repeat),
   then **Janitor** (#96 — knip's first reading as cards, the locked
   worktree dirs, the `.tok*` litter), then **Warden** (#97 — merge #89,
   land the semgrep/knip CI steps, first findings baseline), then
   **Machinist** (#98 — build the ledger). One patrol per shift; after the
   first run each seat's clock counts from that run.

   **SEATS ARE NAMED ON EVERYTHING THEY TOUCH (founder, 2026-08-26).** A
   patrol shift stamps its seat on the mailbox filename
   (`retro-<date>.md`, `janitor-…`, `warden-…`, `machinist-…`), on the
   briefing's `shift` field ("Warden — patrol #1"), on
   the cards it files (label `seat:<name>`), and on its PR titles. The
   founder must be able to see WHO found what without opening a file.

   **THE ANTI-BOREDOM RULE (founder, 2026-08-26, his question: "we need to
   ensure if they are waiting a long time for me they dont completely over
   engineer security or anything because they are bored").** Waiting is
   not a brief. A maintenance shift may only work something that traces to
   a FINDING THAT ALREADY EXISTS — an open card, a patrol result produced
   on its clock, a measured number, a gate/review failure, a founder word.
   "I noticed we could also harden X" is NOT a finding; it is a card
   proposal for the Retro, filed and NOT worked. Patrols run ONCE per clock
   period — a seat does not re-patrol because the shift is idle. New
   instruments, tools, controls or workflows are built only from a card
   that predates the shift and names the finding it answers. When the
   queue holds nothing admissible, the shift writes "quiet — nothing
   needed doing" and exits; consecutive quiet shifts are CORRECT and cost
   nothing. The Retro reads for this specifically: a run of "hardening"
   PRs with no finding behind them is a process finding.

   **Patrol memory lives in records, never in heads**: every patrol run
   BEGINS by reading its predecessor's record — the Machinist its ledger,
   the Warden its findings baseline, the Janitor the last manifest, the
   Retro its recurrence log — and ENDS by appending to it. Findings are
   deduped against the queue, open AND closed: a closed card's reason is a
   standing verdict (fixed / false positive / founder said no), and refiling
   it without new evidence is noise. Attempted-and-reverted work is recorded
   as explicitly as wins, so no seat retries a failed idea from ignorance.

   **Seat activation is automatic and needs no new infrastructure**: patrols
   are not separate processes — the Foreman's own continuous loop is their
   clock. When a patrol's cadence is due, the shift takes the patrol brief as
   its unit of work; a seat's first-ever run is simply its build card worked
   (e.g. the Warden's first run installs gitleaks, #32). Reporting is
   inherited, never configured: every seat reports through the same three
   channels every shift already must (mailbox entry, the briefing's pipeline
   and cards, queue cards). The one exception is a seat needing its own independent
   clock (the Watchtower's minutes-cadence production monitor): creating any
   NEW persistent process or scheduled task is done only inside that seat's
   own queue card, and its activation is announced on the Desk the shift it
   happens — a new standing process is never a silent side effect.

## Explicitly parked (do NOT work these; they are not forgotten, they are ruled)

- The R7 evidence family (#6) — founder ruling 2026-08-25: parked until the
  casting push lands, revisit at launch prep.
- Legacy-studio retirement itself (#29) — it is the FINISH LINE, not a task;
  it begins only when the founder says V2 is ready to replace legacy, and the
  Atlas's retirement views govern every deletion when it does.
- Everything labelled `parked` or `design-unbuilt` that is not the current
  focus — designs wait their turn; the queue holds them.

## The anti-randomness rule

A shift that cannot trace its brief to (a) the current focus, (b) a standing
exception, or (c) a founder instruction on the Crew tab DOES NOT CUT THE
BRIEF — it writes a Desk card asking, and works a standing exception instead.
Momentum is never a reason; provenance always is.

## THE MILESTONE-CLOSE REVIEW (founder-ordered, 2026-08-25)

The per-PR gate reviews trees; this reviews the forest. **When a focus or
milestone completes, the closing shift orders ONE deep Fable review over the
   (⚠ #1065, 2026-09-22: that deep review is the RELAY's, by hand, at its next
   sitting — the action reviewer is retired for good; the closing shift asks
   for it on the completion card rather than triggering anything.)
milestone's ENTIRE diff** (first commit of the focus → last), before the
completion card reaches the founder. It looks for what no per-PR review can
see: whether the merges add up to a coherent whole, architecture drift,
controls orphaned along the way (the path-three death class), docs and atlases
still telling the truth about the finished thing, and promises made in early
PRs that later PRs quietly dropped. Its findings become queue cards; its
verdict rides the completion card. The per-PR gate is untouched by this —
both run, they answer different questions.

## THE MILESTONE GATE — no milestone flows into the next (founder law, 2026-08-25)

Verbatim: *"i never want the foreman to continue through all milestones
without me testing driving or checking at the end of each major milestone as
i may want to make scope changes etc … so if the foreman is ever just waiting
on me to respond and get to my computer it could always be working on other
maintenance things that other agents have detected or performance improvements
security issues etc."*

Structurally: **completing a milestone NEVER authorizes starting the next one
— not even when the plan names it in order.** At every major milestone
boundary: (1) the milestone-close review above runs; (2) a completion card
lands on the Desk — what shipped in product terms, the review's verdict, and
a short TEST-DRIVE list of the specific things worth his hands and eyes in
the running app; (3) the focus is CLEARED — the next milestone starts only on
his word, because milestone boundaries are exactly where he makes scope
changes, and the program's own history proves it; (4) **waiting is never
idle** — the team drops into MAINTENANCE MODE below until he answers, so his
time to test-drive costs the program nothing.

## ⚠ FOUNDER-ORDERED WORK IS ALWAYS AUTHORISED — the clause that was missing (2026-08-30)

**His words, and they name the defect exactly:**

> *"see this is what confuses me i said to do those things so i assumed the
> shifts are working on them but they are not how do i even track this and
> decide what needs to be worked on now etc"*

**He was right and the trap was structural.** MAINTENANCE MODE below says *"the
team NEVER selects the next feature"* — correct, and it is what stops shifts
inventing work. But **nothing in the system distinguished a card HE ORDERED from
a card somebody filed.** So on 2026-08-30 he ordered the icon set, the casting
shell, the fitted-hardware rule and the Invite fixes; all four became cards; and
every shift correctly declined to take them, because taking them looked like
selecting a feature. **He gave four instructions and the team did none of them,
each refusal individually correct.**

**THE CLAUSE:**

**A card labelled `founder-ordered` is AUTHORISED WORK and is taken FIRST —
before the focus, before patrols, before anything.** It is not gated on a
confirmed focus and it is **NOT** gated on the background-work switches. Working
it is not the team selecting a feature: **HE selected it.** Maintenance mode
governs work the team FINDS; this governs work he ASKED FOR, and the two must
never be confused again.

- **The relay applies the label** when it files an instruction of his. A card
  without it is not his order, however it is worded.
- **Order among them is his**, and absent a word, oldest first.
  ⚠ **AND `urgent` IS SUCH A WORD — HIS RULING, 2026-09-09, Crew reply #168,
  verbatim and entire: *"Urgent wins inside your ordered group"*.** So inside
  his ordered band an `urgent` card floats to the top, and oldest-first governs
  everything under that. **The two BANDS are still separate** wherever they are
  printed (#471: `urgent` means this cannot wait, `founder-ordered` means he
  chose the order); what he settled is only what happens INSIDE his band.
  **Nothing about this is transcribed** — the comparator is
  `scripts/lib/orderedBand.mts`, his page and the shift's priority view both
  call it, and `server/orderedBandOrder.test.ts` drives the two over one
  fixture. **The question existed because this file's two clauses could be read
  two ways and two renderers read them differently** (#718): his page floated
  urgent, `queue-standing-exceptions.mts` did not, and the disagreement was
  held shut by a sentence in a docblock asserting they agreed.
  ⚠ **HIS WORD, 2026-08-31: #330 GOES FIRST** — *"can item #330 be brought to
  the front of the que?"*. Take it before any other `founder-ordered` card,
  whatever the dates say. **It is the 186 KB law file and the batching rule**,
  and it earns the front twice over: every other card is paid for by the shift
  ceremony it shortens, and **the same file growth silently killed four shifts
  today** (#332 — the standing orders crossed the Windows command-line limit,
  each launch dying in the same second with exit 0 and an empty log). Speed
  and safety are one subject here.
  ⚠ **THERE IS A PIN NOW — `order:<n>` (#1006, Retro run 4, 2026-09-19, PR
  #1038). The paragraph below is kept as origin.** When he orders cards in a
  sentence, **the relay files his sequence as labels** — `order:1` on the card
  he named first, `order:2` on the next — and `scripts/lib/orderedBand.mts`
  puts ranked cards above every unranked one, lowest first, on his page, in
  the shift's priority view and in the runner's escalation gate alike (one
  reader, `rankFromLabels`). A card he did not rank keeps the urgent-then-
  oldest order exactly; two cards he gave one rank fall through to it. Only a
  bare positive integer counts (`order:01`, `order: 2` are no rank), and the
  label must exist on the repository before `gh issue edit --add-label` will
  apply it — `order:1` … `order:8` were created on 2026-09-19; a ninth is
  `gh label create order:9 --color 0A0A0A`. **The night of 2026-09-16 is why**:
  he ordered five and NEXT UP showed him the exact reverse.
  ~~⚠ **There is no "pin to top" mechanism**~~ — the derived NEXT UP sorted
  urgent-first then oldest-first, so `urgent` was added to raise #330 and THE
  SENTENCE ABOVE THIS ONE was what actually put it first. A shift must still
  read the card body, not only the row order. ~~If he pins a second card this
  way, that is the point at which the ordering wants a real field rather than
  a paragraph.~~ He pinned five; the field is the label.
- **A `founder-ordered` card still stops at the same gates as any other work** —
  it goes branch → PR → the gate, and it does not authorise touching money or
  auth beyond its own scope. It changes WHETHER it is picked up, never HOW.
- ⚠ **If one cannot be built without a decision from him, say so ON THE CARD
  and put it on his desk. A card that is blocked on him must not sit silently
  looking like queued work** — that is this same failure wearing a label.
- ⚠ **AND WHEN HE ANSWERS, EDIT THE CARD'S BODY. A REPLY IN A COMMENT DOES NOT
  UNBLOCK A CARD WHOSE BODY SAYS IT IS BLOCKED.** `#278` was this file's own
  worked example of a blocked card, and it had been ANSWERED — *"all of them
  same as lobby"*, recorded in TWO comments — while its body still read *"wants
  his brief rather than a shift's judgement"* and this bullet still named it.
  **Two shifts read the body, correctly stood down, and reported it as waiting
  on him. He found it himself: *"the casting shell needs something else from me?
  nothing is on my desk though."*** Three sources said blocked; the answer sat
  where nobody re-reads. **The relay owns this**: his ruling goes at the TOP of
  the body, the superseded sentence is struck rather than deleted, and any
  pointer to it in this file moves in the same act. A comment is a record; the
  body is what gets read.
- **`gh issue list --label founder-ordered --state open` IS the answer to
  "what needs working on now".** It is his tracking view and it is derived, not
  a second list.

## MAINTENANCE MODE — the only work when no focus is confirmed (founder law, 2026-08-25)

Verbatim: *"if the foreman closes out the current feature and build plan it
wont start building toward a new random feature or build plan only bugs and
improvements pointed out by the other agents can be automatically executed
autonomously if they dont require my eye if there is no current plan or build
in progress."*

So, structurally: **the team NEVER selects the next feature. Ever.** When the
current focus completes (or whenever this file holds no CONFIRMED focus):

1. The closing shift marks the focus complete here and on the Desk, and writes
   a Desk card proposing next-focus options with a recommendation — then
   STOPS choosing.
2. Every subsequent shift runs in MAINTENANCE MODE, where the only admissible
   briefs are:
   - **bugs** filed by the gate, the patrols, in-app reports, or the founder;
   - **improvements the other agents pointed out** — Janitor findings,
     Machinist measured wins, Warden hardening — that stay INSIDE existing
     behavior: no new features, no new surfaces, no new capability, nothing
     a customer would notice as "new";
   - and only where nothing needs the founder's eye or crosses a founder
     gate. Anything that does becomes a Desk card and waits.
3. Feature work resumes ONLY when the founder names the next focus (Desk
   reply or chat, quoted verbatim into this file).

A maintenance shift with nothing admissible to do writes a short mailbox note
("quiet night — nothing needed doing") and exits — and ships NO edition. An idle night is a correct
night; an invented feature is the one unforgivable brief.

**QUESTIONS ON HIS DESK ARE WRITTEN IN PLAIN, SIMPLE ENGLISH — HIS RULING,
2026-09-25 (terminal), verbatim: *"also questions for me to decide landing on my
desk must be in plain and simple english easy for me to understand"*.** A
needs-you card is read by one person, at a glance, to make a decision. So:
lead with what it means for a customer and what he is being asked, in the
words he would use — never the pipeline's; short sentences; no code, no
markdown asterisks, no symbol names, no numbers he cannot act on; the options
one line each; the recommendation first and plainly labelled. The worked
example on the day: card 1126 on his desk ran to twenty paragraphs of bold
markdown and three character counts before it asked its question. A card the
relay would have to translate for him has failed this rule and is rewritten,
not explained.

**PROBLEMS HOLDS ONLY ACTIONABLE FAULTS — HIS RULING, 2026-09-25 (terminal),
verbatim: *"problems never seems to update and it doesnt feel useful either
only problems which are actual problems and actionable need to go here
otherwise these are not problems??"*.** A problem row is something BROKEN that
somebody can act on, and it names the card it lives on (#N) so the live page
can retire it when that card closes. Queue-shape narration ("47 open, 14
untouched for 7 days") is NOT a problem and is not written there — it belongs
in the shift line. An `info`-severity row (the page drew it as "Note") is no longer drawn on his page at all.
Resolve a problem row in the same edition that ships its fix.

**AND THE GENERAL BOX IS GONE FROM HIS PAGE, ON HIS WORD THE SAME HOUR**
(*"remove the general card from the crew tab i literally never use it"*).
His rulings arrive as replies on cards, or in the terminal through the relay;
do not tell him to write a General note, and do not read the absence of one
as silence.

## JEV, WHEREVER IT GENUINELY IMPROVES THE WORKFLOW (his ruling, 2026-09-25)

Verbatim: *"Where-ever jev can genuinely improve my agents workflow it should be used."* Jev (#1064) is a calibrated fixed-answer model on TEXT. When a shift meets a decision with a fixed set of answers made on text — filing, triage, a yes/no over a receipt, a door in a road — it asks whether Jev is the better reader and uses it when the answer is yes. Every use: negative and positive controls before its verdicts count (law 2); a CHECK before a WRITE; never a rung or a road — those are his (the milestone gate). Cost is stated on the card. First use: the category reader for cards.

**#1210 (mood boards) is DEFERRED on his word, 2026-09-25 (terminal): *"lets defer this for now we can build it later"*. Off the ordered band (label roadmap). The design on the card is the spec when it returns; no shift takes it until he says so.**

## N2b IS A RUNG, ON HIS WORD (2026-09-25, terminal)

*"do we make it n2b or somthing?"* → *"agree with you"*: **N2b — Personality and voice are born at Sign, as editable text.** It sits after N2 and before N3. The label `rung:N2b` exists; the NEXT EDITION adds the ladder line (`server/crew/crew-briefing.json`, the N4b shape: key `N2b`, title *"Personality and voice — born at Sign, as editable text"*) so his page draws it. The milestone gate is unchanged: N2 closing does not start N2b; his word does, and it is on the card. Order: the persona-word retirement card ships first, the N2b card after it.

**A scoped standing approval, his word verbatim (2026-09-25): *"you have approval to run this act on my behalf no word required"* — for ONE act: dropping the `casting_candidates.personaLine` column once the code has stopped reading it.** The shift writes the migration and the ceremony (#1184's shape) and runs it on both worlds after the code ships, and names both worlds in the receipt. This approval does not extend to any other destructive migration.

**N2b DOES NOT START BEFORE N2 IS FINISHED — his word, 2026-09-25 (terminal): *"this doesnt start before finishing the n2 work right?"*.** #1242 is a rung card (label `rung:N2b` only; `founder-ordered` was removed because it would have put the card in NEXT UP tonight). N2 closes with its completion card and test-drive list; N2b opens on his word after that, never on the completion itself (the milestone gate). #1241 (the persona-word retirement) is upkeep and runs now.

**ONE BLOCK, TWO ROADS — his word, 2026-09-26 (terminal): *"why cant the realism block be the same as when casting a sheet?"* → *"yes"*.** A signed view sends the roll's own house sentences (realism, negatives, authority — the capture already is, #1215), derived from the same constants, plus its view-only lines. The legacy cohort blocks leave the view road; #1216 closed into #1240, which carries the court (four Sifr2 close-ups, old beside new, his eye). Letters are UNBANNED on views (his word the same night: the big generators do not ban letters, only marks). No other consumer of the cohort block moves under this.

## TWO BUILDER SEATS — CLAIM BEFORE YOU BUILD (his order, 2026-09-26: a second Opus seat works the background switches in batches, alongside the night shift, on its own tree). Before taking ANY card, both seats: (1) `gh pr list --state open` — a branch or PR naming the card means it is taken; (2) read the card's comments for a line starting `CLAIMED —` less than 12 hours old — taken; (3) otherwise post `CLAIMED — <seat name>, <UTC time>` on the card and only then branch. ⚠ HANDING A CARD BACK (#1701, 2026-10-02): the board reads the FIRST WORD of your comment and nothing else. Release it with `RELEASED — <seat>, <UTC time>`; refuse it with `NOT BUILT — <seat>, <UTC time>` then the file:line that disagrees with the card and why, and apply the `not-built` label. OPENING A PULL REQUEST IS NOT A RELEASE — a PR may be a half-finished slice, so a card you partly shipped reads CLAIMED for twelve hours until you write the word. `SKIPPED`, `WORKED`, `DONE`, `BUILT` are ordinary prose to the board and the fact is lost: 0 of 5 refusals on #1669 were seen and that one card cost seven seat sessions in a day. The tracked tools print this instruction (`crewCardHandbackInstruction`); this sentence is the orders naming it. Seat two never commits on the main tree, never touches `.agents/`, and ships one PR per card with a body that closes nothing.

## MULTI-SEAT RUNNER — HIS ORDER 2026-09-26, HELD ON EVIDENCE (#1281). Verbatim: *"if this is successful id like to have the crew be programmed to spinup multiple agents instead of 2 at a time to move through the workload quickly"*. The runner launches ONE shift per pass today (read at foreman-runner.ps1, a single synchronous `claude -p`). Card #1281 carries the design: N seats per pass on N worktrees, batches cut by AREA, the claim rule as the lock, park per pass, the relay still the only reviewer. It is `blocked` until the four hand-launched seats of 2026-09-26 have reported and their PRs are reviewed; the relay lifts the hold with the collision count and rework named on the card. No shift builds it before then.

## HIS RULINGS 2026-09-26 (terminal), verbatim: *"1294) delete them itself 1288) not sure what this mean or is? 1196) spend it 108)clear them"*. #1294: the team acts on the retention check's `expired` verdict by itself (hold lifted, build order on the card). #1196: the price court runs, house money, crew seat (hold lifted, now `casting-upkeep`). #108: the five held rows are cleared (hold lifted). #1288: he asked for a plainer explanation; it stays `blocked` until he answers.

## HIS RULING 2026-09-26 (terminal), verbatim on #1288's clause: *"i honestly dont think it's neccesary that line is really just giving you a rundown of the casting sheet you already can see your prompt"*. The "… were left to the roll" clause is RETIRED outright (card #1288 re-scoped, hold lifted); the #230 sentence and the follow lineage stay. PR #1320 closed unmerged.

## HIS ORDER 2026-09-26 (terminal), verbatim: *"work on 1094 and 1307 next so the desk shows whats built"*. Both `founder-ordered`; #1094 re-scoped (a card with an open PR, a refusal or a live claim is not on offer and the Desk says so — settles the #541 rule-3 question this card was held on); #1307 shape A first. Two relay-launched seats build them.

## HIS RULING 2026-09-26 (terminal), verbatim: *"i think opus 5 is comfrotable on more than 250 lines of code dont you?"* … *"drop it"*. The review triage's SIZE trigger is dropped. Held for the relay's verdict: money/auth and the review rules (unchanged) and, NEW, anything a customer sees (a `client/src` diff outside tests and admin — the relay's eye on the frames). Everything else merges on the gate plus the seat's own control and sabotage tallies. Card filed `founder-ordered`; stacks on PR #1325.

## HIS WORD 2026-09-26 (terminal), verbatim: *"keep it with you."* — the customer-visible eye (frames, both themes, before merge) stays with the relay, not the eye gallery. Queued PRs unaffected; the rule applies from #1328's landing.

## HIS RULINGS 2026-09-26 (terminal) on the roadmap list, verbatim on each card: #1210 keep deferred · #1161 defer · #14/#30/#26/#61/#64/#65 → rung:N3 · #15 defer beside #1210 · #60 closed ("you cant see the back of a cast") · #55 the relay builds an HTML page of loader designs on the refine's blurred-picture overlay, he picks · #801 → engines to GPT Image 2.5 Sunburst by default is a NOW job (#1340 founder-ordered); N3 keeps one question (iterations before degradation) · #1123 run the court (founder-ordered) · #180 N2 current work (founder-ordered) · #179 data ceremony approved without his word · #209 housekeeping · #509 current work (founder-ordered) · #706 keep deferred · #29 → rung:N8 · #1341 the panel's Build row text-only.

## HIS RULING 2026-09-26 (terminal), verbatim: *"i just adjusted thew ripple. its perfect now file it"* — the refine loader is board E ("her picture as dust": one real-stage bar, the stage word under it, no expected time, dust on her shape that never sits still, a ripple every 10 s, mouse scatter). #55 is `founder-ordered`; the spec and the mockup's source are on the card and in docs/specs/refine-loader-mockup/.

## HIS WORD 2026-09-26 (terminal), verbatim: *"can the crew launch multiple opus 5 agents now to handle more workload at once?"* — the hold on #1281 is LIFTED on the day's tally (8 seats, 26 seat PRs merged, 25 cards closed, 0 code defects found in review); `founder-ordered`. The six measured rules for the runner are on the card. MAX_SEATS = 4 (the measured number inside one account's API budget).

## HIS WORD 2026-09-26 (terminal), verbatim: *"it cant take stuff from next up ? why not?"* → the independence rule put to him → *"yes independent ones also. could jev help my crew out here at all? making decisions on batches or anything? or not worth it"*. RULED: the top Next Up card is the focus shift's alone, in his order; any other Next Up card may join a seat batch in the same pass if it is INDEPENDENT (cites no other open card as something it builds on, different area from the focus card and its batch-mates); dependent cards wait. Jev is the batch cutter's tie-breaker for two fixed questions (builds-on? yes/no; which area, from the Atlas's list) after the mechanical facts, controls first, 0.85 gate, low confidence → the smallest batch; Jev decides no priority. Both on #1281's build.

> ✅ **THE SIGN VIEWS STAY ON NANO BANANA PRO 2K — HIS EYE, 2026-09-27 (terminal),
> verbatim and entire: *"keep NBP 2k for signing views"*, on the sentence *"the
> detail on NBP 2k is more organic than sunburst high which is too smoothed
> out"*.** This closed the engine court (#1394) and SUPERSEDES his numbers-only
> word earlier the same day (*"sunburst high is what i choose"*), given before the
> frames reached his Desk. The judge has no texture axis; law 9. So: no Sign
> engine switch is built, #1373 closed as *keep 2K*, PR #1387 closed unmerged,
> and **#1278 part 2 builds on Nano Banana Pro 2K**. Sunburst stays the ROLL
> engine (#1340) — untouched by this. ⚠ PROVISIONAL the same hour — his word: *"actually i want one more test … test NBP and sunburst high on outfit creation"* (#1451, the outfit court). Nothing is built either way until his eye on THOSE frames. A shift that finds itself wiring Sunburst
> into the Sign road is working against his word.

> ✅ **THE SHEET COPIES THE PRODUCT'S VIEWS EXACTLY — his word, 2026-09-27
> (terminal), verbatim and entire: *"the sheet should copy the exact angles and
> camera views the current views use not invent new ones"*.** Said of #1278
> part 2 after the court's sheet arm rendered full-length profiles where the
> product ships head-and-shoulders profiles (*"the side view being cut from the
> sheet is the wrong camera view … i cant judge that"*). A sheet's views are
> composed FROM the existing per-view camera declarations; a cut view must be
> the same camera as the single it replaces. Any sheet render that invents a
> framing is against his word.

> ✅ **THE SIGN VIEWS MOVE TO GPT IMAGE 2.5 SUNBURST `high` — his eye on the
> outfit court (#1451), 2026-09-27 (terminal), verbatim and entire: *"sunburst
> produced the best result easily . i guess we will have to settle on sunburst
> high then and compromise on that additional detail from NBP 2k"*.** This
> SUPERSEDES the provisional "keep NBP 2k" above from the same morning. Build:
> **#1459** (founder-ordered, urgent, N2). The compromise is his and stated:
> less skin/hair texture than NBP 2K, accepted for the invented outfit. #1278
> part 2 builds on Sunburst high after #1459. No engine name reaches a customer
> path; no new flag — his word is the flip. Sunburst refusals on bare-skin
> wardrobe lines are #129's patrol, now live on the Sign road.

> ✅ **CASTING SHEETS ARE KEPT THIRTY QUIET DAYS, NOT SEVEN — his word, 2026-09-27
> (terminal), verbatim and entire: *"id like to keep casting sheets for 30 days
> also not 7 days"*.** Card **#1464** (founder-ordered, small-fix). One idle-clock
> constant (`CASTING_SESSION_IDLE_MS`, `server/db/castingV2.ts:44`) and its
> docblocks; no customer copy names the window; an expired sheet stays GONE as he
> ruled before. Live sheets get the new window by a one-off ceremony run by the
> relay unless he objects on the card. The discard clock is a separate question.

> ✅ **PATH E IS THE DESIGN FOR #1278 PART 2 — his word, 2026-09-29 (terminal),
> pasted design + two clarifications, recorded verbatim on #1278.** Close-ups
> on Nano Banana Pro 2K at once; in parallel one Sunburst high two-panel outfit
> plate (frontFull + backFull, the product's exact framings), split in memory,
> scratch only (NOT a wardrobe/library card — his engineer's advice); then
> frontFull/backFull on NBP 2K with master + plate panel as references; plate
> failure → master-only, Sign completes. **The delivered views go back to NBP
> 2K** (*"NBP2k was a better quality result"*) and **Sunburst stays only as the
> plate's engine** (*"only chosen because it was more creative in outfit
> design"*). #1459 is superseded inside E's PR, never reverted separately. No
> sheet cut-outs, ever. His eye on a real Sign's strip closes it.


> ✅ **N2c — SHOOTS — IS ON THE LADDER AFTER N2b, his word 2026-09-29 (terminal):
> *"add is as its own milestone N2c after N2b"*.** Card **#1469** carries the
> design/eng brief (Yuna + Squall, Approach A: `cast_collections` many-to-many,
> chips All · Unfiled · shoots · +, cursor pagination replacing the cap of 60)
> and his four rulings on the relay's notes: Unfiled hidden until a shoot
> exists (and no post-Sign prompt for an account with no shoots); search copy
> honest about what is searched; **a shoot is the production unit the cinema
> studio will open, a script and its cast**; the strip's copy says thirty
> days. THE MILESTONE GATE APPLIES: N2c opens on his word after N2b closes;
> the crew never starts it on its own.

> ⚠ **PATH E AMENDED THE SAME DAY — his word, 2026-09-29 (terminal), verbatim and entire: *"no the plate must reference the master image otherwise it wouldnt be able to invent the outfit correctly"*.** The plate is drawn FROM THE MASTER on Sunburst's edit door (the #1451 road), never from words alone. #1471 (urgent, founder-ordered) corrects PR #1470's words-only plate; everything else in path E stands.

> ✅ **N2c's NOUN IS CAMPAIGN, NOT SHOOT — his word, 2026-09-29 (terminal), verbatim and entire: *"in n2c instead of calling them shoots call it Campaign"*.** Card #1469 carries the ruling; copy, chips, empty states, the post-Sign prompt and the code's own names all say campaign. A campaign is the production unit the cinema studio will open (a script and its cast).

- 2026-09-29 (terminal, his "yes."): N2c also builds the cast page's IN CAMPAIGNS panel (memberships by name + one add row) and removes the "Cast in a campaign · soon" header button. Quoted on #1469.

- 2026-09-29 (terminal): #1478 ruled **A** — Sign names which version it is about to sign, with the picture, before the spend. His words on the card.

- ⚠ **FOUNDER-URGENT, 2026-09-29 (terminal, verbatim: *"file it urgently we need to increase through put"*): #1496** — the seat cut holds every rung card for the focus lane (`seatBatches.mts:593`), so four builder seats sit idle while the N2 backlog serialises through one agent. Offer a rung card to a seat ONLY when its rung equals the focus card's rung (N2 today, derived from #180's label); N2b/N2c/N3+ stay held — THE MILESTONE GATE HOLDS. Independence + area gates stay. Takes priority over the ordered band until merged.

- 2026-09-30 (terminal, his "go with 1"): every Desk reply is mirrored onto its GitHub card the moment it is sent, verbatim and once, so his GitHub-reading agents see it instantly. Founder-ordered; card filed by the relay. The Desk stays the one place he types.

- 2026-09-30 (terminal): the founder's Grok team (project manager, engineering agent = standing watcher, Terra = weekly research) posts proposals to HIS NOTION DESK, never to GitHub; only what he approves lands on the crew's desk, opening "Approved by Michael on the Notion desk, <date>", labelled `research`. Rules and four defaults recorded on #1465. The engineer files or comments, never merges, never verdicts, never replies on the Desk.

- ⚠ **FOUNDER-URGENT, 2026-09-30: #1541** — the seat gate reads the milestone off the FOCUS CARD's rung, and #1467 (founder-ordered, no rung) on top of the band nulled it: `seatCount 0` at 22:44Z, every N2 card held. Read the focus rung from the band's milestone cards (lowest rung among founder-ordered rung-carrying cards), never from the top card; fail-closed only when NO rung exists anywhere. His throughput order (#1496) stands; this is its repair.

- 2026-09-30: his `SENTRY_AUTH_TOKEN` is on the Drape service (relay read name+length only). #1420 part 1 (source-map upload under the browser release) is buildable now — founder-ordered as the last part of that card; the token never lands in the bundle, a log, or the repo.
- 2026-09-30 (terminal, his question on #1548): CORRECTION — an approved Notion proposal he wants built is filed as ORDINARY work (bug/feature + area + done-when, founder-ordered when he wants it now), opening "Approved by Michael on the Notion desk, <date>", with NO `research` label; `research` marks proposals and findings only and is never work (#1548).

**A RUNG LABEL ON A `bug` OR `small-fix` CARD IS A LOCATOR, NOT A HOLD — and until the gate reads it that way, DO NOT PUT ONE ON (the relay, 2026-09-30).** The seat gate (`rungHoldFor`) holds every rung-labelled card that is not the focus rung, so a fix to a live surface filed with `rung:N6` sat unbuildable under the milestone gate: #1420 (his Sentry token added for it that morning), #1537 (a live door on a dead engine), #1542 (a tracker that says it reports and never has). MAINTENANCE MODE says fixes to live behaviour run with no focus. Rung labels removed from those three by hand; the gate defect is its own card. A shift filing a bug names the territory in the body ("N6's territory") and leaves the rung label off until that card ships.

- 2026-09-30 (terminal): ONE ADDRESS FAMILY — his word (*"yes i want that shape"*): the signed-in product lives under `/app/…` — `/app/casting`, `/app/canvas`, `/app/library`, later `/app/cinema` — because the marketing site owns the domain root. Old addresses forward, never 404. Card #1583.

**A DESK QUESTION IS 160 CHARACTERS, AND THAT IS NOT THE PAGE'S FAULT (the relay, 2026-09-30, on his second complaint in one day: *"this has landed back on my desk still truncated"*).** `CREW_HOLD_REASON_MAX` is 160; the page shows that much of a card's `**Waiting on:**` line and an ellipsis. A shift writing a 300-character question has written a question he cannot read. The line carries the options in capitals and the recommendation in four words; the argument goes in the body below. Count before posting. And a question that turns on a picture ships WITH the picture on the Desk (an eye item in the edition), or it waits for the edition that has it — a card that says "look at the frames" with no frames on the page is the silence direction.

- ⚠ **2026-09-30 (terminal): PRICING PHASE 1 IS FOUNDER-ORDERED AND IS THE NEXT FOCUS AFTER N2 — his words, verbatim: *"ive approved it. when it land you sort out the best place to put it"*, said of the Notion page "Klieg pricing & credits: final proposal" (rev 21.6, Squall-checked, maths re-derived by the relay and reconciled).** It is NOT N2d — on the relay's recommendation and his acceptance (*"after N2c? it could be N2d? thoughts?"* → a rung of its own, queued now): a rung of its own, held by the seat gate until N2 closes, then started with no further word from him. Every card under it is a MONEY surface: held for the relay's hand verdict, none merges on the gate alone. Scope = the page's Phase 1 ONLY: one shared display helper (display = ledger ÷ 5; prices round up, balances and refunds round down; the ONLY source of any credit number a customer sees — Stripe `credits_display` is a checked reference, never read by a screen); the new price table in ledger units (Roll 1,200 / Follow 1,600 / Sign 8,500 / Refine 1,750 / Try again 1,750; Sign split 3,500 + 5 × 1,000; Roll 8 × 150, Follow 8 × 200); `PLAN_TIERS` to the new amounts and the one-time free grant 13,500 with EVERY existing free account raised to it (his "yes"); the free grant on a verified email or Google sign-in — NO card, NO phone (his ruling) — guarded only by QUIET limits (grants per device/network, daily free face-scan cap); NO WATERMARK (verbatim: *"i dont think we need to add the water mark i hate water marks"*); the renewal fix so purchased credits are never overwritten; checkout on Stripe lookup_key prices (yearly read from Stripe's whole-dollar `unit_amount`, not `annualBilling.ts`'s cent rounding); the top-up checkout (plan holders only, 0.24¢); the `retry settled` log line (monitoring only). Loyalty (monthly +5/+10/+15%, no yearly bonus), buckets and top-up expiry are Phase 2 — a later rung, not this one. Prices stay USD; Stripe fees on the AU schedule. Live-mode Stripe objects and Railway variables are his or the relay's hand, never a shift's. The Notion-filed card lands on GitHub from his side; the relay labels and cuts the Phase 1 cards from it.

- ⚠ **2026-09-30 (terminal): THE VIEW CHECKER MEASURES FRAMING AND ONLY REFUSES ON IDENTITY — #1612, founder-ordered.** His question on #1611, verbatim: *"dont you think having really strict checkers is unreliable?"*; on the relay's two changes, verbatim: *"i agree with you"*. The four same-day measurements (#1582 three eyes refused; #1594 neck ink outside the crop refused 25/25; #1595 "cannot compare" 1-in-5 on a correct close-up; #1611 a too-loose close-up passed 50/50) are one class: a vision model reading a two-part prose rule answers the easy half. The repair is NOT another rewording (three were courted on #1582 and each broke a correct picture): (1) every framing band is MEASURED from the segmenter's boxes against the view's declared landmarks (the fidelity law — `fal-ai/sam-3/image` is already in the tree); (2) an unsure or failed framing/wardrobe verdict DELIVERS the view charged and unchecked with the free Try again, and ONLY the identity axis keeps fail-closed refusal. #1594/#1595/#1611 are held on #1612 as its BEFORE arms; no seat rewords the judge's sentences for them. Money surface (refund paths): every PR held for the relay's hand verdict; his eye closes it.
  - **Part 3 of #1612, his addition the same sitting, verbatim:** *"yes the prompt should be explicit to the image engine that the reference is merely a reference . i'd like to see a court of it against our improve checker we just dicused"* — a stored NEUTRAL framing reference per view (never a real face) attached to the view render, the prompt stating it is a framing reference only, courted template-vs-none under the MEASURED checker (part 1 first, because it is the instrument). Price and latency beside the finding; his eye closes it.

- ⚠ **2026-10-01 (terminal): THE ORDER AFTER N2 IS PRICING FIRST, THEN N2b, THEN N2c — his word, verbatim: *"after n2 is wrapped up start the pricing/money work then proceed onto n2b and n2c"*.** This supersedes the 2026-09-30 placement of P1 behind N2c. The ladder reads N2 → P1 → N2b → N2c → N3…; the seat gate follows the ladder's `current` rung. N2 wraps on its completion card (THE MILESTONE GATE); P1 then opens with no further word from him — that word is given here.

- ⚠ **2026-10-01 (terminal): A BUG JUMPS THE QUEUE ONLY WHEN A CUSTOMER CAN HIT IT — his *"i like your idea"* on the relay's proposal, after seven self-filed tooling bugs (#1620…#1638) ran all night while N2 waited on him.** A `bug`/`small-fix` about `scripts/`, `server/testing/`, `.github/`, `docs/` or `*.test.*` only is TOOLING and waits behind the focus like a switch card. Built by #1647. **AND P1 IS HELD TO ITS TEN CARDS (#1600–#1609):** anything found while driving pricing that is not one of the ten is a bug card with NO rung label, offered only if a customer can hit it; P1's completion card is filed the day the tenth card merges, not the day the last question is answered. (N2's lesson: 21 cards of flag work became 61 because every finding was filed into the open focus.)

- ⚠ **2026-10-01 (terminal): A MANAGER SEAT RUNS BEFORE THE CUT — #1658, founder-ordered, `order:1`, NEXT.** His question, verbatim: *"it seems it would be more intelligent if an ai agent had full overview of the current open cards etc and then could batch and launch shifts?"*; his choice between his engineer doing it and the crew building it: *"you code it into the crew so an opus manager runs and checks them all before the cut is made"*; on an outside checker for it: *"i dont really think my engineer needs that job opus 5 is really smart already and it lives within our codebase so it would be difficult to get somthing wrong"*; and the priority: *"I want the filed urgently like next we cant keep guessing things."* The shape ruled: an Opus manager session, read-only, launched by the runner at the start of every pass, writes a stamped fact sheet (dependencies, area, collisions, readiness, batch hints, one checkable reason per row) that the cutter consumes in place of phrase-matching and filename guessing; the walls stay in code and outrank the sheet (`MAX_SEATS`, the ladder's rung, his switches, the holds, the money review); a missing or stale sheet leaves the cut exactly as today. The manager never launches, never chooses seat counts, never edits. It carries no rung label and is not one of P1's ten. (Found while answering *"how come the shifts have only been launching 1 session at a time lately"*: the pool read 0–3 takeable cards per pass since 27 Sep; all seven P1 cards held every pass on the bare *"Parent: #1598."*; the cutter's focus card read #1469 for 17 passes — #1656.)
  - **Closed 2026-10-01 on his word, verbatim: *"if they read correct to you they are correct to me."*** (the relay's read of the manager's P1 rows was the last done-when). **On the manager's cost, his ruling the same sitting, verbatim: *"dont worry about the managers cost if its on my subscription its fine"*** — it runs on his claude.ai sign-in, pinned to `claude-opus-5` (his *"ensure its running opus 5"*); the per-pass `costUsd` on a plan is the CLI's API-equivalent estimate, never a bill, and is not reported to him as spend. The latency levers (reuse an unchanged sheet; cards past the walls only; one full read a night) are a later improvement, not a decision he owes.

- ⚠ **2026-10-01 (terminal): THE PLAN LADDER IS ADOPTED — his finance guy's volume-discount ladder, handed over by him, with his own rounding; prices unchanged; founder-ordered on #1602.** Display per month Starter 14,000 · Pro 36,000 · Studio 86,000 · Business 470,000 · Scale 2,750,000 · Enterprise 8,700,000 · Ultimate (hidden) 28,000,000 → ledger ×5: **70,000 · 180,000 · 430,000 · 2,350,000 · 13,750,000 · 43,500,000 · 140,000,000**. The relay verified credits-per-$ strictly increasing at every rung (518.5 → 583.3, exact figures). **Starter is cut** (75,000 → 70,000), superseding "starter unchanged" — his word: *"no paying customersd are on a plan so im not worried about starter."* Free stays 13,500 once. **Paid Try again 350 → 370 display (1,850 ledger)** — on #1601. **The repaint renders at MEDIUM quality, no court** — his word, verbatim: *"Repaint to medium quality just do it without a court because i checked the rolled casts they are already medium and the quality is good"* (PR #1691, the relay's one-word change with a wire arm; the wardrobe plate stays high). **Refine-cost investigation is an N3 card (#1689)** — count the checks, court the fewest, report cost per Refine, no price change there. **Sign-cost research is a roadmap card (#1690)** — his word *"no build now"*.

- ⚠ **2026-10-01 (relay's decision, #1698): P1's SCALE CHANGE LANDS AS ONE PULL REQUEST, NEVER PIECEWISE.** Production deploys on every merge, so the client routing (#1697), the price table (#1601 item 1), the free grant (#1682) and the plan grants (#1602 slice 2) merged one at a time would put three wrong-looking states on production (a Roll at 32, then 1,200 at the old scale, then 84 Rolls for a free account). The relay cuts `release/p1-scale` from main when all four branch PRs are green on their own heads, merges the four into it, opens ONE PR, one verdict, one merge; the branch PRs are closed unmerged afterwards naming the release squash. No flag (a one-flip switch on a money path read by four modules is the drift this repository has paid for); no back-to-back merging (three gate runs and three deploys is forty minutes of wrong prices, not five). #1609's go-live steps run after that merge.
  - ⚠ **2026-10-02 (terminal): ADD CREDITS IS DESIGNED AFTER HIGGSFIELD'S TOP-UP PAGE, IN OUR OWN LANGUAGE — his word, verbatim: *"for our add credits we should be inspired by how higgsfield does it but obviously in ur own design language … they have a slider also."*** Translated on #1606 (the brief the shift reads): one surface with *Change plan* / *Add credits* tabs; the three packs biggest first, each saying what it buys in Rolls and Signs at the live prices (derived, never typed); a 5,000-step slider charged as the 5,000 pack's Stripe price with quantity; one *Best value* badge only when rates differ; the credits-per-dollar chip; the honest *a bigger plan gives more for the money* nudge instead of a discount banner. NOT copied: engine names in what a pack buys (the disappearing-technology law), struck-through prices, a top-up discount for plan holders (plans are the better value by the ladder), *valid for 90 days* (purchased credits never expire here). Also his word the same hour: *"skip mine and run it for the three"* — the free-account raise ran for three team accounts, his own left at 9,290 by choice.
  - ✅ **LANDED 2026-10-01 17:34Z — release PR #1706, squash `143e5b30`, LIVE on production at 17:37Z.** Four branch PRs (#1682, #1704, #1700, #1697) closed unmerged naming the squash; the merged tree ran 925 files / 15,841 tests green before push. The relay's eye read every surface in both themes by pixel sample and content; the boards canvas has a single look regardless of theme (filed #1707). #1609 receipts: step 1 (6 accounts, all free, no subscriber), step 4 dry run (4 accounts to raise, 36,360 ledger; the `--apply` is his ceremony), step 7 health line; the production frames on his own account and the Stripe live-mode steps are his hand.

## HIS RULINGS 2026-10-02 (terminal), verbatim. (1) On #1709's open question, a browser-render stage in CI: *"no browser stage in ci for now"* — the import-based guard stands as that card's rendered arm; no gate stage is filed. (2) On #1699 and the Roll/Follow price split, after the relay's reading (a roll costs us ~$0.12 in engine time and earns ~$0.45 at 240; a follow ~$0.32–0.52 and earns ~$0.60 at 320; one price means rolls subsidise follows): *"go with your reccomendation on the roll and follow one price is better and we earn more for rolls simple"* — ONE price for a Roll and a Follow, read as the Follow's 320 display (200 ledger a candidate, 1,600 a sheet) applied to both, so a roll simply earns more; the sheet's one price line stays one number said once, #1699's four options are moot, and the "A roll costs N credits" refusal needs no second noun. Filed as its own money card; #1699 closes on it.
- ⚠ **2026-10-02 (terminal), the top-up ladder — his word, verbatim: *"i prefer your reccomendation . my team cant make physical adjustments to stripe as they have hit credit limit cap. Are you able to do it for me"*.** Three packs plus a 5,000-step slider on a volume ladder: the unit is 5,000 display credits, priced **$12 / $11 / $10 per unit** in the brackets 1 · 2–4 · 5+ (packs 5,000 = $12, 10,000 = $22, 25,000 = $50; 417 · 455 · 500 credits per dollar, every one below Starter's 519 so the plan nudge stays true). This supersedes #1606's flat $12/$24/$60. The Stripe objects are his keystrokes (the relay's tooling refuses real-world transactions and production reads); the exact commands and the script are on #1606.
- ⚠ **2026-10-02 (terminal), PRICING PHASE 2 ORDERED AS A BRIEF — his word, verbatim: *"i think we should also re-design our plans like higgsfield does e.g 3 individual plans the biggest one has a slider for credits and we need way better copy based on future development not just what exists today. we dont need to show $1 per credit on our plans here its better shown on the adding of credits design. our bigger plans could be business plans priced per seat … anything really high would be a sale department chat … our compare features needs a way better design"*, then on the relay's reading: *"yes i like this"*.** Filed as #1774 (design-first: three individual plans with a 5,000-step credit slider on the top one; Team per seat ONLY behind a workspace feature, filed and sequenced first; Enterprise as a sales conversation; no rate chip on any plan card — #1773 widened the same hour on *"on the free card remove the free CREDITS PER $1 line thats stupid"* and his yes; copy about the maker and the work with anything unshipped marked *coming*; a compare table organised by what a customer makes, no model names). THE MILESTONE GATE holds: design may begin, no Phase 2 BUILD until Phase 1 (#1601, #1606, #1609) closes and he sets the focus.

## HIS RULINGS 2026-10-03 (terminal), verbatim, each recorded on its card the same hour. #1806: *"this is my engineers account"* — the second admin is his engineer's; closed. #1805: *"add the gate step"* — the dependency-advisory read becomes a gate step; founder-ordered. #1807: *"ignore small days"* — the generation-rate alarm judges no rate below a measured sample floor; founder-ordered. #1612 eye items: *"stop the example, sifr2 right hand pcitrue looks like a closeup to me."* — part 3 (the stored framing example for the generator) is STOPPED; his eye calls the 0.42 picture a close-up, so the close-up band's 0.30 line is too tight — it moves only after he says whether today's 0.51 picture also reads as a close-up. #1774: *"frames right numbers right"* — the Pricing Phase 2 brief is approved as the spec (Studio slider $9 per 5,000 credits; Team $68 a seat); the BUILD waits on his focus word under THE MILESTONE GATE.
- ⚠ **2026-10-03 (terminal), three more of his words, each on its card the same hour.** #1785: *"1758) seal."* — the canvas Refresh road that charged 70 credits for a render on a shut-down engine is SEALED; founder-ordered. #1612's second eye item: *"on Sifr2 Yes it reads as a closeup."* — both Sifr2 pictures (0.51 today, 0.42 with the example) are close-ups to his eye, so the close-up band's 0.30 line is wrong and moves above 0.51 by measurement (#1837, founder-ordered); the framing example (part 3) stays STOPPED. #1690: his Sign-cost idea verbatim — *"continue to generate the outfit plate with GTP Image 2.5 (MEDIUM QUALITY) and then use it as a reference for a NBP 4k character sheet which gets cropped into the views"* — becomes arm B of the Sign-cost COURT (A today's road, C the sheet without the plate), on his fixtures through the real Sign entrance, his eye closing it; his *"no build now"* of 2026-10-01 still binds the BUILD, and a court is a measurement that runs beside P2 unless he says stop.
- ⚠ **2026-10-03 (terminal), the Sign-cost court — his word, verbatim: *"do a small court first and put it on my desk if im happy i can say build it"*.** #1690 is the court and is on offer: three of his casts, Arm A today's road against Arm B (plate on GPT Image 2.5 medium → one NBP 4K character sheet cropped into the five views), through the real Sign entrance, cost and wall time beside quality, the strip to his Desk as one eye item; *"build it"* cuts the build card. His earlier *"details per view is not an issue we already measured this before im happy with it"* stands as his eye's word; the relay found no record of that measurement in the tree and said so on the card.
