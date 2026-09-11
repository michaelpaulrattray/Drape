/**
 * DISPOSABLE — the sabotage receipt for #697's repair of
 * `server/adminUserManagement.test.ts`.
 *
 * #697's bar, verbatim: *"whatever is rewritten is proven by a SABOTAGE OF THE
 * PRODUCT, not by reading."* Same shape as `_697-accountfreeze-sabotage-
 * disposable.mts`: each entry patches the real router, runs the suite, records
 * which arms went red BY FULL NAME, and RESTORES THE FILE in a `finally`.
 *
 * Controls:
 *   · ARM 0 is a NO-OP sabotage. It must redden NOTHING.
 *   · Every arm asserts the reddened set EXACTLY, not "at least".
 *   · `--before` swaps in the PRE-REPAIR suite from `origin/main` and asserts
 *     the `before` sets — the negative control, driven not predicted. The
 *     claim under test is that the fifteen deleted arms reddened on NONE of
 *     these (their subject was the mock), while the adjustCredits describe at
 *     the foot — untouched by this repair — keeps catching what it always did.
 *
 * Run: npx tsx scripts/_697-adminusermgmt-sabotage-disposable.mts [--before]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SUITE = "server/adminUserManagement.test.ts";
const OUT = path.join(ROOT, "output", "_697-adminusermgmt-sabotage-result.json");
const BEFORE = process.argv.includes("--before");

const ROUTER = "server/routes/admin/users.ts";

const R = "the admin READS — driven, not recited (#697)";
const LU = `${R} admin.listUsers — the filters reach the helper`;
const ST = `${R} admin.getUserStats — the dashboard numbers`;
const AC = `${R} admin.getUserActivity — one account's audit rows`;
const CR = "admin.adjustCredits — DRIVEN";

type Edit = { find: string; replace: string };
type Sabotage = { name: string; file: string; find: string; replace: string; also?: Edit[]; expect: string[]; before: string[] };

const SABOTAGES: Sabotage[] = [
  {
    name: "ARM 0 — NO-OP CONTROL (a comment only; must redden nothing)",
    file: ROUTER,
    find: "  listUsers: adminProcedure",
    replace: "  listUsers: adminProcedure // sabotage no-op",
    expect: [],
    before: [],
  },
  {
    name: "listUsers: the STATUS filter an admin picks is dropped on the floor",
    file: ROUTER,
    find: 'status: input?.status || "all",',
    replace: 'status: "all",',
    expect: [`${LU} every filter an admin types is passed through by name — search, status, role, sort, page`],
    before: [],
  },
  {
    name: "listUsers: the sort direction default flips to ascending",
    file: ROUTER,
    find: 'sortOrder: input?.sortOrder || "desc",',
    replace: 'sortOrder: input?.sortOrder || "asc",',
    expect: [`${LU} with NO input, the declared defaults reach the helper (20 / 0 / all / all / createdAt desc)`],
    before: [],
  },
  {
    name: "listUsers: the page-size ceiling goes (100 → 10,000)",
    file: ROUTER,
    find: "limit: z.number().min(1).max(100).optional().default(20),\n      offset: z.number().min(0).optional().default(0),\n      search:",
    replace: "limit: z.number().min(1).max(10000).optional().default(20),\n      offset: z.number().min(0).optional().default(0),\n      search:",
    expect: [`${LU} the page size is bounded 1..100 and a status or role outside the declared set is refused — before the helper`],
    before: [],
  },
  {
    name: "listUsers: the total is invented (the pager reads the page length, not the database)",
    file: ROUTER,
    find: "        total: result.total,\n      };\n    }),\n\n  // Get user statistics for dashboard",
    replace: "        total: result.users.length,\n      };\n    }),\n\n  // Get user statistics for dashboard",
    expect: [`${LU} the helper's TOTAL rides through untouched — the pager's number is the database's`],
    before: [],
  },
  {
    name: "getUserStats: opens to MODERATORS",
    file: ROUTER,
    find: "  getUserStats: adminProcedure",
    replace: "  getUserStats: moderatorProcedure",
    // The router does not import the moderator gate today — without this second
    // edit the file fails to compile and EVERY arm reddens, which is not the claim.
    also: [{ find: 'import { adminProcedure, router } from "../../_core/trpc";', replace: 'import { adminProcedure, moderatorProcedure, router } from "../../_core/trpc";' }],
    expect: [`${ST} a MODERATOR is refused — adminProcedure, driven`],
    before: [],
  },
  {
    name: "getUserActivity: the user scope is dropped — every account's rows come back",
    file: ROUTER,
    find: "      return await getFilteredAuditLogs({\n        userId: input.userId,",
    replace: "      return await getFilteredAuditLogs({\n        userId: undefined,",
    expect: [
      `${AC} scopes the audit read to the named user, with the declared defaults (50 / 0)`,
      `${AC} passes a typed page through, and refuses one outside 1..100 before the read`,
    ],
    before: [],
  },
  {
    name: "getUserActivity: the default page shrinks to 10",
    file: ROUTER,
    find: "limit: z.number().min(1).max(100).optional().default(50),",
    replace: "limit: z.number().min(1).max(100).optional().default(10),",
    expect: [`${AC} scopes the audit read to the named user, with the declared defaults (50 / 0)`],
    before: [],
  },
  {
    // The untouched describe at the foot — proves the driver reads the whole file
    // and that the money arms catch what they always caught, before and after.
    name: "CONTROL — adjustCredits: the not-found refusal goes (must redden the SAME arm before and after)",
    file: ROUTER,
    find: '      if (!targetUser) {\n        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });\n      }\n\n      const result = await adjustUserCredits(',
    replace: '      if (false) {\n        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });\n      }\n\n      const result = await adjustUserCredits(',
    expect: [`${CR} refuses a target that does not exist, and moves nothing`],
    before: [`${CR} refuses a target that does not exist, and moves nothing`],
  },
];

function runSuite(): { failed: string[]; total: number } {
  if (existsSync(OUT)) rmSync(OUT);
  try {
    execFileSync("npx", ["vitest", "run", SUITE, "--reporter=json", `--outputFile=${OUT}`], { cwd: ROOT, stdio: "pipe", shell: true });
  } catch {
    /* a red suite exits non-zero — the JSON is what we read */
  }
  if (!existsSync(OUT)) throw new Error("vitest produced no JSON report");
  const report = JSON.parse(readFileSync(OUT, "utf8")) as {
    testResults: { assertionResults: { fullName: string; status: string }[] }[];
  };
  const arms = report.testResults.flatMap((f) => f.assertionResults);
  if (arms.length === 0) throw new Error("the report holds no arms at all");
  return { failed: arms.filter((a) => a.status === "failed").map((a) => a.fullName).sort(), total: arms.length };
}

