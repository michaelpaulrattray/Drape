/**
 * THE MECHANISED DESIGN LAWS — the assertions themselves, on their own.
 *
 * The UI milestone completion contract (founder, 2026-08-01) says the
 * mechanizable design laws live "as browser-drive assertions in the suite, not
 * as review memory". This is that suite. Every law here is one that was
 * actually broken once and caught by eye — which is exactly the kind of thing
 * that should never depend on an eye again.
 *
 *   1. No focus outline on a text field's inner element. The token layer draws
 *      a blanket `:focus-visible` ring so nothing can be focus-invisible; on a
 *      text field that lands around the *text* instead of the control. Focus
 *      belongs to the wrapper: caret + border shift.
 *   2. The dock is visible without scrolling, and stays visible at the bottom
 *      of the page. A dock you have to scroll to find is not a dock.
 *   3. No mono type on sentences. Mono is for machine facts — counts, ids,
 *      timestamps, eyebrows. A sentence set in mono reads as output, not as
 *      writing.
 *   4. Every paid button states its price. D-15: the cost is visible on the
 *      affordance, never behind a confirm step.
 *   5. Retention is stated wherever unsigned sheets surface.
 *   6. A refused brief never hangs: skeletons never sit under failure copy.
 *   7. An over-media chip is dark glass, and is never hover-only.
 *   8. The brief echo is a sentence, and every fact in it is reachable.
 *   9. One click, one optimistic transaction — chrome included. (Destructive.)
 *
 * WHY THEY LIVE HERE RATHER THAN IN THE DRIVER (#512). They now have two
 * callers: the walk over the real app, and the positive controls that prove
 * each law can still FAIL. A control that reimplements the law it is checking
 * proves only that two pieces of code agree — the transcription makes the
 * catching assertion unwritable and then reads as coverage. So the control
 * drives THESE BYTES against a synthetic page, and there is exactly one
 * definition of each law in the tree.
 *
 * EVERY CHECK RECORDS WHAT IT SAW (D-235). An affirmative with no observation
 * behind it is not a reading, and this suite has been caught passing vacuously
 * twice. `LawLog.check` therefore takes the observation, not just the verdict.
 */
import type { Page } from "puppeteer-core";

import type { ExistentialSubject } from "./designLawSurfaces.mts";

export type Observation = {
  surface: string;
  law: string;
  /** true = held, false = violated, null = the law's subject is not here. */
  ok: boolean | null;
  /** What was actually measured. Never empty. */
  saw: string;
};

/**
 * The collector.
 *
 * `notApplicable` is the honest third state and it is deliberately NOT a pass:
 * a surface with no dock has not satisfied the dock law, it has no dock. The
 * run reports the three counts separately so "18 held" can never be read off a
 * page where nothing was measured.
 */
export class LawLog {
  readonly observations: Observation[] = [];

  constructor(private readonly onEach?: (o: Observation) => void) {}

  private record(o: Observation) {
    this.observations.push(o);
    this.onEach?.(o);
  }

  check(surface: string, law: string, ok: boolean, saw: string) {
    if (!saw) throw new Error(`LawLog: "${law}" recorded no observation — see D-235.`);
    this.record({ surface, law, ok, saw });
  }

  notApplicable(surface: string, law: string, saw: string) {
    this.record({ surface, law, ok: null, saw });
  }

  get failures(): Observation[] {
    return this.observations.filter((o) => o.ok === false);
  }
  get held(): Observation[] {
    return this.observations.filter((o) => o.ok === true);
  }
  get skipped(): Observation[] {
    return this.observations.filter((o) => o.ok === null);
  }
}

/**
 * Resolve an existential law's absent subject against the surface's contract.
 *
 * On a surface that DECLARES it holds the subject, absence is the defect. This
 * is the whole of the "declared per surface, never skipped silently" rule, and
 * it is the difference between the old drive printing `-- no dock on this
 * surface` for a dock that had vanished from `/casting` and this one failing.
 */
