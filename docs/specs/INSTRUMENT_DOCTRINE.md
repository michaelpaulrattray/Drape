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
**And the confound may be the QUERY rather than the fixture: prove the
question-shape can return rows ANYWHERE before believing a zero.**
*Incident:* a chain read *"0 of 5 regions degraded"* twice — guaranteed before
the first frame was painted, because that bench's regions are disjoint, on
which ground the two anchorings build the same picture by construction. The row
is at `ANCHORING_SIDE_BY_SIDE.md:106` and its algebra at `:118`.
*Incident (the query half, 2026-08-17):* *"the fixture bot owns no signed Cast,
so the 2K half is UNREAD"* stood in two specification documents for a week. The
query behind it named two columns that do not exist on `models`, inside a
`.catch` that turned `ER_BAD_FIELD_ERROR` into the same empty array an honestly
castless bot produces — it could not have returned a row for ANY user alive,
while four signed Casts sat one bot over. The fixture was innocent; the
instrument could not ask. The control that catches it costs one query: ask the
same question across all users and watch it return rows.
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

**17. A convention with no instrument is not a convention; it is a run of luck
with a shape.**
A step kept alive by habit attached to a task survives exactly as long as the
task keeps its shape, and dies the first time it rides inside a different one.
*Incident:* three findings in one shift, all the same mechanism. **The suite
line** was mechanised precisely so a park would stop assembling it by hand — and
the two parks that shipped and ratified the mechanism both hand-edited its
output, inserting the one token (`0 failed`) that vitest never prints and that
had carried a false green claim four days earlier; the habit died because the
reporting rule demanded a fourth number the instrument cannot emit, so quoting
was impossible and editing was the only way to comply. **The doctrine file's own
closing count** was maintained correctly on four consecutive admissions and then
dropped twice: first when an entry rode inside a commit whose subject was
something else, then by the next author copying the state he found. Both were
found the same way — opening the artifact that would have to disagree, at the
moment its claim was repeated — and both were repaired with an instrument rather
than a correction, because the correction is what had already been applied four
times.
*The cheap form of the rule:* if the only thing keeping a step alive is
remembering to do it, count the ways the task could change shape — that is the
list of ways the step is already gone.
*A note on the reporting half:* check that a rule about a report can be
satisfied by QUOTING what the instrument prints. One that cannot will be
satisfied by editing, which is the thing the instrument was built to stop.
*Banked:* fable-796 §2, from the incident records at opus-585 §2, opus-586 §1–2
and opus-587 §4.

**18. A sweep that finds nothing owes proof it was LOOKING — an empty surface
and an unfinished one print the same number.**
*Incident:* the high-DPI sharpness audit swept eight surfaces at two pixel
densities and reported the casting sheet, the boards view and the models library
as clean, one picture each, nothing stretched. All three were **loading
skeletons** at the moment of measurement: eight and six empty grey tiles, and an
avatar that arrives immediately and holds a count perfectly steady while the
photographs are still being fetched. The numbers were plausible, the sweep was
green, and nothing in the output distinguished *"this surface has one picture on
it"* from *"this surface has not painted yet."* What caught it was the
screenshots — the frames, not the counts — which is law 9 turned on one's own
instrument instead of on an engine.
*The repair is the shape worth keeping:* not a longer clock, but the PRODUCT'S
OWN signal that it is still working (here `.animate-pulse`, the class every
lobby surface renders while its query is in flight), plus the surface's own
element waited for, plus a loud `⚠ STILL PULSING` on any surface that timed out
anyway. A stable count and a finished count are different facts. And the
symmetry that follows is the evidence: after the repair both density passes
agreed surface-for-surface, which no racing sweep had managed.
*Kin to* `sampler-must-throttle` (a fast link certifying a surface that fails on
a real one). *Distinct from entry 6:* there the world could not produce the
finding; here the instrument was not yet looking at it.
*Banked:* fable-799 §3b, from the incident record at opus-590 §4.

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

