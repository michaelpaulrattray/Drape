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

**Recommendation: the reading list is the 111, not the 175.** The 23 OTHER
entries are a ten-minute pass (most are prose mentions inside comments, or a
same-named local in a disposable script), and the 41 barrel/dynamic entries need
no reading at all.

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
