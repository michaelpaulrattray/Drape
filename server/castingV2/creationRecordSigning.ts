/**
 * KLIEG'S OWN SIGNATURE ON A CREATION RECORD — Ed25519, N2d-1 (#2311).
 *
 * Design §4 (`docs/specs/N2D_RECORD_OF_CREATION_DESIGN_2026-10-12.md`): a
 * signature anyone can verify must come from a key PAIR whose private half
 * never leaves the service, which is why `JWT_SECRET`'s HS256 is unsuitable and
 * why this is EdDSA over Ed25519 through `jose`, already in the tree.
 *
 * # The form of the signature
 *
 * A DETACHED JWS (RFC 7515 Appendix F): `<protected header>..<signature>`. The
 * payload is the canonical record JSON, stored beside it, so the record is
 * kept once and anyone holding the record, this string and the public key can
 * check it with any JOSE library — `flattenedVerify({ protected, payload,
 * signature }, key)`. The header names the key by its RFC 7638 thumbprint
 * (`kid`), so a key rotated later does not orphan the records signed before it.
 *
 * # The key — from the environment only, never committed, never logged
 *
 * `CREATION_RECORD_PRIVATE_KEY` holds a PRIVATE JWK as one line of JSON
 * (`{"kty":"OKP","crv":"Ed25519","d":"…","x":"…"}`) — one line because a
 * Railway variable is one line, and a JWK rather than a PEM because a PEM's
 * newlines are the kind of thing that survives a paste in one world and not the
 * other. Setting it on production is his or the relay's hand; no shift sets a
 * Railway variable.
 *
 * ⚠ **NOTHING IN THIS FILE EVER PUTS THE KEY'S VALUE IN AN ERROR OR A LOG.**
 * Every refusal names the VARIABLE and a reason, and a parse failure is caught
 * and replaced rather than passed through, because a JSON parser's message can
 * quote the text it choked on. `creationRecordSigning.test.ts` drives a
 * malformed key whose bytes are a recognisable marker and asserts the marker is
 * in no error message.
 *
 * ⚠ **THE VARIABLE IS NAMED BY A CONSTANT THAT DOES NOT END `_ENV`, ON
 * PURPOSE.** That suffix is the house pattern for a FLAG, and a flag gets a row
 * in `scripts/lib/productionFlagPositions.mts`, whose rows are the names the
 * deploy rite prints VALUES for (`never-filter-a-secret-listing`). A private
 * key must never be on that list.
 */
import { createHash, createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";
import { FlattenedSign, flattenedVerify, importJWK } from "jose";

/** The Railway variable that holds the private JWK. A secret, never a flag. */
export const CREATION_RECORD_PRIVATE_KEY_VARIABLE = "CREATION_RECORD_PRIVATE_KEY";

export class CreationRecordKeyError extends Error {
  constructor(reason: string) {
    super(`${CREATION_RECORD_PRIVATE_KEY_VARIABLE} ${reason}`);
    this.name = "CreationRecordKeyError";
  }
}

export type CreationRecordPublicJwk = { kty: "OKP"; crv: "Ed25519"; x: string };

export type CreationRecordSigningKey = {
  /** RFC 7638 thumbprint of the PUBLIC key. */
  kid: string;
  /** The public half, safe to publish (the later check page and certificate). */
  publicJwk: CreationRecordPublicJwk;
  privateKey: KeyObject;
};

/** RFC 7638 §3.2: the required members, lexicographic, no whitespace. */
function thumbprint(publicJwk: CreationRecordPublicJwk): string {
  const members = `{"crv":"${publicJwk.crv}","kty":"${publicJwk.kty}","x":"${publicJwk.x}"}`;
  return createHash("sha256").update(members).digest("base64url");
}

/**
 * Read and validate the key — SYNCHRONOUSLY, so the boot check can call it.
 * Throws `CreationRecordKeyError` naming the variable — never its value — when
 * it is absent, unparseable, not an Ed25519 private key, or a `d` that is not
 * the private half of its own `x` (checked here, not left to the runtime).
 */
export function loadCreationRecordKey(raw: string | undefined): CreationRecordSigningKey {
  if (raw === undefined || raw.trim() === "") {
    throw new CreationRecordKeyError("is not set — a creation record cannot be signed without it");
  }
  let jwk: Record<string, unknown>;
  try {
    jwk = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new CreationRecordKeyError("is not one line of JSON (a private Ed25519 JWK is expected)");
  }
  if (
    typeof jwk !== "object" || jwk === null
    || jwk.kty !== "OKP" || jwk.crv !== "Ed25519"
    || typeof jwk.d !== "string" || typeof jwk.x !== "string"
  ) {
    throw new CreationRecordKeyError("is not a private Ed25519 JWK (kty OKP, crv Ed25519, with d and x)");
  }
  /*
    A key whose `d` and `x` are not one pair would sign records nobody could
    verify against the published half, so the pair is proven here, at load,
    by deriving the public half from `d` and comparing it with `x`.

    ⚠ **THIS COMPARISON WAS DELETED ONCE AS REDUNDANT, AND THAT WAS WRONG ON
    THE NODE PRODUCTION AND CI RUN.** Node 26 refuses a mismatched JWK at
    import (ERR_CRYPTO_INVALID_JWK), so a sabotage of this line stayed green on
    the laptop it was first written on; Node 24.21 IMPORTS the same pair and
    derives a different `x` (measured 2026-10-12), and the gate's
    `unit-tests-2` shard went red on exactly that case. What a runtime happens
    to validate is not this function's contract — so it states its own check,
    and every failure, on every road, is a `CreationRecordKeyError` naming
    the variable and never its value.
  */
  let privateKey: KeyObject;
  let derivedX: unknown;
  try {
    privateKey = createPrivateKey({ key: { kty: "OKP", crv: "Ed25519", d: jwk.d, x: jwk.x }, format: "jwk" });
    derivedX = createPublicKey(privateKey).export({ format: "jwk" }).x;
  } catch {
    throw new CreationRecordKeyError(
      "could not be imported as an Ed25519 private key (or its d and x are not one pair)",
    );
  }
  if (derivedX !== jwk.x) {
    throw new CreationRecordKeyError("has a private half that does not match its public half (d and x are not one pair)");
  }
  const publicJwk: CreationRecordPublicJwk = { kty: "OKP", crv: "Ed25519", x: jwk.x };
  return { kid: thumbprint(publicJwk), publicJwk, privateKey };
}

/** Sign the canonical record bytes. Returns `<protected>..<signature>`. */
export async function signCreationRecord(
  key: CreationRecordSigningKey,
  canonical: string,
): Promise<string> {
  const signed = await new FlattenedSign(new TextEncoder().encode(canonical))
    .setProtectedHeader({ alg: "EdDSA", kid: key.kid })
    .sign(key.privateKey);
  if (!signed.protected) throw new Error("the creation-record signature has no protected header");
  return `${signed.protected}..${signed.signature}`;
}

/**
 * Verify a detached signature against a public JWK — what anyone checking a
 * certificate later does, and what the mint does once before it stores.
 */
export async function verifyCreationRecord(
  publicJwk: CreationRecordPublicJwk,
  canonical: string,
  detached: string,
): Promise<boolean> {
  const parts = detached.split(".");
  if (parts.length !== 3 || parts[1] !== "") return false;
  try {
    await flattenedVerify(
      {
        protected: parts[0]!,
        payload: Buffer.from(canonical, "utf8").toString("base64url"),
        signature: parts[2]!,
      },
      await importJWK(publicJwk, "EdDSA"),
    );
    return true;
  } catch {
    return false;
  }
}
