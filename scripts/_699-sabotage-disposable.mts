/**
 * DISPOSABLE — the sabotage receipt for #699, the moderator panel's
 * client-side role gate.
 *
 * #699's bar, verbatim: *"proven by SABOTAGING the component — flip the gate
 * to admit a plain user and the arm must redden. A guard whose only proof is
 * that it currently passes is the class this card came out of."*
 *
 * For each sabotage it patches a real PRODUCT file, runs the suite, records
 * which arms went red, and RESTORES THE FILE IN A `finally`
 * (`sabotage-driver-must-restore-in-finally`).
 *
 * Two controls, both of which have caught a lying driver in this repository:
 *   · ARM 0 is a NO-OP. It must redden NOTHING — without it, crashes read as
 *     reddenings (`sabotage-driver-needs-unsabotaged-arm`).
 *   · Every arm asserts the reddened set EXACTLY, not "at least".
 *
 * ⚠ THE TWO HALVES ARE SABOTAGED SEPARATELY ON PURPOSE. Extracting a rule to
 * a testable module buys nothing if the component stops calling it, so the
 * predicate sabotages (2-6) and the WIRING sabotages (7-9) must redden
 * different arms. If a wiring sabotage reddened nothing, the extraction would
 * be decoration.
 *
 * Run: npx tsx scripts/_699-sabotage-disposable.mts
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
/* BOTH suites: #699's own arms, and the neighbouring guard whose "gated to
   the roles that may ask it" arm was re-aimed at the shared rule in the same
   commit. Running only the first would put half of a wiring sabotage's real
   effect outside the frame. */
const SUITES = [
  "client/src/features/staff/staffRole.test.ts",
  "client/src/features/staff/counts416-guard.test.ts",
];
const OUT = path.join(ROOT, "_sabotage-699-result.json");

const RULE = "client/src/features/staff/staffRole.ts";
const PAGE = "client/src/pages/ModeratorDashboard.tsx";
const COUNTS = "client/src/features/staff/useModeratorFlagCounts.ts";

type Sabotage = { name: string; file: string; find: string; replace: string; expect: string[] };

const A_ADMIN = "an ADMIN is admitted — the client must not be narrower than the server";
const A_PLAIN = "a PLAIN USER is refused";
const A_UNKNOWN = "a role the product does not have is refused — the list is an allowlist, not a denylist";
const A_LOADING = "a session still LOADING is not refused — the card's own named trap";
const A_SIGNEDOUT = "a SIGNED-OUT visitor is not refused HERE — they belong at /login, not /app";
const A_EXACTLY = "admits exactly the two staff roles and nothing else";
const A_POP = "STAFF_ROLES is the whole population, so the list and the predicate cannot drift";
const A_CALLS = "ModeratorDashboard calls the predicate";
const A_NOINLINE = "ModeratorDashboard states no role comparison of its own";
const A_COUNTS = "useModeratorFlagCounts calls the predicate and states no comparison of its own";
const A_BOTH = "the gate still drives BOTH the redirect and the toast";
const A_GATED = "the query is gated to the roles that may ask it";

