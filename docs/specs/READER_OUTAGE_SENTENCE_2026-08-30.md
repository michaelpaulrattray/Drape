# Whose fault it was — what three paid roads say when a reader does not answer

**foreman-111, 2026-08-30.** Driven, free, no credits and no renders. The
occasion is a measured number rather than a hunch, and it is on the clock.

---

## 1. Why this was looked at tonight

The OpenRouter balance — the account every brief and every refine is read
through — stands at **$7.70 of $260**, with the granted figure flat since
~27 Aug (#202, confirmed at two independent artifacts by foreman-110). Against
the recent burn that is roughly **two days**.

Three shifts in a row have carried the same sentence in their handoffs: *"at
zero, every roll and edit refuses FREE — nobody is charged."* It was a claim
nobody had driven. Working law 7b says a claim like that gets a driven artifact
or the word *unverified*, so it was driven.

## 2. The money half is TRUE, and it is now a fact rather than a belief

`scripts/_shift111-dry-account-drive-disposable.mts` drives both paid roads with
an engine double that throws the exact error an overdrawn account produces —
`classifyOpenRouterTextHttp(402) === "provider_account"`, non-retryable, read at
`server/providers/openrouterText.ts`.

**Both roads refuse before the claim. Nothing is charged on either.** No render
is dispatched, no credit is spent, no variant row is written. The founder's #126
ruling holds, and the product does the right thing with the money.

⚠ **The first run of this drive proved nothing and said it did.** One "healthy"
double was shared across both roads, its reply was the wrong schema for either
interpreter, and **both controls refused** — so the dry arms were
indistinguishable from the controls. The controls are per-road now and both
produce a verified success. That failure is why the guard suite is half positive
controls.

## 3. What is wrong is the SENTENCE, on three roads

| road | what the customer is told when the reader does not answer |
|---|---|
| **roll** (fixed by #126) | *"The studio couldn't read your brief just now — the reader that turns your words into a casting call did not answer. Nothing was cast and you have not been charged. Try again in a moment."* |
| **refine** | *"That one didn't come through clearly. **Try naming what you want changed about them.** Nothing was charged."* |
| **hair from a reference** | *"We couldn't read that picture — **try another one**."* |
| **makeup from a reference** | *"We couldn't read that picture — **try another one**."* |

The roll road tells the truth. The other three tell the customer that **her own
words, or her own photograph, were the problem**, and instruct her to change
them — advice she cannot follow, because nothing about her ask is wrong. She
rephrases; it fails again. She swaps the photograph; it fails again. The product
blames her every time, and on a dry account it does so on **every single
attempt**.

## 4. Why #126's own class sweep did not catch it

It is on the record and it was not careless. #126's sweep asked:

> *"any other paid road that falls back to a degraded compile on a reader
> failure"*

and answered, correctly: *"the refine interpreter already refuses free on an
unreadable reply."* That is a true sentence about **money**. #126's change was
two things — don't charge, **and name the outage** — and the sweep carried the
first half onto the sibling roads and not the second. **The money being right the
whole time is exactly why nobody looked at the words.**

## 5. What changed

One new refusal, `reader_outage`, on the refine road — free, `report: "unread"`,
identical to `unreadable` in every respect except what it says:

> *"I couldn't read that just now — the reader that turns your words into an
> edit didn't answer. Try again in a moment. Nothing was charged."*

The sentence is **derived from the two this product already says honestly** (the
roll road's `READER_OUTAGE_MESSAGE` and the hair/ink cutters' `couldNotRead`)
rather than invented.

`unreadable` **stays exactly as it is** for a reply that DID come back and could
not be parsed. Rephrasing is real advice there, and both directions are armed.

Three consequences worth naming:

- **No engine configured** now refuses `reader_outage` too. It is a deployment
  state and there is nothing wrong with her sentence; the roll road already
  folds that case into the same door.
- **An empty completion on a 200** lands on the outage side, because the
  transport raises for it. Three empty completions in a row is our transport
  failing, and *"try again in a moment"* is the true advice.
- **A dry-account refine with a reference attached no longer buys a fourth
  doomed call.** `unreadable` is on `ANSWERABLE_REFUSALS` — a sentence the
  interpreter could not file, with a picture attached, is exactly what a
  words-take read fixes. An outage is not, and `reader_outage` is deliberately
  off that list.

The two reference readers keep *"try another one"* for a parse failure and say
the cutters' honest sentence for a throw.

## 6. The guard, and the proof it can fail

`server/castingV2/readerOutageRefusal.test.ts` — **15 arms**, driven with a
throwing double (law 3), never through a reader that usually behaves. The
classifier's own 402/401/403 mapping is asserted in the same file so the fixture
cannot drift from the product's idea of what an overdrawn account is.

`scripts/_shift111-outage-sabotage-disposable.mts` puts each defect back and
asserts the reddened arm count:

| sabotage | declared | reddened |
|---|---|---|
| the loop no longer distinguishes a throw | 2 | 2 |
| the throw is no longer recorded | 2 | 2 |
| an unconfigured engine blames her sentence again | 1 | 1 |
| the outage sentence picks up *"Try naming"* | 1 | 1 |
| an unreadable reply mislabelled as an outage | 1 | 1 |
| hair goes back to *"try another one"* | 1 | 1 |
| makeup, the same | 1 | 1 |

Baseline 15/0, after restore 15/0, tree re-read clean.

⚠ **The driver's FIRST run reported five "anchor not found" and it was right to.**
The tree is CRLF; the anchors were LF, so both single-line cases matched and all
five multi-line ones silently replaced nothing. A driver without an anchor check
would have printed five green sabotages and certified an untested guard. The
driver normalizes for matching and restores the original bytes.

## 6b. Two things the guard could not catch, and what caught them

**The full suite caught an arm that was passing for the wrong reason.** The *"no
engine configured"* arm was green **because the test environment has no
`OPENROUTER_API_KEY`**: `interpretRefinement` resolved its engine with `??`, so
`null` fell straight through to the shipped one. The branch was never being
driven, and the arm would have made a REAL network call the day a key appeared
in the environment. The seam is explicit now — `engine?: TextEngine | null`,
where `undefined` takes the shipped engine — which is the pattern
`hairColourFromReference` and `makeupFromReference` already declare in as many
words. It was `typecheckGate.test.ts` that surfaced it, on a type error in the
test file, not on the behaviour.

**And a suite from three weeks ago had already argued for this change and pinned
the old sentence anyway.** `refineInterpreterCeiling.test.ts` (2026-08-09) asserts
what three consecutive empty completions refuse with. Its own prose calls that
state **"a real outage"**, and its header names the exact defect:

> *"the customer whose instruction is least ordinary is the one told 'that
> didn't come through clearly'"*

That file raised the token ceiling to make the branch RARE and left the sentence
alone. Its assertion was pinned to `unreadable` — the implementation — rather
than to its own stated intent, which was *refuses honestly rather than inventing
an answer*. The intent is unchanged and the assertion moved; it now also asserts
the three re-samplings still happen and that the sentence does not send her back
to her own instruction. **A bar was moved, and it is named here as a bar being
moved** so the next reader judges it rather than inheriting it.

## 7. Bound — what this is NOT

- **No money behaviour moves.** Every one of these was free before and is free
  now, before the claim, and the suite asserts the charge and report classes are
  identical to `unreadable`'s.
- **Nothing new is spent.** No engine call, no table, no migration, no flag.
  `assertFalBudget` is untouched.
- **No client change.** The sentences are server-owned; the client renders what
  it is given.
- **It does not fix the OpenRouter balance** (#202) and does not try to. What it
  changes is what a customer reads on the day it runs out.
