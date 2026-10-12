/**
 * ONE ALLOWLISTED PICTURE, AS A DATA URL — the procedure the canvas, the export
 * pack and the studio's image bar use when JavaScript needs the BYTES in the
 * page (a zip entry, a clipboard item, a blob download) rather than a `src`.
 *
 * # Why it is its own module (#2315, step 2 item 1)
 *
 * It lived inside `castingRefinement.ts`, which is the legacy casting refine
 * route his word of 2026-10-12 retires: *"older casting refine route is getting
 * retired // id retire the paths and remove the key"*. **This procedure has
 * nothing to do with Gemini, or with refining anything** — it validates a URL
 * against the allowlist and returns the bytes as a data URL — and it is reached
 * by three surfaces that are NOT being retired. Deleting that file as "the
 * legacy refine route" would therefore have taken a live control with it:
 * working law 7's path-three death, written in advance, with no failing test
 * and no error. So it moves out BEFORE anything there is deleted.
 *
 * ⚠ **The callable id does not change.** `generation.proxyImage` is what four
 * client files call and what `geminiPhase2Migration.test.ts` pins; this router
 * is spread into the same flat `generation` namespace by `./index.ts`, so the
 * move is invisible from the wire. The FILE is named for what the procedure
 * does because `routes/imageProxy.ts` already exists one directory up, and two
 * files differing only in word order is a trap for the next reader.
 *
 * # ⚠ AND IT DOES NOT CARRY ITS OWN `fetch` ANY MORE — the reason the move is
 * not a copy
 *
 * The old body called bare `fetch(input.imageUrl)`. **Bare `fetch` follows
 * redirects**, and the allowlist is consulted exactly once, on the INPUT url,
 * before that call — so the redirect TARGET was validated by nothing. Measured
 * on this runtime (node v26.7.0) rather than reasoned: a 302 is followed,
 * `redirected=true`, and the target's body comes back in the response; the same
 * request with `redirect: "error"` throws. `ALLOWED_DOMAINS` in
 * `security/urlValidator.ts` matches `.cloudfront.net` and `.amazonaws.com` as
 * SUFFIXES, and anyone can obtain a hostname under either — so an approved
 * customer could point this at a host they control, have it redirect anywhere,
 * and read the answer base64-encoded. `#2348` carries that finding.
 *
 * The repair is not a new control: `security/trustedImageFetch.ts` is the
 * dedicated, proven reader this product already has for exactly this job, with
 * `redirect: "error"`, a 15 s timeout, a 20 MB cap read off a bounded stream, a
 * `content-type` check and magic-byte verification. **Six modules and
 * `/api/image-proxy` — this procedure's own Express twin, which does the same
 * job for an `<img>` — already read through it. This was the one place in the
 * product that consulted the allowlist and then fetched for itself**, derived
 * from every consumer of `validateProxyUrl` rather than sampled. The fidelity
 * law decides the rest: writing the bare fetch into new bytes would be the
 * convenient substitute shipped silently.
 *
 * **What that could have refused was measured before it was chosen, not after.**
 * Every `http` row of the two columns the surviving surfaces actually read —
 * `model_assets.storageUrl` (258) and `board_items.imageUrl` (44) — sits on the
 * single allowlisted R2 public host, and 0 of the objects sampled per column
 * would be refused on type, magic bytes or size (largest 6.0 MB against the
 * 20 MB cap).
 *
 * ⚠ **One answer does change, and it changes toward the truth.** The old body
 * put the response's `content-type` HEADER into the data URL; this puts the mime
 * `fetchTrustedImage` derives from the BYTES. A real dev `board_items` object is
 * served `image/png` while its bytes are JPEG — and `ImageActionBar`'s copy
 * path reads that mime back out of the data URL to key a `ClipboardItem`, so the
 * old road handed the browser jpeg bytes labelled png. The download path names
 * its file `.png` from a template either way.
 *
 * # What is deliberately NOT brought across, and why it is named rather than
 * quietly omitted
 *
 * `/api/image-proxy` also rate-limits at 60 requests a minute per user; this
 * procedure never has. It is **not** added here, because the canvas download
 * loops one call per selected item and the export pack one per asset, so a
 * per-minute cap is a feature-breaking change that needs its own measurement of
 * how many a real selection makes. Declared on `#2348` with that reasoning
 * instead of being assumed harmless in either direction.
 */
