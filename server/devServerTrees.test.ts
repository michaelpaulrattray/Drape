/**
 * KILL THE ROOT, NEVER THE LISTENER — the mechanical form of a warning that
 * three seats read and three seats then ignored (filed fable-1450).
 *
 * `pnpm dev` is a WATCHER plus a CHILD. `netstat -ano | findstr :300` names the
 * CHILD, so the pid a person has in hand is always the wrong one: killing it
 * frees the port for about thirty seconds and then the watcher starts another
 * server, on whatever port is free by then. Four were listening at once on
 * 2026-08-23, and one paid browser drive hit a stale one — which is how an
 * instrumented run came back carrying no instrumentation.
 *
 * The fixture below is that exact process table: two trees, each with a child
 * holding a port, and one of them the founder's own from before the shift.
 *
 * ⚠ **The fixture family shares nothing that would rescue a wrong answer.** The
 * child's command line differs from its root's by ONE token (`watch`), which is
 * the only discriminator a process table offers — so an implementation matching
 * on the entrypoint alone passes every arm about counting and fails the two
 * that matter.
 */
import { describe, expect, it } from "vitest";

import {
  devServerTrees,
  isDevServerChild,
  isDevServerRoot,
  launchDirectoryOf,
  listenersOutsideEveryTree,
  rootsStartedAfter,
  pidsNamed,
  rootsToKill,
  type ProcessRow,
} from "../scripts/lib/devServerTrees.mts";

const at = (hhmm: string) => new Date(`2026-08-23T${hhmm}:00.000Z`);

/** The founder's, from before the shift; and one of mine, from during it. */
const TABLE: ProcessRow[] = [
  {
    pid: 14660,
    parentPid: 1492,
    name: "node.exe",
    startedAt: at("07:49"),
    commandLine: 'node "C:\\Users\\Admin\\Drape\\node_modules\\.bin\\..\\.pnpm\\tsx@4.20.6\\node_modules\\tsx\\dist\\cli.mjs" "watch" "server/_core/index.ts"',
  },
  {
    pid: 12316,
    parentPid: 14660,
    name: "node.exe",
    startedAt: at("13:42"),
    commandLine: '"C:\\Program Files\\nodejs\\node.exe" --require C:/Users/Admin/Drape/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/preflight.cjs server/_core/index.ts',
  },
  {
    pid: 22316,
    parentPid: 14784,
    name: "node.exe",
    startedAt: at("13:51"),
    commandLine: 'node "C:\\Users\\Admin\\Drape\\node_modules\\.pnpm\\tsx@4.20.6\\node_modules\\tsx\\dist\\cli.mjs" "watch" "server/_core/index.ts"',
  },
  {
    pid: 21752,
    parentPid: 22316,
    name: "node.exe",
    startedAt: at("13:52"),
    commandLine: '"C:\\Program Files\\nodejs\\node.exe" --require C:/Users/Admin/Drape/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/preflight.cjs server/_core/index.ts',
  },
  /* A disposable script, which runs tsx and is not a server. */
  {
    pid: 9001,
    parentPid: 4000,
    name: "node.exe",
    startedAt: at("14:10"),
    commandLine: 'node "C:\\Users\\Admin\\Drape\\node_modules\\.pnpm\\tsx@4.20.6\\node_modules\\tsx\\dist\\cli.mjs" "scripts/_court-glossary-disposable.mts"',
  },
];

describe("telling a watcher from the server it keeps restarting", () => {
  it("a WATCHER is the one carrying the watch verb", () => {
    expect(TABLE.filter(isDevServerRoot).map((row) => row.pid)).toEqual([14660, 22316]);
  });

  it("a CHILD runs the same entrypoint and is not a watcher", () => {
    expect(TABLE.filter(isDevServerChild).map((row) => row.pid)).toEqual([12316, 21752]);
  });

  it("a tsx script that is not a server is neither", () => {
    const script = TABLE.find((row) => row.pid === 9001)!;
    expect(isDevServerRoot(script)).toBe(false);
    expect(isDevServerChild(script)).toBe(false);
  });

  it("pairs each watcher with what it owns, oldest first", () => {
    expect(devServerTrees(TABLE)).toEqual([
      {
        rootPid: 14660,
        startedAt: at("07:49"),
        childPids: [12316],
        watched: true,
        launchedFrom: "C:/Users/Admin/Drape",
      },
      {
        rootPid: 22316,
        startedAt: at("13:51"),
        childPids: [21752],
        watched: true,
        launchedFrom: "C:/Users/Admin/Drape",
      },
    ]);
  });
});

