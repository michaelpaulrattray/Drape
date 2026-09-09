/**
 * DISPOSABLE — the sabotage receipt for #697's repair of
 * `server/security/adminSecurity.test.ts`.
 *
 * #697's bar, verbatim: *"whatever is rewritten is proven by a SABOTAGE OF THE
 * PRODUCT, not by reading."* This drives that bar, in the shape
 * `scripts/_697-sabotage-disposable.mts` established for `moderator.test.ts`:
 * each sabotage patches a real product file, runs the suite, records which arms
 * went red, and RESTORES THE FILE IN A `finally`.
 *
 * Two controls, both of which have caught a lying driver before:
 *   · ARM 0 is a NO-OP sabotage. It must redden NOTHING.
 *   · Every arm asserts the reddened set EXACTLY, not "at least".
 *
 * # THE NEGATIVE CONTROL, MEASURED BEFORE THE REPAIR
 *
 * `--before` asserts the `before` sets, which were driven against the file as
 * it stood (8 arms, all green) — **10/10 arms behaved exactly as predicted**:
 *
 *   THE ALLOWLIST GOES ................................ reddened NOTHING
 *   THE ALLOWLIST STOPS MATCHING BY ID ................ reddened NOTHING
 *   THE ALLOWLIST STOPS REFUSING ...................... reddened NOTHING
 *   changePlan leaves the sensitive list .............. reddened NOTHING
 *   the unauthorized alert stops naming the user ...... reddened NOTHING
 *
 * ⚠ It can only be re-run with the PRE-REPAIR file checked out; against the
 * repaired suite those sets are false, which is the whole point of them.
 *
 * Run: npx tsx scripts/_697-adminsecurity-sabotage-disposable.mts [--before]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SUITE = "server/security/adminSecurity.test.ts";
const OUT = path.join(ROOT, "_adminsec-sabotage-result.json");
const BEFORE = process.argv.includes("--before");

const SEC = "server/security/adminSecurity.ts";

type Sabotage = {
  name: string;
  file: string;
  find: string;
  replace: string;
  /** Arm titles (exact) expected red AFTER the repair. */
  expect: string[];
  /** Arm titles (exact) expected red BEFORE it — the negative control. */
  before: string[];
};

