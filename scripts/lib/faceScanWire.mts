/**
 * WHAT A BROWSER WALK BUYS WHEN IT OPENS A SHEET — counted at the wire, and
 * optionally HELD there (fable-694 §2).
 *
 * # The blind spot this exists for
 *
 * Opening a casting sheet fires `castingV2.faceScan`, and a scan is ~20
 * segmenter reads plus one describer call per (candidate, version) per server
 * process. **It mints nothing** — no row, no object, no manifest — which is the
 * design (CLAUDE.md, `CASTING_FACE_SCAN_SCOPE`) and is exactly why no
 * instrument in this campaign could see it: the ledger counts credits, the
 * census counts what a refine persists, and a scan writes neither. Every
 * "zero house money" a shift has ever parked was made in good faith and blind,
 * including the one that found this.
 *
 * So the harness declares it. Two halves, deliberately separate:
 *
 *   THE METER  is passive and always on. It listens to requests, never touches
 *              them, and costs a walk nothing — no interception, no cache
 *              change, no timing change. A drive that opens no sheet prints
 *              nothing at all.
 *   THE HOLD   is opt-in (`holdFaceScan`). It ABORTS the ask at the browser
 *              wire, so nothing reaches the server and nothing is spent. The
 *              panel then shows what the library alone knows — the same picture
 *              an account outside the scan's scope sees, reached by a different
 *              route (a failed request rather than a dark payload).
 *
 * # Why abort rather than a fabricated answer
 *
 * A synthetic "scan is off" payload would be a second copy of the server's dark
 * branch living in the harness, and the two would drift the first time that
 * shape changed (law 4). An abort claims nothing about what the server would
 * have said. It says only what is true: **the ask never left the browser.**
 *
 * # The one case a hold must NOT take
 *
 * tRPC batches queries fired in the same tick into ONE HTTP request, and
 * aborting a batch aborts every member of it — `getRoll` and the photograph
 * with it. So a batch carrying a face scan BESIDE other procedures is left
 * alone and recorded as a LEAK, loudly, with its members named. A hold that
 * quietly broke the sheet it was measuring would be worse than no hold; a hold
 * that quietly let the spend through would be worse still, which is why the
 * leak is a line in the report and not a debug log.
 *
 * (In practice the scan fires alone: `CastingSheet` only enables it once
 * `facePanel` has answered `scanning: true`, which is a later tick than the
 * batch that carried `facePanel`.)
 */
import { FACE_SCAN_READS_PER_VERSION, FAL_MEASURED_USD } from "./falSpend.mts";

/** The tRPC procedure that spends. `facePanel` beside it is free and is not
 *  counted — it reads what is already in memory and never asks a provider. */
export const FACE_SCAN_PROCEDURE = "castingV2.faceScan";

/** One (candidate, version) the browser asked to have read. */
export type ScanAsk = { candidateId: string; variantId: string | null };

/**
 * What a single outgoing request is, as far as the scan is concerned.
 *
 * `mixed` is its own kind rather than a flag because it is the one shape the
 * hold cannot act on, and a boolean would let a caller forget to look at it.
 */
export type WireAsk =
  | { kind: "none" }
  | { kind: "scanOnly"; asks: ScanAsk[] }
  | { kind: "mixed"; asks: ScanAsk[]; beside: string[] };

const NONE: WireAsk = { kind: "none" };

/**
 * superjson wraps every payload as `{ json: … }`; a bare object is accepted too
 * so this reader does not depend on the transformer staying chosen.
 */
function unwrap(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const inner = record.json;
  if (inner !== undefined && inner !== null && typeof inner === "object") {
    return inner as Record<string, unknown>;
  }
  return record;
}

function askOf(input: unknown): ScanAsk | null {
  const payload = unwrap(input);
  if (payload === null) return null;
  const candidateId = payload.candidateId;
  if (typeof candidateId !== "string" || candidateId === "") return null;
  const variantId = payload.variantId;
  return { candidateId, variantId: typeof variantId === "string" ? variantId : null };
}

/**
 * Read one outgoing request.
 *
 * `body` is the POST payload when there is one. Queries go out as GET with the
 * inputs in the query string, which is what the batch link does today — the
 * body is read anyway so that a link configured with `methodOverride` would not
 * silently stop being counted.
 */
