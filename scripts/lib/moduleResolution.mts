/**
 * WHERE DOES THIS IMPORT ACTUALLY POINT? — the one resolver, shared (#274).
 *
 * Three instruments decide whether an exported symbol is still reached:
 * `sweep-uncalled-exports-disposable.mts`, `check-cleanup-dispositions.mts`
 * (through the door below) and `lib/importerCountDiff.mts`. All three used to
 * answer the question on a BARE NAME, so a live twin credited its importers to
 * a dead one of the same name and the dead one never appeared. Measured at the
 * tree on 2026-09-13: **70 exported names are declared in more than one file,
 * 36 of them with a value declaration, and 5 straddle `server/` and
 * `client|shared/`** — `BRAND_NAME`, `CREDIT_COSTS`, `FacePanel`, `withRetry`
 * and `getIntraCategoryWeight`.
 *
 * A resolver is what keys those readings on (file, symbol) instead, and it
 * lives here rather than in each of them because a rule spelled three times is
 * working law 4 — the exact drift that put `drizzle` in one copy of
 * `CONSUMER_ROOTS` and not the other.
 *
 * # ⚠ IT FAILS TOWARD THE IMPORT STILL COUNTING
 *
 * Every caller uses this to NARROW a use from "any declaration of this name"
 * to "this one". So an unresolved specifier must never silently narrow to
 * nothing: `resolveSpecifier` returns `null` for anything it cannot place, and
 * the callers' contract is that `null` means **credit every declaration,
 * exactly as before**. The fix can therefore only ever REMOVE a use that is
 * provably somebody else's — it cannot invent a dead symbol out of a
 * resolution miss, which is the direction that would put a live export on a
 * deletion list.
 *
 * That asymmetry is the whole safety argument, and `server/moduleResolution.test.ts`
 * drives it in both directions.
 *
 * ⚠ **THE PARAGRAPH ABOVE USED TO LIST "a package" AMONG THE THINGS `null`
 * MEANS, AND THAT WAS THE ONE ITEM ON THE LIST THAT IS NOT A QUESTION**
 * (2026-09-14). A bare specifier is an ANSWER — `react` reaches no file here —
 * so it now credits NOTHING, through `isPackageSpecifier`, and the fail-safe
 * fallback is left for what it was written for: a chain this walk could not
 * follow. Two things were needed in the same commit and the order matters:
 * `@shared/` is an in-repo alias this module had never been taught, and calling
 * it a package would have invented dead symbols out of 176 real imports. Found
 * by an independent reader — `server/deletionDoorSecondReader.test.ts` — and
 * its measured consequence at HEAD is ONE phantom credit that moved no verdict.
 */
import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";

/**
 * EVERY in-repo path alias, and there are TWO of them.
 *
 * They are named here because the sweep reads `client/` as a consumer root and
 * the house style there is `@/foundation`, never a relative walk — a resolver
 * that did not know the word would return `null` for nearly every client import
 * and the fix would quietly do nothing on the half of the tree that needed it
 * most.
 *
 * ⚠ **`@shared/` WAS MISSING UNTIL 2026-09-14 AND NOTHING SAID SO.** The
 * docblock above this list read *"The client's `@/…` alias"* — singular — while
 * `tsconfig.json` has declared `@shared/*` beside `@/*` the whole time.
 * Measured at HEAD the hour it was added: **176 import statements across
 * `server/`, `client/` and `shared/` use it**, and every one of them arrived at
 * `creditedDeclarations` as an unplaceable specifier and credited EVERY
 * in-scope declaration of the name. That is the over-crediting this module was
 * built to end, surviving inside the module that ends it.
 *
 * ⚠ **The consequence today is nil and that is said plainly rather than left
 * to be assumed**: not one of those 176 names also has a `server/` declaration,
 * so no credit and no verdict on the real table moves. It was latent, not live.
 *
 * `server/moduleResolution.test.ts` reads `tsconfig.json`'s own `paths` and
 * reddens if an alias declared there is missing from this list — a mirror of a
 * source of truth drifts (working law 4), so the list is not left to hold by
 * somebody remembering. `vite.config.ts`'s third alias, `@assets`, is
 * deliberately absent: it points at `attached_assets/`, which holds no
 * TypeScript, so nothing there can declare an export to credit.
 */
const REPO_ALIASES: { prefix: string; root: string }[] = [
  { prefix: "@/", root: "client/src" },
  { prefix: "@shared/", root: "shared" },
];

/** Extensions and index files tried, in the order the bundlers try them. */
const CANDIDATES = (base: string) => [
  `${base}.ts`,
  `${base}.tsx`,
  `${base}.mts`,
  join(base, "index.ts"),
  join(base, "index.tsx"),
];

