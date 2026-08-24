/**
 * WHERE A STORED DESIGN IS LOOKED AT — the shown cut's address (ruled
 * fable-1127 §2, ratified fable-1135 §4d).
 *
 * `CASTING_INK_CUT_SCOPE` changes what a customer's stored design IS: her
 * photograph goes in and the design alone, on transparency, is what lands at
 * `casting_ink_designs.storageKey`. A change to her own picture that she has no
 * way to look at is a change she cannot accept or reject.
 *
 * ⚠ **THIS SAID *"so the flip waits on this — opus-841 §4, both halves then one
 * flip"* UNTIL 2026-08-24, AND THE FLIP DID NOT WAIT.** The founder closed the
 * frames gate himself — *"yes its acceptable"* — and replaced that condition
 * with a narrower one of his own: **his account only until the customer-facing
 * preview ships** (fable-1257 §1). The flag was flipped on that word and
 * production holds `CASTING_INK_CUT_SCOPE=users:1` (fable-1260). So this path
 * serves the bytes today, 3a.2(b) — the room that DRAWS them — is still
 * unbuilt, and what the missing half now gates is WIDENING past `users:1`
 * rather than existing at all. `CLAUDE.md` took the same correction on
 * 2026-08-23; this copy is a day and a surface behind it.
 *
 * # Why the path lives in `shared/` and not in the route that serves it
 *
 * Because the room that draws the picture is a client module and the route is a
 * server one, and the day both spell the path by hand is the day one of them is
 * edited (working law 4). The server registers `PREFIX/:designId`; every caller
 * builds its address with {@link inkDesignImagePath}. There is exactly one
 * spelling of this address in the product.
 */

/** The route's own prefix. The server mounts `PREFIX/:designId` from this. */
export const INK_DESIGN_IMAGE_PATH_PREFIX = "/api/ink-design";

/**
 * The address of one design's bytes, for the account that owns it.
 *
 * It is an ordinary authenticated app URL, not a storage URL — see the route's
 * header for what that does and does not buy.
 */
export function inkDesignImagePath(designPublicId: string): string {
  return `${INK_DESIGN_IMAGE_PATH_PREFIX}/${encodeURIComponent(designPublicId)}`;
}

/**
 * How many design reads one account may make in a minute.
 *
 * A Cast holds at most eight designs (`INK_DESIGNS_PER_CANDIDATE`), so a room
 * showing all of them is eight requests; this is generous against that and
 * still bounds what a loop can pull. Every read is a bounded R2 fetch of an
 * object this account already owns, so the limit is about cost, not secrecy.
 */
export const INK_DESIGN_READS_PER_MINUTE = 120;
