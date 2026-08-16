/**
 * THE EATEN CLICK — the founder's own diagnosis, instrumented (fable-722).
 *
 * > *"it will be selected on one and you wont be able to click the next version
 * > — youll have to click like 5-10 times or click another version and then it
 * > works… but the image always changes with the version selected. i think its
 * > because it waits for the features to catch up before it allows you to
 * > select another thumbnail."*
 *
 * The image is always RIGHT. What is wrong is that a click on a particular next
 * thumbnail does not register, repeatedly, while a different thumbnail works
 * first try.
 *
 * # Why the burst sampler cannot see this, and this driver can
 *
 * `drive-burst-clicks-disposable.mts` clicks with `element.click()` from inside
 * the page. That dispatches an event straight at the node: it cannot miss, it
 * cannot be covered, and it cannot be eaten by the element being replaced
 * between the press and the release. **A programmatic click proves the handler
 * works; it says nothing about whether a person can reach it.** So this driver
 * uses REAL mouse input at measured coordinates — hit-tested by the browser,
 * exactly as his hand is.
 *
 * # The three failures it can tell apart
 *
 *   NO PRESS       the pointer went down and nothing on the chip heard it —
 *                  covered, moved, or `pointer-events: none`
 *   EATEN          the press landed and no CLICK followed — the node was
 *                  replaced between down and up, which is the signature that
 *                  fits "5-10 times, or click another one and then it works"
 *   IGNORED        the click fired, the handler ran, and the selection did not
 *                  move — his gate theory, and the one that would be contrary
 *                  to a standing ruling (clicks are never gated, fable-686 §2b)
 *
 * Driven under Fast 3G, in the window his theory names: each attempt is made
 * while the previous selection's panel work is still landing.
 *
 * It spends nothing: no render, no credits. The panel scan is held where it
 * rides a scan-only batch and declared where it does not.
 *
 *   npx tsx scripts/drive-eaten-clicks-disposable.mts [--no-throttle]
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { SignJWT } from "jose";
import type { Page } from "puppeteer-core";

import { openDatabase } from "./lib/dbConnection.mts";
import { openDrivenPage } from "./lib/drivePage.mts";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("output/eaten-clicks");
const THROTTLE = !process.argv.includes("--no-throttle");
/**
 * THE POSITIVE CONTROL (`--sabotage`).
 *
 * A clean null here means "nothing was eaten" only if this driver CAN see an
 * eaten click. So the control manufactures one: a `pointerdown` listener
 * replaces the chip node with a copy of itself, exactly as a re-render between
 * the press and the release would, and the release then lands on a node that
 * never saw the press — no click event, which is the DOM-swap signature. If the
 * EATEN arm does not go red under this, the green run above says nothing.
 */
const SABOTAGE = process.argv.includes("--sabotage");
/**
 * THE RECORDER'S OWN POSITIVE CONTROL (`--jiggle`).
 *
 * The displacement reading is the other half of this driver, and its first
 * outing produced a figure nobody could use: 760 readings in one run and THREE
 * in the next, from the same code. A reading that can silently collect nothing
 * cannot be quoted when it collects nothing interesting either — so the rail is
 * MADE to move, by a known distance, on a known cadence, and the recorder has
 * to see it. If a jump we ordered does not appear, no null from this instrument
 * means anything (law 2).
 */
const JIGGLE = process.argv.includes("--jiggle");
/** How far the control shoves the rail, in CSS pixels. Chosen to be far larger
 *  than a chip is wide, so a miss it causes is unambiguous. */
const JIGGLE_PX = 154;
/** How many version-to-version moves to attempt. */
const MOVES = Number(process.env.MOVES ?? 8);
/** How long one attempt is given before it is called a failure and repeated. */
const ATTEMPT_MS = Number(process.env.ATTEMPT_MS ?? 2_500);
/** His own figure — past this many tries the product is broken, not slow. */
const MAX_TRIES = 10;
/** How long the run watches the panel land before it starts clicking — the
 *  window in which a chip can travel under a hand. */
