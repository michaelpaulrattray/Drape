/**
 * IS THERE ANY NON-TEST MENTION OF THIS NAME THAT IS NOT ITS OWN DECLARATION?
 *
 * Extracted from `triage-uncalled-exports-disposable.mts` so the SWEEP can ask
 * the same question its own list raises, and print the intersection itself
 * (ordered fable-982 §3). Before this, the two instruments were joined in
 * PROSE — and the join was wrong: a recon read the sweep's test-only list (111)
 * and the reader's `none` bucket (also 111) as one set, put the reading list at
 * 118, and left thirteen symbols with live production callers on it, including
 * admin credit adjustment and admin role changes.
 *
 * **Two lists of the same LENGTH are not the same LIST.** Where two instruments'
 * outputs are combined, the combination is computed and printed by an
 * instrument, never carried across a paragraph.
 *
 *   barrel    named in server/db/index.ts (or another re-export) and reached as
 *             `db.NAME(` or through a destructure off it
 *   dynamic   inside an `await import(...)` destructure
 *   door      re-exported by some other module and imported from it by nobody
 *   other     some other production mention — a hand read decides
 *   none      nothing but its own declaration and its tests
 *
 * The classifier's substring bias is GONE: it matched `REFUSAL_REASONS` inside
 * `GUARD_REFUSAL_REASONS` and the recon read that one by hand. Matching is on
 * word boundaries now, and with it four more of the recon's hand rules became
 * mechanical — somebody else's declaration of the same name, an object key
 * spelled like the symbol, a re-export door nobody walks through, and a
 * consumer this repository does not contain.
 *
 * What survives, declared: the remaining biases run toward NOT-DEAD (a
 * namespace import reaches a whole module; the db barrel is trusted as a real
 * door), which is the safe direction for a triage whose next step is deletion.
 */
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * The source with its comments blanked, line count preserved.
 *
 * A MENTION IN A COMMENT IS PROSE, NOT A CALLER — and the recon already knew
 * it, by hand: nine of the twenty-three OTHER-bucket entries were "a sentence
 * in a COMMENT naming the symbol", each read individually and each kept on the
 * list (triage 1a). Nine hand reads is a rule nobody wrote down, so it is
 * written here instead, and it fixes the class rather than the nine instances:
 * a docblock discussing `openKindZoneScope` is the module explaining itself,
 * and counting that as a caller is how the milestone's own writing promotes
 * symbols out of its own list.
 *
 * String literals are copied through, so a `//` inside a URL cannot swallow the
 * rest of its line.
 */
export function withoutComments(source: string): string {
  const quotes = new Set(['"', "'", "`"]);
  const BACKSLASH = String.fromCharCode(92);
  const NEWLINE = String.fromCharCode(10);
  let out = "";
  let index = 0;
  while (index < source.length) {
    const character = source[index]!;
    if (quotes.has(character)) {
      const quote = character;
      out += character;
      index += 1;
      while (index < source.length) {
        const current = source[index]!;
        out += current;
        index += 1;
        if (current === BACKSLASH) { out += source[index] ?? ""; index += 1; continue; }
        if (current === quote) break;
        if (current === NEWLINE && quote !== "`") break;
      }
      continue;
    }
    if (character === "/" && source[index + 1] === "/") {
      while (index < source.length && source[index] !== NEWLINE) index += 1;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        if (source[index] === NEWLINE) out += NEWLINE;
        index += 1;
      }
      index += 2;
      continue;
    }
    out += character;
    index += 1;
  }
  return out;
}

/**
 * The line with its string literals blanked.
 *
 * A NAME INSIDE QUOTES IS DATA, NOT A CALL — the comment rule's sibling, found
 * the hard way. The milestone's own disposition seeder holds a table of symbol
 * names as quoted strings, and the moment it was committed the reading list
 * fell from 124 to 96: twenty-eight symbols were "mentioned in production" by
 * the very file recording that nobody calls them.
 *
 * That is the THIRD time this apparatus has counted itself. The first two were
 * repaired by naming the offending files — which does not hold, because the
 * next instrument has a new name. A rule about what a mention IS does hold.
 */
