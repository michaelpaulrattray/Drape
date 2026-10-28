# THE GHOST AUDIT — old-lane machinery still running under the author road

**Card #180** (N2, the current focus). **Founder's flag, verbatim (terminal, 2026-08-27):**
*"one thing worth noting or checking when we move into n2 (not now) is that its probably
running on categories like the old lane did? not sure if its relevant to the new prompting
style etc worth looking into so we dont make the same follow mistake"*

Run 2026-09-23 (foreman-20260923-1542), read at `origin/main@272392db`. Every row below was
read at the code, not carried from a document (law 7c); the one behavioural claim is
**driven** rather than reasoned (law 7b), and its driver is named where it is made.

> ⚠ **STOP — READ THE LAST SECTION OF THIS FILE FIRST, *THE RETIREMENT SHIPPED,
> 2026-09-30*, THEN *THE RE-READ, 2026-09-26* ABOVE IT. EVERYTHING BEFORE THOSE TWO IS
> HISTORY.** The retirement this audit was written to enumerate HAS HAPPENED — his word on
> #1398 (*"Delete it"*), shipped across six commits between 27 and 29 September — so a shift
> opening this file for a deletion to make will not find one; the closing section says what
> #180 still owes instead.
>
> ⚠ **AND THE RE-READ IS ITSELF SUPERSEDED IN ITS OWN CLOSING SECTION**, which says in bold
> that the retirement *"has not been asked for"* and *"CANNOT START TONIGHT"*. Both died about
> nine hours after they were written. `CASTING_CREATIVE_REGISTER_SCOPE` went to `all` on **2026-09-24**,
> one day after this audit ran, so the section immediately below — the one this whole
> document turns on — is FALSE, and **ten of the rows in the table have moved**. Two of
> them now read as deletions and are load-bearing. The re-read says which, with the
> production row counts and the `file:line` of every surviving reader.
>
> ⚠ **AND THE REFINE-ROAD HALF IS AT THE FOOT, ITS OWN SECTION — *N3, 2026-10-15*
> (#1577).** It is an enumeration with proposed slices; nothing in it has been
> retired yet.

---

## ⚠ THE SENTENCE THAT REFRAMES THE WHOLE CARD, AND IT WAS MEASURED FIRST

> ⚠ **SUPERSEDED 2026-09-24 — KEPT AS HISTORY, NOT AS FACT.** Struck rather than deleted
> because what it was true of is how the four findings below were scoped, and a correction
> that erases its own premise cannot be checked.

~~**The author road runs for exactly ONE account. For everybody else the "old lane" is not a
ghost — it is the product, and every one of its records IS sent.**~~

`CASTING_CREATIVE_REGISTER_SCOPE=users:1`, read off the live service on the deploy receipt
`output/deploy-receipts/2026-09-23T05-24-42-532Z-22668.txt:58` rather than off the record
that predicts it. So this audit answers two different questions at once and must keep them
apart:

- **On his account** (the author road) — what is still written, and who still trusts it?
- **On every other account** (the house road) — nothing here is a ghost yet, and the
  machinery below becomes one the moment N2 widens the flag.

**That is why this table belongs to N2 rather than to a cleanup pass.** ~~A row marked *dead on
the author road* is not a deletion authority today; it is the list of what stops being true
when the flag goes home.~~

> ⚠ **THE FLAG WENT HOME ON 2026-09-24, SO IT IS ONE NOW** — and the sentence above is the
> exact trap this document became. See the re-read at the foot of the file: the WRITE path
> is retirable and the READ path is not, because 220 of production's 306 rolls read as
> legacy for good.

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

---

# ⚠ THE RE-READ, 2026-09-26 — THE FLAG WENT HOME AND THIS DOCUMENT WENT STALE THE SAME DAY

**Every bold sentence in the section headed *THE SENTENCE THAT REFRAMES THE WHOLE
CARD* above became FALSE on 2026-09-24**, one day after it was written, and
nothing in this file said so. It is kept rather than rewritten, because what it
was true of matters and because a correction that deletes its own premise cannot
be checked — but **read this section first and that one as history.**

What changed: **`CASTING_CREATIVE_REGISTER_SCOPE` went to `all`** at his switch
sitting (#1132, card `switch-01-author-road`, his reply verbatim and entire:
*"Yes"*). Re-read at the **live service** rather than at the record that predicts
it — `railway variables --service Drape` returns
`CASTING_CREATIVE_REGISTER_SCOPE=all` — and `castingIntent.ts:633` says so in the
code.

So the two sentences this file turned on:

| written 2026-09-23 | true on 2026-09-26 |
|---|---|
| *"The author road runs for exactly ONE account."* | **Every account's road.** |
| *"A row marked dead on the author road is not a deletion authority today."* | **It is one.** |

## What that costs, measured at the rows rather than reasoned

The retirement has a **permanent floor**, and it is the first thing this re-read
went looking for. `rollComposedOnAuthorRoad` (`rollProjection.ts:486`) reads the
**ROW's own** `compiledBrief.register.kind`, never the flag — and the projection's
`authorRoad` decides *"the read-only reading sentence and which record lines
draw"*. So every house-composed row keeps needing the house **READ** path however
wide the flag goes.

Counted on **production**, read-only:

| | rolls |
|---|---|
| total | **306** |
| `register.kind = "author"` | 86 |
| **no `register` at all** (pre-flag — the house road) | **216** |
| `register.kind = "house"` (the #132-era follow/override road) | 2 |
| `register.kind = "creative"` (the #94 register, retired) | 2 |
| `compiledBrief.compiler` | `pathA-v1` on all 306 |

**220 of 306 production sheets read as legacy, for good.** The newest of them is
2026-08-26; the author road has had every roll since. So the line this retirement
must not cross is exactly: **the WRITE path can go, the READ path cannot.**

## The table, re-verified row by row

Only rows whose verdict MOVED are listed. Each was opened at the code rather than
carried from the row above it.

| row | verdict 2026-09-23 | verdict now | owner |
|---|---|---|---|
| `personaLine` | *fixed* (nulled on this road) | ⚠ **GONE** — #1241 (`3100bb7a`) retired the candidate disposition end to end and migration `0068` DROPPED the column | closed |
| `intent.reads` | *dead on the author road* | **dead on BOTH roads** — the court measured *"zero readers on either road"*, and its only named consumer `personaLineFor` no longer exists. ⚠ **AND IT STAYS**: his word on #1123, verbatim, *"leave it"* — the `reads`-only trim was offered and **not ordered** | ruled, closed |
| `intent.composedDirection` | *dead on the author road* | ⚠ **WRONG THEN AND WRONG NOW** — `needsAestheticRetry` (`interpreter.ts:137`) reads it on BOTH roads to decide a free re-ask. The court found this before any call fired | #1123, closed |
| `intent.variationAxis` | *dead except through finding 1* | ⚠ **NOT DEAD** — `promoteStatedRole` (`heritagePromotion.ts:126`) reads it on both roads, `cohortPhotorealHuman.ts:1710` reads it, and the axis registry's echo reads it (`axisRegistry.ts:1080`) | #1123, closed |
| `chips`, `variance` → `varianceHeld` | *dead on the wire* | ✅ **OFF THE WIRE** — #1124 shipped; `rollProjection.ts:90` records it. **The ROWS are unchanged**, which was the whole shape of that fix | closed |
| `intent.role` when promoted | ⚠ FICTION CONSUMER | ✅ **the truncation is fixed** — #1122 shipped road (a), with one home for the rule (`capAtWordBoundary.ts`). ⚠ Roads **(b)** and **(c)** are still HIS: whether a borrowed role should be shown at all | #1122 closed, (c) his |
| per-slice `resolvedIdentity` | correctly fenced; residual **#179** | ✅ **residual closed** — #179's ceremony found 404 of 404 production records already marked and **0 readable as fact** | closed |
| `validateLocks` over the dice | ⚠ inert on the author road | unchanged, and now inert for **every** account | **#1125, OPEN, `rung:N3`** |
| `LOOKS` / `ARCHETYPES` / `ENERGIES` | *dead on the author road* | ⚠ **THE MOST MISREADABLE ROW IN THE TABLE — see below** | this card |
| `compiledBrief.archetype` (rolled) | *dead — nothing, anywhere* | ⚠ **true of the PERSISTED FIELD and false of the VALUE — see below** | this card |

## ⚠ TWO ROWS THAT READ AS DELETIONS AND ARE NOT

Both would have been deleted by a shift working from the 2026-09-23 wording, and
both are load-bearing. This is the correction the re-read exists for.

**1 · The three prose tables SURVIVE the retirement.** What dies is their prose
reaching an engine, not the tables. Their readers, opened one at a time:

- `composeCandidatePrompt` (`cohortPhotorealHuman.ts:2919-2922`, `:2784`) — the
  `thesis` / `avoid` / `whisper` strings. **This is the only reader that dies.**
- `stylingResolution.ts:128,134` — `FLAVOURED_ARCHETYPES` and `FLAVOURED_LOOKS`,
  computed at module load from the same prose; `stylingResolutionFor` is called
  from `briefCompiler.ts:935` **inside `resolveSheet`, which runs on BOTH roads**,
  because the author road keeps the per-slice record.
- `properNouns.ts:35` — the brand and proper-noun wall is built from the KEYS.
- `interpreter.ts:627` and `castingIntent.ts:808` — the reader's ask and the
  schema, which **his *"leave it"* protects**.
- `axisRegistry.ts:726,739,1048` — `footprint`, reached only from
  `axisRegistry.test.ts` (`sweepComposedPrompt` has no production caller), so a
  contract-test reader and #1125's subject.

**2 · `resolveArchetype`'s RETURN VALUE is live.** The audit's *"nothing, anywhere
— no reader outside the compiler"* is true of the **persisted**
`compiledBrief.archetype` and false of the value: `briefCompiler.ts:1334` hands it
straight to `resolveSheet`, which is the dice, whose `resolvedIdentity` the author
road **keeps** (marked `unsent: true`) as the honest record of what was rolled. It
cannot be removed on its own; it goes when the dice go, and the dice are not on
this card.

## So what #180 actually still owes, and why it stops here

**One brief: retire the house-road WRITE path.** With the flag at `all`,
`briefCompiler.ts:1382` always builds `seeded` and `:1408` replaces **every**
candidate's `prompt` with `seeded.prompt` — so `composeCandidatePrompt` composes
eight prompts on every production roll and **all eight are discarded**. Its
fourteen `authorRoad` branch sites (`briefCompiler.ts`, plus `rollService.ts` and
`routes/castingV2.ts`) each have one arm no account can reach.

⚠ **AND IT CANNOT START TONIGHT, for a reason that is not caution.** Collapsing
`authorRoad` to `true` while `CASTING_CREATIVE_REGISTER_SCOPE` still exists ships
**a flag that lies** — set it to `off` and the product would ignore it, which is
worse than either state. So the code collapse and the flag's retirement are ONE
act, and retiring a production flag is his word (PROGRAM.md: *production variables
and flag positions* are founder-only). N2's own definition is *"every
half-rolled-out flag either widens to everyone or is retired with its machinery"*
— the widen happened on his word; **the retirement has not been asked for.**

**The question is therefore on his desk as one word, and nothing in this file is
the answer to it.** Two further facts belong beside it when it is asked:

- **Deleting the write path removes the road back.** There would be no house
  compiler to return to if his eye ever disagreed with the author road. His own
  rule cuts toward deleting — *"Nothing is KEPT in a retirement because a future
  feature might want it"* — and his sign-off on the author road (2026-09-23,
  *"im happy to sign off on the cyborg breif now"*) is the eye that earned it.
- **`deterministicBriefCompiler` (`briefCompiler.ts:1559`) is the other caller of
  the dying composer.** Its own docblock calls it test-only and invites live
  callers; whichever way that is settled, it is settled deliberately in that
  brief, not incidentally inside a cleanup.

## What this re-read did NOT do

- **It changed no code.** Every finding above is a reading; the shift that
  produced it shipped its code on #1275, a different card.
- **It did not re-run the audit.** The population above is the 2026-09-23 table
  re-verified, not a fresh walk, so the original's own **floor** note still
  governs: no derived list stands behind it.
- **It did not touch the refine road.** His timing correction of 2026-08-28 puts
  that half at N3's opening act, and that is unchanged.

---

# ⚠ THE RETIREMENT SHIPPED — 2026-09-30, AND THE RE-READ ABOVE IS HISTORY TOO

**Slice 5 of the old-lane retirement — *"the record closes"* — is this section.**
It has no card of its own on purpose (the manifest says why): it IS #180's close
for the deletion half, and it is written here because this is the file a shift
opens to work that card.

## ⚠ TWO SENTENCES ABOVE WERE FALSE FOR THREE DAYS, AND THEY ARE THE TWO A SHIFT ACTS ON

The re-read's closing section — *So what #180 actually still owes, and why it
stops here* — ends on these, in bold:

| written 2026-09-26 | true from 2026-09-26 23:06:38Z |
|---|---|
| *"the retirement has not been asked for"* | **It was asked and answered the same evening** — his Crew reply #228 on #1398, verbatim and entire: *"Delete it"* |
| *"⚠ AND IT CANNOT START TONIGHT, for a reason that is not caution"* | **It started that night** and finished on 2026-09-29 |

The re-read is kept exactly as written, for its own stated reason: a correction
that deletes its own premise cannot be checked. **But it was carrying a bold
`CANNOT START` on the only document that describes this card's work, about nine
hours after his word settled it** — and that is the class this file has now been
bitten by twice in one week, in the same file. The first time a flag moved under
the document; this time his ruling did.

## WHAT ACTUALLY SHIPPED, read at `git log` on `main` rather than off the PR bodies

| slice | card | merged as | what it took |
|---|---|---|---|
| 1 | #1442 | `8a216bf6` (PR #1449) | the manifest, and `CASTING_CONCEPT_UPLOAD_SCOPE` re-parented onto `CASTING_V2_SCOPE` |
| 2 | #1443 | `050212c0` (PR #1460) | the register constant, its two error classes, the parser, the capture, the boot fence, the compiler's `creativeRegister` input and every branch that read it |
| 3 | #1444 | `746f509f` (PR #1487) | the client's `authorRoadEnabled` wire field and the four flag reads behind it |
| 4 | #1445 | `7dd18aa6` (PR #1489) | **no code.** It read the composer at the tree, split it into two forced-order acts, and corrected its own arm count on the way — 86 across 17 was stale; the tree said **101 across 20** |
| 4, act 1 | #1490 | `ba1b30a6` (PR #1493) | the house BRANCH out of `castingBriefCompiler` — 107 arms across 23 suites, each with a verdict |
| 4, act 2 | #1490 | `c94e01be` (PR #1507) | `composeCandidatePrompt` (272 lines) and `deterministicBriefCompiler` (73) — 74 arms across 9 |
| 5 | — | this section | the record |

**Verified at the tree rather than carried**: `git grep` over non-test server
files finds `composeCandidatePrompt` and `deterministicBriefCompiler` only in
past-tense docblocks; `server/_core/env.ts` carries the boot fence's grave note
in place of the fence; `scripts/lib/productionFlagPositions.mts` records the
register row's DELETION rather than a position; `CLAUDE.md`'s flag index row and
`docs/architecture/FEATURE_FLAGS.md`'s entry both already read as history.

## ⚠ ONE ARTIFACT WAS STILL SAYING THE OLD THING, AND IT IS THE ONE AN AGENT READS

`scripts/capability-atlas-corpus.mts` and `scripts/capability-atlas-roads.mts`
each told a reader of `roll.unsupported_cohort` that *"the house arm survives in
the compiler as a declared test seam — 86 arms across 17 suites drive it, and
retiring them is #180 and slice 4 (#1445)"*. Read at the code on 2026-09-30, no
part of that survives:

- **There is no compiler seam.** `castingBriefCompiler` passes `author: true`
  unconditionally on the one and only production call to `interpretBrief`.
- **The count was already wrong when it was written** — #1445 re-read it as 101
  arms across 20 suites — and act 1 then collapsed every one of them.
- **#1445 is closed.** The card that owns what survives is **#1495**.
- What survives is one module further out: the INTERPRETER's own `author`
  option, whose unset position leaves `COHORT_INSTRUCTION` on the prompt
  (`interpreterSystemPrompt`) and lets `parseCastingIntent` return this reason.

⚠ **And the sharper half, which neither artifact said: the COMPILER'S RAISE is
now driven by no arm at all.** Every arm that produces this reason stops at the
interpreter's verdict, so what holds the raise is two BYTE pins —
`briefRefusalCopy.test.ts` counting the constant in the compiler's source, and
`capabilityAtlas.test.ts` reading the declared door at its own `file:line`. The
bytes cannot move silently; the BEHAVIOUR is unowned, and that is now on #1495
rather than implied by a sentence about a seam.

⚠ **AND THAT WAS DRIVEN RATHER THAN GREPPED (law 7b, 2026-09-30).** The raise's
condition was made unreachable in a way TypeScript accepts, on one line so the line
count held and the atlas's own byte pins still resolved —
`String(outcome.reason) === "unsupported_cohortXX"` — and
`vitest run server/castingV2 server/capabilityAtlas.test.ts` returned **281 files /
5,741 tests, 0 failed**. **The POSITIVE control is the same sabotage on the `likeness`
raise three lines down: 2 arms red across 2 suites** (`creativeRegisterScope.test.ts`,
`likenessRefusal.test.ts`). So the instrument can see a compiler raise die, and this one
has nobody watching it. ⚠ A first attempt used `if (false && …)` and reddened only
`typecheckGate.test.ts` — a TYPE error, not a behaviour arm, and it would have been the
wrong receipt for this claim.

**Measured 2026-09-30, with its reader named** — `git grep -c` over `*.test.ts`
for `COHORT_INSTRUCTION` / `COHORT_SCHEMA_LINE` / `author: false` /
`unsupported_cohort`: **six suites**, of which **four drive the two-valued reach,
7 arms between them** (`creativeRegisterScope.test.ts` 4,
`cohortWallRetry.test.ts` 1, `styleRefusal.test.ts` 1, `briefCompiler.test.ts` 1)
and two assert the door's declaration and its sentence instead. ⚠ **It is a
FLOOR**: the reader is a grep over four names, so a suite reaching the two-valued
position without naming any of them is invisible to it.

## WHAT #180 STILL OWES, AND IT IS NOT A DELETION

The retirement is finished. **Two things keep this card open, and neither is N2
deletion work:**

1. **The legacy LOOK vocabulary** — the first concrete act recorded on #180
   (2026-09-05). Read at the code 2026-09-30, `LOOK_KEYS` is still live with real
   readers: the interpreter's own ask (`interpreter.ts`), the brand wall
   (`properNouns.ts`), the per-slice dice (`cohortPhotorealHuman.ts`), the brief
   rewrite and `briefCompiler`'s anchor check. Its replacement is **#535 §12's
   generated chips, which are not built**, so it waits on that and not on this
   card.
2. **The refine-road half** — his own timing correction on this card
   (2026-08-28), verbatim: *"the REFINE-ROAD half re-runs as N3's OPENING ACT."*
   Unchanged, and N3's by his word.

**So a shift opening #180 today should not go looking for a deletion to make.**

---

## THE LAST GHOST IS OUT — #1495, 2026-09-30

**The interpreter's `author` option, `parseCastingIntent`'s two-valued branch
and the `unsupported_cohort` raise are deleted.** They were the remainder this
record handed forward one module out from the compiler, and they went in one act
because the type system made them one: narrowing `SubjectRefusal` takes the
compiler's raise with it, and the raise's copy constant and declared door with
that.

### The bar, and why a deletion needed one

A prompt DELETION and a prompt CHANGE look the same in a diff, and this one
moved the text the reader is asked. So the acceptance bar was byte equality, not
review: `interpreterSystemPrompt` over all 32 option combinations on `main` and
all 16 that survive, each of the 16 sha256-identical to its `author: true` twin.
**16 of 16.** Nothing reaches a reader differently.

### What the record got right, and the one thing it got short

The FLOOR caveat above earned itself. The population was read as *"six suites,
of which four drive the two-valued reach"*, with the honest note that the reader
is a grep over four names. **The typecheck found two more consumers neither the
grep nor the card had**: `server/readerAskTrim.test.ts` (it composes the
production ask and named `author: true` in an options object, not in any of the
four searched strings) and `scripts/court-reader-ask-1123.mts`, a TRACKED court
script, which named it twice. Seven suites and one script, not six suites.

**The lesson is the one the caveat already stated and is worth having paid for
once: a grep over NAMES cannot see a consumer that uses the thing without
naming it.** What found them was the compiler, because the option was typed.

### The two arms that had to be re-pointed rather than deleted, and why

Deleting a fixture's subject is not the same as deleting the property the arm
holds, and two arms here held properties that outlive their fixture:

- **`cohortWallRetry.test.ts`** drove the whole double-check mechanism with
  `{ cohort: "other" }`. That is now an `unreadable` reply, and `unreadable`
  deliberately buys NO second read — so every arm in the file would have gone on
  driving the retry with an input the retry does not apply to. Re-pointed at
  `likeness`, which is what its own court actually drove.
- **`styleRefusal.test.ts`**'s null-shaped reply arm exists because a reply with
  nulls everywhere was once thrown away whole. The retired vocabulary was only
  its carrier.

And one instrument arm lost its specimen rather than its subject: the capability
atlas's multi-line-raise guard read the LIVE tree, and `unsupported_cohort`'s
wrapped raise was the last multi-line raise in the entrance. **A guard whose
subject leaves the tree does not weaken, it goes absent.** The reading was
extracted into `rollRaiseSitesIn` and is driven on synthetic text now, with the
negative control the live-tree version could never have had (a wrapped raise
inside a docblock is not a site — no product file was going to carry one on
purpose).

---

# N3 — THE REFINE-ROAD HALF, ENUMERATED (#1577, 2026-10-15)

**His ruling that places it**, on #180, 2026-08-28, verbatim: *"the REFINE-ROAD
half re-runs as N3's OPENING ACT."* N3 opened on his word today (*"start on
n3"*). **This section is the card's first done-when line and nothing else: the
population, its readers and a proposed fate for each.** No code was changed and
nothing was retired in the commit that wrote it. Every retirement below is its
own later slice and its own PR, in the shape `OLD_LANE_RETIREMENT_MANIFEST_2026-09-27.md`
used for the roll road.

**Read at `origin/main@6fcb8a652`**, which carries #2526 / PR #2528
(`33cdabdcd`, *"the checker acts only on an outright absence"*), so
`renderVerification.ts` is read as it stands after today's change, not before it.

## The method, and what stands behind it

- **Roots**: `server/castingV2/refineService.ts` (11,054 lines),
  `refineInterpreter.ts` (2,053), `renderVerification.ts` (1,192),
  `refineReask.ts` (1,627), `refineRemoval.ts` (512), and what they import.
- **The vocabulary searched for** is the roll road's ghosts: the dice
  (`resolvedIdentity`), categories / archetypes / personas / cohorts, the
  two-valued register, the two PATHS (#203), the retired segment store (#1160)
  and ink studio (#1158), and the house compositor. Then one class the roll
  road did not have: **a refine flag at `all` whose off arm no account can
  reach**, which is the exact shape `CASTING_CREATIVE_REGISTER_SCOPE` had before #1398.
- **Readers** are `git grep` over non-test files on `origin/main`, each opened
  at the line. An import is not a call site; every reader named below is a USE.
- **The two instruments, run this sitting:**
  - `scripts/sweep-uncalled-exports-disposable.mts`: controls 6/6 PASS; 687
    production files, 5,168 exports; 145 test-only, 27 named by nobody.
  - `scripts/diff-importer-count-across-time.mts`, from the ghost audit's own
    read (`272392db`, 2026-09-23) to `6fcb8a652`: both controls PASS; **20
    symbols un-wired in the window**, one of them on the refine road (item F)
    and six on the roll road (item K).
- ⚠ **This is a FLOOR, not a derived population**, for the floor note's reason
  above: a grep over names cannot see a consumer that uses a thing without
  naming it (#1495 paid for that lesson once). Each retirement slice re-counts
  before it cuts, and the count it finds is the one its PR quotes.
- **Production positions** are from `scripts/lib/productionFlagPositions.mts`,
  which the deploy rite checks against the live service on every push. Row
  counts are quoted from where they were measured, with the date. **No
  production database was read for this section.**

## THE HEADLINE — the refine road's real ghost is the OLD COMPOSITOR, not a vocabulary

The roll road's ghosts were words: categories, dice, archetypes. **The refine
road has very few of those left. What it carries instead is a whole second
picture road that no customer can reach.**

`CASTING_REPAINT_SCOPE` is `all` on production. Inside the render,
`refineService.ts:7535` reads `if (repaintEnabled) return repaintOnce();`, and
the code's own comment two lines above calls everything below it *"the old
compositor's machinery, and D-241 retires it rather than configuring it"*. So
the paste road (render, cut a region out with the segmenter, paste it onto the
master, blend the seam) **still exists in full and runs for nobody.** It brings
with it the only refine use of the Nano Banana Pro plain edit, and the only
production caller of the main export of the 2,120-line `maskedRefine.ts`.

⚠ **This is the one surprising finding, and it reaches CLAUDE.md.** The
`FAL_KEY` locator lists *"the paid refine's plain edit on Nano Banana Pro at
`1K` (`castingIdentityEngine`, reached from `refineService.ts`)"* as one of five
live roads. It is reached from `refineService.ts`, but on the paste arm only
(`:6242` builds it, `:7557` is its only use). No production request takes that
road today. **Read, not driven**: the claim rests on the flag's position and on
`dependencies.repaintEnabled` being a test seam. The slice that retires it
drives the off arm first.

Retiring it is the same shape #1398 was: **the code collapse and the flag's
retirement are one act, and a production flag is his word.** And it has the
same ordering trap the old-lane manifest found: `CASTING_REPAINT_SCOPE` is the
BOOT PARENT of three other flags (`captureCastingSidePhrasingEnabled`,
`captureCastingOpenLaneEnabled`, `captureCastingReferenceAttachEnabled`;
`castingV2Scope.ts:443`, `:780` and `:1037` each end `return
captureCastingRepaintEnabled(userId)`), so the children are re-parented before
the parent can go.

⚠ **TWO OF THOSE THREE CHILDREN ARE THEMSELVES RETIRED NOW — the open lane in
slice D1 and the side phrasing in slice D2 — so the only LIVE child still
proving slice 4a's re-parent is `captureCastingReferenceAttachEnabled`, whose
arm is in `referenceAttachScope.test.ts`.** The side-phrasing re-parent arm in
`castingV2Scope.test.ts` drove the retired flag and was removed with it rather
than re-pointed: an arm with no subject left is what slice 4b found 134 of. The
fourth re-parented site, `validateCastingInkStudioEnvironment`, belongs to a
feature already retired (#1158). **Nothing is orphaned by either deletion** —
written down because a reader counting arms after the fact would find one where
there were two.

## THE TABLE

*Readers* are production readers at `origin/main@6fcb8a652`. *Fate* is a
proposal; nothing here is decided.

| # | item | readers (live / none) | fate | why |
|---|---|---|---|---|
| **A1** | the dice record read for PRONOUNS: `readResolvedIdentity(source.internalPrompt)` → `pronounsForSex` (`refineService.ts:1344-1345`) | **live**, but it answers `null` for every cast rolled since 2026-08-26: the author road marks its dice `unsent: true` and `readResolvedIdentity` (`rollService.ts:155`) refuses them, so `pronounsForSex` answers `they` | **keep** (read path) | the 220 of 306 legacy production sheets (counted 2026-09-26, above) still hold honest house-road dice. ⚠ Whether a refine sentence should gender anyone at all on those legacy casts is a product question for him, not this audit |
| **A2** | the dice record as *"the composed identity so far"*: `currentIdentity` (`:1438`), read for relative asks (*"lighter"*, *"shorter"*) and the removal record check (`:3315-3318`, `:7713`, `:8616`) | **live**, same null on every author-road cast | **keep** (read path) | same reason as A1. On an author-road cast each degrades to *no recorded value*, the honest null road the reader was built for |
| **A3** | the dice record as `priorItems` for a stated subject (`:1515`) | **live**, same null | **keep** (read path) | same |
| **A4** | the variant landing's identity WRITE: `resolved: baseIdentity ? applyDelta(baseIdentity, filed, picturedCaptions) : null` (`:9875`, `:9891`) | **live code, inert data on every author-road cast**: `baseIdentity` is `null` there, so `resolved` is written `null` and the caption hybrid's filing (fable-1434, `:8680-8700`, whose own docblock names *a follow* as its one consumer) never lands | ✅ **CARDED — #2537** | not a deletion, because 220 legacy sheets still carry it. But the feature it serves is silent for every cast rolled since 2026-08-26. Whether picture-taken captions get a home on the author road, or the filing retires, is a design question. **Read at the code, not driven**. ⚠ **AND THIS ROW FOUND ONE OF THE TWO DEAD ENDS — corrected at the card, 2026-10-15.** It reads as though repairing the write would revive the feature. It would not: the one consumer, `honestFollowSource` (`rollService.ts:204`), **refuses the whole record when the parent roll was composed on the author road** (`if (rollComposedOnAuthorRoad(…)) return { identity: null, … }`), deliberately, because #176's unsent dice fiction put *"keep South Asian heritage"* into a family clause about a man who is not. **So the filing is dead at the WRITE and dead again at the READ**, and the fix is a capability (a picture carried into a roll) rather than a repair — which is why #2537 is a design card under N3 and not a slice here |
| **B1** | the two-paths half of the wardrobe resolution on refine: `rollPath` threaded into `currentWardrobeLine` (`refineService.ts:1862`, `:9751`; selected at `db/castingV2.ts:865`, `:964`), the `incoherent` kind (`wardrobeLine.ts:94`, `:168`) and the `"born"` source (`:62`, `:165`) | **reachable by no production branch**: `rollService.ts:698` writes the path as a constant `null`, and the thirteen pathed rolls production holds have **zero candidates** (measured 2026-09-23, `TWO_PATHS_PREDICATES_2026-09-24.md`), and a refine needs a candidate | ✅ **RETIRED — slice 2, 2026-10-15** | a branch only a row with no candidate could take. ⚠ The resolution is SHARED: Sign reads it (`signService.ts:319`, `:335`), and so do the ink coverage owner (`inkSurfaceCoverage.ts:402`) and the ink-form demand counter (`refineService.ts:2531`, `source !== "brief"`). The #203 warning above holds: every question that reads it is re-answered in writing. **The `path` column stays** (#203's ruling). ✅ **DONE. All four questions re-answered, and the row's own count was one short.** **(a) Refine's door** — stops threading the path; `wardrobeNow` is the stored line or `unpathed`. **(b) Sign** — stops threading it, its `incoherent` arm goes, and the snapshot still writes `path: null` on purpose (a stored blob three services read back; no row in either world has ever held a non-null one, so the shape is byte-identical to what it already wrote). **(c) The ink coverage owner** — its `incoherent` → `unknown` arm goes, and its docblock's claim that `incoherent` was *the whole reason the gate takes a resolution* is CORRECTED: the reason moved rather than dying, because a bare string still cannot say whether a line is the brief's or an edit, and the surviving arm turns on exactly that. **(d) The demand counter** — the guard is now `source === "edited"` (written positive, because the negative silently widens the day a member is added) and `pathAtRefusal` is no longer passed. ⚠ **THE READER THIS ROW DID NOT NAME IS THE ONE THAT DECIDED WHETHER `born` COULD GO AT ALL: `castWardrobeSource`, which reads the SIGNED SNAPSHOT back** (three callers — `signService.ts:643`, `packageRedoService.ts:580`, `viewRetryService.ts:547`). Measured in both worlds first: **production holds zero snapshots with `source: "born"` and zero with a non-null `wardrobe.path`; dev holds four** (the verify-bot fixtures). ⚠ **And neither reading moves, which is a property of the consumers rather than of the counts** — the whole snapshot chain is typed `string | null` and branches on `"brief"` ALONE (`coverageOfSnapshotWardrobe`, reached through `placementRideCoverage`, whose docblock already says *"Absent means not brief"*), so `born`, `edited`, `null` and absent were always one answer there. That is the argument; the row counts are its second witness. **Also measured: zero of the thirteen pathed rolls are in the `incoherent` shape** — every one carries a line — so that kind was unreachable from the DATA as well as from the code. **Three dead imports of `CastingPath` fell out with it** and were removed |
| **B2** | `unpathed`: no path and no line, answered as *"the house crew tee"* (`wardrobeLine.ts:167`, `refineInterpreter.ts:818`) | **live**: every cast whose brief named no outfit | **keep** | current machinery under an old-lane name. A rename is cosmetic and not proposed |
| **B3** | two stale docblocks on the wardrobe hand-off (`refineService.ts:1915-1930`): *"a roll cast before the paths has both columns NULL … every roll in production answers exactly what it answered"*, and *"the BRANCH'S edited line is not threaded yet"* | none (prose) | ✅ **CORRECTED — slice 2, 2026-10-15** | false since #1222 (a pathless line is now the brief's own outfit) and item 8 (the edited line IS threaded, `:1867`). ⚠ **There were THREE false sentences there, not two.** The third was the middle paragraph — *the resolution rides WHOLE because `incoherent` must not read as the house crew tee* — and this slice is what made it false, by retiring the kind. All three are replaced with what is true, and the reason the resolution still rides whole is stated rather than left implied |
| **C1** | **the paste road**: `renderOnce` below `if (repaintEnabled) return repaintOnce();` (`refineService.ts:7536-7667`) | **none in production**: `CASTING_REPAINT_SCOPE=all` | **retire, with the flag, on his word** | D-241 called it retired; the code kept it as the flag's off arm |
| **C2** | `castingIdentityEngine` on refine, the Nano Banana Pro plain edit at `1K` (`refineService.ts:338`, built `:6242`, used only `:7557`) | **none in production** (paste arm only) | **retire with C1** | CLAUDE.md's `FAL_KEY` locator is corrected in the same slice. At this tree nothing else calls `signEngine.ts:94`'s factory, so it goes too unless the slice's re-count finds a reader |
| **C3** | `harvestRefinement` (`maskedRefine.ts:1022`) | **one** production caller, `refineService.ts:7564`, on the paste arm | **retire with C1** | the module STAYS: `RegionReader` has 13 production importers, and `refusingRegionReader`, `regionNameOf`, `additionDestination` and `maskedEditingEnabledFor` all have live readers off this road |
| **C4** | the masked-edit branch INSIDE the paste arm (`:7550-7556`) | none (paste arm) | **retire with C1** | `defaultMaskedEditEngine` itself **stays**: the repaint road paints with it (`:7289`) |
| **C5** | the `kind_unserved` door, *"I can't do that to them yet. Nothing was charged."*, for `REPAINT_ONLY_SUBJECTS` (`refineService.ts:2755-2770`) | **none in production**: it fires only when repaint is off | **retire with C1** | a capability-atlas door, so its slice moves the door's map entry in the same commit |
| **C6** | six repaint-or-paste ternaries and guards around it (`:4386`, `:4599`, `:6270`, `:6398`, `:7898`, `:9592`) | the paste half of each: none | **collapse with C1** | each keeps its repaint half |
| **D1** | `CASTING_OPEN_LANE_SCOPE` (`all`): the off arm is the two closed-lane prompts, `BASE_PROMPT` and `SYSTEM_PROMPT` (`refineInterpreter.ts:383`, `:431`, chosen at `:481`), read through `refineService.ts:1886` | the off arm: none | ✅ **RETIRED — slice D1, 2026-10-16** | two of the four interpreter prompts no account is asked. The bar is #1495's: the surviving prompts sha256-identical before and after — **and it was MET**: `5166fdbc…` / 12,990 chars (classify) and `d938853e…` / 10,547 (edit), hashed at `9622e69e` before the cut and re-asserted every run by `refineOpenLaneClause.test.ts`. ⚠ **The hash is the bar and the LENGTH is not**, driven rather than assumed: one lowercase character moved both hashes and left both lengths unchanged. Out with the flag: the parse, two error classes, `captureCastingOpenLaneEnabled`, the boot fence, the `openLaneEnabled` service seam, the interpreter's `openLane` option, the acceptance door's second gate, and the two closed-lane fixtures — confirmed hash-for-hash as the dying prompts before they were removed. **The LANE is live and is not what retired.** ⚠ **ONE LIVE ROAD CHANGES, DECLARED (the relay's held finding on PR #2556)**: the removal path's RULE 3 re-read (`refineService.ts`, `const asEdit = await (dependencies.interpret ?? interpretRefinement)({ instruction, mode: "edit", … })`) was the one direct interpret call that never passed `openLane`, so on production it read with the CLOSED edit prompt and skipped `acceptOpenKind`. It now gets the open prompt and the door, like every other read. **What changes for the customer**: a removal of a thing that cannot depart, re-read as an edit naming a kind nobody catalogued, can file an `open` delta and RENDER — **a free refusal becomes a charged render of the removal they asked for**. Measured with the real interpreter, text only, two runs each (2026-10-16): *"take off his tail"* and *"get rid of her wings"* went from `wall_unbacked` (free) to `open.tail` / `open.wings` with the words *"no tail"* / *"no wings"*; *"remove her horns"* and *"remove the antlers"* already filed `free.horns` (*"no horns"*, *"no antlers"*) on the closed prompt and still do (one antlers run read `unreadable`, a free refusal). No kind was invented and the words are the same state phrase the closed lane already renders for horns, so this is the main read's behaviour reaching the one caller that bypassed its seam. Pinned in `refineService.test.ts` ("the RULE 3 re-read takes the open lane"), which reddens when the door is closed. The Railway variable comes off AFTER the deploy |
| **D2** | `CASTING_SIDE_PHRASING_SCOPE` (`all`): `placeSides` (`refineService.ts:7010`) | the off arm: none | ✅ **RETIRED — slice D2, 2026-10-16** | the clause naming which half of the picture a side is on. **The bar was #1495's and it was MET**: the assembled instruction hashed across twelve shapes before and after the cut, every one byte-identical, rollup `883b5ab0…` — and ⚠ **the hash is the bar and the LENGTH is not**, driven rather than assumed: one changed letter moved a hash and left its length at 84. Out with the flag: the parse, two error classes, `captureCastingSidePhrasingEnabled`, the boot fence, the `sidePhrasingEnabled` service seam, and the `placeSides` option on the assembler — the compiler named every reader the moment the option came off `AssembleInput`. **`sidePhrasing.ts` and `imageHalfClause` STAY**: the signed-Cast view lane says the same sentence through the same owner. ⚠ **This row's `all` hid a stale belief, not a live arm** — `recipeAssembler.ts` still called the clause *"dark until its own court runs"* seven weeks after he widened it. The Railway variable comes off AFTER the deploy |
| **D3** | `CASTING_INK_WORDS_SCOPE` (`all`): *"the neck alone"* is the off arm (`:1912`, `:4010`) | the off arm: none | ✅ **RETIRED — PR for slice D3, 2026-10-15.** Both off-arm sites confirmed at the code before the cut | the flag chose between two placement lists rather than flipping a boolean, so the cut was five choice sites and the parameter they rode on. ⚠ **The compiler named FOUR readers and a grep afterwards found THREE MORE** — an injected dependency and two object-literal fields that survived the typecheck because their literals are inferred or spread, where excess-property checking never runs. D2's slice found the opposite (*"a grep afterwards added nothing"*), which is why each slice establishes its own count. The bar: the classifier's verdict over 256 shapes, rollup identical, the reader proven able to fail on the closed arm |
| **D4** | `CASTING_REFINE_DISPATCH_SCOPE` (`all`): the arm that HOLDS the request until the render lands (`refineService.ts:1076`) | the off arm: none | ✅ **RETIRED — slice D4, 2026-10-28** | it decides when a paid request returns, so the slice was a held review and the bar was a BEHAVIOUR bar rather than a prompt hash: a before/after arm asserting that with no variable set anywhere a caller that says nothing gets a receipt, **written and driven RED against the pre-cut tree first** (`expected undefined to be "dispatched"`), green after. ⚠ **THE ROW'S OWN READING OF THIS SLICE WAS RIGHT AND ITS SEQUENCING WAS NOT, and the fortnight between D3 and D4 is the correction.** *"the off arm: none"* is true of PRODUCTION and was false of this repository: our own measuring scripts set the flag `off` in their own process to get the awaited road, because a script handed a receipt exits and abandons the render it paid for. So the off arm had a live consumer that was not a customer — found by the 2026-10-15 sweep, which REFUSED to cut the slice and filed the door instead (#2560, `cannotTakeAReceipt` on the call; #2710, the same field on all sixteen exposed callers, with `server/refineReceiptDiscipline.test.ts` holding the tree to it). ⚠ **AND ITS OFF ARM WAS THE DEFECT RATHER THAN AN OLD FEATURE, which makes it the odd member of D1–D5**: off meant median 121 s, p95 276 s and 1.7% of refines answering past the ~305 s gateway wall with the money safe and the REASON lost. The flag was raised to fix that; retiring it means the fix cannot be switched off by a variable. Out with the flag: the env constant, two error classes, `parseCastingRefineDispatchScope`, `captureCastingRefineDispatchEnabled`, the boot fence, the service's one read, the position row, the capability road's flag entry and the census drive's dead pin. **The HELD road stays, reached by the caller and never by an account.** ⚠ **THE COMPILER NAMED SIX READERS AND NOT ONE OF THEM WAS PRODUCTION CODE, and the first reading of that was WRONG ON THE INSTRUMENT RATHER THAN ON THE TREE — the correction is the finding.** `npx tsc -p tsconfig.json` (which is only `check:root`) says NOTHING: it excludes `**/*.test.ts`, and the one production read sits behind an optional call the compiler cannot see. Reading that as *the compiler named zero readers* was about to go into this row. **`pnpm check` runs FOUR typechecks in parallel, and two of them include test files** — driven by reverting the two test files to `origin/main` with the production cut in place: `tsconfig.casting-tests.json` names all six imports in `castingV2Scope.test.ts` by line, with a *Did you mean* for each. **So the lesson is not a new blind spot; it is that `pnpm check` and `tsc -p tsconfig.json` are different instruments and only one of them is the gate's.** What the compiler genuinely cannot reach here is everything outside TypeScript's own graph — the position table's string key, the capability road's flag literal, the drive profiles' dead pin, the two law surfaces and a client comment — and the grep found all of those. Run both instruments, in that order, and expect either answer: D1 found the compiler sufficient, D3 found a grep added three, and D4 found the compiler reaching only the tests. The Railway variable comes off AFTER the deploy |
| **D5** | `CASTING_REFERENCE_LIBRARY_SCOPE` (`all`), the repaint flag's own parent, read at `routes/castingV2.ts`'s two panel doors, `refineService.ts`'s three sites, the mint's `enabledFor` and the sweep's armed read | the off arm: none | ✅ **RETIRED — slice D5, 2026-10-28** | it was the root of the chain C and D1–D2 hung from, so it went after them. **Three validators re-parented onto `CASTING_V2_SCOPE`, not six** — three of the six had already gone with their own flags, exactly as the 2026-10-15 sweep's table predicted, and the re-count is a comment on #1577 rather than a figure carried from a handoff. ⚠ **ONE PROPERTY IS LOST RATHER THAN MOVED AND IT IS NAMED EVERYWHERE IT MATTERS: the cleanup-worker fence over the LIBRARY'S OWN writes.** Each surviving child asks for the sweep in its own body, so nothing about an uploaded design, an attached photograph or a kept scan is weaker; a deployment with the sweep off now boots and files crops nothing collects, and `ENABLE_STORAGE_CLEANUP_WORKER` is `true` on the service. ⚠ **The bar was the REAL BOOT GATE rather than a hash**: production's whole recorded position set driven through `validateEnv()` after the cut (`scripts/rehearse-reparent-boot-disposable.mts`, re-pointed in this slice rather than deleted — the first of its arms to survive a retirement, because the fence lived and only its variable moved), with a negative control that refuses BY NAME over the new parent. **The one behaviour change is declared**: a refine always reads the library now, where the flag could in principle have skipped the digest query — unreachable on production since 2026-08-24, and the arm that asserted the dark road is INVERTED rather than deleted |
| **E** | the refine flags still at `users:1`: `MASKED_EDITING_SCOPE` (`maskedRefine.ts:99`, a **code constant**, read at `refineService.ts:3387`, `:4759`, `:7550`), and `CASTING_HAIR_REFERENCE_SCOPE`, `CASTING_INK_REFERENCE_SCOPE`, `CASTING_INK_TRANSFORM_SCOPE`, `CASTING_REFERENCE_ATTACH_SCOPE`, `CASTING_INK_REGION_CROP_SCOPE` | **live** for his account | **keep** | not ghosts: half rollouts, and widening is his. ⚠ `MASKED_EDITING_SCOPE` is a constant in the source, not a Railway variable, so `productionFlagPositions.mts` cannot see it. Worth one line in the catalogue |
| **F** | `withoutFacets` (`refineDelta.ts:1957`), the segment store's facet filter | **none, anywhere, not even a test.** Lost its only caller at #1160 slice 1 (`fa1a9ce5d`, 2026-09-25) | ✅ **RETIRED — slice 1, this commit** | the differ found it. The uncalled-export sweep cannot, because the docblock at `:1971` names it and the sweep counts that as a self-use. Re-counted at the cut: two mentions in the source, the declaration and that docblock, and nothing else in the tree. `clearFacets` has a second live caller (`:2282`) and STAYS |
| **G** | `readStoredDelta` / `migrateStoredDelta` (`refineLegacy.ts:116`, `:150`), the reader for deltas older builds wrote | **live**: 15 uses in `refineService.ts`, and `signService.ts:42` | **keep** | it is the READ path for history, the refine road's equivalent of `rollComposedOnAuthorRoad`: a stored row is our own paid-for past |
| **H** | `renderVerification.ts` after #2526 | n/a | **keep** | no old-lane vocabulary: *"the house"* there is the company paying for its own free re-render. Its two test-only exports (`facetsWithUnreliabilityPrior`, a declared seam; `unreadFacts`) are not this card's class |
| **I** | `refineReask.ts`, `refineRemoval.ts` | n/a | **keep** | no old-lane vocabulary. `refineReask.ts:758` names `cohortPhotorealHuman.ts` only as where a word was once found. `stepLabel` is test-only and not this class |
| **J** | `readBriefFacts` over the roll's brief, for *"the sheet asked for glasses"* (`refineService.ts:3352-3356`) | **live** on both roads | **keep** | it reads the brief, which both roads write |
| **K** | **roll-road residue, found on the way**: `describeRealizedAxes`, `statedFinish`, `COMPOSED_DIRECTION_ENABLED` and `PARTIAL_DEFERENCE_ENABLED` are imported by `cohortPhotorealHuman.ts` and used nowhere (each name appears once there, on the import); `statedCovering` and `coveringDirective` have no production importer at all | **none**: the differ's *fully dark* list, un-wired by #1490 act 2 | **not this card** | they belong to the roll road's retirement. Filed rather than fixed here |

**Counted: 25 items. Proposed for retirement: 13** (B1, C1-C6, D1-D5, F), of
which **11 wait on his word** because they retire a production flag (C1-C6 are
one act with `CASTING_REPAINT_SCOPE`; D1-D5 are one flag each), and **2 need no
flag** (B1, F). **Nine are kept as current machinery** (A1-A3, B2, E, G, H, I,
J: the read path for the 220 legacy sheets, and live work). **A4 is carded as
#2537, B3 is a docblock correction riding B1, and K is filed for the roll
road.**

## THE PROPOSED SLICES

Each is its own card and its own PR, in this order. Nothing new is folded into
any of them (his rule on #1398).

1. ✅ **SHIPPED — `withoutFacets` is out** (item F). No flag, no customer
   change, one function. It proved the slice shape on the smallest possible
   cut, and it turned up the one thing a deletion always has to be asked:
   **what did the dying code CARRY that nothing else does.**
   ⚠ **Its docblock held a measured production specimen recorded nowhere else
   in the tree** — grepped before the cut, in the source and under `docs/` —
   and it is kept here rather than deleted with the function: *the first
   production walk of the segment architecture asked for pasted-eligible
   freckles anyway, so the painter re-rolled them and lost them, **twice**, on
   renders she paid for.* That is why a render ever asked for less than the
   recipe held, and with the segment store retired (#1160) there is no live
   code where the fact is load-bearing, so the retirement record is its home.
   The reasoning the ink filter's docblock borrowed from it — facet
   granularity cannot serve one-tattoo-at-a-time — is **kept at that
   docblock** and reworded so it no longer points at a function that is gone.
2. ✅ **SHIPPED — the two-paths half of the wardrobe resolution is out of
   refine** (B1, with B3's docblocks). No flag, no production variable, no
   customer-visible change. The thirteen pathed rows were re-read first and
   still hold **zero candidates**, and all four questions are re-answered in
   writing at the B1 row above. The `path` column stays.

   ⚠ **The row's list of readers was one short, and the missing one is the
   one that decided whether `born` could go at all**: `castWardrobeSource`
   reads the SIGNED SNAPSHOT back, with three callers. Both worlds were
   measured before anything was cut (production zero `born` snapshots, dev
   four), and the reading provably cannot move in either, because the whole
   snapshot chain branches on `"brief"` alone.

   ⚠ **TWO FINDINGS CAME OUT OF THE RE-POINTING AND NEITHER IS FIXED HERE**,
   on his 2026-09-24 ruling that a capability or a second retirement is never
   folded into a cleanup. Both are filed:

   - **The ink-form demand counter has no reachable road at all now.** Its
     guard wants a non-`brief` source; `born` was the one that reached it, and
     the survivor `edited` needs the `wardrobe` free subject, which
     `refineSubjects.ts` says *"is served to nobody"*. **It was already
     unreachable before this slice** — a `born` branch needs a pathed roll with
     a candidate — and `casting_ink_form_demand` holds **zero rows in both
     worlds, all time**. What changed is only HOW it is shut: by a member
     nothing can produce rather than by rows that happen not to exist.
   - ~~**`HOUSE_WARDROBE_LINE` cannot be stored as a wardrobe edit**: 132
     characters against `MAX_FREE_LENGTH`'s 120, and an over-long free value
     makes the strict reader reject the WHOLE delta rather than that key, so
     the branch reads `unpathed`. It is the only line whose upper chest reads
     `covered`, so the demand table's `surfaceCovered` kind has no road either.
     Found by driving the arms rather than by reading them.~~
     ✅ **FIXED — #2552, 2026-10-27.** `wardrobe` has its own cap of 245,
     derived from the longest outfit sentence the product composes (149) plus
     two more garment clauses at the richest observed clause mean (48). All
     four of the product's wardrobe sentences store now. It was raised because
     #2544 slice 1 SERVED the subject, which turned a latent finding into a
     live one — a customer's five-part outfit was losing the whole edit. The
     `surfaceCovered` road opening is a consequence and is **#2551**'s to
     judge. **A value past the new cap still behaves the old way — #2714.**

   **The suites were re-pointed and not relaxed**: seven files, and the arms
   that guarded the retired members were replaced with arms that assert the
   members cannot come BACK — over values, since a type stops saying so the
   moment somebody widens the union. One of them had to be repaired after the
   first re-point, and it is the lesson of this slice: the counter's
   throws-and-is-caught arm **passed without calling the counter at all** once
   its fixture became `brief`-sourced, so it now records the call and asserts
   it. ⚠ **A re-pointed arm must be checked for whether it still reaches its
   own subject, not merely for whether it is green.**
3. ✅ **FILED — #2537** (item A4): the caption hybrid's filing lands `null` on
   every author-road cast. A design card, not a deletion. ⚠ **Reading the
   follow road to write it turned up the second dead end this section had
   missed** — the consumer refuses the record on the author road on purpose, so
   the write is not the thing holding the feature shut. The card carries both
   ends, the three answers and the code's own sentence on the hole; **its
   recommendation is that N3's design pass answers it**, and it is deliberately
   NOT held on him, because nothing waits on it and today's behaviour is one of
   the three answers.
4. **His question, asked once: retire `CASTING_REPAINT_SCOPE`?** If yes:
   - 4a ✅ **SHIPPED — and it re-parented FOUR children, not three.** The
     three named here are the `capture…Enabled` chains (side phrasing, open
     lane, reference attach); the VALIDATOR side has a fourth,
     `validateCastingInkStudioEnvironment`, which also took `repaintScope`.
     ⚠ **The ink studio is RETIRED (#1158) and its flag is unset, so its own
     off arm returns before it ever reads a parent — which is exactly why
     nothing had noticed: a retired feature's boot fence outlives the feature,
     and a child still naming a flag about to be deleted is what refuses
     boot.** It was found by enumerating every production reader of the flag
     before editing anything, rather than by trusting this row's count — the
     rule that a retirement slice re-counts before it cuts, paying for itself
     one slice after it was written down. All four then read
     `CASTING_REFERENCE_LIBRARY_SCOPE`, the manifest's slice-1 shape, because
     a child naming a missing parent refuses boot. ✅ **AND SLICE D5 MOVED THE
     SURVIVORS AGAIN, ONTO `CASTING_V2_SCOPE`** — three of them, because three of
     the four had retired with their own flags by then. The re-count rule paid
     for itself a second time on the same row.
     **Nothing production holds changes**: both flags stood at `all`, and the
     repaint's own gate ENDED in the library's, so every user inside the
     repaint was already inside the library. ⚠ **It is the weaker of the two
     wherever the repaint is narrower than its own parent** — a child at `all`
     under a `users:1` repaint used to be refused and would now pass — and
     after 4b there is no narrower flag to track. **Eleven existing arms went
     red on the old parent and were re-pointed rather than relaxed, and two
     NEW arms drive the repaint dark and assert the children survive it**:
     without those, every re-pointed arm would pass just as well if the chain
     still ran through the repaint, because production holds both flags wide
     enough to hide it. Proven able to fail by putting one capture back on the
     repaint — exactly one arm reddened. ⚠ **And the BOOT gate was rehearsed
     rather than reasoned about**, which is the switch sitting's own precedent
     for a scope chain: `scripts/rehearse-reparent-boot-disposable.mts` drives
     the real `validateEnv()` with production's recorded positions (passes), with
     each child narrowed under the library (refuses, naming the child's own
     variable AND the parent's), and with the repaint driven DARK (passes — the
     arm that fails on the tree as it was, proven by mis-wiring one boot call
     site back to the repaint, which reddened exactly that arm). ⚠ **Its own
     first two runs were RED for reasons that had nothing to do with this slice,
     and its third PASSED FOR THE WRONG REASON** — the repaint's own fence fires
     first and its message CONTAINS the parent's name, which is
     `CASTING_INK_CUT_SCOPE`'s recorded trap exactly (*a regex of merely
     `/FAL_KEY/` matched `CASTING_V2_SCOPE`'s message and printed PROVEN over a
     control that does nothing*). Every refusal arm now names both variables and
     silences its siblings. **It also turned up a fact worth keeping: the
     reference library was ALREADY a parent before this slice** — of the repaint,
     and of the face scan and the kept-scan table under it — so the four moved
     onto a flag with children of its own rather than onto a leaf. The flag
     catalogue's four parent claims are stamped in the same commit;
   - 4b ⚠ **SHIPPED — the paste road is out (C1-C6), the flag with it, and the
     slice measured four things the audit could not see from the import graph.**

     What went: the `renderOnce` fork and everything below it; the
     `harvestRefinement` CALL; refine's reach to `castingIdentityEngine`; the
     masked branch inside the paste arm; the `kind_unserved` door; the six
     repaint-or-paste guards; `regionOverrides`; three dependency seams
     (`engine`, `harvest`, `maskedEdit`) and the `repaintEnabled` predicate seam;
     `CASTING_REPAINT_SCOPE`'s constant, parse, two errors, capture and boot
     fence; its row in `productionFlagPositions.mts`; a DEAD IMPORT of
     `captureCastingRepaintEnabled` in `routes/castingV2.ts` (zero call sites,
     read at the bytes); the flag from the capability atlas's `refine-money`
     road, with `kind_unserved` moved to `UNDECLARED_PROSE_NAMES` because the
     door's DEATH is now the sentence's content. CLAUDE.md's `FAL_KEY` locator
     is corrected and both law surfaces stamp the flag RETIRED.

     **The off arm was driven before anything was cut**, which is the slice's
     own stated bar, and it is the first of the four findings:

     1. ⚠ **134 of the refine suite's 433 arms were driving the DEAD road.**
        Measured by sabotage — a throw at the top of the paste half reddened
        exactly 134 — and the suite's DEFAULT was that road, because with no
        flag set in a unit test `captureCastingRepaintEnabled` answers false.
        **Only 20 of them break when every render goes through the repaint**,
        which is what made this one slice rather than a programme: the empty
        library repaint is the degenerate case the paste road's single-reference
        edit resembled. 13 arms retired with the road, 8 were re-pointed onto
        the live one, and the ones that were re-pointed are the valuable half —
        they now prove on the only road the product has what they used to prove
        on a road no customer was ever on.
     2. ⚠ **TWO CAPABILITIES WERE ALREADY DEAD, AND ONLY ONE OF THEM IS A
        FINDING — the distinction is the honest half of this row.** Both were
        fed by the harvest and both are `undefined` on a repaint, and the
        COMPILER named them the moment the fork came out: `rendered.evidence`
        narrowed to `undefined` and its readers to `never`.
        **The magnified verification crop was already recorded**, in
        `renderVerification.ts`'s own #2526 note — *"the crop is cut from the
        masked road's harvest … `repaintOnce` returns `evidence: undefined` …
        so production has no crop to keep"* — so this slice CONFIRMS a written
        fact rather than discovering one, and what it adds is that the call now
        passes the honest constant instead of reading a field that cannot
        exist. It still costs what the marks court measured: that reader sees
        freckles 8/8 on a 2x face crop against 6/8 unanimous at portrait size.
        **The SEAM VERDICT was not recorded anywhere**, and that half is new:
        the repaint pastes nothing, so there is no join to score and the tear
        rate has had no denominator since the repaint widened — a flip decision
        that had rested on three anecdotes for four shifts, waiting on a
        denominator that had already stopped being collected.
     3. ⚠ **`castingIdentityEngine` IS NOT DELETED, and the re-count is why.**
        C2 said *"nothing else calls `signEngine.ts:94`'s factory, so it goes
        too unless the slice's re-count finds a reader"* — the re-count found
        one: `scripts/calibration/accessory-instance-cell.mts`, TRACKED, which
        builds it. Refine's reach is gone; the factory stays. Same shape as 4a's
        fourth child: a retirement slice re-counts before it cuts, and it has
        now paid for itself twice in two slices.
     4. ⚠ **ONE CONTROL WAS SAVED FROM THIS SLICE BY READING ITS ARM.** The
        lineage read (`branchRows`) was gated on the repaint, and the repaint was
        an AND of its parent — so *repaint on* and *library on* were the same
        answer. Collapsing it to unconditional made the library's own
        *"a dark deploy must not pay for a database round trip"* arm fail, and
        that arm had been passing for the WRONG REASON (what silenced the query
        was the suite leaving the REPAINT flag unset). It was then gated on
        `CASTING_REFERENCE_LIBRARY_SCOPE` — the same condition it always
        had, named at its real parent. ✅ **AND IT IS GATED ON NOTHING SINCE
        SLICE D5**: the library has no switch, so the read is unconditional and
        the arm that asserted the dark road is INVERTED rather than deleted —
        *speaks to the library on every render*, which is this slice's one
        declared behaviour change.

     **What is left standing and is named rather than cut**, because each is its
     own change with its own suites: `harvestRefinement` itself (~965 lines
     inside a 2,120-line module whose other exports are live, and whose two
     suites are tests OF the function rather than of the paste road);
     `REPAINT_ONLY_SUBJECTS` and the `admittedOn` field it derives from, now read
     by nothing; `makeupRegionFor`, which lost its only caller with
     `regionOverrides`; and the mint's harvest-side machinery, which its only
     caller now reaches with constants. A dead input is not licence to cut a
     module this slice does not own.

     ⚠ **AND ONE ARM COULD NOT BE RE-POINTED AND IS A DEBT RATHER THAN A
     RETIREMENT:** *records a departure when the FACE has it but the recipe does
     not* (rule 3, D-238) drove `marks`/freckles, and on the live road that ask
     refuses — *"That's a part of her I can't work on yet. Nothing was charged."*
     It is filed as **#2554** with the reading attached. The departure road
     itself is NOT in doubt: the founder's-walk arm one block down does the same
     thing with `statedAccessories`, renders, charges once and files
     `absent: { statedAccessories: ["glasses"] }` — on the repaint. So what is
     unproven is that subject, not the road.

     ⚠ **THE VARIABLE'S DELETION FROM THE SERVICE IS THE MERGE'S OWN ACT, AND
     THE ORDER CANNOT BE REVERSED.** An absent variable parses as `off`, so
     deleting it while the old build is still serving puts every customer back on
     the paste road — the one direction of this retirement that could hurt
     somebody. Code first, variable second, and between the merge and the
     deletion the rite reports a flag-position mismatch naming
     `CASTING_REPAINT_SCOPE`, by design: `comparePositions` reports a governed
     variable with no row, and the row had to go in the same commit as the
     declaration (`productionFlagPositions.test.ts` reddens otherwise).

     The retirement is held by `server/castingV2/repaintFlagRetirement.test.ts`
     — no declaration, no read in any of the three shapes this repository uses,
     no production row, both law surfaces stamped RETIRED, and the paste road's
     members absent from the service's CODE with comments stripped (the first run
     of that arm found the road quoted in its own obituary). Proven able to fail
     by five sabotages, one per arm.
5. **One flag at a time after that, each on his word**: open lane (D1, with the
   prompt-hash bar), side phrasing (D2), ink words (D3), refine dispatch (D4,
   held review), and the reference library last (D5 — ✅ all five shipped; D5 on
   2026-10-28, and with it every flag retirement this audit proposed).
6. **The record closes**: this section's own last slice, as on the roll road.

**What is NOT in it**: the dice reader and everything that reads the house-road
record (A1-A3, G: the 220 legacy sheets read through it for good); the
`users:1` flags (E: his to widen); the legacy `LOOK_KEYS` vocabulary (the
card's own *not in this card*); `validateLocks` (#1125, `rung:N3`, its own
card); and the roll-road residue (K).
