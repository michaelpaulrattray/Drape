/**
 * THE CERTIFICATE OF CREATION — the document, N2d-2 (#2312).
 *
 * The design is `docs/specs/N2D_RECORD_OF_CREATION_DESIGN_2026-10-12.md`
 * (§1, §2 Q3, §5's honesty rule, §7 slice 2). One A4 PDF: a first page a person
 * reads, and an appendix nobody must open that carries what anyone needs to
 * check the record without asking Klieg.
 *
 * # Derived from the SIGNED record, never mirrored beside it
 *
 * Every fact on the first page — the Klieg ID, the maker, the dates, the
 * fingerprint, the steps — is read back out of the stored canonical record
 * JSON, the exact bytes that were signed and stamped (working law 4). The only
 * things that are not in the record are the cast's name, the authority's stamp
 * time (the token's own time, stored beside it) and the picture, and the route
 * proves the picture IS the fingerprinted one before it gets here.
 *
 * # ⚠ THE BOUND, restated at the last door
 *
 * `masterPrompt`, `technicalSchema`, `preferences`, the brief, a refine's
 * words — none of it may appear on this document or in its appendix (design
 * §3; the founder's 2026-07-25 *"A customer's cast is their work"*). The record
 * was bound-checked before it was signed; it is checked AGAIN here
 * (`assertCreationRecordBound`) because this is the door it leaves the
 * building by, and the input type carries no field that could hold the recipe.
 *
 * ⚠ **The appendix prints the record VERBATIM, account number included if the
 * record carries one** (#2352). A version "2" record carries none — the bound
 * refuses `accountId` at any depth in it. A version "1" record keeps its
 * `maker.accountId` in the appendix, because those are its signed bytes and a
 * certificate that edited them would no longer verify.
 *
 * # The words
 *
 * Every sentence says **evidence of creation** and none says ownership is
 * proven: prompts alone earn no copyright in the US and Australia has no AI
 * ruling, so a document promising ownership would promise what it cannot
 * deliver (the design's settled preamble). No vendor, no algorithm and no
 * token appears on the first page (§2 Q3); the appendix is the one place the
 * machinery shows, because a certificate nobody can check is decoration.
 */
import { createHash } from "node:crypto";

import { jsPDF } from "jspdf";
import sharp from "sharp";

import { PRODUCT_NAME } from "@shared/brand";
import {
  assertCreationRecordBound,
  type CreationRecordStep,
  type StoredCreationRecord,
} from "./creationRecord";
import type { CreationRecordPublicJwk } from "./creationRecordSigning";

/** The headline, verbatim from the design (§1). */
export const CERTIFICATE_HEADLINE =
  `This certifies that this character was created in ${PRODUCT_NAME}. It is evidence of creation, not a registration of ownership.`;

/**
 * The fuller disclaimer, set directly beneath the headline: counsel's wording,
 * verbatim from card #2331 (the founder shared counsel's review 2026-10-12).
 * It says what the document IS evidence of and, in so many words, what it is
 * not: no registration of ownership, no copyright created or transferred, no
 * proof that copyright subsists at all.
 */
export const CERTIFICATE_DISCLAIMER =
  `This certificate records that a character with the stated ID and image fingerprint was created and signed in ${PRODUCT_NAME} on the stated dates. `
  + "It is evidence of creation and of the integrity of the recorded data. "
  + "It is not a registration of ownership, does not create or transfer copyright or other intellectual property rights, "
  + "and does not constitute proof that copyright subsists in the character or any associated images.";

export type CertificateMaster = { jpeg: Buffer; width: number; height: number };

export type CreationCertificateInput = {
  /** The cast's own name, as its owner set it; null draws "Untitled character". */
  castName: string | null;
  /** The stored canonical record — exactly the bytes signed and stamped. */
  recordJson: string;
  /** Detached signature over `recordJson`, as stored. */
  signature: string;
  signingKeyId: string;
  /** The public half — null when the service's key is not the one that signed this record. */
  publicJwk: CreationRecordPublicJwk | null;
  /** The authority's token, DER, base64, as stored. */
  timestampTokenBase64: string;
  /** The authority's own time for the stamp. */
  stampedAt: Date;
  master: CertificateMaster;
};

