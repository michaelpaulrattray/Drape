# The reviewer court — GPT-6 Astra against Fable, on the PRs Fable already judged

**Card #513. Run 2026-09-13 by the Retro seat. Nine of the ten PRs; the tenth is
named below with its price.**

His word blocked this card on one external condition, verbatim:
*"leave it for when openrouter is available through openrouter."* Read at the
artifact this morning, `openai/gpt-6-astra` is listed. The condition cleared, so
the court ran.

⚠ **THE CARD'S OWN BAR, RESTATED BECAUSE IT GOVERNS HOW THIS IS READ:** *"the
reviewer stays Fable on his subscription regardless of the result; a win for
Astra is a founder decision, not a shift's switch."* **No workflow was changed,
no flag moved, no reviewer switched.** This is a scoresheet for his eye.

---

## 1 · The headline, in one paragraph

**Each reviewer found a real defect the other missed, and the two misses are
different kinds.** Astra found **three** real defects Fable passed over — one of
them a live money-path bug now filed as **#896** — and **invented two**. Fable
found **one** real defect Astra missed, invented none, and verified its claims
at the bytes in a way Astra never attempted. **Astra is ~15× faster and its
reviews are a fifth the length; on this evidence that brevity is both why it
misses things and why it is willing to say something is wrong.**

---

## 2 · How the court was built, and the one thing that had to be decided

For each PR the input `review.yml` gives Fable was rebuilt: **the same prompt
text** lifted from the workflow's `prompt:` block, **the same tier** (the
workflow's own MONEY regex — #875 earned the DEEP tier, CLAUDE.md in full;
the rest read `docs/REVIEWER_CHARTER.md`), and the same diff.

⚠ **THE ASYMMETRY, DECLARED BEFORE THE RESULT RATHER THAN DISCOVERED IN IT.**
Fable does not review a diff: it runs inside `claude-code-action` with the
repository checked out **and tools**, so it opens whatever file a finding turns
on. Astra through OpenRouter gets **one completion and can open nothing.** A
court that hands one side the codebase and the other a patch measures the
HARNESS — every *"Astra missed it"* would be unreadable, since it could equally
mean *"Astra could not look."*

So every request also carried **the full text of every source file the diff
touches**. That is generous to the challenger where the card's literal reading
(charter + diff) would have been stingy, and generosity is the safe direction:
**a challenger that loses *with* the files cannot be said to have lost for want
of them.**

**Two limits remain and neither is repairable in one completion:** Astra cannot
reach files the diff does *not* touch, and cannot run a command. Both show up in
its own output — every review ends by naming what it could not verify, which is
to its credit and is also a real capability gap.

### ⚠ A defect in this court's own harness, found mid-run and fixed

The first pass read each carried file off the **working tree** — `main` at HEAD,
up to seven merged PRs into the future of the diff being judged. **It
manufactured a finding.** On #864 Astra reported that the PR's own wiring tests
*"contradict the supplied post-merge pages and will fail"*, because
`CastingSheet.tsx` imports `sheetGoneRefusal` and `CastingV2.tsx` calls
`readSheetGone` — **neither of which existed when #864 merged.** Both arrived in
**PR #891, a day later** (`git log -S sheetGoneRefusal` → `107196f4`).

**Astra's reasoning was correct and the inconsistency was real. The
inconsistency was mine.** Measured across the ten: #864 both carried files
drifted, #866 two, #872 two, #877 one; the other six were byte-identical either
way. The four affected were re-run at their own merge commits
(`git show <mergeSha>:<path>`), and #864's manufactured finding was replaced by
three substantive ones.

**It was caught by the hand pass and by no arm** — which is the whole argument
for the card's rule that every finding is opened at the code before it counts
(working law 2). A court that had shipped without this would have scored a
challenger down for reading a tree the champion never saw.

---

## 3 · The scoresheet — every finding opened at the code

**Nine PRs: #864, #865, #866, #870, #871, #874, #875, #876, #877.**

### Astra — 6 findings, 4 real, 2 invented; 5 clean passes

