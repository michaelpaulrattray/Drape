/**
 * THE FLAG POSITION TABLE COVERS EVERY FLAG THE CODE DECLARES — AND ITS
 * COMPARATOR IS PROVEN ABLE TO SAY NO IN BOTH DIRECTIONS.
 *
 * `scripts/lib/productionFlagPositions.mts` is a declaration of where each
 * rollout flag is meant to stand on production, and the deploy rite compares it
 * to what the service actually holds on every push. This file is the half that
 * keeps the table honest: a flag written tomorrow joins the population by being
 * written, not by anyone remembering.
 *
 * # Why the table exists at all
 *
 * `CLAUDE.md`'s feature-gated section is prose, and nothing ever compared its
 * sentences to the service. Measured 2026-08-23, two paragraphs had gone stale
 * in the worst direction — they read as prohibitions on things the founder had
 * already authorised and the mailbox had already executed:
 *
 *   CASTING_INK_CUT_SCOPE    *"should not be flipped for anyone until 3a.2(b)
 *                            lands"* — superseded by his own verbatim yes and a
 *                            narrower condition, HIS ACCOUNT ONLY until the
 *                            preview ships (fable-1257 §1); flipped to `users:1`
 *                            on that word (fable-1260).
 *   CASTING_INK_WORDS_SCOPE  *"do not widen this flag on the strength of this
 *                            paragraph"* — the court had run and been ratified
 *                            and the flip to `all` went through HIS OWN HAND
 *                            (fable-1400).
 *
 * # ⚠ WHY THIS ARM CANNOT PROVE THE POSITIONS THEMSELVES
 *
 * Stated rather than left to be assumed. The production environment is not in
 * the repository and this suite must never reach a network — so **nothing here
 * knows whether `CASTING_V2_SCOPE` is really `all`.** Only the rite can know
 * that, because only the rite is already reading the service. What this file
 * guarantees is narrower and is the half a test can hold: the table's
 * POPULATION is right, every row carries a reason, and the comparator reports
 * a disagreement instead of swallowing it. A clean run here is a floor.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  PRODUCTION_FLAG_POSITIONS,
  comparePositions,
  parseVariableLines,
} from "../scripts/lib/productionFlagPositions.mts";
import { declaredEnvNames, serverAndSharedSources } from "../scripts/lib/declaredEnvNames.mts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The Atlas's own flag grammar, so the two readings agree on what a flag is. */
const FLAG_NAME = /^[A-Z0-9_]*(SCOPE|ENABLE|STAGE)[A-Z0-9_]*$/;

/**
 * TWO READERS OF THE FLAG POPULATION, AND THEY DO NOT SHARE A SHAPE.
 *
 * The Atlas's inventory is the primary because it is the broader one: it scans
 * `process.env.X`, `process.env["X"]` AND the `*_ENV` constant pattern, which is
 * why it can see `ENABLE_FINAL_MODEL_DELETE` — read directly off `process.env`
 * in `server/routes/models.ts` and invisible to the constant scan.
 *
 * `declaredEnvNames` is kept as the SECOND reader rather than replaced by the
 * first. It is a plain text scan of a declaration form; the Atlas resolves
 * through ts-morph and lands in a committed artifact. A flag either reader loses
 * is caught by the other, and neither inherits the other's blind spot.
 */
const ATLAS_FLAGS: string[] = (
  JSON.parse(
    readFileSync(path.join(repoRoot, "docs/architecture/drape-architecture.json"), "utf8"),
  ) as { flags: Array<{ name: string }> }
).flags.map((flag) => flag.name).sort();

const CONSTANT_SCAN_FLAGS = declaredEnvNames(serverAndSharedSources(repoRoot))
  .filter((name) => FLAG_NAME.test(name))
  .sort();

