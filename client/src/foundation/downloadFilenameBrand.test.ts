/**
 * NO FILE A CUSTOMER DOWNLOADS IS NAMED AFTER THE OLD PRODUCT — #1992.
 *
 * Both brand sweeps (#1934/#1944 on the client, #1955 on the server) read for
 * PROSE — sentences in JSX. A template literal handed to `a.download` is not
 * prose, so five filenames kept saying `drape-…` after both: the board's
 * selection zip, three canvas image downloads, and the legacy studio's image
 * bar. This guard reads the SHAPE rather than the instances:
 *
 *   1. every `.download = <expr>` under `client/src` and `shared/`;
 *   2. where `<expr>` is a parameter of the function it sits in, that function
 *      is a FORWARDER (`downloadImage`, `triggerDownload`, `downloadBlob`…),
 *      and every call to it anywhere in the client is read instead — the
 *      filename is decided at the call, not at the assignment;
 *   3. every `Content-Disposition` filename the server sets.
 *
 * None of them may carry the old name. A site whose value comes from somewhere
 * this reader cannot follow (a server response, a list built a screen away) is
 * ENROLLED below with where it comes from, and the enrolment is checked both
 * ways — an unenrolled new one reddens, and a stale entry reddens.
 *
 * `shared/brand.ts` draws the line this rests on: a download's name is READ by
 * a person and never read back by the product, so it is `PRODUCT_NAME`'s
 * business, not an identifier's.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_NAME, productFilename } from "@shared/brand";

const ROOT = join(__dirname, "..", "..", "..");
const OLD_NAME = /drape/i;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function rel(file: string): string {
  return relative(ROOT, file).split(sep).join("/");
}

type Site = { file: string; line: number; expr: string };

/** Every `.download = <expr>` assignment in a source text. */
function findDownloadAssignments(file: string, src: string): Site[] {
  const sites: Site[] = [];
  const re = /\.download\s*=\s*([^;\n]+)/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    sites.push({ file, line: src.slice(0, m.index).split("\n").length, expr: m[1].trim() });
  }
  return sites;
}

/** The named function whose parameter list declares `ident`, if any. */
function forwarderFor(src: string, ident: string): string | null {
  const re = /function\s+(\w+)\s*\(([^)]*)\)/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const params = m[2].split(",").map((p) => p.trim().split(/[\s:?=]/)[0]);
    if (params.includes(ident)) return m[1];
  }
  return null;
}

/** The argument text of every call to `name(` in a source, paren-matched. */
function callArguments(src: string, name: string): string[] {
  const args: string[] = [];
  const re = new RegExp(`(?<!function\\s+)\\b${name}\\s*\\(`, "g");
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
    }
    args.push(src.slice(start, i - 1));
  }
  return args;
}

/**
 * Sites whose filename this reader cannot follow, and where it comes from.
 * Keyed `file:expr` so a moved line keeps its entry and a changed one does not.
 */
const ENROLLED: Record<string, string> = {
  "client/src/features/settings/sections/SecuritySection.tsx:name":
    "exportFileName() in exportAccountData.ts — PRODUCT_NAME, driven by exportAccountData.test.ts (#1981)",
  "client/src/pages/AdminAuditLogs.tsx:result.filename":
    "server/routes/admin/auditLogs.ts — `audit-logs-<date>.csv`, staff only",
  "client/src/pages/CastingRoom.tsx:file.name":
    "the literal list a few lines above — character-sheet.jpg and the cast's own name",
};

const clientFiles = [...walk(join(ROOT, "client", "src")), ...walk(join(ROOT, "shared"))];
const sources = new Map(clientFiles.map((f) => [rel(f), readFileSync(f, "utf8")]));

const assignments = [...sources].flatMap(([file, src]) => findDownloadAssignments(file, src));
const forwarders = new Set<string>();
const enrolledSeen = new Set<string>();
const literalSites: Site[] = [];
const unenrolled: string[] = [];
for (const site of assignments) {
  if (/['"`]/.test(site.expr) || /\(/.test(site.expr)) {
    literalSites.push(site);
    continue;
  }
  const forwarder = /^\w+$/.test(site.expr) ? forwarderFor(sources.get(site.file)!, site.expr) : null;
  if (forwarder) {
    forwarders.add(forwarder);
    continue;
  }
  const key = `${site.file}:${site.expr}`;
  if (key in ENROLLED) enrolledSeen.add(key);
  else unenrolled.push(`${site.file}:${site.line} — .download = ${site.expr}`);
}

describe("download filenames carry the product's name (#1992)", () => {
  it("productFilename prefixes the one declared name, lower-cased", () => {
    expect(productFilename("selection.zip")).toBe(`${PRODUCT_NAME.toLowerCase()}-selection.zip`);
    expect(productFilename("x.png")).not.toMatch(OLD_NAME);
  });

  it("the reader finds the assignments and the forwarders it exists to follow", () => {
    // Positive control on the real tree: the three helpers every image download
    // goes through must be DERIVED, or the call-site arm below reads nothing.
    for (const name of ["downloadImage", "triggerDownload", "downloadBlob"]) {
      expect([...forwarders]).toContain(name);
    }
    expect(literalSites.length).toBeGreaterThan(0);
  });

  it("the reader flags the five shapes the brand sweeps missed (negative control)", () => {
    const fixture = [
      "a.download = 'drape-selection.zip';",
      "export async function downloadImage(url: string, filename: string) { a.download = filename; }",
      'onClick={() => void downloadImage(imageUrl, `drape-${label || "image"}.png`)}',
      "downloadImage(imageUrl, `drape-${nodeId}.png`);",
    ].join("\n");
    const sites = findDownloadAssignments("fixture.tsx", fixture);
    expect(sites.map((s) => s.expr)).toEqual(["'drape-selection.zip'", "filename"]);
    expect(OLD_NAME.test(sites[0].expr)).toBe(true);
    expect(forwarderFor(fixture, "filename")).toBe("downloadImage");
    const args = callArguments(fixture, "downloadImage");
    expect(args).toHaveLength(2);
    expect(args.every((a) => OLD_NAME.test(a))).toBe(true);
  });

  it("no `.download =` literal names the old product", () => {
    const hits = literalSites.filter((s) => OLD_NAME.test(s.expr));
    expect(hits.map((s) => `${s.file}:${s.line} ${s.expr}`)).toEqual([]);
  });

  it("no call to a download forwarder names the old product", () => {
    const hits: string[] = [];
    let calls = 0;
    for (const name of forwarders) {
      for (const [file, src] of sources) {
        for (const arg of callArguments(src, name)) {
          calls++;
          if (OLD_NAME.test(arg)) hits.push(`${file}: ${name}(${arg})`);
        }
      }
    }
    expect(calls).toBeGreaterThan(0);
    expect(hits).toEqual([]);
  });

  it("every site the reader cannot follow is enrolled, and every enrolment is live", () => {
    expect(unenrolled).toEqual([]);
    expect(Object.keys(ENROLLED).filter((k) => !enrolledSeen.has(k))).toEqual([]);
  });

  it("no Content-Disposition filename the server sets names the old product", () => {
    const hits: string[] = [];
    let seen = 0;
    for (const file of walk(join(ROOT, "server"))) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/Content-Disposition["'`]\s*,\s*([^)\n]+)/g)) {
        seen++;
        if (OLD_NAME.test(m[1])) hits.push(`${rel(file)}: ${m[1]}`);
      }
    }
    expect(seen).toBeGreaterThan(0);
    expect(hits).toEqual([]);
  });
});
