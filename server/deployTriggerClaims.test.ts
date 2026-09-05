/**
 * #296 — NO DOCUMENT MAY TELL A SHIFT THAT A MERGE TO `main` DEPLOYS.
 *
 * **Measured, not argued** (foreman-121, 2026-08-30): PR #294 squash-merged to
 * `main` at `09:46Z`; twenty-five minutes later production was still serving the
 * previous build, and Railway had created **no deployment at all** for the merge
 * commit — not failed, not building, never started. Railway watches
 * `local-migration`, and a squash merge only moves `main`.
 *
 * The reason this is worth a guard rather than a one-line edit is the reading:
 * **every check a shift naturally reaches for agrees with the merge.**
 * `gh pr view` says `MERGED`; `git log origin/main` carries the commit; and
 * `/api/health` returns `200` — from the OLD process. So a shift that merged,
 * saw green, and wrote "shipped" would have been wrong in exactly the way
 * working law 1 names: a deploy reporting success is a claim, the changed bytes
 * are the fact.
 *
 * ⚠ **And the sentence had THREE copies.** `CLAUDE.md`'s *"Every push to `main`
 * deploys"* was the authority, but `scripts/lib/refineDriver.mts` and
 * `server/castingV2/refineRecovery.test.ts` each carried their own, because a
 * correction tracks readership rather than authority. Fixing one and calling it
 * done is how the wrong model survives — which is the whole of working law 7.
 *
 * # What this arm does, and the two things it deliberately does not
 *
 * It scans the prose a shift actually reads and refuses a sentence that names
 * **the wrong ref as the deploying one**. It is a DECLARATION test, not a
 * mention test (#360's class): a document may name `main`, may quote the
 * corrected sentence, and may explain the mistake at length — what it may not do
 * is assert that pushing or merging `main` ships anything.
 *
 * The deploying ref is **derived from `DEPLOY_SOURCE_REF`**, the constant the
 * rite itself pushes to, so this guard cannot drift into being a second source
 * of truth about which ref deploys (working law 4).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DEPLOY_SOURCE_REF } from "../scripts/lib/ritePushSequence.mts";

const ROOT = process.cwd();

/**
 * The files a shift reads for the deploy model. Deliberately narrow: this is
 * about the documents that TEACH the model, not every string in the tree.
 * `.agents/` is gitignored and unreachable from CI, so it cannot be scanned.
 */
const SCANNED_FILES = ["CLAUDE.md", "AGENTS.md"];
const SCANNED_DIRS = [
  path.join("scripts", "lib"),
  path.join("server", "castingV2"),
  path.join(".claude", "skills", "deploy-railway"),
];
const SCANNED_EXTENSIONS = [".md", ".mts", ".ts"];

function filesToScan(): string[] {
  const found = SCANNED_FILES.map((file) => path.join(ROOT, file)).filter((file) => {
    try {
      return statSync(file).isFile();
    } catch {
      return false;
    }
  });
  for (const dir of SCANNED_DIRS) {
    const absolute = path.join(ROOT, dir);
    let entries: string[];
    try {
      entries = readdirSync(absolute);
    } catch {
      throw new Error(`#296 guard: ${dir} is not readable — the scan has drifted off the tree.`);
    }
    for (const entry of entries) {
      const full = path.join(absolute, entry);
      if (statSync(full).isFile() && SCANNED_EXTENSIONS.includes(path.extname(entry))) {
        found.push(full);
      }
    }
  }
  return found;
}

/**
 * Everything a document may QUOTE without asserting: fenced code, blockquotes,
 * and any double-quoted span. #360's exact lesson — the corrected paragraph in
 * `CLAUDE.md` reproduces the false sentence in order to strike it, and a guard
 * that fired on that would forbid the correction from being written down.
 */
function withoutQuotation(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*>.*$/gm, " ")
    .replace(/"[^"\n]*"/g, " ")
    .replace(/[“][^”\n]*[”]/g, " ");
}

/**
 * A CLAIM that pushing or merging `main` deploys. Returns the ref named.
 *
 * ⚠ **BOTH HALVES OF THIS PATTERN WERE WIDER IN THE FIRST DRAFT AND IT FOUND
 * TWO FALSE POSITIVES IN THE REAL TREE**, which is the reason they are narrow
 * and the reason both are kept below as negative controls:
 *
 * - the REF was any word, so *"pushing to a branch that deploys production"*
 *   (`scripts/lib/pushPaths.mts`) read as a claim about a branch called "a".
 *   Only `main`, `origin/main` and a `main:<ref>` refspec are claims about our
 *   deploy trigger; anything else is ordinary prose.
 * - the VERB allowed `deploy` as well as `deploys`, so *"direct pushes to main
 *   are the deploy rite's alone"* (`CLAUDE.md`) matched on the NOUN in "deploy
 *   rite". The verb must be asserted — `deploys`, `ships`, `will deploy`,
 *   `triggers a build`.
 *
 * The cost of that narrowing is stated rather than hidden: an exotic phrasing
 * of the same falsehood can slip past. This guard is a floor, not a proof, and
 * its real job is that the three sentences which actually shipped cannot come
 * back.
 */
