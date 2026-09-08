/**
 * DISPOSABLE — the sabotage receipt for #697's repair of `server/moderator.test.ts`.
 *
 * #697's bar, verbatim: *"whatever is rewritten is proven by a SABOTAGE OF THE
 * PRODUCT, not by reading."* This drives that bar. For each sabotage it
 * patches a real product file, runs the suite, records which arms went red,
 * and RESTORES THE FILE IN A `finally` — a crash mid-run must never leave a
 * sabotaged product behind (`sabotage-driver-must-restore-in-finally`).
 *
 * Two controls, both of which have caught a lying driver before:
 *   · ARM 0 is a NO-OP sabotage. It must redden NOTHING. Without it, six
 *     crashes read as six reddenings (`sabotage-driver-needs-unsabotaged-arm`).
 *   · Every arm asserts the reddened set EXACTLY, not "at least". A sabotage
 *     that reddens more than it should is a finding about the arm, not a pass.
 *
 * Run: npx tsx scripts/_697-sabotage-disposable.mts
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SUITE = "server/moderator.test.ts";
const OUT = path.join(ROOT, "_sabotage-result.json");

type Sabotage = {
  name: string;
  file: string;
  find: string;
  replace: string;
  /** Arm titles (exact) expected to go red. Empty = the no-op control. */
  expect: string[];
};

const TRPC = "server/_core/trpc.ts";
const ROUTER = "server/routes/moderator.ts";
const SCHEMA = "drizzle/schema.ts";

