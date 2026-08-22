import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * EVERY MANIFEST FOR BYTES WE MEAN TO KEEP IS DISCHARGED BY THE ROW THAT KEEPS
 * THEM — the class sweep, ordered fable-1034 §1(d) after `keepScan` was found
 * to be the one writer that never released its receipt.
 *
 * # The defect this generalises
 *
 * `createStorageCleanupManifestIn` is a PROMISE TO DELETE. A caller registers
 * keys, writes the bytes, and then — if it means to keep them — the statement
 * that files the referencing row deletes the manifest in its own transaction.
 * Miss that last step and the worker keeps the promise: on 2026-08-19 every
 * face scan's stencils were deleted about six minutes after they were written,
 * the kept row survived pointing at nothing, and a table that had cost real
 * money to build had never once answered.
 *
 * Every other writer on this road did it correctly, which is exactly why a
 * prose claim to that effect is worth nothing — working law 7 asks for the
 * sweep, and a sweep is an assertion per module.
 *
 * # THE TWO CLASSES, and the second is what makes the first mean anything
 *
 * **Keepers** register bytes they are about to reference and MUST carry a
 * receipt to the row. **Collectors** register bytes they want the worker to
 * take — a Cast being deleted, a candidate ageing out — and must NOT discharge
 * anything, because the deletion is the point. A test that demanded a receipt
 * from every caller would be wrong about half of them and would have to be
 * weakened until it proved nothing.
 *
 * The union is DERIVED from source, so a new caller of the manifest cannot
 * appear without being classified here. That is the half that survives the next
 * writer, and it is the half a hand list would not have.
 *
 * # THE SCOPE IS NOW EVERY CALLER IN THE SERVER — the ten older roads read
 *
 * It was `server/castingV2/` only, with ten further callers declared OUT and
 * declared out honestly: *"out because I have not read them, not because they
 * are known good"*. They have now been read (2026-08-19), one at a time, and
 * they are named below. **No defect was found on any of them** — one keeper
 * that discharges its own manifest inline (`evidenceFork`, the fork's rollback
 * net) and nine collectors that correctly discharge nothing.
 *
 * So the scope is every source file under `server/` that calls the manifest,
 * derived rather than listed, minus the module that DEFINES it. A caller added
 * anywhere tomorrow is in scope the moment it exists.
 *
 * # WHY THE COLLECTOR'S NEGATIVE CONTROL HAD TO CHANGE TO WIDEN AT ALL
 *
 * The old control asserted a collector's source does NOT contain the string
 * `cleanupBatchId`. That is sound inside Casting V2, where the word has exactly
 * one meaning — the receipt a keeper hands to the row that saves its bytes.
 *
 * **On the older roads the same word means the opposite thing.** A cancelled
 * ink-ADD candidate is set to `status: "cleanup_pending", cleanupBatchId:
 * manifest.id` — the row is not holding a receipt, it is holding a POINTER TO
 * THE BATCH THAT WILL DELETE IT. Widened unchanged, the old assertion would
 * have called five correct collectors violations, and the only ways out are to
 * exempt them by hand (a list that rots) or to weaken it until it proves
 * nothing.
 *
 * The act, not the word: **a collector must not DELETE the batch it created.**
 * Discharging is what turns a promise-to-delete into a keep, and it is a
 * deletion of `storageCleanupBatches` in the row's own transaction — the same
 * shape at every discharge site in the tree. That is what
 * {@link dischargesItsOwnManifest} reads, and it is driven directly below
 * against a source that does and sources that do not, because an assertion
 * over source text that has never been shown failing is not an assertion.
 */
/**
 * Every caller, anywhere under `server/`, except the module that DEFINES the
 * helper — `storageCleanup.ts` contains the call site's own text and is the
 * worker's home, so it is neither a keeper nor a collector.
 */
const SCOPE = (file: string) => file !== "server/db/storageCleanup.ts";

/**
 * Does this module discharge a manifest itself — the act that turns a
 * promise-to-delete into a keep?
 *
 * Reads the deletion of the BATCH rather than of its items: an items-only
 * delete leaves the batch behind for the worker to finalize empty, which is
 * untidy and is not a leak. Every real discharge site in the tree deletes both.
 */
