/**
 * THE INK STUDIO'S DOOR, AT THE WIRE.
 *
 * The service's order is proved in `castingV2/inkUploadService.test.ts` and its
 * decisions in `castingV2/inkUploadDoor.test.ts`. This file drives the
 * PROCEDURE — the schema that is actually on it, the flag that is actually
 * consulted, and the errors a customer actually receives — because every one of
 * those is a promise made at the boundary and provable only there.
 *
 * The three it exists for:
 *
 *   - **the flag is asked before anything else happens.** Off, there is no such
 *     thing as an ink upload, and no byte moves.
 *   - **`userId` comes from the session, never from input** (invariant 3), and
 *     the schema is `.strict()`, so a field nobody expected is a refusal rather
 *     than a silent drop.
 *   - **the vocabulary is the wire's own contract.** `forearm` is the word that
 *     returned upper-arm skin from the opposite side of the body on three
 *     frames of four; it is refused here, by the closed list, and not by a
 *     reader's opinion later.
 */
import { readFile } from "node:fs/promises";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { INK_DESIGNS_PER_CANDIDATE } from "./castingV2/inkUploadDoor";

const uploaded = vi.fn();

vi.mock("./castingV2/inkUploadService", async () => {
  const real = await vi.importActual<typeof import("./castingV2/inkUploadService")>(
    "./castingV2/inkUploadService",
  );
  return { ...real, uploadInkDesign: (...args: unknown[]) => uploaded(...args) };
});

const { castingV2Router } = await import("./routes/castingV2");
const { InkDesignCapError, InkDesignOwnershipError } = await import("./db/castingV2InkDesigns");

const CANDIDATE = "11111111-1111-4111-8111-111111111111";
/* A real 1×1 PNG, so the base64 is a picture rather than a shape. What it is a
   picture OF does not matter here — the service is mocked; the schema is the
   subject. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function caller(userId = 1) {
  return castingV2Router.createCaller({
    user: { id: userId, approved: true, role: "user" },
  } as never);
}

const ask = {
  candidateId: CANDIDATE,
  placement: "upperArm" as const,
  side: "left" as const,
  provenance: "consented" as const,
  intents: ["tattoo"] as const,
  imageBase64: PNG_BASE64,
};

function armed(): void {
  process.env.CASTING_INK_STUDIO_SCOPE = "users:1";
  process.env.CASTING_REPAINT_SCOPE = "users:1";
  process.env.CASTING_REFERENCE_LIBRARY_SCOPE = "users:1";
  process.env.CASTING_V2_SCOPE = "users:1";
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of [
    "CASTING_INK_STUDIO_SCOPE",
    "CASTING_REPAINT_SCOPE",
    "CASTING_REFERENCE_LIBRARY_SCOPE",
    "CASTING_V2_SCOPE",
  ]) delete process.env[key];
  uploaded.mockResolvedValue({
    ok: true,
    design: {
      publicId: "design-1",
      candidateId: 42,
      placement: "upperArm",
      side: "left",
      provenance: "consented",
      intents: ["tattoo"],
      storageKey: "casting-v2/ink/abc.png",
      createdAt: new Date("2026-08-18T00:00:00Z"),
      width: 900,
      height: 1200,
    },
  });
});

describe("the door is shut unless the studio is open for this account", () => {
  it("refuses with NOT_FOUND when the flag is off, and stores nothing", async () => {
    /* The MESSAGE as well as the code: tRPC answers NOT_FOUND for a procedure
       that does not exist at all, so a code-only assertion would pass just as
       happily against a router with no ink namespace in it. */
    await expect(caller().ink.upload(ask)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "No such thing.",
    });
    expect(uploaded).not.toHaveBeenCalled();
  });

  it("refuses a user the parent chain does not cover", async () => {
    /* The whole chain at the point of use — the studio flag naming a user is
       not enough if the repaint road below it does not. */
    armed();
    process.env.CASTING_REPAINT_SCOPE = "off";
    await expect(caller().ink.upload(ask)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "No such thing.",
    });
    expect(uploaded).not.toHaveBeenCalled();
  });

  it("lets a covered user through", async () => {
    armed();
    const result = await caller().ink.upload(ask);
    expect(result).toMatchObject({ designId: "design-1", placement: "upperArm", side: "left" });
    expect(uploaded).toHaveBeenCalledTimes(1);
  });
});

