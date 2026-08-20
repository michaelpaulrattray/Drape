/**
 * DOES A DELIVERED TATTOO SURVIVE THE NEXT EDIT — the carry drive (ordered
 * fable-1165 §2, from the walk's §4 finding).
 *
 * The walk put his T-rex design onto a cast's chest and the frame is good. Then
 * two log lines landed eight seconds apart: the caption reader described the
 * tattoo in detail and declared the edit not visible, and the ink facet was
 * filed NOWHERE (`unfiled: ink, uncataloguedFeature`).
 *
 * The product promise this threatens is scenario 6 as it was relayed to him —
 * *"regenerate, edit, sign: the same stored cutout reused, no drift"*. Today
 * that is a CLAIM, and this is the drive that turns it into a reading.
 *
 * # IT DISCRIMINATES THREE STATES (1165 §2b), and only one of them is a pass
 *
 *   CARRIED               the tattoo is there on step two — a wire exists
 *   LOST                  it is gone — the ruling's omission 1165 §2a names
 *   CARRIED BY ACCIDENT   it is there, but only because WORDS rescued it —
 *                         drift waiting, not a pass
 *
 * The third is why the frames matter more than any reader here: a tattoo
 * re-invented from a sentence looks like a tattoo that carried, and only the
 * PIXELS tell them apart — same artwork, or a different dinosaur.
 *
 * # THE ASK NAMES NOTHING ABOUT INK, DELIBERATELY
 *
 * An edit that mentioned the tattoo would rescue it through the words road and
 * prove nothing. So it asks for an unrelated feature, with NO picture attached,
 * which is the ordinary shape of every second edit a customer ever makes.
 *
 *   pnpm dev            (in another shell)
 *   npx tsx scripts/drive-ink-carry-disposable.mts
 */
import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";

import { SignJWT } from "jose";

import { openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/ink-carry";
const SESSION = "af5011d8-ca5f-4bd8-a785-7cc516c8361d";
/** Unrelated to ink, visible, and cheap to judge by eye. */
const ASK = "give him green eyes";

const log: string[] = [];
const say = (line: string) => { console.log(line); log.push(line); };

await mkdir(OUT, { recursive: true });

const token = await new SignJWT({
  openId: "verify-bot-local",
  appId: process.env.VITE_APP_ID,
  name: "Verify Bot",
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 960 });

await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "domcontentloaded" });
const tile = await page
  .waitForSelector('button[aria-label^="View candidate"]', { timeout: 120_000 })
  .catch(() => null);
if (!tile) { say("FAILED: no candidate tile"); await browser.close(); process.exit(1); }
await tile.click();
const box = await page.waitForSelector(".dpc-refine__field", { timeout: 120_000 }).catch(() => null);
if (!box) { say("FAILED: no ask box"); await browser.close(); process.exit(1); }

/*
  STEP ONE IS ALREADY DONE — the walk bought it. What matters here is that the
  edit is built on THE VERSION THAT HAS THE TATTOO, so this READS which version
  the viewer is on rather than clicking the rail to change it: the first attempt
  clicked a rail item and tore the panel down, which is a driver breaking the
  surface it came to measure.

  The panel draws the selected version's own request beside the box ("what made
  the version she is looking at"), so that sentence IS the identity of the
  version being edited.
*/
const on = await page.evaluate(() => {
  /*
    THE VERSION RAIL IS `.dpc-refine__pick`, and the first attempt used
    `[class*='rail__item']` — which matches the STUDIO NAVIGATION (Create,
    Canvas, Casting, Library). Clicking "the last one" navigated away and tore
    down the panel, and the driver reported that as a broken surface. A selector
    read off the component beats one guessed from a name.
  */
  const picks = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__pick"));
  const last = picks[picks.length - 1];
  last?.click();
  return { picks: picks.length, clicked: Boolean(last) };
});
say(`version picks: ${on.picks}, selected the newest: ${on.clicked}`);
/* The panel re-renders around the newly selected version; wait on the SENTENCE
   that identifies it rather than on the clock. */
const made = await page.waitForFunction(
  () => document.querySelector(".dpc-refine__madeText")?.textContent?.trim() || null,
  { timeout: 60_000, polling: 500 },
).then((handle) => handle.jsonValue() as Promise<string>, () => "");
say(`the version on screen was made by: "${made || "(the original — no request)"}"`);
if (!/tattoo|design/i.test(made)) {
  say("REFUSING TO SPEND: the viewer is not on the tattooed version, so an edit here");
  say("would answer a different question. Nothing was asked and nothing was charged.");
  await browser.close();
  await writeFile(`${OUT}/carry.log`, `${log.join("\n")}\n`);
  process.exit(1);
}

await page.type(".dpc-refine__field", ASK);
await page.evaluate(() => {
  const submit = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
    .find((button) => button.type === "submit");
  submit?.click();
});
say(`asked: "${ASK}" — no picture attached, nothing about ink in the sentence`);

const settled = await page.waitForFunction(
  () => {
    const note = document.querySelector(".dpc-refine__outcome")?.textContent ?? "";
    return note.length > 0;
  },
  { timeout: 900_000, polling: 3000 },
).then(() => true, () => false);
say(`settled: ${settled}`);
say(`said: ${await page.evaluate(() =>
  document.querySelector(".dpc-refine__outcome")?.textContent?.replace("×", "").trim() ?? "(nothing)")}`);

await browser.close();
await writeFile(`${OUT}/carry.log`, `${log.join("\n")}\n`);
console.log(`\nlog: ${OUT}/carry.log — the FRAME is read off the database, not here`);

/* END BY ENDING THE PROCESS — puppeteer leaves handles alive. */
process.exit(0);
