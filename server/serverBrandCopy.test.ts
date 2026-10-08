/**
 * NO CUSTOMER EVER READS THE OLD NAME IN A SENTENCE THE SERVER WROTE — #1955.
 *
 * # What this guards, and why a bare grep could not
 *
 * The product is Klieg. The repository, the Railway service, the GitHub slug,
 * a cookie, a referral-code prefix, several R2 object keys and a great deal of
 * prose all still say Drape, and **most of that is correct** — renaming a
 * persisted identifier invalidates live data, and renaming a docblock changes
 * nothing a customer can see. So "no Drape in `server/`" is the wrong rule: it
 * would be red forever and would be silenced rather than obeyed.
 *
 * The rule this holds is narrow and is the one that matters: **a STRING
 * LITERAL in `server/` that a customer could read must not contain the old
 * name.** Everything else is enumerated below with the reason it stays, in the
 * shape `ACCOUNT_DELETION_DISPOSITIONS` uses for tables — a declared map held
 * against a derived population, in BOTH directions, so the list cannot rot
 * quietly in either.
 *
 * # The population is derived, never typed
 *
 * Every `*.ts` under `server/` except `*.test.ts`, read off disk. A file added
 * tomorrow is in the population the moment it exists, which is the half a
 * hand-written list can never have.
 *
 * # Why it exists at all
 *
 * `server/db/referrals.ts` records the last rename in its own docblock: *"the
 * FormaStudio→Drape rename fixed this file and missed that quotation, so every
 * mistyping customer was told to type `FORMA-XXXXXX` for six months."* #1944
 * fixed the client and four brand lines; #1955's own body named six server
 * lines and the real figure was **thirteen** — the identity PDF alone spelled
 * the name in eight literals the card counted as three. A rename sweep that is
 * a person reading a grep misses some, every time; this is the arm that says
 * which.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { PRODUCT_NAME } from "../shared/brand";

const SERVER_ROOT = join(import.meta.dirname, "..", "server");

/**
 * THE OLD NAME, IN EVERY SPELLING THAT HAS EVER REACHED A CUSTOMER.
 *
 * Case-insensitive, so `drape`, `Drape` and `DRAPE` are one question — the PDF
 * printed all three.
 */
const OLD_NAME = /drape/i;

/**
 * WHAT MAY STILL SAY THE OLD NAME, AND WHY — one entry per reason, never per
 * occurrence.
 *
 * Each is a pattern matched against the LINE. A line that matches none of them
 * and contains the old name inside a string literal is the finding.
 *
 * ⚠ **THE FABRIC WORD IS FIRST AND IS NOT AN EXEMPTION — IT IS A DIFFERENT
 * WORD.** `draped`, `drape over`, `same fabric weight and drape`: eleven
 * occurrences across `castViewPackage.ts`, `vtoGeneration.ts` and
 * `statedCovering.ts` are ordinary English about cloth, inside prompts an
 * engine reads. A sweep that "fixed" those would change what the engines are
 * told about clothing, which is the one way a copy card could break a picture.
 */
