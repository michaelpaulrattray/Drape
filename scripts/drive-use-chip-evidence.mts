/**
 * THE USE CHIP, PHOTOGRAPHED WITH A PICTURE IN IT — the attach eye's second
 * half (approved fable-1429).
 *
 * `47e841b6` made the chip point at the authenticated route instead of a public
 * url, and `54cfe7a5` stopped the worker collecting the bytes that route serves.
 * Both are unit-armed. **Neither has been looked at**, and the last time a
 * thumbnail on this exact chip was assumed to work it had never loaded once —
 * found by an eye in a second, after seven green arms.
 *
 * So this photographs it, both themes, at the size a person sees it, and
 * measures the one thing a screenshot cannot tell you on its own: whether the
 * picture in the tile actually DECODED. An `<img>` whose src 404s occupies its
 * box and paints nothing, and the panel's own `onError` then removes the tile —
 * so "no broken glyph" is satisfied by both the fixed road and the broken one.
 * `naturalWidth` is what separates them.
 *
 *   EYE_VARIANT=<variant publicId> npx tsx scripts/drive-use-chip-evidence.mts
 */
import "dotenv/config";

import { mkdir } from "node:fs/promises";

import { SignJWT } from "jose";

import { openDrivenPage } from "./lib/drivePage.mts";
import { openDatabase } from "./lib/dbConnection.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/use-chip";

