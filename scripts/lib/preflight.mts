/**
 * PREFLIGHT — the gate's cheap checks, run on the branch before the first push
 * (#543 build item 1, founder-ordered and urgent 2026-09-05).
 *
 * THE MEASUREMENT THAT ORDERED IT. Over the last 25 merged PRs the gate ran
 * **3.1 times per PR** at ~7 minutes each, and the shift was idle for every one
 * of those minutes: PR opened → merged is 52% of the mean shift (42 min of 80).
 * Nearly all of that repetition is a first run failing on something the branch
 * could have been asked about locally in under a minute. A first gate run
 * should be green BY INTENT, not by luck; the number that says this worked is
 * gate runs per PR falling from 3.1 toward 1.5.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THE CHECK LIST LIVES HERE AND IS VERIFIED AGAINST THE GATE.
 *
 * A second list shadowing a source of truth always drifts from it (working
 * law 4), and this list is exactly that shape: the gate's steps are the truth
 * and these are a local echo of the cheap ones. It cannot be *derived* — the
 * gate's own order is written in YAML as shell strings and only a human knows
 * which of them are cheap enough to run before a push — so the drift is caught
 * instead: `server/preflight.test.ts` reads `.github/workflows/gate.yml` and
 * reddens when a check named here is no longer a step there, or when a new
 * step appears that this file has neither adopted nor explicitly excused.
 *
 * ⚠ THE EXCUSED LIST IS THE HONEST HALF. Preflight deliberately does NOT run
 * gitleaks, actionlint/zizmor, semgrep or the full `pnpm test` — the first
 * three need tools a dev box may not have and the fourth is the thing whose
 * seven minutes we are trying not to spend twice. Each is named in
 * `EXCUSED_GATE_STEPS` with its reason, so "preflight was green and the gate
 * was red" has a written list of the ways that can honestly happen, rather
 * than being a surprise. **A green preflight is a FLOOR, never a promise.**
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE TEST SELECTION, AND ITS ONE HONEST LIMIT.
 *
 * The gate runs the whole suite; preflight runs the vitest files that share a
 * directory with the diff (the card's own rule). That catches the common
 * shape — a change and its neighbouring arms — and it CANNOT catch a distant
 * suite that imports what you changed. `server/` root holds 263 test files and
 * `server/castingV2` another 266, so on this repository "the same directory"
 * is already a substantial run for most server work; the selection prints its
 * own count so the shift can see what it bought.
 */

/** A check preflight runs, in the gate's own order. */
export type PreflightCheck = {
  /** Stable id, used by the drift arm and printed on a red so the shift can name the failing check. */
  readonly id: string;
  /** What the shift sees on the line. */
  readonly label: string;
  /** argv[0] and its arguments — never a shell string, so no quoting exists to get wrong. */
  readonly command: readonly string[];
  /**
   * The `run:` text of the gate step this echoes, matched as a substring of
   * the workflow file. Empty means preflight-only (nothing in the gate to
   * drift from) and the arm skips it.
   */
  readonly gateRun: string;
};

/**
 * A gate step preflight does NOT run, and why. The drift arm requires every
 * gate `run:` line to be either adopted by a check above or excused here, so a
 * new gate step cannot appear without someone deciding which it is.
 *
 * ⚠ `match` EXISTS BECAUSE A PLAIN SUBSTRING EXCUSE FAILS OPEN, AND TWO OF
 * THESE ENTRIES WERE ALREADY DEAD (review findings 2 and 3 on PR #549).
 *
 * `"command"` matches a whole gate command, or that command followed by a
 * space — never a prefix of a longer name. With a bare substring the excuse
 * `pnpm test` swallowed any future `pnpm test:integration` or `pnpm test:e2e`
 * step, which is precisely the "a new step arrived and nobody decided about
 * it" event this list exists to make impossible.
 *
 * `"token"` is a deliberate substring, for the steps the gate runs through a
 * shell script rather than as a bare command. It is the honest exception and
 * it is declared rather than assumed — and it is what fixes the second half of
 * that finding: the `gitleaks` and `actionlint` excuses named binaries that
 * appear nowhere in a gate `run:` line (the gate runs `sh scripts/secret-scan.sh`
 * and `sh scripts/workflow-lint.sh`), so both excused nothing at all and would
 * have sat here forever after those steps left. They name the script now, and
 * an arm requires every excuse to match a real gate command.
 */
export type ExcuseMatch = "command" | "token";

