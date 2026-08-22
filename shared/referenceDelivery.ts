/**
 * WHERE A PICTURE SHE ATTACHED IS LOOKED AT — the Use chip's own address
 * (founder ruling fable-1419 §2, route countersigned fable-1423 §2).
 *
 * His sentence: *"the only reference that go into that box are ones you use to
 * generate the previous image with … that way when i press use im essentially
 * regenerating the exact same prompt + reference image."* The chip shows the
 * picture she gave and Use gives it back.
 *
 * # ⚠ IT EXISTS BECAUSE THE PUBLIC BUCKET IS THE WRONG ANSWER, MEASURED
 *
 * The chip's thumbnail was built as `storagePublicUrl(key)` for every kind, and
 * on the founder's own render:
 *
 * ```
 * master             200   casting-v2/candidates/…
 * carry open:feet    200   casting-v2/library/…
 * source hair        404   casting-v2/reference-carrier/…
 * her ATTACHMENT     404   casting-v2/reference/…    three of three, live rows
 * ```
 *
 * **The 404 is the product working.** `askReference`'s own rule is that what
 * comes back to a caller is the storage KEY and never a URL, *"the address is
 * the only thing between a photograph of a person and a stranger"*. So there is
 * no public address for her photograph, there should not be, and the chip drew
 * a broken glyph until this route existed.
 *
 * # It serves the ATTACHMENT, never the carrier
 *
 * The `source` reference on a render is the CARRIER — the crop cut from her
 * picture for that one ask — and it is minted with a cleanup manifest and
 * swept. A thumbnail pointing at it would go broken with age even if it were
 * served. The attachment is kept, purged with her Cast, and is the thing she
 * recognises: her photograph rather than our crop of it.
 *
 * # Why the path lives here and not in the route that serves it
 *
 * The room that draws the picture is a client module and the route is a server
 * one, and the day both spell the path by hand is the day one of them is edited
 * (working law 4). One spelling, {@link referenceImagePath}.
 */

/** The route's own prefix. The server mounts `PREFIX/:referenceId` from this. */
export const REFERENCE_IMAGE_PATH_PREFIX = "/api/reference";

/**
 * The address of one attachment's bytes, for the account that owns it.
 *
 * An ordinary authenticated app URL, not a storage URL — see the route's header
 * for what that does and does not buy.
 */
export function referenceImagePath(attachmentPublicId: string): string {
  return `${REFERENCE_IMAGE_PATH_PREFIX}/${encodeURIComponent(attachmentPublicId)}`;
}

/**
 * How many attachment reads one account may make in a minute.
 *
 * A Cast holds at most eight attachments (`REFERENCE_PICTURES_PER_CANDIDATE`),
 * and the chip draws ONE — the picture the version on screen was made with — so
 * a room walking its whole version rail is a handful. Generous against that and
 * still bounding what a loop can pull. Every read is a bounded fetch of an
 * object this account already owns, so the limit is about cost, not secrecy.
 */
export const REFERENCE_READS_PER_MINUTE = 120;
