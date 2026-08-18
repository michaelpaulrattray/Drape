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

**Disposition: RETIRE the island — proposed, not taken.** It is the largest
single deletion the milestone has found (eight symbols, their tests, and a public
type), it touches the module the fidelity law is named for, and §14b's question
has a clean answer for once: *what was this for?* — it was the road before the
mattes. Held for ratification rather than taken on one shift's reading.

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
