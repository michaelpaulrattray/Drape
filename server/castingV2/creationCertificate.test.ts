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
  CERTIFICATE_DISCLAIMER,
  CERTIFICATE_HEADLINE,
  certificateDatesLine,
  certificateStepSentences,
  fingerprintLines,
  prepareCertificateMaster,
  printable,
  readSignedRecord,
  renderCreationCertificate,
  type CreationCertificateInput,
} from "./creationCertificate";
import { loadCreationRecordKey, signCreationRecord, verifyCreationRecord } from "./creationRecordSigning";

const SHA = "0123456789abcdef".repeat(4);

function record(overrides: Partial<Parameters<typeof buildCreationRecord>[0]> = {}) {
  return buildCreationRecord({
    kliegId: "KI-7Q2M-XR4D",
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
    .join(" ")
    /* A date's own spaces are non-breaking on the page (it never wraps mid-date). */
    .replace(/\u00a0/g, " ");
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

describe("⚠ #2352 — the appendix carries no account number", () => {
  /** Every text run with jsPDF's wrap points removed, so a word split across lines reads whole. */
  const appendixOf = (pdf: Buffer) => textOf(pdf).replace(/ /g, "");
  /* A version "1" record exactly as #2311 signed it — maker.accountId and all. */
  const v1Json = () => canonicalCreationRecordJson({ ...record(), recordVersion: "1", maker: { accountId: 823, displayName: "Mia Strom" } });

  it("a v2 record's certificate holds no account identifier — not in the text, not in the file", async () => {
    const json = canonicalCreationRecordJson(record());
    expect(JSON.parse(json).recordVersion).toBe("2");
    const pdf = renderCreationCertificate(await input(json));
    const text = appendixOf(pdf);
    /* CONTROL — the appendix is read: the record's own keys and display name are there. */
    expect(text).toContain("MiaStrom");
    expect(text).toContain("recordVersion");
    expect(text).not.toMatch(/accountId|userId|openId/i);
    expect(pdf.toString("latin1")).not.toMatch(/accountId/i);
  });

  it("POSITIVE CONTROL — the same reader DOES see accountId in a v1 record's appendix (so the arm above can fail)", async () => {
    const text = appendixOf(renderCreationCertificate(await input(v1Json())));
    expect(text).toContain("accountId");
  });

  it("a v1 record still renders and its signature still verifies — a signed record is never rewritten", async () => {
    const json = v1Json();
    const made = await input(json);
    expect(() => renderCreationCertificate(made)).not.toThrow();
    expect(await verifyCreationRecord(made.publicJwk!, json, made.signature)).toBe(true);
    expect(readSignedRecord(json).maker.displayName).toBe("Mia Strom");
  });

  it("a record claiming v2 that carries an account number is refused at the last door — nothing is drawn", async () => {
    const leaky = canonicalCreationRecordJson({ ...record(), maker: { accountId: 823, displayName: "Mia Strom" } });
    expect(() => renderCreationCertificate({ ...SYNC_INPUT, recordJson: leaky })).toThrow(CreationRecordBoundError);
  });
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

/* ------------------------------------------------------------------ #2331 */

/** Page one's content stream — the first stream that draws the title. */
function pageOneStream(pdf: Buffer): string {
  const streams = pdf.toString("latin1").split(/\bstream\r?\n/).slice(1).map((s) => s.split(/\r?\nendstream/)[0]);
  const page = streams.find((s) => s.includes("(Certificate of Creation) Tj"));
  if (!page) throw new Error("page one's content stream was not found");
  return page;
}

const PT_PER_MM = 72 / 25.4;

/**
 * Every text run on page one with the depth of its baseline from the TOP of
 * the page, in mm — read from the drawing operators themselves (`Td` places
 * a block, each `T*` steps down one `TL`), so it is where the PDF puts ink.
 */
function pageOneBaselines(pdf: Buffer): { text: string; mm: number }[] {
  const out: { text: string; mm: number }[] = [];
  for (const block of pageOneStream(pdf).match(/^BT$[\s\S]*?^ET$/gm) ?? []) {
    const leading = Number(block.match(/([\d.]+) TL/)?.[1] ?? 0);
    const td = block.match(/([\d.-]+) ([\d.-]+) Td/);
    if (!td) continue;
    let yPt = Number(td[2]);
    for (const line of block.split("\n")) {
      if (/^T\* /.test(line)) yPt -= leading;
      const run = line.match(/\(((?:\\.|[^\\)])*)\) Tj/);
      if (run) out.push({ text: run[1], mm: 297 - yPt / PT_PER_MM });
    }
  }
  return out;
}

describe("#2331 — the fuller disclaimer, and page one still fits", () => {
  it("is counsel's paragraph, verbatim, with the product's name", () => {
    expect(CERTIFICATE_DISCLAIMER).toBe(
      "This certificate records that a character with the stated ID and image fingerprint was created and signed in Klieg on the stated dates. "
        + "It is evidence of creation and of the integrity of the recorded data. "
        + "It is not a registration of ownership, does not create or transfer copyright or other intellectual property rights, "
        + "and does not constitute proof that copyright subsists in the character or any associated images.",
    );
  });

  it("is drawn on page one, directly beneath the headline, and the closing line is kept", async () => {
    const runs = pageOneBaselines(renderCreationCertificate(SYNC_INPUT)).map((r) => r.text.replace(/\\([()\\])/g, "$1"));
    const page = runs.join(" ").replace(/\s+/g, " ");
    expect(page).toContain(`${CERTIFICATE_HEADLINE} ${CERTIFICATE_DISCLAIMER}`);
    expect(page).toContain("This certificate is evidence of creation. It is not a registration of ownership.");
  });

  /* The longest page one a real record can draw: a tall master, a name and a
     maker that wrap, both dates, every step there is. */
  const WORST = async () => input(
    canonicalCreationRecordJson(record({ makerName: "Alexandria Wilhelmina Featherstonehaugh-Montgomery" })),
    {
      castName: "The Very Long-Named Character Who Keeps Going Well Past One Line",
      master: await prepareCertificateMaster(
        await sharp({ create: { width: 200, height: 640, channels: 3, background: "#777777" } }).png().toBuffer(),
      ),
    },
  );

  it.each([
    ["the ordinary page", async () => SYNC_INPUT],
    ["the longest page a record can draw", WORST],
  ])("⚠ %s: every line of the body sits above the footer, on ONE A4 page", async (_name, make) => {
    const runs = pageOneBaselines(renderCreationCertificate(await make()));
    const footer = runs.filter((r) => r.text.startsWith("Certificate of Creation · "));
    /* Positive controls: the reader finds the footer where the renderer puts
       it, and finds the closing paragraph at all. */
    expect(footer).toHaveLength(1);
    expect(footer[0].mm).toBeCloseTo(283, 1);
    expect(runs.some((r) => r.text.includes("not a registration of ownership."))).toBe(true);
    const body = runs.filter((r) => r !== footer[0] && !/^\d+ of \d+$/.test(r.text));
    /* Page one has no second page to spill onto: its lowest line keeps a
       clear 6 mm above the footer however long the page runs. */
    const lowest = Math.max(...body.map((r) => r.mm));
    expect(lowest).toBeLessThanOrEqual(footer[0].mm - 6);
  });
});
