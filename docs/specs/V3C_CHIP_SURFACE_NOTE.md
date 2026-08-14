# The chip surface — what she sees when a step goes

*Written 2026-08-15 for fable-540 §4's GO. The rulings that decide most of this
already exist (D-121, D-155, D-109); what is genuinely open is the SERVER shape,
and that is the part this note asks to be ruled before it is built.*

---

## What is already ruled

```
D-121   removing a mid-stack instruction is a PAID RE-RENDER (25 credits) —
        a new combination is a new generation. Backing up to a variant that
        already exists is FREE SELECTION.
D-155   the two must never look alike. Remove is visible ON the instruction
        chips carrying its price; backing up stays free navigation.
D-109   the price lives in the quiet meta line, never in button text.
```

And the rail already says the rest, in its own comment: the affordance belongs
in the shared `CardMenu`, and **it should arrive with the action it opens** — *a
visible control that does nothing is worse than the one nobody found.*

The action now exists and is measured (`V3C_PRUNE_COURT_VERDICT_2.md`), so the
control can arrive.

## The one open question: what does a chip click SEND?

A typed removal is ambiguous, so the service reads the sentence, matches it
against the chain, and asks the picture whether the chain put the thing there.
**A chip click is not ambiguous.** She pointed at a step; the step is in the
chain; there is nothing to interpret and nothing to arbitrate.

```
(i)   send the step's own INSTRUCTION as a sentence ("take the earrings off")
      → reuses everything, and re-derives by guesswork what the click already
        knew. It can also match the WRONG step when two steps share words.
(ii)  send the STEP IDENTITY (its index in the chain, with the instruction as a
      check that the index still means what it meant)
      → the interpreter and the arbitration are skipped because the user
        answered both questions by pointing.
```

**I recommend (ii)**, with three properties:

- the index is checked against the instruction it was drawn from, so a stale
  client (she clicked while another edit landed) refuses rather than pruning the
  wrong step — the same shape as every other stale-state door in this service;
- the arbitration is skipped **and that is stated in the record**: `restated`
  still names the slots, and the road remains the pruning one;
- the base-worn case stays honest: if the pruned step asked for something the
  MASTER already had, the step goes and the thing stays in the picture, because
  the master is reference 1. The chip disappears; her face does not change. That
  is the truth of it, and the copy must not promise otherwise.

## What she sees

```
before   a column of chips, each her own sentence, one per version
click    the chip's menu (the shared CardMenu) offers "Remove this step",
         with the price in the quiet meta line — never in the label
after    a new version lands WITHOUT that step; the chip for it is gone from
         the column, and the new version is selected
```

The removed chip disappearing is the receipt: *"the record now says what the
person HAS rather than what they once asked for"* — the rail's own words, and
already true of a typed removal.

**What must not happen:** the column must not look like something broke. A chip
vanishing while the picture reloads reads as a crash unless the new version
arrives in the same beat, so the pending ghost chip (D-161) covers the gap the
same way it does for an ordinary refine.

## The evidence pack this will carry (the UI contract)

- side-by-sides per surface, both themes: the menu open, the pending state, the
  settled column after the removal;
- a copy audit classifying every visible string (prototype-verified / adapted /
  invented) — there is no prototype for this, so every string is INVENTED and
  must be justified or taken from the registry;
- the mechanizable laws as browser-drive assertions: the price is not in the
  button text (D-109), the remove affordance and the back-up affordance are not
  the same control (D-155), and the column never renders empty mid-flight.

## What I will build before the ruling

The **server half only**, which is dark until a UI calls it: the step-identity
input, its stale-index refusal, and the tests. No affordance ships until the
shape is ruled — a click that spends 25 credits is not a thing to add to a
customer's screen on my own judgement overnight.
