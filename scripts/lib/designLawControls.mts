/**
 * THE CONTROLS — proof that each design law can still fail.
 *
 * Working law 2: verify the instrument before believing its finding. A green
 * design-law run over nineteen surfaces proves nothing at all if the laws
 * cannot redden, and this suite has already been caught passing vacuously
 * twice (law 5 sampling before its section resolved; law 8 reading the DOM
 * while the panel was clipped off screen).
 *
 * So every law gets a pair of synthetic pages:
 *
 *   - an OFFENDER, built to break exactly that law. The law must FAIL.
 *   - a COMPLIANT page holding the same subject, built correctly. The law
 *     must HOLD.
 *
 * Both halves matter and the second is the one that is usually missing. A law
 * that fails on everything catches every defect and is worthless; a law that
 * passes on everything is the vacuous pass. Only the pair pins the boundary.
 *
 * These pages are `setContent` strings — no server, no session, no database,
 * no credits. That is deliberate: it is what lets the controls run in the gate
 * on every pull request, where the walk over the real app cannot go.
 *
 * AND THE CONTROLS DRIVE THE SHIPPED BYTES. They import the law functions the
 * walk imports. A control that reimplemented a law would prove only that two
 * pieces of code agree with each other, and the transcription is what makes
 * the catching assertion unwritable in the first place.
 */
import type { Browser, Page } from "puppeteer-core";

import {
  assertBriefEcho,
  assertDockVisible,
  assertNoInnerFocusRing,
  assertNoMonoSentences,
  assertNoOrphanSkeletons,
  assertOverMediaChips,
  assertPricedButtons,
  assertRetentionStated,
  LawLog,
  type LawKey,
} from "./designLaws.mts";
import type { ExistentialSubject } from "./designLawSurfaces.mts";

type Arm = {
  /** The page. */
  html: string;
  /** Surfaces this control pretends to be, for the existential laws. */
  requires?: ExistentialSubject[];
  /** ...and the data-conditional third state (see SurfacePlan.mayHold). */
  mayHold?: ExistentialSubject[];
};

export type Control = {
  law: LawKey;
  /** What the offender does wrong, in one line — printed on a miss. */
  breaks: string;
  run: (
    page: Page,
    where: string,
    log: LawLog,
    requires?: ExistentialSubject[],
    mayHold?: ExistentialSubject[],
  ) => Promise<void>;
  offender: Arm;
  compliant: Arm;
};

/** Wrap a fragment in the shell every real surface has. */
const page = (head: string, body: string) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #0A0A0A; color: #EBEBEB; }
  ${head}
</style></head><body class="dp-root">${body}</body></html>`;

/** A lawful dock: fixed to the bottom, so both readings hold on a tall page. */
const COMPLIANT_DOCK = page(
  `.dp-dock { position: fixed; bottom: 16px; left: 16px; height: 60px; background: #222; }`,
  `<div style="height:2000px">tall page</div><div class="dp-dock">dock</div>`,
);

/** A lawful text field: the ring is on the wrapper, never on the text. */
const COMPLIANT_FIELD = page(
  `input:focus, input:focus-visible { outline: none; box-shadow: none; }
   .dp-field:focus-within { border-color: #EBEBEB; }`,
  `<div class="dp-field" style="border:1px solid #333"><input type="text" aria-label="search" /></div>`,
);

/** A lawful over-media chip: dark fill, named, in the tab order. */
const COMPLIANT_CHIP = page(
  `.dp-btn--onmedia { background: rgba(10,10,10,0.72); }`,
  `<button class="dp-btn--onmedia" aria-label="Expand">+</button>`,
);

/**
 * A lawful brief echo, with one stylesheet line left open for the offender.
 *
 * Every offender below differs from the compliant page by exactly ONE
 * declaration, so a control that misses can only be its own check failing to
 * fire — not a neighbouring check catching the page for an unrelated reason.
 * Two arms that differ in several ways cannot tell you which one they caught.
 */
const echoPage = (broken: string) =>
  page(
    `.dpc-echo { line-height: 20px; position: relative; }
     .dp-pop__trigger { background: transparent; border: 0; padding: 0;
                        text-decoration: underline; color: #FFFFFF; }
     .dpc-echo__prose { color: #9A9A9A; }
     .dp-pop__panel { position: absolute; top: 24px; left: 0; }
     .dp-pop__option { height: 20px; }
     ${broken}`,
    `<div class="dpc-echo"><span class="dpc-echo__prose">A woman,</span>
       <button class="dp-pop__trigger" aria-label="age">thirty</button>
       <div class="dp-pop__panel"><div class="dp-pop__option">a</div><div class="dp-pop__option">b</div></div>
     </div>`,
  );

const COMPLIANT_ECHO = echoPage("");

