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

The rule bit while the file was being written, and again before it was an hour
old, which is the best argument for keeping it.

The seed order named **eleven** sentences. Entries **1–12** below are those
eleven, minus *verify the instrument first* (founder law, above), plus two
curated from the mailbox — so the two counts are about different sets and
neither is the other's total. **Entry 13 belongs to neither set**: it was found,
banked and written after the file existed, which is what the sections below are
for. **Two of the eleven could not be traced to an
incident**, so they were left out and sent back for their citation rather than
given a plausible one; a fabricated incident here would be exactly the invented
cause that entry 2 below had just been written to remove from a report. Both
came back with citation and price tag and are entries 9 and 10. **A third was
admitted on the seed list itself** — real sentence, real incident, never banked
in a numbered ruling — and was reported ten minutes after the file was finished
(08:41 → 08:51), by reading all twelve warrants in their own messages. It is
entry 6, and it is banked now.

So the rule has caught the order that wrote it (a seed list smuggled an unbanked
sentence past the rule declared in the same message), the author who built the
file (two siblings held out), and the reader who came after (the third, found by
reading warrants nobody had asked to be re-read). All three inside one morning,
on a file of twelve sentences.

**Entry 13 is the first admitted through the front door** — found on a shift,
proposed to Fable rather than written, banked in a numbered ruling with its
incident, and only then added. That is the order the admission rule asks for,
and it is worth contrasting with how entry 6 got in.

**How the rule is enforced: by reading.** One author opens every citation in its
own message. **Two arms are mechanical**, both in
`server/instrumentDoctrine.test.ts`, and each fires on a defect that has actually
occurred here — there is no arm for a mistake nobody has made:

- **No entry cites the message named in the `Ordered:` line above**, because the
  order that commissioned this file cannot also be a warrant for its contents.
  *(One entry of twelve did, and it was found ten minutes after the file was
  finished.)*
- **The closing sentence's count agrees with the number of entries**, derived
  from the entries themselves rather than kept beside them. *(It said "fourteen"
  over sixteen entries. The count had been maintained on all four commits where
  adding the entry was the job, and was dropped on the one where the entry rode
  inside a commit about something else — a step attached to a task by habit dies
  the moment the task changes shape.)*

Neither arm reads the mailbox, and a green suite says nothing about whether a
citation says what its entry claims.

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

**6. A null result is evidence only if the fixture could have produced a
non-null.**
Ask what the fixture can EXPRESS before believing its zero. A comparison whose
fixture cannot produce the defect reads clean over anything, so every clean cell
carries the proof it COULD have failed — and every cell carries its own n.
*Incident:* a chain read *"0 of 5 regions degraded"* twice — guaranteed before
the first frame was painted, because that bench's regions are disjoint, on
which ground the two anchorings build the same picture by construction. The row
is at `ANCHORING_SIDE_BY_SIDE.md:106` and its algebra at `:118`.
*Banked:* fable-665 §1, with fable-126 (the audit that cleared that page to the
founder, naming the disjoint-algebra disqualification).

*(Provenance, deliberately outside the warrant line above: this entry cited the
order that commissioned this file until 2026-08-16, which is not a banking. The
header tells the story, and a `*Banked:*` block holds warrants only — history
goes here, where nothing can mistake it for one.)*

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

**9. A sabotage that changes nothing is indistinguishable from a test that
cannot fail.** Prove the sabotage LANDED before believing the red — or the
green.
*Incident:* a card-body slice keyed on `index("  },")` found a NESTED closing
brace, so two sabotages landed outside the card and the suite stayed green
twice. Re-aimed at the field, both reddened.
*Banked:* fable-510 §3, in those words. The sibling of *never `git checkout` to
revert a sabotage* and *bench arms must be independent*.

**10. A fixture that is not shaped like a real account measures itself.**
*Incident:* a cloned fixture cast carried `internalPrompt` NULL, so verification
could state almost nothing about her and nothing was earned or filed — **75 dev
credits across two purchases, spent reading the clone's own hollowness** before
the row said so. The sharper half: the row already held the answer, and the
reading that should have preceded the purchase was a SELECT.
*Banked:* fable-596 §1.

**14. A probe that assumes a refusal is a mutation with extra steps.**
Before sending a production probe that EXPECTS a gate to refuse it, read the
gate — the schema, the guard, the flag. A probe aimed at an unread gate is a
live request wearing a test's clothes.
*Incident:* a smuggled-key probe at `newsletter.subscribe`, sent to watch a
`.strict()` rejection, assumed a strictness that schema does not have — it is
one of the ~180 that are not. The key was silently dropped, **the resolver
ran**, and a live Klaviyo signup fired for an address nobody meant to create.
No harm: reserved example domain, `success: false`, no row. None of that was
designed; all of it was luck.
*Banked:* fable-676 §5, from the unprompted report at opus-519 §6.