**19. A list that argues for itself in prose can be checked against the code
the prose describes — and that is cheaper than any test.**
Where a constant carries a written justification, the justification is a
CLAIM about the tree, and it is usually two greps from being settled. No suite
can catch a rule whose premise stopped being true, because every test agrees
with the rule.
*Incident:* `surfaceOwnership.ts` excluded `castingV2.refine` from the bridge's
toast on the stated ground that *"an outcome is never lost by not being watched
— it is sitting on the surface when you come back."* Two queries decide that
sentence, and both refuse it: the sheet's lists are `status='ready'` and
`status IN ('queued','dispatched')`, so a **failed** variant is in neither and
leaves the payload entirely. The exclusion was right for two of its three
entries and wrong for the one whose surface could not represent the outcome the
list promised — costing eight production refusals that answered past the
gateway, every one of them the founder's own. The suite was green throughout,
and could not have been otherwise: it restated the rule.
*Corollary, from the same sitting:* a test that restates some of a decision's
clauses and imports the rest is describing the code, not testing it — the
defect lived in the relationship between the restated clauses and the imported
one. Move the whole decision into the function the caller calls, and add one
arm proving the caller still calls it.
*Banked:* fable-829 §3 (finding at opus-614, built at opus-618).

**20. A verdict on a structural feature change is taken at a magnification
matched to the feature, not at viewing size.**
A change to the SHAPE of something small is carried by a few dozen pixels; the
frame it lives in is a thousand across. Looking at the delivered frame the way a
customer looks at it answers a different question — *does this read as her?* —
and answers the one that was asked, *did the thing change?*, with a confident
no.
*Incident:* the founder's *"give her fox eyes"* (production, 2026-08-16
23:48:12Z). At full frame I could not see it and was about to report a paid
render as invisible; at **3× on the eye region, nearest-neighbour**, it is
unmistakable — both eye openings longer and narrower, the outer corners drawn
toward the temples and lifted. Eye shape is the one class this program has
historically failed, so a viewing-size verdict would have been a false negative
on exactly the class where a false negative is most expensive. It also
retroactively glosses the 2026-08-07 court's *"near-invisible"* eye-shape
scores — noted, not re-litigated.
*Banked:* fable-849 §3 (finding at opus-631 §2).

**21. A test whose comment and assertion disagree is a regression with a green
light.**
The comment is a claim about what the assertion checks. When they split, one of
them is the bug — and the suite will never tell you which, because it only ever
runs the assertion.
*Incident:* `recipeAssembler.test.ts` asserted `expect(recipe.standing).toEqual([])`
directly underneath a comment quoting fable-192 — *"the words are the carrier of
record, and they ride whether or not this render is about the hair."* The test
DESCRIBED the law and ENFORCED its opposite. So when fable-598's item rule
(POINT, DON'T DESCRIBE) was applied to every carried slot rather than to items
alone, nothing went red, and every anatomy slot with a crop stopped saying what
the feature was. Eyes never carried a picture in the product's whole life
because of it. Finding it took two founder challenges, an outside-the-app
exhibit, three courts and $4.25 of house money — and every layer suspected on
the way (the crop, its size, the packing, the engine) was innocent.
*Banked:* fable-864 §2 (finding at opus-639 §3).

**22. A meter that is correct but LATE reads as headroom — a self-metering run
whose meter lags is not self-metering.**
The live guard prices the unit at the wire, from what the call itself reports;
the account balance is a RECONCILIATION after the fact and must never be the
guard. A late meter does not look broken from inside, because every reading it
gives is true — it is true about a moment that has passed, and the difference
between "spent" and "settled" is exactly the budget a run will overspend.
*Two incidents, one class.* **fal's settlement lag:** the account read $12.12 the
instant the last render returned and $11.89 four minutes later with nothing in
flight, so a court reported at **$1.10 was really $1.29** — 29% over a $1 cap
rather than 10%, and the per-render column derived from those subtractions was
invalid throughout, every figure being the previous render's price (opus-635 §4).
**OpenRouter's credits endpoint:** the open-lane routing bench priced its own
pilot by reading the balance seconds after eleven calls, computed **$0.00183 a
call against a true $0.0148 — eight-fold low** — and then used the same lagging
figure at every abort check, so the guard that existed to stop the run reported
headroom that was already spent and the run passed its $1.50 ceiling by $0.41.
*Corollary, from the repair:* the wire meter's first backstop threw from inside
the engine wrapper and **never fired** — `interpretRefinement` catches every
engine error and returns null, so the stop signal was swallowed by the code
under test and logged as a bad reply; driven at a $2.45 ceiling the run reached
$2.689 with the guard in place. A budget guard belongs where the caller can see
it throw, and its overshoot should be bounded by one UNIT of work rather than
one batch: checked between atoms instead, the same case stops at $2.4525.
*Banked:* fable-882 §3 (findings at opus-635 §4 and opus-650 §1).

**23. AN ARM IS PLACED AT THE PRODUCER, AND ITS SABOTAGE IS DELETING THE
PRODUCING LINE.**
An arm written where a value is CONSUMED reads identically whether the line that
MAKES it works or not, and a green suite cannot tell the two apart. So the
mechanizable half is a definition of done: **an arm is not finished until the
producer-deletion sabotage has been run and reddened exactly it** — and **a
guard proving an ABSENCE first proves its population non-empty**, or it is
proving nothing over nothing.
*Incident:* five instruments passed while proving nothing in a single day
(2026-08-22), and none was found by a failing test — all five by asking what the
green meant. A boot rehearsal matched a SIBLING flag's refusal and printed
REHEARSED; a measurement gate scored the interpreter instead of the compression
it was built for; a projection guard proved an absence over a list a product
change had quietly emptied; a write-then-replay feature was armed at the read
and not at the write.
*The type specimen is the fifth,* because the same file got it right in one
direction and wrong in the other. `storageManifestReceipt.test.ts` sweeps every
manifest caller and splits them into KEEPERS and COLLECTORS. Its COLLECTOR arm
*"reads the ACT and not the word"* and carries a CAN-FAIL arm proving its reader
both ways. Its KEEPER arm asked whether the file MENTIONED `cleanupBatchId` —
which every broken keeper also does, in the declaration and in the manifest call.
**The rigorous control was the negative one.** Under that green,
`referenceAttachService` minted a receipt, handed it to the manifest and never
passed it on, so the cleanup worker collected every picture a customer had ever
attached and left the rows pointing at nothing. Found by building the route that
shows her the picture and getting `NoSuchKey` from a live row's own key.
*The rule's first recursion — a SABOTAGE that proved the wrong thing* (2026-08-23,
banked fable-1431): a fix handed its pointer to the same door at TWO sites, once
on the first reading and once on the retry the door itself triggers. Deleting the
first hand-off reddened **nothing** — the retry rescued it — and that green would
have been filed as *"producer-sabotage run, arm proven"*. The honest producer was
the builder they both call; emptying THAT reddened exactly the new arm. So the
rule needs its own corollary: **find the single line the value cannot exist
without, not the first line that mentions it.** A value handed over twice is
proven by neither hand-off alone.
*Banked:* fable-1422 §2 (the rule, named before the worst specimen surfaced),
fable-1427 (this entry) and fable-1431 (the recursion), findings at opus-1058 §4,
opus-1060, opus-1061 §4 and opus-1068 §3.

