/**
 * RESOLVING THE PICTURE AN ASK CAME WITH — the three questions, and the one a
 * careless version of this file would skip.
 *
 * Driven directly with injected dependencies rather than through the
 * interpreter or a database: every rule here is a decision about ownership and
 * scope, and a rule proven only through a model that usually behaves is a rule
 * that is untested (working law 3).
 */
import { describe, expect, it, vi } from "vitest";

import { resolveAskReference, type ResolveAskReferenceDependencies } from "./askReference";

const ROW = {
  id: 7,
  candidateId: 42,
  provenance: "consented" as const,
  storageKey: "casting-v2/reference/abc.png",
  digest: "d".repeat(64),
  mime: "image/png",
  width: 1024,
  height: 1024,
};

function deps(over: Partial<ResolveAskReferenceDependencies> = {}): ResolveAskReferenceDependencies {
  return {
    enabled: () => true,
    read: vi.fn(async () => ROW),
    ...over,
  };
}

describe("the road's own flag is asked FIRST", () => {
  it("refuses an account outside it", async () => {
    const read = vi.fn(async () => ROW);
    const resolved = await resolveAskReference(
      { userId: 1, referencePublicId: "ref", candidateId: 42 },
      deps({ enabled: () => false, read }),
    );
    expect(resolved).toBeNull();
  });

  /* THE CHEAPEST REFUSAL IS THE ONE THAT NEVER ASKS — and it is not only about
     cost. A handle read for a user no road can serve is a photograph looked up
     on behalf of a feature that cannot act on it. */
  it("does not touch the database to do it", async () => {
    const read = vi.fn(async () => ROW);
    await resolveAskReference(
      { userId: 1, referencePublicId: "ref", candidateId: 42 },
      deps({ enabled: () => false, read }),
    );
    expect(read).not.toHaveBeenCalled();
  });
});

describe("ownership is decided in the statement that reads (invariant 1)", () => {
  it("passes the session's user id into the read, never the input's", async () => {
    const read = vi.fn(async () => ROW);
    await resolveAskReference(
      { userId: 9, referencePublicId: "ref-abc", candidateId: 42 },
      deps({ read }),
    );
    expect(read).toHaveBeenCalledWith({ userId: 9, attachmentPublicId: "ref-abc" });
  });

  it("refuses a handle that resolves to nothing", async () => {
    const resolved = await resolveAskReference(
      { userId: 9, referencePublicId: "ref", candidateId: 42 },
      deps({ read: vi.fn(async () => null) }),
    );
    expect(resolved).toBeNull();
  });
});

describe("THE ONE A CARELESS VERSION WOULD SKIP — re-anchoring to this Cast", () => {
  /*
    Hers, valid, and attached to a DIFFERENT Cast. Both questions above pass and
    it is still not this ask's reference. Verifying the handle would not have
    caught it, which is the whole of invariant 2 in one case.
  */
  it("refuses her own attachment when it belongs to another Cast", async () => {
    const resolved = await resolveAskReference(
      { userId: 9, referencePublicId: "ref", candidateId: 43 },
      deps({ read: vi.fn(async () => ({ ...ROW, candidateId: 42 })) }),
    );
    expect(resolved).toBeNull();
  });

  it("admits it when the Cast matches", async () => {
    const resolved = await resolveAskReference(
      { userId: 9, referencePublicId: "ref", candidateId: 42 },
      deps(),
    );
    expect(resolved).not.toBeNull();
  });
});

describe("what comes back", () => {
  it("carries the storage key and the claimed provenance", async () => {
    const resolved = await resolveAskReference(
      { userId: 9, referencePublicId: "ref", candidateId: 42 },
      deps(),
    );
    expect(resolved).toEqual({
      id: 7,
      storageKey: "casting-v2/reference/abc.png",
      provenance: "consented",
      digest: "d".repeat(64),
      mime: "image/png",
      width: 1024,
      height: 1024,
    });
  });

  /*
    AND NEVER A URL. An attachment's object sits at a permanently public
    address, so a URL minted before something needs bytes outlives every reason
    it was minted for — asserted as an ABSENCE because that is what it is.
  */
  it("hands out no address of any kind", async () => {
    const resolved = await resolveAskReference(
      { userId: 9, referencePublicId: "ref", candidateId: 42 },
      deps(),
    );
    const serialized = JSON.stringify(resolved);
    expect(serialized).not.toMatch(/https?:/);
    expect(Object.keys(resolved ?? {})).not.toContain("url");
  });
});