/** A repo-relative path with forward slashes, whatever the platform wrote. */
export const repoRelative = (root: string, file: string) =>
  resolve(file).slice(resolve(root).length + 1).split(sep).join("/");

/**
 * Is this specifier addressing a PACKAGE rather than a file in this repository?
 *
 * ⚠ **THE TWO MEANINGS OF `null` WERE ONE MEANING UNTIL 2026-09-14, AND THE
 * COMMENT THAT NAMED THE DIFFERENCE SAT INSIDE THE FUNCTION THAT COLLAPSED
 * IT.** `resolveSpecifier` returned `null` for `"react"` under the words *"A
 * bare specifier is a package. Not ours, and not a miss worth reporting"* —
 * and `creditedDeclarations` read that same `null` as *"I could not follow this
 * chain"* and credited every in-scope declaration.
 *
 * They are not the same. *I could not follow this chain* is a question mark and
 * must fail toward the import still counting. *This is a package* is an
 * ANSWER: no specifier of the form `react` can reach a file in this tree, so
 * crediting a declaration here is not conservatism, it is a phantom.
 *
 * **Found by the Atlas cross-reader on its first run** (`server/deletionDoorSecondReader.test.ts`):
 * `client/src/features/boards/canvas/canvasZoom.ts` imports `createContext`
 * **from `"react"`**, and it was recorded as a production importer of
 * `server/_core/context.ts::createContext` — the tRPC request context — because
 * that is the one `server/` declaration of the name. The Atlas holds no import
 * path whatever between those two modules, which is how the reading could be
 * shown wrong by something that does not share this resolver.
 *
 * ⚠ **The honest size, both ways**: measured at HEAD, **861 package import
 * statements and 176 in-repo alias ones** reach this function, and **exactly
 * ONE** of them produces a phantom credit — the specimen above. It keeps a
 * declaration reading as live that has a real importer anyway, so **no verdict
 * on `cleanup-dispositions.yaml` moves and nothing was ever at risk.** This is
 * a latent defect repaired, not a live one caught, and saying otherwise would
 * be the population overstatement #909 is about.
 *
 * ⚠ **THE ALIAS RULE MUST LAND FIRST OR THIS ONE IS DANGEROUS.** `@shared/x`
 * is not a package, and classifying it as one would credit NOTHING for 176 real
 * imports — inventing dead symbols out of a resolution the resolver simply had
 * not been taught. That is the direction that puts a live export on a deletion
 * list, which is why `REPO_ALIASES` and this predicate are one change.
 *
 * An EMPTY specifier is neither: the sweep passes `""` for a computed
 * `await import(expr)` that has no literal to read, and that is a miss of the
 * first kind. It keeps the credit-everything fallback.
 */
export const isPackageSpecifier = (spec: string): boolean =>
  spec !== ""
  && !spec.startsWith(".")
  && !REPO_ALIASES.some((alias) => spec.startsWith(alias.prefix));

/**
 * The absolute file an import specifier names, or `null` when it cannot be
 * placed. `null` is never "nothing is there" — see the header.
 */
export function resolveSpecifier(fromFile: string, spec: string, root: string): string | null {
  let base: string | null = null;
  for (const alias of REPO_ALIASES) {
    if (!spec.startsWith(alias.prefix)) continue;
    base = join(resolve(root), alias.root, spec.slice(alias.prefix.length));
    break;
  }
  if (base === null && spec.startsWith(".")) base = join(resolve(fromFile), "..", spec);
  /* A bare specifier is a package — see `isPackageSpecifier`, which is where
     the callers learn that this `null` is an ANSWER rather than a question. */
  if (base === null) return null;
  for (const candidate of CANDIDATES(base)) if (existsSync(candidate)) return candidate;
  return null;
}

/** Every `export … from "…"` a module carries, resolved. */
export type ReexportMap = Map<string, string[]>;

/**
 * Build the re-export graph over already-read sources.
 *
 * Takes the sources rather than reading them again: each caller has already
 * walked and read its own tree, and a second walk here would be a second
 * answer to "which files are there" — the same mirror this module exists to
 * remove.
 */
export function buildReexportMap(sources: Map<string, string>, root: string): ReexportMap {
  const out: ReexportMap = new Map();
  for (const [file, source] of sources) {
    for (const match of source.matchAll(
      /export\s+(?:type\s+)?(?:\{[^}]*\}|\*)\s*from\s*["']([^"']+)["']/g,
    )) {
      const target = resolveSpecifier(file, match[1]!, root);
      if (!target) continue;
      const list = out.get(resolve(file)) ?? [];
      if (!list.includes(target)) list.push(target);
      out.set(resolve(file), list);
    }
  }
  return out;
}

