/**
 * THE INDEPENDENT TIMESTAMP ON A CREATION RECORD — RFC 3161, N2d-1 (#2311).
 *
 * The design (`docs/specs/N2D_RECORD_OF_CREATION_DESIGN_2026-10-12.md` §5)
 * chose and MEASURED this capability on 2026-10-12: an RFC 3161 time-stamp
 * authority answers a hash with a token signed by somebody who is not Klieg,
 * which fixes the record's existence at a point in time anyone can check years
 * later without a subscription. Two public authorities, both $0:
 *
 *   DigiCert public TSA   0.43–0.46 s warm, 1.6 s cold   the default
 *   FreeTSA               ~1.0 s                         the fallback
 *
 * ⚠ **THE CHOICE CARRIES A DATE — 2026-10-12 — AND AN EXPIRY.** Like every
 * engine choice in this product (the disappearing-technology law, clause 1), a
 * rung that touches this road re-asks whether these are still the right two.
 *
 * ⚠ **WHICH AUTHORITY ANSWERED IS RECORDED INTERNALLY AND NEVER NAMED TO A
 * CUSTOMER.** Every surface says *"independently timestamped"* (§2, Q3). The
 * `authority` id this module returns is for the row and the logs only.
 *
 * # What this module proves about a reply, and what it deliberately does not
 *
 * Proven before a token is accepted, on the bytes:
 *   - the authority said `granted` (0) or `grantedWithMods` (1);
 *   - the token's message imprint is SHA-256 over EXACTLY the digest we sent —
 *     a token for some other hash is refused, not stored;
 *   - the token carries the NONCE we sent — a replayed or cross-wired reply is
 *     refused;
 *   - the token's own time (`genTime`) parses, and that is the stamp time;
 *   - the token's CMS SIGNATURE verifies and chains to one of two PINNED roots
 *     (`creationRecordTimestampTrust.ts`) — added on the relay's finding 2 on
 *     PR #2317, which named the forgery the first version would have stored:
 *     DigiCert answers only over plain HTTP (its HTTPS port refused, measured
 *     2026-10-12), so the signature, not the transport, is what makes a token
 *     ours to keep. A token that fails it is refused and the record retries.
 *
 * # Why a hand-written DER reader and not a library
 *
 * Declared rather than slipped in (the fidelity law): the tree carries no
 * ASN.1 library, the request is a fixed five-field structure, and the reply is
 * read along ONE path to four fields. The reader REFUSES every shape it was not
 * written for — indefinite lengths, a constructed (BER) eContent, a length
 * running past its parent — rather than guessing, so the failure mode is "no
 * token stored, the record retries", never "a wrong token stored". Its arms run
 * against a REAL DigiCert reply captured into `__fixtures__`, not against bytes
 * this module wrote itself.
 */
import { randomBytes } from "node:crypto";

import { verifyTimestampSignature } from "./creationRecordTimestampTrust";

/** An authority this road may ask. `id` is internal — never customer copy. */
export type TimestampAuthority = { id: string; url: string };

/**
 * The measured pair, in the order they are asked (design §5, 2026-10-12).
 * DigiCert's endpoint is plain HTTP by its operator's own publication; the
 * token's integrity is its signature, not the transport.
 */
export const TIMESTAMP_AUTHORITIES: readonly TimestampAuthority[] = [
  { id: "digicert", url: "http://timestamp.digicert.com" },
  { id: "freetsa", url: "https://freetsa.org/tsr" },
];

/** Real replies measured 4.6–6.0 KB with certificates; anything this large is not one. */
export const TIMESTAMP_REPLY_MAX_BYTES = 64 * 1024;

/** Per-authority deadline. The measured worst case was 1.6 s cold. */
export const TIMESTAMP_TIMEOUT_MS = 8_000;

export type TimestampToken = {
  /** The TimeStampToken (a CMS ContentInfo), DER — what `openssl ts -token_in` reads. */
  tokenDer: Buffer;
  /** The authority's own time for the stamp. */
  stampedAt: Date;
  /** Which authority answered. INTERNAL. */
  authority: string;
};

