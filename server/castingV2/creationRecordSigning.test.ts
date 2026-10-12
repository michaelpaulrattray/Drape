/**
 * KLIEG'S SIGNATURE ON A CREATION RECORD — the key and the signature (#2311).
 *
 * Positive: a real Ed25519 pair, generated here, signs and verifies.
 * Negative: a changed record, a different key and a malformed signature each
 * fail verification — so "verifies" is a claim this suite can see go false.
 *
 * ⚠ And the key's VALUE never reaches an error message: every malformed key
 * below is built around a recognisable marker, and every refusal is asserted
 * to name the variable and NOT to contain the marker.
 */
import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  CREATION_RECORD_PRIVATE_KEY_VARIABLE,
  CreationRecordKeyError,
  loadCreationRecordKey,
  signCreationRecord,
  verifyCreationRecord,
} from "./creationRecordSigning";

function freshJwk(): Record<string, string> {
  const { privateKey } = generateKeyPairSync("ed25519");
  return privateKey.export({ format: "jwk" }) as Record<string, string>;
}

const CANONICAL = '{"kliegId":"KI-AAAA-BBBB-CCCC-DDDD","recordVersion":"1"}';

describe("signing and verifying", () => {
  it("signs a record that verifies against the published half", async () => {
    const key = loadCreationRecordKey(JSON.stringify(freshJwk()));
    const signature = await signCreationRecord(key, CANONICAL);
    expect(signature).toMatch(/^[A-Za-z0-9_-]+\.\.[A-Za-z0-9_-]+$/);
    expect(await verifyCreationRecord(key.publicJwk, CANONICAL, signature)).toBe(true);
    /* The header names the key by its thumbprint, and nothing else rides in it. */
    const header = JSON.parse(Buffer.from(signature.split(".")[0]!, "base64url").toString("utf8"));
    expect(header).toEqual({ alg: "EdDSA", kid: key.kid });
  });

  it("⚠ NEGATIVE — a record changed by one character does not verify", async () => {
    const key = loadCreationRecordKey(JSON.stringify(freshJwk()));
    const signature = await signCreationRecord(key, CANONICAL);
    expect(await verifyCreationRecord(key.publicJwk, CANONICAL.replace("DDDD", "DDDE"), signature)).toBe(false);
  });

  it("⚠ NEGATIVE — another key's public half does not verify it", async () => {
    const key = loadCreationRecordKey(JSON.stringify(freshJwk()));
    const other = loadCreationRecordKey(JSON.stringify(freshJwk()));
    const signature = await signCreationRecord(key, CANONICAL);
    expect(await verifyCreationRecord(other.publicJwk, CANONICAL, signature)).toBe(false);
  });

  it("⚠ NEGATIVE — an attached or mangled signature string is not a detached JWS", async () => {
    const key = loadCreationRecordKey(JSON.stringify(freshJwk()));
    const signature = await signCreationRecord(key, CANONICAL);
    const [header, , sig] = signature.split(".");
    expect(await verifyCreationRecord(key.publicJwk, CANONICAL, `${header}.cGF5bG9hZA.${sig}`)).toBe(false);
    expect(await verifyCreationRecord(key.publicJwk, CANONICAL, "nonsense")).toBe(false);
  });
});

describe("the key — from the environment, refused by name, never echoed", () => {
  const MARKER = "PRIVATE-KEY-MARKER-2311";

  it("refuses an absent or blank key, naming the variable", () => {
    for (const raw of [undefined, "", "   "]) {
      expect(() => loadCreationRecordKey(raw)).toThrow(CreationRecordKeyError);
      expect(() => loadCreationRecordKey(raw)).toThrow(new RegExp(`^${CREATION_RECORD_PRIVATE_KEY_VARIABLE} `));
    }
  });

  it("refuses malformed values WITHOUT quoting them", () => {
    const pair = freshJwk();
    const cases = [
      `{"kty":"OKP","d":"${MARKER}`, // not JSON — a parser's message could quote this
      JSON.stringify({ kty: "OKP", crv: "Ed25519", x: MARKER }), // no d
      JSON.stringify({ kty: "EC", crv: "P-256", d: MARKER, x: MARKER, y: MARKER }), // wrong curve
      JSON.stringify({ kty: "OKP", crv: "Ed25519", d: MARKER, x: pair.x }), // d is not a key
      JSON.stringify({ kty: "OKP", crv: "Ed25519", d: pair.d, x: freshJwk().x }), // d and x not one pair
    ];
    for (const raw of cases) {
      let message = "";
      try {
        loadCreationRecordKey(raw);
      } catch (error) {
        expect(error).toBeInstanceOf(CreationRecordKeyError);
        message = (error as Error).message;
      }
      expect(message, raw.slice(0, 30)).toMatch(new RegExp(`^${CREATION_RECORD_PRIVATE_KEY_VARIABLE} `));
      expect(message).not.toContain(MARKER);
      expect(message).not.toContain(pair.d);
    }
  });

  it("CONTROL — the mismatched-pair refusal is about the PAIR, so a matched pair loads", () => {
    expect(() => loadCreationRecordKey(JSON.stringify(freshJwk()))).not.toThrow();
  });
});
