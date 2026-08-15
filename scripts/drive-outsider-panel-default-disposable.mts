/**
 * WHAT THE PANEL LOOKS LIKE TO EVERYONE WHO IS NOT THE FOUNDER.
 * (fable-544 §2 use (b), on the fixture built for it.)
 *
 * The face panel draws from two places: the reference LIBRARY (what her edits
 * have minted) and, behind `CASTING_FACE_SCAN_SCOPE`, an auto-SCAN that fills
 * the rows the library has nothing for. Both flags name the founder in
 * production. **So every user who is not him meets a third panel that no driver
 * has ever looked at** — the one with no scan and an empty library.
 *
 * Every existing driver signs in as the account inside every flag, which cannot
 * see this state by construction. This one signs in as the standing outsider
 * (`scripts/lib/outsider.mts`) and refuses to run if that account turns out to
 * be inside the flags after all — a green from an admitted user would be a
 * statement about the flag rather than about the surface.
 *
 * # What is asserted, and why each one is a real failure mode
 *
 * ```
 * 1  her photograph decodes                    — everything after it is graded
 *                                                on a picture that is there
 * 2  the working line CLEARS                   — "Reading their features…"
 *                                                belongs to a scan that is not
 *                                                coming for this account; a
 *                                                working state that outlives
 *                                                its read is the defect
 * 3  no empty column                           — the panel is either absent
 *                                                (what the server's own
 *                                                `enabled: false` intends) or
 *                                                it has rows. An empty column
 *                                                is the founder's "it looks
 *                                                like nothing is happening",
 *                                                shipped to everyone but him
 * 4  every row it shows is labelled, and its
 *    picture slot is a cutout or a deliberate
 *    blank
 * 5  her photograph has the room               — the neighbour law: a panel
 *                                                that takes the viewer's pixels
 *                                                passes every assertion about
 *                                                itself
 * 6  she can still be asked for something      — read off the refine field's
 *                                                OWN class. The first pass
 *                                                asked for "an input with a
 *                                                placeholder" and matched the
 *                                                sheet's brief box behind the
 *                                                viewer; the second guessed a
 *                                                container class and found
 *                                                nothing. Both would have been
 *                                                verdicts about a selector
 * 7  nothing spends                            — watched at the wire
 * ```
 *
 * Both themes, screenshots kept, every check records what it SAW.
 *
 *   pnpm dev            (separate terminal)
 *   npx tsx scripts/drive-outsider-panel-default-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import { openDrivenPage } from "./lib/drivePage.mts";
import { assertOutsideScope, ensureOutsider } from "./lib/outsider.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/outsider-panel";
mkdirSync(OUT, { recursive: true });
const THEMES = ["dark", "light"] as const;

const records: { ok: boolean; name: string; saw: string }[] = [];
const check = (ok: boolean, name: string, saw: string) => {
  records.push({ ok, name, saw });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
};

const outsider = await ensureOutsider();
/* The panel's two sources. If either admits this account the run is meaningless
   and says so instead of passing. */
