import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WHAT THE GATE CALLS A MONEY DIFF, AND WHY IT IS TWO READINGS (card #958).
 *
 * `gate.yml`'s *Money/auth surface check* labels a PR `founder-review`, which
 * is what puts it in the founder's digest AND what forces the full Fable
 * review in `review.yml`. Until 2026-09-15 it asked ONE question — does this
 * diff touch a path on a list — and that list is *where money is stored and
 * where it is bought*. It had no entry for **where money is decided**.
 *
 * ⚠ THE FAILURE DIRECTION WAS THE BAD ONE. A pattern that is too wide costs a
 * needless review; this one was too narrow, so it failed SILENTLY, toward less
 * scrutiny, on the paths that move customers' credits. Measured on #958 and
 * re-measured before the change, over the 60 newest merged PRs:
 *
 *     path list alone (before)                 4 of 60
 *     + credit-API symbol reading (shipped)    9 of 60
 *     + whole casting dirs (the rejected one) 17 of 60
 *
 * The four the path list caught are three auth PRs and one Stripe one. **Not
 * one credit-refund fix was among them.** The five the symbol reading adds are
 * #924, #874, #872, #871 and #866 — every one a change to how many credits a
 * customer gets back — and all five shipped unlabelled. The rejected
 * alternative (`^server/casting/`, `^server/castingV2/` wholesale) labels 17,
 * most touching no money at all, which is a real cost against a capped
 * reviewer.
 *
 * ⚠ WHAT THE SYMBOL READING DOES *NOT* CLAIM, said plainly rather than left to
 * be discovered. It matches any ADDED OR REMOVED LINE mentioning a credit
 * primitive — including a docblock, and including a substring: PR #866's only
 * symbol-bearing line is a comment, and PR #924's is the fixture string
 * `cr_addCredits`. It is a VISIBILITY signal under the founder's own ruling on
 * this label ("visibility, not a block"), never a proof that money moved. A
 * narrower reading with word boundaries was measured and rejected: it drops
 * #924, a real credit change-request PR. Coarse and catching all five beats
 * precise and catching four.
 *
 * ⚠ AND THE SWEEP FOUND THE SIBLING, WHICH IS THE LARGER HALF OF THE FIX.
 * `review.yml`'s triage carried a BYTE-IDENTICAL copy of the same path list
 * under the name `MONEY`, and what that copy decides is whether the reviewer
 * reads CLAUDE.md IN FULL rather than the charter. So the same 27 modules were
 * invisible twice: unlabelled for the founder, and reviewed shallow. Fixing
 * only the gate would have left a diff the gate calls money getting the
 * charter reading — working law 4, and exactly the drift `.githooks/atlas-paths`
 * was carved out to stop. Both patterns now live once, in
 * `.github/money-surfaces.sh`, and both workflows source it.
 *
 * WHY THIS SUITE EXISTS AT ALL. The step had no test of any kind, so a pattern
 * edited by hand could silently stop labelling money PRs — which is the very
 * defect #958 recorded. Working law 2: the instrument gets a negative control
 * and a positive control before its verdicts count. Both readings are
 * EXTRACTED from the declaration here rather than restated, so this file
 * cannot become the second list working law 4 warns about — and an arm below
 * refuses either workflow growing a local copy again.
 *
 * ⚠ ONE STATED LIMIT OF THIS SUITE. The gate runs the patterns under
 * `grep -E` and `git diff -G` (POSIX ERE); these arms drive the same bytes
 * through JS `RegExp`. That is a second reader with its own dialect, so an arm
 * below refuses any construct where the two diverge — the patterns are held to
 * the common subset rather than trusted to behave the same.
 */

const repoRoot = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");
const declaration = read(".github/money-surfaces.sh");
const gateYml = read(".github/workflows/gate.yml");
const reviewYml = read(".github/workflows/review.yml");

/** The `Money/auth surface check` step of `gate.yml`, and nothing else. */
function moneyStep(): string {
  const start = gateYml.indexOf("- name: Money/auth surface check");
  if (start === -1) throw new Error("gate.yml has no 'Money/auth surface check' step");
  const rest = gateYml.slice(start + 1);
  const end = rest.indexOf("\n      - name: ");
  const step = end === -1 ? rest : rest.slice(0, end);
  if (step.trim().length === 0) throw new Error("the money/auth step parsed empty");
  return step;
}

/**
 * A shell assignment's value, read out of the ONE file that declares it.
 * THROWS rather than returning "" — a collector that can come up empty reports
 * a complete answer either way, and an empty pattern here means "label
 * nothing", which is exactly the silence this guard exists to catch.
 */
function shellVar(name: string): string {
  const m = new RegExp(`(?:^|\n)${name}='([^']+)'`).exec(declaration);
  if (!m) throw new Error(`.github/money-surfaces.sh declares no ${name}=`);
  const value = m[1]!;
  if (value.trim().length === 0) throw new Error(`${name} is declared empty`);
  return value;
}

const PATTERNS = shellVar("MONEY_PATHS");
const SYMBOLS = shellVar("MONEY_SYMBOLS");
const pathRe = new RegExp(PATTERNS);
const symbolRe = new RegExp(SYMBOLS);

describe("the gate's money classifier is declared and wired (#958)", () => {
  it("declares both readings", () => {
    expect(PATTERNS.length).toBeGreaterThan(40);
    expect(SYMBOLS.length).toBeGreaterThan(10);
  });

  /**
   * Invariant 7 in miniature: a pattern nobody consults is not a control. The
   * whole #958 defect was a rule doing no work, so the coupling is asserted
   * rather than assumed — a `SYMBOLS` left declared after its `git diff -G`
   * was removed would otherwise read as coverage.
   */
  it("consults both — the path list through grep, the symbols through git diff -G", () => {
    const step = moneyStep();
    expect(step).toMatch(/grep -E "\$MONEY_PATHS"/);
    expect(step).toMatch(/git diff -G"\$MONEY_SYMBOLS"/);
  });

  /**
   * ⚠ THE ANTI-MIRROR ARM, AND IT IS THE ONE THAT CAUGHT THE SIBLING. Until
   * #958 both workflows carried byte-identical copies of the path list, and
   * `review.yml`'s decides whether the reviewer reads CLAUDE.md IN FULL — so
   * widening one and not the other leaves a diff the gate calls money getting
   * the shallow reading. Neither workflow may declare its own: both source the
   * single file, and a local `MONEY…=` assignment in either reddens here.
   */
  it("both workflows source the one declaration and neither keeps a copy", () => {
    for (const [name, yml] of [
      ["gate.yml", gateYml],
      ["review.yml", reviewYml],
    ] as const) {
      expect(yml, `${name} must source .github/money-surfaces.sh`).toContain(
        ". ./.github/money-surfaces.sh",
      );
      expect(
        yml,
        `${name} declares its own money pattern — the copy that drifted is exactly what #958 removed`,
      ).not.toMatch(/\n\s*MONEY(_PATHS|_SYMBOLS)?='/);
    }
  });

  /**
   * The reviewer's half of the fix: triage must read the symbols too, or a
   * credit-refund PR the gate labels still reaches the reviewer as an ordinary
   * diff with the charter reading.
   */
  it("review.yml's triage reads both halves, not only the paths", () => {
    expect(reviewYml).toMatch(/git diff -G"\$MONEY_SYMBOLS"/);
    expect(reviewYml).toMatch(/grep -qE "\$MONEY_PATHS" \|\| \[ -n "\$MONEY_SYMBOL_HITS" \]/);
  });

  it("acts on either reading, never only on the first", () => {
    const step = moneyStep();
    expect(step).toMatch(/if \[ -z "\$PATH_HITS" \] && \[ -z "\$SYMBOL_HITS" \]/);
    expect(step).toMatch(/--add-label founder-review/);
  });

  /**
   * The two-dialects arm. `grep -E` and `git diff -G` are POSIX ERE; these
   * arms are JS. Held to the common subset so the second reader is honest.
   */
  it("uses no construct where POSIX ERE and JS RegExp disagree", () => {
    for (const [name, pattern] of [
      ["PATTERNS", PATTERNS],
      ["SYMBOLS", SYMBOLS],
    ] as const) {
      expect(pattern, `${name} must not use a lookaround`).not.toMatch(/\(\?[=!<]/);
      expect(pattern, `${name} must not use a PCRE shorthand class`).not.toMatch(/\\[dwsDWS]/);
      expect(pattern, `${name} must not use a non-greedy quantifier`).not.toMatch(/[*+?]\?/);
    }
  });
});

describe("the path reading — where money is stored and bought", () => {
  it.each([
    "server/routes/billing.ts",
    "server/routes/credits.ts",
    "server/routes/emailAuth.ts",
    "server/routes/googleAuth.ts",
    "server/db/billing.ts",
    "server/db/credits.ts",
    "server/stripe/webhooks.ts",
    "server/_core/sdk.ts",
    "server/_core/cookies.ts",
    "server/security/adminSecurity.ts",
    "shared/const.ts",
    "drizzle/0042_whatever.sql",
  ])("labels %s", (file) => {
    expect(pathRe.test(file)).toBe(true);
  });

  /**
   * ⚠ THE FLOOR, AND IT IS HERE BY NAME ON PURPOSE (#958 recommendation 3).
   * `atomicCredits.ts` is the charge/refund primitive every other caller goes
   * through. A change to its ceiling, its transaction shape or its "a refund
   * that did not record is never reported as you-weren't-charged" law can
   * touch no line naming a primitive at all — so the symbol reading would miss
   * it, and the PATH reading is what closes that. Deleting the alternative on
   * the ground that "casting is covered" reddens here.
   */
  it("labels the credit primitive itself by name, not by the symbols it defines", () => {
    expect(pathRe.test("server/casting/atomicCredits.ts")).toBe(true);
    expect(PATTERNS).toContain("^server/casting/atomicCredits\\.ts$");
  });

  it("a diff touching only the primitive, changing no call line, is still a money diff", () => {
    const changed = ["server/casting/atomicCredits.ts"];
    const diffLines = ["+  const ceiling = 400;", "-  const ceiling = 200;"];
    expect(changed.some((f) => pathRe.test(f))).toBe(true);
    expect(diffLines.some((l) => symbolRe.test(l))).toBe(false);
  });

  it.each([
    "server/casting/promptAuthor.ts",
    "server/castingV2/rollService.ts",
    "server/castingV2/briefCompiler.ts",
    "client/src/features/casting/CastSheet.tsx",
    "docs/architecture/FEATURE_FLAGS.md",
    ".github/workflows/review.yml",
  ])("leaves %s alone", (file) => {
    expect(pathRe.test(file)).toBe(false);
  });
});

describe("the price reading — where money is SET (#1359)", () => {
  /*
    ⚠ THE THIRD SURFACE, AND IT WAS ON NEITHER HALF UNTIL 2026-09-26.

    The path list is *where money is stored and bought*; the symbol list is
    *where money is decided*. **Where money is PRICED was never added** — so a
    change to `rollCandidate: 20`, to `CASTING_V2_ROLL_PRICE_CREDITS`, or to the
    Sign decomposition merged on the gate like a CSS tweak, with no
    `founder-review` label and the charter reading rather than CLAUDE.md in
    full. Road: never covered; `git log -S "castingCreditCosts" -- .github/`
    returns nothing on any branch at any time.

    ⚠ IT HAD NEVER BITTEN, AND THAT IS THE ARGUMENT FOR FIXING IT RATHER THAN
    AGAINST. Every commit that ever touched a price module was caught
    INCIDENTALLY, because a new price ships beside the refund machinery that
    spends it and the symbol half fires for an unrelated reason. A PURE
    repricing has never happened here. Measured over the 60 newest merge commits
    on `main`, the same standard #958 set: 9 of 60 before this widening and
    **9 of 60 after it** — nothing new is labelled, so it costs no reviewer
    attention at all and closes a hole whose first instance would have been a
    repricing.
  */
  it.each([
    "server/casting/castingCreditCosts.ts",
    "server/casting/packagePricing.ts",
    "server/casting/evidence/evidenceCandidateContract.ts",
    "server/wardrobe/creditCosts.ts",
    "server/castingV2/castViewPackage.ts",
    "client/src/features/casting/constants.ts",
    "client/src/features/casting/castingPrices.ts",
  ])("labels %s", (file) => {
    expect(pathRe.test(file)).toBe(true);
  });

  /**
   * THE POSITIVE CONTROL, and it is the arm the card asked for by name: a diff
   * that changes ONLY a price, touching no credit primitive, is a money diff
   * now and was not before. Without the symbol half asserted false here, this
   * arm would pass on a diff the OLD reading already caught, which is the shape
   * that reads as coverage and is not.
   */
  it("a repricing that calls no credit primitive is a money diff", () => {
    const changed = ["server/casting/castingCreditCosts.ts"];
    const diffLines = [
      "-  rollCandidate: 20,",
      "+  rollCandidate: 30,",
      "-export const CASTING_V2_ROLL_PRICE_CREDITS = 160;",
      "+export const CASTING_V2_ROLL_PRICE_CREDITS = 240;",
    ];
    expect(changed.some((f) => pathRe.test(f))).toBe(true);
    expect(diffLines.some((l) => symbolRe.test(l))).toBe(false);
  });

  /**
   * The same, on the CLIENT copy — which is the half that is structurally
   * invisible to the symbol reading, not merely a pattern near-miss. `git diff
   * -G"$MONEY_SYMBOLS"` is scoped `-- server shared` and STAYS so; a `client/`
   * scope would match every client file mentioning a primitive as a substring,
   * which is #958's rejected 17-of-60 widening wearing a different hat. So the
   * two client price files are on the PATH list by name, and this arm holds
   * both facts at once.
   */
  it("the client's own price copy is a money diff, and the symbol scope stays server-only", () => {
    expect(pathRe.test("client/src/features/casting/constants.ts")).toBe(true);

    /*
      ⚠ READ AS A PATHSPEC, NOT AS A SUBSTRING — THE FIRST SHAPE OF THIS ARM WAS
      `toContain(… -- server shared)` AND ITS OWN SABOTAGE WALKED THROUGH IT.
      Appending ` client` to the pathspec leaves the asserted string perfectly
      contained, so the widening this arm exists to refuse passed it green
      (4 of 5 caught, and this was the miss). So the pathspec is EXTRACTED and
      compared whole.
    */
    for (const [name, yml] of [
      ["gate.yml", gateYml],
      ["review.yml", reviewYml],
    ] as const) {
      const m = /git diff -G"\$MONEY_SYMBOLS"[^\n]*? -- ([^|\n]+?)\s*(?:\|\||\)|$)/.exec(yml);
      if (!m) throw new Error(`${name} has no 'git diff -G"$MONEY_SYMBOLS" ... -- <pathspec>' line`);
      expect(
        m[1]!.trim().split(/\s+/),
        `${name}'s symbol reading must stay scoped to server+shared — a client scope matches every `
          + "client file mentioning a primitive as a substring, which is #958's rejected widening. "
          + "The client's price files are on the PATH list by name instead.",
      ).toEqual(["server", "shared"]);
    }
  });

  /**
   * THE NEGATIVE CONTROL. #958 rejected `^server/casting/`, `^server/castingV2/`
   * wholesale at 17 of 60 as too noisy to be read, and that judgement is what
   * this widening must not quietly undo. Named files only: an ordinary casting
   * module beside a price module is still not a money diff.
   */
  it.each([
    "server/casting/promptAuthor.ts",
    "server/casting/refreshSlots.ts",
    "server/castingV2/briefCompiler.ts",
    "server/castingV2/rollService.ts",
    "client/src/features/casting/ControlPanel.tsx",
    "client/src/features/castingV2/briefEcho.ts",
  ])("still leaves %s alone", (file) => {
    expect(pathRe.test(file)).toBe(false);
  });

  /*
    ⚠ THE DRIFT GUARD, DERIVED RATHER THAN TYPED — the same shape as the
    `atomicCredits` one below, pointed at prices.

    A file-path list is precisely the second list working law 4 warns about, and
    the list above is one. So the POPULATION is read out of the Atlas's own
    price collector, which emits every credit number keyed by its declaring
    constant and its module: a price module added tomorrow reddens here instead
    of arriving invisible to the gate on its first day.

    ⚠ THE COLLECTOR DOES NOT TRY TO DEFINE "PRICE" — deliberately, and CLAUDE.md
    records why: inventing a taxonomy is not a mechanical act, so it emits every
    number with its provenance and lets the reader judge. Its list is therefore
    WIDER than this one, and the two numbers that are not prices are excluded BY
    NAME so the exclusion is a decision on the record rather than a regex that
    quietly skips them.
  */
  const NUMBERS_THAT_ARE_NOT_PRICES = new Map([
    [
      "server/castingV2/carriedGeometry.ts",
      "CARRIED_GEOMETRY_COST_NOTE_ABOVE is a log threshold, read as `if (slots.length > it) log.info(...)`. Nobody is charged it.",
    ],
    [
      "server/db/discrepancyQueries.ts",
      "OPERATION_COST_SQL READS costs the ledger already recorded, for the moderator reconciliation. It sets none.",
    ],
  ]);

  it("every module the Atlas says declares a credit number is on the list, or excluded by name", () => {
    const atlas = JSON.parse(read("docs/architecture/drape-architecture.json")) as {
      creditCosts?: { file?: string; module?: string; id?: string }[];
    };
    const rows = atlas.creditCosts ?? [];
    /* A collector that can come up empty reports a complete answer either way. */
    if (rows.length === 0) throw new Error("the Atlas declares no creditCosts — reader broken");

    const modules = [...new Set(rows.map((r) => r.file ?? r.module ?? r.id?.split(":")[1] ?? ""))]
      .filter(Boolean)
      .sort();
    expect(modules.length).toBeGreaterThan(3);

    const missing = modules.filter((m) => !pathRe.test(m) && !NUMBERS_THAT_ARE_NOT_PRICES.has(m));
    expect(
      missing,
      "these modules declare a credit number the Atlas can see, and a diff touching only them "
        + `is not read as money: ${missing.join(", ")}. Add them to MONEY_PATHS, or name them in `
        + "NUMBERS_THAT_ARE_NOT_PRICES with the reason.",
    ).toEqual([]);
  });

  /**
   * And the exclusion list cannot rot into a silencer: a module named there
   * must still exist and must still be absent from the path list, so "excluded
   * because it is not a price" can never come to mean "excluded because
   * somebody added it and forgot to delete the excuse".
   */
  it("each excluded module is real and genuinely off the list", () => {
    for (const [module, reason] of NUMBERS_THAT_ARE_NOT_PRICES) {
      expect(reason.length, `${module} needs a stated reason`).toBeGreaterThan(30);
      expect(() => read(module), `${module} no longer exists, so drop its exclusion`).not.toThrow();
      expect(pathRe.test(module), `${module} is now on MONEY_PATHS, so drop its exclusion`).toBe(false);
    }
  });
});

describe("the symbol reading — where money is decided", () => {
  /**
   * Real lines, taken from the five PRs the path list missed. Not invented
   * fixtures: each is `git diff -U0 <sha>^ <sha> -- server shared` output from
   * the merge commit named beside it.
   */
  it.each([
    ["#924 9da4dfb8", '+        [6, "cr_addCredits", "42"],'],
    ["#874 612c4aaf", "+ * the only exposed window is `recordRefund` or `failVariant`"],
    ["#872 81adfbfc", '+    const { recordRefund } = await import("../casting/atomicCredits");'],
    ["#871 c3bdf01c", '+    const { recordRefund } = await import("../casting/atomicCredits");'],
    ["#866 62d051f3", "+ * `updateGeneration`, `recordRefund`). Any of those leaves a row in whatever"],
  ])("labels the line that shipped unlabelled in PR %s", (_pr, line) => {
    expect(symbolRe.test(line)).toBe(true);
  });

  it.each([
    "+  await deductCredits(userId, cost, ref);",
    "-  await addCredits(userId, amount, ref);",
    "+  return withAtomicCredits(userId, cost, async () => {",
    "+  const ref = refundReferenceFor(chargeReferenceId);",
    "+  await recordRefund(userId, cost, ref);",
  ])("labels a changed line calling the credit API: %s", (line) => {
    expect(symbolRe.test(line)).toBe(true);
  });

  it.each([
    "+  const prompt = composeBrief(seed, clause);",
    "-  await updateGeneration(id, { status: 'ready' });",
    "+  const credits = user.creditBalance;",
    "+  toast.success('Saved');",
  ])("leaves an ordinary changed line alone: %s", (line) => {
    expect(symbolRe.test(line)).toBe(false);
  });
});

describe("the symbol list cannot fall behind the primitive it names (#958)", () => {
  /**
   * THE DRIFT GUARD, and it is derived rather than typed. `atomicCredits.ts`
   * is small and is the primitive: every function it exports that moves or
   * references a customer's money must be a name the gate knows, or a new
   * primitive added there is invisible to the classifier from its first day.
   * `refundTruth` is excluded by the reader below because it formats an
   * outcome and moves nothing — it is named here so the exclusion is a
   * decision on the record rather than a regex that quietly skips it.
   */
  const primitive = readFileSync(path.join(repoRoot, "server/casting/atomicCredits.ts"), "utf8");
  const FORMATTERS_NOT_MOVERS = new Set(["refundTruth"]);

  function exportedFunctions(source: string): string[] {
    const names = [...source.matchAll(/^export (?:async )?function (\w+)/gm)].map((m) => m[1]!);
    if (names.length === 0) throw new Error("atomicCredits.ts exported no functions — reader broken");
    return names;
  }

  it("every mover the credit primitive exports is a name the gate looks for", () => {
    const movers = exportedFunctions(primitive).filter((n) => !FORMATTERS_NOT_MOVERS.has(n));
    expect(movers.length).toBeGreaterThan(0);
    const unknown = movers.filter((n) => !symbolRe.test(n));
    expect(
      unknown,
      `these exports of server/casting/atomicCredits.ts move money and the gate's SYMBOLS list does not name them: ${unknown.join(", ")}`,
    ).toEqual([]);
  });

  it("the two db-level movers the uncovered modules call are named too", () => {
    for (const name of ["addCredits", "deductCredits"]) {
      expect(symbolRe.test(name), `SYMBOLS must name ${name}`).toBe(true);
    }
  });
});
