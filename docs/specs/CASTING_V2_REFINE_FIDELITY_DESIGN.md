# THE INSPIRED EDIT — §10 item 3e's design report

Ordered fable-1603, from the founder's own question — *"when refining an image
do we have any composer issues"*. GO for this report at fable-1614.

**It decides nothing.** No constant moves in this document, no migration is
proposed for execution, and no court is dispatched. It exists so that the
moment somebody wants the raise, the decision is one word rather than a
fortnight — and so that the two things a shift must never decide alone (a
production migration, and whether a long ask parses faithfully) are named as
his or the reviewer's rather than discovered mid-build.

---

## 1. The complaint, in one sentence

**The inspired EDIT is capped at a tenth of the inspired BRIEF.**

`REFINE_INSTRUCTION_MAX_LENGTH` is **200 characters** — about 35 words — while
a brief now speaks at up to 2,000 with full fidelity since
`CASTING_BRIEF_FIDELITY_SCOPE`'s build. His sentence over the whole composer
family stands here too: *"it will destory people trying to cast inspired
creations"*, arriving at the second of the two places people create.

---

## 2. What was checked before claiming anything

Read at the code, 2026-08-24 (fable-1603) and 2026-08-25 (this report):

- **There is no silent summarisation on the refine road.** The instruction
  travels whole into the interpreter; the deltas keep her words under
  containment. The field-level slices (`match` 80, `asked` 60) are handle
  strings, not the ask.
- **The cap is INPUT validation** (`z.string().trim().min(1).max(…)` at
  `server/routes/castingV2.ts`), so an over-long ask is a `BAD_REQUEST` refusal
  and never a ration. Nothing is lost by position on this road — which is
  precisely what makes it different from the roll road's own defect, and worth
  saying out loud so the two are not treated as one problem.
- **The refusal is a sentence, not machine text**
  (`server/_core/invalidInputMessage.ts`): *"That's longer than we can take —
  please keep it to 200 characters or fewer."*

So the road is HONEST today. What it is not is generous.

---

## 3. The population, and it says LOW — deliberately

Read at production twice, by two different queries that agree:

```
0 of 19 settled refines came within 20 characters of the cap
max instruction 144 characters — and every one of the 19 is his own
```

The second reading is a by-product of §5's column read
(`MAX(CHAR_LENGTH(requestText))` over `casting_candidate_variants`) and lands on
the same two numbers from a different direction, which is the only reason this
paragraph asserts them rather than quoting one shift.

**Nobody has ever hit this wall.** 1603's own condition therefore applies: the
row stands — the fidelity direction predicts longer asks, not shorter — but its
priority is the reading's, and the reading says nobody is waiting.

---

## 4. ✅ What already landed, and why it had to land FIRST

