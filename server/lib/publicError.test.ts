/**
 * Batch C final correction 2 — the public/internal error boundary.
 * Deliberately authored TRPCError/PublicError wording passes through;
 * anything else (raw provider/DB/SDK text) is replaced by the safe fallback.
 */
import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import { PublicError, isPublicError, publicErrorMessage } from "./publicError";

describe("publicErrorMessage", () => {
  it("preserves deliberately written TRPCError messages", () => {
    const e = new TRPCError({ code: "PRECONDITION_FAILED", message: "A name is required to mint" });
    expect(publicErrorMessage(e, "fallback")).toBe("A name is required to mint");
  });

  it("preserves PublicError messages (sanitized at the throw site)", () => {
    const e = new PublicError("Engine offline. The servers are experiencing downtime.");
    expect(publicErrorMessage(e, "fallback")).toBe("Engine offline. The servers are experiencing downtime.");
  });

  it("replaces raw internal Error text with the fallback", () => {
    const e = new Error("connect ECONNREFUSED mysql://root:secret@10.0.0.1/drape");
    expect(publicErrorMessage(e, "The operation failed.")).toBe("The operation failed.");
  });

  it("replaces non-Error throwables with the fallback", () => {
    expect(publicErrorMessage("raw string", "fallback")).toBe("fallback");
    expect(publicErrorMessage(undefined, "fallback")).toBe("fallback");
    expect(publicErrorMessage({ message: "objecty" }, "fallback")).toBe("fallback");
  });

  it("PublicError keeps its cause for server-side logging", () => {
    const raw = new Error("raw detail");
    const e = new PublicError("Safe words", { cause: raw });
    expect(isPublicError(e)).toBe(true);
    expect(e.cause).toBe(raw);
    expect(e.message).toBe("Safe words");
  });
});
