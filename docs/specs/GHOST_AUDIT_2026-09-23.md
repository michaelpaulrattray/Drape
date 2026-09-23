# THE GHOST AUDIT — old-lane machinery still running under the author road

**Card #180** (N2, the current focus). **Founder's flag, verbatim (terminal, 2026-08-27):**
*"one thing worth noting or checking when we move into n2 (not now) is that its probably
running on categories like the old lane did? not sure if its relevant to the new prompting
style etc worth looking into so we dont make the same follow mistake"*

Run 2026-09-23 (foreman-20260923-1542), read at `origin/main@272392db`. Every row below was
read at the code, not carried from a document (law 7c); the one behavioural claim is
**driven** rather than reasoned (law 7b), and its driver is named where it is made.

---

## ⚠ THE SENTENCE THAT REFRAMES THE WHOLE CARD, AND IT WAS MEASURED FIRST

**The author road runs for exactly ONE account. For everybody else the "old lane" is not a
ghost — it is the product, and every one of its records IS sent.**

`CASTING_CREATIVE_REGISTER_SCOPE=users:1`, read off the live service on the deploy receipt
`output/deploy-receipts/2026-09-23T05-24-42-532Z-22668.txt:58` rather than off the record
that predicts it. So this audit answers two different questions at once and must keep them
apart:

- **On his account** (the author road) — what is still written, and who still trusts it?
- **On every other account** (the house road) — nothing here is a ghost yet, and the
  machinery below becomes one the moment N2 widens the flag.

**That is why this table belongs to N2 rather than to a cleanup pass.** A row marked *dead on
the author road* is not a deletion authority today; it is the list of what stops being true
when the flag goes home.

---

## THE METHOD, AND THE ONE LINE IT ALL TURNS ON

The author road composes **one** prompt for all eight slices, and `promptAuthor.ts`
(`composeFinalPrompt`, L325–347) says exactly what is in it:

```
her brief, verbatim
  + the dentition clause   (only when her words name fangs, #599)
  + the family clause      (only on a follow, #154)
  + the locked house block (the style's and the lane's)
```

**Nothing else reaches the engine.** So the test for every field the compile still populates
is mechanical: *is it in her brief (SENT), is it something she typed that we merely recorded
(STATED), or was it ROLLED?* A rolled value with a consumer that treats it as a fact about
the delivered picture is the #176 class — the founder followed a Mediterranean-looking man
whose record claimed South Asian heritage.

---

## THE TABLE

*sent?* is **on the author road**. On the house road every row is sent, which is the point of
the section above.

| field | written by | sent? | consumed by | verdict |
|---|---|---|---|---|
| `intent.role/sex/ageBand/agePhase/heritage/build/energy/archetype/look` | the reader, from her words (`interpreter.ts` SYSTEM_PROMPT: *"extract only what it actually says"*) | **yes** — her brief travels verbatim | chips, `statedAnchorFrom` (the follow's honest source), `lockFactsOf` | **honest record** |
| `intent.role` **when promoted** | `promoteStatedRole` (`heritagePromotion.ts:123`) — sets it to the brief's own first 80 chars | n/a — it *is* her brief | `readBriefFacts` → the sheet's echo sentence | ⚠ **FICTION CONSUMER — see finding 1** |
| per-slice `resolvedIdentity` (the dice) | `resolveSheet` | no | every reader goes through `readResolvedIdentity`, which refuses `unsent: true`; Sign gates independently on BOTH the mark and the roll's register kind | **correctly fenced** (#176). Residual: rows written before the mark — **#179** |
| `personaLine` | `personaLineFor` | no | nulled on this road (`briefCompiler.ts:1376`); the tile draws its index label | **fixed** |
| `intent.reads` (8 tile captions) | the reader | no | `personaLineFor` only | **dead on the author road** |
| `intent.composedDirection` | the reader, as composed prose | no | `cohortPhotorealHuman.ts:2715` → the unsent per-slice prompt | **dead on the author road** — and it is why the reader's token ceiling was raised 1200→1800 (`interpreter.ts:1203`). See finding 2 |
| `intent.poolTendencies` | the reader, **inferred from the category** | no | the dice + `avoidFamilies` | **dead on the author road** |
| `intent.variationAxis` | the reader, as a judgement | no | the dice, the axis registry's selector — **and `promoteStatedRole`**, which is finding 1's trigger | **dead except through finding 1** |
| `compiledBrief.archetype` (the **rolled** one — `resolveArchetype` falls back to `ARCHETYPE_KEYS[hash(seed) % n]`) | `briefCompiler.ts:1293` | no | **nothing, anywhere** — no reader outside the compiler | **dead** |
| `variance` → projected as `varianceHeld` | `resolveSheet` | no | persisted **and projected to the client**; the only surface that drew it was killed by #166 | **dead on the wire** — see finding 3 |
| `chips` (up to 12) | `buildChips`, twice per compile | no | projected as `roll.chips`; **no castingV2 client surface reads it** — the sheet uses `facts` | **dead on the wire** — see finding 3 |
| `cohortKey` | `intent.cohort` — names the *adapter* that resolved the record | no | copied onto the Cast at Sign; not projected, no reader found | **honest record, no consumer** |
| `LOOKS` / `ARCHETYPES` / `ENERGIES` prose tables (thesis / avoid / whisper) | hand-written constants | no | only `cohortPhotorealHuman`'s per-slice prompt | **dead on the author road** — a `look` override would append the four words *"A `<look>` look."* and none of the table's prose (`shared/briefRewrite.ts:249`) |
| the echo's pickers (sex, age, heritage, build, energy, look) | `BriefEcho` | — | **drawn not at all** on this road (#535's read-only ruling); `rollAdjustments` returns `{}` (`chipEdit.ts:92`), so `input.overrides` is always empty and `register.rewrites` never rides a new row | **correctly absent** |
| `validateLocks(locks, resolvedIdentity)` | `briefCompiler.ts:1383` | — | runs over the **unsent** dice | ⚠ **inert on the author road — see finding 4** |

