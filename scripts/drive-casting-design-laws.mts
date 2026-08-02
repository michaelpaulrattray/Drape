/**
 * Design-law assertions for the casting surfaces.
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
 *
 * Usage (needs a running server and a session cookie):
 *   npx tsx scripts/drive-casting-design-laws.mts \
 *     --base http://localhost:3000 --token <app_session_id> --session <uuid>
 *
 * Exits non-zero on any violation, so it can gate a release.
 */
import puppeteer, { type Page } from "puppeteer-core";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
}

const BASE = arg("base", "http://localhost:3000");
const TOKEN = arg("token");
const SESSION = arg("session");
/** Law 9 clicks Follow for real, which costs credits. Opt in deliberately. */
const OPTIMISTIC = process.argv.includes("--optimistic");
if (!TOKEN) throw new Error("--token <app_session_id JWT> is required");

const failures: string[] = [];
function check(ok: boolean, law: string, detail: string) {
  if (ok) {
    console.log(`  ok   ${law}`);
  } else {
    console.log(`  FAIL ${law} — ${detail}`);
    failures.push(`${law} — ${detail}`);
  }
}

/** Law 1. Focus a field, let the transition settle, read the inner element. */
async function assertNoInnerFocusRing(page: Page, where: string) {
  /*
    EVERY text field, not only the ones wearing `.dp-input`.

    The room's inline rename carried a red focus ring for a whole milestone and
    this law never saw it, because the law scanned a CLASS and the rename is a
    bare styled <input>. A law that only inspects the controls that opted in is
    a law the next control silently opts out of.
  */
  const SELECTOR = ".dp-input, input[type=text], input:not([type]), textarea";
  const fields = await page.$$eval(SELECTOR, (els) => els.length);
  for (let i = 0; i < fields; i += 1) {
    const result = await page.evaluate(async (index) => {
      const input = document.querySelectorAll<HTMLElement>(
        ".dp-input, input[type=text], input:not([type]), textarea",
      )[index];
      input.focus();
      // border-color is transitioned; reading in the same tick returns the
      // pre-transition value and reports a false failure.
      await new Promise((r) => setTimeout(r, 320));
      const cs = getComputedStyle(input);
      // A ring can be drawn as a box-shadow just as easily as an outline.
      const shadow = cs.boxShadow;
      const wrapper = input.closest(".dp-field");
      return {
        name: input.getAttribute("aria-label") ?? input.getAttribute("placeholder") ?? `#${index}`,
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
        boxShadow: shadow === "none" ? null : shadow,
        wrapperBorder: wrapper ? getComputedStyle(wrapper).borderTopColor : null,
        unfocusedBorder: wrapper ? (wrapper as HTMLElement).dataset.restingBorder ?? null : null,
      };
    }, i);

    const outlined = result.outlineStyle !== "none" && result.outlineWidth !== "0px";
    const shadowed = Boolean(result.boxShadow);
    check(
      !outlined && !shadowed,
      `[${where}] no inner focus ring: ${result.name}`,
      outlined
        ? `outline ${result.outlineStyle} ${result.outlineWidth}`
        : `box-shadow ${result.boxShadow}`,
    );
  }
  if (fields === 0) console.log(`  --   [${where}] no text fields on this surface`);
}

/** Law 2. The dock is on screen at load, and still on screen at page bottom. */
async function assertDockVisible(page: Page, where: string) {
  const atLoad = await page.evaluate(() => {
    const dock = document.querySelector(".dp-dock");
    if (!dock) return null;
    const r = dock.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  });
  if (atLoad === null) {
    console.log(`  --   [${where}] no dock on this surface`);
    return;
  }
  check(atLoad, `[${where}] dock visible without scrolling`, "dock is off screen at load");

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 500));
  const atBottom = await page.evaluate(() => {
    const r = document.querySelector(".dp-dock")!.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  });
  check(atBottom, `[${where}] dock still visible at page bottom`, "dock scrolled away");
  await page.evaluate(() => window.scrollTo(0, 0));
}

/**
 * Law 3. No mono on sentences.
 *
 * "A sentence" is approximated as visible text with several words that ends in
 * sentence punctuation, or is long enough that it cannot be a label. Eyebrows,
 * counts, ids and index labels are all short and unpunctuated, so they pass.
 */
