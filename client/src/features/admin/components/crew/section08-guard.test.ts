import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Brief 08's rules, as assertions rather than as review memory
 * (`docs/specs/Casting-ui-ux-design/drape-redesign/08-crew.md`).
 *
 * ⚠ **THIS BRIEF IS MOSTLY A WARNING, SO MOST OF THESE ARMS GUARD THE THINGS
 * THAT MUST NOT MOVE.** His §1: *"Crew is already built, and its content
 * architecture is better than my prototype's … If the diff moves a paragraph's
 * order, deletes a quote, adds a second progress number or splits history back
 * apart, it has gone wrong."* Those four sentences are four arms below, and
 * they are worth more than the type rules — a later brief restyling this page
 * would undo them by accident, which is exactly what happened to the pipeline
 * before #291.
 *
 * ⚠ **THE POPULATION IS DERIVED, NOT TYPED** — every non-test source file in
 * this directory plus the page that mounts them. Section 05's guard learned
 * why: a hand-written list of surfaces had the same blind spot the mockup did.
 * A fourteenth component here is measured the moment it exists, and the floor
 * arm means an empty read FAILS rather than reading clean.
 *
 * ⚠ **EVERY ABSENCE ARM IS PAIRED WITH A POSITIVE CONTROL.** An absence arm
 * alone is green when its subject is deleted and green when its own matcher is
 * wrong — both have happened in this repo (working law 2).
 *
 * **What a source read cannot see**, stated rather than implied: whether the
 * full-bleed gallery actually clears the pane without a horizontal scrollbar,
 * whether the reply field reads as a field in dark mode, whether the rung bar's
 * ringed segment is legible against `--surface`. Those were DRIVEN in the
 * running app, both themes, and recorded in the section's evidence file.
 */

const HERE = __dirname;
const CLIENT_SRC = path.resolve(HERE, "..", "..", "..", "..");
const PAGE = path.resolve(CLIENT_SRC, "pages/AdminCrew.tsx");

const read = (file: string) => fs.readFileSync(file, "utf8");

/** Strip comments, so a docblock explaining a rule cannot trip the rule. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CSS = read(path.join(HERE, "crew.css"));
const PAGE_TEXT = read(PAGE);

/** Every component of this section, plus the page. Derived, never named. */
const section = (): { name: string; text: string }[] => {
  const files = fs
    .readdirSync(HERE)
    .filter((n) => (n.endsWith(".tsx") || n.endsWith(".ts")) && !n.includes(".test."))
    .map((n) => ({ name: n, text: read(path.join(HERE, n)) }));
  files.push({ name: "AdminCrew.tsx", text: PAGE_TEXT });
  return files;
};

/** The rendering surfaces only — the two helper modules draw nothing. */
const surfaces = () => section().filter((f) => f.name.endsWith(".tsx"));

describe("brief 08 — the population is real", () => {
  it("finds every Crew component plus the page", () => {
    const names = section().map((f) => f.name);
    expect(names).toContain("CrewProgramBanner.tsx");
    expect(names).toContain("CrewNeedsYou.tsx");
    expect(names).toContain("CrewEyeGallery.tsx");
    /* The four the mockup never saw — #272, #277, #290, #293. They are more
       than half this section's colour debt and §6 does not list one of them. */
    expect(names).toContain("CrewWorkingNow.tsx");
    expect(names).toContain("CrewBackgroundWork.tsx");
    expect(names).toContain("CrewNextUp.tsx");
    expect(names).toContain("CrewGeneral.tsx");
    expect(names).toContain("AdminCrew.tsx");
    /* ⚠ THE FLOOR. Without it an empty or misdirected read passes every
       absence arm below by having nothing to look at. */
    expect(names.length).toBeGreaterThanOrEqual(14);
  });

  it("reads a stylesheet that is actually there", () => {
    expect(CSS.length).toBeGreaterThan(2000);
    expect(CSS).toContain(".dp-crew__card");
  });
});

/* ================================================================
   §1 + §7 — THE FOUR THINGS THAT MEAN THE DIFF HAS GONE WRONG
   ================================================================ */

