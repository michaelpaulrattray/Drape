/**
 * #185 — CAN THE NEW ARMS FAIL? (working law 2, and law 3 for the instruction.)
 *
 * The suite around the concept describer went from 74 arms to 112 in one
 * sitting. A green run of arms nobody has ever seen fail is a green suite
 * standing over an open door — so each declared defect is INTRODUCED into the
 * real tree, the real suite is run, and the arms that redden are counted
 * against what was predicted.
 *
 * Every case restores in `finally` (a driver that dies mid-sabotage leaves the
 * tree sabotaged, and a later shift reads the red as its own).
 *
 * Run: npx tsx scripts/_type-not-inventory-sabotage-disposable.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const READER = "server/castingV2/conceptDescribe.ts";

type Case = { name: string; file: string; from: string; to: string; predicted: number };

const CASES: Case[] = [
  {
    name: "the ceiling drifts back up to the inventory era",
    file: READER,
    from: "export const CONCEPT_DESCRIPTION_MAX = 300;",
    to: "export const CONCEPT_DESCRIPTION_MAX = 1200;",
    predicted: 3,
  },
  {
    name: "the announced target is quietly widened",
    file: READER,
    from: "export const CONCEPT_DESCRIPTION_TARGET = { low: 150, high: 250 } as const;",
    to: "export const CONCEPT_DESCRIPTION_TARGET = { low: 150, high: 900 } as const;",
    predicted: 4,
  },
  {
    name: "the absence sweep is never consulted",
    file: READER,
    from: "  const phrase = absenceClaimIn(description);\n  if (phrase) return { kind: \"absence\", phrase };",
    to: "",
    predicted: 3,
  },
  {
    name: "the absence sweep loses the American spelling again",
    file: READER,
    from: '"jewell?e?ry"',
    to: '"jewellery"',
    predicted: 1,
  },
  {
    /*
      ⚠ THIS CASE WAS WRONG BEFORE IT WAS RIGHT, and the correction is the
      finding. It first widened the LEAD to `no-?`, predicted 2 arms, and
      reddened NOTHING — because the pattern requires whitespace after the lead,
      so "no-nonsense" never reached the noun test and the sabotage was a no-op
      wearing an over-broad ban's clothes. What actually holds this ban narrow
      is the NOUN LIST, so that is what the positive controls must fence, and
      this is the sabotage that proves they do.

      DECLARED LIMIT: the separator is fenced by nothing. Relaxing `\s+` to
      `\s*` on its own reddens no arm — and it also catches no real sentence,
      because no describer writes "notattoos".
    */
    name: "the absence sweep goes over-broad — any noun at all becomes an absence claim",
    file: READER,
    from: 'nouns: ["tattoos?", "jewell?e?ry", "make-?up", "piercings?"],',
    to: 'nouns: ["\\\\w+"],',
    predicted: 1,
  },
  {
    name: "THE BLIND RE-ASK IS RESTORED — the same words, twice, at temperature 0",
    file: READER,
    from: "        user: previous ? `${ASK} ${reAsk(previous)}` : ASK,",
    to: "        user: ASK,",
    predicted: 6,
  },
  {
    name: "the re-ask stops naming the LENGTH it refused",
    file: READER,
    from: "      return `Your previous answer was ${fault.length} characters — that is an inventory,",
    to: "      return `Your previous answer was too long — that is an inventory,",
    predicted: 1,
  },
  {
    name: "an over-long read is TRUNCATED instead of re-asked",
    file: READER,
    from: "    const fault = faultIn(description);\n    if (!fault) return { ok: true, description, attempts: attempt };",
    to: "    const fault = faultIn(description.slice(0, CONCEPT_DESCRIPTION_MAX));\n    if (!fault) return { ok: true, description: description.slice(0, CONCEPT_DESCRIPTION_MAX), attempts: attempt };",
    predicted: 4,
  },
  {
    name: "his keep/drop lists are edited out of the instruction",
    file: READER,
    from: '  "DO NOT CATALOGUE. Leave out exact eye colour, brow shape, the exact cut, fade or hairline,",',
    to: '  "Be thorough about the face.",',
    predicted: 1,
  },
  {
    name: "the REASON behind the rules is dropped, leaving only the list",
    file: READER,
    from: '  "EVERYTHING YOU NAME IS LOCKED ON EVERY FACE THAT GETS CAST, so each detail you list is a detail",\n  "eight different people are forced to share.",',
    to: '  "Be brief.",',
    predicted: 1,
  },
  {
    name: "his golden example stops being shown to the reader",
    file: READER,
    from: '  "This is the length and the level of detail to aim for:",\n  `"${GOLDEN_NOTE}"`,',
    to: '  "Aim for a short casting note.",',
    predicted: 1,
  },
  {
    name: "the second-failure reasons collapse back into one",
    file: READER,
    from: '    : second.fault.kind === "brief" ? "unreadable" : "not_a_casting_note";',
    to: '    : "unreadable";',
    predicted: 3,
  },
];

function run(): { failed: number; names: string[] } {
  try {
    execFileSync(
      "npx",
      ["vitest", "run", "server/castingV2/conceptDescribe.test.ts", "--reporter=json", "--outputFile=.sabotage.json"],
      { stdio: "ignore", shell: true },
    );
  } catch { /* a red run exits non-zero; the report is what we read */ }
  const report = JSON.parse(readFileSync(".sabotage.json", "utf8")) as {
    testResults: { assertionResults: { status: string; fullName: string }[] }[];
  };
  const failures = report.testResults
    .flatMap((file) => file.assertionResults)
    .filter((a) => a.status === "failed");
  return { failed: failures.length, names: failures.map((a) => a.fullName) };
}

const clean = run();
console.log(`BASELINE: ${clean.failed} failing arms${clean.failed ? " ⚠ THE TREE IS NOT CLEAN" : ""}`);
if (clean.failed) process.exit(1);

const rows: string[] = [];
for (const c of CASES) {
  const original = readFileSync(c.file, "utf8");
  if (!original.includes(c.from)) {
    console.log(`⚠ SKIPPED (anchor not found): ${c.name}`);
    rows.push(`| ${c.name} | ANCHOR NOT FOUND | ${c.predicted} |`);
    continue;
  }
  try {
    writeFileSync(c.file, original.replace(c.from, c.to), "utf8");
    const result = run();
    const verdict = result.failed === c.predicted ? "" : ` ⚠ predicted ${c.predicted}`;
    console.log(`\n${result.failed} red — ${c.name}${verdict}`);
    for (const name of result.names.slice(0, 6)) console.log(`    · ${name}`);
    rows.push(`| ${c.name} | ${result.failed} | ${c.predicted} |`);
  } finally {
    writeFileSync(c.file, original, "utf8");
  }
}

const after = run();
console.log(`\nTREE RE-READ AFTER RESTORE: ${after.failed} failing arms${after.failed ? " ⚠ NOT RESTORED" : " — clean"}`);
console.log("\n| sabotage | arms red | predicted |\n|---|---|---|");
for (const row of rows) console.log(row);

/* A script ends by ending the process (scriptExitDiscipline). */
process.exit(0);