const ALLOWED: ReadonlyArray<{ why: string; pattern: RegExp }> = [
  {
    /*
      ⚠ THE INFLECTIONS ARE WRITTEN OUT RATHER THAN MATCHED LOOSELY, and the
      guard's own positive control is why. This was `/drapes?d?\b/i`, which
      matches the bare word `Drape` — so it swallowed `Drape Casting Studio`,
      `alt="Drape"` and three other real brand lines, and because `ALLOWED` is
      ordered it answered before their own entries could. An exemption wide
      enough to cover the thing it is distinguishing itself FROM is not an
      exemption. These three alternatives are every fabric use in the tree
      (eleven occurrences) and none of them can match a brand phrase.
    */
    why: "the English word for how cloth hangs — not the brand, and rewriting it changes what an engine is told about clothing",
    pattern: /\bdraped\b|\bdrape over\b|\bweight and drape\b/i,
  },
  {
    why: "a PERSISTED identifier: a referral-code prefix, a cookie name, Stripe metadata keys, an R2 object key, a refusal-tag symbol. Renaming any of these invalidates live data, logs out a control, or 404s an asset — a data decision, not copy",
    pattern: /DRAPE-|drape_device|drapeUserId|drapeChangeRequestId|hero\/drape-|drape-logo-tight|Symbol\.for\("drape/,
  },
  {
    why: "the GitHub repository slug the Crew desk reads its own queue from — a fact about where this lives, which a rename does not change",
    pattern: /michaelpaulrattray\/Drape/,
  },
  {
    why: "the Crew desk's own User-Agent — a staff tool identifying itself to GitHub, read by no customer",
    pattern: /"drape-crew-desk"/,
  },
  {
    why: "a server log line, which no customer reads (CLAUDE.md's metadata-only boundary keeps these off every customer surface)",
    pattern: /carries no Drape tracking metadata/,
  },
  {
    why: "a dead export already dispositioned by the cleanup milestone's table, which records its own measurement: nothing in the product reaches that constant (scripts/check-cleanup-dispositions.mts)",
    /*
      ⚠ THE SYMBOL IS `BRAND_NAME`, which is NOT the shared constant this file
      imports, and a blanket rename across this card's files briefly made this
      pattern say `PRODUCT_NAME` — which matches nothing, so the exemption went
      dead and the legacy line became a finding. It is the legacy twin's own
      name and it stays spelled that way until #29 deletes the module.
    */
    pattern: /^export const BRAND_NAME = 'DRAPE';$/,
  },
  {
    why: "the email logo's alt text, deliberately left with #1921, which owns that email's artwork",
    pattern: /alt="Drape"/,
  },
];

function allowedBy(line: string): string | null {
  for (const entry of ALLOWED) {
    if (entry.pattern.test(line)) return entry.why;
  }
  return null;
}

/**
 * WHICH LINES ARE COMMENT — tracked as a block, not guessed per line.
 *
 * A comment may say the old name freely: it is read by an engineer, never by a
 * customer, and several of them are the record of the rename itself. What this
 * must not do is mistake either kind of line for the other, in either
 * direction.
 *
 * ⚠ **IT WAS A PER-LINE TEST AND THE GUARD CAUGHT IT ON ITSELF.** The first
 * version asked whether a line's first non-whitespace was `//`, `/*`, `*` or
 * `*​/` — which is true of a docblock and FALSE of a continuation line inside a
 * `/* … *​/` block that does not start its lines with `*`. This repository
 * writes a great many of those, and two of them are in this very card's diff,
 * so the guard reported two of its own author's comments as customer copy.
 * A guard that cries wolf about prose is a guard that gets silenced.
 *
 * ⚠ **A BLOCK OPENS ONLY WHEN THE TRIMMED LINE STARTS WITH `/*`, and that
 * narrowness is deliberate rather than lazy.** Scanning anywhere in the line
 * would let a `/*` inside a STRING LITERAL open a comment that never closes,
 * and every brand word after it would go unread — a failure toward silence,
 * which is the one direction a guard may not fail. At line start it cannot be
 * inside a string, and it is how every block comment in this tree is written.
 */
function commentMask(lines: readonly string[]): boolean[] {
  let inBlock = false;
  return lines.map((line) => {
    const trimmed = line.trimStart();
    if (inBlock) {
      if (trimmed.includes("*/")) inBlock = false;
      return true;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inBlock = true;
      return true;
    }
    return trimmed.startsWith("//") || trimmed.startsWith("*");
  });
}

function serverFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full, { throwIfNoEntry: false });
    if (!stat) continue;
    if (stat.isDirectory()) {
      serverFiles(full, found);
      continue;
    }
    if (!entry.endsWith(".ts")) continue;
    if (entry.endsWith(".test.ts")) continue;
    found.push(full);
  }
  return found;
}

interface Hit {
  where: string;
  line: string;
}

