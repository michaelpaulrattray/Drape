# How an open kind is CARRIED — executing fable-760's ruling

> **Status: design record — build state NOT re-verified in this sweep (#69, 2026-08-28).** Before acting on this, check the rollout-debt register, the queue, and CLAUDE.md's flag paragraphs.


*Written 2026-08-16, shift 79, ordered by fable-762 §4. **Nothing here is
built**, and nothing here re-opens a decision: fable-760 §2 ruled the shape and
this note executes it — the key form, the one dynamic branch, the tests that pin
the closedness, and every slot-keyed call site walked with its decision
recorded. Free: source reads only, no render, no call, no credit.*

> **RULED, fable-760 §2 — shape (a), synthesized keys, bounded:**
> a. open kinds mint under a **derived namespace** (`open@<noun>` *or as the
>    code prefers*), and `slotDefinition` gains **one** dynamic branch confined
>    to it;
> b. the closed catalogue's guarantees are **pinned mechanically** — a test
>    proves no open key can enter the closed tables, the closed union stays
>    closed for every non-open key, and the call sites are swept with each one's
>    tolerate-or-answer decision recorded;
> c. open crops ride the **same library lifecycle** as everything else — minted
>    at delivery, digests, frozen bytes, purged with their candidate.

---

## 1. The key form is `open:<noun>`, not `open@<noun>` — and the code has already
## told us why

The ruling left the spelling to the code, and the code has an opinion, in
`referenceSlots.ts:83`:

```ts
const feature = trimmed.slice(0, at);
const suffix  = trimmed.slice(at + 1);
if (feature === "" || feature.includes(" ")) return null;
if (!INSTANCES.includes(suffix as Instance)) return null;   // ← "left" | "right"
```

**`@` is not a separator in this grammar. It is the INSTANCE separator**, and
the suffix after it is checked against a two-member closed list. So:

- `open@horns` **fails `parseSlot` outright** — `horns` is not an instance — and
  returns `null` before any branch could see it. Written as ruled, the key
  simply is not a slot.
- The only way to make `@` work would be to widen `INSTANCES`, and that is the
  one thing this design must not do: `earring@horns` would parse the moment
  `horns` were an instance, which is the closed grammar breached in exactly the
  place bound (b) exists to protect.

**So: `open:<noun>`** — a prefix on a separator the slot grammar does not use,
recognised *before* `parseSlot` is reached. The `feature@instance` grammar is
left untouched, which is the cheapest possible way to honour bound (b): the
closed form cannot admit an open key because the two forms cannot be confused.

This is the ruling kept rather than amended — fable-760 said *"or as the code
prefers"*, and this is what the code prefers, with its reason.

## 2. The one dynamic branch

**Where.** At the top of `slotDefinition` (`referenceSlotCatalogue.ts:994`),
before `parseSlot`. One branch, one exit, and it can only ever be entered by a
key carrying the prefix:

```
slotDefinition(slot):
  if slot starts with "open:"  →  openSlotDefinition(slot)   ← the whole branch
  …everything else exactly as today…
```

**What it returns.** `SlotDefinition` is a total record, so the branch must
answer every field — which is `openKindPolicy.ts`'s job done one layer along,
and every answer below is that record's or a derivation from horns, the one
kind that has travelled this road for real.

| field | an open kind's answer | why |
|---|---|---|
| `slot` | `open:<noun>` | the key itself |
| `feature` | the noun | there is no second name for it |
| `instance` | **`null`, always** | `openKindIsPlural() → false`: singular until promoted, and per-instance geometry is exactly what promotion buys (§5 of the design note) |
| `tier` | `"anatomy"` | the horns precedent, and its reason transfers verbatim: *"horns are not worn, they GROW — she is not carrying them and cannot take them off in the way a hoop comes out of a lobe."* An open kind is asked for, not put on. `anatomy` also means the words ride every render beside the crop, which is what fable-566 requires |
| `group` | `"face"` | the least-wrong of four closed values, and **stated rather than derived**: nobody has catalogued this thing, so no grouping is honest. It decides panel ordering only, and an open kind draws no row (below), so this value is inert by construction — declared here so that the day it stops being inert, this line is what gets read |
| `panel` | `{ row: "none", why: … }` | the panel draws catalogued rows. A kind nobody has catalogued has no row to draw, and inventing one would put an uncourted feature in the founder's face chart |
| `noun` | the noun | the stylist's word and the model's key are the same string here, which is the open lane's whole premise |
| `question` | the noun — **but only from the DELIVERED frame** | `openKindSegmenterQuestion()`, and the horns entry states the reason exactly: *"horns arrive through an edit, so segmenting the picture she has now asks where a thing is she has not got."* |
| `guardKind` | `null` until the kind has a completeness specimen | the catalogue's own invariant is that `guardKind` is null exactly when `question` is; an open kind's `question` is non-null, so **this is the one field where the open branch cannot satisfy the closed invariant** — see §5 |
| `frame` | `"wholeFrame"` | `openKindZoneScope() → fullFrame`, and `ownSide` is meaningless for a slot with no instance |
| `remint` | `"whenEarned"` | the default every slot should keep; `everyRender` re-buys vision calls to re-photograph a feature nobody edited |
| `display` | `null` | an open kind is drawn from the region it is cut from, like almost every slot |
| `pairNoun` | absent | present only for a per-side slot, and an open kind has no instance |

## 3. The pinning tests — bound (b), written to be watched failing

Bound (b) is the part of the ruling that is easiest to satisfy on paper and
worthless if it is. Every test below must be **seen to fail** before any
`open:` key exists — invariant 2, and this shift's own inherited lesson that a
sabotage which does not land looks exactly like a test that cannot fail.

1. **No open key enters a closed table.** For every table `openKindPolicy`
   answers — the eight total, the four lists, the six that decide by omission —
   assert no key beginning `open:` is present. **Negative control:** a fixture
   that inserts one must redden it.
2. **The closed grammar is unchanged for every non-open key.** `INSTANCES` still
   has exactly two members; `parseSlot("open@horns")` still returns `null`;
   every existing catalogued slot resolves byte-identically to today.
   **Negative control:** widening `INSTANCES` by one must redden it.
3. **The branch is entered only by the prefix.** `slotDefinition` returns the
   catalogue's answer for every catalogued slot and `null` for every malformed
   key that does not carry `open:`. **Negative control:** a branch condition
   loosened to `slot.includes("open")` must redden it.
4. **An open kind is never scopable** — §4's finding, and the sharpest of these.
5. **An open kind never reaches the vacate path** — §4 again; the removal of an
   open kind is a dropped carry, never a vacancy sentence.

Test 1's shape is already in the tree and can be copied rather than invented:
`openKindPolicy.test.ts` scans the source for tables keyed on the closed
vocabulary and checks the policy answers all of them. This is the same scan with
the question inverted.

## 4. The call-site walk — and the two findings that are worth the whole note

I reported *"8 `slotDefinition` call sites"* in opus-555. **That figure was
low**, in the same way and for the same reason as every other hand count in this
milestone: it counted one function. The slot-keyed reading surface is:

```
slotDefinition       8      the resolver
facetsOfSlot         5      what facets does this slot cover
accessoryKindOfSlot  2      is this slot a kind of worn thing
slotsForFeature      1      the sibling instances of this feature
────────────────────────
                    16      call sites outside the catalogue and its tests
```

(`slotsForFacet`, 7 sites, is deliberately *not* in the list: it is keyed by
`Facet`, and an open kind has no facet, so it is unreachable rather than
tolerant. That is the boundary doing its job.)

### The eight `slotDefinition` sites, each with its decision

| site | today | decision |
|---|---|---|
| `recipeAssembler.ts:426` (`whereItIs`) | `null` → `""`, no side clause | **TOLERATES.** With `instance: null` the branch returns no side clause, which is correct — an open kind has no sides until promotion |
| `refineService.ts:691` | a scope naming an unknown slot throws `scope_unknown`, free | **ANSWER — and the answer is to keep refusing.** See below |
| `refineService.ts:2858` | `scopeNoun` for a log line; null-tolerant | **TOLERATES** |
| `refineService.ts:3358` | `scopeNoun` in the customer's sentence; null-tolerant | **TOLERATES** |
| `refineService.ts:4104` | `scopedSide` → `facetsOfSlot`; null → empty set | **TOLERATES**, and `facetsOfSlot` on an open key must return empty rather than throw |
| `refineService.ts:4792` | a vacated slot with no `question` **throws** | **ANSWER — leave the throw.** See below |
| `repaintAsks.ts:657` | refuses `uncatalogued` for an unknown slot | **TOLERATES** — an open ask enters by its own loop and never reaches this one; test 3 pins that |
| `repaintAsks.ts:718` (restore) | `null` → **`continue`**, silently | **ANSWER — this one is a defect waiting.** See below |

### Finding 1 — the dynamic branch must not silently grant SCOPABILITY

`refineService.ts:691` refuses an ask whose scope names a slot the catalogue
does not know. Today `open:horns` is unknown, so it refuses. **The moment the
branch resolves it, this door opens** — and an open kind becomes scopable: *"her
left one, longer"*.

That is precisely what the policy forbids. `ZONE_SCOPE` is `fullFrame` and
`bilateralPair` is *"specifically forbidden until promotion"*; §5 of the design
note rules that the one-of-a-pair ask **refuses into the refund rather than
guessing, which is the earring history not repeated.**

So the branch would hand back a capability three separate rulings withhold, as a
side effect of answering a different question. **The design: `slotDefinition`
answers for CARRY, and the scope door keeps its own refusal** — either by
checking the prefix at site 691 directly, or by the branch returning a
definition that the scope door already rejects. Test 4 exists to make this
mechanical rather than remembered.

This is the unowned-axis class arriving through the back door: nobody would
*decide* that open kinds are scopable, and without this paragraph nobody would
have decided they are not, either.

### Finding 2 — the restore path skips silently, and that loses a paid feature

`repaintAsks.ts:718` walks the slots a restore is putting back, and a slot the
catalogue cannot name is **skipped with `continue`** — no refusal, no log, no
trace. Today that is unreachable, because every restorable slot is catalogued.

With open kinds carried, a restore whose set contains `open:horns` would put
back everything *except* the open feature, and say nothing. The customer
restores a version and her horns are gone. **That is the build-lost class
exactly** — a paid feature disappearing under a later operation, silently — and
it is the one the founder has already felt.

The branch resolving `open:` keys fixes it by construction, which is an argument
*for* shape (a) that the fork did not consider. But the silent `continue` should
not survive on its own merits either: a slot in a restore set that cannot be
named is a fact worth a log line at minimum, whatever answers it.

### Finding 3 — the vacate guard should be left exactly as it is

`refineService.ts:4792` **throws** when a vacated slot has no question. The
policy says an open kind departs by `dropTheCarry`, *"named as a value rather
than a boolean so the step-4 build cannot satisfy it by reaching for the closed
lane's vacate machinery, which would write an absence phrase about a thing her
master never had."*

So an open key must never reach this line — and if one does, a loud throw is
the right outcome, not a tolerated null. **Recorded as: answer = change
nothing.** A call site whose correct decision is "leave it" is still a decision,
and bound (b) asks for it to be written down.

## 5. The one field where the closed invariant cannot hold — declared, not hidden

The catalogue's invariant is that `guardKind` is `null` **exactly when**
`question` is. An open kind has a question (its own noun) and no completeness
specimen, so it would carry `question: <noun>` with `guardKind: null` and break
the biconditional.

Three ways out, and this note picks the third:

1. give the open kind a fake `guardKind` — a default falling through a silent
   path, which is the defect `subjectQualifiers.ts` exists to end;
2. give it `question: null` and let it be words-only — which is fable-566's
   defect, the feature that re-rolls;
3. **let the invariant be stated as closed-catalogue-only, and have the open
   branch carry an explicit `noSpecimen` reason** — so a crop can be minted and
   the absence of a completeness specimen is a *recorded* fact that the mint
   door reads, rather than a null nobody notices.

(3) keeps the fidelity law: the shortcut is declared, and the thing that would
have been silent becomes the input to §4's absence control instead.

> **RATIFIED, fable-766 §2 — option 3, with one bound.** It is V1's own
> principle applied to an invariant: silence becomes a loud, written decision.
>
> **The bound: the mint door must demonstrably READ the reason.** An arm has to
> prove behaviour DIFFERS on `noSpecimen` versus a specimen present — because a
> recorded fact nobody consults is the gate-not-reader class, and this campaign
> has already paid for one of those (`hairWorn` charged twice while three
> instruments said absent). A `noSpecimen` field that every reader ignores is
> indistinguishable from the silent null it replaced.

## 6. Bound (c): the library lifecycle is unchanged, and horns already proved the
## hard part

Nothing in this design touches the mint, the digests, the frozen bytes or the
purge. An open kind's crop is minted at delivery, keyed by its slot, swept with
its candidate — the same path everything else rides, which is the whole point of
synthesizing a key rather than inventing a second carrier.

And the piece that looked hardest is already measured. The design note's §4
worried that a segmenter asked *"where are the horns"* on a face with none would
return a confident patch of forehead. The horns catalogue entry answers it with
a court:

> *"the detection court read **0.0000% on three visibly bare frames** against
> 0.39–0.87% on twelve worn ones, across two faces, asked exactly `"horns"`"*

That is the absence control's shape, run once, on a real kind, and passed — the
question is asked of the **delivered** frame (where the thing is), and the bare
frames are the negative control that proves the reader can decline. **The open
lane's step 3 is therefore a generalisation of a measured procedure rather than
a new idea** — its remaining unknown is whether a reader declines as cleanly on
a kind nobody armed as it does on one somebody courted, which is a measurement,
and it needs specimens the catalogue does not own.

## 6b. THE CARRY WAS WALKED, and the words half works — 2026-08-17, opus-654

Authorized fable-890 §4(3). One paid dev step on candidate #376, the face the
first open ask (opus-653) had already given fangs, `words_only`, no crop minted.
The second ask was **"give her copper hair"** — closed lane, loud, and nowhere
near her mouth, so anything that happened to the fangs was the carry's doing.

**Pre-registered before a credit moved**, and every bar read:

| | asked | answer |
|---|---|---|
| C1 | does the recipe RE-SAY the fangs? | **yes**, in her own words |
| C2 | has she still got them? | **YES** — my eye, 3× on the mouth |
| C3 | did the new ask land? | yes, copper |
| C4 | is she still herself? | yes, judged against the branch state |
| C5 | did the SHAPE re-roll? | **YES, visibly** — see below |
| C6 | charged once? | 25, refunded 0, one ledger row |

The whole sentence the second ask produced, with the carried half first:

> *…Change only her **fangs: vampire fangs**; her hair: coloured copper — bright
> orange-red with real saturation…*

She had never mentioned fangs in that instruction. The composed delta on the new
row is `{"open":{"fangs":…},"hairColour":"copper"}`, and the service's own log
names what it painted: `edited: ["open:fangs","hair"]`, `carried: []`.

**The negative control is the master itself** and it is unusually clean: the
pristine anchor is closed-mouthed with no teeth anywhere, so a carry that failed
would have painted a mouth with nothing in it. There is no way to score this
one wrong by accident.

### C5 is the finding: the KIND survives, the INSTANCE does not

§2's `remint: whenEarned` row and the design note's declared limit — *"an open
kind is a feature carried in WORDS, which re-rolls its shape between renders"* —
now have a specimen. Both frames hold two fangs; **they are not the same
fangs.** The first pair are long, tapered and curved, hanging well over the
lower lip; the second are distinctly shorter, blunter, straighter and cooler in
tone, sitting higher on the lip. At viewing size a customer would say "she still
has fangs". At 3× they are a different pair of teeth.

So the two halves of fable-566's requirement separate cleanly, and this is the
sentence to carry forward: **the words carry the FACT and cannot carry the
FORM.** Nothing in this note's §2–§6 is contradicted — it is the crop half,
unbuilt, being measured by its absence. A customer who asks for something twice
and gets a different answer each time is the earring history (one gold hoop
moving ear to ear between v#156 and v#157), and the crop is what ended that.

**n=1.** One face, one kind, one pair of renders. It is a specimen, not a rate,
and the carry noise floor (the same recipe twice drifting 0.0% vs 21.3%) says a
rate would need arms this walk did not buy.

### And the pair held again, unprompted

Two fangs, symmetric, on both renders — nothing tells the engine that fangs come
in twos (`openKindIsPlural()` answers the same for every open kind). That is the
**second** friendly specimen on the founder's *"two wings rather than just 1"*
demand, and the first one where the pair survived a render that was not about it.
Still n=2, still a specimen; `OPEN_KIND_PROPERTIES_DESIGN.md` §4's D1 control is
what would turn it into a reading.

### What it cost, priced the honest way

```
census   10 calls · 0 failed · wall 196s
           fal:openai/gpt-image-2/edit      1 call   118s   the paint
           openrouter:anthropic/sonnet-5    7 calls   41s   interpret, captions, verify
           fal:fal-ai/sam-3/image           2 calls   11s   hair
ledger   25 dev credits · refunded 0
fal      $26.8033 → $26.6158 after a 4m settle
```

The balance figure is corroboration and **not** a per-operation price (fable-890
§2): the account is shared. The census is the instrument — and the first attempt
to read it returned `0 calls` for this very render, because a census opened
around `refineCandidate` is shadowed by the one `refineCandidate` opens itself.
That trap is now written on `callCensus.ts` with a test pinning it.

## 7. What this note does not decide

- **Whether V5 is built at all** — the founder's gate card, and nothing here
  presumes his answer.
- **§5's invariant change** — Fable's to ratify.
- **The specimen set** for the absence control (candidate 2, design-only:
  `fangs`, `wings`, `tail`, `scales`, `gills` are confirmed open today).
- **Any pricing.** An open kind's render cost, and whether a words-only outcome
  is offered at all, are the founder's clause on the gate card.
