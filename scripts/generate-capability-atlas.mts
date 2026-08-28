/**
 * THE STUDIO CAPABILITY CENSUS — the generator and the check.
 *
 *   pnpm capability:generate            static half only; keeps the committed drive
 *   pnpm capability:generate --drive    drives the corpus through the REAL entrance
 *                                       (text calls on OpenRouter, cents; dev only)
 *   pnpm capability:check               static half must match the committed file;
 *                                       error-severity findings fail
 *   pnpm capability:check --drive       …and a fresh drive must match the committed
 *                                       observations (changed rows re-driven twice,
 *                                       majority rules, so one flaky read is not a
 *                                       route change)
 *
 * What the drive IS: `refineCandidate` with `admit: () => false` — every pre-claim
 * door, the real interpreter, nothing charged. What it is NOT: a render. The
 * fixture's ledger is read before and after and a moved ledger is an
 * error-severity finding, because the one thing a census must never do is spend.
 *
 * THE DRIVE NEVER RUNS UNLESS `--drive` IS PASSED. A script whose default path
 * spends house money must not spend when invoked to be looked at
 * (memory law: spending-script-never-inspected). `--help` prints and exits.
 */
import "dotenv/config";

import fs from "node:fs";

import {
  buildStaticAtlas, driveRow, drivenFindings, readCommittedAtlas, writeAtlas, declaredFlags,
  renderCapabilityPage,
  CAPABILITY_SCHEMA_VERSION, CAPABILITY_JSON, CAPABILITY_MD,
  type CapabilityAtlas, type DrivenAtlas, type Observation,
} from "./lib/capabilityAtlas.mts";
import { CORPUS } from "./capability-atlas-corpus.mts";

const args = new Set(process.argv.slice(2));
const WANT_DRIVE = args.has("--drive");
const WANT_CHECK = args.has("--check");
const WANT_HELP = args.has("--help") || args.has("-h");
/**
 * `--state=<s>` — diagnostic runs drive ONLY that state's rows and NEVER write
 * the committed table (a partial run written whole would delete every other
 * row's observation — the truncated-inventory class). Exists for cheap
 * sabotage proofs of the harness itself.
 */
const ONLY_STATE = [...args].map((a) => /^--state=(.+)$/.exec(a)?.[1]).find(Boolean) ?? null;

const usage = () => {
  console.log("capability census — --drive to put the corpus through the real entrance (dev only, text calls), --check to verify, --help for this.");
};

/**
 * The flag configuration the drive runs under — ONE named profile, recorded in
 * the output so every observation says what doors were open when it was made.
 * The shipped parents are `all` (production's own values, read 2026-08-21); the
 * feature doors are opened for the fixture alone, the way the founder's account
 * is opened; the three that need a table or a worker stay off.
 */
const profileFor = (userId: number): Record<string, string> => {
  const flags: Record<string, string> = {};
  for (const flag of declaredFlags()) {
    if (["CASTING_V2_SCOPE", "CASTING_REPAINT_SCOPE", "CASTING_REFERENCE_LIBRARY_SCOPE"].includes(flag)) flags[flag] = "all";
    else if (["CASTING_SEGMENTS_SCOPE", "CASTING_SEGMENTS_DELIVERED_SCOPE", "CASTING_SCAN_TABLE_SCOPE", "CASTING_REFINE_DISPATCH_SCOPE"].includes(flag)) flags[flag] = "off";
    else flags[flag] = `users:${userId}`;
  }
  return flags;
};