function withoutStrings(line: string): string {
  const quotes = new Set(['"', "'", "`"]);
  let out = "";
  let index = 0;
  while (index < line.length) {
    const character = line[index]!;
    if (!quotes.has(character)) { out += character; index += 1; continue; }
    const quote = character;
    index += 1;
    while (index < line.length && line[index] !== quote) {
      index += line[index] === String.fromCharCode(92) ? 2 : 1;
    }
    index += 1;
    out += "QQ";
  }
  return out;
}

export type MentionKind = "barrel" | "dynamic" | "door" | "other" | "none";
export type Mention = { kind: MentionKind; where: string };

/**
 * Files an instrument must not read as evidence.
 *
 * THE INSTRUMENTS ARE NOT CALLERS, and this rule caught itself first: a control
 * failed because the control's own name appeared in the reader's header. A
 * reader that counts its own prose as evidence quietly promotes every future
 * control symbol out of the real list — so every file in this family is skipped,
 * including this one.
 *
 * IT CAUGHT ITSELF A SECOND TIME, and that is why the pattern is now a FAMILY
 * rather than two filenames. A new instrument in the same family
 * (`sweep-shadowed-exports-disposable.mts`) named three dead symbols in its own
 * docblock, and `eyeRegion`, `eyewearRegion` and `mergeRegions` left the strict
 * reading list the moment it was written — three of the very symbols it had
 * been built to expose. A guard spelled as a list of names does not cover the
 * next member; a guard spelled as the family's naming rule does.
 */
const SELF = /[\\/](sweep|triage)-[a-z-]*disposable\.mts$|lib[\\/]productionMention\.mts$/;

/** A symbol's own name, safe to drop into a pattern. */
function escapeForRegExp(text: string): string {
  return text.replace(/[^\w$]/g, (character) => String.fromCharCode(92) + character);
}