| # | finding | verdict at the code |
|---|---|---|
| #871 | `rollRecovery.ts:571` — a candidate that becomes `failed` *after* recovery's snapshot enters neither `torn` nor the successful-CAS refund path; the slice is charged and never paid back | ✅ **REAL, and it was unfiled.** Confirmed at the code: the CAS loser `continue`s (line 682) on the assumption *"their settlement stands"*, `torn` was computed once at line 571, and nothing downstream reconciles them — `unrecorded` counts only *attempted* refunds. **Filed as #896.** |
| #866 | `rollService.ts:1005-1012` — the new recovery exit seals `durable_success` over a terminal `failed` slice `isSettleable` excludes, leaving the user charged | ✅ **REAL** — and it is **issue #868 almost sentence for sentence**, which the team filed off this PR's own law-7 sweep and fixed in PR #871. Astra rediscovered it from the diff alone, with no sight of the queue. **Neither reviewer missed it**: the PR declared it and Fable confirmed the filing. |
| #864 | `CastingSheet.tsx:3032` — on a cold visit the enabled button carries `brief === ""` and leaves the sheet's words behind | ✅ **REAL.** `brief = displayText(draft, roll.data?.briefText ?? "")` and `displayText = draft ?? shownBrief`. `getSession` gates the closed dock; `getRoll` is a **dependent** query (`enabled: Boolean(shownRollId)`) so it strictly resolves later. On a cold visit `draft` is null, so for the whole `getRoll` round-trip the button is live and carries `""`. **The feature is called "Start a new sheet with these words."** |
| #864 | the closed follow sheet still promises *"Roll again keeps this family"* while the replacement carries text only | ✅ **REAL.** The FOLLOWING chip renders on `standingFollowId` alone (line 2579) — **not gated on `closedSheet`** — so the page names a control that is no longer there and promises inheritance the replacement does not give. |
| #864 | the diff carries no `capability-atlas` entry | ❌ **WRONG.** #864 is client-only; the capability atlas records **server** doors and refusals. `pnpm capability:check` is green in the gate, and Fable checked this explicitly: *"capability atlas untouched, correctly — no server door changed."* |
| #875 | `adminUserManagement.test.ts:259` — `ADMIN_CTX` is `as never`, so `ADMIN_CTX.user.id` is TS2339 and *"the regression test fails when type-checked"* | ❌ **WRONG on its consequence.** TypeScript does error on that shape (driven directly on a scratch file: `error TS2339`). But `tsconfig.json` **excludes `**/*.test.ts`**, and `tsconfig.casting-tests.json` covers only `server/castingV2/**`, `shared/**`, `client/src/features/castingV2/**`. **Nothing typechecks that file**, and the suite passes 17/17. The underlying observation — the fixture has no type safety at all — is true and mildly useful; the stated failure does not occur. |

### Fable — 1 finding, real, since fixed; 0 invented; 8 clean passes with notes

| # | finding | verdict at the code |
|---|---|---|
| #871 | `rollRecovery.ts:621` — `refundSlice` passed `SLICE_REFUND_DESCRIPTION.candidateAbsent` unconditionally, so a torn `render_fault` slice is repaid with *"Casting candidate did not arrive"* — the wrong event on the one durable line the customer reads | ✅ **REAL, and already fixed.** The code now reads `rollSliceRefundDescription(candidate.failureClass)` with a comment citing *"PR #871 review"*. **Astra did not raise it.** |

Fable's clean passes carry substantial non-blocking notes (three on #866, two on
#870, one on #876) — the `durable_success` totals, a third copy of a shared
sentence, an adjacent `.min(1)` gap on `profile.updateProfile`. They are
observations rather than defects, and none was scored as a finding either way.

### ⚠ The one place both reviewers read the same line, and only one asked both questions

This is the sharpest thing in the court and it is worth his eye.

Fable's review of #871 says, verbatim:

> *"`owed` and `torn` are disjoint by status, and a candidate CAS'd mid-loop
> can't re-enter `torn` (filtered from the pre-loop snapshot)."*

That is the **double-pay** direction of the snapshot property, and **it is
correct** — the snapshot makes a second payment impossible. **The never-pay
direction of the same property was not asked.** Astra asked it, and #896 is what
was behind it. Neither reviewer was careless; one question was simply not put.

---

