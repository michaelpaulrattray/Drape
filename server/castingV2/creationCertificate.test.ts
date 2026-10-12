/**
 * THE CERTIFICATE OF CREATION — the document (N2d-2, #2312).
 *
 * Driven through the real renderer on a record built by the real builder and
 * signed with a real key; the PDF's own text runs are read back out of its
 * bytes, so what is asserted is what a reader of the file sees.
 *
 *  - the words: "evidence of creation" is there, "proof of ownership" is not;
 *  - derived, not mirrored: the ID, the maker, the fingerprint and the steps
 *    come out of the SIGNED record — change the record and the page changes;
 *  - the bound at the last door: a record carrying the recipe is refused, and
 *    nothing is drawn (with the same record minus the recipe as the positive
 *    control, so the refusal is the bound's and not a broken renderer's);
 *  - §5's honesty rule: a backfilled record says both dates.
 */
import { generateKeyPairSync } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  buildCreationRecord,
  canonicalCreationRecordJson,
  CreationRecordBoundError,
} from "./creationRecord";
import {
  CERTIFICATE_HEADLINE,
  certificateDatesLine,
  certificateStepSentences,
  fingerprintLines,
  prepareCertificateMaster,
  printable,
  renderCreationCertificate,
  type CreationCertificateInput,
} from "./creationCertificate";
import { loadCreationRecordKey, signCreationRecord } from "./creationRecordSigning";

const SHA = "0123456789abcdef".repeat(4);

function record(overrides: Partial<Parameters<typeof buildCreationRecord>[0]> = {}) {
  return buildCreationRecord({
    kliegId: "KI-7Q2M-XR4D",
    accountId: 7,
    makerName: "Mia Strom",
    createdAt: new Date("2026-09-03T10:00:00Z"),
    mintedAt: new Date("2026-09-03T10:06:00Z"),
    masterSha256: SHA,
    rolledAt: new Date("2026-09-02T09:00:00Z"),
    rollsInSession: 2,
    keptAt: new Date("2026-09-02T09:30:00Z"),
    refinements: { count: 3, firstAt: new Date("2026-09-02T10:00:00Z"), lastAt: new Date("2026-09-03T08:00:00Z") },
    recordedAt: new Date("2026-10-14T00:00:00Z"),
    ...overrides,
  });
}

async function input(recordJson: string, overrides: Partial<CreationCertificateInput> = {}): Promise<CreationCertificateInput> {
  const key = loadCreationRecordKey(JSON.stringify(generateKeyPairSync("ed25519").privateKey.export({ format: "jwk" })));
  const png = await sharp({ create: { width: 200, height: 300, channels: 3, background: "#777777" } }).png().toBuffer();
  return {
    castName: "Pigman",
    recordJson,
    signature: await signCreationRecord(key, recordJson),
    signingKeyId: key.kid,
    publicJwk: key.publicJwk,
    timestampTokenBase64: Buffer.from("a timestamp token").toString("base64"),
    stampedAt: new Date("2026-10-14T04:31:00Z"),
    master: await prepareCertificateMaster(png),
    ...overrides,
  };
}

/** Every text run the PDF draws, in order, joined — what a reader of the file sees. */
function textOf(pdf: Buffer): string {
  const runs = pdf.toString("latin1").match(/\((?:\\.|[^\\)])*\) Tj/g) ?? [];
  return runs
    .map((run) => run.slice(1, -4).replace(/\\([()\\])/g, "$1"))
    .join(" ");
}

describe("the certificate's words", () => {
  it("is a PDF headed with the design's sentence, and says evidence of creation", async () => {
    const pdf = renderCreationCertificate(await input(canonicalCreationRecordJson(record())));
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const text = textOf(pdf);
    expect(CERTIFICATE_HEADLINE).toBe(
      "This certifies that this character was created in Klieg. It is evidence of creation, not a registration of ownership.",
    );
    expect(text).toContain("This certifies that this character was created in Klieg.");
    expect(text).toContain("evidence of creation");
    expect(text).toContain("Certificate of Creation");
  });

  it("⚠ never says proof of ownership — anywhere in the file, appendix included", async () => {
    const pdf = renderCreationCertificate(await input(canonicalCreationRecordJson(record())));
    const text = textOf(pdf);
    /* Positive control first: the reader sees the page at all. */
    expect(text.length).toBeGreaterThan(500);
    expect(text).not.toMatch(/proof of ownership/i);
    expect(text).not.toMatch(/proves? (?:that you |your )?own/i);
    expect(pdf.toString("latin1")).not.toMatch(/proof of ownership/i);
  });

  it("names no timestamping vendor anywhere a person reads", async () => {
    const text = textOf(renderCreationCertificate(await input(canonicalCreationRecordJson(record()))));
    expect(text).not.toMatch(/digicert|freetsa/i);
  });
});