/** The master, made print-sized: a flattened JPEG no wider than this many pixels. */
const MASTER_MAX_PX = 1400;

/** Decode the stored master picture into the one shape the document embeds. */
export async function prepareCertificateMaster(bytes: Buffer): Promise<CertificateMaster> {
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize({ width: MASTER_MAX_PX, height: MASTER_MAX_PX, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true });
  return { jpeg: data, width: info.width, height: info.height };
}

/** Parse the stored record and check it is the shape this document knows how to read. */
export function readSignedRecord(recordJson: string): StoredCreationRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(recordJson);
  } catch {
    throw new Error("the stored creation record is not JSON");
  }
  /* The bound first: a record carrying the recipe never reaches a renderer. */
  assertCreationRecordBound(parsed);
  const record = parsed as StoredCreationRecord;
  if (
    typeof record !== "object" || record === null
    || typeof record.kliegId !== "string"
    || typeof record.createdAt !== "string"
    || typeof record.mintedAt !== "string"
    || typeof record.master?.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(record.master.sha256)
    || !Array.isArray(record.steps)
  ) {
    throw new Error("the stored creation record is not a shape this certificate can read");
  }
  return record;
}

/* ------------------------------------------------------------------ words */

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

export function certificateDate(at: Date | string): string {
  return DATE.format(typeof at === "string" ? new Date(at) : at);
}

function sameDay(left: Date, right: Date): boolean {
  return certificateDate(left) === certificateDate(right);
}

/**
 * The dates line — §5's honesty rule. The stamp proves when the RECORD existed,
 * not when the cast was made, so a record made later than its cast (one
 * backfilled on first request) says both dates plainly.
 */
export function certificateDatesLine(createdAt: Date, stampedAt: Date): string {
  if (sameDay(createdAt, stampedAt)) {
    return `Created and independently timestamped ${certificateDate(createdAt)}`;
  }
  return `Created ${certificateDate(createdAt)} · recorded and timestamped ${certificateDate(stampedAt)}`;
}

/** The steps, as plain sentences — events only, never a word of the brief or a refine. */
export function certificateStepSentences(steps: readonly CreationRecordStep[]): string[] {
  return steps.map((step) => {
    switch (step.event) {
      case "rolled":
        return step.rollsInSession && step.rollsInSession > 0
          ? `First appeared on ${certificateDate(step.at)}, in roll ${step.rollsInSession} of its casting session.`
          : `First appeared on ${certificateDate(step.at)}.`;
      case "kept":
        return `Chosen and kept on ${certificateDate(step.at)}.`;
      case "refined": {
        if (step.count === 1) return `Refined once, on ${certificateDate(step.firstAt)}.`;
        const first = certificateDate(step.firstAt);
        const last = certificateDate(step.lastAt);
        return first === last
          ? `Refined ${step.count} times on ${first}.`
          : `Refined ${step.count} times between ${first} and ${last}.`;
      }
      case "signed":
        return `Signed on ${certificateDate(step.at)}.`;
      case "minted":
        return `Character sheet completed on ${certificateDate(step.at)}.`;
      default:
        /* A step this version of the document does not know is left out
           rather than guessed at in words. */
        return null;
    }
  }).filter((line): line is string => line !== null);
}

/**
 * The fingerprint grouped like a passport number: eight groups of eight, two
 * lines — lowercase, exactly as any standard SHA-256 tool prints it, so it can
 * be compared character for character.
 */
export function fingerprintLines(sha256: string): [string, string] {
  const groups = sha256.toLowerCase().match(/.{8}/g) ?? [];
  return [groups.slice(0, 4).join(" "), groups.slice(4, 8).join(" ")];
}

