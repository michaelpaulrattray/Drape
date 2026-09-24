/**
 * THE INK STUDIO'S ENTRANCE IS GONE, AND CANNOT COME BACK UNNOTICED — #1158
 * slice 1, on his ruling of 2026-09-24 (Crew reply #208): *"It retires with N2"*.
 *
 * `server/castingV2InkUpload.test.ts` drove that procedure and left with it.
 * This file is what stands in its place, and it exists because a retirement
 * that deletes a door and nothing else leaves no failing test the day somebody
 * adds it back — which is how the three path-one controls in `CLAUDE.md` came
 * to be documented for months as things the product did.
 *
 * # ⚠ WHY HALF OF THIS FILE IS A POSITIVE CONTROL
 *
 * An absence assertion is the single easiest arm in this repository to pass for
 * the wrong reason: `procedures["ink.upload"] === undefined` is equally true of
 * a retired procedure, a renamed one, a typo in the key, and **a router that
 * threw on import and never registered anything at all**. So the absence is
 * never asserted alone here. Every arm below pairs it with `ink.remove` —
 * present in the same map, and DRIVEN through the real caller so the map is
 * proved to describe a router that actually works.
 *
 * # ⚠ AND `remove` IS NOT MERELY A CONVENIENT CONTROL — IT IS THE SCOPE
 *
 * Two doors mint a `casting_ink_designs` row and neither is the other's parent:
 * the studio's upload, which this card retires, and the take from an attached
 * picture (`CASTING_INK_REFERENCE_SCOPE`, whose parent is the attach door).
 * **He HELD that second road and moved it to N3** — Crew reply #213. So the
 * table keeps a live writer, and the one door that lets a customer delete a
 * picture of her own that we are still holding must survive the cleanup.
 *
 * A future slice that takes `remove` out reddens this file, and that is
 * deliberate: it should have to argue with his hold rather than slip past it.
 *
 * The census, the four roads and every module this card may NOT touch:
 * `docs/specs/INK_STUDIO_RETIREMENT_2026-09-24.md`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const removed = vi.fn();

vi.mock("./db/castingV2InkDesignRemoval", () => ({
  removeInkDesign: (...args: unknown[]) => removed(...args),
}));

const { castingV2Router } = await import("./routes/castingV2");

/* tRPC keys its procedure map by dotted path, so this is the callable id a
   client would actually send — not a property of some nested object that a
   restored procedure could hide behind. */
function procedureIds(): string[] {
  return Object.keys((castingV2Router as unknown as {
    _def: { procedures: Record<string, unknown> };
  })._def.procedures);
}

function caller(userId = 1) {
  return castingV2Router.createCaller({
    user: { id: userId, approved: true, role: "user" },
  } as never);
}

/* A real public id, because the procedure's own schema is a uuid and a shape
   that fails validation would exercise the wire instead of the door. */
const DESIGN = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  removed.mockResolvedValue({ designPublicId: DESIGN, remaining: 0 });
});

describe("the studio's upload door is retired", () => {
  it("is absent from the router, while its surviving sibling is present", () => {
    const ids = procedureIds();
    /* THE POSITIVE CONTROL FIRST, on purpose. If this map is empty or
       malformed, the absence below means nothing, and reading it in this order
       is what makes a broken import look like a broken import. */
    expect(ids).toContain("ink.remove");
    expect(ids).not.toContain("ink.upload");
  });

  it("leaves no ink procedure behind but the removal", () => {
    /* Derived, never a second list (working law 4): whatever the namespace
       holds is read back out of the router itself. A slice that adds an ink
       procedure has to come through here and say so. */
    const inkIds = procedureIds().filter((id) => id.startsWith("ink."));
    expect(inkIds).toEqual(["ink.remove"]);
  });

  it("the surviving door still works — the control, driven rather than listed", async () => {
    /* The held reference road still mints design rows, so this is the promise
       that must not have been swept up with the studio: a customer can still
       destroy a picture of her own that we are holding. */
    await expect(caller().ink.remove({ designId: DESIGN })).resolves.toEqual({
      designId: DESIGN,
      remaining: 0,
    });
    expect(removed).toHaveBeenCalledWith({ userId: 1, designPublicId: DESIGN });
  });

  it("the flag that gated the door reaches no procedure any more", () => {
    /* The four flags leave the service in slice 4, not here — an unset flag
       over live code is the opposite of what #203 slice 1 did. What is true
       from THIS commit is that no procedure consults the studio scope, and a
       flip of it in either direction changes nothing a client can call. */
    for (const position of ["off", "all", "users:1"]) {
      process.env.CASTING_INK_STUDIO_SCOPE = position;
      expect(procedureIds().filter((id) => id.startsWith("ink."))).toEqual(["ink.remove"]);
    }
    delete process.env.CASTING_INK_STUDIO_SCOPE;
  });
});
