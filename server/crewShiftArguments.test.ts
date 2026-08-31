/**
 * THE COMMAND LINE THAT REFUSES WHAT IT DOES NOT UNDERSTAND — driven (issue #288).
 *
 * The incident, on PRODUCTION, 2026-08-30: an operator wanting to READ the live
 * shift row typed `crew-shift-close.mts --outcome shipped --note probe
 * --dry-run`. `--dry-run` did not exist, the word was silently ignored, and the
 * close ran — stamping a RUNNING shift's row terminal so the founder's page
 * read *"Nothing running"* mid-shift.
 *
 * # WHY THE PARSER IS DRIVEN HERE AND NOT THROUGH THE SCRIPTS
 *
 * Working law 3 — *a backstop needs a test the model cannot rescue*, and its
 * sibling: a guard whose only exercise path opens a database connection is a
 * guard that gets skipped in CI and proven by nobody. `parseStrictArgs` throws
 * rather than exiting for exactly this reason, so every refusal below is a
 * direct call with a real argument vector.
 *
 * # AND THE ARM THAT MATTERS MOST IS THE POSITIVE ONE
 *
 * A refusal test is easy to write green: a parser that refuses EVERYTHING
 * passes every arm about refusing. So each script's REAL command line — the one
 * the standing orders tell a shift to type — is parsed here and must be
 * accepted, and the vocabularies are read out of the script sources rather than
 * retyped, so a flag added to a script and forgotten here is caught instead of
 * being silently outside the test.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CREW_SHIFT_LIVE_HEARTBEAT_MS,
  CREW_SHIFT_STALL_MS,
  hasEverCheckedIn,
  looksLive,
} from "../shared/crewShiftState.js";
import { ArgumentError, known, parseStrictArgs } from "../scripts/lib/strictArgs.mts";

const REPO = join(__dirname, "..");
const sourceOf = (relative: string) => readFileSync(join(REPO, relative), "utf8");

const CLOSE_SPEC = {
  value: ["outcome", "note", "pr", "id"],
  boolean: ["dry-run", "force"],
} as const;

const START_SPEC = {
  value: ["shift", "seat", "kind", "card", "title", "intent", "note", "branch"],
  boolean: ["dry-run"],
} as const;

describe("the argument reader refuses what it was not asked about", () => {
  /* THE INCIDENT ITSELF, replayed verbatim. This is the arm the card exists for. */
  it("refuses the exact line that closed a live shift's row", () => {
    expect(() =>
      parseStrictArgs(["--outcome", "shipped", "--note", "probe", "--dry-run"], {
        value: ["outcome", "note", "pr", "id"],
        boolean: [],
      }),
    ).toThrow(/unknown argument --dry-run/);
  });

  it("names what it does know, so the refusal is actionable", () => {
    try {
      parseStrictArgs(["--nonsense"], CLOSE_SPEC);
      expect.unreachable("should have refused");
    } catch (cause) {
      expect(cause).toBeInstanceOf(ArgumentError);
      expect((cause as Error).message).toContain("--outcome <value>");
      expect((cause as Error).message).toContain("--dry-run");
    }
  });

  it("refuses a value flag with no value", () => {
    expect(() => parseStrictArgs(["--outcome"], CLOSE_SPEC)).toThrow(/--outcome needs a value/);
  });

  /*
    ⚠ THE ONE THE OLD READER GOT ACTIVELY WRONG rather than merely permitted.
    `--outcome --note x` returned null for outcome — indistinguishable from *not
    passed* — so the script refused with "--outcome is required" and sent the
    operator looking at the wrong end of their own command.
  */
  it("refuses a value flag swallowed by the next flag, and says which", () => {
    expect(() => parseStrictArgs(["--outcome", "--note", "x"], CLOSE_SPEC))
      .toThrow(/--outcome needs a value, and was followed by --note/);
  });

  it("refuses the same flag twice", () => {
    expect(() => parseStrictArgs(["--outcome", "shipped", "--outcome", "failed"], CLOSE_SPEC))
      .toThrow(/--outcome was given twice/);
    expect(() => parseStrictArgs(["--dry-run", "--dry-run"], CLOSE_SPEC))
      .toThrow(/--dry-run was given twice/);
  });

  /* A positional these scripts have never had: `close 26` must not read as
     "close whatever is newest". */
  it("refuses a bare word", () => {
    expect(() => parseStrictArgs(["26"], CLOSE_SPEC)).toThrow(/unknown argument 26/);
  });

  it("refuses a near-miss spelling rather than ignoring it", () => {
    expect(() => parseStrictArgs(["--outcomes", "shipped"], CLOSE_SPEC)).toThrow(/unknown argument --outcomes/);
  });
});

