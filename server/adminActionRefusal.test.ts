/**
 * What the product ACTUALLY does with an admin action name it does not
 * recognise — driven against the real handlers, under NO doubles.
 *
 * ⚠ THIS FILE EXISTS BECAUSE A COMMENT IN `adminActionDispatch.test.ts` SAID
 * THE OPPOSITE, AND THE ARM IT SAT ON COULD NEVER HAVE CAUGHT IT.
 *
 * Until 2026-08-25 that arm was titled *"an UNKNOWN action falls through to
 * the direct handler rather than throwing"* and carried, as a stated product
 * property: *"the dispatcher has no default refusal, so a typo in a cr_ name
 * does not error — it silently takes the other road."* It was filed from there
 * into `lib/adminActions/index.ts` and onto the roadmap as an open product
 * question about admin money actions.
 *
 * The routing half is true. **The "does not error" half is false of the
 * product.** Both handlers end in a `default:` that throws, so an unrecognised
 * name is refused on whichever road it lands on, and there is no unrefused
 * path at all.
 *
 * The reason the original arm could not have found this is the reusable part:
 * it replaced BOTH handlers with `vi.fn().mockResolvedValue(...)`. A double
 * that cannot throw makes "and it does not throw" true before the subject is
 * reached — so the conclusion was a property of the mock, not of the code.
 * (The sibling shape is legitimate and common in this suite: a mock made to
 * REJECT, proving the code under test swallows it. There the mock is the
 * premise. Here it was the conclusion.)
 *
 * These arms are the reading. A `default:` deleted from either handler reddens
 * one of them.
 */
import { describe, it, expect } from "vitest";
import { executeApprovedAdminAction } from "./lib/adminActions";
import { executeDirectAction } from "./lib/adminActions/directActions";
import { executeChangeRequestAction } from "./lib/adminActions/changeRequestActions";

const CTX = {
  user: { id: 1, name: "Admin", email: "admin@example.com", role: "admin" },
  req: { headers: {} },
  res: {},
} as never;

/** No `changeRequestId`, no amount — every arm here refuses before any of it is read. */
function unknown(action: string) {
  return { action, targetId: "42", params: {}, resolvedBy: "tester" } as never;
}

describe("an unrecognised admin action is REFUSED, on both roads", () => {
  it("the DIRECT handler refuses a name it does not recognise", async () => {
    await expect(executeDirectAction(unknown("cr_suspendUserr"), CTX)).rejects.toThrow(
      "Unknown direct action type: cr_suspendUserr",
    );
  });

  it("the CHANGE-REQUEST handler refuses a name it does not recognise", async () => {
    await expect(executeChangeRequestAction(unknown("cr_notAThing"), CTX)).rejects.toThrow(
      "Unknown change request action type: cr_notAThing",
    );
  });

  it("so a typo'd cr_ name reaching the DISPATCHER errors — it does not run as an admin action", async () => {
    // The arm that replaces the false comment. `cr_refundCreditss` is
    // `cr_refundCredits` with one character added: the dispatcher's set does
    // not hold it, it is routed to the direct road, and the direct road
    // refuses. Nothing is executed and no change request is silently left
    // unsettled, because nothing runs at all.
    await expect(
      executeApprovedAdminAction(unknown("cr_refundCreditss"), CTX),
    ).rejects.toThrow(/^Unknown/);
  });

  it("⚠ and the refusal it meets names the OTHER road — the one true remnant, pinned", async () => {
    // What survives of the original worry, and it is diagnostic rather than
    // monetary: because the dispatcher routes by membership rather than by
    // prefix, a `cr_`-shaped typo is refused BY THE DIRECT ROAD, so the
    // operator reading the failure is told about a "direct action type". The
    // behaviour is safe; the message points at the wrong handler. Pinned so
    // that changing it is a decision rather than a discovery.
    await expect(
      executeApprovedAdminAction(unknown("cr_refundCreditss"), CTX),
    ).rejects.toThrow("Unknown direct action type: cr_refundCreditss");
  });

  it("CONTROL — a name the direct road DOES recognise is not refused by this route", async () => {
    // Without this, all four arms above would pass against a handler that
    // threw unconditionally, and the population would be untested. It gets as
    // far as the real work and fails there instead ("User not found" — no test
    // database), which is a different failure and proves the `default:` was
    // not what stopped it.
    await expect(executeDirectAction(unknown("suspendUser"), CTX)).rejects.not.toThrow(
      /^Unknown direct action type/,
    );
  });
});