function absentSubject(
  log: LawLog,
  surface: string,
  law: string,
  subject: ExistentialSubject,
  requires: ExistentialSubject[] | undefined,
  saw: string,
) {
  if (requires?.includes(subject)) {
    log.check(surface, law, false, `${saw} — but this surface declares it holds a ${subject}`);
  } else {
    log.notApplicable(surface, law, saw);
  }
}

/**
 * The input types that are CONTROLS rather than text, and therefore keep the
 * blanket accent ring.
 *
 * This is not a list invented here. `client/src/foundation/tokens.css` defines
 * text entry by excluding exactly these nine types from its focus carve-out,
 * and `designLawTextEntry.test.ts` parses that rule and reddens if the two ever
 * disagree — so the law follows the stylesheet rather than shadowing it.
 */
export const CONTROL_INPUT_TYPES = [
  "checkbox",
  "radio",
  "range",
  "file",
  "button",
  "submit",
  "reset",
  "color",
  "image",
] as const;

/** Every control the product's own stylesheet treats as text entry. */
export const TEXT_ENTRY_SELECTOR = [
  "textarea",
  `input${CONTROL_INPUT_TYPES.map((t) => `:not([type="${t}"])`).join("")}`,
].join(", ");

/** Law 1. Focus a field, let the transition settle, read the inner element. */
export async function assertNoInnerFocusRing(page: Page, where: string, log: LawLog) {
  /*
    EVERY text field, and "text field" means what the STYLESHEET means by it.

    Two rounds of this law were written as an allow-list and each one let the
    next control through. It began as `.dp-input` alone, and the casting room's
    inline rename — a bare styled <input> — carried a red focus ring for a whole
    milestone underneath it. That was widened to `.dp-input, input[type=text],
    input:not([type]), textarea`, which is a longer allow-list and has exactly
    the same shape of hole: measured against the running app, EVERY staff search
    box is `<input type="search">`, so `/admin/users` — the control the founder
    actually complained about in #445 — reported "no text fields on this
    surface" and passed.

    The fix is to stop enumerating what counts and derive it from the rule that
    decides: `tokens.css` excludes nine CONTROL types from its text-entry
    carve-out, and everything else is text. A guard holds the two together.
  */
  const fields = await page
    .$$eval(TEXT_ENTRY_SELECTOR, (els) =>
      els.filter((el) => {
        /* A field with no box cannot be looked at, and focusing it measures
           nothing — a hidden input would otherwise report a clean pass. */
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).length,
    )
    .catch(() => 0);
  if (fields === 0) {
    /* Universal, so this is genuinely satisfied rather than unmeasured — but it
       is still recorded as unmeasured, because "no fields" and "every field
       passed" are different facts and only one of them is evidence. */
    log.notApplicable(where, "no inner focus ring", "no text fields on this surface");
    return;
  }
  for (let i = 0; i < fields; i += 1) {
    const result = await page.evaluate(
      async ([selector, index]: [string, number]) => {
      const input = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })[index];
      if (!input) return null;
      input.focus();
      // border-color is transitioned; reading in the same tick returns the
      // pre-transition value and reports a false failure.
      await new Promise((r) => setTimeout(r, 320));
      const cs = getComputedStyle(input);
      // A ring can be drawn as a box-shadow just as easily as an outline.
      const shadow = cs.boxShadow;
      return {
        name: input.getAttribute("aria-label") ?? input.getAttribute("placeholder") ?? `#${index}`,
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
        boxShadow: shadow === "none" ? null : shadow,
      };
      },
      [TEXT_ENTRY_SELECTOR, i] as [string, number],
    );
    if (!result) continue;

    const outlined = result.outlineStyle !== "none" && result.outlineWidth !== "0px";
    const shadowed = Boolean(result.boxShadow);
    log.check(
      where,
      `no inner focus ring: ${result.name}`,
      !outlined && !shadowed,
      outlined
        ? `focused, outline ${result.outlineStyle} ${result.outlineWidth}`
        : shadowed
          ? `focused, box-shadow ${result.boxShadow}`
          : "focused, outline none and no box-shadow",
    );
  }
}