describe("derived from the signed record", () => {
  it("prints the ID, the maker, the fingerprint and the steps that the record holds", async () => {
    const text = textOf(renderCreationCertificate(await input(canonicalCreationRecordJson(record()))));
    expect(text).toContain("KI-7Q2M-XR4D");
    expect(text).toContain("Mia Strom");
    expect(text).toContain("Pigman");
    const [one, two] = fingerprintLines(SHA);
    expect(text).toContain(one);
    expect(text).toContain(two);
    expect(text).toContain("Refined 3 times between 2 September 2026 and 3 September 2026.");
    expect(text).toContain("First appeared on 2 September 2026, in roll 2 of its casting session.");
  });

  it("⚠ a different record draws a different page — the facts are read, not carried beside it", async () => {
    const other = record({ kliegId: "KI-OTHER-ONE", makerName: "Someone Else", masterSha256: "f".repeat(64) });
    const text = textOf(renderCreationCertificate(await input(canonicalCreationRecordJson(other))));
    expect(text).toContain("KI-OTHER-ONE");
    expect(text).toContain("Someone Else");
    expect(text).not.toContain("KI-7Q2M-XR4D");
    expect(text).not.toContain("Mia Strom");
  });

  it("carries the exact signed bytes in the appendix, so the signature can be checked against them", async () => {
    const json = canonicalCreationRecordJson(record());
    const made = await input(json);
    const text = textOf(renderCreationCertificate(made)).replace(/ /g, "");
    expect(text).toContain(Buffer.from(json, "utf8").toString("base64"));
    expect(text).toContain(made.signature);
    expect(text).toContain(made.publicJwk!.x);
  });

  it("a record signed by another key prints its key id, never the wrong public key", async () => {
    const made = await input(canonicalCreationRecordJson(record()));
    const text = textOf(renderCreationCertificate({ ...made, publicJwk: null }));
    expect(text).not.toContain(made.publicJwk!.x);
    expect(text).toContain(`Key id ${made.signingKeyId}`);
  });
});

describe("⚠ the bound, at the last door", () => {
  const SENTINEL = "SENTINEL-RECIPE-a-tall-woman-in-red";

  it("POSITIVE CONTROL — the same record without the recipe renders", async () => {
    const json = canonicalCreationRecordJson(record());
    expect(() => renderCreationCertificate({ ...SYNC_INPUT, recordJson: json })).not.toThrow();
  });

  it.each(["masterPrompt", "technicalSchema", "preferences", "brief", "instructions"])(
    "refuses a stored record that carries %s — nothing is drawn",
    async (field) => {
      const leaky = JSON.stringify({ ...record(), steps: [{ event: "signed", at: "2026-09-03T10:00:00.000Z", [field]: SENTINEL }] });
      expect(() => renderCreationCertificate({ ...SYNC_INPUT, recordJson: leaky })).toThrow(CreationRecordBoundError);
    },
  );
});

/* One input built once for the synchronous arms above. */
const SYNC_INPUT: CreationCertificateInput = await input(canonicalCreationRecordJson(record()));

describe("§5's honesty rule — the dates", () => {
  it("a record stamped the day its cast was made says it once", () => {
    expect(certificateDatesLine(new Date("2026-10-12T09:00:00Z"), new Date("2026-10-12T09:01:00Z")))
      .toBe("Created and independently timestamped 12 October 2026");
  });

  it("⚠ a backfilled record says BOTH dates, plainly", () => {
    expect(certificateDatesLine(new Date("2026-09-03T09:00:00Z"), new Date("2026-10-14T09:00:00Z")))
      .toBe("Created 3 September 2026 · recorded and timestamped 14 October 2026");
  });

  it("draws the backfill line on the page", async () => {
    const text = textOf(renderCreationCertificate(SYNC_INPUT)).replace(/\s+/g, " ");
    expect(text).toContain("Created 3 September 2026 · recorded and timestamped 14 October 2026");
  });
});

describe("the steps as sentences", () => {
  it("says one refinement once, and leaves out a step it does not know", () => {
    expect(certificateStepSentences([
      { event: "refined", count: 1, firstAt: "2026-09-02T10:00:00Z", lastAt: "2026-09-02T10:00:00Z" },
      { event: "teleported", at: "2026-09-02T10:00:00Z" } as never,
      { event: "signed", at: "2026-09-03T10:00:00Z" },
    ])).toEqual(["Refined once, on 2 September 2026.", "Signed on 3 September 2026."]);
  });

  it("folds a name to what the page can print, and never prints broken glyphs", () => {
    expect(printable("Zoë Šarić", "x")).toBe("Zoë Saric");
    expect(printable("美咲", "Untitled character")).toBe("Untitled character");
  });
});