const dischargesItsOwnManifest = (source: string) =>
  /\.delete\(\s*storageCleanupBatches\s*\)/.test(source);

/**
 * ⚠ DOES THIS KEEPER ACTUALLY HAND THE RECEIPT ON — the arm that was a
 * substring check, and the defect it missed.
 *
 * `referenceAttachService.ts` sat in {@link KEEPERS} and its bytes were being
 * COLLECTED. It minted a batch id, handed it to the manifest, and never passed
 * it to the row — so nothing ever discharged, the worker took every picture a
 * customer had attached, and the ROWS SURVIVED POINTING AT NOTHING. Found by
 * building the route that shows her the picture and getting `NoSuchKey` from a
 * live row's own key.
 *
 * The old arm asked whether the file *mentions* `cleanupBatchId`. It did — in
 * the declaration and in the manifest call, which are the two places every
 * broken keeper would also mention it. Its own sibling, the collector arm,
 * *"reads the ACT and not the word"* and has a CAN-FAIL arm behind it; the
 * positive one did not, and that asymmetry is the whole bug.
 *
 * So this reads the ACT: the id must appear SOMEWHERE OTHER than its own
 * declaration and the manifest call it was minted for — that is what "handing
 * it on" looks like from outside. A keeper that discharges inline
 * ({@link dischargesItsOwnManifest}) needs no hand-off and is answered by that
 * reader instead.
 *
 * Driven both ways below, on the broken shape and the fixed one, because an
 * absence test whose reader never returns false passes over anything at all.
 */
const handsTheReceiptOn = (source: string): boolean => {
  /* Everything the manifest call itself consumes, removed — including the
     declaration that feeds it. What is left is the hand-off, or nothing. */
  const withoutMint = source
    .replace(/const\s+cleanupBatchId\s*=[^;]*;/g, "")
    .replace(/(?:dependencies\.)?manifest\s*\(\s*\{[\s\S]*?\}\s*\)/g, "")
    .replace(/createStorageCleanupManifestIn\s*\([\s\S]*?\)\s*;/g, "");
  return /cleanupBatchId/.test(withoutMint);
};
const ROOT = path.resolve(__dirname, "..");

/** Every server source file, comments and all — the classification reads code. */
function serverSources(): Array<{ file: string; source: string }> {
  const out: Array<{ file: string; source: string }> = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
      out.push({
        file: path.relative(ROOT, full).split(path.sep).join("/"),
        source: readFileSync(full, "utf8"),
      });
    }
  };
  walk(path.join(ROOT, "server"));
  return out;
}

/**
 * Modules that register bytes they mean to KEEP. Each must hand a
 * `cleanupBatchId` to the statement that files the referencing row.
 */
const KEEPERS: Readonly<Record<string, string>> = {
  "server/castingV2/bornWornCatalogue.ts": "a born-worn mask and crop, referenced by the catalogue row",
  "server/castingV2/inkPlateMint.ts": "the plate an engine is shown on every later render",
  "server/castingV2/inkUploadService.ts": "the customer's own design photograph",
  "server/castingV2/keptFaceScan.ts": "the scan's stencils — THE ONE THAT WAS MISSING, fixed 2026-08-19",
  "server/castingV2/referenceAttachService.ts": "the picture a customer attached to her Cast",
  "server/castingV2/referenceMint.ts": "a library crop and its mask",
  "server/castingV2/segmentPersistence.ts": "a kept edit's mask and crop",
  "server/castingV2/signService.ts": "the anchor copy a Sign makes, released as the ceremony's last act",
  "server/castingV2/refineService.ts": "the variant image a paid refine is about to write",
  "server/db/castingV2FaceScans.ts": "the REPLACED reading's stencils, at the moment nothing references them",
  /*
    THE OLDER ROAD'S ONE KEEPER, read 2026-08-19. A fork registers the
    DESTINATION keys of the copies it is about to make, so a fork that dies
    half-copied leaves nothing orphaned on the bucket, and its own commit
    deletes the batch inline rather than handing a receipt to a db module. Both
    shapes are keepers; only the second is common.
  */
  "server/casting/evidence/evidenceFork.ts": "the copies a fork is about to make, released by its own commit",
};

