# The second tattoo — §10 item 3b, design report for countersign

**Status: DESIGN ONLY. Nothing here is built.** Written 2026-08-24 (opus-1143)
against §10's own order — *3b: KEYING + MULTI-TATTOO REMOVAL, after 5* — and
against the capability census rather than from recollection, per the rule that
rides with the queue (fable-1315 §3).

---

## 0. The one-paragraph version

A Cast may wear one tattoo today and it works. **The moment she asks for a
second one at a second placement, the first one is dropped — not on some later
edit, but inside the very render that adds the second** — because a step that
says anything at all about ink replaces the whole ink pointer set with its own,
and the ADD road never restates what she already had. The transform road hit
this same rule in August and worked around it in two lines for its own case
(`priorDelta.inkApplied` / `priorDelta.inkDelivered`, `refineService.ts:3948`);
the ADD road has no such lines. The repair §10 names is per-slot decomposition
of `free.ink`, and this report says what that means, what it must not break,
and what it costs.

**It is reachable by every account today.** `CASTING_INK_WORDS_SCOPE` is `all`
on production and `WORDS_ROAD_PLACEMENTS` holds `neck` and `upperArm`, so any
customer can put a tattoo on a neck, then ask for one on an upper arm. What has
not happened yet is anybody DOING it — no branch in either world has ever worn
two. That is a population fact, not a door.

---

## 1. What the census says, and the one thing it does not

Rows this design extends (`docs/architecture/capability-atlas.md`):

| row | ask | state | verdict |
|---|---|---|---|
| `ink.words.neck.branch` | *give him a small star tattoo on his neck* | `branch-with-ink` | **would-render** |
| `ink.remove.branch.whole` | *take his tattoos off* | `branch-with-ink` | `free:navigate` |
| `ink.remove.has` | *take the tattoo off his arm* | `branch-with-ink` | `free:navigate` |
| `ink.transform.has` | *his upper arm tattoo — make it bigger* | `branch-with-ink` | would-render |
| `ink.transform.two` | *make his arm tattoo bigger and darker* | `branch-with-ink` | `free:inkOneChangeAtATime` |

`ink.words.neck.branch` is the entrance to this whole item: **the census already
records that a second-tattoo ask is ADMITTED.** Its `why` line says what it was
written for — *"the carried chest piece must not wall a NEW neck ask"* — and it
proves exactly that and no more.

⚠ **AND THAT IS THE CENSUS LIMIT WORTH WRITING DOWN, because it is a property of
the instrument rather than of this feature: `would-render` says the ask reaches
a render. It says nothing about what the render does to what she already had.**
The corpus stops at the door on purpose (it must never spend), so no row in it
can see a feature being dropped on the other side. Every finding below therefore
comes from driving the composition itself, not from the census.

**The second gap is the fixture.** `ensureInkBranchFixture` asserts
`JSON_LENGTH(inkDelivered) === 1` and throws `ContaminatedFixtureError` when it
is not — *"ink branch wears N delivered slots, corpus assumes 1"*. So **no census
row has ever been driven against a Cast wearing two**, and none can be until a
two-tattoo state fixture exists. That fixture needs a paid render (§7).

---

## 2. The defect, driven

Driven at `composeDeltas` — the function the claim is about — with no engine, no
model, no database and no credits (`scripts/_two-tattoo-compose-disposable.mts`,
quoted here rather than kept on disk):

```
1. one tattoo (neck)
   free.ink        "a small swallow on his neck"
   inkDelivered    {"ink:neck":<crop A>}

6. second tattoo added, words restated          <- what actually ships
   free.ink        ["a rose on his left upper arm","a small swallow on his neck"]
   inkDelivered    {"ink:upperArm@left":<crop B>}

7. …then an unrelated edit
   free.ink        ["a rose on his left upper arm","a small swallow on his neck"]
   inkDelivered    {"ink:upperArm@left":<crop B>}
```

