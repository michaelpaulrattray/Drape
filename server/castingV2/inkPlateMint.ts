/**
 * MINTING THE PLATE — station two of the plate road (fable-936 §2, fable-959 §3).
 *
 * A customer attached a photograph of a tattoo. This draws that design onto a
 * blank ghost mannequin and keeps the result. **The plate is the only ink
 * artifact an engine is ever shown** (D-138, ruled fable-684 §2), which is how
 * the real-person fence is met by construction rather than by a filter.
 *
 * # WHAT THIS FILE IS RESPONSIBLE FOR: the ORDER
 *
 * Same division as the upload beside it. The decisions are in `inkPlateDoor.ts`,
 * the blank forms in `inkTemplates.ts`, the statements in
 * `db/castingV2InkPlates.ts`, the two engines behind one verb in
 * `inkPlateEngines.ts`. What lives here is the sequence — the part that goes
 * wrong invisibly:
 *
 *   1. the doors that cost nothing, before anything is read or spent
 *   2. the design's own row, owner-scoped — the placement and the bytes come
 *      from it, never from a caller
 *   3. the TEMPLATE, read and hashed, and refused if it is not the artwork he
 *      approved
 *   4. the DESIGN's bytes, read and hashed, and refused if they have moved
 *   5. **the engine call** — the only step that spends
 *   6. the MANIFEST, naming the exact key about to be written
 *   7. the BYTES, to that key
 *   8. the ROW, which discharges the manifest in its own transaction
 *
 * Steps 6–8 are the library's discipline and they are here for the reason it
 * learned them: bytes at a permanently public URL with no row referencing them
 * are litter nobody will go looking for. If step 7 dies the hold lapses and the
 * worker collects; if step 8 dies the same; only a committed row releases the
 * receipt.
 *
 * **Every door that can refuse is asked BEFORE step 5**, and that ordering is
 * the whole argument for a door module: a mint costs a paid image call, and a
 * refusal discovered inside that call has already spent the money it exists to
 * save.
 *
 * # WHY THE ENGINE IS INJECTED AND HAS NO DEFAULT
 *
 * Two reasons, and the second is the one that would have taken production down.
 *
 * The plate court (fable-936 §4) has not run: which engine draws the better
 * plate is an open question with the founder's eye as its instrument, so a
 * default here would be this file quietly answering it.
 *
 * And a default engine needs a queue, and a queue needs an allowance. The
 * account's twenty concurrent requests are spent EXACTLY — 8 + 3 + 3 + 6 — and
 * `assertFalBudget()` refuses to boot when the sum exceeds the ceiling. A fifth
 * declared path with any fallback at all takes the server down on the next
 * deploy, from a feature that is flag-dark. So the caller brings the engine, and
 * the pie is re-cut with the court's measured wall-clock in hand rather than
 * from a guess made before it.
 *
 * # WHAT IS NOT DECIDED HERE
 *
 * Whether the plate contains a PERSON. That cannot be decided from inputs — it
 * is a judgement about pixels that do not exist until the engine has drawn them,
 * and law 9 says no vision reader closes it. It is the fence court (fable-919
 * §3): a face-bearing reference must produce a plate with zero person content,
 * at the frames, in front of the founder. A door here would be the comfortable
 * lie that the problem is handled.
 */
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";

import type { InkFormDemandKind, InkFormDemandOutcome } from "../../shared/inkFormDemand";
import type { InkPlacement } from "../../shared/inkPlacementVocabulary";

