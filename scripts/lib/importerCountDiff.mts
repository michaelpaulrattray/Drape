/**
 * THE UN-WIRING READING — production importer counts, per symbol, per tree.
 *
 * This is the MODULE half of `scripts/diff-importer-count-across-time.mts`;
 * that file carries the reasoning, the proof and the limits. Nothing here
 * exits, because a script something imports is a module and a module must
 * never exit (`server/scriptExitDiscipline.test.ts`).
 *
 * It is separate so the classification can be driven against manufactured
 * trees in a test, without a `git worktree` — the arms that CAN run cheaply
 * should not need the ones that cannot.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/** Windows path separator, by code point: see the entrypoint's §heredoc note. */
const SEP = String.fromCharCode(92);

export function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mts)$/.test(full)) out.push(full);
  }
  return out;
}

export const isTestFile = (file: string) => /\.(test|integration\.test)\.tsx?$/.test(file);

export type Tree = {
  /** symbol -> declaring file, repo-relative with forward slashes */
  decl: Map<string, string>;
  /** symbol -> production files importing it, excluding its own declaring file */
  prodImporters: Map<string, string[]>;
  /** symbol -> mentions inside its own declaring file, the declaration excluded */
  selfUses: Map<string, number>;
  files: number;
};

/**
 * Read one tree.
 *
 * Declarations are looked for under `server/` only — the same scope
 * `sweep-uncalled-exports-disposable.mts` uses, so the two instruments are
 * talking about the same population. Importers are looked for wider.
 */
export function readTree(rootArgument: string): Tree {
  /*
    ⚠ THE ROOT IS RESOLVED, AND A RELATIVE ONE USED TO READ NOTHING AT ALL.
    `show` strips `root.length + 1` characters to make a path repo-relative,
    so a root of "." chopped TWO characters off every path — `server/x.ts`
    became `rver/x.ts`, the `startsWith("server/")` gate below never matched,
    and the reader declared ZERO exports while happily reporting that it had
    walked 1,471 files. Found 2026-08-22 by an operator typing the most
    natural thing there is:

        diff-importer-count-across-time.mts <worktree> .

    The differ's sanity control caught it and REFUSED to report, which is that
    control earning its place — but a blind reader that looks busy is exactly
    the shape this program keeps paying for, and `check-cleanup-dispositions`
    now shares this function for its `rewired` door. That caller passes an
    absolute root and was never affected; this line is what keeps the next one
    from being.
  */
  const root = resolve(rootArgument);
  const all = ["server", "client", "shared"].flatMap((r) => walk(join(root, r)));
  const show = (f: string) => f.slice(root.length + 1).split(SEP).join("/");
  const decl = new Map<string, string>();
  const declSource = new Map<string, string>();
  const sources = new Map<string, string>();

  const exportPattern =
    /^export\s+(?:async\s+)?(?:const|let|function|class|enum)\s+([A-Za-z_$][\w$]*)/gm;
  for (const file of all) {
    const src = readFileSync(file, "utf8");
    sources.set(file, src);
    if (isTestFile(file)) continue;
    if (!show(file).startsWith("server/")) continue;
    for (const match of src.matchAll(exportPattern)) {
      if (decl.has(match[1])) continue;
      decl.set(match[1], show(file));
      declSource.set(match[1], src);
    }
  }

  const prodImporters = new Map<string, string[]>();
  for (const [file, src] of sources) {
    if (isTestFile(file)) continue;
    const here = show(file);
    for (const match of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'][^"']+["']/g)) {
      for (const raw of match[1].split(",")) {
        const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
        if (!name || !decl.has(name)) continue;
        /* A module importing from itself is not a consumer. */
        if (decl.get(name) === here) continue;
        const list = prodImporters.get(name) ?? [];
        if (!list.includes(here)) list.push(here);
        prodImporters.set(name, list);
      }
    }
  }

  const selfUses = new Map<string, number>();
  for (const [name, src] of declSource) {
    const hits = src.match(new RegExp(String.raw`\b` + name + String.raw`\b`, "g"))?.length ?? 0;
    /* One hit in the declaring file is the declaration itself. */
    selfUses.set(name, Math.max(0, hits - 1));
  }

  return { decl, prodImporters, selfUses, files: all.length };
}

export const importerCount = (tree: Tree, name: string) => (tree.prodImporters.get(name) ?? []).length;

export type Unwiring = {
  name: string;
  /** the production files that imported it BEFORE and no longer do */
  lostImporters: string[];
  declaredAt: string;
  selfUses: number;
  /**
   * `self-consulted` is the type specimen's shape — the symbol is still named
   * inside its own module for some other purpose, so the uncalled-export sweep
   * excludes it and cannot report it however many trees it reads.
   */
  kind: "self-consulted" | "fully-dark";
};

/**
 * Every symbol declared in BOTH trees whose production importer count fell
 * from one-or-more to zero.
 *
 * A symbol DELETED between the trees is deliberately not reported: an outright
 * deletion is a different question, visible in the diff, and the class this
 * measures is the one that leaves the code in place looking alive.
 */
export function unwiredBetween(before: Tree, after: Tree): Unwiring[] {
  const found: Unwiring[] = [];
  for (const name of before.decl.keys()) {
    if (!after.decl.has(name)) continue;
    if (importerCount(before, name) === 0) continue;
    if (importerCount(after, name) > 0) continue;
    const selfUses = after.selfUses.get(name) ?? 0;
    found.push({
      name,
      lostImporters: before.prodImporters.get(name) ?? [],
      declaredAt: after.decl.get(name)!,
      selfUses,
      kind: selfUses > 0 ? "self-consulted" : "fully-dark",
    });
  }
  return found;
}
