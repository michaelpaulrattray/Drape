# Warden instrument: semgrep (static security shapes)

`pnpm warden:semgrep` — the Warden's mechanical reader for known-bad code
shapes (issue #33): SQL string building, tainted `eval`/`new Function`, raw
response writes, open redirects, weak crypto, prototype-pollution and path
shapes, as the OSS Semgrep registry rulesets `p/nodejs`, `p/expressjs`,
`p/typescript` and `p/javascript` define them (76 rules at 1.174.0). It is a
COMPLEMENT to the Fable review on every PR, never a replacement: it sees
shapes, not intent. `--error` makes findings exit 1, so it can stand in the
gate.

**Installing it**: semgrep is a Python tool, not an npm dependency.
`python -m venv ~/.semgrep-venv && ~/.semgrep-venv/Scripts/pip install
semgrep==1.174.0`, then put `~/.semgrep-venv/Scripts` on `PATH` for the
`pnpm` call. It runs natively on this Windows machine (proven 2026-08-26).
**In the gate since Warden patrol #1 (2026-08-26)**: `gate.yml`'s "Static
shapes (semgrep, OSS rulesets)" step installs the same pinned version with
pipx and runs `pnpm warden:semgrep` — the rulesets and flags live in
`package.json` alone, so the step and a hand reading cannot drift. The version
pin is in two places by necessity (a Python tool has no line in
`pnpm-lock.yaml`): the workflow step and the sentence above; move both
together. The step landed on #89's SHA-pinned shape as promised, and its
positive control in CI is recorded in `docs/WARDEN_LOG.md` run 1.

## What it reads

Everything git tracks except what `.semgrepignore` names — and that file
REPLACES semgrep's default ignore list, so the whole exclusion set is stated
there: `node_modules/`, `dist/`, `output/`, `.playwright-mcp/`, `docs/`,
`drizzle/`, `patches/` and `scripts/**/*-disposable.*` (litter by definition,
issue #8). **Tests are read on purpose**: a test that plants a dangerous
shape as a fixture says so with `// nosemgrep: <rule-id> -- <reason>`.

A suppression is never bare. The house form is
`// nosemgrep: <full.rule.id> -- <why this site is not the thing the rule
fears>`; a `nosemgrep` without a rule id and a reason is a finding about the
suppression.

## Controls taken 2026-08-26 on the committed config (working law 2)

- **Positive** — a planted `server/_semgrepPlant.ts` holding
  `exec(req.query.cmd)` and `res.send(eval(req.query.code))` was reported
  (`code-string-concat` ERROR, `direct-response-write` WARNING; exit 1).
  Removed, the reading returned to 0 findings / exit 0 exactly.
- **Ignore scope** — the identical plant at
  `scripts/_semgrep-plant-disposable.ts` produced NO finding while the
  `server/` copy did, so the ignore file is scoped as written and does not
  swallow product code.
- **Ceiling found by the positive control, stated rather than hidden**: the
  tainted `exec(req.query.cmd)` line was NOT reported by these 76 rules. The
  OSS rulesets caught the `eval` and the raw write on the same plant and
  missed the command injection one line above them. Command execution from a
  request is therefore NOT something this reader proves absent; the Fable
  review and the Express-surface tests remain the control for that class.

## Ceilings (stated, not silent)

- **JSX text with a bare `&`** (`Drag & drop`, `Terms & Conditions`) trips
  semgrep's TypeScript parser into partial parsing: four client files
  (`CastProfilePanel.tsx`, `ModelUploadZone.tsx`, `RackPanel.tsx`,
  `Login.tsx`) parse at ~99.9% and the lines after the `&` in that element
  are not read. A finding there is invisible to this reader.
- Eight files over 1.0 MB are skipped by semgrep's default size cap.
- `p/react` added no rules over the four sets above without a registry login
  (the run reports the same 76 either way); the reader is unauthenticated on
  purpose so the reading is reproducible from a clean machine.
- Registry rulesets are fetched by name and can change between runs. The
  reading records the semgrep VERSION; if a run's rule count moves from 76,
  the diff is the registry's, not the tree's, and the readings table says so.

## Readings (the Warden appends one line per run; findings become cards)

| date | semgrep | rules | targets | findings | note |
|---|---|---|---|---|---|
| 2026-08-26 | 1.174.0 | 76 | 1604 | 4 → 0 | First reading at `833175a3`: four `direct-response-write` WARNINGs, all in `server/heroProxy.ts`, one class — image bytes from our own bucket under an allowlisted key sent as the body. Read as false positives for XSS and annotated with the rule id and reason at each site. Opening the file for the annotation found the allowlist was a bare object index: `/api/hero/constructor` passed the unknown-asset door with `Object`'s constructor as a key. Fixed with `Object.hasOwn` and pinned by `server/heroProxy.test.ts`; the other two request-keyed lookups (`crewEyeFrames.ts`, `evidenceDelivery.ts`) were swept and already closed (law 7). Client: 0 findings. |
| 2026-08-26 | 1.174.0 | 76 | 1607 | 0 | Warden patrol #1 at `fcfee27e` (08:20): clean, exit 0 — the findings baseline. New ceiling: the `react-unsanitized-method` rule TIMED OUT on `server/castingV2/refineService.test.ts` (semgrep default per-rule timeout), so that one file is unread by that one rule; every other rule read it. Skipped: 8 files over 1.0 MB, 1213 by `.semgrepignore`. The step is in `gate.yml` from this run on. |