export function buildClassifier(repoRoot: string): (symbol: string) => Mention {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|mts)$/.test(entry)) files.push(full);
    }
  };
  for (const root of ["server", "client", "shared", "scripts"]) walk(join(repoRoot, root));

  const source = new Map<string, string>();
  for (const file of files) source.set(file, withoutComments(readFileSync(file, "utf8")));

  /*
    A CONSUMER THIS REPOSITORY DOES NOT CONTAIN IS NOT A CONSUMER. Two hundred
    and eighty-three files under `scripts/` are untracked disposables that
    exist on one machine; one of the recon's twelve hand reads was exactly
    that, and the tracked script beside it in the same pile is a real caller.
    Only git can tell those apart, so git is asked.
  */
  const tracked = new Set(
    execSync("git ls-files", { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
      .split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
  );
  const untracked = new Set(
    files.filter((file) => !tracked.has(file.slice(repoRoot.length + 1).split("\\").join("/"))),
  );

  return function classify(symbol: string): Mention {
    const word = new RegExp(`(?<![\\w$])${escapeForRegExp(symbol)}(?![\\w$])`);
    const mentions: Array<{ file: string; line: string; door: boolean }> = [];
    for (const [file, text] of source) {
      if (/\.test\.tsx?$/.test(file)) continue;
      if (SELF.test(file)) continue;
      if (untracked.has(file)) continue;
      if (!word.test(text)) continue;
      for (const line of text.split(/\r?\n/)) {
        if (!word.test(line)) continue;
        /* Data is not a call: a name that survives only inside quotes is a
           table entry, a test title or a config key. */
        if (!word.test(withoutStrings(line))) continue;
        /* Its own declaration is not a caller. */
        if (/^\s*export\s+(async\s+)?(function|const|class|type|interface)\s/.test(line)) continue;
        /* Nor is SOMEBODY ELSE'S declaration of the same name — a local in a
           script, which the recon met three times and read by hand. */
        if (new RegExp(`^\\s*(const|let|var|function|class|type|interface)\\s+${escapeForRegExp(symbol)}(?![\\w$])`)
          .test(line)) continue;
        /* Nor is an object KEY that happens to be spelled like the symbol —
           met twice, in a policy record whose rows are named after the rules
           they document. A computed key `[NAME]:` has brackets and is a real
           reference, so it survives this. */
        if (new RegExp(`^\\s*${escapeForRegExp(symbol)}\\s*:`).test(line)) continue;
        mentions.push({
          file: file.slice(repoRoot.length + 1).split("\\").join("/"),
          line: line.trim(),
          door: /^\s*export\s*\{|^\s*\}\s*from\s|^\s*[\w$]+,?$/.test(line),
        });
      }
    }
    if (mentions.length === 0) return { kind: "none", where: "nothing but its own declaration" };
    const barrel = mentions.find((m) => m.file.endsWith("server/db/index.ts"));
    const dynamic = mentions.find((m) => /await import\(|import\(/.test(m.line));
    const first = mentions[0]!;
    if (barrel) return { kind: "barrel", where: `${mentions.length} mention(s), incl. ${barrel.file}` };
    if (dynamic) return { kind: "dynamic", where: `${dynamic.file}: ${dynamic.line.slice(0, 70)}` };
    /* A RE-EXPORT IS A DOOR, NOT A CALLER — the recon's own words, on five
       symbols it kept on the list by hand. Checked AFTER the barrel, because
       `server/db/index.ts` is the one door this product actually walks
       through (`db.NAME(`), and collapsing the two would put admin credit
       adjustment back on a deletion list. */
    if (mentions.every((m) => m.door)) {
      return { kind: "door", where: `re-exported by ${first.file}, imported from it by nobody` };
    }
    return { kind: "other", where: `${first.file}: ${first.line.slice(0, 70)}` };
  };
}

/**
 * The two controls both instruments run before any verdict (working law 2).
 *
 * Hand-read 2026-08-18: `shouldSendGlobalAttackAlert` is a declaration and its
 * tests and nothing else; `isAccountLocked` is reached as `db.isAccountLocked`
 * from two auth routes. A classifier that cannot tell those apart cannot tell
 * anything apart.
 */
export function runMentionControls(
  classify: (symbol: string) => Mention,
  log: (line: string) => void,
): boolean {
  const positive = classify("shouldSendGlobalAttackAlert");
  const negative = classify("isAccountLocked");
  /*
    The stripper's control is SYNTHETIC, so it cannot die the day the product
    retires whichever symbol happens to be discussed in a comment today — the
    lesson that cost this milestone its first instrument. Both directions in
    one fixture: a name only discussed must vanish, a name actually called must
    survive, and a `//` inside a string must not eat the call after it.
  */
  const fixture = [
    "/* zzzOnlyDiscussed is explained here and called nowhere. */",
    'const url = "https://example.invalid/x";',
    "const value = zzzActuallyCalled();",
    "",
  ].join(String.fromCharCode(10));
  const stripped = withoutComments(fixture);
  const strippedComment = !stripped.includes("zzzOnlyDiscussed");
  const keptCall = stripped.includes("zzzActuallyCalled");
  /*
    And the sibling rule, which cost the milestone a reading list: a name that
    survives only inside quotes is DATA. Both directions, same line, so a
    stripper that blanked everything would fail the second arm.
  */
  const dataLine = withoutStrings('  { symbol: "zzzInATable", verdict: zzzInCode },');
  const blankedString = !dataLine.includes("zzzInATable");
  const keptIdentifier = dataLine.includes("zzzInCode");
  log("  positive  shouldSendGlobalAttackAlert → " + positive.kind
    + "  " + (positive.kind === "none" ? "PASS" : "FAIL"));
  log("  negative  isAccountLocked             → " + negative.kind
    + "  " + (negative.kind !== "none" ? "PASS" : "FAIL"));
  log("  synthetic a name only DISCUSSED is not a mention  "
    + (strippedComment ? "PASS" : "FAIL"));
  log("  synthetic a call after a URL survives stripping   "
    + (keptCall ? "PASS" : "FAIL"));
  log("  synthetic a name inside QUOTES is data, not a call "
    + (blankedString ? "PASS" : "FAIL"));
  log("  synthetic an identifier beside it survives         "
    + (keptIdentifier ? "PASS" : "FAIL"));
  return positive.kind === "none" && negative.kind !== "none"
    && strippedComment && keptCall && blankedString && keptIdentifier;
}

/**
 * The repository root, derived from THIS file's own location.
 *
 * Not from the caller's: the first wiring passed `import.meta.dirname` from a
 * script in `scripts/` into a helper that assumed `scripts/lib/`, and walked
 * `C:\Users\Admin\server`. A path a helper computes from its caller's depth
 * is a second copy of the layout.
 */
export const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
