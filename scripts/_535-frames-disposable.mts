/**
 * DISPOSABLE — #535 design-report frames: the Re-imagine control mocked onto
 * the three real surfaces (hero brief box, sheet dock, concept-upload
 * description), both themes, by DOM injection into the running dev app.
 * These are DESIGN MOCKUPS, not shipped UI — the captions say so.
 *
 *   npx tsx scripts/_535-frames-disposable.mts --stage glyphs
 *   npx tsx scripts/_535-frames-disposable.mts --stage frames
 */
import "dotenv/config";
import { SignJWT } from "jose";
import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage } from "./lib/drivePage.mts";

const base = process.env.DRIVE_BASE ?? "http://localhost:3001";
const stageAt = process.argv.indexOf("--stage");
const STAGE = stageAt === -1 ? "frames" : process.argv[stageAt + 1];

/* The proposed glyph candidates — house grammar: 24×24, straight runs + arcs, stroke 1.7. */
const GLYPHS: Record<string, string[]> = {
  A_turn: ["M19.5 12a7.5 7.5 0 1 1-2.2-5.3", "M19.5 4v4.7h-4.7"],
  B_lineloop: ["M4 18.5h8a5.5 5.5 0 1 0-5.5-5.5"],
  D_spiral: ["M12 3.5a8.5 8.5 0 1 1-8.5 8.5", "M3.5 12a5.5 5.5 0 1 1 5.5 5.5"],
};

