/**
 * THE STAFF CSV EXPORTS' OWN ROUTINE — so a refusal can be DRIVEN (#1991).
 *
 * # The defect this exists to make impossible
 *
 * Three staff exports — Audit logs, a user's Credit history and a user's
 * Generation history — ran as `useQuery(input, { enabled: false })` and were
 * driven by `await query.refetch()`. That is the shape #1962 repaired on the
 * customer's data export (`features/settings/sections/exportAccountData.ts`),
 * and it fails the same three ways:
 *
 * - **`refetch()` RESOLVES with `{ error }` — it does not throw**, so the
 *   `try/catch` around it (two of the three had one; Generations had none)
 *   could never fire;
 * - the result was read as `if (result.data)` with no `else`, so a refusal
 *   put the button back and said NOTHING;
 * - `result.data` is the last SUCCESSFUL value, so a refused press after a good
 *   one re-downloaded the PREVIOUS file and announced a fresh export.
 *
 * # Why a module rather than three handlers
 *
 * Component rendering is outside `pnpm test` (`vitest.config.ts` is a node
 * environment), so no arm can press the button. The decision — given a throwing
 * fetch, does anything download and does staff get a sentence? — is a plain
 * function over injected sinks, and `staffCsvExport.test.ts` drives the real
 * one with the real `readableFailure`. One routine rather than three copies,
 * because three copies of a repair is how the fourth export ships without it.
 *
 * The components' remaining job is to supply `fetchExport`, and it MUST be a
 * call that neither caches nor retries — `utils.client.moderatorExports.<x>.query(input)`,
 * the vanilla client — because this routine cannot defend against a caller that
 * hands it a cached value. The test's class arm holds every `moderatorExports`
 * call in `client/src` to that road.
 */

/** What every staff CSV export answers with — `server/routes/moderatorExports.ts`. */
export type StaffCsvAnswer = { readonly csv: string; readonly total: number };

export type StaffCsvExportDeps<T extends StaffCsvAnswer> = {
  /** The procedure's name, for the developer log only. */
  readonly context: string;
  /** Ask the server. MUST throw on refusal and MUST NOT cache or retry. */
  readonly fetchExport: () => Promise<T | null | undefined>;
  /** The downloaded file's name. */
  readonly fileName: string;
  /** What a finished export says — built from THIS answer, never a remembered one. */
  readonly successMessage: (answer: T) => string;
  /** What a refusal says when the server's own sentence did not reach us. */
  readonly fallbackFailure: string;
  /** Put the bytes in front of the reader. Called at most once, never on a refusal. */
  readonly download: (file: { readonly name: string; readonly csv: string }) => void;
  readonly onSuccess: (message: string) => void;
  readonly onFailure: (message: string) => void;
  readonly logFailure: (context: string, error: unknown) => void;
  /** `readableFailure`, injected so the arms drive the real one. */
  readonly readFailure: (error: unknown, fallback: string) => string;
};

/**
 * Run one staff export and say what happened either way.
 *
 * ⚠ **THERE IS NO SILENT EXIT, and that is the whole repair.** Every road out
 * has called either `download` + `onSuccess` or `onFailure` — a thrown refusal,
 * a transport failure, a browser failure while saving the file, and an empty
 * answer all reach the reader as a sentence.
 */
export async function runStaffCsvExport<T extends StaffCsvAnswer>(
  deps: StaffCsvExportDeps<T>,
): Promise<void> {
  const { context, fetchExport, fallbackFailure, logFailure, onFailure, readFailure } = deps;
  let answer: T | null | undefined;
  try {
    answer = await fetchExport();
  } catch (error) {
    logFailure(context, error);
    onFailure(readFailure(error, fallbackFailure));
    return;
  }

  /* The procedures never answer nothing; a road that should be unreachable still may not be silent. */
  if (!answer || typeof answer.csv !== "string") {
    logFailure(context, new Error("export answered with no file"));
    onFailure(fallbackFailure);
    return;
  }

  try {
    deps.download({ name: deps.fileName, csv: answer.csv });
  } catch (error) {
    /* A blob URL or an anchor click that fails: no file arrived, so say so. */
    logFailure(context, error);
    onFailure(fallbackFailure);
    return;
  }
  deps.onSuccess(deps.successMessage(answer));
}

/** The browser half every staff export shares: CSV bytes to a saved file. */
export function saveCsvFile({ name, csv }: { readonly name: string; readonly csv: string }): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Today's date for a file name, `YYYY-MM-DD` — the stamp all three files already carried. */
export function csvDateStamp(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