export const EXCUSED_GATE_STEPS: ReadonlyArray<{
  readonly gateRun: string;
  readonly match: ExcuseMatch;
  readonly reason: string;
}> = [
  {
    gateRun: "scripts/secret-scan.sh",
    match: "token",
    reason:
      "the gitleaks secret scan — needs the gitleaks binary, which a dev box is not required to have; the gate is the only place this must hold. A token because the gate runs it inside a shell assignment.",
  },
  {
    gateRun: "scripts/workflow-lint.sh",
    match: "token",
    reason:
      "actionlint + zizmor — needs both binaries installed, and only a workflow diff can fail it. A token because the gate runs it behind environment-variable prefixes.",
  },
  {
    gateRun: "semgrep",
    match: "token",
    reason:
      "needs semgrep (python) installed; the Warden runs it on its own clock and the gate blocks on it. A token because the step is three commands, only one of which is ours.",
  },
  {
    gateRun: "pnpm install --frozen-lockfile",
    match: "command",
    reason: "a local tree already has its dependencies; the lockfile arm is a CI concern.",
  },
  {
    gateRun: "pnpm test",
    match: "command",
    reason:
      "THE SEVEN MINUTES THIS SCRIPT EXISTS TO NOT SPEND TWICE — preflight runs the diff-adjacent files instead (see the header's stated limit).",
  },
  {
    gateRun: "npx tsx scripts/drive-design-laws.mts --controls",
    match: "command",
    reason:
      "drives a browser against a built app; minutes and a dev server, so it belongs to the gate and to a UI shift's own law-6 pass.",
  },
];

/**
 * Whether a gate command is covered by an adopted check or an excuse.
 *
 * Word-boundary by default so `pnpm test` cannot claim `pnpm test:integration`;
 * substring only where an excuse says out loud that it is a token.
 */
export function gateCommandMatches(command: string, run: string, match: ExcuseMatch = "command"): boolean {
  if (match === "token") return command.includes(run);
  return command === run || command.startsWith(`${run} `);
}

/**
 * The cheap checks, in the gate's order. `pnpm check` already carries the
 * scripts typecheck (`tsc -p tsconfig.scripts.json`), so the script guards
 * below are the two BEHAVIOURAL arms the shift close asks for, not a typecheck.
 */
export const PREFLIGHT_CHECKS: readonly PreflightCheck[] = [
  {
    id: "typecheck",
    label: "Typecheck (pnpm check)",
    command: ["pnpm", "check"],
    gateRun: "pnpm check",
  },
  {
    id: "architecture",
    label: "Architecture Atlas freshness",
    command: ["pnpm", "architecture:check"],
    gateRun: "pnpm architecture:check",
  },
  {
    id: "capability",
    label: "Capability Atlas (static)",
    command: ["pnpm", "capability:check"],
    gateRun: "pnpm capability:check",
  },
  {
    id: "script-guards",
    label: "Script guards (exit + connection discipline)",
    command: [
      "node",
      "node_modules/vitest/vitest.mjs",
      "run",
      "server/scriptExitDiscipline.test.ts",
      "server/scriptConnectionDiscipline.test.ts",
    ],
    // Inside `pnpm test` at the gate; run early here because a disposable
    // written this shift is the likeliest thing to have broken them, and it
    // costs seconds.
    gateRun: "",
  },
];

/**
 * Vitest's `include`, mirrored — as ROOT-AND-SUFFIX PAIRS, because the two
 * roots do not take the same suffixes and treating them as one list was wrong
 * at birth (review round 2, finding 2 on PR #549).
 *
 * ⚠ `vitest.config.ts` collects `server/**\/*.test.ts`, `server/**\/*.spec.ts`
 * and `client/src/**\/*.test.ts` — there is **no** `client/src` `.spec.ts`
 * entry. A flat suffix list therefore let preflight select a
 * `client/src/…/x.spec.ts` that vitest never collects: passed as a positional
 * filter beside real files it matches nothing and goes GREEN about a test it
 * never ran, and passed alone it reds with "No test files found" on a file the
 * gate does not run either. Zero `.spec.ts` files exist today, so it was
 * latent — which is exactly when a mirror is cheapest to fix.
 *
 * This is the second mirror in this file (the first shadows `gate.yml`), and
 * working law 4 applies to it identically: `server/preflight.test.ts` parses
 * the real `include` array and reddens when these pairs drift from it.
 */
export const COLLECTED_PATTERNS: ReadonlyArray<{ readonly root: string; readonly suffix: string }> = [
  { root: "server/", suffix: ".test.ts" },
  { root: "server/", suffix: ".spec.ts" },
  { root: "client/src/", suffix: ".test.ts" },
];

