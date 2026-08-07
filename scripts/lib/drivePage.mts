/**
 * The browser harness these drivers share — one launch, one session, one
 * collector.
 *
 * `drive-casting-design-laws.mts` grew this shape first (puppeteer-core against
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

/** The system browser. No download, no bundled Chromium, no version drift. */
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

export async function openDrivenPage(input: {
  base: string;
  token: string;
  width?: number;
  height?: number;
}): Promise<{ browser: Browser; page: Page }> {
  /* `true`, not `"new"` — puppeteer-core dropped that string and its type says
     so. It ran anyway, which is why it survived: the scripts tree was not in
     any typecheck, so nothing ever read the type. */
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: input.width ?? 1440, height: input.height ?? 900 });
  const { hostname } = new URL(input.base);
  await page.setCookie({ name: "app_session_id", value: input.token, domain: hostname, path: "/" });
  return { browser, page };
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
