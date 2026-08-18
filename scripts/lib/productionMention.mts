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
 *   other     some other production mention — a hand read decides
 *   none      nothing but its own declaration and its tests
 *
 * The classifier's bias is declared and runs toward NOT-DEAD: it matches on
 * substrings, so a longer symbol containing this one counts as a mention. It
 * can keep a dead symbol on the maybe-alive pile and can never invent a dead
 * one — the safe direction for a triage whose next step is deletion.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export type MentionKind = "barrel" | "dynamic" | "other" | "none";
export type Mention = { kind: MentionKind; where: string };

/**
 * Files an instrument must not read as evidence.
 *
 * THE INSTRUMENTS ARE NOT CALLERS, and this rule caught itself first: a control
 * failed because the control's own name appeared in the reader's header. A
 * reader that counts its own prose as evidence quietly promotes every future
 * control symbol out of the real list — so every file in this family is skipped,
 * including this one.
 */
const SELF = /(sweep|triage)-uncalled-exports-disposable\.mts$|lib[\\/]productionMention\.mts$/;

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
  for (const file of files) source.set(file, readFileSync(file, "utf8"));

  return function classify(symbol: string): Mention {
    const mentions: Array<{ file: string; line: string }> = [];
    for (const [file, text] of source) {
      if (/\.test\.tsx?$/.test(file)) continue;
      if (SELF.test(file)) continue;
      if (!text.includes(symbol)) continue;
      for (const line of text.split(/\r?\n/)) {
        if (!line.includes(symbol)) continue;
        /* Its own declaration is not a caller. */
        if (/^\s*export\s+(async\s+)?(function|const|class|type|interface)\s/.test(line)
          && line.includes(symbol)) continue;
        mentions.push({ file: file.slice(repoRoot.length + 1).split("\\").join("/"), line: line.trim() });
      }
    }
    if (mentions.length === 0) return { kind: "none", where: "nothing but its own declaration" };
    const barrel = mentions.find((m) => m.file.endsWith("server/db/index.ts"));
    const dynamic = mentions.find((m) => /await import\(|import\(/.test(m.line));
    const first = mentions[0]!;
    if (barrel) return { kind: "barrel", where: `${mentions.length} mention(s), incl. ${barrel.file}` };
    if (dynamic) return { kind: "dynamic", where: `${dynamic.file}: ${dynamic.line.slice(0, 70)}` };
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
  log("  positive  shouldSendGlobalAttackAlert → " + positive.kind
    + "  " + (positive.kind === "none" ? "PASS" : "FAIL"));
  log("  negative  isAccountLocked             → " + negative.kind
    + "  " + (negative.kind !== "none" ? "PASS" : "FAIL"));
  return positive.kind === "none" && negative.kind !== "none";
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
