/**
 * A USER-FACING SENTENCE DECLARED ON THE SERVER AND WRITTEN AGAIN ON THE CLIENT.
 *
 * The cleanup milestone removed one of these by hand (`STATED_WARDROBE_NOTICE`,
 * triage §8a): the server declared the sentence, the wire carried a BOOLEAN, and
 * the client declared the same sentence again and showed it. The sweep that
 * removal owed — law 7 — was never taken; one neighbouring constant was read
 * instead, and it was innocent. A second member (`VARIANCE_CONFESSION`) then
 * turned up from a different direction entirely.
 *
 * So this is the class, asked mechanically: for every sentence-shaped string
 * literal declared in server production source, does the same sentence appear
 * verbatim in the client's own source?
 *
 * It DECIDES NOTHING. A hit is a question — the two copies may be one promise
 * stated twice (law 4, and it will drift), or a coincidence of ordinary
 * English. Only a person can tell those apart.
 *
 * # Controls (law 2 — they run before any verdict, and refuse it on failure)
 *
 * The matcher's controls are SYNTHETIC and therefore cannot die when the
 * product retires a specimen — triage §0's lesson, which cost this milestone
 * its first instrument. The corpus controls are counts, so an empty-corpus
 * false null (a clean run that scanned nothing) cannot be reported as clean.
 */
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const MIN_CHARS = 30;
const MIN_SPACES = 4;

/** Whitespace is not part of a sentence's identity: JSX indents, source wraps. */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Sentence-shaped: prose a person could read, not an identifier or a query. */
function isSentence(raw: string): boolean {
  const text = normalize(raw);
  if (text.length < MIN_CHARS) return false;
  if ((text.match(/ /g) ?? []).length < MIN_SPACES) return false;
  if (!/[a-z]{3}/.test(text)) return false;
  if (/:\/\//.test(text)) return false;
  if (text.includes("${")) return false;
  if (/\bSELECT\b|\bINSERT\b|\bDELETE FROM\b/.test(text)) return false;
  if (/%[sdj]/.test(text)) return false;
  if (/\w\(\)/.test(text)) return false;
  return true;
}

const QUOTES = new Set(['"', "'", "`"]);

/**
 * The source with its comments removed and its line count preserved.
 *
 * This codebase quotes people inside docblocks — *"…it looks like nothing is
 * even happening"* — and a quotation mark in prose opens a literal that was
 * never a literal. Left in, the sweep reports a sentence DISCUSSED on both
 * sides as a sentence DECLARED on both sides, which is a different finding.
 * String literals are copied through rather than skipped, so a `//` inside a
 * URL cannot swallow the rest of its line.
 */
function withoutComments(source: string): string {
  let out = "";
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (QUOTES.has(character)) {
      const quote = character;
      out += character;
      index += 1;
      while (index < source.length) {
        const current = source[index];
        out += current;
        index += 1;
        if (current === "\\") { out += source[index] ?? ""; index += 1; continue; }
        if (current === quote) break;
        if (current === "\n" && quote !== "`") break;
      }
      continue;
    }
    if (character === "/" && source[index + 1] === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        if (source[index] === "\n") out += "\n";
        index += 1;
      }
      index += 2;
      continue;
    }
    out += character;
    index += 1;
  }
  return out;
}

/**
 * Every plain string literal in a source file, with the line it sits on.
 *
 * Hand-scanned rather than matched with one regex, because the three quote
 * characters and their escapes are exactly where a clever pattern gets one of
 * the three wrong and reports a smaller corpus without saying so.
 */
function literalsOf(source: string): Array<{ text: string; line: number }> {
  const out: Array<{ text: string; line: number }> = [];
  let index = 0;
  let line = 1;
  while (index < source.length) {
    const character = source[index];
    if (character === "\n") { line += 1; index += 1; continue; }
    if (!QUOTES.has(character)) { index += 1; continue; }
    const quote = character;
    const startLine = line;
    let body = "";
    let cursor = index + 1;
    let closed = false;
    let interpolated = false;
    while (cursor < source.length) {
      const current = source[cursor];
      if (current === "\\") {
        const next = source[cursor + 1];
        if (next === "\n") line += 1;
        body += next ?? "";
        cursor += 2;
        continue;
      }
      if (current === quote) { closed = true; cursor += 1; break; }
      if (current === "\n") {
        line += 1;
        /* A single- or double-quoted literal cannot span a line: this is not one. */
        if (quote !== "`") break;
      }
      if (quote === "`" && current === "$" && source[cursor + 1] === "{") interpolated = true;
      body += current;
      cursor += 1;
    }
    if (!closed) { index += 1; continue; }
    index = cursor;
    if (interpolated) continue;
    if (isSentence(body)) out.push({ text: normalize(body), line: startLine });
  }
  return out;
}

