import { describe, expect, it } from "vitest";

import { keepScan, serveKeptScan, type KeptScanShape } from "./keptFaceScan";
import type { FeatureSlot } from "./recipeAssembler";
import type { PanelBox } from "./facePanel";

/**
 * KEEPING A SCAN, DRIVEN DIRECTLY.
 *
 * Every dependency is injected, so nothing here needs a database, a bucket or a
 * segmenter — and, more to the point, nothing here is proved THROUGH a scan.
 * A store whose only exercise runs behind fourteen model calls is a store
 * nobody has tested: this program has paid for that shape twice (the segment
 * store shipped inert; the reference library's guard was proved only through
 * the thing that used it).
 */
const box = (x: number): PanelBox => ({ x, y: 20, width: 30, height: 40, frame: { width: 1000, height: 1500 } });

/** A one-pixel PNG, base64'd exactly as the panel carries a stencil. */
const STENCIL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const dataUrl = `data:image/png;base64,${STENCIL.toString("base64")}`;

const shape = (slots: readonly FeatureSlot[]): KeptScanShape => ({
  slots: new Map(slots.map((slot, at) => [slot, { box: box(10 * at), maskUrl: dataUrl }])),
  words: new Map([["skin" as FeatureSlot, ["a warm even tan"]]]),
  asked: 12,
  empty: ["horn"],
  stencilBytes: 8360,
  sides: "eye:LR brow:LR ear:LR horns:-- earring:--",
});

/** A bucket and a table, in memory, recording the order they were used in. */
function bench() {
  const objects = new Map<string, Buffer>();
  const manifested: string[][] = [];
  const manifestIds: string[] = [];
  const rows: any[] = [];
  const journal: string[] = [];
  /** Manifests nothing has discharged — what the cleanup worker will collect. */
  const held = new Map<string, string[]>();
  /**
   * THE WORKER, in one line: it deletes every object an undischarged manifest
   * still names, once that manifest's hold has lapsed.
   *
   * A model rather than the real sweep, and a faithful one on the only axis
   * that matters here — a manifest that nobody released is a promise to delete,
   * and the worker keeps it. Production's own record: three batches born
   * seconds after three scans on 2026-08-19, every one `succeeded` about six
   * minutes later.
   */
  const sweep = () => {
    let deleted = 0;
    for (const keys of held.values()) {
      for (const key of keys) if (objects.delete(key)) deleted += 1;
    }
    held.clear();
    return deleted;
  };
  return {
    objects,
    manifested,
    manifestIds,
    rows,
    journal,
    held,
    sweep,
    dependencies: {
      store: async (one: { key: string; bytes: Buffer }) => {
        journal.push(`store:${one.key}`);
        objects.set(one.key, one.bytes);
      },
      manifest: async (one: { id: string; storageKeys: readonly string[] }) => {
        journal.push("manifest");
        manifested.push([...one.storageKeys]);
        /* The RECEIPT's own id, kept — the row must carry it back or the worker
           collects the stencils this reading depends on. */
        manifestIds.push(one.id);
        held.set(one.id, [...one.storageKeys]);
      },
      /*
        THE ROW'S WRITE, INCLUDING THE HALF THIS BENCH USED TO LEAVE OUT.

        `keepFaceScan` discharges the manifest inside the transaction that files
        the row. A double that only recorded the row modelled a database and not
        the CONTRACT, which is why the full cycle below could not be written
        against the old bench and the defect it would have caught shipped.
      */
      write: async (row: any) => {
        journal.push("write");
        rows.push(row);
        if (row.cleanupBatchId) held.delete(row.cleanupBatchId);
      },
      read: async () => rows.at(-1) ?? null,
      readBytes: async (key: string) => {
        const bytes = objects.get(key);
        return bytes ? { bytes, contentType: "image/png" } : (null as never);
      },
    },
  };
}