async function drive(committed: CapabilityAtlas | null): Promise<DrivenAtlas> {
  if (process.env.MYSQL_PUBLIC_URL || process.env.RAILWAY_ENVIRONMENT_NAME) {
    throw new Error("the census drives DEV only — it writes a fixture account and the product's own free-refusal audit rows");
  }
  const { assertOneWorld } = await import("./lib/worldGuard.mts");
  assertOneWorld(["DATABASE_URL"]);
  const { ensureOutsider } = await import("./lib/outsider.mts");
  const { openDatabase } = await import("./lib/dbConnection.mts");

  /*
    THE ACCOUNT is the outsider's; THE CAST is the census's own pristine clone.
    The outsider's standing cast is whatever the last court left — on the first
    run it wore two paid tattoos, and every "master" row measured a branch
    (`censusFixture.mts` has the story). A contaminated fixture refuses to drive.
  */
  const account = await ensureOutsider();
  const { ensureCensusFixture } = await import("./lib/censusFixture.mts");
  const fixture = { id: account.id, openId: account.openId, candidatePublicId: (await ensureCensusFixture({ userId: account.id })).candidatePublicId };
  const flags = profileFor(fixture.id);
  for (const [key, value] of Object.entries(flags)) process.env[key] = value;

  /* Imported AFTER the flags are set, so any module-level read sees the profile. */
  const { refineCandidate } = await import("../server/castingV2/refineService");
  const { interpretRefinement } = await import("../server/castingV2/refineInterpreter");

  const connection = await openDatabase(process.env.DATABASE_URL!);
  const ledger = async (): Promise<number> => {
    const [rows] = await connection.query<Array<{ rowCount: number }>>(
      "SELECT COUNT(*) AS rowCount FROM point_transactions WHERE userId = ?", [fixture.id],
    );
    return Number(rows[0]!.rowCount);
  };
  const before = await ledger();

  /*
    STATE → CAST. "master" drives the pristine clone; the two branch states
    drive their own fixtures (the REAL ink branch pinned to its court variant,
    the manufactured accessory branch), and their selections are RESTORED after
    the run so no other court inherits the census's pin. "reference-attached"
    stays not-driven until the attach door has its own harness.
  */
  const { ensureInkBranchFixture, ensureAccessoryBranchFixture, ensureDanglingCropFixture, restoreSelection } = await import("./lib/censusStateFixtures.mts");
  const inkBranch = await ensureInkBranchFixture({ userId: fixture.id }).catch((error) => { console.error(`[census] ink branch unavailable: ${error instanceof Error ? error.message : error}`); return null; });
  const accessoryBranch = await ensureAccessoryBranchFixture({ userId: fixture.id }).catch((error) => { console.error(`[census] accessory branch unavailable: ${error instanceof Error ? error.message : error}`); return null; });
  const danglingBranch = await ensureDanglingCropFixture({ userId: fixture.id }).catch((error) => { console.error(`[census] dangling-crop branch unavailable: ${error instanceof Error ? error.message : error}`); return null; });
  const castFor = (state: string): string | null => {
    if (state === "master") return fixture.candidatePublicId;
    if (state === "branch-with-ink") return inkBranch?.candidatePublicId ?? null;
    if (state === "branch-with-accessory") return accessoryBranch?.candidatePublicId ?? null;
    if (state === "branch-with-dangling-crop") return danglingBranch?.candidatePublicId ?? null;
    return null;
  };

  const observations: Observation[] = [];
  const notDriven: DrivenAtlas["notDriven"] = [];
  const priorById = new Map((committed?.driven?.observations ?? []).map((o) => [o.id, o]));
  /*
    A FREE ANSWER IS A WRITE (opus-972, overturning fable-1321 §2). The
    navigate moves the cast's selection, so a state pinned once per run is the
    previous row's side effect from the first state-moving answer onward — the
    census measured a bare master and filed a false "live defect". So: the
    declared state is RE-ESTABLISHED AND RE-ASSERTED in front of EVERY row
    that declares one. Proven by sabotage before it was claimed: with this
    re-pin, `ink.remove.branch.whole` observes `would-render`; with it
    removed, the row flips back to `refused:removal_absent`.
  */
  const repin = async (state: string): Promise<void> => {
    if (state === "branch-with-ink" && inkBranch) await ensureInkBranchFixture({ userId: fixture.id });
    if (state === "branch-with-accessory" && accessoryBranch) await ensureAccessoryBranchFixture({ userId: fixture.id });
    if (state === "branch-with-dangling-crop" && danglingBranch) await ensureDanglingCropFixture({ userId: fixture.id });
  };
  try {
  for (const row of CORPUS) {
    if (ONLY_STATE && row.state !== ONLY_STATE) continue;
    const cast = castFor(row.state);
    if (!cast) { notDriven.push({ id: row.id, state: row.state }); continue; }
    await repin(row.state);
    let observation = await driveRow({ row, userId: fixture.id, candidatePublicId: cast, refine: refineCandidate, interpret: interpretRefinement });
    /*
      A ROUTE THAT MOVED GETS ASKED AGAIN, because the interpreter is the one
      unstable participant (memory: the model's read is the unstable thing). Two
      more drives; the majority is the observation, and a 1-1-1 split is
      recorded as the FIRST read with the split named in `said`.
    */
    const prior = priorById.get(row.id);
    if (WANT_CHECK && prior && prior.observed !== observation.observed) {
      const reads = [observation];
      for (let n = 0; n < 2; n += 1) {
        /* Re-pin AND the row's own cast — the first cut re-drove every row
           against the master, which would have re-judged a branch row on the
           wrong face (found while landing the repin, 2026-08-22). */
        await repin(row.state);
        reads.push(await driveRow({ row, userId: fixture.id, candidatePublicId: cast, refine: refineCandidate, interpret: interpretRefinement }));
      }
      const tally = new Map<string, number>();
      for (const read of reads) tally.set(read.observed, (tally.get(read.observed) ?? 0) + 1);
      const [winner, votes] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]!;
      const chosen = reads.find((read) => read.observed === winner)!;
      observation = votes >= 2
        ? chosen
        : { ...observation, said: `${observation.said ?? ""} [split 1-1-1: ${reads.map((r) => r.observed).join(" / ")}]`.trim() };
    }
    observations.push(observation);
    console.log(`${observation.observed.padEnd(34)} ${String(observation.ms).padStart(6)}ms  ${row.id}  ${row.expect === observation.observed ? "" : `(believed ${row.expect})`}`);
  }
  } finally {
    /* No other court inherits the census's pin. */
    if (inkBranch) await restoreSelection(inkBranch).catch((error) => console.error("[census] ink-branch selection restore FAILED", error));
    if (accessoryBranch) await restoreSelection(accessoryBranch).catch((error) => console.error("[census] accessory selection restore FAILED", error));
    if (danglingBranch) await restoreSelection(danglingBranch).catch((error) => console.error("[census] dangling-crop selection restore FAILED", error));
  }
  const after = await ledger();
  await connection.end();
  return {
    profile: { name: "fixture-as-founder", flags, fixture: `${fixture.openId} / ${fixture.candidatePublicId}` },
    observations,
    notDriven,
    ledger: { before, after },
  };
}

