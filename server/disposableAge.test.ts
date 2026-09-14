/**
 * THE READING THAT REPLACES AN MTIME — driven (#526).
 *
 * Working law 2: a new reader gets a negative control and a positive control
 * before its verdicts count for anything. That bar is sharper than usual here,
 * because **the thing this reader replaces failed silently in the direction
 * nobody complains about**: every mtime reset says "too new, keep it", so the
 * population can only grow and no instrument anywhere goes red. Run 3 found it
 * only by reading a record run 2 had preserved on purpose.
 *
 * So the arms below are written the other way round from the usual: for each
 * of the four conditions that make a file sweepable, there is an arm proving
 * that **removing that one condition alone flips the verdict to KEEP**. A
 * reader that dropped a condition would otherwise pass a suite that only ever
 * checked the happy path — and dropping a condition here deletes somebody's
 * working file.
 *
 * The pure readers are driven directly with fixture strings rather than
 * against the disk: the population is untracked scratch that differs on every
 * machine and every hour, so a suite that read it would be asserting against
 * a moving target.
 */
import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  agedOut, chainSweep, citationsFrom, internalCitationLines, nameAnchorOf, sweepable,
  sweptSet, untrackedDisposables, untrackedUnderScripts, verdictOf,
  type Verdict,
} from "../scripts/disposable-age.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* The subject imports `execFileSync` (git and gh), so this file is in #548's
   derived population one hop out — even though the arms below drive only the
   pure readers. Declaring the floor is cheaper and more honest than arguing
   that today's arms happen not to spawn: tomorrow's might. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-09T00:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

describe("untrackedDisposables — the population, and only the population", () => {
  const PORCELAIN = [
    "?? scripts/_429-plan-disposable.mts",
    "?? scripts/court-fixture-plate-disposable.mts",
    "?? scripts/_briefing-e88-disposable.mts",
    /* NOT disposables: an untracked helper the team means to keep. */
    "?? scripts/lib/sabotage.mts",
    "?? scripts/_429-notes.md",
    /* NOT under scripts/. */
    "?? output/_500-frames-disposable.mts",
    "?? 692-evidence-dark.png",
    /* NOT untracked — a staged add and a modification. */
    "A  scripts/_777-staged-disposable.mts",
    " M scripts/deploy-rite.mts",
  ].join("\n");

  it("takes every untracked disposable under scripts/", () => {
    expect(untrackedDisposables(PORCELAIN)).toEqual([
      "scripts/_429-plan-disposable.mts",
      "scripts/court-fixture-plate-disposable.mts",
      "scripts/_briefing-e88-disposable.mts",
    ]);
  });

  it("NEGATIVE CONTROL — a tracked, staged or non-disposable file is never in it", () => {
    const got = untrackedDisposables(PORCELAIN);
    /* Each of these is a way a real sweep could have eaten a file that is not
       litter: a staged new script, a modified tracked one, an untracked lib. */
    expect(got).not.toContain("scripts/_777-staged-disposable.mts");
    expect(got).not.toContain("scripts/deploy-rite.mts");
    expect(got).not.toContain("scripts/lib/sabotage.mts");
    expect(got).not.toContain("scripts/_429-notes.md");
    expect(got).not.toContain("output/_500-frames-disposable.mts");
  });

  it("reads a quoted path — git quotes any name it considers unusual", () => {
    expect(untrackedDisposables('?? "scripts/_1-a b-disposable.mts"'))
      .toEqual(["scripts/_1-a b-disposable.mts"]);
  });

  it("DROPS a C-quoted name rather than half-decoding it, and names it", () => {
    /*
      PR #693 review, finding 4. git C-escapes the body of a quoted path
      (`\"`, `\\`, octal for non-ASCII). Stripping the quotes alone yields a
      path that does not exist, and the `statSync` in `read()` then crashes the
      whole run with a message that does not say why. Dropping it is the
      fail-safe direction: a file that is never in the population can never be
      swept, and the run says the name out loud.
    */
    const escaped = String.raw`?? "scripts/_1-od\303\251-disposable.mts"`;
    const got = untrackedUnderScripts(escaped);
    expect(got.paths).toEqual([]);
    expect(got.undecodable).toHaveLength(1);
    expect(untrackedDisposables(escaped)).toEqual([]);
  });

  it("lists every untracked path under scripts/, not only the disposables", () => {
    /* The citation sweep needs ALL of them (review finding 2): an untracked
       keeper naming a disposable is a citation, and `scripts/lib/sabotage.mts`
       is exactly that shape. */
    const got = untrackedUnderScripts(PORCELAIN);
    expect(got.paths).toEqual([
      "scripts/_429-plan-disposable.mts",
      "scripts/court-fixture-plate-disposable.mts",
      "scripts/_briefing-e88-disposable.mts",
      "scripts/lib/sabotage.mts",
      "scripts/_429-notes.md",
    ]);
    expect(got.undecodable).toEqual([]);
  });
});

