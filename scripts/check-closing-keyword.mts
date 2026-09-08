/**
 * THE GATE'S HALF OF #376 — DOES THIS PULL REQUEST CLOSE A CARD BY ACCIDENT?
 *
 * Reads a pull request's TITLE and BODY and refuses either one that carries a
 * closing keyword before a card number. The reasoning, the eight instances and
 * the pattern all live in `lib/closingKeyword.mts`; this file is its I/O.
 *
 * ⚠ **THE TITLE IS READ, AND IT IS NOT PADDING.** A squash merge writes the
 * commit subject as `<PR title> (#N)`, so a title carrying the token reaches
 * `main` and closes from there — which is how instance 6 happened, from an
 * edition commit's subject rather than any PR body.
 *
 * ⚠ **IT REFUSES WHEN IT CANNOT READ, never when it has nothing to say.** An
 * unreadable PR is a checker that proved nothing, and a green check over a
 * question nobody answered is this repository's most-repeated defect (invariant
 * 7). An empty title and body is a real answer and passes.
 *
 *   npx tsx scripts/check-closing-keyword.mts --pr 682
 *   npx tsx scripts/check-closing-keyword.mts --file some-body.md
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { closingKeywordHits, closingKeywordRefusal } from "./lib/closingKeyword.mts";

const args = process.argv.slice(2);
const valueOf = (flag: string): string | null => {
  const at = args.indexOf(flag);
  return at >= 0 && at + 1 < args.length ? args[at + 1] : null;
};

const unknown = args.filter((a, i) =>
  a.startsWith("--") && !["--pr", "--file"].includes(a) && !(i > 0 && ["--pr", "--file"].includes(args[i - 1])));
if (unknown.length > 0) {
  console.log(`REFUSED: unknown flag(s) ${unknown.join(", ")} — this tool takes --pr <n> or --file <path>.`);
  process.exit(1);
}

const pr = valueOf("--pr");
const file = valueOf("--file");

if (pr === null && file === null) {
  console.log("usage: check-closing-keyword --pr <number> | --file <path>");
  process.exit(1);
}

/** What is being read, and what it is called in a refusal. */
let where: string;
let text: string;

if (file !== null) {
  where = `${file}`;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    console.log(`REFUSED: could not read ${file} — ${(error as Error).message}`);
    process.exit(1);
  }
} else {
  where = `pull request #${pr}`;
  try {
    const raw = execFileSync(
      process.platform === "win32" ? "gh.exe" : "gh",
      ["pr", "view", String(pr), "--json", "title,body"],
      { encoding: "utf8" },
    );
    const read = JSON.parse(raw) as { title?: unknown; body?: unknown };
    /* ⚠ A MISSING FIELD IS A FAILED READ, NOT AN EMPTY ONE. `gh` answering
       without `body` means the shape changed underneath this tool, and reading
       that as "nothing to check" is the green-over-nothing failure again. An
       EMPTY STRING is a real answer and passes below. */
    if (typeof read.title !== "string" || typeof read.body !== "string") {
      console.log(`REFUSED: gh answered for #${pr} without a title or body — nothing has been checked.`);
      process.exit(1);
    }
    text = `${read.title}\n${read.body}`;
  } catch (error) {
    console.log(`REFUSED: could not read pull request #${pr} — ${(error as Error).message}`);
    console.log("  The check has proven nothing; it does not pass by being unable to look.");
    process.exit(1);
  }
}

const hits = closingKeywordHits(text);
if (hits.length > 0) {
  console.log(closingKeywordRefusal(`${where}'s title or body`, hits));
  process.exit(1);
}

console.log(`closing keyword: none — ${where} closes no card on merge.`);
process.exit(0);