async function sourcesUnder(root: string, extensions: string[]): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        await walk(path);
        continue;
      }
      if (!extensions.some((extension) => entry.name.endsWith(extension))) continue;
      if (/\.test\.tsx?$/.test(entry.name)) continue;
      found.push(path.replaceAll("\\", "/"));
    }
  }
  await walk(root);
  return found.sort();
}

/* ---- controls ---------------------------------------------------------- */

const SYNTHETIC_SHARED = "The sitting is held while the second reader answers.";
const SYNTHETIC_NEAR = "The sitting is held while the third reader answers.";

const SYNTHETIC_COMMENTED = "The reader in the comment is quoted, never declared.";

const syntheticSource = [
  `const a = "${SYNTHETIC_SHARED}";`,
  `const b = "${SYNTHETIC_NEAR}";`,
  `/* Somebody said "${SYNTHETIC_COMMENTED}" and it is prose about it. */`,
  `const url = "https://example.invalid/x";`,
  `const c = "${SYNTHETIC_SHARED} Again, after a URL.";`,
  "",
].join("\n");
const syntheticServer = literalsOf(withoutComments(syntheticSource));
const syntheticClient = normalize(`<p>\n  ${SYNTHETIC_SHARED}\n</p>`);
const positiveControl = syntheticServer.some(
  (entry) => entry.text === SYNTHETIC_SHARED && syntheticClient.includes(entry.text),
);
const negativeControl = syntheticServer.some((entry) => entry.text === SYNTHETIC_NEAR)
  && !syntheticClient.includes(SYNTHETIC_NEAR);

const commentControl = !syntheticServer.some((entry) => entry.text === SYNTHETIC_COMMENTED);
const urlControl = syntheticServer.some((entry) => entry.text.endsWith("Again, after a URL."));

console.log("MATCHER CONTROLS (synthetic — they cannot die with a specimen)");
console.log(`  positive  a shared sentence is found                ${positiveControl ? "PASS" : "FAIL"}`);
console.log(`  negative  a one-word variant is read and not found  ${negativeControl ? "PASS" : "FAIL"}`);
console.log(`  negative  a sentence quoted in a COMMENT is not read ${commentControl ? "PASS" : "FAIL"}`);
console.log(`  positive  a literal after a URL survives stripping  ${urlControl ? "PASS" : "FAIL"}`);
if (!positiveControl || !negativeControl || !commentControl || !urlControl) {
  console.log("REFUSED — the matcher failed its own controls; no verdict printed.");
  process.exit(1);
}

/* ---- the corpora ------------------------------------------------------- */

const serverFiles = await sourcesUnder("server", [".ts"]);
const clientFiles = await sourcesUnder("client/src", [".ts", ".tsx"]);

const serverLiterals = serverFiles.flatMap((file) =>
  literalsOf(withoutComments(readFileSync(file, "utf8"))).map((entry) => ({ ...entry, file })));
const clientBodies = clientFiles.map((file) => ({
  file,
  text: normalize(withoutComments(readFileSync(file, "utf8"))),
}));

console.log("");
console.log("CORPUS CONTROLS (a run that scanned nothing is not a clean run)");
console.log(`  server production files            ${serverFiles.length}`);
console.log(`  sentence-shaped server literals    ${serverLiterals.length}`);
console.log(`  client source files                ${clientFiles.length}`);
if (serverFiles.length === 0 || serverLiterals.length === 0 || clientFiles.length === 0) {
  console.log("REFUSED — a corpus is empty; a null result would mean nothing.");
  process.exit(1);
}

/* ---- the join, printed by the instrument itself ------------------------ */

const hits: Array<{ text: string; server: string; client: string }> = [];
const seen = new Set<string>();
for (const literal of serverLiterals) {
  if (seen.has(literal.text)) continue;
  const match = clientBodies.find((body) => body.text.includes(literal.text));
  if (!match) continue;
  seen.add(literal.text);
  hits.push({ text: literal.text, server: `${literal.file}:${literal.line}`, client: match.file });
}

console.log("");
console.log(`SENTENCES DECLARED ON THE SERVER AND WRITTEN AGAIN ON THE CLIENT — ${hits.length}`);
for (const hit of hits) {
  console.log("");
  console.log(`  "${hit.text.length > 96 ? `${hit.text.slice(0, 96)}…` : hit.text}"`);
  console.log(`    server  ${hit.server}`);
  console.log(`    client  ${hit.client}`);
}
if (hits.length === 0) console.log("  none");

process.exit(0);