describe("⚠ the refusal, which is the whole point", () => {
  it("REFUSES a child's pid and names the root it belongs to", () => {
    /*
      21752 is what `netstat` hands you. Killing it frees the port and the
      watcher starts another server thirty seconds later — the mistake, made
      three times, in one assertion.
    */
    const verdict = rootsToKill(TABLE, [21752]);
    expect(verdict.kind).toBe("refused");
    expect(verdict.kind === "refused" && verdict.reason).toContain("CHILD");
    expect(verdict.kind === "refused" && verdict.reason).toContain("22316");
  });

  it("CONTROL — the root of that very tree is accepted", () => {
    /* Without this, the refusal above could be a constant and would prove
       nothing about which pid was passed. */
    expect(rootsToKill(TABLE, [22316])).toEqual({ kind: "kill", rootPids: [22316] });
  });

  it("refuses a pid that is not a dev server at all", () => {
    expect(rootsToKill(TABLE, [9001]).kind).toBe("refused");
  });

  it("refuses the whole batch when one member is wrong", () => {
    /* A partial kill is the worst outcome: some trees gone, one respawning,
       and a report saying the cleanup ran. */
    expect(rootsToKill(TABLE, [22316, 21752]).kind).toBe("refused");
  });

  it("REFUSES an empty target list rather than reporting a kill of nothing", () => {
    /*
      #642's declared remainder, filed by PR #670's review. The loop below never
      runs on an empty list, so this returned `{ kind: "kill", rootPids: [] }`
      and dev-servers.mts killed nothing, printed the trees still standing, and
      exited 0 — which reads as a successful cleanup.

      An empty list is never a legitimate kill instruction: the --since path
      exits earlier on its own "nothing to kill", so the only way to arrive
      here empty is that every word the operator named was unusable.
    */
    const verdict = rootsToKill(TABLE, []);
    expect(verdict.kind).toBe("refused");
    expect(verdict.kind === "refused" && verdict.reason).toContain("no pid");
  });
});

describe("⚠ the pids the operator NAMED, before any of them is a number", () => {
  /*
    `--kill abc`, `--kill 0` and `--kill ""` all became [] through
    `.map(Number).filter(Boolean)` — NaN and 0 are both falsy — and the script
    then exited 0 having killed nothing. The parse it sits behind catches the
    MISSING-value spelling (`--kill` with nothing after it); this catches the
    UNUSABLE-value one, which is the half that was left open.
  */
  it("reads a plain list of pids", () => {
    expect(pidsNamed("22316, 29132")).toEqual({ kind: "pids", pids: [22316, 29132] });
  });

  it("refuses a word that is not a number, and quotes it back", () => {
    const verdict = pidsNamed("abc");
    expect(verdict.kind).toBe("refused");
    expect(verdict.kind === "refused" && verdict.reason).toContain("abc");
  });

  it("refuses 0, which is falsy and was silently dropped", () => {
    expect(pidsNamed("0").kind).toBe("refused");
  });

  it("refuses an empty string", () => {
    expect(pidsNamed("").kind).toBe("refused");
  });

  it("refuses a NEGATIVE and a fractional pid", () => {
    expect(pidsNamed("-1").kind).toBe("refused");
    expect(pidsNamed("22316.5").kind).toBe("refused");
  });

  it("⚠ refuses the WHOLE list when one member is unusable, naming only that one", () => {
    /*
      The direction that matters: `--kill 22316,abc` used to drop "abc" and kill
      22316, so the operator got a partial cleanup and no word about it. Same
      reasoning as the batch refusal above.
    */
    const verdict = pidsNamed("22316,abc");
    expect(verdict.kind).toBe("refused");
    expect(verdict.kind === "refused" && verdict.reason).toContain("abc");
    /* ⚠ NO TRAILING SPACE (PR #676 review). The regression this guards against
       is `pidsNamed` quoting every word back, which reads `"22316", "abc"` — a
       quote after the digits, never a space — so the assertion would have
       stayed green through exactly the failure it documents. Plain and
       stronger: the correct reason contains no other occurrence of them. */
    expect(verdict.kind === "refused" && verdict.reason).not.toContain("22316");
  });
});

