/**
 * A TIMESTAMP TOKEN IS STORED ONLY IF ITS SIGNATURE IS REAL — the relay's
 * finding 2 on PR #2317, driven on real authority bytes.
 *
 * Positive: both captured replies (DigiCert, FreeTSA — the same fixtures
 * `openssl ts -verify` returned OK on) verify and chain to a pinned root.
 * Negative, each its own way a forgery or a mistake would arrive: one flipped
 * signature byte, a changed TSTInfo under an unchanged signature, a root that
 * is not pinned, and — the subtle one — a token that BRINGS its own
 * self-signed root (FreeTSA's does) with no pinned root to meet it.
 */
import { X509Certificate, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
  askAuthority,
  parseTimestampReply,
  TIMESTAMP_AUTHORITIES,
  type SignedParts,
  type TimestampFetch,
} from "./creationRecordTimestamp";
import { PINNED_TIMESTAMP_ROOTS, verifyTimestampSignature } from "./creationRecordTimestampTrust";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPLIES = {
  digicert: readFileSync(path.join(here, "__fixtures__/creation-record-digicert.tsr")),
  freetsa: readFileSync(path.join(here, "__fixtures__/creation-record-freetsa.tsr")),
};
const DIGEST = createHash("sha256").update("klieg creation-record fixture 2311\n").digest();
const NONCE = Buffer.from("0123456789abcdef", "hex");

function granted(reply: Buffer) {
  const parsed = parseTimestampReply(reply);
  if (parsed.kind !== "granted") throw new Error("fixture is not granted");
  return parsed;
}

function replying(body: Buffer): TimestampFetch {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
  }));
}

/** The reply with one byte of its first signer's signature flipped. */
function withFlippedSignature(reply: Buffer): Buffer {
  const signature = granted(reply).signed.signers[0]!.signature;
  const at = reply.indexOf(signature);
  expect(at).toBeGreaterThan(0);
  const forged = Buffer.from(reply);
  forged[at + signature.length - 1] ^= 0x01;
  return forged;
}

describe("the pinned roots", () => {
  it("are exactly the two roots measured on 2026-10-12, by fingerprint", () => {
    expect(PINNED_TIMESTAMP_ROOTS.map((pem) => new X509Certificate(pem).fingerprint256)).toEqual([
      "55:2F:7B:DC:F1:A7:AF:9E:6C:E6:72:01:7F:4F:12:AB:F7:72:40:C7:8E:76:1A:C2:03:D1:D9:D2:0A:C8:99:88",
      "A6:37:9E:7C:EC:C0:5F:AA:3C:BF:07:60:13:D7:45:E3:27:BB:BA:A3:8C:0B:9A:F2:24:69:D4:70:1D:18:AA:BC",
    ]);
  });
});

describe("a real token verifies", () => {
  for (const [authority, reply] of Object.entries(REPLIES)) {
    it(`${authority}'s signature verifies and chains to a pinned root at its own stamp time`, () => {
      const parsed = granted(reply);
      expect(verifyTimestampSignature(parsed.signed, parsed.stampedAt)).toEqual({ ok: true });
    });
  }
});

describe("⚠ a forged or foreign token does not", () => {
  it("one flipped signature byte", () => {
    for (const reply of Object.values(REPLIES)) {
      const parsed = granted(withFlippedSignature(reply));
      expect(verifyTimestampSignature(parsed.signed, parsed.stampedAt).ok).toBe(false);
    }
  });

  it("a changed TSTInfo under the authority's unchanged signature (the messageDigest no longer matches)", () => {
    const parsed = granted(REPLIES.digicert);
    const content = Buffer.from(parsed.signed.content);
    content[content.length - 1] ^= 0x01;
    const tampered: SignedParts = { ...parsed.signed, content };
    expect(verifyTimestampSignature(tampered, parsed.stampedAt).ok).toBe(false);
  });

  it("a genuine signature that chains to a root we did not pin", () => {
    const parsed = granted(REPLIES.digicert);
    /* Only FreeTSA's root pinned: DigiCert's real chain meets nothing. */
    expect(verifyTimestampSignature(parsed.signed, parsed.stampedAt, [PINNED_TIMESTAMP_ROOTS[1]!]).ok).toBe(false);
  });

  it("a token that brings its OWN self-signed root is not trusted for bringing it", () => {
    const parsed = granted(REPLIES.freetsa);
    /* FreeTSA's token carries its root; with only DigiCert's pinned, it must fail. */
    expect(parsed.signed.certificates.length).toBeGreaterThan(1);
    expect(verifyTimestampSignature(parsed.signed, parsed.stampedAt, [PINNED_TIMESTAMP_ROOTS[0]!]).ok).toBe(false);
  });

  it("a stamp time before the SIGNER's certificate was valid, while its CA and root still were", () => {
    /* DigiCert's responder is valid from 2026-08-05; its CA from 2025-05-07 and
       the G4 root from 2013 — so 2026-01-01 isolates the signer's own window. */
    const parsed = granted(REPLIES.digicert);
    expect(verifyTimestampSignature(parsed.signed, new Date("2026-01-01T00:00:00Z")).ok).toBe(false);
  });
});

describe("the authority road refuses an unverified token — nothing is stored", () => {
  it("a forged reply carrying OUR imprint and OUR nonce is refused as unverified", async () => {
    const answer = await askAuthority({
      digest: DIGEST,
      authority: TIMESTAMP_AUTHORITIES[0]!,
      nonce: NONCE,
      fetch: replying(withFlippedSignature(REPLIES.digicert)),
    });
    expect(answer).toMatchObject({ reason: "unverified", authority: "digicert" });
  });

  it("CONTROL — the same reply unforged is a token", async () => {
    const answer = await askAuthority({
      digest: DIGEST, authority: TIMESTAMP_AUTHORITIES[0]!, nonce: NONCE, fetch: replying(REPLIES.digicert),
    });
    expect("tokenDer" in answer).toBe(true);
  });

  it("FreeTSA is asked over HTTPS; DigiCert over HTTP because it offers nothing else (measured), so the signature carries it", () => {
    expect(TIMESTAMP_AUTHORITIES.map((authority) => authority.url)).toEqual([
      "http://timestamp.digicert.com",
      "https://freetsa.org/tsr",
    ]);
  });
});