async function assertNoMonoSentences(page: Page, where: string) {
  const offenders = await page.evaluate(() => {
    const bad: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      if (el.children.length > 0) continue;
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
      const font = getComputedStyle(el).fontFamily.toLowerCase();
      if (font.includes("mono")) bad.push(text.slice(0, 70));
    }
    return bad;
  });
  check(
    offenders.length === 0,
    `[${where}] no mono type on sentences`,
    offenders.join(" | "),
  );
}

/**
 * Law 4. Paid buttons state their price.
 *
 * Keyed on the verbs that spend. A button in a pending state ("Rolling…",
 * "Casting…") is exempt: it has already been paid for and is reporting, not
 * offering.
 */
async function assertPricedButtons(page: Page, where: string) {
  const result = await page.evaluate(() => {
    const PAID = [/^cast it/i, /^roll again/i, /^sign\b/i];
    const PENDING = [/^casting…/i, /^rolling…/i, /^signing…/i];
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
    console.log(`  --   [${where}] no paid buttons on this surface`);
    return;
  }
  check(
    result.bad.length === 0,
    `[${where}] every paid button states its price`,
    result.bad.join(" | "),
  );
}

/**
 * Law 5. Retention is stated wherever unsigned sheets surface.
 *
 * A sheet that quietly disappears after a week is a worse surprise than one
 * that said so. Only asserted where the section actually renders.
 */
async function assertRetentionStated(page: Page, where: string) {
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
    console.log(`  --   [${where}] no unsigned-sheets section on this surface`);
    return;
  }
  check(result, `[${where}] retention stated where sheets surface`, "no expiry copy found");
}

/**
 * Law 6. A refused brief never hangs.
 *
 * The founder's anime brief was refused server-side — correctly, and for free
 * — and the sheet showed eight skeletons that waited forever. The law is that
 * a failure always resolves to copy with an action.
 */
async function assertNoOrphanSkeletons(page: Page, where: string) {
  const result = await page.evaluate(() => {
    const skeletons = document.querySelectorAll(".dp-skeleton").length;
    const hasFailureCopy = /can't be cast|didn't start/i.test(document.body.innerText);
    return { skeletons, hasFailureCopy };
  });
  // Skeletons and a failure message must never coexist: one of them is lying.
  check(
    !(result.skeletons > 0 && result.hasFailureCopy),
    `[${where}] skeletons never sit under a failure message`,
    `${result.skeletons} skeletons alongside failure copy`,
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
async function assertOverMediaChips(page: Page, where: string) {
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
    console.log(`  --   [${where}] no over-media chips on this surface`);
    return;
  }
  const pale = result.filter((chip) => chip.light);
  check(
    pale.length === 0,
    `[${where}] over-media chips are dark glass`,
    `${pale.length} translucent-white chip(s)`,
  );
  const unreachable = result.filter((chip) => !chip.focusable || chip.label.length === 0);
  check(
    unreachable.length === 0,
    `[${where}] over-media chips are named and keyboard-reachable`,
    `${unreachable.length} chip(s) unnamed or not focusable`,
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
async function assertBriefEcho(page: Page, where: string) {
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
      layered: prose ? getComputedStyle(prose).color !== (triggers[0] && getComputedStyle(triggers[0]).color) : false,
      clamped: style.webkitLineClamp === "2",
      lines: Math.round(echo.getBoundingClientRect().height / parseFloat(style.lineHeight)),
      legacyPills: document.querySelectorAll(".dp-chip--static").length,
    };
  });
  if (result === null) {
    console.log(`  --   [${where}] no brief echo on this surface`);
    return;
  }
  check(result.triggers > 0, `[${where}] the echo has adjustable facts`, "no triggers in the sentence");
  check(
    result.unreachable === 0,
    `[${where}] every fact is keyboard-reachable and named`,
    `${result.unreachable} unreachable`,
  );
  check(result.chipLike === 0, `[${where}] facts are underlined words, not chips`, `${result.chipLike} chip-like`);
  check(result.layered, `[${where}] pinned facts and prose are two layers`, "prose and facts share one colour");
  check(result.lines <= 2, `[${where}] the echo never exceeds two lines`, `${result.lines} lines`);
  check(result.legacyPills === 0, `[${where}] the pill row is gone`, `${result.legacyPills} static chips remain`);

  /*
    And the check that would have caught the defect the founder found.

    The first version asserted against the DOM — the options were in the
    markup, so it passed — while the sentence's `overflow: hidden` clipped the
    popover panel to a sliver on screen. Reading the tree proves a thing
    exists; only measuring proves a user can see it. So this opens a popover
    for real and compares its rendered box against every clipping ancestor.
  */
  const panel = await page.evaluate(() => {
    const trigger = document.querySelector<HTMLElement>(".dpc-echo .dp-pop__trigger");
    if (!trigger) return null;
    trigger.click();
    return true;
  });
  if (!panel) return;
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

  check(visibility.open, `[${where}] a fact's popover actually opens`, "no panel rendered");
  check(
    visibility.clippedBy === "none",
    `[${where}] the popover is not clipped by an ancestor`,
    `clipped by .${visibility.clippedBy}`,
  );
  check(
    visibility.visible === visibility.options && visibility.options > 1,
    `[${where}] every option is on screen`,
    `${visibility.visible} of ${visibility.options} visible`,
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
async function assertOptimisticChrome(page: Page, where: string) {
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
    console.log(`  --   [${where}] no enabled Follow on this surface`);
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
                eyebrow: document.body.innerText.match(/Casting \d+…/)?.[0] ?? "",
              }),
            ),
          ),
      ),
  );

  check(
    after.counter !== follow.counter && /casting/i.test(after.counter),
    `[${where}] the roll counter moves in the click's frame`,
    `still "${after.counter}"`,
  );
  check(
    after.provisional === 1 && after.railPills > follow.railPills,
    `[${where}] the rail grows a provisional pill in the click's frame`,
    `${after.provisional} provisional, ${follow.railPills} → ${after.railPills} pills`,
  );
  check(
    after.eyebrow.length > 0,
    `[${where}] the eyebrow enters its casting state in the click's frame`,
    "eyebrow unchanged",
  );
  check(
    after.skeletons > 0,
    `[${where}] the tiles are skeletons in the click's frame`,
    `${after.skeletons} skeletons`,
  );
}

