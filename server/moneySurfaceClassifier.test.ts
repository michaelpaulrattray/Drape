import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { readListedSource } from "./testing/listedSource";
import { once } from "./testing/once";
import { codeOnly, withoutComments } from "./testing/withoutComments";

/* This suite reads every module the Atlas lists (the direct-balance guard) and,
   since #1906, spawns `git ls-files` for the Stripe-write guard, so it is in the
   child-process population (#548) — whose floor equals the contended one (30 s),
   so the class it already carried for the walk is still met. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

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

/**
 * THE DETERMINISTIC WORK IS DONE ONCE; THE POPULATIONS ARE UNTOUCHED (#2172).
 *
 * This suite was 22.4 s of the gate's unit `tests` total, and all of it is
 * repetition rather than breadth: four tree sweeps are each called two or three
 * times by their own arms, so the tree was read and comment-stripped **eleven
 * times**, and the 1.2 MB Atlas document was `JSON.parse`d **seven**. Nothing
 * here mutates anything it reads and `codeOnly`/`withoutComments` are pure
 * character walks, so the second answer can only ever equal the first.
 *
 * ⚠ **WHAT IS SHARED IS THE WORK, NEVER A POPULATION.** Each sweep keeps its
 * own list exactly as it was — the Atlas's modules under two roots or three,
 * `git ls-files` filtered to code — because a shared population is the one
 * change that could make a module invisible to one guard and visible to
 * another, which is what `atlasModulesUnder` was written to prevent (#1711).
 * The cache is keyed on the PATH, so two sweeps that happen to name the same
 * file share the read and the walk and nothing else.
 *
 * ⚠ **A vanished file is still a vanished file.** `null` is cached as `null`,
 * never as empty content, which is `readListedSource`'s own contract (#223).
 */
/** One listed module's bytes and its two strippings, each paid for once. */
type ListedCode = {
  readonly raw: string;
  /** Comments and literal CONTENTS gone — what every symbol reader here asks. */
  readonly code: () => string;
  /** Comments gone, literals kept — what the Stripe import reader asks. */
  readonly withComments: () => string;
};
const listedCodeCache = new Map<string, ListedCode | null>();

/**
 * A listed file's source and strippings, or `null` when the file is gone from
 * the tree between the listing and the read. The strippings are lazy: the
 * import reading is wanted on one sweep's population only, and paying for it
 * everywhere would hand back a third of the saving.
 */
function listedCode(relative: string): ListedCode | null {
  const cached = listedCodeCache.get(relative);
  if (cached !== undefined) return cached;
  const raw = readListedSource(path.join(repoRoot, relative));
  const entry: ListedCode | null =
    raw === null ? null : { raw, code: once(() => codeOnly(raw)), withComments: once(() => withoutComments(raw)) };
  listedCodeCache.set(relative, entry);
  return entry;
}

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

/**
 * The Atlas's own module list, filtered to a root — a derived population rather
 * than a walk of this suite's own invention, so a module cannot be invisible to
 * one guard here and visible to another (#1711).
 *
 * It REFUSES rather than returning a short list: a collector that can come up
 * empty reports a complete answer either way, and every absence arm in this file
 * would pass on silence.
 */
const atlasModuleList = once(() => {
  const atlas = JSON.parse(read("docs/architecture/drape-architecture.json")) as {
    modules?: { path?: string }[];
  };
  return (atlas.modules ?? []).map((module) => module.path ?? "");
});

