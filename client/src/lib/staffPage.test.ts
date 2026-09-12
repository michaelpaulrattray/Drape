/**
 * staffPage — the once-only reload on a chunk that was deployed away (#744,
 * PR #832 review finding 1), driven in node with injected storage and reload.
 */
import { describe, expect, it, vi } from "vitest";
import { STAFF_CHUNK_RELOAD_KEY, loadStaffChunk } from "./staffPage";

const memoryStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
};

const settled = <T>(p: Promise<T>) =>
  Promise.race([p.then(() => "resolved" as const, () => "rejected" as const), new Promise<"pending">((r) => setTimeout(() => r("pending"), 20))]);

describe("loadStaffChunk", () => {
  it("resolves the module on success and clears a spent reload flag", async () => {
    const storage = memoryStorage();
    storage.setItem(STAFF_CHUNK_RELOAD_KEY, "1");
    const reload = vi.fn();
    const mod = await loadStaffChunk(async () => ({ default: "page" }), { storage, reload });
    expect(mod.default).toBe("page");
    expect(reload).not.toHaveBeenCalled();
    expect(storage.getItem(STAFF_CHUNK_RELOAD_KEY)).toBeNull();
  });

  it("on the FIRST failure reloads exactly once, marks it, and never resolves", async () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    const p = loadStaffChunk(async () => { throw new Error("Failed to fetch dynamically imported module"); }, { storage, reload });
    expect(await settled(p)).toBe("pending");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem(STAFF_CHUNK_RELOAD_KEY)).toBe("1");
  });

  it("on a failure AFTER a reload rethrows and does not reload again — no loop", async () => {
    const storage = memoryStorage();
    storage.setItem(STAFF_CHUNK_RELOAD_KEY, "1");
    const reload = vi.fn();
    const boom = new Error("still gone");
    await expect(loadStaffChunk(async () => { throw boom; }, { storage, reload })).rejects.toBe(boom);
    expect(reload).not.toHaveBeenCalled();
  });

  it("CAN FAIL — the pending reading tells a hang from a resolve", async () => {
    expect(await settled(Promise.resolve(1))).toBe("resolved");
    expect(await settled(Promise.reject(new Error("x")))).toBe("rejected");
  });
});
