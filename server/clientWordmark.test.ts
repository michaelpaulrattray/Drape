/**
 * #1916 · THE PRODUCT IS KLIEG, AND THE CLIENT MAY NOT DRAW THE OLD WORDMARK.
 *
 * The defect this refuses was found by eye, on a frame, two and a half months
 * after the rename: the canvas header drew `/drape-logo.svg` on every board
 * (`BoardHeader.tsx`), and the canvas's own loading screen rendered the word
 * `drape` in 15px semibold before the header had even painted
 * (`BrandLoader.tsx`). Both are gone. Nothing in the repository could have
 * said so, because a wordmark is not a symbol and no import graph reaches it.
 *
 * # WHAT IS ASKED, AND WHY IT IS THIS AND NOT "NO FILE SAYS DRAPE"
 *
 * The obvious guard — ban the word under `client/` — cannot be written
 * honestly, and trying to is this repository's single most repeated defect: a
 * regex standing in for something the code already states. The word is load
 * bearing in at least five shapes that must NOT move, and a reader built out
 * of exclusions for them would be wrong in both directions:
 *
 *   - **browser storage keys** (`drape_theme`, `drape_referral_code`,
 *     `drape_staff_auto_refresh`, `drape_active_session`, …) — renaming one
 *     silently discards every customer's stored value; the theme key would log
 *     the whole product back to its default on the deploy that did it
 *   - **invite and referral code FORMATS** (`DRAPE-XXXX-XXXX`) — those are
 *     real values in the database, not copy
 *   - **the avatar identity seed** (`ProfileVisual`, `StudioSlimHeader`) —
 *     the card naming this defect carved it out by name: it seeds a colour,
 *     and changing it recolours every fallback avatar
 *   - **downloaded file names** — lower-case, so this reading cannot see
 *     them; `client/src/foundation/downloadFilenameBrand.test.ts` reads that
 *     shape since #1992 — and `__DRAPE_RELEASE__`
 *   - **document paths in comments** (`docs/.../drape-redesign/…`)
 *
 * So this guard asks the narrow, mechanical question the defect actually was:
 * **does the client DRAW the old wordmark?** Three readings, no taxonomy:
 * a `drape-logo` asset reference, an `alt` naming the old product, and a
 * `drape-` file sitting in `client/public` (which Vite copies verbatim into
 * the build, so a dead one ships).
 *
 * # THE REMAINDER IS ENUMERATED AND ONLY SHRINKS
 *
 * `DRAWS_THE_OLD_MARK` is not a tolerance, it is a debt with an owner. Every
 * row is a surface whose image lives in the R2 bucket, and **there is no Klieg
 * wordmark in that bucket** — measured 2026-10-07 with its control:
 * `assets/drape-logo-tight.png` answers 200 and five Klieg spellings answer
 * 404. Minting brand assets into the production bucket is not a seat's act,
 * so those surfaces are carded, not quietly edited. A row that becomes false
 * REDDENS this suite until its line is deleted, which is the only direction
 * this list is allowed to move.
 */
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { readListedSource } from "./testing/listedSource";

/* This suite asks git itself the population question (`ls-files client`), so it
   spawns a real process and must not sit inside vitest's 5s default under a
   parallel run. Declared once per FILE, never on an arm, so an arm written
   beside it tomorrow inherits it (#741's derived-population shape). It also
   reads every tracked client file, which is the CONTENDED class — the two
   constants are the same 30s today, and the child-process one is named here
   because that is the population this suite is derived into. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** A reference to the retired wordmark ASSET, in any of the house shapes. */
const ASSET = /drape-logo/i;
/** An `alt` or `aria-label` telling a screen reader the old product's name. */
const LABEL = /(?:alt|aria-label)\s*=\s*(?:"|'|\{")\s*drape\b/i;

/**
 * COMMENT PROSE IS NOT A DRAW, AND THE CONTINUATION LINE IS WHY THIS IS A
 * STATE MACHINE RATHER THAN A PATTERN.
 *
 * The retirement's own two explanations name the asset they replaced, and a
 * guard that forced them to stop saying so would be buying its own green with
 * the only sentence telling the next reader why the component exists. The
 * first cut of this skipped a line whose first characters opened a comment —
 * and it still reddened, on the THIRD line of a four-line JSX block comment,
 * which begins with an ordinary word. A line-at-a-time reader cannot see that
 * it is inside anything.
 *
 * ⚠ BOTH HALVES FAIL TOWARD FINDING, which is what makes the skip admissible:
 *   - a block only OPENS on a line whose first non-space is `/*` or `{/*`, so
 *     a string or a regex carrying those characters mid-line cannot open one
 *   - a trailing `// old` on a real element does not skip it — only a line
 *     that STARTS a line comment does
 * And skipping a comment can never hide a real draw in the first place,
 * because a commented-out element renders nothing.
 */
