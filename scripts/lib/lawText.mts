/**
 * THE LAW SURFACES — `CLAUDE.md` AND THE FILES IT CARVED ITSELF INTO.
 *
 * On 2026-08-31 (#330, the founder's own card: *"why are simple code changes
 * and edits taking so long like up to an hour?"*) the feature-flag catalogue —
 * **122,893 bytes, 64% of a 191 KB file** — moved out of `CLAUDE.md` into
 * `docs/architecture/FEATURE_FLAGS.md`, byte for byte, not one word rewritten.
 *
 * ⚠ **THE GUARDS THAT READ THAT TEXT MUST NOT NOTICE.** Three of them read
 * `CLAUDE.md` and asserted things about the flag catalogue inside it
 * (`claudeMdFlagEnumeration`, `scopeParentChain`, `productionFlagPositions`).
 * A move that left them pointed at `CLAUDE.md` alone would turn every one of
 * them green over an absence — the exact shape this repository calls
 * `absence-only-expect-passes-on-nothing`, and the reason each of those files
 * opens with a positive control.
 *
 * So the population is declared ONCE, here, and derived by every reader
 * (working law 4: derive, never mirror). A future carve-out adds its file to
 * `LAW_SURFACES` and every guard follows it with no edit of its own.
 *
 * ⚠ **`lawText()` IS FOR MEMBERSHIP QUESTIONS ONLY** — *is this flag documented
 * anywhere in the law?* A guard asking a question about a SPECIFIC surface (is
 * the index in `CLAUDE.md`? does the catalogue name this parent?) reads that
 * surface by name instead; concatenating them would let a claim satisfied on
 * one page pass for the other, which is what the index/catalogue agreement arm
 * in `claudeMdFlagEnumeration.test.ts` exists to prevent.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

/** `CLAUDE.md` first — it is the surface every session loads before anything. */
export const LAW_SURFACES = ["CLAUDE.md", "docs/architecture/FEATURE_FLAGS.md"] as const;

/** The path of the catalogue the flag entries live in, relative to the repo root. */
export const FLAG_CATALOGUE = "docs/architecture/FEATURE_FLAGS.md";

/** Every law surface's text, joined. See the warning above about what this is for. */
export function lawText(repoRoot: string): string {
  return LAW_SURFACES.map((file) => readFileSync(path.join(repoRoot, file), "utf8")).join("\n");
}

/** The flag catalogue alone. */
export function flagCatalogue(repoRoot: string): string {
  return readFileSync(path.join(repoRoot, FLAG_CATALOGUE), "utf8");
}

/**
 * The flag names the CLAUDE.md index table names, in order.
 *
 * The index is a markdown table whose first cell is a backticked flag name, so
 * this is the table's own membership rather than a second list of it.
 */
export function indexedFlags(claudeMd: string): string[] {
  return [...claudeMd.matchAll(/^\| `([A-Z][A-Z0-9_]+)` \| /gm)].map((hit) => hit[1]!);
}

/**
 * The flag names the catalogue carries a top-level bullet for, in order.
 *
 * The catalogue's entries are `- \`FLAG\` — …` at column zero; a nested bullet
 * is indented and is deliberately not one.
 */
export function cataloguedFlags(catalogue: string): string[] {
  return [...catalogue.matchAll(/^- `([A-Z][A-Z0-9_]+)`/gm)].map((hit) => hit[1]!);
}

/** One catalogue entry: its flag, the 1-based line its bullet starts on, its whole text. */
export type CatalogueEntry = {
  readonly name: string;
  readonly line: number;
  readonly text: string;
};

/**
 * The catalogue split into entries, each one running from its own bullet to the
 * next flag's bullet.
 *
 * ⚠ **ANCHORED ON THE BULLET, NEVER ON THE NAME'S FIRST MENTION (#2747).** A
 * flag is named inside OTHER flags' entries constantly — as a parent, as a
 * sibling, as the reason a bound moved — so a reader that locates an entry with
 * `indexOf(name)` reads a neighbour's paragraph. Measured when this was built:
 * the unanchored draft took `CASTING_OUTFIT_EDIT_SCOPE`'s position off a
 * neighbour's line AND missed `CASTING_CONCEPT_UPLOAD_SCOPE` altogether, so it
 * was noisy and silent at once. {@link cataloguedFlags} already anchors this
 * way; this shares the anchor rather than restating it.
 *
 * A continuation line is indented (the catalogue wraps long entries), so an
 * unindented, non-bullet line ends the entry — which is how the prose
 * paragraphs between entries stay out of them.
 */