/** Law 2. The dock is on screen at load, and still on screen at page bottom. */
export async function assertDockVisible(
  page: Page,
  where: string,
  log: LawLog,
  requires?: ExistentialSubject[],
) {
  const atLoad = await page.evaluate(() => {
    const dock = document.querySelector(".dp-dock");
    if (!dock) return null;
    const r = dock.getBoundingClientRect();
    return { onScreen: r.top < window.innerHeight && r.bottom > 0, top: Math.round(r.top) };
  });
  if (atLoad === null) {
    absentSubject(log, where, "dock visible without scrolling", "dock", requires, "no .dp-dock in the document");
    return;
  }
  log.check(
    where,
    "dock visible without scrolling",
    atLoad.onScreen,
    `dock top ${atLoad.top}px at load`,
  );

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 500));
  const atBottom = await page.evaluate(() => {
    const el = document.querySelector(".dp-dock");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { onScreen: r.top < window.innerHeight && r.bottom > 0, top: Math.round(r.top) };
  });
  if (atBottom !== null) {
    log.check(
      where,
      "dock still visible at page bottom",
      atBottom.onScreen,
      `dock top ${atBottom.top}px after scrolling to the bottom`,
    );
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

/**
 * Law 3. No mono on sentences.
 *
 * "A sentence" is approximated as visible text with several words that ends in
 * sentence punctuation, or is long enough that it cannot be a label. Eyebrows,
 * counts, ids and index labels are all short and unpunctuated, so they pass.
 */
export async function assertNoMonoSentences(page: Page, where: string, log: LawLog) {
  const result = await page.evaluate(() => {
    const bad: string[] = [];
    let sentences = 0;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      if (el.children.length > 0) continue;
      /*
        ONLY WHAT IS ACTUALLY PAINTED.

        `*` reaches <script>, <style>, <title> and <noscript>, whose text is
        long, childless and unpunctuated-but-wordy — so every one of them was
        being counted as a sentence. The 404 page, 114 characters of visible
        copy, reported "16 sentences read"; that number is the observation this
        law offers as its evidence, and it was measuring the stylesheet. None of
        them can be set in mono, so the law never misfired — it just could not
        be believed, which is the same defect one step earlier.
      */
      if (/^(SCRIPT|STYLE|TITLE|NOSCRIPT|TEMPLATE|META|LINK|HEAD)$/.test(el.tagName)) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (getComputedStyle(el).visibility === "hidden") continue;
      /*
        Eyebrows and chrome labels are mono BY DESIGN — they are the machine
        register the law reserves mono for, not prose that wandered into it.
        Exempting them by class is exact; exempting by word count would also
        excuse the real offenders.
      */
      if (el.classList.contains("dp-eyebrow") || el.classList.contains("dp-chrome")) continue;
      const text = (el.textContent ?? "").trim();
      if (!text) continue;
      const words = text.split(/\s+/).length;
      const sentenceish = words >= 5 || /[.!?]$/.test(text);
      if (!sentenceish) continue;
      sentences += 1;
      const font = getComputedStyle(el).fontFamily.toLowerCase();
      if (font.includes("mono")) bad.push(text.slice(0, 70));
    }
    return { bad, sentences };
  });
  if (result.sentences === 0) {
    log.notApplicable(where, "no mono type on sentences", "no sentence-length text on this surface");
    return;
  }
  log.check(
    where,
    "no mono type on sentences",
    result.bad.length === 0,
    result.bad.length === 0
      ? `${result.sentences} sentence(s) read, none set in mono`
      : `${result.bad.length} of ${result.sentences} in mono: ${result.bad.join(" | ")}`,
  );
}