/**
 * ⚠ ONE `pnpm dev`, READ OFF THIS MACHINE — #658.
 *
 * Not a shape reasoned about: a dev server was started 2026-09-08 05:13 and its
 * ancestry walked with `Get-CimInstance Win32_Process`, pids and command lines
 * verbatim below. `pnpm dev` is `cross-env NODE_ENV=development tsx watch …`,
 * and `cross-env` starts the watcher through a **`cmd.exe`** — so the table
 * holds two node processes that every command-line test calls a watcher, with
 * a shell between them that a `Name='node.exe'` filter cannot see.
 *
 * Before the fix the reader printed this as TWO trees (`root 29132 … children
 * [none]` beside `root 32244 … children [28220] :3000`), and killing 29132
 * alone left NOTHING behind — which is what says 29132 is the root and 32244 is
 * not.
 *
 * The two shells are in the fixture on purpose. They are what makes the walk
 * possible, and they are also why `isNodeProcess` exists: `cmd.exe` repeats the
 * command line it was handed, so without that gate the same server would grow
 * two MORE roots the moment the whole table came into view.
 */
const PNPM_DEV: ProcessRow[] = [
  {
    pid: 34936,
    parentPid: 27076,
    name: "node.exe",
    startedAt: at("05:13"),
    commandLine: 'node   "C:\\Users\\Admin\\AppData\\Local\\pnpm\\.tools\\pnpm\\10.28.2\\bin\\\\..\\node_modules\\pnpm\\bin\\pnpm.cjs" "dev"',
  },
  {
    pid: 6240,
    parentPid: 34936,
    name: "cmd.exe",
    startedAt: at("05:13"),
    commandLine: "C:\\Windows\\system32\\cmd.exe /d /s /c cross-env NODE_ENV=development tsx watch server/_core/index.ts",
  },
  {
    pid: 29132,
    parentPid: 6240,
    name: "node.exe",
    startedAt: at("05:13"),
    commandLine: 'node   "C:\\Users\\Admin\\Drape\\node_modules\\.bin\\\\..\\cross-env\\dist\\bin\\cross-env.js" NODE_ENV=development tsx watch server/_core/index.ts',
  },
  {
    pid: 30356,
    parentPid: 29132,
    name: "cmd.exe",
    startedAt: at("05:13"),
    commandLine: 'C:\\Windows\\system32\\cmd.exe /d /s /c "tsx ^^^"watch^^^" ^^^"server/_core/index.ts^^^""',
  },
  {
    pid: 32244,
    parentPid: 30356,
    name: "node.exe",
    startedAt: at("05:13"),
    commandLine: 'node   "C:\\Users\\Admin\\Drape\\node_modules\\.bin\\\\..\\tsx\\dist\\cli.mjs" "watch" "server/_core/index.ts"',
  },
  {
    pid: 28220,
    parentPid: 32244,
    name: "node.exe",
    startedAt: at("05:14"),
    commandLine: '"C:\\Program Files\\nodejs\\node.exe" --require C:\\Users\\Admin\\Drape\\node_modules\\.pnpm\\tsx@4.20.6\\node_modules\\tsx\\dist\\loader.mjs server/_core/index.ts',
  },
];