const DWELL_MS = Number(process.env.DWELL_MS ?? 6_000);
/** How many times the fable-726 alignment is built and pressed. */
const DEAD_CLICK_TRIALS = Number(process.env.DEAD_CLICK_TRIALS ?? 4);
/**
 * How long the plate is given to become the pressed version.
 *
 * Deliberately shorter than two round trips: with the guard back in, the
 * picture DOES eventually arrive — once the parked write lands and then the
 * pressed one behind it — and a window wide enough to include that would score
 * the founder's dead click as a pass with a delay. What he reports is the
 * click doing nothing, and this is the window in which it does nothing.
 */
const DEAD_CLICK_WATCH_MS = Number(process.env.DEAD_CLICK_WATCH_MS ?? 1_800);

const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;
if (!secret || !appId) throw new Error("JWT_SECRET and VITE_APP_ID are required");

const conn = await openDatabase(process.env.DATABASE_URL!);
const [rows] = await conn.query<Array<{ openId: string; session: string; position: number; versions: number }>>(
  `SELECT u.openId AS openId, s.publicId AS session, c.position AS position, COUNT(v.id) AS versions
     FROM users u
     JOIN casting_sessions s ON s.userId = u.id
     JOIN casting_candidates c ON c.sessionId = s.id
     JOIN casting_candidate_variants v ON v.candidateId = c.id AND v.status = 'ready'
    WHERE u.openId = 'outside-scope-bot-local' AND c.status = 'ready'
    GROUP BY c.id HAVING versions >= 3 ORDER BY c.id DESC LIMIT 1`,
);
await conn.end();
if (rows.length === 0) throw new Error("no fixture cast with three delivered versions to click between");
const { openId, session, position, versions } = rows[0]!;
const tile = String(position + 1).padStart(2, "0");

