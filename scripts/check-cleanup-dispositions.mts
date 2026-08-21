/**
 * THE DELETION DOOR, AS A CHECK RATHER THAN AS A DOCUMENT.
 *
 * The cleanup milestone was ordered a "disposition document — the single
 * deletion door". Written as prose it would be **a second list shadowing a
 * source of truth**: every verdict already has a home in
 * `CLEANUP_MILESTONE_TRIAGE.md`'s §6, §7, §8, §13, §14, §17 and §18, and a
 * document restating them drifts from those sections within a shift. That is
 * law 4, and this milestone has spent the night quoting it.
 *
 * So the door is a TABLE plus this CHECK. The table
 * (`docs/specs/cleanup-dispositions.yaml`) carries one row per symbol on the
 * sweep's reading list — a verdict, a one-line reason, the triage section that
 * argues it, and for a HELD row the blocker BY NAME. The triage document keeps
 * the reasoning and stops being the index.
 *
 * # What it refuses, and why each refusal exists
 *
 *   unread    the sweep lists a symbol no row dispositions. Nothing is deleted
 *             while something is unread, and the milestone's exit condition
 *             becomes a number rather than an opinion.
 *   stale     a row names a symbol that no longer exists in the source. The
 *             Atlas refuses a stale annotation for the same reason: a table
 *             that may rot quietly is worse than no table.
 *   blockerless  a HELD row with no blocker named. "A deferral to when next
 *             touched has no owner and is not a deferral — it is a drop."
 *   ownerless a FILED row with no owner named. The same rule aimed at the
 *             other half: HELD says "waiting on a named thing", FILED says
 *             "this is somebody's build" — and a build nobody owns is the drop
 *             wearing the more respectable word. Every FILED row here is a
 *             question about LIVE code, so it is the half that matters more.
 *   unknown   a verdict outside the closed set, which is how a table grows a
 *             sixth meaning nobody agreed to.
 *   rewired   a HELD or TAKE row whose symbol has a PRODUCTION IMPORTER. Both
 *             verdicts say the same thing about the request path — *ruled for
 *             removal, waiting on a named blocker* — so a caller coming back
 *             is the row and the source disagreeing, and nothing else here
 *             could see it. `stale` catches a row whose symbol WENT AWAY;
 *             this catches one whose symbol CAME BACK. Added 2026-08-22 with
 *             a live instance in the table: see below.
 *   unreadable  a HELD or TAKE row whose symbol the importer reader cannot see
 *             at all. It exists so `rewired` cannot pass by being blind — a
 *             pin that answers zero because it is looking at nothing is how a
 *             dead control keeps a live reputation. Zero today, and refusing
 *             is what keeps it there.
 *
 * # THE SIXTH REFUSAL WAS BORN WITH A HIT — `hairTakeSentence` (2026-08-22)
 *
 * §10 item 7's debt was three symbols the un-wiring differ found DECIDED-dead
 * and nothing pinned. Discharging it meant asking the table a question it had
 * never been asked — *do the rows that say "not on the request path" still
 * mean it* — and one row did not: `hairTakeSentence` was HELD, blocked on
 * *"the hair crop chunk, where the recipe composes the outgoing prompt this
 * sentence goes into"*, and `refineService.ts` has imported and CALLED it
 * since that chunk landed. The blocker was discharged and the row was never
 * flipped.
 *
 * Nothing was at risk — the danger of a rotten HELD row is a cleanup sitting
 * working its way down the list — but the shape is this program's most
 * expensive one: **a document confident about code that moved underneath it.**
 * The reason no existing refusal could catch it is worth stating, because it
 * is why the arm is mechanical rather than a habit: a re-wired symbol simply
 * DROPS OFF the sweep's reading list, and `unread` only ever looks the other
 * way — listed with no row, never a row with no listing.
 *
 # THE PROPERTY NOBODY DESIGNED, AND IT IS THE POINT
 *
 * **The knife does not close until the table catches up.** Discovered by
 * surprise executing the nine TAKE rows: the symbols were cut, the rows still
 * said TAKE, and `pnpm check` refused with nine STALE rows — because a row
 * naming a symbol that no longer exists is precisely the rot above. The cut
 * could not be finished without coming back and flipping every row to TAKEN.
 *
 * That is derive-never-mirror enforcing itself **at the exact moment a mirror
 * would have been born**: the instant the table and the source disagree is the
 * instant the door shuts. It is named here because a property discovered by
 * accident is kept only by being written down.
 *
 * `--strict` makes `unread` fatal; without it the count is reported and the
 * other SIX still refuse — `stale`, `blockerless`, `ownerless`, `unknown`,
 * `rewired`, `unreadable`, counted out rather than adjectival, because this
 * sentence said "the other three" while four of them were already fatal. The
 * milestone is finished the day `--strict` is green, and it is the reading —
 * not this file — that gets it there.
 *
 * # WHY `pnpm check` PASSES `--strict` (ruled fable-999 §2, 2026-08-19)
 *
 * It did not, for a while, and both governing documents said it did:
 * `POST_SIGN_ROADMAP.md` §0b and `CLEANUP_MILESTONE_TRIAGE.md` §23 each stated
 * the completion bar AS `--strict` being green and then claimed `pnpm check`
 * enforced it. **`pnpm check` ran this file bare**, so the gate held the three
 * rot refusals and not the bar the same sentence stated.
 *
 * It was priced within the hour. Executing the nine TAKE rows MINTED a new
 * symbol — `AMBIGUOUS_WORDS_FOR_CORPUS`, the corpus seam the surviving test
 * needed once `namesRemoval` was cut — and no row was written for it. The
 * reading list went 115 → 116 with an unread symbol on it and `pnpm check`
 * stayed GREEN. (Triage §24d.)
 *
 * That is invariant 7 verbatim: a control that reports and does not refuse is
 * not a control. The friction this adds is real and it is exactly the four
 * lines of YAML the knife skipped — which is the bar working, not the bar
 * failing.
 *
 * # Controls (law 2)
 *
 * Driven DIRECTLY against synthetic tables rather than against today's real
 * one: a checker whose only exercise is a table that happens to be clean has
 * never been shown to fail. Each refusal has a fixture that must trip it and
 * the clean table must pass, so the checker is proved to discriminate before
 * its verdict on the real table counts for anything.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { importerCount, readTree } from "./lib/importerCountDiff.mts";

const REPO = resolve(import.meta.dirname, "..");
const TABLE = resolve(REPO, "docs/specs/cleanup-dispositions.yaml");

/*
  FIVE, AND THE FIFTH IS NOT A CONVENIENCE. A symbol ruled for removal but not
  yet cut had to read as unread with four verdicts, which is false — it has been
  read, and carefully. TAKE is "ruled for removal, not yet done", and its count
  is the milestone's own outstanding queue rather than a state hidden inside a
  prose paragraph. It is currently zero, and the checker is what made that true:
  the nine cuts each had to come back and flip their own row to TAKEN, because
  a deleted symbol whose row still said TAKE reads as STALE and refuses.
*/
const VERDICTS = ["KEEP", "TAKE", "TAKEN", "HELD", "FILED"] as const;
type Verdict = (typeof VERDICTS)[number];

