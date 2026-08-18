/**
 * THE READ TOKEN — driven at every door, including the ones that must REFUSE.
 *
 * This module exists so a row cannot lie about where somebody's words came
 * from, which means the interesting tests are the negative ones: a token from
 * another account, another Cast, an old afternoon, or a client that made one
 * up. A control that only ever sees its happy path is not a control.
 */
import { createHmac, hkdfSync } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  READ_TOKEN_TTL_MS,
  issueReadToken,
  readStepProvenance,
  verifyReadToken,
} from "./referenceProvenance";

const SECRET = "a-test-secret-that-is-long-enough-to-be-realistic";
const NOW = 1_700_000_000_000;
const SENTENCE = "soft brown smoky shadow, bare lip";

function token(over: Partial<Parameters<typeof issueReadToken>[0]> = {}): string {
  return issueReadToken({
    secret: SECRET,
    userId: 1,
    candidateId: 42,
    intent: "makeup",
    sentence: SENTENCE,
    issuedAt: NOW,
    ...over,
  });
}

function verify(over: Partial<Parameters<typeof verifyReadToken>[0]> = {}) {
  return verifyReadToken({
    secret: SECRET,
    token: token(),
    userId: 1,
    candidateId: 42,
    instruction: SENTENCE,
    now: NOW + 1_000,
    ...over,
  });
}

describe("what the server derives rather than being told", () => {
  it("says VERBATIM when she spent the sentence as it was read", () => {
    const outcome = verify();
    expect(outcome).toEqual({
      ok: true,
      provenance: { source: "referenceRead", intent: "makeup", adopted: "verbatim" },
    });
  });

  it("says EDITED when she reworked it — the common case, not a lesser one", () => {
    const outcome = verify({ instruction: "soft brown smoky shadow, glossy lip" });
    expect(outcome).toEqual({
      ok: true,
      provenance: { source: "referenceRead", intent: "makeup", adopted: "edited" },
    });
  });

  it("does not count a space she never saw as an edit", () => {
    /* The refine input trims before anything else sees it, so the comparison is
       over the sentence as the product treats it. */
    const outcome = verify({ instruction: `  ${SENTENCE}  ` });
    expect(outcome).toMatchObject({ ok: true, provenance: { adopted: "verbatim" } });
  });

  it("DOES count a capitalisation she changed — this column records what happened", () => {
    /* Deliberately not generous: rewriting the case of a sentence is a change
       she made to it, and a lenient comparison would file her words as the
       reader's. */
    const outcome = verify({ instruction: SENTENCE.toUpperCase() });
    expect(outcome).toMatchObject({ ok: true, provenance: { adopted: "edited" } });
  });
});