**Read row 6.** The words say two tattoos. The pointers say one. That is exactly
the disagreement the composition rule's own docblock says must never happen —
*"the only thing that must never happen is that they disagree about whether she
still has a tattoo"* (`refineDelta.ts`, the `INK_POINTER_FIELDS` loop).

Three code facts make it certain rather than inferred:

- **The words come back as two items.** Not assumed — `refineDelta.ts:1373`
  records it as measured: plural subjects are told to restate all of them, so on
  a branch already wearing a chest piece, *"give him a small swallow tattoo on
  his NECK"* comes back as two items. (That measurement bought a different fix:
  the ink gate was classifying the CARRIED item and refusing the whole ask with
  the wrong sentence.)
- **The pointer set is replaced, not merged.** `inkRestated` is
  `delta.free !== undefined && "ink" in delta.free`, and when it is true the
  composed pointer fields become `{ ...(delta[field] ?? {}) }` — the step's own
  and nothing else.
- **The carry reads the composed pointers and nothing else.** The render's carry
  loop is built from `Object.keys(composed.inkApplied)` union
  `Object.keys(composed.inkDelivered)` (`refineService.ts:6474`). Words with no
  pointer produce no carry, no reference and no clause — which is precisely the
  wire reading that bought `inkApplied` in the first place (opus-864 §1: *"no ink
  reference, no ink clause, tattoo gone"*).

**So the loss is not deferred to the next unrelated edit — it happens in the
render that adds the second tattoo**, because `composed` is built from the chain
INCLUDING the new step, and by the time it exists the previous pointers are
already gone from it. That sentence is not mine: it is `refineService.ts:3663`,
written when the transform road hit the same rule and answered *"she hasn't got
one yet"* about a chest piece she plainly had (measured, opus-949). The transform
road's repair was to read `priorDelta` instead. **The ADD road reads neither.**

### What the customer sees

She pays 25 credits for an arm tattoo and gets a frame with an arm tattoo and no
neck tattoo. The panel agrees with the frame — `inkWornBy` derives its rows from
the same `inkDelivered` expression the carry reads, which is fable-1259 §2's
ruling working correctly — so the neck card disappears too. **Nothing anywhere
says a feature was removed.** The only trace is `free.ink` still holding her neck
sentence, which no surface renders and no engine receives.

It is the *build is lost under words* class, on ink, with the loss inside the
paid render rather than one edit later.

---

## 3. What the fix must not break

Four things are load-bearing and each was bought with an incident:

1. **The three halves may never disagree** — her WORDS (`free.ink`), WHICH
   DESIGN (`inkApplied`), WHICH PICTURE (`inkDelivered`). Two copies of a
   restatement rule drift, and the drift's cheapest shape is a paid removal
   where the words go empty and a pointer stays.
2. **A removal must still remove.** `free: {ink: []}` — she had it taken off —
   must clear the pointers with the words. An emptied plural subject answers no
   facet, so a facet-keyed rule would leave the pointer standing.
3. **A prune must still be arithmetic.** `composeChain` over the surviving steps
   is what un-carries; nothing may need a second mechanism to take a tattoo away.
4. **No tattoo is ever repainted from words.** D-137. A slot whose words survive
   without its picture must not become an instruction to paint a second one — the
   exact sentence `INK_IS_NOT_THIS_SLOT` says to every library caption.

And one thing that must keep working *because* it is the rule, not despite it: a
REPLACEMENT at the same placement (*"give him a different tattoo on his neck
instead"*) must still overwrite, words and pointer together.

---

## 4. The shape — recommendation

**Recommended: (A) the words become the third slot-keyed member of the pointer
family, and `free.ink` is derived from it.**

```
today      free.ink          one value for every tattoo she has   <- the defect
           inkApplied        slot -> designId
           inkDelivered      slot -> delivered crop id

proposed   inkAsked          slot -> the sentence that painted THAT one
           inkApplied        slot -> designId
           inkDelivered      slot -> delivered crop id
           free.ink          DERIVED for every existing consumer
```

Why this one:

- **The composition rule stops being three rules.** The existing
  `INK_POINTER_FIELDS` loop widens to three fields and per-slot
  last-writer-wins falls straight out: a second placement accumulates, a
  replacement at the same slot overwrites, an empty restatement clears all
  three. Constraints 1–3 of §3 are satisfied by construction rather than by
  discipline — working law 4 at the seam that pays for it.
- **The ask stops being ambiguous.** With words keyed by slot, the render can
  say *paint THIS slot, carry the others* without asking a summariser which
  sentence belongs to which tattoo.
- **It is the shape §10 already names** (*per-slot decomposition of
  `free.ink`*), and it is the shape the two pointer fields already are, so there
  is no new idea to test — only a third field under an existing loop.
- **The fence is already written.** `inkAsked` is CODE-WRITTEN and the strict
  reader is blind to it, exactly as `inkApplied` and `inkDelivered` are, and for
  the same reason one step softer: a model free to name the words of a slot it
  was not asked about is a model editing the record of a tattoo she did not
  mention. `deltaCarriesAppliedInk`'s arms are the template.

**Considered and not recommended: (B) merge the pointer sets instead of
replacing them.** Change `inkRestated` so pointers merge per slot and only an
EMPTY ink restatement clears them. It is three lines and no new field, it fixes
the carry, and it is genuinely tempting.

It is rejected because it leaves the words undecomposed, and that has two
consequences the report should not hide: an interpreter that drops one tattoo
from its restatement would leave a pointer standing with no words behind it —
the disagreement in the OTHER direction, which is §3's rule 1 broken quietly
rather than loudly — and nothing downstream can still say which sentence belongs
to which tattoo, so the second half of the item (a removal or a transform that
must decompose the words) gets no help from it. **B is a patch on the carry; A
is the decomposition the item is named after.**

**Considered and rejected outright: (C) putting the words on
`casting_ink_delivery_crops`.** That table has no words column and adding one
would be the wrong home: the chain IS the branch, so a fork carries what its own
steps did and a prune takes them away by arithmetic. A table keyed on the
candidate can do neither, and it would be a second list beside the chain.

### The retroactive limit, stated

Deltas already written carry `free.ink` and no `inkAsked`. They must keep
working, so the derivation reads `inkAsked` when present and falls back to the
stored `free.ink` when it is not. **That fallback is a compatibility shim with a
stated end**, not a permanent second source: it is safe today because the
population is exactly zero branches wearing two, and every branch wearing ONE
composes identically under both readings. The shim is deleted when the last
one-tattoo branch in either world has been re-rendered, or kept forever if that
never happens — either is honest, and the choice is not this design's to make.
The same limit applies as fable-1167 §2d ruled it for `inkApplied`: rows already
written carry nothing new; re-asking re-applies.

---

## 5. What each road inherits once A lands

- **ADD (the words road, the reference road, the design road).** The step writes
  `inkAsked[slot]` beside the two pointers it already writes, at the same place
  and by the same fold (`withInkPointers` becomes `withInk`). Every other slot
  composes forward untouched. This is the whole defect closed.
- **REMOVAL of one of two.** The prune already strikes the step and
  `slotsOfPrunedStep` already reads the struck step's own pointer KEYS, which are
  slot keys. With A, the composition of the survivors returns the other tattoo's
  words AND its pointers together, so the re-render's ask names the surviving
  slot and carries it. **No new machinery** — this is why the item pairs keying
  with multi-tattoo removal rather than treating them as two builds.
- **REMOVAL of "take his tattoos off" (both).** Unchanged: the whole-set noun
  strikes every ink step and the master, which never had them, does the removing.
- **TRANSFORM of one of two.** Already correct today, and its two restatement
  lines (`refineService.ts:3948`) become redundant rather than wrong — with A the
  composition no longer drops the other slots, so those lines stop being the
  thing that saves the neck piece. **They are removed in the same commit or they
  are not removed at all**: a workaround left standing beside the fix it was
  standing in for is the second list this repo keeps paying for. `inkPriorAsk`'s
  read of `priorDelta` stays — it answers a different question (*what did she
  have BEFORE this sentence*).
- **The panel.** Two rows, unchanged: `facePanel` already draws one card per
  delivered slot and `facePanel.test.ts:1005` already pins it.
- **The signed views.** The sign-view wire carries a signed Cast's tattoos into
  the six angles from the same per-slot record, so a Cast wearing two signs
  wearing two. Not measured — see §7.

---

## 6. The arms (red-first, none of them paid)

1. **The defect arm, at composition.** The chain of §2 row 6, asserting BOTH
   slots present in `composed.inkDelivered`. It must go RED against today's code
   — a fix whose arm passes before the fix is an arm about something else.
2. **The strict reader is blind.** A planted model reply carrying `inkAsked` is
   REFUSED by `readDelta`, and `readStoredDelta` round-trips it exactly. Both
   directions, `deltaCarriesAppliedInk`'s template.
3. **Replacement still overwrites.** Same slot twice: one entry, the later
   sentence, one pointer.
4. **Removal still empties.** `free: {ink: []}` clears all three fields.
5. **Prune arithmetic.** Two ink steps, strike one -> the survivor's words and
   pointers both compose; strike both -> nothing.
6. **The compatibility shim.** A pre-`inkAsked` delta composes exactly as it does
   today, asserted against a stored fixture rather than a hand-built one.
7. **At the service, not only at the function.** The two-tattoo ADD driven
   through `refineCandidate` with a doubled interpreter — the existing
   `inkedBranch` / `transformRoad` harness in `refineService.test.ts` already
   builds two-slot branches, so this is a new arm in a suite that can already
   express it. Asserting on the CLAIMED delta and on the dispatched prompt: both
   crops on the wire, one grow clause, no second paint of the carried one.

Arm 7 is the one that matters, and it is the one a composition-only fix would be
tempted to skip: §2's own lesson is that the loss happens at the render, and a
function that composes correctly proves nothing about what the render dispatches.

---

## 7. What this design does NOT do, and what it would cost to close

- **It does not prove anything at the wire on a real Cast.** No branch in either
  world wears two tattoos, so the entire finding above is at the composition
  layer and at doubled-interpreter service arms. **Making it real is a paid
  court**: two words-road renders on a dev Cast (neck, then upper arm) at 25
  credits each = **50 dev credits**, plus the same two after the fix to show the
  frame keeping both = **100 dev credits total**. That court would also mint the
  census's missing `branch-with-two-tattoos` state fixture, which is worth more
  than the court itself — it is a permanent instrument. Costed here, not run, not
  authorized.
- **It does not touch the sign views.** A signed Cast wearing two is a further
  450-credit Sign and is not part of this item.
- **It does not widen any placement.** `upperChest` still walls with
  `gate_ink_uncarried`; nothing here changes which surfaces the words road
  serves.
- **It needs no flag, and that is a judgement to countersign rather than a
  fact.** The change is a record shape on a live lane (`CASTING_INK_WORDS_SCOPE`
  is `all`), and its whole content is *stop dropping a feature the customer paid
  for*. A flag here would mean an account outside it keeps the defect, which is
  the same argument that landed the removal-wall copy ungated. **But it is a
  composition change on the money path**, so if the countersign wants it behind a
  child flag, that is a cheap concession and I would take it without argument.
- **It does not answer the multi-tattoo ASK-WHICH questions**, because they are
  already answered: `inkSlotSheAsksAbout` narrows by her words, prefers a tapped
  rectangle, and asks which one when two match — `refineService.test.ts:13360`
  pins it. Nothing in this design touches that reading.

---

## 8. The open question for countersign

**One.** Whether A's third field lands as `inkAsked` (a new delta field, this
report's recommendation) or whether the countersign prefers B's merge as an
interim while A is designed further. My recommendation is A and my reason is
narrow: B fixes the carry and leaves the item's own name — *keying* —
unaddressed, so the second tattoo's removal and transform roads would each need
their own answer to *which sentence belongs to which tattoo*, which is three
answers to one question.