describe("nameAnchorOf — what artifact does the name point at", () => {
  it("reads a card number", () => {
    expect(nameAnchorOf("scripts/_429-plan-disposable.mts")).toEqual({ kind: "card", id: 429 });
    expect(nameAnchorOf("scripts/_7_probe-disposable.mts")).toEqual({ kind: "card", id: 7 });
  });

  it("reads a briefing edition in the shape the reader was born with", () => {
    expect(nameAnchorOf("scripts/_briefing-e88-disposable.mts")).toEqual({ kind: "edition", id: 88 });
  });

  it("reads the edition shapes shifts ACTUALLY write (#973)", () => {
    /* The reader's edition anchor was the single literal `_briefing-e<N>`, which
       matched TWO files in the live population while 27 others carried a
       readable edition and fell into the permanent-KEEP bucket. Every name here
       was in `scripts/` on the day this arm was written. */
    expect(nameAnchorOf("scripts/_edition99337-disposable.mts")).toEqual({ kind: "edition", id: 99337 });
    expect(nameAnchorOf("scripts/_edition99061-disposable.py")).toEqual({ kind: "edition", id: 99061 });
    expect(nameAnchorOf("scripts/_foreman-edition99354-disposable.mts")).toEqual({ kind: "edition", id: 99354 });
    expect(nameAnchorOf("scripts/_janitor5-edition99353-disposable.mts")).toEqual({ kind: "edition", id: 99353 });
    expect(nameAnchorOf("scripts/_shift99093-briefing-e99096-disposable.mts")).toEqual({ kind: "edition", id: 99096 });
  });

  it("a name carrying BOTH a card number and an edition number resolves by the CARD (#973)", () => {
    /* The widening must not silently re-date these. It cannot: the edition
       pattern is anchored at `^_` with an optional `[a-z]+\d*-` prefix, so it
       can never begin with digits, and these resolve by the card whichever order
       the two lines are tested in. That was DRIVEN rather than assumed — the
       draft of #973 claimed these matched both shapes and inverted the order to
       protect them; swapping the order back left this arm green, which is how
       the claim was caught. The arm stays as the pin on the real behaviour. */
    expect(nameAnchorOf("scripts/_9155-edition99179-disposable.mts")).toEqual({ kind: "card", id: 9155 });
    expect(nameAnchorOf("scripts/_9921-edition99393-disposable.mts")).toEqual({ kind: "card", id: 9921 });
    expect(nameAnchorOf("scripts/_9412-edition-disposable.mts")).toEqual({ kind: "card", id: 9412 });
  });

  it("NEGATIVE CONTROL — the widening did not reach a name that only LOOKS like an edition (#973)", () => {
    /* This is the arm that stops the fix trading hoarding for deletion. Each of
       these was in the live population beside the 24 that now resolve, and each
       would be dated at an artifact it has nothing to do with by a looser
       pattern — `_court177-…` most of all, which is a court and not an edition. */
    for (const name of [
      "scripts/_court99177-briefing-edit-disposable.py",
      "scripts/_court99177-grid-disposable.mts",
      "scripts/_shift99101-court-mouth-disposable.mts",
      "scripts/_9381b-edition-disposable.py",
      "scripts/_shift99191-edition-disposable.py",
      "scripts/_briefing-e99076b-disposable.mts",
      "scripts/_edition-disposable.mts",
    ]) expect(nameAnchorOf(name), name).toBeNull();
  });


  it("NEGATIVE CONTROL — a name it cannot read anchors at NOTHING, never at a guess", () => {
    /* Every one of these is in the live population, and every one of them must
       stay: `_read-…`, `_probe-…`, `court-…`, `_shift93-…`. A reader that
       invented an anchor for any of them would be deleting a working file. */
    for (const name of [
      "scripts/_read-rows-disposable.mts",
      "scripts/_probe-wall-disposable.mts",
      "scripts/court-fixture-plate-disposable.mts",
      "scripts/_shift93-tables-disposable.mts",
      "scripts/_-disposable.mts",
    ]) expect(nameAnchorOf(name), name).toBeNull();
  });

  it("refuses a number too long to be a card in this repository", () => {
    /* Five digits is a date or a pixel width, not an issue. The reader keeps
       what it cannot name, so a wrong guess here is the expensive direction. */
    expect(nameAnchorOf("scripts/_20260830-sweep-disposable.mts")).toBeNull();
  });
});

