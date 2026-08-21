/**
 * THE FRAMES GATE — fable-919 §3's founder gate, on the artifacts that exist
 * (substitution RULED fable-1243 §2a; walk shape RULED fable-1243 §2b).
 *
 *   npx tsx scripts/gate-frames-face-bearing-disposable.mts
 *
 * # What the gate asks, and whose question it is
 *
 * fable-919 §3: *a face-bearing tattoo reference must produce a PLATE with zero
 * person content — proven at the frames, founder's eye on the first specimens
 * per law 9.* This script buys the frames. It closes nothing: no executor may.
 *
 * # ⚠ THE ARTIFACT IS SUBSTITUTED, AND THAT IS A RULING (fable-1243 §2a)
 *
 * A PLATE is minted by `inkPlateMint`, and minting sits behind
 * `MANNEQUIN_ROAD_DEFERRED` — deferred into the sitting that also holds the
 * release door, D-138's taste gate and the fence court. **So the artifact the
 * gate names cannot be produced today.** What exists is the CUT (the object
 * `CASTING_INK_CUT_SCOPE` stores) and the DELIVERED FRAME. fable-1243 §2a
 * granted the substitution as a decision rather than an executor's convenience:
 * 919 §3's intent — *no stranger's face survives into anything we keep or send*
 * — is answerable at those two, and the plate belongs to the deferred sitting.
 *
 * # THE WALK IS THE PRODUCT'S OWN, END TO END
 *
 * Nothing here cuts anything. The driver attaches the specimen and asks, and
 * the SERVER mints the design, cuts it, offers it and paints it. A cut this
 * script made itself would be a claim about code; the object the product stored
 * is the fact. The read-back is a separate script, so the counts may be re-run
 * without re-buying the walk.
 *
 * # WHAT IT COSTS, and the bounds were on the record BEFORE anything was bought
 *
 *   house      the cut's own segmenter reads — `tattooed skin`, `human skin` on
 *              the padded copy, `upper chest`, the in-surface ink read, `face`
 *              — five, on the shared FAL_CONCURRENCY courtesy pool. Cents.
 *   credits    ONE render, 25 DEV credits, verify-bot (user 823). The campaign
 *              ledger reads production `userId = 1` and does not see this
 *              account.
 *
 * # WHY THE UPPER CHEST AND NOT THE NECK
 *
 * Two reasons, and both are about what his eyes can actually judge.
 *
 * The CUT: `upper chest` was believed to be the surface whose box CLIMBS on
 * this class of photograph, so that the face exclusion would have something to
 * exclude and its zero would mean something. ⚠ IT DID NOT — measured, `face ∩
 * upper chest` is 0 px on this specimen and on its sibling, and the box is
 * identical with the subtraction and without it (`V3B_FRAMES_GATE_WALK.md`
 * §5(b)). The reason stands for choosing the placement; the expectation behind
 * it was wrong, and it is left here as written rather than tidied.
 *
 * The RENDER: this cast's master wears a crew tee, and a chest ask UNDRESSES
 * him — `v476` on this same Cast came back shirtless with the whole torso bare.
 * So a leak of the stranger's own skin or face would be plainly visible, where
 * a covered placement would hide the very thing the gate is looking for.
 */
import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";

import { SignJWT } from "jose";
import type { ElementHandle } from "puppeteer-core";

import { openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/frames-gate";
const SESSION = "af5011d8-ca5f-4bd8-a785-7cc516c8361d";
const PICTURE = "docs/specs/references/build-two-founder-specimens/tattoo-patchwork-man-selective-take.png";
/* S1 — the patchwork man. Opened at working size for this walk: the frame is
   cropped just below his eyes, so his NOSE, MOUTH, CHIN and JAW are in it. That
   is what makes him the face-bearing specimen — and the corpus README's "chin
   cropped out" is wrong about this file, which is reported rather than quietly
   relied on. */
const ASK = "use this tattoo design on his upper chest";

const log: string[] = [];
const say = (line: string) => { console.log(line); log.push(line); };

await mkdir(OUT, { recursive: true });

const token = await new SignJWT({
  openId: "verify-bot-local",
  appId: process.env.VITE_APP_ID,
  name: "Verify Bot",
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("3h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

const { browser, page } = await openDrivenPage({ base: BASE, token, width: 1440, height: 960 });

const finish = async (code: number, why: string): Promise<never> => {
  say(why);
  await browser.close();
  await writeFile(`${OUT}/walk.log`, `${log.join("\n")}\n`);
  process.exit(code);
};

/* WHICH SERVER ANSWERED — read off the running service rather than assumed.
   From NODE and not from the page: the first evaluate happens on `about:blank`,
   where a fetch at localhost is cross-origin and fails for a reason that has
   nothing to do with the server. */
const health = await fetch(`${BASE}/api/health`).then(
  async (response) => `${response.status} ${(await response.text()).slice(0, 200)}`,
  (error: unknown) => `unreachable — ${String(error)}`,
);
say(`health: ${health}`);
if (!health.startsWith("200")) await finish(1, "STOPPED: no server on the port this walk is aimed at");

/**
 * The frame on screen, saved at full size.
 *
 * ⚠ THE SELECTOR IS THE VIEWER'S OWN SHAPE, inherited from the realism court
 * rather than guessed: the real frame is the `img` under `.dpc-viewer__plate`
 * carrying `data-preview`, and `false` is waited for because `true` is the
 * small copy shown while the real bytes are in flight. A guessed selector saved
 * NOTHING on either step of that court's first run.
 */
async function saveFrame(name: string): Promise<void> {
  const src = await page.waitForFunction(
    () => document.querySelector<HTMLImageElement>('.dpc-viewer__plate img[data-preview="false"]')
      ?.getAttribute("src") || null,
    { timeout: 120_000, polling: 1000 },
  ).then((handle) => handle.jsonValue() as Promise<string>, () => "");
  if (!src) { say(`   frame:   (none on screen for ${name})`); return; }
  /* FETCHED FROM NODE: the frame's address is the R2 bucket's public URL, a
     different origin from the dev server, and an in-page fetch fails CORS as a
     bare "Failed to fetch". Node has no origin to violate. */
  const from = src.startsWith("http") ? src : `${BASE}${src}`;
  const bytes = await fetch(from).then(
    async (response) => (response.ok ? Buffer.from(await response.arrayBuffer()) : null),
    () => null,
  );
  if (!bytes) { say(`   frame:   (could not fetch ${from})`); return; }
  await writeFile(`${OUT}/${name}.png`, bytes);
  say(`   frame:   ${OUT}/${name}.png (${bytes.length} bytes)  <- ${from}`);
}

await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "domcontentloaded" });
if (!(await page.waitForSelector('button[aria-label^="View candidate"]', { timeout: 120_000 }).catch(() => null))) {
  await finish(1, "STOPPED: no candidate tiles");
}
const opened = await page.evaluate(() => {
  const tiles = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label^="View candidate"]'));
  tiles[0]?.click();
  return { count: tiles.length, label: tiles[0]?.getAttribute("aria-label") ?? "" };
});
say(`tile 0 of ${opened.count}: ${opened.label || "(none)"}`);
if (!(await page.waitForSelector(".dpc-refine__field", { timeout: 120_000 }).catch(() => null))) {
  await finish(1, "STOPPED: no ask box");
}

await saveFrame("0-master-before");

/*
  BRANCH FROM A VERSION WITH NO INK IN ITS CHAIN — the containment wall refuses
  a second placement free, so a chain that already carries a tattoo would wall
  this ask and the gate would buy nothing.

  ⚠ THE CHIP'S OWN STATE IS ASSERTED, NOT THE VIEWER'S CAPTION.
  `.dpc-refine__pick` is not only buttons — a pending render is drawn as a
  `div…--ghost` carrying its instruction in `aria-label`, so `.click()` on it is
  silently nothing; and the caption describes what is ON SCREEN, which is a
  different fact from what the box will send. That conflation cost the realism
  court a paid render.
*/
await page.waitForSelector(".dpc-refine__pick", { timeout: 60_000 }).catch(() => null);
const chose = await page.evaluate(() => {
  const picks = Array.from(document.querySelectorAll<Element>(".dpc-refine__pick"));
  const labels = picks.map((one) => one.getAttribute("aria-label") ?? "");
  /* The rail is oldest-first, so the newest chain with no ink at all is the
     version immediately before the first inked one. */
  const firstInked = labels.findIndex((one) => /tattoo|design|ink/i.test(one));
  const at = Math.max(firstInked === -1 ? picks.length - 1 : firstInked - 1, 0);
  const one = picks[at];
  const label = (labels[at] ?? "").trim();
  if (!(one instanceof HTMLButtonElement)) return { count: picks.length, at, label, clickable: false };
  one.click();
  return { count: picks.length, at, label, clickable: true };
});
say(`versions on the rail: ${chose.count}; chose ${chose.at} — "${chose.label}"${chose.clickable ? "" : "  <- NOT A BUTTON"}`);
if (!chose.clickable) await finish(1, "STOPPED: a ghost chip is not a selection");
if (/tattoo|design|ink/i.test(chose.label)) {
  await finish(1, "STOPPED: every version on the rail already carries ink — this ask would be walled free");
}
const pressed = await page.waitForFunction(
  (want: string) => Array.from(document.querySelectorAll(".dpc-refine__pick"))
    .some((one) => one.getAttribute("aria-label") === want && one.getAttribute("aria-pressed") === "true"),
  { timeout: 30_000, polling: 250 },
  chose.label,
).then(() => true, () => false);
say(`chip says it is selected: ${pressed}`);
if (!pressed) await finish(1, "STOPPED: the chip never reported itself selected");

/* HER PICTURE — the attach door, free, and nothing is read from it here. */
const input = (await page.$(".dpc-refine__readInput")) as ElementHandle<HTMLInputElement> | null;
if (!input) await finish(1, "STOPPED: no attach door — is CASTING_REFERENCE_ATTACH_SCOPE armed for 823?");
await input!.uploadFile(PICTURE);
if (!(await page.waitForSelector(".dpc-refine__thumb img", { timeout: 60_000 }).catch(() => null))) {
  await finish(1, "STOPPED: the specimen never became a chip");
}
say("attached: S1, the patchwork man");
/* "I have permission" — picked by its WORDS, so a reordered enum cannot file a
   different claim. */
await page.evaluate(() => {
  Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__claim button"))
    .find((one) => (one.textContent ?? "").toLowerCase().includes("permission"))
    ?.click();
});
await page.waitForFunction(() => document.querySelector(".dpc-refine__claim") === null, { timeout: 60_000 })
  .catch(() => null);

/*
  ⚠ THE OUTCOME BANNER IS STICKY and holds the LAST outcome for this Cast,
  including one left by a render from a previous sitting. A wait that is already
  satisfied before the thing it waits for has started is not a wait; it is a
  coin flip that always lands the same way. So it is DISMISSED first and the
  waits below are for it to APPEAR.
*/
await page.evaluate(() => {
  document.querySelector<HTMLButtonElement>(".dpc-refine__outcome .dpc-refine__dismiss")?.click();
});
await page.waitForFunction(() => document.querySelector(".dpc-refine__outcome") === null,
  { timeout: 30_000, polling: 500 }).catch(() => null);
const stale = await page.evaluate(() => document.querySelector(".dpc-refine__outcome") !== null);
say(`banner:  ${stale ? "STILL THERE — a wait below may read somebody else's answer" : "cleared before the ask"}`);

say("");
say(`== ask — "${ASK}"`);
await page.type(".dpc-refine__field", ASK);
await page.evaluate(() => {
  Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__ask button"))
    .find((button) => button.type === "submit")?.click();
});

/*
  ⚠ A FULL RENDER'S PATIENCE, NOT AN OFFER'S. The theory that a short timeout
  can only ever cost a free stage does not hold — the same ask has gone STRAIGHT
  to the render with no cut shown, and a driver whose timeout is shorter than
  the operation it watches does not fail, it MISREPORTS and leaves a paid frame
  nobody saved.
*/
const offered = await page.waitForFunction(
  () => document.querySelector(".dpc-refine__shownCut img") !== null
    || (document.querySelector(".dpc-refine__outcome")?.textContent ?? "").length > 0,
  { timeout: 900_000, polling: 3000 },
).then(() => true, () => false);
const first = await page.evaluate(() => ({
  outcome: document.querySelector(".dpc-refine__outcome")?.textContent?.replace("×", "").trim() ?? "",
  cut: document.querySelector<HTMLImageElement>(".dpc-refine__shownCut img")?.getAttribute("src") ?? "",
}));
say(`   said:    ${first.outcome || "(nothing)"}`);
say(`   offered a cut: ${first.cut ? "yes" : "no"}`);
if (!offered) await finish(1, "STOPPED: the ask never settled");
if (!first.cut) {
  await finish(1, "STOPPED: no cut was offered — nothing was charged, and there is no cut to gate");
}

/* THE CUT AS THE PRODUCT SHOWS IT — saved before the render, because the offer
   is the last moment it is on screen. The stored OBJECT is read back separately
   and byte-exactly; this is the picture she is shown. */
const shownFrom = first.cut.startsWith("http") ? first.cut : `${BASE}${first.cut}`;
const shownBytes = await fetch(shownFrom).then(
  async (response) => (response.ok ? Buffer.from(await response.arrayBuffer()) : null),
  () => null,
);
if (shownBytes) {
  await writeFile(`${OUT}/1-cut-as-offered.png`, shownBytes);
  say(`   cut:     ${OUT}/1-cut-as-offered.png (${shownBytes.length} bytes)  <- ${shownFrom}`);
} else {
  say(`   cut:     (could not fetch ${shownFrom})`);
}

/* The only line here that spends. */
await page.evaluate(() => {
  Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-refine__answer"))
    .find((one) => (one.textContent ?? "").toLowerCase().startsWith("yes"))
    ?.click();
});
say("   adopted the cut — 25 dev credits from here");

const landed = await page.waitForFunction(
  () => {
    const busy = document.querySelector(".dpc-refine__busy, [data-refining='true']");
    const note = document.querySelector(".dpc-refine__outcome")?.textContent ?? "";
    return !busy && note.length > 0;
  },
  { timeout: 900_000, polling: 3000 },
).then(() => true, () => false);
say(`   render:  ${landed ? "settled" : "did not settle inside 15 minutes"}`);
say(`   after:   ${await page.evaluate(() =>
  document.querySelector(".dpc-refine__outcome")?.textContent?.replace("×", "").trim() ?? "(nothing)")}`);
await saveFrame("3-render-carrying-the-cut");

await finish(landed ? 0 : 1, landed
  ? `\nlog: ${OUT}/walk.log — now run the read-back for the stored object and the counts`
  : "STOPPED: the render did not settle");

/* END BY ENDING THE PROCESS — puppeteer leaves handles alive, and the exit
   discipline wants the LAST top-level statement to be this one rather than an
   exit inside a helper it cannot see. Unreachable, and that is the point. */
process.exit(0);
