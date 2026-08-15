/**
 * THE SIGNED FLOW, FROM OUTSIDE — the end of the funnel nobody has seen except
 * from the founder's account. (Approved in fable-568 §2 at 450 dev credits and
 * ~5 house generations; findings filed, never fixed.)
 *
 * Signing is the product's most loaded ceremony: it is the moment a candidate
 * becomes a Cast, it costs more than everything else put together, and it is
 * the one surface an outside walk has never touched.
 *
 * ```
 * PRICE      said before the money moves, and it is the real number
 * CEREMONY   the confirmation names what is bought and what becomes permanent
 * THE WAIT   a package is five renders; the screen says so rather than hanging
 * AFTER      she is on the roster, reachable, and the sheet says what happened
 * THE LEDGER read before and after — the claim about money measured in money
 * ```
 *
 * Every line is teed to disk as it runs (`teeTo`): this run SPENDS, and a
 * spending run whose output has to be re-read is a run somebody pays for twice.
 *
 *   pnpm dev            (or a server on VERIFY_BASE_URL)
 *   npx tsx scripts/drive-outsider-sign-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import { teeTo } from "./lib/benchKit.mts";
import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage } from "./lib/drivePage.mts";
import { ensureOutsider } from "./lib/outsider.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = "output/outsider-sign";
mkdirSync(OUT, { recursive: true });
const say = teeTo(`${OUT}/run.txt`);

const records: { ok: boolean; name: string; saw: string }[] = [];
const check = (ok: boolean, name: string, saw: string) => {
  records.push({ ok, name, saw });
  say(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
};

const outsider = await ensureOutsider();
const conn = await openDatabase(process.env.DATABASE_URL);
const balance = async () => {
  const [rows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [outsider.id]);
  return (rows as Array<{ balance: number }>)[0]!.balance;
};
const [sheets] = await conn.execute(
  `SELECT s.publicId FROM casting_sessions s WHERE s.userId = ? ORDER BY s.id DESC LIMIT 1`,
  [outsider.id],
);
const session = (sheets as Array<{ publicId: string }>)[0]!.publicId;

say(`outsider ${outsider.id} · sheet ${session} · ${await balance()} credits`);

const { browser, page } = await openDrivenPage({ base: BASE, token: outsider.token, width: 1440, height: 1000 });
try {
  await page.goto(`${BASE}/casting/s/${session}`, { waitUntil: "networkidle2", timeout: 180_000 });
  await page.waitForSelector('button[aria-label^="View candidate"]', { timeout: 180_000 });

  /* KEEP FIRST, because signing is offered on a kept face. The button says what
     it does; this walks the product's own path rather than a shortcut. */
  const kept = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((one) => (one.textContent ?? "").trim() === "Keep");
    if (!button) return false;
    (button as HTMLButtonElement).click();
    return true;
  });
  say(`kept a face: ${kept}`);
  await new Promise((resolve) => setTimeout(resolve, 1_500));

  /*
    SIGNING LIVES ON THE SHEET'S DOCK, and it appears only once something is
    kept — which is why the first pass found "no sign button" (it looked before
    the keep had landed).

    And the viewer must be CLOSED for it. The second pass opened the viewer,
    clicked the dock button THROUGH it with a synthetic click, and measured the
    ceremony sitting behind the viewer at z60 against z70 — a stacking defect
    that is not one: a real user cannot press a button behind a scrim, so the
    state I measured is one nobody can reach. A finding from an unreachable
    state is not a finding.
  */
  await new Promise((resolve) => setTimeout(resolve, 1_500));

  const signOffered = await page.evaluate(() => Array.from(document.querySelectorAll("button"))
    .map((one) => (one.textContent ?? "").trim())
    .filter((text) => /sign/i.test(text)));
  check(signOffered.length > 0, "signing is offered on a kept face", signOffered.join(" · ") || "no sign button");
  writeFileSync(`${OUT}/before.png`, await page.screenshot({ fullPage: false }));

  if (signOffered.length > 0) {
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button"))
        .find((one) => /sign/i.test((one.textContent ?? "").trim()));
      (button as HTMLButtonElement | undefined)?.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const ceremony = await page.evaluate(() => ({
      text: (document.body.innerText ?? "").trim(),
      buttons: Array.from(document.querySelectorAll("button")).map((one) => (one.textContent ?? "").trim()),
    }));
    const priced = /\b450\b/.test(ceremony.text);
    check(priced, "the price is on the confirmation, before the money",
      /(\d[\d,]*)\s*credits?/i.exec(ceremony.text)?.[0] ?? "no price in the words");
    say(`  the ceremony says: ${ceremony.text.split("\\n").filter((line) =>
      /sign|credit|permanent|cast/i.test(line)).slice(0, 6).join(" | ")}`);
    writeFileSync(`${OUT}/ceremony.png`, await page.screenshot({ fullPage: false }));
    writeFileSync(`${OUT}/ceremony.json`, `${JSON.stringify(ceremony, null, 2)}\n`);
  }

  /* ---- and then it is bought, because the walk was approved ---------- */
  const before = await balance();
  /*
    THE CEREMONY WANTS A NAME, and the confirm is "Sign to your roster" — not
    the dock's "Sign to roster", which is what opened it. Matching loosely
    pressed the opener again and the money never moved: an instrument that
    re-opens the door it is standing in.
  */
  const named = await page.evaluate(`(() => {
    const field = document.querySelector(".dpc-signm input, .dpc-signm__card input");
    if (!field) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(field, "Outside Bot");
    field.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
  say(`  named her: ${named}`);
  await new Promise((resolve) => setTimeout(resolve, 800));
  const confirmed = await page.evaluate(`(() => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((one) => /sign to your roster/i.test((one.textContent || "").trim()));
    if (!button) return null;
    if (button.disabled) return "(the confirm is disabled)";
    const label = (button.textContent || "").trim();
    button.click();
    return label;
  })()`) as string | null;
  say(`  pressed: ${confirmed ?? "(nothing that looked like a confirm)"}`);

  /*
    THE WAIT IS THE PRODUCT HERE. A package is five renders; what the screen
    says during those minutes is the thing nobody outside the founder's account
    has ever seen. Sampled rather than looked at once.
  */
  const waited: string[] = [];
  let signedAt: number | null = null;
  const started = Date.now();
  for (let n = 0; n < 60 && signedAt === null; n += 1) {
    const seen = await page.evaluate(() => {
      const text = (document.body.innerText ?? "").trim();
      return {
        says: text.split(String.fromCharCode(10)).filter((line) => /sign|building|package|view|ready|cast/i.test(line)).slice(0, 4),
        done: /signed|ready|cast member/i.test(text) && !/building|signing/i.test(text),
      };
    });
    const line = seen.says.join(" | ");
    if (line && waited.at(-1) !== line) waited.push(line);
    if (seen.done && Date.now() - started > 10_000) signedAt = Date.now() - started;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  const after = await balance();
  check(before - after > 0, "the money moved once, and the ledger says how much",
    `${before} → ${after} (${before - after} credits)`);
  check(waited.length > 0, "the wait says something rather than hanging",
    waited.slice(0, 3).join("  //  ") || "the screen said nothing about it");
  say(`  the wait, in its own words: ${waited.join("  //  ")}`);
  say(`  finished after ${signedAt === null ? "not within 5 minutes" : `${Math.round(signedAt / 1000)}s`}`);
  writeFileSync(`${OUT}/after.png`, await page.screenshot({ fullPage: false }));

  /* ---- and the roster, which is where a signed Cast is supposed to live -- */
  await page.goto(`${BASE}/casting`, { waitUntil: "networkidle2", timeout: 120_000 });
  /*
    WAIT FOR THE ROSTER'S OWN ANSWER, not for the word "cast member" — which the
    EMPTY state also says. The first pass read "0 cast members · No one signed
    yet" seconds after a sign that had plainly worked, and the wire proved her
    there (castId KI-…, status ready) while the page was still fetching. A count
    of zero is what this page says before it knows.
  */
  const rosterFilled = await page.waitForFunction(
    () => /([1-9]\d*)\s+cast members?/.test(document.body.innerText ?? ""),
    { timeout: 60_000 },
  ).then(() => true).catch(() => false);
  say(`  the roster filled: ${rosterFilled}`);
  const roster = await page.evaluate(() => {
    const text = (document.body.innerText ?? "").trim();
    return {
      count: /(\d+)\s+cast members?/.exec(text)?.[1] ?? null,
      emptyLine: text.split(String.fromCharCode(10)).find((line) => line.includes("No one signed yet")) ?? null,
    };
  });
  check(roster.count !== "0" && roster.count !== null, "she is on the roster afterwards",
    `${roster.count ?? "no count"} cast members${roster.emptyLine ? ` · "${roster.emptyLine}"` : ""}`);
  writeFileSync(`${OUT}/roster.png`, await page.screenshot({ fullPage: false }));
} finally {
  await browser.close();
}

const failed = records.filter((row) => !row.ok);
say("");
say(`${records.length - failed.length}/${records.length} · shots in ${OUT}/`);
writeFileSync(`${OUT}/checks.json`, `${JSON.stringify(records, null, 2)}\n`);
await conn.end();
process.exit(failed.length === 0 ? 0 : 1);