export type TimestampRefusal =
  | { reason: "transport"; authority: string }
  | { reason: "http_status"; authority: string; status: number }
  | { reason: "rejected"; authority: string; status: number }
  | { reason: "malformed"; authority: string; detail: string }
  | { reason: "wrong_imprint"; authority: string }
  | { reason: "wrong_nonce"; authority: string }
  | { reason: "unverified"; authority: string; detail: string };

/* ------------------------------------------------------------ DER, written */

const SHA256_OID = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]);
const SHA256_OID_TEXT = "2.16.840.1.101.3.4.2.1";
const SIGNED_DATA_OID_TEXT = "1.2.840.113549.1.7.2";
const TST_INFO_OID_TEXT = "1.2.840.113549.1.9.16.1.4";

function derLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  let rest = length;
  while (rest > 0) {
    bytes.unshift(rest & 0xff);
    rest >>>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function tlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

/** A DER INTEGER from unsigned big-endian bytes — minimal, and never negative. */
function derUnsignedInteger(bytes: Buffer): Buffer {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
  let body = bytes.subarray(start);
  if (body[0]! & 0x80) body = Buffer.concat([Buffer.from([0]), body]);
  return tlv(0x02, body);
}

/**
 * The TimeStampReq (RFC 3161 §2.4.1): version 1, a SHA-256 imprint of
 * `digest`, our nonce, and `certReq` TRUE so the token carries the
 * authority's certificate and stays verifiable offline.
 */
export function encodeTimestampRequest(digest: Buffer, nonce: Buffer): Buffer {
  if (digest.length !== 32) throw new Error("a creation-record imprint is a 32-byte SHA-256 digest");
  const algorithm = tlv(0x30, Buffer.concat([SHA256_OID, Buffer.from([0x05, 0x00])]));
  const imprint = tlv(0x30, Buffer.concat([algorithm, tlv(0x04, digest)]));
  return tlv(0x30, Buffer.concat([
    derUnsignedInteger(Buffer.from([1])),
    imprint,
    derUnsignedInteger(nonce),
    Buffer.from([0x01, 0x01, 0xff]),
  ]));
}

/* ------------------------------------------------------------- DER, read */

type Node = {
  tag: number;
  /** Offset of the tag byte. */
  start: number;
  contentStart: number;
  /** One past the last content byte. */
  end: number;
};

class DerShapeError extends Error {}

function readNode(buffer: Buffer, offset: number, limit: number): Node {
  if (offset + 2 > limit) throw new DerShapeError("truncated header");
  const tag = buffer[offset]!;
  if ((tag & 0x1f) === 0x1f) throw new DerShapeError("multi-byte tags are not read");
  const first = buffer[offset + 1]!;
  let length: number;
  let contentStart: number;
  if (first < 0x80) {
    length = first;
    contentStart = offset + 2;
  } else {
    const count = first & 0x7f;
    if (count === 0) throw new DerShapeError("indefinite length (BER) is refused");
    if (count > 4) throw new DerShapeError("length too long");
    if (offset + 2 + count > limit) throw new DerShapeError("truncated length");
    length = 0;
    for (let index = 0; index < count; index += 1) length = length * 256 + buffer[offset + 2 + index]!;
    contentStart = offset + 2 + count;
  }
  const end = contentStart + length;
  if (end > limit) throw new DerShapeError("length runs past its parent");
  return { tag, start: offset, contentStart, end };
}

function childrenOf(buffer: Buffer, node: Node): Node[] {
  const children: Node[] = [];
  let at = node.contentStart;
  while (at < node.end) {
    const child = readNode(buffer, at, node.end);
    children.push(child);
    at = child.end;
  }
  return children;
}

function expectTag(node: Node | undefined, tag: number, what: string): Node {
  if (!node || node.tag !== tag) throw new DerShapeError(`expected ${what}`);
  return node;
}

function contentOf(buffer: Buffer, node: Node): Buffer {
  return buffer.subarray(node.contentStart, node.end);
}

function oidText(bytes: Buffer): string {
  if (bytes.length === 0) throw new DerShapeError("empty OID");
  const parts: number[] = [Math.floor(bytes[0]! / 40), bytes[0]! % 40];
  let value = 0;
  for (let index = 1; index < bytes.length; index += 1) {
    value = value * 128 + (bytes[index]! & 0x7f);
    if (!(bytes[index]! & 0x80)) {
      parts.push(value);
      value = 0;
    }
  }
  return parts.join(".");
}

function unsignedValue(bytes: Buffer): Buffer {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
  return bytes.subarray(start);
}

function smallInteger(bytes: Buffer): number {
  if (bytes.length === 0 || bytes.length > 4 || bytes[0]! & 0x80) throw new DerShapeError("unexpected integer");
  return bytes.reduce((total, byte) => total * 256 + byte, 0);
}

/** GeneralizedTime `YYYYMMDDHHMMSS[.f+]Z`, the only form RFC 3161 allows. */
function generalizedTime(text: string): Date {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.(\d+))?Z$/.exec(text);
  if (!match) throw new DerShapeError("genTime is not a UTC GeneralizedTime");
  const [, year, month, day, hour, minute, second, fraction] = match;
  const millis = fraction ? Number(`0.${fraction}`) * 1000 : 0;
  const at = new Date(Date.UTC(
    Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), Math.floor(millis),
  ));
  if (
    Number.isNaN(at.getTime())
    || at.getUTCFullYear() !== Number(year) || at.getUTCMonth() !== Number(month) - 1
    || at.getUTCDate() !== Number(day) || at.getUTCHours() !== Number(hour)
    || at.getUTCMinutes() !== Number(minute) || at.getUTCSeconds() !== Number(second)
  ) {
    /* Date.UTC rolls month 13 into next year; a genTime that does not round-trip is refused. */
    throw new DerShapeError("genTime does not name a real instant");
  }
  return at;
}

