/**
 * THE CEREMONY READER REFUSES A WORD IT DOES NOT KNOW (#642, #345's remainder).
 *
 * Eighteen ceremonies hand `process.argv` to one function, `openCeremonyWorld`,
 * and until now that function asked `argv.includes("--production")`,
 * `argv.includes("--dev")`, and looked at nothing else. That is #288's class:
 * *a reader that looks up the flags it wants and never looks at what it was
 * actually given.*
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
      exactly what this reddens, and it is the only way the eighteen quietly
      become seventeen.
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

    expect(callers.length, "no ceremony found — the reader itself is the bug").toBeGreaterThanOrEqual(18);

    for (const { name, body } of callers) {
      const strayArgv = body
        .split("\n")
        .filter((line) => line.includes("process.argv") && !SANCTIONED_HANDOFF.test(line));
      expect(strayArgv, `${name} reads process.argv outside the shared reader`).toEqual([]);
    }
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