describe("the position table's population", () => {
  it("⚠ CONTROL — both readers found a real population, and each one's specimen", () => {
    /* POSITIVE CONTROLS, first. Every assertion below is vacuously true over an
       empty scan, which is exactly how an enumeration guard goes green while
       enumerating nothing (`absence-only-expect-passes-on-nothing`). Each
       reader pins the member the OTHER one cannot see, so a reader quietly
       collapsing into the other is caught here. */
    expect(ATLAS_FLAGS.length).toBeGreaterThan(25);
    expect(CONSTANT_SCAN_FLAGS.length).toBeGreaterThan(25);
    expect(ATLAS_FLAGS).toContain("CASTING_V2_SCOPE");
    expect(
      ATLAS_FLAGS,
      "read straight off process.env — the constant scan cannot see this one",
    ).toContain("ENABLE_FINAL_MODEL_DELETE");
    expect(CONSTANT_SCAN_FLAGS).not.toContain("ENABLE_FINAL_MODEL_DELETE");
    expect(
      CONSTANT_SCAN_FLAGS,
      "the WRAPPED declaration — a same-line regex drops it silently",
    ).toContain("ENABLE_EVIDENCE_CANDIDATE_WORKER");
  });

  it("names a position for every flag EITHER reader declares", () => {
    const missing = [...new Set([...ATLAS_FLAGS, ...CONSTANT_SCAN_FLAGS])]
      .sort()
      .filter((name) => !(name in PRODUCTION_FLAG_POSITIONS));
    expect(
      missing,
      "these flags exist in the code and have no declared production position — the rite "
      + "cannot compare what nobody wrote down. Add a row with the ruling that put it there.",
    ).toEqual([]);
  });

  it("names no flag neither reader declares, except by deliberate exception", () => {
    /* The other direction: a row for a variable that no longer exists is a row
       that can never disagree with anything, which is the quietest way for a
       table like this to rot. The one exception is stated in the row itself —
       `R7_EVIDENCE_COMPOSER_RECIPE` is not a scope, and it is on the table
       because the SERVICE holds it. */
    const EXPECTED_NON_FLAGS = ["R7_EVIDENCE_COMPOSER_RECIPE"];
    const declared = new Set([...ATLAS_FLAGS, ...CONSTANT_SCAN_FLAGS]);
    const extra = Object.keys(PRODUCTION_FLAG_POSITIONS)
      .filter((name) => !declared.has(name))
      .filter((name) => !EXPECTED_NON_FLAGS.includes(name));
    expect(extra, "rows for variables the code no longer declares").toEqual([]);
  });

  it("gives every row a reason, because a position with no why is an accident", () => {
    for (const [name, entry] of Object.entries(PRODUCTION_FLAG_POSITIONS)) {
      expect(entry.position, `${name} has no position`).toBeTruthy();
      expect(entry.why.length, `${name}'s reason is too thin to be one`).toBeGreaterThan(20);
    }
  });

  it("⚠ holds the two positions whose CLAUDE.md paragraphs had gone stale", () => {
    /* Pinned BY NAME rather than left to the population check, because these two
       are the specimens this whole file was built from. If either moves, the
       paragraph in CLAUDE.md moves with it — that is the coupling. */
    expect(PRODUCTION_FLAG_POSITIONS.CASTING_INK_WORDS_SCOPE?.position).toBe("all");
    expect(PRODUCTION_FLAG_POSITIONS.CASTING_INK_CUT_SCOPE?.position).toBe("users:1");
  });
});

