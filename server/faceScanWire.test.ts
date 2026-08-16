/**
 * THE FACE-SCAN WIRE HOLD — the reader, and the one batch it must never touch.
 *
 * A browser walk that opens a casting sheet buys ~20 segmenter reads of house
 * money and, until fable-694, declared nothing: the scan mints no row, so the
 * ledger, the census and every park block were blind to it by design. The
 * harness now counts the ask at the wire and can abort it there.
 *
 * Two things can go wrong, and they fail in opposite directions:
 *
 *   TOO LITTLE  a reader that does not recognise the ask lets the spend through
 *               while printing "held", which is the false pass with a dollar
 *               sign on it.
 *   TOO MUCH    a hold that aborts a BATCH takes `getRoll` and the photograph
 *               with it — the sheet breaks and the walk measures a broken sheet.
 *
 * So the reader is driven on the string the browser really sent (captured with
 * the hold ON, so the pin itself cost nothing), on the batch shape that must be
 * left alone, and on the near misses that must read as nothing at all.
 */
import { describe, expect, it } from "vitest";

import {
  createFaceScanMeter,
  readFaceScanAsk,
  FACE_SCAN_PROCEDURE,
} from "../scripts/lib/faceScanWire.mts";
import { FACE_SCAN_READS_PER_VERSION, FAL_MEASURED_USD } from "../scripts/lib/falSpend.mts";

/**
 * CAPTURED, NOT COMPOSED — `drive-facescan-hold-disposable.mts` against the dev
 * server on 2026-08-16, candidate 372's sheet. A URL this suite rebuilt from
 * what it believes tRPC does would pass while the product sent something else,
 * which is the harness-supplied-argument trap on a query string.
 */
const REAL_ASK =
  "http://localhost:3000/api/trpc/castingV2.faceScan?batch=1&input=%7B%220%22%3A%7B%22json"
  + "%22%3A%7B%22candidateId%22%3A%227cb9c7a4-7954-4106-8b20-61f7ca4de292%22%2C%22variantId"
  + "%22%3Anull%7D%7D%7D";

/** The shape the hold must refuse to abort: a scan riding with the sheet. */
const MIXED_BATCH =
  "http://localhost:3000/api/trpc/castingV2.getRoll,castingV2.faceScan?batch=1&input="
  + encodeURIComponent(JSON.stringify({
    0: { json: { sessionId: "a-session" } },
    1: { json: { candidateId: "cand-2", variantId: "v-9" } },
  }));

describe("what the reader sees at the wire", () => {
  it("reads the real ask the browser sent, down to the version", () => {
    const ask = readFaceScanAsk(REAL_ASK);
    expect(ask.kind).toBe("scanOnly");
    expect(ask.kind === "scanOnly" && ask.asks).toEqual([
      { candidateId: "7cb9c7a4-7954-4106-8b20-61f7ca4de292", variantId: null },
    ]);
  });

  it("reads a selected version rather than flattening it to the master", () => {
    const url = `http://localhost:3000/api/trpc/${FACE_SCAN_PROCEDURE}?batch=1&input=`
      + encodeURIComponent(JSON.stringify({ 0: { json: { candidateId: "cand-1", variantId: "v-7" } } }));
    expect(readFaceScanAsk(url)).toEqual({
      kind: "scanOnly",
      asks: [{ candidateId: "cand-1", variantId: "v-7" }],
    });
  });

  it("reads a lone, unbatched query — a different input shape entirely", () => {
    const url = `http://localhost:3000/api/trpc/${FACE_SCAN_PROCEDURE}?input=`
      + encodeURIComponent(JSON.stringify({ json: { candidateId: "cand-3", variantId: null } }));
    expect(readFaceScanAsk(url)).toEqual({
      kind: "scanOnly",
      asks: [{ candidateId: "cand-3", variantId: null }],
    });
  });

  it("takes the input at the scan's OWN position in a batch", () => {
    const ask = readFaceScanAsk(MIXED_BATCH);
    expect(ask.kind).toBe("mixed");
    /* Position 1, not position 0 — a reader that took the first input would
       report the roll's session id as a candidate and be wrong about which
       face was read. */
    expect(ask.kind === "mixed" && ask.asks).toEqual([{ candidateId: "cand-2", variantId: "v-9" }]);
    expect(ask.kind === "mixed" && ask.beside).toEqual(["castingV2.getRoll"]);
  });

  /* THE NEGATIVE HALF. A reader that says "scan" to everything would hold the
     whole app and report a walk as free because nothing ever loaded. */
  it.each([
    ["a picture", "https://pub-something.r2.dev/casting/candidate-1.png"],
    ["the free panel read", "http://localhost:3000/api/trpc/castingV2.facePanel?batch=1&input=%7B%7D"],
    ["a different namespace", "http://localhost:3000/api/trpc/billing.getPlans?batch=1&input=%7B%7D"],
    ["a procedure that merely starts the same way", "http://localhost:3000/api/trpc/castingV2.faceScanned?batch=1"],
    ["not a URL at all", "data:image/png;base64,AAAA"],
  ])("says nothing about %s", (_what, url) => {
    expect(readFaceScanAsk(url).kind).toBe("none");
  });

  it("still reports the ask when the input will not parse", () => {
    /* The money is spent by the REQUEST, not by our ability to read its input.
       A walk whose input we cannot decode has still bought the scan, so this
       counts the ask and declines to name a version rather than returning
       `none` and printing a free walk. */
    const ask = readFaceScanAsk(`http://localhost:3000/api/trpc/${FACE_SCAN_PROCEDURE}?batch=1&input=%7Bnot-json`);
    expect(ask).toEqual({ kind: "scanOnly", asks: [] });
  });
});

