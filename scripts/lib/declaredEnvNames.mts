/**
 * THE ENVIRONMENT VARIABLES THIS PRODUCT DECLARES, READ OUT OF THE CODE.
 *
 * Lifted out of `server/claudeMdFlagEnumeration.test.ts` on 2026-08-23 when a
 * SECOND arm needed the same population (`server/productionFlagPositions.test.ts`).
 * A derivation used by two readers must not live inside one of them — the copy
 * is what drifts (working law 4), and the incident this whole family exists for
 * is a list that stopped being the list.
 *
 * The population is every string literal assigned to an exported `*_ENV*`
 * constant — the house pattern for *this is the name of an environment
 * variable* — so a new flag joins by being written, not by being remembered.
 *
 * ⚠ **The match is multiline on purpose.** `EVIDENCE_CANDIDATE_WORKER_ENV` is
 * declared with its value on the NEXT line, and a same-line regex drops it
 * without a word. A derivation that silently loses a member is worse than the
 * hand list it replaces, because it reads as coverage — both callers pin that
 * specimen by name.
 *
 * ⚠ **This shape, and only this shape.** A variable named some other way is
 * invisible here, and there is a real family of them: `FAL_ALLOWANCES` carries
 * five as `env:` fields on a table. Those have their own boot check and their
 * own arm. A clean run over this population is a floor, not coverage.
 */
import { readdirSync } from "node:fs";
import { readIfPresent, statIfPresent } from "./listedEntry.mts";
import path from "node:path";

/**
 * Every non-test TypeScript file under a tree.
 *
 * ⚠ ENTRIES TOUCHED THROUGH THE ENOENT-ONLY TOLERANCE (#591, PR #592 review
 * finding 1), AND THIS WALKER IS WHY THAT FINDING WAS RIGHT. It is called on
 * `server` and `shared` today — roots where the untracked disposables this rule
 * is about do not land — so the sweep that landed the sibling fixes cleared it
 * on that basis. That is a claim about its CALLERS, and this same commit had
 * already refused exactly that reasoning one file over: `sourceFiles` is
 * EXPORTED and takes its root as an argument, so "it never walks scripts/" is
 * true only until somebody passes a different directory, and nothing goes red
 * on the day they do.
 *
 * ⚠ STATED LIMIT, because it is not what a reader would assume: this module
 * names no scripts root, so the class guard in
 * `server/testing/listedSource.test.ts` cannot SEE it even now — the predicate
 * needs one. It is correct here and unguarded, which is filed rather than left
 * to be discovered.
 */
export function sourceFiles(from: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const at = path.join(dir, entry);
      const stat = statIfPresent(at);
      if (stat === null) continue; /* vanished between list and stat (#589) */
      if (stat.isDirectory()) {
        walk(at);
        continue;
      }
      if (!at.endsWith(".ts")) continue;
      if (at.endsWith(".test.ts")) continue;
      found.push(at);
    }
  };
  walk(from);
  return found;
}

/** The two trees an environment variable can be declared in. */
export function serverAndSharedSources(repoRoot: string): string[] {
  return [
    ...sourceFiles(path.join(repoRoot, "server")),
    ...sourceFiles(path.join(repoRoot, "shared")),
  ];
}

export function declaredEnvNames(sources: readonly string[]): string[] {
  const names = new Set<string>();
  const declaration = /export\s+const\s+[A-Z0-9_]*ENV[A-Z0-9_]*\s*=[\s\S]{0,40}?"([A-Z][A-Z0-9_]{3,})"/g;
  for (const file of sources) {
    const text = readIfPresent(file);
    if (text === null) continue; /* left between the walk and the read (#589) */
    for (const hit of text.matchAll(declaration)) names.add(hit[1]!);
  }
  return [...names].sort();
}