let EXIT_CODE = 0;

function main(): void {
  const suiteAbs = path.join(ROOT, SUITE);
  const repairedSuite = readFileSync(suiteAbs, "utf8");
  if (BEFORE) {
    const old = execFileSync("git", ["show", `origin/main:${SUITE}`], { cwd: ROOT, encoding: "utf8" });
    writeFileSync(suiteAbs, old, "utf8");
  }
  try {
    console.log(`=== ${BEFORE ? "BEFORE (pre-repair suite from origin/main)" : "AFTER"} — the suite must be GREEN before any sabotage ===`);
    const base = runSuite();
    if (base.failed.length > 0) {
      console.error(`REFUSING — already red:\n  ${base.failed.join("\n  ")}`);
      EXIT_CODE = 1;
      return;
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
          console.log(`X ${s.name}\n    anchor matched ${occurrences} times — NOT DRIVEN`);
          continue;
        }
        let patched = original.replace(s.find, s.replace);
        for (const e of s.also ?? []) {
          if (patched.split(e.find).length - 1 !== 1) throw new Error(`${s.name}: secondary anchor not unique`);
          patched = patched.replace(e.find, e.replace);
        }
        writeFileSync(abs, patched, "utf8");
        const { failed } = runSuite();
        const want = [...(BEFORE ? s.before : s.expect)].sort();
        const same = want.length === failed.length && want.every((w, i) => w === failed[i]);
        if (same) {
          pass += 1;
          console.log(`OK ${s.name}\n    reddened exactly ${failed.length}: ${failed.join(" | ") || "(nothing, as required)"}`);
        } else {
          findings.push(`${s.name}\n      wanted: ${want.join(" | ") || "(nothing)"}\n      got:    ${failed.join(" | ") || "(nothing)"}`);
          console.log(`X ${s.name}\n    wanted: ${want.join(" | ") || "(nothing)"}\n    got:    ${failed.join(" | ") || "(nothing)"}`);
        }
      } finally {
        writeFileSync(abs, original, "utf8");
      }
    }
    console.log(`\n=== ${pass}/${SABOTAGES.length} sabotages behaved exactly as claimed ===`);
    if (findings.length > 0) {
      console.log("\nFINDINGS:");
      for (const f of findings) console.log(`  - ${f}`);
      EXIT_CODE = 1;
    }
  } finally {
    writeFileSync(suiteAbs, repairedSuite, "utf8");
    rmSync(OUT, { force: true });
  }
}

main();
process.exit(EXIT_CODE);