const SABOTAGES: Sabotage[] = [
  {
    name: "ARM 0 — NO-OP CONTROL (a comment only; must redden nothing)",
    file: ROUTER,
    find: "export const moderatorRouter = router({",
    replace: "export const moderatorRouter = router({ // sabotage no-op",
    expect: [],
  },
  {
    name: "middleware stops admitting admins",
    file: TRPC,
    find: 'if (ctx.user.role !== "moderator" && ctx.user.role !== "admin") {',
    replace: 'if (ctx.user.role !== "moderator") {',
    expect: [
      "an ADMIN is allowed through moderatorProcedure — the capability grid's footnote, driven not recited",
    ],
  },
  {
    name: "middleware admits everyone (the role check goes)",
    file: TRPC,
    find: 'if (ctx.user.role !== "moderator" && ctx.user.role !== "admin") {',
    replace: 'if (ctx.user.role === "__never_a_role__") {',
    expect: [
      "a plain user is REFUSED that same procedure — the control that makes the arm above mean something",
    ],
  },
  {
    name: "getAuditLogs stops collapsing `all` to no severity",
    file: ROUTER,
    find: 'severity: input?.severity === "all" ? undefined : input?.severity,',
    replace: "severity: input?.severity,",
    expect: ["`all` is a filter word, not a severity — the router sends NO severity for it"],
  },
  {
    name: "getAuditLogs stops passing a real severity",
    file: ROUTER,
    find: 'severity: input?.severity === "all" ? undefined : input?.severity,',
    replace: "severity: undefined,",
    expect: ["a real severity travels whole"],
  },
  {
    name: "getAuditLogs stops collapsing `all` to no category",
    file: ROUTER,
    find: 'actionCategory: input?.actionCategory === "all" ? undefined : input?.actionCategory,',
    replace: "actionCategory: input?.actionCategory,",
    expect: ["`all` is a filter word for the category too"],
  },
  {
    name: "getAuditLogs drops the userId filter",
    file: ROUTER,
    find: `        actionCategory: input?.actionCategory === "all" ? undefined : input?.actionCategory,
        userId: input?.userId,`,
    replace: `        actionCategory: input?.actionCategory === "all" ? undefined : input?.actionCategory,
        userId: undefined,`,
    expect: ["a userId filter travels whole"],
  },
  {
    name: "getAuditLogs sends the date STRINGS through unconverted",
    file: ROUTER,
    find: "startDate: input?.startDate ? new Date(input.startDate) : undefined,",
    replace: "startDate: input?.startDate as never,",
    expect: ["the date STRINGS the panel sends become real Dates on the way to the reader"],
  },
  {
    name: "getAuditLogs manufactures an Invalid Date when none was asked for",
    file: ROUTER,
    find: "startDate: input?.startDate ? new Date(input.startDate) : undefined,",
    replace: "startDate: new Date(input?.startDate as never),",
    /* ⚠ CORRECTED AFTER DRIVING IT. This arm first claimed the conversion arm
       would redden too; it does not, and it SHOULD not — `new Date(str)` still
       produces the right Date when a date WAS asked for, so only the
       no-dates-asked arm can see this sabotage. The prediction was wrong, not
       the arm. Recorded rather than quietly edited: a driver whose expectation
       is tuned until it agrees is `scripted-reader-agrees-with-you`. */
    expect: ["no dates asked for means NONE sent — never an Invalid Date, which reads as a filter"],
  },
  {
    name: "getAuditLogs' own page size changes",
    file: ROUTER,
    find: `      return await getFilteredAuditLogs({
        limit: input?.limit || 20,`,
    replace: `      return await getFilteredAuditLogs({
        limit: input?.limit || 25,`,
    expect: ["asked for nothing at all, the router's own page size is what reaches the reader"],
  },
  {
    name: "getUserActivity reaches its reader TWICE (proves the population control)",
    file: ROUTER,
    find: `      return await getFilteredAuditLogs({
        userId: input.userId,`,
    replace: `      await getFilteredAuditLogs({ userId: input.userId, limit: 1, offset: 0 });
      return await getFilteredAuditLogs({
        userId: input.userId,`,
    expect: [
      "the userId asked for reaches the reader, with this procedure's own page size of 50",
    ],
  },
  {
    name: "getAbuseAlerts' own default limit changes",
    file: ROUTER,
    find: "return await getAbuseAlertsSummary(input?.limit || 10);",
    replace: "return await getAbuseAlertsSummary(input?.limit || 5);",
    expect: ["asked for nothing, the router's own default of 10 reaches the summary reader"],
  },
  {
    name: "getAbuseAlerts ignores the asked-for limit",
    file: ROUTER,
    find: "return await getAbuseAlertsSummary(input?.limit || 10);",
    replace: "return await getAbuseAlertsSummary(10);",
    expect: ["an asked-for limit replaces it"],
  },
  {
    name: "getUserDetails returns an empty shell instead of null for a missing user",
    file: ROUTER,
    find: "      if (!user) return null;",
    replace: "      if (!user) return { user: {}, credits: null } as never;",
    expect: ["a user who does not exist comes back as NULL — not an error, not an empty shell"],
  },
  {
    name: "listUsers drops the search term",
    file: ROUTER,
    find: "        search: input?.search,",
    replace: "        search: undefined,",
    expect: ["a search term reaches the db helper"],
  },
  {
    name: "listUsers' own defaults change",
    file: ROUTER,
    find: '        sortOrder: input?.sortOrder || "desc",',
    replace: '        sortOrder: input?.sortOrder || "asc",',
    expect: ["no search term sends none, and the router's own defaults go with it"],
  },
  {
    name: "listUsers stops turning its dates into ISO strings",
    file: ROUTER,
    find: "          createdAt: user.createdAt.toISOString(),",
    replace: "          createdAt: user.createdAt as never,",
    expect: [
      "the dates cross the boundary as ISO STRINGS — a Date would reach the panel as something else",
    ],
  },
  {
    name: "listBlockedIPs leaks an extra field into its projection",
    file: ROUTER,
    find: "          reason: ip.reason,",
    replace: '          reason: ip.reason,\n          leakedField: "should not be here",',
    expect: ["the projection the ROUTER builds, whole — ISO dates, and a null expiry kept null"],
  },
  {
    name: "getUserFullDetails stops returning null for a missing user",
    file: ROUTER,
    find: "      if (!result) return null;",
    replace: "      if (!result) return { user: {}, credits: null, stats: null } as never;",
    expect: ["a user who does not exist comes back as NULL"],
  },
  {
    name: "getUserFullDetails stops turning its dates into ISO strings",
    file: ROUTER,
    find: "          createdAt: result.user.createdAt.toISOString(),",
    replace: "          createdAt: result.user.createdAt as never,",
    expect: ["the dates cross as ISO strings, and the credits and stats ride along untouched"],
  },
  {
    name: "the schema drops the moderator role",
    file: SCHEMA,
    find: 'role: mysqlEnum("role", ["user", "admin", "moderator"]).default("user").notNull(),',
    replace: 'role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),',
    expect: [
      "the users table's role column declares the moderator role — read off the column, not recited",
    ],
  },

  /* ── The arms added in response to the PR #698 review. The arm you have just
     written is the one to sabotage; these were written last, so they are
     driven hardest. ── */
  {
    name: "getUserCreditHistory stops collapsing `all` to no transaction type (the CREDITS read)",
    file: ROUTER,
    find: `      return await getDetailedCreditHistory(input.userId, {
        limit: input.limit,
        offset: input.offset,
        type: input.type === "all" ? undefined : input.type,`,
    replace: `      return await getDetailedCreditHistory(input.userId, {
        limit: input.limit,
        offset: input.offset,
        type: input.type,`,
    expect: ["`all` is a filter word, not a transaction type — the router sends none for it"],
  },
  {
    name: "getUserCreditHistory reads the WRONG user's credits",
    file: ROUTER,
    find: "return await getDetailedCreditHistory(input.userId, {",
    replace: "return await getDetailedCreditHistory(999, {",
    /* CORRECTED AFTER DRIVING IT: only the `all` arm reads the FIRST argument;
       the second arm looks at the options object alone, so it cannot see the
       user id go wrong and should not be claimed to. One arm guards this. */
    expect: ["`all` is a filter word, not a transaction type — the router sends none for it"],
  },
  {
    name: "getUserCreditHistory stops converting its dates",
    file: ROUTER,
    find: `        offset: input.offset,
        type: input.type === "all" ? undefined : input.type,
        startDate: input.startDate ? new Date(input.startDate) : undefined,`,
    replace: `        offset: input.offset,
        type: input.type === "all" ? undefined : input.type,
        startDate: input.startDate as never,`,
    expect: ["a real transaction type travels whole, and the dates become Dates"],
  },
  {
    name: "getUserGenerationHistory stops collapsing `all` on STATUS",
    file: ROUTER,
    find: `        status: input.status === "all" ? undefined : input.status,
        type: input.type === "all" ? undefined : input.type,`,
    replace: `        status: input.status,
        type: input.type === "all" ? undefined : input.type,`,
    expect: ["neither `all` reaches the reader as a filter"],
  },
  {
    name: "getUserGenerationHistory stops collapsing `all` on TYPE (the other half of that arm)",
    file: ROUTER,
    find: `        status: input.status === "all" ? undefined : input.status,
        type: input.type === "all" ? undefined : input.type,`,
    replace: `        status: input.status === "all" ? undefined : input.status,
        type: input.type,`,
    expect: ["neither `all` reaches the reader as a filter"],
  },
  {
    name: "getUserGenerationHistory drops a real status on the floor",
    file: ROUTER,
    find: `        status: input.status === "all" ? undefined : input.status,
        type: input.type === "all" ? undefined : input.type,`,
    replace: `        status: undefined,
        type: input.type === "all" ? undefined : input.type,`,
    expect: ["a real status and a real type both travel whole"],
  },
  {
    name: "getFlaggedReferrals' own defaults change",
    file: ROUTER,
    find: "return await getFlaggedReferrals(input?.limit || 50, input?.offset || 0);",
    replace: "return await getFlaggedReferrals(input?.limit || 25, input?.offset || 0);",
    expect: ["the router's own defaults reach the reader when nothing is asked for"],
  },
  {
    name: "getAuditLogById reads a fixed row instead of the one asked for",
    file: ROUTER,
    find: "return await getAuditLogById(input.id);",
    replace: "return await getAuditLogById(1);",
    expect: ["the id asked for is the id read — not a default, not the first row"],
  },
  {
    name: "getUserStats never reaches its reader",
    file: ROUTER,
    find: "return await getUserStatistics();",
    replace: "return { totalUsers: 0, activeUsers: 0, suspendedUsers: 0 } as never;",
    expect: ["the statistics reader is reached, and its answer is what comes back"],
  },
  {
    /* PR #698 review round 2, finding 2. Before the fixture was seeded with the
       forbidden six, THIS SABOTAGE REDDENED NOTHING — the arm asserted absence
       against a fixture that had nothing to leak. It is the whole reason the
       seeding is in the diff. */
    name: "getUserDetails' explicit projection regresses to a SPREAD (invariant 8's own class)",
    file: ROUTER,
    find: `      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,`,
    replace: `      return {
        user: {
          ...user,
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,`,
    expect: ["getUserDetails hands back the projection the ROUTER builds, driven not recited"],
  },
  {
    name: "A NEW PROCEDURE APPEARS ON THE ROUTER — the derived accounting must notice",
    file: ROUTER,
    find: "  getFlaggedReferrals: moderatorProcedure",
    replace: `  getSomethingNobodyDrove: moderatorProcedure.query(async () => ({ ok: true })),

  getFlaggedReferrals: moderatorProcedure`,
    expect: ["no procedure on the moderator router is unaccounted for"],
  },
  {
    name: "A PROCEDURE IS RENAMED AWAY — the accounting must not keep naming a surface that is gone",
    file: ROUTER,
    find: "  getUserStats: moderatorProcedure",
    replace: "  getUserStatsUnderANewName: moderatorProcedure",
    expect: [
      "and nothing is accounted for that the router does not have — the list cannot outlive the surface",
      "no procedure on the moderator router is unaccounted for",
      "the statistics reader is reached, and its answer is what comes back",
    ],
  },
];