function atlasModulesUnder(root: RegExp): string[] {
  const modules = atlasModuleList().filter((p) => root.test(p) && !/\.test\.tsx?$/.test(p));
  if (modules.length === 0) {
    throw new Error(`the Atlas lists no module under ${root} — reader broken`);
  }
  return modules.sort();
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
   * ⚠ **EVERY FILE EXTENSION IN THE PATH LIST IS AN ESCAPED DOT — the class,
   * not the instance (#1903 review, "the merge dropped the backslash in
   * `packageRedoService).ts$`").**
   *
   * A bare dot is any character, so `packageRedoService).ts$` also selects
   * `packageRedoServiceXts`. On this list that is harmless today and will not
   * stay harmless by itself: the line is edited by hand on every money card, a
   * three-way merge of two cards touching one 936-character line is exactly how
   * the backslash was lost, and **nothing noticed** — every other arm here asks
   * only whether a REAL file is selected, which both spellings answer the same
   * way. Sabotage proved that: the escape removed again, 129 arms green.
   *
   * So this reads the DECLARATION rather than its effect, which is the only
   * reader that can tell the two apart.
   */
  it("escapes every file extension in the path list", () => {
    const unescaped = [...PATTERNS.matchAll(/[^\\]\.(ts|tsx|mts|sh|json)\$/g)].map((match) => match[0]);
    expect(unescaped, "a bare dot before a file extension matches any character")
      .toEqual([]);
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

/**
 * THE CASH-PRICE READING — WHERE A YEAR'S PRICE IS SET (#1711).
 *
 * ⚠ **THE PRICE HALF OF #1359, ONE UNIT OF CURRENCY OVER.** That repair asked
 * where CREDITS are priced and never asked where CASH is, so
 * `shared/annualBilling.ts` — the one declaration of `ANNUAL_RATE` and of what a
 * year costs for every plan — was on neither half. Both sides import it and its
 * own docblock forbids a second copy, so moving `0.83` to `0.93` reprices every
 * annual subscription in the product, in a one-line diff that no reading sees.
 *
 * **Found by driving it**: PR #1710 touched this module and nothing else, and
 * the gate applied no `founder-review` and triage no `needs-fable`.
 *
 * ⚠ **AND THE DERIVED GUARD ABOVE CANNOT BE REUSED FOR IT, WHICH IS WHY THIS
 * SECTION IS NAMED ARMS RATHER THAN A SECOND POPULATION.** The Atlas's price
 * collector emits CREDIT numbers, and a rate of `0.83` is not one. A name-shaped
 * reader for cash was written and run (recorded in `money-surfaces.sh`): 25
 * modules, of which **eleven are rate LIMITS** — in this tree `RATE` is
 * overwhelmingly a rate-limit word — so a guard built on it is #958's rejected
 * 17-of-60 noise in a different costume. Its output was read by hand instead,
 * and the two arms below are what it bought.
 */
describe("the cash-price reading — where a year's price is SET (#1711)", () => {
  it("labels the module that decides what a year costs", () => {
    expect(pathRe.test("shared/annualBilling.ts")).toBe(true);
  });

  /**
   * THE POSITIVE CONTROL, with the symbol half asserted FALSE beside it — the
   * shape the price section above established, and the only shape that proves
   * the new entry is doing the work rather than riding an older reading.
   */
  it("a diff that moves only the annual rate is a money diff, and the symbol half is blind to it", () => {
    const diffLines = [
      "-export const ANNUAL_RATE = 0.83;",
      "+export const ANNUAL_RATE = 0.93;",
      "-  return Math.round((monthlyInCents * 12 * ANNUAL_RATE) / 100) * 100;",
      "+  return Math.round(monthlyInCents * 12 * ANNUAL_RATE);",
    ];
    expect(pathRe.test("shared/annualBilling.ts")).toBe(true);
    expect(
      diffLines.some((line) => symbolRe.test(line)),
      "a repricing names no credit primitive — if this ever becomes true the arm "
        + "has stopped proving what it claims",
    ).toBe(false);
  });

  /**
   * THE NEGATIVE CONTROL, and it is the measured one rather than an invented
   * one: these are the modules the cash reader actually returned and that were
   * deliberately NOT added, each with its reason in `money-surfaces.sh`. An
   * arm over a plausible-sounding file nobody measured proves nothing; these
   * four are the real candidates a future widening will be tempted by.
   */
  it.each([
    /* `*_USD_PER_IMAGE` is HOUSE cost — what a render costs us, not a customer. */
    "server/providers/falImages.ts",
    "server/providers/falQueue.ts",
    /* `ROLL_PRICE_FALLBACK = 0` is a safe absence; zero cannot misquote upward. */
    "client/src/pages/CastingV2.tsx",
    /* Derives from `annualBilling.ts` and is held to importing rather than
       re-declaring the rate; covering the authority covers it. */
    "client/src/features/settings/planMath.ts",
    /* A rate LIMIT, which is what 11 of the cash reader's 25 hits were. */
    "server/routes/imageProxy.ts",
  ])("still leaves %s alone", (file) => {
    expect(pathRe.test(file)).toBe(false);
  });

  /**
   * ⚠ THE DRIFT GUARD FOR THIS ENTRY, DERIVED FROM THE MODULE ITSELF.
   *
   * The entry above is a path, and a path list is the second list working law 4
   * warns about. There is no Atlas collector for cash, so the derivation
   * available is the other direction: assert that the module this entry names
   * still IS the authority — that it declares the rate and the cents function,
   * and that no other non-test module declares its own `ANNUAL_RATE`. A second
   * declaration appearing elsewhere is both a working-law-4 defect and a new
   * uncovered money surface, and this is the only arm in the tree that would say
   * so from the gate's side.
   */
  it("the module it names still declares the rate, and nothing else declares one", () => {
    const code = codeOnly(read("shared/annualBilling.ts"));
    expect(code, "annualBilling.ts no longer declares ANNUAL_RATE — re-point this entry")
      .toMatch(/export const ANNUAL_RATE\s*=/);
    expect(code, "annualBilling.ts no longer declares what a year costs")
      .toMatch(/export function annualPriceInCents/);

    /*
      The population is the Atlas's own module list across all three roots —
      CLIENT INCLUDED, which is the half that matters: `planMath.ts` is the module
      that carried its own `ANNUAL_RATE` before #664, so the second declaration
      this arm exists to catch has already happened once, there.
    */
    const others = atlasModulesUnder(/^(server|shared|client\/src)\//)
      .filter((file) => file !== "shared/annualBilling.ts")
      .filter((file) => {
        const entry = listedCode(file);
        return entry !== null && /\bconst\s+ANNUAL_RATE\s*=/.test(entry.code());
      });
    expect(
      others,
      "a second module declares its own ANNUAL_RATE. That is working law 4 — the "
        + "drift annualBilling.ts was created to end — AND a money surface outside "
        + "MONEY_PATHS. Make it import the shared one, or add it to the list: "
        + others.join(", "),
    ).toEqual([]);
  });
});

/**
 * THE THIRD POSITION IN THE SENTENCE — where a refund is DECIDED BY A BRANCH
 * (#1622).
 *
 * The symbol reading below matches a diff that adds or removes a LINE naming a
 * primitive. It cannot see a diff that changes the CONTROL FLOW deciding
 * whether an existing refund line is ever REACHED, and `money-surfaces.sh`
 * carries the measurement that settled what to do about it.
 */
describe("the refund-decision reading — a branch that decides WHETHER (#1622)", () => {
  /**
   * `packageOrchestrator.ts` holds `await (dependencies.refund ?? recordRefund)(…)`
   * inside its per-view failure path. It is on the list BY NAME on the same
   * argument `atomicCredits.ts` is: it decides whether the refund primitive is
   * called at all for a signed view, and it can do that while touching no call
   * line.
   */
  it("the module that decides whether a signed view is refunded is a money diff", () => {
    expect(pathRe.test("server/castingV2/packageOrchestrator.ts")).toBe(true);
  });

  /**
   * THE NEGATIVE CONTROL, AND IT IS THE WHOLE ARGUMENT FOR THE ENTRY ABOVE.
   *
   * Real lines, copied from `git diff -U0 origin/main...` on PR #1621 — the
   * change that rewrote the branch above that refund. Not one of them names a
   * primitive, so the symbol half was silent and the PR's triage comment read
   * *"An ordinary diff"*. If this arm ever goes green because a line here
   * started matching, the path entry is no longer what is catching this class
   * and the reasoning above wants re-reading.
   */
  const SPECIMEN_LINES_PR_1621 = [
    "-        lastReason = conformanceReason(failedAxes, verdict);",
    "+  viewConformanceRefuses,",
    "-import { conformanceProvenance, type ViewConformanceJudge, type ViewConformanceVerdict } from \"./viewConformance\";",
  ];

  it("the symbol half cannot see that change, which is why the path entry exists", () => {
    for (const line of SPECIMEN_LINES_PR_1621) {
      expect(symbolRe.test(line), `${line} — the symbol half was believed blind to this`).toBe(false);
    }
  });

  /*
    ⚠ THE REMAINDER, DERIVED RATHER THAN TYPED — the same shape as the price
    guard above, pointed at the refund adjudicators.

    Adding all of them was MEASURED at 17 of 60 merged PRs, the exact rate #958
    rejected for `paths + whole casting dirs`, so the bulk widening was declined
    and these 18 stay off the list. That is a stated remainder, not a closed
    hole — and the thing a stated remainder must not do is GROW in silence.

    So the population is read out of the Atlas's own import graph: every module
    that reaches `server/casting/atomicCredits.ts`. A new adjudicator reddens
    here on its first day and has to be either put on MONEY_PATHS or named
    below with the decision. The Atlas is the right reader rather than a grep:
    `refineRefundLedger.ts` MENTIONS `recordRefund` in a docblock and calls
    nothing, and a text search counts it.
  */
  const CREDIT_PRIMITIVE = "module:server/casting/atomicCredits.ts";
  const ADJUDICATORS_OFF_THE_LIST = new Set([
    "server/casting/evidence/evidencePackageExecution.ts",
    "server/casting/evidence/inkCandidateGeneration.ts",
    "server/casting/mintPackage.ts",
    "server/casting/operationRecovery.ts",
    "server/castingV2/refineRecovery.ts",
    "server/castingV2/refineService.ts",
    "server/castingV2/retryRecovery.ts",
    "server/castingV2/retryService.ts",
    "server/castingV2/rollRecovery.ts",
    "server/castingV2/rollService.ts",
    "server/castingV2/signRecovery.ts",
    "server/castingV2/signService.ts",
    "server/castingV2/viewRetryRecovery.ts",
    "server/castingV2/viewRetryService.ts",
    "server/lib/boardOps.ts",
    "server/routes/generation/castingImaging.ts",
    "server/routes/generation/castingRefinement.ts",
    "server/routes/wardrobe.ts",
  ]);

  function adjudicators(): string[] {
    const atlas = JSON.parse(read("docs/architecture/drape-architecture.json")) as {
      edges?: { from?: string; to?: string; kind?: string }[];
    };
    const reaching = (atlas.edges ?? [])
      .filter((e) => e.kind === "imports" && e.to === CREDIT_PRIMITIVE)
      .map((e) => (e.from ?? "").replace(/^module:/, ""))
      .filter((m) => /^(server|shared)\//.test(m) && !/\.test\.tsx?$/.test(m));
    /* A collector that can come up empty reports a complete answer either way. */
    if (reaching.length === 0) {
      throw new Error(`the Atlas records no importer of ${CREDIT_PRIMITIVE} — reader broken`);
    }
    return [...new Set(reaching)].sort();
  }

  it("every module that reaches the credit primitive is on the list or a stated remainder", () => {
    const missing = adjudicators()
      .filter((m) => !pathRe.test(m) && !ADJUDICATORS_OFF_THE_LIST.has(m));
    expect(
      missing,
      "these modules reach the credit primitive and a diff touching only them is not read as "
        + `money: ${missing.join(", ")}. Add them to MONEY_PATHS, or name them in `
        + "ADJUDICATORS_OFF_THE_LIST — and re-measure the 60-PR rate before widening in bulk.",
    ).toEqual([]);
  });

  /**
   * And the remainder cannot rot into a silencer: an entry must still exist,
   * must still reach the primitive, and must still be absent from the path
   * list — so "left off deliberately" can never come to mean "left off and
   * forgotten".
   */
  it("each stated remainder is real, still an adjudicator, and genuinely off the list", () => {
    const reaching = new Set(adjudicators());
    for (const module of ADJUDICATORS_OFF_THE_LIST) {
      expect(() => read(module), `${module} no longer exists, so drop it`).not.toThrow();
      expect(reaching.has(module), `${module} no longer reaches the primitive, so drop it`).toBe(true);
      expect(pathRe.test(module), `${module} is now on MONEY_PATHS, so drop it`).toBe(false);
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

/**
 * THE FOURTH POSITION IN THE SENTENCE — where a balance is WRITTEN DIRECTLY,
 * with no primitive in sight (#1662).
 *
 * After where money is DECIDED (the symbol half), where it is SET (the price
 * modules) and where a refund is DECIDED BY A BRANCH (#1622), one shape was
 * still invisible to both halves: a module that reaches past the credit
 * primitive and writes `credits.balance` and the ledger itself.
 *
 * `server/db/admin.ts`'s `adjustUserCredits` is the specimen and it is not an
 * obscure one — it is the "adjust any" cell of `CLAUDE.md`'s capability grid,
 * the one write in the product that moves a customer's credits on a staff
 * decision. It names none of the symbols below and sat two files away from
 * `^server/db/(billing|credits)\.ts$` on the path half.
 *
 * ⚠ ITS SIBLING SHIPPED IN THE SAME COMMIT, because the class is the fix and
 * the instance is not (working law 7). `server/db/accountDeletion.ts` deletes a
 * customer's whole ledger and their credits row inside the GDPR deletion. Its
 * ROUTE (`server/routes/auth.ts`) was already read as money; the module holding
 * the statements was not.
 */
describe("the direct-balance reading — a module that writes the ledger itself (#1662)", () => {
  it.each([
    ["server/db/admin.ts", "adjustUserCredits — the capability grid's 'adjust any'"],
    ["server/db/accountDeletion.ts", "deletes the customer's credits row and ledger"],
  ])("%s is a money diff (%s)", (file) => {
    expect(pathRe.test(file)).toBe(true);
  });

  /**
   * THE NEGATIVE CONTROL. `server/db/` holds forty-odd modules and most of them
   * are casting reads; `money-surfaces.sh` says NAMED FILES, NEVER DIRECTORIES
   * and this widening must not quietly become the directory.
   */
  it.each([
    "server/db/connection.ts",
    "server/db/moderatorQueries.ts",
    "server/db/discrepancyQueries.ts",
    "server/db/castingV2.ts",
    "server/db/ipBlocking.ts",
  ])("still leaves %s alone", (file) => {
    expect(pathRe.test(file)).toBe(false);
  });

  /**
   * AND THE WHOLE ARGUMENT FOR THE TWO ENTRIES ABOVE: the symbol half cannot
   * see these writes. Real lines, copied from `server/db/admin.ts` and
   * `server/db/accountDeletion.ts` at the commit that added them to the list.
   * If an arm here ever goes green because a line started matching, the path
   * entries are no longer what catches this class and the reasoning wants
   * re-reading.
   */
  const SPECIMEN_LINES_DIRECT_WRITES = [
    "          .update(credits)",
    "            creditsPurchased: sql`${credits.creditsPurchased} + ${amount}`,",
    "      await tx.insert(creditTransactions).values({",
    "        .delete(creditTransactions)",
    "        .delete(credits)",
    '      if (newBalance < 0) {',
  ];

  it.each(SPECIMEN_LINES_DIRECT_WRITES)("the symbol half is blind to %s", (line) => {
    expect(symbolRe.test(line)).toBe(false);
  });

  /*
    ⚠ THE DRIFT GUARD, DERIVED RATHER THAN TYPED — the third of its kind in this
    file, after the price modules and the refund adjudicators, and pointed at the
    writers.

    The POPULATION is every module the Atlas lists under `server/` or `shared/`,
    and the reading is a non-comment `.update`/`.insert`/`.delete` of the
    `credits` or `creditTransactions` tables. A module that starts writing a
    balance directly tomorrow reddens here instead of arriving invisible to the
    gate on its first day.

    ⚠ COMMENTS ARE STRIPPED AND THAT IS LOAD-BEARING, NOT HYGIENE — the arm
    below proves it with the specimen that measured it. `server/db/connection.ts`
    carries `await tx.update(credits).set({ balance: 100 })` as a docblock
    EXAMPLE of how to use the transaction helper. A raw text reader counts it and
    reports a fifth writer that writes nothing, and the repair for a false
    positive is normally to add an exclusion — which would have put a real
    module's name on a silencer list for a defect in the reader.

    ⚠ NO EXCLUSION MAP, DELIBERATELY. The other two guards carry one because they
    have real remainders; all four writers here are on the list, so an empty map
    would buy a rot arm that can only pass. A writer that genuinely moves no
    customer money gets its reason in the failure message's own words, and the
    map is written on the day it has an entry.
  */
  const DIRECT_BALANCE_WRITE = /\.\s*(?:update|insert|delete)\s*\(\s*(?:credits|creditTransactions)\s*\)/;

  function atlasModules(): string[] {
    const modules = atlasModuleList().filter(
      (p) => /^(server|shared)\//.test(p) && !/\.test\.tsx?$/.test(p),
    );
    /* A collector that can come up empty reports a complete answer either way. */
    if (modules.length === 0) {
      throw new Error("the Atlas lists no server/ or shared/ module — reader broken");
    }
    return modules;
  }

  /* Three arms ask this, and the tree does not change between them (#2172). */
  const directBalanceWriters = once((): string[] => {
    const writers: string[] = [];
    for (const module of atlasModules()) {
      /* A listed path can be gone from a shared working tree between the Atlas
         being written and this read; a vanished file is skipped, never empty. */
      const entry = listedCode(module);
      if (entry === null) continue;
      if (DIRECT_BALANCE_WRITE.test(entry.code())) writers.push(module);
    }
    return writers.sort();
  });

  it("the reader finds the writers everybody already agrees about", () => {
    const writers = directBalanceWriters();
    expect(writers).toContain("server/db/credits.ts");
    expect(writers).toContain("server/db/billing.ts");
    expect(writers.length).toBeGreaterThanOrEqual(3);
  });

  it("the reader does not count a docblock example as a writer", () => {
    const entry = listedCode("server/db/connection.ts");
    if (entry === null) throw new Error("server/db/connection.ts is gone — re-aim this control");
    const source = entry.raw;
    expect(
      DIRECT_BALANCE_WRITE.test(source),
      "server/db/connection.ts no longer carries the docblock example this control is built on — "
        + "find another comment-only specimen or this arm proves nothing",
    ).toBe(true);
    expect(DIRECT_BALANCE_WRITE.test(entry.code())).toBe(false);
    expect(directBalanceWriters()).not.toContain("server/db/connection.ts");
  });

  it("every module that writes a balance or the ledger directly is read as money", () => {
    const missing = directBalanceWriters().filter((m) => !pathRe.test(m));
    expect(
      missing,
      "these modules write the credits table or the ledger directly, name no credit primitive, "
        + `and a diff touching only them is not read as money: ${missing.join(", ")}. Add each to `
        + "MONEY_PATHS by name — or, if it genuinely moves no customer money, say so here with the "
        + "reason and re-measure the 60-PR rate before widening in bulk.",
    ).toEqual([]);
  });
});

/**
 * THE SIXTH POSITION IN THE SENTENCE — where a staff money action is
 * AUTHORISED (#1719).
 *
 * #1662 added the module that WRITES a customer's balance on a staff decision
 * (`server/db/admin.ts`, `adjustUserCredits`). The road that AUTHORISES that
 * write was in nobody's population: the route, the two gates it asks before the
 * compare-and-swap, the dispatch map that decides the approval executes at all,
 * and the mapping that decides what the executor is handed.
 *
 * `money-surfaces.sh` carries the whole measurement, the two readers the law-7
 * sweep used, and the six exclusions by name with their reasons.
 */
describe("the authorisation reading — where a staff money action is APPROVED (#1719)", () => {
  it.each([
    ["shared/changeRequestApproval.ts", "declares CREDIT_AMOUNT as the approval requirement"],
    ["server/routes/admin/changeRequests.ts", "the route that authorises, and asks both gates"],
    ["server/lib/adminActions/approvalStateBlocker.ts", "the second gate — HAS_BALANCE (#991)"],
    ["server/lib/adminActions/approvalExecution.ts", "decides what the executor is handed"],
    ["server/lib/adminActions/changeRequestActions.ts", "decides whether the primitive is called"],
    ["shared/changeRequestLabels.ts", "the dispatch map, and the definition of sensitive"],
  ])("%s is a money diff (%s)", (file) => {
    expect(pathRe.test(file)).toBe(true);
  });

  /**
   * THE POSITIVE CONTROL, and it is the card's own: a diff that removes
   * `CREDIT_AMOUNT` from `add_credits` lets a staff member approve a credit
   * grant with NO AMOUNT recorded on the request. The lines are real, copied
   * from `shared/changeRequestApproval.ts`.
   *
   * ⚠ THE SYMBOL HALF IS ASSERTED FALSE BESIDE IT — the shape every entry in
   * this file since the price reading has used, and the only shape that proves
   * the new entry is doing the work rather than riding an older reading.
   */
  it("a diff that drops the amount requirement is a money diff, and the symbol half is blind to it", () => {
    const diffLines = [
      "-  add_credits: [CREDIT_AMOUNT],",
      "-  refund_credits: [CREDIT_AMOUNT],",
      "+  add_credits: [],",
      "+  refund_credits: [],",
    ];
    expect(pathRe.test("shared/changeRequestApproval.ts")).toBe(true);
    expect(
      diffLines.some((line) => symbolRe.test(line)),
      "dropping the approval requirement names no credit primitive — if this ever "
        + "becomes true the arm has stopped proving what it claims",
    ).toBe(false);
  });

  /**
   * AND THE DISPATCH MAP, where the symbol half's coverage turned out to be an
   * ACCIDENT OF SPELLING — measured here rather than assumed, because the first
   * version of this arm claimed blindness and went red.
   *
   * `CHANGE_REQUEST_ACTION_BY_TYPE` routes `add_credits` to `"cr_addCredits"`,
   * and that string CONTAINS `addCredits`, so `git diff -G` fires on a diff that
   * DELETES the row. It does not fire on:
   *
   *  - **re-pointing that same row** (`"cr_addCredits"` → `"cr_refundCredits"`),
   *    which is the worse of the two defects: a staff grant runs the refund
   *    executor instead, and the panel's warning still reads correctly.
   *  - **anything at all on the `refund_credits` row**, whose action name
   *    contains none of the five symbols.
   *
   * So the file's own warning — the symbol reading matches a SUBSTRING, PR
   * #924's hit being the fixture string `cr_addCredits` — is what was covering
   * this road, for one of its two rows, by luck. Rename the executor action to
   * `cr_grantCredits` and that coverage disappears with nothing going red. The
   * path entry is what makes it deliberate.
   */
  it("the symbol half covers the dispatch map's add row by SUBSTRING LUCK, and nothing else on it", () => {
    expect(pathRe.test("shared/changeRequestLabels.ts")).toBe(true);
    /* The accident, asserted so that losing it is visible rather than silent. */
    expect(
      symbolRe.test('-  add_credits: "cr_addCredits",'),
      "the executor action no longer contains a credit primitive as a substring — the "
        + "symbol half has stopped covering even this row, and the path entry is now the "
        + "only reading. Correct, but re-read this arm's reasoning.",
    ).toBe(true);
    /* And the three shapes it cannot see, which is what the path entry is for. */
    for (const line of [
      '+  add_credits: "cr_refundCredits",',
      '-  refund_credits: "cr_refundCredits",',
      '+  refund_credits: "cr_stripeRefund",',
    ]) {
      expect(symbolRe.test(line), `the symbol half unexpectedly sees: ${line}`).toBe(false);
    }
  });

  /**
   * THE OTHER FOUR MODULES' OWN POSITIVE CONTROLS, in one arm: the real decision
   * lines, none of which names a credit primitive. The path entries are the only
   * reading that sees any of them.
   */
  it("the gates and the params mapping are money diffs the symbol half cannot see", () => {
    for (const [file, line] of [
      ["server/lib/adminActions/approvalStateBlocker.ts", "-  add_credits: [HAS_BALANCE],"],
      [
        "server/lib/adminActions/approvalExecution.ts",
        "-  if (request.creditAmount) params.creditAmount = request.creditAmount;",
      ],
      ["server/routes/admin/changeRequests.ts", "-        const blocker = changeRequestApprovalBlocker(request);"],
    ] as const) {
      expect(pathRe.test(file)).toBe(true);
      expect(symbolRe.test(line), `the symbol half unexpectedly sees: ${line}`).toBe(false);
    }
  });

  /**
   * THE NEGATIVE CONTROLS, and they are the MEASURED candidates rather than
   * invented ones: every one of these was returned by the law-7 sweep's wide
   * reader and deliberately not added, with its reason in `money-surfaces.sh`.
   * An arm over a plausible-sounding file nobody measured proves nothing.
   */
  it.each([
    /* The CREATION road, not the authorisation road — and the whole moderator
       surface would come with it. */
    "server/routes/moderator.ts",
    /* Keys by type to choose an icon, a colour and the modal's copy, and DERIVES
       SENSITIVE_TYPES from the shared map. Authorises nothing. */
    "client/src/features/admin/ChangeRequestConstants.tsx",
    /* Reads audit rows for the alerts feed. */
    "server/db/adminOverviewQueries.ts",
    /* Audit action NAMES. */
    "shared/auditActions.ts",
    "shared/auditActionCategories.ts",
    /* A comment naming the two refund roads. */
    "shared/productEventCatalogue.ts",
    /* The barrel the route imports the dispatch map THROUGH — it re-exports and
       decides nothing, and NAMED FILES NEVER DIRECTORIES is this file's rule. */
    "server/lib/adminActions/index.ts",
  ])("still leaves %s alone", (file) => {
    expect(pathRe.test(file)).toBe(false);
  });

  /**
   * ⚠ THE ENTRIES STILL NAME THE AUTHORITIES — the #1711 arm's shape, pointed at
   * six modules instead of one. A path list is the second list working law 4
   * warns about, so each entry is held to the declaration that earned it: an
   * entry whose subject MOVED is an entry guarding nothing, and it would pass a
   * `pathRe.test()` arm forever.
   */
  it("each module it names still carries the decision it was added for", () => {
    const approval = codeOnly(read("shared/changeRequestApproval.ts"));
    expect(approval, "changeRequestApproval.ts no longer declares the requirements map")
      .toMatch(/export const CHANGE_REQUEST_APPROVAL_REQUIREMENTS/);
    expect(approval, "add_credits no longer requires an amount — re-read this entry")
      .toMatch(/add_credits:\s*\[CREDIT_AMOUNT\]/);
    expect(approval, "refund_credits no longer requires an amount — re-read this entry")
      .toMatch(/refund_credits:\s*\[CREDIT_AMOUNT\]/);

    /* ⚠ `withoutComments`, NOT `codeOnly`, and the difference is load-bearing:
       `codeOnly` drops a literal's CONTENTS by design, so the map reads
       `add_credits: ,` through it and an assertion about the action NAME can
       only fail. Measured — this arm went red on exactly that before it was
       re-pointed. Comments are stripped by both, which is all this needs. */
    const labels = withoutComments(read("shared/changeRequestLabels.ts"));
    expect(labels, "changeRequestLabels.ts no longer declares the dispatch map")
      .toMatch(/export const CHANGE_REQUEST_ACTION_BY_TYPE/);
    expect(labels, "the dispatch map no longer routes add_credits")
      .toMatch(/add_credits:\s*"cr_addCredits"/);

    const state = codeOnly(read("server/lib/adminActions/approvalStateBlocker.ts"));
    expect(state, "approvalStateBlocker.ts no longer gates the two credit types")
      .toMatch(/add_credits:\s*\[HAS_BALANCE\]/);

    const route = codeOnly(read("server/routes/admin/changeRequests.ts"));
    expect(route, "the route no longer asks the approval blocker — this entry has moved")
      .toMatch(/changeRequestApprovalBlocker\(request\)/);
    expect(route, "the route no longer dispatches through CHANGE_REQUEST_ACTION_BY_TYPE")
      .toMatch(/CHANGE_REQUEST_ACTION_BY_TYPE/);

    const params = codeOnly(read("server/lib/adminActions/approvalExecution.ts"));
    expect(params, "approvalExecution.ts no longer decides the amount the executor is handed")
      .toMatch(/params\.creditAmount\s*=\s*request\.creditAmount/);

    /* `withoutComments` again, and for the same reason as the dispatch map: the
       executor is selected by a STRING case label, which `codeOnly` empties. */
    const executors = withoutComments(read("server/lib/adminActions/changeRequestActions.ts"));
    expect(executors, "the staff credit executors have moved out of changeRequestActions.ts")
      .toMatch(/case "cr_addCredits"/);
    expect(executors, "the refund executor has moved out of changeRequestActions.ts")
      .toMatch(/case "cr_refundCredits"/);
  });

  /*
    ⚠ THE DRIFT GUARD, DERIVED — the fourth of its kind in this file, after the
    price modules, the refund adjudicators and the direct writers.

    THE READER IS THE NARROW ONE OF THE SWEEP'S TWO, and `money-surfaces.sh`
    records why the wide one is not shipped: naming a money-moving
    change-request type returns TWELVE modules, half of them audit-action names
    and catalogue prose, and a guard built on that is noise a shift learns to
    ignore. This reads for a map KEYED BY one of those types — a DECISION TABLE
    rather than a mention — and returns FOUR across all three roots.

    ⚠ THE POPULATION IS THE ATLAS'S, CLIENT INCLUDED, and the client half is the
    half that matters: the one module the reader returns that is NOT on the list
    is a client file, and a server-only population would hide its own false
    positive — which is the thing that tells you the reader is reading.

    ⚠ COMMENTS ARE STRIPPED. No production module carries the key shape inside a
    comment today, so unlike #1662's docblock specimen this cannot be driven on a
    tree file; the arm below drives the predicate over a CONSTRUCTED source
    instead and says so, rather than claiming a measured control it does not have.
  */
  const TYPE_KEYED_DECISION = /^[ \t]*(?:add_credits|refund_credits|stripe_refund)[ \t]*:/m;

  /**
   * The one module the reader returns that is deliberately off the list, with
   * the reason that will be read when this arm next fails. An exclusion map
   * rather than a lowered floor: a new entry here is a decision somebody wrote
   * down, and `money-surfaces.sh` carries the same reason at length.
   */
  const NOT_AUTHORISATION: Readonly<Record<string, string>> = {
    "client/src/features/admin/ChangeRequestConstants.tsx":
      "keys by type for an icon, a colour and the modal's copy; derives SENSITIVE_TYPES "
      + "from the shared map rather than declaring one. It authorises nothing.",
  };

  /* Three arms ask this, and the tree does not change between them (#2172). */
  const typeKeyedDeciders = once((): string[] => {
    const found: string[] = [];
    for (const module of atlasModulesUnder(/^(server|shared|client\/src)\//)) {
      /* A listed path can be gone from a shared working tree between the Atlas
         being written and this read; a vanished file is skipped, never empty. */
      const entry = listedCode(module);
      if (entry === null) continue;
      if (TYPE_KEYED_DECISION.test(entry.code())) found.push(module);
    }
    return found.sort();
  });

  it("the reader finds the decision tables everybody already agrees about", () => {
    const found = typeKeyedDeciders();
    expect(found).toContain("shared/changeRequestApproval.ts");
    expect(found).toContain("shared/changeRequestLabels.ts");
    expect(found).toContain("server/lib/adminActions/approvalStateBlocker.ts");
  });

  it("the reader does not count a module that merely NAMES a type", () => {
    /* `shared/auditActions.ts` declares `STRIPE_REFUND_ISSUED:
       "billing.stripe_refund_issued"` — the type name is in both the key and the
       value as a SUBSTRING, and neither is a key equal to the type. This is the
       measured specimen that a looser reader would have counted. */
    const entry = listedCode("shared/auditActions.ts");
    if (entry === null) throw new Error("shared/auditActions.ts is gone — re-aim this control");
    expect(
      /stripe_refund/.test(entry.raw),
      "shared/auditActions.ts no longer mentions stripe_refund — this control proves nothing now",
    ).toBe(true);
    expect(TYPE_KEYED_DECISION.test(entry.code())).toBe(false);
    expect(typeKeyedDeciders()).not.toContain("shared/auditActions.ts");
  });

  it("the reader strips comments, driven on a constructed source", () => {
    /* ⚠ NOT a docblock: a ` * ` continuation line can never match this reader,
       which anchors on whitespace alone — the first version of this arm used one
       and went red for that reason. A commented-out BLOCK is the shape that
       genuinely would match raw, and is what a reader without stripping counts. */
    const commentedOut = [
      "/*",
      "  The map used to read:",
      "  add_credits: [CREDIT_AMOUNT],",
      "*/",
      "export const NOTHING = 1;",
    ].join("\n");
    expect(
      TYPE_KEYED_DECISION.test(commentedOut),
      "the raw text must match, or this arm is not testing the stripping",
    ).toBe(true);
    expect(TYPE_KEYED_DECISION.test(codeOnly(commentedOut))).toBe(false);
  });

  it("every module that decides on a money change-request type is read as money", () => {
    const missing = typeKeyedDeciders()
      .filter((module) => !pathRe.test(module))
      .filter((module) => !(module in NOT_AUTHORISATION));
    expect(
      missing,
      "these modules declare a decision table keyed by add_credits / refund_credits / "
        + `stripe_refund, and a diff touching only them is not read as money: ${missing.join(", ")}. `
        + "Add each to MONEY_PATHS by name — or, if it decides nothing about whether the money "
        + "action is authorised or what it moves, add it to NOT_AUTHORISATION above with the "
        + "reason, and put the same reason in money-surfaces.sh.",
    ).toEqual([]);
  });

  it("each stated exclusion is real, still keyed by a type, and genuinely off the list", () => {
    for (const [module, reason] of Object.entries(NOT_AUTHORISATION)) {
      expect(reason.length, `${module}'s exclusion carries no reason`).toBeGreaterThan(40);
      const entry = listedCode(module);
      expect(entry, `${module} is excluded but is not in the tree — drop the entry`).not.toBeNull();
      expect(
        TYPE_KEYED_DECISION.test(entry?.code() ?? ""),
        `${module} no longer keys by a change-request type, so excluding it guards nothing`,
      ).toBe(true);
      expect(pathRe.test(module), `${module} is both excluded and on the list`).toBe(false);
    }
  });
});

/**
 * THE EIGHTH POSITION IN THE SENTENCE — code that writes to STRIPE from outside
 * the product (#1906).
 *
 * `scripts/ceremony-topup-prices-1606.mts` creates and archives the LIVE top-up
 * prices on launch day. PR #1839 changed it and nothing else, and neither half
 * fired: no path entry under `scripts/`, and the symbol half is scoped
 * `-- server shared` and names credit primitives rather than Stripe calls. It
 * was held only because a reviewer read it by hand.
 *
 * `money-surfaces.sh` carries the measurement, the sweep and why the directory
 * was declined.
 */
describe("the Stripe-write reading — code that changes what Stripe holds (#1906)", () => {
  const CEREMONY = "scripts/ceremony-topup-prices-1606.mts";

  it("the live top-up price ceremony is a money diff", () => {
    expect(pathRe.test(CEREMONY)).toBe(true);
  });

  it("the spent-share product ceremony is a money diff too (#2023)", () => {
    expect(pathRe.test("scripts/ceremony-spent-share-product-2023.mts")).toBe(true);
    expect(pathRe.test("scripts/ceremony-spent-share-product-2023.mts.bak")).toBe(false);
  });

  /**
   * THE NEGATIVE CONTROL — `scripts/` holds ~600 tracked files and this entry
   * must not quietly become the directory (`money-surfaces.sh`: NAMED FILES,
   * NEVER DIRECTORIES). Real neighbours, including other ceremonies and the
   * merge tool that READS this very declaration.
   */
  it.each([
    "scripts/ceremony-extend-sheet-window-1464.mts",
    "scripts/ceremony-crew-replies.mts",
    "scripts/lib/ceremony.mts",
    "scripts/lib/prMergeOrder.mts",
    "scripts/pr-merge-in-order.mts",
    "scripts/ceremony-topup-prices-1606.mts.bak",
    "scripts/old/ceremony-topup-prices-1606.mts",
  ])("still leaves %s alone", (file) => {
    expect(pathRe.test(file)).toBe(false);
  });

  /**
   * AND THE WHOLE ARGUMENT FOR THE ENTRY: the symbol half is blind to these
   * lines even where it would look. Real lines, from the ceremony at the commit
   * that added it to the list.
   */
  it.each([
    "    const p = await stripe.prices.create({ product, currency: \"usd\", unit_amount: w.cents, lookup_key: w.lookupKey });",
    "  for (const p of oldOnes) { await stripe.prices.update(p.id, { active: false }); }",
    "  if (!product) product = (await stripe.products.create({ name: \"Klieg Credit Top-up\" })).id;",
  ])("the symbol half is blind to %s", (line) => {
    expect(symbolRe.test(line)).toBe(false);
  });

  it("both workflows still scope the symbol half away from scripts/, which is why the path entry exists", () => {
    for (const [name, yml] of [["gate.yml", gateYml], ["review.yml", reviewYml]] as const) {
      const scopes = [...yml.matchAll(/git diff -G"\$MONEY_SYMBOLS"[^\n]*? -- ([^|\n]+?)\s*\|\|/g)]
        .map((m) => m[1]!.trim().split(/\s+/));
      expect(scopes.length, `${name} no longer runs the symbol half — re-read this arm`).toBeGreaterThan(0);
      for (const scope of scopes) expect(scope).not.toContain("scripts");
    }
  });

  /*
    ⚠ THE DRIFT GUARD, DERIVED RATHER THAN TYPED — the card's own second option,
    *"match any file that calls Stripe price create/archive"*, widened to the
    class: any code that holds a Stripe client or calls a Stripe write.

    ⚠ THE POPULATION IS `git ls-files`, NOT THE ATLAS. The Atlas scans
    `server`, `client/src`, `shared` and `drizzle` and lists no module under
    `scripts/` at all, so an Atlas-derived population here would be EMPTY on the
    one directory this card is about — the silence this file's readers refuse.

    ⚠ COMMENTS AND STRING CONTENTS ARE STRIPPED (`codeOnly`) for the call and
    constructor readings, because the sabotage drives under `scripts/` carry
    real call lines inside find/replace STRINGS and a docblock in
    `stripePriceCatalogue.ts` quotes `stripe.prices.create`. The import reading
    needs the specifier, so it reads `withoutComments` and only a line that
    BEGINS an import statement.
  */
  const STRIPE_CLIENT = /\bnew\s+Stripe\s*\(/;
  const STRIPE_VALUE_IMPORT =
    /(?:^|\n)[ \t]*import\s+(?!type\b)[^;]*?\bfrom\s*["']stripe["']|\brequire\(\s*["']stripe["']\s*\)|\bimport\(\s*["']stripe["']\s*\)/;
  const STRIPE_WRITE =
    /\.\s*(?:prices|products|coupons|promotionCodes|subscriptions|subscriptionItems|subscriptionSchedules|refunds|customers|paymentIntents|invoices|invoiceItems|plans|paymentLinks|creditNotes|taxRates|checkout\s*\.\s*sessions|billingPortal\s*\.\s*sessions)\s*\.\s*(?:create|update|del|cancel|resume|release|expire|pay|voidInvoice|finalizeInvoice)\s*\(/;

  function writesToStripe(source: string): boolean {
    const code = codeOnly(source);
    return STRIPE_CLIENT.test(code) || STRIPE_WRITE.test(code) || STRIPE_VALUE_IMPORT.test(withoutComments(source));
  }

  /** The same question of a file already read, off the shared strippings. */
  function entryWritesToStripe(entry: ListedCode): boolean {
    const code = entry.code();
    return STRIPE_CLIENT.test(code) || STRIPE_WRITE.test(code) || STRIPE_VALUE_IMPORT.test(entry.withComments());
  }

  /* Two sweeps walk this list and five arms ask them, so the `ls-files` process
     ran five times for one answer that cannot change under them (#2172). */
  const trackedCodeFiles = once((): string[] => {
    const listed = execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
      .split("\0")
      .filter((p) => /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/.test(p))
      .filter((p) => !/\.test\.[cm]?[jt]sx?$/.test(p) && !/(?:^|\/)node_modules\//.test(p));
    /* A collector that can come up empty reports a complete answer either way. */
    if (!listed.some((p) => p.startsWith("scripts/")) || !listed.some((p) => p.startsWith("server/"))) {
      throw new Error("git ls-files returned no scripts/ or no server/ code — reader broken");
    }
    return listed;
  });

  const stripeWriters = once((): string[] => {
    const writers: string[] = [];
    for (const file of trackedCodeFiles()) {
      const entry = listedCode(file);
      if (entry === null) continue;
      if (entryWritesToStripe(entry)) writers.push(file);
    }
    return writers.sort();
  });

  it("the reader is driven on constructed sources, both directions", () => {
    expect(writesToStripe("await stripe.prices.update(id, { active: false });")).toBe(true);
    expect(writesToStripe("const s = await stripe.checkout.sessions.create({});")).toBe(true);
    expect(writesToStripe("const stripe = new Stripe(key);")).toBe(true);
    expect(writesToStripe('import Stripe from "stripe";\nexport const x = 1;')).toBe(true);
    /* Comment-only, string-only, type-only, and a read — none is a writer. */
    expect(writesToStripe("/** a plan change called `stripe.prices.create` */\nexport const x = 1;")).toBe(false);
    expect(writesToStripe("// await stripe.prices.create({})\nexport const x = 1;")).toBe(false);
    expect(writesToStripe('const find = "await stripe.subscriptions.cancel(id)";')).toBe(false);
    expect(writesToStripe('import type Stripe from "stripe";\nexport const x = 1;')).toBe(false);
    expect(writesToStripe("const all = await stripe.prices.list({ limit: 100 });")).toBe(false);
  });

  it("the reader finds the Stripe writers everybody already agrees about, and the ceremony", () => {
    const writers = stripeWriters();
    expect(writers).toContain("server/stripe/stripeService.ts");
    expect(writers).toContain("server/security/deleteUserData.ts");
    expect(writers).toContain(CEREMONY);
  });

  it("every tracked file that writes to Stripe is read as money", () => {
    const missing = stripeWriters().filter((file) => !pathRe.test(file));
    expect(
      missing,
      "these files hold a Stripe client or call a Stripe write, and a diff touching only them "
        + `is not read as money: ${missing.join(", ")}. Add each to MONEY_PATHS by name, with its `
        + "entry in money-surfaces.sh — never `^scripts/`, which #1906 measured and declined.",
    ).toEqual([]);
  });

  /*
    ⚠ AND A FILE CAN REACH STRIPE WITHOUT EVER HOLDING A CLIENT (#2006). The
    readers above see `new Stripe(`, a `stripe` value import and a direct
    `.x.create/update/del(` call. A script that imports `issueStripeRefund`,
    `updateSubscriptionPlan` or `scheduleSubscriptionChange` from
    `server/stripe/` and calls it does none of the three, so a diff touching
    only it would pass unlabelled. The population therefore widens to every
    tracked code file that IMPORTS from `server/stripe/`, whatever it calls.

    The specifier is read from `withoutComments` (it is a string, and `codeOnly`
    blanks it), and a match counts only when the SAME LINE of `codeOnly` still
    carries the keyword that introduces it — `from`, `import` or `import(` /
    `require(` — so an import quoted inside a find/replace string is not an
    importer. Both outputs keep every newline, which is what makes the line a
    shared coordinate. A type-only import is erased at compile time, moves no
    money, and is not counted.
  */
  const STATIC_IMPORT =
    /(?:^|\n)[ \t]*(?:import|export)\s+(type\s+)?[\w\s{},*$]*?\bfrom\s*["']([^"']+)["']/g;
  const BARE_IMPORT = /(?:^|\n)[ \t]*import\s*["']([^"']+)["']/g;
  const DYNAMIC_IMPORT = /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g;

  /** Every module specifier `file` really imports, resolved to a repo path where it is relative. */
  function importedPaths(file: string, source: string): string[] {
    return importedPathsOf(file, withoutComments(source), codeOnly(source));
  }

  /** The same reading off strippings already paid for (#2172). */
  function importedPathsOf(file: string, kept: string, code: string): string[] {
    const codeLines = code.split("\n");
    const lineOf = (offset: number) => codeLines[kept.slice(0, offset).split("\n").length - 1] ?? "";
    const resolve = (spec: string) =>
      spec.startsWith(".") ? path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)) : spec;
    const found: string[] = [];
    for (const m of kept.matchAll(STATIC_IMPORT)) {
      if (m[1]) continue; // `import type` / `export type`
      const at = m.index! + m[0].lastIndexOf(m[2]!);
      if (/\bfrom\b/.test(lineOf(at))) found.push(resolve(m[2]!));
    }
    for (const m of kept.matchAll(BARE_IMPORT)) {
      const at = m.index! + m[0].lastIndexOf(m[1]!);
      if (/\bimport\b/.test(lineOf(at))) found.push(resolve(m[1]!));
    }
    for (const m of kept.matchAll(DYNAMIC_IMPORT)) {
      if (/\b(?:import|require)\s*\(/.test(lineOf(m.index!))) found.push(resolve(m[1]!));
    }
    return found;
  }

  const reachesStripeHelper = (file: string, source: string) =>
    importedPaths(file, source).some((p) => /^server\/stripe\//.test(p));

  const entryReachesStripeHelper = (file: string, entry: ListedCode) =>
    importedPathsOf(file, entry.withComments(), entry.code()).some((p) => /^server\/stripe\//.test(p));

  /*
    The two server modules that import a `server/stripe/` helper and are NOT on
    MONEY_PATHS on the day this arm landed. A STATED REMAINDER, not a verdict:
    #2006's scope forbade editing `money-surfaces.sh` (PR #1924 was open on it),
    so both were reported on the PR for the relay to decide.
     - `server/_core/index.ts` mounts `handleStripeWebhook` behind
       `express.raw()` — the route every Stripe grant arrives through.
     - `server/routes/moderator.ts` reads `getSessionChargedAmountCents` to
       derive the amount a filed Stripe refund request carries.
  */
  const STRIPE_IMPORTERS_OFF_THE_LIST = new Set([
    "server/_core/index.ts",
    "server/routes/moderator.ts",
  ]);

  const stripeHelperImporters = once((): string[] => {
    const importers: string[] = [];
    for (const file of trackedCodeFiles()) {
      const entry = listedCode(file);
      if (entry === null) continue;
      if (entryReachesStripeHelper(file, entry)) importers.push(file);
    }
    return importers.sort();
  });

  it("the importer reader is driven on constructed sources, both directions", () => {
    const script = "scripts/refund-everyone.mts";
    /* Positive: the card's own shape — static, multi-line, dynamic, require, re-export, namespace. */
    expect(reachesStripeHelper(script, 'import { issueStripeRefund } from "../server/stripe/stripeService";\nawait issueStripeRefund(x);')).toBe(true);
    expect(reachesStripeHelper(script, 'import {\n  updateSubscriptionPlan,\n  scheduleSubscriptionChange,\n} from "../server/stripe/stripeService";')).toBe(true);
    expect(reachesStripeHelper(script, 'const { issueStripeRefund } = await import("../server/stripe/stripeService");')).toBe(true);
    expect(reachesStripeHelper(script, 'const s = require("../server/stripe/stripeService");')).toBe(true);
    expect(reachesStripeHelper(script, 'export { issueStripeRefund } from "../server/stripe/stripeService";')).toBe(true);
    expect(reachesStripeHelper("server/lib/x.ts", 'import * as s from "../stripe/stripeService";')).toBe(true);
    /* Negative: an unrelated server module, type-only, a comment, a string, lookalike paths. */
    expect(reachesStripeHelper(script, 'import { getDb } from "../server/db/connection";')).toBe(false);
    expect(reachesStripeHelper(script, 'import type { PlanChange } from "../server/stripe/stripeService";')).toBe(false);
    expect(reachesStripeHelper(script, '// import { issueStripeRefund } from "../server/stripe/stripeService";\nexport const x = 1;')).toBe(false);
    expect(reachesStripeHelper(script, 'const find = \'await import("../server/stripe/stripeService")\';')).toBe(false);
    expect(reachesStripeHelper(script, 'const fixture = `\nimport { issueStripeRefund } from "../server/stripe/stripeService";\n`;')).toBe(false);
    expect(reachesStripeHelper(script, 'import { x } from "../server/stripeish/thing";')).toBe(false);
    expect(reachesStripeHelper("server/lib/x.ts", 'import { x } from "./stripe/thing";')).toBe(false);
  });

  it("the importer reader finds the importers everybody already agrees about, and the ceremony", () => {
    const importers = stripeHelperImporters();
    expect(importers).toContain(CEREMONY);
    expect(importers).toContain("server/routes/billing.ts");
    expect(importers).toContain("server/lib/adminActions/changeRequestActions.ts");
    /* A neighbouring ceremony that imports server code but nothing under server/stripe/. */
    expect(importers).not.toContain("scripts/ceremony-r7-founder-evidence.mts");
  });

  it("every tracked file that imports a server/stripe helper is read as money, or a stated remainder", () => {
    const missing = stripeHelperImporters()
      .filter((file) => !pathRe.test(file) && !STRIPE_IMPORTERS_OFF_THE_LIST.has(file));
    expect(
      missing,
      "these files import from server/stripe/ and a diff touching only them is not read as money: "
        + `${missing.join(", ")}. Add each to MONEY_PATHS by name, with its entry in money-surfaces.sh `
        + "— never `^scripts/`, which #1906 measured and declined.",
    ).toEqual([]);
  });

  it("each stated importer remainder is real, still an importer, and genuinely off the list", () => {
    const importers = new Set(stripeHelperImporters());
    for (const file of STRIPE_IMPORTERS_OFF_THE_LIST) {
      expect(() => read(file), `${file} no longer exists, so drop it`).not.toThrow();
      expect(importers.has(file), `${file} no longer imports from server/stripe/, so drop it`).toBe(true);
      expect(pathRe.test(file), `${file} is now on MONEY_PATHS, so drop it`).toBe(false);
    }
  });
});

/**
 * THE NINTH POSITION IN THE SENTENCE — where a PRICE is DECIDED BY A BRANCH
 * (#2068).
 *
 * A Try again on an unchecked view is free once, then a purchase. The price is
 * DECLARED in `castViewPackage.ts` / `castingCreditCosts.ts`, both on the list;
 * whether a customer PAYS it is decided in two modules that were on neither
 * half — the free-ask fact (has this view had its free ask?) and
 * `castSlotRetryOffer` (so what does the button show and the till charge?).
 *
 * `money-surfaces.sh` carries the measurement (27 → 28 of 60, 65 → 67 of 200,
 * with the reader checked against the gate's own labels first) and the sweep.
 *
 * ⚠ **THE FREE/PAID BRANCH THIS ENTRY WAS ABOUT IS GONE — #1903 slice 3, ONE
 * DAY after the entry landed — AND BOTH FILES STAY ON THE LIST.** His ruling
 * retired the free Try again, so the free-ask filter is deleted and
 * `castSlotRetryOffer` has no free branch to choose between. What each file
 * decides about money did not stop; it narrowed, and the arms below are
 * re-driven on what survives:
 *
 * - `castingV2ViewRetry.ts` still holds the readers a REFUND is decided from,
 *   `viewReplacementInFlight` among them — the one that defers a redo's refund
 *   while a picture can still arrive (#1924).
 * - `castProjection.ts` still decides whether there is a price AT ALL: a
 *   delivered view offers nothing, a refunded one offers the Try again price.
 *
 * **The entry is narrowed rather than removed, which is the opposite of what a
 * green suite would have suggested**: deleting it because its original specimen
 * died would take two refund-deciding modules off the money gate.
 */
describe("the free-or-paid reading — a branch that decides WHETHER she pays (#2068)", () => {
  it.each([
    ["server/db/castingV2ViewRetry.ts", "the readers a refund is decided from, deferral included"],
    ["server/castingV2/castProjection.ts", "castPackageRedoOffer and castSlotRetryOffer — whether a button carries a price, and the till re-reads it"],
  ])("%s is a money diff (%s)", (file) => {
    expect(pathRe.test(file)).toBe(true);
  });

  /**
   * THE SPECIMEN, and the whole argument for the entry: PR #2067 (card #1943)
   * rewrote the free/paid predicate and NEITHER HALF FIRED. Its changed files
   * and its predicate lines are real — `git diff` of the squash commit against
   * its parent. The path half must now fire on it, and on THIS entry alone, or
   * the arm is passing on a neighbour the old reading already caught.
   */
  const SPECIMEN_FILES_PR_2067 = [
    "server/casting/directOperation.ts",
    "server/castingV2/viewRetryNoFreeAsk.test.ts",
    "server/db/castingV2ViewRetry.ts",
    "server/directOperationProductEvents.test.ts",
  ];
  /* ⚠ The removed predicate line itself (`ne(generationOperations.status,
     CLAIMED_OPERATION_STATUS)`) is NOT quoted as a string here: this suite also
     calls `execFileSync`, and a `.status` token in its code makes
     `server/testing/hookDriver.test.ts` read it as a suite that drives a child
     and reads its exit status, which it does not. The lines kept are real. */
  const SPECIMEN_LINES_PR_2067 = [
    "-import { and, eq, inArray, isNull, ne } from \"drizzle-orm\";",
    "+import { and, eq, inArray, isNotNull, isNull } from \"drizzle-orm\";",
    "-const CLAIMED_OPERATION_STATUS = \"claimed\";",
    "+    isNotNull(generationOperations.heartbeatAt),",
  ];

  it("the PR that rewrote the free/paid predicate is a money diff now, by this entry alone", () => {
    expect(SPECIMEN_FILES_PR_2067.filter((file) => pathRe.test(file)))
      .toEqual(["server/db/castingV2ViewRetry.ts"]);
    for (const line of SPECIMEN_LINES_PR_2067) {
      expect(symbolRe.test(line), `the symbol half unexpectedly sees: ${line}`).toBe(false);
    }
  });

  /**
   * DRIVEN, NOT ASSERTED AGAINST A CONSTANT: the entry is held to the decision
   * that earned it. The real `castSlotRetryOffer` is asked about ONE unchecked
   * slot twice, and the only thing that differs is the free-ask fact — so the
   * price a customer is charged is decided inside this module. If that ever
   * stops being true the entry is guarding nothing and this arm says so.
   */
  it("castProjection.ts really decides the price: no per-view ask on any slot, and the redo's price only when she is ready", async () => {
    const { castPackageRedoOffer, castSlotRetryOffer } = await import("./castingV2/castProjection");
    const PAID = 1234;
    /*
      ⚠ THIS ARM DROVE THE FREE/PAID PAIR UNTIL #1903 SLICE 3, THEN DELIVERED
      vs REFUNDED UNTIL #2089 (his *"regenerate is the only option"*,
      2026-10-08). `castSlotRetryOffer` now answers null for every slot — a
      refunded one included — and the entrance refuses on that null, so the
      price-deciding branch that keeps this file on the list is the redo's:
      `castPackageRedoOffer` puts a price on the button when she is ready and
      none while she is building. Both functions are driven, because the
      retirement is itself a money decision made in this module.
    */
    const delivered = { state: "ready", refundedCredits: null } as never;
    const refunded = { state: "failed-refunded", refundedCredits: 200 } as never;
    expect(castSlotRetryOffer(delivered, PAID)).toBeNull();
    expect(castSlotRetryOffer(refunded, PAID)).toBeNull();
    const slots = [{}, {}] as never;
    expect(castPackageRedoOffer({ status: "ready", slots }, PAID)).toEqual({ priceCredits: PAID });
    expect(castPackageRedoOffer({ status: "building", slots }, PAID)).toBeNull();
    /* The injected price is neither of the product's own numbers, so a branch
       reaching for a constant cannot pass here by coincidence. */
    expect(PAID).toBe(1234);
  });

  /**
   * And the other half, driven the same way — at the SQL the module really
   * sends, never at a constant beside it (invariant 5).
   *
   * ⚠ **IT DROVE THE FREE-ASK FILTER UNTIL #1903 SLICE 3 and now drives
   * `runningViewRetryFilter`, which is the reader a REFUND turns on.** Both
   * `viewReplacementInFlight` (defer a redo's refund while a picture can still
   * land, #1924) and `listRunningViewRetryAngles` (what the room draws as busy)
   * read it, so loosening one clause here refunds a customer for a view she is
   * about to receive. That is the same kind of fact the deleted filter was, on
   * the same money path, in the same file.
   */
  it("castingV2ViewRetry.ts really decides whether a replacement is still in flight", async () => {
    const { MySqlDialect } = await import("drizzle-orm/mysql-core");
    const { runningViewRetryFilter } = await import("./db/castingV2ViewRetry");
    const filter = runningViewRetryFilter({ userId: 7, modelId: 11 });
    if (!filter) throw new Error("runningViewRetryFilter returned no condition");
    const query = new MySqlDialect().sqlToQuery(filter);
    /* The owner and the Cast are both in the WHERE (invariant 1), and the
       statuses it admits are the in-flight pair rather than a single literal. */
    expect(query.params).toEqual(expect.arrayContaining([7, 11]));
    expect(query.params).toEqual(expect.arrayContaining(["claimed", "running"]));
  });

  /**
   * THE NEGATIVE CONTROLS, and they are the measured neighbours: the specimen's
   * other files, the spending road that is a stated remainder of #1622, and
   * lookalike paths. NAMED FILES, NEVER DIRECTORIES.
   */
  it.each([
    "server/casting/directOperation.ts",
    "server/castingV2/viewRetryService.ts",
    "server/castingV2/viewRetryFreeOnce.test.ts",
    "server/castingV2/castProjection.test.ts",
    "server/db/castingV2ViewRetry.ts.bak",
    /* `server/db/castingV2Sign.ts` stood here and LEFT it with #2127: it now writes a
       refused sheet's share to the ledger, so it is on MONEY_PATHS. A lookalike
       keeps the anchoring arm this entry was for. */
    "server/db/castingV2Signing.ts",
  ])("still leaves %s alone", (file) => {
    expect(pathRe.test(file)).toBe(false);
  });
});
