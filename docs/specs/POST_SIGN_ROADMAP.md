# Post-Sign Roadmap — founder-ruled items awaiting their slot

Canonical home for roadmap rulings and deferred commitments. Each item
cites its ruling. Nothing here is built before its stated gate;
nothing here may be silently dropped. Session memory and the mailbox
POINT here — this file is the survivor. Reconciled against the full
mailbox archive, memory, and DECISION_LOG by the lost-pin audit of
2026-08-09; items marked (L#) were recovered by that audit.

## 0. CAMPAIGN PRECONDITIONS — owed BEFORE Tier A scores (not post-Sign)

- **Frame-05 / removal-composite hair silhouette** (L1): owed its own
  frames before Tier A scores removals against `hairWorn`
  (fable-059/060/061). The segments pivot does NOT moot it — removals
  still ride the departed/vacancy machinery. **That sentence is still
  true and still current** — `invisibleRemoval.ts` (fable-398 §3): *"the
  slot is retired and a vacancy is filed so every later render says the
  absence"*, on migration 0030's `vacancy` role.

  **But it answers a different question than this item's name asks, and
  the item is PASTE-ROAD ONLY** (opus-602, ruled fable-813 §2). The check
  fable-059 named is *"the removal **composite**'s hair silhouette at the
  sides"* — the concern being that a wording which makes a **compositing
  artefact** read correctly would be hiding it. **A compositing artefact
  cannot exist where nothing is composited.** On the repaint road the
  engine's own frame IS the delivered frame, so the frames this
  precondition owes are **unbuyable there** and it is **LIVE for every
  non-repaint user — today, everyone but him. It closes fully the day
  `CASTING_REPAINT_SCOPE` widens to all users**, exactly as the
  seam-check bullet below it does. The vacancy machinery is
  road-independent; the composite is not.

  *Its twin was ruled on this exact ground.* Frame-05 and the seam-check
  flip were recovered TOGETHER by the lost-pin audit as the two campaign
  gates between 2/2 and Tier A (fable-110 §1/§2, fable-111); the founder
  then killed the seam-check in person on *nothing is pasted, so no seam
  can exist* (fable-709 §3). This paragraph is that one, applied to its
  sibling.

  ⚠ **OPEN, and owned:** whether this gates Tier A at all depends on
  **which road Tier A scores on**, and no document says — "Tier A"
  against road/scope words returns only §0's own headings. If Tier A
  scores his account the check is unrunnable there; if it scores the
  paste road it is fully live. **Answered by whoever opens Tier A, in the
  Tier A plan, before any scoring.**
- **Seam-check shadow→enforce flip decision** (L12) — ⛔ **the flip decision
  is DEAD (founder in person, fable-709 §3, 2026-08-16).** His reasoning
  holds on the repaint road: nothing is pasted, so no seam can exist. Do
  NOT raise it before Tier A. The shadow seam-check may keep logging on any
  paste-road render that still occurs — the paste road survives behind the
  flag split (`CASTING_REPAINT_SCOPE=users:1`) — and **the item CLOSES
  fully the day repaint scope widens to all users.** The specimens that met
  the old trigger are kept for the record: 775 torn px (opus-024) + GPT2's
  torn frames at 848 (opus-068).
- **Truncation-notice verification** (L17) — ✅ **CLOSED 2026-08-16. It did
  not verify; it FAILED, and the fix is a class fix.** Read at the wire (real
  schema off the real `castingV2.createRoll` procedure, real error formatter,
  real express adapter): a 2,001-character brief was refused correctly and
  put zod's serialized issue array on the customer's screen, verbatim, under
  the action "Edit the brief" — `[{"origin":"string","code":"too_big",…,
  "path":["briefText"]}]`. An invalid sessionId printed the validation regex.

  Both client rules were reasoning from a premise true against gateways and
  false against our own framework: `failureCopy.ts` states it — *"the code
  list is the structural argument that a gateway cannot forge a 400"* — but
  tRPC authors a `BAD_REQUEST` for every input failure and fills its message
  with machine text. The `spoken` marker, built for exactly this, was absent
  and correct, and the older code-list evidence overrode it.

  Fixed at the errorFormatter (`server/_core/invalidInputMessage.ts`), not at
  the ~30 `toast.error(err.message)` call sites — that is the mirror law 4
  forbids and it reopens with the next `onError` written. One place, all 260
  procedures, every consumer present and future. Guarded at the wire by
  `server/_core/invalidInputWire.test.ts`, both sabotages reddening only
  their own arm. Sibling swept in the same commit: the Express signup/login
  routes surface `issues[0].message` directly and all six `.max()` ceilings
  had no authored message — and `emailAuth.test.ts` was asserting a
  **transcribed copy** of the schema that had already drifted from its
  source, so the real schemas now live in `server/routes/emailAuthInput.ts`
  and the suite imports them.

  *The brief-box character counter is **KILLED**, not open* — the founder in
  person, 2026-08-16 (fable-710 §1): *"skip the character counter i never
  remember wanting that."* He never asked for it; it was our idea filed
  behind his word, and it dies entirely. The polite over-limit refusal stays
  exactly as it is. (`maxLength` was rejected on its own grounds too: it
  would silently swallow a paste, a worse defect than the rude error it
  replaced.)
- **`bornWornCatalogue` has NO CALLERS** (opus-094, filed by
  fable-121). Built, tested, guarded by two sabotage runs, and invoked
  from nowhere in the product — so **no `detected_born` row can exist**,
  and the whole "she came with it" half of the segment vocabulary is
  unreachable. Verified 2026-08-09: the only importers are its own test
  and the sabotage roster — **that half still holds and was re-read
  2026-08-17** — ~~`bornWornDetector` reaches production code through the
  catalogue alone, plus one calibration script~~ **(FALSE since
  2026-08-14; see the correction below).** The invariant-7 shape exactly —
  helper written, docs written, call site never added.
  *Not a Tier-A blocker*, and deliberately not built inside the
  stop-line. The segments panel wanted a "she came with it" row and could
  not honestly draw one (opus-094); the row returns the day the catalogue
  is invoked.

  ⚠ **The clause beside it is FALSE as of 2026-08-17** (opus-608, ruled
  fable-819 §2). It read *"`bornWornDetector` reaches production code
  through the catalogue alone, plus one calibration script"* — true when
  verified on 2026-08-09, and overtaken since. The **detector** has three
  production importers and the catalogue is not among them; all three are
  value imports of live functions, called:

  ```
  server/castingV2/faceScan.ts:63    armedBornWornClasses, detectionFloorFor
      :147  new Set(armedBornWornClasses().map(...))
      :419  detectionFloorFor(region.question, bilateral ? "side" : "frame")
      THE LIVE AUTO-SCAN — CASTING_FACE_SCAN_SCOPE=users:1 on his account
  server/castingV2/refineService.ts:200   departureFloorFor
      :1778 presentInBase = coverage(seen) > departureFloorFor(asked).floor
      THE PAID REFINE PATH — the "was this already on her face" decision
  server/castingV2/detectionUniversality.ts:40
  ```

  `faceScan.ts` did not exist on 2026-08-09. **So the catalogue is the one
  route that is dead, and two live paid paths reach the detector around
  it.** *(History, kept as the record: "through the catalogue alone, plus
  one calibration script", verified 2026-08-09.)*

  **The consequence, in one line: RETIRE deletes a WRAPPER, not a
  capability.** Retiring `catalogueBornWorn` does not retire
  `bornWornDetector`, which keeps consumers that never went through it —
  so the founder card this fork promises must be posed as **durability**
  (*does "she came with it" ever become a durable fact?*) and never as
  ability, because the ability is already shipped and running on his own
  account.

  ⚠ **UNREAD, and it must not do unearned work in the lean:** whether a
  catalogue call could ride a detector read the live scan has ALREADY
  bought. The cost sentence below prices wiring at *"house money per face"*;
  that was written before the scan shipped and has not been re-read against
  it. Triage owns the question.

  **Bound: importers and call sites were read.** Whether the detector's
  three consumers survive the catalogue's deletion was **not** run — they
  do not import it, but "nothing suggests otherwise" is not a suite run
  against a deletion and is not offered as one.

  **The linkage this entry used to carry is DEAD, and the fork now has an
  owner** (opus-601, ruled fable-812 §2, 2026-08-17). It read *"its first
  honest consumer is the Sign-time scan (fable-092), which is ACTIVE
  work — that is where the call site belongs."* Read at the artifacts:
  `"Sign-time scan"` appears in **one line of this repository** — that
  one; `fable-092` is cited in **one line** — the same one;
  `M12_RECONCILIATION.md` contains the string `scan` **zero** times, as
  does `CASTING_V2_ARCHITECTURE_PLAN.md` for `bornWorn`; the last work on
  it was 2026-08-09/10. The entry deferred its call site not to a task
  but **to a piece of work no document owns**, which is the orphan one
  level of indirection out. `catalogueBornWorn`'s only importer is still
  its own test.

  **And a scan DID ship — a different one, over the same vocabulary.**
  `CASTING_FACE_SCAN_SCOPE=users:1` is live on his account; `faceScan.ts`
  asks accessories only when their class is ARMED
  (`armedBornWornClasses`, the born-worn roster itself) and its first
  stated boundary is **"IT MINTS NOTHING"** — geometry only, no rows, no
  objects, no manifest. So the product has two readers of *what she
  already has*: the one that would file a durable `detected_born` fact
  and has no caller, and the one that is live, spends house money per
  version, and deliberately keeps nothing.

  **Both readings, side by side, because the record does not settle it.**
  (a) *Unwired* — the catalogue is the durable half and still wants a call
  site. (b) *Superseded* — `faceScan.ts` cites **fable-360 ruling 5**, the
  founder's own (*"we dont need to reference anything if it hasnt been
  changed from the original"*), and if that governs the durable half too
  then `detected_born` is a vocabulary this product decided not to keep.
  Nothing in the record says it was read that way, and
  `CASTING_V2_SEGMENT_PERMANENCE_DESIGN.md` §12b now carries the same
  correction rather than describing the row in the present tense.

  **Owner of the fork: the CLEANUP MILESTONE (§0b).** Its triage answers
  wire-or-retire — `catalogueBornWorn` is already on that list's floor.
  Wiring costs house money per face for rows nothing reads today; and if
  the triage leans RETIRE, **that goes to the founder as a card at that
  time** — whether *"she came with it"* ever becomes a durable fact is his
  ontology (law 8) and is never closed by deletion alone.

  ⚠ **Before anyone touches this symbol either way:**
  `catalogueBornWorn` is the **independent positive control** of the
  uncalled-exports sweep (`scripts/sweep-uncalled-exports-disposable.mts`,
  printed `positive catalogueBornWorn FOUND PASS`). Wiring it or deleting
  it kills that control silently — the "specimen joins the vocabulary"
  trap, walked into twice already in both directions. **A replacement
  control is chosen in the same commit as any change here.**

## 0b. THE CLEANUP MILESTONE — founder-ordered, and its slot is the point

*(fable-710 §2, in person 2026-08-16. Filed here 2026-08-17; it had lived only
in the mailbox until then.)*

**His grounds, verbatim:** *"we have done so much testing and changing of
systems with this design."*

**The slot, which is the half that was lost:** after V5 lands and M12 is closed
out, **BEFORE M8 starts.**

```
polish queue → V5 → M12 close-out → CLEANUP → M8
```

**Scope, drafted at ruling time precisely so it would not be reinvented**
(fable-710 §2): disposable scripts swept (keep only what a standing instrument
cites), probe/output directories cleared, dead flags and superseded code paths
retired **with the Atlas as deletion authority** (nothing removed while its
retirement view shows live callers — the M14 discipline applied early at small
scale), stale spec sections marked superseded, the seam-check death
(fable-709 §3, §0 above) executed if repaint scope has widened by then, and the
roadmap file itself re-audited top to bottom.

⚠ **THE ATLAS HAS ONE COMMITTED ARTIFACT, and `index.html` is never a second
opinion** (opus-611 §3, ruled fable-822 §3, 2026-08-17). `git ls-files
docs/architecture/` returns three names — `annotations.yaml`,
`drape-architecture.json`, `drape-architecture.schema.json`.
**`docs/architecture/index.html` is gitignored (`.gitignore:21`, with its
reason written above it) and `git log --all` shows zero commits touching it,
ever.** It is regenerated locally from the tree, so it agrees with the tree by
construction — which is the same as agreeing with nothing.

This is written here because the record briefly used it as corroboration: a
stale committed JSON was diagnosed on the ground that *"index.html already
held"* the canonical fingerprint and was therefore *"the stronger anchor"*
(opus-609 §4, ratified fable-818 §3). **The action was right** — the JSON was
stale, regenerating was correct, the check is green — **and the anchor was the
canonical tree all along.** A shift that reaches for the HTML as a second
witness is reading its own output back.

*(One consequence, since an untracked file cannot be checked out: whatever the
Windows CRLF footgun in `7b99e466`'s commit message describes, it is not
`index.html`. Whether it holds for the JSON has not been re-derived and is not
claimed either way.)*

**One named candidate arrives from the L7 read** (opus-612 §4, fable-823 §2):
`client/src/components/ui/sidebar.tsx` is a shadcn primitive **nothing in
`client/src` imports**, and it is the only other cookie writer in the product
(`sidebar:state`, never set). It is a client-side candidate rather than one of
the sweep's 177, whose scope is server exports — worth a line here because the
triage's list would not have found it.

**ITS FIRST CUSTOMER, AND WHAT TO BUDGET FOR IT** (fable-809 §3, filed
2026-08-17 rather than when the milestone opens, because a scope line nobody
wrote is how §2 and §3 of fable-710 were lost in the first place). The
mechanical sweep `scripts/sweep-uncalled-exports-disposable.mts` prints a list
of production exports no production code references — **179 at its first run, a
FLOOR** (three biases in the method all point toward silence: namespace
imports, computed dynamic specifiers, barrel re-exports). Two were read and
closed on 2026-08-17 (§6), leaving **177 candidates**.

**Budget against reading them, not against fixing them.** The 179 is a
candidate list, not a defect list: of the two entries anyone has actually read,
one was a missing control (`BANNED_ENGINES` — a founder ruling with no call
site) and one was a harmless-looking mirror that was the more dangerous of the
pair (`USER_RATE_LIMITS` — security-adjacent, different numbers, a future
reader would have tightened it and shipped nothing). Nothing but a code-first
read tells those two apart, and each fix was minutes once the read was done.
**The triage is the expensive half.** The sweep itself is reading-only, carries
five printed controls (two positive, three negative) and REFUSES to report if
one fails.

**One candidate arrives already triaged, and this milestone owns its verdict**
(opus-601, ruled fable-812 §2). `catalogueBornWorn` — §0's born-worn entry —
has been read to the bottom: both readings are written out there, the
supersession counter-reading is fable-360 r5, and the answer is
**wire-or-retire, not a fix.** A RETIRE lean goes to the founder as a card at
that time, never closed by deletion alone. Note the trap before touching it:
that symbol is the sweep's own **independent positive control**, so any change
to it chooses a replacement control in the same commit. No second list is kept
here — §0 holds the reasoning, this line holds the ownership.

**How it was lost, because the class outlives the item.** fable-710 carried
three orders from one sitting. §1 — the character counter's death — is written
into §0 above and cited. §2 and §3 were not written anywhere, and
`grep -rn "fable-710" docs/` returned exactly one line for a day. Meanwhile
`M12_RECONCILIATION.md` told whoever closes M12 that the next thing is M8, with
nothing in between. **One message, three orders, one landed** — a shape no
deferral phrase and no failing check can catch, found only by reading the
ruling against the file it governs (opus-596 §2).

## 1. Latency AND COST program (first, after the walk campaign; founder-elevated 2026-08-10)

Median 39s → 151s regression (2026-08-08); founder: "5 minutes for 1
generation is absurd." Stopwatch every stage before optimising.
Enumerated sub-items (L3): **the gateway-outliving-refine topology**
and **the run-15 timestamp audit** — both read at the artifacts on
2026-08-17 (opus-614/616, ruled fable-825/827) and re-posed below.
Related: first-generation
paint softness (hair ~0.51–0.56, brows ~0.48–0.56 vs master, twice
measured) → the **engine sharpness comparison** (NBP vs GPT2 on
hair/brows) rides with item 6's routing question.

### The run-15 timestamp audit — ✅ **CLOSED. It was reported done, and it shipped**

The line above read *"never reported done"* for nine days. It was answered
**opus-059 §4, 2026-08-08**, with the timestamps: run-15 step 2 completed
honestly at **293.0 s** (`facts_missing`, refunded 25, the true sentence
written) and the panel showed *"We lost contact while that was rendering"* at
**323.6 s**. The mechanism was named the same night — an authored refusal thrown
as `INTERNAL_SERVER_ERROR`, the one code the client must never trust — and the
fix shipped: the **`spoken` marker** (`shared/spokenError.ts`,
`server/_core/spokenError.ts`), wired into the real error formatter at
`server/_core/trpc.ts:51` and checked FIRST in `readableFailure`
(`client/src/lib/failureSentence.ts:89`). All five sites opus-059 named now
throw `spokenError(...)`, `signService.ts:525`/`:533` included. Re-read at the
artifacts 2026-08-17.

### The gateway topology — ⚠ **OPEN, and now priced instead of adjectival**

A refine is **one long-held mutation**: `castingV2.refine` awaits the entire
render before it answers, so the customer's exposure is the operation's own
life. Read off production (`scripts/read-refine-wall-clock-disposable.mts`,
both controls printed first):

```
world :23768   199 settled refines — ALL user 1. This is a launch ESTIMATE
               from the only usage that exists, never a customer rate.
  worker-settled (a render)  180        recovery-sweep-settled  19
  held-request seconds, worker-settled only (n=180)
    median 121s · p75 151s · p90 231s · p95 276s · max 390s
  under 240s 164 (91.1%) · 240-290s 11 (6.1%) · 290-305s 2 (1.1%)
                                              · 305s+ 3 (1.7%)
```

**The wall is OBSERVED, not a Railway setting anyone has read**: run-9's step 5
waited **304.9 s** and was answered by a gateway's plain-text 502
(`failureSentence.ts` header), and run-15's 293.0 s was already too late.

**Two instrument bounds, written here so they are not re-derived:**

1. **`completedAt − createdAt` is two different clocks under one name.** For a
   worker-settled operation it is the render; for a **sweep-settled** one it is
   the recovery clock — the 300 s lease plus up to one 60 s sweep, the window
   CLAUDE.md documents as the accepted deploy-collision cost. Pooling them
   manufactured a cluster past the wall out of a class that never rendered:
   the first reading of this said 4.0% past 305 s and p95 290 s, and both were
   artefacts.
2. **The structural discriminator is unavailable for 18 of 19 sweep rows, and
   not because of a missing stamp.** `refineRecovery.ts:197` has the *only*
   `failVariant` call and it fires whenever there is a live row to take over —
   but **15 sweep-settled refines have no variant row at all** (the operation
   was claimed and charged before one existed) and 3 had already been failed by
   the service with a truer class, which `failVariant`'s `queued/dispatched`
   predicate correctly refuses to overwrite. So the sweep arm is keyed on the
   sweep's own sentence, admissible only because it was proven unique first —
   one writer outside tests. **At the time of this reading that sentence was
   *"That refinement didn't come through. Your credits have been returned."*;
   it was rewritten in the same commit** (it can now reach the customer as a
   toast, so it had to join the settling line's voice) and is a named export,
   `RECOVERED_REFINE_SENTENCE`. A re-run must key on the constant, not on the
   string quoted here.

**What crossing the wall costs, in the customer's terms.** Three renders have
answered past 305 s: two honest refusals carrying the *actionable* half
(*"…so it wasn't delivered and your credits have been returned. Try saying it a
different way."*, both 2026-08-08) and one delivered picture at 328 s. The
`spoken` marker cannot rescue any of them — it marks a sentence on a response,
and the socket carrying that response is already closed. **The money is covered**
(LOST_CONTACT promises the refund and the recovery sweep keeps it); **the reason
and the way forward are lost.**

**The surface could not supply them either — ✅ FIXED 2026-08-17** (ruled
fable-825 §2 / fable-828 §3). A terminal refine failure is in neither of the
sheet's two lists (`status='ready'`, `status IN ('queued','dispatched')`), so it
leaves the payload entirely, and the `GenerationOperationBridge` held
`publicMessage` and was told not to say it — `surfaceOwnership.ts` listed
`castingV2.refine` as owning its own outcomes, an argument true for every case
except this one. **`castingV2.refine` is off that list**; its ownership is now
per REQUEST (`client/src/features/operations/outcomeShown.ts`): the panel
records whether what it showed was the server's own sentence or its fallback,
and the bridge speaks only when the true sentence reached nobody. Roll and sign
stay on the kind list — their surfaces genuinely can represent a terminal
failure. Driven in the running app, both arms, with the fix sabotaged to prove
the driver reddens.

*(A row the sweep is taking over was always narrated: `CandidateViewer.tsx`
renders the `settling` stage as "this one didn't make it" with "your credits
come back on their own". That copy covers all 19 recovery rows; it cannot cover
a render whose worker never died. The sweep's own sentence was rewritten into
that line's voice — one story in two beats — since it can now follow it.)*

**The real answer is to stop holding the request** — the sheet already polls, so
the machinery exists; the mutation would dispatch and return, and the outcome
would arrive on the surface like every other durable fact. That is an
architecture item for this program with a price, and it is what retires the
class. **Ruled NOT to be a founder Railway ask** (fable-825 §3): moving a
timeout treats the percentile, making the answer arrive treats the customer.

**One instrument finding, ruled DISCLOSURE rather than inclusion** (fable-828
§2): the 15 sweep-settled refines with no variant row never enter the
reliability report's denominator, which reads `FROM
casting_candidate_variants`. That is **7.5% of his paid refines absent from the
number D-236 made the sole source of the delivery rate**. Excluding them is
arguably right for what the bar MEANS — a deploy-collision death is not the
product failing to deliver a picture — but excluding them silently is not, and
it flatters the figure in the one direction nobody checks. The report now
counts and prints them with their reason (`countRecoveredExclusions`), and
prints "NOT COUNTED" rather than a confident nought when a caller does not
supply the number. No money is wrong: all were charged and refunded.

**COST half (founder, 2026-08-10: "costs are getting ridiculous — after
we lock everything in we need to optimize massively, both render times
and cost"):** a per-render call census (calls × model × when), the
invoice split campaign-instrumentation vs product-per-render, and
cost-per-render vs the 25-credit price per edit class. Named levers:
master-region CACHING (same unchanged master re-segmented every render
— free win, may land pre-program), retry economics per class (every
miss costs two paints), NBP routing pending its n≥20 court, and
text-call budgets (verification readings are the OpenRouter driver).

**FIRST READINGS, 2026-08-15 (opus, free — five delivered dev renders and one
direct probe; artifacts in `output/court-carried-words/*.log`):**

```
a delivered refine    19 calls · wall 149-280s
  render   1 call  ~100s   GPT Image 2, and it is 40-65% of the wall clock
  segment  9 calls 46-123s SAM 3
  read     9 calls 44-54s  Sonnet 5
```

Two corrections to the levers named above, both from artifacts:

1. **Master-region caching buys nothing on the repaint road.** A repaint has no
   harvest, so `masterRegions` arrives EMPTY and the mint reads the DELIVERED
   frame instead (`refineService`, the `readGround` note) — a picture that has
   never existed before, so there is nothing to cache. The lever was written for
   the paste road. On the repaint road the cost is the number of reads, not
   their repetition: two independent reads per slot (ground and guard) is a
   deliberate structural cost, and the sweep should start with how many SLOTS a
   render reads rather than with a cache.
2. **One bilateral region costs three provider calls, and the face read is most
   of the wall clock.** Measured at the wire on a real frame: one
   `region({ name: "earring" })` → `face 1 call 13.7s · earring 2 calls 9.3s`.
   fable-132 predicted the call count; the timing says the MIDLINE HINT is the
   valuable half of that fix, not the halves.

Both readings are now self-reporting: the census summarises `byAbout` — the
question each call asked — and every render and every face scan logs it. That
field was recorded on every call since `aboutOf` existed and summed nowhere,
which is why "what are the nine calls" needed a special run until today.

**THE FIRST POPULATION READING, 2026-08-16 (opus, free — 56 dev renders and 4
production ones, read off rows already paid for; `scripts/call-census-report.mts`,
commits `ce11e3de`/`c7039b9d`/`6e155ea7`).** The five-render glance above is
superseded by a window, and the shape held across two independent worlds:

```
                    DEV (:52008)              PRODUCTION (:23768)
renders measured    56 of 68                  4 of 18
wall                median 200.0s p90 242.9   median 172.2s p90 210.1
sum ÷ wall          0.96×                     0.96×

render   57 calls  56.9%  107.1s each   |  render   4 calls  60.1%  98.9s each
segment 294 calls  21.8%    7.9s each   |  read    39 calls  31.1%   5.3s each
read    352 calls  21.3%    6.5s each   |  segment 32 calls   8.8%   1.8s each
```

Four things this settles, and one it opens:

1. **The paint is 57–60% of the clock and it is not ours.** The founder's
   *"5 minutes"* is real but is the TAIL — the middle is ~200s dev / ~172s prod.
2. **`sum ÷ wall` is MEAN CONCURRENCY**, not "serial round trips": the sum of
   call durations over an interval is the integral of concurrency across it, so
   0.96 says a render spends its clock with about ONE provider call outstanding
   — the parallelism there is and the idle there is cancelling to one. Both
   `censusSoFar` biases run downward, so every figure here is a FLOOR.
3. **The axis cache is visible in the product's own rows.** `face` reads at
   **0.59/render (dev) and 0.50 (prod)** — below one, which is fable-603's
   per-candidate midline working. The first time this program has read one of
   its own optimisations back off data rather than claimed it.
4. **The read stage WAS anonymous and now is not.** Its 352 calls carried no
   `about` at all, so a fifth of every paid edit was un-attributable while the
   equally-sized segment stage was fully named. Twelve closed purposes now ship
   (`ReadPurpose`), split per re-ask DOOR — the colour door fires on 21 of 360
   attempts and its price was invisible. Readings also carry TOKENS now, since
   Sonnet is token-billed and calls-and-milliseconds cannot price it;
   **unmeasured is recorded as unmeasured, never as zero.**

**Open, and pointing at code we control: SAM 3 costs 8.0s a call in dev and 1.8s
in production**, uniformly across questions. Contention was the obvious
explanation and it FAILED its own test — holding it at zero on both sides,
dev-alone 6.99s against prod-alone 1.81s is still 3.9×
(`scripts/sam-latency-worlds-disposable.mts`; within-dev contention is a real
but small 1.32×). The residual leans toward payload or pixels — `face`, the only
whole-frame read in the table, is also the slowest question in dev at 9.33s —
and settling it needs an artifact-level read of what bytes went on the wire.

**Every row above predates both the purposes and the tokens**, so this is the
last UNPRICED reading rather than the first priced one. Cost-per-render against
the 25-credit price becomes a query once ordinary use accumulates rows.
A price table does exist and was overlooked once already:
`FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE = 0.099`, measured off the account
balance rather than a rate card (`server/providers/falImages.ts:88`).

**Filed here by fable-132, deliberately NOT slipped in behind the D-238
fix:** a bilateral region now costs **three** segmentation calls instead of
two (the face, for her own midline, then the plain noun once per half) and
one extra round trip, the two halves still parallel. An `eye.colour` refine
pulls `eyebrows` as an occlusion companion, so it goes **5 calls → 7**. The
clean way to get the extra call back is to thread an **optional midline
hint** through the `RegionReader` interface from callers that already hold a
face mask — a real interface change, decided here on latency evidence rather
than inside a bug fix. Deleting `readCanthalTilt`'s rung 1 (also D-238) pays
four calls per tilt read back immediately.

> **The price above is PRE-CACHE, and this paragraph is the correction**
> (ordered fable-834 §3, from opus-623 §3c). The "third call" it charges a
> bilateral region is the FACE read for her midline — and the per-candidate
> axis cache has since amortised exactly that call, measured off this
> section's own rows: **`face` reads at 0.59/render in dev and 0.50 in
> production**, below one and therefore no longer once per bilateral region.
> The lever is still open (fable-132 filed it deliberately undecided) but its
> **size is quoted against a world the product has left**, and a ruling made
> from the 5→7 figure would be pricing a call largely already stopped. Nothing
> here re-scores the reading; it names which world it was taken in.
>
> *(The last sentence, about `readCanthalTilt`'s rung 1, reads as owed and is
> NOT: `git log -S` puts both that deletion and this sentence in the same
> commit, `d355fa53`, 2026-08-10 — whose message says "Filed, not decided: the
> 5→7 call cost". The sentence records what that commit delivered. Written
> down because the tense has now caught one reader (opus-623 §3b) and the next
> one will read the same words.)*

### THE SLOTS READING — the sweep's own starting number, and it moves the lane

Ordered fable-834 §1 from opus-623 §4, because the paragraph above this section
says the sweep *"should start with how many SLOTS a render reads rather than
with a cache"*. It now has. Read off rows already paid for — **no render, no
segmenter call, no credit** — by `scripts/slots-per-render-disposable.mts`,
whose two controls run first and refuse the verdict on failure (a synthetic row
of 3 known slots and 7 known segment calls must read back as exactly that; a row
with no repaint record must read UNMEASURABLE and one with no census NOT
MEASURED, never 0).

Slots come from `internalPrompt.repaint` — the dispatch record, whose
`references[]` name their own `slot` beside `edited`/`carried`/`vacated` — and
not from counting region nouns in the census, which would have folded the
occlusion companions and the guard's second look into the slot count.

```
                        DEV :52008              PRODUCTION :23768
window                  since 2026-08-07, all users, both worlds
rows / repainted        73 / 66                 24 / 20
slots per render        1:12 2:16 3:31 4:3 5:4  1:9 2:5 3:2 4:1 5:1 6:2
                        median 3 · max 5        median 2 · max 6
census coverage         56/66                   6/20
```

**Three things it settles, and one it explicitly does not.**

1. **Slot count is SMALL** — median 3 in dev, 2 in production, max 6 anywhere.
   Nobody had read this; the sweep was being pointed at a number assumed larger
   than it is.
2. **"Two independent reads per slot" is CONFIRMED for the segment stage**, in
   the largest cell there is: 3 slots, n=29, **6.6 segment calls per render =
   2.2 per slot**. The roadmap's structural claim was right about what it named.
3. **And that makes slot reduction worth about a penny.** At the face scan's own
   measured rate ($0.100 for 20 segmenter calls = **$0.005/call**), removing one
   whole slot saves ~2.2 calls ≈ **$0.011 per render** — against a $0.099 paint
   and a token-billed read stage that is the OpenRouter driver. **The cost lane's
   named slot lever is not the cost lever.**
4. **UNSETTLED — whether the READ stage scales with slots.** Dev says no
   (read/render 4.9 · 7.2 · 6.2 · 5.5 · 7.0 across 1→5 slots, n=56, flat while
   segment climbs 0.5 → 8.0). Production's six censused rows lean the other way
   (6.0 · 15.0 · 12.0 · 8.0) but **every one of those cells is n=1 or n=2** and
   none is quotable. Two worlds, one flat and one noisy, is not a finding.

**The mechanism behind the flatness is NOT MEASURED, and that is why 4 is
unsettled rather than settled.** A flat line can be manufactured by truncation —
`censusSoFar` snapshots at the landing, so every figure here is a FLOOR. The
honest test was to name the read stage's purposes: **25 labelled read calls
across both worlds are ALL per-render (`caption`, `verify`, `interpret`) and not
one is per-slot** — which points at genuine flatness, at n=25. But coverage is
**9/361 in dev and 16/55 in production**, because `ReadPurpose` shipped
2026-08-16 and this window mostly predates it. That is a hint, not a mechanism.

**What it means for priority** (the paragraph fable-834 §1 asked for): the cost
lane's next question is the **read budget per render**, which is token-priced and
whose slot-scaling is exactly what could not be settled here — and the instrument
that would settle it (`ReadPurpose`, plus tokens) is at 2.5–29% coverage and
fills itself with ordinary use. So the cost lane's honest next move is to **let
the purposes accumulate and re-run this**, not to build a third reading on a
nine-call sample. Which leaves the **exposure lane** — the held request — as the
one that can actually be worked now, on evidence rather than for want of
anything else. *(This inverts the executor's own recommendation in opus-623 §4,
which is what the reading was for.)*

One incidental finding, filed not fixed: **`askScope` is present on 2 of 20
production rows and 0 of 66 dev rows**, so the pointed-vs-typed split exists in
production only — and both pointed rows carry **6 slots**, the maximum observed
anywhere, against a typed median of 2. Suggestive at n=2 and no more.

#### THE RE-RUN TRIGGER — named, so it is not a "whenever" (ruled fable-835 §3)

The read-budget question above is **UNSETTLED on purpose**, and the ruling is
that no house money is spent to hurry rows ordinary use writes for free. So it
has a trigger rather than an intention, and the trigger is mechanical:

> **Every shift OPEN runs the one-query coverage check.
> The re-run fires when PRODUCTION censused-with-purpose repainted rows reach
> 25.** Until then the flatness stays a hint on the record and is quoted as one.

```
railway.cmd run --service MySQL -- npx tsx scripts/slots-per-render-disposable.mts --coverage
```

It prints one line — the count, the bar, and FIRES or HOLDS — and it is the
same script that produced the reading, so the trigger cannot drift from the
instrument that answers it. At the reading (2026-08-17) production stood at
**16 labelled read calls over 6 censused repainted rows**; the bar counts ROWS,
not calls.

*(Why a row bar and not a call bar: the question is whether reads scale with
slots, so the unit that has to accumulate is the render, and 25 rows is what
puts more than n=1 or n=2 in each slot-count cell — which is exactly what made
production unquotable this time.)*

## 2. The honest loader (with #1 — same instrumentation)

Real stage transitions only, product voice, NO invented percentages
(fable-020). Interim copy shipped. Owed inside it: **the D-169
loading mock including the re-ask chip states** — the one artifact
still promised to the founder from the paraphrase thread. Small UX
rider (L13): the follow-up-queue chip (a refused compound chip
queues its second half as a follow-up sentence) — filed fable-069.

## 3. The face chart + tattoo studio (post-Sign; skeleton is M12)

**Panel v1 PULLED FORWARD (founder, 2026-08-09, fable-113):** a
read-only segments panel (crop thumbnails, stylist-named, per-variant
via lineage, tap-to-prefill) builds right after the fable-112
stop-the-line fixes — mock to the founder first per D-101/F5. The
full chart below stays post-Sign.

Tappable, human-named chart of her segments (stylist's ontology);
tap → sentence box pre-scoped; per-segment version history. Segment
store (live 2026-08-09) is the foundation. **Tattoo-studio
extension** (founder 2026-08-08): detected ink as INDIVIDUALS,
restyle/resize/move/remove on the patch machinery. **Governing law
D-138 stands:** ALL ink — asked or reference-supplied — via the
FLASH-SHEET path (mannequin templates, tone ladder, no text);
references frozen at introduction (D-192); D-139/140/141 carry.

**Makeup face charts (founder idea, 2026-08-10 — parked here, not
ruled):** "maybe it should be designed on a face mannequin same as
the tattoos idea — every iteration of makeup is stored on a
mannequin face." I.e. a whole makeup LOOK designed/recorded on a
neutral mannequin face chart (the real MUA tool), frozen at
introduction like a flash sheet, transferable to any cast, removable
as one thing. Sits ON TOP of the ruled per-feature handling
(fable-168: words propose, acceptance mints the anatomy-slot
reference — per-feature slots remain the source of truth). The
fable-168 "grouped Makeup look row" taste question folds into this
item; both deferred together until this studio's turn.

## 4. "Show her the refused frame" — ✅ **RULED AND SHIPPED 2026-08-16**

**The reader stopped being a cashier.** Founder, in person, second statement
of that night (fable-721): *"the verification layer was trash… only give
refunds on catastrophic failures because it couldn't truly detect something
as subtle as freckles."* Earlier the same night he had said it
conditionally (fable-709 §1 — *"if refused frames are only catastrophic
failures then it can stay, but don't show the refused frame at all"*); the
freckle overturn at the frames met the condition, and this is the order.

**The contract now, and it is LIVE in production** (`5c5a1f3f`, countersigned
per fable-721 §3 / fable-723 §3, deployed):

- **Refunds after a render happen for three failures only**, named in one
  place — `REFUSES_AFTER_RENDER` in `server/providers/types.ts` — and pinned
  verbatim by `server/providers/providerFailureContract.test.ts`:
  `render_fault` (not a photograph of one person: torn, corrupt, wrong
  human), `composite_fault` (our own compositor cut a fine frame), and
  `segment_store` (our inputs failed before an honest render was possible —
  infrastructure, not a judgment about her picture).
- **Everything else DELIVERS and CHARGES.** A disputed delivery is the
  customer's judgment; the remedy is Regenerate, at a fresh charge. The
  reader's verdict is still recorded and still read by the reliability
  report as `delivered_absent` / `delivered_noncompliant` — telemetry that
  costs nobody a refund.
- **The refused frame is still never shown** (his 2026-08-09 clause, kept).
- **Pre-render refusals are untouched**: asks the product cannot state and
  forbidden recipes still refuse before the provider is contacted, with no
  picture and no charge to argue about.
- **Adding a member to that set is a founder decision**, like adding a
  public endpoint.

Companion principle, unchanged: **the checker judges EXISTENCE against her
own words only; intensity/density belongs to her words or nobody.**

**What remains is one reading, and it decides nothing** — the refused-frames
classification, REPURPOSED by fable-721 §3 from decider to **calibration**:
what would yesterday's refusals be under the new contract, and is
"catastrophic" drawn in the right place? Every refunded render whose frame
survives, dev and production, read **by eye** against the reader's stated
reason (never by re-running the reader), and bucketed:

- **catastrophic** — torn, garbage, wrong person;
- **delivered-but-wrong** — wrong side, missing ask, drift;
- **actually-fine** — checker false positive;
- **describer-misread** — its own bucket (fable-715 §4): the describer denies
  fine sparse surfaces that are visibly there, so a refusal resting on its
  verdict is a distinct failure from a checker false positive — and if the
  checker's reader lies the way the court's reader did, some past refunds
  were refusals of DELIVERED work.

Report rates plus example frames. **Zero new spend** — the frames are already
on disk and in R2.

## 5. Open-vocabulary regions — the map becomes a cache

Founder question 2026-08-09. When the facet→region map is silent,
derive the region from HER WORDS via the segmenter; map = cache of
proven territories. Needs its own court (a hallucinated region is a
confinement hole). Known missing territories (L11): **`allSkin` is
declared and unimplemented** — `skinTone`/`skinCharacter` (a tan!)
cannot reach the masked path, and Tier A's catalogue contains tan
asks; **cheeks** ("the day a cheek region exists, the placement
table is the only thing that changes"); accessory regions —
**CLOSED 2026-08-09 (`6bc2b75e`)**, and not by adding a region to the
map. `statedAccessories` cannot have a `REGION_OF_FACET` entry, because
the region depends on the described OBJECT rather than the facet; the
placement corridor the harvest already builds is now filed under the
accessory's kind id and reaches the cutter as an override, unioned with
the master's own read and with the delivered extent read off the painted
frame. Accessories persist by PATCH from that commit. The remaining
territories above are untouched by it.

## 5b. Vague axes FAN, never collapse (founder-filed 2026-08-16; polish, V5-era)

Founder's specimen: "light colored hair" → all 8 candidates blonde
("not technically wrong, not technically right either"). Mechanism
read at the code: a STATED fact is a lock the variance pass may not
touch (`breakSignatureClusters` varies only unstated axes), so a
vague stated family resolves to its modal value independently per
candidate — the unowned-axis collapse INSIDE a stated range. The fix
shape: when a stated fact names a RANGE ("light colored", "short
hair", "warm skin"), the compile/taste pass fans candidates across
the family's members instead of letting the engine's prior pick one
for all eight — latitude spent as spread. Slots with the V5-era
interpreter work; not in the active queue by founder's word.

## 6. Engine routing for marks (evidence exists; engineering item)

NBP 6/6 at 848×1264 (its only size) vs GPT2 6/8 native; GPT2 tore
half its frames at 848. Routing is NOT a config change (NBP ignores
`image_size`). **Gate: n≥20 before any routing claim goes near the
bar** (opus-068). Over-delivery watched under item 4's principle.

**LIPS ARE ALREADY ANSWERED — do not re-litigate them blind** (founder in
person, 2026-08-16, fable-710 §3, verbatim): *"gpt image 2 won on lips because
NBP overdid it."* **LIPS route GPT2 by founder observation** — NBP
over-renders them — and under law 9 his eye on the frames is the highest
evidence this program holds, so no court re-opens that row without him.
**The open question narrows to MARKS (freckles/moles) only**; the n≥20 gate
above is unchanged and applies to what is still open. (Filed 2026-08-17; it
had lived only in the mailbox, alongside §0b's milestone, from the same
message.)

### ⛔ AN UNEXECUTED FOUNDER RULING ON THE PAID PATH — `EYE_SHAPE_ENGINE` has
### never had a call site (found 2026-08-17, opus-596 §5; ruled fable-807 §3)

**This is not a new question. It is a founder ruling of 2026-08-07 — his
cross-cast matrix, judged by his eye — that was never wired**, and is now
contradicted by two newer roads while a test asserts it true.

```
server/castingV2/eyeShapeRouting.ts:101   export const EYE_SHAPE_ENGINE = "nbp"
  header: "THE RATIFIED ROW — Nano Banana Pro, founder ruling 2026-08-07,
           after the cross-cast matrix… the routing table's first genuine
           per-class payoff"

importers, whole repo   eyeShapeRouting.test.ts  AND NOTHING ELSE
  refineService.ts:195 imports `isUpsweptAsk, readCanthalTilt` from that
  module — the gate and the instrument — never the engine.

git log -S "EYE_SHAPE_ENGINE" --all  →  10143ff8, fec4f9d8
  the two commits that WROTE it. It was never added to a consumer, so it was
  never removed from one either.
```

**What paints an `eye.shape` refine today**, all three branches read
(`refineService.ts:3813`, `:3828`, `:3835`):

| road | engine |
|---|---|
| repaint on (`CASTING_REPAINT_SCOPE=users:1` — his account) | `repaintEngine ?? defaultMaskedEditEngine` → **GPT Image 2** |
| masked path (`MASKED_EDITING_SCOPE = "users:1"`, hardcoded) | `maskedEdit ?? defaultMaskedEditEngine` → **GPT Image 2** |
| neither | `castingIdentityEngine.editWithReferences` → NBP, 1K |

So the engine his matrix chose is what a user on **no flags** gets by accident,
and he — on the newest road — gets the engine that same matrix described as
*"near-invisible on every cast (+1.4 to +1.7 degrees, at the edge of the
instrument's own resolution)"* and which *"on one cast moved the corners the
WRONG WAY"* — for the one class this program has ever failed to deliver.

**The test cannot fail.** `eyeShapeRouting.test.ts:49` is
`expect(EYE_SHAPE_ENGINE).toBe("nbp")` — a constant asserted against its own
literal, under a describe block titled *"the routing row, and its honesty about
being unfinished."* Three green tests about a row that does not exist at
runtime. Invariant 7 in its quietest form; the test dies with whichever answer
he gives.

**The honest caveat, kept rather than argued away.** `842fc1bf` (2026-08-06,
one day BEFORE the row was ratified) deliberately routed face-region masked
edits to GPT Image 2 on the face wall's evidence, so it is *possible* someone
took that as superseding this row. Nothing in the record says so, and
`refineService.ts:468` still tells its reader the opposite in the present
tense: *"Routing is per class (the recipe class on GPT2, **anatomical work on
NBP**), so the day the repaint routes differently is a day this is configured
differently."* The `repaintEngine` seam exists **for this** and is left at GPT2.

**Status: his card, on the desk (fifth item).** Re-affirm and we wire it —
which brings the real design question with it, since a repaint paints the whole
frame and a per-class row has to mean something on that road — or supersede,
and the row retires honestly with its test. **Nothing re-routes and nothing
retires until his word.**

**And it is a family, not an instance** (working law 7). Two siblings are
already tracked by hand: `bornWornCatalogue` has NO CALLERS (§0) and D-213's
record gate has no call site (§9). Two more were found by the mechanical sweep
that followed this one, both in this neighbourhood, and **both are CLOSED as of
2026-08-17** (fable-808 §2 — small enough to execute rather than overwinter to
the cleanup milestone):

- `BANNED_ENGINES` — the FLUX ban, which was a constant no production code
  read, is now a **control**: it lives in `providers/bannedEngines.ts` and both
  image transports call `assertEngineNotBanned` before dispatch
  (`falTransport.runFalImageJob`, which every fal creative/identity job passes,
  and `openrouterImages.generateCandidate`). It matches on the model slug
  derived from the list, so the same model reached through another vendor's
  namespace is refused too. `bannedEngines.test.ts` drives both seams with
  counted `fetch` and a POSITIVE CONTROL per arm; each seam was sabotaged
  separately and reddened exactly its own arm. No behaviour changes — nothing
  selects FLUX — the ruling is simply landed in a call site instead of a file.
- `USER_RATE_LIMITS` — **deleted**. A second per-user limit table nobody read,
  carrying different numbers from the live path; law 4's mirror. The site now
  carries a pointer naming the live pair (`checkUserRateLimit` with each
  route's own limit object; `RATE_LIMITS` for the IP-keyed buckets), and
  `docs/RATE_LIMITING.md` no longer teaches the deleted export.
Also filed: interpreter placement field (trigger: a specimen the
table can't place — fable-103); `earring`/`nose stud` detector
courts; the retry-as-safety-net is CLOSED by this item (routing
superseded it — fable-071/080).

## 7. Pre-launch checklist (M13 gate) — reconciled with the pre-campaign debts

- **Klieg rebrand M5b** (L4, founder-held): domain cutover, OAuth
  redirect, Resend domain, Stripe copy + the tail: TM knockout
  search, .ai/.studio/typo domains, social handles. **Plus (added
  2026-08-10): the R2 CORS policy on `drape-production` names the
  Railway domain verbatim — add the new domain to AllowedOrigins at
  cutover or in-browser pixel reads break silently.**
- **Hero assets** (L5): `hero/*` never migrated from Manus — home
  hero 502s in dev AND prod; needs founder's source files +
  `scripts/upload-hero-v3.mjs`.
- **Stripe** (L6): live keys **+ env-tag/account separation**. ✅ **THE TAG
  HALF IS BUILT 2026-08-17** (opus-610, ruled fable-821 §2); the KEY SPLIT
  remains the founder's, beside item 2's shared R2 credential.

  **The item was read at the ACCOUNT rather than at the line, and its own
  sentence was wrong in both directions.** It used to read *"dev checkouts
  currently fire webhooks at prod trusting `metadata.userId`"* — true at
  `webhooks.ts:155`, and unable to settle anything, because it says nothing
  about whether a dev event can *arrive* or whether arriving *moves money*.
  Both are readable. Read, with controls, fingerprints rather than values:

  ```
  STRIPE_SECRET_KEY   dev and prod BYTE-IDENTICAL   sk_test_ md5:66938022b5
  webhook endpoints registered on that ONE account: 1
    https://drape-production-0232.up.railway.app/api/webhooks/stripe
    enabled · subscribed to all eight handled event types
  control  negative  we_zzz_no_such_endpoint_l6 refused (StripeInvalidRequest)
  ```

  **So production is not merely reachable from a laptop — it is the only
  place a dev checkout goes**, and it verifies there, being signed with that
  endpoint's own secret. The corollary nobody had stated: **development
  receives nothing.** Dev's `STRIPE_WEBHOOK_SECRET` differs from prod's, and
  prod's belongs to the one registered endpoint, so dev's belongs to none —
  every dev subscription purchase has had its fulfilment run in production
  instead. *(Bound: a `stripe listen` CLI session makes a temporary endpoint
  that `webhookEndpoints.list()` does not return.)*

  **The money line, traced forward:** `metadata.userId` reaches exactly one
  spend — `webhooks.ts:164` → `creditReferrerOnPaidAction` →
  `referrals.ts:386` `addCredits(referral.referrerUserId,
  REFERRAL_REWARD_CREDITS)` = **12,500 credits**, two and a half times the
  whole overnight campaign ceiling, paid to the named user's **REFERRER**
  rather than to the named user. The old sentence was wrong in the target and
  orders low in the amount.

  **The other four handlers fail closed, structurally**: they resolve the
  user through `getUserByStripeCustomerId` against the LOCAL database, so a
  foreign customer has no row and returns "No user found" without spending.
  Read rather than assumed — production 0 rows with a `stripeCustomerId`,
  development 1, **overlap 0**.

  **The exposure is zero-population and self-arming**: production holds 0
  referral rows and 4 users, so nothing can be paid today — and the first
  referral arms it. That is why the tag was built now: refusing untagged
  objects is normally the hard half because legacy objects predate the tag,
  and here there are none.

  **What was built** (`server/stripe/environmentTag.ts`): every Stripe object
  we create carries `metadata.env` = a tag derived from
  `RAILWAY_ENVIRONMENT_NAME`, which the platform injects and a laptop cannot
  set by accident — **no new variable and no founder action**. The webhook
  refuses any tagged-family event whose tag is not this deployment's, and
  refuses untagged too, **before the switch — before any handler, any lookup
  and any money.** It ACKs rather than 400s: a foreign event can never
  succeed, and Stripe retries would eventually disable the production
  endpoint and break real fulfilment. The refusal is loud in the log and
  **names itself** — a dashboard-created object is untagged by construction,
  so a legitimate manual action reads as a named refusal rather than a silent
  swallow (fable-821 §2c).

  **The declared bound, not a silent narrowing:** invoices and disputes are
  authored by Stripe and by banks, carry no metadata of ours, and are **out
  of the tag's scope**. Their world check is the customer lookup above. The
  customer object is tagged too, so promoting those two families to a real
  tag check is one API read away if the overlap ever stops being zero.

  **Guarded in the L8b shape, proved both directions** — each arm a full run:

  ```
  positive  the guard call deleted from webhooks.ts   -> 4 money assertions red
                                                         (nobody paid / no tier
                                                         changed / untagged ×2)
  positive  one writer loses ...environmentMetadata() -> the tree-derived
                                                         writer scan red, and
                                                         a DIFFERENT test than
                                                         arm A — independent
  negative  the writer scanner made blind             -> "expected 0 to be
                                                         greater than or equal
                                                         to 3" — it REFUSES
                                                         rather than passing
                                                         vacuously
  ```

  The writer half is derived from the tree, not listed, so a Stripe call
  written tomorrow is in scope the moment it exists. The Atlas red that
  accompanies every arm carries no information about tags — it is the
  source-fingerprint freshness detector, and it is named here so it is never
  mistaken for coverage.
- **Cookie consent** (L7): ⚠ **RE-POSED 2026-08-17 — NOT A BUILD. It is one
  card in the M13 batch** (opus-612 §4, ruled fable-823 §2). It read *"flagged
  2026-07-10, never built"* for five weeks and nobody had asked what this app
  actually stores. The complete inventory, derived from the tree:

  ```
  COOKIES — one, and it is the session
    app_session_id   the JWT, set at five auth sites (emailAuth ×2,
                     emailVerification, googleAuth ×2). Strictly necessary:
                     without it there is no logged-in product.
    sidebar:state    EXISTS in components/ui/sidebar.tsx and is NEVER SET —
                     nothing in client/src imports that shadcn primitive.

  BROWSER STORAGE — six keys, all first-party, all functional
    drape_theme · drape_active_session · drape:cast-deleted ·
    drape:cast-projection-changed · drape_draft_hint_seen ·
    drape_has_account · drape_referral_code

  THIRD PARTIES — none
    analytics/tracking SDKs in package.json   none
    script tags in client/index.html          two, both first-party
  ```

  **So the thing this item names — a consent banner — has nothing to ask
  consent for.** Third instance this week of a correct pre-launch item with a
  zero population (beside the DPR cheap fix and L6's exposure), which is worth
  noticing as a property of a checklist written from worry rather than from
  the tree.

  **The founder card, in the M13 batch beside the key split** — no build, and
  the legal verdict is his and his counsel's, never ours: *one
  strictly-necessary cookie, seven functional storage keys, zero trackers —
  does launch need a privacy statement, and does it need a banner at all?*
  **`drape_referral_code` is named inside that card**: it persists an
  attribution code taken from a URL until it is claimed — first-party, not a
  tracker, and the only one of the seven whose purpose is marketing rather
  than making the product work. Better named than found.
- **`mintModel` concurrency double-charge** (L8): ✅ **CLOSED 2026-08-17 —
  THE MONEY IS GUARDED FOUR DEEP, and the CAS is alive at a new address**
  (opus-607, ruled fable-818 §1). The commit point was read, which is what
  this item was waiting on.

  **Mint commits at `commitGeneratedPackageSnapshot`** —
  `server/casting/snapshotTransitions.ts:1287-1311`, reached from
  `mintPackage.ts:650`. Its `WHERE` is byte-for-byte the one in
  `mintModelAtomically` (`id`, `userId`, `status='draft'`, `deletedAt IS
  NULL`, `agencyId IS NULL`, `mintedAt IS NULL`, `identityRevisionId <=>
  expected`; `affectedRows !== 1` → `CONFLICT`), now **inside the settlement
  transaction** rather than beside it. The move was deliberate and is pinned
  by a contract test — `r7-snapshot-selection-contract.test.ts:679` asserts
  `mintPackage.ts` does not contain `mintModelAtomically`.

  **Two concurrent mints on one Cast cannot both charge.** Four guards, three
  of them ahead of the money, read at the line in call order:

  ```
  1  idempotency claim  claimGenerationOperation — UNIQUE(userId,
                        clientRequestId) INSERT. Replay returns the stored
                        receipt; same id + different payload = CONFLICT.
  2  resource lock      acquireGenerationOperationLock, key "model:<id>".
                        generation_operation_locks.lockKey is the PRIMARY KEY
                        (drizzle/schema.ts:499) — a duplicate-key INSERT, not
                        a check-then-write (invariant 1). The loser is
                        finalized failed/CONFLICT, and an EXPIRED lease is
                        still never stolen (generationOperations.ts:893).
  3  lock re-proved     markGenerationOperationRunning({requiredLockKey}) —
                        castingExport.ts:441. Re-reads the lock row inside
                        the transaction, SELECT ... FOR UPDATE on the model.
  4  ledger reference   only then deductPoints (mintPackage.ts:607), keyed on
                        operationChargeReference(operationId); a duplicate
                        referenceId rolls the balance update back inside the
                        transaction (credits.ts:364).
  ```

  The second mint is refused at guard 2, **before `mintPackage` is entered**.

  **The honest remainder, unread and NOT asserted:** the *sequential*
  re-mint case — a later mint operation against an already-active model —
  was not priced. It is not owed before launch unless someone finds a path
  that charges there; the concurrency case was the money fear in this item,
  and it is dead. (fable-818 §1.)

  ⚠ **But the guards reach the wire by NO TEST — see the entry below.**

  *(History, kept as the record of what was asked, and its premise was
  correct: the function this item was written about has no production
  importer, and two design documents named a call site that is not there —
  opus-604, ruled fable-815 §3, 2026-08-17.)*

  ```
  mintModelAtomically   every textual use in server/ + client/, dynamic
                        destructuring included:
                          server/db/models.ts   the definition
                          server/db/index.ts    the barrel re-export
                          *.test.ts             mocks and assertions
                        NO PRODUCTION IMPORTER.
  named as its live caller, in the PRESENT TENSE, by two documents:
    CASTING_MODEL_ID_WRITER_INVENTORY.md:34             → `generation.mintPackage`
    CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md:103 → "mint keeps
      committing through `mintModelAtomically`'s CAS (`mintPackage.ts:502-513`)"
  read at that file and that region: the clean-draft refusal and the §14
  integrity gates are there. The call is not.
  ```

  *(That block stays exactly true of the SYMBOL. Both design documents now
  carry the found address beside their stale one, as specifications rather
  than reports. The owed read — "read the commit point", owner the cleanup
  milestone with a floor-not-a-fence claim for any quiet shift — was
  DISCHARGED on 2026-08-17 by the shift that claimed it.)*
- **The paid paths' resource lock reaches the wire by NO TEST** (L8b,
  opus-607 §2, ruled fable-818 §2, 2026-08-17). The guards above are real
  and correctly built. Nothing fails when they are removed.

  Derived from the tree rather than listed: **12** `beginDirectOperation`
  call sites in production server code; **11** pass a `lockKey`; the twelfth
  is `models.ts:65` `model.create`, which has no model yet to lock and whose
  key would be refused as naming no resource in the trusted claim. The wire
  is healthy. The test layer is not — three sabotage arms, each a full run:

  ```
  baseline                          463 files / 6778 tests passed
  A  mint gate loses lockKey                 1 failed | 6777 passed
  B  mint's markGenerationOperationRunning
     loses requiredLockKey                   1 failed | 6777 passed
  C  REFINE and HEADSHOT lose lockKey        1 failed | 6777 passed
  ```

  **The single red in all three arms is `architectureAtlas.test.ts`, and it
  carries no information about locks** — a `// semantically null` comment in
  the same file reddens it identically (control run), and the Atlas contains
  zero occurrences of `lockKey`. It is a source-fingerprint freshness
  detector. So mint, refine and headshot can each lose their lock with 6,777
  tests green, and refine is the founder's own daily paid path.

  **The pattern exists one lane over**: `batchC-structured.test.ts:504`
  asserts `lockKey: "model:7"` reaches the gate on `applyModelEdit`, and
  `:726` proves a busy receipt "refuses before marking running, charging, or
  generating" with `expect(deductPoints).not.toHaveBeenCalled()`. Canvas has
  it; the Casting V2 paid surface does not. This is the eye-row class on a
  money line: a real guard with nothing that fails when it is deleted.
- **R7 evidence migrations 0015/0016** (L9): ⛔ **THE PREMISE BELOW IS FALSE
  AND THE ITEM IS RE-POSED — both migrations ARE applied to production**
  (opus-605, ruled fable-816 §2, 2026-08-17). Read against `:23768` with both
  controls printed before any verdict counted:

  ```
  world  hayabusa.proxy.rlwy.net:23768  db railway
    model_identity_feature_projection_evidence  13 columns · declared 13 ·
                                    marker "acceptedCandidatePlateId" PRESENT
    casting_evidence_candidate_feature_targets  10 columns · declared 10 ·
                                    marker "coverageBasis"           PRESENT
    zzz_no_such_table_0015                      ABSENT   ← negative control
    models                                      resolved ← positive control
  ```

  Not "a table with that name": the counts are the exact ones declared in
  `drizzle/0015_r7_all_body_ink.sql` and `0016_…_projection_targets.sql`, and
  each marker column only that DDL produces.

  **So "re-enable by ceremony" has nothing to run.** What is off is the CODE,
  not the schema: `R7_EVIDENCE_COMPOSER_SCOPE=off` and
  `R7_EVIDENCE_PACKAGE_SCOPE=off`, read off the Drape service — the pair the
  2026-07-31 crash-loop ended with. **The real question is a FLAG-AND-CODE
  decision, re-enable versus retire-with-legacy, and it is NOT a production
  migration and NOT founder-gated as it was posed** — which is why it sat for
  weeks under a heading nobody could act on.
  **Owner: the M14 legacy-retirement register**, with the **Atlas retirement
  view as the deciding instrument** (nothing removed while it shows live
  callers). **Recorded lean: retire-with-legacy** — deliberately undecided
  here, because the Atlas is the authority and a reading of two tables is
  not. If the founder ever revives the composer ambition, his word reopens
  it. *(History, now false, kept as the record of what was asked: "never
  applied to prod (the 2026-07-31 crash-loop); decide re-enable-by-ceremony
  vs retire-with-legacy.")*
- **Refine deferred-delete determination** (L10): ✅ **CLOSED 2026-08-17 —
  MOOT, and D-192 is implemented rather than merely ruled** (opus-605, ruled
  fable-816 §3). The three readings the item asked for:
  1. **The premise holds** — `notBefore` returns **zero** occurrences in
     `server/`. No deferred-delete concept exists.
  2. **A creation-time user reference cannot exist at all** —
     `server/routes/modelCreateInput.ts:77`: *"Batch C (§10.3, M22):
     `referenceImage` is GONE and the object is STRICT — a creation reference
     is schema-REJECTED, never silently ignored."*
  3. **A post-headshot reference holds its OWN BYTES** —
     `server/castingV2/referenceMint.ts:532` is
     `storagePut(input.key, input.bytes, input.contentType)`. The library
     mints a crop as a new object under the candidate's own purge path; it
     does not point at a source object somebody else can delete.

  So D-192's *"promoted to an immutable asset… frozen at introduction"* is
  implemented **by a byte copy at mint time**, a reference cannot dangle, and
  **there is nothing for a deferred delete to defer.**

  ⚠ **What would REVIVE it**, and it is a design condition on work not yet
  built: a reference-guided edit (M12 row 15) that attaches a user's upload
  **by pointer instead of by copy**. Row 15's ruled design already intends
  copy-into-the-candidate's-purge-path; this is the sentence its builder must
  meet. *(Bound stated honestly: the mint's own write was read, not every
  path that could ever attach an image to an edit.)*
- Shared R2 credential split (founder re-prioritized here);
  real-inbox Resend test; fal retention answer (founder confirms
  answered, 2026-08-09); the five inert
  security controls (CLAUDE.md's "currently not enforced" list).
- **High-DPI image sharpness — the CHEAP FIX** (founder-ruled
  2026-08-16, from his own report "why do the images look so
  pixelated?"): renders are ~1 MP (1024×1536 GPT2, 848×1264 NBP)
  and 320 px thumbs (`THUMB_MAX_SIDE`) are shown on surfaces larger
  than they were made for, so every high-DPI screen sees upscaling
  softness. Ruled: ship the cheap fix — audit every surface's
  displayed size × devicePixelRatio against the asset it serves;
  where a 320 px thumb is stretched past ~1:1 device pixels, serve
  the full frame instead (thumbs keep the tiny chips); verified by
  eye on a high-DPI screen (law 9). The REAL fix — a dedicated
  upscaler pass at Sign time taking masters/views to 2–4 MP
  (fidelity-law grade) — is NOTED, not ruled; larger render tiers
  need a price check first. Slot: with the M13 pre-launch batch,
  or earlier if a polish window opens.

  **THE AUDIT HE ORDERED HAS BEEN RUN — 2026-08-17, shift 84, zero
  spend** (`scripts/measure-dpr-sharpness-disposable.mts`, rows in
  `output/sharpness/sharpness.json`, screenshots beside them). Eight
  surfaces, **142 measurements**, each one at **dpr 1 AND dpr 2** —
  the variable his ruling names, and the one every previous reading
  here had pinned at 1. The instrument passes a positive and a
  negative control on every page before any verdict is printed.

  **The cheap fix has no population.** Not one thumb is stretched
  anywhere in the product, at either density: only **10 of the 142**
  measurements are thumbs at all, and the worst of them sits at
  **ratio 0.4** — two and a half times more asset than the screen
  asks for. The thumbnail is used exactly where it belongs (30×30
  avatars, 26×26 board chips). *"Where a 320 px thumb is stretched,
  serve the full frame instead"* is a correct rule with nowhere to
  apply, so it would ship a diff and deliver zero pixels — the same
  outcome as the withdrawn 760 px cap lift, one line above.

  **What IS stretched is the master, and only at dpr 2** — two rows
  out of 142, both full frames, both his own complaint:

  | surface | asset | drawn | device px | ratio |
  |---|---|---|---|---|
  | cast room viewer | 1024×1536 | 593×889 | 1186×1779 | **1.158** |
  | casting sheet viewer | 1024×1536 | 526×789 | 1052×1578 | **1.027** |

  **And the sharpest form of it, measured inside ONE viewer box:**
  the signed Cast's package views are **1696×2528** and its master is
  **1024×1536**, drawn into the same 593×889 box. At dpr 2 the views
  land at 0.699 (crisp, every device pixel backed) and the master at
  1.158 (upscaled, visibly soft). The softness is not the layout and
  not the thumbnails — **it is that the master is smaller than the
  views sitting beside it**, and no substitution reaches that. Only
  the NOTED real fix does (or a layout that refuses to draw a frame
  past its own pixels, which trades size for sharpness and is his
  taste to rule, not ours). Window was 1440×1000; his 2560×1440
  window draws the same viewer at 604×906, so these ratios are the
  floor, not the ceiling.

  **The 2K half is no longer unread** — the sentence below it ("the
  fixture bot owns no signed Cast") was produced by a query naming
  two columns that do not exist on `models`, inside a `.catch` that
  turned the error into an empty result. `verify-bot-local` owns
  **four** signed Casts and always did; the reading above is taken on
  one of them (`KI-QNW6-37KK-RVS9-XMKD`), and the broken query is
  fixed at its source.

  **Open for the founder, and NOT decided here:** the cheap fix is
  ruled but has no work to do, and the fix that reaches his complaint
  is the one he explicitly did not rule. His word decides whether
  that promotes.

  **M12's row 2 lands HERE, whole** (fable-786 §3, fable-789 §2 —
  filed into this item on 2026-08-16, having lived only in the
  mailbox until then). There is no magnification anywhere in the
  product: `CandidateViewer` has no wheel handler, no drag, no
  transform and no zoom control, and the only close look it offers
  is the download button. **The measurement, so nobody builds the
  wrong fix:** the 760 CSS px cap (`castingV2.css:722/740/808`)
  **never binds** — height runs out first on every 2:3 frame. Driven
  in the running app (`output/downsample/downsample.json`): a
  1024×1536 frame draws at **604×906** (0.590 of natural) in a
  2560×1440 window — 156 px short of the cap — and at **310×466**
  (0.303) in a 1440×1000 one. An ordered cap lift was withdrawn on
  this measurement; it would have shipped a diff and delivered zero
  pixels. ~~**The 2K half is UNREAD:** the fixture bot owns no signed
  Cast, so every figure above is a 1K candidate frame~~ — **FALSIFIED
  2026-08-17 (shift 84): that sentence was never a reading.** The
  query behind it selected `m.publicId` and filtered on
  `m.castingV2SignedAt`, neither of which exists on `models`, inside a
  `.catch` that turned the error into an empty result — it could not
  have returned a row for any user alive. `verify-bot-local` owns
  **four** signed Casts. The 2K half is now READ and is written up at
  this item's opening: the package views are 1696×2528 and stay crisp
  at dpr 2; it is the **1024×1536 master beside them** that goes soft.
  **The founder ask at this item's opening, in his
  words rather than ours:** *when you want to look closely at a
  face, should the picture get bigger inside the app — or is
  downloading it the answer?* A zoom *gesture* is founder taste and
  is not assumed; the zoom-cursor ruling (`castingV2.css:2168`,
  2026-08-02) rejected an affordance that promised a zoom the viewer
  did not keep, which is a ruling about a broken promise and not
  about magnification being unwanted.
- Hygiene batch (L2) — ✅ **CLOSED 2026-08-16, with the guard that keeps
  it closed.** The line said **11** when it was written on 2026-08-09 and
  read **34** when it was picked up a week later, unchanged in between:
  a burn-down without a guard is a burn-down with a schedule for coming
  back.

  Twenty-one permanent `getDb()` scripts — the audits, backfills,
  repairs, converges, calibrations and drives — now call
  `assertOneWorld(["DATABASE_URL"])`. The one-shot `*-disposable.mts`
  benches deliberately do not: that suffix is the repo's own convention
  for a bench that ran once, and `worldGuard.mts`'s own header makes the
  argument — *"a guard people learn to work around is a guard that is
  off."*

  `server/scriptWorldGuard.test.ts` derives both halves of the scope
  from the tree (calls `getDb()`; is not named `-disposable.mts`) rather
  than from a list, so a script written tomorrow is in scope the moment
  it exists. Its exemption map is empty, and an entry would have to
  carry a reason.

  **The checker was wrong when first written, and the sabotage is what
  said so:** it matched the bare identifier `assertOneWorld`, which the
  IMPORT line satisfies — deleting the call and leaving the import left
  it green. It now requires the call, and that case is pinned as its own
  test. Invariant 7, applied to the guard for a guard.
- Hygiene batch (L2, added 2026-08-10, fable-127): **a script that
  touches an app service never exits** — ✅ **CLOSED 2026-08-11
  (burn-down ordered in fable-246).** `getDb()` hands out a
  module-level pool with no exported shutdown, so the process stays
  resident with all its work done — eighteen such processes from four
  scripts were found alive from the previous day, and the shift that
  left them had reported "no background jobs of mine running" in good
  faith, because nothing showed them. Two parts: scripts calling app
  services end with an explicit `process.exit(0)`, and the park
  checklist's hygiene step becomes a `Get-CimInstance Win32_Process`
  sweep **by command line** rather than a claim from memory.

  The sweep touched **182 scripts** and landed with the guard that
  keeps it closed, `server/scriptExitDiscipline.test.ts`, in one
  commit — the sweep alone reopens with the next script written.

  The scope is **every entrypoint under `scripts/`**, not every script
  that imports an app service, and the narrower rule was tried first:
  it excluded its own origin case. `buy-hoop-specimens-disposable.mts`
  — the spend script found resident for 3h20m — reaches the app
  through `await import("../server/…")`, which a scan of `from "…"`
  lines cannot see, and opens its own `mysql2` connection besides.
  Widening it by naming the packages that hold a handle would have
  been a mirror (working law 4), so the derived split is used instead:
  a file nothing imports is an entrypoint and exits; a file something
  imports is a module and must never exit. The guard checks the LAST
  STATEMENT, because the resident script had contained
  `process.exit(0)` all along, forty lines from the end, in a branch.
- **A CORS rule on the image buckets** — ✅ **DONE and VERIFIED IN A
  BROWSER, 2026-08-10.** The founder applied both policies himself
  (fable-176); `scripts/verify-bucket-cors.mts` then proved it the only
  way that counts. A CORS misfire is silent — the image loads, paints,
  looks perfect, and the canvas is quietly tainted — so the probe is
  `getImageData` on a canvas the image was drawn into, from two origins
  at once:

  ```
  PASS  ON the allow-list    localhost:3000  loaded, pixels readable [82,88,86,255]
  PASS  NOT on it (control)  localhost:4321  did not load at all
  ```

  The negative control is what makes the pass mean anything: a checker
  that only runs against the allowed origin cannot fail. **So the panel
  and the M12 face chart may read stencils directly**, and
  `/api/image-proxy` stays as the fallback for any host not on the
  bucket's list (boards still use it). One note for whoever reads the
  output: the script prints `allow-origin header (none)` on the passing
  arm, and that is correct — the browser does not expose that header to
  script. At the wire, `curl` with an allowed `Origin` gets
  `Access-Control-Allow-Origin: http://localhost:3000` and a foreign one
  gets nothing.

## 7b. The blank new-account lobby — DEFERRED BY THE FOUNDER (2026-08-15)

`/app` settles to **62 characters of body text** for an account with nothing in
it: the nav rail and the word "Home". One image (the avatar), no buttons, no
empty state, no welcome, nothing to do. It is the first screen a real customer
meets after signing in, and it is the only launch-surface finding of the outside
walk that the founder has NOT ordered built.

His words: *"not important at the moment, I'll deal with this at a later
stage."* So it is **his to pick up, and not to be designed before he does** —
filed here with its evidence rather than left in a mailbox message.

```
evidence        output/outsider-walk/{dark,light}-lobby.png
how it was read docs/specs/V4_LAUNCH_SURFACE_READING.md (the outsider fixture,
                both themes, nothing spent)
sibling         the sheet's four-second empty stage — same walk, and that one
                he DID order built (the panel's own skeleton language)
```

## 8. Dormant founder items — mostly CLOSED 2026-08-09 (fable-122)

Remaining: (L14) roster-card coherence question (sheets era,
unanswered); the D-169 mock eyeball (waits for item 2's loader mock
to exist). CLOSED by founder ruling 2026-08-09: the canvas intro
(KILLED); the fal retention question (founder confirms already
answered — annotated on item 7's checklist); D-82 vocabulary reading
and the D-166 glasses clause (both "fine as shipped" —
founder-ratified, no longer provisional).

## 9. Shelved-with-trigger register (durable in DECISION_LOG; pointers here)

**The contamination instrument** (what a paint borrowed from a reference
crop's background) — deferred by fable-184 with an explicit trigger: build
it **when an occlusion-aware cutter reopens the crop-vs-cutout question**
(`COMPOSITOR_SWAP_DESIGN.md` §5.1/§7). Until then the reference-format
ruling stands on shape + material, and neither of those counts borrowing.
Beside it, the **img-left/img-right hoop asymmetry** is an open row rather
than a shelved item — **and it is NARROWED as of 2026-08-17** (opus-603,
ruled fable-814 §3). Its old condition was *"test the mechanism only if the
edit-law cell leans the same way"*; the question that condition existed to
answer **has been answered by a court convened for a different feature.**
`V4_SIDE_INFERENCE_COURT.md` measured per-instance asks at **her right 3/6 ·
her left 6/6** and states *"the misses all landed on the image's RIGHT half
whatever the recipe named"* — the image-side axis, on the same engine by
construction. **The row's original observation confounds size, occlusion and
image side; only the size/occlusion half remains.** No mechanism test is
built: the standing rule contains the risk in production (per-instance
worst-of-n, never averaged), and the narrowed remainder keeps its own trigger
— a hoop case the per-instance rule fails to contain, or the size/occlusion
question opening on its own evidence. Full reasoning, including why the
edit-law cell's row d is NOT offered as the lean, lives in
`COMPOSITOR_SWAP_DESIGN.md` §7's row. Both are stated as owed rather than
absent.


Hair-matting shop (trigger: strand-gap artifacts visible to the
founder in a real case); fine strand tips clipped (cosmetic ceiling,
future shop round); advisory degree/intensity check (bounded by item
4's principle); D-213's record gate has no call site (ADD of an
absent distributed facet still segments — current-behaviour test
marks it); `requestMatte`/`changesSilhouette` documented as
spec-not-control; reliability-report build-id column (prod migration
= founder gate).

**`refineService`'s open noun to the segmenter** (filed fable-132, off
D-238's class sweep): `region({ name: parsed.match })` at
`refineService.ts:939` and `:1073` sends an **interpreter-authored noun
phrase** — "round wire-frame glasses", "smokey eye" — straight to SAM 3,
which is D-213's *"a segmenter is never asked an open question"* under
strain. Pre-existing and NOT this class; **no evidence of harm was
gathered**, so it is filed rather than fixed. Trigger: any read on that
path returning a mask nobody can account for, or the vocabulary work in
item 5 (open-vocabulary regions), which meets the same question head-on.
