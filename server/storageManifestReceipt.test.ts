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
 * # WHAT THIS SWEEP DOES NOT COVER, said rather than implied
 *
 * The SCOPE is the Casting V2 road — `server/castingV2/` and
 * `server/db/castingV2*` — derived by path, so a writer added there tomorrow is
 * in scope the moment it exists.
 *
 * Ten further callers live on older roads: the account deletion, the legacy
 * evidence family and the ink-ADD family. They are OUT of scope and they are
 * out because I have not read them, not because they are known good — and a
 * green test here is a claim about the modules it names and nothing else. That
 * sweep is real work somebody should do; pretending this file already did it
 * would be exactly the confident-and-incomplete record this defect came from.
 */
const SCOPE = (file: string) =>
  file.startsWith("server/castingV2/") || file.startsWith("server/db/castingV2");
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
  "server/castingV2/referenceMint.ts": "a library crop and its mask",
  "server/castingV2/segmentPersistence.ts": "a kept edit's mask and crop",
  "server/castingV2/signService.ts": "the anchor copy a Sign makes, released as the ceremony's last act",
  "server/castingV2/refineService.ts": "the variant image a paid refine is about to write",
  "server/db/castingV2FaceScans.ts": "the REPLACED reading's stencils, at the moment nothing references them",
};

/**
 * Modules that register bytes they want COLLECTED. A receipt here would defeat
 * the purpose — the worker taking them is the whole point.
 */
const COLLECTORS: Readonly<Record<string, string>> = {
  "server/castingV2/candidateRetention.ts": "a candidate ageing out, and everything under its purge path",
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
    expect(callers.length).toBeGreaterThan(5);
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

  it("every KEEPER carries its receipt to the row", () => {
    const missing = Object.keys(KEEPERS).filter((file) =>
      !readFileSync(path.resolve(ROOT, file), "utf8").includes("cleanupBatchId"));
    expect(missing, "a keeper with no receipt is a promise the worker will keep").toEqual([]);
  });

  it("no COLLECTOR discharges anything — the negative control", () => {
    /*
      Without this the assertion above is satisfied by a rule that simply says
      "mention this word somewhere", and the two classes stop being two. A
      collector that started discharging its own manifest would leave a deleted
      Cast's objects on a permanently public bucket forever.
    */
    const wrong = Object.keys(COLLECTORS).filter((file) =>
      readFileSync(path.resolve(ROOT, file), "utf8").includes("cleanupBatchId"));
    expect(wrong, "a collector's manifest is meant to be collected").toEqual([]);
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
