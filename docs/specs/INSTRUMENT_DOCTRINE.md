# Instrument doctrine — what this program has learned about measuring things

**Ordered:** fable-662 §3, from opus-504 §4 — *"build
`docs/specs/INSTRUMENT_DOCTRINE.md`, with the charter below."*

## What this file is, and what it is NOT

These are **craft rules about instruments and measurements**, banked by Fable
across the Casting V2 campaign. Each one cost a real mistake.

**Nothing in this file is founder law and nothing in it binds a product
decision.** Founder law lives in two places, both his: CLAUDE.md's *working
laws* and `DECISION_LOG.md`'s D-numbers. Where an entry here elaborates one of
those — most of them elaborate **working law 2, *verify the instrument before
believing its finding*** — it elaborates and never amends. If the founder ever
wants any of this ratified upward, that is his pull and not our push.

**Admission rule.** A sentence enters only when it has been banked in a numbered
Fable ruling AND has a real incident behind it. Every entry carries three
things: the rule, the incident in one line, and the mailbox citation. **No
aspirational entries** — a rule nobody has yet been bitten by is a preference.

**And read this before you assume the worst of the codebase.** When the rule
below about coverage lines was swept across the program's reports, **fourteen of
fifteen were already honest** — several already printed exactly the line the
rule asks for. The doctrine here mostly describes how this program already
writes. The instrument that violates one of these is the outlier, not the norm.

---

## On reporting a measurement

**1. Unmeasured is not free.**
An invented zero is indistinguishable from a measured one, so every figure
carries its denominator and an unpriced window says so in words.
*Incident:* the census counted calls and milliseconds while the read model is
token-priced, so a cost report would have divided a real invoice by a token
count half the calls never contributed to. `tokenCalls` sits beside the totals
and every token figure prints `4/39 priced`.
*Banked:* fable-659 §2.

**2. An absent label reads as complete attribution.**
Any table built from an OPTIONAL field prints its coverage above itself. This is
rule 1's sibling: an absent column reads as free, and an absent label reads as
complete.
*Incident:* the census report's table headed *"what the reads were bought for"*
contained zero read calls — `about` was optional and the read stage left it
empty. It spoke for 293 of 703 calls and said so nowhere, while the two tables
above it shared out everything under identically shaped `%` columns.
*Banked:* fable-661 §3.

**3. Claims are weather; survivals are quotable.**
Where a provider samples, first-call claim rates swing by tens of percent
between windows. Quote the outcome that survived the whole path, never the
intermediate rate.
*Incident:* an arm no shipped change could touch moved 37.8% → 62.2% between
windows. Sixteen survivals to zero was the number that meant something.
*Banked:* fable-642 §2.

**4. Read the row before the credit card.**
Prefer a figure measured off this program's own records to one taken from a
published price. An invoice is confirmatory.
*Incident:* the paint's real price, measured off the account balance, is $0.099
— **18% over list.** A rate-card figure would have been wrong in the direction
nobody checks.
*Banked:* fable-658 §1; the invoice errand downgraded to confirmatory at
fable-657 §4.

**5. A figure quoted more than once gets a script, not a memory.**
*Incident:* a hand-derived figure was quoted twice and was wrong both times. It
now owns a script (20 reads / $0.10, counted).
*Banked:* fable-646 §3.

## On designing the instrument

**6. A null result needs a fixture that could have produced a non-null.**
Ask what the fixture can EXPRESS before believing its zero.
*Incident:* a chain read *"0 of 5 regions degraded"* twice — guaranteed before
the first frame was painted, because that bench's regions are disjoint, on
which ground the two anchorings build the same picture by construction.
*Banked:* fable-662 §3c (2026-08-09, the disjoint-chain trap).

**7. Re-derive the bar from the new estimator.**
A bar inherited from a weaker design measures the weaker design.
*Incident:* a one-armed bench could only say *zero refusals out of N*, so its
threshold was "≥12 refusals in the single column". The two-armed replacement's
statistic is a 2×2 — and the 12 was carried across unchanged, failing a run the
new design had answered comfortably. The mirror image of optional stopping.
*Banked:* fable-656 §1 (finding at fable-654).

**8. A gap list is not checked by its length.**
Read the REASONS, not the count.
*Incident:* a sweep covered only `scanPlan` and called a composed measurement
invisible; the count looked fine.
*Banked:* fable-646 §2.

## On what a measurement can and cannot reach

**9. A re-ask door inherits the correlation of what it re-asks.**
A door built as a second ask of the same engine cannot exceed the agreement
between two of its calls — and that ceiling is findable only on the road, never
from a probe, because the door only ever meets attempts that already claimed.
*Incident:* the colour door fires 21 of 21 and rescues 16 — every failure
content→content, a ~76% ceiling.
*Banked:* fable-656 §2 (measured at fable-655 §1).

**10. Byte arithmetic closes only on a uniform file.**
Record the CRLF/LF split beside the md5, or a proof-of-scope carries an
unexplained term.
*Incident:* a +118 that would not account to the byte until the line endings
were counted — which is what upgraded it from anomaly to rule.
*Banked:* fable-656 §3. The companion technique is the **prefix hash**: hashing
the first N bytes of an appended file and matching the predecessor's whole-file
md5 PROVES the earlier content untouched rather than claiming it (fable-660 §1).

---

## Adding to this file

Follow the admission rule at the top: numbered Fable ruling, real incident, one
line each, citation. Keep it to a page or two — **terse over complete.** A
doctrine file long enough to skim past is an instrument nobody reads, which is
the failure mode all ten of these describe.