export function readFaceScanAsk(url: string, body?: string | null): WireAsk {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NONE;
  }
  const marker = "/api/trpc/";
  const at = parsed.pathname.indexOf(marker);
  if (at === -1) return NONE;
  const procedures = decodeURIComponent(parsed.pathname.slice(at + marker.length))
    .split(",")
    .map((one) => one.trim())
    .filter((one) => one !== "");
  if (procedures.length === 0) return NONE;
  const scanAt = procedures
    .map((procedure, index) => ({ procedure, index }))
    .filter((one) => one.procedure === FACE_SCAN_PROCEDURE);
  if (scanAt.length === 0) return NONE;

  const batched = parsed.searchParams.get("batch") === "1";
  const raw = parsed.searchParams.get("input") ?? body ?? null;
  let inputs: unknown = null;
  if (raw !== null) {
    try {
      inputs = JSON.parse(raw);
    } catch {
      inputs = null;
    }
  }

  const asks: ScanAsk[] = [];
  for (const one of scanAt) {
    /*
      A BATCH KEYS ITS INPUTS BY POSITION, a lone query does not. Reading the
      lone shape as a batch would silently find no input and report an ask with
      no version — which is the shape of a walk that bought a scan and could not
      say which face it was for.
    */
    const slot = batched
      ? (inputs as Record<string, unknown> | null)?.[String(one.index)]
      : inputs;
    const ask = askOf(slot);
    if (ask !== null) asks.push(ask);
  }

  const beside = procedures.filter((procedure) => procedure !== FACE_SCAN_PROCEDURE);
  return beside.length === 0
    ? { kind: "scanOnly", asks }
    : { kind: "mixed", asks, beside };
}

/** fal's price for one segmentation question, from the one table that holds it. */
const USD_PER_READ = FAL_MEASURED_USD["fal-ai/sam-3/image"]?.usd ?? 0;

export type FaceScanMeter = {
  /** Record one request. `held` is true when the harness aborted it. */
  saw: (ask: WireAsk, held: boolean) => void;
  /** Every scan request seen at the wire, retries and polls included. */
  asks: () => number;
  /** Requests the hold aborted — money that was never spent. */
  held: () => number;
  /** Batches that carried a scan beside other procedures and were let through. */
  leaks: () => Array<{ beside: string[]; asks: ScanAsk[] }>;
  /** (candidate, version) pairs whose ask reached the server. */
  delivered: () => string[];
  /** The line a walk prints. `null` when the walk opened no sheet. */
  line: () => string | null;
};

const keyOf = (ask: ScanAsk): string => `${ask.candidateId}@${ask.variantId ?? "master"}`;

/**
 * The walk's own declaration of what it bought.
 *
 * The money figure is a **CEILING and says so**: the server pays once per
 * (candidate, version) per process lifetime, so a version another walk already
 * read in the same server process cost this walk nothing. It can also be
 * exceeded in one direction — a reading that comes back damaged is deliberately
 * not kept (`faceScanService`), so that version is re-read on the next look.
 * Both are named rather than rounded away.
 */
export function createFaceScanMeter(): FaceScanMeter {
  let asks = 0;
  let held = 0;
  const leaks: Array<{ beside: string[]; asks: ScanAsk[] }> = [];
  const askedVersions = new Set<string>();
  const deliveredVersions = new Set<string>();

  return {
    saw: (ask, wasHeld) => {
      if (ask.kind === "none") return;
      asks += 1;
      if (wasHeld) held += 1;
      if (ask.kind === "mixed") leaks.push({ beside: ask.beside, asks: ask.asks });
      for (const one of ask.asks) {
        askedVersions.add(keyOf(one));
        if (!wasHeld) deliveredVersions.add(keyOf(one));
      }
    },
    asks: () => asks,
    held: () => held,
    leaks: () => leaks,
    delivered: () => [...deliveredVersions],
    line: () => {
      if (asks === 0) return null;
      const reads = deliveredVersions.size * FACE_SCAN_READS_PER_VERSION;
      const usd = reads * USD_PER_READ;
      const lines = [
        `face scan  ${asks} ask(s) at the wire · ${askedVersions.size} version(s) asked about`
        + ` · ${deliveredVersions.size} reached the server`,
        `           HOUSE MONEY ≤ $${usd.toFixed(3)} — ${reads} segmenter reads`
        + ` (${FACE_SCAN_READS_PER_VERSION}/version at $${USD_PER_READ})`
        + ` plus ${deliveredVersions.size} describer call(s), UNPRICED`,
        "           a CEILING: the server reads a (candidate, version) once per process,"
        + " so a version already warm cost this walk nothing",
      ];
      if (held > 0) {
        lines.push(
          `           HELD: ${held} ask(s) aborted at the browser wire — they never left it`,
        );
      }
      for (const leak of leaks) {
        lines.push(
          `           *** LEAK: a scan rode a batch with ${leak.beside.join(", ")} and was let`
          + " through — aborting it would have aborted them ***",
        );
      }
      return lines.join("\n");
    },
  };
}