function brandHits(): { findings: Hit[]; allowed: Map<string, number>; filesRead: number } {
  const files = serverFiles(SERVER_ROOT);
  const findings: Hit[] = [];
  const allowed = new Map<string, number>();
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    const isComment = commentMask(lines);
    lines.forEach((line, index) => {
      if (!OLD_NAME.test(line)) return;
      if (isComment[index]) return;
      const why = allowedBy(line);
      if (why) {
        allowed.set(why, (allowed.get(why) ?? 0) + 1);
        return;
      }
      findings.push({
        where: `${relative(SERVER_ROOT, file).split(sep).join("/")}:${index + 1}`,
        line: line.trim().slice(0, 160),
      });
    });
  }
  return { findings, allowed, filesRead: files.length };
}

describe("the server never writes the old brand name where a customer can read it (#1955)", () => {
  /*
    THE READER'S OWN CONTROLS FIRST (working law 2). A walk that found no files,
    or a matcher that could not recognise the word, would make every assertion
    below pass by measuring nothing — which is this repository's most expensive
    recurring failure.
  */
  it("the walk reads the real server tree", () => {
    const { filesRead } = brandHits();
    expect(filesRead, "the walk found almost nothing — it is pointed at the wrong place")
      .toBeGreaterThan(300);
  });

  it("POSITIVE CONTROL — the matcher recognises each spelling the PDF used", () => {
    for (const spelling of ["drape", "Drape", "DRAPE"]) {
      expect(OLD_NAME.test(`doc.text('${spelling} Casting Studio')`)).toBe(true);
    }
    /* And a line with no exemption is a finding rather than silently allowed. */
    expect(allowedBy("  doc.text('Generated by Drape Casting Studio');")).toBeNull();
  });

  /*
    THE COMMENT TRACKER'S OWN TWO CONTROLS, and the second is the one that
    matters: a tracker that over-reaches hides real copy, which is the only
    direction this guard may not fail.
  */
  it("POSITIVE CONTROL — a comment block hides prose, including its unprefixed lines", () => {
    const mask = commentMask([
      "/*",
      "  A note about the Drape rename, with no leading star.",
      "*/",
      "const x = 1;",
    ]);
    expect(mask).toEqual([true, true, true, false]);
  });

  it("⚠ POSITIVE CONTROL — a block comment does not swallow the code after it", () => {
    const mask = commentMask([
      "/* a one-line note about Drape */",
      "doc.text('Generated by Drape');",
      "/*",
      " * a docblock",
      " */",
      "doc.text('DRAPE CERTIFIED');",
    ]);
    expect(
      mask,
      "a comment block ran on past its close and a brand literal went unread",
    ).toEqual([true, false, true, true, true, false]);
  });

  it("NEGATIVE CONTROL — the fabric word is not the brand, and is left alone", () => {
    for (const cloth of [
      "a long draped sleeve/robe covering",
      "Pant hems drape over footwear.",
      "same fabric weight and drape, same construction",
      "never a loosely draped fashion scarf",
    ]) {
      expect(allowedBy(cloth), `"${cloth}" would be rewritten by this guard`).not.toBeNull();
    }
  });

  it("⚠ no server string literal a customer could read says the old name", () => {
    const { findings } = brandHits();
    expect(
      findings,
      "a customer-readable server line says the old product name. If it is an"
        + " identifier, a log line or prose, add an entry to ALLOWED with the"
        + " reason it stays — never widen an existing entry to cover it",
    ).toEqual([]);
  });

  /*
    ⚠ AND THE OTHER DIRECTION, which is the half that rots. An exemption whose
    last occurrence has been renamed or deleted is a rule still describing the
    tree it was written against — working law 4 pointed at this file. It errors
    rather than warns, because the repair is one deleted entry.
  */
  it("every exemption is still earning its place in the tree", () => {
    const { allowed } = brandHits();
    const unused = ALLOWED.filter((entry) => !allowed.has(entry.why)).map((entry) => entry.why);
    expect(
      unused,
      "an exemption matches nothing in the tree any more — delete it rather"
        + " than leaving a rule about code that is gone",
    ).toEqual([]);
  });

  it("the brand constant is the one the server composes from", () => {
    expect(PRODUCT_NAME).toBe("Klieg");
    /* The PDF composes every spelling from it, so these are the three forms
       the document actually prints. */
    expect(PRODUCT_NAME.toUpperCase()).toBe("KLIEG");
    expect(PRODUCT_NAME.toLowerCase()).toBe("klieg");
  });
});
