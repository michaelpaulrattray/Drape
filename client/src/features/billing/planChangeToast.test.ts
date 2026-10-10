/**
 * #2190 — the one voice both plan-change doors answer with. A change held for
 * the customer's bank must put the confirmation page behind a button the
 * customer clicks (a new tab opened from that click, not from the request's
 * answer, which a browser would block), and wait for them; every other answer
 * is the ordinary short toast. Both doors are held to calling this, so the
 * two cannot drift.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { announcePlanChange } from "./planChangeToast";

beforeEach(() => {
  toast.mockReset();
  toast.success.mockReset();
});

describe("announcePlanChange", () => {
  it("a held change puts its confirmation page behind a 'Confirm payment' button and waits", () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });

    announcePlanChange({ message: "Your bank wants you to confirm this payment.", confirmPaymentUrl: "https://pay.example/i/1" });

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(1);
    const [message, options] = toast.mock.calls[0];
    expect(message).toBe("Your bank wants you to confirm this payment.");
    expect(options.action.label).toBe("Confirm payment");
    expect(options.duration).toBeGreaterThanOrEqual(15_000);
    /* Nothing opens until the customer clicks. */
    expect(open).not.toHaveBeenCalled();
    options.action.onClick();
    expect(open).toHaveBeenCalledWith("https://pay.example/i/1", "_blank", "noopener");
    vi.unstubAllGlobals();
  });

  it("NEGATIVE CONTROL — an ordinary answer is the ordinary toast, with no button", () => {
    announcePlanChange({ message: "You're on Pro now.", confirmPaymentUrl: null });

    expect(toast.success).toHaveBeenCalledWith("You're on Pro now.");
    expect(toast).not.toHaveBeenCalled();
  });

  it("both doors to changePlan answer through it", () => {
    for (const file of ["ChangePlanModal.tsx", "AddCreditsModal.tsx"]) {
      const source = readFileSync(resolve(__dirname, file), "utf8");
      const start = source.indexOf("trpc.billing.changePlan.useMutation(");
      expect(start, file).toBeGreaterThan(-1);
      const onSuccess = source.slice(start, source.indexOf("onError", start));
      expect(onSuccess, file).toContain("announcePlanChange(data)");
      expect(onSuccess, file).not.toContain("toast.success(data.message)");
    }
  });
});
