/**
 * THE CEREMONY READER REFUSES A WORD IT DOES NOT KNOW (#642, #345's remainder).
 *
 * The ceremonies hand `process.argv` to one function, `openCeremonyWorld`, and
 * until #644 that function asked `argv.includes("--production")`,
 * `argv.includes("--dev")`, and looked at nothing else. That is #288's class:
 * *a reader that looks up the flags it wants and never looks at what it was
 * actually given.*
 *
 * ⚠ **AND THE FIRST VERSION OF THIS SUITE COULD NOT SEE TWELVE CEREMONIES THAT
 * WERE STILL DOING IT** (PR #644's review, finding 2; fixed in #642 slice 2).
 * Its derived arm walks the CALLERS of the shared reader, so a
 * `scripts/ceremony-*.mts` that had never called it sat outside the population
 * BY CONSTRUCTION — and twelve did, among them `ceremony-crew-work-switches`
 * and `ceremony-crew-shift-runs`, the two that built the founder's own switch
 * panel, both of which can be pointed at production. **A guard keyed on
 * adoption cannot see what has not adopted**, and every one of the twelve was
 * inside the eighteen's own headline as "the ceremonies now refuse a word they
 * do not know" — the most confusable members of the class, wearing its prefix.
 *
 * So there are TWO derived arms below and they must not be collapsed into one:
 * the adoption arm asks *does an adopter still read argv beside the reader*,
 * and the DIRECTORY arm asks *does any ceremony at all still pick its world out
 * of a raw argv read*. Only the second can see a thirteenth arriving.
 *
 * ⚠ BE PRECISE ABOUT WHAT WAS AND WAS NOT AT RISK, because the honest version
 * is why this was the CHEAPEST fix in #642 rather than the most urgent, and a
 * report that overstates it earns a correction later.
 *
 *   - `--prod` alone was ALREADY SAFE. Neither world is named, so the old
 *     reader refused and the run stopped. Nothing was ever going to migrate the
 *     wrong database over that typo.
 *   - **A mistyped word BESIDE a correct one was not.** `--production
 *     --dry-run`, `--dev --limit 10`, `--production --exclude x`: the world
 *     parses, the ceremony proceeds, and the operator's other intention is
 *     discarded without a word. Every one of these scripts writes to a
 *     database, and half of them can be pointed at production.
 *   - `--dev --production` together resolved to production silently, on the
 *     order of two `includes` calls. An operator who typed both meant one.
 *
 * These arms drive the real exported function rather than a model of it
 * (working law 3), with `process.exit` made to throw so a refusal is
 * observable instead of killing the runner.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { openCeremonyWorld } from "../scripts/lib/ceremony.mts";
import { codeWithoutBlockComments } from "../scripts/lib/stopline.mts";
import { parseFounderEvidenceCeremonyArgs } from "./casting/evidence/founderEvidenceCeremony";
import { readListedSource } from "./testing/listedSource";

const REPO = resolve(import.meta.dirname, "..");
const SCRIPTS = join(REPO, "scripts");

/**
 * Handing the WHOLE `process.argv` to the shared reader — with or without an
 * `extra` spec after it, and across a line break.
 *
 * ⚠ `\s*[,)]` rather than a literal `)`: the second capture is the sanctioned
 * road for a ceremony with its own flags, and the first version of this guard
 * banned it (PR #644's review). `.slice` is deliberately NOT matched — the
 * reader slices argv itself, so a pre-sliced caller silently loses two words.
 */
const SANCTIONED_HANDOFF = /openCeremonyWorld\(\s*process\.argv\s*[,)]/;

