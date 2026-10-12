import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/*
  THE CERTIFICATE'S ONE DOOR IN THE ROOM — N2d-2 (#2312).

  The row is drawn through React's own renderer, so what is asserted is what
  the browser would draw: one button, the customer's words, and nothing of the
  machinery. The door's own behaviour (who gets 200, 404, 409) is driven over
  HTTP in `server/routes/creationCertificate.test.ts`; here the room's reading
  of those answers is pinned, because the row must offer itself on 200 ONLY.
*/
const {
  CERTIFICATE_BODY,
  CERTIFICATE_BUTTON,
  CreationCertificatePanel,
  certificatePath,
  certificateProbeAnswer,
} = await import("./CreationCertificateRow");

const ROOT = join(import.meta.dirname, "..", "..", "..", "..", "..");

describe("the certificate row", () => {
  it("draws one download button and the customer's sentence", () => {
    const html = renderToStaticMarkup(createElement(CreationCertificatePanel, { busy: false, onDownload: () => {} }));
    expect(html).toContain("CERTIFICATE OF CREATION");
    expect(html).toContain(CERTIFICATE_BUTTON);
    expect(CERTIFICATE_BUTTON).toBe("Download certificate");
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain(CERTIFICATE_BODY);
  });

  it("⚠ never says ownership is proven, and shows none of the machinery", () => {
    const source = readFileSync(join(ROOT, "client/src/features/castingV2/components/CreationCertificateRow.tsx"), "utf8");
    /* Only where a sentence can live — string literals and JSX text with a
       space in them — read off the parsed file, as castingNotSheet.test.ts does. */
    const parsed = ts.createSourceFile("row.tsx", source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
    const sentences: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) {
        const text = node.text.trim();
        if (/\s/.test(text)) sentences.push(text);
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
    const said = sentences.join("\n");
    /* Positive control: the reader sees the sentences at all. */
    expect(said).toContain("independently timestamped");
    expect(said).not.toMatch(/proof of ownership|proves? ownership/i);
    expect(said).not.toMatch(/hash|sha-?256|signature|jws|rfc|digicert|freetsa|token/i);
  });

  it("says it is preparing while the file is made, and cannot be pressed twice", () => {
    const html = renderToStaticMarkup(createElement(CreationCertificatePanel, { busy: true, onDownload: () => {} }));
    expect(html).toContain("Preparing");
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it("⚠ offers itself on 200 only — 409 waits, every other answer hides", () => {
    expect(certificateProbeAnswer(200)).toBe("offer");
    expect(certificateProbeAnswer(409)).toBe("wait");
    for (const status of [401, 403, 404, 429, 500, 503]) expect(certificateProbeAnswer(status)).toBe("hide");
  });

  it("asks the server's one path, the cast's public id encoded", () => {
    expect(certificatePath("KI-7Q2M XR4D")).toBe("/api/cast/KI-7Q2M%20XR4D/certificate");
  });

  it("is mounted in the room, once, waiting until the views are made", () => {
    const room = readFileSync(join(ROOT, "client/src/pages/CastingRoom.tsx"), "utf8");
    expect(room.match(/<CreationCertificateRow /g)).toHaveLength(1);
    expect(room).toContain('<CreationCertificateRow castId={data.castId} settled={data.status !== "building"} />');
  });
});
