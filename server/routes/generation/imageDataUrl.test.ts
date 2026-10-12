/**
 * `generation.proxyImage` — THE MOVE OUT OF THE RETIRING FILE, AND THE READER
 * IT NOW GOES THROUGH (#2315 step 2 item 1).
 *
 * Two contracts are pinned here and they fail for different reasons:
 *
 *  1 · **the callable id survived the move** — four client files and
 *      `geminiPhase2Migration.test.ts` name `generation.proxyImage`, and the
 *      whole point of moving the procedure rather than rewriting the clients is
 *      that the wire does not change. An arm asserts it is in the flat
 *      namespace AND that it is no longer on `castingRefinementRouter`, so the
 *      move is pinned in both directions and a half-done revert is red.
 *
 *  2 · **it does not fetch for itself.** The old body called bare `fetch`, which
 *      FOLLOWS REDIRECTS, while the allowlist is consulted once on the input —
 *      so the redirect target was validated by nothing (#2348). The repair is
 *      that the reader is `fetchTrustedImage` ITSELF, where `redirect: "error"`
 *      lives, pinned at the wire in
 *      `server/security/trustedImageFetch.test.ts`.
 *
 * ⚠ **The identity arm is the one worth reading twice, and it is written this
 * way because the first version of it did not work.** It originally asserted
 * the reader's BEHAVIOUR — that it rejects a host outside the allowlist — and
 * the sabotage that puts a bare `fetch` back came back GREEN, because a bare
 * fetch rejects on DNS too. An injected or spied reader can never redirect, so
 * no behavioural arm in this file can see the difference that matters. Only the
 * identity can, and it is captured at MODULE LOAD (`WIRED_AT_LOAD`) so a spy
 * installed by a neighbouring arm cannot make it pass or fail by accident.
 *
 * ⚠ The negative control is the second: a refused host must be refused BEFORE
 * any outbound request, so that arm asserts the reader was called ZERO times
 * rather than merely that the call threw. A guard that only checks the error
 * cannot tell "refused it" from "fetched it and then refused".
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { imageDataUrlReader, imageDataUrlRouter } from "./imageDataUrl";
import { fetchTrustedImage, type TrustedImage } from "../../security/trustedImageFetch";

/* Captured before any arm can install a spy. */
const WIRED_AT_LOAD = imageDataUrlReader.fetchImage;

/* A real PNG header and a real JPEG header, so the mime the reader derives is
   derived from bytes rather than from a string this file also wrote. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);

const ALLOWED = "https://files.manuscdn.com/cast/one.png";
const REFUSED = "https://evil.example.com/cast/one.png";

/* `protectedProcedure` is `requireUser` + `requireApproved`, so the fixture
   carries both — an unapproved user answers FORBIDDEN before the body runs and
   every arm below would pass for the wrong reason. */
const APPROVED = { id: 42, approved: true, suspendedAt: null, lockedUntil: null };
const caller = () => imageDataUrlRouter.createCaller({ user: APPROVED } as never);

function readerReturning(image: TrustedImage) {
  return vi.spyOn(imageDataUrlReader, "fetchImage").mockResolvedValue(image);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generation.proxyImage — after the move out of castingRefinement", () => {
  it("returns the bytes as a data URL whose mime comes from the BYTES, not a header", async () => {
    const reader = readerReturning({ bytes: JPEG, mime: "image/jpeg" });
    const result = await caller().proxyImage({ imageUrl: ALLOWED });

    expect(reader).toHaveBeenCalledWith(ALLOWED);
    expect(result.success).toBe(true);
    /* The old body wrote the response's content-type header here. A dev
       `board_items` object is served `image/png` with JPEG bytes, and
       `ImageActionBar` keys a ClipboardItem off this very string. */
    expect(result.base64.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(result.base64.endsWith(JPEG.toString("base64"))).toBe(true);
  });

  it("refuses a host outside the allowlist BEFORE any outbound request", async () => {
    const reader = readerReturning({ bytes: PNG, mime: "image/png" });
    await expect(caller().proxyImage({ imageUrl: REFUSED })).rejects.toThrow(
      /URL not allowed/,
    );
    /* The control that matters: nothing left the building. */
    expect(reader).toHaveBeenCalledTimes(0);
  });

  it("answers a refused read with the same opaque message as before the move", async () => {
    vi.spyOn(imageDataUrlReader, "fetchImage").mockRejectedValue(
      new Error("whatever the reader refused on"),
    );
    const error = await caller()
      .proxyImage({ imageUrl: ALLOWED })
      .then(() => null, (e: unknown) => e as TRPCError);

    expect(error).toBeInstanceOf(TRPCError);
    expect(error?.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error?.message).toBe("Failed to fetch image");
  });

  it("rejects an undeclared input key (invariant 4 — strict on new code)", async () => {
    const reader = readerReturning({ bytes: PNG, mime: "image/png" });
    await expect(
      (caller().proxyImage as (input: unknown) => Promise<unknown>)({
        imageUrl: ALLOWED,
        follow: true,
      }),
    ).rejects.toThrow();
    expect(reader).toHaveBeenCalledTimes(0);
  });

  it("reads through fetchTrustedImage in production — the arm that reddens on a bare fetch", () => {
    /* IDENTITY, by reference, for the reason in this file's header: every
       behavioural arm above is satisfied by a bare fetch too. `redirect:
       "error"`, the 15 s timeout, the 20 MB bounded read and the magic-byte
       check are that function's own contracts and are pinned at the wire in
       `server/security/trustedImageFetch.test.ts`. This arm is the link between
       that file and this procedure. */
    expect(WIRED_AT_LOAD).toBe(fetchTrustedImage);
  });
});

describe("the move itself", () => {
  it("keeps the callable id on `generation` and takes it off the retiring router", async () => {
    const { generationRouter } = await import("./index");
    expect(generationRouter._def.procedures).toHaveProperty("proxyImage");

    const { castingRefinementRouter } = await import("./castingRefinement");
    /* Pinned in both directions: a revert that re-adds it to the retiring file
       without removing it here would leave two declarations of one id. */
    expect(castingRefinementRouter._def.procedures).not.toHaveProperty("proxyImage");
    expect(castingRefinementRouter._def.procedures).toHaveProperty("enhance");
  });
});
