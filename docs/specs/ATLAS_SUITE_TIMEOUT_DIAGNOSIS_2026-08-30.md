# #233 — WHY the Atlas suite needs two minutes, measured

**foreman-107, 2026-08-30.** The card (#233) was filed twice — three runs by
foreman-98, two more by foreman-99 — and both filings say the same thing about
themselves: *"Not a diagnosis of why the generation takes two minutes"*, and
*"a timeout raised without asking why the work grew is how a slow instrument
becomes permanent."* This is that diagnosis. **Nothing was shipped.** Every
patch below was applied, measured and restored inside one script whose restore
runs in `finally`; `git diff --exit-code -- scripts/generate-architecture.mts`
was run after each of the four runs and reported clean each time.

## 1. The work did not grow. It is paid 22 times.

`server/architectureAtlas.test.ts`, run alone on an otherwise quiet machine:

```
Test Files  1 passed (1)
     Tests  17 passed (17)
  Duration  118.86s  (tests 118.30s)
```

Per arm, from the verbose reporter:

| arms | cost |
|---|---|
| **10 arms that call `checkArchitecture()`** (one of them calls it twice) | **118.115 s** |
| the other **7** arms | **0.179 s** |

So eleven calls account for **99.85%** of the file, at ~10.7 s each. That figure
is not a mystery either — `checkArchitecture()` calls `buildAtlas()` **twice**,
by design, because step 2 *is* the determinism check ("two builds on an
unchanged tree must be identical"). Timed directly
(`scripts/_shift107-atlas-timing-disposable.mts`, code only, no network):

| | |
|---|---|
| `new Project({ tsConfigFilePath: … })` — ts-morph, cold / second | **4.53 s / 4.10 s** |
| one `buildAtlas()` | **5.43 s / 5.30 s** |
| one `checkArchitecture()` | **10.75 s** = 1.98 × `buildAtlas` |
| **the ts-morph Project's share of one build** | **83%** |

**11 calls × 2 builds = 22 full TypeScript program constructions of the same
unchanged working tree, ~4.2 s of each spent on the compiler alone.** Nothing
injected into `checkArchitecture` reaches `buildAtlas` — the signature is
`buildAtlas()`, argument-free, and the `readFile` / `trackedFiles` doubles the
ten arms inject only affect the *comparison* steps against committed files. So
all 22 builds read identical bytes and produce identical output.

## 2. Why the SECOND suite is a different one each run

`vitest.config.ts` sets **no `testTimeout`** and **no pool limits**. So:

- every suite that does not name its own clock runs on vitest's **5 s default**
  — which is exactly the number every "second subject" in the card failed at
  (`capabilityAtlas`, `queueOrdinalDiscipline`, `phase-a-quota`,
  `r7-evidence-ingestion-contract`), including foreman-99's tell, an arm titled
  *"enforceDailyQuota is an async function"*;
- the fork pool defaults to `availableParallelism`. **This machine reports 20
  CPUs**, so ~19 workers run at once;
- **nine suites shell out** (`execFileSync` / `execSync` / `spawnSync`:
  `architectureAtlas`, `atlasMergeDriver`, `batchB-drive-guards`,
  `preCommitGate`, `prePushGate`, `quietEdition`, `r7-b4-live-consumers`,
  `scriptWorldGuard`, `typecheckGate`), spawning children *on top of* the 19.

`architectureAtlas` burns ~2 CPU-minutes and `typecheckGate` ~111 s more.
Anything scheduled alongside them competes for what is left against a 5-second
clock. **"A different second suite each run" is scheduling, not flakiness** —
it is whichever cheap assertion landed inside the burn. And the Atlas's own
first arm needs only a **5.2× slowdown** to cross its 60 s clock: it measures
11.58 s standalone.

## 3. ⚠ The repair that is 16× faster is the one that kills the control

Four runs of the real suite, one variable each, the tree restored and verified
clean between every one. The injected nondeterminism is identical in the three
sabotage rows: one random suffix on the atlas fingerprint, produced by the
collector rather than by the compiler.

| variant | duration | tests | occurrences of `generator is not deterministic` |
|---|---|---|---|
| **today** — a fresh `Project` per build | 118.86 s clean · **122.29 s** sabotaged | 17/17 clean · 3 failed sabotaged | **6** — the baseline positive control |
| **one shared `Project`**, collectors still run twice | **18.77 s** clean · 18.67 s sabotaged | **17/17 clean** · 3 failed sabotaged | **6** — identical to baseline |
| **memoised ATLAS** — the tempting one | 7.32 s sabotaged | 3 failed | **0 — SILENT** |

⚠ **AND THE THREE SABOTAGE ROWS FAIL THE SAME THREE ARMS BY NAME.** Read at
the pass/fail line alone — `3 failed | 14 passed`, same three titles — the
disarmed variant is **indistinguishable** from the two working ones. The
difference is only visible inside the problems string, where the determinism
complaint appears six times in two variants and **not once** in the third.

**And the red the memoised variant did show is not the determinism check
working.** My injected nondeterminism also broke the fingerprint's schema
pattern and its freshness, and those are what refused. Step 2 is the only thing
in `checkArchitecture` that asks the determinism question, and with the atlas
memoised it compares one object to itself — so a nondeterminism that did not
happen to also trip schema or freshness would have gone **entirely green**.
That last sentence is read off the code, not measured, and is stated as such.

This is the control that cannot fail: the shape of the velocity-caps suite that
could not go red when its own subject was deleted, and what working law 2
exists to catch. It would have shipped as the bigger win.

**The 83% that is safe to share is the Project, not the atlas**, because the
collectors still run twice over it — which is exactly what row 2 measures.

## 4. What a shared Project would still NOT catch — stated, not measured away

With one Project reused, a nondeterminism arising **inside Project construction
itself** (file-discovery order, say) would no longer be exercised twice. That is
a real narrowing of step 2's reach and it is not covered by any run above. It is
the question whoever ships this owes an answer to; it is not answered here.

## 5. What this does not decide

The card gives the choice to whoever owns the suite's shape. Three options were
on it — a longer timeout, a serial lane, a concurrency cap — and each makes the
two minutes permanent, which is the card's own warning. This adds a fourth,
priced: **remove the redundancy** (118.86 s → 18.77 s, 17/17 passing), with the
trap in §3 and the limit in §4 attached to it.

It was NOT shipped. `scripts/generate-architecture.mts` is on the merge-gating
path for every PR, and the gate's Fable review arm has been down for ~30 hours
(#219). The team's standing rule through that outage is that measurements,
tooling and written records may ship while a product change waits.

## 6. Artifacts

- `scripts/_shift107-atlas-timing-disposable.mts` — the component timings (§1).
- `scripts/_shift107-shared-project-probe-disposable.mts` — patch / run /
  **restore in `finally`**; four modes (`shared`, `sabotage`, `atlas-memo`,
  `baseline-sabotage`). Refuses to patch if its anchor text has moved, and
  throws if the restore does not verify.
- `output/_shift107-*.log` — the four full verbose runs.
