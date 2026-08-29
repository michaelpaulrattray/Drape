# #233 — the repair, and the control it had to buy first

**foreman-108, 2026-08-30.** foreman-107 measured this the night before and
shipped nothing, for a reason it wrote down: *"a change to the instrument that
guards every change is the exact thing a second reader exists for — and §3 is
the proof of that, not a rhetorical point: the version I would have reached for
first is the one that breaks it, and it breaks it invisibly."*

This is that change, with the two conditions its own diagnosis attached to it
discharged rather than deferred. The diagnosis is
`ATLAS_SUITE_TIMEOUT_DIAGNOSIS_2026-08-30.md`; nothing in it is re-derived here.

## 1. What shipped

| | before | after |
|---|---|---|
| `server/architectureAtlas.test.ts` alone | **118.86 s**, 17 arms | **29.45 s**, 20 arms |
| the full suite (`npx vitest run`) | — | **82.78 s**, 655 files, 10,307 passing |
| ts-morph `Project` constructions in that file | **22** | **3** |

`buildAtlas()` reuses one ts-morph `Project` per process. The collectors still
run twice inside `checkArchitecture()`, because that second run *is* step 2's
determinism check — which is exactly the line between this repair and the
faster one that must not be taken.

**4.0×, not the 6.3× the diagnosis priced.** The difference is the third arm
below, which deliberately buys back two independent constructions (10.81 s
measured) to keep the coverage the cache would otherwise have dropped. The
diagnosis's 18.77 s row is the shape of this change *without* that arm; the
extra ~10.7 s is the price of §4 staying answered instead of open.

## 2. ⚠ The condition that had to be discharged FIRST: step 2 had never been driven

Every arm in that file handed `checkArchitecture` the **real** generator, which
is deterministic. So all seventeen of them agreed that two identical builds are
identical, and **not one of them could have noticed the comparison being
deleted.** That is working law 2 on the checker that gates every merge.

It is not hypothetical, and the diagnosis is what made it urgent: the tempting
version of this repair memoises the ATLAS, which compares one object to itself
and disarms step 2 while `3 failed | 14 passed` reads *identically* to the
working version.

So `checkArchitecture` gained one seam — an injectable `build`, defaulting to
`buildAtlas`, called once per build — and the suite gained a positive control
and its negative control. The positive control asserts **the mechanism** (the
builder is called twice) and **the reason** (the determinism complaint by
name), never the colour: the fixture also fails schema and freshness, so
`ok === false` would have passed on a disarmed check.

### The control was proven able to fail, on both disarming shapes

`scripts/_shift108-disarm-probe-disposable.mts` — patch, run, **restore in
`finally`**, refuse if the anchor has moved, throw if the restore does not
verify. Run twice, restored and verified byte-for-byte both times.

| sabotage | arms red | the assertion that caught it |
|---|---|---|
| **A — memoise** (`const second = atlas`, the §3 variant) | **2** | `checkArchitecture must build TWICE — expected 1 to be 2` |
| **B — delete step 2's complaint entirely** | **1** | `expected 'schema: /meta/schemaVersion…' to contain 'generator is not deterministic'` |

⚠ **AND THE READING THAT MATTERS IS THE OTHER COLUMN: under sabotage A, ALL
EIGHTEEN PRE-EXISTING ARMS STAYED GREEN.** The disarm was invisible to the
entire suite until tonight — that is the measurement, not the inference.

Sabotage B reddens **exactly one** arm, which is the independence the repo asks
of bench arms: the negative control correctly stays green there, because the
builder really is still called twice and its job is only to prove the positive
control does not fire unconditionally.

## 3. §4 — the open question, answered rather than measured away

The diagnosis stated the cost honestly and left it open: with one Project
reused, a nondeterminism arising **inside Project construction** is no longer
exercised by step 2's second build.

Two things close it.

**First, the narrowing is smaller than it looks, and this is read off the code
rather than hoped for.** The file scan `allFiles` was **already** a module-level
constant, computed once at import and explicitly `.sort()`ed
(`generate-architecture.mts`). No build has ever re-discovered the tree, so
"file-discovery order" — the diagnosis's own example — was never re-exercised by
the second build even before this change. What remains is ts-morph's own
resolution through `tsConfigFilePath`.

**Second, that remainder is now driven directly.** A dedicated arm builds two
atlases from two **independently constructed** Projects (`{ freshProject: true }`)
and compares them, with a population control first so an empty husk cannot
satisfy the equality. It costs 10.81 s — the price of exactly **one** of the
eleven `checkArchitecture()` calls this file used to make. **The reach is
unchanged; it is paid once per suite run instead of eleven times.**

## 4. Verification

- `npx vitest run server/architectureAtlas.test.ts` — **20/20, 29.45 s**
- `npx vitest run` (full) — **655 files, 10,307 passing, 82.78 s**, one failure
  that is not this change: see §5
- `pnpm check` — exit 0 (uncalled-export sweep OPEN, every symbol dispositioned)
- `pnpm architecture:check` — exit 0, fresh / schema-valid / deterministic /
  secret-free
- `pnpm capability:check` — exit 0, 58 doors, 62 corpus rows, 0 errors
- `pnpm architecture:generate` — regenerated and committed with the change; the
  diff is **one line, the fingerprint**, so the map's content did not move

## 5. ⚠ A finding that is not mine and is not on CI

The full suite's single failure is `server/scriptExitDiscipline.test.ts`, and it
names **six untracked disposable scripts left by foreman-106 and foreman-107**
(`_briefing-e113`, `_briefing-e114`, `_shift106-contact`,
`_shift106-departure-population`, `_shift107-atlas-timing`,
`_shift107-shared-project-probe`) whose last top-level statement is not
`process.exit(0)`. Two of them are marked **keep** in foreman-107's handoff.

They are untracked, so **CI never sees them** and no gate is affected. What is
affected is every shift's own reading: that guard's population includes
untracked files, so a shift that leaves a keeper disposable makes the *next*
shift's full-suite run red. Two shifts running have now done it, and neither saw
it, because both verified with narrower runs (foreman-107 ran `server/crew/`).

Mine was fixed the moment it appeared. The other six are Janitor material
(clock ~2026-09-01) and are **not swept here** — the anti-boredom rule.

## 6. Money

**Nothing.** No credits, no renders, no segmenter, text or vision calls. Code
reading, our own suite, and two sabotage runs of it.
