/**
 * #1617's SABOTAGE — every arm of `server/trackedFilePopulation.test.ts` proven
 * able to fail, and each patch proven to have CHANGED BYTES before its verdict
 * is read.
 *
 * The memory this is shaped by (`surviving-sabotage-may-be-inert`): a sabotage
 * that survives green has five possible causes, and only one of them is a blind
 * guard — the other four are an inert edit, no edit at all, the wrong line, and
 * a fixture that cannot ask the question. So every case here asserts its anchor
 * matched exactly once and that the file on disk moved, and a case whose patch
 * did not apply is reported as a BROKEN CASE rather than as a surviving guard.
 *
 * Restoration is `git checkout --` per file, so a crash cannot leave a sabotaged
 * tree behind: every target is committed.
 *
 *   npx tsx scripts/_1617-sabotage-disposable.mts
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..");
const SUITE = "server/trackedFilePopulation.test.ts";

type Case = {
  name: string;
  file: string;
  find: string;
  replace: string;
  /** The arm title that must go red — a case that reddens some OTHER arm is not this case. */
  expectRed: string;
  /**
   * An INVERTED case: the edit is legitimate and the suite must stay GREEN.
   *
   * Without this, a false-positive road can only be checked by eye, and a
   * sabotage suite that can only ever ask "does it redden" cannot tell a
   * discriminating guard from one that reddens at everything — which is the
   * other half of working law 2 and the half usually left out.
   */
  mustStayGreen?: true;
};

const cases: Case[] = [
  {
    name: "the sweep's walk stops gating on what the repository contains",
    file: "scripts/sweep-uncalled-exports-disposable.mts",
    find: "      if (contains(full)) out.push(full);\n      else uncontained += 1;",
    replace: "      out.push(full);\n      if (!contains(full)) uncontained += 1;",
    expectRed: "the sweep gates its walk",
  },
  {
    name: "the door's stale check reads the disk again",
    file: "scripts/check-cleanup-dispositions.mts",
    find: "if (!existsSync(path) || !contains(path)) return false;",
    replace: "if (!existsSync(path)) return false;",
    expectRed: "the sweep gates its walk",
  },
  {
    name: "the classifier stops excluding what the repository does not contain",
    file: "scripts/lib/productionMention.mts",
    find: "const untracked = new Set(files.filter((file) => !contains(file)));",
    replace: "const untracked = new Set<string>();",
    expectRed: "the sweep gates its walk",
  },
  {
    name: "the reader says every file on disk is contained",
    file: "scripts/lib/trackedFiles.mts",
    find: "    return files.has(absolute.slice(resolvedRoot.length + 1).split(BACKSLASH).join(\"/\"));",
    replace: "    return true;",
    expectRed: "both directions, at a real repository",
  },
  {
    name: "the reader compares NATIVE separators — the silent-empty-population bug",
    file: "scripts/lib/trackedFiles.mts",
    find: "    return files.has(absolute.slice(resolvedRoot.length + 1).split(BACKSLASH).join(\"/\"));",
    replace: "    return files.has(absolute.slice(resolvedRoot.length + 1));",
    expectRed: "both directions, at a real repository",
  },
  {
    name: "a root git cannot answer for returns an empty set instead of refusing",
    file: "scripts/lib/trackedFiles.mts",
    find: "    const said = (cause as { stderr?: string }).stderr?.trim();",
    replace: "    if (cause) return new Set<string>();\n    const said = \"\";",
    expectRed: "REFUSES on a directory git cannot answer for",
  },
  {
    name: "an empty listing is treated as a repository with nothing in it",
    file: "scripts/lib/trackedFiles.mts",
    find: "  if (files.size === 0) {",
    replace: "  if (false as boolean) {",
    expectRed: "REFUSES on a repository with no files",
  },
  {
    name: "a SECOND reader appears in the door's own closure",
    file: "scripts/lib/productionMention.mts",
    find: "import { containedIn } from \"./trackedFiles.mts\";",
    replace: "import { containedIn } from \"./trackedFiles.mts\";\n"
      + "import { execFileSync } from \"node:child_process\";\n"
      + "export const mine = () => execFileSync(\"git\", [\"ls-files\"], { encoding: \"utf8\" });",
    expectRed: "only the shared reader asks git",
  },
  {
    /*
      THE SAME CASE WEARING AN ALIAS, and it is here because it SURVIVED the
      first shape of the detector: the regex matched the function's NAME, so
      `rogue("git", ["ls-files"…` was invisible. Kept as its own case rather than
      folded into the one above, because the two fail for different reasons and a
      single case cannot show which one came back.
    */
    name: "a second reader appears under an ALIASED import",
    file: "scripts/lib/productionMention.mts",
    find: "import { containedIn } from \"./trackedFiles.mts\";",
    replace: "import { containedIn } from \"./trackedFiles.mts\";\n"
      + "import { execFileSync as rogue } from \"node:child_process\";\n"
      + "export const mine = () => rogue(\"git\", [\"ls-files\"], { encoding: \"utf8\" });",
    expectRed: "only the shared reader asks git",
  },
  {
    /*
      AND THE OTHER DIRECTION: a comment discussing the call must not redden the
      rule. `preflight.mts` carries this exact argument shape in a docblock, so
      the false-positive road is real rather than theoretical — and a guard that
      reddens on an explanation is one a shift learns to ignore.
    */
    name: "PROSE describing the call does NOT redden the rule",
    mustStayGreen: true,
    file: "scripts/lib/productionMention.mts",
    find: "import { containedIn } from \"./trackedFiles.mts\";",
    replace: "/* the shared reader's own call is `execFileSync(\"git\", [\"ls-files\"], …)`. */\n"
      + "import { containedIn } from \"./trackedFiles.mts\";",
    expectRed: "",
  },
];