/**
 * The standard PDF fonts speak Latin-1 only. A name outside it is folded to
 * its closest Latin letters (é stays, ł → l) and anything with no Latin form
 * becomes a plain placeholder rather than a row of broken glyphs. ⚠ DECLARED,
 * not hidden: a name written wholly in another script prints as the fallback.
 */
export function printable(text: string, fallback: string): string {
  const folded = text
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .split("")
    .map((ch) => {
      if (ch.charCodeAt(0) <= 0xff) return ch;
      const stripped = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      return stripped.length > 0 && Array.from(stripped).every((c) => c.charCodeAt(0) <= 0xff) ? stripped : "";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return folded.length > 0 ? folded : fallback;
}

/* --------------------------------------------------------------- drawing */

const INK: [number, number, number] = [10, 10, 10];
const SOFT: [number, number, number] = [96, 96, 96];
const FAINT: [number, number, number] = [150, 150, 150];
const RULE: [number, number, number] = [200, 200, 200];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 22;
const CONTENT_W = PAGE_W - MARGIN * 2;

function label(doc: jsPDF, text: string, x: number, y: number): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...SOFT);
  doc.text(text.toUpperCase(), x, y, { charSpace: 0.45 });
}

function rule(doc: jsPDF, y: number): void {
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
}

function header(doc: jsPDF, kliegId: string): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text(PRODUCT_NAME.toUpperCase(), MARGIN, MARGIN, { charSpace: 1.4 });
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.text(kliegId, PAGE_W - MARGIN, MARGIN, { align: "right" });
  rule(doc, MARGIN + 4);
}