assertOutsideScope(outsider, "CASTING_FACE_SCAN_SCOPE");
assertOutsideScope(outsider, "CASTING_REFERENCE_LIBRARY_SCOPE");
if (!outsider.sessionPublicId) throw new Error("the outsider has no sheet to open — check the donor account");
console.log(`outsider ${outsider.id} · sheet ${outsider.sessionPublicId} · inside: ${outsider.insideScopes.join(", ") || "(nothing)"}\n`);

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
    await page.goto(`${BASE}/casting/s/${outsider.sessionPublicId}`, { waitUntil: "networkidle2", timeout: 180_000 });
    await page.waitForSelector('button[aria-label^="View candidate"]', { timeout: 180_000 });
    /* The viewer of whichever tile this sheet has — never a hard-coded index,
       because the fixture's sheet holds exactly one and a future one may not. */
    const label = await page.evaluate(() => document.querySelector('button[aria-label^="View candidate"]')!.getAttribute("aria-label"));
    await page.click(`button[aria-label="${label}"]`);

    /*
      WAIT ON THE BYTES, THEN ON THE READ — in that order, and never on a clock.

      The first pass of this driver read at mount and reported four failures
      that were all one mistake: a 2.4MB master had not decoded (the plate is a
      grey box until it does) and the panel's own query was still in flight, so
      "Reading their features…" was on screen and the rows had not arrived. Every
      one of those was the loading state being graded as the finished one.
    */
    const painted = await page.waitForFunction(() => {
      const img = document.querySelector(".dpc-viewer__plate img") as HTMLImageElement | null;
      return Boolean(img && img.complete && img.naturalWidth > 0);
    }, { timeout: 90_000 }).then(() => true).catch(() => false);
    check(painted, `${theme}: her photograph decodes`, painted ? "naturalWidth > 0" : "still blank after 90s");

    /* A working state that can outlive its read is the failure this waits to
       catch: with the scan out of scope, nothing is coming, and the line must
       go rather than promise forever. */
    const settled = await page.waitForFunction(
      () => !document.querySelector(".dpc-face__working"),
      { timeout: 60_000 },
    ).then(() => true).catch(() => false);
    check(settled, `${theme}: no read is promised that will never come`,
      settled ? "the working line cleared" : "\"Reading their features…\" still on screen after 60s");

    const seen = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".dpc-face__row"));
      const photo = document.querySelector(".dpc-viewer__plate img") as HTMLImageElement | null;
      const box = photo?.getBoundingClientRect();
      return {
        panelPresent: Boolean(document.querySelector(".dpc-face")),
        working: document.querySelector(".dpc-face__working")?.textContent?.trim() ?? null,
        title: document.querySelector(".dpc-face__title")?.textContent?.trim() ?? null,
        rowCount: rows.length,
        named: rows.filter((row) => (row.querySelector(".dpc-face__name")?.textContent ?? "").trim().length > 0).length,
        withCutouts: rows.filter((row) => row.querySelector(".dpc-face__cut")).length,
        blankThumbs: rows.filter((row) => row.querySelector(".dpc-face__thumb--none")).length,
        names: rows.map((row) => (row.querySelector(".dpc-face__name")?.textContent ?? "").trim()).slice(0, 12),
        photo: box ? { width: box.width, height: box.height } : null,
        /* SCOPED TO THE VIEWER'S OWN DOCK. The first pass asked the whole
           document for "an input with a placeholder" and got the sheet's brief
           box, which sits behind the viewer and is always there — an assertion
           that would have passed with the ask box entirely missing. The class
           below is the field's own, read out of RefinePanel rather than
           guessed. */
        askBox: (document.querySelector('.dpc-refine__field') as HTMLInputElement | null)?.placeholder ?? null,
      };
    });

    /*
      THE STEADY STATE, and what it should be.

      `facePanel` answers `{ enabled: false, groups: [] }` to an account outside
      the reference-library scope, and the client renders nothing at all rather
      than an empty column — so the honest outcome for this actor is NO PANEL,
      with the viewer keeping the width. A panel that appeared with rows would
      mean the gate leaks; a panel that appeared EMPTY would be the founder's
      own "it looks like nothing is even happening", shipped to everyone who is
      not him.
    */
    check(!seen.panelPresent || seen.rowCount > 0,
      `${theme}: no empty column — the panel is either absent or has rows`,
      seen.panelPresent ? `panel present with ${seen.rowCount} rows (${seen.names.join(", ")})` : "no .dpc-face on screen");
    check(seen.rowCount === 0 || seen.named === seen.rowCount, `${theme}: every row it does show is labelled`,
      `${seen.named} of ${seen.rowCount} carry a name`);
    check(seen.rowCount === 0 || seen.blankThumbs + seen.withCutouts === seen.rowCount,
      `${theme}: every row's picture slot is a cutout or a deliberate blank`,
      `${seen.withCutouts} cutouts · ${seen.blankThumbs} blank · ${seen.rowCount} rows`);
    check(Boolean(seen.photo && seen.photo.width > 200 && seen.photo.height > 200),
      `${theme}: her photograph has the room`,
      seen.photo ? `${Math.round(seen.photo.width)}×${Math.round(seen.photo.height)}` : "no photograph found");
    check(seen.askBox !== null, `${theme}: she can still be asked for something`,
      seen.askBox ?? "no ask box on screen");
    check(spends.length === 0, `${theme}: nothing spent`, spends.length === 0 ? "no spending call left the page" : spends.join(" | "));

    const shot = await page.screenshot({ fullPage: false });
    writeFileSync(`${OUT}/${theme}.png`, shot);
    writeFileSync(`${OUT}/${theme}.json`, `${JSON.stringify(seen, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

const failed = records.filter((row) => !row.ok);
console.log(`\n${records.length - failed.length}/${records.length} · shots in ${OUT}/`);
writeFileSync(`${OUT}/checks.json`, `${JSON.stringify(records, null, 2)}\n`);
process.exit(failed.length === 0 ? 0 : 1);