describe("citationsFrom — a KEEP is a citation", () => {
  const POPULATION = [
    "scripts/_429-plan-disposable.mts",
    "scripts/_430-other-disposable.mts",
    "scripts/court-fixture-plate-disposable.mts",
  ];

  it("POSITIVE CONTROL — finds the tracked file that names one", () => {
    const grep = [
      "docs/specs/INK_COURT.md:12:the strip was built by `scripts/court-fixture-plate-disposable.mts`",
      "docs/JANITOR_LOG.md:400:| `scripts/_429-plan-disposable.mts` | kept |",
    ].join("\n");
    const found = citationsFrom(grep, POPULATION);
    expect(found.get("scripts/court-fixture-plate-disposable.mts")).toEqual(["docs/specs/INK_COURT.md"]);
    expect(found.get("scripts/_429-plan-disposable.mts")).toEqual(["docs/JANITOR_LOG.md"]);
  });

  it("NEGATIVE CONTROL — a line naming a DIFFERENT disposable is not a citation of this one", () => {
    /* The failure this catches is the one that would matter: a substring pass
       that credited `_43-…` with `_430-…`'s citation, or credited every file
       on the line to every file in the population. */
    const found = citationsFrom(
      "docs/x.md:1:see scripts/_430-other-disposable.mts for the arm",
      POPULATION,
    );
    expect(found.get("scripts/_430-other-disposable.mts")).toEqual(["docs/x.md"]);
    expect(found.get("scripts/_429-plan-disposable.mts")).toBeUndefined();
    expect(found.get("scripts/court-fixture-plate-disposable.mts")).toBeUndefined();
  });

  it("counts one citing file once however many times it names the file", () => {
    const found = citationsFrom([
      "docs/x.md:1:scripts/_429-plan-disposable.mts",
      "docs/x.md:9:scripts/_429-plan-disposable.mts again",
      "docs/y.md:2:scripts/_429-plan-disposable.mts",
    ].join("\n"), POPULATION);
    expect(found.get("scripts/_429-plan-disposable.mts")).toEqual(["docs/x.md", "docs/y.md"]);
  });

  it("THE WALK ITSELF reads untracked NON-disposables, not just the population", () => {
    /*
      ⚠ THE ARM THAT WAS MISSING, AND ITS ABSENCE WAS FOUND BY A SABOTAGE.
      Narrowing the walk back to the disposables alone reddened NOTHING: the
      arm below drives `citationsFrom`, which does not care which list fed it,
      so the helper was proven and the CALL SITE was not — `derive-adds-a-hop`,
      arriving inside the repair for the reviewer's finding 2.

      This drives the walk with an injected reader and asserts on the FILES IT
      ASKED FOR, which is the only thing a narrowing changes.
    */
    const asked: string[] = [];
    const lines = internalCitationLines(
      ["scripts/_429-plan-disposable.mts", "scripts/lib/sabotage.mts", "scripts/gone.mts"],
      (file) => {
        asked.push(file);
        if (file === "scripts/gone.mts") return null;
        return file === "scripts/lib/sabotage.mts"
          ? 'import { arm } from "../_429-plan-disposable.mts";'
          : "// nothing here";
      },
    );
    expect(asked, "the keeper must be WALKED, not merely allowed").toContain("scripts/lib/sabotage.mts");
    expect(asked).toHaveLength(3);
    expect(lines).toEqual([
      'scripts/lib/sabotage.mts:0:import { arm } from "../_429-plan-disposable.mts";',
    ]);
  });

  it("and `read()` HANDS IT the wide list — the argument, not just the walker", () => {
    /*
      ⚠ THE SECOND HALF, AND IT WAS ALSO FOUND BY A SABOTAGE RATHER THAN BY
      THINKING. Extracting the walk made the arm above possible, and swapping
      the ARGUMENT back to `population` inside `read()` STILL reddened nothing:
      the walker is proven, the call that feeds it is not. `read()` needs a real
      repository with real untracked files, which a unit suite cannot have
      deterministically — so the call site is asserted at the source, which is
      thin but is the only reading here that can fail.

      This is the whole `derive-adds-a-hop` lesson in one arm: sabotage the
      helper, AND assert its arguments.
    */
    const source = readFileSync(
      path.join(path.resolve(__dirname, ".."), "scripts/disposable-age.mts"),
      "utf8",
    );
    expect(source).toMatch(/internalCitationLines\(\s*untracked\s*,/);
    expect(source, "`population` is the NARROW list — feeding it here is the defect")
      .not.toMatch(/internalCitationLines\(\s*population\s*,/);
    /* And the wide list must genuinely be the wide one where it is built. */
    expect(source).toMatch(/const \{ paths: untracked, undecodable \} = untrackedUnderScripts\(porcelain\)/);
  });

  it("POSITIVE CONTROL — an untracked NON-disposable keeper counts as a citation", () => {
    /*
      PR #693 review, finding 2, and it is this PR's own class one shape over.
      The first cut folded in only the POPULATION's text, so an untracked file
      the team keeps — `scripts/lib/sabotage.mts` is exactly that shape, and it
      is in this file's own fixture — was invisible to both readers. A keeper
      importing a disposable would have left that disposable at zero citations
      and reported it sweepable. The excluded set is empty now rather than
      merely narrower, which is the only version of this fix that ends.
    */
    const found = citationsFrom(
      'scripts/lib/sabotage.mts:0:import { arm } from "../_429-plan-disposable.mts";',
      POPULATION,
    );
    expect(found.get("scripts/_429-plan-disposable.mts")).toEqual(["scripts/lib/sabotage.mts"]);
  });

  it("POSITIVE CONTROL — sees the population's own INTERNAL edges", () => {
    /*
      The reader folds each untracked disposable's own text into the same
      `path:line:text` shape, because `git grep` reads tracked files only.
      Measured live before that existed: of 131 sweep candidates, 3 were named
      by files being KEPT — `_327-max-author-read` by `_466-authorread` and
      `_477-court-read`, `_327-strip` by `_477-strip`, `_briefing-e81` by
      `_patch195l` — and all 3 would have been deleted from under a script
      that still names them. Twelve scripts were restored for this same hole
      during the original purge.
    */
    const found = citationsFrom(
      "scripts/_430-other-disposable.mts:0:import x from \"./_429-plan-disposable.mts\";",
      POPULATION,
    );
    expect(found.get("scripts/_429-plan-disposable.mts")).toEqual(["scripts/_430-other-disposable.mts"]);
  });

  it("NEGATIVE CONTROL — a file naming ITSELF is not cited", () => {
    /* Every one of these scripts prints its own name in its own header, so
       without the self-exclusion the whole population reads as cited and the
       sweep can never fire — the hoarding failure this card is about, arriving
       through the repair for it. */
    const found = citationsFrom(
      "scripts/_429-plan-disposable.mts:0: * npx tsx scripts/_429-plan-disposable.mts",
      POPULATION,
    );
    expect(found.get("scripts/_429-plan-disposable.mts")).toBeUndefined();
  });

  it("is empty when git grep matched nothing at all", () => {
    expect(citationsFrom("", POPULATION).size).toBe(0);
  });
});

describe("sweepable — four conditions, and dropping ANY ONE must flip it to KEEP", () => {
  /*
    THE ARM SHAPE THAT MATTERS. Each case below is the sweepable base with
    exactly one condition spoiled, so a reader that stopped checking that
    condition passes every other arm in this file and fails only here. This is
    the deletion decision; a suite that only proved the happy path would be
    green over a reader that deletes a cited file, an open card's file, or a
    file somebody edited this morning.
  */
  const base: Verdict = {
    file: "scripts/_429-plan-disposable.mts",
    anchor: { kind: "card", id: 429, at: ago(30), note: "#429 closed" },
    citations: [],
    mtime: ago(30),
  };

  it("sweeps when all four hold", () => {
    expect(sweepable(base, 7, NOW)).toBe(true);
  });

  it("KEEPS a file a tracked document cites, however old", () => {
    expect(sweepable({ ...base, citations: ["docs/specs/A_COURT.md"] }, 7, NOW)).toBe(false);
  });

  it("KEEPS a file whose name resolves to nothing", () => {
    expect(sweepable({ ...base, anchor: { kind: "none", note: "unresolved" } }, 7, NOW)).toBe(false);
  });

  it("KEEPS a file whose artifact is inside the window", () => {
    expect(sweepable({ ...base, anchor: { kind: "card", id: 429, at: ago(3), note: "" } }, 7, NOW)).toBe(false);
  });

  it("KEEPS a file somebody has touched inside the window, even with an old artifact", () => {
    /* The mtime can only ever HOLD A DELETION BACK — the mass reset made files
       look newer, never older — so requiring it to agree costs nothing and
       protects the case where an old card's script is being reused today. */
    expect(sweepable({ ...base, mtime: ago(1) }, 7, NOW)).toBe(false);
  });

  it("respects a wider window", () => {
    expect(sweepable(base, 7, NOW)).toBe(true);
    expect(sweepable(base, 60, NOW)).toBe(false);
  });

  it("is `agedOut` plus the citation test, and nothing else — the split cannot drift", () => {
    /* `chainSweep` reuses `agedOut` for the three file-side conditions. If
       `sweepable` ever grew a fourth condition of its own, the chain verdict
       would sweep files the plain verdict refuses; this pins the two to one
       definition. */
    expect(agedOut(base, 7, NOW)).toBe(true);
    expect(agedOut({ ...base, mtime: ago(1) }, 7, NOW)).toBe(false);
    expect(agedOut({ ...base, anchor: { kind: "none", note: "unresolved" } }, 7, NOW)).toBe(false);
    expect(sweepable({ ...base, citations: ["scripts/_1-x-disposable.mts"] }, 7, NOW)).toBe(false);
  });
});

describe("chainSweep — a file kept ONLY by a file being swept is swept with it (#827)", () => {
  /*
    Janitor run 5's shape, as a fixture: `_434-prbody-disposable.md` was in the
    first wave and `_434-sabotage-disposable.mts` was KEPT solely because the
    prbody draft named it. One pass deleted the draft and left the driver for
    the next reading to find. Every arm below spoils exactly one thing about
    that shape, because this verdict FEEDS A DELETION and a chain reader that
    followed one hop too many would delete a file a real document still names.
  */
  const old = (file: string, citations: string[] = []): Verdict => ({
    file,
    anchor: { kind: "card", id: 434, at: ago(30), note: "#434 closed" },
    citations,
    mtime: ago(30),
  });
  const prbody = old("scripts/_434-prbody-disposable.md");
  const sabotage = old("scripts/_434-sabotage-disposable.mts", [prbody.file]);

  it("POSITIVE CONTROL — run 5's second wave, read in the first reading", () => {
    const chain = chainSweep([prbody, sabotage], 7, NOW);
    expect(sweepable(sabotage, 7, NOW)).toBe(false); // the plain verdict still says KEEP
    expect(chain.get(sabotage.file)).toEqual([prbody.file]); // and this says by whom
    expect(chain.has(prbody.file)).toBe(false); // the first wave is not a chain verdict
  });

  it("NEGATIVE CONTROL — a citer that STAYS keeps the file, even beside one being swept", () => {
    const held = old("scripts/_434-sabotage-disposable.mts", [prbody.file, "docs/JANITOR_LOG.md"]);
    expect(chainSweep([prbody, held], 7, NOW).has(held.file)).toBe(false);
  });

  it("NEGATIVE CONTROL — a citer inside its window is a keeper, and so is one that resolves to nothing", () => {
    const fresh: Verdict = { ...old("scripts/_434-fresh-disposable.mts"), mtime: ago(1) };
    const unresolved: Verdict = { ...old("scripts/_scratch-disposable.mts"), anchor: { kind: "none", note: "" } };
    const byFresh = old("scripts/_434-a-disposable.mts", [fresh.file]);
    const byUnresolved = old("scripts/_434-b-disposable.mts", [unresolved.file]);
    const chain = chainSweep([fresh, unresolved, byFresh, byUnresolved], 7, NOW);
    expect([...chain.keys()]).toEqual([]);
  });

  it("NEGATIVE CONTROL — a file that has not aged out is never chain-swept, whoever names it", () => {
    const young: Verdict = { ...old("scripts/_434-young-disposable.mts", [prbody.file]), mtime: ago(1) };
    expect(chainSweep([prbody, young], 7, NOW).has(young.file)).toBe(false);
  });

  it("follows a chain of any length — the one-pass reading stops at two", () => {
    const third = old("scripts/_434-third-disposable.mts", [sabotage.file]);
    const chain = chainSweep([prbody, sabotage, third], 7, NOW);
    expect(chain.get(third.file)).toEqual([sabotage.file]);
    expect(chain.get(sabotage.file)).toEqual([prbody.file]);
  });

  it("two dead siblings naming EACH OTHER and nothing else are swept together", () => {
    /* The card's own guard arm. Neither is in any wave of a first-wave-then-
       reclassify reading, because each keeps the other; nothing that STAYS
       names either, which is the only question that matters. */
    const a = old("scripts/_434-a-disposable.mts", ["scripts/_434-b-disposable.mts"]);
    const b = old("scripts/_434-b-disposable.mts", ["scripts/_434-a-disposable.mts"]);
    const chain = chainSweep([a, b], 7, NOW);
    expect(chain.get(a.file)).toEqual([b.file]);
    expect(chain.get(b.file)).toEqual([a.file]);
  });

  it("and a cycle one real keeper reaches is kept whole", () => {
    const a = old("scripts/_434-a-disposable.mts", ["scripts/_434-b-disposable.mts"]);
    const b = old("scripts/_434-b-disposable.mts", ["scripts/_434-a-disposable.mts", "docs/specs/A_COURT.md"]);
    expect(chainSweep([a, b], 7, NOW).size).toBe(0);
  });
});

describe("verdictOf — the one sentence both outputs print, and it never names a keeper that is leaving (PR #829 review)", () => {
  const old = (file: string, citations: string[] = []): Verdict => ({
    file,
    anchor: { kind: "card", id: 434, at: ago(30), note: "#434 closed" },
    citations,
    mtime: ago(30),
  });
  const prbody = old("scripts/_434-prbody-disposable.md");
  const sabotage = old("scripts/_434-sabotage-disposable.mts", [prbody.file]);
  const read = (rows: Verdict[], v: Verdict) => {
    const chain = chainSweep(rows, 7, NOW);
    return verdictOf(v, 7, NOW, chain, sweptSet(rows, 7, NOW, chain));
  };

  it("a plain sweep, a chain sweep naming its citer, and a keep cited by a file that stays", () => {
    const kept = old("scripts/_434-court-disposable.mts", ["docs/specs/A_COURT.md"]);
    const rows = [prbody, sabotage, kept];
    expect(read(rows, prbody)).toEqual({ verdict: "sweep", reason: "#434 closed 30d ago" });
    expect(read(rows, sabotage)).toEqual({
      verdict: "sweep-chain",
      reason: "#434 closed 30d ago — kept only by scripts/_434-prbody-disposable.md, itself swept",
    });
    expect(read(rows, kept)).toEqual({ verdict: "keep", reason: "cited by docs/specs/A_COURT.md" });
  });

  it("THE REVIEWER'S ROW — a young file whose only citer is being swept says WHY it stays, not who keeps it", () => {
    /* The verdict was always right (it is inside its window); the sentence
       was wrong at print time — `KEEP cited by X` in the report whose manifest
       deletes X. Now the citation counts only from a file that stays, and the
       row says its citers are leaving. */
    const young: Verdict = { ...old("scripts/_434-young-disposable.mts", [prbody.file]), mtime: ago(1) };
    const out = read([prbody, young], young);
    expect(out.verdict).toBe("keep");
    expect(out.reason).not.toContain("cited by");
    expect(out.reason).toContain("mtime 1d");
    expect(out.reason).toContain("its only citers (scripts/_434-prbody-disposable.md) are being swept");
  });

  it("and the same for a file unresolved by name — the anchor note is the reason, the leaving citer is noted", () => {
    const unresolved: Verdict = { ...old("scripts/_scratch-disposable.mts", [prbody.file]), anchor: { kind: "none", note: "the name points at no card or edition" } };
    const out = read([prbody, unresolved], unresolved);
    expect(out.verdict).toBe("keep");
    expect(out.reason).toBe("the name points at no card or edition — its only citers (scripts/_434-prbody-disposable.md) are being swept");
  });

  it("a keep with one citer staying and one leaving names only the one that stays", () => {
    const both = old("scripts/_434-both-disposable.mts", [prbody.file, "docs/JANITOR_LOG.md"]);
    expect(read([prbody, both], both)).toEqual({ verdict: "keep", reason: "cited by docs/JANITOR_LOG.md" });
  });

  it("sweptSet is the union the JSON reader used to have to compute itself", () => {
    const rows = [prbody, sabotage];
    expect([...sweptSet(rows, 7, NOW, chainSweep(rows, 7, NOW))].sort()).toEqual([prbody.file, sabotage.file].sort());
  });
});

/*
  THE ARM THAT STOPS THIS SUITE PINNING THE POPULATION IT MEASURES (#975).

  #973 widened the reader's edition anchor and wrote its arms with REAL names
  out of the live population, deliberately, so the evidence would be honest.
  The citation sweep then did exactly what it is built to do — *a KEEP is a
  citation, never a judgement of value* — and because this file is TRACKED and
  stays, every name it quoted became a permanent KEEP:

      KEEP  cited by server/disposableAge.test.ts   scripts/_edition337-disposable.mts
      …

  Measured across that merge: sweepable 4 -> 2, `cited by a file that stays`
  101 -> 114. So the fix recovered 27 files from *undatable* and, in the same
  commit, pinned 13 of them as *permanently kept*. **A citation never ages**, so
  nothing about that decays on its own.

  ⚠ **RE-MEASURED BEFORE THIS WAS TAKEN (#909's rule) AND THE CARD'S FIGURE IS
  THE RELEASE COUNT, NOT THE POPULATION: this suite cited FIFTEEN rows, of which
  thirteen were cited by nothing else.** The other two — `_shift101-court-mouth-`
  and `court-ink-plate-` — are also named by `docs/specs/INK_COURT.md` and
  `scripts/build-ink-court-panel-disposable.mts`, so they stay KEEP on their own
  merits and renaming here neither releases nor harms them.

  ⚠ **THE READER IS NOT WEAKENED TO FIX THIS, AND THAT WAS THE CARD'S OWN
  RECOMMENDATION.** Excluding this suite from the citation authority would trade
  a safety reader for a naming problem, and the next tracked file to quote a
  disposable path will not be this suite. The names moved instead.

  The fixtures now sit in a reserved range that respects both of the reader's
  own digit rules, read at `nameAnchorOf` rather than assumed: a CARD id is
  `\d{1,4}` (so `9155`, and a five-digit card deliberately reads as null — the
  reader treats it as a date or a pixel width), while an EDITION id is unbounded
  (so `99337`, five digits, far above the ~413 editions that exist). Every
  SHAPE under test is preserved exactly; only the numbers moved, which is why
  the forty arms above pass unchanged.

  ⚠ **AND ITS LIMIT IS STATED: this arm reads the DISK, so on a clean checkout —
  which is what CI runs — nothing exists and it is VACUOUS.** It has teeth on a
  shift's own tree, which is the only place the population lives at all. That is
  not a weakness to fix here; it is what the subject is.
*/
describe("this suite's own fixtures name no file that exists (#975)", () => {
  const SELF = path.join(import.meta.dirname, "disposableAge.test.ts");
  /* `*-disposable.<ext>` is the population's shape. `scripts/disposable-age.mts`
     is the READER and does not match it, which is deliberate — that one must
     exist, and an arm indicting it would be this guard crying wolf on day one. */
  const QUOTED = /[\w./\-]*-disposable\.[a-z]+/g;

  it("reads its own source, and finds the fixtures it is about", () => {
    /* The floor (working law 2): an absence arm over an empty list is green
       when the reader breaks, and this one reads a file by a computed path. */
    const names = [...new Set(readFileSync(SELF, "utf8").match(QUOTED) ?? [])];
    expect(names.length, "the reader found no disposable names in its own source").toBeGreaterThan(20);
    expect(names).toContain("scripts/_edition99337-disposable.mts");
  });

  it("and not one of them is a file in the live population", () => {
    const names = [...new Set(readFileSync(SELF, "utf8").match(QUOTED) ?? [])];
    const REPO = path.resolve(import.meta.dirname, "..");
    const live = names.filter((name) => existsSync(path.join(REPO, name)));

    expect(
      live,
      "a fixture name here is a real file, so this suite has pinned it as a permanent KEEP — "
        + "rename the fixture (cards 9xxx, editions 99xxx), never the file:\n" + live.join("\n"),
    ).toEqual([]);
  });
});