/**
 * Whether vitest's `pnpm test` config would collect this path.
 *
 * A changed file outside the collected roots — a script, a doc, a workflow —
 * has no neighbouring suite to select, and saying so is better than selecting
 * none silently.
 */
export function isCollectedTest(file: string): boolean {
  const unix = file.replace(/\\/g, "/");
  // `*.integration.test.ts` needs a running dev server and is excluded from
  // `pnpm test` by the config; selecting one turns a green preflight into a red
  // that has nothing to do with the diff.
  if (unix.includes(".integration.test.")) return false;
  return COLLECTED_PATTERNS.some(({ root, suffix }) => unix.startsWith(root) && unix.endsWith(suffix));
}

/** Whether a changed file sits under a root vitest collects at all. */
function isCollectedRoot(file: string): boolean {
  const unix = file.replace(/\\/g, "/");
  return COLLECTED_PATTERNS.some(({ root }) => unix.startsWith(root));
}

function dirOf(file: string): string {
  const unix = file.replace(/\\/g, "/");
  const cut = unix.lastIndexOf("/");
  return cut === -1 ? "" : unix.slice(0, cut);
}

export type TestSelection = {
  /** The vitest files to run, sorted and deduped. */
  readonly files: readonly string[];
  /** Directories the diff touched that vitest collects from. */
  readonly directories: readonly string[];
  /** Changed files vitest could never collect a neighbour for, with their reason. */
  readonly uncovered: readonly string[];
  /** Suites selected because they are ABOUT a changed tree, not beside it. */
  readonly subjectFiles: readonly string[];
};

/**
 * A quoted path-shaped literal: at least one slash, no spaces, no interpolation.
 * Deliberately loose — every candidate is then RESOLVED against the real tree,
 * so a literal that is not a directory costs nothing but a set lookup.
 */
