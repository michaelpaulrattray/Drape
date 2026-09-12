/**
 * THE INTERACTION-LATENCY DRIVE — click → first visible change, on a real
 * sheet, on the customer's own hand (#555, the Machinist's client half).
 *
 * The founder's question, 2026-09-05: *"does the machinist measure things like
 * how long a click takes to register? e.g if i click keep on a cast tile it
 * can take around 2 seconds to show up in the prompt box."* The ledger's own
 * line said *"interaction latency … UNREAD"*. This reads it. The method and
 * the probes are in `lib/interactionLatency.mts`; this file is the walk.
 *
 * THE TWO MODES:
 *
 *   --controls   the instrument's own proof: a synthetic page with an instant
 *                action, a 2-second one, one that never changes anything and
 *                one that is not there — plus a clock ticking beside them that
 *                must NOT count as the change. Needs NO server, NO session, NO
 *                database, NO credits, so it runs in the gate on every PR.
 *   (default)    the walk over a real sheet: Keep and Unkeep on up to
 *                `--samples` tiles (free), the chip edit (free; ABSENT on the
 *                author road, where the sentence is read-only since #535), and
 *                — only under `--spend` — Roll again, Follow and Retry, each of
 *                which renders for real and costs the driven account credits.
 *
 * Usage:
 *   npx tsx scripts/drive-interaction-latency.mts --controls
 *   npx tsx scripts/drive-interaction-latency.mts --base http://localhost:3000 \
 *     --token <app_session_id for the sheet's OWNER> --session <sheet publicId> \
 *     [--samples 8] [--json output/latency.json] [--wait 300] [--spend]  *     [--brief "a fitness creator in their 30s"]     # typed first; an EMPTY sheet has an empty box
 *     [--only follow]                                # one action alone — re-read one paid number
 *
 * EXIT CODES:
 *     0  the walk completed and nothing got WORSE — every read probe is under
 *        its bar, or under the ceiling of a reading it declares as known
 *     1  refused, or the sheet could not be reached
 *     2  the walk completed and at least one probe regressed past its ceiling,
 *        or never changed — a FINDING for the ledger, not a failure of the drive
 *
 * Only the sheet's OWNER can be driven: the page's own guards send anyone
 * else to /casting, and the walk would then measure the lobby while the
 * report named the sheet. The walk refuses when the grid never appears.
 */
import { writeFileSync } from "node:fs";

import puppeteer from "puppeteer-core";

import { openDrivenPage } from "./lib/drivePage.mts";
import {
  CHIP_PICKER_OPENER,
  CONTROL_ACTIONS,
  CONTROL_PAGE,
  judgeControls,
  measureClick,
  renderTable,
  SHEET_ACTIONS,
  summarise,
  type ClickReading,
} from "./lib/interactionLatency.mts";
import { spendAuthorized } from "./lib/stopline.mts";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";
import { resolveBrowser } from "./lib/systemBrowser.mts";

const args = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["base", "token", "session", "samples", "json", "wait", "brief", "only"],
  boolean: ["controls", "spend"],
});

const CONTROLS_ONLY = args.flag("controls");
const BASE = args.value("base") ?? "http://localhost:3000";
const TOKEN = args.value("token") ?? "";
const SESSION = args.value("session") ?? "";
const SAMPLES = args.number("samples", 8);
const JSON_OUT = args.value("json");
/** Seconds to wait for a paid roll to settle before the next action. */
const SETTLE_SECONDS = args.number("wait", 300);
/** Typed into the box before Roll again — needed on a sheet with no roll yet. */
const BRIEF = args.value("brief");
/** One action alone (`roll again` | `keep` | `retry` | `chip edit` | `follow`), to re-read one number without paying for the rest. */
const ONLY = args.value("only");
if (ONLY !== null && !SHEET_ACTIONS.some((a) => a.name === ONLY)) {
  /* A typo here would skip EVERYTHING and print a table of "skipped" rows —
     a run that read nothing dressed as a run. Refused instead. */
  console.error(`REFUSING: --only ${JSON.stringify(ONLY)} names no action; the actions are ${SHEET_ACTIONS.map((a) => JSON.stringify(a.name)).join(", ")}`);
  process.exit(1);
}
const wanted = (name: string) => ONLY === null || ONLY === name;

/* ────────────────────────────── controls mode ────────────────────────────── */

if (CONTROLS_ONLY) {
  const executablePath = resolveBrowser();
  if (!executablePath) {
    console.error(
      "No Chromium found. Set DRAPE_BROWSER to a Chrome or Edge executable, or install one " +
        "at a standard location (see scripts/lib/systemBrowser.mts).",
    );
    process.exit(1);
  }
  const browser = await puppeteer.launch({ executablePath, headless: true });
  const readings: ClickReading[] = [];
  for (const action of CONTROL_ACTIONS) {
    /* A fresh PAGE per control — not `setContent` on one page, which writes
       into the same document and re-runs its script — so the clock's ticks
       and the previous control's text never carry into the next reading. */
    const page = await browser.newPage();
    await page.setContent(CONTROL_PAGE);
    readings.push(await measureClick(page, action));
    await page.close();
  }
  await browser.close();

  const verdicts = judgeControls(readings);
  let bad = 0;
  console.log("INTERACTION-LATENCY CONTROLS — can the reader still tell fast from slow from never?\n");
  for (const v of verdicts) {
    if (!v.ok) bad += 1;
    console.log(`${v.ok ? "  ok  " : "  MISS"} ${v.control}`);
    console.log(`        saw: ${v.saw}`);
  }
  console.log(`\n${verdicts.length} control(s), ${bad} miss(es)`);
  process.exit(bad === 0 ? 0 : 1);
}