const OPENS_BLOCK = /^\s*(?:\/\*|\{\/\*)/;
const LINE_COMMENT = /^\s*(?:\/\/|\*)/;

/** The lines of `source` that are CODE — block state carried across lines. */
function codeLines(source: string): string[] {
  const out: string[] = [];
  let inBlock = false;
  for (const line of source.split(/\r?\n/)) {
    if (inBlock) {
      if (line.includes("*/")) inBlock = false;
      continue;
    }
    if (OPENS_BLOCK.test(line)) {
      /* A one-line `/* x *​/` opens and closes on the same line. */
      if (!line.includes("*/")) inBlock = true;
      continue;
    }
    if (LINE_COMMENT.test(line)) continue;
    out.push(line);
  }
  return out;
}

/**
 * The surfaces still drawing it, each with the reason it could not move in
 * #1916's pass. ONE reason, and it is the same one: the image they draw lives
 * in the R2 bucket and no Klieg counterpart exists there yet.
 */
const DRAWS_THE_OLD_MARK: Record<string, string> = {
  "client/src/features/home/HomeNavbar.tsx":
    "the marketing navbar's logo is `${ASSETS_BASE_URL}/drape-logo-tight.png` — bucket asset",
  "client/src/pages/Login.tsx":
    "the sign-in header's logo is the same bucket asset",
  "client/src/pages/VerifyEmail.tsx":
    "the verify-email header's logo is the same bucket asset, and its body copy"
    + " names the sender of an email whose own logo is that asset too",
};

function trackedClientFiles(): string[] {
  /* git itself, so a file is in the population because it is COMMITTED rather
     than because a directory walk happened to reach it. */
  const out = execFileSync("git", ["ls-files", "client"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return out.split(/\r?\n/).map((line) => line.trim().replace(/\\/g, "/")).filter(Boolean);
}

/** Every tracked client file that DRAWS the retired mark, with what was found. */
function filesDrawingTheOldMark(files: string[]): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const file of files) {
    /* `readListedSource` because a listing and a read are two moments: a
       disposable planted by a sibling suite can vanish between them (#223). */
    const source = readListedSource(join(REPO_ROOT, file));
    if (source === null) continue;
    const hits: string[] = [];
    for (const line of codeLines(source)) {
      if (ASSET.test(line) || LABEL.test(line)) hits.push(line.trim());
    }
    if (hits.length > 0) found[file] = hits;
  }
  return found;
}

describe("#1916 · the client does not draw the retired wordmark", () => {
  it("⚠ CONTROL — the reader finds both shapes, and is not fooled by a storage key", () => {
    /* POSITIVE CONTROL FIRST. Every assertion below is vacuously satisfied by a
       reader that finds nothing, and a blind reader reads exactly like a clean
       tree (working law 2). */
    expect(ASSET.test('<img src="/drape-logo.svg" />'), "the asset shape").toBe(true);
    expect(ASSET.test("`${ASSETS_BASE_URL}/drape-logo-tight.png`"), "the bucket shape").toBe(true);
    expect(LABEL.test('<img alt="drape" />'), "the alt shape").toBe(true);
    expect(LABEL.test("aria-label='drape'"), "single quotes").toBe(true);

    /* NEGATIVE CONTROLS — the five load-bearing shapes named in the header. A
       guard that fired on any of these would be asking a shift to break a
       customer's stored theme in order to go green. */
    for (const safe of [
      'localStorage.getItem("drape_theme")',
      'const REFERRAL_STORAGE_KEY = "drape_referral_code";',
      "return `DRAPE-${seg()}-${seg()}`;",
      'identity={user ?? "drape"}',
      "a.download = 'drape-selection.zip';",
      " * (`docs/specs/Casting-ui-ux-design/drape-redesign/08-crew.md`).",
      "__DRAPE_RELEASE__",
    ]) {
      expect(ASSET.test(safe) || LABEL.test(safe), `must not fire on: ${safe}`).toBe(false);
    }

    /* The comment reader, driven in BOTH directions over a block with a
       CONTINUATION line — the shape that reddened this suite's first cut, and
       the only one a line-at-a-time reader cannot see. */
    const sample = [
      "      {/* #1916: the mark is Klieg's, and it is drawn in the DOM rather",
      "          than fetched as an image, because the retired `/drape-logo.svg`",
      '          rendered with alt="drape" in whatever face the machine had. */}',
      "      <KliegWordmark fontSize={15} />",
      "      <img src=\"/drape-logo.svg\" /> // retired",
    ].join("\n");
    const code = codeLines(sample);
    expect(code, "the whole block comment is prose and is skipped, continuation lines included")
      .toEqual(["      <KliegWordmark fontSize={15} />", "      <img src=\"/drape-logo.svg\" /> // retired"]);
    expect(
      code.filter((line) => ASSET.test(line) || LABEL.test(line)).length,
      "a real draw carrying a trailing comment is still FOUND",
    ).toBe(1);
  });

  it("⚠ no tracked client file draws it, outside the enumerated remainder", () => {
    const files = trackedClientFiles();
    /* The reader's own positive control: a blind `git ls-files client` returns
       nothing, which satisfies "no file draws it" perfectly happily. */
    expect(
      files.length,
      "`git ls-files client` saw no tracked client files — the reader is blind, not the tree clean",
    ).toBeGreaterThan(200);

    const drawing = filesDrawingTheOldMark(files);
    const unexpected = Object.keys(drawing).filter((file) => !(file in DRAWS_THE_OLD_MARK));
    expect(
      unexpected.map((file) => `${file} — ${drawing[file]!.join(" | ")}`),
      "a client surface draws the retired wordmark. The product is Klieg:"
      + " `client/src/foundation/KliegWordmark.tsx` is the mark, cut from the"
      + " locked brand reference. If the surface needs a raster from the R2"
      + " bucket, that asset does not exist yet — card it rather than adding a"
      + " row below.",
    ).toEqual([]);
  });

  it("⚠ the remainder only SHRINKS — a row that stopped being true is deleted, not kept", () => {
    const drawing = filesDrawingTheOldMark(trackedClientFiles());
    const stale = Object.keys(DRAWS_THE_OLD_MARK).filter((file) => !(file in drawing));
    expect(
      stale,
      "these files no longer draw the retired wordmark — delete their rows from"
      + " DRAWS_THE_OLD_MARK. A debt list that keeps a discharged row is a list"
      + " that stops meaning anything.",
    ).toEqual([]);
  });

  it("⚠ `client/public` ships no retired-wordmark asset — Vite copies it verbatim", () => {
    /* The two that were there (`drape-logo.svg`, `drape-logo-white.svg`) went
       out with #1916: the white one had had NO consumer at all, and the black
       one had exactly one, the canvas header. Both were still being copied into
       `dist/public` on every build, so the build shipped the old mark whether
       or not anything drew it. */
    const published = trackedClientFiles().filter((file) => file.startsWith("client/public/"));
    expect(
      published.length,
      "no tracked file under client/public — the reader is blind",
    ).toBeGreaterThan(0);
    expect(
      published.filter((file) => ASSET.test(file)),
      "a retired-wordmark asset is published in client/public and ships in every build",
    ).toEqual([]);
  });

  it("⚠ the browser tab says the product's name", () => {
    /* The most-read "Drape" in the product and the cheapest to miss: it is in
       no component, so no UI sweep reaches it, and it is on every page, every
       bookmark and every history entry. */
    const html = readListedSource(join(REPO_ROOT, "client/index.html"));
    expect(html, "client/index.html could not be read").not.toBeNull();
    expect(
      /<title>\s*Klieg\s*<\/title>/.test(html!),
      `the tab title is not the product's name — found: ${/<title>[^<]*<\/title>/.exec(html!)?.[0] ?? "no <title> at all"}`,
    ).toBe(true);
  });
});

/**
 * #1934 · AND IT MAY NOT SAY THE OLD PRODUCT'S NAME EITHER.
 *
 * The suite above asks whether the client DRAWS the retired mark. It went
 * green, and two and a half months after the rename a customer could still
 * READ the old name in four places on the way in: the sign-in page's own
 * heading said **Welcome to Drape**, the homepage video placeholder said
 * *"See how Drape transforms your creative workflow"*, the verify-email page
 * said *"Open the email from Drape"*, and the canvas's cast dialog said
 * *"Drape will use the strongest complete coverage already available."*
 *
 * An asset reference and a sentence are different shapes, and #1916's reader
 * was built for the first on purpose — so this is a second question in the
 * same file rather than a second file, because it needs #1916's `codeLines`
 * and a second copy of that state machine is the drift this repository has
 * been bitten by (working law 4).
 *
 * # THE WORD BOUNDARY IS WHAT MAKES THIS WRITABLE
 *
 * The header above explains why *"no file says drape"* cannot be written
 * honestly, and it is right — but every shape it names is excluded by
 * `/\bDrape\b/` on its own, with no taxonomy and no exclusion list:
 *
 *   - `DrapeStudio`, `DrapeStudio.tsx`, `pages/DrapeStudio` — a word character
 *     follows, so the boundary does not close. The legacy studio's symbol is
 *     the most common hit in the tree and this reader never sees it.
 *   - `drape_theme`, `drape_referral_code`, `drape_staff_auto_refresh` — `_`
 *     is a word character; same reason.
 *   - `DRAPE-XXXX`, `__DRAPE_RELEASE__`, `drape-logo-tight.png`,
 *     `drape-selection.zip`, `docs/…/drape-redesign/…` — this reader is case
 *     SENSITIVE, and every one of those is lower or upper case, never the
 *     capitalised product name a sentence uses.
 *
 * What is left is the shape nothing else in the repository can see: the
 * product's name, capitalised, standing alone, in prose. Each of those five
 * is a NEGATIVE CONTROL below rather than a claim in this comment.
 *
 * # POPULATION, AND THE TWO THINGS DELIBERATELY OUT OF IT
 *
 * Every tracked file under `client/src` and `shared` — `.ts`, `.tsx` and
 * `.css`, which is all three extensions those two trees contain. `shared` is
 * in it because a customer reads `APP_UPDATE_REQUIRED_MESSAGE` as a toast, and
 * it was the fifth instance: the card named three, the sweep found two more,
 * and that one is not even in the client bundle — the server sends it over the
 * wire, so a bundle grep could never have found it.
 *
 *   - **Comments are skipped**, by #1916's reader, for #1916's reason: the
 *     rename's own explanations name what they replaced, and the four CSS
 *     files that still carry a `Drape™` banner are history rather than copy.
 *   - **`*.test.ts` / `*.test.tsx` are out of the population**, and this suite
 *     is the worked example of why: a guard must be able to quote the string
 *     it refuses, and the arms below quote all five. A test ships to nobody.
 *
 * ⚠ `server/` IS NOT IN THIS POPULATION AND THAT IS A DEBT, NOT A DECISION.
 * The same sweep found customer-visible prose there — a tattoo refusal, the
 * referral invite's sender fallback, the Klaviyo `app_name`, and the identity
 * PDF — and the carve-outs that population needs are real work (the Railway
 * service is `--service Drape`, the repo is `michaelpaulrattray/Drape`, the
 * Atlas file is `drape-architecture.json`, and log lines are staff-only). It
 * is carded rather than guessed at here. The verification email moved in
 * #1934's own commit for one reason only: `"Open the email from Klieg"` is
 * true only if the sender says Klieg.
 */

/** The product's name, capitalised and standing alone — the shape prose uses. */
const SAYS_THE_OLD_NAME = /\bDrape\b/;

/**
 * The code lines that may say it, with the reason — EMPTY since #1992. Its
 * one row was the moderator reconciliation CSV's title (a STAFF download,
 * carved out by #1934 by name); #1992 moved it onto `PRODUCT_NAME`, and the
 * row was deleted rather than kept, which is the arm below doing its job.
 * A new row is a carded decision, not a convenience.
 */
const MAY_SAY_IT: Record<string, string> = {};

function trackedCopyFiles(): string[] {
  const out = execFileSync("git", ["ls-files", "client/src", "shared"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return out
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\\/g, "/"))
    .filter((file) => /\.(?:ts|tsx|css)$/.test(file))
    .filter((file) => !/\.test\.tsx?$/.test(file));
}

/** Every file in the population whose CODE says the old name, with the lines. */
function filesSayingTheOldName(files: string[]): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const file of files) {
    /* `readListedSource` because a listing and a read are two moments: a
       disposable planted by a sibling suite can vanish between them (#223). */
    const source = readListedSource(join(REPO_ROOT, file));
    if (source === null) continue;
    const hits = codeLines(source)
      .filter((line) => SAYS_THE_OLD_NAME.test(line))
      .map((line) => line.trim());
    if (hits.length > 0) found[file] = hits;
  }
  return found;
}