export type ParsedTimestampReply =
  | {
    kind: "granted";
    tokenDer: Buffer;
    stampedAt: Date;
    imprint: Buffer;
    nonce: Buffer | null;
    signed: SignedParts;
  }
  | { kind: "rejected"; status: number };

/**
 * Read a TimeStampResp (RFC 3161 §2.4.2) along the one path this road needs.
 * Throws `Error` on any shape it was not written for — the caller turns that
 * into a `malformed` refusal, never into a stored token.
 */
export function parseTimestampReply(reply: Buffer): ParsedTimestampReply {
  const root = expectTag(readNode(reply, 0, reply.length), 0x30, "TimeStampResp");
  if (root.end !== reply.length) throw new DerShapeError("trailing bytes after TimeStampResp");
  const [statusInfo, tokenNode] = childrenOf(reply, root);
  const statusFields = childrenOf(reply, expectTag(statusInfo, 0x30, "PKIStatusInfo"));
  const status = smallInteger(contentOf(reply, expectTag(statusFields[0], 0x02, "PKIStatus")));
  if (status !== 0 && status !== 1) return { kind: "rejected", status };

  const contentInfo = expectTag(tokenNode, 0x30, "TimeStampToken");
  const [contentType, explicitContent] = childrenOf(reply, contentInfo);
  if (oidText(contentOf(reply, expectTag(contentType, 0x06, "contentType"))) !== SIGNED_DATA_OID_TEXT) {
    throw new DerShapeError("the token is not SignedData");
  }
  const signedData = expectTag(childrenOf(reply, expectTag(explicitContent, 0xa0, "[0] content"))[0], 0x30, "SignedData");
  const signedFields = childrenOf(reply, signedData);
  const encap = expectTag(signedFields[2], 0x30, "EncapsulatedContentInfo");
  const [eContentType, eContentExplicit] = childrenOf(reply, encap);
  if (oidText(contentOf(reply, expectTag(eContentType, 0x06, "eContentType"))) !== TST_INFO_OID_TEXT) {
    throw new DerShapeError("the token does not carry TSTInfo");
  }
  const octets = expectTag(
    childrenOf(reply, expectTag(eContentExplicit, 0xa0, "[0] eContent"))[0],
    0x04,
    "a primitive OCTET STRING eContent",
  );
  const tstBytes = contentOf(reply, octets);
  const tstRoot = expectTag(readNode(tstBytes, 0, tstBytes.length), 0x30, "TSTInfo");
  const tst = childrenOf(tstBytes, tstRoot);
  /* version, policy, messageImprint, serialNumber, genTime, then optionals */
  const imprintFields = childrenOf(tstBytes, expectTag(tst[2], 0x30, "MessageImprint"));
  const algorithm = childrenOf(tstBytes, expectTag(imprintFields[0], 0x30, "hashAlgorithm"));
  if (oidText(contentOf(tstBytes, expectTag(algorithm[0], 0x06, "hash OID"))) !== SHA256_OID_TEXT) {
    throw new DerShapeError("the imprint is not SHA-256");
  }
  const imprint = Buffer.from(contentOf(tstBytes, expectTag(imprintFields[1], 0x04, "hashedMessage")));
  const stampedAt = generalizedTime(contentOf(tstBytes, expectTag(tst[4], 0x18, "genTime")).toString("latin1"));
  /* The nonce is the first INTEGER after genTime: accuracy is a SEQUENCE and
     ordering a BOOLEAN, so neither can be mistaken for it. */
  const nonceNode = tst.slice(5).find((node) => node.tag === 0x02);
  const nonce = nonceNode ? Buffer.from(unsignedValue(contentOf(tstBytes, nonceNode))) : null;
  return {
    kind: "granted",
    tokenDer: Buffer.from(reply.subarray(contentInfo.start, contentInfo.end)),
    stampedAt,
    imprint,
    nonce,
    signed: readSignedParts(reply, signedFields, Buffer.from(tstBytes)),
  };
}

