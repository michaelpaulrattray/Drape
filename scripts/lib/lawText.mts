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