/**
 * Law 4. Paid buttons state their price.
 *
 * Keyed on the verbs that spend. A button in a pending state ("Rolling...",
 * "Casting...") is exempt: it has already been paid for and is reporting, not
 * offering.
 */
export async function assertPricedButtons(page: Page, where: string, log: LawLog) {
  const result = await page.evaluate(() => {
    /*
      `sign` MEANS SIGNING A CAST TO THE ROSTER, NEVER SIGNING IN OR OUT.

      This read `/^sign\b/i` and was written when the drive only ever visited
      three casting addresses. It now walks `/login`, the lobby, the studio and
      nine staff pages, every one of which can render a "Sign out" — and
      "Sign in", "Sign in with Email" and "Sign out" all match `sign\b`. Each
      would be reported as a paid button with no price, on pages that sell
      nothing. A law that reddens on correct pages is one people learn to
      ignore, which is the same failure as no law at all.

      ⚠ AND THE WORD BOUNDARY STAYS. The first repair here dropped it in favour
      of the lookahead alone, and immediately caught "Signed" — the roster
      filter pill on /casting and on the specimen gallery — which the original
      `\b` had always excluded. Driven in both themes and caught before it
      shipped. So: a boundary after the verb, AND the three labels that are not
      a purchase.
    */
    const PAID = [/^cast it/i, /^roll again/i, /^sign\b(?!\s*(in|out|up)\b)/i];
    const PENDING = [/^casting/i, /^rolling/i, /^signing/i];
    const bad: string[] = [];
    let seen = 0;
    for (const b of Array.from(document.querySelectorAll("button"))) {
      const label = (b.innerText ?? "").trim();
      if (!label || PENDING.some((p) => p.test(label))) continue;
      if (!PAID.some((p) => p.test(label))) continue;
      seen += 1;
      // A price is a number followed by the credit unit.
      if (!/\d+\s*cr\b/i.test(label)) bad.push(label);
    }
    return { bad, seen };
  });
  if (result.seen === 0) {
    log.notApplicable(where, "every paid button states its price", "no paid buttons on this surface");
    return;
  }
  log.check(
    where,
    "every paid button states its price",
    result.bad.length === 0,
    result.bad.length === 0
      ? `${result.seen} paid button(s), all priced`
      : `${result.bad.length} of ${result.seen} unpriced: ${result.bad.join(" | ")}`,
  );
}

/**
 * Law 5. Retention is stated wherever unsigned sheets surface.
 *
 * A sheet that quietly disappears after a week is a worse surprise than one
 * that said so. Only asserted where the section actually renders.
 */
export async function assertRetentionStated(
  page: Page,
  where: string,
  log: LawLog,
  requires?: ExistentialSubject[],
) {
  /*
    Wait for the section rather than sampling once. `openSessions` is a query;
    checking before it resolves reports "no section here" and passes without
    having tested anything — the vacuous pass this suite exists to prevent.
  */
  await page
    .waitForFunction(() => /unsigned sheets/i.test(document.body.innerText), { timeout: 6000 })
    .catch(() => undefined);

  const result = await page.evaluate(() => {
    const text = document.body.innerText;
    if (!/unsigned sheets/i.test(text)) return null;
    return /7 quiet days/i.test(text);
  });
  if (result === null) {
    absentSubject(
      log,
      where,
      "retention stated where sheets surface",
      "retentionCopy",
      requires,
      "no unsigned-sheets section rendered within 6s",
    );
    return;
  }
  log.check(
    where,
    "retention stated where sheets surface",
    result,
    result ? "unsigned-sheets section states the 7 quiet days" : "unsigned-sheets section with no expiry copy",
  );
}

/**
 * Law 6. A refused brief never hangs.
 *
 * The founder's anime brief was refused server-side — correctly, and for free
 * — and the sheet showed eight skeletons that waited forever. The law is that
 * a failure always resolves to copy with an action.
 */
