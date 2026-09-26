import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const serverRoot = path.join(__dirname);

function runtimeTypeScriptFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return runtimeTypeScriptFiles(fullPath);
    if (
      !entry.name.endsWith(".ts") ||
      entry.name.endsWith(".test.ts") ||
      entry.name.endsWith(".spec.ts") ||
      entry.name.endsWith(".d.ts")
    ) {
      return [];
    }
    return [fullPath];
  });
}

describe("storage object keys use cryptographic randomness", () => {
  it("keeps every storage writer on randomUUID and forbids Math.random", () => {
    const writers = runtimeTypeScriptFiles(serverRoot)
      .map((file) => ({
        file,
        relative: path.relative(serverRoot, file).replaceAll("\\", "/"),
        source: fs.readFileSync(file, "utf8"),
      }))
      .filter(({ source }) => /\bawait\s+storagePut\(/.test(source));

    expect(writers.map(({ relative }) => relative).sort()).toEqual([
      "casting/aiService.ts",
      /*
        THE SIGNED-VIEW WRITER, VISIBLE HERE FOR THE FIRST TIME (#1389).

        ⚠ **It did not arrive; it was always a writer and this guard could not
        see it.** The population above is `\bawait\s+storagePut\(`, and this
        file wrote `return storagePut(...)` — one call syntax away from being
        counted. It came into view because #1389 needed the stored key in order
        to mint a thumbnail beside it, which turned the `return` into an
        `await`; nothing about the write itself changed, and its key has been a
        `randomUUID()` the whole time.

        ⚠ **SEVEN MORE ARE STILL INVISIBLE FOR THE SAME REASON** —
        `hairReferenceCutter`, `inkDeliveryMint`, `inkReferenceMint`,
        `keptFaceScan`, `referenceAttachService`, `referenceMint` and
        `refineService` all reach `storagePut` and all generate their own keys.
        Measured 2026-09-26; filed rather than fixed here, because widening the
        population needs a rule for what counts as a key GENERATOR versus a key
        passer, and inventing that taxonomy inside a thumbnail card is how a
        second feature ships under the first one's name.
      */
      "castingV2/packageOrchestrator.ts",
      // Casting V2 candidate landing (M4). Candidate images sit at public
      // bucket URLs, so a guessable key is the only thing between a
      // customer's sheet and anyone who guesses it — this writer is exactly
      // the kind this pin exists for.
      "castingV2/rollService.ts",
      "routes/moderatorAttachments.ts",
      "routes/profile.ts",
      "routes/wardrobe.ts",
      "wardrobe/outfitDecomposition.ts",
      "wardrobe/utils.ts",
    ]);

    for (const { relative, source } of writers) {
      expect(source, `${relative} must use crypto.randomUUID for storage keys`).toContain(
        'from "node:crypto"',
      );
      expect(source, `${relative} must call randomUUID for storage keys`).toContain(
        "randomUUID()",
      );
      expect(source, `${relative} must never use Math.random near storage writes`).not.toContain(
        "Math.random",
      );
    }
  });
});