## 4 · Cost and latency — stated beside the quality, as clause 3 requires

⚠ **THE LISTED PRICE IS NOT WHAT YOU PAY, AND THE GAP GROWS WITH THE PROMPT.**
OpenRouter lists `openai/gpt-6-astra` at **$10/M prompt, $50/M completion**.
Measured from OpenRouter's own reported `cost` field — never from our arithmetic,
which understated the first five reviews by 20%:

| PR | prompt tokens | effective $/M prompt | actual | at listed price | ratio |
|---|---:|---:|---:|---:|---:|
| 871 | 25,331 | 10.76 | $0.3152 | $0.2959 | 1.07× |
| 865 | 34,205 | 11.21 | $0.4003 | $0.3588 | 1.12× |
| 870 | 36,687 | 11.30 | $0.4545 | $0.4068 | 1.12× |
| 864 | 65,450 | 11.83 | $0.8273 | $0.7077 | 1.17× |
| 866 | 67,235 | 11.85 | $0.8312 | $0.7072 | 1.18× |
| 875 | 69,002 | 12.50 | $0.8957 | $0.7232 | 1.24× |
| 876 | 75,426 | 11.92 | $0.9071 | $0.7626 | 1.19× |
| 877 | 129,214 | 12.16 | $1.5842 | $1.3052 | 1.21× |
| **874** | **293,209** | **24.70** | **$7.2683** | **$2.9495** | **2.46×** |

**TOTAL: $13.48 actual against $8.22 at the listed price.**

Two separate effects, and both are decision-grade:

1. **A cache-write surcharge on every call** (#877 alone wrote 129,163
   cache-write tokens). Nothing here is ever cache-*read* — each prompt is a
   different diff — so it is pure loss, and it is 1.07–1.24× below ~130k tokens.
2. **A long-context tier between 129k and 293k tokens** that takes the effective
   rate to **$24.70/M — 2.46× listed.** One review of a PR touching
   `refineService.ts` (540 KB) and its test (659 KB) cost **$7.27 on its own.**

**Latency: Astra 6.8–25.4 s per review. Fable 3m 1s – 6m 43s.** Roughly **15×
faster**, on a step that #543 measured as the largest single block of a shift's
wall-clock.

**Length: Astra 513–1,497 bytes. Fable 3.6–6.6 KB.** Astra states its own limits
every time — *"tests were not run"*, *"CLAUDE.md was not supplied"* — which is
honest and is also the shape of what it misses.

**What Fable costs is not in dollars**: it runs on his Claude subscription, and
#161 measured reviews at ~10% of his cap. The two are not directly comparable
and this court does not pretend otherwise.

---

## 5 · The tenth PR, named rather than quietly dropped

**#872 did not run.** At ~345k prompt tokens it sits in the long-context tier and
prices at **~$8.50**; the OpenRouter balance is **$5.24**. The balance
auto-tops-up (his standing rule — a low number is not a finding and is not being
carded), and #872 is a single re-run whenever it next clears. Its Fable verdict
is already on the PR, so nothing but the Astra arm is outstanding.

**Total court spend: $13.48.** The card guessed *"single-digit dollars"*; the
pre-run estimate posted on #513 said ~$12 at listed prices. **Both were low, and
the reason is exactly the two surcharges in §4** — which is itself the most
reusable finding here.

---

## 6 · What this does NOT say

- **It does not recommend a reviewer switch**, and could not: the card reserves
  that to him, and the sample is nine PRs from one day of one repository.
- **It does not show Fable is worse at finding money bugs.** Fable found the
  #871 ledger-sentence defect Astra walked past, and its verification — tracing
  every exit of `settleAbandonedDispatch`, confirming a test is red on the
  unfixed tree, re-running the sweep's own grep — is work Astra did not attempt
  and structurally cannot.
- **It does not settle the tooling question, which is the real variable.** Astra
  was read one completion with the touched files pasted in. Fable was read a
  repository. **The most interesting unasked question this court raises is what
  Astra does with tools**, and that is a different court.

---

*Run by the Retro seat, 2026-09-13. Runner:
`scripts/_513-astra-court-disposable.mts`. Raw per-PR records, both verdicts
side by side: `output/astra-court/`.*