export function catalogueEntries(catalogue: string): CatalogueEntry[] {
  const lines = catalogue.split(/\r?\n/);
  const anchor = /^- `([A-Z][A-Z0-9_]+)`/;
  const entries: CatalogueEntry[] = [];
  let open: { name: string; line: number; buf: string[] } | null = null;

  const close = () => {
    if (open) entries.push({ name: open.name, line: open.line, text: open.buf.join("\n") });
    open = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const hit = anchor.exec(line);
    if (hit) {
      close();
      open = { name: hit[1]!, line: i + 1, buf: [line] };
      continue;
    }
    if (!open) continue;
    if (/^\s{2,}\S/.test(line) || line.trim() === "") open.buf.push(line);
    else close();
  }
  close();
  return entries;
}

/**
 * An entry's text with everything it marks as HISTORY taken out.
 *
 * ⚠ **QUOTING IS NEVER DECLARING, AND THIS CATALOGUE CARRIES ITS OWN
 * CORRECTIONS (#2747).** A corrected entry states the right position and then
 * quotes the wrong one — *"This entry said `Production: UNSET` for eleven days
 * and was corrected 2026-10-28"* — and a retired position is struck rather than
 * deleted. So the naive last-stated-position reader calls a correct repair a
 * mismatch, measured: it read `CASTING_CURRENT_DESCRIPTION_SCOPE` and
 * `CASTING_OUTFIT_EDIT_SCOPE` wrong off their own correction notes.
 *
 * ⚠ **Three instances of this one class are already on the record here** —
 * `productionFlagPositions.test.ts`'s forbidden-sentence arm learned it by
 * failing on its own first run (*"a substring test cannot tell an INSTRUCTION
 * from a QUOTATION of a retired instruction"*), and the standing orders'
 * quiet-shift detector strips fences and quotes for the same reason. That is
 * what makes it worth a reader rather than care.
 *
 * ⚠ **Its stated limit: a quoted span is bounded at 400 characters and an
 * UNPAIRED quote therefore blanks up to 400 characters after itself.** The
 * bound is what stops one stray quote swallowing a whole entry; what it cannot
 * do is tell an unpaired quote from an open one. The arm that keeps this
 * honest is in `productionFlagPositions.test.ts`: every entry the record
 * carries a row for must keep at least one statement if its raw text has one,
 * so a stripper that blinded itself on a live flag reddens rather than passing.
 */
export function withoutMarkedHistory(entryText: string): string {
  return entryText
    .replace(/~~[\s\S]*?~~/g, " ")
    .replace(/[“"][\s\S]{0,400}?[”"]/g, " ");
}

/** A position an entry states in its own prose, as prose — never normalised. */
export type StatedPosition = {
  readonly name: string;
  readonly line: number;
  /** Every position the entry declares, after history is stripped, in order. */
  readonly stated: readonly string[];
  /** How many `Production:` statements the entry has before stripping. */
  readonly rawStatements: number;
};

/**
 * What every catalogue entry says production holds, read off its own prose.
 *
 * The value is returned EXACTLY as the page spells it (`users:1`, `all`,
 * `UNSET`, `unset`) — normalising belongs to whoever compares it to the record,
 * because `UNSET` is the record's own word for `off` and that mapping is the
 * record's to declare, not this reader's.
 *
 * An entry that states nothing is still returned, with an empty `stated`: the
 * silent entries are the honest remainder of this reading (measured 2026-10-28:
 * 25 of 40 state no position at all), and a caller that cannot see them cannot
 * report that remainder.
 */
export function statedFlagPositions(catalogue: string): StatedPosition[] {
  const statement = /Production:\s*(?:\*\*\s*)?(?:`([^`\n]+)`|([A-Za-z][A-Za-z0-9_:.]*))/g;
  return catalogueEntries(catalogue).map((entry) => ({
    name: entry.name,
    line: entry.line,
    stated: [...withoutMarkedHistory(entry.text).matchAll(statement)]
      .map((hit) => (hit[1] ?? hit[2]!).trim()),
    rawStatements: [...entry.text.matchAll(/Production:/g)].length,
  }));
}