/*
  ⚠ THE FIRST SEGMENT ALTERNATES, AND THE OBVIOUS `@?` DOES NOT WORK. The alias
  in this repo is a BARE `@` followed straight by a slash (`@/features/…`), so
  `@?[A-Za-z0-9_.-]+` — which still demands a word character before the first
  slash — matched nothing at all. Caught by driving the review's own specimen
  and finding it still absent, not by reading the pattern.
*/
const PATH_LITERAL = /["'`]((?:@[A-Za-z0-9_.-]*|[A-Za-z0-9_.-]+)(?:\/[A-Za-z0-9_.-]+)+)["'`]/g;

/**
 * The extensions an import may leave off. Tried only when the literal as
 * written is not a path in the tree, so an existing directory always wins.
 *
 * ⚠ **WITHOUT THIS THE BEHAVIOUR DIFFERS BY SPELLING INSIDE ONE FILE (PR #616
 * review, finding 1b).** `server/architectureCreditCosts.test.ts` — CLAUDE.md's
 * own price-list guard — imports its four cost modules extensionless
 * (`"./casting/castingCreditCosts"`) and `"../scripts/generate-architecture.mts"`
 * with an extension; only the second resolved, so a change to a cost module did
 * not select the suite that guards its prices. Measured at the tree: **108**
 * suites in `server/` alone carry cross-directory extensionless imports.
 */
const IMPLIED_EXTENSIONS = [".ts", ".tsx", ".mts", ".mjs", ".js", ".json"];

/**
 * `tsconfig.json`'s `compilerOptions.paths`, as `[prefix, replacement]` pairs —
 * DERIVED, never a hand-kept copy (working law 4), because a second list of
 * aliases would drift the first time one is added.
 *
 * ⚠ **AN ALIAS IMPORT PRODUCED NO CANDIDATE AT ALL BEFORE THIS (PR #616 review,
 * finding 1a).** `client/src/features/operations/outcomeShown.test.ts` imports
 * `"@/features/castingV2/failureCopy"` and asserts on that module's copy,
 * reaching it by no other literal — so a change to `failureCopy.ts` selected
 * castingV2's own neighbours, read as covered, and the cross-tree suite about
 * it never ran. That is #565's scenario verbatim, in a different spelling.
 *
 * A tsconfig that cannot be read or has no `paths` yields no aliases: the index
 * loses the alias spelling and keeps every other, which is the direction this
 * whole selection fails in by design.
 */
export function aliasPrefixes(tsconfigText: string): Array<readonly [string, string]> {
  let paths: Record<string, unknown>;
  try {
    /* Strip line comments — tsconfig permits them and JSON.parse does not. */
    const stripped = tsconfigText.replace(/^\s*\/\/.*$/gm, "");
    paths = (JSON.parse(stripped)?.compilerOptions?.paths ?? {}) as Record<string, unknown>;
  } catch {
    return [];
  }
  const out: Array<readonly [string, string]> = [];
  for (const [pattern, targets] of Object.entries(paths)) {
    const target = Array.isArray(targets) ? targets[0] : undefined;
    if (typeof target !== "string") continue;
    if (!pattern.endsWith("/*") || !target.endsWith("/*")) continue;
    out.push([
      pattern.slice(0, -1),
      target.slice(0, -1).replace(/^\.\//, ""),
    ] as const);
  }
  return out;
}

/**
 * Collapse `.` and `..` inside a repo-relative path.
 *
 * ⚠ **WITHOUT THIS THE INDEX MISSES THE SUITE THAT OWNS THE FILE, and it was
 * found by driving preflight on this very change rather than by reasoning.**
 * `server/preflight.test.ts` reaches its subject as `"../scripts/lib/preflight.mts"`,
 * so the resolved candidate is the literal string `server/../scripts/lib`,
 * which is not in the directory set and matched nothing. The suite most about
 * the change was the one suite the index could not find.
 *
 * A path that climbs above the repo root returns null rather than clamping:
 * `../../elsewhere` is not a directory of this tree and must not resolve to one.
 */
function normalizeRepoPath(candidate: string): string | null {
  const out: string[] = [];
  for (const part of candidate.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

/** The directories a path sits under, longest first, ending at the repo root. */
function ancestorsOf(file: string): string[] {
  const parts = file.replace(/\\/g, "/").split("/");
  const out: string[] = [];
  for (let i = parts.length - 1; i > 0; i -= 1) out.push(parts.slice(0, i).join("/"));
  out.push("");
  return out;
}

/**
 * Which directories of this repository a test file is ABOUT — the reverse of
 * adjacency, and the answer to #565.
 *
 * ⚠ **A GUARD'S FILE AND ITS SUBJECT ARE DIFFERENT THINGS, ON PURPOSE.**
 * `client/src/foundation/token-guard.test.ts` guards four feature trees;
 * `architectureAtlas.test.ts` guards the whole server. Directory adjacency
 * finds the suites that sit NEXT TO a change and cannot find the suites that
 * are ABOUT it — so preflight went green on PR #563 and the gate reddened seven
 * minutes later on the guard that owns the changed directory.
 *
 * ⚠ **A LITERAL IS RESOLVED AGAINST THE TREE, NOT MATCHED AGAINST A ROOT
 * PREFIX — AND #565'S OWN RECOMMENDATION FAILS WITHOUT THAT.** Measured before
 * this was written: reading only literals spelled from a repo root
 * (`client/src/…`, `server/…`) finds **zero** subjects for that card's own
 * specimen, because `token-guard.test.ts` writes `"features/castingV2"`,
 * relative to `client/src`. Written the card's way this would have shipped
 * green and still missed the incident that produced it.
 *
 * The resolution takes no list of roots: a literal is tried against the
 * DECLARING FILE'S OWN ANCESTORS, longest first, up to the repo root. That is
 * derived from where the suite actually sits (working law 4), so it cannot rot
 * the way an enumerated root list would.
 *
 * ⚠ **A SUITE IS NEVER ITS OWN SUBJECT.** Its own directory is already covered
 * by adjacency, and counting it here would make every `__fixtures__` path in
 * every suite re-select the directory it already lives in.
 *
 * ⚠ **THE SUBJECT IS THE EXACT PATH THE LITERAL NAMES — A FILE STAYS A FILE.**
 * The first shape here widened a file literal to its directory, and driving it
 * showed why that is wrong: every suite importing anything from `scripts/lib`
 * became a subject of every OTHER module in `scripts/lib`, and a two-file change
 * selected **71** suites where the precise reading selects a fraction of that.
 * Importing a neighbour is not being about it. A literal naming a DIRECTORY is
 * about that whole tree, which is what a cross-tree guard writes and is the
 * case #565 exists for.
 *
 * @param tests      `[repo-relative test path, its source text]` pairs
 * @param realPaths  every file AND directory that exists in the tree
 */
export function buildSubjectIndex(
  tests: ReadonlyArray<readonly [string, string]>,
  realPaths: ReadonlySet<string>,
  aliases: ReadonlyArray<readonly [string, string]> = [],
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const [rawPath, text] of tests) {
    const test = rawPath.replace(/\\/g, "/");
    const own = dirOf(test);
    const roots = ancestorsOf(test);
    const named = new Set<string>();
    for (const match of text.matchAll(PATH_LITERAL)) {
      const candidate = match[1]!;
      /*
        An ALIAS is absolute from the repo root, so it is tried alone rather
        than against the ancestors — `@/features/x` under `client/src/…` must
        not also be read as `client/src/features/operations/@/features/x`.
      */
      const alias = aliases.find(([prefix]) => candidate.startsWith(prefix));
      const attempts = alias
        ? [`${alias[1]}${candidate.slice(alias[0].length)}`]
        : roots.map((root) => (root ? `${root}/${candidate}` : candidate));

      let hit: string | null = null;
      for (const attempt of attempts) {
        const resolved = normalizeRepoPath(attempt);
        if (!resolved) continue;
        /*
          The literal as written wins; only then are the implied extensions
          tried, so an existing DIRECTORY is never shadowed by a same-named file.
        */
        if (realPaths.has(resolved)) { hit = resolved; break; }
        const implied = IMPLIED_EXTENSIONS.map((ext) => `${resolved}${ext}`).find((p) => realPaths.has(p));
        if (implied) { hit = implied; break; }
      }
      /* Its own path and its own directory are adjacency's job, not this. */
      if (hit && hit !== own && hit !== test) named.add(hit);
    }
    for (const subject of named) {
      const bucket = index.get(subject);
      if (bucket) bucket.push(test);
      else index.set(subject, [test]);
    }
  }
  return index;
}

/**
 * The card's rule, exactly: the vitest files whose paths share a directory
 * with the diff.
 *
 * A changed file that IS a test file selects itself, which matters because the
 * commonest diff of all on this team is a source file plus its arm.
 *
 * ⚠ **ADJACENCY ALONE IS BLIND TO THE SUITE THAT OWNS THE CHANGE (#565).** A
 * `subjects` index — see `buildSubjectIndex` — adds the suites that NAME a
 * changed directory, whether or not they sit in it. Passing none keeps the
 * original behaviour exactly, which is what the arms compare against.
 *
 * ⚠ **AND SUBJECTS ARE READ FOR A CHANGED FILE OUTSIDE THE COLLECTED ROOTS
 * TOO, WHICH IS THE BIGGER HALF.** Measured: a one-file change under `shared/`
 * or `scripts/lib/` selected **nothing at all** — those roots hold no suites,
 * so every such file went straight to `uncovered` and the whole step was
 * silently empty. `scripts/lib/` is where this team's own instruments live.
 *
 * @param changed    repo-relative paths the diff touches (any slash style)
 * @param repoTests  every vitest-collected test path in the repository
 * @param subjects   directory -> suites ABOUT it, from `buildSubjectIndex`
 */
export function selectDiffAdjacentTests(
  changed: readonly string[],
  repoTests: readonly string[],
  subjects: ReadonlyMap<string, readonly string[]> = new Map(),
): TestSelection {
  const tests = repoTests.map((t) => t.replace(/\\/g, "/")).filter(isCollectedTest);
  const collected = new Set(tests);
  const byDirectory = new Map<string, string[]>();
  for (const test of tests) {
    const dir = dirOf(test);
    const bucket = byDirectory.get(dir);
    if (bucket) bucket.push(test);
    else byDirectory.set(dir, [test]);
  }

  const directories = new Set<string>();
  const uncovered: string[] = [];
  const subjectFiles = new Set<string>();
  for (const raw of changed) {
    const file = raw.replace(/\\/g, "/");
    const dir = dirOf(file);
    /*
      THE FILE ITSELF, ITS DIRECTORY, AND EVERY TREE ABOVE IT. A guard that
      names a whole tree (`token-guard.test.ts` writes "features/castingV2")
      owns everything under it, so a change three directories down is still its
      subject — that is the case adjacency cannot see and this exists for.
    */
    const claims = [file, dir, ...ancestorsOf(file).slice(1)];
    /*
      A suite is only runnable if vitest collects it — the subject index is
      built from the same list, but filtering here means a stale or hand-made
      index can never put a file vitest ignores on the command line, which is
      how preflight goes green about a test it never ran.
    */
    const about = [...new Set(claims.flatMap((c) => subjects.get(c) ?? []))].filter((t) => collected.has(t));
    for (const test of about) subjectFiles.add(test);

    const adjacent = isCollectedRoot(file) && byDirectory.has(dir);
    if (adjacent) directories.add(dir);
    /* Uncovered means NOTHING selected it — neither beside it nor about it. */
    if (!adjacent && about.length === 0) uncovered.push(file);
  }

  const files = new Set<string>();
  for (const dir of directories) for (const test of byDirectory.get(dir) ?? []) files.add(test);
  for (const test of subjectFiles) files.add(test);

  return {
    files: [...files].sort(),
    directories: [...directories].sort(),
    uncovered: [...new Set(uncovered)].sort(),
    subjectFiles: [...subjectFiles].sort(),
  };
}

/**
 * Every `run:` command the gate executes, read out of the workflow text.
 *
 * Deliberately a text read rather than a YAML parse: the arm's job is to
 * notice that a step's COMMAND changed, and the surrounding YAML shape is not
 * part of that question. Multi-line `run: |` blocks are flattened to their
 * lines, so a substring match against `gateRun` finds a command wherever in a
 * block it sits.
 */
export function gateRunCommands(workflowText: string): string[] {
  const lines = workflowText.split(/\r?\n/);
  const commands: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    // ⚠ A FOLDED BLOCK IS REFUSED, NOT PARSED WRONG (review round 2, nit).
    // `run: >` would otherwise read as the literal command ">" and every line
    // of its body would go unseen — one more silent road into the drift arm,
    // which is the one thing this reader must never have. The gate uses no
    // folded blocks today; if one arrives, this says so instead of going quiet.
    if (/^\s*run:\s*>[-+]?\s*$/.test(lines[i])) {
      throw new Error(
        "gate.yml uses a folded `run: >` block, which this reader cannot see into — teach it the shape before trusting the drift arm again",
      );
    }
    const inline = /^\s*run:\s*(?!\|)(\S.*)$/.exec(lines[i]);
    if (inline) {
      commands.push(inline[1].trim());
      continue;
    }
    const block = /^(\s*)run:\s*\|\s*$/.exec(lines[i]);
    if (!block) continue;
    const indent = block[1].length;
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j];
      if (line.trim() === "") continue;
      const lineIndent = line.length - line.trimStart().length;
      if (lineIndent <= indent) break;
      commands.push(line.trim());
    }
  }
  return commands;
}

