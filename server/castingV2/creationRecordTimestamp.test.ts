/**
 * THE TIMESTAMP ROAD, DRIVEN ON REAL AUTHORITY REPLIES — N2d-1 (#2311).
 *
 * The two fixtures are REAL `TimeStampResp` bytes, captured 2026-10-12 from
 * DigiCert's and FreeTSA's public authorities in answer to requests this
 * module's own encoder built (imprint: SHA-256 of `FIXTURE_TEXT`, nonce
 * `0123456789abcdef`, certReq true). Before they were committed, OpenSSL was
 * the SECOND READER on both ends — `openssl ts -query -text` read the request
 * (sha256, the nonce, certificate required), `openssl ts -reply -text` read
 * each reply as `Status: Granted.` with the same nonce, and `openssl ts
 * -verify -data … -token_in` verified the token this module extracts against
 * the data, `Verification: OK`, for both authorities. So the parser is held to
 * bytes it did not write and to a reader it does not share.
 *
 * Every refusal has its own arm, and each one is a negative control for the
 * granted arm: a token for the wrong hash, with the wrong nonce, from an
 * authority that said no, or out of bytes that do not parse is NEVER returned
 * as a token.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
  askAuthority,
  encodeTimestampRequest,
  isTimestampToken,
  parseTimestampReply,
  stampDigest,
  TIMESTAMP_AUTHORITIES,
  TIMESTAMP_REPLY_MAX_BYTES,
  type TimestampFetch,
} from "./creationRecordTimestamp";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIGICERT_REPLY = readFileSync(path.join(here, "__fixtures__/creation-record-digicert.tsr"));
const FREETSA_REPLY = readFileSync(path.join(here, "__fixtures__/creation-record-freetsa.tsr"));
const FIXTURE_TEXT = "klieg creation-record fixture 2311\n";
const FIXTURE_DIGEST = createHash("sha256").update(FIXTURE_TEXT).digest();
const FIXTURE_NONCE = Buffer.from("0123456789abcdef", "hex");

function replying(body: Buffer, status = 200): TimestampFetch {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
  }));
}

const DIGICERT = TIMESTAMP_AUTHORITIES[0]!;
const FREETSA = TIMESTAMP_AUTHORITIES[1]!;

describe("the reply reader, on real authority bytes", () => {
  it("reads DigiCert's reply as granted, for OUR hash and OUR nonce, at its own time", () => {
    const parsed = parseTimestampReply(DIGICERT_REPLY);
    expect(parsed.kind).toBe("granted");
    if (parsed.kind !== "granted") return;
    expect(parsed.imprint.equals(FIXTURE_DIGEST)).toBe(true);
    expect(parsed.nonce?.toString("hex")).toBe("0123456789abcdef");
    expect(parsed.stampedAt.toISOString()).toBe("2026-10-12T03:11:42.000Z");
    /* The token is the ContentInfo inside the reply — what `openssl ts -token_in` read. */
    expect(parsed.tokenDer[0]).toBe(0x30);
    expect(parsed.tokenDer.length).toBe(5997);
    expect(DIGICERT_REPLY.includes(parsed.tokenDer)).toBe(true);
  });

  it("reads FreeTSA's reply the same way — the fallback is held to the same bytes-level bar", () => {
    const parsed = parseTimestampReply(FREETSA_REPLY);
    expect(parsed.kind).toBe("granted");
    if (parsed.kind !== "granted") return;
    expect(parsed.imprint.equals(FIXTURE_DIGEST)).toBe(true);
    expect(parsed.nonce?.toString("hex")).toBe("0123456789abcdef");
    expect(parsed.stampedAt.toISOString()).toBe("2026-10-12T03:11:43.000Z");
  });

  it("reads a refusal as a refusal (PKIStatus 2, no token)", () => {
    /* TimeStampResp { PKIStatusInfo { status 2 } } */
    expect(parseTimestampReply(Buffer.from("3005300302010" + "2", "hex"))).toEqual({ kind: "rejected", status: 2 });
  });

  it("REFUSES a truncated reply rather than reading part of it", () => {
    expect(() => parseTimestampReply(DIGICERT_REPLY.subarray(0, DIGICERT_REPLY.length - 40))).toThrow();
  });

  it("REFUSES a genTime naming no real instant (month 13), rather than rolling it into next year", () => {
    const at = DIGICERT_REPLY.indexOf(Buffer.from("20261012031142"));
    expect(at).toBeGreaterThan(0);
    const bad = Buffer.from(DIGICERT_REPLY);
    bad.write("20261312031142", at, "latin1");
    expect(() => parseTimestampReply(bad)).toThrow(/real instant/);
  });

  it("REFUSES trailing bytes after the reply", () => {
    expect(() => parseTimestampReply(Buffer.concat([DIGICERT_REPLY, Buffer.from([0])]))).toThrow(/trailing/);
  });
});

describe("the request writer", () => {
  it("refuses an imprint that is not a 32-byte SHA-256 digest", () => {
    expect(() => encodeTimestampRequest(Buffer.alloc(20), FIXTURE_NONCE)).toThrow(/32-byte/);
  });

  it("puts the digest and the nonce on the wire — and an authority answered exactly those (the fixtures)", () => {
    const request = encodeTimestampRequest(FIXTURE_DIGEST, FIXTURE_NONCE);
    expect(request.includes(FIXTURE_DIGEST)).toBe(true);
    expect(request.includes(FIXTURE_NONCE)).toBe(true);
    /* certReq TRUE, as the last three bytes — the token must carry the authority's certificate. */
    expect(request.subarray(-3).toString("hex")).toBe("0101ff");
  });

  it("writes a nonce with its high bit set as a POSITIVE integer", () => {
    const request = encodeTimestampRequest(FIXTURE_DIGEST, Buffer.from("ff00000000000001", "hex"));
    expect(request.toString("hex")).toContain("020900ff00000000000001");
  });
});

