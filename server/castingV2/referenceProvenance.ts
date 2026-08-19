/**
 * WHERE A STEP'S WORDS CAME FROM, PROVED RATHER THAN CLAIMED — the read token
 * (ruled fable-968 §3(c), designed opus-709 §3).
 *
 * # The defect this exists to prevent, and it is not an attacker
 *
 * The obvious build has the client post `fromReferenceRead: true` beside the
 * instruction. That is an assertion by the one party that cannot be checked,
 * and its realistic failure mode is entirely domestic: OUR OWN UI leaving a
 * stale flag set on a box she has since retyped from scratch. The row would
 * then say a sentence came off a photograph when she wrote every word of it —
 * quietly, forever, and in a column whose whole purpose is to not lie.
 *
 * **A provenance a client can assert is a provenance that will eventually be
 * wrong quietly.** So the client asserts nothing. `readMakeup` returns an
 * opaque token; a refine may carry it back; and the server compares her
 * instruction against the hash it sealed inside that token and writes
 * `verbatim` or `edited` ITSELF. The row records a fact the server derived.
 *
 * # THE KEY IS PURPOSE-SCOPED, NOT `JWT_SECRET` (fable-968 §3's one bound)
 *
 * The signing key is HKDF-derived from `JWT_SECRET` under the label
 * `ink-provenance-v1`, so this token can never be confused with, substituted
 * for, or used to mint a session artifact — and a future second purpose gets
 * its own label rather than a second use of the same key. Prefixing the
 * MESSAGE with a label (the evidence etag's pattern) protects the message
 * space; deriving the KEY protects the key space, and this is a token handed
 * to a browser rather than an etag computed for a response.
 *
 * # TTL: THIRTY MINUTES
 *
 * Stated here because a freshness bound nobody can find is a freshness bound
 * that gets loosened by accident. Thirty minutes is the shape of the actual
 * task — read a photograph, look at the sentence it produced, adopt or reword
 * it, spend credits — with room for her to be interrupted, and short enough
 * that a token which leaks into a log or a history entry stops meaning anything
 * the same afternoon. Nothing breaks when it expires: the refine proceeds
 * exactly as an ordinary typed one, and the step simply carries no provenance,
 * which is the honest answer rather than a guessed one.
 *
 * # NOTHING HERE STORES OR TRANSPORTS THE SENTENCE
 *
 * The token carries a HASH of the reader's sentence, never the sentence. That
 * is 0036's privacy note held one station along: a makeup note read off
 * somebody's photograph is a description of a real person's face, and it is not
 * written into a row, a token, or a log by this module or by anything it feeds.
 */
import { createHmac, hkdfSync, timingSafeEqual, createHash } from "node:crypto";

/** The label the signing key is derived under — never reused for anything. */
const KEY_LABEL = "ink-provenance-v1";

/** Thirty minutes, in milliseconds. See the module header for the reasoning. */
export const READ_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * What a reference read can be ABOUT.
 *
 * A closed list rather than a string, so a second reader cannot start writing
 * an intent nothing has agreed to, and so the provenance a row carries is drawn
 * from a vocabulary rather than from a caller.
 *
 * **The list is the only copy.** Both doors below — the token's own parse and
 * the persisted column's reader — test membership of THIS array rather than
 * spelling a member out, because two hand-written `!== "makeup"` checks are
 * exactly the second list working law 4 forbids: the day a third reader lands,
 * one of them gets updated and the other silently refuses every token it sees.
 */
export const REFERENCE_READ_INTENTS = ["makeup", "hair"] as const;

export type ReferenceReadIntent = (typeof REFERENCE_READ_INTENTS)[number];

function isReadIntent(value: unknown): value is ReferenceReadIntent {
  return typeof value === "string"
    && (REFERENCE_READ_INTENTS as readonly string[]).includes(value);
}

/**
 * How closely her instruction matched the sentence the reader produced.
 *
 * Derived by comparing hashes, never sent. `edited` is not a lesser outcome —
 * it is the common and intended one, because the sentence is a suggestion she
 * reworks.
 */
export type ReferenceReadAdoption = "verbatim" | "edited";

/**
 * One step's provenance, as it is written to `stepProvenance[i]`.
 *
 * KIND, never identity: no object key, no row id, no digest of her photograph,
 * and no sentence. What survives is that this step's words came from a read,
 * what the read was about, and whether she changed them.
 */
export type StepProvenance = {
  readonly source: "referenceRead";
  readonly intent: ReferenceReadIntent;
  readonly adopted: ReferenceReadAdoption;
};

/**
 * The comparison is over the sentence as the PRODUCT treats it, not as it was
 * typed — the refine input already trims, and a trailing space she never sees
 * is not an edit she made.
 *
 * Case is preserved deliberately: rewriting the capitalisation of a sentence is
 * a change she made to it, and this column exists to record what happened
 * rather than to be generous.
 */
function sentenceHash(sentence: string): string {
  return createHash("sha256").update(sentence.trim(), "utf8").digest("hex");
}

/**
 * The signing key for this purpose, derived from the session secret.
 *
 * Throws on an empty secret rather than signing with one: a token signed under
 * `""` verifies for anybody who can guess that we did it, and a control that
 * degrades quietly when a dependency is missing is invariant 7's exact
 * counterexample. The caller's failure here is a read that returns no token,
 * which costs a provenance and nothing else.
 */
