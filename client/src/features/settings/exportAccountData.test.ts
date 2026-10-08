/**
 * THE DATA EXPORT'S REFUSAL, DRIVEN (#1962, the relay's finding on PR #1981).
 *
 * The server half of #1962 gave the GDPR export a real limit — one every five
 * minutes, a `TOO_MANY_REQUESTS` whose message says when to come back. **The
 * customer never saw it.** `refetch()` resolves with `{ error }` instead of
 * throwing, so the component's `catch` could not fire; the next line exited
 * silently on `!result.data`; and `data` holds the LAST SUCCESSFUL value, so a
 * refused second click re-downloaded the stale file and claimed success.
 *
 * ⚠ **THESE ARMS DRIVE THE REAL ROUTINE AND THE REAL `readableFailure`.** A
 * text guard asserting the absence of `!result.data` would read a spelling for
 * a meaning (working law 3: a backstop needs a test that drives the thing), and
 * component rendering is outside `pnpm test` — `vitest.config.ts` is a node
 * environment with no DOM, so no arm can click the Export button. What is
 * driveable is the decision: given a throwing fetch, does anything download and
 * does the customer get the server's own sentence?
 *
 * The arms that matter are the two the defect passed:
 *   - a refusal downloads NOTHING and says nothing about success;
 *   - the SECOND click after a success — the stale-data road — downloads nothing.
 */
import { describe, expect, it } from "vitest";

import { readableFailure } from "../../lib/failureSentence";
import {
  EXPORT_FALLBACK_FAILURE,
  EXPORT_SUCCESS,
  exportAccountData,
  exportFileName,
  type ExportAccountDataDeps,
} from "./sections/exportAccountData";
import { PRODUCT_NAME } from "@shared/brand";

type Recorder = {
  deps: ExportAccountDataDeps;
  downloads: { name: string; json: string }[];
  failures: string[];
  successes: string[];
  logged: { context: string; error: unknown }[];
};

function recorder(fetchExport: () => Promise<unknown>): Recorder {
  const downloads: { name: string; json: string }[] = [];
  const failures: string[] = [];
  const successes: string[] = [];
  const logged: { context: string; error: unknown }[] = [];
  return {
    downloads,
    failures,
    successes,
    logged,
    deps: {
      fetchExport,
      download: (file) => downloads.push({ name: file.name, json: file.json }),
      onFailure: (message) => failures.push(message),
      onSuccess: (message) => successes.push(message),
      logFailure: (context, error) => logged.push({ context, error }),
      /* The REAL chooser, so an arm cannot pass by a stub being generous. */
      readFailure: readableFailure,
      now: () => new Date("2026-10-08T11:30:00.000Z"),
    },
  };
}

/** The shape a tRPC refusal arrives in — the code is what `readableFailure` reads. */
function refusal(code: string, message: string): Error & { data: { code: string } } {
  const error = new Error(message) as Error & { data: { code: string } };
  error.data = { code };
  return error;
}

describe("the GDPR export's refusal reaches the customer", () => {
  it("downloads nothing and shows the SERVER'S OWN sentence when the limit refuses", async () => {
    const said = "You can export your data once every 5 minutes. Try again in 4 minutes.";
    const r = recorder(() => Promise.reject(refusal("TOO_MANY_REQUESTS", said)));

    await exportAccountData(r.deps);

    /* The defect: both of these were empty and the customer saw a success toast. */
    expect(r.downloads).toHaveLength(0);
    expect(r.successes).toHaveLength(0);
    expect(r.failures).toEqual([said]);
    expect(r.logged.map((l) => l.context)).toEqual(["account.exportData"]);
  });

  it("falls back to our own sentence when the failure is NOT ours", async () => {
    /* A gateway's plain-text 502 arrives as a parser error — never shown raw. */
    const r = recorder(() =>
      Promise.reject(new Error(`Unexpected token 'u', "upstream error" is not valid JSON`)),
    );

    await exportAccountData(r.deps);

    expect(r.failures).toEqual([EXPORT_FALLBACK_FAILURE]);
    expect(r.downloads).toHaveLength(0);
  });

  it("downloads exactly once, with the data, when the export succeeds", async () => {
    const r = recorder(() => Promise.resolve({ user: { id: 1 }, casts: [] }));

    await exportAccountData(r.deps);

    expect(r.downloads).toHaveLength(1);
    expect(r.successes).toEqual([EXPORT_SUCCESS]);
    expect(r.failures).toHaveLength(0);
    expect(JSON.parse(r.downloads[0]!.json)).toEqual({ user: { id: 1 }, casts: [] });
  });

  it("⚠ THE STALE ROAD: a refusal AFTER a success still downloads nothing", async () => {
    /*
      This is the arm the defect failed worst. The old code read `result.data`,
      which a TanStack query keeps from the last SUCCESSFUL fetch — so the
      second click re-sent the first click's file and said it had downloaded.
      The routine holds no state at all, which is what makes that impossible.
    */
    let call = 0;
    const r = recorder(() => {
      call += 1;
      return call === 1
        ? Promise.resolve({ user: { id: 1 } })
        : Promise.reject(refusal("TOO_MANY_REQUESTS", "Try again in 5 minutes."));
    });

    await exportAccountData(r.deps);
    await exportAccountData(r.deps);

    expect(r.downloads).toHaveLength(1);
    expect(r.successes).toEqual([EXPORT_SUCCESS]);
    expect(r.failures).toEqual(["Try again in 5 minutes."]);
  });

  it("calls the server EXACTLY ONCE — a retry would spend the one allowance", async () => {
    /*
      The app's query client is a stock `new QueryClient()` (`main.tsx`), whose
      default is `retry: 3`: a transient first failure spent the single
      allowance and the three retries were then refused by the limit the first
      attempt had just consumed — no file and no sentence for five minutes.
      The routine must never fetch twice, and the component's `fetchExport`
      must be a call that does not retry.
    */
    let calls = 0;
    const r = recorder(() => {
      calls += 1;
      return Promise.reject(refusal("TOO_MANY_REQUESTS", "Try again in 5 minutes."));
    });

    await exportAccountData(r.deps);

    expect(calls).toBe(1);
  });

  it("says nothing silently: an empty answer is a failure, not a quiet return", async () => {
    const r = recorder(() => Promise.resolve(undefined));

    await exportAccountData(r.deps);

    expect(r.downloads).toHaveLength(0);
    expect(r.failures).toEqual([EXPORT_FALLBACK_FAILURE]);
    expect(r.successes).toHaveLength(0);
  });
});

describe("the downloaded file carries the product's name", () => {
  it("names the file from PRODUCT_NAME, not the old product", () => {
    const name = exportFileName(new Date("2026-10-08T11:30:00.000Z"));

    expect(name).toBe(`${PRODUCT_NAME.toLowerCase()}-data-export-2026-10-08.json`);
    /* The miss both brand sweeps could not see: a filename is not prose. */
    expect(name.toLowerCase()).not.toContain("drape");
  });
});