describe("⚠ one `pnpm dev` is ONE tree, whatever it is made of (#658)", () => {
  it("reads the measured chain as a single tree rooted at cross-env", () => {
    expect(devServerTrees(PNPM_DEV)).toEqual([
      {
        rootPid: 29132,
        startedAt: at("05:13"),
        childPids: [32244, 28220],
        watched: true,
        /* ⚠ NOT read off the root: `cross-env.js` is the root's own path and
           names no `tsx`, so the tree answers from the watcher below it. */
        launchedFrom: "C:/Users/Admin/Drape",
      },
    ]);
  });

  it("⚠ NEGATIVE CONTROL — a watcher with no watcher above it is still its own root", () => {
    /*
      #561's 4 September rows were tsx-only, with no cross-env process visible
      at all, and the two shapes sat in ONE listing. A fix that attributed every
      watcher to something would have traded an over-count for an under-count —
      and an under-count is the direction that leaves servers on his machine.
    */
    expect(devServerTrees(TABLE).map((tree) => tree.rootPid)).toEqual([14660, 22316]);
  });

  it("⚠ CONTROL — the two shapes in one table stay two trees, not one and not three", () => {
    const mixed = [...TABLE, ...PNPM_DEV];
    expect(devServerTrees(mixed).map((tree) => tree.rootPid).sort()).toEqual([14660, 22316, 29132].sort());
  });

  it("CONTROL — an empty table is no trees, and one server is one tree", () => {
    /* Without this the arms above pass on a reader that has stopped reading. */
    expect(devServerTrees([])).toEqual([]);
    expect(devServerTrees(PNPM_DEV)).toHaveLength(1);
  });

  it("a `cmd.exe` repeating the watch command is NOT a watcher", () => {
    const shells = PNPM_DEV.filter((row) => row.name === "cmd.exe");
    expect(shells).toHaveLength(2);
    for (const shell of shells) {
      expect(isDevServerRoot(shell)).toBe(false);
      expect(isDevServerChild(shell)).toBe(false);
    }
  });

  it("names the inner watcher as the root's, and refuses it as a kill target", () => {
    const verdict = rootsToKill(PNPM_DEV, [32244]);
    expect(verdict.kind).toBe("refused");
    expect(verdict.kind === "refused" && verdict.reason).toContain("29132");
    /* CONTROL, so the refusal cannot be a constant: the real root is accepted. */
    expect(rootsToKill(PNPM_DEV, [29132])).toEqual({ kind: "kill", rootPids: [29132] });
  });

  it("still refuses the pid `netstat` hands you, which is the port holder", () => {
    const verdict = rootsToKill(PNPM_DEV, [28220]);
    expect(verdict.kind).toBe("refused");
    expect(verdict.kind === "refused" && verdict.reason).toContain("29132");
  });

  it("counts one shift's own dev server ONCE, which is what the hygiene rule reads", () => {
    /* The 2026-09-07 sweep read eleven trees where seven were running: the
       number a shift acts on, wrong by 57% before anyone had to be careless. */
    expect(rootsStartedAfter(PNPM_DEV, at("05:00"))).toHaveLength(1);
  });

  it("⚠ refuses the SHELL between the two watchers, and says what killing it would do", () => {
    /*
      PR #659 review, note 1. The refusal held — a shell is not a root — but it
      said *"not a dev-server process at all"*, which describes the child LIST
      rather than the machine: `childPids` holds node processes, so the shell
      is invisible to it. Somebody reading that would reasonably go kill it by
      hand and orphan the watcher below it.
    */
    const verdict = rootsToKill(PNPM_DEV, [30356]);
    expect(verdict.kind).toBe("refused");
    expect(verdict.kind === "refused" && verdict.reason).toContain("29132");
    expect(verdict.kind === "refused" && verdict.reason).not.toContain("not a dev-server process");
  });

  it("CONTROL — a pid in no tree at all is still refused as exactly that", () => {
    /* The sentence above must not become the answer to everything: a process
       that belongs to no dev server keeps the plain refusal. */
    const stranger = rootsToKill(PNPM_DEV, [34936]);
    expect(stranger.kind === "refused" && stranger.reason).toContain("not a dev-server process");
  });

  it("⚠ an unreadable creation date stops the walk instead of passing the guard", () => {
    /*
      PR #659 review, note 2: `NaN > x` is `false`, so a row whose date the
      process table would not give up sailed through the recycled-pid guard.
      Here the shell's date is unreadable, so the inner watcher can no longer
      be attributed and reads as its own root — the over-count direction, which
      is the one that leaves nothing running unseen.
    */
    const unreadable = PNPM_DEV.map((row) =>
      row.pid === 30356 ? { ...row, startedAt: new Date("not a date") } : row);
    expect(devServerTrees(unreadable).map((tree) => tree.rootPid).sort()).toEqual(
      [29132, 32244].sort(),
    );
  });

  it("⚠ a recycled pid does not adopt a live server", () => {
    /*
      Windows reuses pids. A parent that started AFTER its child is not that
      child's parent, and treating it as one would hide a running server inside
      an unrelated tree — the under-count direction again.
    */
    const recycled = PNPM_DEV.map((row) =>
      row.pid === 29132 ? { ...row, startedAt: at("06:00") } : row);
    const roots = devServerTrees(recycled).map((tree) => tree.rootPid).sort();
    expect(roots).toEqual([29132, 32244].sort());
  });
});