describe("asking one authority — every outcome is a value", () => {
  it("returns the token when the reply is for our digest and our nonce", async () => {
    const answer = await askAuthority({
      digest: FIXTURE_DIGEST, authority: DIGICERT, nonce: FIXTURE_NONCE, fetch: replying(DIGICERT_REPLY),
    });
    expect(isTimestampToken(answer)).toBe(true);
    if (!isTimestampToken(answer)) return;
    expect(answer.authority).toBe("digicert");
    expect(answer.stampedAt.toISOString()).toBe("2026-10-12T03:11:42.000Z");
  });

  it("⚠ NEGATIVE — a granted token for SOME OTHER HASH is refused, never stored", async () => {
    const other = createHash("sha256").update("a different record").digest();
    const answer = await askAuthority({
      digest: other, authority: DIGICERT, nonce: FIXTURE_NONCE, fetch: replying(DIGICERT_REPLY),
    });
    expect(answer).toEqual({ reason: "wrong_imprint", authority: "digicert" });
  });

  it("⚠ NEGATIVE — a granted token carrying a DIFFERENT NONCE is refused (a replayed reply)", async () => {
    const answer = await askAuthority({
      digest: FIXTURE_DIGEST, authority: DIGICERT, nonce: Buffer.from("0000000000000001", "hex"),
      fetch: replying(DIGICERT_REPLY),
    });
    expect(answer).toEqual({ reason: "wrong_nonce", authority: "digicert" });
  });

  it("refuses a reply larger than any timestamp reply before reading it", async () => {
    expect(await askAuthority({
      digest: FIXTURE_DIGEST, authority: DIGICERT, fetch: replying(Buffer.alloc(TIMESTAMP_REPLY_MAX_BYTES + 1)),
    })).toEqual({ reason: "malformed", authority: "digicert", detail: "reply larger than any timestamp reply" });
  });

  it("names a refusal, an HTTP error, garbage and a dead transport each as itself", async () => {
    expect(await askAuthority({
      digest: FIXTURE_DIGEST, authority: DIGICERT, fetch: replying(Buffer.from("300530030201" + "02", "hex")),
    })).toEqual({ reason: "rejected", authority: "digicert", status: 2 });
    expect(await askAuthority({
      digest: FIXTURE_DIGEST, authority: DIGICERT, fetch: replying(Buffer.alloc(0), 503),
    })).toEqual({ reason: "http_status", authority: "digicert", status: 503 });
    expect(await askAuthority({
      digest: FIXTURE_DIGEST, authority: DIGICERT, fetch: replying(Buffer.from("<html>oops</html>")),
    })).toMatchObject({ reason: "malformed", authority: "digicert" });
    expect(await askAuthority({
      digest: FIXTURE_DIGEST, authority: DIGICERT,
      fetch: vi.fn(async () => { throw new Error("ECONNRESET"); }) as unknown as TimestampFetch,
    })).toEqual({ reason: "transport", authority: "digicert" });
  });
});

describe("stamping — the primary, then the fallback, and never a throw", () => {
  it("falls back to the second authority when the first is down, and records which one answered", async () => {
    const asked: string[] = [];
    const fetch = vi.fn(async (url: string) => {
      asked.push(url);
      if (url === DIGICERT.url) throw new Error("down");
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => FREETSA_REPLY.buffer.slice(
          FREETSA_REPLY.byteOffset, FREETSA_REPLY.byteOffset + FREETSA_REPLY.byteLength,
        ) as ArrayBuffer,
      };
    }) as unknown as TimestampFetch;
    const result = await stampDigest({ digest: FIXTURE_DIGEST, fetch, nonce: FIXTURE_NONCE });
    expect(asked).toEqual([DIGICERT.url, FREETSA.url]);
    expect(result.token?.authority).toBe("freetsa");
    expect(result.refusals).toEqual([{ reason: "transport", authority: "digicert" }]);
  });

  it("CONTROL — the primary answering means the fallback is never asked", async () => {
    const asked: string[] = [];
    const fetch = vi.fn(async (url: string) => {
      asked.push(url);
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => DIGICERT_REPLY.buffer.slice(
          DIGICERT_REPLY.byteOffset, DIGICERT_REPLY.byteOffset + DIGICERT_REPLY.byteLength,
        ) as ArrayBuffer,
      };
    }) as unknown as TimestampFetch;
    const result = await stampDigest({ digest: FIXTURE_DIGEST, fetch, nonce: FIXTURE_NONCE });
    expect(asked).toEqual([DIGICERT.url]);
    expect(result.token?.authority).toBe("digicert");
  });

  it("returns no token and every refusal, in order, when both authorities fail — it does not throw", async () => {
    const result = await stampDigest({
      digest: FIXTURE_DIGEST,
      fetch: vi.fn(async () => { throw new Error("offline"); }) as unknown as TimestampFetch,
    });
    expect(result.token).toBeNull();
    expect(result.refusals).toEqual([
      { reason: "transport", authority: "digicert" },
      { reason: "transport", authority: "freetsa" },
    ]);
  });
});
