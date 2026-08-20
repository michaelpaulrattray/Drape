/**
 * RESOLVING THE PICTURE AN ASK CAME WITH — the three questions, and the one a
 * careless version of this file would skip.
 *
 * Driven directly with injected dependencies rather than through the
 * interpreter or a database: every rule here is a decision about ownership and
 * scope, and a rule proven only through a model that usually behaves is a rule
 * that is untested (working law 3).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  askReferenceRoadOpen,
  resolveAskReference,
  type ResolveAskReferenceDependencies,
} from "./askReference";
import {
  CASTING_HAIR_REFERENCE_SCOPE_ENV,
  CASTING_INK_REFERENCE_SCOPE_ENV,
  CASTING_REFERENCE_ATTACH_SCOPE_ENV,
  CASTING_REFERENCE_LIBRARY_SCOPE_ENV,
  CASTING_REPAINT_SCOPE_ENV,
  CASTING_V2_SCOPE_ENV,
} from "./castingV2Scope";

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

/**
 * THE SHIPPED GATE ITSELF — the one predicate every arm above injects past
 * (added 2026-08-20 with the fix it would have caught, ruled fable-1163 §2).
 *
 * `resolveAskReference`'s gate was the HAIR flag for the whole life of the ink
 * road. Nothing here could see it: each arm supplies its own `enabled`, so the
 * suite proved the three ownership questions perfectly and never once asked the
 * shipped predicate a question. The defect surfaced in a browser, two runs
 * deep, as *"That picture isn't attached to this Cast any more"* — said about a
 * picture that was attached.
 *
 * These arms read the FLAGS, through the real captures, and the ink arm is the
 * drive's two lost runs turned into something that costs nothing to re-ask.
 */
describe("the shipped gate is the OR of the roads that can act on a picture", () => {
  const ENV = [
    CASTING_V2_SCOPE_ENV,
    CASTING_REFERENCE_LIBRARY_SCOPE_ENV,
    CASTING_REPAINT_SCOPE_ENV,
    CASTING_REFERENCE_ATTACH_SCOPE_ENV,
    CASTING_HAIR_REFERENCE_SCOPE_ENV,
    CASTING_INK_REFERENCE_SCOPE_ENV,
  ] as const;
  const held: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV) held[key] = process.env[key];
    /* The chain both roads hang from, so the arms below differ in ONE flag. */
    process.env[CASTING_V2_SCOPE_ENV] = "all";
    process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV] = "users:5";
    process.env[CASTING_REPAINT_SCOPE_ENV] = "users:5";
    process.env[CASTING_REFERENCE_ATTACH_SCOPE_ENV] = "users:5";
    delete process.env[CASTING_HAIR_REFERENCE_SCOPE_ENV];
    delete process.env[CASTING_INK_REFERENCE_SCOPE_ENV];
  });

  afterEach(() => {
    for (const key of ENV) {
      if (held[key] === undefined) delete process.env[key];
      else process.env[key] = held[key];
    }
  });

  it("opens for a HAIR-only account, exactly as it always did", () => {
    process.env[CASTING_HAIR_REFERENCE_SCOPE_ENV] = "users:5";
    expect(askReferenceRoadOpen(5)).toBe(true);
  });

  it("OPENS FOR AN INK-ONLY ACCOUNT — the defect this file could not see", () => {
    /*
      The whole finding in one line. Before the fix this was `false`, and the
      customer was told her attached picture was not attached.
    */
    process.env[CASTING_INK_REFERENCE_SCOPE_ENV] = "users:5";
    expect(askReferenceRoadOpen(5)).toBe(true);
  });

  it("stays shut when NO road can serve her", () => {
    /* The negative control: a picture resolved for an account no road serves is
       a photograph looked up on behalf of a feature that cannot act on it. */
    expect(askReferenceRoadOpen(5)).toBe(false);
  });

  it("is about THIS account, not about the flags being set at all", () => {
    process.env[CASTING_INK_REFERENCE_SCOPE_ENV] = "users:5";
    expect(askReferenceRoadOpen(6)).toBe(false);
  });
});
