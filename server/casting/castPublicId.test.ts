import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  CAST_PUBLIC_ID_PATTERN,
  CastPublicIdAllocationError,
  generateCastPublicId,
  isCastPublicIdCollision,
  withUniqueCastPublicId,
} from "./castPublicId";

function agencyIdCollision(id = "KI-2222-2222-2222-2222") {
  return Object.assign(
    new Error(`Duplicate entry '${id}' for key 'models.models_agencyId_unique'`),
    {
      code: "ER_DUP_ENTRY",
      errno: 1062,
      sqlMessage:
        `Duplicate entry '${id}' for key 'models.models_agencyId_unique'`,
    },
  );
}

describe("Cast public IDs", () => {
  it("generates cryptographic KI identifiers in the ratified readable format", () => {
    const generated = Array.from({ length: 1_000 }, () => generateCastPublicId());
    expect(new Set(generated).size).toBe(generated.length);
    for (const agencyId of generated) {
      expect(agencyId).toMatch(CAST_PUBLIC_ID_PATTERN);
      expect(agencyId).toHaveLength(22);
      expect(agencyId.slice(3)).not.toMatch(/[01IO]/);
    }
  });

  it("recognizes only an agencyId unique-index collision, including wrapped driver errors", () => {
    expect(isCastPublicIdCollision(agencyIdCollision())).toBe(true);
    expect(isCastPublicIdCollision(new Error("ordinary failure", {
      cause: agencyIdCollision(),
    }))).toBe(true);
    expect(isCastPublicIdCollision(Object.assign(
      new Error("Duplicate entry for another key"),
      { code: "ER_DUP_ENTRY", errno: 1062, sqlMessage: "for key 'users_email_unique'" },
    ))).toBe(false);
    expect(isCastPublicIdCollision(new Error("agencyId write failed"))).toBe(false);
  });

  it("retries the atomic boundary with a fresh ID and returns the committed result", async () => {
    const ids = [
      "KI-2222-2222-2222-2222",
      "KI-3333-3333-3333-3333",
    ];
    const generate = vi.fn(() => ids.shift()!);
    const commit = vi.fn(async (agencyId: string) => {
      if (agencyId.includes("2222")) throw agencyIdCollision(agencyId);
      return { agencyId, minted: true };
    });

    await expect(withUniqueCastPublicId(commit, { generate }))
      .resolves.toEqual({
        agencyId: "KI-3333-3333-3333-3333",
        minted: true,
      });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it("never retries unrelated failures and fails closed after the bounded collision limit", async () => {
    const unrelated = new Error("database unavailable");
    const unrelatedCommit = vi.fn(async () => {
      throw unrelated;
    });
    await expect(withUniqueCastPublicId(unrelatedCommit))
      .rejects.toBe(unrelated);
    expect(unrelatedCommit).toHaveBeenCalledTimes(1);

    const collisionCommit = vi.fn(async () => {
      throw agencyIdCollision();
    });
    await expect(withUniqueCastPublicId(collisionCommit, {
      generate: () => "KI-2222-2222-2222-2222",
      maxAttempts: 3,
    })).rejects.toBeInstanceOf(CastPublicIdAllocationError);
    expect(collisionCommit).toHaveBeenCalledTimes(3);
  });

  it("pins the production mint path to cryptographic allocation and the existing column capacity", () => {
    const mintSource = readFileSync("server/casting/mintPackage.ts", "utf8");
    const idSource = readFileSync("server/casting/castPublicId.ts", "utf8");
    const schemaSource = readFileSync("drizzle/schema.ts", "utf8");

    expect(mintSource).toContain("withUniqueCastPublicId");
    expect(mintSource).not.toContain("Math.random()");
    expect(idSource).toContain('from "node:crypto"');
    expect(idSource).toContain("randomBytes");
    expect(schemaSource).toMatch(
      /agencyId:\s*varchar\("agencyId",\s*\{\s*length:\s*32\s*\}\)\.unique\(\)/,
    );
  });
});