export const CONTROLS: Control[] = [
  {
    law: "focus-ring",
    breaks: "a text field that draws a ring around its own text on focus",
    run: assertNoInnerFocusRing,
    offender: {
      html: page(
        `input:focus, input:focus-visible { outline: 2px solid #E5484D; outline-offset: 2px; }`,
        `<input type="text" aria-label="search" />`,
      ),
    },
    compliant: { html: COMPLIANT_FIELD },
  },
  {
    /*
      The same law by the other road. "A ring can be drawn as a box-shadow just
      as easily as an outline" is a sentence in the law; without this arm it is
      a sentence with no evidence behind it, and half the law could rot unseen.
    */
    law: "focus-ring",
    breaks: "a text field whose focus ring is a box-shadow rather than an outline",
    run: assertNoInnerFocusRing,
    offender: {
      html: page(
        `input:focus, input:focus-visible { outline: none; box-shadow: 0 0 0 2px #E5484D; }`,
        `<input type="text" aria-label="search" />`,
      ),
    },
    compliant: { html: COMPLIANT_FIELD },
  },
  {
    /*
      THE STAFF SEARCH BOX, REPRODUCED — the control the founder raised #445
      over, and the one this law could not see. Every table search box in the
      product is `<input type="search">`, which the law's old allow-list
      (`input[type=text], input:not([type]), textarea, .dp-input`) did not
      contain, so `/admin/users` reported "no text fields on this surface" and
      passed. Without this arm the selector could narrow back to an allow-list
      and every other control here would stay green.
    */
    law: "focus-ring",
    breaks: "a staff table search box — input[type=search] — wearing the accent ring",
    run: assertNoInnerFocusRing,
    offender: {
      html: page(
        `input:focus, input:focus-visible { outline: 2px solid #E5484D; outline-offset: 2px; }`,
        `<input type="search" class="dp-tablesearch__input" aria-label="Search users by name, email or id" />`,
      ),
    },
    compliant: {
      html: page(
        `input:focus, input:focus-visible { outline: none; box-shadow: none; }`,
        `<input type="search" class="dp-tablesearch__input" aria-label="Search users by name, email or id" />`,
      ),
    },
  },
  {
    /*
      The law has two readings — on screen at load, and still on screen at the
      bottom — and each gets an offender that breaks ONLY it. The first shape of
      this control parked the dock at top:-500px, which fails BOTH readings; the
      sabotage sweep then found the at-load reading could be disabled entirely
      with the control still green, because the at-bottom reading was quietly
      holding it up. A single arm covering two readings hides the death of one.
    */
    law: "dock",
    breaks: "a dock below the fold at load, which scrolling then brings into view",
    run: assertDockVisible,
    offender: {
      html: page(
        `.dp-dock { position: absolute; top: 1900px; height: 60px; background: #222; }`,
        `<div style="height:2000px">tall page</div><div class="dp-dock">dock</div>`,
      ),
    },
    compliant: { html: COMPLIANT_DOCK },
  },
  {
    law: "dock",
    breaks: "a dock on screen at load that scrolls away and is gone at the page bottom",
    run: assertDockVisible,
    offender: {
      html: page(
        `.dp-dock { position: absolute; top: 0; height: 60px; background: #222; }`,
        `<div style="height:2000px">tall page</div><div class="dp-dock">dock</div>`,
      ),
    },
    compliant: { html: COMPLIANT_DOCK },
  },
  {
    /*
      The existential arm, and it is the one this card is really about. A
      surface that DECLARES it holds a dock, with no dock in the document, is a
      failure — not the `-- no dock on this surface` line the old drive printed
      and moved past. Its compliant twin is the same empty page WITHOUT the
      declaration, which must stay a not-applicable rather than becoming a pass.
    */
    law: "dock",
    breaks: "a surface that declares it holds a dock, and holds none",
    run: assertDockVisible,
    offender: { html: page(``, `<p>no dock anywhere on this page.</p>`), requires: ["dock"] },
    compliant: {
      html: page(
        `.dp-dock { position: fixed; bottom: 16px; height: 60px; background: #222; }`,
        `<div class="dp-dock">dock</div>`,
      ),
      requires: ["dock"],
    },
  },
  {
    law: "mono-sentences",
    breaks: "a sentence of prose set in a monospace face",
    run: assertNoMonoSentences,
    offender: {
      html: page(``, `<p style="font-family: 'Roboto Mono', monospace">Cast eight of them and pick the one you like.</p>`),
    },
    compliant: {
      html: page(``, `<p style="font-family: Inter, sans-serif">Cast eight of them and pick the one you like.</p>`),
    },
  },
  {
    law: "priced-buttons",
    breaks: "a paid button whose label does not carry its price",
    run: assertPricedButtons,
    offender: { html: page(``, `<button>Cast it</button>`) },
    compliant: { html: page(``, `<button>Cast it &middot; 160 cr</button>`) },
  },
  {
    /*
      THE BOUNDARY THE PAID VERBS SIT ON, and it had no arm until the reviewer
      of #522 walked it. "Sign" is a paid action — signing a cast to the roster
      — and "Sign in" / "Sign out" are not, but `/^sign\b/i` matched all three.
      The drive now visits /login, the lobby, the studio and nine staff pages,
      every one of which can render a Sign out; each would have been reported
      as an unpriced paid button on a page that sells nothing.

      The offender is the real paid verb with no price (must be caught); the
      compliant page carries every label that merely STARTS with those letters
      and is not a purchase, none of them priced, and must stay clean. Only the
      pair pins the line between them.

      ⚠ "SIGNED" IS IN THE COMPLIANT ARM BECAUSE THE FIRST FIX BROKE IT. The
      roster filter pills on /casting read All / Signed / Unsigned, and a repair
      that dropped the word boundary for the lookahead flagged "Signed" as an
      unpriced paid button on two surfaces. The drive caught it; this arm is so
      that the next reader of this regex does not have to.
    */
    law: "priced-buttons",
    breaks: "the Sign boundary — a paid Sign with no price, beside Signed/sign-in/sign-out, which are not paid",
    run: assertPricedButtons,
    offender: { html: page(``, `<button>Sign them</button>`) },
    compliant: {
      html: page(
        ``,
        `<button>Sign in</button><button>Sign in with Email</button><button>Sign out</button>` +
          `<button>Sign up</button><button>Signed</button><button>Unsigned</button>` +
          `<button>Signature</button>`,
      ),
    },
  },
  {
    law: "retention",
    breaks: "an unsigned-sheets section that never says when the sheets expire",
    run: assertRetentionStated,
    offender: { html: page(``, `<section><h2>Unsigned sheets</h2><p>Three waiting.</p></section>`) },
    compliant: {
      html: page(``, `<section><h2>Unsigned sheets</h2><p>Kept for 7 quiet days, then cleared.</p></section>`),
    },
  },
  {
    /*
      THE LATE SECTION, and this arm exists because its absence cost a real
      assertion. Law 5 waited six seconds on every surface for copy that only
      /casting can show, which was ~3.8 minutes a walk; the "fast" repair
      sampled once and reported *not applicable* on /casting — a page that had
      been PASSING this law a run earlier, and whose section arrives with a
      query. Only a diff of two runs caught it.

      So the surface declares `mayHold` and the law waits there. The offender
      renders the section late WITHOUT its expiry copy and must be caught; the
      compliant one renders it late WITH the copy and must hold. Both fail
      instantly if the wait is ever dropped again.
    */
    law: "retention",
    breaks: "an unsigned-sheets section that arrives with a query and never says when the sheets expire",
    run: assertRetentionStated,
    offender: {
      html: page(
        ``,
        `<div id="late"></div><script>setTimeout(function(){document.getElementById("late").innerHTML=` +
          `"<section><h2>Unsigned sheets</h2><p>Three waiting.</p></section>";},1500)<\/script>`,
      ),
      mayHold: ["retentionCopy"],
    },
    compliant: {
      html: page(
        ``,
        `<div id="late"></div><script>setTimeout(function(){document.getElementById("late").innerHTML=` +
          `"<section><h2>Unsigned sheets</h2><p>Kept for 7 quiet days.</p></section>";},1500)<\/script>`,
      ),
      mayHold: ["retentionCopy"],
    },
  },
  {
    /* The existential twin of law 5: a surface promising retention copy that
       renders no section at all must fail rather than report nothing here. */
    law: "retention",
    breaks: "a surface that declares it shows unsigned sheets, and shows none",
    run: assertRetentionStated,
    offender: { html: page(``, `<p>nothing about sheets on this page.</p>`), requires: ["retentionCopy"] },
    compliant: {
      html: page(``, `<section><h2>Unsigned sheets</h2><p>Kept for 7 quiet days.</p></section>`),
      requires: ["retentionCopy"],
    },
  },
  {
    law: "orphan-skeletons",
    breaks: "loading skeletons sitting under copy that says the roll already failed",
    run: assertNoOrphanSkeletons,
    offender: {
      html: page(``, `<p>That brief can't be cast.</p><div class="dp-skeleton"></div><div class="dp-skeleton"></div>`),
    },
    compliant: { html: page(``, `<div class="dp-skeleton"></div><div class="dp-skeleton"></div>`) },
  },
  {
    /* Dark glass alone. The chip is named and focusable, so a miss here can
       only be the contrast rule failing to fire — not the reachability one
       catching it by accident. */
    law: "over-media-chips",
    breaks: "a translucent-WHITE over-media chip (the 2.5:1 fill), correctly named and reachable",
    run: assertOverMediaChips,
    offender: {
      html: page(
        `.dp-btn--onmedia { background: rgba(255,255,255,0.85); }`,
        `<button class="dp-btn--onmedia" aria-label="Expand">+</button>`,
      ),
    },
    compliant: { html: COMPLIANT_CHIP },
  },
  {
    /* Reachability alone: correct dark fill, but hover-only in practice —
       no accessible name and out of the tab order. */
    law: "over-media-chips",
    breaks: "a correctly dark over-media chip that is unnamed and out of the tab order",
    run: assertOverMediaChips,
    offender: {
      html: page(
        `.dp-btn--onmedia { background: rgba(10,10,10,0.72); }`,
        `<button class="dp-btn--onmedia" tabindex="-1"></button>`,
      ),
    },
    compliant: { html: COMPLIANT_CHIP },
  },
  {
    law: "brief-echo",
    breaks: "echo facts wearing chip clothing — a background and a border instead of an underline",
    run: assertBriefEcho,
    offender: {
      html: echoPage(
        `.dp-pop__trigger { background: #1d1d1d; border: 1px solid #444; color: #FFFFFF; }`,
      ),
    },
    compliant: { html: COMPLIANT_ECHO },
  },
  {
    /*
      THE ONE THE FOUNDER ACTUALLY FOUND, first reading: the sentence's own
      `overflow: hidden` clips the panel. Every option row still sits inside the
      clip rect here — the panel exceeds its ancestor only by its padding — so
      the painted-option count passes and ONLY the ancestor check can catch it.
    */
    law: "brief-echo",
    breaks: "a popover whose box escapes the sentence's overflow, with every option still inside it",
    run: assertBriefEcho,
    offender: {
      /* Two lines exactly, so the echo's own line-count rule stays satisfied —
         the first shape of this offender was 70px tall and was being caught by
         THAT rule instead, which the sabotage sweep found. The panel escapes
         its ancestor by its padding alone, so every option row is still inside
         the clip rect and the painted-option count passes. */
      html: echoPage(`.dpc-echo { overflow: hidden; height: 40px; }
                      .dp-pop__panel { top: 0; padding-bottom: 20px; }
                      .dp-pop__option { height: 18px; }`),
    },
    compliant: { html: COMPLIANT_ECHO },
  },
  {
    /*
      Second reading, and the one that measures what a user can SEE. Nothing
      clips — no ancestor has a non-visible overflow, so the ancestor check
      cannot fire — but the panel is pushed below the fold and no option is
      painted on screen. The DOM holds all of them, which is exactly the reading
      that passed while the founder was looking at one option.
    */
    law: "brief-echo",
    breaks: "a popover pushed below the fold: every option in the DOM, none of them on screen",
    run: assertBriefEcho,
    offender: { html: echoPage(`.dp-pop__panel { top: 1000px; }`) },
    compliant: { html: COMPLIANT_ECHO },
  },
];