**This list is a FLOOR, not a complete population.** It was produced by reading
`briefCompiler`, `promptAuthor`, `cohortPhotorealHuman`, `castingIntent`, `rollProjection`,
`rollService`, `signService`, `heritagePromotion`, `axisRegistry`, `refineSubjects`,
`wardrobeCards`, `briefRewrite`, `chipEdit` and `BriefEcho`, and by grepping each field name
across `server/`, `client/` and `shared/`. No derived list stands behind it, so it is honest
work and not a proof of completeness (the sweep-remainder rule).

---

## FINDING 1 — HER OWN SENTENCE IS SHOWN BACK AS HER CAST ROLE, CUT MID-WORD

**This is the only customer-visible defect in the audit, and it is on BOTH roads.**

`promoteStatedRole` fires when the reader set no role and `variationAxis === "look"` — which
the reader is instructed to set for *"a model, editorial, fashion, runway, beauty or campaign
casting"*. It then sets `intent.role` to **the first 80 characters of her own brief**, at a
word boundary, so that the `CASTING CATEGORY` block has something to say.

Two things follow that nobody joined up:

1. **The author road never composes a `CASTING CATEGORY` block at all**, so the promotion's
   entire purpose is absent there — the only effect it still has is on what she reads.
2. `readBriefFacts` projects `intent.role` with a bare `.slice(0, 60)`
   (`rollProjection.ts:313`) — **no word boundary** — and `BriefEcho` renders it as
   *"Everyone on this sheet is cast as …"* at full ink, deliberately not adjustable.

**Driven, not reasoned** (`scripts/_180-promoted-role-disposable.mts`, the two real functions,
no network, no spend):

```
brief : "a beauty campaign casting, luminous skin, wide-set eyes, cropped platinum hair, strong brows"
shown : "a beauty campaign casting, luminous skin, wide-set eyes, cro"
```

So the sheet tells her: **"Everyone on this sheet is cast as a beauty campaign casting,
luminous skin, wide-set eyes, cro"**.

The echo's own docblock argues the case against itself: *"the category is not the user's
sentence, it is the single fact the compiler treats as ABSOLUTE"*. On a promoted role it **is**
her sentence, truncated twice — and his #534 ruling already covers the shape: *"I made the
change, I don't need it repeated."*

