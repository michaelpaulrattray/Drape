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
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

  /*
    ⚠ THE NAMESPACE HOP — WITHOUT IT THE ACCOUNT LOCKOUT IS INVISIBLE.

    The reading above sees `import { isAccountLocked } from "../db"`. It does
    NOT see the house style of this product's database layer:

        import * as db from "../db";
        const lockStatus = await db.isAccountLocked(user.openId);

    Both login routes reach the lockout that way, and `server/lib/boardOps.ts`
    exports its whole plan/execute layer to one `ops.` consumer. Measured
    2026-08-23 before this existed: **33 server exports were production-wired
    and counted zero** — `isAccountLocked`, `recordFailedLogin`,
    `resetFailedLogins`, and 28 board operations among them.

    That is the "toward silence" direction and it is the worse one. A symbol
    the reader already counts at zero can never be seen to FALL to zero, so
    delete the lockout's call site tomorrow and the differ reports nothing —
    the instrument the retirement program uses to prove a control did not die
    is structurally blind to the control dying.

    The resolution is deliberately narrow, because a loose one would count
    `foo.map` as an importer of any `map` the server happens to export: the
    binding must be a RELATIVE import, and the member must be declared in that
    exact module or in a module it re-exports from. One re-export hop, which is
    what a barrel is (`server/db/index.ts` -> `./security`); a barrel of
    barrels is not resolved and would read as no importer, which is the safe
    direction for this reader to be wrong in.
  */
  const resolveSpec = (fromFile: string, spec: string): string | null => {
    if (!spec.startsWith(".")) return null;
    const base = join(fromFile, "..", spec);
    for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
      if (existsSync(candidate)) return show(candidate);
    }
    return null;
  };

  /** repo-relative module -> the modules it re-exports from */
  const reexports = new Map<string, string[]>();
  for (const [file, src] of sources) {
    for (const match of src.matchAll(/export\s+(?:type\s+)?(?:\{[^}]*\}|\*)\s*from\s*["']([^"']+)["']/g)) {
      const target = resolveSpec(file, match[1]!);
      if (!target) continue;
      const list = reexports.get(show(file)) ?? [];
      list.push(target);
      reexports.set(show(file), list);
    }
  }

  for (const [file, src] of sources) {
    if (isTestFile(file)) continue;
    const here = show(file);
    const bindings = new Map<string, string>();
    for (const match of src.matchAll(
      /import\s+(?:type\s+)?(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s+from\s*["']([^"']+)["']/g,
    )) {
      const target = resolveSpec(file, match[2]!);
      if (target) bindings.set(match[1]!, target);
    }
    for (const [alias, target] of bindings) {
      const reachable = new Set<string>([target, ...(reexports.get(target) ?? [])]);
      for (const match of src.matchAll(new RegExp(String.raw`\b` + alias + String.raw`\.([A-Za-z_$][\w$]*)`, "g"))) {
        const name = match[1]!;
        const declaredAt = decl.get(name);
        if (!declaredAt || !reachable.has(declaredAt)) continue;
        /* A module importing from itself is not a consumer. */
        if (declaredAt === here) continue;
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

/* ------------------------------------------------------------- the timeline */

/**
 * THE SAME READING OVER MANY TREES — *was this symbol EVER wired?*
 *
 * `unwiredBetween` compares two trees, and its entrypoint's docblock states the
 * gap that follows from that: a symbol born AND un-wired inside one window is
 * invisible, because it is not in the `before` tree to have lost anything.
 * Demonstrated on this instrument's own specimens — the February tile reported
 * ZERO while both deaths that morning were inside it.
 *
 * ⚠ **AND THE MISS IS NOT A SILENCE. IT IS A CONFIDENT WRONG ROAD.** Measured
 * 2026-08-23 on the real history: read at a coarse tile, `isSensitiveAction`
 * classifies `dark-born` — *never had a production importer at any boundary*,
 * which is the path-ONE shape — and at a fine tile it classifies `died`, which
 * is path THREE and hands you `3cb0cdee` to read. CLAUDE.md spends a paragraph
 * on why filing a path-three death as path-one is worse than filing nothing.
 * The arm for that fact is `server/unwiringTimeline.test.ts`'s intermediate-
 * boundary pair, so it is a mechanical property of this classifier rather than
 * an anecdote about one symbol.
 *
 * Fed one tree at a time in HISTORICAL ORDER so a whole history need not be
 * held in memory, and pure, so the arms need no `git worktree`.
 */
export type TimelineKind = "wired-at-head" | "revived" | "died" | "deleted" | "dark-born";

export type Timeline = {
  lastWiredIdx: Map<string, number>;
  firstWiredIdx: Map<string, number>;
  lastWiredImporters: Map<string, string[]>;
  /**
   * The last boundary that DECLARED a symbol with zero production importers,
   * after it had already been wired once. Without it `revived` cannot exist:
   * a symbol wired at both ends looks identical to one that was dark for four
   * and a half months in between, which is exactly the login-attack detector.
   */
  darkAfterWiredIdx: Map<string, number>;
  everDeclared: Set<string>;
  observed: number;
};

export const newTimeline = (): Timeline => ({
  lastWiredIdx: new Map(),
  firstWiredIdx: new Map(),
  lastWiredImporters: new Map(),
  darkAfterWiredIdx: new Map(),
  everDeclared: new Set(),
  observed: 0,
});

export function observeTree(timeline: Timeline, index: number, tree: Tree): void {
  for (const name of tree.decl.keys()) {
    timeline.everDeclared.add(name);
    const importers = tree.prodImporters.get(name);
    if (importers && importers.length > 0) {
      timeline.lastWiredIdx.set(name, index);
      timeline.lastWiredImporters.set(name, importers);
      if (!timeline.firstWiredIdx.has(name)) timeline.firstWiredIdx.set(name, index);
    } else if (timeline.firstWiredIdx.has(name)) {
      timeline.darkAfterWiredIdx.set(name, index);
    }
  }
  timeline.observed += 1;
}

export type TimelineRow = {
  name: string;
  kind: TimelineKind;
  /** null when the symbol is not declared at HEAD */
  declaredAt: string | null;
  lastWiredIndex: number | null;
  firstWiredIndex: number | null;
  darkAfterWiredIndex: number | null;
  lostImporters: string[];
  selfUsesAtHead: number;
};

/**
 * Classify every symbol the timeline has ever seen against the HEAD tree.
 *
 *   died          wired at some boundary, still declared at HEAD, zero
 *                 importers there — the hunt's target
 *   revived       wired at HEAD, and dark at some boundary after its first
 *                 wiring
 *   deleted       wired at some boundary, no longer declared — a different
 *                 question, and one a diff can already answer
 *   dark-born     never had a production importer at any boundary observed
 *   wired-at-head wired at HEAD with no dark boundary behind it
 *
 * ⚠ `dark-born` is the class to read carefully rather than act on: importers
 * are counted under `server`/`client`/`shared`, so a symbol whose only consumer
 * is a CEREMONY or AUDIT SCRIPT lands here. Measured 2026-08-23 on the
 * control-shaped never-wired names: 13 of 19 had a `scripts/` consumer, and
 * every one of the remaining six was accounted for. Right for the question
 * *"is this on a request path"*, wrong for *"is this dead"*, and stated because
 * the two look identical in the output.
 */
export function classifyTimeline(timeline: Timeline, head: Tree): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (const name of timeline.everDeclared) {
    const wiredIdx = timeline.lastWiredIdx.get(name);
    const declaredAtHead = head.decl.has(name);
    const importersAtHead = declaredAtHead ? importerCount(head, name) : 0;

    let kind: TimelineKind;
    if (wiredIdx === undefined) kind = "dark-born";
    else if (importersAtHead > 0) kind = timeline.darkAfterWiredIdx.has(name) ? "revived" : "wired-at-head";
    else if (!declaredAtHead) kind = "deleted";
    else kind = "died";

    rows.push({
      name,
      kind,
      declaredAt: declaredAtHead ? head.decl.get(name)! : null,
      lastWiredIndex: wiredIdx ?? null,
      firstWiredIndex: timeline.firstWiredIdx.get(name) ?? null,
      darkAfterWiredIndex: timeline.darkAfterWiredIdx.get(name) ?? null,
      lostImporters: timeline.lastWiredImporters.get(name) ?? [],
      selfUsesAtHead: declaredAtHead ? (head.selfUses.get(name) ?? 0) : 0,
    });
  }
  return rows;
}