describe("§1 — a paragraph's order does not move", () => {
  /*
    His standing order, and the layout is what holds it: product impact is the
    first paragraph of a needs-you card and there is nowhere else for it to go.
    Asserted as an ORDER rather than a presence — a card that renders all three
    fields in the wrong sequence passes a presence check.
  */
  it("product impact comes before the worked example, and both before the options", () => {
    const body = code(read(path.join(HERE, "CrewNeedsYou.tsx")));
    const impact = body.indexOf("card.productImpact");
    const example = body.indexOf("card.workedExample");
    const recommendation = body.indexOf("card.recommendation");
    const options = body.indexOf("card.options");
    expect(impact).toBeGreaterThan(-1);
    expect(example).toBeGreaterThan(impact);
    /* §1: "The recommendation is stated before the options, so a yes needs no
       reading of alternatives." */
    expect(recommendation).toBeGreaterThan(example);
    expect(options).toBeGreaterThan(recommendation);
  });

  it("the eye item leads with the question, not with the pictures", () => {
    const body = code(read(path.join(HERE, "CrewEyeGallery.tsx")));
    expect(body.indexOf("item.question")).toBeLessThan(body.indexOf("item.frames.map"));
  });

  /**
   * ⚠ **INVERTED, NOT DELETED (#437, 2026-09-02).** This arm read *"working now
   * is mounted above the program banner"* and pinned #272's reasoning. **The
   * founder reversed it** — *"yes the easier fix"*, taking THE PROGRAM whole to
   * the top of the page — so the arm now pins HIS order instead. An arm removed
   * to let a change through stops guarding the thing it was written for.
   *
   * ⚠ **And it pins the WHOLE order rather than the one pair it used to.** Two
   * of the three comments this move overturned were arguing for adjacencies no
   * test had ever held, so a later shift could have restored either of them and
   * nothing would have gone red. The section order of this page is the founder's
   * repeatedly, and it is the thing he actually looks at; it is worth deriving
   * from one list.
   *
   * A deliberate future reorder edits this list and quotes him, exactly as this
   * one did.
   */
  /**
   * HIS TABLE, top to bottom: the phrase the page's docblock uses for each
   * section, beside the tag it mounts.
   *
   * ⚠ **ONE LIST, READ BY BOTH ARMS.** It was two — a tag array here and a
   * phrase/tag table in the docblock arm — which is working law 4 inverted
   * even though it happened to fail closed. A second list shadowing a source
   * of truth always drifts from it, and this one is the founder's order,
   * which is the last thing that should be written down twice.
   */
  const HIS_ORDER: [string, string][] = [
    ["the program", "<CrewProgramBanner"],
    ["working now", "<CrewWorkingNow"],
    ["next up", "<CrewNextUp"],
    ["background work", "<CrewBackgroundWork"],
    ["needs you", "<CrewNeedsYou"],
    ["for your eyes", "<CrewEyeGallery"],
    ["what is not done", "<CrewPipeline"],
    /* ⚠ `["already dealt with", "<CrewRecentHistory"]` was here and is GONE by
       his own word (#438). The section is not re-ordered — it is deleted, and
       §7 below asserts its absence rather than this list asserting its place. */
    ["problems", "<CrewProblems"],
    ["general", "<CrewGeneral"],
  ];

  /* The card is named in the docblock above rather than in this title: the
     foundation token guard reads `#437` in a STRING as a hex literal (every
     issue number from #100 up is valid hex) and strips comments, which is what
     its own failure message tells you to do. */
  it("the page is mounted in the order he ruled", () => {
    const body = code(PAGE_TEXT);
    const at = HIS_ORDER.map(([, tag]) => {
      const index = body.indexOf(tag);
      /* A section that stops being mounted must REDDEN, never quietly sort to
         the front — `indexOf` returns -1, which is less than everything. */
      expect(index, `${tag} is not mounted`).toBeGreaterThan(-1);
      return index;
    });
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it("POSITIVE CONTROL: the order matcher fires on the arrangement that was here", () => {
    const was = "<CrewWorkingNow /><CrewBackgroundWork /><CrewProgramBanner /><CrewNextUp />";
    const at = ["<CrewProgramBanner", "<CrewWorkingNow", "<CrewNextUp"].map((t) =>
      was.indexOf(t),
    );
    expect(at).not.toEqual([...at].sort((a, b) => a - b));
  });

  /**
   * ⚠ **THE PAGE'S OWN DOCBLOCK MUST AGREE WITH ITS JSX, AND THIS ARM EXISTS
   * BECAUSE IT DID NOT.** The first shape of the change above rewrote the three
   * comments at the MOUNT SITES — the places the card named — and left the
   * file's top docblock still listing the old reading order, plus near-verbatim
   * copies of two of those sentences in the components' own headers. The
   * reviewer found them. **The sweep chose its sites instead of deriving
   * them**, which is the same mistake the previous shift made on the previous
   * card, one week apart.
   *
   * ⚠ **Of the four stale sentences, this is the ONLY one a machine can hold**,
   * and it is also the one a reader meets first — it is the first paragraph of
   * the file the order lives in. The other three are prose in other files and
   * stay a human sweep; pinning this one at least means the two statements of
   * the order that live in THIS file can never silently disagree again.
   *
   * The phrase table is hand-written on purpose. Deriving the words from the
   * docblock would make the arm compare the sentence to itself.
   */
  it("the reading order in the page's own docblock matches the order it mounts", () => {
    /*
      ⚠ THE SENTENCE IS CUT AT ITS FULL STOP, NOT AT THE END OF THE DOCBLOCK.
      The first shape sliced to the end of the block and fell back to a bare
      `indexOf(phrase)` for the two phrases the line wrap leaves without a
      trailing arrow — so a later paragraph in the same docblock could have
      supplied the match instead of the list. It cannot mis-resolve today (the
      reviewer traced every landing point), but the arm claimed to be anchored
      and for two of ten rows it was not. Bounded here so the claim is true.
    */
    const head = PAGE_TEXT.slice(0, PAGE_TEXT.indexOf("*/"));
    const from = head.indexOf("His reading order:");
    expect(from, "the reading-order sentence is gone from the docblock").toBeGreaterThan(-1);
    const stop = head.indexOf("**", head.indexOf("→ general"));
    const sentence = head.slice(from, stop > from ? stop : undefined).toLowerCase();
    expect(sentence, "the reading-order sentence has lost its arrows").toContain("→");

    const prose = HIS_ORDER.map(([phrase]) => {
      const at = sentence.indexOf(phrase);
      expect(at, `the docblock's reading order never names "${phrase}"`).toBeGreaterThan(-1);
      return at;
    });
    expect(prose, "the docblock lists the sections in a different order than it mounts them")
      .toEqual([...prose].sort((a, b) => a - b));

    /* And the two statements must be the SAME order, not merely each sorted. */
    const body = code(PAGE_TEXT);
    const mounted = HIS_ORDER.map(([, tag]) => body.indexOf(tag));
    expect(mounted).toEqual([...mounted].sort((a, b) => a - b));
  });

  it("POSITIVE CONTROL: the docblock arm fires on the sentence that was here", () => {
    const was =
      "his reading order: working now → background work → the program → needs you → next up → general.";
    const order = ["the program", "working now", "next up"].map((p) => was.indexOf(p));
    expect(order).not.toEqual([...order].sort((a, b) => a - b));
  });
});

describe("§1 — a quote is rendered verbatim and never trimmed", () => {
  const banner = code(read(path.join(HERE, "CrewProgramBanner.tsx")));

  it("renders the quote whole", () => {
    expect(banner).toContain("{program.focus.quote}");
  });

  /*
    POSITIVE CONTROL for the matcher below: the file genuinely contains the
    truncation vocabulary nowhere, so the arm could be green because the words
    are absent OR because the regex is wrong. This proves the regex fires.
  */
  const TRUNCATORS = /\.(slice|substring|substr|truncate)\s*\(/;
  it("the truncation matcher fires on a planted call", () => {
    expect(TRUNCATORS.test("const shown = quote.slice(0, 120);")).toBe(true);
  });

  it("does not truncate, ellipsise or paraphrase it", () => {
    expect(TRUNCATORS.test(banner)).toBe(false);
    expect(banner).not.toContain("line-clamp");
    expect(CSS).not.toContain("-webkit-line-clamp");
  });

  /*
    ⚠ **THE CLASS, NOT THE INSTANCE (working law 7).** `CrewWorkingNow`'s
    `clockTime` was fixed to 24-hour with its reasoning written down — *"every
    other time in his world is 24-hour … the one clock he would be comparing
    against was the one written differently"* — and the sweep stopped at that
    function. The other two formatters on the same page kept the locale
    default, so his own confirming quote read `07:17 pm` a few hundred pixels
    above a shift row reading `20:17`.

    The population is DERIVED — every `toLocaleString`/`toLocaleTimeString`
    call in the section — so a fourth formatter added later is measured the
    moment it exists rather than needing this list updated.
  */
  it("every time formatter on the page is forced to 24-hour", () => {
    const offenders: string[] = [];
    for (const file of surfaces()) {
      const body = code(file.text);
      const calls = body.match(/toLocale(?:Time)?String\([\s\S]{0,240}?\)/g) ?? [];
      for (const call of calls) {
        if (!/hour:/.test(call)) continue;
        if (!/hour12:\s*false/.test(call)) offenders.push(`${file.name}: ${call.slice(0, 60)}…`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the 24-hour matcher fires on the shape that was actually shipped", () => {
    /* POSITIVE CONTROL — the exact call that produced "07:17 pm". */
    const planted = 'date.toLocaleString(undefined, { day: "numeric", hour: "2-digit" })';
    const calls = planted.match(/toLocale(?:Time)?String\([\s\S]{0,240}?\)/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(/hour:/.test(calls[0]) && !/hour12:\s*false/.test(calls[0])).toBe(true);
  });

  /*
    ⚠ THE FLOOR FOR THE ARM ABOVE. Without it, a sweep that matched nothing —
    a renamed API, a moved formatter — reports "no offenders" and reads exactly
    like a clean page.

    ⚠ **AND IT COUNTS THE CALLS THAT FORMAT A TIME, NOT EVERY `toLocaleString`.**
    The first shape of this arm counted five and expected three: `CrewReplyBox`
    formats the character counter with the same method name, and a number is
    not a clock. Pinning "3" would also have been a magic number tied to
    today's fixture — the population and the file spread are derived instead.
  */
  it("the formatter sweep has a real population, spread across files", () => {
    const perFile = surfaces()
      .map((f) => ({
        name: f.name,
        n: (code(f.text).match(/toLocale(?:Time)?String\([\s\S]{0,240}?hour:/g) ?? []).length,
      }))
      .filter((f) => f.n > 0);
    expect(perFile.length).toBeGreaterThanOrEqual(3);
    expect(perFile.reduce((sum, f) => sum + f.n, 0)).toBeGreaterThanOrEqual(3);
  });

  it("keeps the attribution and the date, and the date is absolute", () => {
    expect(banner).toContain("shortDate(program.focus.quotedAt)");
    /* §7: no relative timestamps on anything decided. `shortDate` is the
       absolute one; `ago()` is the status strip's and must not appear here. */
    expect(banner).not.toMatch(/\bago\s*\(/);
  });
});

describe("§7 — there is no SECOND progress number beside the milestone bar", () => {
  const banner = code(read(path.join(HERE, "CrewProgramBanner.tsx")));

  it("reads the bar off the steps, once", () => {
    expect(banner.match(/milestoneProgress\(/g)).toHaveLength(1);
  });

  it("says the count once, and only through the derived line", () => {
    /* #74's rule: the sentence under the bar is the same reading in words, not
       a second measurement. Two calls would be two numbers that can disagree. */
    expect(banner.match(/milestoneCountLine\(/g)).toHaveLength(1);
  });

  it("computes no percentage anywhere but the bar's own width", () => {
    const percents = banner.match(/progress\.fraction/g) ?? [];
    expect(percents).toHaveLength(1);
  });
});

/**
 * ⚠ **REWRITTEN, NOT DELETED (#438, 2026-09-02).** This block asserted that
 * history was ONE list and that exactly one component read it — #292's
 * consolidation. **He then deleted the one**, so the arm's subject no longer
 * exists and an arm that is removed to let a change through stops guarding
 * what it was written for. It now asserts the stronger thing: the section is
 * GONE, and none of the FOUR headings can come back.
 *
 * ⚠ **Brief 08 §7 says *"If the diff … splits history back apart, it has gone
 * wrong"*, and this is not that.** One list did not become two — it became
 * none, which is #292's own argument carried to its end. A future shift
 * reading §7 or #292 alone would restore the block; these arms are what stop
 * it, and they are why the clause is answered here in code rather than only
 * in a commit message.
 */
describe("§7 — history is not a section on this page at all (#438)", () => {
  it("no component reads the folded history, and the derivations are gone", () => {
    const readers = surfaces().filter((f) => code(f.text).includes("recentHistory("));
    expect(readers.map((f) => f.name)).toEqual([]);
    /*
      The helper module too — dead code kept alive by its own tests is how a
      dead thing keeps a live reputation (the credit-velocity lesson).

      ⚠ SUBSTRING, NOT A REGEX, AND THE REASON IS A DEFECT THIS ARM ALREADY
      HAD. The first shape was a regex ending in a word-boundary escape, and it
      was written through a shell heredoc, which turned that escape into a
      literal BACKSPACE byte (0x08) - a pattern nothing can ever match, so the
      arm was green over a restored derivation. The sabotage driver found it;
      reading the line could not, because a 0x08 is invisible in terminal
      output. A substring cannot be corrupted that way.
    */
    const types = read(path.join(HERE, "crewTypes.ts"));
    expect(types).not.toContain("export function recentHistory");
    expect(types).not.toContain("export function foldHistory");
  });

  /*
    ⚠ AND THE MOUNT, which the arms above do not cover: with the file deleted,
    re-adding `<CrewRecentHistory />` to the page breaks `pnpm check` but left
    this suite green. The gate catches it either way; the suite should say WHY
    rather than leaving the reason to a type error in another tool.
  */
  it("no surface mounts the deleted component", () => {
    for (const file of surfaces()) {
      expect(code(file.text), `${file.name} mounts it again`).not.toContain(
        "<CrewRecentHistory",
      );
    }
  });

  it("the component file itself is gone from the directory", () => {
    expect(section().map((f) => f.name)).not.toContain("CrewRecentHistory.tsx");
  });

  /*
    POSITIVE CONTROL: the three headings #292 deleted, plus the one #438 did.
    If a later brief brings any back, this arm names it — and the control
    proves the matcher works by finding the words in a string that has them.
  */
  const DEAD_HEADINGS = [
    "Recently answered",
    "Already judged",
    "Recently landed",
    "Already dealt with",
  ];
  it("the dead-heading matcher fires on a planted heading", () => {
    const planted = 'const h = "Already dealt with";';
    expect(DEAD_HEADINGS.some((h) => planted.includes(h))).toBe(true);
  });

  it("none of the four deleted history headings has come back", () => {
    for (const file of surfaces()) {
      for (const heading of DEAD_HEADINGS) {
        expect(code(file.text), `${file.name} brought back "${heading}"`).not.toContain(heading);
      }
    }
  });

  /*
    ⚠ AND THE FLOOR: an absence sweep over an empty population is green. Both
    arms above read `surfaces()`, so this proves the population is real.
  */
  it("the surface population is not empty", () => {
    expect(surfaces().length).toBeGreaterThan(8);
  });
});

describe("§4 + §6 — the Needs You empty state STAYS (brief 07's rule reversed)", () => {
  const needsYou = code(read(path.join(HERE, "CrewNeedsYou.tsx")));

  /*
    ⚠ THE ONE PLACE THE OVERVIEW'S "EMPTY SECTIONS DISAPPEAR" RULE DOES NOT
    APPLY, and his reason is that its absence would read as a loading failure.
    A later shift sweeping empty states off staff surfaces would delete this
    without the arm.
  */
  it("renders the sentence rather than returning null", () => {
    expect(needsYou).toContain("Nothing is waiting on you.");
    expect(needsYou).not.toMatch(/if\s*\(\s*open\.length\s*===\s*0\s*\)\s*return\s+null/);
  });

  it("draws it as a well block, not as a full card", () => {
    expect(needsYou).toContain("dp-crew__well");
    expect(CSS).toMatch(/\.dp-crew__well\s*\{[^}]*background:\s*var\(--well\)/);
  });

  /* The gallery is the opposite case and stays that way — an empty gallery
     frame would be furniture (#75), which is a different question from an
     empty answer to "what needs you". */
  it("the eye gallery still returns null when nothing is open", () => {
    const gallery = code(read(path.join(HERE, "CrewEyeGallery.tsx")));
    expect(gallery).toMatch(/if\s*\(open\.length === 0\)\s*return null/);
  });
});

/**
 * ⚠ **THE PIPELINE'S EMPTY LINE SAYS WHAT THE SECTION IS FOR (#438).**
 *
 * He asked whether this section was one he needed. It was rendering NOTHING
 * because every pipeline row was merged — and *"nothing is stuck"* and *"this
 * section is broken"* looked identical, which is the ambiguity §6 protects
 * `CrewNeedsYou` from. The old line described the rows (*"Nothing is in flight.
 * Everything the crew has started has landed."*); the new one names what a FULL
 * section would mean, so an empty box teaches him to read a populated one.
 *
 * ⚠ **What these arms CANNOT see**, said rather than implied: whether the well
 * reads correctly nested inside the pipeline's own card, and whether a
 * populated section still draws its rows. Both were DRIVEN in the running app,
 * both themes, with a non-merged fixture row — an empty-state arm alone is
 * green when the section is broken.
 */
describe("§6 — THE PIPELINE keeps an honest empty state (#438)", () => {
  const pipeline = code(read(path.join(HERE, "CrewPipeline.tsx")));

  it("renders the sentence rather than nothing, and says what the section is for", () => {
    expect(pipeline).toContain("Nothing is stuck.");
    expect(pipeline).toContain("Blocked work and anything waiting on you appears here.");
  });

  it("the old line, which described the rows instead, is gone", () => {
    expect(pipeline).not.toContain("Everything the crew has started has landed");
  });

  it("draws it as a well block, the same treatment as the Needs You empty state", () => {
    expect(pipeline).toMatch(/notDone\.length === 0 \?[\s\S]{0,400}dp-crew__well/);
  });

  /* ⚠ THE ROWS ARE THE OTHER HALF: an empty-state change must not become an
     empty SECTION. The populated branch still maps `notDone`. */
  it("a populated pipeline still draws its rows", () => {
    expect(pipeline).toMatch(/notDone\.map\(\(item\) => \(/);
    expect(pipeline).toContain("<PipelineRow");
  });

  it("POSITIVE CONTROL: the empty-state matcher fires on the line that was here", () => {
    const was = "Nothing is in flight. Everything the crew has started has landed.";
    expect(was).toContain("Everything the crew has started has landed");
    expect(was).not.toContain("Nothing is stuck.");
  });
});

/* ================================================================
   §2 — WIDTH, AND THE ONE EXCEPTION
   ================================================================ */

describe("§2 — a 790px reading column with exactly one full-bleed section", () => {
  it("the page asks the shell for the reading measure rather than setting a width", () => {
    expect(code(PAGE_TEXT)).toContain('measure="read"');
  });

  /*
    ⚠ THE COLUMN IS THE SHELL'S (#395), NOT THIS SHEET'S. A `max-width` here
    would be a second source of truth for the page width — working law 4 — and
    the two would drift the first time the shell's changed.
  */
  it("the section stylesheet declares no page width of its own", () => {
    expect(CSS).not.toMatch(/max-width:\s*790px/);
  });

  it("exactly one section breaks out, and it is the eye gallery", () => {
    const users = surfaces().filter((f) => code(f.text).includes("dp-crew__bleed"));
    expect(users.map((f) => f.name)).toEqual(["CrewEyeGallery.tsx"]);
  });

  it("the breakout measures against the pane, not the viewport", () => {
    /* A breakout against a bare `100vw` overshoots by the rail plus the pane's
       padding and hands the pane a horizontal scrollbar — on the one section
       whose whole job is being looked at. */
    const rule = CSS.match(/\.dp-crew__bleed\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("var(--rail-w)");
    expect(rule).toContain("min(1240px");
  });
});

/* ================================================================
   §3 + §4 — THE HOUSE DEVICES
   ================================================================ */

describe("§3 — every section head is the house head", () => {
  /*
    ⚠ NOT A NEW COMPONENT. `TableHead` already IS the mono eyebrow + `--rule`
    hairline + optional right meta, with thirteen consumers after brief 07 —
    §9's "it must be a component by the end of this shift" was already
    discharged, and a fourteenth head built here would be the third in the
    tree.
  */
  it("every section that draws a head imports TableHead", () => {
    const heads = surfaces().filter((f) => code(f.text).includes("<TableHead"));
    expect(heads.length).toBeGreaterThanOrEqual(9);
    for (const file of heads) {
      expect(code(file.text), `${file.name} uses TableHead without importing it`)
        .toMatch(/import\s*\{[^}]*TableHead[^}]*\}\s*from\s*"@\/foundation"/);
    }
  });

  /* POSITIVE CONTROL: the hand-rolled eyebrow the section used to carry. */
  const HAND_EYEBROW = /text-\[11px\]\s+uppercase\s+tracking-/;
  it("the hand-rolled-eyebrow matcher fires on the markup it replaced", () => {
    expect(HAND_EYEBROW.test('className="text-[11px] uppercase tracking-[0.12em]"')).toBe(true);
  });

  it("no component hand-rolls an eyebrow any more", () => {
    for (const file of surfaces()) {
      expect(HAND_EYEBROW.test(code(file.text)), `${file.name} hand-rolls an eyebrow`).toBe(false);
    }
  });

  it("the count rides in the head's right meta, and the middle dot is gone", () => {
    const needsYou = code(read(path.join(HERE, "CrewNeedsYou.tsx")));
    expect(needsYou).toContain("dp-crew__meta");
    /* §3: "The hairline is what separates the label from the count, so the
       middle dot goes." */
    expect(needsYou).not.toMatch(/·\s*\{open\.length\}/);
  });
});

describe("§4 — two faces, and every measured value is mono", () => {
  it("the mono classes are actually mono", () => {
    for (const cls of ["dp-crew__mono", "dp-crew__num", "dp-crew__ref", "dp-crew__stamp"]) {
      const rule = CSS.match(new RegExp(`\\.${cls}\\s*\\{[^}]*\\}`))?.[0] ?? "";
      expect(rule, `.${cls} is not mono`).toContain("var(--font-mono)");
    }
  });

  it("prose stays on the sans face", () => {
    for (const cls of ["dp-crew__body", "dp-crew__mission", "dp-crew__title", "dp-crew__quote"]) {
      const rule = CSS.match(new RegExp(`\\.${cls}\\s*\\{[^}]*\\}`))?.[0] ?? "";
      expect(rule, `.${cls} is missing or not sans`).toContain("var(--font-sans)");
    }
  });

  /*
    ⚠ THE ISSUE-NUMBER HALF WAS PINNED TO ONE FILE AND THAT FILE IS GONE (#438).
    It read `CrewRecentHistory.tsx`, so deleting the section would have taken
    the assertion with it silently. The population is DERIVED now: every place
    on this page that prints a bare `#<number>` must draw it in a mono class.

    ⚠ **`CrewWorkingNow.tsx` prints `PR #{run.prNumber}` in `dp-crew__body--quiet`
    and is EXEMPT here by name, not by accident** — a bare `#` before a PR
    number inside a running sentence, which is a different shape from a
    standalone id chip. It is a real §4 inconsistency (`CrewPipeline` calls a PR
    number a measured value and monos it) and it is filed rather than fixed
    under a card about a different section. Removing the exemption without
    fixing that file is what this comment is here to make impossible to do
    quietly.
  */
  const ISSUE_NUMBER_EXEMPT = new Set(["CrewWorkingNow.tsx"]);
  it("issue numbers, step numbers and rung keys are drawn in a mono class", () => {
    const banner = code(read(path.join(HERE, "CrewProgramBanner.tsx")));
    expect(banner).toMatch(/dp-crew__num dp-crew__stepnum/);
    expect(banner).toMatch(/dp-crew__num dp-crew__rungid/);

    let seen = 0;
    for (const file of surfaces()) {
      if (ISSUE_NUMBER_EXEMPT.has(file.name)) continue;
      const body = code(file.text);
      for (let at = body.indexOf("#{"); at > -1; at = body.indexOf("#{", at + 2)) {
        seen += 1;
        /* The nearest className BEFORE the number is the one drawing it. */
        const before = body.slice(0, at);
        const cls = before.slice(before.lastIndexOf('className="'));
        expect(cls, `${file.name} prints an id outside a mono class`).toMatch(
          /dp-crew__(mono|ref)/,
        );
      }
    }
    /* FLOOR: a sweep that found nothing is green for the wrong reason. */
    expect(seen, "the id sweep read no rendered ids at all").toBeGreaterThan(2);
  });

  it("POSITIVE CONTROL: the id sweep rejects a number drawn outside a mono class", () => {
    const planted = '<span className="dp-crew__body">#{row.issueNumber}</span>';
    const before = planted.slice(0, planted.indexOf("#{"));
    expect(before.slice(before.lastIndexOf('className="'))).not.toMatch(/dp-crew__(mono|ref)/);
  });
});

describe("§7 — no weight above 500, and no italic anywhere", () => {
  /* POSITIVE CONTROLS first: both matchers proven to fire. */
  it("the weight and italic matchers fire on planted markup", () => {
    expect(/font-semibold|font-bold/.test('className="text-sm font-semibold"')).toBe(true);
    expect(/\bitalic\b/.test('className="text-sm italic"')).toBe(true);
    expect(/font-weight:\s*[6-9]00/.test("font-weight: 600;")).toBe(true);
  });

  it("no component uses font-semibold or font-bold", () => {
    for (const file of surfaces()) {
      expect(/font-semibold|font-bold/.test(code(file.text)), `${file.name}`).toBe(false);
    }
  });

  it("no component uses italic, and the quote's is gone", () => {
    for (const file of surfaces()) {
      expect(/\bitalic\b/.test(code(file.text)), `${file.name}`).toBe(false);
    }
    /* §4's own argument: the quote already carries two markers. */
    expect(CSS).toMatch(/\.dp-crew__quote\s*\{[^}]*font-style:\s*normal/);
  });

  it("the stylesheet declares no weight above 500", () => {
    expect(/font-weight:\s*[6-9]00/.test(CSS)).toBe(false);
    expect(/font:\s*[6-9]00\s/.test(CSS)).toBe(false);
  });
});

/* ================================================================
   §5 — TOKENS
   ================================================================ */

describe("§5 — the card shell is one declaration, in tokens", () => {
  const shell = CSS.match(/\.dp-crew__card\s*\{[^}]*\}/)?.[0] ?? "";

  it("uses the card border, the 2xl radius and the surface", () => {
    expect(shell).toContain("var(--borderCard)");
    expect(shell).toContain("var(--r-2xl)");
    expect(shell).toContain("var(--surface)");
    expect(shell).toContain("18px 19px");
  });

  it("no component re-declares a card shell in Tailwind", () => {
    /* POSITIVE CONTROL for the matcher, then the sweep. */
    expect(/rounded-2xl|bg-white/.test('className="bg-white rounded-2xl"')).toBe(true);
    for (const file of surfaces()) {
      expect(/rounded-2xl|bg-white/.test(code(file.text)), `${file.name}`).toBe(false);
    }
  });

  /*
    ⚠ THE GUARD ITS NEIGHBOUR CANNOT SEE. `token-guard` catches `#RRGGBB` and
    is blind to functional notation by construction — the viewer's backdrop was
    an inline `rgba(10,10,10,.92)` and three `white/60` opacities, none of them
    ever flagged, all of them semantic colours that must flip with the theme.
  */
  it("no component writes a colour in functional or opacity notation", () => {
    expect(/rgba?\(|\/\d\d\b|white\/|black\//.test('style={{ background: "rgba(10,10,10,.92)" }}'))
      .toBe(true);
    for (const file of surfaces()) {
      const body = code(file.text);
      expect(/rgba?\(/.test(body), `${file.name} writes an rgb()/rgba() colour`).toBe(false);
      expect(/\b(?:text|bg|border)-(?:white|black)\/\d/.test(body), `${file.name}`).toBe(false);
    }
  });

  /*
    ⚠ **EVERY TAILWIND WIDTH CAP THAT MOVED INTO THE SHEET IS PINNED HERE, AND
    THIS ARM EXISTS BECAUSE ONE OF THEM DID NOT MAKE THE MOVE** (PR #409
    review). The diff removed three — `max-w-3xl` on the viewer caption,
    `max-w-[16rem]` on a program chip, `max-w-[92vw]` on the viewer image — and
    the caption's was lost, so a long caption ran the full width of a 2560px
    screen under the frame it describes.

    A cap is invisible until the window is wide enough, which is why no drive
    at 1440 or 1024 could have caught it and why it is pinned rather than
    remembered. The reviewer found this one; the arm is what stops the next.
  */
  it("every width cap that moved out of Tailwind still exists in the sheet", () => {
    const caps: [string, string][] = [
      [".dp-crew__viewercap p", "the viewer caption — was max-w-3xl"],
      [".dp-crew__chipcell", "a program chip — was max-w-[16rem]"],
      [".dp-crew__viewerimg", "the viewer image — was max-w-[92vw]"],
    ];
    for (const [selector, why] of caps) {
      /* A selector may contain a space (`.dp-crew__viewercap p`), so it is
         escaped whole rather than by a hand-rolled character class — the first
         shape of this arm prefixed a stray backslash and matched nothing,
         which reads as "the rule is missing" on a rule that is right there. */
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rule = CSS.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`))?.[0];
      expect(rule, `${selector} is missing (${why})`).toBeTruthy();
      expect(rule, `${selector} lost its width cap (${why})`).toContain("max-width:");
    }
  });

  it("the viewer sits on the scrim tokens rather than on page ink", () => {
    const viewer = CSS.match(/\.dp-crew__viewer\s*\{[^}]*\}/)?.[0] ?? "";
    expect(viewer).toContain("var(--viewerScrim)");
    /* Text on a scrim is `--onScrim` and never `--ink`: `--ink` flips with the
       theme and the scrim does not, which is white-on-white in light mode. */
    const cap = CSS.match(/\.dp-crew__viewercap\s*\{[^}]*\}/)?.[0] ?? "";
    expect(cap).toContain("var(--onScrim)");
    expect(cap).not.toContain("var(--ink)");
  });
});

/* ================================================================
   §6 + §7 — COLOUR IS EARNED, AND ONLY IN THREE PLACES
   ================================================================ */

describe("§7 — nothing is coloured by state except the three sanctioned sites", () => {
  /*
    §6: "CrewProblems — this is the one place `--error` is legitimate on this
    page." §5: the warn chip. And one departure this shift states rather than
    slips in: the no-check-in reading and a failed outcome on `CrewWorkingNow`,
    a component §6 never saw. Those are the PROBLEM class §6 admits — brief
    07's rule one surface over is that fine is colourless and red means urgent.
  */
  const SANCTIONED = [
    "dp-crew__chip--warn",
    "dp-crew__sev--urgent",
    "dp-crew__card--alert",
    "dp-crew__alert",
    "dp-crew__outcome--failed",
  ];

  it("every rule using --errorInk is one of the five sanctioned selectors", () => {
    const rules = CSS.match(/\.[a-zA-Z0-9_-]+[^{]*\{[^}]*\}/g) ?? [];
    const reds = rules
      .filter((r) => r.includes("--errorInk") || r.includes("--error)"))
      .map((r) => r.slice(0, r.indexOf("{")).trim());
    expect(reds.length).toBeGreaterThan(0);
    for (const selector of reds) {
      expect(
        SANCTIONED.some((s) => selector.includes(s)),
        `${selector} uses the error token and is not one of the sanctioned five`,
      ).toBe(true);
    }
  });

  /*
    ⚠ `--error` SETS BORDERS AND FILLS; `--errorInk` SETS TEXT. `tokens.css`
    records plain `--error` on the dark surface at 3.40:1, below the AA floor.
    Anchored because `color:` is a substring of `border-color:` — the same
    near-miss that flagged two legitimate borders one brief ago.
  */
  it("never puts plain --error on text", () => {
    expect(/(^|[^-])color:\s*var\(--error\)/m.test("  color: var(--error);")).toBe(true);
    expect(/(^|[^-])color:\s*var\(--error\)/m.test("  border-color: var(--error);")).toBe(false);
    expect(/(^|[^-])color:\s*var\(--error\)/m.test(CSS)).toBe(false);
  });

  it("no amber, green or blue reaches this section", () => {
    const BANNED = /\b(?:text|bg|border|from|to|via)-(?:green|emerald|amber|yellow|blue|sky|indigo|violet|purple|teal|orange)-\d{2,3}\b/;
    expect(BANNED.test('className="text-emerald-500"')).toBe(true);
    for (const file of surfaces()) {
      expect(BANNED.test(code(file.text)), `${file.name} paints a tint`).toBe(false);
    }
  });
});

/* ================================================================
   §7 — WHAT THIS BRIEF WAS FORBIDDEN TO TOUCH
   ================================================================ */

describe("§7 — the query, the flag and the mutations are untouched", () => {
  it("the tab is still absent when crew.getState is not ok", () => {
    /* §7: "Do not touch useCrewState or the visibility flag. The query
       succeeding is the flag; that is right." */
    const hook = code(read(path.join(HERE, "useCrewState.ts")));
    expect(hook).toContain("crew.getState");
    expect(code(PAGE_TEXT)).toContain("useCrewState(isAdmin, { live: true })");
  });

  it("adds no query and changes no mutation", () => {
    const body = code(PAGE_TEXT);
    const mutations = body.match(/trpc\.crew\.\w+\.useMutation/g) ?? [];
    /* The three that were here: reply, setWorkSwitch, setCardIntent. */
    expect(mutations).toHaveLength(3);
    const queries = body.match(/trpc\.\w+\.\w+\.useQuery/g) ?? [];
    expect(queries).toHaveLength(0);
  });

  it("the reply box still guards its own bound and clears only on success", () => {
    const box = code(read(path.join(HERE, "CrewReplyBox.tsx")));
    expect(box).toContain("CREW_REPLY_MAX = 4000");
    expect(box).toMatch(/await onSend\(\{ cardId, body: trimmed \}\);\s*\n\s*setBody\(""\);/);
  });
});
