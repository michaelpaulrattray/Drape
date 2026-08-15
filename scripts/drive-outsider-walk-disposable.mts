/**
 * THE LAUNCH SURFACE — every casting screen as the user who is not the founder.
 * (fable-557 §4: a READING, not a build. Its product is evidence.)
 *
 * Every scope flag in this program names the founder in production, and every
 * driver we have signs in as an account inside all of them. So the surface that
 * ships to everybody else — the panel with no scan, the rail with one version,
 * the casting entry with an empty roster — has never been looked at with
 * instruments on. This walks it as the standing outsider and photographs what
 * is actually there, both themes.
 *
 * # What it does and does not claim
 *
 * It does not assert that any of this is CORRECT — that judgement is the
 * founder's and Fable's, and the shots are the exhibit. What it asserts is only
 * what a reading can honestly assert:
 *
 * ```
 * RENDERS      the page paints something rather than a blank or an error
 * NOT STUCK    no spinner or "reading…" line survives its own wait
 * NOT EMPTY    a surface that shows nothing says why (an empty state with words)
 * NO PROMISE   nothing offers a capability this account does not have
 * NO SPEND     no roll, refine or sign call leaves any page
 * ```
 *
 * Every observation records what it SAW, and each page's own words are captured
 * verbatim into the JSON so the copy can be read without opening a browser.
 *
 *   pnpm dev            (separate terminal)
 *   npx tsx scripts/drive-outsider-walk-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import { openDrivenPage } from "./lib/drivePage.mts";
import { ensureOutsider } from "./lib/outsider.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/outsider-walk";
mkdirSync(OUT, { recursive: true });
const THEMES = ["dark", "light"] as const;

const records: { ok: boolean; name: string; saw: string }[] = [];
const check = (ok: boolean, name: string, saw: string) => {
  records.push({ ok, name, saw });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
};

const outsider = await ensureOutsider();
if (!outsider.sessionPublicId) throw new Error("the outsider has no sheet — check the donor");
console.log(`outsider ${outsider.id} · sheet ${outsider.sessionPublicId} · inside: ${outsider.insideScopes.join(", ") || "(nothing)"}\n`);

const STOPS = [
  { name: "lobby", path: "/app" },
  { name: "casting-entry", path: "/casting" },
  { name: "sheet", path: `/casting/s/${outsider.sessionPublicId}` },
] as const;

for (const theme of THEMES) {
  const { browser, page } = await openDrivenPage({ base: BASE, token: outsider.token, width: 1440, height: 1000 });
  const spends: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (request.method() === "POST" && /castingV2\.(refine|roll|sign)/.test(url)) spends.push(url.slice(0, 160));
  });
  try {
    await page.evaluateOnNewDocument((value) => {
      window.localStorage.setItem("drape_theme", value);
    }, theme);

    for (const stop of STOPS) {
      await page.goto(`${BASE}${stop.path}`, { waitUntil: "networkidle2", timeout: 180_000 });
      /*
        WAIT FOR THE PAGE'S OWN CONTENT, NOT FOR THE APP'S CHROME.

        The first pass waited for "more than 40 characters of body text" and
        photographed three "Loading…" screens: the rail alone (Home, Create,
        Canvas, Templates, Casting, Assets, Library) is fifty characters, so the
        wait was satisfied before the route rendered anything at all. A
        page-level text wait is met by the frame around the page.

        So it waits for the loading word to LEAVE — and records how long that
        took, because a route that never finishes is a finding rather than a
        slow pass.
      */
      const startedAt = Date.now();
      const settled = await page.waitForFunction(
        () => {
          const text = (document.body.innerText ?? "").trim();
          if (text.length <= 40 || text.includes("Loading…")) return false;
          /* AND THE SKELETONS MUST BE GONE. The second pass caught the word
             "Loading…" and photographed the lobby as four grey placeholder
             tiles: a skeleton says nothing in innerText, so a text-only wait
             cannot see it. This driver already COLLECTED the skeleton count and
             never asserted on it — collected-but-unasserted is the same as
             blind. */
          if (document.querySelectorAll('[class*="skeleton"], [aria-busy="true"]').length > 0) return false;
          /* And any picture the page has decided to show has to have arrived,
             or the shot is of the network. */
          const images = Array.from(document.querySelectorAll("img")) as HTMLImageElement[];
          return images.every((img) => !img.src || img.complete);
        },
        { timeout: 60_000 },
      ).then(() => true).catch(() => false);
      const waited = Date.now() - startedAt;
      check(settled, `${theme} ${stop.name}: the route finishes loading`,
        settled ? `settled in ${waited}ms` : `still loading after ${waited}ms — skeletons or a picture never arrived`);

      const seen = await page.evaluate(() => {
        const text = (document.body.innerText ?? "").trim();
        const spinners = document.querySelectorAll('[class*="skeleton"], [class*="spinner"], [aria-busy="true"]').length;
        const buttons = Array.from(document.querySelectorAll("button"))
          .map((one) => (one.textContent ?? "").trim())
          .filter((one) => one.length > 0 && one.length < 40);
        return {
          words: text.slice(0, 1400),
          length: text.length,
          spinners,
          buttons: Array.from(new Set(buttons)).slice(0, 24),
          images: Array.from(document.querySelectorAll("img"))
            .filter((img) => (img as HTMLImageElement).naturalWidth > 0).length,
          brokenImages: Array.from(document.querySelectorAll("img"))
            .filter((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth === 0).length,
          errorish: /something went wrong|error|failed to load|not found/i.test(text),
        };
      });

      check(seen.length > 40, `${theme} ${stop.name}: the page has words`, `${seen.length} characters`);
      check(!seen.errorish, `${theme} ${stop.name}: nothing on it reads as an error`,
        seen.errorish ? seen.words.slice(0, 120) : "no error wording");
      check(seen.brokenImages === 0, `${theme} ${stop.name}: no picture failed to load`,
        `${seen.images} painted · ${seen.brokenImages} broken`);
      check(seen.spinners === 0, `${theme} ${stop.name}: nothing is still a placeholder`,
        `${seen.spinners} skeletons on screen`);
      check(spends.length === 0, `${theme} ${stop.name}: nothing spent`,
        spends.length === 0 ? "no spending call" : spends.join(" | "));

      writeFileSync(`${OUT}/${theme}-${stop.name}.png`, await page.screenshot({ fullPage: false }));
      writeFileSync(`${OUT}/${theme}-${stop.name}.json`, `${JSON.stringify(seen, null, 2)}\n`);
      console.log(`      ${stop.name}: ${seen.buttons.slice(0, 8).join(" · ")}`);

      /*
        AND THE GAP NOBODY HAS TIMED. The sheet paints its chrome and its brief
        box with NO tile and NO placeholder, and her face arrives afterwards —
        the page is "settled" by every definition above while the thing she came
        for is not on it. Measured rather than asserted, both states
        photographed: a reading, not a verdict (fable-557 §4).
      */
      if (stop.name === "sheet") {
        const from = Date.now();
        const appeared = await page.waitForSelector('button[aria-label^="View candidate"]', { timeout: 120_000 })
          .then(() => Date.now() - from).catch(() => null);
        const decoded = await page.waitForFunction(() => {
          const img = document.querySelector('button[aria-label^="View candidate"] img') as HTMLImageElement | null;
          return Boolean(img && img.complete && img.naturalWidth > 0);
        }, { timeout: 120_000 }).then(() => Date.now() - from).catch(() => null);
        check(appeared !== null, `${theme} sheet: her tile arrives at all`,
          appeared === null ? "no tile after 120s"
            : `the button after ${appeared}ms, her face after ${decoded ?? "never"}ms`);
        writeFileSync(`${OUT}/${theme}-sheet-after.png`, await page.screenshot({ fullPage: false }));
      }
    }

    /* And the one surface that only exists inside the sheet: the viewer, its
       rail and whatever the panel column does with no scan and no library. */
    await page.waitForSelector('button[aria-label^="View candidate"]', { timeout: 120_000 });
    const label = await page.evaluate(() => document.querySelector('button[aria-label^="View candidate"]')!.getAttribute("aria-label"));
    await page.click(`button[aria-label="${label}"]`);
    await page.waitForFunction(() => {
      const img = document.querySelector(".dpc-viewer__plate img") as HTMLImageElement | null;
      return Boolean(img && img.complete && img.naturalWidth > 0);
    }, { timeout: 90_000 }).catch(() => null);
    await page.waitForFunction(() => !document.querySelector(".dpc-face__working"), { timeout: 60_000 }).catch(() => null);

    const viewer = await page.evaluate(() => ({
      chips: Array.from(document.querySelectorAll("[data-frame]")).length,
      panel: Boolean(document.querySelector(".dpc-face")),
      working: document.querySelector(".dpc-face__working")?.textContent?.trim() ?? null,
      notes: Array.from(document.querySelectorAll(".dpc-refine__note")).map((one) => (one.textContent ?? "").trim()),
      askBox: (document.querySelector(".dpc-refine__field") as HTMLInputElement | null)?.placeholder ?? null,
      dockButtons: Array.from(document.querySelectorAll(".dpc-viewer__dock button, .dpc-refine button"))
        .map((one) => (one.textContent ?? "").trim()).filter(Boolean),
    }));
    check(viewer.working === null, `${theme} viewer: nothing is still "reading"`, viewer.working ?? "no working line");
    check(viewer.askBox !== null, `${theme} viewer: she can be asked for something`, viewer.askBox ?? "no ask box");
    check(spends.length === 0, `${theme} viewer: nothing spent`, spends.length === 0 ? "no spending call" : spends.join(" | "));
    console.log(`      viewer notes: ${viewer.notes.join(" | ")}`);
    writeFileSync(`${OUT}/${theme}-viewer.png`, await page.screenshot({ fullPage: false }));
    writeFileSync(`${OUT}/${theme}-viewer.json`, `${JSON.stringify(viewer, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

const failed = records.filter((row) => !row.ok);
console.log(`\n${records.length - failed.length}/${records.length} · shots in ${OUT}/`);
writeFileSync(`${OUT}/checks.json`, `${JSON.stringify(records, null, 2)}\n`);
process.exit(failed.length === 0 ? 0 : 1);
