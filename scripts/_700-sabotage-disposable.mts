/**
 * DISPOSABLE — the sabotage receipt for #700, the two moderator reads that
 * built their response by spreading a database row, plus the two ADMIN twins
 * the law-7 sweep found.
 *
 * The card's own bar: *"Seed the fixture first, watch it go red, then fix the
 * router."* The seeding-then-red half was driven by hand before the fix landed
 * (2 arms red, 34 green). This drives the standing half: for each sabotage it
 * patches a real PRODUCT file, runs both suites, records which arms went red,
 * and RESTORES THE FILE IN A `finally` — a crash mid-run must never leave a
 * sabotaged product behind (`sabotage-driver-must-restore-in-finally`).
 *
 * Two controls, both of which have caught a lying driver in this repository:
 *   · ARM 0 is a NO-OP sabotage. It must redden NOTHING. Without it, six
 *     crashes read as six reddenings (`sabotage-driver-needs-unsabotaged-arm`).
 *   · Every arm asserts the reddened set EXACTLY, not "at least". A sabotage
 *     that reddens more than it should is a finding about the arm, not a pass.
 *
 * ⚠ THE SABOTAGES THAT MATTER MOST ARE THE TWO `DROP A FIELD` ARMS. Six
 * `not.toContain` checks can only ever catch a leak; they are silent when a
 * projection DROPS something the panel needs. The whole-object assertions are
 * what catch that, and these arms are what prove they do.
 *
 * Run: npx tsx scripts/_700-sabotage-disposable.mts
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SUITES = ["server/moderator.test.ts", "server/adminUserProjection.test.ts"];
const OUT = path.join(ROOT, "_sabotage-700-result.json");

const MOD = "server/routes/moderator.ts";
const ADMIN = "server/routes/admin/users.ts";
const TRPC = "server/_core/trpc.ts";

type Sabotage = {
  name: string;
  file: string;
  find: string;
  replace: string;
  /** Arm titles (exact) expected to go red. Empty = the no-op control. */
  expect: string[];
};

/* Arm titles, written once so a typo is a typo in one place. */
const MOD_LIST = "the projection the ROUTER builds, whole — invariant 8, and the fixture holds the forbidden six so it can fail";
const MOD_FULL = "the user projection the ROUTER builds, whole — invariant 8, forbidden six seeded";
const ADM_LIST = "listUsers hands back the projection the ROUTER builds, whole";
const ADM_FULL = "getUserFullDetails hands back the projection the ROUTER builds, whole";
const ADM_SIX = "the forbidden six are absent from BOTH reads — invariant 8, stated as itself";
const ADM_ANON = "an unauthenticated caller is UNAUTHORIZED, not an empty list";

const SABOTAGES: Sabotage[] = [
  {
    name: "ARM 0 — NO-OP CONTROL (a comment only; must redden nothing)",
    file: MOD,
    find: "export const moderatorRouter = router({",
    replace: "export const moderatorRouter = router({ // sabotage no-op",
    expect: [],
  },

  /* ── The defect itself, restored: a spread of the db row ───────────────── */
  {
    name: "MODERATOR listUsers regresses to a SPREAD of the db row",
    file: MOD,
    find: "        users: result.users.map(user => ({\n          id: user.id,\n          openId: user.openId,",
    replace: "        users: result.users.map(user => ({\n          ...user,\n          openId: user.openId,",
    expect: [MOD_LIST],
  },
  {
    name: "MODERATOR getUserFullDetails regresses to a SPREAD of the db row",
    file: MOD,
    find: "        user: {\n          id: result.user.id,\n          openId: result.user.openId,",
    replace: "        user: {\n          ...result.user,\n          openId: result.user.openId,",
    expect: [MOD_FULL],
  },
  {
    name: "ADMIN listUsers regresses to a SPREAD of the db row",
    file: ADMIN,
    find: "        users: result.users.map(user => ({\n          id: user.id,\n          openId: user.openId,",
    replace: "        users: result.users.map(user => ({\n          ...user,\n          openId: user.openId,",
    expect: [ADM_SIX, ADM_LIST].sort(),
  },
  {
    name: "ADMIN getUserFullDetails regresses to a SPREAD of the db row",
    file: ADMIN,
    find: "        user: {\n          id: result.user.id,\n          openId: result.user.openId,",
    replace: "        user: {\n          ...result.user,\n          openId: result.user.openId,",
    expect: [ADM_SIX, ADM_FULL].sort(),
  },

  /* ── The other direction: a projection that DROPS a real field ─────────── */
  {
    name: "MODERATOR listUsers silently DROPS avatarUrl (the panel loses the face)",
    file: MOD,
    find: "          avatarUrl: user.avatarUrl,\n          role: user.role,\n          suspendedReason: user.suspendedReason,\n          frozenAt: user.frozenAt,",
    replace: "          role: user.role,\n          suspendedReason: user.suspendedReason,\n          frozenAt: user.frozenAt,",
    expect: [MOD_LIST],
  },
  {
    name: "ADMIN getUserFullDetails silently DROPS frozenReason (the why of a freeze)",
    file: ADMIN,
    find: "          frozenReason: result.user.frozenReason,\n          frozenBy: result.user.frozenBy,",
    replace: "          frozenBy: result.user.frozenBy,",
    expect: [ADM_FULL],
  },

  /* ── A date stops being converted — the shape the old arms watched ─────── */
  {
    name: "MODERATOR listUsers stops converting createdAt to ISO (a Date reaches the panel)",
    file: MOD,
    find: "          createdAt: user.createdAt.toISOString(),\n          lastSignedIn: user.lastSignedIn.toISOString(),\n        })),\n        total: result.total,",
    replace: "          createdAt: user.createdAt,\n          lastSignedIn: user.lastSignedIn.toISOString(),\n        })),\n        total: result.total,",
    expect: [
      MOD_LIST,
      "the dates cross the boundary as ISO STRINGS — a Date would reach the panel as something else",
    ].sort(),
  },

  /* ── The wire-type divergence this PR deliberately PRESERVES ───────────────
   * PR #701 review, finding 3. `frozenAt` crosses the moderator wire as a raw
   * Date and the admin wire as an ISO string — same column, same helper, two
   * staff surfaces. Converging them is a wire-type change and is filed
   * separately rather than smuggled into a no-behaviour-change PR. Until the
   * fixtures seeded it NON-NULL these two sabotages reddened NOTHING, because
   * `null` is the one value where raw and ISO are indistinguishable. */
  {
    name: "MODERATOR frozenAt silently converges to ISO (the follow-up landing unannounced)",
    file: MOD,
    /* Anchored on its NEIGHBOURS, not on the line alone: the bare line also
       appears in `getUserDetails`, a third moderator read that passes the same
       column raw. The driver REFUSED the two-match anchor rather than patching
       whichever came first — without that refusal this arm would have
       sabotaged the wrong procedure and read the result as a pass. */
    find: "          suspendedReason: user.suspendedReason,\n          frozenAt: user.frozenAt,",
    replace: "          suspendedReason: user.suspendedReason,\n          frozenAt: user.frozenAt?.toISOString() || null,",
    expect: [MOD_LIST],
  },
  {
    name: "ADMIN frozenAt silently converges to a raw Date (the divergence moving the other way)",
    file: ADMIN,
    find: "          frozenAt: user.frozenAt?.toISOString() || null,",
    replace: "          frozenAt: user.frozenAt,",
    expect: [ADM_LIST],
  },

  /* ── The middleware under the admin reads ──────────────────────────────── */
  {
    name: "adminProcedure stops refusing an unauthenticated caller",
    file: TRPC,
    find: '    // Must be authenticated\n    if (!ctx.user) {\n      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });\n    }\n\n    // Validate admin access (checks both role AND allowlist)',
    replace: '    // Validate admin access (checks both role AND allowlist)',
    expect: [ADM_ANON],
  },
];