import { protectedProcedure, router } from "../../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { validateProxyUrl } from "../../security/urlValidator";
import {
  fetchTrustedImage,
  type TrustedImage,
} from "../../security/trustedImageFetch";
import { createModuleLogger } from "../../logging/logger";

const log = createModuleLogger("routes/generation");

/**
 * THE READER, AS A REPLACEABLE PROPERTY — and the shape is load-bearing, so do
 * not "tidy" it into a factory.
 *
 * ⚠ **This module's first draft was `createImageDataUrlRouter(deps)` with the
 * production router built by calling it, and the Architecture Atlas could not
 * see the procedure AT ALL.** `routerDeclarations` in
 * `scripts/generate-architecture.mts` collects `const x = router({…})` — a
 * variable whose initializer is a direct `router` call with an object literal —
 * so a router returned from a factory is invisible to it, and
 * `server/architectureProcedureShapes.test.ts` caught the disagreement: 287
 * procedures in the source against 286 in the map.
 *
 * That is not a cosmetic miss. The Atlas is **the deletion authority for the
 * legacy-retirement program** — nothing is removed while its retirement view
 * shows live callers — and this procedure exists precisely because a retirement
 * was about to delete it. A shape that hides it from that view, shipped under
 * that card, would have been the defect wearing the fix's clothes.
 *
 * So the router is declared INLINE below, and the one thing a suite needs to
 * replace lives here instead. `vi.spyOn(imageDataUrlReader, "fetchImage")` is
 * the seam (the house's own — 189 server suites mock or spy), and
 * `imageDataUrl.test.ts` captures this reference at module load so it can still
 * assert the production wiring by identity while a spy is installed.
 *
 * ⚠ It is the BARE `fetchTrustedImage` reference and not
 * `(url) => fetchTrustedImage(url)`, which is also load-bearing rather than
 * tidy. The wrapper was the first draft, and the sabotage arm for a bare-fetch
 * swap came back GREEN against it: a suite can only assert a wrapper's
 * BEHAVIOUR, and "rejects a host outside the allowlist" is true of a bare
 * `fetch` too — it rejects on DNS. The arm was a blind guard, true of both
 * states. An identity a suite can compare by reference is the only version of
 * this control that can fail.
 */
export const imageDataUrlReader: { fetchImage(url: string): Promise<TrustedImage> } = {
  fetchImage: fetchTrustedImage,
};

export const imageDataUrlRouter = router({
  proxyImage: protectedProcedure
    .input(z.object({
      imageUrl: z.string().url(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      /* The allowlist is checked HERE as well as inside the reader, so a
         refused host still answers BAD_REQUEST with the reason instead of the
         reader's one opaque error — the same two-step `/api/image-proxy` takes.
         It is one function called twice, not a second copy of the rule. */
      const validation = validateProxyUrl(input.imageUrl);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `URL not allowed: ${validation.reason}`,
        });
      }

      try {
        const image = await imageDataUrlReader.fetchImage(input.imageUrl);
        return {
          success: true,
          base64: `data:${image.mime};base64,${image.bytes.toString("base64")}`,
        };
      } catch (error) {
        /* The classification and the account, never the URL: a customer's
           object URL is the only thing protecting it (`storage.ts` — the bucket
           is public and the URLs are persisted, so they never expire), and the
           log is a staff-wide surface. This is the Express twin's shape; the
           reader's own error carries no URL to leak either way. */
        log.warn(
          {
            userId: ctx.user.id,
            errorType: error instanceof Error ? error.name : "unknown",
          },
          "[ProxyImage] refused",
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch image",
        });
      }
    }),
});
