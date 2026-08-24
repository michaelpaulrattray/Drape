# The cleanup milestone — the reasoning. THE INDEX IS ELSEWHERE.

> **THIS DOCUMENT IS NOT THE DELETION DOOR** (ruled fable-992 §2c). The door is
> `docs/specs/cleanup-dispositions.yaml`, checked by
> `scripts/check-cleanup-dispositions.mts`, which runs inside `pnpm check` —
> one row per symbol on the sweep's reading list, each naming the section
> BELOW that argues it. This file keeps the reasoning and has lost the index
> role, because a prose list of verdicts beside seven sections of argument is
> a second list shadowing a source of truth, which is the law this milestone
> spent a week measuring.
>
> **The completion bar** (adopted fable-992 §2b): every row's verdict
> non-empty and `check-cleanup-dispositions.mts --strict` green. Nothing else
> counts as finishing the reading.
>
> **An uncalled export is a QUESTION, not a verdict** — the milestone's motto,
> and the question is *what was this for?* Two ways of getting it wrong were
> paid for here: an instrument counting prose as a caller (§19), and a reader
> counting an import graph as an intention (§15d). **An import graph says who
> calls a symbol; it cannot say what the symbol is FOR, and in this repository
> that is usually written at the top of the file.**

## The recon that opened it

