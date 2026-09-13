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
import { readdirSync } from "node:fs";
import { readIfPresent, statIfPresent } from "./listedEntry.mts";
import { join, resolve } from "node:path";
import {
  buildReexportMap,
  creditedDeclarations,
  reachableModules,
  resolveSpecifier,
} from "./moduleResolution.mts";

/** Windows path separator, by code point: see the entrypoint's §heredoc note. */
const SEP = String.fromCharCode(92);

/*
  ⚠ ENTRIES READ THROUGH THE ENOENT-ONLY TOLERANCE (#591), AND THE CARVE-OUT
  WAS DECLINED ON PURPOSE.

  This module walks `server`, `client` and `shared` today, where the ~440
  untracked disposables this rule is about do not land — so the guard's own
  precedent (`architectureAtlas.test.ts`'s row in `NOT_THE_CLASS`) would have
  exempted it by name. It is fixed instead, because that row's reason would be
  a claim about this walker's CALLERS rather than about the walker: `walk` is
  EXPORTED and takes its root as an argument, so "it never walks scripts/" is
  true until somebody passes a different directory, and nothing would go red on
  the day they did. Two lines now against a carve-out that rots (working law 4).
*/
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
    const stat = statIfPresent(full);
    if (stat === null) continue; /* vanished between list and stat (#589) */
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mts)$/.test(full)) out.push(full);
  }
  return out;
}

export const isTestFile = (file: string) => /\.(test|integration\.test)\.tsx?$/.test(file);

/**
 * THE KEY — a declaration is a (file, symbol) PAIR, never a bare name (#274).
 *
 * Measured at the tree on 2026-09-13: **11 names are declared TWICE under
 * `server/`** — `generateMasterPrompt`, `enhanceUserPrompt`,
 * `generateCastingImage`, `generateFullBody`, `generateRemainingViews`,
 * `diagnoseResponse`, `hairRegion`, `intersectMasks`, `subtractMask`,
 * `sameChain`, `bugReportsRouter`. Under a name key the first one walked wins
 * and **the second does not exist to this reader at all**, so it can never be
 * seen to lose an importer and `check-cleanup-dispositions`'s `unreadable` arm
 * cannot catch it either: it reads as whatever its visible twin reads.
 */
export const declKey = (file: string, symbol: string) => `${file}::${symbol}`;

export type Tree = {
  /**
   * symbol -> EVERY declaring file under `server/`, repo-relative with forward
   * slashes, in walk order. A one-entry list is the ordinary case.
   */
  decls: Map<string, string[]>;
  /** `declKey` -> production files importing THAT declaration */
  prodImportersAt: Map<string, string[]>;
  /** `declKey` -> mentions inside that declaring file, the declaration excluded */
  selfUsesAt: Map<string, number>;
  /**
   * Every declaration of every exported name ANYWHERE in the walked tree,
   * `client/` and `shared/` included — the out-of-scope ones are what turn *"I
   * could not follow this chain"* into *"this import belongs to someone else"*.
   * See `creditedDeclarations`' own `allDeclaringFiles` docblock.
   */
  declsAnywhere: Map<string, string[]>;
  files: number;
};

/* ---------------------------------------------------- the name-keyed views */

/*
  DERIVED, NEVER MIRRORED (working law 4). The timeline below asks a NAME-level
  question across trees — *did this symbol stop being imported* — and a file key
  cannot answer it, because a declaration that MOVES file would read as one
  symbol deleted and another born. So the name-level reading stays, and it is
  computed from the file-keyed store on demand rather than stored beside it.

  ⚠ Where the name has two declarations these views are a UNION, and that is
  the old conflation surviving on purpose for the one caller that needs it.
  A caller asking about a specific declaration uses the `…At` functions.
*/

/** The declaring file a bare name resolves to: the FIRST walked, as before. */
export const declFileOf = (tree: Tree, symbol: string): string | undefined =>
  tree.decls.get(symbol)?.[0];

/** Production importers of ONE declaration. */
export const importersAt = (tree: Tree, file: string, symbol: string): string[] =>
  tree.prodImportersAt.get(declKey(file, symbol)) ?? [];