export type ControlResult = {
  law: LawKey;
  breaks: string;
  /** The offender reddened, as it must. */
  offenderCaught: boolean;
  /** The compliant page came back clean, as it must. */
  compliantClean: boolean;
  /** What each arm actually produced, so a miss can be read rather than guessed. */
  offenderSaw: string;
  compliantSaw: string;
};

async function armFailures(
  browser: Browser,
  control: Control,
  arm: Arm,
  where: string,
): Promise<{ failures: number; saw: string }> {
  const tab = await browser.newPage();
  try {
    await tab.setViewport({ width: 1440, height: 900 });
    await tab.setContent(arm.html, { waitUntil: "load" });
    const log = new LawLog();
    await control.run(tab, where, log, arm.requires, arm.mayHold);
    return {
      failures: log.failures.length,
      saw:
        log.observations.length === 0
          ? "the law recorded nothing at all"
          : log.observations.map((o) => `${o.ok === null ? "n/a" : o.ok ? "ok" : "FAIL"} ${o.law} — ${o.saw}`).join(" ; "),
    };
  } finally {
    await tab.close();
  }
}

/**
 * Drive every control. A control passes only when BOTH arms behave.
 *
 * The offender arm asks "can this law fail"; the compliant arm asks "does it
 * fail on everything". An instrument needs both answers before its verdicts on
 * the real app count for anything.
 */
export async function runControls(browser: Browser, only?: LawKey): Promise<ControlResult[]> {
  const results: ControlResult[] = [];
  for (const control of CONTROLS) {
    if (only && control.law !== only) continue;
    const offender = await armFailures(browser, control, control.offender, `control offender: ${control.law}`);
    const compliant = await armFailures(browser, control, control.compliant, `control compliant: ${control.law}`);
    results.push({
      law: control.law,
      breaks: control.breaks,
      offenderCaught: offender.failures > 0,
      compliantClean: compliant.failures === 0,
      offenderSaw: offender.saw,
      compliantSaw: compliant.saw,
    });
  }
  return results;
}
