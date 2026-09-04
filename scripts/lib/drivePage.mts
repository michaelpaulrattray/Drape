/**
 * The browser harness these drivers share — one launch, one session, one
 * collector.
 *
 * `drive-design-laws.mts` grew this shape first (puppeteer-core against
 * the system Edge, an `app_session_id` cookie minted for the run, a check
 * collector that exits non-zero). The self-drive walk needs exactly the same
 * three things, and a second copy of them is the mirror law #4 forbids — two
 * harnesses drift, and then two runs disagree about whether the product works.
 *
 * So the plumbing lives here and the LAWS live in the drivers, which is the
 * split that actually matters: what a surface must do is worth reading; how a
 * browser gets opened is not.
 */
import puppeteer, { type Browser, type Page } from "puppeteer-core";

import { createFaceScanMeter, readFaceScanAsk, type FaceScanMeter } from "./faceScanWire.mts";

/** The system browser. No download, no bundled Chromium, no version drift. */
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

export async function openDrivenPage(input: {
  base: string;
  token: string;
  width?: number;
  height?: number;
  /**
   * THE SCREEN'S OWN PIXEL DENSITY, which until now was silently 1.
   *
   * `setViewport` defaults `deviceScaleFactor` to 1, so every driver that has
   * ever run here measured a standard-density screen. That is invisible until a
   * measurement DEPENDS on it, and one does: the founder's "why do the images
   * look so pixelated?" is a question about device pixels, and the reading taken
   * for it (`output/downsample/downsample.json`, every row `"dpr": 1`) answered
   * at the one value where nothing can be stretched.
   *
   * Left undefined it stays 1 — no existing driver changes behaviour.
   */
  deviceScaleFactor?: number;
  /**
   * HOLD THE FACE SCAN AT THE WIRE (fable-694 §2).
   *
   * Off by default, because a walk that needs the panel needs the scan. On, the
   * ask is aborted in the browser and the sheet shows what the library alone
   * knows — nothing reaches the server, nothing is spent, and the walk's report
   * says so.
   *
   * It turns on request interception, which is not free: puppeteer disables the
   * page cache alongside it, so the cache is turned straight back on here.
   * A driver that installs its OWN request handler must guard it with
   * `request.isInterceptResolutionHandled()`, or the two will both try to
   * resolve one request.
   */
  holdFaceScan?: boolean;
}): Promise<{ browser: Browser; page: Page; faceScan: FaceScanMeter }> {
  /* `true`, not `"new"` — puppeteer-core dropped that string and its type says
     so. It ran anyway, which is why it survived: the scripts tree was not in
     any typecheck, so nothing ever read the type. */
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage();
  await page.setViewport({
    width: input.width ?? 1440,
    height: input.height ?? 900,
    deviceScaleFactor: input.deviceScaleFactor ?? 1,
  });
  const { hostname } = new URL(input.base);
  await page.setCookie({ name: "app_session_id", value: input.token, domain: hostname, path: "/" });

  const faceScan = createFaceScanMeter();
  const hold = input.holdFaceScan === true;
  if (hold) {
    await page.setRequestInterception(true);
    /* Interception turns the page cache off as a side effect, and half the
       measurements these drivers make are about a picture already being in the
       browser (`chosenFrame.ts`). Put it back. */
    await page.setCacheEnabled(true);
    page.on("request", (request) => {
      if (request.isInterceptResolutionHandled()) return;
      const ask = readFaceScanAsk(request.url(), request.postData() ?? null);
      /* Only a batch that is NOTHING BUT scans may be aborted — see the module
         comment: the alternative aborts the photograph beside it. */
      const holdable = ask.kind === "scanOnly";
      faceScan.saw(ask, holdable);
      if (holdable) {
        void request.abort("blockedbyclient").catch(() => {
          /* The page can go while a request is in flight; a hold that throws on
             teardown would fail a walk for finishing. */
        });
        return;
      }
      void request.continue().catch(() => {});
    });
  } else {
    /* PASSIVE, and that is the point: no interception, no cache change, no
       timing change. A walk that is not holding still declares what it spends. */
    page.on("request", (request) => {
      faceScan.saw(readFaceScanAsk(request.url(), request.postData() ?? null), false);
    });
  }
  declareOnExit(faceScan);

  return { browser, page, faceScan };
}

/**
 * EVERY WALK DECLARES WHAT IT BOUGHT, without every walk being edited.
 *
 * Twenty-nine drivers open this harness and not one of them has ever printed a
 * house-money line, because until fable-694 nobody knew there was one to print.
 * Registering the declaration here means the next driver written gets it for
 * free, and a driver that opens no sheet prints nothing at all — the meter
 * returns `null` and this stays silent.
 */
