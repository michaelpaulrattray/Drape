/**
 * THE TWO PATHS' TOGGLE, PHOTOGRAPHED IN THE RUNNING APP — §6's evidence pack
 * (design `docs/specs/CASTING_V2_TWO_PATHS_DESIGN.md` §6/§6.1; the UI milestone
 * contract, founder 2026-08-01).
 *
 * Render before shipping (law 6): no visual change ships without being looked
 * at in the running app. What this produces is the LOOKING — both themes, every
 * state the control has, at the size a person sees it — plus the mechanizable
 * laws as assertions rather than as review memory.
 *
 * The surfaces, in the order a person meets them:
 *
 *   1  the lobby, in the flag        PATH · Wardrobe | Basics, default Wardrobe,
 *                                    the selected path's own line beneath
 *   2  the lobby, Basics tapped      the selection moves and the line changes
 *   3  the lobby, OUTSIDE the flag   NOTHING — absent, never disabled (§6)
 *   4  a Wardrobe sheet, read back   WARDROBE · the outfit — the RECORD, and
 *                                    no switch, because Roll again applies to
 *                                    the live sheet
 *   5  the switch AT REST + moved    on a PATHED live sheet: the pills as a
 *                                    LABEL, silent, with the record line saying
 *                                    the same thing — then moved off it, where
 *                                    the label becomes a plan
 *   6  a Basics sheet                BASICS · the basics line
 *   7  an UNPATHED sheet             no RECORD, and the plan still offered —
 *                                    pinned to a session that is unpathed BY
 *                                    CONSTRUCTION, not to whatever is newest
 *
 * ⚠ **THE NEGATIVE CONTROLS ARE THE POINT OF THIS DRIVER, not a courtesy.**
 * Everything here ships dark, and "ships dark" is a claim about what does NOT
 * render. Surface 3 is a real account the server refuses the capability to, and
 * surface 7 is a real roll cast before the paths existed — both read through
 * the product's own gates rather than by turning a flag off in a fixture.
 *
 * ⚠ **IT SPENDS NOTHING.** No roll, no refine, no sign, no segmenter read: the
 * face scan is held at the wire and every surface is a page load of rows that
 * already exist. The house-money line the harness prints declares it.
 *
 *   npx tsx scripts/drive-two-paths-evidence.mts
 *
 * Environment, all overridable and all defaulted to the dev court fixture:
 *   VERIFY_BASE_URL      the server to drive (default :3010 — the founder's own
 *                        dev server on :3000 does not carry the flag)
 *   PATHS_OPEN_ID        an account INSIDE `CASTING_TWO_PATHS_SCOPE`
 *   PATHS_SHUT_OPEN_ID   an account outside it
 *   PATHS_SESSION        a session holding both a Wardrobe and a Basics roll
 *   PATHS_UNPATHED       a session whose rolls predate the paths
 */
import "dotenv/config";

import { mkdir } from "node:fs/promises";

import { SignJWT } from "jose";

import type { Page } from "puppeteer-core";

import { openDrivenPage, createChecks } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3010";
const OUT = "output/two-paths-toggle";

/* The dev court fixture — read off the database rather than guessed. Session
   `6d7d455f` holds rolls 2/4 on the Wardrobe path and 3/5/6/7 on Basics. */
const OPEN_ID = process.env.PATHS_OPEN_ID ?? "outside-scope-bot-local";
const SHUT_OPEN_ID = process.env.PATHS_SHUT_OPEN_ID ?? "verify-bot-local";
const SESSION = process.env.PATHS_SESSION ?? "6d7d455f-5e11-4542-bf71-c5730d207200";
const UNPATHED = process.env.PATHS_UNPATHED ?? "2128dadf-0684-4d9c-aa2e-f38a0c8efdf5";

const { check, records, failures, print } = createChecks();

await mkdir(OUT, { recursive: true });