function restore(file: string): void {
  execFileSync("git", ["checkout", "--", file], { cwd: REPO, stdio: ["ignore", "pipe", "pipe"] });
}

let broken = 0;
let survived = 0;

for (const [index, testCase] of cases.entries()) {
  const path = resolve(REPO, testCase.file);
  const before = readFileSync(path, "utf8");
  const hits = before.split(testCase.find).length - 1;
  if (hits !== 1) {
    /* THE FALSE-GREEN GUARD. An anchor that matched nothing, or matched twice,
       means the case never asked its question — which looks exactly like a guard
       that saw the sabotage and passed anyway. */
    console.log(`  BROKEN CASE  ${index + 1}. ${testCase.name} — anchor matched ${hits}×, not once`);
    broken += 1;
    continue;
  }
  const after = before.split(testCase.find).join(testCase.replace);
  if (after === before) {
    console.log(`  BROKEN CASE  ${index + 1}. ${testCase.name} — the patch changed no bytes`);
    broken += 1;
    continue;
  }
  writeFileSync(path, after, "utf8");
  try {
    /*
      ⚠ NO `--reporter=` FLAG. The first shape of this passed `--reporter=basic`,
      which vitest 4 does not have: it failed at STARTUP, all eight cases went
      red, and the red said nothing about the sabotage. The arm-name check below
      is what caught it — a driver that only asked "did it go red" would have
      reported eight clean catches on a run that never loaded the suite.
    */
    const run = spawnSync("npx", ["vitest", "run", SUITE], {
      cwd: REPO,
      encoding: "utf8",
      shell: true,
      maxBuffer: 32 * 1024 * 1024,
    });
    const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
    const red = run.status !== 0;
    if (testCase.mustStayGreen) {
      if (red) {
        console.log(`  FALSE RED    ${index + 1}. ${testCase.name}`);
        survived += 1;
      } else {
        console.log(`  HELD GREEN   ${index + 1}. ${testCase.name}`);
      }
      continue;
    }
    const namedTheRightArm = output.includes(testCase.expectRed);
    if (red && namedTheRightArm) {
      console.log(`  CAUGHT       ${index + 1}. ${testCase.name}`);
    } else if (red) {
      console.log(`  WRONG ARM    ${index + 1}. ${testCase.name}`
        + ` — red, but "${testCase.expectRed}" is not in the failures`);
      broken += 1;
    } else {
      console.log(`  SURVIVED     ${index + 1}. ${testCase.name}`);
      survived += 1;
    }
  } finally {
    restore(testCase.file);
  }
}

console.log("");
console.log(`${cases.length} case(s) · ${cases.length - survived - broken} caught`
  + ` · ${survived} survived · ${broken} broken`);
/* Restated at the end, because a `git status` after a crash is the only other
   way to learn this and nobody runs one. */
const dirty = execFileSync("git", ["status", "--short", "--", "scripts", "server"], {
  cwd: REPO,
  encoding: "utf8",
}).trim();
console.log(dirty === "" ? "tree restored" : `⚠ TREE NOT CLEAN:\n${dirty}`);

process.exit(0);