describe("#1934 · the client does not say the old product's name to a customer", () => {
  it("⚠ CONTROL — it finds all five renamed lines, and none of the load-bearing shapes", () => {
    /* POSITIVE CONTROL FIRST, on the real strings this card removed, because
       every assertion below is vacuously satisfied by a blind reader and a
       blind reader reads exactly like a renamed tree (working law 2). */
    for (const copy of [
      "                    Welcome to Drape",
      "                    See how Drape transforms your creative workflow",
      "                  Drape will use the strongest complete coverage already available.",
      '                "Open the email from Drape",',
      '  "Drape was updated while this page was open. Reload to continue — nothing was charged.";',
    ]) {
      expect(SAYS_THE_OLD_NAME.test(copy), `must find: ${copy.trim()}`).toBe(true);
    }

    /* NEGATIVE CONTROLS — the five shapes #1916's header names as load
       bearing, each excluded by the boundary alone rather than by a list. A
       guard that fired on any of these would ask a shift to discard every
       customer's stored theme, or rename a code format that is a real value in
       the database, in order to go green. */
    for (const safe of [
      'const DrapeStudio = staffPage(() => import("./pages/DrapeStudio"));',
      '    "pages/DrapeStudio",',
      'localStorage.getItem("drape_theme")',
      'const REFERRAL_STORAGE_KEY = "drape_referral_code";',
      "return `DRAPE-${seg()}-${seg()}`;",
      'identity={user ?? "drape"}',
      "a.download = 'drape-selection.zip';",
      "__DRAPE_RELEASE__",
      "const logoUrl = `${ASSETS_BASE_URL}/drape-logo-tight.png`;",
      "import x from '@/docs/drape-redesign/08-crew';",
    ]) {
      expect(SAYS_THE_OLD_NAME.test(safe), `must not fire on: ${safe}`).toBe(false);
    }

    /* And the comment reader on THIS question — a `Drape™` banner is history,
       a continuation line below it is still prose, and a real string is
       found. This is the shape the four CSS files carry. */
    const sample = [
      "/**",
      " * Drape™ Keyframe Animations",
      "   still inside the block, and this line says Drape too.",
      " */",
      "// Drape, in a line comment",
      'const heading = "Welcome to Drape";',
    ].join("\n");
    expect(
      codeLines(sample).filter((line) => SAYS_THE_OLD_NAME.test(line)),
      "only the real string survives the comment reader",
    ).toEqual(['const heading = "Welcome to Drape";']);
  });

  it("⚠ no shipped client or shared file says it, outside the enumerated remainder", () => {
    const files = trackedCopyFiles();
    /* The reader's own positive control: a blind `git ls-files` returns
       nothing, which satisfies "nothing says it" perfectly happily. */
    expect(
      files.length,
      "`git ls-files client/src shared` saw nothing — the reader is blind, not the tree renamed",
    ).toBeGreaterThan(200);

    const saying = filesSayingTheOldName(files);
    const unexpected = Object.keys(saying).filter((file) => !(file in MAY_SAY_IT));
    expect(
      unexpected.map((file) => `${file} — ${saying[file]!.join(" | ")}`),
      "a customer-visible line says the old product's name. The product is"
      + " Klieg: say Klieg, or drop the name where the sentence reads better"
      + " without it. If the line is genuinely staff-only, that is a second"
      + " decision and it is carded, not a row added below:",
    ).toEqual([]);
  });

  it("⚠ the remainder only SHRINKS — a row that stopped being true is deleted, not kept", () => {
    const saying = filesSayingTheOldName(trackedCopyFiles());
    const stale = Object.keys(MAY_SAY_IT).filter((file) => !(file in saying));
    expect(
      stale,
      "these files no longer say the old name — delete their rows from"
      + " MAY_SAY_IT. A debt list that keeps a discharged row is a list that"
      + " stops meaning anything.",
    ).toEqual([]);
  });
});