async function tokenFor(openId: string): Promise<string> {
  return new SignJWT({ openId, appId: process.env.VITE_APP_ID, name: "two paths eye" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
}

/**
 * THE DOOR, ASKED BEFORE THE SURFACE IS JUDGED — the attach driver's own lesson
 * (2026-08-23), which cost a shift a FAIL on a surface that was working.
 *
 * `twoPathsEnabled` is the exact field the pages read to decide whether to draw
 * the control, so this is the product's own answer rather than a second opinion
 * about the flag. It REFUSES rather than skipping: a driver whose subject is
 * absent must fail, and must fail saying WHICH absence it is.
 */
async function doorFor(token: string): Promise<boolean> {
  const url = `${BASE}/api/trpc/castingV2.config?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`;
  const response = await fetch(url, { headers: { cookie: `app_session_id=${token}` } });
  const body = await response.json() as { result?: { data?: { json?: { twoPathsEnabled?: boolean } } } };
  return body.result?.data?.json?.twoPathsEnabled === true;
}

const openToken = await tokenFor(OPEN_ID);
const shutToken = await tokenFor(SHUT_OPEN_ID);

{
  const open = await doorFor(openToken);
  const shut = await doorFor(shutToken);
  if (!open || shut) {
    console.error(
      `REFUSING TO DRIVE: this run needs one account inside the flag and one outside it.\n`
      + `  ${OPEN_ID}: twoPathsEnabled=${open} (needs true)\n`
      + `  ${SHUT_OPEN_ID}: twoPathsEnabled=${shut} (needs false)\n`
      + `Start the server with CASTING_TWO_PATHS_SCOPE naming the first account's user id.`,
    );
    process.exit(2);
  }
  console.log(`door: ${OPEN_ID} IN · ${SHUT_OPEN_ID} OUT`);
}

/** Wait on the thing, never on the clock (the verify skill's first reading). */
async function settled(page: Page, marker: string): Promise<void> {
  await page.waitForFunction(
    (text: string) => document.body.innerText.includes(text),
    { timeout: 45_000 },
    marker,
  );
}

type Toggle = {
  present: boolean;
  tag: string | null;
  pills: { label: string; pressed: boolean }[];
  note: string | null;
  /* The mono law: a machine tag may be mono, a sentence may never be. */
  tagIsMono: boolean;
  noteIsMono: boolean;
};

async function readToggle(page: Page, scope: string): Promise<Toggle> {
  return page.evaluate((selector: string) => {
    const root = document.querySelector(`${selector} .dpc-paths`);
    if (!root) {
      return { present: false, tag: null, pills: [], note: null, tagIsMono: false, noteIsMono: false };
    }
    const tagEl = root.querySelector(".dp-chrome");
    const noteEl = root.querySelector(".dpc-paths__note");
    /* ⚠ NO INNER NAMED ARROW INSIDE `evaluate` — tsx compiles one into an
       `__name(...)` call the page has never heard of, and the whole evaluate
       dies with a ReferenceError that reads like a page error. */
    const pills: { label: string; pressed: boolean }[] = [];
    for (const pill of Array.from(root.querySelectorAll<HTMLButtonElement>(".dp-scopepill"))) {
      pills.push({
        label: (pill.textContent ?? "").trim(),
        pressed: pill.getAttribute("aria-pressed") === "true",
      });
    }
    return {
      present: true,
      tag: tagEl?.textContent ?? null,
      pills,
      note: noteEl?.textContent ?? null,
      tagIsMono: tagEl !== null && /mono/i.test(getComputedStyle(tagEl).fontFamily),
      noteIsMono: noteEl !== null && /mono/i.test(getComputedStyle(noteEl).fontFamily),
    };
  }, scope);
}

async function readRecordLine(page: Page): Promise<{ present: boolean; tag: string | null; line: string | null }> {
  return page.evaluate(() => {
    const el = document.querySelector(".dpc-wardrobeline");
    if (!el) return { present: false, tag: null, line: null };
    return {
      present: true,
      tag: el.querySelector(".dp-chrome")?.textContent ?? null,
      line: el.querySelector(".dpc-wardrobeline__line")?.textContent ?? null,
    };
  });
}

async function tapPill(page: Page, scope: string, label: string): Promise<boolean> {
  return page.evaluate((selector: string, want: string) => {
    for (const pill of Array.from(
      document.querySelectorAll<HTMLButtonElement>(`${selector} .dpc-paths .dp-scopepill`),
    )) {
      if ((pill.textContent ?? "").trim() !== want) continue;
      pill.click();
      return true;
    }
    return false;
  }, scope, label);
}

/**
 * WAIT ON THE BYTES BEFORE PHOTOGRAPHING (the verify skill's second reading).
 *
 * The candidate tiles are `<img>` elements fetched from the public bucket, and
 * a shot taken before they decode is a photograph of empty boxes — which in a
 * founder's evidence pack is indistinguishable from a sheet that rendered
 * nothing. It resolves rather than throwing: a tile that will not load is a
 * fact about that tile, not a reason to lose the frame.
 */
async function shoot(page: Page, name: string): Promise<string> {
  await page.evaluate(`(async () => {
    const images = Array.from(document.images).filter((image) => image.src);
    await Promise.all(images.map((image) => (image.complete && image.naturalWidth > 0)
      ? null
      : new Promise((resolve) => {
          image.addEventListener("load", () => resolve(null), { once: true });
          image.addEventListener("error", () => resolve(null), { once: true });
          setTimeout(() => resolve(null), 15000);
        })));
  })()`);
  /*
    ⚠ AND WAIT FOR THE PAINT TO STOP MOVING, which cost this driver a frame.

    `.dp-scopepill` transitions its background over `--t-fast` (120ms), and a
    screenshot taken in the frame after a tap catches BOTH pills mid-fade — the
    chosen one part-way to black, the other part-way back to transparent. The
    computed style read 200ms later says solid, so the reading and the picture
    disagreed and the PICTURE was the one going to the founder. Measured at the
    pixels rather than argued: a mid-grey "selected" pill in a founder's
    evidence pack reads as a styling defect that is not there.

    Two consecutive stable samples rather than a fixed sleep, so it settles as
    fast as the machine does and still waits when it must.
  */
  await page.evaluate(`(async () => {
    const read = () => Array.from(document.querySelectorAll(".dp-scopepill"))
      .map((pill) => getComputedStyle(pill).backgroundColor).join("|");
    let last = read();
    for (let i = 0; i < 40; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 60));
      const now = read();
      if (now === last) return;
      last = now;
    }
  })()`);
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path: path as `${string}.png`, fullPage: false });
  return path;
}

