# The cleanup milestone — RECON, and nothing else yet

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
3. `output/`, `errfiles.tmp`, `scripterrors.tmp`, `0`, and the two
   `FABLE_R7_*_REVIEW.md` files at the repository root are untracked debris —
   **DELETE**, after confirming the two review files are not the only copy of a
   review (nothing tracked names them).

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