**Read-only reconnaissance, ordered fable-975 §5, taken 2026-08-18.** The
founder ordered this milestone in person (fable-710 §2, *"we have done so much
testing and changing of systems with this design"*) and its slot is after V5 and
M12's close-out and before M8 (`POST_SIGN_ROADMAP.md` §0b). M12 is
done-bar-verdicts, so this opens it WARM: **nothing here is deleted, no code
path is retired, no flag is touched.** Every line below is a reading with a
recommendation attached, so that when the milestone opens, the expensive half —
the triage — is already done.

---

## 0. THE FIRST FINDING IS ABOUT THE INSTRUMENT, NOT THE CODE

The sweep this milestone is budgeted against
(`scripts/sweep-uncalled-exports-disposable.mts`) **refused to run**:

```
CONTROLS
  positive  EYE_SHAPE_ENGINE          NOT FOUND  FAIL
REFUSED — the instrument failed its own controls; no verdict printed.
```

Its positive control named `EYE_SHAPE_ENGINE` — the founder-ratified routing row
the sweep was built around — and **he retired that row in person** (D-248,
fable-848). A grep now returns the sweep's own prose and nothing else. The
control died with the code it named, and the refusal is the instrument working:
a control that cannot be found is indistinguishable from a sweep that cannot
find anything.

**Repaired** with a specimen that cannot drift — `SYSTEM_PROMPT_FOR_TESTS`,
whose own NAME is the reason it will stay test-only, hand-verified as declared
once and imported by exactly two `.test.ts` files — with `catalogueBornWorn`
kept beside it as the independent second positive. One more repair rode along:
the label now prints from the same constant the control uses, because during
this recon the file printed `positive EYE_SHAPE_ENGINE ... PASS` for a run that
had tested something else entirely.

> **The class, for the milestone's own use:** an instrument whose control is a
> real specimen dies when the product retires that specimen. Prefer controls
> that are true *by construction* (a symbol named `...ForTests`) over controls
> that are true *by circumstance* (today's dead code).

---

## 1. THE UNCALLED EXPORTS — 175 candidates, and 64 of them are not candidates

Sweep, after repair: **431 production files · 3,104 named exports · 2,157
consumer files.** It prints two lists — 111 test-only and 64 named-by-nobody —
and says its own three biases (namespace imports, dynamic specifiers, barrel
re-exports) make the total a floor.

**That is true of the count and misleading about the work**, so this recon added
a second reader — `scripts/triage-uncalled-exports-disposable.mts` — which asks
of each symbol: *is there any non-test mention anywhere that is not its own
declaration, and of what kind?* Its own controls (`shouldSendGlobalAttackAlert`
must classify `none`; `isAccountLocked` must not, because it is reached as
`db.isAccountLocked` from two auth routes) both pass.

```
175 symbols off the sweep
  NONE     111   nothing but its own declaration and its tests — THE REAL LIST
  OTHER     23   some other production mention — a hand read decides
  BARREL    34   re-exported through server/db/index.ts and used as db.NAME(
  DYNAMIC    7   reached through await import("...") with a static specifier
```

**Every one of the 64 "named by nobody" entries has a production mention.** The
sweep's biases are not a theoretical caveat; they are 100% of its second list
and 37% of the total. Three that matter, because they are security-adjacent and
would have been read as dead controls:

| symbol | reads as | actually |
|---|---|---|
| `isAccountLocked` | named by nobody | `db.isAccountLocked` in `emailAuth.ts:238` and `googleAuth.ts:173` — **lockout is wired** |
| `recordFailedLogin` | named by nobody | `db.recordFailedLogin` in `emailAuth.ts:277` |
| `handleSlackInteraction` | named by nobody | `await import("../slack/slackInteractions")` in `_core/index.ts:225` |

**Recommendation: the reading list is 118, not 175** — the 111 test-only plus
seven of the OTHER entries, per the pass below. The 41 barrel/dynamic entries
need no reading at all, and exactly one OTHER entry turned out to have a
caller.

### 1a-pre. THE OTHER PASS — done, so the list is exact rather than approximate

All 23, read (ordered fable-976 §5). None of them cost more than a glance, and
two of them are findings:

| what the mention was | n | verdict |
|---|---|---|
| a sentence in a COMMENT naming the symbol (`rasterise`, `requestMatte`, `openKindZoneScope`, `openKindIsPlural`, `openKindDeparture`, `presentPair`, `isDistributed`, `HAIR_STYLE_NAMES`, `refusalTallies`) | 9 | prose, not a caller — **stays on the reading list** |
| a same-named LOCAL in a disposable script (`FACET_KEYS`, `stepLabel`, `cutOf`) | 3 | coincidence — **stays on the list** |
| an object KEY spelled like the symbol (`INSTRUCTION_MAY_OVERRIDE`, `OPEN_QUESTIONS`) | 2 | coincidence — **stays on the list** |
| a SUBSTRING of a longer symbol (`REFUSAL_REASONS` inside `GUARD_REFUSAL_REASONS`) | 1 | the reader's own bias, declared below — **stays on the list** |
| re-exported through a module barrel and imported by NOBODY from it (`getSessionCount`, `stopSessionEviction`, `clearAllUserSessions`, `_clearDedupCache`, `getDedupCacheSize`) | 5 | **stays on the list** — a re-export is a door, not a caller |
| a real consumer in a TRACKED script (`inspectStorageCleanupReconciliation`, used by `scripts/run-storage-cleanup.mts`) | 1 | **off the list** — it has a caller |
| **findings** (below) | 2 | **on the list, and named** |

**So the exact reading list is 118**: the 111 test-only, plus the 5
re-export-only, plus the two findings. One symbol — exactly one — left the list
because it had a caller.

⚠ **The reader's own bias, stated rather than discovered:** it matches on
substrings, so `REFUSAL_REASONS` was "mentioned" by `GUARD_REFUSAL_REASONS`. The
bias runs toward **not-dead** — it can keep a dead symbol on the maybe-alive
pile, never invent a dead one — which is the safe direction for a triage whose
next step is deletion.

#### The two findings

- **`beginInkAddIntent` is superseded, and its NAME is what hides that.**
  `server/routes/evidence.ts` declares a tRPC procedure called
  `beginInkAddIntent` — and imports `beginInkAnywhereIntent`, its successor. The
  client calls `trpc.evidence.beginInkAddIntent`, so every grep for the name
  finds a live path, and the function of that name has had no caller since the
  successor landed. **RETIRE candidate**, and the class is worth naming for the
  milestone: *a dead function whose name is also a live procedure's key reads as
  alive from every direction except an import graph.*
- **`STATED_WARDROBE_NOTICE` exists TWICE, and the live copy is the client's.**
  `server/castingV2/statedWardrobe.ts` declares the sentence and nothing imports
  it; `client/src/features/castingV2/sheetNotice.ts` declares the same sentence
  again and shows it. They are byte-identical today — *"Casting sheets keep the
  studio tee — outfits come after Sign, in takes."* — which is precisely the
  state law 4 describes before drift. **RETIRE the server copy** (or make the
  client import it), and read the neighbouring notices in the same sitting:
  `FELL_BACK_NOTICE` sits beside it and may be the same shape.

### 1a. The 111, by family, with a recommended disposition

| family | n | recommendation |
|---|---|---|
| test hooks by name (`...ForTests`, `reset...`, `...Stats`) | 9 | **KEEP.** A hook whose name says test-only is doing its job; the sweep cannot tell it apart and a human can. |
| contract assertions (`assert...`, `canTransition...`) | 8 | **KEEP, and check one.** These are the R7 status contracts; a `canTransition` with no production caller is either a guard nobody invokes (invariant 7) or a contract used only to prove the table. One read settles the family. |
| named constants (`SHOUTY_CASE`) | 15 | **INVESTIGATE cheaply.** A constant nothing imports is either dead or the thing a test pins a behaviour to; the second is legitimate and common here. |
| everything else | 79 | **INVESTIGATE, in file order.** `server/castingV2` holds 67 of the 111 — the newest and most-rewritten area, exactly as the founder's grounds predict. |

### 1b. Named for a first read, on evidence rather than on a hunch

- **`catalogueBornWorn`** — already owned by this milestone
  (`POST_SIGN_ROADMAP.md` §0b): read to the bottom, verdict is **wire-or-retire**,
  and a RETIRE lean goes to the founder as a card. ⚠ It is also this sweep's
  second positive control, so any change to it **chooses a replacement control in
  the same commit** — and after §0 that replacement should be a by-construction
  one.
- **`commitIdentityEdit` / `commitAnchorReRoll`** (`server/casting/identity/`) —
  test-only, and `batchC-sourceGuards.test.ts` asserts they must NOT appear in
  the iterate block. So the suite holds an opinion about where they may not be
  called while nothing calls them at all. **INVESTIGATE first**: either legacy
  superseded by V2 (M14's authority decides that, not this milestone) or a live
  authority path that lost its caller.
- **`shouldSendGlobalAttackAlert` / `markGlobalAttackAlertSent` /
  `recordGlobalFailedLogin`** (`server/security/rateLimit.ts`) — genuinely no
  production mention. This is the shape CLAUDE.md already documents for other
  controls ("helper written, docs written, call site never added"), and it is
  security-adjacent. **INVESTIGATE, and expect a wire-or-delete decision** —
  never a silent deletion, because a deleted alert looks identical to an alert
  that never fires.
- **`getRecentTopupCount` / `getRecentTopupCredits`** — barrel-reached, so not
  dead by import; but CLAUDE.md already lists credit-purchase velocity limits as
  *"helpers and Slack alert exist, no call site in the checkout path"*. The
  import graph cannot settle that one; the checkout path must be read.
  **RESOLVED 2026-08-19 — DELETED by founder default** (§9's wire-or-bin card,
  binned). The checkout path was read and there was no check in it; the git
  record then showed why, and it is not what this entry assumed — see §9.

---

## 2. THE UNTRACKED DISPOSABLES — 285 of them, and 25 are cited by tracked work

```
untracked files in the tree   292   (285 under scripts/)
cited by tracked content       25   docs, CLAUDE.md, tracked scripts or code name them
named by nothing tracked      260
dated                         2026-08-11 to 2026-08-18; 34 written on 2026-08-17 alone
```

**The 25 are the finding.** A disposable that a standing document names is not
disposable any more — it is an instrument the repository does not contain.

- **`scripts/slots-per-render-disposable.mts`** is the roadmap's own
  **mechanical shift-open trigger** (*"every shift OPEN runs the one-query
  coverage check"*, §1) — and it existed only on this machine. **PROMOTED with
  this document.**
- **`scripts/prove-refine-idempotency-disposable.mts`** was the same shape and
  was promoted earlier this shift, when fable-974 made it a standing regression.
- **`scripts/sweep-uncalled-exports-disposable.mts`** and its new companion
  `scripts/triage-uncalled-exports-disposable.mts` are promoted here too: this
  milestone is budgeted against a script nobody else could run.

**Recommendation, in this order:**

1. **PROMOTE** the remaining cited files, or retire the citation, per file — a
   document that names a dead script is the other half of the same defect.
2. **DELETE** the 260 nothing names, with one exception stated rather than
   discovered: the last two days' worth (66 files) belong to work still in
   flight, so the sweep runs at the milestone's own date rather than against
   this list.
3. ~~`output/`~~, `errfiles.tmp`, `scripterrors.tmp`, `0`, and the two
   ~~`FABLE_R7_*_REVIEW.md`~~ files at the repository root are untracked debris —
   **DELETE**, after confirming the two review files are not the only copy of a
   review (nothing tracked names them).

   ⚠ **This order was WRONG in two of its five items, and both are struck above
   — see §24f.** `output/` is not debris: tracked documents name 475 distinct
   paths inside it and 445 of them exist, including frames filed for the
   founder's eye. The `FABLE_R7_*` pair stays too — a tracked prompt names one
   of them as a file that must remain unstaged, so untracked-and-live is
   deliberate in that family. The three that were genuinely uncited are taken
   and archived. **A kill list is the one kind of list that must be re-read
   against the evidence before it is obeyed**, and this one had outlived its.

---

## 3. THE NAMED FORKS

- **`client/src/components/ui/sidebar.tsx`** (from the L7 read, fable-823 §2) —
  a shadcn primitive nothing in `client/src` imports, and the product's only
  other cookie writer (`sidebar:state`, never set). Out of the sweep's scope,
  which is server exports. **DELETE candidate**, and the cookie inventory should
  be re-read in the same sitting so the deletion can be stated as *"the product
  writes one cookie"*.
- **The Manus CSP/SSRF remnant** (`files.manuscdn.com`, `*.cloudfront.net`) is
  NOT this milestone's: CLAUDE.md ties it to running
  `scripts/migrate-storage-urls.ts` against production at final cutover. Named
  here only so the next reader does not find it and think it was missed.

---

## 4. WHAT THIS RECON DID NOT DO

No export was deleted, no flag retired, no spec section marked superseded, and
no Atlas retirement view consulted for a removal — the Atlas remains the
deletion authority when the milestone opens, and nothing goes while its
retirement view shows live callers. The only edits this recon made were to its
own two instruments: repairing a dead control, and stopping a reader from
counting its own prose as evidence.

---

# THE MILESTONE PROPER — the reading, and the first removals

**Opened 2026-08-18 under fable-978/979.** The recon above is the input; this
half is the reading it ordered, the dispositions it produced, and the two
commits that discharged the ruled ones. Everything below was read against the
source, not against the recon's prose.

## 5. THE MECHANICAL CUT — none of the 175 is used inside its own module

The cheapest reading in the milestone, and it removes a whole disposition from
the table. For each symbol, how many lines of its OWN file name it:

```
CONTROL  positive  WORN_CLOTHING_WORDS (declared + used in-file)   2   pass
         negative  ZZZ_NOT_A_SYMBOL                                0   pass
RESULT   175 of 175                                                1   declaration only
```

**So "un-export it, keep the code" is never the answer for any entry on either
list.** Every symbol is keep-for-tests or dead, with nothing in between.

## 5a. THE DECLARED/SILENT SPLIT — `scripts/triage-declared-intent-disposable.mts`

A large share of these symbols answer the milestone's question in their own
docblock ("Test seam: …", "Exported for the contract test", "for the
reverse-direction test", "never used at runtime"). The instrument reads the
comment block immediately above each declaration and asks only whether it names
a test, a suite or a report.

```
CONTROLS
  positive  SYSTEM_PROMPT_FOR_TESTS    DECLARED   pass
  negative  isBilateral                SILENT     pass

111 symbols read
  DECLARED   18   the declaration names a test, suite or report
  SILENT     93   no stated reason — this is the reading list
  NOT FOUND   0
```

⚠ **Its bias, stated rather than discovered: it reads only the NEAREST comment
block, so a symbol carrying two adjacent blocks is judged on the closer one.**
`COHORT_CONSTANT_MARKERS` reads SILENT although a block above it says "Exported
for the contract test". **The bias runs toward SILENT** — it inflates the
reading list and can never shrink it — which is the safe direction, the same
way the recon's substring reader was biased toward not-dead. `DECLARED` is a
floor; `SILENT` is a ceiling.

⚠ **And the eyeball estimate this instrument was built to check was WRONG.** A
docblock dump of the castingV2 entries read as though *most* declared their
intent; the measurement says 16%. The dump showed the striking ones. Filed
because the milestone's remaining budget was about to be set from that
impression.

## 5b. NO DEAD MODULES — the disposition is per-symbol

| module | exports | flagged | production importers |
|---|---|---|---|
| `maskGeometry.ts` | 37 | 7 | 8+ |
| `axisRegistry.ts` | 28 | 4 | 2 |
| `maskedRefine.ts` | 23 | 4 | 8+ |
| `openKindPolicy.ts` | 20 | 9 | 3 |
| `zoneScope.ts` | 9 | 4 | 4 |

**No file on this list can be deleted whole**, which is worth knowing before
anyone budgets the milestone in files rather than in symbols.

## 6. THE FAMILIES, with dispositions

### 6a. Derived views the test asserts the TABLE through — **KEEP, as a family**

`axesOnShelf`, `edgeTableNames`, `fringeTableNames`, `neighbourTableNames`,
`segmentableRegionNames`, `namingTableFacets`, `exemptSubjects`,
`neighbourPairs`, `arrangementsWithPrecedent`, `unmeasuredAmplitudes`,
`unprotectedFacets`, `facetsWithUnreliabilityPrior`, `unreadFacts`,
`splitByInheritance`, `courtSeparationFor`, `REFUSAL_REASONS`, `VACANCY_KINDS`,
`FACET_KEYS`, `COHORT_CONSTANT_MARKERS`.

One says it in its own docblock — *"Facets declared in the edge table — for the
reverse-direction test"*. **Deleting these pushes their tests back onto
hardcoded lists, which is law 4 in reverse** and precisely the drift the
derivations were built to stop.

### 6b. Contract assertions — **KEEP; the derive is a BUILD, filed** (fable-979)

The eight assert/canTransition exports of `evidenceCandidateContract.ts` are
imported by their own test alone, while the module around them is imported by
**21 production files** for its status arrays and types.

**The transition table is not the enforcement.** The writers enforce in SQL,
every time:

```
inkAddCandidates.ts:1223  .set({ status: "generating" })   … WHERE status = "planned"
                  :1319  .set({ status: "probe_failed" })  … WHERE status = "stored"
                  :1394  .set({ status: "probe_passed" })  … WHERE status = "stored"
```

So `CANDIDATE_TRANSITIONS` is a second copy of that rule in TypeScript, proven by
its own test and consulted by nobody. **Disposition: KEEP** — it is also the only
place the machine is written whole, and a deleted state machine looks identical
to one that was never specified. **Filed as a post-milestone build: make the SQL
writers take their predecessor FROM the table**, so the mirror becomes a source.

### 6c. Test seams and hooks by name — **KEEP** (9, unchanged from §1a)

## 7. TWO FINDINGS ABOUT LIVE CODE, neither of them a deletion

### 7a. `INSTRUCTION_MAY_OVERRIDE` is declared, tested, and applied by nothing

`zoneScope.ts:99` declares that the INSTRUCTION can override a facet's scope, with
the audit's own reasoning beside it (*"scope is a property of the facet AND the
instruction"*):

```
marks : default distributedFacet → override "object"           (a single named scar)
ink   : default object           → override "distributedFacet" (a sleeve)
```

**The applier does not exist.** The only production consumer of scope is
`maskedRefine.ts` → `scopedZone(facet, region)`, which takes **no instruction
argument at all** and switches on `zoneScopeOf(facet)` alone. The table's only
other mentions are its own test — which asserts the table's CONTENTS, a pure
mirror test — and a documentation row inside `openKindPolicy`.

So *"a scar on her cheek"* takes the `distributedFacet` branch and is dilated 48px
and rendered whole, where the table says it should be scoped as an object.
**Invariant 7's shape in live geometry, not a dead export.**

⚠ **NOT claimed: that this is visible.** No frame has been put in front of
anyone, and the repaint road renders full-frame, so it is a paste-road question
at most. What is proven is that **the rule is not invoked**; the consequence is
unmeasured.

### 7b. The `openKind*` accessors are a POLICY RECORD, not a policy engine

Nine of `openKindPolicy.ts`'s twenty exports are per-property accessors.
Production imports exactly three things from the module — `isOpenKindKey`,
`openKindNoSpecimenReason`, `openKindPresenceBindsToday`. The nine are not
ignored: they are **quoted in comments by the code that implements their answers
independently**.

```
inheritedVerdict.ts:94         "…and `openKindZoneScope()` answers `fullFrame` — so there is no…"
referenceSlotCatalogue.ts:1178 "`openKindZoneScope()` is `fullFrame`, and `ownSide` is meaningless…"
```

**Disposition: KEEP** — it is the open lane's written answer sheet and D-241's
road is young. **Filed with 7a as one class: a policy stated in one place and
implemented in another, with a comment as the only join.**

### 7c. A disposition already written in the code, honoured

`OPEN_QUESTIONS` (`zoneScope.ts:108`) is an empty map with its reason inline —
*"Kept as an empty map rather than deleted… the next one added has somewhere to
go"*, founder-ruled 2026-08-06. **KEEP, no further reading.**

## 8. WHAT WAS REMOVED, and what each removal cost

### 8a. The server's duplicate `STATED_WARDROBE_NOTICE`

Declared twice, byte-identical, and only the client's was ever read:
`rollProjection.ts:488` sends the BOOLEAN and `sheetNotice.ts` owns the sentence.
The server's copy was imported by nothing — **not even a test**. Deleted; the
reasoning that stood over it moved to the surviving declaration rather than being
deleted with it.

**`FELL_BACK_NOTICE` is NOT the same shape** — single-copy, declared beside the
function that uses it. The recon flagged it as possibly a sibling; it is not.

### 8b. `READ_PURPOSES` — **derived, not deleted** (fable-979)

It was annotated `: readonly ReadPurpose[]`, which rejects an array member that is
not a purpose and says **nothing** about a purpose missing from the array. A
thirteenth `ReadPurpose` would have compiled and quietly fallen out of every
sweep that walks the list. Now `satisfies` keeps the first direction and a
type-level `AssertNever<Exclude<…>>` buys the second.

**Its control was driven, not assumed:** removing `"gate"` from the array while it
stays in the union gives

```
server/providers/types.ts(396,15): error TS2344: Type '"gate"' does not satisfy the constraint 'never'.
```

and restoring it returns `tsc --noEmit` to exit 0.

### 8c. `beginInkAddIntent` and its private ring — its own commit (fable-979)

The placement-picker intent (`{ sourceAssetId, side }`), superseded by
`beginInkAnywhereIntent` (`{ instruction }`). The route that still carries its
NAME — `evidence.beginInkAddIntent`, kept because the client calls it — has
validated an `instruction` and called the successor since that landed, **which is
why the dead function reads as alive from every direction except an import
graph.**

Removed with it: `InkAddIntentDependencies` (its one live borrower,
`InkAnywhereIntentDependencies.warnAuthorizationUnknown`, now names a local type),
`closedIntentResult`, and the private `classifyInkAdd` whose only caller it was.

> **The tests were RE-POINTED, not deleted — and that is the finding.** Five tests
> drove the dead function. Three of them were the only coverage anywhere of
> branches that exist in the LIVE function: **the flag door, the operation replay,
> and warn-once on unavailable authorization truth.** Deleting the dead road's
> tests would have taken three live branches' only coverage with it. Each was
> re-pointed at `beginInkAnywhereIntent` and **each reddens ALONE under its own
> sabotage** (door removed → only the door arm fails; replay branch falling
> through → only the replay arm; the warn call disabled → only the warn arm).
>
> **The class, for the rest of this milestone:** when a dead road's tests are
> deleted, ask which of them were testing the LIVE road through the dead one. A
> superseded function and its successor usually share their scaffolding.

### 8d. THE SECOND RING — filed by name, deliberately NOT taken

Deleting `beginInkAddIntent` orphans a further ring that this commit stops short
of, because each item needs something this sitting did not have:

| symbol | why it is held |
|---|---|
| `commitBeginInkAddIntent` (`db/inkAddIntents.ts`) | its only remaining consumer is `r7-ink-add-lifecycle-db.test.ts`, which uses it to BUILD intents for the whole downstream lifecycle — and that suite **skips without `TEST_DATABASE_URL`**. Rewriting its setup onto `commitBeginInkAnywhereIntent` would ship an unverified rewrite of a suite that cannot be run green here. **Needs a disposable database.** |
| `BeginInkAddIntentResult` | dies with the above |
| `buildInkAuthorizationProviderConfig` | now test-only; it will appear on the NEXT sweep, which is the honest way for it to arrive |
| `authorizeInkAddDescription` + `composer/inkAuthorization.ts` | the placement-picker road's whole authorization module, with its own suite. A module-sized retirement, not a symbol-sized one — **and `inkAddRecipe.ts` is already marked retire with 18 remaining callers in the Atlas.** |

**Not a deferral without an owner:** these are named here with their blockers, and
the first two are unblocked by exactly one thing (a disposable database).

## 9. THE SECURITY FAMILY — read, and going to the founder as ONE card (fable-979)

Neither is a deletion the milestone may take on its own, because **a deleted alert
and an alert that never fires look identical**.

- **`recordGlobalFailedLogin` / `shouldSendGlobalAttackAlert` /
  `markGlobalAttackAlertSent`** (`server/security/rateLimit.ts`) — zero production
  mentions, and `docs/RATE_LIMITING.md:285-294` carries a worked example of the
  wiring **that was never done**. Documentation of a call site that does not exist
  reads as a live control to anyone auditing.
- **`getRecentTopupCount` / `getRecentTopupCredits`** (`db/moderatorQueries.ts`) —
  barrel-reached, no caller; `SlackAlerts.velocityLimitHit` exists with no caller;
  and `server/velocityLimits.test.ts:108` asserts **that the alert is a function**.
  A suite that proves a control exists and never that it fires.

Both are already in CLAUDE.md's *"Currently not enforced — do not rely on these"*
list. **A deletion changes what that list means**, so the choice is the founder's:
wire them, or delete them and say so in that list.

**BOTH RESOLVED, by opposite doors, and the list says so.** The login-attack
detector was **WIRED** on 2026-08-19 (`server/security/loginAttackAlert.ts`, onto
the admin and moderator panels rather than Slack, because production has no Slack
webhook). The velocity pair was **DELETED** the same day, by the founder's stated
default after a wire-or-bin card: the helpers, `SlackAlerts.velocityLimitHit` and
`server/velocityLimits.test.ts` are gone, and CLAUDE.md, `BILLING_ALERTS.md`,
`SECURITY_OVERVIEW.md` and audit H5 all record it. Neither was silently deleted,
which is what this section asked for.

**One correction this section owes itself.** It filed the velocity pair under the
same shape as the login detector — *"helper written, docs written, call site never
added"*. That is wrong about the velocity pair. The caps were **wired and live**
from `a3abdf8b` (2026-02-06) to `41a765ea` (2026-02-07), when removing the
one-time topup system deleted `createTopupCheckout` and with it the only call
site. Nobody skipped a step; a deletion aimed elsewhere orphaned a control and
nothing swept behind it. The two symbols read identically to an import graph and
arrived by entirely different roads — **a reading that only asks "does anything
call this" cannot tell a control that was never wired from one that was
un-wired**, and only the second kind has a commit that can be found and read.

## 10. THE CLASS both §7 findings belong to (ruled fable-980)

> **A policy stated in one place and implemented in another, with a comment as
> the only join — the record and the behaviour agree today and nothing holds
> them together.**

Two instances found in one pass, and both cite this line: `INSTRUCTION_MAY_OVERRIDE`
(§7a) and the `openKind*` accessor family (§7b). It is law 4's cousin: not a second
LIST shadowing a source of truth, but a second STATEMENT of a rule, in prose or in
a table, that no execution path consults. It fails the same way — silently, at the
moment somebody changes one side.

**Where to look for more of it:** any table or accessor whose only importer is a
test, whose values are ALSO quoted in a comment somewhere in the production path.
The comment is the tell — it is what a developer writes when they have read the
policy, agreed with it, and implemented it by hand.

### 10a. §7a's card carries one more fact than the finding does (fable-980)

`scopedZone` is on the **PASTE road**, and the paste road is the legacy one —
`CASTING_REPAINT_SCOPE` supersedes it, and a repaint renders full-frame with no
mask scoping at all. So the honest repair may be **"the road retires"** rather
than **"the override wires"**, and that choice belongs to the road's own
planning, not to a cleanup milestone. The finding is filed; the fix is not this
milestone's to choose.

---

## 11. THE CORRECTION — the reading list is 98, not 118, and the recon's own
## finding is why

**§1 above is wrong, and it is wrong in the way §1 itself warned about.** The
recon proved that 100% of the sweep's *named-by-nobody* list (64) had production
mentions — and it did not re-run that check against the sweep's OTHER list. **It
fixed the instance and not the class** (law 7).

The arithmetic hid it. The sweep prints a TEST-ONLY list that was **111** long.
The triage reader classifies all 175 into four buckets, and its **NONE** bucket
was **also 111** at that moment. They are different sets. §1's *"the reading list
is 118 — the 111 test-only plus seven of the OTHER"* silently used one 111 where
it meant the other.

Crossed properly:

```
sweep TEST-ONLY 111  →  NONE 75 · OTHER 21 · BARREL 11 · DYNAMIC 4
```

### 11a. Thirteen entries on the reading list have live production callers

Verified at the call site, not from the reader's classification:

| symbol | live caller |
|---|---|
| `adjustUserCredits` | `lib/adminActions/directActions.ts:219`, `changeRequestActions.ts:288` |
| `updateUserRole` | `routes/admin/roles.ts:35` |
| `listAllUsers` | `routes/admin/users.ts:296`, `routes/moderator.ts:137` |
| `getUserFullDetails` | `routes/admin/users.ts:331` |
| `getUserStatistics` | `routes/admin/users.ts:323`, `routes/moderator.ts:182` |
| `unblockIp` | `routes/admin/ipBlocking.ts:81`, `directActions.ts:180` |
| `getBlockedIps` | `routes/admin/ipBlocking.ts:134`, `routes/moderator.ts:107` |
| `getFlaggedReferrals` | `routes/moderator.ts:403` |
| `expireStalePendingReferrals` | `_core/index.ts:307` |
| `getFilteredAuditLogs` | `routes/admin/auditLogs.ts:17,65` |
| `getAbuseAlertsSummary` | `routes/admin/auditLogs.ts:36`, `routes/moderator.ts:36` |
| `getAuditStatistics` | `routes/admin/auditLogs.ts:43`, `routes/moderator.ts:43` |
| `getAuditLogById` | `routes/admin/auditLogs.ts:51` |

Every one is reached as `const { X } = await import("../../db")` — a **dynamic
barrel import**, which is the sweep's declared bias arriving on the list it was
not checked against.

**Admin credit adjustment and admin role changes are live.** A triage opened
against the uncorrected list would have spent its first hour proving that, which
is the recon's three-security-controls finding one size larger.

### 11b. Two BARREL entries are NOT live, and both are findings

- **`mintModelAtomically`** (`db/models.ts:134`) — no mention anywhere outside its
  own file and the barrel, and its docblock reads *"Mint a model on export —
  assigns agencyId and locks the identity. **Called when a user exports their
  model for the first time.**"* **A docblock asserting a call site that does not
  exist** — the same shape as `docs/RATE_LIMITING.md`'s worked example of wiring
  that was never done, this time on a mint that claims to lock an identity.
- **`markModelAssetsStale`** (`db/models.ts`) — one COMMENT mention in
  `mintPackage.ts:805`, no caller.

### 11c. The class, for anyone building the next sweep

> **Two lists that are the same LENGTH are not the same LIST.** The conflation
> survived a written recon because both numbers were 111 and the sentence joining
> them read as arithmetic. Where two instruments' outputs are combined, combine
> them **mechanically and print the intersection** — a number carried across a
> paragraph in prose is a claim about a join nobody performed.

---

## 12. THE INTERSECTION IS NOW PRINTED BY THE SWEEP — and it corrects §11 too

**Ordered fable-982 §3**, and building it found a SECOND error in §1, in the
opposite direction from §11's.

The classifier moved to `scripts/lib/productionMention.mts`, imported by both
instruments, and the sweep now ends by asking it about every symbol it flagged
and printing the join itself:

```
INTERSECTION CONTROLS
  positive  shouldSendGlobalAttackAlert → none    PASS
  negative  isAccountLocked             → barrel  PASS

THE READING LIST - 110 of 175 flagged
  with a production mention  65  (barrel 34 - dynamic 7 - other 24)
  nothing but a declaration  110   <- THE LIST
```

Split by which of the sweep's two lists each came from:

```
test-only        111  →  77 on the reading list
named-by-nobody   64  →  33 on the reading list
```

### 12a. §1's other claim was also wrong: **33 of the 64 have no mention at all**

§1 says *"Every single one of the 64 'named by nobody' entries has a production
mention."* **It is not true of 33 of them.** Hand-verified rather than taken from
the classifier:

```
verifyBackView    declared server/casting/backViewGate.ts:106 — no other mention anywhere
isTasteWritable   declared server/castingV2/axisRegistry.ts:1092 — no other mention
pairSlots         declared server/castingV2/facePanel.ts:911 — no other mention
```

So the recon was wrong in **both** directions: §11 showed it kept thirteen LIVE
symbols on the reading list; this shows it removed thirty-three DEAD ones from
it. Both errors have the same cause — a join performed in prose — and both are
now impossible to make, because the join is printed by the instrument.

### 12b. And §11's own figure of 98 inherited the false premise

§11 derived *"111 − 13 = 98"* while quoting §1's 100% claim as established. **The
figure to use is the sweep's own printed one.** The strict reading is **110**,
and the remaining hand work is the **OTHER bucket (24)** — a mention that is a
COMMENT is not a caller, and only a person can tell those apart. The recon's
OTHER pass (§1a) already did that for 23 of them and kept 20 on the list.

> **The class, sharpened:** §11c said combine mechanically. This says why it
> matters twice over — **a prose join fails in BOTH directions, and neither
> failure announces itself.** One left admin credit adjustment on a deletion
> list; the other hid a third of the dead code from the milestone that was
> looking for it.

---

## 13. THE EXACT LIST, BY AREA — and the tail outside casting is read

With the intersection printed rather than reasoned, the milestone finally has a
list it can be budgeted against:

```
110  server/castingV2 65 · server/casting 31 · server/db 7 · server/security 3
     · server/monitoring 2 · server/slack 1 · server/testing 1
```

The 14 outside `casting`/`castingV2` are read here, because they are the ones a
casting-shaped reading would never reach.

### 13a. Underscore-prefixed test seams — **KEEP** (4)

`_clearCooldowns`, `_getCooldownCount` (`monitoring/healthMonitor.ts`),
`_clearPendingActions` (`slack/slackApproval.ts`), `allowColdImports`
(`testing/coldImportTimeout.ts`). The leading underscore is this codebase's own
convention for a seam, and `server/testing/` is test infrastructure by
directory. The sweep cannot see a convention; a human can.

### 13b. The security three — the founder card of §9

`recordGlobalFailedLogin` / `shouldSendGlobalAttackAlert` /
`markGlobalAttackAlertSent`. Unchanged from §9: wire-or-delete, his call.

### 13c. THE FINDING — `removeEdgesForItems` is the deletion path's other half,
### and nothing calls it

`server/db/boardEdges.ts:79` exists to remove the edges belonging to deleted
board items. **The deletion path does not call it.**

```
routes/boards.ts:339  deleteItems  →  db/boards.ts:610  deleteBoardItems
                                      deletes boardItems, and only boardItems
drizzle/schema.ts:1894  boardEdges.sourceItemId / targetItemId
                        plain int columns with indexes — NO foreign key,
                        so no ON DELETE CASCADE is doing it either
db/boardEdges.ts:22     getBoardEdges(boardId) selects every edge on the board
                        with no join to items — orphans are RETURNED
```

So deleting an item leaves its edges in the table and in the payload. **Three
readings, no join between them, and each was taken from the file rather than
recalled.**

⚠ **NOT claimed: that a user sees anything.** React Flow drops edges whose
endpoints are absent, so the likely surface cost is nothing and the likely real
cost is unbounded row growth on a table nobody prunes. **What is proven is that
the helper written for this exact path is not invoked** — invariant 7, and the
THIRD instance this milestone has found (after `INSTRUCTION_MAY_OVERRIDE` and
the security alert family).

**Disposition: NOT a deletion.** `removeEdgesForItems` is the fix, not the
debris — wiring it into `deleteBoardItems`'s transaction is a one-line build
with an owner, and it is filed as one rather than taken here, because a boards
write path is not a cleanup milestone's to change on its own reading.

⚠ **THAT DISPOSITION WAS OVERTURNED — see §23d, executed §26.** It is left
standing because it is what was true on the day it was read. The count that
overturned it found three deletion paths rather than one and two child tables
rather than one, and the turn that mattered is this: **wiring the helper would
have satisfied the sentence above while breaking enforcement invariant 1 inside
the very commit fixing a deletion path**, because it deletes by bare item id
with no owner in the statement. The three paths were fixed forward with
owner-scoped statements instead, and the helper — superseded rather than merely
uncalled — was deleted 2026-08-22.

### 13d. The rest of `server/db` — INVESTIGATE with the milestone's own list (4)

`listSegmentHistory`, `listOrphanedVariants`, `dbReferencePlateIngestionPersistence`,
`inspectOwnedInkAddAvailability`, `getStorageCleanupBatchByOperation`,
`getStorageCleanupItemsForBatch` — reporting and inspection helpers around
casting V2 and the cleanup worker. Each needs the same question asked of it as
§13c: *is this debris, or the unwired half of something?* — and after `removeEdgesForItems`
that question is no longer rhetorical.

## 14. `server/casting` — 31, and the milestone's real question is now sharp

### 14a. The second ring ARRIVED on its own, exactly as §8d said it would

`buildInkAuthorizationProviderConfig`, `authorizeInkAddDescription` and
`INK_ADD_RECIPE` are on this list because `beginInkAddIntent` was removed. §8d
predicted it — *"it will appear on the NEXT sweep, which is the honest way for it
to arrive"* — and it did, without anyone having to remember. **A retirement that
leaves its next ring to the instrument does not need a follow-up note; it needs
the instrument to be run.** Sixteen of these 31 are `casting/evidence`, which is
the placement-picker road unwinding.

### 14b. **The discrimination this milestone is actually for**

Two symbols on the same list, both uncalled, and their dispositions are
opposites:

| symbol | reads as | is |
|---|---|---|
| `verifyBackView` (`backViewGate.ts:106`) | an unwired identity gate | **debris.** Its own docblock says *"Back-compat alias (pre-D-46 callers/tests)"*; the real gate `verifyViewIdentity` is wired at `mintPackage.ts:41` and is what the tests drive. **DELETE.** |
| `removeEdgesForItems` (`boardEdges.ts:79`) | debris beside a live table | **a missing wire** (§13c). **KEEP and wire.** |

**An uncalled export is a QUESTION, not a verdict** — and the question is *what
was this for?*, which only the declaration and its neighbours answer. A milestone
that deletes by list would have removed the boards fix and kept the alias.

### 14c. Already dispositioned above, not re-argued here

The eight `evidenceCandidateContract` assertions (§6b, KEEP), `commitIdentityEdit`
/ `commitAnchorReRoll` (§1b, INVESTIGATE — M14's authority decides, not this
milestone), `CAST_PUBLIC_ID_PATTERN` and the ink constants (§5a's constant
family).

### 14d. Owed a read, each with the §14b question asked of it

`compressImageUrlForApi`, `compareModelSnapshotShadow`, `roleForAuthorizedResult`,
`isLimbInkZone`, `probeOutcomeAllowsCanon`, `planEvidenceMint`,
`planEvidencePackageSync`, `stageCanonicalReferencePlate`,
`createInkCalibrationRecorder`, `evaluateInkCalibrationGate`,
`inkAddCapabilityKey`, `resetStorageCleanupHealthReport`,
`assertStorageCleanupItemStatus`, `ALL_SUPPORTED_INK_ANATOMY_TUPLES`,
`INK_RELEASE_POLICY_VERSION`.

**`compareModelSnapshotShadow` is named first**: "shadow" in a name usually means
a comparison mode kept beside a live path during a migration, and a shadow whose
migration has landed is the cleanest deletion this list holds — or the last
instrument still watching something. One read settles which.

---

## 15. THE LIST'S FLOOR HAS TWO MORE HOLES IN IT, AND ONE OF THEM HID A WHOLE
## SUB-API — `scripts/sweep-shadowed-exports-disposable.mts`

§12 gave the milestone a printed list of 110 and §13 budgeted against it. The
list is a **floor**, which the sweep says of itself — but it names three biases
(namespace imports, dynamic specifiers, barrel re-exports) and there are
**five**. The two undeclared ones are found here, both hiding dead code, and
the first of them hid a symbol no list this milestone has read has ever held.

### 15a. The sweep matches imported NAMES and throws the specifier away

```
import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'][^"']+["']
                       ^^^^^^^ kept          ^^^^^^^^ discarded
```

So one `import { hairRegion } from "./axisRegistry"` marks **every** export
named `hairRegion` as imported. There are two: `axisRegistry.hairRegion(prompt)`
returns the hair sentence out of a composed prompt and is live;
`maskGeometry.hairRegion(geometry, destination)` builds a `RegionSpec` out of
authored shapes, is imported by `maskGeometry.test.ts` and nothing else, and
**appears on neither of the sweep's two printed lists** — not the 111, not the
64, not the 110.

Its siblings `eyeRegion`, `eyewearRegion` and `mergeRegions` are all three on
the reading list. The one with a live twin is the one that vanished.

**The repair is a resolver, scoped to where the bias can bite**: a name declared
in exactly one production file cannot be confused with anything. Sixty-six names
are declared in two or more, so those are the ones whose importers get their
specifiers resolved — relative, `@/`, `@shared/`, with directory-index and
extension resolution, and barrel re-exports followed to a fixpoint in both
`export { x } from` and `export *` forms.

Its controls are **structural** rather than specimens (§0's lesson, which cost
this milestone its first instrument): a relative specifier must resolve, a
directory specifier must land on `index.ts`, a bare package name must resolve to
nothing, and — the discrimination arm — declarations known to be live must come
back **reached**, because a resolver that reaches nothing would print the whole
repository as dead.

```
RESOLVER CONTROLS (structural — not facts about today's dead code)
  positive  a relative specifier resolves to its file   PASS
  positive  a directory specifier resolves to index.ts  PASS
  negative  a bare package name resolves to nothing     PASS

  names declared in 2+ production files   66
  of those declarations, reached by a production importer  81

DECLARATIONS NO PRODUCTION IMPORTER REACHES, WHOSE NAME LIVES ELSEWHERE — 7
```

Three of the seven are declared on the server or shared side, which is the
sweep's own scan root:

| symbol | dead here | the twin that hid it |
|---|---|---|
| `hairRegion` | `server/castingV2/maskGeometry.ts` | `server/castingV2/axisRegistry.ts` |
| `BRAND_NAME` | `server/casting/geminiPrompts.ts` | `client/src/foundation/brand.ts` |
| `OverridableField` | `server/castingV2/briefCompiler.ts` | `client/src/features/castingV2/sheetState.ts` |

The other four are client-side (`withRetry`, `formatRelativeTime`,
`GeneratedAsset`, `SEVERITY_ICONS`) and out of the parent sweep's scan root, in
the same way §3's `sidebar.tsx` is.

⚠ **Two biases this pass keeps deliberately**, both toward not-dead: a namespace
import reaches a module and is treated as reaching all of it, and so is a
dynamic import whose names cannot be seen. A dynamic import whose names CAN be
seen — `const { unionMasks } = await import("./maskGeometry")` — is read by
name, and that single line in one tracked helper was what had been covering the
whole authored-shape road.

### 15b. The sweep counts `scripts/` as consumers, and 283 of them are untracked

`consumerRoots = ["server", "client", "shared", "scripts"]`. Two hundred and
eighty-three files under `scripts/` are untracked disposables (§2) — they exist
on this machine and in no clone of this repository. A server export whose only
non-test consumer is one of those is dead by every standard the repository
itself can check.

**Measured, with its own controls** (a known tracked script must read as
tracked; untracked scripts must exist to be counted):

```
SERVER EXPORTS WHOSE ONLY NON-TEST CONSUMER IS AN UNTRACKED SCRIPT — 1
  AMBIGUOUS_WORDS_FOR_CORPUS   server/castingV2/removalWords.ts   (tests too)
```

**One.** The door is real and nearly empty, which is worth knowing precisely
because the untracked pile is 283 files: the disposables borrow from the product
far less than their number suggests.

### 15c. THE ISLAND `hairRegion` WAS HIDING — the authored-shape road, whole

Once the symbol surfaced, the sub-API around it reads as one closed island.
Every one of these has **zero** mentions anywhere outside `maskGeometry.ts`,
counted mechanically:

```
FaceGeometry · RegionKind · RegionSpec · hairRegion · eyeRegion
browRegion · eyewearRegion · mergeRegions
```

`FaceGeometry` is the input type and **nothing in the repository produces one**
outside the module's own test. The live paste road builds its zones from
segmenter mattes in `maskedRefine` (`scopedZone(facet, region: Mask)`), never
from a `RegionSpec`.

This is the authored-shape road CLAUDE.md's fidelity law is named after — *"the
maskGeometry incident (masks built from authored shapes when segmentation models
were the obvious source)"*. The corrected versions sit beside it in the same file
and are also uncalled: `hairMaskFrom` and `eyeMaskFrom`, whose docblocks say
*"Same law as `hairRegion`, with nothing hand-drawn"*. The road was corrected by
being routed around rather than by being removed, and the sweep's blind spot is
why nobody has been asked about it since.

⚠ **NOT claimed: that anything is broken.** `mergeRegions` carries D-209's
batching law and `eyeRegion` carries the frames-are-opaque rule, and it would be
easy to read this as two founder rulings gone unenforced. **It is not that.** The
live road implements both — the frames case at length, in `maskedRefine`'s
removal-territory and corridor logic — by a different mechanism. The finding is a
dead island, not a missing guard.

**Disposition: superseded by §15d — the island is KEEP, WHOLE.** What follows
is the proposal as written, kept because the correction is only legible beside
it.

~~RETIRE the island — proposed, not taken.~~ It is the largest
single deletion the milestone has found (eight symbols, their tests, and a public
type), it touches the module the fidelity law is named for, and §14b's question
has a clean answer for once: *what was this for?* — it was the road before the
mattes. Held for ratification rather than taken on one shift's reading.

### 15d. ⚠ §15c's DISPOSITION IS WITHDRAWN — the island is a declared test
### vocabulary, and I had not read the module's own header

**The import facts in §15c stand. The verdict built on them does not.**

Two things were found on the way to executing the retirement, both inside files
§15c had not opened:

**1. The module header declares the shape machinery, in the same breath as the
fidelity law.** `maskGeometry.ts:28`:

> *"Everything below therefore operates on MASKS, from any source. **The shape
> rasteriser at the bottom exists to build fixtures for tests that must not cost
> a credit**; it is not a way to make a mask for a paying user, and it says so."*

So the authored shapes were not corrected-and-abandoned. They were **demoted on
purpose**, in writing, at the top of the file that carries the founder rider
about where masks come from. §15c read that demotion as an unfinished
retirement because it read the import graph and the live road and not the
prose above them.

**2. The fixtures those builders produce are what several LIVE functions are
tested with.** `rasterise` takes a `RegionSpec`, so the two types cannot leave
while the declared fixture facility stays — and the region builders are the
vocabulary the fixtures are written in:

```
const checked: UsableMask = assertUsable(rasterise(hairRegion(GEOMETRY), W, H), "hair");
expect(() => assertUsable(empty, "eyes")).toThrow(/selects nothing/);
expect(coverage(mask)).toBeGreaterThan(0.01);
```

`assertUsable` has live production callers. So does `coverage`. Counted rather
than eyeballed, the fixtures built through a region builder exercise
`assertUsable` (×2), `compositeMasked`, `coverage` and `outsideMaskUnchanged`.

**That is §8c's class, aimed at me**: *"when a dead road's tests are deleted,
ask which of them were testing the LIVE road through the dead one."* The
milestone wrote that rule after the ink-intent removal and I proposed a
retirement eight symbols wide without applying it.

**Status: KEEP, WHOLE — closed fable-991 §3.** The header is the evidence: a
declared fixture facility whose vocabulary tests live algebra. The three-symbol
residual (`mergeRegions`, `eyewearRegion`, `browRegion` — the ones whose tests
were not shown to touch live code) was offered and **DECLINED**: they cost
nothing while the facility stays, and an hour that changes nothing is not
spent.
What is still true and worth keeping: `FaceGeometry` has no producer in
production, nothing outside the module names any of these, and the live paste
road builds its zones from segmenter mattes. What is now also true: the
region API is the declared vocabulary of a declared test-fixture facility, and
some of its tests are the only coverage of live algebra.

> **The class, and it is the same one twice in one shift:** §15a found an
> instrument counting prose as a caller; this is a READER counting an import
> graph as an intention. **An import graph says who calls a symbol. It cannot
> say what the symbol is for — and in this repository the answer is usually
> written at the top of the file.** Read the module's own header before
> proposing to retire anything in it.

---

## 16. A SENTENCE STATED ON THE SERVER AND WRITTEN AGAIN ON THE CLIENT —
## §8a's class, swept at last

§8a removed the server's duplicate `STATED_WARDROBE_NOTICE` and, for its law-7
sweep, read **one** neighbouring constant (`FELL_BACK_NOTICE`, innocent). That is
an instance check, not a class sweep.
`scripts/sweep-duplicated-sentences-disposable.mts` is the sweep it owed: every
sentence-shaped string literal in server production source, asked whether the
same sentence appears verbatim in client source.

Its matcher controls are **synthetic** — a fabricated shared sentence must be
found, a one-word variant must not, a sentence quoted in a COMMENT must not be
read as a literal, and a literal after a URL must survive comment-stripping — so
no control can die when the product retires a specimen. Its corpus controls are
counts, so a run that scanned nothing cannot report clean.

```
CORPUS CONTROLS (a run that scanned nothing is not a clean run)
  server production files            431
  sentence-shaped server literals    2974
  client source files                378

SENTENCES DECLARED ON THE SERVER AND WRITTEN AGAIN ON THE CLIENT — 11 → 10
```

**Ten of the eleven are two LIVE statements**, which is a different thing from
§8a's shape and mostly legitimate: a client pre-validation toast beside a server
validator (`"Stripe session ID is required for refund requests"`, `"Please enter
a valid email address"`), a client access-denied toast beside a tRPC FORBIDDEN
message, generic auth failure copy. They drift, but both copies run.

Two are worth naming and neither is a deletion:

- **`"Finish or discard the current evidence edit before restoring this Cast."`**
  is §8a's exact shape with a live server copy: `wholeCastRestore.ts:641` throws
  it as a `PRECONDITION_FAILED`, the wire carries `blockedByPendingEvidence:
  boolean`, and `CastStateHistory.tsx:107` writes the sentence again for the
  hint. Reword the throw and the hint keeps yesterday's words. **One promise, two
  homes — filed, not changed**; a live error path is not a cleanup milestone's to
  refactor.
- **`"Tattoo previews are temporarily unavailable. Nothing was charged."`** is the
  same duplication carrying a MONEY claim, and the client's copy is a fallback
  for *any* error with an empty message (`publicMessage()` in
  `useInkAddWorkflow.ts:58`). The server says it where it knows nothing was
  charged; the client says it where it knows nothing at all. **Filed** — a false
  reassurance is worse than no sentence, and it is a product judgement rather
  than a deletion.

### 16a. The one that WAS §8a's shape — removed

`VARIANCE_CONFESSION` (`server/castingV2/varianceBudget.ts`) declared

> "Most of this sheet is held — the eight will differ mainly in expression."

and **nothing imported it — not even a test**, exactly as the server's
`STATED_WARDROBE_NOTICE` was. `CastingSheet.tsx:2060` writes the same sentence
again and shows it, gated on `varianceHeld: boolean` from `rollProjection`.
Deleted, and the sweep's own count fell 11 → 10 with `tsc --noEmit` at exit 0.

**Its docblock disagreed with the running product, and that is the part worth
keeping.** It said *"Before the roll, not after… they are entitled to know that
while it is still a decision"*, while the live surface says it after the eight
faces exist — `rollService.ts:374` states that choice deliberately (*"so the
sheet can say, after the fact"*). So the dead constant was the last written
record of an intent the road did not take.

Deleting it silently would have deleted that record. The reasoning moved to the
surviving declaration in `CastingSheet.tsx`, with the fact that makes it
actionable: the variance plan is computed by the brief compiler **inside roll
creation**, so a pre-roll confession is not a copy change — it needs the brief
compiled at echo time, which is a second text call before anyone has paid.

---

## 17. THIS SHIFT'S READS, against §14b's question

| symbol | verdict |
|---|---|
| `compareModelSnapshotShadow` | **HOLD, blocked.** A single-model wrapper around `withTransaction` plus two live functions; the A4 audit script uses the cohort primitive instead, and `r7-snapshot-selection-contract.test.ts` pins the module's eight production callers, none of which is this. Its four tests exercise LIVE code through it (owner-scoped `NOT_FOUND`, the mismatch-kind vocabulary, the no-write assertion) — §8c's class — so removing it means re-pointing them, and they live in a suite that **skips without `TEST_DATABASE_URL`**. Same blocker as §8d's second ring, and it is now a measured one: **there is no `docker` on this machine** (`docker --version` → command not found), so a disposable database cannot be raised here at all. |
| `pruneSegmentFacet` | **HOLD — a road question, not debris.** Its own docblock declares the deliberate half-landing (*"There is no tRPC procedure and no charge path here… belongs with the face chart's surface (M12)"*), and `db/castingV2Segments.retireSegmentFacet` has no other consumer either, so the pair stands or falls together. But the user promise it was built for is already served: `RefinePanel.tsx:555` offers *"take something back — 'undo', 'remove the earrings' · free when you already have it"*, and the live road is the chain-step prune (`removeStep`, wired at `routes/castingV2.ts:964`). **The question for the face chart's owner is whether the segment-drop road still has a job**, and it is not a cleanup milestone's to answer. |
| `castImageUrl` | **DELETE candidate — debris, with a false docblock.** *"the only place the room learns an image URL"* is untrue eight lines above its own declaration: `castProjection.ts:434` calls `storagePublicUrl` directly, three times. The function is a one-line alias for `storagePublicUrl` with no caller. Joins `mintModelAtomically` (§11b) in the docblock-asserts-a-role-it-does-not-have family. |
| `retentionSweepEnabledForUser` | **DELETE candidate**, same family: *"Exposed for the boot wiring's readability"* — the boot wiring (`_core/index.ts:343`) imports `startCandidateRetentionSweep` and nothing else. |
| `blankSuppressed` (with `cutOf`) | **RETIRE candidates — the alternative that was not taken.** `blankSuppressed` blanks a suppressed axis out of the record; `cutOf` reads the record correctly by consulting the tiers. Neither is called. The design took the other road and says so at the call site: *"The tiers travel with the identity so no later reader has to infer where a value came from"*, and the only production reader of `realized` is the axis sweep, whose suppressor list is exactly the mechanism that excuses a silenced axis. ⚠ Checked before writing this: the user-facing hair record is already null under coverage (`hair: hairColour === null ? null : hairRecord(…)`), so no surface over-claims today. |
| `sweepComposedPrompt`, `suppressorsFor`, `CROSS_AXIS_IMPLICATIONS`, `AXIS_REGISTRY_BINDINGS` | **KEEP — a guard the suite drives and proves.** `axisRegistry.test.ts` builds a context with `suppressorsFor` and runs the sweep over really-composed prompts, with sabotage arms (hair removed → the hair axis is caught; eyes removed → the eye axis is caught). This is invariant 7 satisfied at the suite level, not another mirror test. `AXIS_REGISTRY_BINDINGS` says in its own comment that it exists to stop a linter stripping the compile-time bindings. |
| `deriveEvidenceCandidateBillingTruth`, `evidenceCandidateAttemptCost` | **KEEP with §6b** — and §6b's family is nine or ten, not eight. `BillingTruth` and `requiresRecovery` have no other mention in the server, so this is the same "the machine written whole in one place, enforced in SQL at every writer" shape already ruled KEEP, arriving on a billing noun. |
| the `maskGeometry` region island | **RETIRE, proposed** — §15c. |

---

## 18. `server/casting`'s §14d FIFTEEN — read, and the ink road answers most of them

§14d listed fifteen symbols owed a read with §14b's question asked of each.
`compareModelSnapshotShadow` is in §17; the other fourteen are here. **Nine of
them are KEEP under a family already ruled** — which is itself the reading's
result, not a shortcut: the ink and cleanup modules around them are live, with
five to twenty production importers each, and the flagged symbol is the derived
list or the closed-value assertion beside them.

| symbol | verdict |
|---|---|
| `stageCanonicalReferencePlate` | **KEEP — declared, with an owner.** *"Internal C2 orchestration only. No route, worker, startup hook, or production delivery adapter may call this until the later reviewed C4 capability."* An uncalled export whose docblock forbids callers is not debris; it is a landing waiting for its gate, the same shape as `pruneSegmentFacet` (§17) and the honest version of what §8d holds. |
| `ALL_SUPPORTED_INK_ANATOMY_TUPLES` | **KEEP with §6a** — a derived list (`allSupportedInkAnatomyTuples()` over the registry's own rules), and `inkAnatomyRegistry` has six production importers. Deleting it pushes its test back onto a hardcoded tuple list, which is §6a's argument exactly. |
| `isLimbInkZone` | **KEEP with §6a**, same module, a predicate over the same table. |
| `INK_RELEASE_POLICY_VERSION` | **KEEP** — `inkReleasePolicy` is live in three production modules; the version constant is what its test pins so a policy change is a visible diff. CLAUDE.md's *"the released-tuple table is EMPTY — measured is not earned"* is the reason it looks inert. |
| `assertStorageCleanupItemStatus` | **KEEP with §6b** — a closed-value assertion beside `assertStorageCleanupBatchStatus`. The pair is the contract; one of the two happens to have a mention. |
| `resetStorageCleanupHealthReport` | **KEEP with §6c** — *"For tests, which must not inherit a previous case's memo."* |
| `probeOutcomeAllowsCanon` | **KEEP with §6b** — the retry decision's own predicate, in a module the composer road drives. |
| `planEvidenceMint`, `planEvidencePackageSync` | **KEEP** — both are the async wrapper around a `compute…Plan` that their own module calls internally, and both modules are production consumers of `readSnapshotShadowStateIn`. Same shape as `compareModelSnapshotShadow` (§17) and held for the same reason: their tests drive live planning code through them. |

And five that are candidates:

| symbol | verdict |
|---|---|
| `compressImageUrlForApi` | **DELETE candidate.** Its sibling `compressImageForApi` is live (`aiService.ts:99`, a destructured dynamic import); the URL-fetching variant has no caller anywhere. |
| `inkAddCapabilityKey()` | **DELETE candidate** — an accessor returning `INK_ADD_CAPABILITY_KEY`, while the live composer imports the CONSTANT directly (`inkAddRecipe.ts:2`). The accessor family of §7b with the difference that here the thing accessed is already imported by name. |
| `roleForAuthorizedResult` | **DELETE candidate** — *"Convenience: the role a frontClose result takes under an authorization (§7.2 table)"*, and it is `authorization.anchorEligible ? "anchor" : "display"` with **zero mentions anywhere**, test included. ⚠ Checked for the §10 class before writing this: the live writers do NOT re-implement the mapping, they pass a literal (`identityStampFor({ role: "anchor", … })`) because an identity commit is definitionally an anchor. So it is an unused convenience, not a policy stated twice. |
| `createInkCalibrationRecorder`, `evaluateInkCalibrationGate` | **RETIRE candidates, with the road.** *"A calibration command may persist the returned allowlisted snapshot explicitly"* — **there is no calibration command**: nothing under `scripts/` or `server/routes/` names either symbol. Instruments landed ahead of a caller that never arrived, on the placement-picker composer road that §8d already has marked retire. They go with `inkAddRecipe`, not on their own. |

⚠ **The cluster this leaves is worth naming.** `roleForAuthorizedResult` sits in
`anchorSelector` beside `commitIdentityEdit` / `commitAnchorReRoll`, which §1b
holds as INVESTIGATE because **M14's authority decides that road, not this
milestone**. All three are uncalled, all three are about who may stamp an
anchor. They should be dispositioned in one sitting by whoever owns M14 — not
picked off individually by a cleanup pass that would be guessing.

---

## 19. THE INSTRUMENT COUNTED THIS DOCUMENT'S OWN FAMILY AS A CALLER — and the
## repair turns nine hand reads into a rule

Building §15's instrument moved the list. `eyeRegion`, `eyewearRegion` and
`mergeRegions` — three of the very symbols the new sweep was written to expose
— **left the strict reading list the moment its docblock named them**.

`productionMention.mts` already carried a guard for exactly this, with a
docblock saying it *"caught itself first"*. The guard was spelled as two
filenames:

```
const SELF = /(sweep|triage)-uncalled-exports-disposable\.mts$|…/
```

A list does not cover its next member. **A guard spelled as a list of names is
the same defect it is guarding against** — law 4, one level up — so it is now
spelled as the family's naming rule.

### 19a. And the deeper repair: a mention in a COMMENT is prose, not a caller

The self-contamination was one instance of something the recon already knew and
had been paying for by hand. §1a read twenty-three OTHER-bucket entries and
classified **nine** of them as *"a sentence in a COMMENT naming the symbol —
prose, not a caller"*, one at a time, keeping every one on the list.

Nine hand reads is a rule nobody wrote down. It is written down now: the
classifier blanks comments before it counts, string literals copied through so
a `//` inside a URL cannot swallow the call after it.

**Its controls are synthetic** (§0's lesson again — a control that is a real
specimen dies when the product retires that specimen), and they run in both
directions in one fixture:

```
INTERSECTION CONTROLS
  positive  shouldSendGlobalAttackAlert → none    PASS
  negative  isAccountLocked             → barrel  PASS
  synthetic a name only DISCUSSED is not a mention  PASS
  synthetic a call after a URL survives stripping   PASS
```

### 19b. What it does to the list — 110 → 117, and the hand pile halves

```
THE READING LIST - 117 of 170 flagged
  with a production mention  53  (barrel 34 - dynamic 7 - other 12)
  nothing but a declaration  117   <- THE LIST
```

Eleven symbols joined the strict list, and **nine of them are §1a's own nine**
— `rasterise`, `requestMatte`, `openKindZoneScope`, `openKindIsPlural`,
`openKindDeparture`, `presentPair`, `isDistributed`, `HAIR_STYLE_NAMES`,
`refusalTallies`. Nothing is overturned: the hand pass got all nine right. What
changes is that the next reader does not have to repeat it, and the OTHER
bucket a person must read fell from 24 to **12**.

The other two are `SYSTEM_PROMPT_FOR_TESTS` and `isBilateral` — the two
instruments' own control specimens, which their own prose had been promoting
off the list. A control that quietly exempts itself from the list it controls
is the shape §0 warned about, arriving from the other side.

Four left the list because they were deleted: `VARIANCE_CONFESSION` (§16a) and
the three of §17's candidates taken below.

> **The class, for the record:** an instrument that reads source text counts the
> writing ABOUT the code as the code. Every reader in this family — the mention
> classifier, the in-module use counter, the duplicated-sentence sweep — needed
> the same repair, and each found it independently. **Strip the prose before you
> count, or the milestone's own document becomes the reason a symbol looks
> alive.**

### 18a. §18's five, dispositioned — ruled fable-991 §4

- **TAKEN**: `compressImageUrlForApi` and `inkAddCapabilityKey()`, with the
  four of §17 (`INK_ADD_CAPABILITY_KEY`'s import went with the accessor). No
  test drove either.
- **`createInkCalibrationRecorder` / `evaluateInkCalibrationGate` go WITH the
  composer road**, not alone. They are instruments for a calibration command
  that does not exist, on the placement-picker road §8d already has marked
  retire — a module-sized disposition, like `composer/inkAuthorization.ts`.
- **`roleForAuthorizedResult` joins the anchor trio for M14's owner**, in one
  sitting: it, `commitIdentityEdit` and `commitAnchorReRoll` are three uncalled
  symbols about **who may stamp an anchor**. That is a road's design question.
  A cleanup pass picking them off one at a time would be deciding it by
  accident, which is the opposite of what this milestone is for.

---

## 20. THE HAND PILE GOES FROM TWENTY-FOUR TO THREE — the recon's readings,
## written as rules

§19 turned one of the recon's hand rules into code (a comment is not a caller).
Reading the twelve that survived it, **eleven were the same kind of thing**:
not judgements, but rules the recon applied consistently and never wrote down.
They are written down now, each with the evidence that earned it.

| the recon's hand read | now |
|---|---|
| *"a SUBSTRING of a longer symbol (`REFUSAL_REASONS` inside `GUARD_REFUSAL_REASONS`)"* | matching is on **word boundaries**. The classifier's one declared bias is gone rather than documented. |
| *"a same-named LOCAL in a disposable script"* (`FACET_KEYS`, `stepLabel`, `cutOf`) | a line that **declares** the name (`const X =`, `function X(`) is not a mention of somebody else's `X`. |
| *"an object KEY spelled like the symbol"* (`INSTRUCTION_MAY_OVERRIDE`, `OPEN_QUESTIONS`) | a line matching `^\s*NAME\s*:` is a **key**, not a reference. A computed key `[NAME]:` has brackets and still counts, which is correct — that one IS a reference. |
| *"re-exported through a module barrel and imported by NOBODY from it — a re-export is a door, not a caller"* (five symbols) | its own bucket, **`door`**, checked AFTER the barrel and counted **onto** the reading list. |
| *"a real consumer in a TRACKED script"* — kept off the list; and §15b's untracked-only consumer, which is not a consumer at all | git decides. `git ls-files` is asked, and an untracked disposable is not evidence. |

```
THE READING LIST - 124 of 168 flagged
  with a production mention  44  (barrel 34 - dynamic 7 - other 3)
  nothing but a declaration  119
  a re-export door only      5
  THE LIST                   124
```

**The pile a person must read by hand is three**, and all three are honest:

- `inspectStorageCleanupReconciliation` — a real caller in a **tracked** script
  (`run-storage-cleanup.mts`). Correctly OFF the list, as the recon had it.
- `commitBeginInkAddIntent` — reached by `drive-r7-ink-add-intent-disposable.mts`,
  which is **tracked**. §8d holds it for a disposable database; it also has a
  consumer this repository contains.
- `stepLabel` — a same-named local in a tracked calibration script, *used* on a
  later line. Telling that apart needs scope analysis, not a pattern, so it
  stays a hand read with its reason stated.

### 20a. The door bucket is on the list, because the recon's ruling says so

A door counted as a mention would have quietly taken five symbols off the list
the recon had deliberately kept on it. It is a separate printed bucket so the
reason stays visible, and it is checked **after** the barrel — `server/db/index.ts`
is the one door this product actually walks through (`db.NAME(`), and
collapsing the two would put admin credit adjustment back on a deletion list
(§11a, the milestone's most expensive near-miss).

### 20b. And the print had stopped adding up

Introducing a fifth bucket left the summary line reading `barrel 34 - dynamic 7
- other 3` beside a total of **49**. Nobody would have noticed; the numbers
look like numbers. **The sweep now refuses to print a verdict whose buckets do
not sum to the count it flagged**, which is the suite-reading rule
(passed + skipped + failed must equal the printed total) arriving on an
instrument of our own.

---

## 21. THE DELETION DOOR IS A TABLE AND A CHECK, not a document

The seam ordered *"the disposition document — the single deletion door"*.
Written as prose it would be **a second list shadowing a source of truth**:
every verdict already has a home in §6, §7, §8, §13, §14, §17 and §18, and a
document restating them drifts from those sections inside a shift. That is
law 4, and this milestone has spent the night quoting it.

So the door is `docs/specs/cleanup-dispositions.yaml` plus
`scripts/check-cleanup-dispositions.mts`. One row per symbol on the sweep's
current reading list: a verdict, the reason in a sentence, **the triage section
that argues it** — and for a HELD row, the blocker BY NAME. This document keeps
the reasoning and stops being the index.

```
THE TABLE — 124 rows against a reading list of 124
  KEEP     71
  TAKE     1
  TAKEN    0
  HELD     14
  FILED    2

  unread       36
  stale        0
  blockerless  0
  unknown      0
```

**The milestone finally has an exit condition that is a number**: it is finished
when `--strict` is green. Thirty-six symbols remain unread — the honest count,
down from "96 left" which was an estimate against a list two corrections old.

### 21a. What it refuses, and why each refusal is there

| refusal | why |
|---|---|
| `unread` | the sweep lists a symbol no row dispositions, or a row's verdict is blank. **Nothing is deleted while something is unread.** |
| `stale` | a row names a symbol that no longer exists. The Atlas refuses a stale annotation for the same reason — a table that can rot quietly is worse than no table. |
| `blockerless` | a HELD row with no blocker named. *"A deferral to when next touched has no owner and is not a deferral — it is a drop."* |
| `unknown` | a verdict outside the closed set, which is how a table grows a sixth meaning nobody agreed to. |

**Each is driven directly by a synthetic fixture that must trip it**, and the
clean table must pass — a checker whose only exercise is a table that happens
to be clean has never been shown to fail. Two arms exist because getting them
wrong is easy and silent:

- **a TAKEN row is exempt from `stale`** — the whole point of TAKEN is that the
  symbol is gone, and without the arm the table would refuse the moment it
  recorded a successful deletion, which is the one thing it exists to record;
- **an EMPTY verdict is `unread`, not `unknown`** — a row nobody has filled in
  is remaining work; a row with a verdict nobody agreed to is rot. The first
  draft conflated them and reported a sound table as broken.

### 21b. The fifth verdict is not a convenience

`verifyBackView` was ruled a deletion by §14b and has not been executed. With
four verdicts it had to read as *unread*, which is false — it has been read,
and carefully. **TAKE** is *ruled for removal, not yet done*, and its count is
the milestone's outstanding queue rather than a state buried in a paragraph.

`TAKEN` reads zero, and that is correct rather than unused: a symbol removed by
an earlier shift is no longer on the sweep's list, so it has no row. The verdict
is for the row flipped in the same commit that deletes its symbol. Git and the
sections above hold the history; the table holds the door.

---

## 22. THE APPARATUS COUNTED ITSELF A THIRD TIME — and the third repair is a
## rule about what a mention IS, not a list of files

The disposition table was seeded and committed. The next run of the door read:

```
THE TABLE — 124 rows against a reading list of 96
```

**Ninety-six.** Twenty-eight symbols left the reading list the moment the
seeder that records their dispositions became a tracked file — because that
seeder holds their names as quoted strings, and the classifier counted a quoted
name as a production mention.

- §19: an instrument's **docblock** promoted three symbols off the list.
- §22: a disposition table's **data** promoted twenty-eight.

Both times the milestone's own writing became evidence about the code it was
writing about.

**The first two repairs named files.** `SELF` was two filenames, then a family
pattern. That does not hold, because the next instrument has a new name — and
the next one arrived within the hour, with a name (`seed-cleanup-dispositions`)
that no pattern written for `sweep-*`/`triage-*` could have anticipated.

**So the third repair is a rule about what a mention is:**

> **A name inside quotes is DATA, not a call.** A table entry, a test title, a
> config key. The classifier blanks string literals before it decides, exactly
> as it blanks comments — the sibling rule to §19a's, and it covers every
> instrument that will ever be written, including ones nobody has thought of.

Both directions are controlled on one synthetic line, so a stripper that
blanked everything would fail the second arm:

```
INTERSECTION CONTROLS
  positive  shouldSendGlobalAttackAlert → none    PASS
  negative  isAccountLocked             → barrel  PASS
  synthetic a name only DISCUSSED is not a mention  PASS
  synthetic a call after a URL survives stripping   PASS
  synthetic a name inside QUOTES is data, not a call PASS
  synthetic an identifier beside it survives         PASS
```

And the list returns to **124 of 168**, unchanged from before the seeder
existed — which is the actual proof the repair worked: the number a file's
existence should not have moved is back where it was.

> **The class, in its final form for this milestone:** an instrument that reads
> source text has three kinds of thing in front of it — code, prose and data —
> and only the first is evidence. Prose was §19. Data was §22. **Both were
> found by the number moving when nothing about the product had changed**, and
> that is the tell worth keeping: if writing a document changes what the
> instrument says about the code, the instrument is reading the document.

---

## 23. THE READING IS FINISHED — `--strict` is green

```
THE TABLE — as it read on 2026-08-18, when the reading closed. The nine TAKE
rows below have since been executed; §24d carries the current reading.
  124 rows against a reading list of 124
  KEEP     96
  TAKE     9
  TAKEN    0
  HELD     14
  FILED    5

  unread       0
  stale        0
  blockerless  0
  unknown      0

OPEN — every symbol on the list has a disposition.
```

**The completion bar adopted in fable-992 §2b is met**, on the mechanical
reading of it: every symbol the sweep lists has a verdict, no row names a
symbol that is gone, every HELD row names its blocker, and no verdict is
outside the closed set.

⚠→✅ **The sentence that stood here — *"`pnpm check` runs it, so it cannot
quietly stop being true"* — was FALSE WHEN WRITTEN and is TRUE NOW, and both
halves matter.** It was false because `pnpm check` ran the door WITHOUT
`--strict`, where `unread` is not fatal: rot could not come back quietly but
INCOMPLETENESS could, and it did, within the hour (§24d). **It was then made
true rather than merely re-argued** — `pnpm check` passes `--strict` as of
`c5cb450a`, ruled fable-999 §2, proved able to fail in §24h. The bar above is
now the bar the gate holds.

**What "finished" does and does not mean.** It means the QUESTION has been
asked of all 124 — *what was this for?* — and answered in a sentence that cites
where it is argued. It does not mean the milestone's work is done: nine TAKE
rows are removals that have been read and not yet executed, fourteen HELD rows
are waiting on something named, and five FILED rows are findings about live
code that belong to other roads.

### 23a. The nine TAKE rows, and what they have in common

`verifyBackView` · `censusIsOpen` · `namesRemoval` · `refusalCharge` ·
`refusalReportClass` · `heartbeatLine` · `getSessionCount` ·
`stopSessionEviction` · `namesHerHairItself`

Every one is a **convenience beside a live sibling**: an accessor over a table
the live path indexes directly, a formatter beside the one the report actually
calls, a back-compat alias beside the real gate, a coarse predicate beside the
sharp one the service consults. None has a test. None is the missing half of
anything — that question was asked of each, because §13c's `removeEdgesForItems`
is what happens when it is not.

Two carry a line worth keeping when they go:

- **`stopSessionEviction`** is redundant *by construction*: the timer two lines
  above it is already `unref()`d, so it never holds the process open. A
  graceful-shutdown hook for a thing that needs no shutting down.
- **`heartbeatLine`** was **corrected once** — its docblock records the fix, a
  denominator that misnamed its own population — for a defect it could never
  have shown anyone, because nothing has ever called it. Maintenance paid on
  dead code is the quietest cost this milestone has found.

### 23b. The fourteen HELD rows all name the same three blockers

A disposable database (three rows), an owner who has to decide a road (M14's
anchor trio, the composer road's calibration pair, the face chart's segment
prune), and the founder's security card. **Nothing is held on "later".**

### 23c. The five FILED rows are findings, not deletions

`removeEdgesForItems` (a live deletion path missing its other half),
`INSTRUCTION_MAY_OVERRIDE` (a rule applied by nothing),
`mintModelAtomically` and `markModelAssetsStale` (a docblock asserting a call
site that does not exist), `refusalTallies` and `listOrphanedVariants` (a
reporting query whose only readers are untracked, and a purge sweep with no
reader at all), `clearAllUserSessions` (nothing clears a user's whole VTO
session set).

**Not one of them is a cleanup deletion**, and that is the milestone's own
result rather than a caveat: the reading found more live-code questions than
dead code.

### 23d. THE FIRST FILED ROW WAS READ AND COUNTED, and its one-line summary
### pointed at the SMALLER HALF of its own finding

Ruled fable-1044 §4 as the standing method after this read: **a FILED row's
summary is a pointer, not a finding — every one gets the read-and-count before
anyone acts on it.**

§13c said *"`removeEdgesForItems` is the deletion path's other half, and nothing
calls it"*, named ONE path, ONE child table, and priced the cost as *"the LIKELY
real cost is unbounded row growth"*. That word was honest — nobody had counted.
Counted now (`scripts/census-board-orphans-disposable.mts`, read-only, three
controls: visibility, an emptied-parent detector, and arithmetic closure; all
passed in both worlds):

```
                        DEV :52008          PRODUCTION :23768
board_edges             6                   83
board_item_versions     701                 184

EDGE / board gone       0                   73     (88% of the table)
EDGE / endpoint gone    0                   73
EDGE / endpoint soft    2                   0      ← not a leak, kept apart
VERSION / item gone     658  (94%)          170    (92%)
```

**Three corrections, none of which change §13c's verdict and all of which
change its size:**

1. **Three paths, not one.** `deleteBoard` (routes/boards.ts:176) and
   `deleteBoardItem` (:324) have the identical shape and §13c named neither.
   `deleteBoard` is the biggest of the three — edges are keyed by `boardId`, so
   deleting a board stranded every edge on it.
2. **Two child tables, not one.** `board_item_versions` is keyed on `itemId`
   with no foreign key and was never mentioned. **It is the larger leak by an
   order of magnitude and the only one carrying image URLs.**
3. **§13c pointed at the smaller half.** The edge leak it named is **0 rows in
   dev**. The table it did not name is **92–94% orphaned in both worlds**.

The counterpart that makes it a class: `finalCastDeletion.ts:417-422` — the
Cast deletion path in this same product — has always deleted both child tables
correctly.

**Fixed forward** for all three paths, rows only, each child statement
re-anchored through the owned parent (invariants 1–2), guarded by
`server/boardDeletionChildren.test.ts` — which drives the real functions through
a recording fake transaction and was proven able to fail by three sabotages
(dropped child delete · parent-before-children · a cross-domain delete), each
reddening the arm that owns it. **The behavioural arm — insert, delete, observe
the rows are gone — remains unrunnable on this machine**, and this fix is the
FOURTH customer of the disposable-database blocker three HELD rows already name.

*One thing the sabotage found that reading had not:* the ordering assertion
used `indexOf(...) < parentIndex`, and `indexOf` returns **-1** for a missing
delete — so an arm written to catch reordering stayed green when the delete was
removed outright. Presence is now asserted before order. A negative arm that
cannot distinguish "wrong place" from "not there at all" is half an arm.

**`removeEdgesForItems` itself was NOT wired, and that is the finding's last
turn.** The helper deletes by bare item id with no ownership predicate, so
calling it would have satisfied §13c's sentence while breaking enforcement
invariant 1 *in the commit fixing a deletion path*. The three paths carry their
own owner-scoped statements instead, and the helper's disposition moves
**FILED → TAKE**: it is now superseded rather than merely uncalled. Executing
that TAKE is its own commit, per §21's rule.

### 23e. FILED ROW SIX — the storage question, which the census opened and this
### milestone does not answer

Ruled fable-1044 §2. Owner: **the boards/storage road.**

The row fix above stops the growth and deliberately touches **no bytes**. The
reason is that the obvious escalation is forbidden until a reading nobody has
done: **a board item's `imageUrl` may point at an object owned by another
domain** — a cast's generated frame placed onto a board — so scheduling R2
deletion from a boards delete is cross-domain destruction through a reference.
Which objects are boards-OWNED versus boards-REFERENCED is that design reading.

**And the consequence cuts both ways, which is why it is filed rather than
deferred.** Today an orphaned version row is the LAST POINTER to a billed
object. After the row fix, a permanent deletion leaves **no pointer at all** —
the object unreachable, unrecorded, and still paid for. Neither state is
correct; the row fix is the one that stops the bleeding without doing anything
irreversible to bytes.

*Practical consequence for the 316 existing production orphans:* purging them
before this row is answered **burns the map** to the unbilled-object question.
Recommend holding the purge until then — carded for the founder on those terms.

### 23f. `listOrphanedVariants`, read and counted — it would return NOTHING, and
### half its predicate cannot fire at all

The §13c method applied to the next FILED row (ruled fable-1045 §5). Verdict
stays **FILED**: this is the retention road's design call, and the read below
sharpens the question rather than answering it.

**Read at the code first.** The predicate is a disjunction —
`expiresAt < now` **OR** `NOT EXISTS (the candidate row)` — and
**`castingCandidateVariants.expiresAt` is written by nothing.** The column
exists and is indexed (`idx_casting_variants_expires`); the ONLY reference to it
in the entire server is this helper's own predicate. `expiresAt` is stamped on
the CANDIDATE (`db/castingV2.ts:1038`, on discard; cleared on undo at `:1075`),
never on the variant. **So arm 1 is dead by construction.**

**Counted** (`scripts/census-variant-orphans-disposable.mts`, read-only, the
same three controls):

```
                                  DEV :52008      PRODUCTION :23768
casting_candidate_variants        80              27
casting_candidates                32              55
detector (parent set emptied)     80 of 80 pass   27 of 27 pass
ARM 2 — candidate row gone        0               0
ARM 1 — expiresAt < now           0               0
variants carrying any expiresAt   0               0
candidates carrying any expiresAt 0               0
```

**Arm 2 is a real zero and the detector is what makes it one:** no variant has
ever outlived its candidate in either world. `listOrphanedVariants` would return
an empty list today — belt-and-braces that has never had anything to catch.

⚠ **Arm 1's zero is NOT a confirmation, and the control is what says so.** The
`candidates carrying any expiresAt` line was included as the discriminator — the
idea being that a populated candidate column beside an empty variant column
would confirm the code read at the data. **It reads 0 as well, and on reflection
0 is exactly what a WORKING purge produces**, since a swept candidate's row goes
with its expiry. So the reading cannot distinguish "nothing writes this column"
from "everything that did has been purged". **The code read stands on the code
alone** — which is solid, being a whole-server grep with one hit — and the data
neither confirms nor refutes it. Recorded this way rather than as a confirmation,
because a control that turns out not to discriminate is a fact about the reading.

**What it means for the filed question.** *Should the purge run this sweep?* The
honest state: it would do nothing today, and half of it could never do anything.
**Do not wire it as-is** — the choice is whether the fix is the PREDICATE (drop
the dead arm, keep the orphan sweep as a real safety net) or the COLUMN (start
stamping variant expiries, which is a retention design decision nobody has
made). Wiring the helper unchanged would install a safety net with one arm tied
behind it and call the row closed.

### 23g. `refusalTallies` — its stated reader does not read it, and the thing it
### was built to measure is not yet measurable

Third FILED row, same method. Verdict stays **FILED**; the read replaces a vague
owner with a mechanical trigger.

**The row's premise was wrong, in §13c's way.** It said *"a reporting query
whose only readers are UNTRACKED benches"*. There is exactly one candidate —
`scripts/read-refusal-tallies-disposable.mts` — and **it does not import
`refusalTallies` at all.** Its own header says why: importing it *"would need
`getDb()` and a production `DATABASE_URL` in the same process the world guard
exists to prevent, so the grouping is restated here in SQL."* So the function
has **zero consumers of any kind**, and its only would-be consumer is
STRUCTURALLY UNABLE to become one — the bench and the product are two
implementations of one grouping, by necessity rather than by neglect.

**The writer is live.** `countRefusal` has two call sites in the paid refine
path (`refineService.ts:786`, `:1325`) and writes an audit row per refusal. So
this is `collected-never-asserted` exactly: rows accumulating for a stated
purpose with nothing summing them.

**And the purpose is stated, which is what makes the count decisive.** The
docblock: the `rescued` : `upheld` ratio *"IS the honest-ask-refused rate the
guard's redesign has to be judged on, measured continuously from the day this
lands rather than reconstructed afterwards from logs that no longer exist."*

**Counted in production** (the bench's own controls printed first — 163 audit
rows across 4 actions in the window, so the reader is not blind):

```
casting.refusal rows           2   (parsed 2, unparsable 0)
  2  refused / absorbed
rescued or upheld              0
```

**Two rows, and neither carries either outcome the ratio needs.** The
invention door never ran in the window, so *the honest-ask-refused rate is not
yet readable* — the bench prints that sentence itself rather than a confident
nought.

**Which answers the filed question for now: neither.** Building a tracked reader
today would be building a report over two rows and one bucket, and deleting the
query would delete the reader of a dataset that is still being collected on
purpose. So the row keeps a **trigger** instead of an owner's intention:

> **`refusalTallies` gets a tracked reader when production holds any
> `rescued` or `upheld` row.** Until then it is a correct query waiting for a
> population, and the bench above is how to check — it prints the count and says
> in words when the rate is unreadable.

*(Incidental, not this row's business: the same window holds **155
`casting.scan_miss` rows**, which dwarf every other action in the audit log.
Nobody has asked what they are telling us.)*

### 23h. `INSTRUCTION_MAY_OVERRIDE` — §7a re-read at the artifacts and it HOLDS,
### with two things §7a does not say

Fifth and last FILED row, and the only one whose summary survived its read
(fable-1046 §3). Verdict stays **FILED**, owner unchanged.

**§7a verified independently rather than quoted.** `scopedZone(facet, region)`
at `maskedRefine.ts:926` takes **no instruction argument**, and its first line
is `zoneScopeOf(facet)`, which reads `ZONE_SCOPE[facet]` alone. Nothing anywhere
consults `INSTRUCTION_MAY_OVERRIDE`. The defaults it claims to override are
confirmed at `facetCards.ts`: `marks.zone = "distributedFacet"` (override says
`object`), `ink.zone = "object"` (override says `distributedFacet`). Its only
other mentions are its own test and a documentation row in `openKindPolicy.ts`
— a STRING KEY in a registry, which is §19a's prose-is-not-a-caller rule holding
exactly as designed.

**The first thing §7a does not say: who is affected today.** §7a closes *"it is
a paste-road question at most"*, which is true and now reads as a narrowing when
it is the opposite. `maskedRefine.ts` IS the paste road — and production runs
`CASTING_REPAINT_SCOPE=users:1`, **so the paste road is every user except the
founder.** The one account that would notice is the one account structurally
unable to reach the code. That is worth stating plainly wherever this row is
picked up: it is not a dark corner, it is the default road for everyone who is
not him, and it is still unmeasured.

**The second: the table is a hand-written MIRROR beside a DERIVED one — law 4's
shape.** `ZONE_SCOPE` is not a literal; it is
`facetTableOf((card) => card.zone)`, derived from the facet cards so it cannot
drift from them. `INSTRUCTION_MAY_OVERRIDE` is a separate hand-authored literal
naming the same facets and quoting their defaults in its `when` prose. **Change
`marks.zone` in the cards and this table still claims to override
`distributedFacet`, with nothing to catch it** — its test asserts its own
contents (a pure mirror test), so the assertion moves with the drift.

So if the road ever retires this rule, the derived/mirrored split is part of
what has to be decided: an override table that survives should be derived from
the cards too, or it will disagree with them the first time a card moves.


---

## 24. THE UNTRACKED HALF, EXECUTED — and the knife's own residue was the
## reading list's 116th symbol

§2 ordered three things: promote the cited, delete what nothing names, and take
the debris. The first two are done. This section is the receipt, and it carries
two findings that are not about debris at all.

### 24a. The promotions, and the archive

**Twenty-four promoted** (`fd16e75a`), at a fresh reading rather than from §2's
four-shift-old list — six of them cited by PRODUCTION SOURCE, not by documents.

**One hundred and forty-three deleted**, and the irreversible act was made
reversible first:

```
archive   C:\Users\Admin\drape-untracked-2026-08-19.zip
entries   143, read back FROM THE ZIP
on disk   0 of those 143 remain
```

The count is read out of the archive rather than asserted beside it — an archive
asserted but never listed is a receipt that is a claim.

**Two refusals, stated rather than discovered.** `docs/specs/references/…720w.mp4`
is a hash-named media file in the directory the founder's own reference material
lives in; nothing cites it and nobody here knows what it is, which is a reason to
ask rather than a licence. `FABLE_R7_7D_D4D2_REVIEW.md` stays because its sibling
is named must-remain-unstaged by a tracked prompt — untracked-and-live is a
deliberate state in that family.

### 24b. THE CITER UNIVERSE WAS BLIND TO THIS PROGRAM'S OWN COORDINATION SURFACE

*"Named by something tracked"* is the right evidence bar for KEEPING and the
wrong completeness bar for DELETING: the standing instruments of this program are
cited by the mailbox, the founder queue and the memory files, none of which the
sweep can see by construction. The measured case: the campaign ledger pair is
eight days cold — squarely in the DELETE bucket — and is the instrument every
campaign state block must re-run. **Both are promoted, not deleted.**

So the 143 were swept a second time against that surface before the record
closed, with the instrument controlled in both directions first:

```
POSITIVE  campaign-ledger-window-disposable  → 4 mailbox files   (must not be 0)
NEGATIVE  no-such-script-a4f19c-disposable   → 0 mailbox files   (must be 0)
RESULT    3 of 143 named by mailbox or memory
```

The control mattered: the **first** run of this sweep returned **0 of 143**, and
0 was wrong. A malformed `grep -c … || echo 0` emitted two lines, the integer
comparison died on the non-integer, and the loop's whole condition collapsed to
false. A sweep that finds nothing looks exactly like a sweep that is broken —
which is this milestone's §0 finding, arriving one last time in the milestone it
opened.

**All three hits are past-tense receipts, not standing orders**, which is the
distinction that decides them. Two are historical readings reported once
(`bench-teeth-box`, opus-467; `drive-version-switch-latency`, opus-379). The
third looked like the real thing — `rehearse-repaint-boot-disposable`, ordered
"re-run at flip" — and fable-342 §4 records that re-run as *performed at flip
time, clean*. An order already discharged is not an outstanding claim on a file.

### 24c. THE SUFFIX WAS NEVER THE SENTENCE — and the promotion proved it

`scriptWorldGuard` exempted `-disposable.mts` from `assertOneWorld` **by
spelling**. The argument for the exemption was never about letters: *a bench that
ran once against dev and will never be run again does not need a ceremony.* A
bench that will never be run again is a file **the repository does not contain** —
tracking status is that sentence.

They came apart the moment twenty-four of those files were promoted. Three of the
twenty-four read the app's database, and under the spelling key they kept a
one-shot's pass **forever**: guard calls were added to all three, and deleting
those calls would have reddened nothing. An import without a call is not a guard.

A rename would have closed it for three files and left the class open for the
twenty-fifth promotion. The guard now keys on `git ls-files`, so the names stay
as their citers spell them and the suffix is residue. Its predicate **refuses
when git cannot answer** — an empty answer would exempt the entire tree and turn
the suite green by making it blind, which is the silent direction.

```
getDb() scripts        44   tracked 36 · untracked 8
POSITIVE CONTROL        7   untracked and unguarded — the population it needs
TRACKED + UNGUARDED     0   the bar
```

### 24d. THE KNIFE LEFT A SYMBOL AND THE TABLE DID NOT CATCH IT

`AMBIGUOUS_WORDS_FOR_CORPUS` was **born of a deletion in this milestone**: when
`namesRemoval` was taken, its ten phrasings were carried onto `removalEvidence`,
and the surviving corpus test needed the module's own list rather than a copy.
The export was written; its disposition row was not.

The door caught it — `NOT FINISHED — 1 unread` — and that is the door working.
**What did not work, THAT DAY, is the gate.** `pnpm check` ran the door without
`--strict`, and `unread` is fatal only under `--strict`, so the reading list grew
from 115 to 116 with an unread symbol on it and `pnpm check` stayed **green**.
§23's claim that the bar "cannot quietly stop being true" is corrected there.
**This paragraph is the INCIDENT and not the present state: the gate was flipped
the same day and now refuses — see §24h.** Read in the past tense; it is kept
because it is the evidence the flip was bought with.

Row added, verdict KEEP, argued 6c: the seam's alternative is a hand-copied word
list in the test — law 4, a second list shadowing the source, which is the exact
defect the carry existed to prevent.

```
THE TABLE — 125 rows against a reading list of 116
  KEEP     97   ·   TAKE 0   ·   TAKEN 9   ·   HELD 14   ·   FILED 5
  unread 0 · stale 0 · blockerless 0 · ownerless 0 · unknown 0
  --strict exit 0 · pnpm check exit 0
```

### 24e. THE PROMOTION COMMIT SHIPPED RED, AND `pnpm check` COULD NOT SEE IT

`fd16e75a` was verified with `pnpm check` — exit 0, reported as such. **The suite
was not run, and it was failing in two places, both caused by that very commit:**

```
FAIL  server/architectureAtlas.test.ts        Atlas stale — fingerprint
                                              36fe0782ffe2b3a5 vs source 83a70fafe092b783
FAIL  server/scriptExitDiscipline.test.ts     sweep-untracked-disposables: last
                                              statement does not exit
```

Neither is incidental; **both are the promotion itself**. Promoting 24 files moved
the Atlas source fingerprint, and the second is sharper: the sweep script broke a
tracked discipline the instant it was promoted, because that discipline only
scans files the repository contains. **A file entering the repository acquires the
repository's rules** — the same lesson as §24c's guard, arriving through a
different door on the same commit. The Atlas failure is also the third appearance
of one class in three commits: `7b41fb0d` was committed on a green door without a
suite run, `3a1633a3` repaired it, and `fd16e75a` did it again.

Both fixed here, and the commit that carries this section quotes the whole-suite
reading taken after its last write — `pnpm check` alone cannot see either of
them, which is the point.

### 24f. WHAT `output/` TURNED OUT TO BE — and why §2's third order was refused

§2's recommendation 3 lists `output/` as *"untracked debris — DELETE"*. It is not
debris. Tracked documents name **475 distinct `output/` paths, 445 of which exist
on disk** — evidence packs, court readings, and DECISION_LOG citations, including
frames filed for the founder's own eye.

The automation had already declined it: `output` came back HAND, *"basename too
generic to auto-decide"*. So the machine abstained and **the prose kill list still
said DELETE** — a directory of 445 cited artifacts, one obedient reading away from
gone. It is the mirror of §22's rule: there, the kill list was mistaken for a
citation; here, a kill list outlived the evidence that should have retired it.

**`output/` is REFUSED, and the order in §2 is wrong rather than pending.**

What was actually taken is the three genuinely uncited items, archived first:

```
archive   C:\Users\Admin\drape-debris-2026-08-19.zip
entries   3, read back from the zip — `0` 678 B · errfiles.tmp 1034 B ·
          scripterrors.tmp 14496 B
```

`errfiles.tmp`'s only two remaining mentions are the sweep's own docblock
*about* it being a false citation — commentary on a death warrant is not a
citation either.

✅ **CLOSED — `pnpm check` now passes `--strict`** (ruled fable-999 §2; see
§24h for the flip and the sabotage that proved the gate can refuse). It was filed
here as an open friction decision; the ruling was that it is not a new bar at all
— fable-992 §2b had already ADOPTED `--strict`-green as the completion bar, and a
gate weaker than its adopted bar is invariant 7 verbatim.


### 24g. THE 180-VERSUS-143 ARITHMETIC — the missing 37 were a FILTER, not a loss

§24a's knife took 143 of a DELETE bucket that read 182, less two refusals — 180
planned. The 37 were never lost and never deleted. They were still on disk, cold,
and the reason is the best thing that happened in this milestone: **bound one had
already been applied at knife time and was never written down.**

The evidence is an asymmetry no coincidence produces. Sweeping the same
mailbox-and-memory citer surface across both populations, over the SAME date
range (2026-08-11 … 2026-08-17):

```
of the 143 DELETED      3 named by the coordination surface   (2.1%)
of the 39 LEFT BEHIND  35 named by the coordination surface  (89.7%)
```

A knife that had ignored the mailbox would have left the two populations alike.
These are near-perfect complements, which is what a filter looks like from the
far side. **The act was right and only its record was missing** — the reverse of
this milestone's usual finding, and worth stating in that direction.

⚠ **The instrument was contaminated mid-reading and caught it.** The negative
control — a stem git has never seen — went from 0 to **1**, because the sweep's
own report had by then been filed in the mailbox WITH THE CONTROL'S NAME IN IT.
The specimen joined the vocabulary inside one shift. Re-run with an unpublished
token: negative 0, positive 5, and three deleted stems spot-read at 0 by hand.

**The close, at a fresh reading with every remaining path assigned:**

```
THE UNTRACKED HALF — 114 paths
  CITED 3  ·  FRESH 74  ·  HAND 1 (`output/`)  ·  COURTESY 36  ·  DELETE 0
```

⚠ **One correction to my own hand count, made by the machine that replaced it**
(§24i). By hand I read this as *"36 = 1 refusal (the mp4) + 35 courtesy-held"*.
The mechanized pass puts all **36** in COURTESY, the mp4 included — because the
coordination surface DOES name it: the message asking the founder what it is, is
itself a citation. The refusal I made by judgement is now made by rule, which is
the better outcome and not the one I predicted.

**`DELETE` is 0. There is nothing left in the untracked half to take.**

The four that were cold AND unnamed by every surface — `survey-bot-fixtures`,
`survey-cast-assets`, `survey-signed-bot`, `survey-verify-bot` — are archived to
`C:\Users\Admin\drape-untracked-tail-2026-08-19.zip` (4 entries, all 4 read back
byte-for-byte) and taken. The 35 are HELD as courtesy citations: the evidence rule
is unchanged, the delete list is not.

The buckets sum across the shift boundary and not merely within a run, which is
the form the ruling asked for.

### 24h. THE GATE NOW REFUSES — `pnpm check` passes `--strict` (ruled fable-999 §2)

§24d's open question is closed in the direction the incident argued. `pnpm check`
now runs the door with `--strict`, so `unread` is fatal and the completion bar
stated in `POST_SIGN_ROADMAP.md` §0b is the bar the gate actually holds.

**Proved able to fail before it was believed** (law 2): the
`AMBIGUOUS_WORDS_FOR_CORPUS` row was removed from a copy of the table, the strict
door exited **1**, the table was restored from that copy — not from git, which
would have taken the working tree with it — and the door exited **0**, with the
file byte-identical to `HEAD`.

The friction is real and named rather than hidden: any new export used only by its
own test now blocks `pnpm check` until four lines of YAML exist. Those are exactly
the four lines the knife skipped.


### 24i. BOUND ONE IS NOW A MECHANISM, NOT A SHELL LOOP I TYPED

The courtesy pass lived in a hand-typed `grep` loop at the knife, and §24g
records that its first run returned a false zero. An instrument that can return
0-of-143 when the answer is 3, and looks identical either way, does not get to be
re-typed by the next shift. It is now inside
`scripts/sweep-untracked-disposables-disposable.mts` as a fifth bucket:

```
CITED     named by TRACKED content            → promote or retire the citation
FRESH     touched inside 48h                  → work in flight
HAND      basename too generic to auto-decide → a person reads it
COURTESY  cold, but the MAILBOX/QUEUE names it → HELD, not deleted
DELETE    named by nothing, tracked or coordinating, and cold
```

A courtesy citer never promotes anything — the evidence rule for KEEPING is
unchanged. It only removes a path from the delete list, which is exactly the
scope fable-998 §2 gave it. Citers are printed by name for COURTESY as they are
for CITED, because the death-warrant rule applies on this surface too: a message
ordering a file deleted names it.

**It refuses rather than going blind.** This predicate can only move files OUT of
DELETE, so its silent failure is a surface that reads empty — which would delete
the very instruments it exists to protect. Both arms are driven:

```
ARM A  surface pointed at an empty directory
       → "surface 0 coordination files read" · REFUSED · exit 1
ARM B  the negative control's token planted on the surface
       → "PRESENT — CORPUS CONTAMINATED  FAIL" · REFUSED · exit 1
normal 1739 coordination files · positive FOUND · negative absent · exit 0
```

Arm A's sabotage was reverted from a `cp` backup and verified byte-identical —
never with `git checkout`, which would have taken the whole working tree.

**And the contamination trap is designed out rather than documented.** The
negative control's token is declared in tracked source, which the surface reader
does not read, and **the control line prints its verdict without ever printing
the string.** The hand-run version was contaminated within one shift precisely
because its report quoted the token into the corpus it searches. An instrument
that publishes its own control specimen has an expiry date.

## 25. THE DOOR LEARNS TO SEE A RE-WIRING — and the arm was born with a hit
## (2026-08-22, discharging §10 item 7's three-symbol debt)

`scripts/diff-importer-count-across-time.mts` gave this milestone the reading
CLAUDE.md said could not exist: not *does anything call this*, but **did
something STOP calling it**. Run over two windows it found seven un-wirings, all
DECIDED, and named three that nothing pinned —
`authorizeInkAddDescription`, `buildInkAuthorizationProviderConfig`,
`commitBeginInkAddIntent`, all from `c99ff1c4`'s deliberate second ring (§8d).
That trio is §10 item 7's stated debt.

### 25a. The debt is discharged by an ARM, not by three hand-written assertions

Two of the three already had rows in `cleanup-dispositions.yaml`. Writing a
separate absence test for each would have been **a third list of the same
symbols** — the yaml, §8d's table, and a new suite — which is law 4 in the one
document that exists to quote it. So the pin is a refusal on the door instead:

> **`rewired`** — a HELD or TAKE row whose symbol has a production importer.

Both verdicts say the same thing about the request path, so a caller coming back
under either is the row and the source disagreeing. It rides the existing
ceremony: the day one of these three is deleted, its row must be flipped to
`TAKEN` or the `stale` refusal shuts the door — and the day one is re-wired,
`rewired` shuts it. **Every HELD row is now pinned, not three.**

Its reader is `readTree` from `scripts/lib/importerCountDiff.mts` — the differ's
own module half, not a second one — so the door and the instrument cannot drift
on what a production importer IS. `scripts/` is outside that scope, which is the
same call the differ makes: a drive bench naming a symbol is not the request
path.

### 25b. `unreadable`, because an arm must not pass by being blind

A HELD row whose symbol the reader cannot see would answer zero for ever.
`readTree` declares only `const`/`let`/`function`/`class`/`enum` under
`server/`, so a `type` export — `BeginInkAddIntentResult`, §8d's fourth
item — **cannot be pinned by this instrument, and that is said rather than
faked.** It has no row, so it trips nothing; a HELD row that ever did would
refuse. Zero today, on all 17 HELD-or-TAKE rows.

### 25c. THE HIT — `hairTakeSentence` was HELD, and it is on the request path

The arm found an instance in the table on the day it was built.

```
row      hairTakeSentence  HELD
blocker  "the hair crop chunk, where the recipe composes the outgoing
          prompt this sentence goes into (fable-1071 §5)"
source   server/castingV2/refineService.ts:143   imports it
         server/castingV2/refineService.ts:5280  CALLS it
```

That call site **is** the named blocker. The hair crop chunk landed, the symbol
went onto the request path, and the row that said *waiting to be deleted* was
never flipped. Read at the artifact, not recalled: line 5280 sits inside the
`wantsCrop` mint branch, composing the scope sentence that rides out with a hair
carrier.

**Nothing was at risk.** The cost of a rotten HELD row is a cleanup sitting
working its way down the list toward a live symbol, which is a hazard rather
than an incident — but the shape is the expensive one this program keeps
meeting: **a document confident about code that moved underneath it.**

⚠ **The reason no existing refusal could catch it is the whole argument for
making this mechanical.** A re-wired symbol simply DROPS OFF the sweep's reading
list. `unread` only ever looks the other way — a listed symbol with no row,
never a row with no listing — so the rot was invisible from every direction the
door already faced. `stale` catches a row whose symbol went away; nothing
caught one whose symbol came back.

The row is now `KEEP`, with its history in its own `why` rather than in this
paragraph alone, because the yaml is what the next knife reads.

### 25d. And the third symbol had no row at all — for a mechanical reason

`commitBeginInkAddIntent` was never on the sweep's reading list, so the seed
never wrote its row, though `seed-cleanup-dispositions-disposable.mts` has
carried its verdict text all along. The reason is exact: the reading list is the
flagged set INTERSECTED with the classifier's *no production mention*, and two
**tracked** disposable scripts name it, so it classifies as mentioned and drops
out. Its row is now written by hand with §8d's blocker verbatim.

**This is the differ and the sweep disagreeing productively rather than a
defect in either.** The sweep asks whether anything in the repository says the
name; the differ asks whether a production module IMPORTS it. `c99ff1c4`'s ring
is exactly the population where those two answers come apart.

## 26. THE LAST TAKE IS TAKEN — `removeEdgesForItems` is deleted, and §13c's
## own sentence is the thing that had to be overruled to do it
## (2026-08-22, opus-1001)

`removeEdgesForItems` was the ONLY row left under `TAKE` — a verdict the door's
own header describes as *"read, and the reading says remove; not yet done"*.
Ten rows now read `TAKEN`; none reads `TAKE`.

**The reading was re-read before the knife, because the file argues with
itself.** §13c wrote, in bold, **"Disposition: NOT a deletion"** — it had found
the helper written for the board-item deletion path and never invoked, and it
filed it as the FIX rather than the debris, one wire away from closing. That
sentence is still on this page and is deliberately not edited. **§23d overturned
it with a count**, and the ground is not that §13c was careless — it is that
wiring the helper would have *satisfied §13c's own sentence while breaking
enforcement invariant 1 inside the commit that fixed a deletion path.* The
helper deletes by bare item id with no ownership predicate. The three paths
(`deleteBoard`, `deleteBoardItem`, `deleteBoardItems`) were fixed forward
instead, each child statement re-anchored through the owned parent, guarded by
`server/boardDeletionChildren.test.ts`. So the helper is not the unwired half of
anything any more: it is **superseded**, and superseded is what makes it a
deletion rather than a build.

**§8c's question, asked first and answered by grep rather than by memory:**
*which of this symbol's tests were testing the LIVE road through the dead one?*
**None — it has no tests at all.** Its only code mentions in the repository were
two disposable scripts — this milestone's own orphan census and the disposition
seed. Nothing was re-pointed because there was nothing to re-point, and that is
worth stating rather than skipping as a formality: the class §8c named exists
precisely where a dead road and its successor share scaffolding, and this one
never had any.

⚠ **AND BOTH OF THOSE SCRIPTS ARE TRACKED, WHICH IS §25d's RULE POINTED AT THIS
ROW.** I wrote *"untracked"* first, from `grep -rn`, and `git ls-files` says
otherwise. It is not a spelling correction: the sweep's reading list is the
flagged set INTERSECTED with the classifier's *no production mention*, and a
TRACKED script naming a symbol counts as a mention — which is exactly why
`commitBeginInkAddIntent` never reached a row (§25d). **So `removeEdgesForItems`
would today be excluded from the list its own row came from**, and the reason is
that both of its citers were written AFTER the row: the orphan census was built
to produce §23d's count, and the seed is the register writing itself down. An
instrument that publishes its control specimen into the corpus it searches
stops being able to find it. Nothing was at risk here — the row existed, the
door held it, and the symbol is now gone — but the next sweep should expect the
same shape wherever a disposable was written to investigate a listed symbol.

**What was checked at the artifacts before the cut**, each read rather than
recalled: no production importer — across the whole repository the only CODE
mentions were the two disposable scripts above and the definition itself, the
rest being this document's own prose and the yaml row; the two `drizzle-orm`
helpers the deleted body used (`or`, `inArray`) are still used by
`getEdgesForItem` and `removeBoardEdge`, so no import goes dark with it; and the deletion path's real statements are where
§23d says they are.

## 27. AND RUNNING THE DIFFER OVER THIS SITTING'S OWN WINDOW FOUND A SECOND
## CLEAN-NULL DEFECT IN THE DIFFER (2026-08-22, opus-1001)

§10 item 7 (RETIREMENT + CLEANUP) says no retirement sitting closes without
running `scripts/diff-importer-count-across-time.mts` over its own window. §26
is a retirement act, so it was run — `613dd561 → cd4d8166`, a worktree at the
older tree — **and the first invocation was this:**

```
diff-importer-count-across-time.mts C:/tmp/rite-window-1001 .

  FAIL  sanity  both trees read   1470 files / 2478 exports -> 1471 files / 0 exports
  REFUSING TO REPORT — 1 control(s) failed.
```

**A relative root read ZERO exports out of 1,471 files.** `readTree`'s `show()`
strips `root.length + 1` characters to make a path repo-relative, so a root of
`.` chopped TWO characters off every path — `server/x.ts` became `rver/x.ts`,
the `startsWith("server/")` gate never matched, and the reader declared nothing
while reporting that it had walked the whole tree.

**The sanity control caught it and refused to report**, which is that control
earning its place on its second outing — and it is the same shape as the
multi-line-import defect the differ's own suite already keeps as an arm: *a
clean, confident, wrong null.* Both were found by RUNNING the thing, neither by
reading it.

⚠ **The `rewired` door shares this reader, and was never affected** —
`check-cleanup-dispositions.mts` passes `resolve(import.meta.dirname, "..")`,
read at the code rather than assumed. But a door reading an empty tree finds
nothing to refuse, and that is a door that passes by being blind. `readTree`
now resolves its own root, and `server/unwiringDiffer.test.ts` drives the
reader BOTH ways over one fixture and asserts they AGREE — a comparison rather
than a literal count, so it cannot be quieted by editing a number. Proven able
to fail: with the resolve removed, that arm reddens and the other eight stay
green.

**The window itself is clean and the arithmetic says the differ saw it**: zero
un-wirings, `-1 exports, +1 file` across the window — exactly
`removeEdgesForItems` gone and `queueOrdinalDiscipline.test.ts` arrived. The
deleted symbol is correctly absent from the finding list: it had zero
production importers at BOTH ends, so it was never un-wired, only removed.

## 28. THE COMPOSER ROAD — the READING its four HELD rows are blocked on, and
## the finding is that a MODULE-level graph cannot draw this boundary at all
## (2026-08-22, opus-1001. A reading, not a verdict — no deletion is proposed
## here and none is authorised by it.)

Four HELD rows name one blocker: *"the composer road's module-sized
disposition"* (`INK_ADD_RECIPE`, `authorizeInkAddDescription`,
`createInkCalibrationRecorder`, `evaluateInkCalibrationGate`, plus
`buildInkAuthorizationProviderConfig` naming the same road). Nobody could write
that disposition without knowing where the road's edge is. This section is that
reading.

### 28a. The road is REACHABLE FROM A LIVE, LINKED SURFACE — it is dark by FLAG

Read at the code rather than assumed, and this is the part that changes how the
disposition has to be written:

```
/studio  (App.tsx, and linked from Navigation, AdminHeader and the lobby's
          empty states — not an orphan URL)
  -> pages/DrapeStudio -> studio/CastingWorkspace -> casting/ImageViewerPanel
  -> casting/evidence/useInkAddWorkflow  -> trpc.evidence.*
```

The eleven ink procedures in `routes/evidence.ts` each call
`requireInkCapability` → `captureEvidenceComposerEnabled` →
**`R7_EVIDENCE_COMPOSER_SCOPE`, which the rite read off the service tonight as
`off`.** So every mutation on this road answers `PRECONDITION_FAILED` for every
account, the founder's included, and `readInkAddCapability` returns
`inkAdd: false` so the panel does not offer itself.

⚠ **THERE IS ONE USER-VISIBLE SENTENCE BEHIND THAT, AND IT NAMES THE WRONG
SUBJECT.** `ImageViewerPanel` routes a Refine instruction that
`looksLikeTattooInstruction` matches into this road, and with the flag off the
customer is told:

> *"Tattoo previews are not available for this Cast."*

It is not this Cast. It is every Cast, for everyone, because the road is shut —
and the tattoo road that WORKS is the V2 one at `/casting`.

⚠ **AND IT IS WORSE THAN A WRONG SENTENCE: THE SURFACE OFFERS FIRST.** Read one
file further (`components/ImageViewer/RefinePanel.tsx`) — when
`looksLikeTattooInstruction` matches what the customer is typing, **the submit
button RENAMES ITSELF to "Review tattoo"** with the aria-label *"Review tattoo
request"*. So the product notices the ask, changes its own control to
acknowledge it, invites the click, and then answers that previews are not
available for her Cast. That is the dead-end-OFFER class D-180 exists to
forbid, not merely a stale string — and it is the same shape as census 4(b),
where `gate_ink_uncarried` offered a road the next door shut.

**The trigger is not narrow; only the surface is.** `TATTOO_LANGUAGE` matches
`tattoo`, `tattoos`, `tattooed`, `ink`, `inking`, `inked`, `body art` and
every sleeve form — so ANY tattoo-word refine typed on the legacy studio takes
this road. What is narrow is that `/casting` is where the work happens now.

**Filed as a finding here rather than sent to his desk, and the recommendation
is deliberately NOT a copy patch.** The honest fix is either to stop the button
re-labelling when the capability is false — the panel already holds
`capability.inkAdd` and could pass it down — or to retire the surface, which is
the question §28 opened and cannot answer alone. Writing new copy for a road
that may be retired is work thrown away; leaving a self-labelling dead end live
while that is undecided is worse. **It needs a decision, not a string**, and
law 6 puts any visual change in front of eyes in the running app first.

### 28b. The two doors, and the ONE import line that decides the whole boundary

`routes/evidence.ts` has exactly two gates, and they disagree:

```
requireCapability     -> captureEvidenceIngestEnabled   R7_EVIDENCE_INGEST_SCOPE=users:1   LIVE
requireInkCapability  -> captureEvidenceComposerEnabled R7_EVIDENCE_COMPOSER_SCOPE=off     DEAD
```

Walking the static import closure from each door's own entry modules
(disposable, since deleted; the method is thirty lines of BFS over relative
`from "…"` specifiers, four controls, all passing):

```
                                        as written    with ONE edge cut
  dead-door closure                     141 modules   141
  live-door closure                     129 modules    71
  rest-of-product closure               432 modules   432
  REACHABLE ONLY THROUGH THE DEAD DOOR   11 modules    13
  also reached by the LIVE ingest door  126 modules    68
```

**The cut edge is the finding.** `evidenceOperations.ts` imports
`findOwnedPendingInkIntent` from `db/inkAddIntents.ts`, and the only function in
that file which calls it is `stageOwnedInkIntentReference` — which sits behind
`requireInkCapability`, the DEAD door. Read at the file. **That single import
line drags 58 modules across the boundary, including every module the four HELD
rows name.** One dual-purpose file, one line, and the whole partition moves.

### 28c. So the answer is: THIS IS THE WRONG INSTRUMENT, and that is worth more
### than the table it produced

Three times in one reading the *"shared, therefore not ours to retire"* verdict
turned out to rest on a single symbol rather than on a module:

1. the import above — one symbol for a dead-gated function;
2. `snapshotTransitions.ts` → `evidencePackageComposition.ts` →
   `composer/inkComposer.ts`, where **the Sign road imports
   `EVIDENCE_PACKAGE_COMPOSER_RECIPE_VERSION` and nothing else** — a version
   CONSTANT, not the composer machinery. A module graph reports that as the
   package-minting path depending on the composer road;
3. `routes/evidence.ts` itself imports `INK_ADD_MIN/MAX_DESCRIPTOR_LENGTH` from
   `composer/inkAddRecipe` at module scope, for a zod schema, on procedures the
   same file refuses.

**A module-level import closure cannot draw this boundary**, and a disposition
written from one would either retire something live or refuse to retire
something dead. The control that caught (2) is worth keeping in mind: it did not
let the table be believed until the path had been read, and once read it was
converted into an assertion about the REASON — the import is one named constant
— so it still fires if that ever becomes a machinery import.

**The instrument the disposition actually needs already exists in this
repository.** `scripts/lib/importerCountDiff.mts`'s `readTree` is a
symbol → production-importers map, and `diff-importer-count-across-time.mts`
compares two trees. The shape that answers this question is: build a worktree
with the eleven dead-gated procedures removed, diff it against HEAD, and
**iterate to a fixpoint** — each pass un-wires a ring, exactly as §8d predicted
the `beginInkAddIntent` ring would arrive *"on the NEXT sweep, which is the
honest way for it to arrive"*. That is a real build with a real design question
in it (what stops the fixpoint, and what stops it eating a live symbol), so it
is named here and NOT started.

### 28d. What the reading does establish, and can be used today

- **Thirteen modules are reachable only through the dead door**, and this is a
  floor rather than the road: `composer/inkRetryDecision.ts`,
  `inkAcceptanceCommit.ts`, `inkAddIntent.ts`, `inkCandidateAcceptance.ts`,
  `inkCandidateGeneration.ts`, `inkCandidatePublicStorage.ts`,
  `inkInstructionPlanner.ts`, `inkIntentCancellation.ts`, `inkViewImpact.ts`,
  `db/inkAddAcceptance.ts`, `db/inkAddCancellation.ts`, `db/inkAddCandidates.ts`,
  `db/inkAddIntents.ts`.
- **`inkCalibration.ts` is in NO closure at all.** Its only mentions anywhere
  are its own suite and `r7-ink-add-d3-contract.test.ts`, which READS THE FILE
  as text rather than importing it. So its two HELD rows
  (`createInkCalibrationRecorder`, `evaluateInkCalibrationGate`) are the
  cheapest of the four and do not need the fixpoint — they need only the
  contract test's own question answered.
- **Six of the eight `composer/` modules are reached from outside both evidence
  doors**, so *"the composer directory"* is not the unit of retirement. The
  directory name is not the road.
- The road's client half (`InkAddPanel`, `useInkAddWorkflow`,
  `inkAddUxPolicy`, `inkProjectionEvents`, `evidencePackageDisplay`) is already
  `lifecycle: retire` in the Atlas, along with 132 modules in total — of which
  ~55 are the server evidence road. **That number is the size of the sitting**
  this reading was scoping, and it is a sitting rather than a chunk.

### 28e. The calibration island — two HELD rows whose BLOCKER was wrong, and
### the module is the unit rather than the symbols

§28d said `inkCalibration.ts` was the cheap half. Read at the artifacts, it is
cheaper than that in one way and not cheap at all in another, and **both rows'
`blocker:` line has been corrected** — the verdicts have not moved.

**Written and never wired, CONFIRMED AT THE BIRTH COMMIT rather than assumed.**
`git log -S` on both names returns `a63dbafe` (2026-07-27, *"R7-7D D3: add pure
ink composer"*) and then nothing but this milestone's own bookkeeping. At that
commit the only things naming `inkCalibration.ts` were its own suite and
`r7-ink-add-d3-contract.test.ts`, which READS THE FILE AS TEXT. That is still
exactly true today. It is CLAUDE.md's path ONE, held to the standard that entry
sets for IP blocking — *"confirmed at birth"*, not inferred from a present-day
grep.

**One of the two IS pinned, and I had it the wrong way round in the mailbox
before driving it.** `r7-ink-add-d3-contract.test.ts` asserts
`toContain("createInkCalibrationRecorder")`. Driven — the module replaced with a
single unused constant — **exactly one arm reddens**, and it is that one. So for
the recorder this is NOT `velocityLimits`'s shape. For
`evaluateInkCalibrationGate` there is no such pin: the contract test never names
it. Same module, same suite, two different exposures.

⚠ **AND THE UNIT IS THE MODULE, because the sweep can only see two of its four
exports.** `inkCalibration.ts` exports `createInkCalibrationRecord`,
`createInkCalibrationRecorder`, `summarizeInkCalibration` and
`evaluateInkCalibrationGate`. The first is called at line 174 by the recorder;
the third at 279 and 291 by the gate. **Both are consulted inside their own
declaring module, so the uncalled-export sweep excludes them by construction and
neither has a row** — the `isSensitiveAction` shape verbatim, the one the
un-wiring differ's docblock was written about. The two rows are the island's two
entry points and everything behind them is invisible to the list. Retiring "the
two symbols" would leave a 299-line module with two unreachable functions in it.

**So the blocker is not the composer road's boundary.** `inkCalibration.ts`
appears in NO import closure at all, so §28c's fixpoint reading cannot reach it
either way. What actually blocks it is a DECISION, and it is not a cleanup
milestone's to make: **is R7-7D's founder visual/calibration gate still
expected?** The design document requires one per authoring-matrix row
(`CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md`, *"founder visual/calibration
gate"*), and this module is the recorder and threshold gate built for it. If
that programme is resumed the island is its scaffolding; if the V2 ink roads
have replaced it, the island and its suite go together as a module.

Both `blocker:` lines now say that, and both rows stay `HELD` — the door's own
header forbids flipping a row to quiet it, and this is the opposite move: the
row keeps its verdict and gains a blocker that is true.

## 29. THE SIXTEEN THE SWEEP HAD NEVER LOOKED FOR — `shared/` was a CONSUMER
## root and never a SCAN root (2026-08-24, opus-1157/1159, ruled fable-1508 §1.
## A reading, not a ruling: no deletion is proposed here and none is authorised
## by it.)

### 29a. Why there are suddenly sixteen more

`sweep-uncalled-exports-disposable.mts` had `scanRoots = ["server"]` from the
day it was written. `shared/` was in `consumerRoots` — it could always be
*asked* whether it consumed something — and was never in `scanRoots`, so a
symbol **declared** there could not appear in any reading this instrument ever
produced.

That is the half of the repository this scan was most needed in. `shared/` is
where a closed vocabulary goes when two sides that cannot import each other both
need it — `drizzle/schema.ts` cannot import from `server/` — so it holds
precisely the derivations most worth checking for consumers.

The specimen is not hypothetical. `openReferenceIntents`
(`shared/referenceIntents.ts:162`) was carried forward as a shift's hand-found
lesson — *a derivation with no consumer looks exactly like a derivation* — while
the instrument built for that exact class was looking at another directory.

Adding the root: 479 → 513 production files, 3,554 → 3,792 named exports, and
**eighteen findings no reading had ever carried** (sixteen of them on the
reading list; `PACKAGE_SLOTS` and `MODELS` classify as `other` — see §29d).

`client/` is deliberately still absent, and that is a scope rather than an
oversight (endorsed by name, fable-1508 §1): a test-only export in `client/` is
a weaker claim, since there is no request path for it to be off.

### 29b. ⚠ And the repair had a trap that a false-positive would have written
### into this very table

Widening `scanRoots` **alone** makes the instrument invent findings, which its
docblock explicitly promised it could not do (*"Every one of those biases toward
SILENCE, so the list it prints is a floor"*).

The first widened run flagged `WARDROBE_LINE_MAX_LENGTH` as consumed by nothing
but a test. It is live at `drizzle/schema.ts:2076` — the varchar length of the
column that stores a wardrobe line. **`drizzle/` was in neither spelling of the
consumer-root list**, and there were two spellings (the sweep's own, and
`productionMention.mts`'s), which is working law 4 inside the instrument.

Caught by spot-checking the highest-signal row before publishing it. Had it not
been, a live constant would have entered this table as an inert-control claim —
and this repository acts from this table.

The repair: one owned `CONSUMER_ROOTS` including `drizzle`, the docblock's
silence-bias sentence rewritten to state its **condition** instead of asserting
itself, and `WARDROBE_LINE_MAX_LENGTH` kept as a **negative control** so the
root cannot be dropped again without the run refusing. Proven able to fail:
dropping `drizzle` reddens that arm alone, exit 1, `REFUSED`.

### 29c. The class — five of the sixteen are ONE mistake-shape, not five

A closed `as const` vocabulary in `shared/`, plus an `isX()` narrower that no
production code calls — because membership is already enforced **structurally**
by the same array, as a `mysqlEnum` column and/or a `z.enum` at the wire:

```
isCastingPath       CASTING_PATHS        mysqlEnum schema.ts:2075 · z.enum castingV2.ts:1101
isInkCutRoute       INK_CUT_ROUTES       mysqlEnum schema.ts:3234
isInkProvenance     INK_PROVENANCES      mysqlEnum schema.ts:3196,3464 · z.enum castingV2.ts:568,744
isInkTemplateKind   INK_TEMPLATE_KINDS   mysqlEnum schema.ts:3304
isCanonicalViewAngle CANONICAL_VIEW_ANGLES  z.enum boardOps.ts:683,694
```

Every one is `KEEP`, and the reason is the same sentence five times: the guard is
redundant *because* the vocabulary is derived rather than copied. The list being
the enum is law 4 working — the guard is what law 4 made unnecessary.

`isInkCutRoute` was read first and separately, because it is the only row of the
sixteen sitting on a road that is LIVE in production
(`CASTING_INK_CUT_SCOPE=users:1`). It is a fence the tests hold shut, not
invariant 7 with a customer behind it: the containment rule that actually governs
that road is its sibling `inkDesignWasExamined`, with three production call sites
(`inkDesignForAsk.ts:378`, `recipeAssembler.ts:1338`, `recipeAssembler.ts:1739`).

### 29d. Two that are NOT on the reading list, and one of them is a finding

`PACKAGE_SLOTS` and `MODELS` classify as `other` — the classifier found a
production mention of each name and quoted it — so neither gets a row here. Both
mentions are **a different declaration of the same name**, which is the `other`
bucket working as designed (a hand read decides).

`MODELS` is benign: `geminiGeneration.ts:218` and `:551` each declare a local
`const MODELS = [...TEXT_HEAVY_FALLBACK]` from the properly-imported member. The
`shared/modelRegistry.ts` aggregate is simply unused.

⚠ **`PACKAGE_SLOTS` is a working-law-4 instance and it is LIVE client code.**
`shared/boardTypes.ts:61` declares the derived view
(`PACKAGE_SLOTS = CANONICAL_VIEW_ANGLES`) and nobody imports it, while
`client/src/features/casting/components/ImageViewer/ViewTabs.tsx:242` declares a
**hand-written literal array of the same six under the same name**, and drives
both the tab strip and `hasMissingView` from it.

They have **already drifted**: `frontFull` and `sideClose` are in opposite
positions in the two lists. Membership still agrees, so nothing is broken today.

That is exactly the incident `shared/boardTypes.ts` records one constant above,
about this same family:

> `CANONICAL_VIEW_ANGLES` is the comp-card six and iterating IT is how package
> v3's close-up came to be generated, charged, refunded and then silently
> dropped from the room — the slot did all its work and never reached the
> screen, because the loop that draws the strip had never heard of it.

No test pins the client's list to the shared one. It is filed here rather than
fixed here: it is live client code and a rendering change, not a cleanup-table
row, and it is not this sitting's grant.

### 29e. What every verdict below rests on, stated as a floor

Per fable-1508 §2, no row here is dispositioned *inert* on a grep. A clean hand
grep inherits every limit the sweep declares — namespace imports, dynamic
specifiers, barrels, the six root-level `.ts` files, and the self-reference
discriminator. So the honest verdicts are:

- **live-via-a-shape-the-instrument-cannot-see**, with the shape named;
- **defensive-by-design**, with the docblock, test or structural enforcement
  cited;
- **no-consumer-found-by-any-reading** — a floor, never a proof.

None of the sixteen is ruled for removal. There is no `TAKE` row in this
section, and that is deliberate: fable-1508 granted a triage, and a removal
ruling is a different act.

## 30. LAW 7 ASKED OF LAW 7's OWN FIX — and §29d's repair had created a THIRD
## copy of the six it was repairing (2026-08-24, opus-1160, ruled fable-1511.
## A reading plus two repairs; the held rows authorise no deletion.)

### 30a. Why this section exists

`f0fe2f6e` fixed §29d: `ViewTabs.tsx` had hand-written the comp-card six and
drawn the customer's tab strip from its own copy, and the two lists had already
drifted in ORDER. The fix pinned `shared/boardTypes.ts`'s `PACKAGE_SLOTS` to
D-39's clusters and derived the strip from it.

**It shipped without its sweep.** Law 7 says the sweep is part of the fix — name
the class, look for siblings — and that fix named no class and looked for none.
The 1509 grant that specified it did not ask either. So the class was asked
mechanically afterwards, by
`scripts/sweep-handwritten-vocabularies.mts` (promoted from disposable in this
commit, fable-1511 §2): every exported string-literal `as const` array in
`shared/`, against every literal array in `client/src`, `server/`, `shared/` and
`drizzle/`, matched on member SET.

```
DECLARED  38 vocabularies in shared/ (>= 2 members)      [before this commit]
SCANNED   1528 files
HITS      93 literal arrays whose member SET equals a declared vocabulary
          26 in production files, 22 of those never naming the constant
```

### 30b. ⚠ THE HEADLINE — the repair landed a second constant identical to one
### that already existed, and the two orders were pinned APART

```
shared/boardTypes.ts:86   PACKAGE_SLOTS
  frontClose · threeQuarter · sideClose · frontFull · sideFull · backFull
shared/exportViews.ts:18  COMP_CARD_VIEW_ORDER
  frontClose · threeQuarter · sideClose · frontFull · sideFull · backFull
```

Identical, member for member and position for position. Two shared constants,
two docblocks, each claiming to be *the* comp-card presentation order, and
nothing tying them.

What each one drives is why it matters:

```
PACKAGE_SLOTS         → the tab strip the customer sees (ViewTabs.tsx:274)
COMP_CARD_VIEW_ORDER  → compCardViewOrder(), the export sort key, and the order
                        the ZIP filenames 01_…–06_… are numbered along
                        (server/exportViews.test.ts:29); live consumers
                        client/src/features/export/prepareExportViews.ts:50
                        and useExportPack.ts:94
```

They are one promise stated twice — **tab 4 is file 04**. And each was pinned to
its OWN literal by its own test (`boardTypes.test.ts:54`,
`exportViews.test.ts:69`), which is the worst available arrangement: reorder the
strip deliberately, one test reddens, update its literal, ship — and the tabs
number differently from the customer's download, with a green suite and no
reader anywhere able to see it.

`COMP_CARD_VIEW_ORDER`'s docblock was also stale by twenty hours: it cited *"the
order ViewTabs renders (ViewTabs.tsx VIEWS)"*, and `f0fe2f6e` had deleted
`VIEWS`.

**Repaired here** (fable-1511 §1): `COMP_CARD_VIEW_ORDER = PACKAGE_SLOTS`, an
exported alias whose docblock says it is one. The direction is forced by the
import graph — `boardTypes.ts` imports nothing at all, so the declaration cannot
live in `exportViews.ts`. The name is kept because every export consumer reads
it and a test's own description names it. `exportViews.test.ts` now asserts the
IDENTITY instead of a second literal, and that assertion is this commit's real
content: the *tab 4 is file 04* promise finally has a test that can see it.

**No value moved, and that is proven rather than asserted** —
`scripts/_vocab-fold-evidence-disposable.mts` reads BEFORE out of git at
`f0fe2f6e` and AFTER by IMPORTING the modules, prints both, and refuses if
either constant changed. Law 6 does not bind a change proven value-identical
(fable-1511 §1 Q2), and the identity assertion is stronger evidence than a
screenshot of the same pixels. ⚠ **Its first reading said a value HAD moved, and
the instrument was the thing that was wrong**: the reader kept `PACKAGE_SLOTS`'s
interleaved cluster comments inside the members. Suspect the instrument first.

### 30c. The second live client copy, in the one file that had already paid

```
client/src/features/casting/utils/buildHistoryFromAssets.ts:37
  const PACKAGE_VIEW_TYPES = ['frontClose','threeQuarter','sideClose',
                              'frontFull','sideFull','backFull'];
  a MEMBERSHIP filter (.includes) — order is not load-bearing here
```

Its own comment, three lines above: *"the old frontClose/frontFull/sideClose
whitelist made a Production mint look three slots short on re-edit (VC-R3b bug
1)"*. **A wrong membership list in this exact file has already cost a customer a
wrong screen once.**

**Repaired here**: `isCanonicalViewAngle(asset.viewType)` — the narrower
`shared/boardTypes.ts` already exports for precisely this, unused here.

### 30d. HELD — the three `mysqlEnum` literals (fable-1511 §3)

`drizzle/schema.ts:924` (`targetViewAngle`), `:1136` (`sourceViewAngle`),
`:1190` (`targetViewAngle`) each hand-write the canonical six, in
`CANONICAL_VIEW_ANGLES` order, never naming it. The house style already exists
in the same file — `CASTING_PATHS`, `INK_CUT_ROUTES`, `INK_PROVENANCES`,
`INK_TEMPLATE_KINDS` and `INK_SIDES` are all imported from `shared/` into
`mysqlEnum` — and these three predate it.

**Held, not taken.** It is the schema file and the value of the change is
entirely latent. IF ever taken: its own commit, with the drizzle-generates-no-
diff check shown. Value and order are identical today, so no migration is
implied — but that is the thing to prove, not to assume.

### 30e. FILED — read, and correctly left alone, with the reason each

- **`INK_SIDES` × 8 production sites** — `inkAnatomyRegistry.ts` (×6) and
  `inkAddRecipe.ts:18` declare `["left","centre","right"]` against the shared
  `["left","right","centre"]`. All on the composer road:
  `R7_EVIDENCE_COMPOSER_SCOPE` is `off`, and `INK_ADD_RECIPE` /
  `authorizeInkAddDescription` are already `HELD` in
  `cleanup-dispositions.yaml` on *the composer road's module-sized
  disposition*. Folding these would be work on a road pending retirement.
- **`server/castingV2/axisRegistry.ts:613` `AGE_PHASE_ORDER`** and
  **`server/castingV2/poolTendencies.ts:177` `AGE_ORDER`** — literal copies of
  `AGE_PHASES` / `AGE_BANDS`, same order, on a LIVE road
  (`CASTING_V2_SCOPE=all`). Worth its own sentence: `AGE_ORDER` is typed
  `readonly AgeBand[]`, so **the compiler checks that each member is a valid
  band and NOT that all seven are present or in the declared order** — the
  drift shape exactly, one type annotation away from looking safe.
- **`server/db/inkAddCandidates.ts:561` `fallbackOrder`** — a deliberate THIRD
  ordering of the same six (widest, most identity-bearing source view first).
  Not a mirror at all: deriving it from either other order would be a lie about
  what it means. **It carries the sweep's `deliberate-vocabulary-copy` marker
  and is the instrument's NEGATIVE control.** Its exposure is membership only —
  a seventh canonical view would still have to be added by hand.
- `client/src/features/casting/ControlPanel.tsx:494` — the studio's body-type
  picker hand-writes the six `BODY_TYPE_VALUES` that the server's identity
  option set derives from (`identityTypes.ts:160`). Live client/server
  coupling, nothing pinning it.
- `server/casting/evidence/composer/inkCalibration.ts:13` (`INK_PROVENANCES`),
  `server/castingV2/inkPlacement.ts:116` and `shared/castingOptions.ts:142` and
  `shared/inkProvenance.ts:13` — the last three name their constant in the same
  file, which is the weakest class of hit and the sweep's noise bias working.

### 30f. ⚠ UNVERIFIED, and stated in 7b's own wording — the gender lists differ

Found by hand BESIDE the sweep, and it is the shape set-equality can never
report:

```
client/.../ControlPanel.tsx:455  options={["Female", "Male", "Non-Binary"]}
shared/castingOptions.ts:97      GENDER_VALUES = ["Male", "Female"]
```

`Non-Binary` is first-class client vocabulary — `hairStyleConfig.ts` keys 15+
hairstyle rows on it. `GENDER_VALUES` feeds `FORM_OPTION_SETS.gender` →
`GenderOption`, whose docblock says an off-list structured value *"cannot
compile"*.

**No defect is claimed and none is established.** `FORM_OPTION_SETS` and
`GenderOption` have no consumer outside `identityTypes.ts` in the reading taken,
so the likeliest account is a dormant contract rather than a live rejection —
and *likeliest* is not a reading. It is also product ontology, which is the
founder's. Not carded (fable-1511 §3): no customer impact is established and a
card about a dormant contract spends his attention on a maybe.

**What would make it real: a consumer of `FORM_OPTION_SETS.gender` appearing.**
The sitting that adds one inherits this question by name.

### 30g. What the instrument owes, and what it cannot see

Promoted with the dues a tracked instrument owes here (working law 2):

```
POSITIVE (synthetic)  a planted copy of a fixture vocabulary must be FOUND, and
                      a reordered one reported as ORDER DIFFERS
NEGATIVE (real tree)  inkAddCandidates.ts's marked fallbackOrder must NOT be
                      reported — and a second arm asserts it is quiet because it
                      is MARKED rather than because it is absent
```

The positive control is synthetic on purpose: the real specimen that bought this
instrument is repaired by the same commit that promotes it, so a control anchored
on it would have been born unable to fire.

**Both proven able to fail, by two sabotages:** deleting the marker at the real
site reddens the two negative arms ALONE; blinding the matcher reddens the
positive arms and leaves the negative arms passing vacuously — which is the
absence-only shape, survivable only because the run REFUSES on any failed arm.

⚠ **And its own controls caught a defect in it before it was believed.** The
marker was first *"any marker within eight lines above"*, which silenced every
literal beneath one note — an exemption that grows on its own. A marker now
governs the NEXT literal and no other.

Its named limits: a copy assembled rather than written (`[...A, "x"]`,
`Object.keys(M)`), a copy whose members are not all string literals on one
bracket pair, and any SUBSET or SUPERSET — §30f is that last limit standing in
front of a live example. **A clean run is a floor, never a proof.**

Reading after the two repairs: **66 hits, 17 in production** (from 93/26 — the
fold removes one declaration and the two repairs remove their sites), and every
remaining production row is dispositioned in §30d–§30e above.

## 31. THE OTHER HALF OF THE SAME INSTRUMENT — the list that has ALREADY
## drifted (2026-08-24, opus-1162, ruled fable-1513. A reading plus one
## instrument change; no deletion is proposed here and none is authorised by it.)

### 31a. Why this section exists

§30 promoted `scripts/sweep-handwritten-vocabularies.mts` and, in the same
breath, named its own blind spot — and named a LIVE example inside it:

> a SUBSET or SUPERSET of a vocabulary — set equality is the match, so a list
> that has already drifted in MEMBERSHIP falls silent here. That is not
> hypothetical: `ControlPanel.tsx:455` offers a gender the shared
> `GENDER_VALUES` does not contain, and this sweep does not report it.

**Set equality can only ever find a copy that has NOT drifted yet.** The copy
that has already drifted is the one that costs something, and it was invisible.
§30f had to be found by a hand beside the instrument, which is why 7b made us
file it as UNVERIFIED.

Ruled fable-1513 §1: the sweep gains a SECOND reading — a literal exactly ONE
member from a declared vocabulary, in either direction, reported with which
member is EXTRA here or MISSING here. Printed as its own section, never pooled
into the HITS count, and disjoint from it by construction (an exact match has a
symmetric difference of zero and can never be a near miss).

### 31b. The band is a stated scope, and the bands outside it are MEASURED

`NEAR_MISS_MAX_DIFFERENCE` is 1. That is chosen, not natural, so the whole
distribution was measured first and written into the docblock rather than left
as a threshold nobody could argue with. Production counts in brackets:

```
symmetric difference == 1     69 [27]   ← READ
symmetric difference <= 2    142 [67]   ← measured, NOT read
jaccard >= 0.5               153 [53]   ← measured, NOT read
any strict SUBSET            194 [61]   ← measured, NOT read
any overlap at all           581        ← measured, NOT read
```

Widening the band is a one-constant change; the cost is a table nobody
finishes. Written down so that widening it is a decision with a number attached
rather than a discovery. (An `intersection >= 2` guard was tried and REMOVED: at
this band it removes exactly zero rows — two lists with nothing in common are at
least four members apart — and a filter that has never filtered is not shipped.)

The reading on the tree at this commit:

```
DECLARED  37 string-literal `as const` vocabularies under shared (>= 2 members)
SCANNED   1528 files under client/src, server, shared, drizzle
HITS      66 literal arrays whose member SET equals a declared vocabulary
          17 in production files, 14 of those never naming the constant
NEAR      68 literal arrays exactly 1 member from a declared vocabulary
          26 in production files, 24 of those never naming the constant
```

**26 and not the measured 27** because one row became the reading's real-tree
NEGATIVE control and is now marked — see §31g.

### 31c. ⚠ TEN OF THE TWENTY-SIX ARE ATTRIBUTED TO THE WRONG VOCABULARY, and
### that is a named limit standing in front of live rows again

`server/casting/evidence/inkAnatomyRegistry.ts` lines 141–186 each declare
`sides: ["left", "right"]` and are reported as one member short of
`shared/inkReleasedPlacements.ts`'s `INK_SIDES`. **They are not narrowings of
`INK_SIDES` at all.** They are typed `readonly InkAnatomySide[]`, and
`INK_ANATOMY_SIDES` is declared at `inkAnatomyRegistry.ts:81` — OUTSIDE
`VOCAB_ROOTS`, which the docblock names as a thing the sweep cannot see. The
compiler checks each of those ten against the composer road's own vocabulary.

So the honest row is not the ten. **It is the declaration at line 81** — a
second spelling of `INK_SIDES`, same three members, different order — and
reading (1) already reports it. Its disposition is §30e's, unchanged: the
composer road (`R7_EVIDENCE_COMPOSER_SCOPE` is `off`, `INK_ADD_RECIPE` and
`authorizeInkAddDescription` HELD on a module-sized disposition) is pending
retirement, and folding a vocabulary on a road being retired is work on a road
being retired.

**The class is worth more than the ten instances**: a near miss can be
attributed to the WRONG vocabulary whenever a same-worded one is declared
outside `VOCAB_ROOTS`, and the row then points at a fold that would be actively
wrong to make. A near-miss row names a candidate, never a defect.

### 31d. The gender family — §30f moves from a HAND's word to an INSTRUMENT's row

Five production rows, and they are the reason this reading exists:

```
client/src/features/casting/ControlPanel.tsx:455     options={[…"Non-Binary"]}
client/src/features/casting/hairStyleConfig.ts:20,25,26,30
                                     gender: ['Female','Male','Non-Binary']
  all five vs GENDER_VALUES (shared/castingOptions.ts:97) = ["Male","Female"]
  EXTRA here: Non-Binary
```

**§30f's verdict does not change and its condition does not move** — what
changes is who found it. The client's three-member gender vocabulary is declared
as an inline TYPE UNION (`gender: ('Female' | 'Male' | 'Non-Binary')[]`,
`hairStyleConfig.ts:16`) rather than as a shared const, which is why no reading
of `shared/` could ever have seen the declaration; only the drift is visible.

Verdict: **`no-consumer-found-by-any-reading`** for the shared contract.
`FORM_OPTION_SETS.gender` → `GenderOption` has no consumer outside
`identityTypes.ts` in the reading taken, so the likeliest account is a dormant
contract rather than a live rejection — and *likeliest* is not a reading. Not
carded (fable-1511 §3, unchanged). **What would make it real: a consumer of
`FORM_OPTION_SETS.gender` appearing.**

### 31e. The lifecycle family — defensive-by-design WITH A NAMED TENSION
### (four rows; the verdict wording is fable-1513 §3's)

```
drizzle/schema.ts:239              status mysqlEnum, EXTRA: provisioning
server/db/castingV2Sign.ts:1230    ["provisioning","active","locked"]
server/casting/modelAvailability.ts:11  AVAILABLE_MODEL_STATUSES, twice —
    MISSING archived (vs MODEL_LIFECYCLE_STATUSES), EXTRA draft (vs
    MODEL_MINTED_STATUSES)
```

**`provisioning` is a real, live, written status that the shared closed
vocabulary does not contain.** Written at `castingV2Sign.ts:409` and
`server/casting/evidence/evidenceFork.ts:357`, queried in eleven places, and it
reaches the customer as *building* at `server/routes/castingV2.ts:1773` and
`server/castingV2/castProjection.ts:251`. So `isModelLifecycleStatus(
"provisioning")` is **false** and every predicate in `shared/modelLifecycle.ts`
reads a Cast mid-Sign as UNKNOWN.

**No defect is claimed and nothing was changed.** Both docblocks say this is the
design, in as many words — `modelAvailability.ts`: *"New lifecycle states such
as `provisioning` stay invisible and non-authoritative until they are
deliberately added here and reviewed across every consumer"*, and
`shared/modelLifecycle.ts`: *"Unknown/unrecognized status fails
CONSERVATIVELY"*. The customer sees *building* correctly today.

⚠ **The named tension**: the shared module's read-state law says *"Status is the
ONLY read-model discriminator"*, and its carve-out is for authoritative
TRANSITION guards. The two surfaces above discriminate on `provisioning`
directly, and a projection deciding whether the customer sees "building" is a
read model by any honest reading. **The sitting that adds the NEXT lifecycle
status inherits this by name** — that is the moment the direct discriminations
either multiply or get folded into the shared module, and it should be decided
then, on a real case rather than on this one.

### 31f. The remaining seven, each with its reason

- **`server/castingV2/inkReferenceTake.ts:90` `STATEABLE_SIDES`** —
  `defensive-by-design`, and the docblock says so at the site: *"`centre` is not
  among them and that is deliberate … Nobody types it about a tattoo."* A
  narrowing of what a SENTENCE can state, not a copy of the vocabulary.
- **`server/castingV2/referenceSlots.ts:43` `INSTANCES`** — not a vocabulary of
  sides at all: the suffix set for a slot KEY. Coincidence of words. The sweep's
  noise bias working exactly as its docblock promises.
- **`server/castingV2/inkPlacement.ts:582` `SIDES`** and
  **`server/castingV2/refineService.ts:8287` `SIDE_WORDS`** — both are
  word-matching sets over a customer's prose (`.find(…RegExp…)` and a `Set` of
  words STRIPPED from an ask). A list of words to look for in a sentence is not
  a copy of a list of values. Same class, same disposal.
- **`client/src/features/casting/hairStyleConfig.ts:43`** — `'Braids / Locs'`
  offers four of the five `HAIR_LENGTHS`, MISSING `Very Short`, which is a real
  per-style narrowing and correct. ⚠ **It is the weakest row here and worth its
  sentence**: the field is typed `lengths?: string[]`, bare strings, so nothing
  checks these against `HAIR_LENGTHS` at all — a typo would ship. Not fixed
  here (it is a client config shape, not a drift), and named so the sitting that
  types that interface knows what it is buying.
- **`server/castingV2/hairStyles.ts:639` `ORDINARY_SLOTS`** — four of the five
  `MODIFIER_SLOTS`, MISSING `lineup`, deliberate and documented (*"there is no
  fringe on a buzz cut"*). Typed `readonly ModifierSlot[]`, so the compiler
  checks each member is a real slot and **not** that the list is complete —
  `AGE_ORDER`'s shape from §30e, one type annotation away from looking safe.
- **`shared/boardTypes.ts:118` `MINT_TIER_SLOTS.production`** — five of the six
  `CANONICAL_VIEW_ANGLES`, MISSING `frontClose`, which is what a tier IS. Typed
  `Record<MintTier, readonly CanonicalViewAngle[]>`, names the constant, and
  carries a comment per tier.

**No TAKE rows.** Nothing here authorises a deletion or a fold, and none is
proposed.

### 31g. What the second reading owes, and what it cannot see

```
POSITIVE (synthetic)  a planted literal ONE MEMBER SHORT is found and named
                      MISSING; one MEMBER LONG is found and named EXTRA
                      — BOTH directions, each with its label asserted
DISJOINT (synthetic)  an EXACT copy is NOT reported here
BAND     (synthetic)  a literal TWO members apart is NOT reported
MARKER   (synthetic)  one marker silences the near miss it governs and NOT the
                      next literal down
NEGATIVE (real tree)  shared/inkReleasedPlacements.ts's marked perSide
                      narrowing of INK_SIDES is NOT reported — plus a second
                      arm asserting it is quiet because it is MARKED
```

The positive controls are synthetic for §30g's reason, and it applies harder
here: several rows above are candidates for repair, and a control anchored on a
row that can be repaired is a control that quietly stops firing.

**The real-tree negative is new production comment, and it is the honest way to
buy one**: `sidesForInkPlacement` in `shared/inkReleasedPlacements.ts` IS the
narrowing of `INK_SIDES` — the paired half in one branch, the unpaired in the
other — so `deliberate-vocabulary-copy` is true of it. Delete that marker line
and the arm reddens.

**Proven able to fail, three sabotages:**

```
A  marker deleted at the real site   → the TWO near-miss negative arms, alone
B  band set to 0 (matcher blinded)   → the two POSITIVE arms and the MARKER arm;
                                       both NEGATIVE arms pass VACUOUSLY
C  the two direction labels swapped  → the two POSITIVE arms, alone
```

B is the absence-only shape again and it is now stated in the file rather than
in a report: **a negative arm passes for free when the finder is blind**, and it
is survivable only because the run REFUSES on any failed arm. ⚠ That sentence
was reported as landing in the docblock at `d11f7c27` and **it was not in the
file** — opus-1161 §4 said it had been written there, fable-1512 ratified the
report, and the artifact never held it. Law 1, on this program's own paperwork:
a report is a claim. It is in the file now, driven rather than asserted.

**One marker serves BOTH readings** (fable-1513 §2), and the consequence is
stated in the docblock rather than left to be met: a site that is a deliberate
narrowing of vocabulary A and an accidental exact copy of vocabulary B would go
quiet about both on one note. No such row exists today. **If one ever does, the
marker gains an optional qualifier THEN** — `deliberate-vocabulary-copy:
GENDER_VALUES` — scoping the silence to the named vocabulary. Not built now: a
qualifier grammar nobody has needed is a second vocabulary, which is what this
instrument is about.

Its limits, beyond §30g's, which all still hold: **the wrong-vocabulary
attribution of §31c**, and every band in §31b that is measured and not read.
A clean run is a floor in both readings, never a proof.

## 32. THE VOCABULARY SPELLED TWICE WHERE NEITHER SPELLING IS IN `shared/` —
## reading (3), and the FOUR the database has under them (2026-08-24,
## opus-1164, ruled fable-1515. A reading plus two instrument changes; no
## deletion is proposed here and none is authorised by it.)

### 32a. Why this section exists

§31c closed on a sentence that had already been true twice:

> a near miss can be attributed to the WRONG vocabulary whenever a same-worded
> one is declared outside `VOCAB_ROOTS` … **That is the second time in two
> sittings a docblock's named limit has been found standing in front of live
> rows.**

The limit is one line — `VOCAB_ROOTS = ["shared"]`. Readings (1) and (2) match
literals against vocabularies declared in `shared/` and nowhere else, so **a
closed list spelled twice OUTSIDE `shared/` was invisible to every reading this
repository had.** That population was measured before any repair was proposed
(`scripts/_vocab-root-widening-measure-disposable.mts`, reads only).

### 32b. ⚠ BOTH OBVIOUS REPAIRS ARE WRONG, and each carries the number that
### killed it

**Widening `VOCAB_ROOTS` to `SCAN_ROOTS`** — declare from everywhere, change
nothing else. Measured, raw populations, both columns read the same way:

```
                        shared/ only    all production
  HITS  (production)         18                96
  NEAR  (production)         27                98
```

That is fable-1508 §2b's trap in different clothes: a floor turned into an
inventor, and §31b's own sentence — *the cost is a table nobody finishes*.
Nearly every extra row is a literal matched against some module's private list,
which is a narrowing the compiler already checks.

**Suppressing a near miss when the literal's own file declares something
closer** — the natural fix for §31c. Measured: that rule fires on **15 of the 27
production near-miss rows**, and three of those fifteen are rows worth keeping:

```
shared/boardTypes.ts:118            MINT_TIER_SLOTS.production — §31f says this
                                    row is CORRECT; a narrowing is what a tier IS
server/casting/modelAvailability.ts:11  the literal IS the local declaration
shared/inkReleasedPlacements.ts:81  ⚠ THE INSTRUMENT'S OWN REAL-TREE NEGATIVE
                                    CONTROL — suppression would have made it pass
                                    for a second reason and stop testing the marker
```

**A suppression rule would have quietly killed one of this sweep's own
controls.** That is the argument for the shape that landed: a row is a
CANDIDATE, never a verdict, and the repair belongs on what a row SAYS rather
than on whether it is printed.

### 32c. What landed instead — a third reading and a pointer (fable-1515 §1)

- **Reading (3), DECLARATION PAIRS**: two exported `as const` vocabularies, in
  two modules, whose member sets are EQUAL or one member apart. Its own section,
  never pooled, disjoint from (1) and (2) by construction — a pair of
  declarations is not a literal. **Seventeen production rows, against the 194 a
  widened `VOCAB_ROOTS` would print.**
- **The LOCAL-DECLARATION POINTER**: a row in reading (1) or (2) prints, beside
  its attribution, any vocabulary declared in the literal's OWN FILE that is at
  least as close. Sixteen pointers on this tree — §31c's ten near-miss rows and
  six hits. Nothing is suppressed.
- The band for reading (3) is 1, ruled rather than assumed (fable-1515 §1) on a
  real asymmetry: a literal is often a legitimate NARROWING, while two DECLARED
  closed lists two members apart are usually two different lists.

Readings (1) and (2) are **unchanged in every count** — 66 hits / 17 production
/ 14 never-naming, 68 near / 26 production / 24 never-naming, identical to
opus-1163's figures on the same tree. The refactor that gave all three readings
one walk and one collector moved nothing.

```
PAIRS     16 pairs of DECLARED vocabularies within 1 member of each other
          drawn from 137 production declarations under client/src, server, shared, drizzle
          10 with EQUAL member sets, 6 one member apart, 10 with NEITHER side in
          shared — invisible to readings (1) and (2)
```

**16 reported and 17 dispositioned below**, because one became the reading's
real-tree NEGATIVE control and is now marked — §32j, and the same accounting
§31b made for its 27-versus-26.

### 32d. ⚠ THE HEADLINE — FOUR vocabularies declared twice, three of them under
### the SAME NAME, with a database column on one side and a runtime assertion
### on the other

```
EVIDENCE_INTENT_STATUSES              server/casting/evidence/evidenceCandidateContract.ts:5
IDENTITY_FEATURE_INTENT_STATUSES      drizzle/schema.ts:808     3 members, same order
EVIDENCE_CANDIDATE_STATUSES           evidenceCandidateContract.ts:12
EVIDENCE_CANDIDATE_STATUSES           drizzle/schema.ts:814     7 members, SAME NAME
EVIDENCE_CANDIDATE_ATTEMPT_STATUSES   evidenceCandidateContract.ts:24
EVIDENCE_CANDIDATE_ATTEMPT_STATUSES   drizzle/schema.ts:824     9 members, SAME NAME
EVIDENCE_PROBE_OUTCOMES               evidenceCandidateContract.ts:45
EVIDENCE_PROBE_OUTCOMES               drizzle/schema.ts:836     3 members, SAME NAME
```

Read at both files. **The two sides are not two copies of one job — they are the
two halves of one contract, and neither knows the other exists:**

- the schema side is what the COLUMN accepts (`mysqlEnum(...)` at `:864`,
  `:939`, `:1049`, and `EVIDENCE_PROBE_OUTCOMES` on **eight** outcome columns
  from `:1065` to `:1072`)
- the contract side is what the APPLICATION accepts
  (`assertClosedValue(value, …)` at `:95`, `:103`, `:113`, `:121`)

Neither is imported by the other, and — read by grep across `server`, `client`,
`shared` and `drizzle` — **neither is imported by anything else at all.** They
agree today, member for member and in order.

**The failure mode is the reason this is the headline rather than a tidiness
row.** Add a status to the contract and not the column and the application
accepts a value the insert rejects; add it to the column and not the contract
and `assertClosedValue` throws on a row the database is holding. Neither side
would fail to compile, and no test would redden.

**And the house's own counter-example is six lines above the schema copies**:
`drizzle/schema.ts` imports `INK_SIDES`, `INK_PROVENANCES`, `INK_CUT_ROUTES`,
`INK_FORM_DEMAND_KINDS`, `INK_TEMPLATE_KINDS` and `KIND_LOCALITIES` from
`shared/` at lines 17–24 and feeds them straight into `mysqlEnum`. The pattern
that would fix this is already in the file.

**Verdict: HELD, on §30d tier 3's condition exactly** (directed fable-1515 §2).
A fold moves the vocabulary to `shared/` and imports it on both sides; because
it touches `drizzle/schema.ts` it takes **its own commit, with the
drizzle-generates-no-diff check shown**. Values and orders are identical today
so no migration is implied — *that is the thing to prove, not to assume.*

**What lowers the temperature, and it is a condition rather than a comfort**:
the road these tables serve is off. `R7_EVIDENCE_COMPOSER_SCOPE` is `off` on
production, and `ENABLE_EVIDENCE_CANDIDATE_WORKER=true` is inert behind it. **A
drift costs nothing while nothing writes these rows** — which is the same
sentence §31e's tension carries and the same one fable-1508 §3 wrote about the
composer cap: *a dead control keeps a live reputation exactly while its road is
off.* The sitting that turns that scope ON inherits this by name.

### 32e. `REQUIRED_CAST_FIELDS` / `ENGINE_CHOICE_FIELDS` — §16's class, and a
### drift here is a SILENT DROP rather than an error

```
REQUIRED_CAST_FIELDS  client/src/features/casting/engineChoicePersistence.ts:3
ENGINE_CHOICE_FIELDS  server/casting/engineChoiceMetadata.ts:3
  castingBrand · gender · age · ethnicity · skinTone · eyeColor · hairColor · hairStyle
  8 members, same order, different names, NEITHER in shared/
```

This is §16's shape — a thing stated on the server and written again on the
client — and §16's ruling governs: **one promise, two homes; filed, not
changed.** Both copies are live and each derives its own type
(`RequiredCastField`, `EngineChoiceField`).

⚠ **What §16's sentence does not cover, and belongs on this row**: the server's
list is the VALIDATOR for what the client persists. `sanitizeEngineChoice`
(`engineChoiceMetadata.ts:21`) filters the incoming object by
`ENGINE_CHOICE_FIELDS`, so a ninth field added on the client is **dropped in
silence** — no error, no log, no failing test. §16's ten live-statement pairs
drift into two different sentences; this pair drifts into data that vanishes.
Not carded and not changed: no ninth field is proposed and no customer impact is
established. **What would make it real: a ninth engine-choice field.** The
sitting that adds one inherits this by name.

### 32f. The ink `left/centre/right` family — SIX pairs, one already-dispositioned
### road

```
INK_ADD_SIDES      server/casting/evidence/composer/inkAddRecipe.ts:18
INK_ANATOMY_SIDES  server/casting/evidence/inkAnatomyRegistry.ts:81
INSTANCES          server/castingV2/referenceSlots.ts:43
INK_SIDES          shared/inkReleasedPlacements.ts:59
```

Six pairs among those four: `INK_ADD_SIDES`≡`INK_ANATOMY_SIDES`, each of those
two ≡ `INK_SIDES` with **ORDER DIFFERING**, and each of the three three-member
lists one member from `INSTANCES`.

**No verdict moves.** `INK_ADD_SIDES` and `INK_ANATOMY_SIDES` keep §30e's
disposition — the composer road, `R7_EVIDENCE_COMPOSER_SCOPE` `off`,
`INK_ADD_RECIPE` and `authorizeInkAddDescription` HELD on the composer road's
module-sized disposition; folding a vocabulary on a road pending retirement is
work on a road pending retirement. `INSTANCES` keeps §31f's: it is the suffix
set for a slot KEY and not a vocabulary of sides at all — coincidence of words,
the sweep's noise bias working as its docblock promises.

**What reading (3) adds is the third leg**: §31c saw ten literals pointing at
the wrong vocabulary and named `INK_ANATOMY_SIDES` as the honest row.
`INK_ADD_SIDES` is a THIRD spelling of the same three words, and the pair
between the two server copies was invisible to every reading before this one.

### 32g. `TASTE_WRITABLE_AXES` / `HAIR_AXES` — two QUESTIONS that coincide today

```
TASTE_WRITABLE_AXES  server/castingV2/axisRegistry.ts:233
  hairStyle · hairTexture · hairModifiers · wornState · facialHair · hairColour
HAIR_AXES            server/castingV2/hairResolver.ts:53
  hairColour · hairStyle · hairTexture · hairModifiers · wornState · facialHair
  EQUAL member sets · ORDER DIFFERS · neither in shared/
```

**No defect claimed and nothing changed.** They answer different questions —
*which axes hair has* against *which axes the sheet taste pass may write* — and
the second has a stated law and a type-level proof of it at the site:
`TASTE_WRITABLE_AXES`'s docblock calls itself *"the law's single source"*, and
`OnlyRealizedIsTasteWritable` makes adding `sex` a compile error. The coincidence
is a fact about today's scope, not a mirror.

⚠ **The named tension**: nothing checks the two against each other, and nothing
should — but the day a seventh hair axis is added, whether it is taste-writable
is a real decision, and these two lists differing is exactly the record of it.
**The sitting that adds the next hair axis inherits this by name.**

### 32h. Rows whose verdicts are already written, restated with their citation

- **`AVAILABLE_MODEL_STATUSES` vs `MODEL_LIFECYCLE_STATUSES` and
  `MODEL_MINTED_STATUSES`** (2 pairs, `server/casting/modelAvailability.ts:11`)
  — §31e's lifecycle family. **Defensive-by-design with a named tension**, both
  docblocks cited there, verdict and inheritance condition unchanged: the
  sitting that adds the NEXT lifecycle status inherits it.
- **`INSTANCES` vs `INK_SIDES`** — §31f, coincidence of words, disposed of as
  noise with its reason.
- **`INK_CALIBRATION_SOURCE_KINDS` vs `INK_PROVENANCES`**
  (`server/casting/evidence/composer/inkCalibration.ts:12`) — §30e already filed
  the LITERAL one line below this declaration. Composer road, scope `off`. The
  pointer now prints on that hit row too, naming the local declaration.

### 32i. `CASTING_EVIDENCE_INGESTION_PURPOSES` / `CASTING_EVIDENCE_ENTITY_KINDS`

```
drizzle/schema.ts:639   reference_plate · evidence_crop · fork_copy
drizzle/schema.ts:657   reference_plate · evidence_crop
  MISSING from the second: fork_copy
```

**Defensive-by-design, read at the site.** A PURPOSE (why bytes were ingested)
and an ENTITY KIND (what the thing is) are two questions, and `fork_copy` is an
answer to the first that is not an answer to the second. Two vocabularies that
overlap, not one written twice. **Not marked**: a marker is a claim, and one
honest real-tree negative control is enough — a second would be buying silence
rather than evidence.

### 32j. The real-tree NEGATIVE control, and why the marker is TRUE of it

```
STORAGE_CLEANUP_BATCH_STATUSES  drizzle/schema.ts:552
  pending · processing · succeeded · partial · failed
STORAGE_CLEANUP_ITEM_STATUSES   drizzle/schema.ts:561
  pending · processing · succeeded · failed
```

`partial` is what a BATCH is when some of its items succeeded and others failed.
It is meaningless for one item, which either went or did not. **Two lifecycles,
not one list written twice** — so `deliberate-vocabulary-copy` is true of the
site rather than convenient there, which is the standard §31g set. The file is
one nobody is retiring. Delete the marker line and the two pair-negative arms
redden; that is sabotage D below.

### 32k. What reading (3) owes, and what it cannot see

```
POSITIVE (synthetic)  two declarations with EQUAL member sets are reported as a
                      PAIR, with the ORDER verdict asserted
POSITIVE (synthetic)  two declarations ONE member apart are reported, and the
                      missing member named on the right side
DISJOINT (synthetic)  a declaration is never paired with ITSELF — one
                      declaration, and the same declaration twice, both silent
BAND     (synthetic)  two declarations TWO members apart are NOT reported
MARKER   (synthetic)  a marker at a declaration silences every pair that
                      declaration is in, and NOT the pair between the two below it
NEGATIVE (real tree)  §32j's marked pair is NOT reported — plus a second arm
                      asserting it is quiet because that declaration is MARKED
POINTER  (synthetic)  a near miss whose own file declares an EQUALLY CLOSE
                      vocabulary names it, and the row is still REPORTED
POINTER  (synthetic)  a local declaration FARTHER than the attributed vocabulary
                      is NOT a pointer
```

Twenty-three arms in all. **Proven able to fail, four sabotages:**

```
A  the pair matcher blinded          → the two pair POSITIVES and the pair MARKER
                                       arm; the pair NEGATIVE passes VACUOUSLY
B  the pair band set to 0            → the one-member-apart POSITIVE, alone
C  the pointer's "at least as close"
   flipped to "strictly closer"      → the POINTER positive, alone — and this is
                                       the one that matters, because §31c's ten
                                       rows are EXACTLY as close to their own
                                       file's vocabulary as to the shared one
D  the real-tree marker deleted      → the TWO pair NEGATIVE arms, alone
```

All four restored, each restore re-verified by the instrument before anything
was believed, and no restore shared a `;` chain with a cleanup. **A restore is a
file copy, never a `git checkout`** — that would take the uncommitted work in
the file with it.

⚠ **Sabotage A is the vacuous-pass shape a third time**, and it is stated in the
docblock rather than in a report: a negative arm passes for free when the finder
is blind, and it is survivable only because the run REFUSES on any failed arm.
Never read a NEGATIVE arm's PASS without the POSITIVE arms beside it.

**What reading (3) cannot see, beyond §30g's and §31g's limits, which all hold:**
a declaration in a `*.test.ts` file (the pair population is production
declarations, so a fixture vocabulary equal to a real one is not a pair); a
vocabulary that is not `export`ed; and a pair two or more members apart, which is
measured and not read. **And the pointer covers only the MIS-ATTRIBUTION that
§31c named — a LITERAL copying a vocabulary declared outside `shared/` is still
unread by any reading here.** A clean run is a floor in all three, never a proof.

**No TAKE rows.** Nothing in this section authorises a deletion or a fold, and
none is proposed.

---

## 33. STATE CLAIMS THAT WENT STALE IN `server/` AND `shared/` DOCBLOCK PROSE —
## THREE SPECIMENS, NOT A POPULATION (2026-08-24, opus-1175, ruled fable-1526
## §3. A named row so that "follow-up" has an address; no deletion is proposed
## here and none is authorised by it.)

### 33a. Why this row exists, and what it deliberately is not

The six-document stale-row sweep of 2026-08-24 was scoped to `docs/specs/`. Three
specimens of the SAME class were hit incidentally, in `server/` and `shared/`,
each while verifying a document row against the code. **No sweep of code prose has
ever been run**, so these are three specimens and this row does not claim a
population — saying otherwise would be the noise-bias failure the sweep family
has already paid for twice.

The class is the one the document sweep is about: **a present-tense claim about
what the product IS, sitting in prose that nobody re-opens when the thing it
describes moves.** In a docblock it is worse in one specific way than in a design
note — the next person to read it is holding the file open to change the code
beside it.

### 33b. The three, each with the artifact that overtook it

| specimen | the claim | what overtook it |
|---|---|---|
| **`server/castingV2/refineService.ts`** | *"In production that is `CASTING_REPAINT_SCOPE=users:1` — his own account — on every tattoo ask"* | Production is `all`. **Line ~4519 of the same file says so** — *"while production is `all`"* — so the file contradicts itself about production state roughly 800 lines apart. The stale one narrates a past incident in the present tense, which is what makes it hard to see: it is *correct about the moment it describes* and wrong as a sentence. |
| **`shared/referenceIntents.ts` (a)** | *"the whole road is behind `CASTING_INK_STUDIO_SCOPE`, which is off"* | It is `users:1`, read at `scripts/lib/productionFlagPositions.mts` — the declared table the deploy rite compares to the SERVICE on every push. |
| **`shared/referenceIntents.ts` (b)** | the hair clarifying question described as *"an unbuilt road whose design is reviewed before it is built"* | **The founder DELETED the clarifying question** (fable-1087, relayed into `CLAUDE.md`'s `CASTING_HAIR_REFERENCE_SCOPE` paragraph: *"if they are vague and say copy this hair it just means the whole lot unless they specify"*). The road it calls unbuilt is built and live at `users:1` (`hairReferenceTake.ts`, `hairReferenceCutter.ts`, `referenceWordsLane.ts`). |

**A fourth was found and REPAIRED in the same commit rather than filed here**,
because it was one line and it sits on a founder-gated flip: `CASTING_TWO_PATHS_SCOPE`'s
`why` in `scripts/lib/productionFlagPositions.mts` said the flip waits on a court
that ran on 2026-08-23 — the FOURTH surface of a sentence three commits had
already chased off three others, on the one file whose whole job is not to go
stale about flags. Its correction carries the lesson in place: **a `why` is
prose, and prose in an instrument rots exactly like prose in a document.**

### 33c. Disposition, and what would settle it

**`no-consumer-found-by-any-reading` does not apply here** — these are not dead
symbols, they are live comments on live code, so the 1508 §2 vocabulary does not
fit and inventing a verdict for them would be worse than saying so. The honest
disposition is **HELD, pending a sweep that has never been run**: a hand reading
of `server/` and `shared/` docblock prose for present-tense state claims,
weighted by distance from where work happens, queued as its own sitting beside
the design-docs remainder (fable-1526 §3).

⚠ **The pricing lesson is already banked and applies to that sitting**: do NOT
price it with a phrase-anchor grep. Measured on the one population where truth
was known (V3B's six stale rows, found by hand), a mechanical not-yet-phrase ERE
matched **three of the six** while producing nearly three times the noise, and one
of the three misses carried no stale-claim word at any point. Two of the three
specimens above would have been invisible to it: neither says *not yet*, and one
of them is wrong only in its TENSE.

**No TAKE rows.** Nothing in this section authorises a deletion, a fold or an
edit, and none is proposed.

### 33d. ✅ THE SITTING RAN (2026-08-24, opus-1177/1178, ruled fable-1528/1529)

**The three specimens above are repaired and they were three of nineteen.** What
made the sitting possible is that the class §33b names has a sub-population with
a GROUND TRUTH in the repository: prose that names a governed flag can be
compared against `scripts/lib/productionFlagPositions.mts`, the declared table
the deploy rite compares to the SERVICE on every push. That is an ENTITY anchor,
not a phrase anchor — *the prose says `off`, the table says `users:1`* is a
comparison; *"not yet" sounds stale* is an impression.

```
491 files under server/ and shared/ carry comment prose · 69,527 comment lines
121 comment lines name a governed flag, across 40 files   <- the sitting
 19 STALE · 24 HOLDS · 78 not-a-claim
```

**The population honestly disqualifies the sitting as §33c wrote it**: 69,527
lines is six times the whole live design-docs population, so *"a hand reading of
`server/` and `shared/` docblock prose"* is a program rather than a sitting. And
**recency is not a filter here** — of 357 files carrying a header docblock
(10,807 lines), 201 were touched in the fortnight before this sitting, which
removes 19% of the lines. The whole `castingV2` tree is hot, which is why its
prose rots AND why git recency cannot find the rot: distance from where work
happens is measured in LINES INSIDE A FILE here, not in commits.

**What the nineteen were, ranked the way they should be**: four carried a SAFETY
ARGUMENT rather than a description — `subjectCards.ts` telling the next seat that
promoting a subject *"changes nothing for anyone but the founder"* when
`CASTING_REPAINT_SCOPE` is `all`; `inkViewReferences.ts` proving a wrong-arm
tattoo unreachable from a premise that had gone false (the conclusion survives on
`MANNEQUIN_ROAD_DEFERRED`, and the repaired docblock now says so); a flag's
docblock claiming the customer *is shown* a crop on a surface that does not
exist; and a live prohibition — *"do not widen this flag on the strength of this
docblock"* — against a widening the founder had already made with his own hand,
which was the **FIFTH** surface of a sentence four other documents had each
corrected before it. One sentence about the repaint scope was found in THREE
files; one about the words road in three more.

**The remainder is named with its price and stays shut**: the 357 header
docblocks (10,807 lines) as its own multi-sitting program, inheriting both
disqualifications above — no phrase anchor, and no git-recency cut.

⚠ **THE FLOOR SENTENCE NOW CARRIES TWO NUMBERS.** On the one population where
truth was known, a phrase anchor matched **3 of 6** and one miss carried no
stale-claim word at all. On this sitting's own population, the entity anchor
found **19 of 24 findings** — the other five were found only because a person
read the prose AROUND the hit, and not one of those five names a flag: a
docblock contradicted by the constant ONE LINE below it, a stale clause four
lines above a true one, a third number for one house-money figure inside one
file, and a stale claim in `CLAUDE.md` about a live spendable road. **A state
claim that never names an entity is invisible to any anchor, and the only
instrument that has ever found one is a reader.** A clean anchored run is a
floor and not coverage.
