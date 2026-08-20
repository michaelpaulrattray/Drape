/**
 * THE ATTACH-POINTED MINT — the ORDER, and what is left behind when it fails.
 *
 * The mint's own decisions live elsewhere (the cutter's, the store's, the
 * resolver's), so what is driven here is the SEQUENCE and the wreckage: bytes,
 * cut, byte check, manifest, object, row — and, on every failure, NO ROW AND NO
 * OBJECT (fable-1148 §3b, the arm fable-1149 §2d asked to read first).
 *
 * # WHY THE FAILURE ARMS ARE THE POINT
 *
 * A refusal that merely returns a sentence looks identical, from the outside,
 * to one that returns a sentence after writing a cut of somebody's photograph
 * to a permanently public URL with no row pointing at it. So each refusal arm
 * asserts the two absences rather than the message — the message is the
 * cutter's own and is asserted where it is written.
 *
 * # THE FAKES ARE RECORDERS, NOT AGREERS
 *
 * Every dependency records what it was HANDED, and the arms assert against
 * those recordings: that the manifest names the same key the store is called
 * with, that the row's digest is the sha of the bytes stored rather than of the
 * attachment, that the cutter saw the attachment's bytes. A double that simply
 * returned success would discriminate nothing.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  INK_DESIGN_CAP_REFUSAL,
  MINT_DEPENDENCIES,
  mintInkDesignFromReference,
  type InkReferenceMintDependencies,
} from "./inkReferenceMint";
import { REFERENCE_PICTURES_PER_CANDIDATE_REFUSAL } from "./referenceAttachDoor";
import { InkDesignCapError, InkDesignOwnershipError } from "../db/castingV2InkDesigns";
import type { CutInkDesignResult } from "./inkReferenceCutter";
import { INK_DESIGN_MAX_BYTES } from "./inkUploadDoor";

const ATTACHED = Buffer.from("her whole photograph, with a person in it");
const CUTOUT = Buffer.from("the design alone, on transparency");

const REFERENCE = {
  storageKey: "casting-v2/reference/abc.jpg",
  digest: "5".repeat(64),
  provenance: "consented" as const,
  mime: "image/jpeg",
};

const REQUEST = {
  userId: 7,
  candidatePublicId: "cand-1",
  reference: REFERENCE,
  placement: "upperArm" as const,
  side: "left" as const,
  intents: ["tattoo"] as const,
};

const cutOutcome = (over: Partial<{
  route: "cut" | "rideWhole";
  bytes: Buffer;
  width: number;
  height: number;
}> = {}): CutInkDesignResult => ({
  ok: true,
  cut: {
    route: over.route ?? "cut",
    bytes: over.bytes ?? CUTOUT,
    width: over.width ?? 400,
    height: over.height ?? 300,
    inkPixels: 12_000,
    personPixels: 800_000,
    box: { left: 10, top: 20, width: over.width ?? 400, height: over.height ?? 300 },
  },
});

type Recorder = {
  dependencies: InkReferenceMintDependencies;
  manifested: Array<{ id: string; storageKeys: readonly string[] }>;
  stored: Array<{ key: string; bytes: Buffer; contentType: string }>;
  recorded: any[];
  cutSaw: Buffer[];
};

function recorder(over: Partial<InkReferenceMintDependencies> = {}): Recorder {
  const manifested: Recorder["manifested"] = [];
  const stored: Recorder["stored"] = [];
  const recorded: any[] = [];
  const cutSaw: Buffer[] = [];
  const dependencies: InkReferenceMintDependencies = {
    readBytes: async () => ({ bytes: ATTACHED }),
    cut: async (input) => {
      cutSaw.push(input.bytes);
      return cutOutcome();
    },
    manifest: async (input) => {
      manifested.push({ id: input.id, storageKeys: input.storageKeys });
    },
    store: async (input) => {
      stored.push(input);
      return { key: input.key, url: `https://example.invalid/${input.key}` };
    },
    record: async (input) => {
      recorded.push(input);
      return {
        publicId: "design-1",
        candidateId: 42,
        placement: input.placement,
        side: input.side,
        provenance: input.provenance,
        intents: input.intents,
        storageKey: input.storageKey,
        cutRoute: input.cutRoute,
        sourceDigest: input.sourceDigest,
        createdAt: new Date("2026-08-20T06:00:00Z"),
      };
    },
    ...over,
  };
  return { dependencies, manifested, stored, recorded, cutSaw };
}

describe("the design in her picture becomes a row", () => {
  it("cuts HER attachment, stores the CUT, and files a row describing what was stored", () => {
    const bench = recorder();
    return mintInkDesignFromReference(REQUEST, bench.dependencies).then((outcome) => {
      expect(outcome.ok).toBe(true);

      /* The cutter saw her attachment's bytes and nothing else. */
      expect(bench.cutSaw).toEqual([ATTACHED]);

      /* What went to storage is the CUT, never the photograph. */
      expect(bench.stored).toHaveLength(1);
      expect(bench.stored[0]!.bytes).toBe(CUTOUT);
      expect(bench.stored[0]!.bytes.equals(ATTACHED)).toBe(false);

      /* And every column describes the object that was actually written —
         the digest is the sha of the CUT, not of her attachment. */
      const row = bench.recorded[0]!;
      expect(row.digest).toBe(createHash("sha256").update(CUTOUT).digest("hex"));
      expect(row.digest).not.toBe(createHash("sha256").update(ATTACHED).digest("hex"));
      expect(row.byteSize).toBe(CUTOUT.byteLength);
      expect(row.width).toBe(400);
      expect(row.height).toBe(300);
    });
  });

  it("MANIFESTS THE EXACT KEY IT THEN WRITES, in that order", async () => {
    /*
      The keeper-receipt discipline, asserted as an identity rather than as two
      calls that happened. A manifest naming a different key is a hold over
      nothing, and the bytes it was supposed to protect become litter — on this
      road, a cut taken from a photograph of a person.
    */
    const bench = recorder();
    await mintInkDesignFromReference(REQUEST, bench.dependencies);
    expect(bench.manifested).toHaveLength(1);
    expect(bench.manifested[0]!.storageKeys).toEqual([bench.stored[0]!.key]);
    /* And the row discharges that same manifest, in its own transaction. */
    expect(bench.recorded[0]!.cleanupBatchId).toBe(bench.manifested[0]!.id);
    expect(bench.recorded[0]!.storageKey).toBe(bench.stored[0]!.key);
  });

  it("is born EXAMINED, and carries the picture it came out of", async () => {
    /*
      Two columns that make this road's rows different from the ones the flag's
      off-period created. `cutRoute` is the cutter's own answer, so fable-1137
      §4's containment condition is satisfied at birth rather than checked
      after; `sourceDigest` is the attachment's, which is what makes the next
      ask about the same picture a RIDE rather than a second cut.
    */
    const bench = recorder();
    await mintInkDesignFromReference(REQUEST, bench.dependencies);
    expect(bench.recorded[0]!.cutRoute).toBe("cut");
    expect(bench.recorded[0]!.sourceDigest).toBe(REFERENCE.digest);
  });

  it("carries provenance and intents rather than inventing either", async () => {
    const bench = recorder();
    await mintInkDesignFromReference(
      { ...REQUEST, reference: { ...REFERENCE, provenance: "synthetic" } },
      bench.dependencies,
    );
    expect(bench.recorded[0]!.provenance).toBe("synthetic");
    expect(bench.recorded[0]!.intents).toEqual(["tattoo"]);
  });

  it("files the placement and side it was given, unchanged", async () => {
    /* This road's measured failure is a design on the wrong arm. The mint has
       no opinion about either value: both were resolved from her own sentence
       and proven before it was called. */
    const bench = recorder();
    await mintInkDesignFromReference({ ...REQUEST, side: "right" }, bench.dependencies);
    expect(bench.recorded[0]!.placement).toBe("upperArm");
    expect(bench.recorded[0]!.side).toBe("right");
  });

  it("keeps HER format when the frame rides whole", async () => {
    /*
      `rideWhole` is the cutter saying there is nobody in the picture, so her
      bytes go on untouched — and a row recording PNG over her JPEG would be a
      mime that describes an object nobody wrote.
    */
    const bench = recorder({
      cut: async () => cutOutcome({ route: "rideWhole", bytes: ATTACHED, width: 900, height: 900 }),
    });
    await mintInkDesignFromReference(REQUEST, bench.dependencies);
    expect(bench.stored[0]!.contentType).toBe("image/jpeg");
    expect(bench.stored[0]!.key.endsWith(".jpg")).toBe(true);
    expect(bench.recorded[0]!.mime).toBe("image/jpeg");
    expect(bench.recorded[0]!.cutRoute).toBe("rideWhole");
    /* And the digest still means byte identity of what was stored. */
    expect(bench.recorded[0]!.digest).toBe(createHash("sha256").update(ATTACHED).digest("hex"));
  });

  it("stores a cut as PNG, whatever her file was", async () => {
    /* The cut carries an alpha channel and a JPEG has none, so recording her
       original format would write a mime that flattens the transparency the
       whole cut is made of. */
    const bench = recorder();
    await mintInkDesignFromReference(REQUEST, bench.dependencies);
    expect(bench.stored[0]!.contentType).toBe("image/png");
    expect(bench.stored[0]!.key.endsWith(".png")).toBe(true);
  });
});