describe("and it still accepts the lines a shift actually types", () => {
  /* THE POSITIVE CONTROL. A parser that refused everything would pass every arm
     above; these are the commands the standing orders prescribe. */
  it("accepts the close a shift runs at the end of the night", () => {
    const args = parseStrictArgs(
      ["--outcome", "shipped", "--note", "PR #343 merged, edition 166 live", "--pr", "343"],
      CLOSE_SPEC,
    );
    expect(args.value("outcome")).toBe("shipped");
    expect(args.value("note")).toBe("PR #343 merged, edition 166 live");
    expect(args.value("pr")).toBe("343");
    expect(args.value("id")).toBeNull();
    expect(args.flag("dry-run")).toBe(false);
    expect(args.flag("force")).toBe(false);
  });

  it("accepts the close of a dead shift's stale row, forced", () => {
    const args = parseStrictArgs(["--id", "26", "--outcome", "failed", "--force"], CLOSE_SPEC);
    expect(args.value("id")).toBe("26");
    expect(args.flag("force")).toBe(true);
  });

  it("accepts the shift open the standing orders prescribe", () => {
    const args = parseStrictArgs(
      [
        "--shift", "foreman-147",
        "--seat", "foreman",
        "--kind", "focus",
        "--card", "#288",
        "--title", "crew-shift-close accepts unknown flags",
        "--intent", "Make the writers refuse what they do not understand.",
      ],
      START_SPEC,
    );
    expect(args.value("shift")).toBe("foreman-147");
    expect(args.value("seat")).toBe("foreman");
    expect(args.value("branch")).toBeNull();
  });

  it("accepts the heartbeat", () => {
    const args = parseStrictArgs(["--note", "branch cut", "--branch", "team/288-shift-writers"], START_SPEC);
    expect(args.value("note")).toBe("branch cut");
    expect(args.value("branch")).toBe("team/288-shift-writers");
  });

  /* A note may legitimately hold an em dash, a hash and quotes — the refusal is
     about `--`, and it must not be about punctuation. */
  it("accepts a note carrying the prose a shift really writes", () => {
    const note = "#343 merged — gate green, `review` red is #219's outage";
    expect(parseStrictArgs(["--outcome", "shipped", "--note", note], CLOSE_SPEC).value("note")).toBe(note);
  });

  it("accepts no arguments at all", () => {
    const args = parseStrictArgs([], { value: ["limit"], boolean: [] });
    expect(args.value("limit")).toBeNull();
  });
});

/**
 * ⚠ THE VOCABULARY IS DERIVED FROM THE SCRIPTS, NOT RETYPED HERE.
 *
 * Working law 4. A second copy of "which flags does the close script take"
 * drifts from the first, and the drift is invisible: a flag added to the script
 * and not to this file leaves the arms above testing a vocabulary nobody uses,
 * green forever. So the specs the scripts actually construct are read out of
 * their source and compared with the ones driven above.
 */