async function main(): Promise<number> {
  if (WANT_HELP) { usage(); return 0; }
  const committed = readCommittedAtlas();
  const staticAtlas = buildStaticAtlas(CORPUS);
  const driven = WANT_DRIVE ? await drive(committed) : (committed?.driven ?? null);
  const findings = [
    ...staticAtlas.findings,
    ...(driven ? drivenFindings({ staticAtlas, driven, corpus: CORPUS, committed: WANT_DRIVE ? committed : null }) : []),
  ].sort((a, b) => a.id.localeCompare(b.id));
  const atlas: CapabilityAtlas = { schemaVersion: CAPABILITY_SCHEMA_VERSION, static: staticAtlas, driven, findings };

  const errors = findings.filter((f) => f.severity === "error");
  if (WANT_CHECK) {
    const problems: string[] = [];
    if (!committed) problems.push(`no committed census at ${CAPABILITY_JSON} — run pnpm capability:generate`);
    else {
      if (JSON.stringify(committed.static) !== JSON.stringify(atlas.static)) problems.push("the STATIC half is stale — the source declares something the committed census does not know; regenerate");
      /*
        ⚠ THE PAGE IS GENERATED TOO, AND NOTHING HAS EVER COMPARED IT (#195's
        sweep). `writeAtlas` writes two files — the JSON and
        `capability-atlas.md` — and this check read one, so a hand-edited or
        stale committed PAGE shipped green. It is the same class the
        architecture check's step 4 was fixed for with the sign flipped:
        "stale" is a finding exactly where a reviewable committed copy exists,
        and this file is tracked (`.gitattributes` names it `merge=atlas`,
        pinned by `server/atlasMergeDriver.test.ts`) — unlike the architecture
        explorer, which is gitignored and therefore says nothing.

        Compared on CONTENT, not on the bytes git left on disk: the generator
        writes LF and a Windows checkout hands it back with CRLF, which is the
        same trap `check-architecture.mts`'s `sameContent` exists for.
      */
      const lfOnly = (text: string): string => text.split("\r\n").join("\n");
      if (!fs.existsSync(CAPABILITY_MD)) problems.push(`no committed page at ${CAPABILITY_MD} — run pnpm capability:generate`);
      else if (lfOnly(fs.readFileSync(CAPABILITY_MD, "utf8")) !== lfOnly(renderCapabilityPage(atlas))) {
        problems.push("the PAGE is stale or hand-edited — docs/architecture/capability-atlas.md does not match a fresh render; regenerate and review the diff");
      }
      if (WANT_DRIVE && JSON.stringify(committed.driven?.observations.map((o) => [o.id, o.observed])) !== JSON.stringify(driven?.observations.map((o) => [o.id, o.observed]))) {
        problems.push("the DRIVEN half moved — see the route-changed findings");
      }
    }
    for (const f of errors) problems.push(`${f.kind} ${f.subject}: ${f.message}`);
    console.log(problems.length === 0
      ? `[capability:check] OK — ${staticAtlas.declared.length} declared doors, ${staticAtlas.corpus.length} corpus rows, ${findings.length} findings (${errors.length} error)`
      : `[capability:check] FAILED\n - ${problems.join("\n - ")}`);
    return problems.length === 0 ? 0 : 1;
  }

  if (ONLY_STATE) {
    /* THE DOCBLOCK'S PROMISE, IMPLEMENTED — the first cut promised "never
       writes" in prose and wrote anyway; the sabotage run clobbered the
       committed 54-row table with its 5 rows before this guard existed
       (2026-08-22). A partial drive is a diagnostic, never the record. */
    console.log(`[capability] --state=${ONLY_STATE}: diagnostic run, ${driven?.observations.length ?? 0} rows driven, NOTHING WRITTEN`);
    return errors.length === 0 ? 0 : 1;
  }
  writeAtlas(atlas);
  console.log(`[capability] wrote ${CAPABILITY_JSON} — ${staticAtlas.declared.length} declared doors, ${staticAtlas.corpus.length} corpus rows (${driven ? `${driven.observations.length} driven, ${driven.notDriven.length} not driven` : "no drive"}), ${findings.length} findings (${errors.length} error)`);
  for (const f of findings.filter((x) => x.severity !== "info")) console.log(`  ${f.severity.padEnd(5)} ${f.kind.padEnd(16)} ${f.subject} — ${f.message}`);
  return errors.length === 0 ? 0 : 1;
}

main().then((code) => process.exit(code), (error) => { console.error(error); process.exit(1); });