describe("a mint that cannot proceed stores NOTHING", () => {
  /*
    fable-1148 §3b, and each arm asserts the two absences rather than the
    sentence. The sentence is the cutter's own and is asserted where it is
    written; what this file owns is that nothing was left behind.
  */
  const leftNothing = (bench: Recorder) => {
    expect(bench.manifested, "manifest").toHaveLength(0);
    expect(bench.stored, "object").toHaveLength(0);
    expect(bench.recorded, "row").toHaveLength(0);
  };

  it("when her picture cannot be read back from storage", async () => {
    const bench = recorder({
      readBytes: async () => { throw new Error("no such object"); },
      cut: async () => { throw new Error("the cutter must not be reached"); },
    });
    const outcome = await mintInkDesignFromReference(REQUEST, bench.dependencies);
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.refusal.code).toBe("bytesUnavailable");
    leftNothing(bench);
  });

  it("when the cutter refuses — and her sentence travels unchanged", async () => {
    /*
      THE ROW THE WHOLE ROAD IS FOR: a photographed person with no design the
      reader could isolate. The refusal is the cutter's, passed through, because
      a re-worded refusal is how two surfaces come to say different things about
      one wall.
    */
    const refusal = {
      code: "personWithoutDesign" as const,
      message: "That looks like a design on a model's arm — I can't safely take it from there. Nothing was charged.",
    };
    const bench = recorder({ cut: async () => ({ ok: false, refusal }) });
    const outcome = await mintInkDesignFromReference(REQUEST, bench.dependencies);
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.refusal.code).toBe("cut");
    expect(!outcome.ok && outcome.refusal.message).toBe(refusal.message);
    leftNothing(bench);
  });

  it("when the CUT comes out bigger than a design may be", async () => {
    /*
      fable-1149 §2a, and the reason it is an arm rather than a comment: the
      cut re-encodes as LOSSLESS PNG, so a large-dimension JPEG comfortably
      under the attach door's cap can cut to a PNG well over it. The door
      bounded the bytes she SENT; this bounds the bytes we KEEP, and they are
      not the same quantity.
    */
    const huge = Buffer.alloc(INK_DESIGN_MAX_BYTES + 1, 1);
    const bench = recorder({ cut: async () => cutOutcome({ bytes: huge }) });
    const outcome = await mintInkDesignFromReference(REQUEST, bench.dependencies);
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.refusal.code).toBe("tooLargeAfterCut");
    expect(!outcome.ok && outcome.refusal.message).toContain("Nothing was charged.");
    leftNothing(bench);
  });

  it("admits a cut that is exactly at the cap — the bound is not off by one", async () => {
    /* The control for the arm above: a check written `>=` would refuse a legal
       design and would look identical in a green suite. */
    const exact = Buffer.alloc(INK_DESIGN_MAX_BYTES, 1);
    const bench = recorder({ cut: async () => cutOutcome({ bytes: exact }) });
    const outcome = await mintInkDesignFromReference(REQUEST, bench.dependencies);
    expect(outcome.ok).toBe(true);
    expect(bench.recorded).toHaveLength(1);
  });
});

