/**
 * #416 — CAN THE GUARD SUITE ACTUALLY FAIL?
 *
 * Working law 2: verify the instrument before believing its finding. Thirteen
 * green arms prove nothing until each one has been shown to redden under the
 * exact edit it exists to catch — and this card's whole subject is a control
 * that was green while doing nothing, so a suite that cannot fail would be the
 * same mistake one level up.
 *
 * Each sabotage below names the ONE arm it must redden. A sabotage reddening
 * zero arms is an unarmed clause; a sabotage reddening several means the arms
 * are not independent and a future failure will not say what broke.
 *
 * ⚠ THE TREE IS RESTORED IN A `finally`. A driver that dies mid-run and leaves
 * the working tree sabotaged has happened here before, and the next thing that
 * reads the tree — a suite, a commit, the gate — reads the sabotage as the
 * product. Files are read and written as UTF-8 explicitly for the same class of
 * reason: a re-encode would rewrite every arrow in every docblock.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SUITE = "client/src/features/staff/counts416-guard.test.ts";

const CHROME = "client/src/components/AppChrome.tsx";
const HOOK = "client/src/features/staff/useModeratorFlagCounts.ts";
const COMPOSER = "client/src/features/staff/useAccountMenuCounts.ts";
const CARD = "client/src/features/moderator/FlaggedDiscrepanciesCard.tsx";
const THRESHOLDS = "client/src/features/moderator/flagThresholds.ts";
const RECONCILIATION = "server/routes/moderatorReconciliation.ts";

interface Sabotage {
  what: string;
  file: string;
  from: string;
  to: string;
  /** A distinctive fragment of the arm title that must appear among the failures. */
  arm: string;
}

const SABOTAGES: Sabotage[] = [
  {
    what: "the call site stops passing adminCount (the original defect, half of it)",
    file: CHROME,
    from: "                  adminCount={adminCount}\n",
    to: "",
    arm: "hands UserCard both counts",
  },
  {
    what: "the call site stops passing moderationCount (the original defect, other half)",
    file: CHROME,
    from: "                  moderationCount={moderationCount}\n",
    to: "",
    arm: "hands UserCard both counts",
  },
  {
    what: "the referral count is read off the returned page instead of the unbounded total",
    file: HOOK,
    from: "const flaggedReferrals = referrals?.total ?? 0;",
    to: "const flaggedReferrals = (referrals as { items?: unknown[] })?.items?.length ?? 0;",
    arm: "unbounded total",
  },
  {
    what: "the discrepancy count is read off scannedCount instead of the flagged accounts",
    file: HOOK,
    from: "const flaggedDiscrepancies = discrepancies?.users?.length ?? 0;",
    to: "const flaggedDiscrepancies = (discrepancies as { scannedCount?: number })?.scannedCount ?? 0;",
    arm: "never off scannedCount",
  },
  {
    what: "the zero fallback is dropped, so an unanswered query totals NaN",
    file: HOOK,
    from: "const flaggedReferrals = referrals?.total ?? 0;",
    to: "const flaggedReferrals = referrals?.total as number;",
    arm: "not NaN",
  },
  {
    what: "a FETCH-level option is set on a key another surface observes",
    file: HOOK,
    from: "{ enabled, staleTime: STALE_MS },\n  );\n\n  const discrepancies",
    to: "{ enabled, staleTime: STALE_MS, retry: false },\n  );\n\n  const discrepancies",
    arm: "observer-scoped options",
  },
  {
    what: "the hook writes its own threshold literal instead of importing the shared one",
    file: HOOK,
    from: "{ threshold: DEFAULT_DISCREPANCY_THRESHOLD }",
    to: "{ threshold: 500 }",
    arm: "both import it rather than writing a number",
  },
  {
    what: "the card grows a second declaration of the default",
    file: CARD,
    from: "export function FlaggedDiscrepanciesCard({",
    to: "const DEFAULT_DISCREPANCY_THRESHOLD = 500;\n\nexport function FlaggedDiscrepanciesCard({",
    arm: "exactly one module declares",
  },
  {
    what: "the default is moved off the chip row, so no chip can show as pressed",
    file: THRESHOLDS,
    from: "export const DEFAULT_DISCREPANCY_THRESHOLD = 500;",
    to: "export const DEFAULT_DISCREPANCY_THRESHOLD = 750;",
    arm: "one of the lenses",
  },
  {
    what: "the composer starts fetching for itself, becoming a second reader of the admin count",
    file: COMPOSER,
    from: "export function useAccountMenuCounts(): AccountMenuCounts {",
    to: "export function useAccountMenuCounts(): AccountMenuCounts {\n  trpc.admin.getOverview.useQuery();",
    arm: "issues no query of its own",
  },
  {
    what: "the gate narrows to admins, so a moderator's badge silently never fills",
    file: HOOK,
    from: 'const isStaff = user?.role === "moderator" || user?.role === "admin";',
    to: 'const isStaff = user?.role === "admin";',
    arm: "gated to the roles",
  },
  {
    /*
      ⚠ NOT A HYPOTHETICAL — THIS RESTORES THE EXACT BYTES THAT WERE ON `main`,
      and the arm it must redden did not exist until the gate review of PR #463
      pointed at them. It is the positive control for that arm: the guard must
      catch the real defect, not a caricature of it.
    */
    what: "the server takes back its own default (the REAL pre-fix bytes, 50 against a product default of 500)",
    file: RECONCILIATION,
    from: "threshold: z.number().min(1),",
    to: "threshold: z.number().min(1).default(50),",
    arm: "SERVER declares no default",
  },
];