import { withTransaction } from "../db/connection";
import {
  createStorageCleanupManifestIn,
  storageCleanupManifestHeldUntil,
} from "../db/storageCleanup";
import { readInkDesign, readInkDesignCastIdentity, type StoredInkDesign } from "../db/castingV2InkDesigns";
import { recordInkFormDemand } from "../db/castingV2InkFormDemand";
import {
  listInkPlatesForDesign,
  recordInkPlate,
  type InkPlateToRecord,
  type RecordedInkPlate,
} from "../db/castingV2InkPlates";
import { storagePut, storageReadBytes } from "../storage";
import {
  inkPlateAlreadyMintedRefusal,
  inkPlateDesignRefusal,
  inkPlateFormRefusal,
  inkPlateKey,
  inkPlatePrompt,
  inkPlateTemplateRefusal,
  inkPlateTransportRefusal,
  type InkPlateRefusal,
} from "./inkPlateDoor";
import { inkTemplateFor, loadInkTemplate } from "./inkTemplates";
import { readResolvedIdentity } from "./rollService";
import type { InkPlateEngine } from "./inkPlateEngines";

export type InkPlateMintOutcome =
  /** Minted now, or already there — `reused` is which, never inferred. */
  | { ok: true; plate: RecordedInkPlate; reused: boolean }
  | { ok: false; refusal: InkPlateRefusal };

export type InkPlateMintRequest = {
  /** From the session, never from input (invariant 3). */
  userId: number;
  designPublicId: string;
  /**
   * WHO DRAWS IT. No default — see the header.
   *
   * `null` is a deployment with no transport at all, which the transport door
   * turns into a sentence rather than a crash.
   */
  engine: InkPlateEngine | null;
  signal?: AbortSignal;
};

export type InkPlateMintDependencies = {
  readDesign: (input: { userId: number; designPublicId: string }) => Promise<StoredInkDesign | null>;
  /**
   * The Cast's compiled instruction, for the one field the blank depends on.
   *
   * A dependency rather than a call, like every other read here, so the whole
   * ordering — including the refusal that has no torso form — can be driven
   * without a database.
   */
  readCastIdentity: (input: { userId: number; designPublicId: string }) => Promise<{ internalPrompt: unknown } | null>;
  /**
   * The demand row for a Cast whose build has no form.
   *
   * Injected like every other side effect here, so the refusal AND its count
   * can be driven without a database — and so a test can prove the count
   * happens rather than trusting a call site to remember it.
   */
  countMissingForm: (input: {
    kind: InkFormDemandKind;
    placement: InkPlacement;
    outcome: InkFormDemandOutcome;
  }) => Promise<unknown>;
  existingPlates: (input: { userId: number; designPublicId: string }) => Promise<readonly RecordedInkPlate[]>;
  loadTemplate: typeof loadInkTemplate;
  fetchDesignBytes: (storageKey: string) => Promise<{ bytes: Buffer; contentType: string } | null>;
  manifest: (input: { id: string; userId: number; storageKeys: readonly string[] }) => Promise<void>;
  store: (input: { key: string; bytes: Buffer; contentType: string }) => Promise<{ key: string; url: string }>;
  record: (input: InkPlateToRecord) => Promise<RecordedInkPlate>;
};

async function defaultManifest(input: {
  id: string;
  userId: number;
  storageKeys: readonly string[];
}): Promise<void> {
  await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
    id: input.id,
    userId: input.userId,
    /* A synthetic operation id, like the upload's and the sweep's: the column is
       unique and NOT NULL, and a plate mint is not a generation operation. */
    operationId: randomUUID(),
    /* BORN HELD, and the synthetic id above is exactly why — the worker's
       in-flight fence tests a batch against a live operation row, and a
       synthetic id matches none. Without the hold this manifest is claimable the
       instant it is written, while the bytes it names are still uploading. */
    heldUntil: storageCleanupManifestHeldUntil(),
    kind: "casting_candidate_cleanup",
    storageItems: input.storageKeys.map((storageKey) => ({
      storageKey,
      storageBackend: "public_r2" as const,
    })),
  }));
}

/**
 * A missing object reads as `null` rather than as a throw, because the door
 * tells *the bytes are gone* apart from *the bytes are different* and both of
 * those are refusals rather than faults.
 */