const SABOTAGES: Sabotage[] = [
  {
    name: "ARM 0 — NO-OP CONTROL (a comment only; must redden nothing)",
    file: RULE,
    find: 'export const STAFF_ROLES = ["moderator", "admin"] as const;',
    replace: 'export const STAFF_ROLES = ["moderator", "admin"] as const; // sabotage no-op',
    expect: [],
  },

  /* ── The rule itself ───────────────────────────────────────────────────── */
  {
    name: "the client narrows to moderators — an ADMIN is locked out of a panel the server serves them",
    file: RULE,
    find: 'export const STAFF_ROLES = ["moderator", "admin"] as const;',
    replace: 'export const STAFF_ROLES = ["moderator"] as const;',
    expect: [A_ADMIN, A_EXACTLY, A_POP].sort(),
  },
  {
    name: "the gate becomes a DENYLIST — anything that is not `user` is admitted",
    file: RULE,
    find: "  return STAFF_ROLES.includes(role as StaffRole);",
    replace: '  return role !== "user";',
    expect: [A_EXACTLY, A_UNKNOWN].sort(),
  },
  {
    name: "the gate admits EVERYONE — the flip #699 names in its own bar",
    file: RULE,
    find: "  return STAFF_ROLES.includes(role as StaffRole);",
    replace: "  return true;",
    expect: [A_EXACTLY, A_PLAIN, A_UNKNOWN].sort(),
  },
  {
    name: "the `loading` term goes — a moderator is bounced during their own page load",
    file: RULE,
    find: "  return !view.loading && view.isAuthenticated && !isStaffRole(view.role);",
    replace: "  return view.isAuthenticated && !isStaffRole(view.role);",
    expect: [A_LOADING],
  },
  {
    name: "the `isAuthenticated` term goes — a signed-out visitor is sent to /app instead of /login",
    file: RULE,
    find: "  return !view.loading && view.isAuthenticated && !isStaffRole(view.role);",
    replace: "  return !view.loading && !isStaffRole(view.role);",
    expect: [A_SIGNEDOUT],
  },

  /* ── The wiring: the component stops using the rule ────────────────────── */
  {
    name: "WIRING — ModeratorDashboard re-derives the gate inline (the pre-#699 line, restored)",
    file: PAGE,
    find: "  const isUnauthorized = isModeratorPanelUnauthorized({ loading, isAuthenticated, role: user?.role });",
    replace: '  const isUnauthorized = !loading && isAuthenticated && user?.role !== "moderator" && user?.role !== "admin";',
    expect: [A_CALLS, A_NOINLINE].sort(),
  },
  {
    name: "WIRING — useModeratorFlagCounts re-derives its half inline",
    file: COUNTS,
    find: "  const isStaff = isStaffRole(user?.role);",
    replace: '  const isStaff = user?.role === "moderator" || user?.role === "admin";',
    expect: [A_COUNTS, A_GATED].sort(),
  },
  {
    name: "WIRING — the panel keeps the toast but loses the REDIRECT (the guard itself)",
    file: PAGE,
    find: '  if (isUnauthorized) return <Redirect to="/app" />;',
    replace: "  /* redirect removed by sabotage */",
    expect: [A_BOTH],
  },
];

function runSuite(): { failed: string[]; total: number } {
  if (existsSync(OUT)) rmSync(OUT);
  try {
    execFileSync("npx", ["vitest", "run", ...SUITES, "--reporter=json", `--outputFile=${OUT}`], {
      cwd: ROOT,
      stdio: "pipe",
      shell: true,
    });
  } catch {
    /* a red suite exits non-zero — that is the point; the JSON is what we read */
  }
  if (!existsSync(OUT)) throw new Error("vitest produced no JSON report");
  const report = JSON.parse(readFileSync(OUT, "utf8")) as {
    testResults: { assertionResults: { title: string; status: string }[] }[];
  };
  const arms = report.testResults.flatMap(f => f.assertionResults);
  if (arms.length === 0) throw new Error("the report holds no arms at all");
  return { failed: arms.filter(a => a.status === "failed").map(a => a.title).sort(), total: arms.length };
}

function main(): void {
  console.log("=== BASELINE: the suite must be GREEN before any sabotage ===");
  const base = runSuite();
  if (base.failed.length > 0) {
    console.error(`REFUSING — already red:\n  ${base.failed.join("\n  ")}`);
    rmSync(OUT, { force: true });
    process.exit(1);
  }
  console.log(`  ${base.total} arms, 0 red. Proceeding.\n`);

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
      const { failed } = runSuite();
      const want = [...s.expect].sort();
      const same = want.length === failed.length && want.every((w, i) => w === failed[i]);
      if (same) {
        pass += 1;
        console.log(`✓ ${s.name}\n    reddened exactly ${failed.length}: ${failed.join(" | ") || "(nothing, as required)"}`);
      } else {
        findings.push(`${s.name}\n      wanted: ${want.join(" | ") || "(nothing)"}\n      got:    ${failed.join(" | ") || "(nothing)"}`);
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
  }
}

main();
process.exit(0);
