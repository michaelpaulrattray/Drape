/**
 * CAN SHE FIND HER WAY BACK TO A SHEET SHE HAS NOT SIGNED? (fable-560 §4, a
 * costless walk; the question came out of the casting entry's own shot.)
 *
 * The outsider has an OPEN sheet: one candidate, four paid versions, nothing
 * signed. Her casting entry says **"0 cast members"** and *"No one signed yet —
 * cast a sheet, then sign the candidate you want to keep working with."* Both
 * are true — the roster is signed casts — and neither mentions the work she has
 * in progress.
 *
 * So: from the casting page, with no URL in hand, is there any door back to it?
 * The page offers three filters (All / Signed / Unsigned), which is the obvious
 * candidate for one.
 *
 * This clicks each filter and records what it lists, then looks for any link to
 * the open session anywhere on the page. **A reading, not a verdict**: if the
 * door is absent that is a finding for the founder's desk, not a fix to make.
 *
 * No credits, no generation, nothing written.
 *
 *   pnpm dev            (separate terminal)
 *   npx tsx scripts/probe-unfinished-sheet-door-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import { openDrivenPage } from "./lib/drivePage.mts";
import { ensureOutsider } from "./lib/outsider.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/outsider-walk";
mkdirSync(OUT, { recursive: true });

const outsider = await ensureOutsider();
const { browser, page } = await openDrivenPage({ base: BASE, token: outsider.token, width: 1440, height: 1000 });
const spends: string[] = [];
page.on("request", (request) => {
  const url = request.url();
  if (request.method() === "POST" && /castingV2\.(refine|roll|sign)/.test(url)) spends.push(url.slice(0, 160));
});

try {
  await page.goto(`${BASE}/casting`, { waitUntil: "networkidle2", timeout: 180_000 });
  await page.waitForFunction(() => (document.body.innerText ?? "").includes("cast member"), { timeout: 60_000 });

  /*
    THE FIRST PASS OF THIS PROBE ASKED FOR `a[href*="/casting/s/"]` AND FOUND
    NONE, and I nearly filed "an unsigned sheet has no door" on it. The wire
    says otherwise: `castingV2.openSessions` returns her sheet, so the door
    exists and my selector was a guess about how it is rendered — the third
    absence-by-guessed-selector of the night.

    So this reads the page's WHOLE text (the card may be below the fold; every
    earlier shot was viewport-only), then finds the door by its own words and
    CLICKS it — a door is proved by walking through it, not by matching a tag.
  */
  const readings: any[] = [];
  for (const filter of ["All", "Signed", "Unsigned"]) {
    const clicked = await page.evaluate((want) => {
      const button = Array.from(document.querySelectorAll("button"))
        .find((one) => (one.textContent ?? "").trim() === want);
      if (!button) return false;
      (button as HTMLButtonElement).click();
      return true;
    }, filter);
    await new Promise((resolve) => setTimeout(resolve, 600));
    const seen = await page.evaluate(() => {
      const text = (document.body.innerText ?? "").trim();
      return {
        count: /(\d+)\s+cast members?/.exec(text)?.[1] ?? null,
        emptyLine: /No one signed yet[^\n]*/.exec(text)?.[0] ?? null,
      };
    });
    readings.push({ filter, clicked, ...seen });
    console.log(`${filter.padEnd(9)} clicked=${clicked} · roster count=${seen.count}`);
  }

  /*
    AND WAIT FOR THE SECTION ITSELF. `openSessions` runs four queries per sheet
    against a remote database and only renders once they land — the page is
    "settled" long before. Timed rather than assumed, because the first version
    of this probe read at ~2s and concluded the door did not exist.
  */
  const sectionAt = Date.now();
  const sectionArrived = await page.waitForFunction(
    () => (document.body.innerText ?? "").includes("Unsigned sheets"),
    { timeout: 30_000 },
  ).then(() => Date.now() - sectionAt).catch(() => null);
  console.log(`the "Unsigned sheets" section: ${sectionArrived === null ? "NEVER ARRIVED in 30s" : `arrived after ${sectionArrived}ms`}`);

  const whole = await page.evaluate(() => (document.body.innerText ?? "").trim());
  const mentionsSheet = /roll|sheet|keep|unsigned sheet/i.test(whole);
  console.log(`\nthe page's whole text is ${whole.length} characters · mentions a sheet: ${mentionsSheet}`);

  /*
    Find the door by its own words and walk through it — and do not assume it
    is a button or a link. The card is clickable markup with no tag that says
    so, which is why the tag-based search found nothing: **an absence proved by
    a guessed selector is not an absence.** So this takes every element whose
    text names a roll, keeps the DEEPEST (a page-level wrapper matches too, and
    clicking that does nothing), then walks up to whatever answers a pointer.
  */
  const door = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*")) as HTMLElement[];
    const naming = all.filter((one) => /[0-9]+\s+rolls?/i.test(one.textContent ?? ""));
    const deepest = naming.filter((one) => !naming.some((other) => other !== one && one.contains(other)));
    const hit = deepest[0];
    if (!hit) return null;
    let target: HTMLElement = hit;
    for (let up = 0; up < 6 && target.parentElement; up += 1) {
      if (target.getAttribute("role") === "button" || target.tagName === "BUTTON" || target.tagName === "A") break;
      target = target.parentElement;
    }
    target.setAttribute("data-probe", "door");
    return (target.textContent ?? "").trim().slice(0, 80);
  });
  let walked: string | null = null;
  if (door) {
    await page.click('[data-probe="door"]');
    await page.waitForFunction(() => location.pathname.includes("/casting/s/"), { timeout: 30_000 }).catch(() => null);
    walked = await page.evaluate(() => location.pathname);
  }
  console.log(`the door reads "${door ?? "(none found by words)"}" · walking it lands on ${walked ?? "(not walked)"}`);
  console.log(`expected /casting/s/${outsider.sessionPublicId}`);
  console.log(`nothing spent: ${spends.length === 0}`);
  writeFileSync(`${OUT}/unfinished-door.json`, `${JSON.stringify({ readings, door, walked, whole, session: outsider.sessionPublicId }, null, 2)}\n`);
  writeFileSync(`${OUT}/unfinished-door.png`, await page.screenshot({ fullPage: true }));
} finally {
  await browser.close();
}
process.exit(0);