/**
 * A file that names one of the two worlds in words it took out of `process.argv`
 * itself — `includes`, `indexOf`, an index, a pre-slice, any of them.
 *
 * ⚠ **IT ASKS TWO QUESTIONS OF THE WHOLE FILE RATHER THAN ONE OF A LINE, AND
 * THAT IS THE REVIEW'S FINDING ON PR #657.** The first form required
 * `process.argv` and the world word within 60 characters of each other on ONE
 * line, which is tight against a false POSITIVE and quietly open the other way:
 *
 *     const args = process.argv.slice(2);
 *     const world = args.includes("--production") ? "production" : "dev";
 *
 * is the same defect through an alias, and a prettier-wrapped
 * `process.argv\n  .includes("--production")` is the same defect through a line
 * break. Both are non-adopters, so the adoption arm cannot see them either —
 * which is this suite's own thesis failing on its own new arm.
 *
 * So: an **unsanctioned `process.argv` read anywhere in the file**, AND a
 * `--dev`/`--production` **literal anywhere in its code**. The `unsanctioned`
 * half is what protects a legitimate caller — a ceremony that hands the whole
 * line over and merely mentions `--production` in a hint string has no
 * unsanctioned argv read, so it stays clean. Measured over the real directory:
 * **35 ceremonies, 0 offenders**, and `ceremony-r7-founder-evidence` falls out
 * on the second question by itself rather than by an exemption — it reads argv,
 * but the words it names are its own (`--database-url`), never a world.
 *
 * ⚠ **Its remaining quiet direction, stated rather than discovered** (the house
 * convention, `codeWithoutBlockComments` in `scripts/lib/stopline.mts`): a
 * ceremony that reads argv by hand and never spells a world word in its own
 * source — assembling it, importing it as a constant, or reading it from an
 * env var — passes. Nothing in the tree does this, it is not a shape anyone
 * writes by accident, and the alternative is a real parser. **This reader can
 * go quiet, never loud.**
 *
 * ⚠ **The block-comment strip is DEFENSIVE AND NOT LOAD-BEARING, and that was
 * measured rather than assumed.** Every one of these scripts documents its own
 * command line in its docblock, so the strip looks essential; driven over the
 * real directory it changes nothing — **0 offenders with the strip and 0
 * without**. It stays for the case that costs nothing to cover: a docblock
 * QUOTING the banned form to explain it, which is how this repository writes
 * about its own defects — and under the whole-file predicate that case is no
 * longer hypothetical, since a quoted `--production` and a real argv read no
 * longer have to share a line to meet.
 */
