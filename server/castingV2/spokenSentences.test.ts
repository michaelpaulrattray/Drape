/**
 * FIVE SENTENCES WE WROTE FOR HER, AND WHETHER THEY REACH HER.
 *
 * # The incident
 *
 * Run-15 step 2 was refused honestly at 293.0s, with the server's own sentence
 * on the receipt — *"That one came back twice without fox eyes, so it wasn't
 * delivered and your credits have been returned."* At 323.6s the panel showed
 * her *"We lost contact while that was rendering"*. The honest answer existed
 * thirty seconds before she was told the transport had lost it.
 *
 * The severity is not the vagueness. THREE of the five sentences below say
 * **"Nothing was charged"**, and the substitute promises her credits will come
 * back on their own — money language wrong in the other direction, on the one
 * surface where a person is working out whether they paid.
 *
 * # What this pins, and why in two halves
 *
 * The end-to-end path is: throw site → error formatter → client copy rule. Each
 * half is driven directly here, and the join is the flag's one spelling in
 * `shared/spokenError`, imported by both.
 *
 *   1. THE FORMATTER puts `spoken` on the payload for an authored error and on
 *      nothing else — asserted on the shape that goes out, not on a constant.
 *   2. THE CLIENT RULE shows a spoken sentence verbatim, whatever its code.
 *   3. THE SITES still author these sentences AS spoken — a source sweep, so
 *      converting one back to a bare `TRPCError` fails here rather than in
 *      production six weeks later. This is the half that closes the class: the
 *      first four sentences were written correctly and reached nobody.
 */
import { readFileSync } from "node:fs";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { errorIsSpoken } from "@shared/spokenError";
import { readableFailure } from "../../client/src/features/castingV2/failureCopy";
import { spokenError, withSpokenFlag } from "../_core/spokenError";

/**
 * The five, by the fragment that identifies each in its source file.
 *
 * Fragments rather than whole sentences: the wording may be improved, and a
 * test that pins prose becomes a tax on writing. What must not change is that
 * each of these is authored as SPOKEN.
 */
const SITES = [
  { file: "server/castingV2/refineService.ts", says: "quietly dropped one of your earlier changes" },
  { file: "server/castingV2/refineService.ts", says: "argued with one of your earlier changes" },
  { file: "server/castingV2/refineService.ts", says: "asked for a change and forbidden it in the same breath" },
  { file: "server/castingV2/refineService.ts", says: "That refinement didn't come through" },
  { file: "server/castingV2/signService.ts", says: "The Cast couldn't be signed" },
];

describe("a sentence written for a customer reaches the customer", () => {
  it("the formatter marks an authored error, and only an authored one", () => {
    const authored = spokenError({ code: "INTERNAL_SERVER_ERROR", message: "Your credits have been returned." });
    const crash = new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "read ECONNRESET" });

    const marked = withSpokenFlag({ message: authored.message, data: { code: "INTERNAL_SERVER_ERROR" } }, authored);
    const plain = withSpokenFlag({ message: crash.message, data: { code: "INTERNAL_SERVER_ERROR" } }, crash);

    expect(errorIsSpoken(marked)).toBe(true);
    expect(errorIsSpoken(plain), "an unhandled crash is never her sentence").toBe(false);
    /* The existing payload survives — the marker adds, it does not replace. */
    expect(marked.data.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("the client shows a spoken sentence verbatim, whatever the code", () => {
    const refusal = {
      message: "That one came back twice without fox eyes, so it wasn't delivered and your "
        + "credits have been returned. Try saying it a different way.",
      data: { code: "INTERNAL_SERVER_ERROR", spoken: true },
    };
    expect(readableFailure(refusal, "We lost contact.")).toBe(refusal.message);

    /* And the defect itself: the same sentence WITHOUT the marker, on the code
       it used to ride, is still replaced — which is what happened to her. */
    const asItShipped = { message: refusal.message, data: { code: "INTERNAL_SERVER_ERROR" } };
    expect(readableFailure(asItShipped, "We lost contact.")).toBe("We lost contact.");
  });

  it("a gateway's sentence is still never shown", () => {
    /* The rule this must not weaken. A transport cannot set `spoken`, so its
       sentence keeps meeting the fallback — run-9's parser error on a paid
       surface is the reason the rule exists. */
    expect(readableFailure(new Error("upstream error"), "We lost contact.")).toBe("We lost contact.");
    expect(readableFailure({ message: "502 Bad Gateway", data: { code: "INTERNAL_SERVER_ERROR" } }, "We lost contact."))
      .toBe("We lost contact.");
  });

  it("every one of the five sites still authors its sentence as spoken", () => {
    for (const site of SITES) {
      const source = readFileSync(site.file, "utf8");
      const at = source.indexOf(site.says);
      expect(at, `"${site.says}" has left ${site.file} — update this sweep with it`).toBeGreaterThan(-1);
      /*
        The throw that carries it, found by walking back to the nearest call
        opening. A sentence composed by `spokenError(` is marked; one composed
        by `new TRPCError({` is not, and that is the whole defect.
      */
      /* The whole prefix, not a window: a fixed lookback fails the moment the
         throw grows a comment, and the question is only ever which call opened
         nearest before the sentence. */
      const before = source.slice(0, at);
      const spokenAt = before.lastIndexOf("spokenError({");
      const bareAt = before.lastIndexOf("new TRPCError({");
      expect(spokenAt, `${site.file}: "${site.says}" is not authored by spokenError`).toBeGreaterThan(-1);
      expect(spokenAt, `${site.file}: "${site.says}" was reverted to a bare TRPCError`).toBeGreaterThan(bareAt);
    }
  });
});