const token = await new SignJWT({ openId, appId, name: "Eaten clicks" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(secret));

await mkdir(OUT, { recursive: true });
const { browser, page, faceScan } = await openDrivenPage({
  base: BASE, token, width: 1440, height: 1000, holdFaceScan: true,
});

let failed = 0;
const check = (ok: boolean, name: string, saw: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
  if (!ok) failed += 1;
};

type Attempt = {
  move: number;
  try: number;
  target: string | null;
  /** What the browser heard, in order: the press, then the click, if any. */
  press: boolean;
  click: boolean;
  /** Did the selection actually move to the target? */
  selected: boolean;
  /** Was the panel still catching up when this was attempted (his theory)? */
  panelWorking: boolean;
  /**
   * WHAT WAS ACTUALLY UNDER THE AIM — the rail-movement mechanism, read at the
   * one instant it matters rather than as a statistic over the whole run.
   *
   * `aimedAt` is the chip sitting at the coordinates a moment before the press,
   * `hitAfter` the chip sitting there once the click has been delivered. A
   * person's hand is slower than this loop, so any disagreement here is a rail
   * that moved out from under an aim — his click landing on a neighbour, or on
   * nothing, while he was looking at the chip he meant.
   */
  aimedAt: string | null;
  hitAfter: string | null;
  /** How far the target chip's own top-left travelled across the press, in px. */
  chipDrift: number;
  ms: number;
};
const attempts: Attempt[] = [];

try {
  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable");
  const throttle = async (on: boolean) => cdp.send("Network.emulateNetworkConditions", on
    ? { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }
    : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  if (THROTTLE) await throttle(true);

  /*
    WHAT THE BROWSER HEARD — recorded from OUT HERE, so the product carries no
    probe. Capture phase on the document, so a handler that stops propagation
    cannot hide the event from this reading.
  */
  await page.evaluateOnNewDocument(`(() => {
    window.__heard = [];
    const label = (target) => {
      const chip = target && target.closest ? target.closest(".dpc-refine__pick") : null;
      return chip ? (chip.querySelector("span")?.textContent?.trim() ?? "(no label)") : null;
    };
    for (const kind of ["pointerdown", "click"]) {
      document.addEventListener(kind, (event) => {
        window.__heard.push({ kind, at: Math.round(performance.now()), label: label(event.target) });
      }, true);
    }
    /*
      AND WHETHER THE THING HE AIMS AT MOVES while the panel lands
      (fable-722 (b); the recorder rebuilt per fable-727 §3c).

      A person aims at a thumbnail and presses a moment later. If the chip has
      travelled in between — the panel's rows arriving and resizing the columns
      — the press lands somewhere else, and to them that is a click that did
      nothing.

      Three things were wrong with the first version of this, and all three are
      why its honest run collected THREE readings and could not be quoted:

      1. IT WATCHED THE RAIL, NOT THE CHIP. The container can sit perfectly
         still while the chip a person is aiming at travels inside it — a label
         wrapping to two lines, a ring appearing, a version arriving above.
         What moves under the aim is the CHIP, so every chip is recorded, by
         name.
      2. ONE CLOCK. An interval alone is at the mercy of whatever the page
         is doing to the main thread and of the browser's own throttling of a
         page it thinks nobody is looking at. Two clocks now push into one
         recording — an interval and an animation frame — with a floor on the
         gap so they cannot double-count.
      3. NO COVERAGE. Three readings and 760 readings printed the same kind of
         sentence, and only one of them was a measurement. Every sample carries
         its own timestamp so the run can prove afterwards that it watched the
         whole window, and refuse to quote a figure when it did not.
    */
    window.__railBoxes = [];
    /* WHY it slept, when it slept — a recorder that returns few readings must
       be able to say whether its clocks stopped or its target was absent.
       Without this the two are one silence, and the first outing spent a shift
       guessing between them. */
    window.__railMeta = {
      installedAt: Math.round(performance.now()), url: location.href,
      ticks: 0, missing: 0, pushed: 0, lastTick: 0, frames: 0, intervals: 0,
      lastProbe: -3000, probes: [],
    };
    const SAMPLE_GAP_MS = 50;
    let lastSample = -1;
    const sample = () => {
      const now = Math.round(performance.now());
      window.__railMeta.ticks += 1;
      window.__railMeta.lastTick = now;
      if (now - lastSample < SAMPLE_GAP_MS) return;
      const rail = document.querySelector(".dpc-refine__stack");
      if (!rail) {
        window.__railMeta.missing += 1;
        /* WHAT THE RECORDER'S OWN DOCUMENT HELD when it found nothing — the
           two silences (clocks stopped / target absent) are already told
           apart above; this tells absent-from-the-page from
           absent-from-THIS-page. */
        if (now - window.__railMeta.lastProbe > 2_000) {
          window.__railMeta.lastProbe = now;
          window.__railMeta.probes.push({
            at: now, href: location.href,
            refineNodes: document.querySelectorAll("[class*=dpc-refine]").length,
            viewer: document.querySelectorAll(".dpc-viewer__plate").length,
            bodyKids: document.body ? document.body.children.length : -1,
          });
        }
        return;
      }
      window.__railMeta.pushed += 1;
      lastSample = now;
      const box = rail.getBoundingClientRect();
      window.__railBoxes.push({
        at: now,
        x: Math.round(box.left), y: Math.round(box.top),
        w: Math.round(box.width), h: Math.round(box.height),
        /* WHAT ELSE WAS TRUE AT THAT INSTANT — so a jump can be attributed
           rather than merely reported. A rail that moves the moment the panel
           lands is a different finding from one that moves at random. */
        layout: rail.getAttribute("data-layout"),
        panelWorking: Boolean(document.querySelector(".dpc-face__working"))
          || Boolean(document.querySelector(".dpc-face__scanning")),
        /* WHAT IS BESIDE THE PICTURE, and how wide — a rail that moves the
           instant the panel lands has been PUSHED, and the width of the thing
           that pushed it is the whole explanation. */
        panel: (() => {
          /* The DOCK, not the panel inside it: the column is what holds the
             width, and it can stand empty. Reading the panel called a stable
             column "absent" the moment its rows were nothing. */
          const beside = document.querySelector(".dpc-viewer__dock");
          if (!beside) return null;
          const rect = beside.getBoundingClientRect();
          return { x: Math.round(rect.left), w: Math.round(rect.width) };
        })(),
        /* AND WHAT SITS UNDER THE PICTURE — the other neighbour that can move
           the rail, this time vertically: the stage is centred, so a control
           appearing below lifts everything above it by half its height. */
        below: (() => {
          const under = document.querySelector(".dpc-refine");
          if (!under) return null;
          const rect = under.getBoundingClientRect();
          return { y: Math.round(rect.top), h: Math.round(rect.height) };
        })(),
        plate: (() => {
          const plate = document.querySelector(".dpc-viewer__plate");
          if (!plate) return null;
          const rect = plate.getBoundingClientRect();
          return { y: Math.round(rect.top), h: Math.round(rect.height) };
        })(),
        visible: document.visibilityState,
        /* And the chips themselves, by name: the target a hand actually has. */
        chips: Array.from(rail.querySelectorAll(".dpc-refine__pick")).map((pick) => {
          const chip = pick.getBoundingClientRect();
          return {
            label: pick.querySelector("span")?.textContent?.trim() ?? null,
            x: Math.round(chip.left), y: Math.round(chip.top),
            w: Math.round(chip.width), h: Math.round(chip.height),
          };
        }),
      });
    };
    setInterval(() => { window.__railMeta.intervals += 1; sample(); }, 100);
    const frame = () => {
      window.__railMeta.frames += 1;
      sample();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  })()`);

  if (SABOTAGE) {
    /* The manufactured eaten click — see `SABOTAGE`. Installed on the page, in
       the same capture phase, so the swap happens before the release. */
    await page.evaluateOnNewDocument(`(() => {
      document.addEventListener("pointerdown", (event) => {
        const chip = event.target && event.target.closest
          ? event.target.closest(".dpc-refine__pick")
          : null;
        if (chip && chip.parentNode) chip.parentNode.replaceChild(chip.cloneNode(true), chip);
      }, true);
    })()`);
    console.log("SABOTAGE: every press replaces its chip — the EATEN arm must go red\n");
  }

  if (JIGGLE) {
    /* The recorder's control — see `JIGGLE`. The rail is shoved sideways by a
       known distance on a known cadence; the displacement reading must find it,
       and the aim reading must show the press landing somewhere else. */
    await page.evaluateOnNewDocument(`(() => {
      setInterval(() => {
        const rail = document.querySelector(".dpc-refine__stack");
        if (!rail) return;
        rail.style.transform = rail.style.transform === "translateX(${JIGGLE_PX}px)"
          ? "" : "translateX(${JIGGLE_PX}px)";
      }, 400);
    })()`);
    console.log(`JIGGLE: the rail is shoved ${JIGGLE_PX}px sideways every 400ms`
      + " — the displacement arm must find it\n");
  }

  await page.goto(`${BASE}/casting/s/${session}`, { waitUntil: "networkidle2", timeout: 240_000 });
  await page.waitForSelector(`button[aria-label="View candidate ${tile} larger"]`, { timeout: 240_000 });
  await page.click(`button[aria-label="View candidate ${tile} larger"]`);
  await page.waitForSelector(".dpc-refine__stack .dpc-refine__pick", { timeout: 240_000 });
  console.log(`${versions} delivered versions on this face — the rail is the target\n`);

  const heardSince = async (from: number) => (await page.evaluate(
    `(window.__heard ?? []).filter((one) => one.at >= ${from})`,
  )) as Array<{ kind: string; at: number; label: string | null }>;
  const now = async () => (await page.evaluate("Math.round(performance.now())")) as number;

  const railState = async () => (await page.evaluate(`(() => {
    const picks = Array.from(document.querySelectorAll(".dpc-refine__stack .dpc-refine__pick"))
      .filter((pick) => pick.tagName === "BUTTON");
    return {
      labels: picks.map((pick) => pick.querySelector("span")?.textContent?.trim() ?? null),
      lit: picks.findIndex((pick) => pick.getAttribute("aria-pressed") === "true"),
      /* His theory's own window: the panel beside the picture still catching
         up with the version that was just selected. */
      panelWorking: Boolean(document.querySelector(".dpc-face__working"))
        || Boolean(document.querySelector(".dpc-face__scanning")),
    };
  })()`)) as { labels: Array<string | null>; lit: number; panelWorking: boolean };

  type Chip = { label: string | null; x: number; y: number; w: number; h: number };
  type Reading = {
    at: number; x: number; y: number; w: number; h: number;
    layout: string | null; panelWorking: boolean; visible: string; chips: Chip[];
    panel: { x: number; w: number } | null;
    below: { y: number; h: number } | null;
    plate: { y: number; h: number } | null;
  };
  /*
    THE WINDOW THE RECORDER IS JUDGED ON — from the rail existing to the last
    press, in the page's own clock.

    The document is alive for a long time before any of this: a throttled load
    is over a minute of it, and the rail is not in the page for one tick of it.
    Readings that do not exist while there is nothing to record are not a gap in
    a measurement, and judging the recorder on the document's whole life called
    a perfect run a failure.

    AND THE LANDING IS INSIDE IT. The clicking itself is under a second — the
    selection is optimistic, so a move lands in a frame — and a window that
    short cannot see the layout settle, which is the very moment a chip travels
    under an aim. So the run dwells here, watching, for as long as a person
    spends looking at a face before reaching for the next version.
  */
  const phaseFrom = await now();
  await new Promise((resolve) => setTimeout(resolve, DWELL_MS));
  for (let move = 1; move <= MOVES; move += 1) {
    const before = await railState();
    /* The NEXT version along, wrapping — "the next thumbnail", his words. */
    const target = (before.lit + 1) % before.labels.length;
    const label = before.labels[target] ?? null;

    let landed = false;
    for (let attempt = 1; attempt <= MAX_TRIES && !landed; attempt += 1) {
      const picks = await page.$$(".dpc-refine__stack .dpc-refine__pick");
      const element = picks[target];
      if (!element) break;
      const box = await element.boundingBox();
      if (!box) break;
      /* Scrolled out of the rail's own overflow is not an eaten click — it is a
         chip nobody could have clicked, and it is skipped rather than counted. */
      const state = await railState();
      const startedAt = await now();
      const aim = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      /*
        WHAT IS AT THE AIM, AND WHERE THE TARGET IS — read on both sides of the
        press. `elementFromPoint` answers the first in the browser's own
        hit-testing, which is the same question a press asks; the target's box
        by position answers the second, so a chip that travelled is a distance
        and not an inference.
      */
      const atAim = async (): Promise<{
        under: string | null; target: { x: number; y: number } | null;
      }> => (await page.evaluate(`(() => {
        const found = document.elementFromPoint(${aim.x}, ${aim.y});
        const chip = found && found.closest ? found.closest(".dpc-refine__pick") : null;
        const picks = Array.from(document.querySelectorAll(".dpc-refine__stack .dpc-refine__pick"));
        const mine = picks[${target}];
        const rect = mine ? mine.getBoundingClientRect() : null;
        return {
          under: chip ? (chip.querySelector("span")?.textContent?.trim() ?? "(no label)") : null,
          target: rect ? { x: Math.round(rect.left), y: Math.round(rect.top) } : null,
        };
      })()`)) as { under: string | null; target: { x: number; y: number } | null };
      const aimBefore = await atAim();
      await page.mouse.click(aim.x, aim.y);
      const aimAfter = await atAim();
      const chipDrift = aimBefore.target && aimAfter.target
        ? Math.round(Math.max(
          Math.abs(aimAfter.target.x - aimBefore.target.x),
          Math.abs(aimAfter.target.y - aimBefore.target.y),
        ))
        : 0;

      let selected = false;
      const until = Date.now() + ATTEMPT_MS;
      while (Date.now() < until) {
        const at = await railState();
        if (at.lit === target) { selected = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const heard = await heardSince(startedAt);
      const onTarget = heard.filter((one) => one.label === label);
      attempts.push({
        move,
        try: attempt,
        target: label,
        press: onTarget.some((one) => one.kind === "pointerdown"),
        click: onTarget.some((one) => one.kind === "click"),
        selected,
        panelWorking: state.panelWorking,
        aimedAt: aimBefore.under,
        hitAfter: aimAfter.under,
        chipDrift,
        ms: Date.now() - (until - ATTEMPT_MS),
      });
      landed = selected;
    }
    const tries = attempts.filter((one) => one.move === move).length;
    console.log(`move ${move}: "${label}" — ${landed ? `selected after ${tries} click(s)` : `NEVER selected in ${tries}`}`
      + `${attempts.find((one) => one.move === move)?.panelWorking ? " (panel catching up)" : ""}`);
  }

  /*
    THE DISPLACEMENT WINDOW CLOSES HERE, before the dead-click phase reloads.

    A reload is a new document with a new clock and an empty recorder, so a
    window that spanned one would compare timestamps from two different zeroes —
    which it did, and reported a run of MINUS seventy-four seconds. The reading
    belongs to the clicking phase; the phase after it deliberately starts again
    from a fresh page.
  */
  const phaseTo = await now();
  const boxes = await page.evaluate("window.__railBoxes ?? []") as Reading[];
  const meta = await page.evaluate("window.__railMeta ?? null") as {
    installedAt: number; url: string; ticks: number; missing: number;
    pushed: number; lastTick: number; frames: number; intervals: number;
  } | null;

  const total = attempts.length;
  const noPress = attempts.filter((one) => !one.press);
  const eaten = attempts.filter((one) => one.press && !one.click);
  const ignored = attempts.filter((one) => one.click && !one.selected);
  const firstTry = new Set(attempts.filter((one) => one.try === 1 && one.selected).map((one) => one.move));
  const moves = new Set(attempts.map((one) => one.move));

  console.log("");
  check(noPress.length === 0, "every click reached a chip",
    `${noPress.length} of ${total} clicks were not heard at all`);
  check(eaten.length === 0, "no click was EATEN between the press and the release",
    `${eaten.length} of ${total} presses produced no click event`);
  check(ignored.length === 0, "no click fired and left the selection where it was",
    `${ignored.length} of ${total} clicks moved nothing`);
  check(firstTry.size === moves.size, "every version selected on the FIRST click",
    `${firstTry.size} of ${moves.size} moves landed first try`);

  /*
    THE ALIGNMENT HIS REPORT NEEDS — and the reason the IGNORED arm above read
    zero (founder pattern, fable-726; the blind spot named in §3).
    ---------------------------------------------------------------------------

    > *"say im on the original thumbnail and theres 3 total, if the middle one
    > isnt working for me to click onto it, the third one will."*

    Every move above steps to the NEXT version along, and that is a click on a
    version the server is not showing — the case that always worked. His case
    needs the two pointers lined up a particular way: the picture on screen is
    a click's claim (version A), while the SERVER's own frame is still version
    S, because the write has not landed yet. A click on S is then a click on
    the server's own frame, and until tonight that wrote no claim at all — so
    the claim already standing went on painting A and the click was dead.

    So the fixture is built rather than hoped for: park a claim on A, then,
    inside the round trip, press S. It costs nothing — two clicks and looking.

    A pass here is only worth what the red beside it is worth: run this with the
    `claimFor` guard put back and the plate stays on A for the whole window.
  */
  type Trial = { trial: number; parked: string | null; pressed: string | null; movedAfterMs: number | null };
  const trials: Trial[] = [];
  const chipsNow = async () => (await page.evaluate(`(() => Array.from(
    document.querySelectorAll(".dpc-refine__stack .dpc-refine__pick"),
  ).map((pick) => ({
    label: pick.querySelector("span")?.textContent?.trim() ?? null,
    frame: pick.getAttribute("data-frame"),
    thumb: pick.getAttribute("data-thumb"),
    lit: pick.getAttribute("aria-pressed") === "true",
  })))()`)) as Array<{ label: string | null; frame: string | null; thumb: string | null; lit: boolean }>;
  const plateNow = async () => (await page.evaluate(`(() => {
    const img = document.querySelector(".dpc-viewer__plate img");
    return img ? (img.currentSrc || img.src) : null;
  })()`)) as string | null;
  /** A real hand's click on the chip at this index. */
  const press = async (index: number) => {
    const picks = await page.$$(".dpc-refine__stack .dpc-refine__pick");
    const box = await picks[index]?.boundingBox();
    if (!box) return false;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    return true;
  };

  console.log("");
  /*
    A FRESH PAGE PER TRIAL, AND THE THROTTLE LIFTED FOR IT.

    "The version the server is showing" has to be a FACT, and there is exactly
    one moment it can be read for free: a page that has just loaded holds no
    claim, so its lit chip is the server's own answer. Asking a running page
    instead reads whatever claim is standing — which is how the first control
    run scored two of three trials as passes while testing nothing: the sabotage
    leaves a stale claim behind, the next trial believed it, and the press it
    then made was an ordinary switch that has always worked.

    The throttle goes for this phase because it was never what this arm needs.
    It exists for the eaten-click question (a person clicking while the panel
    catches up); here the only thing that matters is that the press happens
    inside the write's round trip, and that is ~2.7s on this machine unthrottled
    — ten times the gap used.
  */
  await throttle(false);
  for (let trial = 1; trial <= DEAD_CLICK_TRIALS; trial += 1) {
    await page.reload({ waitUntil: "networkidle2", timeout: 240_000 });
    await page.waitForSelector(`button[aria-label="View candidate ${tile} larger"]`, { timeout: 240_000 });
    await page.click(`button[aria-label="View candidate ${tile} larger"]`);
    await page.waitForSelector(".dpc-refine__stack .dpc-refine__pick", { timeout: 240_000 });
    const chips = await chipsNow();
    const server = chips.findIndex((one) => one.lit);
    if (server < 0) {
      console.log(`dead-click trial ${trial}: nothing lit on a fresh page — skipped`);
      continue;
    }
    const park = (server + 1) % chips.length;
    if (!(await press(park))) break;
    /* Inside the round trip: long enough for the claim to paint, far short of
       the write landing (it is ~2.7s on this machine, longer throttled). */
    await new Promise((resolve) => setTimeout(resolve, 250));
    const parkedPlate = await plateNow();
    /*
      THE FIXTURE HAS TO EXIST BEFORE ITS NULL MEANS ANYTHING.

      If the parked click never took the plate, then the press that follows is
      not a press on "the version the server is showing while something else is
      painted" — it is an ordinary switch, which always worked. A trial that
      never built the alignment is SKIPPED and says so; it is not a pass.
    */
    const parkChip = chips[park]!;
    if (!parkedPlate || (parkedPlate !== parkChip.frame && parkedPlate !== parkChip.thumb)) {
      console.log(`dead-click trial ${trial}: the park never took the plate — skipped`
        + ` (wanted "${parkChip.label}", plate …${String(parkedPlate).slice(-18)})`);
      continue;
    }
    if (!(await press(server))) break;

    const wanted = chips[server]!;
    const from = Date.now();
    let movedAfterMs: number | null = null;
    while (Date.now() - from < DEAD_CLICK_WATCH_MS) {
      const plate = await plateNow();
      if (plate && (plate === wanted.frame || plate === wanted.thumb)) {
        movedAfterMs = Date.now() - from;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    trials.push({
      trial, parked: chips[park]?.label ?? null, pressed: wanted.label ?? null, movedAfterMs,
    });
    check(movedAfterMs !== null,
      `dead click ${trial}: pressing the version the SERVER is showing moves the picture`,
      movedAfterMs !== null
        ? `the plate was his click's picture after ${movedAfterMs}ms`
        : `the plate stayed on "${chips[park]?.label}" for ${DEAD_CLICK_WATCH_MS}ms`
        + ` (parked picture …${String(parkedPlate).slice(-18)})`);
  }
  await writeFile(path.join(OUT, "dead-clicks.json"), `${JSON.stringify(trials, null, 2)}\n`);

  /*
    WHAT MOVED UNDER HIS AIM — the second mechanism, and the half that has to
    prove itself before it is allowed to say anything.

    A rail that shifts is a mechanism for his report, and a rail that does not
    shift RULES THAT MECHANISM OUT, which is worth as much — but only if the
    recorder was awake for the run. Its first outing collected 760 readings on
    one arm and three on the next, and three readings covering 300ms of a
    seventy-second run would have printed the same reassuring `0px`. So
    COVERAGE IS ASSERTED FIRST, and every figure below is withheld when it
    fails (law 2: verify the instrument before believing its finding).
  */
  console.log(`recorder: ${meta ? `installed at ${meta.installedAt}ms on ${meta.url}`
    + ` · ${meta.intervals} interval ticks + ${meta.frames} animation frames`
    + ` · ${meta.pushed} pushed, ${meta.missing} found no rail, last tick ${meta.lastTick}ms`
    : "NEVER INSTALLED"}`);
  const during = boxes.filter((one) => one.at >= phaseFrom && one.at <= phaseTo);
  const phase = phaseTo - phaseFrom;
  /* The longest the recorder ever went quiet INSIDE that window, counting the
     run-up to the first reading and the run-out after the last: a burst of
     samples at each end would pass a span test and measure nothing between. */
  let gap = during.length ? Math.max(during[0]!.at - phaseFrom, phaseTo - during[during.length - 1]!.at) : phase;
  for (let at = 1; at < during.length; at += 1) gap = Math.max(gap, during[at]!.at - during[at - 1]!.at);
  /* Enough readings to be a trace, and no silence long enough to hide a jump.
     Both are about the WINDOW rather than the count: thirteen readings across
     0.7s is a measurement; thirteen across a minute is not. */
  const armed = during.length >= 5 && gap <= 250;
  check(armed, "the displacement recorder was awake for the clicking",
    `${during.length} readings across a ${(phase / 1000).toFixed(1)}s clicking window`
    + ` (${boxes.length} in the page's whole life), longest silence ${gap}ms`
    + `${armed ? "" : " — NOT A MEASUREMENT, the figures below are withheld"}`);

  if (armed) {
    /* The rail's own travel, then the CHIPS' — the container can sit still while
       the thing he aims at moves inside it. */
    let worst = 0;
    let worstAt = 0;
    let worstWhy: Reading | null = null;
    for (let at = 1; at < during.length; at += 1) {
      const jump = Math.max(
        Math.abs(during[at]!.x - during[at - 1]!.x),
        Math.abs(during[at]!.y - during[at - 1]!.y),
      );
      if (jump > worst) { worst = jump; worstAt = during[at]!.at; worstWhy = during[at]!; }
    }
    let chipWorst = 0;
    let chipWorstLabel: string | null = null;
    let chipWorstAt = 0;
    for (let at = 1; at < during.length; at += 1) {
      /*
        PAIRED BY POSITION, NOT BY NAME — a chip's label is its request text and
        a face can hold the same request many times over. Matching by label
        first reported a 586px jump on a rail that had moved 154, because it
        paired the third "her right eye crimson" with the first.
      */
      if (during[at]!.chips.length !== during[at - 1]!.chips.length) continue;
      for (let index = 0; index < during[at]!.chips.length; index += 1) {
        const chip = during[at]!.chips[index]!;
        const was = during[at - 1]!.chips[index]!;
        const jump = Math.max(Math.abs(chip.x - was.x), Math.abs(chip.y - was.y));
        if (jump > chipWorst) {
          chipWorst = jump; chipWorstLabel = chip.label; chipWorstAt = during[at]!.at;
        }
      }
    }
    console.log(`rail displacement: worst single jump ${worst}px at ${worstAt}ms`
      + ` over ${during.length} readings`
      + (worstWhy ? ` (layout "${worstWhy.layout}", panel ${worstWhy.panelWorking ? "catching up" : "at rest"}`
        + `${worstWhy.panel ? `, beside it ${worstWhy.panel.w}px wide at x=${worstWhy.panel.x}` : ""})` : ""));
    console.log(`chip displacement: worst single jump ${chipWorst}px at ${chipWorstAt}ms`
      + ` on "${chipWorstLabel}" — the target a hand actually has`);
    if (JIGGLE) {
      check(worst >= JIGGLE_PX - 4 || chipWorst >= JIGGLE_PX - 4,
        `the recorder SEES a ${JIGGLE_PX}px shove it was told about`,
        `worst rail ${worst}px, worst chip ${chipWorst}px`);
    }
  }

  /*
    AND THE ONE INSTANT THAT MATTERS: was the chip he aimed at still under the
    point when the press landed? A statistic over the whole run can be large and
    harmless (a jump between attempts) or small and fatal (a two-pixel slide at
    the exact moment of the press). This is read per attempt, on both sides of
    the click, by the browser's own hit-testing.
  */
  const misaimed = attempts.filter((one) => one.aimedAt !== one.target);
  const drifted = attempts.filter((one) => one.chipDrift > 0);
  check(misaimed.length === 0, "the chip aimed at was still under the point at the press",
    `${misaimed.length} of ${total} presses had something else under them`
    + (misaimed.length ? ` — e.g. aimed "${misaimed[0]!.target}", found "${misaimed[0]!.aimedAt}"` : ""));
  console.log(`chip drift across the press: ${drifted.length} of ${total} attempts moved at all`
    + (drifted.length ? `, worst ${Math.max(...drifted.map((one) => one.chipDrift))}px` : ""));
  await writeFile(path.join(OUT, "rail-boxes.json"), `${JSON.stringify(boxes, null, 2)}\n`);

  await writeFile(path.join(OUT, "attempts.json"), `${JSON.stringify(attempts, null, 2)}\n`);
  await page.screenshot({ path: path.join(OUT, "at-rest.png") });
} finally {
  console.log(faceScan.line() ?? "");
  await browser.close();
}

console.log(failed === 0 ? "\nall arms passed" : `\n${failed} arm(s) failed`);
process.exit(failed === 0 ? 0 : 1);
