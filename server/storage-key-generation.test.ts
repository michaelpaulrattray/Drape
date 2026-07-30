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