describe("what the wire accepts", () => {
  beforeEach(armed);

  it("takes the account from the session and refuses one sent as input", async () => {
    await caller(1).ink.upload(ask);
    expect(uploaded.mock.calls[0]![0]).toMatchObject({ userId: 1, candidatePublicId: CANDIDATE });

    await expect(caller(1).ink.upload({ ...ask, userId: 2 } as never))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses an unknown field rather than dropping it", async () => {
    await expect(caller().ink.upload({ ...ask, notes: "for my sister" } as never))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(uploaded).not.toHaveBeenCalled();
  });

  it("refuses a placement the photograph has not been measured to contain", async () => {
    /*
      `forearm` is not a typo — it is the word that returned upper-arm skin from
      the OPPOSITE SIDE of the body, confidently labelled, on three frames of
      four. Sixteen production masters are cropped above the elbow. The closed
      list refuses it at the wire, before a reader is ever asked.
    */
    await expect(caller().ink.upload({ ...ask, placement: "forearm" } as never))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(uploaded).not.toHaveBeenCalled();
  });

  it("refuses an unknown side and an unknown provenance, and demands both", async () => {
    await expect(caller().ink.upload({ ...ask, side: "either" } as never))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    /* A guessed provenance is exactly the value the fence cannot tolerate, so
       there is no default to fall back to. */
    const { provenance: _dropped, ...withoutProvenance } = ask;
    await expect(caller().ink.upload(withoutProvenance as never))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().ink.upload({ ...ask, provenance: "found online" } as never))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(uploaded).not.toHaveBeenCalled();
  });

  it("demands a declaration, and refuses one it has never heard of", async () => {
    /*
      Ruled fable-937: the schema carries the intent field now. An upload with
      no declaration is refused at the wire; an unknown feature name is refused
      by the closed vocabulary rather than stored as a string somebody typed.
    */
    const { intents: _dropped, ...undeclared } = ask;
    await expect(caller().ink.upload(undeclared as never))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().ink.upload({ ...ask, intents: [] } as never))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().ink.upload({ ...ask, intents: ["freckles"] } as never))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(uploaded).not.toHaveBeenCalled();
  });

  it("hands the declaration to the service exactly as it arrived", async () => {
    /* Multi-intent is legal at the wire; whether both halves are BUILT is the
       door's question, one layer in. Asserted at the wire rather than beside
       the schema (invariant 5). */
    await caller().ink.upload({ ...ask, intents: ["tattoo", "hair"] } as never);
    expect(uploaded.mock.calls[0]![0]).toMatchObject({ intents: ["tattoo", "hair"] });
  });

  it("refuses bytes that are not base64 at all", async () => {
    await expect(caller().ink.upload({ ...ask, imageBase64: "not base64 !!!" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(uploaded).not.toHaveBeenCalled();
  });

  it("refuses a payload too large to be worth decoding", async () => {
    await expect(caller().ink.upload({ ...ask, imageBase64: "A".repeat(20_000_000) }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(uploaded).not.toHaveBeenCalled();
  });
});

describe("what a customer is told when it does not work", () => {
  beforeEach(armed);

  it("speaks the door's own sentence on a refusal", async () => {
    uploaded.mockResolvedValue({
      ok: false,
      refusal: { code: "tooSmall", message: "That image is too small to draw from." },
    });
    await expect(caller().ink.upload(ask)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "That image is too small to draw from.",
    });
  });

  it("says NOT FOUND about somebody else's Cast — the same as a missing one", async () => {
    uploaded.mockRejectedValue(new InkDesignOwnershipError("candidate"));
    await expect(caller().ink.upload(ask)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("says TOO MANY REQUESTS at the cap, with a real code and not a 200", async () => {
    /* Invariant 6: a limit that answers 200 with an error field is a limit the
       client cannot tell from a validation failure. */
    uploaded.mockRejectedValue(new InkDesignCapError());
    const error = await caller().ink.upload(ask).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect((error as TRPCError).message).toContain(String(INK_DESIGNS_PER_CANDIDATE));
  });
});

describe("nothing is charged for it", () => {
  /*
    Ruled fable-921 §3b: no charge path opens while the mannequin template is
    unanswered — an upload that cannot deliver is a promise the product cannot
    keep. Proved on the source of the namespace itself rather than remembered,
    because "we did not add a charge" is the kind of claim that stops being true
    in somebody else's commit.
  */
  function inkNamespaceSource(source: string): string {
    const opened = source.indexOf("const inkRouter = router({");
    if (opened < 0) throw new Error("no `const inkRouter = router({` in the casting router");
    let depth = 0;
    for (let at = opened; at < source.length; at += 1) {
      if (source[at] === "{") depth += 1;
      if (source[at] === "}") {
        depth -= 1;
        if (depth === 0) return source.slice(opened, at + 1);
      }
    }
    throw new Error("the ink namespace never closes");
  }

  const SPEND = /withAtomicCredits|spendCredits|pointsCost|PRICE_CREDITS|createGeneration/;

  it("has no credit vocabulary anywhere in the ink namespace", async () => {
    const source = await readFile("server/routes/castingV2.ts", "utf8");
    expect(inkNamespaceSource(source)).not.toMatch(SPEND);
  });

  it("and the reader would have found one — the positive control", async () => {
    /* The extractor and the pattern, driven against a namespace that DOES
       charge. Without this arm a broken extractor reads as "nothing charges". */
    const charging = [
      "const inkRouter = router({",
      "  upload: protectedProcedure.mutation(async () => {",
      "    await withAtomicCredits({ amount: 1 }, async () => null);",
      "  }),",
      "});",
    ].join("\n");
    expect(inkNamespaceSource(charging)).toMatch(SPEND);
  });
});
