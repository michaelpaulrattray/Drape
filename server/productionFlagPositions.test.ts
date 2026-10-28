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
 *                            on that word (fable-1260), and OFF the service
 *                            entirely on 2026-09-24 — his *"It retires with
 *                            N2"* (#1158 slice 4c). The specimen has now been
 *                            wrong in both directions on one flag, which is
 *                            why it is kept rather than replaced.
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

import { FLAG_CATALOGUE, flagCatalogue, statedFlagPositions } from "../scripts/lib/lawText.mts";

import {
  PRODUCTION_FLAG_POSITIONS,
  compareCatalogueToRecord,
  comparePositions,
  parseVariableLines,
  positionIsLegal,
} from "../scripts/lib/productionFlagPositions.mts";
import { declaredEnvNames, serverAndSharedSources } from "../scripts/lib/declaredEnvNames.mts";
import { BOOT_GOVERNED_ENV_NAMES } from "../scripts/lib/governedBootSettings.mts";

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

  it("⚠ #1174 — names a position for every BOOT SETTING the product refuses to start over", () => {
    /* The non-scope half. `CASTING_ROLL_ENGINE_MODEL` was SET to `sunburst` on
       production and governed by nothing, because the gate read a NAME PATTERN
       and that name carries neither SCOPE nor STAGE. A boot setting with no row
       is a setting the rite cannot compare in either direction. */
    const missing = BOOT_GOVERNED_ENV_NAMES.filter((name) => !(name in PRODUCTION_FLAG_POSITIONS));
    expect(
      missing,
      "these settings are read at boot and have no declared production position",
    ).toEqual([]);
  });

  it("names no flag neither reader declares, except by deliberate exception", () => {
    /* The other direction: a row for a variable that no longer exists is a row
       that can never disagree with anything, which is the quietest way for a
       table like this to rot. The one exception is stated in the row itself —
       `R7_EVIDENCE_COMPOSER_RECIPE` is not a scope, and it is on the table
       because the SERVICE holds it. */
    const EXPECTED_NON_FLAGS = ["R7_EVIDENCE_COMPOSER_RECIPE"];
    /* ⚠ #1174 widened the population rather than the exception list: the boot
       settings are DERIVED from the declarations the product refuses to start
       over, so a retired one drops out of this set on its own and its row then
       shows up here as litter — which is the direction this arm exists for. */
    const declared = new Set([...ATLAS_FLAGS, ...CONSTANT_SCAN_FLAGS, ...BOOT_GOVERNED_ENV_NAMES]);
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

  /*
    ────────────────────────────────────────────────────────────────────────────
    EVERY POSITION IS IN THE LEGAL DOMAIN (#2691, found by Janitor patrol #17).

    A row wrote `position: "UNSET"` — the constant's NAME in quotes — and the
    record then claimed production held the literal text `UNSET`. What makes it
    a class rather than a typo is that **every local instrument was blind to
    it**, driven at the time rather than reasoned: these three suites passed 45
    tests with the defect present, `tsc` was silent because the field was a bare
    `string`, and the deploy rite was the ONLY reader that caught it — after
    merge, where it blocked every rite for about two hours.

    The field is a union now, so that exact token is a COMPILE error. This arm
    is the other half, and it is not redundant with the type: the type cannot
    say *"a comma-separated list of positive integers"*, so `users:UNSET` type-
    checks and this is what refuses it.
  */
  it("⚠ #2691 — every position is in the legal domain, ids and all", () => {
    for (const [name, entry] of Object.entries(PRODUCTION_FLAG_POSITIONS)) {
      expect(positionIsLegal(entry.position), `${name} holds "${entry.position}"`).toBe(true);
    }
  });

  it("⚠ CONTROL — the domain reader refuses the token that actually shipped", () => {
    /*
      THE SPECIMEN FIRST, because an arm that cannot fail on the real defect is
      decoration. `"UNSET"` is what row 255 carried.
    */
    expect(positionIsLegal("UNSET")).toBe(false);

    /* The shape the TYPE lets through, which is this reader's whole reason for
       existing beside it. */
    expect(positionIsLegal("users:UNSET")).toBe(false);
    expect(positionIsLegal("users:")).toBe(false);
    expect(positionIsLegal("users:0")).toBe(false);
    expect(positionIsLegal("users:01")).toBe(false);
    expect(positionIsLegal("users:1,1")).toBe(false);
    expect(positionIsLegal("users:1,")).toBe(false);
    expect(positionIsLegal("users:-1")).toBe(false);

    /* And the other identifier-shaped mistakes in the same family: a constant
       this module does not have, and the catalogue's own spelling of one. */
    expect(positionIsLegal("ALL")).toBe(false);
    expect(positionIsLegal("OFF")).toBe(false);
    expect(positionIsLegal("")).toBe(false);

    /*
      ⚠ POSITIVE CONTROL, and it is the arm that matters most: a reader that
      refuses everything would pass every assertion above while making the
      domain arm refuse the real table. Each of these is a value some row
      genuinely holds today.
    */
    expect(positionIsLegal("off")).toBe(true);
    expect(positionIsLegal("all")).toBe(true);
    expect(positionIsLegal("true")).toBe(true);
    expect(positionIsLegal("users:1")).toBe(true);
    expect(positionIsLegal("users:1,2")).toBe(true);
    expect(positionIsLegal("sunburst")).toBe(true);
    expect(positionIsLegal("ink.add.front_upper_torso.v1")).toBe(true);
  });

  /*
    AND THE DOMAIN READER IS HELD TO THE TABLE IN BOTH DIRECTIONS — a value the
    reader allows and no row holds is dead permission, and the two named
    settings are the ones most likely to rot: `flare` is in the union because it
    is `CASTING_ROLL_ENGINE_MODEL`'s other legal value, and the recipe id is a
    string nobody would notice going stale.

    Derived from the table rather than listed, so a row that changes its value
    moves this arm with it.
  */
  it("⚠ #2691 — the named settings the reader allows are the ones rows actually hold", () => {
    const held = new Set(Object.values(PRODUCTION_FLAG_POSITIONS).map((entry) => entry.position));
    const namedSettingsHeld = [...held].filter((position) => !/^(off|all|true|users:)/.test(position));
    /* Sorted, so the failure message names the drift rather than an order. */
    expect(namedSettingsHeld.sort()).toEqual(["ink.add.front_upper_torso.v1", "sunburst"]);
    /* `flare` is allowed and unheld ON PURPOSE — stated here so a later reader
       does not "tidy" it out of the union and make the other engine illegal. */
    expect(positionIsLegal("flare")).toBe(true);
    expect(held.has("flare")).toBe(false);
  });

  it("⚠ holds the two positions whose CLAUDE.md paragraphs had gone stale", () => {
    /* Pinned BY NAME rather than left to the population check, because these two
       are the specimens this whole file was built from. If either moves, the
       paragraph in the flag catalogue moves with it — that is the coupling.

       ⚠ AND THE COUPLING FIRED, WHICH IS THE ONLY REASON THIS COMMENT IS BEING
       WRITTEN (2026-09-24, #1158 slice 4c). `CASTING_INK_CUT_SCOPE` moved from
       `users:1` to `off` — his ruling *"It retires with N2"* took the whole
       studio road, and the variable came off the service in one act with its
       parent. This line is the thing that made the catalogue entry and
       `CLAUDE.md`'s own index row move in the same commit instead of being
       rediscovered as stale in a month. The specimen is KEPT rather than
       re-pointed at some other flag: a position that has now been wrong in both
       directions on one flag is a better specimen than a fresh one.

       ⚠ AND THE COUPLING HAS NOW FIRED A THIRD TIME, ON THE OTHER SPECIMEN
       (2026-10-15, #1577 slice D3). `CASTING_INK_WORDS_SCOPE` is RETIRED — the
       flag is out of the code on his word *"yes approve the plan and switch off
       the six settings"* — so the right pin is no longer a POSITION but the
       ABSENCE of a row, and this arm says so rather than being deleted. Deleting
       it would have dropped the one assertion that makes the catalogue entry and
       `CLAUDE.md`'s index row move in the same commit as the code, which is the
       whole coupling this arm exists to be.

       ⚠ The row's absence is asserted here and the flag's NAME is still
       required in the law by the retirement guard — those are two different
       claims and both are wanted: the table must stop governing a variable the
       code no longer reads, and the record must still name what died. */
    expect(
      PRODUCTION_FLAG_POSITIONS.CASTING_INK_WORDS_SCOPE,
      "a retired flag keeps no row — the table governs what the code reads",
    ).toBeUndefined();
    expect(PRODUCTION_FLAG_POSITIONS.CASTING_INK_CUT_SCOPE?.position).toBe("off");
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
    /* ⚠ The subject was `CASTING_INK_WORDS_SCOPE` until #1577 slice D3 retired
       it, at which point this arm asserted a mismatch on a row that no longer
       exists and could only ever have found none. It is re-pointed at
       `CASTING_V2_SCOPE` — the program's own door, the one flag on this table
       that no retirement slice can take — rather than at another scope flag
       whose own slice would move this arm again (D4 and D5 are queued). */
    const verdict = comparePositions(
      agreeing.map((reading) =>
        reading.name === "CASTING_V2_SCOPE" ? { ...reading, value: "users:1" } : reading,
      ),
    );
    expect(verdict.mismatches).toHaveLength(1);
    expect(verdict.mismatches[0]).toContain("CASTING_V2_SCOPE");
    expect(verdict.mismatches[0], "the recorded position is quoted so the reader can judge").toContain(
      "`all`",
    );
  });

  it("reports a flag the record says is off and the service has switched on", () => {
    /* The direction that matters most: a scope quietly widened past what the
       record says. `off` is the absence of a variable, so this is a reading the
       naive "compare what is set" shape would never make.

       ⚠ THIS ARM NAMED `CASTING_BORN_INK_SCOPE` UNTIL 2026-09-24 AND WAS NOT
       DOING WHAT THIS COMMENT SAYS. That flag's recorded position was `users:1`,
       never `off`, so `agreeing` already carried a reading for it and appending
       `all` produced a mismatch by DISAGREEING ON A VALUE — the same thing the
       arm above this one tests, with a duplicate reading in the array. The `off`
       → switched-on direction, which is the one the comment calls the direction
       that matters most, had no coverage here at all.

       It surfaced when born-ink was widened to `all` on his reply #215: the
       literal came to AGREE with the record, the mismatch count fell to 0, and
       the arm went red. A guard that reddens because the product changed
       legitimately was keyed on the wrong thing.

       So the fixture is DERIVED rather than named (working law 4): whichever
       flags the record genuinely holds at `off`. A named one rots the next time
       that flag's position moves, which is precisely what just happened, and
       the three `off` rows today are a retiring flag and two in a parked family
       — none of them a position worth pinning a guard to. */
    const recordedOff = Object.entries(PRODUCTION_FLAG_POSITIONS)
      .filter(([, entry]) => entry.position === "off")
      .map(([name]) => name);
    /* VACUITY GUARD. With no `off` row this arm would append nothing, compare an
       agreeing service against itself and pass with zero mismatches — green,
       and proving the opposite of its name. */
    expect(
      recordedOff.length,
      "no flag in the record is `off`, so this arm has nothing to switch on and cannot test its direction",
    ).toBeGreaterThan(0);

    const name = recordedOff[0];
    const verdict = comparePositions([...agreeing, { name, value: "all" }]);
    expect(verdict.mismatches).toHaveLength(1);
    expect(verdict.mismatches[0]).toContain(name);
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

describe("the flag catalogue and the table do not drift apart", () => {
  /*
    ⚠ THE PROSE MOVED, THE ARM DID NOT (2026-08-31, #330). The flag entries were
    carved out of `CLAUDE.md` into `docs/architecture/FEATURE_FLAGS.md`, byte for
    byte. Both arms below read those paragraphs, so both follow them. The CONTROL
    is what would have caught a move that left this pointed at the emptied file,
    which is why it asserts a length and two specimens rather than only that
    nothing bad is present.
  */
  const claude = flagCatalogue(repoRoot);

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
    /* ⚠ `CASTING_INK_WORDS_SCOPE` was the second pair here and came off with the
       flag (#1577 slice D3). This arm compares a FORBIDDEN SENTENCE against a
       position the table holds, and a retired flag has no position to hold — with
       the row gone the guard clause read "still flipped" off `undefined` and
       asked the question about nothing. The sentence it watched for is retired
       prose either way; what replaced this arm's cover for that flag is the
       retirement guard, which requires the law to go on naming it. */
    const retired = [
      ["CASTING_INK_CUT_SCOPE", "should not be flipped for anyone until 3a.2(b) lands"],
    ] as const;

    const lowered = claude.toLowerCase();
    for (const [flag, sentence] of retired) {
      const stillFlipped = PRODUCTION_FLAG_POSITIONS[flag]?.position !== "off";
      if (!stillFlipped) continue;
      expect(
        lowered.includes(sentence.toLowerCase()),
        `${FLAG_CATALOGUE} forbids a position production already holds for ${flag} — `
        + `the record says \`${PRODUCTION_FLAG_POSITIONS[flag]?.position}\`. `
        + `A ruling that landed in a mailbox and never reached this page.`,
      ).toBe(false);
    }
  });

  it("⚠ CONTROL — the sentences being looked for are the real ones", () => {
    /* The arm above is absence-only, so on its own it passes over a catalogue
       that has been emptied, renamed or moved — which #330 made a live
       possibility rather than a hypothetical. This proves the file is the one
       we think it is and that a positive match is possible at all. */
    expect(claude.length).toBeGreaterThan(50_000);
    expect(claude, "the flag section itself").toContain("CASTING_INK_WORDS_SCOPE");
    expect(claude, "the corrections that retired those two sentences").toContain("fable-1400");
  });
});

describe("⚠ #2747 — every catalogue entry that states a position states the right one", () => {
  /*
    THE DERIVED READING THAT REPLACES THE FLOOR ABOVE.

    The arm above pins TWO named sentences and its own docblock says what that
    costs: *"a third stale sentence in some other paragraph is still invisible,
    and saying so is the honest floor."* That floor was honest, and it was also
    where SIX live mistakes were sitting when somebody finally looked.

    Five were found by #2697's sweep on 2026-10-28 and corrected in PR #2746 —
    `CASTING_CURRENT_DESCRIPTION_SCOPE` and `CASTING_OUTFIT_EDIT_SCOPE` saying
    UNSET while his own hand had set both to `users:1`, `CASTING_VOICE_SCOPE`
    saying unset for 14 days, and `CASTING_RETRY_SCOPE` and
    `CASTING_CONCEPT_UPLOAD_SCOPE` saying `users:1` for **34 days** about roads
    his switch sitting had opened to everyone. Four of the five were wrong in
    the direction that HIDES a live road.

    ⚠ **The sixth was found by this arm, on the tree AFTER those corrections,
    and it is the reason the arm is not merely a regression test for #2746.**
    `CASTING_CREATIVE_REGISTER_SCOPE` is RETIRED and its variable is off the
    service, and the tail of its 24,000-character entry still read
    `Production: users:1 … It widens on his eye at the milestone gate and not
    before`. #2697's sweep could not see it: that sweep compared entries the
    record carries a ROW for, and a retired flag has none. It is struck in the
    catalogue by the same commit as this arm.
  */
  const catalogue = flagCatalogue(repoRoot);

  it("⚠ CONTROL — the reader found a real population, in both of its halves", () => {
    /* FIRST, because every assertion below is vacuously true over an empty
       read. A moved file, a renamed heading or a broken anchor all produce the
       same clean pass otherwise — #330 moved this very catalogue once already.
       These are FLOORS and not literals on purpose: a literal count pins the
       fixture and goes red for a reason that is not the claim. */
    const { stating, silent } = compareCatalogueToRecord(catalogue);
    expect(catalogue.length, FLAG_CATALOGUE).toBeGreaterThan(50_000);
    expect(stating.length + silent.length, "entries the bullet anchor found").toBeGreaterThan(30);
    expect(stating.length, "entries stating a position — the population under test").toBeGreaterThan(10);
    expect(silent.length, "entries stating nothing — the declared remainder").toBeGreaterThan(10);
  });

  it("agrees with the record the deploy rite enforces", () => {
    const { drift } = compareCatalogueToRecord(catalogue);
    expect(drift.join("\n"), `${FLAG_CATALOGUE} has drifted from the record`).toBe("");
  });

  it("⚠ CONTROL — it reddens when an entry's stated position is wrong, and names the flag", () => {
    /* THE FIRING CONTROL, and it is the only one that separates a careful
       reader from an inert one: the four arms around it all pass unchanged
       under a reader that nominates nothing. The fixture drives the SHIPPED
       function with a substituted record, rather than re-reading the catalogue
       by a shorter road of its own. */
    const sabotaged = catalogue.replace(
      "**Production: `all` — WIDENED 2026-09-24 ON HIS CREW REPLY #204**",
      "**Production: `users:1` — WIDENED 2026-09-24 ON HIS CREW REPLY #204**",
    );
    expect(sabotaged, "the anchor this control flips must exist exactly once").not.toBe(catalogue);
    expect(catalogue.split("**Production: `all` — WIDENED 2026-09-24 ON HIS CREW REPLY #204**").length - 1).toBe(1);

    const { drift } = compareCatalogueToRecord(sabotaged);
    expect(drift).toHaveLength(1);
    expect(drift[0]).toContain("CASTING_RETRY_SCOPE");
    expect(drift[0], "the position the prose now claims").toContain("`users:1`");
    expect(drift[0], "the position the record holds").toContain("`all`");
    expect(drift[0], "where to go and fix it").toContain(`${FLAG_CATALOGUE}:`);
  });

  it("⚠ CONTROL — a QUOTATION of a retired position is not a declaration", () => {
    /* TRAP 2, and it has now been paid three times in this repository: the
       forbidden-sentence arm above learned it by failing on its own first run,
       the standing orders' quiet-shift detector strips fences and quotes for
       the same reason, and the naive last-stated-position draft of THIS reader
       called a correct repair a mismatch — because a corrected entry states the
       right position and then quotes the wrong one.

       Both orderings are in the real file, so both are driven here: the
       quotation BEFORE the declaration and the declaration before it. */
    const record = { ACME_SCOPE: { position: "all", why: "a fixture" } } as const;

    const quotedThenDeclared = "- `ACME_SCOPE` — this entry said *\"Production: UNSET\"* "
      + "for eleven days and was corrected today. **Production: `all`** — his word.\n";
    expect(compareCatalogueToRecord(quotedThenDeclared, record).drift).toEqual([]);

    const declaredThenQuoted = "- `ACME_SCOPE` — **Production: `all`** — his word. "
      + "This entry said *\"Production: UNSET — the flip is his\"* until today.\n";
    expect(compareCatalogueToRecord(declaredThenQuoted, record).drift).toEqual([]);

    /* And the struck form, which is how this catalogue retires a position it
       once held rather than deleting it. */
    const struck = "- `ACME_SCOPE` — ~~**Production: unset, `off`** — built dark~~ "
      + "(read until today). **Production: `all`** — his word.\n";
    expect(compareCatalogueToRecord(struck, record).drift).toEqual([]);

    /* ⚠ AND THE TYPOGRAPHIC QUOTE, because the three fixtures above all share
       one property — a STRAIGHT quote — and a fixture family that shares a
       property leaves the other road untested. Measured on the real catalogue:
       both shapes are in it (9 curly pairs against 470 straight), and today's
       two correction notes happen to use straight ones, so the curly branch of
       the stripper's character class has no cover from the live file at all. */
    const curly = `- \`ACME_SCOPE\` — this entry said ${String.fromCharCode(0x201c)}Production: UNSET`
      + `${String.fromCharCode(0x201d)} until today. **Production: \`all\`** — his word.\n`;
    expect(compareCatalogueToRecord(curly, record).drift).toEqual([]);
    expect(compareCatalogueToRecord(curly, record).stating[0]?.stated).toEqual(["all"]);

    /* ⚠ THE CONTROL ON THE CONTROL. All three arms above are satisfied by a
       reader that strips the whole entry and finds nothing, which is the shape
       that makes a stripper worse than no stripper. So the same fixtures with
       the DECLARATION wrong must redden. */
    const wrong = { ACME_SCOPE: { position: "users:1", why: "a fixture" } } as const;
    for (const [label, text] of [
      ["quoted then declared", quotedThenDeclared],
      ["declared then quoted", declaredThenQuoted],
      ["struck then declared", struck],
      ["curly-quoted then declared", curly],
    ] as const) {
      const { drift, stating } = compareCatalogueToRecord(text, wrong);
      expect(stating, `${label}: the declaration must still be READ`).toHaveLength(1);
      expect(drift, `${label}: and compared`).toHaveLength(1);
      expect(drift[0]).toContain("ACME_SCOPE");
    }
  });

  it("⚠ CONTROL — prose `UNSET` means this record's `off`, in both directions", () => {
    /* ⚠ THIS ARM EXISTS BECAUSE THE SABOTAGE ROUND FOUND IT MISSING. Dropping
       the normalisation entirely left all nine other cases GREEN: after PR
       #2746 and the strike above, no live entry spells its position `UNSET`
       any more — all fourteen use a backticked value — so a branch that was
       exercised by three entries as recently as `72d56cc06` had no cover at
       all. The catalogue writes UNSET in prose and `UNSET` is this record's own
       word for `off`, so the mapping is live code either way and will be
       exercised again the next time a dark flag gets an entry.

       Both directions, because a normalisation that maps everything to `off`
       passes the first half on its own. And both spellings the catalogue has
       actually used — the capitalised bare word, and the lowercase
       "unset, `off`" that `CASTING_VOICE_SCOPE`'s entry carried for 14 days. */
    for (const spelt of ["UNSET", "unset, `off`"]) {
      expect(
        compareCatalogueToRecord(
          `- \`ACME_SCOPE\` — **Production: ${spelt}** — built dark.\n`,
          { ACME_SCOPE: { position: "off", why: "a fixture" } },
        ).drift,
        `"${spelt}" against a record that says off`,
      ).toEqual([]);

      const { drift } = compareCatalogueToRecord(
        `- \`ACME_SCOPE\` — **Production: ${spelt}** — built dark.\n`,
        { ACME_SCOPE: { position: "users:1", why: "a fixture" } },
      );
      expect(drift, `"${spelt}" against a record that says users:1`).toHaveLength(1);
      expect(drift[0]).toContain("ACME_SCOPE");
    }
  });

  it("⚠ #2747 — reports an entry stating a position for a flag the record does not carry", () => {
    /* THE SIXTH FINDING'S OWN SHAPE, kept as an arm because retiring a flag and
       unsetting its variable are two separate acts and the sentence stating a
       position outlives both. This is the first direction of this file's own
       header: *"a paragraph saying `users:1` about a variable that is gone is
       the same defect as one saying `off` about a variable that is set."* */
    const orphan = "- `GONE_SCOPE` — ✅ **RETIRED.** Production: `users:1`, and it widens on his eye.\n";
    const { drift } = compareCatalogueToRecord(orphan, { ACME_SCOPE: { position: "all", why: "a fixture" } });
    expect(drift).toHaveLength(1);
    expect(drift[0]).toContain("GONE_SCOPE");
    expect(drift[0], "it must say the record has no row, not guess a position").toContain("no row");
  });

  it("⚠ #2747 — refuses to guess when an entry declares TWO positions", () => {
    /* Picking the last one is exactly the naive reader that called a correct
       repair a mismatch. An entry whose declaration cannot be read is a finding
       about the entry, so it is reported rather than resolved. */
    const twoFaced = "- `ACME_SCOPE` — **Production: `all`** — his word. Later: **Production: `off`**.\n";
    const { drift } = compareCatalogueToRecord(twoFaced, { ACME_SCOPE: { position: "all", why: "a fixture" } });
    expect(drift).toHaveLength(1);
    expect(drift[0]).toContain("ACME_SCOPE");
    expect(drift[0], "and it says what to do about it").toMatch(/cannot be read/);
  });

  it("⚠ CONTROL — the anchor is the entry's own bullet, never the name's first mention", () => {
    /* TRAP 1, measured when this was built: the unanchored draft read
       `CASTING_OUTFIT_EDIT_SCOPE`'s position off a NEIGHBOUR's line and missed
       `CASTING_CONCEPT_UPLOAD_SCOPE` entirely — noisy and silent at once. A
       flag is named inside other flags' entries constantly, and in the real
       catalogue `CASTING_CREATIVE_REGISTER_SCOPE` is named inside
       `CASTING_BRIEF_FIDELITY_SCOPE`'s entry, one bullet above its own. */
    const record = { ACME_SCOPE: { position: "all", why: "a fixture" } } as const;
    const crossReferenced = "- `OTHER_SCOPE` — its parent is `ACME_SCOPE`. **Production: `off`**.\n"
      + "- `ACME_SCOPE` — **Production: `all`** — his word.\n";
    const { drift, stating } = compareCatalogueToRecord(crossReferenced, record);
    expect(stating.map((entry) => entry.name)).toEqual(["OTHER_SCOPE", "ACME_SCOPE"]);
    expect(stating.find((entry) => entry.name === "ACME_SCOPE")?.stated).toEqual(["all"]);
    /* `OTHER_SCOPE` has no row, so it reports as an orphan — which proves the
       two entries were read separately rather than as one blob. */
    expect(drift).toHaveLength(1);
    expect(drift[0]).toContain("OTHER_SCOPE");
  });

  it("⚠ CONTROL — the stripper never blinds itself on a flag the record governs", () => {
    /* The stated limit of `withoutMarkedHistory` is that a quoted span is
       bounded at 400 characters, so an UNPAIRED quote blanks up to 400
       characters after itself. That bound is what stops one stray quote
       swallowing a whole entry; what it cannot do is tell an unpaired quote
       from an open one.

       This is the non-circular assertion that keeps it honest: if an entry's
       RAW text states a position and the stripper removes every one of them,
       the guard has gone silently blind — and that is only acceptable where the
       record carries no row, which is a retired flag whose whole statement is
       history by construction. */
    const blinded = statedFlagPositions(catalogue).filter(
      (entry) => entry.rawStatements > 0
        && entry.stated.length === 0
        && entry.name in PRODUCTION_FLAG_POSITIONS,
    );
    expect(
      blinded.map((entry) => `${entry.name} (${FLAG_CATALOGUE}:${entry.line})`),
      "entries the stripper silenced on a flag the record still governs",
    ).toEqual([]);
  });
});
