# V3(c) — pruning: the shape note

*Written 2026-08-15 by the executor. The review calls this **the largest single
build in the program**, so it gets a note before a line of code, the way V3 did.
Every claim about today's behaviour carries the file it was read from, and the
one question the code could not answer was DRIVEN through the shipped service
rather than guessed at — the answer changed the note's priority.*

---

## 1. What "pruning" means here

The review's phrase is *"deriving the word stack from the chain so an added
thing can be taken back."* Two halves, and only the first exists:

```
THE DELTA      already derived. A removal DELETES the matching steps and
               recomposes what is left (`refineRemoval.ts` — `chainAfterRemoval`,
               `composeChain`). The chips are the receipt: the removed chip
               disappears, because the record says what she HAS rather than what
               she once asked for.
THE LIBRARY    NOT derived. Crops and words are filed per render and live until
               something RETIRES them, and the only thing that retires anything
               is an explicit `vacated` on a delivered recipe
               (`refineService.ts:3991` — "Nothing but `vacated` may retire
               anything").
```

So the chain and the library answer *"what does she have"* by two different
routes, and a prune only moves one of them. That is the shape of the whole
milestone: **one source of truth for what she has, or the two will disagree.**

## 2. The question, asked of the running product rather than of the code

> After a prune removes the step that added her earrings, does the next render
> still carry the earring CROP the library filed?

I could not answer that by reading, so I drove it — the shipped service, a
two-step chain, a live earring row, the picture arbitrating that the base has no
earrings. **The answer is neither yes nor a silent wrong picture: it REFUSES**,
and the refusal names the missing piece in the product's own words:

> *"this step takes an earlier one back, and under D-244 a removal strikes
> matching words from the library's stack — **which is not yet derived from the
> chain's own pruning**"* — `repaintAsks.ts`, `repaintCannotRemove()`

So on the repaint road today:

```
"remove her glasses"    (base-worn)   → VACANCY, works, measured
"take the earrings off" (chain-added) → REFUSES, charged and refunded, no picture
```

That is the honest state and it is better than the failure I expected — nothing
untrue is painted, nobody is charged for it — but it is a real hole in the
founder's ruling, and it is the one V3(c) exists to close. The drive is now a
test (`refineService.test.ts`, *"a prune on the repaint road, today"*) which
**is meant to go RED the day pruning is derived**; at that point it becomes the
place to assert what the pruned render carries instead.

One correction to my own earlier reading, recorded because it changes the
priority: the risk is NOT that a pruned crop rides silently. The library never
gets the chance, because the road refuses first.

## 3. Why "just retire on prune" is not the answer

The tempting one-liner is: when a prune deletes a step, retire the library rows
that step created. It is wrong for three reasons already paid for:

1. **A row is not owned by one step.** A crop is minted from a RENDER, and a
   render usually answers several asks. Retiring "the rows that step made" would
   take her hair crop off because it happened to be minted on the render that
   also added the earrings.
2. **A retirement that is wrong is expensive and silent.** The service already
   says so where it retires: a library that retired on a weak signal *"would
   delete her earrings because a render came out shadowy"*. A prune is a
   stronger signal than a shadowy render, but the failure mode is identical.
3. **Retirement is a WRITE on a path that must stay cheap.** A prune that lands
   on an existing variant is free (it moves her selection and charges nothing);
   one that does not is charged and refunded today. Adding a database write to
   either is where "free" and "refunded" quietly become "sometimes
   half-written".

## 4. The shape I would build

**Derive the carry list at ASSEMBLY time from the surviving chain, and let the
library be a store of pictures rather than a claim about the face.**

```
today      recipe carries  = live library rows (minus explicit retirements)
proposed   recipe carries  = live library rows ∩ what the surviving chain says
                             she has
```

The library keeps filing what it filed; nothing is deleted on a prune; the
recipe simply stops asking for a crop the chain no longer supports. That
satisfies the review's sentence exactly — the word stack is DERIVED from the
chain — and it has three properties worth naming:

- **A prune stops refusing**, which is the whole point: today the road says "I
  can't do that on this face yet" to a chain-added removal.
- **No write, no retirement, no half-written state.**
- **It is reversible by construction.** Re-adding the step brings the crop back,
  because the crop was never destroyed — which is the founder's own
  remove-then-re-add behaviour, generalised.
- **It cannot delete the wrong row**, because it deletes nothing.

And one property that must be measured rather than assumed: **a crop whose ask
has been pruned may still be the best picture of her** (her hair crop minted on
the render that also added earrings is still her hair). The intersection must be
by SLOT-and-ask, not by render.

## 4b. What actually landed (2026-08-15)

Both halves are in, and the second one needed a ruling I did not make myself:

```
step 2   the carry derivation — live rows ∩ the surviving chain, with the two
         exemptions (master-minted rows, slots re-cut every render). Nine unit
         arms, and the one that matters is the negative control: on an ordinary
         render it changes NOTHING.
the lift the prune's own ask shape (`Ask.restate`), ruled by fable-536 as (ii).
         The recipe says nothing about a taken-back slot — the master never had
         the thing and the carry no longer holds it, so the removal is
         arithmetic — but the ask NAMES it, so the verification has a question
         at the wire instead of shipping unverified on the one fact the render
         exists to change.
```

**The lift is a narrowing.** Only a prune that took something back AND can name
it gets through; anything else meets yesterday's refusal, with no picture, and
that arm is driven.

One thing the wiring taught: the accessory KIND for the slot lookup has to come
from the words that LEFT, not from the ask. A prune files nothing, so
`accessoryRegion` is null and `statedAccessories` — one facet over several kinds
— resolves to no slot at all. *"Gold hoop earrings"* is an earring whether it is
arriving or leaving.

## 5. What it costs, and the order

```
1  the premise                                             SETTLED — it refuses
   (driven, and now a test that goes red when (c) lands)
2  the intersection at assembly, behind no flag             ~1 day, unit-driven
   — it removes carries, it never adds one, so the blast
     radius is "a crop stops riding", never "a wrong crop rides"
3  a prune court: prune → next render → is the thing gone,
   and is everything else still there                       ~$1.50 house money
4  the chip surface (what she SEES when a step goes)        UI, founder-visible
```

Step 3's second half is the arm that matters and it is not the obvious one:
proving the pruned thing left is easy, and proving **everything else survived**
is the expensive half — the same asymmetry the removal court found, where the
control (can the judge still see a beard) was the arm that made the verdict
worth anything.

## 6. What this note does NOT propose

- **No schema change.** If the intersection needs a fact the rows do not carry,
  that is a finding for the note's revision, not a migration smuggled into a
  build.
- **No change to what a prune COSTS.** It is free today; nothing here charges
  for it, and if the founder ever wants it charged that is a pricing decision
  with its own gate.
- **No touching the removal roads.** Vacancy and drop-the-carry are measured and
  working; (c) is about the third road only.