/* Held at the wire: the panel's scan is house money and this driver buys
   nothing. The harness prints what it saw either way. */
const { browser, page } = await openDrivenPage({
  base: BASE,
  token: openToken,
  width: 1440,
  height: 980,
  holdFaceScan: true,
});

for (const theme of ["dark", "light"] as const) {
  console.log(`\n════════ theme: ${theme} ════════`);
  await page.evaluateOnNewDocument((one: string) => {
    localStorage.setItem("drape_theme", one);
  }, theme);

  /* ───────────────────────── 1 + 2 · the lobby, in the flag ─────────────── */
  await page.goto(`${BASE}/casting`, { waitUntil: "domcontentloaded" });
  await settled(page, "Meet eight of them");

  const resting = await readToggle(page, ".dpc-hero__copy");
  check(resting.present, `[${theme}] the lobby draws the toggle for an account in the flag`,
    resting.present ? `PATH tag "${resting.tag}", pills ${resting.pills.map((p) => p.label).join("|")}` : "no .dpc-paths in the hero");
  check(
    resting.pills.length === 2 && resting.pills[0]?.label === "Wardrobe" && resting.pills[1]?.label === "Basics",
    `[${theme}] two pills, the default first`,
    resting.pills.map((p) => `${p.label}${p.pressed ? "*" : ""}`).join(" "),
  );
  check(
    resting.pills.filter((p) => p.pressed).length === 1 && resting.pills[0]?.pressed === true,
    `[${theme}] exactly ONE is chosen, and it is Wardrobe (his ruling, fable-1389)`,
    resting.pills.map((p) => `${p.label}=${p.pressed}`).join(" "),
  );
  check(
    (resting.note ?? "").includes("shows skin"),
    `[${theme}] the tradeoff is told BEFORE the roll — Wardrobe's own line`,
    JSON.stringify(resting.note),
  );
  check(
    !(resting.note ?? "").toLowerCase().includes("anywhere"),
    `[${theme}] ⚠ §5.1 — neither line promises "anywhere" on a waist-up frame`,
    JSON.stringify(resting.note),
  );
  /* CLAUDE.md's own design law: no mono on sentences. The PATH tag is a
     machine label and may be; the line under it is prose and may not. */
  check(resting.tagIsMono, `[${theme}] the PATH tag is set in the chrome face`, `mono=${resting.tagIsMono}`);
  check(!resting.noteIsMono, `[${theme}] the line under it is NOT mono — it is a sentence`, `mono=${resting.noteIsMono}`);
  console.log(`  shot ${await shoot(page, `1-lobby-wardrobe-${theme}`)}`);

  const tapped = await tapPill(page, ".dpc-hero__copy", "Basics");
  check(tapped, `[${theme}] the Basics pill is reachable`, tapped ? "clicked" : "no pill with that label");
  await page.waitForFunction(
    () => (document.querySelector(".dpc-paths__note")?.textContent ?? "").includes("chest piece"),
    { timeout: 5_000 },
  ).catch(() => undefined);
  const chosen = await readToggle(page, ".dpc-hero__copy");
  check(
    chosen.pills[1]?.pressed === true && chosen.pills[0]?.pressed === false,
    `[${theme}] tapping Basics moves the choice, and moves it OFF Wardrobe`,
    chosen.pills.map((p) => `${p.label}=${p.pressed}`).join(" "),
  );
  check(
    (chosen.note ?? "").includes("chest piece"),
    `[${theme}] and the line follows — Basics states the CHEST, per §5.1`,
    JSON.stringify(chosen.note),
  );
  console.log(`  shot ${await shoot(page, `2-lobby-basics-${theme}`)}`);

  /* ───────────────────────── 4 + 5 · a Wardrobe sheet ───────────────────── */
  await page.goto(`${BASE}/casting/s/${SESSION}`, { waitUntil: "domcontentloaded" });
  await settled(page, "Roll again");
  /*
    ⚠ WAIT ON THE RAIL, NOT ON THE DOCK — the verify skill's first reading, and
    this driver paid for it: "Roll again" is the dock, which renders before the
    session query has told the rail how many rolls there are. Waiting on the
    dock and then reaching for pill 04 read a rail that had not been built yet
    and reported "no 04 pill" on a sheet that has one.
  */
  await page.waitForFunction(
    () => document.querySelectorAll(".dpc-rollrail__item").length >= 4,
    { timeout: 30_000 },
  );
  /* Roll 4 is the Wardrobe roll; the sheet opens on the newest, so walk back. */
  const walked = await page.evaluate(() => {
    for (const pill of Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-rollrail__item"))) {
      if (!(pill.textContent ?? "").trim().startsWith("04")) continue;
      pill.click();
      return true;
    }
    return false;
  });
  check(walked, `[${theme}] the Wardrobe roll is reachable on the rail`, walked ? "clicked 04" : "no 04 pill");
  await page.waitForFunction(
    () => (document.querySelector(".dpc-wardrobeline .dp-chrome")?.textContent ?? "") === "WARDROBE",
    { timeout: 20_000 },
  ).catch(() => undefined);

  const record = await readRecordLine(page);
  check(record.present && record.tag === "WARDROBE",
    `[${theme}] the sheet says WHICH PATH it was cast on (§6: shown on the cast, not only on the control)`,
    `${record.tag} · ${record.line}`);
  check((record.line ?? "").length > 0 && !(record.line ?? "").includes("undefined"),
    `[${theme}] and WHAT it is wearing, in the sentence register`, JSON.stringify(record.line));

  /*
    ⚠ THE SWITCH IS HIDDEN HERE, AND THAT IS THE READING RATHER THAN A GAP.

    Roll 04 is being READ, not lived on — and the switch says what *Roll again*
    will do, which always applies to the LIVE sheet (the FOLLOWING chip's own
    rule, kept by fable-1483 ASK 1(b) condition 2). So this frame photographs
    the RECORD without the plan, which is exactly the pair §6 separates.
  */
  const dockInHistory = await readToggle(page, ".dp-dock-fade");
  check(!dockInHistory.present,
    `[${theme}] ⚠ reading history shows the record and NOT the plan`,
    dockInHistory.present ? "the dock drew a switch while reading history" : "no .dpc-paths in the dock");
  console.log(`  shot ${await shoot(page, `4-sheet-wardrobe-${theme}`)}`);

  /*
    ───────────── 5 · THE SWITCH AT REST, on a PATHED live sheet ────────────

    Back to the latest roll, which on this fixture now carries a path (arm 3's
    covering-outfit roll, bought 2026-08-24). **This is the one state §6 could
    not photograph until a live pathed roll existed**, and it is the quiet one:
    the pills are a LABEL of what this sheet is, so the note is SILENT and the
    record line above the grid says the same thing in words.

    ⚠ The other half — the pills as a PLAN on a sheet with no path — moved to
    surface 7, where the session is unpathed by construction rather than by
    whatever happens to be newest. **That is the repair this fixture taught: a
    surface pinned to "the latest roll" is pinned to whatever the last court
    bought**, and this driver asserted "Nothing was chosen" against a sheet that
    had just been given a path.
  */
  await page.evaluate(() => {
    for (const back of Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-rollrail__back"))) {
      back.click();
      return;
    }
  });
  await page.waitForFunction(
    () => document.querySelector(".dp-dock-fade .dpc-paths") !== null,
    { timeout: 20_000 },
  ).catch(() => undefined);

  const dock = await readToggle(page, ".dp-dock-fade");
  check(dock.present, `[${theme}] the LIVE sheet's re-roll box carries the switch`,
    dock.present ? dock.pills.map((p) => `${p.label}=${p.pressed}`).join(" ") : "no .dpc-paths in the dock");
  check(dock.pills[0]?.pressed === true,
    `[${theme}] preselected to THIS SHEET's own path, not to the global default`,
    dock.pills.map((p) => `${p.label}=${p.pressed}`).join(" "));
  check(dock.note === null,
    `[${theme}] ⚠ and it says NOTHING while it rests there — a label, not a plan`,
    JSON.stringify(dock.note));
  const liveRecord = await readRecordLine(page);
  check(liveRecord.present && liveRecord.tag === "WARDROBE",
    `[${theme}] ⚠ while the RECORD says the same thing in words, above the faces`,
    liveRecord.present ? `${liveRecord.tag} · ${liveRecord.line}` : "no .dpc-wardrobeline on the page");
  console.log(`  shot ${await shoot(page, `5-sheet-resting-${theme}`)}`);

  /* And then moved off it — the moment the label becomes a plan. */
  await tapPill(page, ".dp-dock-fade", "Basics");
  await page.waitForFunction(
    () => (document.querySelector(".dp-dock-fade .dpc-paths__note")?.textContent ?? "").includes("Basics"),
    { timeout: 5_000 },
  ).catch(() => undefined);
  const switched = await readToggle(page, ".dp-dock-fade");
  check(
    (switched.note ?? "") === "Roll again casts on Basics.",
    `[${theme}] leaving the sheet's path makes it speak, and say only the plan`,
    JSON.stringify(switched.note),
  );
  /* And the sheet on screen has NOT changed — rolls are immutable, and the
     switch is a statement about the next one. */
  const afterSwitch = await readRecordLine(page);
  check(afterSwitch.tag === "WARDROBE",
    `[${theme}] ⚠ and the SHEET does not move — the switch is about the next roll`,
    afterSwitch.present ? `record still ${afterSwitch.tag}` : "the record line vanished");
  console.log(`  shot ${await shoot(page, `5-sheet-switched-${theme}`)}`);

  /* Back to the Wardrobe roll for the rail walk below. */
  await page.evaluate(() => {
    for (const pill of Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-rollrail__item"))) {
      if (!(pill.textContent ?? "").trim().startsWith("04")) continue;
      pill.click();
      return;
    }
  });

  /* ───────────────────────── 6 · a Basics sheet ─────────────────────────── */
  const walkedBasics = await page.evaluate(() => {
    for (const pill of Array.from(document.querySelectorAll<HTMLButtonElement>(".dpc-rollrail__item"))) {
      if (!(pill.textContent ?? "").trim().startsWith("03")) continue;
      pill.click();
      return true;
    }
    return false;
  });
  check(walkedBasics, `[${theme}] the Basics roll is reachable on the rail`, walkedBasics ? "clicked 03" : "no 03 pill");
  await page.waitForFunction(
    () => (document.querySelector(".dpc-wardrobeline .dp-chrome")?.textContent ?? "") === "BASICS",
    { timeout: 20_000 },
  ).catch(() => undefined);
  const basicsRecord = await readRecordLine(page);
  check(basicsRecord.tag === "BASICS",
    `[${theme}] walking the rail changes what the sheet says it is wearing`,
    `${basicsRecord.tag} · ${basicsRecord.line}`);
  check((basicsRecord.line ?? "").includes("black"),
    `[${theme}] and the Basics line is the basics`, JSON.stringify(basicsRecord.line));
  console.log(`  shot ${await shoot(page, `6-sheet-basics-${theme}`)}`);

  /* ───────────────────── 7 · AN UNPATHED SHEET — the control ────────────── */
  await page.goto(`${BASE}/casting/s/${UNPATHED}`, { waitUntil: "domcontentloaded" });
  await settled(page, "Roll again");
  /* The dock's own row arrives with the config and the roll, both of which are
     round trips after "Roll again" has painted — wait on the thing (the verify
     skill's first reading). A genuine absence still falls through to a failing
     check rather than being swallowed. */
  await page.waitForFunction(
    () => document.querySelector(".dp-dock-fade .dpc-paths") !== null,
    { timeout: 20_000 },
  ).catch(() => undefined);
  const none = await readRecordLine(page);
  const noDock = await readToggle(page, ".dp-dock-fade");
  check(!none.present,
    `[${theme}] ⚠ CONTROL — a roll cast BEFORE the paths claims no path`,
    none.present ? `drew "${none.tag}"` : "no .dpc-wardrobeline on the page");
  /* And the other half of the same rule: it is still offered the PLAN, because
     a customer whose every sheet predates the paths must have a door to one. */
  check(noDock.present && (noDock.note ?? "").includes("Nothing was chosen"),
    `[${theme}] ⚠ and IS offered the plan, speaking, on a second unpathed session`,
    noDock.present ? JSON.stringify(noDock.note) : "no .dpc-paths in the dock");
  console.log(`  shot ${await shoot(page, `7-sheet-unpathed-${theme}`)}`);
}