function runSuite(): { failed: string[]; total: number } {
  if (existsSync(OUT)) rmSync(OUT);
  try {
    execFileSync(
      "npx",
      ["vitest", "run", SUITE, "--reporter=json", `--outputFile=${OUT}`],
      { cwd: ROOT, stdio: "pipe", shell: true },
    );
  } catch {
    /* a red suite exits non-zero — that is the point; the JSON is what we read */
  }
  if (!existsSync(OUT)) throw new Error("vitest produced no JSON report");
  const report = JSON.parse(readFileSync(OUT, "utf8")) as {
    testResults: { assertionResults: { fullName: string; title: string; status: string }[] }[];
  };
  const arms = report.testResults.flatMap(f => f.assertionResults);
  if (arms.length === 0) throw new Error("the report holds no arms at all");
  return {
    failed: arms.filter(a => a.status === "failed").map(a => a.title).sort(),
    total: arms.length,
  };
}

function main(): void {
  console.log("=== BASELINE: the suite must be GREEN before any sabotage ===");
  const base = runSuite();
  if (base.failed.length > 0) {
    console.error(`REFUSING — the suite is already red:\n  ${base.failed.join("\n  ")}`);
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
      const got = failed;
      const same = want.length === got.length && want.every((w, i) => w === got[i]);
      if (same) {
        pass += 1;
        console.log(`✓ ${s.name}\n    reddened exactly ${got.length}: ${got.join(" | ") || "(nothing, as required)"}`);
      } else {
        findings.push(
          `${s.name}\n      wanted: ${want.join(" | ") || "(nothing)"}\n      got:    ${got.join(" | ") || "(nothing)"}`,
        );
        console.log(`✗ ${s.name}\n    wanted: ${want.join(" | ") || "(nothing)"}\n    got:    ${got.join(" | ") || "(nothing)"}`);
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