async function defaultFetchDesignBytes(
  storageKey: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  try {
    return await storageReadBytes(storageKey);
  } catch {
    return null;
  }
}

const REAL: InkPlateMintDependencies = {
  readDesign: readInkDesign,
  readCastIdentity: readInkDesignCastIdentity,
  countMissingForm: recordInkFormDemand,
  existingPlates: listInkPlatesForDesign,
  loadTemplate: loadInkTemplate,
  fetchDesignBytes: defaultFetchDesignBytes,
  manifest: defaultManifest,
  store: (one) => storagePut(one.key, one.bytes, one.contentType),
  record: recordInkPlate,
};

/**
 * The design is not this account's, or is not there.
 *
 * A THROW rather than a refusal, and deliberately: every other outcome of this
 * function is a sentence a customer reads, and "that Cast isn't yours" is not
 * one of them — it is answered the way a missing thing is answered, one layer
 * up, by the procedure that knows what a client is allowed to be told.
 */
export class InkPlateDesignNotFound extends Error {
  constructor() {
    super("design not found");
    this.name = "InkPlateDesignNotFound";
  }
}

export async function mintInkPlate(
  request: InkPlateMintRequest,
  dependencies: InkPlateMintDependencies = REAL,
): Promise<InkPlateMintOutcome> {
  /*
    THE TRANSPORT FIRST, before a database is touched. A mint with no engine
    cannot be retried into existence by the caller, and every read below would
    be work bought for a call that cannot happen.
  */
  const engine = request.engine;
  const transport = inkPlateTransportRefusal(engine !== null);
  if (transport || !engine) return { ok: false, refusal: transport! };

  const design = await dependencies.readDesign({
    userId: request.userId,
    designPublicId: request.designPublicId,
  });
  if (!design) throw new InkPlateDesignNotFound();

  /*
    ALREADY PLATED IS NOT AN ERROR, and it returns the plate that exists.

    This is the whole cost argument of minting at upload (fable-936 §2): the
    plate is made once per design and reused by every later render. A second ask
    that bought a second picture would quietly turn a one-off into a per-render
    cost, and nothing downstream would say so.
  */
  const plates = await dependencies.existingPlates({
    userId: request.userId,
    designPublicId: request.designPublicId,
  });
  const already = plates.find((plate) => plate.engine === engine.id);
  if (already) return { ok: true, plate: already, reused: true };

  /*
    THE BLANK FORM — the placement picks the family, the SIDE or the cast's own
    BUILD picks the member. Total over the placement vocabulary, so a fourth
    placement cannot reach an engine before somebody has decided which form it
    stands on, and total over the two that pick the member, so an unanswerable
    combination refuses instead of falling to whichever blank was listed first.

    The side matters here and not merely in the words: the ink follows the
    PLATE'S own geometry rather than the prompt's sentence (the mirror court,
    2026-08-19), so a left-arm design plating onto the right-facing blank is a
    tattoo on the wrong arm no clause can talk out of it.

    Ahead of every read below, because a refusal that costs nothing is strictly
    better for her than one discovered after the bytes have been fetched.
  */
  const identity = await dependencies.readCastIdentity({
    userId: request.userId,
    designPublicId: request.designPublicId,
  });
  const build = readResolvedIdentity(identity?.internalPrompt ?? null)?.sex ?? null;
  const choice = inkTemplateFor({ placement: design.placement, side: design.side, build });
  const formRefusal = inkPlateFormRefusal(choice);
  if (formRefusal || !choice.ok) {
    /*
      COUNTED, and counted HERE rather than in `refusalCounter` — the refusal is
      about a BUILD, and every audit row that counter writes carries a userId,
      which would attribute one bit of this Cast's `technicalSchema` to an
      account a staff member can read. The demand table holds no account at all.

      **Swallowed HERE, and not only inside the writer.** The writer catches its
      own failures — it has to, because the table lands by a founder ceremony
      and every call before that one fails — but a refusal that could be turned
      into a throw by whatever is injected as its counter is a refusal whose
      safety depends on a caller remembering. It is awaited so a test can see
      the write, and caught so nothing it does can reach the customer.

      The two kinds are not one: `torsoNonbinary` is *draw a third form*,
      `torsoUnstated` is *this record is missing a field*. Collapsing them would
      put a data gap into the count that decides whether to commission artwork.
    */
    await dependencies.countMissingForm({
      kind: build === null ? "torsoUnstated" : "torsoNonbinary",
      placement: design.placement,
      outcome: "refused",
    }).catch(() => undefined);
    return { ok: false, refusal: formRefusal! };
  }
  const template = choice.template;

  const loaded = await dependencies.loadTemplate(template);
  const templateRefusal = inkPlateTemplateRefusal({
    present: loaded !== null,
    approvedDigest: template.digest,
    fetchedDigest: loaded?.digest ?? null,
  });
  if (templateRefusal || !loaded) return { ok: false, refusal: templateRefusal! };

  const fetched = await dependencies.fetchDesignBytes(design.storageKey);
  const fetchedDigest = fetched
    ? createHash("sha256").update(fetched.bytes).digest("hex")
    : null;
  const designRefusal = inkPlateDesignRefusal({
    recordedDigest: design.digest,
    fetchedDigest,
  });
  if (designRefusal || !fetched) return { ok: false, refusal: designRefusal! };

  /*
    THE WORDS, BUILT ONCE — sent, and hashed onto the row from the same string.

    Two calls to `inkPlatePrompt` would be two chances to record a digest of
    something other than what went out, which is the drift working law 5 is
    about: the contract is proved on the outgoing request, not on a constant
    near it.
  */
  const prompt = inkPlatePrompt({ placement: design.placement, side: design.side, template });

  /* Everything that could refuse has refused. This is where money is spent. */
  const drawn = await engine.mint({
    prompt,
    template: { bytes: loaded.bytes, contentType: template.mime },
    design: { bytes: fetched.bytes, contentType: design.mime },
    templateWidth: template.width,
    templateHeight: template.height,
    signal: request.signal,
  });

  /*
    THE PLATE'S OWN SIZE, DECODED — never the number the provider reported.

    `ImageResult.width` is optional and it is a CLAIM; the bytes are the fact
    (working law 1), and the court's question "did the shape survive" is asked of
    this column. A `?? 0` here would file a plate whose recorded size is a lie
    that reads as a measurement, on the row a verdict is later read off.
  */
  const measured = await sharp(drawn.bytes).metadata().catch(() => null);
  if (!measured?.width || !measured.height) {
    /* Ours, not hers: an engine returned bytes we cannot open. No row is filed,
       the manifest is never discharged, and the worker collects what was
       stored — which is why this is a fault rather than a refusal. */
    throw new Error("the engine returned a plate that will not decode");
  }

  const storageKey = inkPlateKey();
  const cleanupBatchId = randomUUID();
  await dependencies.manifest({
    id: cleanupBatchId,
    userId: request.userId,
    storageKeys: [storageKey],
  });
  await dependencies.store({
    key: storageKey,
    bytes: drawn.bytes,
    contentType: drawn.contentType,
  });

  const plate = await dependencies.record({
    userId: request.userId,
    designPublicId: request.designPublicId,
    engine: engine.id,
    templateKind: template.kind,
    /* The digest MEASURED off disk, not the pin it was compared against — the
       row records what this plate actually stands on. */
    templateDigest: loaded.digest,
    /* And the words it stood on, from the same string that was sent. */
    promptDigest: createHash("sha256").update(prompt).digest("hex"),
    storageKey,
    digest: createHash("sha256").update(drawn.bytes).digest("hex"),
    mime: drawn.contentType,
    byteSize: drawn.bytes.byteLength,
    width: measured.width,
    height: measured.height,
    cleanupBatchId,
  });

  return { ok: true, plate, reused: false };
}