async function auditSurface(page: Page, url: string, where: string, waitFor?: string) {
  console.log(`\n── ${where}`);
  await page.goto(url, { waitUntil: "networkidle2" });
  if (waitFor) {
    await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 40000 }, waitFor);
  }
  await new Promise((r) => setTimeout(r, 900));
  await assertNoInnerFocusRing(page, where);
  await assertDockVisible(page, where);
  await assertNoMonoSentences(page, where);
  await assertPricedButtons(page, where);
  await assertRetentionStated(page, where);
  await assertNoOrphanSkeletons(page, where);
  await assertOverMediaChips(page, where);
  await assertBriefEcho(page, where);
  // Spends credits, so it is opt-in: --optimistic, on the sheet only.
  if (OPTIMISTIC && where.includes("sheet")) await assertOptimisticChrome(page, where);
}

const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const { hostname } = new URL(BASE);
await page.setCookie({ name: "app_session_id", value: TOKEN, domain: hostname, path: "/" });

for (const theme of ["dark", "light"] as const) {
  console.log(`\n════════ theme: ${theme} ════════`);
  await page.goto(`${BASE}/casting`, { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    localStorage.setItem("drape_theme", t);
  }, theme);

  await auditSurface(page, `${BASE}/casting`, `${theme} · casting tab`, "Meet eight of them");
  if (SESSION) {
    await auditSurface(page, `${BASE}/casting/s/${SESSION}`, `${theme} · casting sheet`);
  } else {
    /*
      A suite that silently skips a surface and still reports success is the
      inverse of invariant 7: a control that does not run does not exist.
    */
    check(false, `[${theme}] casting sheet audited`, "no --session given, so the sheet was never checked");
  }
  await auditSurface(
    page,
    `${BASE}/casting/foundation`,
    `${theme} · primitive gallery`,
    "Shared app foundation",
  );
}

await browser.close();

console.log(`\n${failures.length === 0 ? "ALL DESIGN LAWS HOLD" : `${failures.length} VIOLATION(S)`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