describe("what a kept scan writes", () => {
  it("registers every stencil for cleanup BEFORE writing a single one", async () => {
    const it_ = bench();
    const kept = await keepScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      scan: shape(["eye@left", "hair"] as FeatureSlot[]),
      dependencies: it_.dependencies,
    });

    expect(kept).toEqual({ kept: true, objects: 2 });
    /*
      THE ORDER IS THE ASSERTION. A crash between the object write and the row
      insert leaves stencils nothing points at, and the sweep only finds what a
      row names — so the manifest has to exist before the bytes do. Asserting
      "both happened" would pass on the broken order.
    */
    expect(it_.journal[0]).toBe("manifest");
    expect(it_.journal.filter((step) => step.startsWith("store:"))).toHaveLength(2);
    expect(it_.journal.at(-1)).toBe("write");
    expect(it_.manifested[0]).toEqual(Array.from(it_.objects.keys()));
  });

  it("CARRIES THE RECEIPT TO THE ROW, so the worker cannot collect what the row needs", async () => {
    /*
      THE ASSERTION THIS SUITE DID NOT HAVE, and its absence cost the table its
      whole purpose for days.

      The manifest above is a promise to DELETE these objects unless something
      claims them. `keepScan` made that promise, wrote the bytes, wrote the row
      — and handed the row no batch id, so nothing ever claimed it. The hold
      lapsed at five minutes, the sweep ran within sixty seconds, and the worker
      deleted the stencils the scan had just paid ten cents for. The row
      survived pointing at objects that no longer existed, `serveKeptScan` fell
      through its one branch that logs nothing, and every subsequent look at
      that face re-bought the whole scan.

      Measured on production 2026-08-19: three faces re-scanned at 01:16, 01:17
      and 01:20 while holding matching kept rows, each with a cleanup batch born
      seconds after and `succeeded` about six minutes later.

      The old suite passed throughout, because it asserted that a manifest
      HAPPENED and never that anything discharged it. This asserts the wire: the
      id that went to the manifest is the id that reaches the row.
    */
    const it_ = bench();
    await keepScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      scan: shape(["eye@left", "hair"] as FeatureSlot[]),
      dependencies: it_.dependencies,
    });

    expect(it_.manifestIds).toHaveLength(1);
    expect(it_.rows[0].cleanupBatchId).toBe(it_.manifestIds[0]);
  });

  it("makes no promise it needs to keep when it stores nothing", async () => {
    /*
      The control on the line above, and it is not decoration: a `cleanupBatchId`
      that were simply always present would satisfy the assertion whether or not
      it named a real manifest. A scan whose slots carry no storable stencil
      writes no objects, registers nothing, and must therefore hand the row no
      receipt — there is nothing to discharge, and an id for a manifest that was
      never created would make the row's write throw on the real path.
    */
    const it_ = bench();
    const kept = await keepScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      scan: { ...shape([] as FeatureSlot[]), slots: new Map() },
      dependencies: it_.dependencies,
    });

    expect(kept).toEqual({ kept: true, objects: 0 });
    expect(it_.manifestIds).toHaveLength(0);
    expect(it_.rows[0].cleanupBatchId).toBeUndefined();
  });

  it("keeps the geometry and the frame it was measured on, never the bytes", async () => {
    const it_ = bench();
    await keepScan({
      userId: 1, candidateId: 41, variantId: 12, frameKey: "faces/v1.png",
      scan: shape(["eye@left"] as FeatureSlot[]),
      dependencies: it_.dependencies,
    });

    const row = it_.rows[0];
    const stored = JSON.stringify(row.geometry);
    /* The founder's storage condition, at the row: a stencil in here is 10× the
       row and 4.7 GB of MySQL at ten thousand users. */
    expect(stored).not.toContain("base64");
    expect(row.geometry.slots[0].maskKey).toMatch(/^casting-v2\/scans\/[0-9a-f-]{36}\.png$/);
    /* A box without its frame is a rectangle in an unknown space. */
    expect(row.geometry.slots[0].box.frame).toEqual({ width: 1000, height: 1500 });
    expect(row.frameKey).toBe("faces/v1.png");
    expect(row.stencilBytes).toBe(8360);
  });

  it("never lets its own failure reach the customer", async () => {
    /* She already has her panel. A row is bookkeeping, and bookkeeping may not
       break a courtesy read — the next look simply pays again. */
    const it_ = bench();
    const kept = await keepScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      scan: shape(["eye@left"] as FeatureSlot[]),
      dependencies: {
        ...it_.dependencies,
        store: async () => { throw new Error("R2 said no"); },
      },
    });
    expect(kept).toEqual({ kept: false, objects: 0 });
    expect(it_.rows, "and no row claims objects that were never written").toHaveLength(0);
  });
});