/** The pieces of the SignedData a signature check needs (RFC 5652 §5). */
export type SignedParts = {
  /** The TSTInfo bytes — the content the signature's messageDigest covers. */
  content: Buffer;
  /** Every certificate the token carries, DER. */
  certificates: Buffer[];
  signers: Array<{
    digestOid: string;
    /** The signed attributes re-tagged as a SET — the exact bytes signed (§5.4). */
    signedAttributes: Buffer;
    contentTypeOid: string | null;
    messageDigest: Buffer | null;
    signatureOid: string;
    signature: Buffer;
  }>;
};

function readSignedParts(reply: Buffer, signedFields: Node[], content: Buffer): SignedParts {
  const certificates: Buffer[] = [];
  const certBag = signedFields.find((node) => node.tag === 0xa0);
  if (certBag) {
    for (const cert of childrenOf(reply, certBag)) {
      if (cert.tag === 0x30) certificates.push(Buffer.from(reply.subarray(cert.start, cert.end)));
    }
  }
  const signerSet = signedFields[signedFields.length - 1];
  if (!signerSet || signerSet.tag !== 0x31) throw new DerShapeError("expected SignerInfos");
  const signers = childrenOf(reply, signerSet).map((signerInfo) => {
    const fields = childrenOf(reply, expectTag(signerInfo, 0x30, "SignerInfo"));
    /* version, sid, digestAlgorithm, [0] signedAttrs, signatureAlgorithm, signature, [1]? */
    const digestAlgorithm = childrenOf(reply, expectTag(fields[2], 0x30, "digestAlgorithm"));
    const attrsNode = expectTag(fields[3], 0xa0, "[0] signedAttrs (a TSA token without them is refused)");
    const signatureAlgorithm = childrenOf(reply, expectTag(fields[4], 0x30, "signatureAlgorithm"));
    const signature = Buffer.from(contentOf(reply, expectTag(fields[5], 0x04, "signature")));
    let contentTypeOid: string | null = null;
    let messageDigest: Buffer | null = null;
    for (const attribute of childrenOf(reply, attrsNode)) {
      const [type, values] = childrenOf(reply, expectTag(attribute, 0x30, "Attribute"));
      const oid = oidText(contentOf(reply, expectTag(type, 0x06, "attribute type")));
      const first = childrenOf(reply, expectTag(values, 0x31, "attribute values"))[0];
      if (oid === "1.2.840.113549.1.9.3") contentTypeOid = oidText(contentOf(reply, expectTag(first, 0x06, "contentType value")));
      if (oid === "1.2.840.113549.1.9.4") messageDigest = Buffer.from(contentOf(reply, expectTag(first, 0x04, "messageDigest value")));
    }
    const signedAttributes = Buffer.from(reply.subarray(attrsNode.start, attrsNode.end));
    signedAttributes[0] = 0x31;
    return {
      digestOid: oidText(contentOf(reply, expectTag(digestAlgorithm[0], 0x06, "digest OID"))),
      signedAttributes,
      contentTypeOid,
      messageDigest,
      signatureOid: oidText(contentOf(reply, expectTag(signatureAlgorithm[0], 0x06, "signature OID"))),
      signature,
    };
  });
  return { content, certificates, signers };
}