const meters: FaceScanMeter[] = [];

function declareOnExit(meter: FaceScanMeter): void {
  meters.push(meter);
  /* ONE listener however many pages a driver opens. Registering per page would
     print the same walk's spend twice and, past ten pages, warn about a leak
     that is really a harness counting itself. */
  if (meters.length > 1) return;
  process.on("exit", () => {
    for (const one of meters) {
      const line = one.line();
      if (line !== null) console.log(`\n${line}`);
    }
  });
}

/**
 * What a check saw — recorded on the pass as well as the failure.
 *
 * D-235's asymmetry, carried into the browser layer. An affirmative with
 * nothing behind it is how a production render got delivered and charged with
 * the hair visibly still down, and a browser assertion is the same shape: `ok`
 * with no `saw` is a claim, and `saw` is the artifact. It costs one string per
 * check and it is the difference between "the panel said the right thing" and
 * "something was truthy".
 */
export type CheckRecord = {
  law: string;
  ok: boolean;
  /** The observation the verdict rests on. Never empty on a real reading. */
  saw: string;
  /** False when the check never ran — which is neither a pass nor a failure. */
  armed: boolean;
};

/**
 * The collector itself, named so it can be PASSED to shared mechanics.
 *
 * `refineDriver` records the panel's own laws into the caller's collector rather
 * than keeping a second one — two collectors would print two verdicts about one
 * run, and the reader would have to know which was authoritative.
 */
export type Checks = {
  check: (ok: boolean, law: string, saw: string) => boolean;
  absent: (law: string, why: string) => void;
  neverArmed: (law: string, why: string) => void;
  records: CheckRecord[];
  failures: () => CheckRecord[];
  print: () => void;
};

export function createChecks(): {
  check: (ok: boolean, law: string, saw: string) => boolean;
  /** Legitimately not applicable here — recorded, and not counted as a pass. */
  absent: (law: string, why: string) => void;
  /** Declared for this run and never reached. A control that did not run does
   *  not exist (invariant 7), so this FAILS rather than passing quietly. */
  neverArmed: (law: string, why: string) => void;
  records: CheckRecord[];
  failures: () => CheckRecord[];
  print: () => void;
} {
  const records: CheckRecord[] = [];

  const check = (ok: boolean, law: string, saw: string): boolean => {
    /*
      THE ARGUMENT ORDER DEFENDS ITSELF, because getting it wrong is SILENT and
      passes everything (opus-654, found in a driver of my own).

      `check(law, ok, saw)` reads perfectly naturally and is what a shift writes
      at 2am. It puts a non-empty STRING in `ok` — truthy — so every assertion in
      that driver passes by construction, prints `ok`, and the run ends "ALL
      CHECKS HELD". The measurements underneath can be perfectly good; the
      verdict layer is simply not connected to them.

      TypeScript would catch it, and does not: `scripts/` is outside the two
      projects `pnpm check` compiles, so no driver in this directory is ever
      typechecked. Until that changes this is the only thing standing between a
      transposed call and a green report.

      A guard that refuses by ACTING rather than by absence — it throws rather
      than recording a failure, because a driver that cannot state its own
      assertions has not produced a weaker reading, it has produced none.
    */
    if (typeof ok !== "boolean") {
      throw new TypeError(
        `check() takes (ok, law, saw) and was given ${typeof ok} for \`ok\` — `
        + `almost certainly check(law, ok, saw), which passes every assertion silently. `
        + `Received: ${JSON.stringify(ok)}`,
      );
    }
    records.push({ law, ok, saw, armed: true });
    console.log(`  ${ok ? "ok  " : "FAIL"} ${law} — saw: ${saw}`);
    return ok;
  };

  return {
    check,
    absent: (law, why) => {
      records.push({ law, ok: true, saw: why, armed: false });
      console.log(`  --   ${law} — ${why}`);
    },
    neverArmed: (law, why) => {
      records.push({ law, ok: false, saw: why, armed: false });
      console.log(`  FAIL ${law} — never armed: ${why}`);
    },
    records,
    failures: () => records.filter((record) => !record.ok),
    print: () => {
      const armed = records.filter((record) => record.armed).length;
      const failed = records.filter((record) => !record.ok);
      console.log(
        `\n${failed.length === 0 ? "ALL CHECKS HELD" : `${failed.length} FAILURE(S)`}`
        + ` — ${armed} armed of ${records.length} declared`,
      );
      for (const record of failed) console.log(`  · ${record.law} — ${record.saw}`);
    },
  };
}