function footer(doc: jsPDF, kliegId: string, page: number, pages: number): void {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...FAINT);
  doc.text(`Certificate of Creation · ${kliegId}`, MARGIN, PAGE_H - 14);
  doc.text(`${page} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 14, { align: "right" });
}

/**
 * The record as text a person can read. The standard fonts print Latin-1 only,
 * so anything outside it is written as its JSON escape (\uXXXX) — the same JSON,
 * read the same way by any parser. The EXACT bytes ride beside it in base64.
 */
function readableRecordText(recordJson: string): string {
  return recordJson.replace(/[^\u0000-\u00ff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

/*
 * # Where the appendix may break a line (#2366)
 *
 * A PDF reader rebuilds text from the lines it finds. When a line was cut in
 * the middle of a word, a hex string or a key, some readers put a space there,
 * some join it to the wrong neighbour, and the record comes back scrambled \u2014
 * which is what a reader did to a real certificate on 2026-10-12, reporting a
 * name and a fingerprint "mismatch" that were not there. So every break in the
 * appendix falls at a point where breaking cannot change what is read back:
 *
 *  - the data blocks (base64, the signature, the hash) break every 64
 *    characters, the PEM convention, and never between the JWS's two dots \u2014
 *    remove the line breaks and the exact text returns;
 *  - JSON (the readable record, the public key) is printed one key per line;
 *    a line still too long breaks after its `:`. ⚠ DECLARED: a string value
 *    longer than a whole line (a 128-character name; a name in another script,
 *    six characters per letter once escaped) cannot fit any other way, so it
 *    runs on — breaking just after a space, so every word stays whole, or,
 *    with no space to use, between two escapes and never inside one. Strip
 *    each line's indentation and join the lines, and the JSON parses to the
 *    same value. The exact bytes are always the base64 block.
 *
 * None of this touches the signed bytes. They are what they were; only the way
 * they are laid on the page changed.
 */

/** The data blocks' line width \u2014 the PEM convention. */
export const APPENDIX_DATA_WIDTH = 64;

/**
 * Cut a run of data into lines of `width` characters, never between the two
 * dots of a detached JWS (`header..signature`): a break there leaves a line
 * ending in "." beside one starting with ".", which reads as one dot or three.
 */
export function wrapDataLines(data: string, width = APPENDIX_DATA_WIDTH): string[] {
  const lines: string[] = [];
  let at = 0;
  while (at < data.length) {
    let end = Math.min(at + width, data.length);
    if (end < data.length && data[end - 1] === "." && data[end] === ".") end -= 1;
    lines.push(data.slice(at, end));
    at = end;
  }
  return lines.length > 0 ? lines : [""];
}

/** A JSON string literal's atoms: an escape (`\uXXXX`, `\"`, \u2026) is never split. */
function stringAtoms(literal: string): string[] {
  return literal.match(/\\u[0-9a-fA-F]{4}|\\.|[\s\S]/g) ?? [];
}

/**
 * Lay a JSON document out for reading inside `width` characters. `json` must
 * already be printable (see `readableRecordText`); pretty-printing it adds only
 * whitespace between tokens, so the value is unchanged.
 */
export function readableJsonLines(json: string, width: number): string[] {
  const pretty = readableRecordText(JSON.stringify(JSON.parse(json), null, 2));
  const out: string[] = [];
  for (const line of pretty.split("\n")) {
    if (line.length <= width) {
      out.push(line);
      continue;
    }
    const indent = line.match(/^ */)![0].length;
    /* A key's line breaks after its colon first: the value moves down a line. */
    const colon = line.match(/^( *"(?:\\.|[^"\\])*": )(.*)$/);
    let value = line;
    let valueIndent = indent;
    if (colon) {
      out.push(colon[1].trimEnd());
      valueIndent = indent + 2;
      value = " ".repeat(valueIndent) + colon[2];
      if (value.length <= width) {
        out.push(value);
        continue;
      }
    }
    /* Still too long: only a string value can be (numbers and words are short),
       and it is cut between its atoms, never beside a space. */
    const body = value.slice(valueIndent);
    const atoms = stringAtoms(body);
    const room = Math.max(8, width - valueIndent - 4);
    for (let i = 0; i < atoms.length; ) {
      /* Take as many atoms as fit, then step back to a break beside no space. */
      let j = i;
      let len = 0;
      while (j < atoms.length && len + atoms[j].length <= room) {
        len += atoms[j].length;
        j += 1;
      }
      if (j === i) j = i + 1;
      if (j < atoms.length && !/^\s$/.test(atoms[j - 1])) {
        /* Words stay whole: break just after the last space that fits, so the
           space ends the line and the next word starts the next one. A run
           with no space in it (an escaped name) breaks between two atoms. */
        let k = j - 1;
        while (k > i && !/^\s$/.test(atoms[k - 1])) k -= 1;
        if (k > i) j = k;
      }
      /* A line never hands the next one a leading space: that space would read
         as indentation and be lost when the lines are joined. (A run of many
         spaces at a break may push a line past the edge — a name like that
         still reads back exactly; it only looks long.) */
      while (j < atoms.length && /^\s$/.test(atoms[j])) j += 1;
      /* Continuations sit two deeper, so they read as the same value going on. */
      out.push(" ".repeat(i === 0 ? valueIndent : valueIndent + 2) + atoms.slice(i, j).join(""));
      i = j;
    }
  }
  return out;
}

/** Render the certificate. Returns the PDF bytes. */
export function renderCreationCertificate(input: CreationCertificateInput): Buffer {
  const record = readSignedRecord(input.recordJson);
  const kliegId = printable(record.kliegId, "-");
  const castName = printable(input.castName ?? "", "Untitled character");
  const maker = record.maker?.displayName ? printable(record.maker.displayName, "") : "";
  const createdAt = new Date(record.createdAt);

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.setProperties({
    title: `Certificate of Creation · ${kliegId}`,
    subject: "Evidence of creation, not a registration of ownership",
    creator: PRODUCT_NAME,
    author: PRODUCT_NAME,
  });

  /* ------------------------------------------------------------- page one */
  header(doc, kliegId);

  let y = MARGIN + 22;
  doc.setFont("times", "normal");
  doc.setFontSize(30);
  doc.setTextColor(...INK);
  doc.text("Certificate of Creation", MARGIN, y);

  y += 9;
  doc.setFont("times", "italic");
  doc.setFontSize(11.5);
  doc.setTextColor(...SOFT);
  const headline = doc.splitTextToSize(CERTIFICATE_HEADLINE, CONTENT_W * 0.8) as string[];
  doc.text(headline, MARGIN, y, { lineHeightFactor: 1.35 });
  y += headline.length * 5.6 + 1.5;

  /* Counsel's fuller disclaimer, directly beneath the headline (#2331). The
     space it takes comes out of the gaps around it, so page one still ends
     clear of the footer with the tallest picture and every step there is —
     measured by the certificate's suite, not assumed. */
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SOFT);
  const disclaimer = doc.splitTextToSize(CERTIFICATE_DISCLAIMER, CONTENT_W * 0.8) as string[];
  doc.text(disclaimer, MARGIN, y, { lineHeightFactor: 1.4 });
  y += (disclaimer.length - 1) * 4.45 + 7;

  /* The master, left; the facts, right. */
  const pictureW = 74;
  const pictureH = Math.min(118, pictureW * (input.master.height / input.master.width));
  const drawnW = pictureH * (input.master.width / input.master.height);
  doc.addImage(input.master.jpeg, "JPEG", MARGIN, y, drawnW, pictureH);
  label(doc, "Master picture", MARGIN, y + pictureH + 5);

  const factsX = MARGIN + pictureW + 10;
  const factsW = PAGE_W - MARGIN - factsX;
  let fy = y + 2;
  const fact = (name: string, value: string, font: "times" | "courier" = "times", size = 13) => {
    label(doc, name, factsX, fy);
    doc.setFont(font, "normal");
    doc.setFontSize(size);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(value, factsW) as string[];
    doc.text(lines, factsX, fy + 6);
    fy += 6 + lines.length * (size * 0.42) + 6;
  };
  fact("Character", castName, "times", 16);
  fact(`${PRODUCT_NAME} ID`, kliegId, "courier", 11);
  fact("Made by", maker || "No display name recorded", "times", 13);
  /* A date never breaks across a line ("12 / October 2026"): its own spaces
     are non-breaking, so the wrap falls between the phrases instead. */
  fact(
    "Dates",
    certificateDatesLine(createdAt, input.stampedAt).replace(/(\d{1,2}) ([A-Z][a-z]+) (\d{4})/g, "$1\u00a0$2\u00a0$3"),
    "times",
    11.5,
  );

  label(doc, "Fingerprint of the master picture", factsX, fy);
  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const [fpOne, fpTwo] = fingerprintLines(record.master.sha256);
  doc.text([fpOne, fpTwo], factsX, fy + 6, { lineHeightFactor: 1.5 });
  fy += 6 + 2 * 4.8 + 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SOFT);
  const fpNote = doc.splitTextToSize(
    "Unique to this exact picture. The same picture always gives the same fingerprint; any change to it gives a different one.",
    factsW,
  ) as string[];
  doc.text(fpNote, factsX, fy, { lineHeightFactor: 1.4 });

  y = Math.max(y + pictureH + 14, fy + fpNote.length * 3.4 + 8);
  rule(doc, y);
  y += 9;
  label(doc, "How this character was made", MARGIN, y);
  y += 7;
  doc.setFont("times", "normal");
  doc.setFontSize(11.5);
  doc.setTextColor(...INK);
  for (const sentence of certificateStepSentences(record.steps)) {
    doc.text(sentence, MARGIN, y);
    y += 6;
  }

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SOFT);
  const closing = doc.splitTextToSize(
    `${PRODUCT_NAME} signed the record behind this certificate and an independent timestamping service fixed the time it existed. `
      + "The appendix carries everything needed to check both, without asking us. "
      + "This certificate is evidence of creation. It is not a registration of ownership.",
    CONTENT_W,
  ) as string[];
  doc.text(closing, MARGIN, Math.max(y, PAGE_H - 34 - closing.length * 3.4), { lineHeightFactor: 1.45 });

  /* ------------------------------------------------------------ appendix */
  doc.addPage();
  header(doc, kliegId);
  let ay = MARGIN + 16;
  doc.setFont("times", "normal");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text("Appendix · the signed record", MARGIN, ay);
  ay += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SOFT);
  const intro = doc.splitTextToSize(
    "Nobody needs this page to read the certificate. It is here so that anyone can check it independently, now or years from now. "
      + "The record is printed twice: as text to read, and as its exact signed bytes in base64. "
      + "The signature is a detached JWS (EdDSA, Ed25519) over those bytes, checkable with the public key printed here. "
      + "The timestamp token is an RFC 3161 token over the SHA-256 hash of the same bytes, checkable with standard tools "
      + "(for example, OpenSSL).",
    CONTENT_W,
  ) as string[];
  doc.text(intro, MARGIN, ay, { lineHeightFactor: 1.45 });
  ay += intro.length * 3.5 + 6;

  const monoSize = 6.2;
  const lineH = monoSize * 0.43;
  /* How many monospace characters fit across the page (Courier is 0.6 em). */
  const perLine = Math.floor(CONTENT_W / (monoSize * 0.6 * 0.3528));
  const blocks: { name: string; note?: string; lines: string[] }[] = [
    {
      name: "Record",
      note: "Formatted for reading, one key per line. The exact signed bytes are the block below.",
      lines: readableJsonLines(input.recordJson, perLine),
    },
    {
      name: "Record, exact signed bytes (base64)",
      note: "Line breaks here, in the signature and in the timestamp token are not part of the data.",
      lines: wrapDataLines(Buffer.from(input.recordJson, "utf8").toString("base64")),
    },
    {
      name: "SHA-256 of the record (what the timestamp covers)",
      lines: wrapDataLines(createHash("sha256").update(input.recordJson, "utf8").digest("hex")),
    },
    { name: "Signature", lines: wrapDataLines(input.signature) },
    {
      name: "Public key",
      lines: input.publicJwk
        ? readableJsonLines(
          JSON.stringify({ kty: input.publicJwk.kty, crv: input.publicJwk.crv, x: input.publicJwk.x, kid: input.signingKeyId }),
          perLine,
        )
        : [`Key id ${input.signingKeyId}`],
    },
    {
      name: `Timestamp token (base64), stamped ${certificateDate(input.stampedAt)} ${TIME.format(input.stampedAt)} UTC`,
      lines: wrapDataLines(input.timestampTokenBase64),
    },
  ];
  for (const block of blocks) {
    if (ay + 12 > PAGE_H - 22) {
      doc.addPage();
      header(doc, kliegId);
      ay = MARGIN + 14;
    }
    label(doc, block.name, MARGIN, ay);
    ay += 4.5;
    if (block.note) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...SOFT);
      doc.text(block.note, MARGIN, ay);
      ay += 3.6;
    }
    doc.setFont("courier", "normal");
    doc.setFontSize(monoSize);
    doc.setTextColor(...INK);
    /* Every line was cut at a safe point above — see "Where the appendix may
       break a line". No hyphen is ever added. */
    for (const line of block.lines) {
      if (ay > PAGE_H - 22) {
        doc.addPage();
        header(doc, kliegId);
        ay = MARGIN + 14;
        doc.setFont("courier", "normal");
        doc.setFontSize(monoSize);
        doc.setTextColor(...INK);
      }
      doc.text(line, MARGIN, ay);
      ay += lineH;
    }
    ay += 5;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    footer(doc, kliegId, page, pages);
  }
  return Buffer.from(doc.output("arraybuffer"));
}