const abs = (file: string) => path.join(ROOT, file);
const readFile = (file: string) => fs.readFileSync(abs(file), { encoding: "utf8" });
const writeFile = (file: string, text: string) =>
  fs.writeFileSync(abs(file), text, { encoding: "utf8" });

/** Run the suite. Returns the arm titles that failed, or null if it was green. */
function runSuite(): string[] | null {
  try {
    execFileSync("npx", ["vitest", "run", SUITE, "--reporter", "json", "--outputFile", ".sab416.json"], {
      cwd: ROOT,
      stdio: "pipe",
      shell: true,
    });
  } catch {
    /* A red suite exits nonzero; the JSON is still written. */
  }
  const raw = fs.readFileSync(path.join(ROOT, ".sab416.json"), { encoding: "utf8" });
  const report = JSON.parse(raw) as {
    testResults: { assertionResults: { status: string; title: string }[] }[];
  };
  const failed = report.testResults
    .flatMap((f) => f.assertionResults)
    .filter((a) => a.status === "failed")
    .map((a) => a.title);
  return failed.length ? failed : null;
}

const originals = new Map<string, string>();
for (const s of SABOTAGES) if (!originals.has(s.file)) originals.set(s.file, readFile(s.file));

let reds = 0;
let noReds = 0;
let wrongArms = 0;

try {
  const baseline = runSuite();
  if (baseline) {
    console.log("BASELINE IS RED — nothing below means anything:");
    for (const t of baseline) console.log("   " + t);
    process.exit(1);
  }
  console.log("baseline: GREEN\n");

  for (const s of SABOTAGES) {
    const original = originals.get(s.file)!;
    if (!original.includes(s.from)) {
      console.log("NO SUBJECT — the sabotage target is not in the file: " + s.what);
      noReds++;
      continue;
    }
    writeFile(s.file, original.replace(s.from, s.to));
    const failed = runSuite();
    writeFile(s.file, original);

    if (!failed) {
      console.log("NO RED   " + s.what);
      noReds++;
      continue;
    }
    const hit = failed.filter((t) => t.includes(s.arm));
    if (!hit.length) {
      console.log("WRONG ARM " + s.what + "\n   expected an arm matching: " + s.arm + "\n   got: " + failed.join(" | "));
      wrongArms++;
      continue;
    }
    const extra = failed.length - hit.length;
    console.log(
      "RED      " + s.what + "\n   -> " + hit[0] + (extra ? "   (+" + extra + " other arm(s))" : ""),
    );
    reds++;
  }
} finally {
  for (const [file, text] of originals) writeFile(file, text);
  const json = path.join(ROOT, ".sab416.json");
  if (fs.existsSync(json)) fs.unlinkSync(json);
  console.log("\ntree restored.");
}

console.log("\nRED " + reds + " / " + SABOTAGES.length + "  ·  NO RED " + noReds + "  ·  WRONG ARM " + wrongArms);
process.exit(noReds + wrongArms === 0 ? 0 : 1);