/* ------------------------------------------------------------- the asking */

export type TimestampFetch = (url: string, init: {
  method: "POST";
  headers: Record<string, string>;
  body: Buffer;
  signal: AbortSignal;
}) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

/** Ask ONE authority. Every outcome is a value; nothing here throws. */
export async function askAuthority(input: {
  digest: Buffer;
  authority: TimestampAuthority;
  fetch?: TimestampFetch;
  nonce?: Buffer;
  timeoutMs?: number;
  /** The signature check — injected only by arms that drive a hand-made reply. */
  verify?: typeof verifyTimestampSignature;
}): Promise<TimestampToken | TimestampRefusal> {
  const nonce = input.nonce ?? randomBytes(8);
  const authority = input.authority.id;
  const send = input.fetch ?? (globalThis.fetch as unknown as TimestampFetch);
  let body: Buffer;
  try {
    const response = await send(input.authority.url, {
      method: "POST",
      headers: { "Content-Type": "application/timestamp-query", Accept: "application/timestamp-reply" },
      body: encodeTimestampRequest(input.digest, nonce),
      signal: AbortSignal.timeout(input.timeoutMs ?? TIMESTAMP_TIMEOUT_MS),
    });
    if (!response.ok) return { reason: "http_status", authority, status: response.status };
    body = Buffer.from(await response.arrayBuffer());
    if (body.length > TIMESTAMP_REPLY_MAX_BYTES) {
      return { reason: "malformed", authority, detail: "reply larger than any timestamp reply" };
    }
  } catch {
    return { reason: "transport", authority };
  }
  let parsed: ParsedTimestampReply;
  try {
    parsed = parseTimestampReply(body);
  } catch (error) {
    return { reason: "malformed", authority, detail: error instanceof Error ? error.message : "unreadable" };
  }
  if (parsed.kind === "rejected") return { reason: "rejected", authority, status: parsed.status };
  if (!parsed.imprint.equals(input.digest)) return { reason: "wrong_imprint", authority };
  if (!parsed.nonce || !parsed.nonce.equals(unsignedValue(nonce))) return { reason: "wrong_nonce", authority };
  /* The relay's finding 2 on PR #2317: a token is stored only once its CMS
     signature verifies and chains to a pinned root — DigiCert is asked over
     plain HTTP, and a stored token is never replaced. */
  const verdict = (input.verify ?? verifyTimestampSignature)(parsed.signed, parsed.stampedAt);
  if (!verdict.ok) return { reason: "unverified", authority, detail: verdict.reason };
  return { tokenDer: parsed.tokenDer, stampedAt: parsed.stampedAt, authority };
}

export function isTimestampToken(value: TimestampToken | TimestampRefusal): value is TimestampToken {
  return "tokenDer" in value;
}

/**
 * Stamp a digest: the primary, then the fallback. Returns the first token, or
 * every refusal in order. NEVER throws — a timestamp that could not be had is
 * a record that retries later, never a failed Sign (the ink-plate rule, §5).
 */
export async function stampDigest(input: {
  digest: Buffer;
  authorities?: readonly TimestampAuthority[];
  fetch?: TimestampFetch;
  timeoutMs?: number;
  /** Fixed only by tests replaying a captured reply; absent, each ask draws a fresh one. */
  nonce?: Buffer;
  verify?: typeof verifyTimestampSignature;
}): Promise<{ token: TimestampToken | null; refusals: TimestampRefusal[] }> {
  const refusals: TimestampRefusal[] = [];
  for (const authority of input.authorities ?? TIMESTAMP_AUTHORITIES) {
    const answer = await askAuthority({
      digest: input.digest,
      authority,
      fetch: input.fetch,
      timeoutMs: input.timeoutMs,
      nonce: input.nonce,
      verify: input.verify,
    });
    if (isTimestampToken(answer)) return { token: answer, refusals };
    refusals.push(answer);
  }
  return { token: null, refusals };
}