describe("what the walk declares", () => {
  it("prints nothing at all when no sheet was opened", () => {
    const meter = createFaceScanMeter();
    meter.saw(readFaceScanAsk("https://pub-something.r2.dev/a.png"), false);
    expect(meter.line()).toBeNull();
    expect(meter.asks()).toBe(0);
  });

  it("prices what reached the server, and nothing else", () => {
    const meter = createFaceScanMeter();
    const delivered = readFaceScanAsk(REAL_ASK);
    meter.saw(delivered, false);
    /* The same version asked about twice — the client polls while a scan is
       still filling — is ONE read on the server, so it must not be priced
       twice. This is the difference between $0.10 and a walk that reports
       dollars it never spent. */
    meter.saw(delivered, false);
    const second = readFaceScanAsk(
      `http://localhost:3000/api/trpc/${FACE_SCAN_PROCEDURE}?batch=1&input=`
      + encodeURIComponent(JSON.stringify({ 0: { json: { candidateId: "cand-9", variantId: "v-1" } } })),
    );
    meter.saw(second, false);

    const usd = 2 * FACE_SCAN_READS_PER_VERSION * FAL_MEASURED_USD["fal-ai/sam-3/image"].usd;
    expect(usd).toBeCloseTo(0.2, 5);
    expect(meter.asks()).toBe(3);
    expect(meter.delivered()).toHaveLength(2);
    expect(meter.line()).toContain(`$${usd.toFixed(3)}`);
    expect(meter.line()).toContain("2 reached the server");
  });

  it("prices a held walk at zero and says the asks were held", () => {
    const meter = createFaceScanMeter();
    meter.saw(readFaceScanAsk(REAL_ASK), true);
    meter.saw(readFaceScanAsk(REAL_ASK), true);
    expect(meter.held()).toBe(2);
    expect(meter.delivered()).toEqual([]);
    expect(meter.line()).toContain("$0.000");
    expect(meter.line()).toContain("HELD: 2 ask(s)");
  });

  /*
    THE LEAK IS LOUD, and it is the one case the hold cannot act on. A batch
    carrying the scan beside other procedures is let through — aborting it would
    abort them — so the walk must SAY the money went, not quietly report a hold
    that did not happen.
  */
  it("shouts when a scan rode a batch and was let through", () => {
    const meter = createFaceScanMeter();
    meter.saw(readFaceScanAsk(MIXED_BATCH), false);
    expect(meter.leaks()).toHaveLength(1);
    expect(meter.line()).toContain("*** LEAK");
    expect(meter.line()).toContain("castingV2.getRoll");
    /* And it is PRICED, because it really was bought. */
    expect(meter.line()).toContain("$0.100");
  });

  it("keeps the per-version figure and its price in one place", () => {
    /* Both halves of "$0.10 a look" come from named constants; a suite that
       retyped either would agree with itself while the report drifted. */
    expect(FACE_SCAN_READS_PER_VERSION).toBe(20);
    expect(FAL_MEASURED_USD["fal-ai/sam-3/image"].usd).toBe(0.005);
  });
});