export type Row = {
  symbol: string;
  file: string;
  verdict: Verdict | string;
  why: string;
  argued: string;
  blocker?: string;
  owner?: string;
  line: number;
};

/**
 * The table, parsed by hand.
 *
 * Hand-parsed for the same reason the Atlas hand-parses its annotations: the
 * shape is fixed and this repository does not carry a YAML dependency. The
 * shape is one `- symbol:` per row followed by its fields, any order.
 */
export function parseTable(text: string): Row[] {
  const rows: Row[] = [];
  let current: Partial<Row> | null = null;
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.replace(/\s+$/, "");
    if (line === "" || line.startsWith("#")) continue;
    const start = line.match(/^-\s+symbol:\s*(\S+)\s*$/);
    if (start) {
      if (current?.symbol) rows.push(current as Row);
      current = { symbol: start[1]!, line: index + 1 };
      continue;
    }
    const field = line.match(/^\s+(symbol|file|verdict|why|argued|blocker|owner):\s*(.*)$/);
    if (field && current) {
      (current as Record<string, unknown>)[field[1]!] = field[2]!.replace(/^["']|["']$/g, "").trim();
    }
  }
  if (current?.symbol) rows.push(current as Row);
  return rows;
}

export type Verdicts = {
  unread: string[];
  stale: string[];
  blockerless: string[];
  ownerless: string[];
  unknown: string[];
  rewired: string[];
  unreadable: string[];
};

/** The two verdicts that claim the symbol is NOT on the request path. */
const AWAITING_DELETION = new Set(["HELD", "TAKE"]);

/** Every refusal, computed over inputs a control can fabricate. */
export function auditTable(input: {
  rows: Row[];
  listed: Array<{ symbol: string; file: string }>;
  declares: (file: string, symbol: string) => boolean;
  /**
   * Production importers of a symbol, or `null` when the reader cannot see the
   * symbol at all. The two answers are deliberately different — see `rewired`
   * and `unreadable` below.
   */
  importers: (symbol: string) => number | null;
}): Verdicts {
  const byName = new Map(input.rows.map((row) => [row.symbol, row]));
  /*
    AN EMPTY VERDICT IS UNREAD, NOT ROTTEN. The two failure modes must not be
    confused: a row nobody has filled in is the milestone's remaining work, and
    a row with a verdict nobody agreed to is a table growing a sixth meaning.
    Counting the first as the second makes the door refuse for the wrong reason
    and tells a reader the table is broken when it is merely unfinished.
  */
  const empty = input.rows.filter((row) => row.verdict.trim() === "").map((row) => row.symbol);
  return {
    unread: [
      ...input.listed.filter((entry) => !byName.has(entry.symbol)).map((entry) => entry.symbol),
      ...empty,
    ],
    stale: input.rows
      .filter((row) => row.verdict !== "TAKEN" && row.verdict.trim() !== ""
        && !input.declares(row.file, row.symbol))
      .map((row) => row.symbol),
    blockerless: input.rows
      .filter((row) => row.verdict === "HELD" && !(row.blocker ?? "").trim())
      .map((row) => row.symbol),
    ownerless: input.rows
      .filter((row) => row.verdict === "FILED" && !(row.owner ?? "").trim())
      .map((row) => row.symbol),
    unknown: input.rows
      .filter((row) => row.verdict.trim() !== "" && !(VERDICTS as readonly string[]).includes(row.verdict))
      .map((row) => `${row.symbol} (${row.verdict})`),
    /*
      A ROW THAT SAYS "WAITING TO BE DELETED" ABOUT A SYMBOL ON THE REQUEST
      PATH. The mirror of `stale`: that one catches a row whose symbol went
      away, this one catches a row whose symbol CAME BACK. Neither the sweep
      nor any refusal above can see it — a re-wired symbol simply drops off the
      reading list, and `unread` only looks the other way (listed, no row).
    */
    rewired: input.rows
      .filter((row) => AWAITING_DELETION.has(row.verdict))
      .filter((row) => (input.importers(row.symbol) ?? 0) > 0)
      .map((row) => `${row.symbol} (${input.importers(row.symbol)})`),
    /*
      AND THE ARM MUST NOT PASS BY BEING BLIND. A HELD row whose symbol the
      importer reader cannot see would sail through `rewired` for ever, which
      is "a suite that cannot fail when its subject is deleted" wearing a
      door's name. It is zero today and refusing keeps it there.
    */
    unreadable: input.rows
      .filter((row) => AWAITING_DELETION.has(row.verdict))
      .filter((row) => input.importers(row.symbol) === null)
      .map((row) => row.symbol),
  };
}

/* ---- controls: driven directly, against tables that cannot come clean ---- */

function controls(log: (line: string) => void): boolean {
  const declares = (file: string, symbol: string): boolean =>
    file === "live.ts" && symbol.startsWith("live");
  /*
    The fabricated importer reader. `liveWired` is the one symbol something
    calls; `liveInvisible` is the one the reader cannot see at all, which is a
    THIRD answer and not a quiet zero.
  */
  const importers = (symbol: string): number | null => {
    if (symbol === "liveInvisible") return null;
    return symbol === "liveWired" ? 2 : 0;
  };
  const clean: Row[] = [
    { symbol: "liveKept", file: "live.ts", verdict: "KEEP", why: "w", argued: "§6", line: 1 },
    { symbol: "goneTaken", file: "live.ts", verdict: "TAKEN", why: "w", argued: "§8", line: 2 },
    { symbol: "liveHeld", file: "live.ts", verdict: "HELD", why: "w", argued: "§17", blocker: "a database", line: 3 },
    { symbol: "liveFiled", file: "live.ts", verdict: "FILED", why: "w", argued: "§13c", owner: "the boards road", line: 4 },
  ];
  const listed = [
    { symbol: "liveKept", file: "live.ts" },
    { symbol: "liveHeld", file: "live.ts" },
    { symbol: "liveFiled", file: "live.ts" },
  ];
  const cases: Array<{ name: string; rows: Row[]; listed: typeof listed; expect: keyof Verdicts | null }> = [
    { name: "a complete table passes", rows: clean, listed, expect: null },
    {
      name: "a listed symbol with no row is UNREAD",
      rows: clean,
      listed: [...listed, { symbol: "liveOrphan", file: "live.ts" }],
      expect: "unread",
    },
    {
      name: "a row naming a symbol that is gone is STALE",
      rows: [...clean, { symbol: "liveVanished", file: "dead.ts", verdict: "KEEP", why: "w", argued: "§6", line: 4 }],
      listed,
      expect: "stale",
    },
    {
      name: "a HELD row with no blocker is BLOCKERLESS",
      rows: [...clean, { symbol: "liveStuck", file: "live.ts", verdict: "HELD", why: "w", argued: "§17", line: 5 }],
      listed,
      expect: "blockerless",
    },
    {
      name: "an EMPTY verdict is unread, not rotten",
      rows: [...clean, { symbol: "liveBlank", file: "live.ts", verdict: "", why: "", argued: "", line: 7 }],
      listed,
      expect: "unread",
    },
    {
      name: "a FILED row with no owner is OWNERLESS",
      rows: [...clean, { symbol: "liveDropped", file: "live.ts", verdict: "FILED", why: "w", argued: "§13c", line: 8 }],
      listed,
      expect: "ownerless",
    },
    {
      /* THE NEGATIVE ARM, and it is not a formality: `blocker` and `owner` are
         two optional strings one line apart, and a refusal reading the wrong
         one passes its positive arm and refuses every honest row. A HELD row
         carrying a blocker and no owner is CORRECT and must not trip. */
      name: "a HELD row is not ownerless, and a FILED row is not blockerless",
      rows: clean,
      listed,
      expect: null,
    },
    {
      name: "a verdict outside the closed set is UNKNOWN",
      rows: [...clean, { symbol: "liveOdd", file: "live.ts", verdict: "MAYBE", why: "w", argued: "§6", line: 6 }],
      listed,
      expect: "unknown",
    },
    {
      name: "a HELD row whose symbol has a production importer is REWIRED",
      rows: [...clean, { symbol: "liveWired", file: "live.ts", verdict: "HELD", why: "w", argued: "§17", blocker: "a database", line: 9 }],
      listed,
      expect: "rewired",
    },
    {
      /* TAKE says the same thing as HELD about the request path — ruled for
         removal — so a re-wiring under it is the same refusal. Separate arm
         because a filter naming one verdict passes the arm above and misses
         this one entirely. */
      name: "a TAKE row whose symbol has a production importer is REWIRED too",
      rows: [...clean, { symbol: "liveWired", file: "live.ts", verdict: "TAKE", why: "w", argued: "§8", line: 10 }],
      listed,
      expect: "rewired",
    },
    {
      /* THE NEGATIVE ARM THAT COSTS THE MOST TO GET WRONG. A hundred and three
         KEEP rows in the real table have zero importers and twenty have
         several; a `rewired` check that forgot to look at the verdict would
         refuse twenty honest rows and read as a broken door. */
      name: "a KEEP row with importers is not rewired — that is an ordinary live symbol",
      rows: [...clean, { symbol: "liveWired", file: "live.ts", verdict: "KEEP", why: "w", argued: "§6", line: 11 }],
      listed,
      expect: null,
    },
    {
      name: "a HELD row the importer reader cannot see at all is UNREADABLE, not clean",
      rows: [...clean, { symbol: "liveInvisible", file: "live.ts", verdict: "HELD", why: "w", argued: "§17", blocker: "a database", line: 12 }],
      listed,
      expect: "unreadable",
    },
  ];

  let ok = true;
  for (const testCase of cases) {
    const result = auditTable({ rows: testCase.rows, listed: testCase.listed, declares, importers });
    const tripped = (Object.keys(result) as Array<keyof Verdicts>).filter((key) => result[key].length > 0);
    const passed = testCase.expect === null
      ? tripped.length === 0
      : tripped.length === 1 && tripped[0] === testCase.expect;
    if (!passed) ok = false;
    log(`  ${passed ? "PASS" : "FAIL"}  ${testCase.name}`
      + (tripped.length > 0 ? `  → ${tripped.join(", ")}` : ""));
  }
  /*
    A TAKEN row is EXEMPT from the stale check on purpose, and it is checked
    here rather than assumed: the whole point of TAKEN is that the symbol is
    gone. Without this arm the table would refuse the moment it recorded a
    successful deletion, which is the one thing it exists to record.
  */
  const takenExempt = auditTable({ rows: clean, listed, declares, importers }).stale.length === 0;
  log(`  ${takenExempt ? "PASS" : "FAIL"}  a TAKEN row is not stale — the symbol is SUPPOSED to be gone`);
  return ok && takenExempt;
}

/* ---- the run ------------------------------------------------------------ */

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/").split("/").pop()!)) {
  console.log("CONTROLS — driven directly, against tables that cannot come clean");
  if (!controls((line) => console.log(line))) {
    console.log("REFUSED — the checker failed its own controls; no verdict printed.");
    process.exit(1);
  }

  if (!existsSync(TABLE)) {
    console.log("");
    console.log(`REFUSED — no table at ${TABLE.slice(REPO.length + 1)}.`);
    process.exit(1);
  }

  const rows = parseTable(readFileSync(TABLE, "utf8"));
  const sweep = execFileSync("npx", ["tsx", "scripts/sweep-uncalled-exports-disposable.mts"], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    shell: true,
  });
  const listed = sweep.split(/\r?\n/)
    .slice(sweep.split(/\r?\n/).findIndex((line) => line.includes("THE LIST ")))
    .map((line) => line.match(/^\s{2}(\S+)\s+(\S+)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({ symbol: match[1]!, file: match[2]! }));

  const sourceOf = new Map<string, string>();
  const declares = (file: string, symbol: string): boolean => {
    const path = resolve(REPO, file);
    if (!existsSync(path)) return false;
    if (!sourceOf.has(file)) sourceOf.set(file, readFileSync(path, "utf8"));
    return new RegExp(`^export\\s+(?:async\\s+)?(?:function|const|class|type|interface)\\s+${symbol}(?![\\w$])`, "m")
      .test(sourceOf.get(file)!);
  };

  /*
    THE IMPORTER READER IS THE DIFFER'S, NOT A SECOND ONE. `readTree` is the
    module half of `diff-importer-count-across-time.mts`, so this door and that
    instrument cannot disagree about what a production importer IS — its scope
    is `server`/`client`/`shared` with `*.test.ts` excluded, and `scripts/` is
    deliberately outside it. A drive bench naming a symbol is not the request
    path, and that is the same call the differ makes.
  */
  const tree = readTree(REPO);
  const importers = (symbol: string): number | null =>
    tree.decl.has(symbol) ? importerCount(tree, symbol) : null;

  const audit = auditTable({ rows, listed, declares, importers });
  const counted = rows.reduce<Record<string, number>>((tally, row) => {
    tally[row.verdict] = (tally[row.verdict] ?? 0) + 1;
    return tally;
  }, {});

  console.log("");
  console.log(`THE TABLE — ${rows.length} rows against a reading list of ${listed.length}`);
  for (const verdict of VERDICTS) console.log(`  ${verdict.padEnd(8)} ${counted[verdict] ?? 0}`);
  console.log("");
  for (const [kind, entries] of Object.entries(audit)) {
    console.log(`  ${kind.padEnd(12)} ${entries.length}${entries.length > 0 ? `  ${entries.slice(0, 8).join(", ")}${entries.length > 8 ? " …" : ""}` : ""}`);
  }

  const strict = process.argv.includes("--strict");
  const fatal = audit.stale.length + audit.blockerless.length + audit.ownerless.length
    + audit.unknown.length + audit.rewired.length + audit.unreadable.length
    + (strict ? audit.unread.length : 0);
  console.log("");
  if (fatal > 0) {
    console.log(strict
      ? "REFUSED — the door is not open while anything above is non-zero."
      : "REFUSED — a rotten row is fatal whether or not the reading is finished.");
    process.exit(1);
  }
  console.log(audit.unread.length === 0
    ? "OPEN — every symbol on the list has a disposition."
    : `NOT FINISHED — ${audit.unread.length} unread. The rows that exist are sound.`);
}