/* ─────────────────────────────── the walk ────────────────────────────────── */

if (!TOKEN) throw new Error("--token <app_session_id JWT for the sheet's owner> is required");
if (!SESSION) throw new Error("--session <the sheet's publicId> is required — this drive never guesses a sheet");

/* The spend door — the one implementation of "may I spend?" (#345). Without
   the word, the three rendering actions are reported as not measured. */
const SPEND = spendAuthorized("render a roll, a follow and a retry on the driven account");

const { browser, page } = await openDrivenPage({ base: BASE, token: TOKEN });
const readings: ClickReading[] = [];
const notes: Record<string, string> = {};

try {
  const url = `${BASE}/casting/s/${SESSION}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  /*
    The sheet LOADED, or an honest refusal. Wait on the THING (the verify
    skill's first reading), and the thing is the brief echo — drawn only once
    the roll's data is in (`CastingSheet.tsx`: `roll.data ? <BriefEcho …`) —
    or the empty-sheet copy. ⚠ Not the skeleton grid and not the Roll again
    button: both are on screen while the sheet is still loading, and a Roll
    again clicked then meets `dispatchRoll`'s empty-box early return and does
    NOTHING, silently. Measured on this instrument's first spend run: the
    click "read" as 6.5 s because the probe caught the page's own loading
    skeletons leaving, and no roll was ever created.
  */
  await page
    .waitForFunction(
      () => document.querySelector(".dpc-echo") !== null || /Nothing cast on this sheet yet/.test(document.body.innerText),
      { timeout: 90_000 },
    )
    .catch(() => {
      throw new Error(`the sheet at ${url} never drew its brief echo or its empty state within 90 s — is this the owner's token?`);
    });

  const settle = async (what: string) => {
    /* A paid roll takes ~50 s; wait for every skeleton to leave the grid, then
       one more poll for the page's own settle. Bounded, and it says so. */
    const started = Date.now();
    try {
      await page.waitForFunction(
        () => document.querySelectorAll(".dp-skeleton").length === 0 && document.querySelectorAll(".dpc-card").length > 0,
        { timeout: SETTLE_SECONDS * 1000, polling: 500 },
      );
      console.log(`  ${what} settled in ${((Date.now() - started) / 1000).toFixed(0)} s`);
    } catch {
      console.log(`  ${what} did NOT settle within ${SETTLE_SECONDS} s — the readings that follow are on a sheet still casting`);
    }
  };

  const byName = (name: string) => {
    const action = SHEET_ACTIONS.find((a) => a.name === name);
    if (!action) throw new Error(`no action named ${name}`);
    return action;
  };

  /* ── 1 · Roll again (spends) — first, so Keep has fresh unkept tiles ─── */
  const rollAgain = byName("roll again");
  if (SPEND && wanted(rollAgain.name)) {
    if (BRIEF) {
      /* Typed the way a person types it, so the draft store sees keystrokes;
         `dispatchRoll` returns silently on an empty box, and an empty sheet's
         box IS empty — the placeholder only looks like a brief. */
      await page.click("textarea");
      await page.evaluate(() => { const t = document.querySelector("textarea") as HTMLTextAreaElement; t.select(); });
      await page.keyboard.type(BRIEF, { delay: 5 });
    }
    console.log("roll again …");
    readings.push(await measureClick(page, rollAgain));
    await settle("the roll");
  } else {
    notes[rollAgain.name] = wanted(rollAgain.name) ? "not measured — renders for real; pass --spend" : "skipped by --only";
  }

  /* ── 2 · Keep / Unkeep, one tile per sample, the tile tagged so Unkeep
        undoes the SAME tile and the next Keep takes a fresh one ───────── */
  const keep = byName("keep");
  const unkeep = byName("unkeep");
  const keepOnFreshTile = {
    ...keep,
    find: String.raw`
      const button = Array.from(document.querySelectorAll(".dpc-tile:not([data-latency]) button"))
        .find((b) => !b.disabled && /^keep$/i.test((b.innerText || "").trim()));
      if (!button) return null;
      button.closest(".dpc-tile").setAttribute("data-latency", "kept-by-drive");
      return button;
    `,
  };
  const unkeepThatTile = {
    ...unkeep,
    find: String.raw`
      const tile = document.querySelector('.dpc-tile[data-latency="kept-by-drive"]');
      if (!tile) return null;
      const button = Array.from(tile.querySelectorAll("button")).find((b) => !b.disabled && /^kept$/i.test((b.innerText || "").trim()));
      if (!button) return null;
      tile.setAttribute("data-latency", "sampled");
      return button;
    `,
  };
  /*
    The tile's buttons are `disabled={busy}` while its own mutation is in
    flight, and a round trip to a remote database is one to three seconds.
    So between the keep and its undo the walk waits on the THING — the tagged
    tile's button enabled again — never on a clock: a 1.5 s sleep read two of
    eight undos as "absent" on this instrument's first free walk.
  */
  const settledTile = async (tag: string, label: RegExp) => {
    await page
      .waitForFunction(
        (t: string, l: string) => {
          const tile = document.querySelector(`.dpc-tile[data-latency="${t}"]`);
          if (!tile) return false;
          const re = new RegExp(l, "i");
          return Array.from(tile.querySelectorAll("button")).some((b) => !b.disabled && re.test((b.innerText || "").trim()));
        },
        { timeout: 15_000, polling: 100 },
        tag,
        label.source,
      )
      .catch(() => {
        /* Left to the next find, which reads it as absent and says so. */
      });
  };
  /* An unkeep is read WITH its keep (free, and the tile must be kept first),
     so `--only unkeep` runs the pair — the review's finding 1: gated on keep
     alone it read nothing and exited 0, the exact run the refusal above says
     cannot happen. */
  const keepWanted = wanted(keep.name) || wanted(unkeep.name);
  if (!keepWanted) {
    notes[keep.name] = "skipped by --only";
    notes[unkeep.name] = "skipped by --only";
  }
  for (let i = 0; i < (keepWanted ? SAMPLES : 0); i += 1) {
    const kept = await measureClick(page, keepOnFreshTile);
    readings.push(kept);
    if (kept.kind === "absent") {
      if (i === 0) notes[keep.name] = "absent — no unkept tile on this sheet";
      break;
    }
    await settledTile("kept-by-drive", /^kept$/);
    readings.push(await measureClick(page, unkeepThatTile));
    await settledTile("sampled", /^keep$/);
  }
  console.log(`keep/unkeep: ${readings.filter((r) => r.action === "keep" && r.kind === "read").length} sample(s)`);

  /* ── 3 · Retry (spends) — only where a failed tile exists ─────────────── */
  const retry = byName("retry");
  if (SPEND && wanted(retry.name)) {
    const reading = await measureClick(page, retry);
    readings.push(reading);
    if (reading.kind === "absent") notes[retry.name] = "absent — no failed tile on this sheet to retry";
    else await settle("the retry");
  } else {
    notes[retry.name] = wanted(retry.name) ? "not measured — renders for real; pass --spend" : "skipped by --only";
  }

  /* ── 4 · The chip edit — two steps, the choosing click measured ───────── */
  const chipEdit = byName("chip edit");
  const opened = !wanted(chipEdit.name) ? null : await page.evaluate(`(() => { const b = (() => { ${CHIP_PICKER_OPENER} })(); if (!b) return false; b.click(); return true; })()`);
  if (opened === null) {
    notes[chipEdit.name] = "skipped by --only";
  } else if (!opened) {
    readings.push({ kind: "absent", action: chipEdit.name });
    notes[chipEdit.name] = "absent — the sentence is read-only on the author road (#535); the box is the only editor";
  } else {
    await page.waitForFunction(
      () => document.querySelector('.dpc-echo [role="option"], .dpc-echo [role="menuitem"], .dpc-echo [role="menuitemradio"]') !== null,
      { timeout: 5000 },
    ).catch(() => {});
    readings.push(await measureClick(page, chipEdit));
  }

  /* ── 5 · Follow (spends) — last, so the sheet is left on a settled roll ── */
  const follow = byName("follow");
  if (SPEND && wanted(follow.name)) {
    console.log("follow …");
    readings.push(await measureClick(page, follow));
    await settle("the follow");
  } else {
    notes[follow.name] = wanted(follow.name) ? "not measured — renders for real; pass --spend" : "skipped by --only";
  }
} finally {
  await browser.close();
}

const rows = summarise(SHEET_ACTIONS, readings, notes);
console.log(`\nINTERACTION LATENCY — ${BASE}, sheet ${SESSION}, ${new Date().toISOString()}\n`);
console.log(renderTable(rows));

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ base: BASE, session: SESSION, at: new Date().toISOString(), spend: SPEND, rows, readings }, null, 2));
  console.log(`\nwritten: ${JSON_OUT}`);
}

/* Exit 2 means WORSE: over the bar, or — for a probe with a declared known
   reading — over that reading's ceiling. A known 18 s chip prints OVER in the
   table and exits 0; a 50 s one exits 2. */
const over = rows.filter((r) => r.regressed === true || (r.n === 0 && r.timeouts > 0));
if (over.length > 0) {
  console.log(`\n${over.length} probe(s) regressed past their ceiling or never painted — a finding for the ledger:`);
  for (const r of over) console.log(`  ${r.probe}: p95 ${r.p95 === null ? "—" : `${r.p95.toFixed(0)} ms`}, ${r.timeouts} timeout(s)`);
  process.exit(2);
}
process.exit(0);