describe("the store's own refusals become her sentences", () => {
  it("REFUSES at the cap and never evicts", async () => {
    /*
      Making room by deleting would be destroying a design a customer owns to
      serve a render she did not know cost her one. The cap is decided under
      the parent's own `FOR UPDATE`, which is why it arrives as a throw.
    */
    const bench = recorder({ record: async () => { throw new InkDesignCapError(); } });
    const outcome = await mintInkDesignFromReference(REQUEST, bench.dependencies);
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.refusal.code).toBe("cap");
    expect(!outcome.ok && outcome.refusal.message).toContain("Nothing was charged.");
  });

  it("says a Cast that is not hers the way it says a missing one", async () => {
    const bench = recorder({
      record: async () => { throw new InkDesignOwnershipError("candidate"); },
    });
    const outcome = await mintInkDesignFromReference(REQUEST, bench.dependencies);
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.refusal.code).toBe("noSuchCast");
  });

  it("lets anything else through as the failure it is", async () => {
    /* A refusal vocabulary that swallowed an unknown error would turn a broken
       database into a sentence about her picture. */
    const bench = recorder({ record: async () => { throw new Error("connection reset"); } });
    await expect(mintInkDesignFromReference(REQUEST, bench.dependencies)).rejects.toThrow("connection reset");
  });

  it("leaves the bytes under a manifest nobody discharged", async () => {
    /*
      The half that makes a failed row cost nothing. The object IS written by
      then — the row is the last step — but the manifest was not discharged,
      because that happens inside the transaction that did not commit. So the
      worker collects it, which is the keeper-receipt property rather than a
      promise.
    */
    const bench = recorder({ record: async () => { throw new InkDesignCapError(); } });
    await mintInkDesignFromReference(REQUEST, bench.dependencies);
    expect(bench.stored).toHaveLength(1);
    expect(bench.manifested).toHaveLength(1);
    expect(bench.manifested[0]!.storageKeys).toEqual([bench.stored[0]!.key]);
    expect(bench.recorded).toHaveLength(0);
  });
});

