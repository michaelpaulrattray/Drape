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
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DEPLOY_SOURCE_REF } from "../scripts/lib/ritePushSequence.mts";
import { readListedSource } from "./testing/listedSource";

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

/**
 * ⚠ **A LISTED ENTRY CAN LEAVE BETWEEN THE LISTING AND THE READ** (#223, and
 * `server/testing/listedSource.test.ts` is the guard that caught this file's
 * first cut). `scripts/lib` carries disposables that parallel suites create and
 * delete, so every `statSync` on a listed path passes `throwIfNoEntry: false`
 * and every read goes through `readListedSource`, which answers `null` for an
 * absent file and still THROWS on any other error. A bare read here would
 * ENOENT the deploy rite on a clean tree.
 *
 * The directory listing itself still REFUSES — a scanned root that has moved is
 * a broken guard, not a missing file, and a scan silently short is exactly what
 * the population arm below exists to catch.
 */
function filesToScan(): string[] {
  const found = SCANNED_FILES.map((file) => path.join(ROOT, file)).filter(
    (file) => statSync(file, { throwIfNoEntry: false })?.isFile() === true,
  );
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
      if (!SCANNED_EXTENSIONS.includes(path.extname(entry))) continue;
      if (statSync(full, { throwIfNoEntry: false })?.isFile() === true) found.push(full);
    }
  }
  return found;
}

/**
 * Everything a document may QUOTE without asserting: fenced code, blockquotes,
 * and — **in prose only** — any double-quoted span. #360's exact lesson: the
 * corrected paragraph in `CLAUDE.md` reproduces the false sentence in order to
 * strike it, and a guard that fired on that would forbid the correction from
 * being written down.
 *
 * ⚠ **THE DOUBLE-QUOTE STRIP IS MARKDOWN-ONLY, AND THE FIRST CUT APPLIED IT
 * EVERYWHERE** (PR #582 review, finding 1). Three of the five scan targets are
 * CODE directories, where double quotes are the house string style — so a
 * `say("every push to main deploys …")` in a `scripts/lib` helper read as a
 * quotation and passed. **A runtime message is the prose a shift reads most**,
 * which made that hole systematic rather than the exotic remainder the docblock
 * below owns up to. Nothing was lost by narrowing it: all three shipped copies
 * and both real negative controls live in comments or markdown.
 */
type SourceKind = "md" | "code";

function withoutQuotation(source: string, kind: SourceKind): string {
  const unquoted = source.replace(/```[\s\S]*?```/g, " ").replace(/^\s*>.*$/gm, " ");
  if (kind !== "md") return unquoted;
  return unquoted.replace(/"[^"\n]*"/g, " ").replace(/[“][^”\n]*[”]/g, " ");
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

/** Defaults to `code`, the STRICTER reading — a new caller cannot get the lax one by forgetting. */
function wrongClaims(source: string, kind: SourceKind = "code"): Array<{ ref: string; sentence: string }> {
  const hits: Array<{ ref: string; sentence: string }> = [];
  for (const match of withoutQuotation(source, kind).matchAll(CLAIM)) {
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
      const source = readListedSource(file);
      if (source === null) continue; /* it left between the listing and the read */
      const kind: SourceKind = path.extname(file) === ".md" ? "md" : "code";
      for (const hit of wrongClaims(source, kind)) {
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
    expect(wrongClaims('This sentence read "Every push to `main` deploys" until it was corrected', "md"))
      .toEqual([]);
    expect(wrongClaims("> Every push to `main` deploys, and the founder dogfoods paid rolls", "md")).toEqual([]);
    expect(wrongClaims("```\nEvery push to `main` deploys\n```", "md")).toEqual([]);

    /* And the same words UNQUOTED are still a claim — the mention test must not
       have been bought by turning the guard off. */
    expect(wrongClaims("Every push to `main` deploys, and the founder dogfoods paid rolls", "md"))
      .toHaveLength(1);

    expect(wrongClaims("A merged PR has not shipped anything; the rite is what deploys.")).toEqual([]);
    expect(wrongClaims("Railway watches local-migration, and a squash merge only moves main.")).toEqual([]);
    expect(wrongClaims("Product code goes branch, PR, gate; then run the rite to deploy.")).toEqual([]);
  });

  /*
    PR #582 REVIEW, FINDING 1. The double-quote strip is for markdown prose. In
    a code file double quotes are the house string style, so applying it there
    let a RUNTIME MESSAGE — the prose a shift reads most — carry the false claim
    inside a string literal and pass as a quotation.
  */
  it("catches a false claim inside a code string literal, and still forgives it in prose", () => {
    const inCode = 'say("Every push to `main` deploys — run the rite after merging");';
    expect(wrongClaims(inCode, "code")).toHaveLength(1);
    expect(wrongClaims(inCode, "md")).toEqual([]);

    /* And the strictness is the DEFAULT, so a new caller cannot get the lax
       reading by forgetting the argument. */
    expect(wrongClaims(inCode)).toHaveLength(1);
  });
});
