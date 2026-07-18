import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db/connection", () => ({
  getDb: vi.fn(),
  withTransaction: vi.fn(),
}));

import { getDb } from "./db/connection";
import { createModel } from "./db/models";

const modelInput = (userId: number, name: string) => ({
  userId,
  name,
  masterPrompt: `prompt:${name}`,
  technicalSchema: { subject: { name } },
  preferences: { gender: "female" },
  status: "draft" as const,
});

function insertOnlyDb(ids: number[]) {
  const returningId = vi.fn(async () => {
    const id = ids.shift();
    return id === undefined ? [] : [{ id }];
  });
  const values = vi.fn(() => ({ $returningId: returningId }));
  const insert = vi.fn(() => ({ values }));
  return { db: { insert }, insert, values, returningId };
}

describe("createModel exact insert id (R7-1A)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the id produced by this insert without a newest-row query", async () => {
    const fake = insertOnlyDb([41]);
    vi.mocked(getDb).mockResolvedValue(fake.db as never);

    await expect(createModel(modelInput(7, "A"))).resolves.toEqual({
      success: true,
      modelId: 41,
    });
    expect(fake.returningId).toHaveBeenCalledTimes(1);
    expect(fake.db).not.toHaveProperty("select");
  });

  it("keeps concurrent callers paired with their own returned ids", async () => {
    const ids = Array.from({ length: 20 }, (_, index) => 1001 + index);
    const fake = insertOnlyDb([...ids]);
    vi.mocked(getDb).mockResolvedValue(fake.db as never);

    const results = await Promise.all(
      ids.map((_, index) => createModel(modelInput(9, `Concurrent ${index}`))),
    );

    expect(results.map((result) => result.modelId)).toEqual(ids);
    expect(new Set(results.map((result) => result.modelId)).size).toBe(20);
    expect(fake.returningId).toHaveBeenCalledTimes(20);
  });

  it("fails instead of reporting success without an inserted id", async () => {
    const fake = insertOnlyDb([]);
    vi.mocked(getDb).mockResolvedValue(fake.db as never);

    await expect(createModel(modelInput(7, "Missing"))).resolves.toEqual({
      success: false,
      error: "Failed to create model",
    });
  });
});
