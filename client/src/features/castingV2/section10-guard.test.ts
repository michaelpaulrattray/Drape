import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * SECTION 10 — the casting hero column and the Cast settings modal (#435, his
 * brief `docs/specs/Casting-ui-ux-design/drape-redesign/10-casting-hero-and-settings.md`).
 *
 * # What this guard is for, and what it deliberately is not
 *
 * It does NOT re-assert the look. The look was driven in the running app and
 * photographed (`docs/specs/CASTING_HERO_435_EVIDENCE.md`) — working law 6 — and
 * a unit test that re-states a screenshot is a test of the screenshot.
 *
 * What it pins is the handful of decisions in his brief that carry a REASON and
 * would otherwise regress silently, because each is invisible in a passing suite
 * and only shows up in an export, a short window, or a customer's bill:
 *
 *   · the copy column is not centred — the defect he filed the card about;
 *   · the spacer is an ELEMENT, and NO auto margin exists in either surface,
 *     because a computed-style read resolves one to hard pixels and the card's
 *     `overflow: hidden` then clips it (live fine, every screenshot broken);
 *   · the two `min-height`s under the carousel survive, or the preview resizes
 *     as you step through it;
 *   · the stage flexes and is never given a fixed or `vh` height;
 *   · the receipt line's three values are DERIVED, never typed;
 *   · the modal's action is not inside a scrolling region;
 *   · `followHeld` still suppresses the imagination half — the one behaviour
 *     his brief could not know about (#177 Row A).
 *
 * # Every absence arm here has a positive control
 *
 * `not.toMatch` is green when the file is empty, when the file moved, and when
 * the pattern was mistyped. So each source is proven READABLE and proven to
 * contain something first, and each matcher is proven able to fire against a
 * string that should trip it. An arm that cannot fail is not an arm.
 */

const CSS = new URL("./castingV2.css", import.meta.url);
const MODAL = new URL("./components/CastSettingsModal.tsx", import.meta.url);
const FIELD = new URL("./components/BriefField.tsx", import.meta.url);
const PAGE = new URL("../../pages/CastingV2.tsx", import.meta.url);

const read = async (url: URL) => {
  const text = await readFile(url, "utf8");
  /*
    THE EMPTINESS CHECK, FIRST. A guard whose subject has been renamed or moved
    should go RED on the unreadable file rather than green on an empty string —
    the failure mode that let a whole staff-dialog guard pass over nothing.
  */
  expect(text.length, `${url.pathname} is empty or unreadable`).toBeGreaterThan(400);
  return text;
};

/** Comments carry the reasoning and quote the very things some arms forbid. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * The selector list of a split-out CSS block — everything before its first `{`.
 *
 * A block with no `{` is not a rule and gets an EMPTY head rather than its whole
 * body: searching a body for a class name matches the class named in a comment,
 * which is how a sweep quietly grows a population it was never meant to judge.
 */
const selectorHead = (block: string) => {
  const brace = block.indexOf("{");
  return brace === -1 ? "" : block.slice(0, brace);
};

/** The declared block for one CSS rule, so an arm reads a rule and not a file. */
const rule = (css: string, selector: string) => {
  const at = css.indexOf(`${selector} {`);
  expect(at, `${selector} must exist to be read`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
};

describe("the hero column is three parts, not a centred stack (§2a)", () => {
  it("the copy column does not centre its content", async () => {
    const css = await read(CSS);
    const copy = rule(css, ".dpc-hero__copy");
    expect(copy).toContain("flex-direction: column");
    /*
      ⚠ THE DEFECT HE FILED THE CARD ABOUT. A centred stack of ~277px inside a
      452px card put all its slack above and below the content at once, so the
      column floated while the deck beside it read full.
    */
    expect(copy, "the centred stack is the defect this section exists to remove").not.toContain(
      "justify-content: center",
    );
  });

  it("the matcher would see a centred stack", () => {
    expect(".dpc-hero__copy {\n  justify-content: center;\n").toContain("justify-content: center");
  });

  it("the spacer is a real element with a floor, and the ask group is flex: none", async () => {
    const css = await read(CSS);
    const air = rule(css, ".dpc-hero__air");
    expect(air).toContain("flex: 1");
    // Without this the two groups touch on a short card, which `flex: 1` alone cannot prevent.
    expect(air).toContain("min-height");
    const page = code(await read(PAGE));
    expect(page).toContain('className="dpc-hero__air"');
    expect(page).toContain('className="dpc-hero__pitch"');
    expect(page).toContain('className="dpc-hero__ask"');
  });

  it("NO auto margin exists in either surface", async () => {
    const css = await read(CSS);
    /*
      His §4, and briefs 05/06/07/09 give the same reason: any computed-style
      read resolves an auto margin to hard pixels, which then overflows a
      wrapping row and is clipped by `.dpc-hero`'s `overflow: hidden`. The live
      layout is fine and every screenshot and export is broken — so this is
      checked mechanically rather than by looking, because looking is exactly
      what does not catch it.

      Scoped to the two surfaces this brief owns; the rest of the file is other
      sections' business.

      ⚠ **THE PREFIX IS MATCHED ANYWHERE IN THE SELECTOR LIST, NOT ONLY AT THE
      START, AND THAT WAS A REAL BLIND SPOT** (caught by the second PR review).
      The first shape of this walk asked `startsWith`, so a COMPOUND selector
      slipped past it — including `.dp-field.dpc-hero__field.dpc-briefrow`,
      **a rule this very brief added, on the surface this ban governs.** An auto
      margin added there would have shipped green through the one arm written to
      stop it, with the live layout fine and every export clipped: the exact
      defect, invisible in the exact way, past the exact guard.

      So the selector list is cut at the first `{` and searched — a prefix in
      `a.b.dpc-hero__c`, in `.x, .dpc-hero__y`, or at the start all count.
    */
    for (const prefix of [".dpc-hero__", ".dpc-setm__"]) {
      const blocks = css
        .split(/(?=\n\.)/)
        .filter((block) => selectorHead(block).includes(prefix));
      expect(blocks.length, `no ${prefix} rules found — the walk proves nothing`).toBeGreaterThan(5);
      for (const block of blocks) {
        const body = block.replace(/\/\*[\s\S]*?\*\//g, "");
        expect(body, `${prefix}: an auto margin is clipped in every export`).not.toMatch(
          /margin[^:]*:\s*[^;]*\bauto\b/,
        );
      }
    }
  });

  it("the matcher would see an auto margin", () => {
    expect("  margin-top: auto;").toMatch(/margin[^:]*:\s*[^;]*\bauto\b/);
    expect("  margin-left: auto;").toMatch(/margin[^:]*:\s*[^;]*\bauto\b/);
  });

  it("the walk REACHES the compound selectors, which it used to skip", async () => {
    const css = await read(CSS);
    /*
      ⚠ **THIS ARM IS THE FIX, NOT A RESTATEMENT OF IT.** Widening the filter
      above is invisible in a passing suite — the arm was green before the
      widening and is green after. So the population itself is asserted: the
      compound rule this brief added must be IN the swept set, by name.
    */
    const swept = css
      .split(/(?=\n\.)/)
      .filter((block) => selectorHead(block).includes(".dpc-hero__"));
    const compound = swept.filter((block) =>
      selectorHead(block).includes(".dp-field.dpc-hero__field.dpc-briefrow"),
    );
    expect(
      compound.length,
      "the hero's own compound brief-row rule must be inside the auto-margin walk",
    ).toBe(1);
  });

  it("a `startsWith` walk would MISS that rule — the review's finding, driven", async () => {
    const css = await read(CSS);
    /*
      THE NEGATIVE CONTROL FOR THE ARM ABOVE. It re-runs the OLD filter and
      proves it comes up empty on the same rule, so "the widening changed
      something" is a measurement rather than a claim about a diff.
    */
    const oldWalk = css
      .split(/(?=\n\.)/)
      .filter((block) => block.trimStart().startsWith(".dpc-hero__"));
    const missed = oldWalk.filter((block) =>
      selectorHead(block).includes(".dp-field.dpc-hero__field.dpc-briefrow"),
    );
    expect(
      missed.length,
      "if the old walk already saw this rule, the widening fixed nothing and this arm is theatre",
    ).toBe(0);
  });
});

describe("the receipt line is derived, never typed (§2d)", () => {
  it("every value comes from the server's own roll constants", async () => {
    const page = code(await read(PAGE));
    expect(page).toContain("dpc-hero__receipt");
    expect(page).toContain("config.data.candidatesPerRoll");
    expect(page).toContain("config.data.rollTypicalSeconds");
    expect(page).toContain("config.data.rollPriceCredits");
  });

  it("the line carries no hand-written count, price or duration", async () => {
    const page = await read(PAGE);
    const at = page.indexOf('<p className="dpc-hero__receipt">');
    expect(at, "the receipt line must exist to be read").toBeGreaterThan(-1);
    const block = code(page.slice(at, page.indexOf("</p>", at)));
    /*
      His rule: *"A hand-written price that disagrees with the charge does the
      opposite of what this line is for."* His own brief's example read `4 CR`
      while a roll charges 160, which is the defect arriving in the spec itself
      — so the arm is on the SHIPPED markup, not on the brief.
    */
    expect(block, "a literal on this line is the one thing it may not carry").not.toMatch(/\d/);
  });

  it("the matcher would see a typed number", () => {
    expect("8 CANDIDATES · 4 CR").toMatch(/\d/);
  });

  it("a value the server did not send is absent rather than defaulted", async () => {
    const page = code(await read(PAGE));
    /*
      A `?? 40` here would put a hand-written duration back on the line through
      the door marked "default" — true of an older bundle, of a config still
      settling, and of a server that removed the field.
    */
    expect(page).toContain("rollSeconds ?");
    expect(page).not.toMatch(/rollTypicalSeconds\s*\?\?/);
  });

  it("the duration constant is a measurement carrying its date", async () => {
    const source = await readFile(
      new URL("../../../../server/castingV2/rollDuration.ts", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(/CASTING_V2_ROLL_TYPICAL_SECONDS\s*=\s*\d+/);
    // A number with no reading behind it is the thing this file exists to avoid.
    expect(source).toContain("MEDIAN");
    expect(source).toMatch(/n = 234|234/);
  });
});

describe("the brief box shows no scroll widget at rest (§2c)", () => {
  it("overflow-y is switched where the height is switched", async () => {
    const field = code(await read(FIELD));
    expect(field).toContain("field.style.overflowY");
    /*
      His instruction is *"Set it in the same place you set the height"*, and the
      reason is that the measure only runs on change — a resting value of `auto`
      in the stylesheet shows a widget on a box nobody has typed into.
    */
    expect(field).toMatch(/field\.style\.overflowY\s*=\s*natural > field\.clientHeight/);
    expect(field).toContain('field.style.overflowY = "hidden"');
  });
});

/*
  ⚠ **THE REGRESSION THESE ARMS EXIST FOR WAS CAUGHT BY THE PR #483 REVIEWER,
  AFTER EVERY SUITE IN THIS FILE WAS GREEN.**

  Switching the widget where the height is switched (the arm above) is his
  instruction and is right — but it made the inline `hidden` authoritative over
  the stylesheet's resting `overflow-y: auto`, and the measure only re-ran on a
  VALUE change. So narrowing the window rewrapped the same sentence taller inside
  a box still fixed at its old height, with the widget this component had just
  turned off. Measured on :3021 before the fix: at 251px the box painted **66px
  of a 124px brief** — about half the sentence unreachable, no scrollbar, no
  wheel-scroll — on the control whose whole purpose is *a brief you can read
  before you pay for it*. A 418-character brief narrowed past the cap was worse:
  202px of content in a 124px box.

  # What these arms can and cannot prove

  There is no render harness in this client (no jsdom, no testing-library), and
  jsdom has no layout to measure even if there were — so these are SOURCE arms
  and they cannot execute the behaviour. **The behaviour was proven by driving
  the real app**, with the pre-fix file put back to confirm the driver goes red
  (both arms clipped) and the fixed file to confirm it goes green — recorded in
  `docs/specs/CASTING_HERO_435_EVIDENCE.md`. These arms pin the three structural
  facts that fix depends on, each of which could be "simplified" away by someone
  who never sees the defect.
*/
/* The card is PR #483's review finding 1 — named here, in a comment, because
   the token guard reads a `#` followed by three hex digits in a STRING as a
   colour literal and is right to (`#483` is a valid hex). It strips comments. */
describe("the brief box survives a resize, not only a keystroke", () => {
  it("one function does the measuring, and both paths call it", async () => {
    const field = code(await read(FIELD));
    /*
      DERIVE, NEVER MIRROR. Two copies of this measurement — one on the value
      path, one on the resize path — is working law 4, and they would drift at
      the first change to either.
    */
    expect(field).toMatch(/function fitToContent\(/);
    const calls = field.match(/fitToContent\(field\)/g) ?? [];
    expect(
      calls.length,
      "both the value path and the resize path must call the one measure",
    ).toBeGreaterThanOrEqual(2);
  });

  it("the measurement is re-run when the box is resized, not only re-typed", async () => {
    const field = code(await read(FIELD));
    expect(field).toContain("new ResizeObserver");
    expect(field).toContain("observer.observe(field)");
    /*
      Set up and torn down: an observer left connected after unmount holds the
      node and calls into a dead component.
    */
    expect(field).toContain("observer.disconnect()");
  });

  it("it re-measures on a WIDTH change only — the guard that stops it looping", async () => {
    const field = code(await read(FIELD));
    /*
      ⚠ **THIS IS THE ARM WORTH HAVING.** `fitToContent` writes the field's own
      height, so an observer that re-measured on ANY size change would retrigger
      itself without end — and `main.tsx` silences `ResizeObserver loop` warnings
      globally, so it would run hot in production with nothing in the console to
      show it. Border-box width is the one dimension this component never writes,
      and (unlike `clientWidth`) it does not move when a scrollbar appears, so a
      change in it is always someone else's news.
    */
    expect(field).toMatch(/borderBoxSize/);
    expect(field).toMatch(/inlineSize/);
    expect(
      field,
      "the observer must compare the width before re-measuring, or it feeds itself",
    ).toMatch(/if\s*\(\s*width === lastWidth\s*\)\s*return/);
    expect(
      field,
      "clientWidth shrinks when a scrollbar appears, which is a width change this component caused",
    ).not.toMatch(/inlineSize\s*\?\?\s*field\.clientWidth/);
  });

  it("the matchers would see each of those three removed", () => {
    /*
      POSITIVE CONTROLS. Every arm above is an assertion about text that is
      present; these prove the same matchers fire on the shapes that should
      trip them, so a green arm above is a reading and not an absence.
    */
    const noObserver = `
      useLayoutEffect(() => { const field = ref.current; if (field) fitToContent(field); }, [value]);
    `;
    expect(noObserver).not.toContain("new ResizeObserver");

    const unguarded = `
      const observer = new ResizeObserver(() => { fitToContent(field); });
    `;
    expect(unguarded).not.toMatch(/if\s*\(\s*width === lastWidth\s*\)\s*return/);

    const clientWidthFallback = `
      const width = entries[0]?.borderBoxSize?.[0]?.inlineSize ?? field.clientWidth;
    `;
    expect(clientWidthFallback).toMatch(/inlineSize\s*\?\?\s*field\.clientWidth/);

    const inlinedTwice = `
      useLayoutEffect(() => { field.style.height = "auto"; }, [value]);
      const observer = new ResizeObserver(() => { field.style.height = "auto"; });
    `;
    expect(inlinedTwice).not.toMatch(/function fitToContent\(/);
  });
});

describe("the brief box's cap agrees with its own units", () => {
  /*
    ⚠ THE DEFECT THIS ARM EXISTS FOR SHIPPED IN THIS SECTION'S FIRST COMMIT AND
    WAS CAUGHT IN REVIEW. The cap read `calc(7 * 1.45em)` — inherited from the
    shared box — while a SECOND rule set this box to `13px/1.5` with 7px of
    vertical padding. `em` resolves against font-size, so the cap computed to
    131.95px where seven lines need 143.5px: it held 6.4 lines and clipped the
    seventh mid-glyph, which is the exact defect #375 measured and fixed.

    It survived a drive, too. The probe read `scrollHeight` 144 against
    `clientHeight` 132 at the cap and that WAS the scroll widget's positive
    control firing — the same measurement was also the defect, and nothing in
    the reading said which of the two it was.

    So the arm is not "the cap is 7 lines"; it is that the three numbers which
    have to agree are declared TOGETHER. Split them and they drift again.
  */
  it("the cap, the font and the padding are declared in one rule", async () => {
    const css = await read(CSS);
    const hero = rule(css, ".dpc-hero__field .dpc-brieffield");
    expect(hero).toContain("max-height");
    expect(hero, "a cap in em is meaningless without the line-height beside it").toContain("font:");
    expect(hero).toContain("padding:");
    const lineHeight = hero.match(/font:[^;]*\/([\d.]+)/)?.[1];
    const capMultiplier = hero.match(/max-height:\s*calc\(7\s*\*\s*([\d.]+)em/)?.[1];
    expect(lineHeight, "the hero box must declare its line-height").toBeTruthy();
    expect(capMultiplier, "the cap must be seven lines of something").toBeTruthy();
    // The cap's multiplier IS the line-height, or the cap is not seven lines.
    expect(capMultiplier).toBe(lineHeight);
    // …and the padding it adds back is the padding it declares.
    // `0` is unitless in this rule, so the middle value must not demand `px`.
    const pad = hero.match(/padding:\s*(\d+)px\s+[\d.]+(?:px)?\s+(\d+)px/);
    expect(pad, "the padding must be readable to be added back").toBeTruthy();
    const declared = Number(pad![1]) + Number(pad![2]);
    expect(hero).toContain(`+ ${declared}px`);
  });

  it("only ONE rule sets this box's cap", async () => {
    const css = await read(CSS);
    // Two rules for one box is how the units came apart in the first place.
    const hits = css.split(".dpc-hero__field .dpc-brieffield").length - 1;
    expect(hits, "a second rule for this box is the drift, not a tidy-up").toBe(1);
  });
});

describe("the settings modal (§3)", () => {
  it("the card claims its height and does not content-size", async () => {
    const css = await read(CSS);
    const card = rule(css, ".dpc-setm__card");
    // His §4: a content-sized card stops short and leaves height unused while the preview shrinks.
    expect(card).toContain("height: 100%");
    expect(card).toContain("max-height: 524px");
  });

  it("the action is never inside the scrolling region", async () => {
    const css = await read(CSS);
    expect(rule(css, ".dpc-setm__body")).toContain("overflow-y: auto");
    // Header and footer sit outside it, so `Done` can never be below a fold.
    expect(rule(css, ".dpc-setm__head")).toContain("flex: none");
    expect(rule(css, ".dpc-setm__foot")).toContain("flex: none");
    const modal = code(await read(MODAL));
    const body = modal.slice(modal.indexOf('"dpc-setm__body"'), modal.indexOf('"dpc-setm__foot"'));
    expect(body, "the body must be a real region to be judged").toContain("dpc-setm__col");
    expect(body).not.toContain("dpc-setm__done");
  });

  it("the two min-heights under the carousel survive", async () => {
    const css = await read(CSS);
    /*
      ⚠ His §4 forbids dropping these by name. Without them the flex stage
      absorbs their variance and the preview card resized 18% every step — *"a
      comparison surface whose subjects change size as you step through them has
      no comparison left."* Measured after this landed: 158.75px across two full
      laps of the carousel.
    */
    expect(rule(css, ".dpc-setm__desc")).toContain("min-height: 38px");
    expect(rule(css, ".dpc-setm__act")).toContain("min-height: 26px");
  });

  it("the stage flexes and is never given a fixed or viewport height", async () => {
    const css = await read(CSS);
    const stage = rule(css, ".dpc-setm__stage");
    expect(stage).toContain("flex: 1 1 0");
    // `container-type: size` is what makes 100cqh mean this box rather than the window.
    expect(stage).toContain("container-type: size");
    /*
      His §4 rules out both a fixed pixel height AND a `vh` one — the latter asks
      for a second independent viewport fraction that only pays out above
      ~1130px of window.
    */
    expect(stage).not.toMatch(/(?<!min-|max-)height:\s*\d/);
    expect(stage).not.toContain("vh");
  });

  it("the matcher would see a fixed stage height", () => {
    expect("  height: 240px;").toMatch(/(?<!min-|max-)height:\s*\d/);
  });

  it("there is no nav column and no third setting", async () => {
    const modal = code(await read(MODAL));
    expect(modal).toContain("dpc-setm__col--style");
    expect(modal).toContain("dpc-setm__col--mind");
    // §3a retired the nav on a measurement: 182px of a 724px modal to switch between two things.
    expect(modal).not.toMatch(/dpc-setm__nav|role="tablist"/);
    // §3e: no candidate count, no advanced section, no trait controls.
    expect(modal).not.toMatch(/candidateCount|Advanced|Heritage|Build/i);
  });

  it("both imagination lines are on screen, and neither is a slider", async () => {
    const modal = code(await read(MODAL));
    // §3d: the consequence IS the decision, so a control that shows only the selected one is wrong.
    expect(modal).toContain("IMAGINATION_LINES[option]");
    expect(modal).toContain("IMAGINATIONS.map");
    expect(modal).not.toMatch(/type="range"|<Slider/);
  });

  it("a standing follow still suppresses the imagination half (the follow ruling)", async () => {
    const modal = code(await read(MODAL));
    /*
      ⚠ THE ONE BEHAVIOUR HIS BRIEF COULD NOT KNOW ABOUT. §3d writes "two cards"
      unconditionally; an anchored roll never calls the author, so drawing them
      during a follow would put a dead control back on the exact surface a
      founder ruling took one off. This arm is the whole reason the
      reconciliation happened before a line was written.
    */
    expect(modal).toContain("followHeld ?");
    const held = modal.slice(modal.indexOf("followHeld ?"));
    expect(held.slice(0, 400)).toContain("dpc-setm__held");
  });
});

describe("what the hero must NOT grow back (§2f)", () => {
  it("no TRY chips and no candidate-count selector", async () => {
    const page = code(await read(PAGE));
    expect(page, "the page must be readable for this to mean anything").toContain("dpc-hero");
    /*
      #375 removed the chips: a deck card already fills the box with a REAL
      brief, so a chip was a second mechanism for one job. And eight is the
      promise, not a parameter — *"every decision placed before the button is a
      reason not to press it."*
    */
    expect(page).not.toMatch(/dpc-hero__try|TRY_SEEDS|candidateCount/);
  });

  it("the settings control wears no chevron and is not a pill", async () => {
    const css = await read(CSS);
    const chip = rule(css, ".dpc-setbtn");
    // A chevron-down means "a list drops from here"; this opens a modal.
    expect(chip).toContain("border-radius: var(--r-sm)");
    expect(chip).not.toContain("--r-chip");
    const modal = code(await read(MODAL));
    const button = modal.slice(modal.indexOf('className="dpc-setbtn"'));
    expect(button.slice(0, 700)).not.toMatch(/ChevronDown|dp-chevron/);
  });

  /*
    #552, his report: *"the settings card on the casting sheet prompt box is
    stretching fullwidth?"* — `.dp-dock` is a column flex, whose cross-axis
    default is `stretch`, so the chip was pulled to the dock's whole width.

    The arm reads the DOCK's own direction rather than trusting the chip's rule
    alone: the defect is a RELATIONSHIP between two files, and pinning only the
    chip would stay green if the dock later became a row and some other surface
    a column. If `.dp-dock` stops being a column this arm should be re-read,
    which is what its message says.
  */
  it("the settings chip hugs its content inside the dock's column", async () => {
    const css = await read(CSS);
    const chip = rule(css, ".dpc-setbtn");
    expect(chip, "the .dpc-setbtn rule must be readable for this to mean anything").toBeTruthy();

    const foundation = await read(new URL("../../foundation/foundation.css", import.meta.url));
    const dock = rule(foundation, ".dp-dock");
    expect(dock, ".dp-dock must be readable for this to mean anything").toBeTruthy();
    expect(
      dock,
      "the dock is no longer a column — re-read #552 before trusting the arm below",
    ).toContain("flex-direction: column");

    expect(
      chip,
      "a column flex child with an auto cross size is stretched to the container's width",
    ).toContain("width: fit-content");

    /*
      ⚠ AND NOT `align-self`, which is the tempting fix and reaches a surface
      the bug was never on: the same button mounts inside `.dpc-hero__actions`,
      a ROW with `align-items: center`, where `align-self: flex-start` moves it
      from vertically centred to top-aligned.
    */
    const heroActions = rule(css, ".dpc-hero__actions");
    expect(heroActions, ".dpc-hero__actions must be readable").toContain("align-items: center");
    expect(
      chip,
      "align-self acts on the cross axis, which is horizontal in the dock and VERTICAL in the hero row",
    ).not.toContain("align-self");
  });

  it("each door is absent, never disabled, where the server did not open it", async () => {
    const page = code(await read(PAGE));
    // D-180: a disabled control is a question with no answer wearing a tap target.
    expect(page).toContain("authorRoad || conceptUploadEnabled ?");
    expect(page).toContain("conceptUploadEnabled ? (");
    const actions = page.slice(page.indexOf('className="dpc-hero__actions"'));
    expect(actions.slice(0, 900)).not.toContain("disabled");
  });
});