/**
 * Vitest's own node entry, invoked directly rather than through `npx`.
 *
 * ⚠ THIS IS A COMMAND-LINE LENGTH DECISION, NOT A TIDINESS ONE, AND IT WAS
 * MEASURED. `npx` is a `.cmd` shim on Windows, so spawning it needs
 * `shell: true`, which routes the command through **cmd.exe and its 8191-character
 * limit**. A change to any file in `server/` selects 263 neighbouring suites,
 * and that command line measures **9,075 characters** — over the limit, on the
 * commonest diff shape this repository has. The same limit silently killed four
 * shifts in one day when the standing orders crossed it (#332): the process
 * dies in the same second, with exit 0 and an empty log.
 *
 * `node <entry>` needs no shell, so it goes through CreateProcess (32,767) —
 * and the chunking below keeps every invocation under that too.
 */
export const VITEST_ENTRY = "node_modules/vitest/vitest.mjs";

/**
 * Room for one command line, well under CreateProcess's 32,767 so that the
 * cwd, the entry path and the environment block are never the thing that
 * tips it over.
 */
export const ARGV_BUDGET_CHARS = 24_000;

/**
 * Split a file list into runs that each fit the budget.
 *
 * ⚠ It CHUNKS rather than truncating, and that is the whole point: a selector
 * that quietly drops the files past a limit is green about tests it never ran,
 * which is worse than not selecting them in the first place because it reads
 * as coverage. Every selected file runs, in some chunk.
 *
 * A single path longer than the budget cannot be placed and would otherwise
 * loop forever; it gets its own chunk and the caller learns from the run.
 */
export function chunkVitestFiles(
  files: readonly string[],
  budget: number = ARGV_BUDGET_CHARS,
): string[][] {
  const prefixLength = `node ${VITEST_ENTRY} run`.length;
  const chunks: string[][] = [];
  let current: string[] = [];
  let length = prefixLength;
  for (const file of files) {
    const cost = file.length + 1;
    if (current.length > 0 && length + cost > budget) {
      chunks.push(current);
      current = [];
      length = prefixLength;
    }
    current.push(file);
    length += cost;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function vitestArgv(files: readonly string[]): string[] {
  return ["node", VITEST_ENTRY, "run", ...files];
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}