/* ────────────────── 3 · THE LOBBY OUTSIDE THE FLAG — the control ────────── */
{
  const shutPage = await browser.newPage();
  await shutPage.setViewport({ width: 1440, height: 980 });
  await shutPage.setCookie({ name: "app_session_id", value: shutToken, domain: "localhost", path: "/" });
  for (const theme of ["dark", "light"] as const) {
    await shutPage.evaluateOnNewDocument((one: string) => {
      localStorage.setItem("drape_theme", one);
    }, theme);
    await shutPage.goto(`${BASE}/casting`, { waitUntil: "domcontentloaded" });
    await settled(shutPage, "Meet eight of them");
    const shut = await readToggle(shutPage, ".dpc-hero__copy");
    check(!shut.present,
      `[${theme}] ⚠ CONTROL — outside the flag the toggle is ABSENT, not disabled (§6)`,
      shut.present ? "the hero drew one" : "no .dpc-paths anywhere in the hero");
    /* Absent, and not merely hidden: a disabled control would still be in the
       DOM, and D-180 calls that a question with no answer wearing a tap
       target. Read across the WHOLE page, not only the hero. */
    const anywhere = await shutPage.evaluate(() => ({
      paths: document.querySelectorAll(".dpc-paths").length,
      disabledPills: document.querySelectorAll(".dp-scopepill[disabled]").length,
      says: /basics/i.test(document.body.innerText),
    }));
    check(anywhere.paths === 0 && anywhere.disabledPills === 0 && !anywhere.says,
      `[${theme}] ⚠ CONTROL — and the word Basics appears nowhere on the page`,
      JSON.stringify(anywhere));
    const path = `${OUT}/3-lobby-unflagged-${theme}.png`;
    await shutPage.screenshot({ path: path as `${string}.png` });
    console.log(`  shot ${path}`);
  }
  await shutPage.close();
}

await browser.close();

print();
console.log(`\n${records.length} readings · ${failures().length} failed · frames in ${OUT}/`);
process.exit(failures().length === 0 ? 0 : 1);