describe("the comparator, proven able to say no", () => {
  /** The service's readings when everything stands where the table says. */
  const agreeing = Object.entries(PRODUCTION_FLAG_POSITIONS)
    .filter(([, entry]) => entry.position !== "off")
    .map(([name, entry]) => ({ name, value: entry.position }));

  it("⚠ CONTROL — a service that agrees produces no mismatch, and a full block", () => {
    /* POSITIVE CONTROL. Without it every "reports a mismatch" arm below could
       pass on a comparator that reports a mismatch for everything. */
    const verdict = comparePositions(agreeing);
    expect(verdict.mismatches).toEqual([]);
    expect(verdict.block).toHaveLength(Object.keys(PRODUCTION_FLAG_POSITIONS).length);
    expect(verdict.block.some((line) => line.includes("<unset>"))).toBe(true);
  });

  it("reports a flag the service holds at a different position", () => {
    const verdict = comparePositions(
      agreeing.map((reading) =>
        reading.name === "CASTING_INK_WORDS_SCOPE" ? { ...reading, value: "users:1" } : reading,
      ),
    );
    expect(verdict.mismatches).toHaveLength(1);
    expect(verdict.mismatches[0]).toContain("CASTING_INK_WORDS_SCOPE");
    expect(verdict.mismatches[0], "the recorded position is quoted so the reader can judge").toContain(
      "`all`",
    );
  });

  it("reports a flag the record says is off and the service has switched on", () => {
    /* The direction that matters most: a scope quietly widened past what the
       record says. `off` is the absence of a variable, so this is a reading the
       naive "compare what is set" shape would never make. */
    const verdict = comparePositions([...agreeing, { name: "CASTING_BORN_INK_SCOPE", value: "all" }]);
    expect(verdict.mismatches).toHaveLength(1);
    expect(verdict.mismatches[0]).toContain("CASTING_BORN_INK_SCOPE");
  });

  it("reports a flag the record says is ON that the service does not hold at all", () => {
    /*
      ⚠ THE ARM THE SABOTAGE FOUND MISSING, and it is the direction that costs
      most. Every other arm here varies a VALUE; this one varies PRESENCE. A
      comparator that only ever compares the variables it can see is green while
      `CASTING_V2_SCOPE` is deleted off the service — the record would say `all`,
      the product would be dark for every account, and nothing would say a word.
      Neutering `?? UNSET` reddened NOTHING before this existed.
    */
    const withoutTheProgramsDoor = agreeing.filter(
      (reading) => reading.name !== "CASTING_V2_SCOPE",
    );
    const verdict = comparePositions(withoutTheProgramsDoor);

    expect(verdict.mismatches).toHaveLength(1);
    expect(verdict.mismatches[0]).toContain("CASTING_V2_SCOPE");
    expect(verdict.mismatches[0], "an unset variable is reported as off, not skipped").toContain(
      "`off`",
    );
    expect(verdict.block.join("\n"), "and it still appears in the receipt").toContain(
      "CASTING_V2_SCOPE=<unset>",
    );
  });

  it("reports a governed variable the table has never heard of — by NAME only", () => {
    const verdict = comparePositions([
      ...agreeing,
      { name: "CASTING_SOMETHING_NEW_SCOPE", value: "users:7" },
    ]);
    expect(verdict.mismatches).toHaveLength(1);
    expect(verdict.mismatches[0]).toContain("CASTING_SOMETHING_NEW_SCOPE");
    expect(
      verdict.mismatches[0],
      "an unrecognised variable is exactly the one whose value must not be printed",
    ).not.toContain("users:7");
  });

  it("says nothing about a variable that is not a flag at all", () => {
    /* NEGATIVE CONTROL for the previous arm: the comparator must not start
       reporting every secret on the service as an undeclared flag. */
    const verdict = comparePositions([...agreeing, { name: "DATABASE_URL", value: "mysql://secret" }]);
    expect(verdict.mismatches).toEqual([]);
    expect(verdict.block.join("\n")).not.toContain("DATABASE_URL");
  });

  it("parses the service's kv output and keeps values out of the block for unknown names", () => {
    const readings = parseVariableLines(
      ["CASTING_V2_SCOPE=all", "  R7_SNAPSHOT_READ_SCOPE=all  ", "not a line", "JWT_SECRET=shh"].join(
        "\n",
      ),
    );
    expect(readings.map((reading) => reading.name)).toEqual([
      "CASTING_V2_SCOPE",
      "R7_SNAPSHOT_READ_SCOPE",
      "JWT_SECRET",
    ]);
    expect(comparePositions(readings).block.join("\n")).not.toContain("shh");
  });
});

describe("CLAUDE.md and the table do not drift apart", () => {
  const claude = readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf8");

  it("⚠ carries no instruction forbidding a position the record says production holds", () => {
    /*
      THE ORIGINAL DEFECT, made mechanical for the two sentences that carried it.
      This cannot read prose in general — it pins the two specimens by their own
      words, so restoring either sentence while the table says the flag is
      flipped reddens here. A third stale sentence in some other paragraph is
      still invisible, and saying so is the honest floor.

      ⚠ CASE-INSENSITIVE, AND THE CORRECTIONS DO NOT QUOTE THESE SENTENCES.
      Both halves were learned by this arm failing on its own first run. A
      substring test cannot tell an INSTRUCTION from a QUOTATION of a retired
      instruction, and the correction I had written quoted both verbatim — so
      the ink-cut arm went red and the ink-words arm passed only because the
      quotation had changed one letter's case. The corrections paraphrase now,
      and the match ignores case, so neither a quotation nor a capital can
      decide this.
    */
    const retired = [
      ["CASTING_INK_CUT_SCOPE", "should not be flipped for anyone until 3a.2(b) lands"],
      ["CASTING_INK_WORDS_SCOPE", "Do not widen this flag on the strength of this paragraph"],
    ] as const;

    const lowered = claude.toLowerCase();
    for (const [flag, sentence] of retired) {
      const stillFlipped = PRODUCTION_FLAG_POSITIONS[flag]?.position !== "off";
      if (!stillFlipped) continue;
      expect(
        lowered.includes(sentence.toLowerCase()),
        `CLAUDE.md forbids a position production already holds for ${flag} — `
        + `the record says \`${PRODUCTION_FLAG_POSITIONS[flag]?.position}\`. `
        + `A ruling that landed in a mailbox and never reached this page.`,
      ).toBe(false);
    }
  });

  it("⚠ CONTROL — the sentences being looked for are the real ones", () => {
    /* The arm above is absence-only, so on its own it passes over a CLAUDE.md
       that has been emptied, renamed or moved. This proves the file is the one
       we think it is and that a positive match is possible at all. */
    expect(claude.length).toBeGreaterThan(50_000);
    expect(claude, "the flag section itself").toContain("CASTING_INK_WORDS_SCOPE");
    expect(claude, "the corrections that retired those two sentences").toContain("fable-1400");
  });
});