describe("what a kept scan serves", () => {
  const face = { userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png" };

  it("hands back the same boxes and stencils it was given", async () => {
    const it_ = bench();
    await keepScan({ ...face, scan: shape(["eye@left", "hair"] as FeatureSlot[]), dependencies: it_.dependencies });

    const served = await serveKeptScan({ ...face, dependencies: it_.dependencies });

    expect(served?.slots.size).toBe(2);
    expect(served?.slots.get("eye@left" as FeatureSlot)?.maskUrl).toBe(dataUrl);
    expect(served?.slots.get("eye@left" as FeatureSlot)?.box).toEqual(box(0));
    expect(served?.words.get("skin" as FeatureSlot)).toEqual(["a warm even tan"]);
    expect(served?.asked).toBe(12);
    expect(served?.empty).toEqual(["horn"]);
    expect(served?.sides).toBe("eye:LR brow:LR ear:LR horns:-- earring:--");
  });

  it("REFUSES a reading taken from a frame that has since moved", async () => {
    /*
      The version now points at different bytes, so the kept reading is a
      reading of a picture that is no longer on screen. Serving it would draw
      last week's ear on this week's face — the reference-whose-bytes-moved
      door, on a new road.
    */
    const it_ = bench();
    await keepScan({ ...face, scan: shape(["eye@left"] as FeatureSlot[]), dependencies: it_.dependencies });

    expect(await serveKeptScan({ ...face, frameKey: "faces/v2.png", dependencies: it_.dependencies })).toBeNull();
  });

  it("CONTROL — the same call on the same frame does serve", async () => {
    /* The negative control for the arm above: if this also returned null, the
       refusal would be a constant and would prove nothing about frameKey. */
    const it_ = bench();
    await keepScan({ ...face, scan: shape(["eye@left"] as FeatureSlot[]), dependencies: it_.dependencies });
    expect(await serveKeptScan({ ...face, dependencies: it_.dependencies })).not.toBeNull();
  });

  it("condemns the whole reading when one stencil will not fetch", async () => {
    /* A panel with a hole in it is the founder's own complaint arriving by a
       new road — better to re-scan than to draw a face missing an ear. */
    const it_ = bench();
    await keepScan({ ...face, scan: shape(["eye@left", "hair"] as FeatureSlot[]), dependencies: it_.dependencies });
    it_.objects.delete(Array.from(it_.objects.keys())[1]!);

    expect(await serveKeptScan({ ...face, dependencies: it_.dependencies })).toBeNull();
  });

  it("says SCAN THIS FACE when there is no row at all", async () => {
    const it_ = bench();
    expect(await serveKeptScan({ ...face, dependencies: it_.dependencies })).toBeNull();
  });

  it("says SCAN THIS FACE when the database will not answer", async () => {
    const it_ = bench();
    const served = await serveKeptScan({
      ...face,
      dependencies: { ...it_.dependencies, read: async () => { throw new Error("the database said no"); } },
    });
    expect(served, "one outcome, because every cause has the same right answer").toBeNull();
  });
});

describe("the full cycle — a kept scan survives the cleanup worker", () => {
  /*
    THE TEST THAT WOULD HAVE CAUGHT IT AT BIRTH, and did not exist.

    Every piece of this road had a green test. `keepScan` was proved to register
    a manifest before storing bytes; `serveKeptScan` was proved to serve a kept
    reading, to refuse a moved frame, and to condemn a reading with a missing
    stencil. Not one of them ran the WORKER, so nothing ever asked the only
    question that mattered: is the reading still there ten minutes later?

    It was not. `keepScan` registered its stencils for deletion and handed the
    row no receipt, so the hold lapsed at five minutes, the sweep ran within
    sixty seconds, and the worker deleted the stencils the scan had just paid
    ten cents for. The row survived pointing at nothing, `serveKeptScan` fell
    through its one silent branch, and every look at that face re-bought the
    whole scan — for as long as the flag was on.

    Production, 2026-08-19: candidates 1641, 1642 and 1644 re-scanned at 01:16,
    01:17 and 01:20 while each held a kept row whose frame still matched, with a
    cleanup batch born seconds after each scan and `succeeded` about six minutes
    later. Seventeen kept rows, and the table had never answered once.
  */
  const face = { userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png" };

  it("STILL SERVES after the worker has run", async () => {
    const it_ = bench();
    await keepScan({ ...face, scan: shape(["eye@left", "hair"] as FeatureSlot[]), dependencies: it_.dependencies });

    /* Before the sweep it serves — which is what the old suite proved, and what
       made the defect invisible. */
    expect(await serveKeptScan({ ...face, dependencies: it_.dependencies })).not.toBeNull();

    const deleted = it_.sweep();

    expect(deleted, "the worker must have had nothing left to collect").toBe(0);
    expect(it_.objects.size).toBe(2);
    const served = await serveKeptScan({ ...face, dependencies: it_.dependencies });
    expect(served, "the reading this face paid for must outlive the sweep").not.toBeNull();
    expect(served!.slots.size).toBe(2);
  });

  it("shows the worker CAN delete — the control, on a manifest nothing discharged", async () => {
    /*
      Without this the test above passes against a sweep that does nothing, and
      a bench whose worker cannot delete proves exactly as much as a checker
      that cannot fail. Same bench, same objects, one manifest left held by hand
      — the state `keepScan` used to leave behind on every single scan.
    */
    const it_ = bench();
    await keepScan({ ...face, scan: shape(["eye@left", "hair"] as FeatureSlot[]), dependencies: it_.dependencies });

    it_.held.set("a-manifest-nobody-released", Array.from(it_.objects.keys()));
    const deleted = it_.sweep();

    expect(deleted).toBe(2);
    expect(it_.objects.size).toBe(0);
    expect(
      await serveKeptScan({ ...face, dependencies: it_.dependencies }),
      "and this is exactly what the panel saw on every look",
    ).toBeNull();
  });

  it("hands the REPLACED reading's stencils to the worker, so an upsert does not orphan them", async () => {
    /*
      The same rule pointing the other way, and the half that only exists
      because discharging the manifest created it. An upsert replaces the row,
      and the candidate purge only ever reads the CURRENT row's geometry — so
      the previous reading's objects would be referenced by nothing and
      collected by nothing, forever.

      Driven at the seam this bench owns: `keepFaceScan` is the real writer and
      registers those keys itself, so what is asserted here is that a second
      keep leaves the FIRST reading's objects claimable and the second's not.
    */
    const it_ = bench();
    await keepScan({ ...face, scan: shape(["eye@left", "hair"] as FeatureSlot[]), dependencies: it_.dependencies });
    const first = Array.from(it_.objects.keys());

    await keepScan({ ...face, scan: shape(["eye@left", "hair"] as FeatureSlot[]), dependencies: it_.dependencies });
    const second = Array.from(it_.objects.keys()).filter((key) => !first.includes(key));

    expect(second, "a re-scan writes new objects under new keys").toHaveLength(2);
    /* The real `keepFaceScan` registers `first` on a fresh manifest inside the
       row's transaction; this bench's `write` double does not model that, so
       the assertion here is the one it CAN make honestly — the new reading's
       receipt was discharged, and the old objects are the ones left over. */
    expect(it_.held.size, "no receipt for the new stencils may be left held").toBe(0);
    expect(it_.rows.at(-1).cleanupBatchId).toBe(it_.manifestIds.at(-1));
  });
});