**15. A control built out of a library call needs its own control.**
Law 2 says verify the instrument before believing its finding, and the place it
actually bites is the RULER — because the ruler is the thing you reached for in
order to check something else, and nobody checks the thing they are checking
with.
*Incident:* a mask-overlay painter got a positive control before its output
counted — a synthetic mask over the top-left quarter and nothing else — and the
control failed. It went on failing through two rebuilds of the painter, because
**`sharp(file).extract(box).stats()` ignores the extract and reports over the
whole image**: every quadrant of every image measured identically, so the
control could not have passed on a correct painter either. Two rounds were spent
diagnosing a painter with a broken ruler. It was caught by printing the
ORIGINAL's quadrants beside the painted one and seeing a photograph with a white
t-shirt, a grey background and a face read `R204 G191 B189` in all three. The
check reads its own pixels in a loop now.
*The cheap form of the rule:* a control should measure something whose answer
you already know INDEPENDENTLY — here, that three different regions of a real
photograph cannot have the same mean.
*Banked:* fable-780 §3, from the incident record at opus-571 §4.

**16. A guard with two candidate mechanisms needs a fixture that separates
them — or the test pins whichever one you did not mean.**
Entry 9's sibling, and the harder half: there the sabotage never landed; here it
landed, changed the mechanism, and the suite stayed green because a SECOND
mechanism was quietly doing the work.
*Incident:* a park instrument's suite-line finder was rewritten because its old
predicate also matched `failed |`, which on a red run finds the `Test Files`
line — file counts, printed as the suite, on exactly the run the check exists
for. The new finder had a test named for that trap, and it passed. Restoring the
old predicate as a sabotage **changed nothing**: the finder also takes the LAST
match, which already skips that line, so the case had been passing on a
mechanism it never named and could not have caught the trap coming back. Only a
constructed fixture — a counting line printed AFTER the summary — separated the
two, and with it the sabotage reddened exactly one test.
*The cheap form of the rule:* when a fix has a belt and braces, cut the belt and
check the trousers fall.
*Banked:* fable-792 §2, from the incident record at opus-583 §4.

*(Numbers are ADMISSION order, not reading order — 14 sits here because this is
where it belongs, and renumbering would silently invalidate every citation that
names an entry. Expect the sequence to run out of order as the file grows.)*

## On what a measurement can and cannot reach

**11. A re-ask door inherits the correlation of what it re-asks.**
A door built as a second ask of the same engine cannot exceed the agreement
between two of its calls — and that ceiling is findable only on the road, never
from a probe, because the door only ever meets attempts that already claimed.
*Incident:* the colour door fires 21 of 21 and rescues 16 — every failure
content→content, a ~76% ceiling.
*Banked:* fable-656 §2 (measured at fable-655 §1).

**12. Byte arithmetic closes only on a uniform file.**
Record the CRLF/LF split beside the md5, or a proof-of-scope carries an
unexplained term.
*Incident:* a +118 that would not account to the byte until the line endings
were counted — which is what upgraded it from anomaly to rule.
*Banked:* fable-656 §3. The companion technique is the **prefix hash**: hashing
the first N bytes of an appended file and matching the predecessor's whole-file
md5 PROVES the earlier content untouched rather than claiming it (fable-660 §1).

## On the instrument's own arithmetic

**13. An instrument that subtracts two moments must take both from the same
reading.**
A value sampled at T and a clock read at T+delta produce a figure wrong by delta
and stable enough to look right. The bias is invisible from inside, because two
runs of the same script agree with each other; it shows only against an
independently derived second opinion.
*Incident:* the UPTIME ANCHOR — which exists to answer "same process, or did it
restart?" — took its uptime from the first of three health reads and its clock
from after the read loop, which sleeps between reads. It ran **8.009 s late in
`deploy-rite.mts` and 6.059 s late in `park-state.mts`, two instruments that
disagreed with each other by 1.950 s about one unmoving process.** The fix was
already adjacent in the payload: `timestamp` and `uptime` are neighbouring
fields of one object literal at `server/health.ts:91`. That the two copies
drifted apart by the difference in their own sleeps is **founder working law 4**
(*derive, never mirror*) wearing this incident's clothes; they now derive from
one helper.
*Banked:* fable-668 §3 (finding at opus-510).

---

## Adding to this file

Follow the admission rule at the top: numbered Fable ruling, real incident, one
line each, citation. Keep it to a page or two — **terse over complete.** A
doctrine file long enough to skim past is an instrument nobody reads, which is
the failure mode all sixteen of these describe.