describe("every key is its own", () => {
  it("never writes two designs to one address", async () => {
    /* `randomUUID` per mint, and the assertion is on the two keys rather than
       on the function that made them: every object this product writes sits at
       a permanently public URL and the name is the only thing between it and a
       stranger. */
    const bench = recorder();
    await mintInkDesignFromReference(REQUEST, bench.dependencies);
    await mintInkDesignFromReference(REQUEST, bench.dependencies);
    expect(bench.stored[0]!.key).not.toBe(bench.stored[1]!.key);
  });

  it("puts them under the ink store's own prefix, where an operator can see them", async () => {
    const bench = recorder();
    await mintInkDesignFromReference(REQUEST, bench.dependencies);
    expect(bench.stored[0]!.key.startsWith("casting-v2/ink/")).toBe(true);
  });
});

describe("the shipped dependencies are the ones the mint actually calls", () => {
  it("uses the SAME cutter and the SAME manifest as the upload door", async () => {
    /*
      A second construction of a reader, or a second spelling of the born-held
      manifest, is how one of two roads comes to behave differently from the
      other. Asserted as IDENTITY against the upload door's own exported
      defaults — a `typeof` check here would pass against any two functions.
    */
    const { defaultCutDesign, defaultManifest } = await import("./inkUploadService");
    expect(MINT_DEPENDENCIES.cut).toBe(defaultCutDesign);
    expect(MINT_DEPENDENCIES.manifest).toBe(defaultManifest);
  });

  it("reads bytes by KEY and never by URL", async () => {
    const asked: string[] = [];
    const bench = recorder({
      readBytes: async (key: string) => {
        asked.push(key);
        return { bytes: ATTACHED };
      },
    });
    await mintInkDesignFromReference(REQUEST, bench.dependencies);
    /* The address is the only thing between a photograph of a person and a
       stranger, so the server fetches by KEY and a URL never leaves the
       process. */
    expect(asked).toEqual([REFERENCE.storageKey]);
    expect(asked[0]).not.toContain("http");
  });
});

