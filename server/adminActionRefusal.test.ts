/**
 * What the product ACTUALLY does with an admin action name it does not
 * recognise — driven against the real handler, under NO doubles.
 *
 * ⚠ THIS FILE EXISTS BECAUSE A COMMENT IN THE (SINCE-DELETED) DISPATCHER SUITE
 * SAID THE OPPOSITE, AND THE ARM IT SAT ON COULD NEVER HAVE CAUGHT IT.
 *
 * Until 2026-08-25 that arm was titled *"an UNKNOWN action falls through to
 * the direct handler rather than throwing"* and carried, as a stated product
 * property: *"the dispatcher has no default refusal, so a typo in a cr_ name
 * does not error — it silently takes the other road."* The routing half was
 * true then; the "does not error" half was false — the handler ends in a
 * `default:` that throws. The original arm could not see it because it
 * replaced the handlers with `vi.fn().mockResolvedValue(...)`: a double that
 * cannot throw makes "and it does not throw" true before the subject is
 * reached.
 *
 * #800 SHRANK THE POPULATION: the dispatcher and the direct handler are
 * deleted with the Slack integration (their only entrances were the Slack
 * approval router and the Slack message buttons), so the two-road routing
 * question no longer exists. What remains is ONE handler and its one
 * refusal, and the review procedure hands it names out of
 * `CHANGE_REQUEST_ACTION_BY_TYPE` — so an unknown name can only reach it if
 * that derivation breaks, which is exactly when this refusal must hold.
 *
 * These arms are the reading. A `default:` deleted from the handler reddens
 * one of them.
 */
import { describe, it, expect } from "vitest";
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

describe("an unrecognised admin action is REFUSED", () => {
  it("the change-request handler refuses a name it does not recognise", async () => {
    await expect(executeChangeRequestAction(unknown("cr_notAThing"), CTX)).rejects.toThrow(
      "Unknown change request action type: cr_notAThing",
    );
  });

  it("a one-character typo in a real name is refused the same way — nothing executes, nothing settles", async () => {
    await expect(executeChangeRequestAction(unknown("cr_refundCreditss"), CTX)).rejects.toThrow(
      "Unknown change request action type: cr_refundCreditss",
    );
  });

  it("CONTROL — a name the handler DOES recognise is not refused by the default", async () => {
    // Without this, the arms above would pass against a handler that threw
    // unconditionally, and the population would be untested. It gets as far
    // as the real work and fails there instead ("User not found" — no test
    // database), which is a different failure and proves the `default:` was
    // not what stopped it.
    await expect(executeChangeRequestAction(unknown("cr_suspendUser"), CTX)).rejects.not.toThrow(
      /^Unknown change request action type/,
    );
  });
});