const svgFor = (paths: string[], size: number, color: string): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.map((d) => `<path d="${d}"/>`).join("")}</svg>`;

/* THE CHOSEN GLYPH for the frames — set after the glyphs stage was looked at. */
const CHOSEN = GLYPHS.D_spiral!;

const mintToken = async (): Promise<string> => {
  const db = await openDatabase();
  const [users] = await db.query(`SELECT openId, name FROM users WHERE id = 823`);
  await db.end();
  const bot = (users as { openId: string; name: string | null }[])[0];
  if (!bot) throw new Error("no user 823 in dev");
  return new SignJWT({ openId: bot.openId, appId: process.env.VITE_APP_ID, name: bot.name ?? "verify bot" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
};

if (STAGE === "glyphs") {
  const token = await mintToken();
  const { browser, page } = await openDrivenPage({ base, token });
  const cells = Object.entries(GLYPHS)
    .map(([name, paths]) =>
      [13, 15, 24, 44]
        .map((s) => `<span style="display:inline-flex;align-items:center;justify-content:center;width:${s + 16}px">${svgFor(paths, s, "currentColor")}</span>`)
        .join("")
        .concat(`<span style="font:12px Inter,sans-serif;opacity:.6;margin-left:10px">${name}</span>`),
    )
    .map((row) => `<div style="display:flex;align-items:center;gap:6px;margin:10px 0">${row}</div>`)
    .join("");
  const html = `<body style="margin:0;display:flex"><div style="flex:1;background:#0A0A0A;color:#EBEBEB;padding:24px">${cells}</div><div style="flex:1;background:#EBEBEB;color:#0A0A0A;padding:24px">${cells}</div></body>`;
  await page.setContent(html);
  await page.setViewport({ width: 900, height: 340 });
  await page.screenshot({ path: "output/535-frames/glyph-candidates.png" });
  console.log("wrote output/535-frames/glyph-candidates.png");
  await browser.close();
  process.exit(0);
}

/* ---------- frames stage ---------- */

const SHEET_SESSION = "3e5726f3-14d2-412a-860f-5319eb4a3303"; // dev rolls 100-107: author road
const REIMAGINED =
  "A woman in her late 30s who was built for a war and has outlived the reason for it. Broad through the "
  + "shoulders, a face that carries old damage and doesn't hide it. Her augmentation is military, not cosmetic: "
  + "fused into her rather than worn, plainly older than she is now, scarred and dented where it meets skin, "
  + "still faintly alive with the small lights and glows of a system nobody maintains. Her two eyes don't "
  + "match, and the human one is the tired one. Guarded, unhurried, done being surprised.";
const TYPED =
  "Broad-shouldered woman, late 30s, deep scarring across a face otherwise unaugmented except for one detail: "
  + "a thick black collar of plating fused directly into the base of her neck and upper spine.";

const token = await mintToken();
const { browser, page } = await openDrivenPage({ base, token });
await page.setViewport({ width: 1440, height: 900 });

const GLYPH_BUTTON = `
  <button type="button" title="Re-imagine" aria-label="Re-imagine" data-mock="reimagine"
    style="display:inline-flex;align-items:center;justify-content:center;flex:none;background:none;border:none;
           padding:2px;margin:0;cursor:pointer;color:inherit;opacity:.55;line-height:0">
    ${svgFor(CHOSEN, 13, "currentColor")}
  </button>`;

const setReactValue = (selector: string, value: string) =>
  page.evaluate(
    ({ selector, value }) => {
      const el = document.querySelector(selector) as HTMLTextAreaElement;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    { selector, value },
  );

for (const theme of ["dark", "light"] as const) {
  await page.evaluateOnNewDocument((mode: string) => {
    window.localStorage.setItem("drape_theme", mode);
  }, theme);

  /* -- 1 · the hero -- */
  await page.goto(`${base}/casting`, { waitUntil: "networkidle2", timeout: 120_000 });
  await page.waitForSelector(".dpc-hero__field .dpc-brieffield", { timeout: 60_000 });
  await setReactValue(".dpc-hero__field .dpc-brieffield", TYPED);
  await page.evaluate((btn) => {
    /* Trailing, beside Cast it: type → re-imagine → cast, in reading order. */
    const field = document.querySelector(".dpc-hero__field")!;
    const cast = field.querySelector("button");
    if (cast) cast.insertAdjacentHTML("beforebegin", btn);
    else field.insertAdjacentHTML("beforeend", btn);
    /* Decision 1: the imagination level goes — the chip reads Style alone. */
    for (const el of Array.from(document.querySelectorAll("button, span"))) {
      if (el.children.length === 0 && el.textContent && / · (Low|Max)$/.test(el.textContent.trim())) {
        el.textContent = el.textContent.replace(/ · (Low|Max)\s*$/, "");
      }
    }
  }, GLYPH_BUTTON);
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `output/535-frames/hero-idle-${theme}.png` });

  /* -- 2 · the hero AFTER a press: the box rewritten in place, undo beside the count -- */
  await setReactValue(".dpc-hero__field .dpc-brieffield", REIMAGINED);
  await page.evaluate(() => {
    const btn = document.querySelector('[data-mock="reimagine"]') as HTMLElement;
    btn.style.opacity = "0.9";
    const field = document.querySelector(".dpc-hero__field")!;
    field.insertAdjacentHTML(
      "afterend",
      `<div data-mock="undoline" style="display:flex;gap:14px;align-items:baseline;margin-top:6px;
         font:400 11.5px Inter,sans-serif;opacity:.62">
         <span>Re-imagined from your words — press again for another idea.</span>
         <button type="button" style="background:none;border:none;padding:0;cursor:pointer;color:inherit;
           text-decoration:underline;font:inherit">Undo</button>
       </div>`,
    );
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `output/535-frames/hero-after-${theme}.png` });

  /* -- 3 · the sheet's dock: the glyph where the sparkle sits; the gear reads Style alone -- */
  await page.goto(`${base}/casting/s/${SHEET_SESSION}`, { waitUntil: "networkidle2", timeout: 120_000 });
  /* Wait for the RECORD, not just the dock — the page settles queries after first paint (#534's driver). */
  await page.waitForSelector(".dpc-prompt__summary", { timeout: 60_000 });
  await page.waitForSelector(".dp-dock-fade .dpc-briefrow", { timeout: 60_000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate((btn) => {
    const row = document.querySelector(".dp-dock-fade .dpc-briefrow")!;
    const spark = row.querySelector("svg");
    if (spark) spark.remove();
    row.insertAdjacentHTML("afterbegin", btn);
    /* Decision 1 everywhere it shows: the gear chip and the record line lose the imagination half. */
    for (const el of Array.from(document.querySelectorAll("button, span"))) {
      if (el.children.length === 0 && el.textContent && / · (Low|Max)( imagination)?\s*$/.test(el.textContent.trimEnd())) {
        el.textContent = el.textContent.replace(/ · (Low|Max)( imagination)?\s*$/, "");
      }
    }
  }, GLYPH_BUTTON);
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `output/535-frames/sheet-dock-${theme}.png` });

  /* -- 4 · the concept-upload review: the description is a brief box too -- */
  await page.goto(`${base}/casting`, { waitUntil: "networkidle2", timeout: 120_000 });
  await page.waitForSelector(".dpc-hero__photos", { timeout: 60_000 });
  await page.click(".dpc-hero__photos");
  await page.waitForSelector(".dpc-entry__file", { timeout: 20_000 });
  const fileInput = await page.$(".dpc-entry__file");
  await (fileInput as import("puppeteer-core").ElementHandle<HTMLInputElement>).uploadFile(
    "output/_shift94-concept/A-head/SCI-FI_042dfe5e.jpg",
  );
  /* The reader writes the description — a real vision call, cents. */
  await page.waitForFunction(
    () => {
      const box = document.querySelector("#dpc-concept-description") as HTMLTextAreaElement | null;
      return box !== null && !box.disabled && box.value.trim().length > 0;
    },
    { timeout: 120_000 },
  );
  await page.evaluate((btn) => {
    const field = document.querySelector(".dpc-modal__field")!;
    field.insertAdjacentHTML("afterbegin", `<div style="position:absolute;right:10px;bottom:8px">${btn}</div>`);
    (field as HTMLElement).style.position = "relative";
  }, GLYPH_BUTTON);
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `output/535-frames/concept-${theme}.png` });

  console.log(`[${theme}] hero + sheet + concept done`);
}
await browser.close();
console.log("frames written to output/535-frames/");
process.exit(0);