describe("the doors, each driven directly", () => {
  it("refuses a token minted for ANOTHER ACCOUNT", () => {
    expect(verify({ token: token({ userId: 2 }) })).toEqual({ ok: false, refusal: "mismatched" });
  });

  it("refuses a token minted for ANOTHER CAST of the same account", () => {
    /* The realistic version of this is not theft — it is two Casts open in two
       tabs, and a provenance filed against the wrong one is exactly the quiet
       wrongness this whole mechanism exists to prevent. */
    expect(verify({ token: token({ candidateId: 43 }) })).toEqual({ ok: false, refusal: "mismatched" });
  });

  it("refuses a token signed with a DIFFERENT secret", () => {
    expect(verify({ token: token({ secret: `${SECRET}-other` }) }))
      .toEqual({ ok: false, refusal: "mismatched" });
  });

  it("refuses one signed with the RAW session secret — the key is purpose-scoped", () => {
    /*
      fable-968 §3's one bound, driven rather than asserted. A forger who knows
      the design and holds `JWT_SECRET` still cannot mint this token, because
      the signing key is HKDF-derived under `ink-provenance-v1` and the raw
      secret is not it.
    */
    const hash = "0".repeat(64);
    const payload = ["ink-provenance-v1", "1", "42", "makeup", hash, String(NOW)].join("\0");
    const forged = createHmac("sha256", SECRET).update(payload).digest("base64url");
    expect(verify({ token: ["makeup", hash, String(NOW), forged].join(".") }))
      .toEqual({ ok: false, refusal: "mismatched" });
  });

  it("ACCEPTS one signed with the derived key — so the test above proves scoping, not a typo", () => {
    /*
      The positive control for the negative above. Without it, "the raw secret
      does not verify" is equally consistent with the payload being wrong, the
      separator differing, or the whole scheme being broken.
    */
    const hash = "0".repeat(64);
    const payload = ["ink-provenance-v1", "1", "42", "makeup", hash, String(NOW)].join("\0");
    const key = Buffer.from(
      hkdfSync("sha256", Buffer.from(SECRET, "utf8"), Buffer.alloc(0), "ink-provenance-v1", 32),
    );
    const signed = createHmac("sha256", key).update(payload).digest("base64url");
    const outcome = verify({ token: ["makeup", hash, String(NOW), signed].join(".") });
    /* The hash is not her instruction's, so this is `edited` — what matters is
       that it VERIFIED. */
    expect(outcome).toMatchObject({ ok: true, provenance: { adopted: "edited" } });
  });

  it("refuses one that has gone stale, and one minute inside the window still counts", () => {
    expect(verify({ now: NOW + READ_TOKEN_TTL_MS + 1 })).toEqual({ ok: false, refusal: "expired" });
    expect(verify({ now: NOW + READ_TOKEN_TTL_MS - 60_000 })).toMatchObject({ ok: true });
  });

  it("refuses one from the FUTURE — a clock that moved, or a field somebody set", () => {
    expect(verify({ now: NOW - 1 })).toEqual({ ok: false, refusal: "expired" });
  });

  it("refuses malformed shapes without throwing — a decoration cannot fail a paid edit", () => {
    for (const bad of ["", "not-a-token", "makeup.short.1.sig", "makeup..1.sig", "a.b.c.d.e"]) {
      expect(() => verify({ token: bad })).not.toThrow();
      expect(verify({ token: bad })).toMatchObject({ ok: false });
    }
  });

  it("refuses when there is NO SECRET rather than signing under an empty key", () => {
    /* Invariant 7: a control refuses when a dependency is missing; it does not
       allow. Minting throws (the read returns no token); verifying refuses. */
    expect(() => token({ secret: "" })).toThrow();
    expect(verify({ secret: "" })).toEqual({ ok: false, refusal: "malformed" });
  });
});

describe("reading the column back", () => {
  const one = { source: "referenceRead", intent: "makeup", adopted: "verbatim" } as const;

  it("REFUSES a column whose length disagrees with the chain, like readChain does", () => {
    /* Index i means nothing once the lists differ, and a partial answer about
       where somebody's words came from is worse than none. */
    expect(readStepProvenance([one], 2)).toBeNull();
    expect(readStepProvenance([one, null, null], 2)).toBeNull();
  });

  it("refuses a NULL column — every row written before this existed", () => {
    expect(readStepProvenance(null, 0)).toBeNull();
    expect(readStepProvenance(undefined, 1)).toBeNull();
  });

  it("keeps nulls in place — most steps are typed and the array is not compacted", () => {
    expect(readStepProvenance([null, one, null], 3)).toEqual([null, one, null]);
  });

  it("drops an entry it does not recognise rather than passing it through", () => {
    /* A vocabulary this column does not hold is a row written by something that
       is not this code, and it is not repaired into a shape that looks measured. */
    expect(readStepProvenance([{ source: "guess", intent: "makeup", adopted: "verbatim" }], 1))
      .toEqual([null]);
    expect(readStepProvenance([{ source: "referenceRead", intent: "makeup", adopted: "maybe" }], 1))
      .toEqual([null]);
  });

  it("accepts the shape the writer actually writes — the two ends agree", () => {
    const written = verify();
    expect(written.ok).toBe(true);
    const provenance = written.ok ? written.provenance : null;
    expect(readStepProvenance([provenance], 1)).toEqual([provenance]);
  });
});