const failures: string[] = [];
const check = (name: string, ok: boolean, saw = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${saw ? ` — saw ${saw}` : ""}`);
  if (!ok) failures.push(name);
};

await mkdir(OUT, { recursive: true });

const url = process.env.DATABASE_URL ?? "";
if (!url.includes("52008")) throw new Error("REFUSED: not the dev database");
const connection = await openDatabase(url);

/* The fixture is READ, never assumed: a variant whose ask carried a picture the
   customer attached, on a session that is still open. */
const [rows] = await connection.query<any[]>(
  `SELECT v.publicId AS variant, cand.publicId AS candidate, cand.position, cand.personaLine,
          roll.rollIndex, s.publicId AS session, u.openId
     FROM casting_candidate_variants v
     JOIN casting_candidates cand ON cand.id = v.candidateId
     JOIN casting_rolls roll ON roll.id = cand.rollId
     JOIN casting_sessions s ON s.id = cand.sessionId
     JOIN users u ON u.id = s.userId
    WHERE v.publicId = ?`,
  [process.env.EYE_VARIANT ?? ""],
);
if (rows.length === 0) throw new Error("EYE_VARIANT names no variant in dev");
const { session, openId, personaLine } = rows[0];
/* The tile's own label — `indexLabel`, which is the 1-based position padded. */
const TILE_LABEL = String(Number(rows[0].position) + 1).padStart(2, "0");
/*
  ⚠ AND THE ROLL, because a tile label is only unique WITHIN one.

  The sheet opens on the newest roll. Driven without this, the first run of this
  script clicked "View candidate 07" on roll 7 while its fixture lived on an
  earlier one, opened a stranger, found no chip, and reported FAIL — a red about
  the wrong person, which is worth no more than a green about one.
*/
const ROLL_LABEL = String(Number(rows[0].rollIndex)).padStart(2, "0");
console.log(`fixture: "${personaLine}" — roll ${ROLL_LABEL}, tile ${TILE_LABEL}, session ${session}`);
await connection.end();

const token = await new SignJWT({ openId, appId: process.env.VITE_APP_ID, name: "use chip eye" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 960 });

for (const theme of ["dark", "light"] as const) {
  /* `drape_theme`, the key the provider actually persists — and a fresh load
     per theme rather than a class toggled in place. */
  await page.evaluateOnNewDocument(`(() => { try { window.localStorage.setItem("drape_theme", ${JSON.stringify(theme)}); } catch {} })()`);
  await page.goto(`${BASE}/casting/s/${session}`, { waitUntil: "domcontentloaded" });

  /* THE ROLL FIRST — see {@link ROLL_LABEL}. The rail is tabs of `01`, `02`, …
     and the sheet opens on the newest. */
  await page.waitForSelector(".dpc-rollrail__item", { timeout: 120_000 }).catch(() => null);
  const onTheRoll = await page.$$eval(".dpc-rollrail__item", (tabs, wantedRoll) => {
    const tab = tabs.find((one) => (one.textContent ?? "").trim().startsWith(wantedRoll as string));
    if (!tab) return false;
    (tab as HTMLButtonElement).click();
    return true;
  }, ROLL_LABEL);
  check(`selected roll ${ROLL_LABEL} (${theme})`, onTheRoll);
  if (!onTheRoll) break;

  /* The sheet is the entrance; the panel lives inside a candidate. Clicked by
     the tile's own label rather than by index, so a re-ordered sheet fails
     loudly instead of photographing the wrong person. */
  const tiles = await page.waitForSelector('button[aria-label^="View candidate"]', { timeout: 120_000 })
    .then(() => page.$$('button[aria-label^="View candidate"]'))
    .catch(() => [] as never[]);
  const wanted = `View candidate ${TILE_LABEL} larger`;
  let opened = false;
  for (const tile of tiles) {
    const label = await tile.evaluate((el) => el.getAttribute("aria-label") ?? "");
    if (label !== wanted) continue;
    /* Dispatched on the element rather than clicked at its coordinates: the
       sheet's brief popover is fixed over the lower rows, so a positional click
       on tile 08 lands on the popover. What is under test here is the chip,
       not the sheet's hit targets. */
    await tile.evaluate((el) => (el as HTMLButtonElement).click());
    opened = true;
    break;
  }
  check(`opened ${wanted} (${theme})`, opened, `${tiles.length} tiles on the sheet`);
  if (!opened) break;
  await page.waitForSelector(".dpc-refine__field", { timeout: 120_000 }).catch(() => null);

  /* ⚠ AND IT IS THE RIGHT PERSON — asserted rather than assumed. Every reading
     below is about whoever is on screen, so this is the arm that makes them
     about the FIXTURE. Its absence is what made the first negative control
     worthless. */
  const whoIsOpen = await page.evaluate(() => document.body.innerText);
  check(`the viewer is showing "${personaLine}" (${theme})`, whoIsOpen.includes(personaLine),
    whoIsOpen.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 3).join(" · "));
  if (!whoIsOpen.includes(personaLine)) break;

  /* Wait on the CHIP, never on a clock — the panel can only draw it once the
     selected version's own row has arrived from a remote database. */
  const chip = await page.waitForSelector(".dpc-refine__madeRef img", { timeout: 60_000 }).catch(() => null);
  if (!chip) {
    await page.screenshot({ path: `${OUT}/miss-${theme}.png` as `${string}.png`, fullPage: true });
    const made = await page.$$eval(".dpc-refine__made", (els) => els.map((e) => e.textContent?.slice(0, 120)));
    console.log(`  where I got to: ${page.url()}`);
    console.log(`  .dpc-refine__made blocks on screen: ${JSON.stringify(made)}`);
  }
  check(`the chip's picture tile is in the DOM (${theme})`, chip !== null);
  if (!chip) break;

  /*
    ⚠ THE READING THAT SEPARATES THE FIXED ROAD FROM THE BROKEN ONE.

    `naturalWidth` is 0 until the bytes decode, and stays 0 forever if the src
    404s. Waited on rather than sampled once, because the route is authenticated
    and the fetch is a real round trip.
  */
  const decoded = await page.waitForFunction(() => {
    const img = document.querySelector<HTMLImageElement>(".dpc-refine__madeRef img");
    return img !== null && img.naturalWidth > 0;
  }, { timeout: 30_000 }).then(() => true).catch(() => false);
  const painted = decoded
    ? await page.$eval(".dpc-refine__madeRef img", (img) => ({
      w: img.naturalWidth, h: img.naturalHeight, src: img.getAttribute("src"),
    }))
    : null;
  check(`her picture actually DECODED (${theme})`, painted !== null,
    painted ? `${painted.w}x${painted.h} from ${painted.src}` : "naturalWidth stayed 0");

  /* And it is served by the authenticated route rather than a public url — the
     ruling this chip exists under: a customer's photograph has no public
     address and must not acquire one. */
  /* ⚠ TOLERANT OF AN UNMOUNTED TILE, and that is the negative control's own
     shape: on the broken road the src 404s, the panel's `onError` removes the
     tile, and a bare `$eval` here THROWS instead of reporting. A driver that
     crashes on the failure it exists to detect reports nothing at all. */
  const src = await page.$eval(".dpc-refine__madeRef img", (img) => img.getAttribute("src") ?? "")
    .catch(() => null);
  check(`served through the authenticated route (${theme})`, src !== null && src.startsWith("/api/reference/"),
    src ?? "the tile removed itself — its picture would not load");

  /* The neighbour keeps its size — the reading a driver forgets and pays for. */
  const box = await page.$eval(".dpc-refine__made", (el) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  }).catch(() => null);
  check(`the chip has a real box (${theme})`, box !== null && box.w > 0 && box.h > 0, JSON.stringify(box));

  const made = await page.$(".dpc-refine__made");
  if (made) {
    await made.screenshot({ path: `${OUT}/use-chip-${theme}.png` as `${string}.png` });
    check(`photographed the chip (${theme})`, true, `${OUT}/use-chip-${theme}.png`);
  }
  await page.screenshot({ path: `${OUT}/panel-${theme}.png` as `${string}.png` });
}

await browser.close();
console.log(`\n${failures.length === 0 ? "PASS" : `FAIL — ${failures.length}`}`);
process.exit(failures.length === 0 ? 0 : 1);
