/**
 * THE DATA EXPORT'S OWN ROUTINE — so the refusal can be DRIVEN (#1962, the
 * relay's finding on PR #1981).
 *
 * # The defect this exists to make impossible
 *
 * The server half of #1962 gave the GDPR export a real rate limit: one export
 * every five minutes, refused with a `TOO_MANY_REQUESTS` whose message says
 * when to come back. **The customer never saw it**, and the reason is a shape
 * worth keeping rather than a typo:
 *
 * `SecuritySection` ran the export as `useQuery(undefined, { enabled: false })`
 * and called `refetch()`. **`refetch()` RESOLVES with `{ error }` — it does not
 * throw** (no `throwOnError`), so the `try/catch` around it could never fire and
 * the toast it guarded could never appear. The next line was `if (!result.data)
 * return;`, a silent exit — and `data` on a TanStack query holds the LAST
 * SUCCESSFUL value, so a refused SECOND click did not merely stay quiet: it
 * re-downloaded the previous file and said *"Your data has downloaded."*
 *
 * ⚠ **And the retry made one failure into a five-minute lockout.** The app's
 * query client is a stock `new QueryClient()` (`client/src/main.tsx:50`), whose
 * default is `retry: 3`. A transient failure on the first attempt spent the
 * single allowance, and the three retries were then refused by the limit the
 * first attempt had just consumed. The customer got no file and no sentence for
 * five minutes, with nothing on screen to say why.
 *
 * # Why a module rather than a handler in the component
 *
 * Component RENDERING is deliberately outside `pnpm test` — `vitest.config.ts`
 * is a node environment with no DOM — so an arm cannot click the Export button.
 * A text guard asserting the absence of `!result.data` would be reading a
 * spelling for a meaning, and working law 3 is explicit that a backstop needs a
 * test that drives the thing. So the routine is a plain function over three
 * sinks, and `exportAccountData.test.ts` drives the real one: a refusal shows
 * the server's sentence and downloads NOTHING, a success downloads exactly once.
 *
 * The component's remaining job is to supply the sinks, and the one that matters
 * is `fetchExport`: it must be a call that neither CACHES nor RETRIES
 * (`utils.client.account.exportData.query()`, the vanilla client), because this
 * routine cannot defend against a caller that hands it a cached value.
 */
import { PRODUCT_NAME } from "@shared/brand";

/** What a refused export says when the server's own sentence did not arrive. */
export const EXPORT_FALLBACK_FAILURE = "That export could not be made.";

/** What a finished export says. */
export const EXPORT_SUCCESS = "Your data has downloaded.";

/**
 * The downloaded file's name.
 *
 * ⚠ **IT SAID `drape-data-export-…` UNTIL THIS CARD**, which is a word a
 * customer READS — it lands in their downloads folder and sits there — and
 * `shared/brand.ts` is explicit that such words are this constant's business
 * while persisted identifiers are not. Both brand sweeps missed it (#1934/#1944
 * on the client, #1955 on the server) because both read for customer-visible
 * PROSE, and a template literal assigned to `link.download` is not prose. The
 * five siblings that sweep shape also cannot see are filed rather than folded
 * into a privacy card.
 */
export function exportFileName(now: Date): string {
  return `${PRODUCT_NAME.toLowerCase()}-data-export-${now.toISOString().split("T")[0]}.json`;
}

export type ExportAccountDataDeps = {
  /**
   * Ask the server for the export. MUST throw on refusal, and MUST NOT cache or
   * retry — see the docblock above; this is the whole contract.
   */
  readonly fetchExport: () => Promise<unknown>;
  /** Put the bytes in front of the customer. Called at most once, never on a refusal. */
  readonly download: (file: { readonly name: string; readonly json: string }) => void;
  /** Our sentence for a refusal — the server's own when it reached us. */
  readonly onFailure: (message: string) => void;
  /** Our sentence for a finished export. */
  readonly onSuccess: (message: string) => void;
  /** Keep the raw error where a developer can find it. */
  readonly logFailure: (context: string, error: unknown) => void;
  /** Our sentence-chooser — `readableFailure`, injected so the arms drive the real one. */
  readonly readFailure: (error: unknown, fallback: string) => string;
  /** The clock, so the filename arm is not a date race. */
  readonly now?: () => Date;
};

/**
 * Run one export, and say what happened either way.
 *
 * ⚠ **THERE IS NO SILENT EXIT, and that is the whole repair.** Every road out
 * of this function has either called `download` + `onSuccess` or called
 * `onFailure`. A thrown refusal, a transport failure and an empty answer all
 * reach the customer as a sentence.
 */
export async function exportAccountData(deps: ExportAccountDataDeps): Promise<void> {
  const { fetchExport, download, onFailure, onSuccess, logFailure, readFailure } = deps;
  let data: unknown;
  try {
    data = await fetchExport();
  } catch (error) {
    logFailure("account.exportData", error);
    onFailure(readFailure(error, EXPORT_FALLBACK_FAILURE));
    return;
  }

  /*
    ⚠ AN EMPTY ANSWER IS A FAILURE, NOT A QUIET RETURN. The procedure throws
    `NOT_FOUND` rather than answering nothing, so this road should be
    unreachable — but the old code's silent `return` lived at exactly this test,
    and a road that cannot be reached is not a road that may stay silent.
  */
  if (data === null || data === undefined) {
    logFailure("account.exportData", new Error("export answered with no data"));
    onFailure(EXPORT_FALLBACK_FAILURE);
    return;
  }

  const now = deps.now ? deps.now() : new Date();
  download({ name: exportFileName(now), json: JSON.stringify(data, null, 2) });
  onSuccess(EXPORT_SUCCESS);
}