/**
 * Modules that register bytes they want COLLECTED. A receipt here would defeat
 * the purpose — the worker taking them is the whole point.
 */
const COLLECTORS: Readonly<Record<string, string>> = {
  "server/castingV2/candidateRetention.ts": "a candidate ageing out, and everything under its purge path",
  /*
    THE ONLY COLLECTOR THAT REGISTERS BYTES BEFORE THEY EXIST, and the class is
    a decision rather than an oversight.

    A hair carrier is cut per render from an attachment that is itself KEPT, so
    nothing needs the carrier once the render has loaded it and re-cutting costs
    two segmenter calls of house money. It is held while it is written and then
    collected, which is the right life for an ask-scoped artifact — the
    candidate purge collects by ROW, so an object with no row would otherwise
    outlive the Cast it was cut from.

    **The day a caller needs the carrier to survive its render, this file moves
    to KEEPERS and records a row** — and this table is what will refuse to let
    that happen quietly.
  */
  "server/castingV2/hairReferenceCutter.ts": "a carrier cut for one render, collected after it",
  /* The nine older-road collectors, read one at a time on 2026-08-19. Every one
     records the batch id ONTO its row — the pointer, not the receipt — and not
     one of them deletes a batch. */
  "server/casting/finalCastDeletion.ts": "a Cast being deleted, every object it owns",
  "server/db/accountDeletion.ts": "an account being deleted, every object it owns",
  "server/db/evidenceCandidates.ts": "an evidence candidate's private plates, discarded with it",
  "server/db/evidenceOperations.ts": "a reference plate being discarded from a Cast",
  "server/db/evidenceRecovery.ts": "an abandoned evidence operation's objects, swept",
  "server/db/inkAddAcceptance.ts": "the candidates NOT accepted, discarded at acceptance",
  "server/db/inkAddCancellation.ts": "a cancelled ink-ADD candidate's objects",
  "server/db/inkAddCandidates.ts": "an ink-ADD candidate discarded before acceptance",
  "server/db/inkAddRecovery.ts": "an abandoned ink-ADD operation's objects, swept",
  /* The tenth, 2026-08-20. A COLLECTOR and unambiguously so: the customer asked
     for the design to go, so the manifest is the delete rather than a hold over
     bytes about to be claimed — there is no row left to carry a receipt. */
  "server/db/castingV2InkDesignRemoval.ts": "a design its owner removed, and the plates drawn from it",
};