`080ffe6d` (ordered fable-1603's surface read, countersigned fable-1613).

The client held **two hand-typed copies** of the cap and no reference to the
constant at all. **Raising the server's number would have changed nothing for
any customer**: both boxes would still have stopped at 200, silently, on a green
suite. The constant now lives in `shared/refineLimits.ts` and both surfaces
import it.

That commit also closed a latent defect found on the way — the region popover
composed `prefill + said` against a field that capped `said` alone — and the
full account is in the §10 row and in `shared/refineLimits.ts`'s own header.
It matters HERE for one reason: **the popover's typing room is now
`cap − prefill`, derived, so it follows the raise for free.** One of the four
surfaces this raise touches is already done.

---

## 5. ⚠ THE PREREQUISITE NOBODY HAD LISTED: THE COLUMN

**`casting_candidate_variants.requestText` is `varchar(220)`.**

Read on production (`hayabusa.proxy.rlwy.net:23768`) rather than off
`drizzle/schema.ts`, because the rite's schema-conformance reader compares
column PRESENCE and not WIDTH, so its `OK` never settled this:

```
casting_candidate_variants   requestText   varchar   max    220   NULL
casting_rolls                briefText     text      max  65535   NOT NULL
stored sentences: 19 non-null · longest 144 characters
```

Three things follow, and the third is the one to hold on to.

1. **220 is a bare literal.** It derives from nothing, no arm pins it, and its
   docblock does not mention the cap. It is 20 characters of headroom over 200
   and none at all over any raise.
2. **Past 220 a customer's own sentence dies AT THE INSERT** — refused or
   truncated depending on the server's strict mode — *after* her render is paid
   for. That is the worst position on this road for a failure to sit.
3. ⚠ **This is why the BRIEF's raise to 2,000 was free and this one is not.**
   `briefText` is `text`. Two sentences a customer types, two storage decisions,
   made at different times by people who never had to compare them. **A raise
   that reads as "one constant" on the refine road is one constant on the roll
   road and a MIGRATION here.**

**Sequencing, and it is not negotiable: migration first, then the constant.**
A widened column on a written table is a founder-gated ceremony under the
standing limits — never a shift's act, and never in the same commit as the
code that starts using the width.

The widening itself is cheap and non-destructive (`VARCHAR` grown in place,
no data rewritten, no default), but it is still his to run.

---

## 6. The other risks, from 1603's list, each read at the code

- **The reask-handle arithmetic.** `REFINE_ANSWERING_MAX_LENGTH` is
  `REFINE_INSTRUCTION_MAX_LENGTH + REASK_HANDLE_MAX_LENGTH` — **already
  derived**, so the sum moves with the cap on its own. No action, and the arms
  that prove the derivation are in `server/castingV2/refineReask.test.ts`. This
  is the one risk on the list that is already paid for.
- **Announced-vs-enforced consistency.** ⚠ The trap the campaign just killed on
  the roll side is *an announced cap that disagrees with the enforced door*, and
  the reason it is dangerous there is that the announcement is a BRIEF: the
  model writes to the number it is told. **The refine road announces nothing to
  a model** — the cap is a field attribute and a schema, both enforcement. So
  the roll-side trap does not transfer, and the thing to protect instead is that
  the FOUR places the number appears (schema, ask box, popover allowance,
  column) never disagree. Three of the four now derive from one declaration;
  §5's column is the fourth and the only one that cannot.
- **The interpreter's multi-change behaviour.** This is the real unknown and it
  is what the court is for. A longer allowance invites combo asks ("give her
  red hair, a nose stud and take the glasses off"), and combo asks have their
  own history on this road. **The court measures it; this document does not
  guess at it.**

---

## 7. The court, priced — and NOT dispatched

**The question:** does a dense 400–800 character ask parse as faithfully as a
short one, or does length itself degrade the parse?

**The shape**, following the brief-fidelity court that answered the same
question one road over: a handful of asks × two lengths (a compact form and a
dense multi-facet form saying the SAME things) × two drives, driven through the
real refine entrance's interpreter, text-only, no render and no credit. The
measurement is per-fact survival — every fact stated, counted as present in the
parse — because that is what "faithfully" means here and it is what the roll
side's own court measured.

**What it must include, or it answers the wrong question:**

- a **negative control** — a short ask whose parse is already known good, so a
  degradation is attributable to length and not to the day;
- **two drives per cell**, because one drive separates nothing from sample
  noise (the wardrobe picker's court is the specimen: its central claim was
  settled by two byte-identical drives, not by one);
- a **combo cell** specifically, since §6's real risk is multi-change and a
  court of long-but-single-facet asks would pass while the risk stood.

**Price: unpriced here on purpose, and that is a finding rather than an
omission.** The last text court in this campaign was costed at ~$0.60 by
carrying a per-call figure from a court whose replies were a different size,
and the probe said **$1.93** — caught by buying four calls rather than by
arithmetic. **So this court is priced by a four-call probe at its own reply
size, immediately before it runs, and never from a neighbouring court's
number.**

⚠ **And it does not dispatch at today's balance.** OpenRouter stood at **$9.18**
at the last rite. Per the standing shape (fable-1611), no paid text court is
dispatched without the number in the mailbox first — so the sequencing is: the
balance allows it, then the probe prices it, then it runs.

---

## 8. Open questions for the countersign

1. **Is the target 800, or is it `briefText`'s own 2,000?** The brief-fidelity
   build chose 2,000 on a principle worth reusing — *a bound true by
   construction beats one true by measurement* — and the parallel here would be
   to make the edit's allowance the brief's allowance. Against it: the founder's
   own framing of this box is *one adjustment, not a brief*, and that framing is
   a product decision rather than a technical bound. **Recommendation: put the
   framing question to him with the court's frames, not before them** — the
   court answers whether a long ask parses, and he answers whether the box
   should invite one.
2. **Does the column go to the new cap, or well past it?** Recommendation: well
   past — a `VARCHAR` widening is a ceremony each time, and the second one is
   the expensive one. If the cap goes to 800, the column should go somewhere it
   will not need a third ceremony.
3. **Does anything ANNOUNCE the new number to the customer?** Today nothing
   does, and fable-1613 §2 ruled the popover silent on the reasoning that the
   room is ample. **That ruling's own reopening condition is exactly this
   build**: if the raise brings typical asks near the composed limit, the
   counter question returns with it. It is named here so it is not rediscovered.

---

## 9. What this document is NOT

It does not raise the cap, run the migration, dispatch the court, or decide the
target. It records what was read, what it costs, and which two decisions belong
to somebody other than a shift — so that none of it has to be re-derived by
whoever picks the row up.