**24. A COURT THAT DRAWS AN OVERLAY NAMES, IN ITS OWN REPORT, WHO OPENED IT AND
WHAT THEY SAW.**
D-235's `saw` applied to the ARTIFACT rather than to the checker. A court that
prints a number and draws a picture has produced two artifacts, and a report
that quotes only the number has read half of what it bought — on the one class
of evidence this project has ruled is final (law 9: the founder's eyes are king,
and a reader's output is a pointer to look, not a fact to file).
*Incident:* §10's third flip precondition asked for two segmenter reads on the
Wardrobe path's first non-house garment, and named the failure it feared — *a
reader that outlines a NEW garment files a confident rectangle over fabric, and
nothing goes red*. The reads were taken, printed **101,468 and 133,099 px**, and
went into a log. Read as numbers alone those are exactly what the precondition
is afraid of. **The overlays sat unopened for a day while the document said
nobody trusts a chest read until it is re-taken and the re-take was on disk.**
Opened: the mask is bare skin and stops dead at the fur, on the larger read too.
*The sharper half, and it is the reusable one:* **a SECOND court on a settled
question gets read as a repeat.** Round one's overlays WERE opened and their
verdict written into `inkSurfaceCoverage.ts`; round two asked the same word of
new frames, printed bigger numbers, and inherited round one's verdict without
being looked at. The first run of a court earns its attention; the re-run is
where the skipping is cheapest and least noticed.
*Banked:* fable-1485 §3, corrected at opus-1135; findings at opus-1134 and the
four overlays in `output/two-paths-court{,-round2}/READ-WARDROBE-chest*.jpg`.

---

## Adding to this file

Follow the admission rule at the top: numbered Fable ruling, real incident, one
line each, citation. Keep it to a page or two — **terse over complete.** A
doctrine file long enough to skim past is an instrument nobody reads, which is
the failure mode all twenty-four of these describe.