export async function assertNoOrphanSkeletons(page: Page, where: string, log: LawLog) {
  const result = await page.evaluate(() => {
    const skeletons = document.querySelectorAll(".dp-skeleton").length;
    const hasFailureCopy = /can't be cast|didn't start/i.test(document.body.innerText);
    return { skeletons, hasFailureCopy };
  });
  // Skeletons and a failure message must never coexist: one of them is lying.
  log.check(
    where,
    "skeletons never sit under a failure message",
    !(result.skeletons > 0 && result.hasFailureCopy),
    `${result.skeletons} skeleton(s), failure copy ${result.hasFailureCopy ? "present" : "absent"}`,
  );
}

/**
 * Law 7. An over-media chip is dark glass, and is never hover-only.
 *
 * Two failures in one control. The foundation measured translucent *white*
 * chips at ~2.5:1 against white glyphs on light imagery — below the 3:1 floor
 * — so the fill has to be dark. And a control revealed on hover has to survive
 * having no hover: it must carry a real accessible name and be reachable by
 * keyboard, or it does not exist on a phone or to a screen reader.
 */
export async function assertOverMediaChips(page: Page, where: string, log: LawLog) {
  const result = await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll<HTMLElement>(".dp-btn--onmedia"));
    if (chips.length === 0) return null;
    return chips.map((chip) => {
      const style = getComputedStyle(chip);
      const rgb = style.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [255, 255, 255];
      const [r, g, b] = rgb;
      return {
        label: chip.getAttribute("aria-label") ?? chip.textContent?.trim() ?? "",
        // Relative luminance is overkill here: the rule is "dark glass", and a
        // white chip fails on any of the three channels being high.
        light: r > 140 && g > 140 && b > 140,
        focusable: chip.tabIndex >= 0 && !chip.hasAttribute("aria-hidden"),
      };
    });
  });
  if (result === null) {
    log.notApplicable(where, "over-media chips are dark glass", "no .dp-btn--onmedia on this surface");
    return;
  }
  const pale = result.filter((chip) => chip.light);
  log.check(
    where,
    "over-media chips are dark glass",
    pale.length === 0,
    `${result.length} chip(s), ${pale.length} translucent-white`,
  );
  const unreachable = result.filter((chip) => !chip.focusable || chip.label.length === 0);
  log.check(
    where,
    "over-media chips are named and keyboard-reachable",
    unreachable.length === 0,
    `${result.length} chip(s), ${unreachable.length} unnamed or not focusable`,
  );
}

/**
 * Law 8. The brief echo is a sentence, and every fact in it is reachable.
 *
 * The echo replaced a row of pills, and the two ways it could quietly become a
 * pill row again are a fact getting chip clothing (a background or a border) and
 * the two-layer contrast collapsing so nothing scans. The third failure is the
 * one the mock actually shipped: an underlined word that is not a button, which
 * a founder clicks and nothing happens.
 */