function runSuites(): { failed: string[]; total: number } {
  if (existsSync(OUT)) rmSync(OUT);
  try {
    execFileSync(
      "npx",
      ["vitest", "run", ...SUITES, "--reporter=json", `--outputFile=${OUT}`],
      { cwd: ROOT, stdio: "pipe", shell: true },
    );
  } catch {
    /* a red suite exits non-zero — that is the point; the JSON is what we read */
  }
  if (!existsSync(OUT)) throw new Error("vitest produced no JSON report");
  const report = JSON.parse(readFileSync(OUT, "utf8")) as {
    testResults: { assertionResults: { title: string; status: string }[] }[];
  };
  const arms = report.testResults.flatMap(f => f.assertionResults);
  if (arms.length === 0) throw new Error("the report holds no arms at all");
  return {
    failed: arms.filter(a => a.status === "failed").map(a => a.title).sort(),
    total: arms.length,
  };
}

let EXIT_CODE = 0;

function main(): void {
  console.log("=== BASELINE: both suites must be GREEN before any sabotage ===");
  const base = runSuites();
  if (base.failed.length > 0) {
    console.error(`REFUSING — already red:\n  ${base.failed.join("\n  ")}`);
    rmSync(OUT, { force: true });
    process.exit(1);
  }
  console.log(`  ${base.total} arms across ${SUITES.length} suites, 0 red. Proceeding.\n`);

  let pass = 0;
  const findings: string[] = [];

  for (const s of SABOTAGES) {
    const abs = path.join(ROOT, s.file);
    const original = readFileSync(abs, "utf8");
    const occurrences = original.split(s.find).length - 1;
    try {
      if (occurrences !== 1) {
        findings.push(`${s.name}: anchor matched ${occurrences} times in ${s.file}, expected exactly 1`);
        console.log(`✗ ${s.name}\n    anchor matched ${occurrences} times — NOT DRIVEN`);
        continue;
      }
      writeFileSync(abs, original.replace(s.find, s.replace), "utf8");
      const { failed } = runSuites();
      const want = [...s.expect].sort();
      const same = want.length === failed.length && want.every((w, i) => w === failed[i]);
      if (same) {
        pass += 1;
        console.log(`✓ ${s.name}\n    reddened exactly ${failed.length}: ${failed.join(" | ") || "(nothing, as required)"}`);
      } else {
        findings.push(
          `${s.name}\n      wanted: ${want.join(" | ") || "(nothing)"}\n      got:    ${failed.join(" | ") || "(nothing)"}`,
        );
        console.log(`✗ ${s.name}\n    wanted: ${want.join(" | ") || "(nothing)"}\n    got:    ${failed.join(" | ") || "(nothing)"}`);
      }
    } finally {
      writeFileSync(abs, original, "utf8");
    }
  }

  rmSync(OUT, { force: true });
  console.log(`\n=== ${pass}/${SABOTAGES.length} sabotages behaved exactly as claimed ===`);
  if (findings.length > 0) {
    console.log("\nFINDINGS:");
    for (const f of findings) console.log(`  - ${f}`);
    EXIT_CODE = 1;
  }
}

main();
/* PR #701 review, finding 1 - working law 2 pointed at this driver itself.
   An unconditional exit(0) meant a run whose arms MISBEHAVED still read as
   success to any wrapper, CI step or && chain: the instrument could print
   FINDINGS and pass. Only a red BASELINE used to exit non-zero. */
process.exit(EXIT_CODE);