describe("whose server is it — the only honest discriminator is time", () => {
  it("takes the shift's own and leaves the one that was already running", () => {
    /* The founder runs his own on this machine. A cleanup that kills it is
       worse than a cleanup that leaves litter. */
    expect(rootsStartedAfter(TABLE, at("13:30")).map((tree) => tree.rootPid)).toEqual([22316]);
  });

  it("takes a tree born exactly at the cutoff", () => {
    /* Leaving one of your own behind is the failure this exists to prevent;
       asking about one extra is a question rather than a loss. */
    expect(rootsStartedAfter(TABLE, at("13:51")).map((tree) => tree.rootPid)).toEqual([22316]);
  });

  it("CONTROL — a cutoff before everything takes everything", () => {
    expect(rootsStartedAfter(TABLE, at("00:00")).map((tree) => tree.rootPid)).toEqual([14660, 22316]);
  });
});

/**
 * ⚠ A DEV SERVER WITH NO WATCHER, AND THE READING THAT CALLED IT A CLEAN
 * MACHINE — #783.
 *
 * Not a shape reasoned about. `npx tsx server/_core/index.ts` was started on
 * this machine at 2026-09-11 07:12 and its ancestry read with
 * `Get-CimInstance Win32_Process`; the pids, names and command lines below are
 * that reading verbatim. In the same second, `netstat` said
 * `0.0.0.0:3000 LISTENING 45988` and `dev-servers.mts` said **"no dev server is
 * running on this machine."**
 *
 * That is the whole defect: **no row here carries the watch verb**, so none was
 * a root, and a child with no watcher above it belonged to nothing — the tree
 * was dropped, and a dropped tree prints the same sentence as an empty machine.
 * Four consecutive shifts read it and reported the machine clean, the last of
 * them about a process that had been serving for two days.
 *
 * ⚠ **The `npx` hop is in the fixture because it is the trap.** Its command
 * line names npm's OWN global install — `…/AppData/Roaming/npm/node_modules/…`
 * — so a launch-directory reader that takes the first `node_modules` it sees
 * reports the tree as launched from a directory that has nothing to do with it,
 * and therefore reports it PRESENT when the worktree it really ran from is
 * gone. Which is precisely the verdict this card exists to get right.
 */
const at911 = (hhmmss: string) => new Date(`2026-09-11T${hhmmss}.000Z`);

const UNWATCHED: ProcessRow[] = [
  {
    pid: 94160,
    parentPid: 92124,
    name: "sh.exe",
    startedAt: at911("07:12:23"),
    commandLine: '"C:\\Program Files\\Git\\usr\\bin\\sh.exe" /c/Users/Admin/AppData/Roaming/npm/npx tsx server/_core/index.ts',
  },
  {
    pid: 94344,
    parentPid: 94160,
    name: "node.exe",
    startedAt: at911("07:12:23"),
    commandLine: '"C:\\Program Files\\nodejs\\node.exe" C:\\Users\\Admin\\AppData\\Roaming\\npm/node_modules/npm/bin/npx-cli.js tsx server/_core/index.ts',
  },
  {
    pid: 94816,
    parentPid: 94344,
    name: "cmd.exe",
    startedAt: at911("07:12:24"),
    commandLine: "C:\\Windows\\system32\\cmd.exe /d /s /c tsx server/_core/index.ts",
  },
  {
    pid: 74644,
    parentPid: 94816,
    name: "node.exe",
    startedAt: at911("07:12:24"),
    commandLine: 'node   "C:\\Users\\Admin\\Drape\\node_modules\\.bin\\\\..\\.pnpm\\tsx@4.20.6\\node_modules\\tsx\\dist\\cli.mjs" server/_core/index.ts',
  },
  {
    pid: 45988,
    parentPid: 74644,
    name: "node.exe",
    startedAt: at911("07:12:24"),
    commandLine: '"C:\\Program Files\\nodejs\\node.exe" --require C:\\Users\\Admin\\Drape\\node_modules\\.pnpm\\tsx@4.20.6\\node_modules\\tsx\\dist\\preflight.cjs --import file:///C:/Users/Admin/Drape/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/loader.mjs server/_core/index.ts',
  },
];