describe("the driven vocabulary is the scripts' own", () => {
  /** The `value:` / `boolean:` arrays out of a script's `parseStrictArgsOrRefuse` call. */
  function specIn(source: string): { value: string[]; boolean: string[] } {
    const call = /parseStrictArgsOrRefuse\(\s*process\.argv\.slice\(2\),\s*\{([\s\S]*?)\}\s*\)/.exec(source);
    if (!call) throw new Error("no parseStrictArgsOrRefuse call found — the script stopped parsing strictly");
    const list = (name: string) => {
      const match = new RegExp(`${name}:\\s*\\[([^\\]]*)\\]`).exec(call[1]!);
      if (!match) throw new Error(`no ${name}: [...] in the spec`);
      return [...match[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
    };
    return { value: list("value"), boolean: list("boolean") };
  }

  it.each([
    ["scripts/crew-shift-close.mts", CLOSE_SPEC],
    ["scripts/crew-shift-start.mts", START_SPEC],
  ])("%s declares exactly the flags this file drives", (path, spec) => {
    const declared = specIn(sourceOf(path));
    expect(declared.value.sort()).toEqual([...spec.value].sort());
    expect(declared.boolean.sort()).toEqual([...spec.boolean].sort());
  });

  /* The extractor gets a control: an arm that reads a spec out of source is
     green when it reads the WRONG spec, and `toThrow` is the only thing that
     proves it was looking. */
  it("the spec reader refuses a script that stopped parsing strictly", () => {
    expect(() => specIn("const x = 1;")).toThrow(/no parseStrictArgsOrRefuse call/);
    expect(() => specIn('parseStrictArgsOrRefuse(process.argv.slice(2), { value: ["a"] })'))
      .toThrow(/no boolean/);
  });

  it("both writers really route their arguments through the strict reader", () => {
    for (const path of ["scripts/crew-shift-close.mts", "scripts/crew-shift-start.mts", "scripts/crew-shift-state.mts"]) {
      const source = sourceOf(path);
      expect(source).toContain("parseStrictArgsOrRefuse");
      /* The old reader — `process.argv.indexOf(\`--${name}\`)` — is what made
         the incident possible. Its return is what a re-introduction would look
         like, so its absence is asserted rather than assumed. */
      expect(source).not.toMatch(/process\.argv\.indexOf\(/);
    }
  });

  it("`known` prints a vocabulary an operator can copy", () => {
    expect(known(CLOSE_SPEC)).toBe("--outcome <value>, --note <value>, --pr <value>, --id <value>, --dry-run, --force");
  });
});

/**
 * THE LIVE-ROW REFUSAL (#288's fourth fix) — the bar, driven at its edges.
 *
 * `crew-shift-close.mts` refuses a row that looks live without `--force`. What
 * must not happen is the refusal firing on the ordinary path: a shift closing
 * its own row at the end of the night, or the commonest short run there is — a
 * quiet night that opens a row, finds nothing admissible, and closes it minutes
 * later without ever having checked in.
 */
describe("a row that looks live is distinguishable from one that does not", () => {
  const now = Date.UTC(2026, 7, 31, 12, 0, 0);
  const at = (msAgo: number) => new Date(now - msAgo);

  it("a row that checked in seconds ago looks live", () => {
    expect(looksLive({ startedAt: at(90 * 60_000), heartbeatAt: at(30_000) }, now)).toBe(true);
  });

  /*
    ⚠ THE ARM THAT PROTECTS THE ORDINARY CLOSE. A shift's last heartbeat is the
    briefing edition; after it come the deploy rite (a push, a Railway
    deployment, three health readings) and the mailbox entry. Ten minutes is a
    fast night, and it must close without `--force`.
  */
  it("a shift closing at the end of its night does NOT look live", () => {
    expect(looksLive({ startedAt: at(90 * 60_000), heartbeatAt: at(10 * 60_000) }, now)).toBe(false);
  });

  /*
    ⚠ AND THE ONE THAT PROTECTS A QUIET NIGHT. At open, `heartbeatAt` equals
    `startedAt` — so a row opened 40 seconds ago is "fresh" without anybody
    having stamped anything. A quiet shift closing straight away is correct
    behaviour under the anti-boredom rule and must not need `--force`.
  */
  it("a row that never checked in does NOT look live, however fresh", () => {
    const startedAt = at(40_000);
    expect(hasEverCheckedIn({ startedAt, heartbeatAt: startedAt })).toBe(false);
    expect(looksLive({ startedAt, heartbeatAt: startedAt }, now)).toBe(false);
  });

  it("an unreadable heartbeat does not block an operator", () => {
    expect(looksLive({ startedAt: at(60 * 60_000), heartbeatAt: "not a date" }, now)).toBe(false);
  });

  /* The two windows answer different questions and must not be collapsed into
     one constant by a later tidy-up. */
  it("the live window is far shorter than the stall window", () => {
    expect(CREW_SHIFT_LIVE_HEARTBEAT_MS).toBeLessThan(CREW_SHIFT_STALL_MS / 10);
    expect(CREW_SHIFT_LIVE_HEARTBEAT_MS).toBeGreaterThanOrEqual(60_000);
  });

  /* The refusal must name its way out, or an operator learns to route around
     it — which is how the incident happened in the first place. */
  it("the close script's refusal names --force and the reader", () => {
    const source = sourceOf("scripts/crew-shift-close.mts");
    expect(source).toMatch(/looksLive\(/);
    expect(source).toContain("crew-shift-state.mts");
    expect(source).toContain("--force");
  });

  /* And the dry run is checked AFTER the live guard, so a rehearsal on a live
     row reports the refusal rather than describing a write that would not
     happen. */
  it("the live guard is read before the dry run reports", () => {
    const source = sourceOf("scripts/crew-shift-close.mts");
    expect(source.indexOf("looksLive({")).toBeLessThan(source.indexOf("if (DRY_RUN)"));
  });
});