const CLAIM =
  /\b(?:every )?(?:push(?:es|ing)? to|merg(?:e|es|ing) (?:to|into))\s+`?((?:origin\/)?main(?::[\w-]+)?)`?[^.\n]{0,60}?\b(?:deploys|ships|will deploy|triggers a (?:railway )?(?:build|deploy))\b/gi;

/** The ref a claim may legally name — derived, never restated. */
const DEPLOYING_REF = DEPLOY_SOURCE_REF;

function wrongClaims(source: string): Array<{ ref: string; sentence: string }> {
  const hits: Array<{ ref: string; sentence: string }> = [];
  for (const match of withoutQuotation(source).matchAll(CLAIM)) {
    const ref = match[1]!.replace(/`/g, "");
    /* `main:local-migration` is the refspec the rite pushes — it lands on the
       deploying ref, so a claim about it is true. */
    const lands = ref.includes(":") ? ref.split(":")[1]! : ref;
    if (lands !== DEPLOYING_REF) hits.push({ ref, sentence: match[0] });
  }
  return hits;
}

describe("#296 · nothing tells a shift that a merge to main deploys", () => {
  it("is looking at a real population, not an empty one", () => {
    const files = filesToScan();
    expect(files.length).toBeGreaterThan(10);
    expect(files.map((f) => path.basename(f))).toContain("CLAUDE.md");
    expect(files.map((f) => path.basename(f))).toContain("refineRecovery.test.ts");
  });

  it("derives the deploying ref from the rite rather than restating it", () => {
    expect(DEPLOYING_REF).toBe(DEPLOY_SOURCE_REF);
    /* If someone changes what production builds from, this guard follows. */
    expect(DEPLOYING_REF).not.toBe("main");
  });

  it("finds no document claiming a push or merge of main deploys", () => {
    const offenders: string[] = [];
    for (const file of filesToScan()) {
      for (const hit of wrongClaims(readFileSync(file, "utf8"))) {
        offenders.push(`${path.relative(ROOT, file)} — "${hit.sentence.trim()}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /*
    THE INSTRUMENT'S OWN CONTROLS. A scanner that cannot fail proves nothing,
    and one that fires on any mention would forbid the correction from being
    written down — which is the #360 class this guard is most likely to fall
    into, because the corrected paragraph in CLAUDE.md quotes the old sentence.
  */
  it("catches each of the three sentences that actually shipped", () => {
    expect(wrongClaims("Every push to `main` deploys, and the founder dogfoods paid rolls")).toHaveLength(1);
    expect(wrongClaims("Every push to `main` deploys, and a deploy kills the process")).toHaveLength(1);
    expect(wrongClaims("merging to main deploys production")).toHaveLength(1);
    expect(wrongClaims("A merge into `main` triggers a Railway build")).toHaveLength(1);
  });

  it("accepts the true claims, including the rite's own refspec", () => {
    expect(wrongClaims("Every push to `local-migration` triggers a Railway build + deploy")).toEqual([]);
    expect(wrongClaims("Every push to `main:local-migration` deploys production")).toEqual([]);
  });

  /*
    THE TWO FALSE POSITIVES THE FIRST DRAFT FOUND IN THE REAL TREE, kept
    verbatim. Both are true sentences that must never be flagged; each is why
    one half of the pattern is narrow.
  */
  it("does not fire on the two real sentences that only LOOK like the claim", () => {
    expect(wrongClaims(
      "goes branch → PR → gate; direct pushes to main are the deploy rite's alone.",
    )).toEqual([]);
    expect(wrongClaims(
      "driving it means pushing to a branch that deploys production — see the doc's door A",
    )).toEqual([]);
  });

  it("is a declaration test, so the correction may quote what it is correcting", () => {
    /* The shape CLAUDE.md's corrected paragraph actually uses — a mention. */
    expect(wrongClaims('This sentence read "Every push to `main` deploys" until 2026-09-06, and it was false'))
      .toEqual([]);
    expect(wrongClaims("> Every push to `main` deploys, and the founder dogfoods paid rolls")).toEqual([]);
    expect(wrongClaims("```\nEvery push to `main` deploys\n```")).toEqual([]);

    /* And the same words UNQUOTED are still a claim — the mention test must not
       have been bought by turning the guard off. */
    expect(wrongClaims("Every push to `main` deploys, and the founder dogfoods paid rolls")).toHaveLength(1);

    expect(wrongClaims("A merged PR has not shipped anything; the rite is what deploys.")).toEqual([]);
    expect(wrongClaims("Railway watches local-migration, and a squash merge only moves main.")).toEqual([]);
    expect(wrongClaims("Product code goes branch, PR, gate; then run the rite to deploy.")).toEqual([]);
  });
});