/**
 * How far a barrel chain is followed.
 *
 * `importerCountDiff` followed exactly ONE hop and said so, on the argument
 * that a barrel of barrels reading as "no importer" was the safe direction for
 * IT. It is the UNSAFE direction here — for the sweep, "no importer" means
 * "propose for deletion" — so the walk is transitive with a visited set, and
 * the bound exists only to make a cyclic barrel terminate rather than to
 * express a policy. `client/src/foundation/index.ts` -> `./brand` is one hop;
 * the deepest chain measured in this tree is two.
 *
 * ⚠ **AND THAT ARGUMENT WAS WRONG ABOUT `importerCountDiff` TOO — it uses this
 * walk as of #274.** Its own zero also licenses a deletion now, because
 * `check-cleanup-dispositions` reads it; and a barrel of barrels reading zero at
 * BOTH trees is a silence, not a conservative finding. All three instruments
 * follow the same chain, which is what this module was written for.
 */
const MAX_HOPS = 8;

/**
 * Every module reachable from `entry` through re-exports, `entry` included.
 *
 * Cycles are ordinary in barrels and must not hang: the visited set, not the
 * depth bound, is what terminates this.
 */
export function reachableModules(entry: string, reexports: ReexportMap): Set<string> {
  const seen = new Set<string>([resolve(entry)]);
  let frontier = [resolve(entry)];
  for (let hop = 0; hop < MAX_HOPS && frontier.length > 0; hop += 1) {
    const next: string[] = [];
    for (const module of frontier) {
      for (const target of reexports.get(module) ?? []) {
        const key = resolve(target);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(key);
      }
    }
    frontier = next;
  }
  return seen;
}

/**
 * THE DOOR ITSELF: which of `declaringFiles` this import statement reached.
 *
 * `declaringFiles` is every file declaring the name, absolute. The answer is
 * the subset the specifier can actually reach — and when the specifier cannot
 * be placed, or reaches none of them, it is **all of them**, because the
 * alternative is inventing a dead symbol (see the header).
 */
export function creditedDeclarations(input: {
  fromFile: string;
  spec: string;
  /** Declarations of this name the CALLER is scanning, and may credit. */
  declaringFiles: string[];
  /**
   * Every declaration of this name anywhere in the repository, in scope or not.
   *
   * ⚠ THE OUT-OF-SCOPE ONES ARE THE WHOLE POINT, and leaving them out was the
   * first version of this fix failing on the card's own specimen. The sweep
   * scans `server/` and `shared/` for declarations but reads `client/` for
   * IMPORTERS, so the client's `BRAND_NAME` was invisible as a declaration
   * while its importers were fully visible. With only one in-scope declaration
   * there was "nothing to disambiguate", and two client files importing the
   * client constant went on crediting the legacy server one — exactly the bug
   * being fixed, surviving the fix.
   *
   * Knowing a name is declared somewhere the caller does not scan is what turns
   * "I could not follow this chain" into "this import belongs to someone else".
   */
  allDeclaringFiles: string[];
  reexports: ReexportMap;
  root: string;
}): string[] {
  const { fromFile, spec, declaringFiles, allDeclaringFiles, reexports, root } = input;
  if (declaringFiles.length === 0) return [];

  /*
    A PACKAGE IS AN ANSWER, NOT A MISS (#274, 2026-09-14). `import { x } from
    "react"` cannot reach a file in this repository, so crediting every
    declaration of `x` is a phantom rather than the safe fallback below. See
    `isPackageSpecifier` for the specimen, the measured population and why the
    `@shared/` alias had to be taught in the same commit.
  */
  if (isPackageSpecifier(spec)) return [];

  const target = resolveSpecifier(fromFile, spec, root);
  if (!target) return declaringFiles;

  const reachable = reachableModules(target, reexports);
  const hit = declaringFiles.filter((file) => reachable.has(resolve(file)));
  if (hit.length > 0) return hit;

  /*
    REACHED A DECLARATION, JUST NOT ONE OF OURS — credit nothing. The specifier
    resolved and the walk found the name declared in a module the caller does
    not scan, so this import is provably somebody else's and crediting it here
    is the defect.
  */
  if (allDeclaringFiles.some((file) => reachable.has(resolve(file)))) return [];

  /*
    NONE REACHED AT ALL IS NOT A VERDICT. A chain this walk did not follow — a
    re-export through a package alias, a generated barrel — looks identical to
    a genuine miss, and the two must not be collapsed: only one of them is safe
    to act on. Falling back to every in-scope declaration restores the old,
    over-generous reading for exactly the cases the resolver could not settle.
  */
  return declaringFiles;
}