export async function assertBriefEcho(
  page: Page,
  where: string,
  log: LawLog,
  requires?: ExistentialSubject[],
) {
  const result = await page.evaluate(() => {
    const echo = document.querySelector<HTMLElement>(".dpc-echo");
    if (!echo) return null;
    const triggers = Array.from(echo.querySelectorAll<HTMLElement>(".dp-pop__trigger"));
    const prose = echo.querySelector<HTMLElement>(".dpc-echo__prose");
    const style = getComputedStyle(echo);
    const chipLike = triggers.filter((trigger) => {
      const own = getComputedStyle(trigger);
      const bg = own.backgroundColor;
      return (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") || own.borderTopWidth !== "0px";
    });
    return {
      triggers: triggers.length,
      unreachable: triggers.filter((t) => t.tabIndex < 0 || !t.getAttribute("aria-label")).length,
      chipLike: chipLike.length,
      layered: prose
        ? getComputedStyle(prose).color !== (triggers[0] && getComputedStyle(triggers[0]).color)
        : false,
      lines: Math.round(echo.getBoundingClientRect().height / parseFloat(style.lineHeight)),
      legacyPills: document.querySelectorAll(".dp-chip--static").length,
    };
  });
  if (result === null) {
    absentSubject(log, where, "the echo has adjustable facts", "briefEcho", requires, "no .dpc-echo on this surface");
    return;
  }
  log.check(where, "the echo has adjustable facts", result.triggers > 0, `${result.triggers} trigger(s) in the sentence`);
  log.check(
    where,
    "every fact is keyboard-reachable and named",
    result.unreachable === 0,
    `${result.unreachable} of ${result.triggers} unreachable or unnamed`,
  );
  log.check(
    where,
    "facts are underlined words, not chips",
    result.chipLike === 0,
    `${result.chipLike} of ${result.triggers} carry a background or border`,
  );
  log.check(
    where,
    "pinned facts and prose are two layers",
    result.layered,
    result.layered ? "prose and facts differ in colour" : "prose and facts share one colour",
  );
  log.check(where, "the echo never exceeds two lines", result.lines <= 2, `${result.lines} line(s)`);
  log.check(where, "the pill row is gone", result.legacyPills === 0, `${result.legacyPills} static chip(s) remain`);

  /*
    And the check that would have caught the defect the founder found.

    The first version asserted against the DOM — the options were in the
    markup, so it passed — while the sentence's `overflow: hidden` clipped the
    popover panel to a sliver on screen. Reading the tree proves a thing
    exists; only measuring proves a user can see it. So this opens a popover
    for real and compares its rendered box against every clipping ancestor.
  */
  const opened = await page.evaluate(() => {
    const trigger = document.querySelector<HTMLElement>(".dpc-echo .dp-pop__trigger");
    if (!trigger) return false;
    trigger.click();
    return true;
  });
  if (!opened) return;
  await new Promise((r) => setTimeout(r, 300));

  const visibility = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".dp-pop__panel");
    if (!el) return { open: false, options: 0, clippedBy: "none", visible: 0 };
    const box = el.getBoundingClientRect();
    let clippedBy = "none";
    for (let node = el.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflow === "visible" && style.overflowY === "visible") continue;
      const bounds = node.getBoundingClientRect();
      if (box.bottom > bounds.bottom + 1 || box.right > bounds.right + 1) {
        clippedBy = node.className || node.tagName;
        break;
      }
    }
    /*
      How many option rows are actually PAINTED.

      A clipped element still reports a full bounding box — measured that way,
      the founder's defect scored 7 of 7 visible while showing one option on
      screen. So the rect is intersected with every clipping ancestor first,
      which is what "can the user see it" actually means.
    */
    let clip = { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
    for (let node = el.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflow === "visible" && style.overflowY === "visible") continue;
      const b = node.getBoundingClientRect();
      clip = {
        top: Math.max(clip.top, b.top),
        bottom: Math.min(clip.bottom, b.bottom),
        left: Math.max(clip.left, b.left),
        right: Math.min(clip.right, b.right),
      };
    }
    const options = Array.from(el.querySelectorAll<HTMLElement>(".dp-pop__option"));
    const visible = options.filter((option) => {
      const r = option.getBoundingClientRect();
      return r.height > 0 && r.top >= clip.top - 1 && r.bottom <= clip.bottom + 1;
    }).length;
    return { open: true, options: options.length, clippedBy, visible };
  });

  log.check(where, "a fact's popover actually opens", visibility.open, visibility.open ? "panel rendered" : "no panel rendered");
  log.check(
    where,
    "the popover is not clipped by an ancestor",
    visibility.clippedBy === "none",
    visibility.clippedBy === "none" ? "no clipping ancestor" : `clipped by .${visibility.clippedBy}`,
  );
  log.check(
    where,
    "every option is on screen",
    visibility.visible === visibility.options && visibility.options > 1,
    `${visibility.visible} of ${visibility.options} option(s) inside every clip rect`,
  );
  await page.keyboard.press("Escape");
}

