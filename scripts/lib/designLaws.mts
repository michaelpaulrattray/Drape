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
  /*
    AN INSTRUMENT ERROR IS NOT AN EMPTY PAGE.

    This read `.catch(() => 0)`, so an evaluate that threw — a context destroyed
    by a late client-side navigation, a detached page — became "no text fields
    on this surface" and the surface passed law 1. That is the silent-skip
    direction this whole module refuses everywhere else, hidden in an error
    handler. A failure to MEASURE is now a failure.
  */
  let fields: number;
  try {
    fields = await page.$$eval(TEXT_ENTRY_SELECTOR, (els) =>
      els.filter((el) => {
        /* A field with no box cannot be looked at, and focusing it measures
           nothing — a hidden input would otherwise report a clean pass. */
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).length,
    );
  } catch (error) {
    log.check(
      where,
      "no inner focus ring",
      false,
      `could not read the text fields at all: ${(error as Error).message}`,
    );
    return;
  }
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
 *
 * ⚠ **THE PRICE MAY SIT BESIDE THE BUTTON RATHER THAN INSIDE ITS LABEL —
 * FOUNDER RULING, Crew reply #127, 2026-09-04 21:42Z, verbatim and entire:**
 *
 * > *"Leave the page alone; teach the check to look beside the button"*
 *
 * **The check was narrower than the law it enforces.** D-15, quoted in this
 * module's own header, says *"the cost is visible on the affordance, never
 * behind a confirm step"* — and this read `innerText` on the button and nothing
 * else. So `/casting` was reported as a violation while printing
 * **`8 CANDIDATES · ~160 CR · ~50 SECONDS`** on its own row directly under the
 * brief box, at the affordance, before the click, with nothing to open. The
 * page satisfied D-15 and the instrument called it a fault (#523, found by
 * #512's drive).
 *
 * That direction of error is the expensive one: **a law that reddens on a
 * correct page is one people learn to ignore**, which is the same failure as
 * having no law — `typo-gate-owned-a-real-word`'s class, where a gate owning a
 * real word blocked the founder's own ask.
 *
 * # ⚠ THE CLIMB IS BOUNDED, AND THE BOUND IS THE WHOLE DESIGN
 *
 * The tempting widening is *"a price anywhere on the page"*, and it would be
 * a vacuous pass: every surface that spends also renders a credit balance in
 * its chrome, so the law would hold everywhere and catch nothing. So the price
 * must be in the button's own label **or in an ancestor at most
 * `PRICE_GROUP_LEVELS` up**, and `<body>` is never consulted.
 *
 * Two ancestors is what the real page needs and no more, read at the rendered
 * DOM rather than guessed: the button sits in `div.dp-field` (the `Field`
 * primitive, one div), and the receipt line `p.dpc-hero__receipt` is that div's
 * SIBLING — so the nearest element holding both is the grandparent. A third
 * level would start swallowing page chrome.
 *
 * ⚠ **IT THEREFORE FAILS TOWARD REDDENING.** Wrap the button in one more div
 * and a correct page reports a violation until somebody looks. That is the safe
 * direction and it is chosen deliberately: the alternative — an unbounded climb
 * — fails toward silence, and a silent design law is indistinguishable from a
 * deleted one.
 *
 * `designLawControls.mts` pins all four corners: priced in the label, priced
 * beside the button (the real page's shape), priced NOWHERE, and priced too far
 * away. The last is the one that stops this widening drifting back into
 * "anywhere on the page".
 *
 * ⚠ **AND THE ANCESTOR IS READ WITH EVERY OTHER BUTTON'S SUBTREE EXCLUDED
 * (#782).** The climb above read the ancestor's whole `innerText`, so a bare
 * `Cast it` sharing a control group with `Roll again · 160 cr` was satisfied
 * by its SIBLING'S price — a price that names a different purchase. That is
 * the same mismatch as #523 pointing the other way: the reader was wider than
 * the law's region, and it failed toward silence. Not live on any current
 * surface (each in-label button prices itself), which is exactly why it needs
 * a control rather than a walk: nothing on the real app would ever say so.
 * The price beside the button must therefore be in PROSE — a receipt line, a
 * cost row — never in another affordance's label. `designLawControls.mts`
 * holds the pair: a priced and an unpriced paid button under one parent, and
 * the unpriced one must still be caught.
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
    /* A price is a number followed by the credit unit. */
    const PRICE = /\d+\s*cr\b/i;
    /*
      HOW FAR "BESIDE" REACHES. Two, because the real page needs two and no
      more: the button is inside `div.dp-field` and the receipt line is that
      div's sibling, so the grandparent is the nearest element holding both.
      Raising this is not a tuning knob — it is how this law goes quiet.
    */
    const PRICE_GROUP_LEVELS = 2;
    const bad: string[] = [];
    let seen = 0;
    let beside = 0;
    for (const b of Array.from(document.querySelectorAll("button"))) {
      const label = (b.innerText ?? "").trim();
      if (!label || PENDING.some((p) => p.test(label))) continue;
      if (!PAID.some((p) => p.test(label))) continue;
      seen += 1;
      if (PRICE.test(label)) continue;
      /*
        ⚠ `document.body` AND `document.documentElement` ARE NEVER CONSULTED.
        Reading either is "a price anywhere on the page", which every surface
        that spends satisfies through its own credit balance — the vacuous pass
        this bound exists to prevent.
      */
      let node: HTMLElement | null = b.parentElement;
      let found = false;
      for (let level = 0; level < PRICE_GROUP_LEVELS; level += 1) {
        if (!node || node === document.body || node === document.documentElement) break;
        /*
          THE ANCESTOR'S PROSE, NOT ITS BUTTONS. Every text node under the
          ancestor is read EXCEPT those inside a <button> — this one's label
          was already tested and any other button's label is a different
          purchase. Painted text only: an element with no layout box
          (`display: none`, unrendered) contributes nothing, and neither does
          one under `visibility: hidden`, which keeps its box — the two
          conditions `innerText` applied before this walker replaced it, each
          checked on its own rather than one standing in for both (PR #805
          review, finding 2). (Inlined rather than a named helper: the bundler
          wraps a named function in `__name`, which the page does not have.)
        */
        const parts: string[] = [];
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const parent = n.parentElement;
          if (!parent || parent.closest("button")) continue;
          if (parent.getClientRects().length === 0) continue;
          if (getComputedStyle(parent).visibility === "hidden") continue;
          parts.push(n.textContent ?? "");
        }
        if (PRICE.test(parts.join(" "))) {
          found = true;
          break;
        }
        node = node.parentElement;
      }
      if (found) beside += 1;
      else bad.push(label);
    }
    /* The bound is RETURNED rather than restated in the message below: two
       copies of it would drift the moment one is edited (working law 4), and
       the copy that drifts is the one in the sentence a reader believes. */
    return { bad, seen, beside, levels: PRICE_GROUP_LEVELS };
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
      ? /* The count of prices found BESIDE rather than IN is reported, not
           hidden: it is the difference between the page the founder ruled on
           and a page whose labels all carry their own price, and a reader of
           this line should be able to tell those apart. */
        `${result.seen} paid button(s), all priced` +
        (result.beside > 0 ? ` (${result.beside} beside the button, not in the label)` : "")
      : `${result.bad.length} of ${result.seen} unpriced` +
        ` (label and ${result.levels} ancestor(s) read): ${result.bad.join(" | ")}`,
  );
}

/**
 * Law 5. Retention is stated wherever unsigned sheets surface.
 *
 * A sheet that quietly disappears after a week is a worse surprise than one
 * that said so. Only asserted where the section actually renders.
 *
 * ⚠ **READ INSIDE THE SECTION, NEVER ACROSS THE PAGE (#782).** This tested
 * `document.body.innerText` for the expiry phrase, so *7 quiet days* printed
 * ANYWHERE — a footer, a help line, a different section's aside — satisfied a
 * law whose prose says *wherever unsigned sheets surface*. Wider than its own
 * region, failing toward silence. The reading is scoped now: each element
 * that carries the phrase in its OWN text is resolved to its nearest sectioning
 * ancestor (`section`, `article`, `[role=region]`, else its parent), and the
 * expiry copy must be inside THAT. The real page is `<section class="dp-stack">`
 * holding the eyebrow and its aside (`CastingV2.tsx`), so this is the shape it
 * already has; a page stating retention in the wrong place reddens. The
 * parent fallback stops short of `<body>`: a holder whose only ancestor is
 * the page is its own scope, so the fallback can never widen back into the
 * page-wide read.
 */
export async function assertRetentionStated(
  page: Page,
  where: string,
  log: LawLog,
  requires?: ExistentialSubject[],
  mayHold?: ExistentialSubject[],
) {
  /*
    Wait for the section rather than sampling once. `openSessions` is a query;
    checking before it resolves reports "no section here" and passes without
    having tested anything — the vacuous pass this suite exists to prevent.

    But only where it could arrive. This ran on EVERY surface, and since no
    address declares `retentionCopy` (the section is conditional on data —
    `CastingV2.tsx:945`) all ~38 surface-and-theme visits paid the full six
    seconds waiting for copy that was never coming: about 3.8 minutes a walk.
    So: one immediate sample first, and the wait only for a surface that says
    it holds the section. The drive's `settle()` has already held the page
    until its loading placeholders cleared, so an immediate sample on a page
    that is not claiming the subject is reading a resolved page, not a racing
    one.
  */
  const alreadyThere = await page.evaluate(() => /unsigned sheets/i.test(document.body.innerText));
  const canRender = requires?.includes("retentionCopy") || mayHold?.includes("retentionCopy");
  if (!alreadyThere && canRender) {
    await page
      .waitForFunction(() => /unsigned sheets/i.test(document.body.innerText), { timeout: 6000 })
      .catch(() => undefined);
  }

  const result = await page.evaluate(() => {
    const PHRASE = /unsigned sheets/i;
    const EXPIRY = /7 quiet days/i;
    /*
      THE DEEPEST PAINTED ELEMENTS WHOSE TEXT HOLDS THE PHRASE — read across
      their text nodes, normalised, the way the wait above reads `innerText`.
      The first cut demanded the phrase inside ONE text node, so a `<span>`
      wrapped around one word would have turned the section invisible to this
      law while the wait still saw it (PR #805 review, finding 1). Deepest
      rather than every match, so the section is found once and not once per
      ancestor.
    */
    const matches = Array.from(document.querySelectorAll<HTMLElement>("*")).filter(
      (el) =>
        el.getClientRects().length > 0 &&
        getComputedStyle(el).visibility !== "hidden" &&
        !/^(SCRIPT|STYLE|TITLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName) &&
        PHRASE.test((el.textContent ?? "").replace(/\s+/g, " ")),
    );
    const holders = matches.filter((el) => !matches.some((other) => other !== el && el.contains(other)));
    if (holders.length === 0) return null;
    const sections = new Set<HTMLElement>();
    for (const holder of holders) {
      /* Never the page: a holder with no sectioning ancestor and a parent
         that is <body> (or the page-spanning wrapper under it) is read as its
         own scope, which fails toward reddening rather than back into the
         page-wide read this law used to be (PR #805 review, round 2). */
      const nearest = holder.closest<HTMLElement>("section, article, [role='region']") ?? holder.parentElement;
      sections.add(
        !nearest || nearest === document.body || nearest === document.documentElement ? holder : nearest,
      );
    }
    const readings = Array.from(sections).map((section) => ({
      scope: section.tagName.toLowerCase() + (section.className ? `.${String(section.className).split(/\s+/)[0]}` : ""),
      stated: EXPIRY.test(section.innerText),
    }));
    return { stated: readings.every((r) => r.stated), scopes: readings.map((r) => `${r.scope}${r.stated ? "" : " (no expiry copy)"}`) };
  });
  if (result === null) {
    absentSubject(
      log,
      where,
      "retention stated where sheets surface",
      "retentionCopy",
      requires,
      alreadyThere ? "unsigned-sheets text vanished between samples" : "no unsigned-sheets section on this surface",
    );
    return;
  }
  log.check(
    where,
    "retention stated where sheets surface",
    result.stated,
    result.stated
      ? `unsigned-sheets section states the 7 quiet days (read inside ${result.scopes.join(", ")})`
      : `unsigned-sheets section with no expiry copy inside it (${result.scopes.join(", ")})`,
  );
}

/**
 * Law 6. A refused brief never hangs.
 *
 * The founder's anime brief was refused server-side — correctly, and for free
 * — and the sheet showed eight skeletons that waited forever. The law is that
 * a failure always resolves to copy with an action.
 *
 * ⚠ **"UNDER" IS READ AS A POSITION NOW, NOT A CO-OCCURRENCE (#782).** This
 * counted `.dp-skeleton` anywhere on the page against failure copy anywhere on
 * the page, so it held no positional reading at all — a loading strip in the
 * page header beside a refusal further down would have reddened as the
 * founder's hang. The law's own prose is *skeletons never sit UNDER failure
 * copy*, and that is where the real defect lives: the sheet renders the
 * failure `EmptyState` where the tiles would have been and the grid follows
 * it (`CastingSheet.tsx`). So the reading is the box: a skeleton whose top
 * edge is at or below the failure copy's top edge is under it. This is the
 * one of #782's three that read wider in the LOUD direction — it reddened a
 * page it should not have — rather than toward silence, and the docblock says
 * so instead of borrowing the card's sentence.
 */
export async function assertNoOrphanSkeletons(page: Page, where: string, log: LawLog) {
  const result = await page.evaluate(() => {
    const FAILURE = /can't be cast|didn't start/i;
    const skeletons = Array.from(document.querySelectorAll<HTMLElement>(".dp-skeleton"));
    /*
      THE DEEPEST PAINTED ELEMENTS WHOSE TEXT HOLDS THE FAILURE COPY — read
      across text nodes and normalised, so `That brief <em>can't</em> be cast`
      is still the copy. The first cut read one text node at a time and would
      have gone green forever on the founder's own hang the day the title grew
      inline markup (PR #805 review, finding 1); `designLawControls.mts` now
      holds the split-phrase pair that reddens if this regresses.
    */
    const matches = Array.from(document.querySelectorAll<HTMLElement>("*")).filter(
      (el) =>
        el.getClientRects().length > 0 &&
        getComputedStyle(el).visibility !== "hidden" &&
        !/^(SCRIPT|STYLE|TITLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName) &&
        FAILURE.test((el.textContent ?? "").replace(/\s+/g, " ")),
    );
    const copies = matches.filter((el) => !matches.some((other) => other !== el && el.contains(other)));
    if (copies.length === 0) return { skeletons: skeletons.length, hasFailureCopy: false, under: 0 };
    const copyTop = Math.min(...copies.map((el) => el.getBoundingClientRect().top));
    const under = skeletons.filter((sk) => sk.getBoundingClientRect().top >= copyTop).length;
    return { skeletons: skeletons.length, hasFailureCopy: true, under };
  });
  // A skeleton below a failure message is the hang: one of the two is lying.
  log.check(
    where,
    "skeletons never sit under a failure message",
    result.under === 0,
    `${result.skeletons} skeleton(s), failure copy ${result.hasFailureCopy ? `present, ${result.under} skeleton(s) under it` : "absent"}`,
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
type LawRunner = (
  page: Page,
  where: string,
  log: LawLog,
  requires?: ExistentialSubject[],
  mayHold?: ExistentialSubject[],
) => Promise<void>;

/** Every law key, so a control cannot name one that does not exist. */
export type LawKey =
  | "focus-ring"
  | "dock"
  | "mono-sentences"
  | "priced-buttons"
  | "retention"
  | "orphan-skeletons"
  | "over-media-chips"
  | "brief-echo";

export const LAWS: { key: LawKey; run: LawRunner }[] = [
  { key: "focus-ring", run: assertNoInnerFocusRing },
  { key: "dock", run: assertDockVisible },
  { key: "mono-sentences", run: assertNoMonoSentences },
  { key: "priced-buttons", run: assertPricedButtons },
  { key: "retention", run: assertRetentionStated },
  { key: "orphan-skeletons", run: assertNoOrphanSkeletons },
  { key: "over-media-chips", run: assertOverMediaChips },
  { key: "brief-echo", run: assertBriefEcho },
];

/** Run every non-destructive law against the page now loaded. */
export async function runLaws(
  page: Page,
  where: string,
  log: LawLog,
  requires?: ExistentialSubject[],
  mayHold?: ExistentialSubject[],
) {
  for (const law of LAWS) {
    await law.run(page, where, log, requires, mayHold);
  }
}