export function choosesItsOwnWorld(source: string): boolean {
  const code = codeWithoutBlockComments(source);
  const readsArgvByHand = code
    .split("\n")
    .some((line) => line.includes("process.argv") && !SANCTIONED_HANDOFF.test(line));
  return readsArgvByHand && /["'`]--(?:dev|production)\b/.test(code);
}

/** `process.argv` as node builds it: the binary, the script, then the words. */
const commandLine = (...words: string[]) => ["/node", "/script.mts", ...words];

let exited: number | null;
let refusals: string[];

beforeEach(() => {
  exited = null;
  refusals = [];
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    exited = code ?? 0;
    /* The real `process.exit` never returns, and the code after each refusal is
       written on that assumption. Throwing is what models it inside a test. */
    throw new Error(`EXIT ${code}`);
  }) as never);
  vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => {
    refusals.push(parts.map(String).join(" "));
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

/** Run the reader and report how it refused, never letting it reach a database. */
async function refusalFor(...words: string[]): Promise<{ code: number | null; said: string }> {
  /* ⚠ `--production` reads MYSQL_PUBLIC_URL and NEVER loads dotenv, so a
     positive control can prove the parse succeeded without a `--dev` run
     importing `.env` and opening the founder's real dev database. Cleared here
     so the arm is the same under `railway run` as it is bare. */
  const saved = process.env.MYSQL_PUBLIC_URL;
  delete process.env.MYSQL_PUBLIC_URL;
  try {
    await openCeremonyWorld(commandLine(...words));
    return { code: null, said: "" };
  } catch {
    return { code: exited, said: refusals.join("\n") };
  } finally {
    if (saved !== undefined) process.env.MYSQL_PUBLIC_URL = saved;
  }
}

describe("a word the ceremony reader does not know", () => {
  it("REFUSES an unknown flag sitting beside a correct world — the defect itself", async () => {
    const { code, said } = await refusalFor("--production", "--dry-run");
    expect(code).toBe(1);
    expect(said).toContain("unknown argument --dry-run");
    /* The refusal has to say what IS known, or an operator learns only that
       they were wrong. */
    expect(said).toContain("--production");
  });

  it("REFUSES an unknown VALUE flag, rather than running with it discarded", async () => {
    const { code, said } = await refusalFor("--dev", "--limit", "10");
    expect(code).toBe(1);
    expect(said).toContain("unknown argument --limit");
  });

  it("REFUSES a bare word — a ceremony has never taken a positional", async () => {
    const { code, said } = await refusalFor("--production", "casting_candidates");
    expect(code).toBe(1);
    expect(said.toLowerCase()).toContain("casting_candidates");
  });

  it("REFUSES both worlds named at once, instead of letting the reading order decide", async () => {
    const { code, said } = await refusalFor("--dev", "--production");
    expect(code).toBe(1);
    expect(said).toContain("both named");
  });
});

describe("what was already true stays true", () => {
  it("still REFUSES when no world is named — the pre-existing guard", async () => {
    const { code, said } = await refusalFor();
    expect(code).toBe(1);
    expect(said).toContain("does not guess");
  });

  it("⚠ `--prod` was never the dangerous case, and this pins that it still is not", async () => {
    /* It reads as an unknown word now rather than as a nameless world, so the
       message changes and the OUTCOME does not: the run stops either way. The
       card's own body had to be corrected twice about which typo was at risk;
       this arm is where that reading lives instead of in prose. */
    const { code } = await refusalFor("--prod");
    expect(code).toBe(1);
  });

  it("POSITIVE CONTROL — a correct line PARSES, and fails later on the URL", async () => {
    /* Without this, "refuses everything" and "refuses the right things" are one
       reading, which is the misaimed-guard shape this repository has been bitten
       by before. Reaching the MYSQL_PUBLIC_URL refusal proves the arguments were
       accepted and the world was resolved. */
    const { code, said } = await refusalFor("--production");
    expect(code).toBe(1);
    expect(said).toContain("MYSQL_PUBLIC_URL is not set");
    expect(said).not.toContain("unknown argument");
  });
});

describe("the nineteenth ceremony", () => {
  /** Run the reader with a caller's own spec, reporting how it refused. */
  async function withExtra(
    extra: Parameters<typeof openCeremonyWorld>[1],
    ...words: string[]
  ): Promise<string> {
    const saved = process.env.MYSQL_PUBLIC_URL;
    delete process.env.MYSQL_PUBLIC_URL;
    try {
      await openCeremonyWorld(commandLine(...words), extra);
      return "";
    } catch {
      return refusals.join("\n");
    } finally {
      if (saved !== undefined) process.env.MYSQL_PUBLIC_URL = saved;
    }
  }

  it("a caller's own VALUE flag is accepted beside the world flags", async () => {
    const said = await withExtra({ value: ["limit"], boolean: [] }, "--production", "--limit", "10");
    /* Reaching the URL refusal — not an argument one — is what proves both the
       caller's flag and the world flag survived the merge. */
    expect(said).toContain("MYSQL_PUBLIC_URL is not set");
    expect(said).not.toContain("unknown argument");
  });

  it("⚠ a caller's own BOOLEAN flag too — and this arm exists because a sabotage caught it missing", async () => {
    /*
      The first version of this suite declared only a VALUE flag here, so a
      merge that REPLACED the world booleans with the caller's whenever the
      caller had any passed all nine arms. Sabotaging that line reddened
      nothing, which is the one result a sabotage run must never be shrugged at
      — it was measuring my own control, not the code.

      A ceremony declaring `--force` and losing `--dev` in the same act is
      exactly the shape, and it would break the world flag for that ceremony
      only, which is the hardest kind to notice.
    */
    const said = await withExtra({ value: [], boolean: ["force"] }, "--production", "--force");
    expect(said).toContain("MYSQL_PUBLIC_URL is not set");
    expect(said).not.toContain("unknown argument --production");
    expect(said).not.toContain("unknown argument --force");
  });

  it("DERIVED — every ceremony reaches its command line through this reader, and none reads argv beside it", () => {
    /*
      ⚠ THE POPULATION IS DERIVED, NOT LISTED (working law 4, and "a list stops
      being the list"). #642's own body was measured wrong twice by a grep
      standing in for a reading — once counting 53 where the answer was 51, once
      returning EMPTY over eighteen real members because the delegation sat off
      the left-hand edge of the match. So this arm names no file: it reads the
      directory, finds every caller, and fails on the nineteenth that mentions
      argv anywhere else.

      A ceremony that grows its own flag reads it through `world.args` or
      declares it in `extra`. One that goes back to `process.argv.includes` is
      exactly what this reddens.

      ⚠ THIS ARM'S POPULATION IS ADOPTION, AND ADOPTION IS NOT THE CLASS. A
      ceremony that never calls the reader is invisible here however badly it
      reads its own command line — twelve were, for as long as this arm was the
      only one. The directory arm below is the half that can see them; keep
      both.
    */
    /* ⚠ `readListedSource`, never a bare `readFileSync` — this walks the REAL
       `scripts/` directory, which carries hundreds of untracked disposables and
       is shared by parallel suites, so a file can leave between the listing and
       the read (#223). Caught by `listedSource`'s own guard on this change's
       first preflight, which is that guard doing exactly its job. */
    const callers = readdirSync(SCRIPTS)
      .filter((name) => name.endsWith(".mts") && !name.includes("disposable"))
      .map((name) => ({ name, body: readListedSource(join(SCRIPTS, name)) }))
      .filter((entry): entry is { name: string; body: string } =>
        entry.body !== null && entry.body.includes("openCeremonyWorld("));

    /* ⚠ A FLOOR, and it moved 18 → 30 when #642's twelve landed. It is
       deliberately not the exact count — a new ceremony must never redden this
       — but it is the only thing here that notices a converted file being
       reverted WHOLE, because such a file leaves the population rather than
       failing inside it. */
    expect(callers.length, "no ceremony found — the reader itself is the bug").toBeGreaterThanOrEqual(30);

    for (const { name, body } of callers) {
      const strayArgv = body
        .split("\n")
        .filter((line) => line.includes("process.argv") && !SANCTIONED_HANDOFF.test(line));
      expect(strayArgv, `${name} reads process.argv outside the shared reader`).toEqual([]);
    }
  });

  it("DERIVED — no ceremony in the directory picks its world out of a raw argv read", () => {
    /*
      THE HALF THE ADOPTION ARM CANNOT DO (#642 slice 2). Its population is
      `scripts/ceremony-*.mts` — the DIRECTORY, not the callers — so a ceremony
      that has never heard of `openCeremonyWorld` is inside it, which is exactly
      the twelve this commit converted and exactly where a thirteenth would
      land.

      It asks the one question that decides the defect rather than the one that
      is easy to grep: does this file choose between dev and production from
      words it read out of `process.argv` itself? That is the choice the shared
      reader exists to own, and owning it is what makes `--production
      --dry-run` a refusal instead of a silent half-obeyed command.

      ⚠ IT DOES NOT DEMAND THAT EVERY CEREMONY CALL THE READER, and that is not
      laziness. Read at the tree: 35 ceremonies, 30 of them callers. The five
      that are not divide cleanly — FOUR (`add-diagnostic-batch-kind`,
      `cast-segments`, `reference-library`, `segment-store`) mention
      `process.argv` nowhere at all and read `MYSQL_PUBLIC_URL` directly:
      production-only by construction, with no world to choose and no word to
      swallow. The fifth, `ceremony-r7-founder-evidence`, takes an explicit
      `--database-url` through its own parser, which refuses an unknown
      argument — DRIVEN in the arm below rather than asserted here, because a
      docblock is the one claim a guard can never check. Forcing any of the five
      onto this reader would be a change to what they DO, made by a guard, which
      is not what a guard is for.
    */
    const ceremonies = readdirSync(SCRIPTS)
      .filter((name) => name.startsWith("ceremony-") && name.endsWith(".mts"))
      .map((name) => ({ name, body: readListedSource(join(SCRIPTS, name)) }))
      .filter((entry): entry is { name: string; body: string } => entry.body !== null);

    expect(ceremonies.length, "no ceremony found — the directory read is the bug")
      .toBeGreaterThanOrEqual(30);

    const handRolled = ceremonies
      .filter(({ body }) => choosesItsOwnWorld(body))
      .map(({ name }) => name);

    expect(
      handRolled,
      "these ceremonies choose their world from a raw argv read — hand the whole line to `openCeremonyWorld` instead",
    ).toEqual([]);
  });

  it("the directory arm can FAIL — the hand-rolled shape it was written for still reddens it", () => {
    /*
      A complement that is green over nothing is the failure this repository
      keeps meeting, so the predicate is driven both ways against real text: the
      exact block the twelve carried before this commit, and the sanctioned
      road that replaced it.
    */
    expect(choosesItsOwnWorld(
      'const world = process.argv.includes("--production")\n'
      + '  ? "production"\n'
      + '  : process.argv.includes("--dev") ? "dev" : null;',
    )).toBe(true);
    expect(choosesItsOwnWorld('if (process.argv.indexOf("--dev") !== -1) {')).toBe(true);
    expect(choosesItsOwnWorld("const world = process.argv.slice(2).includes('--production');")).toBe(true);

    /*
      ⚠ THE TWO SHAPES PR #657'S REVIEW FOUND, and they are the reason the
      predicate reads the whole file rather than one line. Both are the identical
      defect with the argv read and the world word on DIFFERENT lines — an alias
      and a wrapped chain — and both are non-adopters, so the adoption arm above
      is blind to them by construction. If this arm ever goes green on these two,
      the directory arm has quietly become the thing it replaced.
    */
    expect(choosesItsOwnWorld(
      "const args = process.argv.slice(2);\n"
      + 'const world = args.includes("--production") ? "production" : "dev";',
    )).toBe(true);
    expect(choosesItsOwnWorld(
      "const world = process.argv\n"
      + '  .includes("--production");',
    )).toBe(true);

    expect(choosesItsOwnWorld(
      "const { world, connection: conn } = await openCeremonyWorld(process.argv);",
    )).toBe(false);
    /*
      ⚠ AND THE FALSE POSITIVE THE WIDENING COULD HAVE BOUGHT. A legitimate
      caller that merely NAMES a world in a hint string must stay clean — it is
      the `unsanctioned` half of the predicate that keeps it so, not luck, and a
      predicate that only asked "does this file mention both" would fail here and
      be weakened by the first person it stopped.
    */
    expect(choosesItsOwnWorld(
      "const { connection: conn } = await openCeremonyWorld(process.argv);\n"
      + 'console.error("run it with --production under railway");',
    )).toBe(false);
    /* The reader's OWN spelling of the two words must not read as an offence —
       it declares them, which is the whole point. */
    expect(choosesItsOwnWorld('const WORLD_FLAGS = ["dev", "production"] as const;')).toBe(false);
  });

  it("the one ceremony outside this reader refuses an unknown word by its own parse", () => {
    /*
      ⚠ THE EXEMPTION ABOVE IS PROVEN, NOT GRANTED. `ceremony-r7-founder-evidence`
      is excused from the directory arm because it parses its own command line
      strictly — so that claim is driven here rather than left as a sentence in
      a docblock, which is the one kind of claim a guard can never check
      (2026-09-07's own finding, twice over).
    */
    expect(() => parseFounderEvidenceCeremonyArgs(["--stage", "--dry-run"]))
      .toThrow(/Unknown ceremony argument/);
  });

  it("the sanctioned `extra` shape is NOT read as a stray argv — the arm above must not ban its own advice", () => {
    /*
      ⚠ PR #644's review, finding 1, and it would have fired on the first
      ceremony that followed this suite's own instructions. The filter was the
      literal substring `openCeremonyWorld(process.argv)` — closing paren
      included — so `openCeremonyWorld(process.argv, { value: ["limit"] })`, the
      exact road the docblock and two arms above teach, read as a STRAY argv.

      The nineteenth ceremony lands, the gate reddens on a file that did
      everything right, and its author either believes the sanctioned road is
      banned or weakens this guard under time pressure. Both are worse than the
      defect the guard exists for.

      `.slice` stays refused on purpose: the reader slices `argv` itself, so a
      pre-sliced caller would lose two real words off the front of its line.
    */
    expect(SANCTIONED_HANDOFF.test("const world = await openCeremonyWorld(process.argv);")).toBe(true);
    expect(SANCTIONED_HANDOFF.test('await openCeremonyWorld(process.argv, { value: ["limit"], boolean: [] });')).toBe(true);
    expect(SANCTIONED_HANDOFF.test("await openCeremonyWorld(process.argv, {")).toBe(true);

    /* And the shapes that must still redden — a guard that accepts everything
       is the failure this arm's own class is about. */
    expect(SANCTIONED_HANDOFF.test("openCeremonyWorld(process.argv.slice(2))")).toBe(false);
    expect(SANCTIONED_HANDOFF.test('if (process.argv.includes("--production")) {')).toBe(false);
    expect(SANCTIONED_HANDOFF.test("const world = process.argv[2];")).toBe(false);
  });
});
