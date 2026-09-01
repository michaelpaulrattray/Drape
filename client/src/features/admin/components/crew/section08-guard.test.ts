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

  it("working now is mounted above the program banner", () => {
    const body = code(PAGE_TEXT);
    expect(body.indexOf("<CrewWorkingNow")).toBeLessThan(body.indexOf("<CrewProgramBanner"));
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

describe("§7 — history is ONE block and is not split back apart", () => {
  it("exactly one component reads the folded history", () => {
    const readers = surfaces().filter((f) => code(f.text).includes("recentHistory("));
    expect(readers.map((f) => f.name)).toEqual(["CrewRecentHistory.tsx"]);
  });

  /*
    POSITIVE CONTROL: the three headings #292 deleted. If a later brief brings
    one back, this arm names it — and the control proves the matcher works by
    finding the words in a string that does contain them.
  */
  const DEAD_HEADINGS = ["Recently answered", "Already judged", "Recently landed"];
  it("the dead-heading matcher fires on a planted heading", () => {
    const planted = 'const h = "Recently answered";';
    expect(DEAD_HEADINGS.some((h) => planted.includes(h))).toBe(true);
  });

  it("none of the three deleted history headings has come back", () => {
    for (const file of surfaces()) {
      for (const heading of DEAD_HEADINGS) {
        expect(code(file.text), `${file.name} brought back "${heading}"`).not.toContain(heading);
      }
    }
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

  it("issue numbers, step numbers and rung keys are drawn in a mono class", () => {
    const banner = code(read(path.join(HERE, "CrewProgramBanner.tsx")));
    expect(banner).toMatch(/dp-crew__num dp-crew__stepnum/);
    expect(banner).toMatch(/dp-crew__num dp-crew__rungid/);
    const history = code(read(path.join(HERE, "CrewRecentHistory.tsx")));
    expect(history).toMatch(/dp-crew__mono[^"]*">#\{row\.issueNumber\}/);
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