describe("⚠ a server with no watcher is still a server (#783)", () => {
  it("⚠ THE DEFECT — not one row in the measured table is a watcher", () => {
    /* The arm that says WHY it was invisible rather than only that it was. An
       implementation that starts listing these trees by loosening the watcher
       test instead would fail here, and it should: `watched` is the fact a
       person killing one needs, and it must stay false. */
    expect(UNWATCHED.filter(isDevServerRoot)).toEqual([]);
  });

  it("reads the measured table as ONE tree, rooted at the outermost of them", () => {
    expect(devServerTrees(UNWATCHED)).toEqual([
      {
        rootPid: 94344,
        startedAt: at911("07:12:23"),
        childPids: [74644, 45988],
        watched: false,
        launchedFrom: "C:/Users/Admin/Drape",
      },
    ]);
  });

  it("⚠ names the LAUNCH DIRECTORY off the tsx path, never off npm's own install", () => {
    /* Driven at the two lines directly, because the tree-level arm above would
       stay green on a reader that took the npx path and happened to be rescued
       by the child beside it. */
    const npx = UNWATCHED.find((row) => row.pid === 94344)!;
    const tsx = UNWATCHED.find((row) => row.pid === 74644)!;
    expect(launchDirectoryOf(npx.commandLine)).toBeNull();
    expect(launchDirectoryOf(tsx.commandLine)).toBe("C:/Users/Admin/Drape");
  });

  it("⚠ ABANDONED — a tree whose worktree is deleted names the directory to check", () => {
    /*
      The specimen that produced this card ran from
      `C:\\Users\\Admin\\drape-shift-752-moderator-badge-poll`, a shift worktree
      later deleted, and THAT is what made killing it safe: a directory that is
      gone cannot be anyone's live work. The rows are the measured ones above
      with the tree path substituted — stated rather than implied, because the
      process was killed the night it was found and its exact bytes are not on
      the record.

      ⚠ **The module answers WHERE, never WHETHER IT EXISTS.** It touches no file
      system by design, so the `existsSync` that turns this into the ABANDONED
      line lives in `scripts/dev-servers.mts` and is not covered here. What this
      pins is the half that can be got wrong silently: name npm's global install
      instead, and the caller checks a directory that always exists and prints
      nothing.
    */
    const gone = "C:/Users/Admin/drape-shift-752-moderator-badge-poll";
    const abandoned = UNWATCHED.map((row) => ({
      ...row,
      commandLine: row.commandLine
        .replace(/C:\\Users\\Admin\\Drape\\/g, "C:\\Users\\Admin\\drape-shift-752-moderator-badge-poll\\")
        .replace(/C:\/Users\/Admin\/Drape\//g, `${gone}/`),
    }));
    expect(devServerTrees(abandoned)[0].launchedFrom).toBe(gone);
  });

  it("⚠ refuses the pid netstat hands you, and does NOT claim a watcher would replace it", () => {
    /*
      45988 is the port holder. The refusal has to name 94344 — and it must not
      reuse the watched tree's sentence, which says the watcher "would start
      another one". Nothing here would: an unwatched tree stays dead, and a
      warning that is false about this machine teaches an operator to discount
      the true one.
    */
    const verdict = rootsToKill(UNWATCHED, [45988]);
    expect(verdict.kind).toBe("refused");
    expect(verdict.kind === "refused" && verdict.reason).toContain("94344");
    expect(verdict.kind === "refused" && verdict.reason).toContain("NO watcher");
    expect(verdict.kind === "refused" && verdict.reason).not.toContain("would start another one");
  });

  it("CONTROL — the root of that very tree is accepted", () => {
    /* Without this the refusal above could be a constant. */
    expect(rootsToKill(UNWATCHED, [94344])).toEqual({ kind: "kill", rootPids: [94344] });
  });

  it("the shell in the middle of it is refused by name, not as a stranger", () => {
    /* PR #659's lesson, in the shape it takes here: `childPids` holds node
       processes, so 94816 is invisible to it, and "not a dev-server process at
       all" would send somebody to kill it by hand. */
    const verdict = rootsToKill(UNWATCHED, [94816]);
    expect(verdict.kind).toBe("refused");
    expect(verdict.kind === "refused" && verdict.reason).toContain("94344");
    expect(verdict.kind === "refused" && verdict.reason).not.toContain("not a dev-server process");
  });

  it("⚠ NEGATIVE CONTROL — a plain tsx script is still not a dev server", () => {
    /*
      The direction this repair could have failed in. The watch verb was the
      guard against matching every disposable in the repository, and it has been
      taken off the root test — so the ENTRYPOINT is now the whole discriminator
      and this arm is what proves it still discriminates.
    */
    const disposable = TABLE.find((row) => row.pid === 9001)!;
    expect(devServerTrees([disposable])).toEqual([]);
    expect(rootsToKill([disposable], [9001]).kind).toBe("refused");
  });

  it("CONTROL — the two shapes in one table stay two trees, and the watched one is unchanged", () => {
    const mixed = [...PNPM_DEV, ...UNWATCHED];
    expect(devServerTrees(mixed).map((tree) => [tree.rootPid, tree.watched])).toEqual([
      [29132, true],
      [94344, false],
    ]);
  });

  it("a shift's own cleanup takes it like any other tree", () => {
    /* `--since` is the road a closing shift actually walks, and a tree it
       cannot see is a tree it cannot clean up. */
    expect(rootsStartedAfter(UNWATCHED, at911("07:00:00")).map((tree) => tree.rootPid)).toEqual([94344]);
    expect(rootsStartedAfter(UNWATCHED, at911("08:00:00"))).toEqual([]);
  });
});

/**
 * ⚠ THE BACKSTOP — the part of #783 that outlives #783.
 *
 * Widening the predicates fixes the launch shape that has already bitten. It
 * cannot fix the next one, and the failure mode of a classifier here is always
 * the same: an unrecognised shape is dropped, and a dropped tree prints the same
 * sentence as a clean machine.
 *
 * `netstat` does not care how a process was started. On the night this was
 * filed, `park-state.mts` printed *"1 listener(s) on :300x"* in the same minute
 * `dev-servers.mts` printed *"0 dev server tree(s) left"* — **the contradiction
 * was already on the machine and nothing compared the two readings.** This is
 * that comparison, and it is why the reader can now only be wrong out loud.
 */
describe("⚠ a listener this reader cannot place is a hole in the reader (#783)", () => {
  const oneTree = devServerTrees(PNPM_DEV);

  it("reports a studio-port listener that belongs to no tree", () => {
    /* 85868 is the pid four shifts read off netstat and could not act on. */
    const ports = new Map([[85868, [3001]]]);
    expect(listenersOutsideEveryTree([], ports)).toEqual([{ pid: 85868, ports: [3001] }]);
  });

  it("⚠ CONTROL — the same pid inside a tree is NOT reported", () => {
    /* Without this the arm above is satisfied by a reader that reports every
       listener, which would cry on every healthy `pnpm dev` and be turned off
       within a week. */
    expect(listenersOutsideEveryTree(oneTree, new Map([[28220, [3000]]]))).toEqual([]);
    expect(listenersOutsideEveryTree(oneTree, new Map([[29132, [3000]]]))).toEqual([]);
  });

  it("⚠ CONTROL — a listener outside the studio's port family is somebody else's business", () => {
    /* The machine holds dozens: a database proxy, an IDE, Docker. Reporting
       those makes the finding unreadable, which is the same as not having it. */
    expect(listenersOutsideEveryTree([], new Map([[4242, [5432]]]))).toEqual([]);
    expect(listenersOutsideEveryTree([], new Map([[4242, [3010]]]))).toEqual([]);
    expect(listenersOutsideEveryTree([], new Map([[4242, [2999]]]))).toEqual([]);
  });

  it("keeps only the studio's ports of a process that holds several", () => {
    const found = listenersOutsideEveryTree([], new Map([[777, [5432, 3009, 3000]]]));
    expect(found).toEqual([{ pid: 777, ports: [3000, 3009] }]);
  });

  it("CONTROL — nothing listening is nothing reported", () => {
    expect(listenersOutsideEveryTree(oneTree, new Map())).toEqual([]);
  });
});