/**
 * A REFUSAL MAY ONLY NAME MOVES THAT EXIST (ruled fable-1173 §2, from a cap met
 * in the running app).
 *
 * Two cap sentences in this feature told a customer to *"remove one"*. One of
 * them — the attach door's — named a move that DOES NOT EXIST: `ink.remove`
 * takes a design and nothing takes an attachment, so her only exit was deleting
 * the Cast. The other, here, named a real move and the WRONG OBJECT: it counted
 * designs and called them pictures, sending her to look at the pictures she had
 * attached, where there is nothing to remove.
 *
 * **Neither sentence had an arm, which is why both could be wrong for as long
 * as they liked.** Changing them reddened nothing. These are that arm, and they
 * are pinned to the ROUTER rather than to a copy of the words: what makes
 * *"remove one"* honest is a `remove` procedure existing, and that is a fact
 * about `routes/castingV2.ts`, not about this string.
 */
describe("a cap refusal names only moves that exist", () => {
  const ROUTER = readFileSync(
    fileURLToPath(new URL("../routes/castingV2.ts", import.meta.url)),
    "utf8",
  );

  it("the design cap may say REMOVE, because a design can be removed", () => {
    /* Read at the router's own text — a suite comparing this sentence to a
       constant beside it would be comparing local constants to themselves. */
    expect(ROUTER).toContain("removeInkDesign");
    expect(INK_DESIGN_CAP_REFUSAL).toContain("remove one");
    /* AND IT SAYS THE THING THAT CAN BE REMOVED. "Pictures" is what she
       attached; "designs" is what this cap counts and what `ink.remove` takes. */
    expect(INK_DESIGN_CAP_REFUSAL).toContain("designs");
    expect(INK_DESIGN_CAP_REFUSAL).not.toContain("pictures");
  });

  it("the ATTACHMENT cap may NOT say remove, because nothing removes one", () => {
    /*
      The negative arm, and it is the one that matters: this reddens on the day
      somebody writes the sentence back, and it STOPS reddening on the day the
      detach lands — which is exactly when the sentence may say it again
      (fable-1173 §2 filed that chunk).
    */
    const detachExists = /reference[\s\S]{0,400}?detach/.test(ROUTER);
    expect(
      detachExists || !/\bremove\b/i.test(REFERENCE_PICTURES_PER_CANDIDATE_REFUSAL),
      "the attachment cap tells her to remove one, and no procedure removes an attachment",
    ).toBe(true);
    /* And it still tells her what she CAN do, rather than only what she cannot
       — a wall with no road is the other half of D-180. */
    expect(REFERENCE_PICTURES_PER_CANDIDATE_REFUSAL).toMatch(/new Cast/i);
  });
});