`heritagePromotion` had already fixed exactly this bug once, at 80 (*"truncated mid-word,
which reads as a typo"*); the projection re-cut it at 60 and the fix did not travel. That is
the *correction reaches copy, not source* class.

**Carded: #1122.** Three roads, and the choice is his because the third is a product one:
(a) cap the projection at a word boundary — strictly better, fixes the typo, keeps the echo;
(b) do not promote on the author road — the block it feeds is not composed there;
(c) do not project a promoted role at all — his #534 ruling's direction. **Recommendation: (a)
now as the bug fix, (c) as the right answer, and (b) falls out of N2's retirement anyway.**

## FINDING 2 — THE READER IS STILL ASKED FOR FOUR FIELDS THE AUTHOR ROAD DISCARDS

`reads`, `composedDirection`, `poolTendencies` and `variationAxis` have, on the author road,
no consumer but the unsent dice (`variationAxis` excepted via finding 1). The reader's system
prompt is one constant asked identically on both roads, and `composedDirection` alone is why
its token ceiling went 1200 → 1800.

**This is NOT a "delete the fields" card, and that is the whole point of filing it as a
court.** His own measured law — *context is not additive* — says a SUBSET of prompt context
once raised the stage wall twice as often as its superset. Trimming what the reader is ASKED
can move the answers to the fields that are KEPT: the sex, the age, the heritage she typed.
So the question is a measurement, not an edit.

**Carded: #1123**, `awaiting-fable` — designing the arms of a court whose result changes what
he judges is judgment-class under #541 rule 3.

## FINDING 3 — TWO FIELDS CROSS THE PROJECTION BOUNDARY WITH NO READER

`roll.chips` (computed twice per compile, up to 12 entries, validated on the way out) and
`roll.varianceHeld` are both projected to the client and **neither is read by any castingV2
surface** — the sheet draws `facts` instead. `varianceHeld`'s only consumer was the
expression-only confession line the founder killed in #166; its docblock says the flag is kept
deliberately so a future surface has its evidence, which is a fair argument for keeping the
PERSISTED field and none at all for keeping it on the wire.

Small, no customer impact, no urgency. **Carded: #1124.**

## FINDING 4 — THE LOCK VALIDATOR CANNOT FIRE ON THE ROAD HIS ACCOUNT USES

`validateLocks(locks, candidate.resolvedIdentity)` is the guard that the sheet honoured the
facts she pinned. On the author road it is handed the dice — the records the compiler has just
marked `unsent: true` — so it is checking the house resolver against itself and can say
nothing at all about the eight pictures that were actually painted. It is invoked, it is
green, and it is inert: invariant 7's shape without a missing call site.

The same gap has a sibling. `sweepComposedPrompt` — the unowned-axis sweep, built after the
founder's eye caught that class **five separate times** — keys on a per-candidate composed
prompt, and the author road composes none. It is called only from its own suite, which is
correct for a contract test, but it means the class has no author-road arm.

Neither is a bug today: on the author road there is genuinely no per-slice composition to
check, so the honest statement is that **the verification the house road had has no author-road
equivalent yet**, and N3's detector (#30) is where it belongs.

**Carded: #1125**, and cross-linked to #30 rather than duplicating it.

---

## THE TWO-PATHS ROWS — WHAT #203 ASKED THIS AUDIT FOR

#203's body asks this table to *"verify nothing still branches on `path`"* before the
retirement cuts. Read at the code:

**Nothing branches on `path` in a way a customer can see, and the reason is deliberate and
argued out loud.** On the author road `bornPath` is `null` (`rollService.ts:630`), so every
roll is `unpathed`, and `unpathed` is handled by **three separate questions with two opposite
answers**:

| question | function | answer for `unpathed` |
|---|---|---|
| may the model be SHOWN this subject? | `subjectServedOnPath` (`refineSubjects.ts:288`) | **no** — which keeps the prompt byte-identical for every roll in production |
| does this path REFUSE her ask? | `pathRefusedNounIn` (`refineSubjects.ts:318`) | **no** — *"a path nobody chose is not a path that refuses"*; the door returns `null` before it opens |
| does the panel draw a wardrobe SECTION? | `wardrobeSectionServed` (`wardrobeCards.ts:189`) | **no** — a card whose every road ends at a wall is a dead end wearing a tap target |

⚠ **That asymmetry is the retirement's landmine and it is the most useful thing this audit can
hand #203.** The second question was once implemented by reusing the first, and that defect
would have turned *"put her in a long black coat"* into a Basics refusal **for the whole
customer base** — caught only by a positive control in `stageWallBackstop.test.ts`. A
retirement that collapses `path` to one value must re-answer all three questions
independently, in writing, or it will reintroduce that bug in the opposite direction.

Recorded on #203; nothing was changed here.

---

## WHAT THIS AUDIT DID NOT COVER

- **The refine road.** His own timing correction (2026-08-28) puts that half at N3's opening
  act: *"the REFINE-ROAD half re-runs as N3's OPENING ACT"*. The rows above touch refine only
  where a roll-time field reaches it.
- **The legacy studio** (`server/casting/`, `features/casting/`) — a different lane, retired
  by #29, not this card's class.
- **A derived population.** See the floor note under the table.