/**
 * Law 9. One click, one optimistic transaction — chrome included.
 *
 * D-38 says everything the client already knows updates in the click's frame.
 * The tiles did; the chrome did not. The counter still read the previous roll,
 * the rail grew no pill, and the eyebrow stayed in its resting state until the
 * poll landed 2.5 seconds later — so a single paid action produced two visible
 * moments and read as a stutter.
 *
 * Asserted by clicking Follow for real and reading the chrome back with NO
 * wait at all. A sleep here would let the poll arrive and the law would pass on
 * the server's work rather than on the client's, which is the vacuous-pass
 * failure this suite has already been caught by twice.
 *
 * Destructive — it spends credits — so it only runs with --optimistic.
 */
export async function assertOptimisticChrome(page: Page, where: string, log: LawLog) {
  const follow = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find((b) =>
      /^follow/i.test((b.innerText ?? "").trim()),
    );
    if (!button || (button as HTMLButtonElement).disabled) return null;
    const before = {
      counter: document.querySelector(".dp-metadata")?.textContent?.trim() ?? "",
      railPills: document.querySelectorAll(".dpc-rollrail__item").length,
      skeletons: document.querySelectorAll(".dp-skeleton").length,
    };
    button.click();
    return before;
  });
  if (!follow) {
    log.notApplicable(where, "one click, one optimistic transaction", "no enabled Follow on this surface");
    return;
  }

  // Read back synchronously — one animation frame, not one poll.
  const after = await page.evaluate(
    () =>
      new Promise<{ counter: string; railPills: number; provisional: number; skeletons: number; eyebrow: string }>(
        (resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              resolve({
                counter: document.querySelector(".dp-metadata")?.textContent?.trim() ?? "",
                railPills: document.querySelectorAll(".dpc-rollrail__item").length,
                provisional: document.querySelectorAll(".dpc-rollrail__item--provisional").length,
                skeletons: document.querySelectorAll(".dp-skeleton").length,
                eyebrow: document.body.innerText.match(/Casting \d+/)?.[0] ?? "",
              }),
            ),
          ),
      ),
  );

  log.check(
    where,
    "the roll counter moves in the click's frame",
    after.counter !== follow.counter && /casting/i.test(after.counter),
    `counter "${follow.counter}" -> "${after.counter}"`,
  );
  log.check(
    where,
    "the rail grows a provisional pill in the click's frame",
    after.provisional === 1 && after.railPills > follow.railPills,
    `${after.provisional} provisional, ${follow.railPills} -> ${after.railPills} pills`,
  );
  log.check(
    where,
    "the eyebrow enters its casting state in the click's frame",
    after.eyebrow.length > 0,
    after.eyebrow.length > 0 ? `eyebrow reads "${after.eyebrow}"` : "eyebrow unchanged",
  );
  log.check(where, "the tiles are skeletons in the click's frame", after.skeletons > 0, `${after.skeletons} skeleton(s)`);
}

/**
 * Every non-destructive law, in the order the drive runs them.
 *
 * Keyed so the controls can address one law by name, and so that a law added
 * here without a control is visible as a gap rather than silently uncovered.
 */
export const LAWS = [
  { key: "focus-ring", run: assertNoInnerFocusRing },
  { key: "dock", run: assertDockVisible },
  { key: "mono-sentences", run: assertNoMonoSentences },
  { key: "priced-buttons", run: assertPricedButtons },
  { key: "retention", run: assertRetentionStated },
  { key: "orphan-skeletons", run: assertNoOrphanSkeletons },
  { key: "over-media-chips", run: assertOverMediaChips },
  { key: "brief-echo", run: assertBriefEcho },
] as const;

export type LawKey = (typeof LAWS)[number]["key"];

/** Run every non-destructive law against the page now loaded. */
export async function runLaws(
  page: Page,
  where: string,
  log: LawLog,
  requires?: ExistentialSubject[],
) {
  for (const law of LAWS) {
    await law.run(page, where, log, requires);
  }
}