describe("the manifest receipt, swept across every caller", () => {
  const callers = serverSources()
    .filter(({ file, source }) =>
      SCOPE(file) && source.includes("createStorageCleanupManifestIn("))
    .map(({ file }) => file)
    .sort();

  it("finds callers at all — the control before any verdict below counts", () => {
    /* An empty scan would make every assertion here vacuously true, and an
       empty scan is exactly what a broken walker or a renamed helper produces. */
    expect(callers.length).toBeGreaterThan(15);
  });

  it("classifies EVERY caller — a new one cannot arrive unnoticed", () => {
    /*
      Derived, not listed. The failure this prevents is the quiet one: somebody
      adds a writer next month, forgets the receipt, and no test anywhere knows
      the module exists. That is precisely how this defect shipped.
    */
    const classified = new Set([...Object.keys(KEEPERS), ...Object.keys(COLLECTORS)]);
    expect(callers.filter((file) => !classified.has(file))).toEqual([]);
    /* And the other direction: a name here that no longer calls the manifest is
       a stale pin claiming to guard something that moved. */
    expect([...classified].filter((file) => !callers.includes(file)).sort()).toEqual([]);
  });

  it("⚠ every KEEPER HANDS ITS RECEIPT ON, or discharges it itself", () => {
    /*
      This arm used to ask whether the file MENTIONED `cleanupBatchId`, and
      `referenceAttachService.ts` mentioned it twice while handing it nowhere —
      so every picture a customer attached was collected by the worker and its
      row left pointing at nothing. See {@link handsTheReceiptOn}.
    */
    const broken = Object.keys(KEEPERS).filter((file) => {
      const source = readFileSync(path.resolve(ROOT, file), "utf8");
      return !dischargesItsOwnManifest(source) && !handsTheReceiptOn(source);
    });
    expect(broken, "a keeper with no receipt is a promise the worker will keep").toEqual([]);
  });

  it("CAN FAIL — the hand-off reader driven on the shape that shipped broken", () => {
    /*
      The exact text `referenceAttachService.ts` carried while its pictures were
      being deleted: the id minted, the id given to the manifest, and nothing
      else. An absence test whose reader never returns false passes over
      anything at all, and this is the reader that did.
    */
    const wasBroken = `
      const cleanupBatchId = randomUUID();
      await dependencies.manifest({ id: cleanupBatchId, userId: u, storageKeys: [k] });
      await dependencies.record({ userId: u, storageKey: k });
    `;
    expect(handsTheReceiptOn(wasBroken)).toBe(false);
    /* And the fix — one more property on the call that writes the row. */
    const isFixed = `
      const cleanupBatchId = randomUUID();
      await dependencies.manifest({ id: cleanupBatchId, userId: u, storageKeys: [k] });
      await dependencies.record({ userId: u, storageKey: k, cleanupBatchId });
    `;
    expect(handsTheReceiptOn(isFixed)).toBe(true);
  });

  it("no COLLECTOR discharges anything — the negative control", () => {
    /*
      Without this the assertion above is satisfied by a rule that simply says
      "mention this word somewhere", and the two classes stop being two. A
      collector that started discharging its own manifest would leave a deleted
      Cast's objects on a permanently public bucket forever.

      It reads the ACT and not the word, and the header says why: on the older
      roads a row's `cleanupBatchId` names the batch that will DELETE it.
    */
    const wrong = Object.keys(COLLECTORS).filter((file) =>
      dischargesItsOwnManifest(readFileSync(path.resolve(ROOT, file), "utf8")));
    expect(wrong, "a collector's manifest is meant to be collected").toEqual([]);
  });

  it("CAN FAIL — the discharge reader driven directly, both ways", () => {
    /*
      The assertion above is an absence test, and an absence test whose reader
      never returns true passes over anything at all. Driven here on three
      sources rather than trusted: the shape every real discharge site uses, a
      collector's own shape, and the items-only delete that is not a discharge.
    */
    expect(dischargesItsOwnManifest(
      "await tx.delete(storageCleanupItems).where(x);\n"
      + "const removed = await tx.delete(storageCleanupBatches).where(and(y));",
    )).toBe(true);
    expect(dischargesItsOwnManifest(
      '.set({ status: "cleanup_pending", cleanupBatchId: manifest.id })',
    )).toBe(false);
    expect(dischargesItsOwnManifest(
      "await tx.delete(storageCleanupItems).where(eq(storageCleanupItems.batchId, id));",
    )).toBe(false);
  });

  it("the two classes are disjoint, and both are populated", () => {
    /*
      A file named in both tables would satisfy every assertion above while
      meaning nothing, and a sweep with an empty side is a sweep with one class.
    */
    expect(Object.keys(KEEPERS).filter((file) => file in COLLECTORS)).toEqual([]);
    expect(Object.keys(KEEPERS).length).toBeGreaterThan(0);
    expect(Object.keys(COLLECTORS).length).toBeGreaterThan(0);
  });

  it("the reader can actually SEE the word it is looking for", () => {
    /*
      The instrument's own control. Both assertions above are absence tests over
      a string, and a mis-resolved path or an unreadable file would make them
      pass while examining nothing.
    */
    const keeper = readFileSync(path.resolve(ROOT, "server/castingV2/inkUploadService.ts"), "utf8");
    expect(keeper).toContain("cleanupBatchId");
    expect(keeper).not.toContain("a-token-no-source-file-contains");
  });
});
