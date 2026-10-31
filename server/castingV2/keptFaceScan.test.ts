import { describe, expect, it } from "vitest";

import { FACE_CUT_RULES_VERSION } from "../db/castingV2FaceScans";
import type { FeatureKind } from "./faceDiscovery";

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

  it("⚠ REFUSES a CARRIED-ONLY row — it is a render's geometry, not a reading", async () => {
    /*
      THE TRAP THE `scanned` FIELD EXISTS TO CLOSE (fable-1445 §2).

      Since the render started filing carried geometry into this same table, a
      row can exist for a version nothing has ever scanned. Its `slots` list is
      EMPTY, so served as a reading it says *this face was scanned and has
      nothing on it* — no cutouts, no described words — and, because the panel
      would then believe the scan had landed, the face would never be scanned
      again. One field, read at the only door that turns a row into a reading.
    */
    const it_ = bench();
    it_.rows.push({
      publicId: "carried-only",
      frameKey: face.frameKey,
      geometry: { slots: [], words: [], sides: "", asked: 0, found: 0, empty: [], scanned: false,
        carried: [{ slot: "hair", box: box(5) }] },
      stencilBytes: 0,
    });

    expect(await serveKeptScan({ ...face, dependencies: it_.dependencies })).toBeNull();
  });

  it("CONTROL — the same row with `scanned` absent DOES serve", async () => {
    /*
      The negative control, and it is the one that matters on this field: every
      row written before `scanned` existed is a scan, so absent must mean true.
      A guard reading `!geometry.scanned` would blank the whole production
      table and re-buy every face at ten cents.
    */
    const it_ = bench();
    it_.rows.push({
      publicId: "written-before-the-field",
      frameKey: face.frameKey,
      /* `rules` current, because `scanned` is this arm's subject and nothing
         else (#2890) — a row below the cut-rules version is condemned one line
         later, and a fixture without it would make this control pass for the
         wrong reason, or rather fail for one. */
      geometry: {
        slots: [], words: [["skin", ["a warm even tan"]]], sides: "", asked: 12, found: 0, empty: [],
        rules: FACE_CUT_RULES_VERSION,
      },
      stencilBytes: 0,
    });

    const served = await serveKeptScan({ ...face, dependencies: it_.dependencies });
    expect(served).not.toBeNull();
    expect(served?.asked).toBe(12);
  });

  /*
    A READING TAKEN UNDER OLDER CUT RULES IS TAKEN AGAIN (#2890).

    The measured instance: seven of the 86 kept readings on production were
    serving an eye cut below the middle of the frame — one of them a 392×772 box
    called *Left eye*, running from the eye down to a tattooed face on the cast's
    arm — and every one of the seven was written before the rule that drops that
    piece was authored. All seven were still alive, still on their original frame
    and therefore still SERVED, two of them on signed casts: the repair had
    shipped and could not reach a single face already read.

    The three arms are the condemnation, the control that a CURRENT row serves
    (without which the refusal would be a constant and prove nothing), and the
    one that matters most — that the condemnation is read as a NUMBER and not as
    truthiness, since a `0` written by anything would otherwise read as present.
  */
  const rulesRow = (rules: number | undefined) => ({
    publicId: `rules-${rules ?? "absent"}`,
    frameKey: face.frameKey,
    geometry: {
      slots: [], words: [["skin", ["a warm even tan"]]], sides: "", asked: 12, found: 0, empty: [],
      ...(rules === undefined ? {} : { rules }),
    },
    stencilBytes: 0,
  });

  it("⚠ CONDEMNS a reading with NO cut-rules version — it was taken before they were versioned", async () => {
    const it_ = bench();
    it_.rows.push(rulesRow(undefined));

    expect(await serveKeptScan({ ...face, dependencies: it_.dependencies })).toBeNull();
  });

  it("CONTROL — a reading AT the current cut-rules version serves", async () => {
    /* The negative control for the arm above. Without it the condemnation could
       be refusing every row for some other reason entirely, which is how a
       guard comes to be celebrated for rejecting everything. */
    const it_ = bench();
    it_.rows.push(rulesRow(FACE_CUT_RULES_VERSION));

    const served = await serveKeptScan({ ...face, dependencies: it_.dependencies });
    expect(served).not.toBeNull();
    expect(served?.asked).toBe(12);
  });

  it("⚠ condemns a version BELOW the current one, read as a number rather than as present-or-absent", async () => {
    /*
      The column is JSON, so the value is whatever was written. `0` is the trap:
      a check asking whether the field is there at all would serve a row that
      says in so many words that it met version zero of the rules.
    */
    const it_ = bench();
    it_.rows.push(rulesRow(0));

    expect(await serveKeptScan({ ...face, dependencies: it_.dependencies })).toBeNull();
  });

  it("writes the current cut-rules version on every scan it keeps", async () => {
    /*
      ASSERTED ON THE ROW THAT GOES TO THE DATABASE, not on a constant beside it
      (invariant 5's shape): the field is what makes a reading taken today
      distinguishable from one taken under older rules, so a scan that filed it
      absent would condemn itself the moment it was next looked at — and would
      do so silently, re-buying every face for ever.
    */
    const it_ = bench();
    await keepScan({ ...face, scan: shape(["eye@left"] as FeatureSlot[]), dependencies: it_.dependencies });

    expect(it_.rows.at(-1)?.geometry.rules).toBe(FACE_CUT_RULES_VERSION);
  });

  it("leaves the CARRIED-ONLY road exactly where it was — refused with a version or without one", async () => {
    /*
      THE ONE ROAD THIS CHANGE MUST NOT MOVE (#2890).

      A carried-only row has never been scanned, so it has no cut rules to be
      stale against and no reading to take again. It is refused by
      `scanned === false` one line ABOVE the version check, and it must stay
      refused whichever way the version reads — otherwise a render's geometry
      could reach the panel as a reading the moment the version was bumped,
      which is the trap that field was added to close.

      ⚠ **The ORDER of the two refusals is for the LOG and not for the answer,
      and that is said rather than pinned**: both roads return null, so a later
      edit that swapped them would change which sentence a diagnosis starts
      from and nothing a customer can see. An arm reading the log to prove it
      would be driving a message, not a behaviour.
    */
    const it_ = bench();
    const carried = (rules: number | undefined) => ({
      publicId: `carried-only-${rules ?? "absent"}`,
      frameKey: face.frameKey,
      geometry: {
        slots: [], words: [], sides: "", asked: 0, found: 0, empty: [], scanned: false,
        ...(rules === undefined ? {} : { rules }),
        carried: [{ slot: "hair", box: box(5) }],
      },
      stencilBytes: 0,
    });

    it_.rows.push(carried(undefined));
    expect(await serveKeptScan({ ...face, dependencies: it_.dependencies })).toBeNull();

    it_.rows.push(carried(FACE_CUT_RULES_VERSION));
    expect(await serveKeptScan({ ...face, dependencies: it_.dependencies })).toBeNull();
  });

  /*
    THE FOURTH `why` SURVIVES THE READ-BACK, AND A FIFTH STILL DOES NOT (#2805).

    The column is JSON, so `why` is whatever was written, and the narrowing here
    is the only thing standing between a value nobody wrote a branch for and a
    panel that branches on it. `dropped` — a name whose detector call never
    completed, told apart from a name the detector answered and could not
    usefully cut — joins the three, and the arm below is the control that the
    narrowing still refuses an unknown word rather than having been widened to
    anything at all.
  */
  /* `rules` is current on purpose and is NOT the subject here (#2890): a row
     below the version is condemned at the door, so a fixture that left it out
     would return null and these two arms would pass and fail for a reason that
     has nothing to do with `why`. The version's own arms are below. */
  const saidRow = (why: string) => ({
    publicId: `why-${why}`,
    frameKey: face.frameKey,
    geometry: {
      slots: [], words: [], sides: "", asked: 12, found: 0, empty: [],
      rules: FACE_CUT_RULES_VERSION,
      namedNotCut: [{ noun: "star tattoo", on: "cheek", about: "a small star", kind: "marking", why }],
    },
    stencilBytes: 0,
  });

  it("reads back a DROPPED entry — the record of a call that never completed", async () => {
    const it_ = bench();
    it_.rows.push(saidRow("dropped"));

    const served = await serveKeptScan({ ...face, dependencies: it_.dependencies });

    expect(served?.namedNotCut?.map((one) => [one.noun, one.why])).toEqual([["star tattoo", "dropped"]]);
  });

  it("CONTROL — a `why` nobody wrote a branch for is still dropped", async () => {
    /* Without this the arm above passes against a narrowing that admits every
       string, which would be the opposite of what that clause is for. */
    const it_ = bench();
    it_.rows.push(saidRow("fetch failed"));

    const served = await serveKeptScan({ ...face, dependencies: it_.dependencies });

    expect(served, "the reading itself still serves").not.toBeNull();
    expect(served?.namedNotCut).toBeUndefined();
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

/**
 * THE FOUND ROWS, KEPT AND HANDED BACK (#2566 slice 2).
 *
 * ⚠ **THIS IS THE ARM THE WHOLE STORAGE HALF OF THE SLICE EXISTS FOR**, and it
 * is not about tidiness. `CASTING_SCAN_TABLE_SCOPE` stands at `all`, so the
 * FIRST look at a frame is kept and every later look on the same frame is
 * served from the row. A row that held the catalogue's rows and not the pointer
 * road's would put a jacket on the panel once and never again on that version —
 * *"the same frame gave a different panel on different readings"*, which is the
 * finding PR #2570 was held on, arriving by the storage road instead of the
 * reader's.
 */
describe("the rows the reading found that nobody catalogued", () => {
  const foundRow = (
    slot: string,
    noun: string,
    instance: number,
    /* The grouping's two facts, defaulted to what a row written before #2566
       slice 2 restores as — a hostless `anatomy`, which is today's panel. An
       arm about the round trip passes its own. */
    over: { kind?: FeatureKind; on?: string; coversFace?: boolean } = {},
  ) => ({
    slot: slot as FeatureSlot,
    noun,
    instance,
    kind: over.kind ?? ("anatomy" as FeatureKind),
    on: over.on ?? "",
    box: box(instance * 100),
    maskUrl: dataUrl,
    coversFace: over.coversFace ?? false,
  });

  it("keeps them beside the catalogue's rows, in ONE manifest and ONE transaction", async () => {
    const it_ = bench();
    const kept = await keepScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      scan: {
        ...shape(["hair"] as FeatureSlot[]),
        discovered: [foundRow("discovered:jacket#1", "jacket", 1)],
      },
      dependencies: it_.dependencies,
    });

    expect(kept).toEqual({ kept: true, objects: 2 });
    /* ⚠ ONE manifest, discharged by the one row — a second manifest is a second
       promise to delete, and this file's own scar is a promise nobody kept. */
    expect(it_.manifested).toHaveLength(1);
    expect(it_.manifested[0]).toHaveLength(2);
    expect(it_.held.size).toBe(0);
    expect(it_.sweep()).toBe(0);
  });

  it("hands them back with their noun, their instance and their picture", async () => {
    const it_ = bench();
    await keepScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      scan: {
        ...shape(["hair"] as FeatureSlot[]),
        discovered: [
          foundRow("discovered:strap#1", "strap", 1),
          foundRow("discovered:strap#2", "strap", 2),
        ],
      },
      dependencies: it_.dependencies,
    });

    const served = await serveKeptScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      dependencies: it_.dependencies,
    });

    expect(served?.discovered).toHaveLength(2);
    expect(served!.discovered!.map((one) => [one.noun, one.instance, one.slot])).toEqual([
      ["strap", 1, "discovered:strap#1"],
      ["strap", 2, "discovered:strap#2"],
    ]);
    /* The picture comes back as a data URL off the stored object, exactly as a
       catalogue row's stencil does. */
    expect(served!.discovered![0]!.maskUrl.startsWith("data:image/png;base64,")).toBe(true);
    /* And the catalogue rows are untouched beside them. */
    expect(Array.from(served!.slots.keys())).toEqual(["hair"]);
  });

  it("carries whether a shape lies over the face across the keep, both ways", async () => {
    /*
      HIS CHECK 1 SURVIVES THE KEEP (#2856) — and it has to, for the reason the
      kind and the host do one arm up. `CASTING_SCAN_TABLE_SCOPE` stands at
      `all`, so the first look is kept and every later look is served from the
      row: a keep that dropped this would put a face-covering garment outside
      the whole-Outfit outline on the first look and back inside it on the
      second, which is the different-panel-same-frame defect this file exists
      against.

      ⚠ **It is a PIXEL measurement and cannot be retaken here.** The masks it
      was read from are gone by the time anything serves this row, so there is
      no recomputing it — the stored answer is the only answer.
    */
    const it_ = bench();
    await keepScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      scan: {
        ...shape(["hair"] as FeatureSlot[]),
        discovered: [
          foundRow("discovered:wrap#1", "wrap", 1, { kind: "clothing", coversFace: true }),
          foundRow("discovered:belt#2", "belt", 2, { kind: "clothing", coversFace: false }),
        ],
      },
      dependencies: it_.dependencies,
    });

    const served = await serveKeptScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      dependencies: it_.dependencies,
    });

    expect(served!.discovered!.map((one) => [one.noun, one.coversFace])).toEqual([
      ["wrap", true],
      ["belt", false],
    ]);
  });

  it("reads a row written before the check as NOT covering, which is today's panel", async () => {
    /*
      ⚠ THE ARM THAT MAKES THE FIELD FREE, and it is the same sentence the
      kind and the host carry: a row already in the table has no `coversFace`
      at all. `=== true` is the only test a JSON column cannot satisfy by
      accident, and the answer it gives is the one that changes nothing —
      inside the outline, where every outfit piece was before his check.
    */
    const it_ = bench();
    await keepScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      scan: {
        ...shape(["hair"] as FeatureSlot[]),
        discovered: [foundRow("discovered:jacket#1", "jacket", 1, { kind: "clothing" })],
      },
      dependencies: it_.dependencies,
    });
    /* The stored row is edited to the shape the table already holds — the key
       absent entirely, not `false` — because those are different bytes and only
       one of them is what a pre-#2856 row looks like. */
    delete (it_.rows[0]!.geometry.discovered[0] as { coversFace?: boolean }).coversFace;
    expect("coversFace" in it_.rows[0]!.geometry.discovered[0]!).toBe(false);

    const served = await serveKeptScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      dependencies: it_.dependencies,
    });
    expect(served!.discovered![0]!.coversFace).toBe(false);
  });

  /*
    ⚠ THE NOUN IS STORED AND NOT RECONSTRUCTED, which is the one property a
    key-derived label would silently break: `cat ears` and `cat-ears` slug the
    same, so the row has to carry the word the reading wrote.
  */
  it("brings back a noun no key could have said", async () => {
    const it_ = bench();
    await keepScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      scan: {
        ...shape(["hair"] as FeatureSlot[]),
        discovered: [foundRow("discovered:cat-ears#1", "cat ears", 1)],
      },
      dependencies: it_.dependencies,
    });

    const served = await serveKeptScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      dependencies: it_.dependencies,
    });
    expect(served!.discovered![0]!.noun).toBe("cat ears");
  });

  it("writes NO field at all when the reading found none — the row is what it was before", async () => {
    const it_ = bench();
    await keepScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      scan: shape(["hair"] as FeatureSlot[]),
      dependencies: it_.dependencies,
    });

    expect("discovered" in it_.rows[0]!.geometry).toBe(false);
    const served = await serveKeptScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      dependencies: it_.dependencies,
    });
    expect("discovered" in served!).toBe(false);
  });

  it("serves a row written before this field existed exactly as it always did", async () => {
    const it_ = bench();
    await keepScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      scan: shape(["hair"] as FeatureSlot[]),
      dependencies: it_.dependencies,
    });
    /* A pre-#2566 row, built by deleting the field the way the old writer never
       wrote it. */
    delete it_.rows[0]!.geometry.discovered;

    const served = await serveKeptScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      dependencies: it_.dependencies,
    });
    expect(served).not.toBeNull();
    expect(Array.from(served!.slots.keys())).toEqual(["hair"]);
  });

  /*
    AND A FOUND STENCIL THAT WILL NOT FETCH CONDEMNS THE WHOLE READING, exactly
    as a catalogue one does. The alternative — drop that row and serve the rest
    — looks gentler and is worse: the reading would be served as COMPLETE, so
    the jacket would never come back without the frame changing.
  */
  it("condemns the reading when a found stencil has gone", async () => {
    const it_ = bench();
    await keepScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      scan: {
        ...shape(["hair"] as FeatureSlot[]),
        discovered: [foundRow("discovered:jacket#1", "jacket", 1)],
      },
      dependencies: it_.dependencies,
    });
    /* The found row's object is the second one written. */
    const key = it_.rows[0]!.geometry.discovered[0]!.maskKey;
    it_.objects.delete(key);

    const served = await serveKeptScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      dependencies: it_.dependencies,
    });
    expect(served).toBeNull();
  });
});