const SABOTAGES: Sabotage[] = [
  {
    name: "ARM 0 — NO-OP CONTROL (a comment only; must redden nothing)",
    file: SEC,
    find: "export function isSensitiveAction(action: string): boolean {",
    replace: "export function isSensitiveAction(action: string): boolean { // sabotage no-op",
    expect: [],
    before: [],
  },
  {
    name: "THE ALLOWLIST GOES — an empty list stops admitting database admins",
    file: SEC,
    find: "  if (ADMIN_ALLOWLIST.length === 0) {\n    return true;\n  }",
    replace: "  if (ADMIN_ALLOWLIST.length === 0) {\n    return false;\n  }",
    expect: [
      "an EMPTY allowlist admits every database admin — the documented production state, driven",
      "an admin allowed by an empty allowlist carries no reason at all",
    ].sort(),
    /* PREDICTION, recorded before the run and CONFIRMED: NOTHING. The old arm 1
       tolerated a denial (`if (!result.allowed) expect(result.reason).toBeDefined()`),
       arm 2 asserted only that the property existed, and arm 3 was denied at the
       ROLE check before the allowlist was ever consulted. */
    before: [],
  },
  {
    /* ⚠ A CONTROL, NOT A COVERAGE ARM — it must redden NOTHING, and that is the
       finding. `ADMIN_ALLOWLIST` can only be populated from `process.env`, whose
       values are strings, so `includes(userId)` with a NUMBER can never match in
       any deployed configuration. Deleting the branch outright changes no
       behaviour, which is what this proves. Pinned by the suite's own
       numeric-id arm and filed as its own card; NOT repaired here, because
       widening who the allowlist admits is a behaviour change and #697 forbids
       batching one with this work. */
    name: "THE DEAD BRANCH — the numeric-id match goes (must redden NOTHING)",
    file: SEC,
    find: "  if (ADMIN_ALLOWLIST.includes(userId)) {\n    return true;\n  }",
    replace: "  if (false) {\n    return true;\n  }",
    expect: [],
    before: [],
  },
  {
    name: "THE ALLOWLIST STOPS REFUSING — everyone passes a populated list",
    file: SEC,
    find: "  if (email && ADMIN_ALLOWLIST.includes(email)) {\n    return true;\n  }\n  \n  return false;",
    replace: "  if (email && ADMIN_ALLOWLIST.includes(email)) {\n    return true;\n  }\n  \n  return true;",
    expect: [
      "a POPULATED allowlist REFUSES an admin who is not on it — the branch an empty list makes unreachable",
      "an allowlist populated from the environment holds STRINGS, so a numeric id never matches it",
    ].sort(),
    before: [],
  },
  {
    name: "THE ALLOWLIST STOPS MATCHING BY openId",
    file: SEC,
    find: "  if (openId && ADMIN_ALLOWLIST.includes(openId)) {\n    return true;\n  }",
    replace: "  if (false) {\n    return true;\n  }",
    expect: [
      "a POPULATED allowlist admits the admin whose openId is on it",
      "an allowlist populated from the environment holds STRINGS, so a numeric id never matches it",
    ].sort(),
    before: [],
  },
  {
    name: "THE ALLOWLIST STOPS MATCHING BY email",
    file: SEC,
    find: "  if (email && ADMIN_ALLOWLIST.includes(email)) {\n    return true;\n  }",
    replace: "  if (false) {\n    return true;\n  }",
    expect: ["a POPULATED allowlist admits the admin whose email is on it"],
    before: [],
  },
  {
    name: "THE ROLE CHECK GOES — validateAdminAccess stops requiring the admin role",
    file: SEC,
    find: '  if (user.role !== "admin") {',
    replace: '  if (user.role === "__never_a_role__") {',
    expect: [
      "a non-admin role is refused, and the reason names the role as the thing that refused it",
      "the role is checked BEFORE the allowlist — a listed non-admin is still refused, for the role",
    ].sort(),
    before: ["should deny access for non-admin users"],
  },
  {
    name: "THE CHECK ORDER FLIPS — the allowlist is consulted before the role",
    file: SEC,
    find: '  if (user.role !== "admin") {\n    return { allowed: false, reason: "User does not have admin role" };\n  }',
    replace: "",
    expect: [
      "a non-admin role is refused, and the reason names the role as the thing that refused it",
      "the role is checked BEFORE the allowlist — a listed non-admin is still refused, for the role",
    ].sort(),
    before: ["should deny access for non-admin users"],
  },
  {
    name: "isSensitiveAction answers FALSE for everything",
    file: SEC,
    find: "  return SENSITIVE_ACTIONS.includes(action);",
    replace: "  return false;",
    expect: [
      "every action the product declares sensitive is answered sensitive",
      "a sensitive action reaches the SENSITIVE Slack alert, carrying the details it was given",
      "a sensitive action is recorded at WARNING severity and an ordinary one at INFO",
    ].sort(),
    before: [
      "should identify sensitive actions",
      "should use sensitive alert for sensitive actions",
    ].sort(),
  },
  {
    name: "isSensitiveAction answers TRUE for everything",
    file: SEC,
    find: "  return SENSITIVE_ACTIONS.includes(action);",
    replace: "  return true;",
    expect: [
      "an ordinary action is not sensitive — the control that makes the arm above mean something",
      "an ordinary action reaches the ORDINARY Slack alert and never the sensitive one",
      "a sensitive action is recorded at WARNING severity and an ordinary one at INFO",
    ].sort(),
    before: [
      "should identify non-sensitive actions",
      "should log admin actions",
    ].sort(),
  },
  {
    name: "changePlan quietly leaves the sensitive list (a money action)",
    file: SEC,
    find: '  "changePlan",\n',
    replace: "",
    expect: ["every action the product declares sensitive is answered sensitive"],
    before: [],
  },
  {
    name: "the sensitive branch sends the ORDINARY alert instead",
    file: SEC,
    find: "    await SlackAlerts.sensitiveAdminAction(",
    replace: "    await SlackAlerts.adminAction(",
    expect: ["a sensitive action reaches the SENSITIVE Slack alert, carrying the details it was given"],
    before: ["should use sensitive alert for sensitive actions"],
  },
  {
    name: "logAdminAction drops the caller's details on the way to Slack",
    file: SEC,
    find: "      targetType,\n      targetId,\n      details\n    );\n  } else {",
    replace: "      targetType,\n      targetId,\n      undefined\n    );\n  } else {",
    expect: ["a sensitive action reaches the SENSITIVE Slack alert, carrying the details it was given"],
    before: [],
  },
  {
    name: "THE AUDIT SEVERITY STOPS DEPENDING ON THE ACTION (the half that survives Slack being unconfigured)",
    file: SEC,
    find: '    severity: isSensitiveAction(action) ? "warning" : "info",',
    replace: '    severity: "info",',
    expect: ["a sensitive action is recorded at WARNING severity and an ordinary one at INFO"],
    before: [],
  },
  {
    name: "the unauthorized-access alert stops naming who attempted it",
    file: SEC,
    find: "  await SlackAlerts.unauthorizedAdminAccess(\n    userId,\n    userName,",
    replace: "  await SlackAlerts.unauthorizedAdminAccess(\n    userId,\n    userName.slice(0, 0),",
    expect: ["an unauthorized attempt alerts with the user, the attempt and the IP that made it"],
    before: [],
  },
  {
    name: "the unauthorized attempt is recorded as ordinary rather than critical",
    file: SEC,
    find: '    severity: "critical",',
    replace: '    severity: "info",',
    expect: ["the attempt is recorded at CRITICAL severity, blocked, against the admin surface"],
    before: [],
  },
  {
    name: "the unauthorized attempt stops recording that it was BLOCKED",
    file: SEC,
    find: "      blocked: true,",
    replace: "      blocked: false,",
    expect: ["the attempt is recorded at CRITICAL severity, blocked, against the admin surface"],
    before: [],
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

let EXIT_CODE = 0;

function main(): void {
  console.log(`=== ${BEFORE ? "BEFORE" : "AFTER"} — the suite must be GREEN before any sabotage ===`);
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
        console.log(`X ${s.name}\n    anchor matched ${occurrences} times — NOT DRIVEN`);
        continue;
      }
      writeFileSync(abs, original.replace(s.find, s.replace), "utf8");
      const { failed } = runSuite();
      const want = [...(BEFORE ? s.before : s.expect)].sort();
      const got = failed;
      const same = want.length === got.length && want.every((w, i) => w === got[i]);
      if (same) {
        pass += 1;
        console.log(`OK ${s.name}\n    reddened exactly ${got.length}: ${got.join(" | ") || "(nothing, as required)"}`);
      } else {
        findings.push(
          `${s.name}\n      wanted: ${want.join(" | ") || "(nothing)"}\n      got:    ${got.join(" | ") || "(nothing)"}`,
        );
        console.log(`X ${s.name}\n    wanted: ${want.join(" | ") || "(nothing)"}\n    got:    ${got.join(" | ") || "(nothing)"}`);
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
/* An unconditional exit(0) would mean a run whose arms MISBEHAVED still read as
   success to any wrapper or && chain (PR #701 review, finding 1). */
process.exit(EXIT_CODE);
