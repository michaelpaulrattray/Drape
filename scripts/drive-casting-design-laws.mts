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
  const fields = await page.$$eval(".dp-input", (els) => els.length);
  for (let i = 0; i < fields; i += 1) {
    const result = await page.evaluate(async (index) => {
      const input = document.querySelectorAll<HTMLElement>(".dp-input")[index];
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