/** Production importers of ANY declaration of the name, deduplicated. */
export function importersOfName(tree: Tree, symbol: string): string[] {
  const out: string[] = [];
  for (const file of tree.decls.get(symbol) ?? []) {
    for (const importer of importersAt(tree, file, symbol)) {
      if (!out.includes(importer)) out.push(importer);
    }
  }
  return out;
}

/** Self-uses of the FIRST declaration — the name-level reading, unchanged. */
export const selfUsesOfName = (tree: Tree, symbol: string): number => {
  const file = declFileOf(tree, symbol);
  return file === undefined ? 0 : (tree.selfUsesAt.get(declKey(file, symbol)) ?? 0);
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
  const decls = new Map<string, string[]>();
  const declsAnywhere = new Map<string, string[]>();
  /** `declKey` -> the source of the file that declares it */
  const declSource = new Map<string, string>();
  const sources = new Map<string, string>();

  const exportPattern =
    /^export\s+(?:async\s+)?(?:const|let|function|class|enum)\s+([A-Za-z_$][\w$]*)/gm;
  /*
    ⚠ TWO INDEXES, AND THE SECOND IS NOT A MIRROR OF THE FIRST (#274).

    `decls` is the population this reader REPORTS on — `server/` only, the same
    scope `sweep-uncalled-exports-disposable.mts` takes, so the two instruments
    name the same symbols. `declsAnywhere` is wider and is never reported: it
    exists solely so `creditedDeclarations` can tell *"this import reached a
    declaration of the name that is not one of mine"* from *"I could not follow
    this chain"*. Collapsing them was the first version of the sweep's own fix
    failing on this card's specimen — with only one in-scope declaration there
    was nothing to disambiguate, and two client files went on crediting the
    legacy server constant.
  */
  for (const file of all) {
    const src = readIfPresent(file);
    if (src === null) continue; /* left between the walk and the read (#589) */
    sources.set(file, src);
    if (isTestFile(file)) continue;
    const here = show(file);
    for (const match of src.matchAll(exportPattern)) {
      const name = match[1]!;
      const anywhere = declsAnywhere.get(name) ?? [];
      if (!anywhere.includes(here)) anywhere.push(here);
      declsAnywhere.set(name, anywhere);
      if (!here.startsWith("server/")) continue;
      const inScope = decls.get(name) ?? [];
      if (inScope.includes(here)) continue;
      inScope.push(here);
      decls.set(name, inScope);
      declSource.set(declKey(here, name), src);
    }
  }

  /** Absolute paths, which is the currency `creditedDeclarations` trades in. */
  const absolute = (rel: string) => join(root, ...rel.split("/"));
  const reexports = buildReexportMap(sources, root);

  /**
   * Which declarations of `name` this one import statement may credit.
   *
   * ⚠ It fails toward the import STILL COUNTING: an unplaceable specifier, or a
   * barrel chain this walk could not follow, credits every in-scope declaration
   * exactly as the bare-name reading did. So the re-key can only ever remove a
   * use that is provably somebody else's — it cannot manufacture a dead symbol
   * out of a resolution miss, which is the direction that would put a live
   * export on a deletion list.
   */
  const credited = (fromFile: string, spec: string, name: string): string[] =>
    creditedDeclarations({
      fromFile,
      spec,
      declaringFiles: (decls.get(name) ?? []).map(absolute),
      allDeclaringFiles: (declsAnywhere.get(name) ?? []).map(absolute),
      reexports,
      root,
    }).map((file) => show(resolve(file)));

  /*
    ⚠ A DEAD IMPORT IS NOT AN IMPORTER — and this was not a hypothetical bias.

    The reader counted the import STATEMENT, so a file that imports a symbol on
    one line and never mentions it again read as a live consumer. The specimen:
    `server/routes/generation/castingRefinement.ts` imported `checkUserRateLimit`
    at `1b8a07f2` and never called it; `916c8cc4` removed the line as part of a
    dead-import cleanup, correctly. To this reader that looked like the per-user
    RATE LIMITER losing its last call site — so the timeline told a four-month
    dark-window story about a control that had never been invoked at all.

    Measured at HEAD the hour it was fixed: **38 dead imports of a server symbol
    across 36 symbols, and SIX symbols the reader called WIRED that nothing
    calls at all** — `PAID_PLAN_ORDER`, `inkPlateAlreadyMintedRefusal`,
    `HAIR_TAKES`, `hairTakeNamedIn`, `OPEN_SLOT_PREFIX` and
    `stampBoardItemWithVersion`, whose sibling `stampBoardItemWithVersionIn` is
    the one actually called. That is the retirement program's own question
    answered wrong, in the direction that protects dead code.

    The test is a MENTION outside the import statements, not a call: a re-export,
    a type position and an object shorthand all count, because all three are
    real uses and none of them is a call.

    ⚠ AND THE BODY IS CUT AT THE EXACT MATCHES, never by a second regex. The
    first version stripped `/^import\s[\s\S]*?from\s*["'][^"']+["']/gm`, which
    runs from a BARE side-effect import (`import "dotenv/config";` — no `from`)
    all the way to the next `from "…"` anywhere below it, deleting real body
    text in between. That pushes this reader toward SILENCE, which is the one
    direction it must never fail in. Splicing out the matched statements
    themselves cannot over-reach by construction.
  */
  const NAMED_IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  const prodImportersAt = new Map<string, string[]>();
  for (const [file, src] of sources) {
    if (isTestFile(file)) continue;
    const here = show(file);
    const matches = [...src.matchAll(NAMED_IMPORT)];
    let body = "";
    let cursor = 0;
    for (const match of matches) {
      body += src.slice(cursor, match.index);
      cursor = match.index + match[0].length;
    }
    body += src.slice(cursor);
    for (const match of matches) {
      for (const raw of match[1].split(",")) {
        const parts = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/);
        const name = parts[0]!.trim();
        /*
          ⚠ THE BODY IS SEARCHED FOR THE LOCAL NAME, NOT THE EXPORTED ONE.
          `import { getApprovalStatus as getSlackApprovalStatus }` is the house
          style wherever two modules export the same word, and the body says
          the ALIAS. Testing the exported name there finds nothing and calls a
          live consumer dead — a false negative, which is the silence direction
          this reader must never fail in. Caught 2026-08-23 by checking the
          claim before writing it down: the Slack-approval trio read as dark
          and their consumers were using them under new names.
        */
        const local = (parts[1] ?? parts[0])!.trim();
        if (!name || !decls.has(name)) continue;
        /* A module that imports it and never mentions it again is not one. */
        if (!local || !new RegExp(String.raw`\b` + local + String.raw`\b`).test(body)) continue;
        /*
          ⚠ AND THE SPECIFIER DECIDES WHICH DECLARATION IS CREDITED (#274).

          This narrowing used to be absent, and its absence is the whole card:
          the only test was `decl.has(name)`, so `import { BRAND_NAME } from
          "@/foundation"` in a CLIENT file credited an importer to the legacy
          `server/casting/geminiPrompts.ts` constant. Measured the day this
          landed — two client files (`StaffBar.tsx`, `AdminFoundation.tsx`) kept
          a server export that nothing reaches reading as live with TWO
          importers, which is the `rewired` arm of
          `check-cleanup-dispositions` answering about the wrong file.
        */
        for (const declaredAt of credited(file, match[2]!, name)) {
          /* A module importing from itself is not a consumer. */
          if (declaredAt === here) continue;
          const key = declKey(declaredAt, name);
          const list = prodImportersAt.get(key) ?? [];
          if (!list.includes(here)) list.push(here);
          prodImportersAt.set(key, list);
        }
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
    member must be declared in the module the specifier names or in one it
    re-exports from.

    ⚠ **TWO THINGS IN THAT SENTENCE CHANGED WITH #274, BOTH TOWARD COUNTING
    MORE.** It used to require a RELATIVE specifier and follow exactly ONE
    re-export hop, on the stated argument that a barrel of barrels reading as
    no importer is the safe direction for THIS reader. Both limits were a
    hand-rolled resolver's, not a policy's: the shared `resolveSpecifier` knows
    the client's `@/` alias and `reachableModules` walks the chain transitively
    with a visited set. Widening them can only ADD importers, which is the same
    safe direction — and it removes the second copy of a rule that
    `lib/moduleResolution.mts` exists to hold once (working law 4, the drift
    that put `drizzle` in one copy of `CONSUMER_ROOTS` and not the other).
  */
  for (const [file, src] of sources) {
    if (isTestFile(file)) continue;
    const here = show(file);
    const bindings = new Map<string, string>();
    for (const match of src.matchAll(
      /import\s+(?:type\s+)?(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s+from\s*["']([^"']+)["']/g,
    )) {
      const target = resolveSpecifier(file, match[2]!, root);
      if (target) bindings.set(match[1]!, target);
    }
    for (const [alias, target] of bindings) {
      const reachable = reachableModules(target, reexports);
      const member = new RegExp(String.raw`\b` + alias + String.raw`\.([A-Za-z_$][\w$]*)`, "g");
      for (const match of src.matchAll(member)) {
        const name = match[1]!;
        /*
          ⚠ EVERY declaration of the name the binding reaches, not the first
          one walked (#274). `decl.get(name)` answered with one file, so a
          member access that genuinely reached the SECOND declaration of a
          twinned name was discarded as unreachable — eleven names are declared
          twice under `server/` in this tree.
        */
        for (const declaredAt of decls.get(name) ?? []) {
          if (!reachable.has(resolve(join(root, ...declaredAt.split("/"))))) continue;
          /* A module importing from itself is not a consumer. */
          if (declaredAt === here) continue;
          const key = declKey(declaredAt, name);
          const list = prodImportersAt.get(key) ?? [];
          if (!list.includes(here)) list.push(here);
          prodImportersAt.set(key, list);
        }
      }
    }
  }

  const selfUsesAt = new Map<string, number>();
  for (const [key, src] of declSource) {
    const name = key.slice(key.lastIndexOf("::") + 2);
    const hits = src.match(new RegExp(String.raw`\b` + name + String.raw`\b`, "g"))?.length ?? 0;
    /* One hit in the declaring file is the declaration itself. */
    selfUsesAt.set(key, Math.max(0, hits - 1));
  }

  return { decls, prodImportersAt, selfUsesAt, declsAnywhere, files: all.length };
}

/** Production importers of ANY declaration of the name — the derived view. */
export const importerCount = (tree: Tree, name: string) => importersOfName(tree, name).length;

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
  for (const name of before.decls.keys()) {
    if (!after.decls.has(name)) continue;
    if (importerCount(before, name) === 0) continue;
    if (importerCount(after, name) > 0) continue;
    const selfUses = selfUsesOfName(after, name);
    found.push({
      name,
      lostImporters: importersOfName(before, name),
      declaredAt: declFileOf(after, name)!,
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
  for (const name of tree.decls.keys()) {
    timeline.everDeclared.add(name);
    const importers = importersOfName(tree, name);
    if (importers.length > 0) {
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
    const declaredAtHead = head.decls.has(name);
    const importersAtHead = declaredAtHead ? importerCount(head, name) : 0;

    let kind: TimelineKind;
    if (wiredIdx === undefined) kind = "dark-born";
    else if (importersAtHead > 0) kind = timeline.darkAfterWiredIdx.has(name) ? "revived" : "wired-at-head";
    else if (!declaredAtHead) kind = "deleted";
    else kind = "died";

    rows.push({
      name,
      kind,
      declaredAt: declaredAtHead ? declFileOf(head, name)! : null,
      lastWiredIndex: wiredIdx ?? null,
      firstWiredIndex: timeline.firstWiredIdx.get(name) ?? null,
      darkAfterWiredIndex: timeline.darkAfterWiredIdx.get(name) ?? null,
      lostImporters: timeline.lastWiredImporters.get(name) ?? [],
      selfUsesAtHead: declaredAtHead ? selfUsesOfName(head, name) : 0,
    });
  }
  return rows;
}
