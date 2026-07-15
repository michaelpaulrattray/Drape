/**
 * Batch B review correction 3 — stale persisted cast links are CLEARED.
 *
 * The `drape_active_session` localStorage entry survives across visits, so a
 * link whose model was archived/hard-deleted must be actively removed:
 *  - the wardrobe-session resume clears it when the source degrades to
 *    imagery-only (branch pinned in modelLifecycleGuard.test.ts);
 *  - the startup restore clears it when the server CONFIRMS the model is
 *    gone (NOT_FOUND/FORBIDDEN) — never on a transient network failure.
 *
 * Node has no localStorage; these tests stub one and START from a
 * pre-populated stale entry, as the review requires.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  persistSession,
  clearPersistedSession,
  isDeadSessionErrorCode,
} from "../client/src/features/studio/hooks/useSessionPersistence";

const STORAGE_KEY = "drape_active_session";

// ── localStorage stub (node environment) ────────────────────────────────────
const store = new Map<string, string>();
const originalLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;
(globalThis as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => void store.clear(),
};
afterAll(() => {
  (globalThis as { localStorage?: unknown }).localStorage = originalLocalStorage;
});

/** A stale entry from an earlier visit: a model that has since been deleted. */
function prePopulateStaleEntry(modelId = 777) {
  store.set(
    STORAGE_KEY,
    JSON.stringify({ modelId, activeTool: "wardrobe", isMinted: true, timestamp: Date.now() }),
  );
}

beforeEach(() => store.clear());

describe("clearPersistedSession — removes a pre-populated stale link", () => {
  it("the stale entry is gone after clearing", () => {
    prePopulateStaleEntry();
    expect(store.has(STORAGE_KEY)).toBe(true);
    clearPersistedSession();
    expect(store.has(STORAGE_KEY)).toBe(false);
  });

  it("clearing an already-empty store is a safe no-op", () => {
    expect(() => clearPersistedSession()).not.toThrow();
    expect(store.has(STORAGE_KEY)).toBe(false);
  });
});

describe("persistSession — overwrites a stale link with status truth", () => {
  it("a resumed session replaces the stale entry with the real minted state", () => {
    prePopulateStaleEntry(777); // dead model, wrongly persisted as minted
    persistSession(42, "wardrobe", false); // a DRAFT resumed with status truth
    const entry = JSON.parse(store.get(STORAGE_KEY)!);
    expect(entry.modelId).toBe(42);
    expect(entry.isMinted).toBe(false);
  });
});

describe("isDeadSessionErrorCode — confirmed-dead vs transient", () => {
  it("NOT_FOUND (deleted or FR-4 archived) and FORBIDDEN (not ours) are dead links", () => {
    expect(isDeadSessionErrorCode("NOT_FOUND")).toBe(true);
    expect(isDeadSessionErrorCode("FORBIDDEN")).toBe(true);
  });

  it("transient/unknown failures never count — the session must survive a flaky network", () => {
    expect(isDeadSessionErrorCode(undefined)).toBe(false); // fetch failure: no tRPC code
    expect(isDeadSessionErrorCode(null)).toBe(false);
    expect(isDeadSessionErrorCode("INTERNAL_SERVER_ERROR")).toBe(false);
    expect(isDeadSessionErrorCode("TIMEOUT")).toBe(false);
    expect(isDeadSessionErrorCode("BAD_REQUEST")).toBe(false);
  });

  it("end to end: a pre-populated stale entry + a confirmed NOT_FOUND clears; a network error keeps it", () => {
    // The restore effect does: if (isDeadSessionErrorCode(code)) clearPersistedSession()
    prePopulateStaleEntry();
    const restoreErrorPath = (code: unknown) => {
      if (isDeadSessionErrorCode(code)) clearPersistedSession();
    };
    restoreErrorPath(undefined); // transient — entry survives
    expect(store.has(STORAGE_KEY)).toBe(true);
    restoreErrorPath("NOT_FOUND"); // confirmed dead — entry cleared
    expect(store.has(STORAGE_KEY)).toBe(false);
  });
});
