/**
 * THE WORDS LANE, END TO END, THROUGH A REAL BROWSER ON A REAL PHOTOGRAPH —
 * the smaller sibling of the founder-eyes crop gate (ordered fable-1105 §5).
 *
 * Every arm of this road has been proved somewhere: the readers in their own
 * suites, the lane's decision directly, the wiring at the service with a
 * scripted reader, the entrance on the live transport. **None of that is a
 * customer doing it.** This is: attach his own colour specimen through the real
 * picker, type a colour ask, and photograph what comes back.
 *
 * WHAT IT SPENDS. One hair-colour read on the OpenRouter balance, house money.
 * NO credits: a words take is answered before the claim, so nothing is
 * deducted — and that is asserted here rather than assumed, by reading the
 * account's balance on both sides.
 *
 *   npx tsx scripts/drive-words-lane-offer-disposable.mts
 */
import "dotenv/config";

import { mkdir } from "node:fs/promises";

import { SignJWT } from "jose";
import type { ElementHandle } from "puppeteer-core";

import { openDrivenPage } from "./lib/drivePage.mts";
import { openDatabase } from "./lib/dbConnection.mts";
import { readOpenRouterBalance } from "./lib/openrouterBalance.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/attach-surface";
const SESSION = process.env.ATTACH_SESSION ?? "af5011d8-ca5f-4bd8-a785-7cc516c8361d";
/* HIS OWN COLOUR SPECIMEN — four blocked tones, the picture §9.2 is about. */
const PICTURE = "docs/specs/references/build-two-founder-specimens/hair-colour-blocked-sections-copper-platinum-black-silver.png";

const failures: string[] = [];
const check = (name: string, ok: boolean, saw = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${saw ? ` — saw ${saw}` : ""}`);
  if (!ok) failures.push(name);
};

await mkdir(OUT, { recursive: true });

/** Her credits, read off the row — "free" is a fact about the ledger. */
const conn = await openDatabase(process.env.DATABASE_URL!);
const creditsNow = async (): Promise<number> => {
  const [rows] = await conn.query<any[]>("SELECT balance FROM points WHERE userId = 823");
  return Number(rows[0]?.balance ?? -1);
};
const before = await creditsNow();
const moneyBefore = await readOpenRouterBalance().catch(() => null);

const token = await new SignJWT({
  openId: "verify-bot-local",
  appId: process.env.VITE_APP_ID,
  name: "Verify Bot",
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 960 });

await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "domcontentloaded" });
const tile = await page
  .waitForSelector('button[aria-label^="View candidate"]', { timeout: 120_000 })
  .catch(() => null);
check("a candidate tile is on the sheet", tile !== null);
if (tile) await tile.click();
const box = await page.waitForSelector(".dpc-refine__field", { timeout: 120_000 }).catch(() => null);
check("the ask box is on screen", box !== null);

if (box) {
  const input = (await page.$(".dpc-refine__readInput")) as ElementHandle<HTMLInputElement> | null;
  check("the picker is there", input !== null);
  if (input) {
    await input.uploadFile(PICTURE);
    await page.waitForSelector(".dpc-refine__claim", { timeout: 20_000 });
    /* "I made it" — his own specimen, and the claim is his to make. */
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>(".dpc-refine__claim button")?.click();
    });
    const attached = await page
      .waitForFunction(() => document.querySelector(".dpc-refine__claim") === null, { timeout: 60_000 })
      .then(() => true, () => false);
    check("the picture attached", attached);

    await page.type(".dpc-refine__field", "take the hair colour from this picture");
    await page.evaluate(() => {
      const submit = Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
        .find((button) => button.type === "submit");
      submit?.click();
    });

    /* Wait on the THING: the offer's own sentence, which is the whole point. */
    const offered = await page
      .waitForSelector(".dpc-refine__readResult .dpc-refine__madeText", { timeout: 180_000 })
      .catch(() => null);
    check("a sentence came back to adopt", offered !== null);

    const read = await page.evaluate(() => ({
      caption: document.querySelector(".dpc-refine__readCaption")?.textContent?.trim() ?? "",
      sentence: document.querySelector(".dpc-refine__readResult .dpc-refine__madeText")?.textContent?.trim() ?? "",
      use: document.querySelector(".dpc-refine__readResult .dpc-refine__madeUse")?.textContent?.trim() ?? "",
      note: document.querySelector(".dpc-refine__readResult .dpc-refine__readNote")?.textContent?.trim() ?? "",
      field: document.querySelector<HTMLInputElement>(".dpc-refine__field")?.value ?? "",
    }));
    console.log(`   caption : ${read.caption}`);
    console.log(`   sentence: ${read.sentence}`);
    console.log(`   dropped : ${read.note || "(nothing)"}`);
    check("it says nothing has changed yet", /nothing has changed yet/i.test(read.caption), read.caption);
    check("the sentence is a real reading", read.sentence.length > 3, read.sentence);

    const panel = await page.$(".dpc-refine");
    if (panel) await panel.screenshot({ path: `${OUT}/4-offer-dark.png` as never });
    check("photographed the offer", panel !== null, `${OUT}/4-offer-dark.png`);

    /* ADOPTING FILLS THE BOX AND STOPS. */
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>(".dpc-refine__readResult .dpc-refine__madeUse")?.click();
    });
    const adopted = await page.evaluate(
      () => document.querySelector<HTMLInputElement>(".dpc-refine__field")?.value ?? "",
    );
    check("Use fills the box with the sentence", adopted === read.sentence, adopted);
  }
}

const after = await creditsNow();
const moneyAfter = await readOpenRouterBalance().catch(() => null);
check("NOTHING WAS CHARGED", before === after, `${before} → ${after} credits`);
console.log(`house money: ${JSON.stringify(moneyBefore)} → ${JSON.stringify(moneyAfter)}`);

console.log(`\n${failures.length === 0 ? "PASS" : `FAIL — ${failures.length}`}`);
await browser.close();
await conn.end();
process.exit(failures.length === 0 ? 0 : 1);
