/**
 * THE STAFF CSV EXPORTS' REFUSAL, DRIVEN (#1991).
 *
 * Three staff exports ran through `refetch()`, which RESOLVES with `{ error }`
 * rather than throwing: a refusal said nothing, and because `data` is the last
 * SUCCESSFUL answer a refused second press re-downloaded the previous file and
 * announced a fresh export. The same class #1962 repaired for the customer's
 * data export.
 *
 * ⚠ **THESE ARMS DRIVE THE REAL ROUTINE AND THE REAL `readableFailure`.** No
 * arm can press the button (component rendering is outside `pnpm test`), so
 * the decision is driven directly; the class arm at the bottom then holds every
 * `moderatorExports` call in `client/src` to the road the routine needs — a
 * caller that hands it a cached answer would defeat it.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readableFailure } from "../../lib/failureSentence";
import { runStaffCsvExport, type StaffCsvAnswer, type StaffCsvExportDeps } from "./staffCsvExport";

const FALLBACK = "The audit logs could not be exported.";

function recorder(fetchExport: () => Promise<StaffCsvAnswer | null | undefined>, opts?: { downloadThrows?: boolean }) {
  const downloads: { name: string; csv: string }[] = [];
  const failures: string[] = [];
  const successes: string[] = [];
  const logged: string[] = [];
  const deps: StaffCsvExportDeps<StaffCsvAnswer> = {
    context: "moderatorExports.exportAuditLogsCsv",
    fetchExport,
    fileName: "audit-logs-2026-10-08.csv",
    successMessage: (answer) => `Exported ${answer.total} audit log entries`,
    fallbackFailure: FALLBACK,
    download: (file) => {
      if (opts?.downloadThrows) throw new Error("blob URLs are blocked");
      downloads.push({ name: file.name, csv: file.csv });
    },
    onSuccess: (message) => successes.push(message),
    onFailure: (message) => failures.push(message),
    logFailure: (context) => logged.push(context),
    readFailure: readableFailure,
  };
  return { deps, downloads, failures, successes, logged };
}

function refusal(code: string, message: string): Error & { data: { code: string } } {
  const error = new Error(message) as Error & { data: { code: string } };
  error.data = { code };
  return error;
}

describe("a refused staff export says so, and downloads nothing (#1991)", () => {
  it("shows the SERVER'S OWN sentence on a refusal, with no file and no success", async () => {
    const said = "You no longer have moderator access.";
    const r = recorder(() => Promise.reject(refusal("FORBIDDEN", said)));

    await runStaffCsvExport(r.deps);

    expect(r.downloads).toHaveLength(0);
    expect(r.successes).toHaveLength(0);
    expect(r.failures).toEqual([said]);
    expect(r.logged).toEqual(["moderatorExports.exportAuditLogsCsv"]);
  });

  it("falls back to our own sentence when the failure is a transport's, not ours", async () => {
    const r = recorder(() =>
      Promise.reject(new Error(`Unexpected token 'u', "upstream error" is not valid JSON`)),
    );

    await runStaffCsvExport(r.deps);

    expect(r.failures).toEqual([FALLBACK]);
    expect(r.downloads).toHaveLength(0);
  });

  it("POSITIVE CONTROL: a good answer downloads exactly once and says how many", async () => {
    const r = recorder(() => Promise.resolve({ csv: "id\n1\n2", total: 2 }));

    await runStaffCsvExport(r.deps);

    expect(r.downloads).toEqual([{ name: "audit-logs-2026-10-08.csv", csv: "id\n1\n2" }]);
    expect(r.successes).toEqual(["Exported 2 audit log entries"]);
    expect(r.failures).toHaveLength(0);
  });

  it("⚠ THE STALE ROAD: a refusal AFTER a success downloads nothing and claims nothing", async () => {
    let call = 0;
    const r = recorder(() => {
      call += 1;
      return call === 1
        ? Promise.resolve({ csv: "id\n1", total: 1 })
        : Promise.reject(refusal("BAD_REQUEST", "That date range is not valid."));
    });

    await runStaffCsvExport(r.deps);
    await runStaffCsvExport(r.deps);

    expect(r.downloads).toHaveLength(1);
    expect(r.successes).toEqual(["Exported 1 audit log entries"]);
    expect(r.failures).toEqual(["That date range is not valid."]);
  });

  it("an empty answer is a failure, not a quiet return", async () => {
    const r = recorder(() => Promise.resolve(undefined));

    await runStaffCsvExport(r.deps);

    expect(r.downloads).toHaveLength(0);
    expect(r.successes).toHaveLength(0);
    expect(r.failures).toEqual([FALLBACK]);
  });

  it("a browser failure while saving the file is said, never a success", async () => {
    const r = recorder(() => Promise.resolve({ csv: "id\n1", total: 1 }), { downloadThrows: true });

    await runStaffCsvExport(r.deps);

    expect(r.successes).toHaveLength(0);
    expect(r.failures).toEqual([FALLBACK]);
  });

  it("asks the server exactly once per press — no retry", async () => {
    let calls = 0;
    const r = recorder(() => {
      calls += 1;
      return Promise.reject(refusal("TOO_MANY_REQUESTS", "Slow down."));
    });

    await runStaffCsvExport(r.deps);

    expect(calls).toBe(1);
  });
});

/* ---------------------------------------------------------------- the class */

const CLIENT_SRC = join(__dirname, "..", "..");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** Every `moderatorExports.<procedure>.<method>` reach in the client. */
function exportReaches(): { file: string; procedure: string; method: string }[] {
  const reaches: { file: string; procedure: string; method: string }[] = [];
  for (const file of sourceFiles(CLIENT_SRC)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/moderatorExports\s*\.\s*(\w+)\s*\.\s*(\w+)/g)) {
      reaches.push({ file: file.slice(CLIENT_SRC.length + 1).replace(/\\/g, "/"), procedure: m[1]!, method: m[2]! });
    }
  }
  return reaches;
}

describe("every staff CSV export goes through the vanilla client (#1991's class)", () => {
  it("finds the three exports — the population is not empty", () => {
    const procedures = new Set(exportReaches().map((r) => r.procedure));
    expect([...procedures].sort()).toEqual([
      "exportAuditLogsCsv",
      "exportUserCreditHistoryCsv",
      "exportUserGenerationHistoryCsv",
    ]);
  });

  it("no export is a cached hook — every reach is `utils.client…query()`", () => {
    /*
      `useQuery` + `refetch()` is the defect's shape: it resolves instead of
      throwing and keeps the last good answer. `.query` here can only be the
      vanilla client's (the React proxy has no `.query`), which throws, caches
      nothing and retries nothing.
    */
    const offenders = exportReaches().filter((r) => r.method !== "query");
    expect(offenders).toEqual([]);
  });
});