function signingKey(secret: string): Buffer {
  if (secret === "") throw new Error("no JWT_SECRET — the provenance key cannot be derived");
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.alloc(0), KEY_LABEL, 32));
}

/** The signed part, in a fixed order — a field separator no field can contain. */
function payloadOf(input: {
  userId: number;
  candidateId: number;
  intent: ReferenceReadIntent;
  sentenceHash: string;
  issuedAt: number;
}): string {
  return [
    KEY_LABEL,
    String(input.userId),
    String(input.candidateId),
    input.intent,
    input.sentenceHash,
    String(input.issuedAt),
  ].join("\0");
}

/**
 * Mint the token a read hands back.
 *
 * `issuedAt` is passed rather than read from the clock, so the freshness door
 * can be driven directly instead of through a sleep — a guard whose only test
 * waits for real time is a guard that gets tested once.
 */
export function issueReadToken(input: {
  secret: string;
  userId: number;
  candidateId: number;
  intent: ReferenceReadIntent;
  sentence: string;
  issuedAt: number;
}): string {
  const hash = sentenceHash(input.sentence);
  const payload = payloadOf({ ...input, sentenceHash: hash });
  const signature = createHmac("sha256", signingKey(input.secret)).update(payload).digest("base64url");
  return [input.intent, hash, String(input.issuedAt), signature].join(".");
}

/**
 * WHY A TOKEN DID NOT COUNT — named, because "no provenance" has several
 * causes and only some of them are interesting.
 *
 * `expired` is ordinary life. `mismatched` means the signature did not verify
 * for this account and this Cast, which is either tampering or a token being
 * carried somewhere it does not belong, and neither should be recorded as a
 * quiet absence.
 */
export type ReadTokenRefusal = "malformed" | "expired" | "mismatched";

/**
 * Verify a token against the account, the Cast, the clock and the instruction —
 * and derive what to write.
 *
 * Returns the provenance to file, or the reason there is none. **Never throws
 * for a bad token**: a refine is a paid operation and a decoration on it must
 * not be able to take it away. The caller files what it gets and charges either
 * way.
 */
export function verifyReadToken(input: {
  secret: string;
  token: string;
  userId: number;
  candidateId: number;
  instruction: string;
  now: number;
}): { ok: true; provenance: StepProvenance } | { ok: false; refusal: ReadTokenRefusal } {
  const parts = input.token.split(".");
  if (parts.length !== 4) return { ok: false, refusal: "malformed" };
  const [intent, hash, issuedAtText, signature] = parts as [string, string, string, string];
  if (!isReadIntent(intent)) return { ok: false, refusal: "malformed" };
  if (!/^[0-9a-f]{64}$/.test(hash)) return { ok: false, refusal: "malformed" };
  const issuedAt = Number(issuedAtText);
  if (!Number.isSafeInteger(issuedAt) || issuedAt <= 0) return { ok: false, refusal: "malformed" };

  /*
    THE SIGNATURE BEFORE THE CLOCK, and the clock before the comparison.

    Freshness is a property of a token we MINTED; asking whether an unverified
    string is fresh is asking an attacker's own field what time it is. And the
    hash comparison last, because it is the only step whose answer is
    interesting rather than a refusal.
  */
  let expected: string;
  try {
    expected = createHmac("sha256", signingKey(input.secret))
      .update(payloadOf({
        userId: input.userId,
        candidateId: input.candidateId,
        intent,
        sentenceHash: hash,
        issuedAt,
      }))
      .digest("base64url");
  } catch {
    /* No secret: the token cannot be verified, so it does not count. It is not
       "mismatched" — nothing was compared. */
    return { ok: false, refusal: "malformed" };
  }
  const given = Buffer.from(signature, "utf8");
  const mine = Buffer.from(expected, "utf8");
  if (given.length !== mine.length || !timingSafeEqual(given, mine)) {
    return { ok: false, refusal: "mismatched" };
  }

  /* A token from the future is not fresh, it is wrong — a clock that has moved
     backwards, or a field somebody set. Both refuse. */
  const age = input.now - issuedAt;
  if (age < 0 || age > READ_TOKEN_TTL_MS) return { ok: false, refusal: "expired" };

  return {
    ok: true,
    provenance: {
      source: "referenceRead",
      intent,
      adopted: sentenceHash(input.instruction) === hash ? "verbatim" : "edited",
    },
  };
}

/**
 * Read a persisted `stepProvenance` column back.
 *
 * REFUSES rather than approximates, exactly as `readChain` does for its two
 * siblings: a column whose length disagrees with the instruction list has lost
 * the correspondence that makes index i mean anything, and a partial answer
 * about where somebody's words came from is worse than none.
 *
 * `null` entries are ordinary and stay null — most steps are typed, and the
 * array is index-aligned rather than compacted.
 */
export function readStepProvenance(
  value: unknown,
  instructionCount: number,
): (StepProvenance | null)[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length !== instructionCount) return null;
  return value.map((entry) => {
    if (entry === null || typeof entry !== "object") return null;
    const one = entry as Partial<StepProvenance>;
    if (one.source !== "referenceRead") return null;
    if (!isReadIntent(one.intent)) return null;
    if (one.adopted !== "verbatim" && one.adopted !== "edited") return null;
    return { source: one.source, intent: one.intent, adopted: one.adopted };
  });
}
