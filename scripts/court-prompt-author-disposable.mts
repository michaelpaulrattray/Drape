/**
 * THE PROMPT AUTHOR COURT — issue #125, step one of the register's next revision
 * (founder ruling `docs/specs/PROMPT_AUTHOR_RULING_2026-08-26.md` §8).
 *
 * # The question
 *
 * His thesis (§0): GPT Image 2 delivers a well-formed prompt beautifully WITHOUT
 * a compiler; what the studio must add is style / framing / studio / lighting,
 * and for a thin brief the invention an expert prompter would add. This court
 * measures that on three briefs, eight frames each, and puts the strips in
 * front of his eye. It BUILDS nothing.
 *
 * # Briefs
 *   (i)   roll 219's briefText verbatim (248 words on the production row)
 *   (ii)  his 73-word prompt verbatim (the four-women specimen — arm A on it
 *         is a direct replication of his own result)
 *   (iii) "goth woman mid 30s" (thin)
 *
 * # Arms (one prompt per sheet, rendered ×8 — "one prompt for a cast sheet not 8")
 *   A    raw brief alone — the bar
 *   B    raw verbatim first + author at LOW: the photoreal bundle where the
 *        brief is silent; nothing about the person invented
 *   C    raw verbatim first + author at MAX: his §5 system instruction
 *        byte-verbatim, house additions after it, the author's text appended
 *        after the user's words (§1 rule 1: verbatim, first, authoritative)
 *   Cr   the SAME MAX author writing the WHOLE prompt (§2 rule 4: reword and
 *        restructure freely, facts must survive). Rules 1 and 4 are both in the
 *        ruling; C and Cr measure which construction the engine prefers, and
 *        the fidelity reader checks facts on both.
 *   D    today's compile (control) — through the real `castingBriefCompiler`
 *        with the register as his account has it today (`creativeRegister:
 *        true`), the #124 deadline in place. Eight DIFFERENT prompts.
 *   F    the length cliff — arm B's prompt padded with neutral NON-VISUAL prose
 *        to 400 / 800 / 1,600 words. Brief (i) is already past 400, so it
 *        takes 800 and 1,600 only.
 *
 * # Readings
 *   fidelity  TEXT: every stated fact of the brief present and uncontradicted
 *             in the authored prompt (the reader is the instrument, checked
 *             before a cent by a dropped fact and a contradicted fact it must
 *             catch). FRAME: one vision read per frame asking whether each
 *             fact is VISIBLE — a POINTER to look, never a verdict (law 9).
 *   framing   `face` + `head` region reads per frame → head share, headroom,
 *             hair gap; calibrated on his reference frame (§3a) first;
 *             compared to the trim's T = 0.316 and to the reference.
 *   refusals  the engine is the judge (§4 rule 16): a refused slice is a datum.
 *   quality, spread  HIS EYE, on the strips.
 *
 * # Cost, stated before it is spent (posted on #125 first)
 *   184 renders at 1024x1536 medium         $0.0557 settled   $10.25
 *   ~370 region reads                        $0.005            ~$1.85
 *   ~32 text calls + 184 vision pointers     cents             ~$2.35
 *                                                              ≈ $14.50
 *   House money, dev .env, no database rows, no customer credits.
 *
 *   npx tsx scripts/court-prompt-author-disposable.mts --prove-guard   (offline)
 *   npx tsx scripts/court-prompt-author-disposable.mts --instrument    (cents)
 *   npx tsx scripts/court-prompt-author-disposable.mts --dry-run       (author + compile, no render)
 *   npx tsx scripts/court-prompt-author-disposable.mts [--briefs=i,ii,iii] [--arms=A,B,C,Cr,D,F]
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { createFalCreativeEngine } from "../server/providers/falImages";
import { createOpenRouterTextEngine } from "../server/providers/openrouterText";
import type { TextEngine } from "../server/providers/types";
import { readFalBalance } from "./lib/falSpend.mts";

if (process.env.MYSQL_PUBLIC_URL) throw new Error("this court touches no database — refusing a production wrapper");

const argv = process.argv.slice(2);
const PROVE = argv.includes("--prove-guard");
const INSTRUMENT = argv.includes("--instrument");
const DRY = argv.includes("--dry-run");
const flag = (name: string): string | null => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const ONLY_BRIEFS = flag("briefs")?.split(",") ?? ["i", "ii", "iii"];
const ONLY_ARMS = flag("arms")?.split(",") ?? ["A", "B", "C", "Cr", "D", "F"];
const RENDER_CONCURRENCY = Number(flag("concurrency") ?? 6);

const OUT_BASE = "output/prompt-author-court";
const RULING = "docs/specs/PROMPT_AUTHOR_RULING_2026-08-26.md";
const REFERENCE_FRAME = "docs/specs/references/prompt-author/house-framing-reference-chest-up.png";
const RENDER_USD = 0.0557;
const REGION_USD = 0.005;

const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
function freeDir(base: string): string {
  if (!existsSync(base)) return base;
  for (let n = 2; n < 500; n += 1) {
    const candidate = `${base}-run${n}`;
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error(`cannot find a free directory beside ${base}`);
}

/* ─── THE BRIEFS ─── */

/** (ii) — quoted in the ruling; asserted below to still be in the ruling file byte for byte. */
const BRIEF_II = "A photorealistic high-fashion portrait of a young woman with an intense cyber-goth aesthetic, facing the camera directly from the chest up. She has extremely pale porcelain skin and a sharp, androgynous face. Soft neutral gray studio background with seamless gradient. Dramatic yet soft frontal studio lighting that creates subtle specular highlights on the dark structured fabrics, intricate textures, and skin while keeping deep shadows. Ultra-detailed textures, sharp focus, cinematic high-fashion photography, 8k, photorealistic.";
const BRIEF_III = "goth woman mid 30s";

type Brief = { id: "i" | "ii" | "iii"; label: string; text: string };
function loadBriefs(): Brief[] {
  const ruling = readFileSync(RULING, "utf8");
  if (!ruling.includes(BRIEF_II)) throw new Error("brief (ii) is not byte-identical to the ruling's quotation — the constant drifted");
  const p219 = "output/_shift121/brief-219.txt";
  if (!existsSync(p219)) throw new Error(`${p219} missing — roll 219's briefText, read off the production row by the #121 shift`);
  const b219 = readFileSync(p219, "utf8").replace(/\s+/g, " ").trim();
  if (words(b219) < 200) throw new Error(`brief (i) is ${words(b219)} words — the wrong thing was read`);
  return [
    { id: "i", label: "(i) roll 219 cyber-goth brief", text: b219 },
    { id: "ii", label: "(ii) his 73-word prompt", text: BRIEF_II },
    { id: "iii", label: "(iii) thin: goth woman mid 30s", text: BRIEF_III },
  ];
}

/* ─── THE PHOTOREAL BUNDLE (§3 rule 11a, §3a) — the ONE style, its defaults ───
   ⚠ "collarbones", never "sternum": run2 of this court sent the sentence with "the crop just
   below the sternum" and fal's content checker refused it 8/8 on a brief that passes 8/8 raw;
   the probe (`_probe-preset-refusal-disposable.mts`) refused the sternum clause alone 2/2 and
   passed the collarbones wording 2/2. Arm B and the F ladder of run2 measure that word. */

export const WORD_BUDGET = 400;
export const PRESET = "STYLE PRESET (photoreal — the default; anything the user's request states overrides it): "
  + "A photorealistic high-fashion casting portrait. Chest-up framing: the subject centred and facing the camera "
  + "square-on, shoulders running off both edges of the frame, the crop just below the collarbones, a small margin of "
  + "headroom above the hair. Neutral grey seamless studio background with a soft gradient, lighter behind the face. "
  + "Soft frontal studio lighting with subtle specular highlights on skin and materials and deep but open shadows. "
  + "Ultra-detailed textures, sharp focus, photorealistic.";

/** His MAX system instruction, §5, byte-verbatim — asserted against the ruling file. */
const MAX_BLOCK = `You are the prompt author for a casting studio image engine.

User request: [user's short description]
Imagination level: MAX

Your job at MAX imagination:
- Treat the user request only as a seed.
- Invent a highly distinctive, memorable, Midjourney-level identity around that seed.
- Maximise visual uniqueness: specific hair architecture, intense but coherent makeup, interesting facial structure, strong texture, deliberate asymmetry, and atmospheric lighting.
- Keep the shot as a clean casting studio portrait (plain or softly graded background, character-focused, no environments or storytelling scenes).
- Stay true to the core identity (age range, gender presentation, and the requested aesthetic direction).
- Write a rich, detailed, opinionated prompt that feels like high-end Midjourney character design, but worded cleanly for GPT Image 2 (no NSFW triggers).

Output only the final image prompt.`;

const HOUSE_RULES = (allowance: number) => `

HOUSE RULES (the studio's, after the instruction above):
- ${PRESET}
- Every fact the user states (sex, age, skin, hair, features, clothing, jewellery, tattoos, expression, framing, lighting, style) must survive exactly — never dropped, softened or contradicted. You may add; you may not take away.
- Word allowance for YOUR text: at most ${allowance} words. If you are over, cut your own additions first — never the user's facts.
- Filter-safe wording only: no nudity, no sexual language, no gore, no named real person or named character.`;

const APPEND_RULE = `
- The user's request is placed VERBATIM before your text by the studio. Write ONLY the text that follows it — do not repeat or paraphrase the request itself.`;

const LOW_SYSTEM = (allowance: number) => `You are the prompt author for a casting studio image engine.

Imagination level: LOW

Your job at LOW imagination:
- Do not invent anything about the person. No new hair, makeup, clothing, jewellery, features or expression.
- Add ONLY the studio's style preset sentences (framing, background, lighting, photoreal quality), and only for the things the user's request is silent about. Where the request already states a framing, background, lighting or style, add nothing on that point.
- Word allowance for your text: at most ${allowance} words.
- Filter-safe wording only.
- The user's request is placed VERBATIM before your text by the studio. Write ONLY the text that follows it — do not repeat or paraphrase the request itself.

${PRESET}

Output only your text.`;

/** Neutral NON-VISUAL prose for arm F. States nothing about any picture. */
export const FILLER_UNIT = "Administrative note for the production office: the booking reference for this session will be "
  + "confirmed by email once the paperwork has been countersigned, and the archive copy of the release form is to be "
  + "filed with the usual quarterly paperwork according to the standing procedure agreed at the last planning meeting.";

export function padToWords(base: string, target: number): string {
  let out = base;
  while (words(out) < target) {
    const need = target - words(out);
    const unitWords = FILLER_UNIT.split(/\s+/);
    out += (out.endsWith("\n") ? "" : "\n\n") + unitWords.slice(0, Math.min(need, unitWords.length)).join(" ");
    if (unitWords.length > need) break;
  }
  return out;
}

/* ─── THE WIRE ASSERTIONS — every arm asserts what it sent ─── */

export type Composed = {
  brief: string;
  arms: {
    A: string; B: string; C: string; Cr: string;
    D: readonly string[];
    F: Record<string, string>;
  };
  systems: { C: string; Cr: string; B: string };
};

export function assertArms(c: Composed): void {
  const { brief, arms } = c;
  if (arms.A !== brief) throw new Error("arm A is not the brief alone — something was added to the bar");
  for (const id of ["B", "C"] as const) {
    const prompt = arms[id];
    if (!prompt.startsWith(brief)) throw new Error(`arm ${id}: the user's words are NOT first and verbatim`);
    const added = prompt.slice(brief.length).trim();
    if (added.length === 0) throw new Error(`arm ${id}: the author added NOTHING — the arm is A wearing a label`);
    if (added.includes(brief)) throw new Error(`arm ${id}: the author repeated the user's request — it is in the prompt twice`);
  }
  if (arms.C === arms.B) throw new Error("arm C equals arm B — MAX and LOW authored the same text");
  if (arms.Cr === arms.C) throw new Error("arm Cr equals arm C — the reworded arm is the verbatim arm");
  if (arms.Cr.trim().length === 0) throw new Error("arm Cr is empty");
  if (words(arms.Cr) > WORD_BUDGET * 1.25) throw new Error(`arm Cr is ${words(arms.Cr)} words — past the budget's tolerance`);
  if (!c.systems.C.includes(MAX_BLOCK)) throw new Error("arm C's system prompt does not carry his §5 instruction verbatim");
  if (!c.systems.Cr.includes(MAX_BLOCK)) throw new Error("arm Cr's system prompt does not carry his §5 instruction verbatim");
  if (!c.systems.C.includes(APPEND_RULE.trim())) throw new Error("arm C's system prompt lacks the append rule — it would repeat the request");
  if (c.systems.Cr.includes(APPEND_RULE.trim())) throw new Error("arm Cr's system prompt carries the append rule — it is not writing the whole prompt");
  if (!c.systems.B.includes(PRESET)) throw new Error("arm B's system prompt lacks the photoreal preset");
  if (arms.D.length > 0) {
    if (arms.D.length !== 8) throw new Error(`arm D holds ${arms.D.length} prompts, not eight`);
    for (const [i, p] of arms.D.entries()) if (p.trim().length === 0) throw new Error(`arm D slice ${i} is empty`);
  }
  for (const [target, prompt] of Object.entries(arms.F)) {
    if (!prompt.startsWith(arms.B)) throw new Error(`arm F${target}: it is not arm B plus filler — B's own text was altered`);
    const filler = prompt.slice(arms.B.length).replace(/\s+/g, " ").trim();
    const repeated = `${FILLER_UNIT} `.repeat(Math.ceil(filler.length / FILLER_UNIT.length) + 1);
    if (filler.length === 0 || !repeated.startsWith(filler)) {
      throw new Error(`arm F${target}: the padding is not the neutral filler unit — something else was appended`);
    }
    const n = words(prompt);
    if (Math.abs(n - Number(target)) > Number(target) * 0.05) throw new Error(`arm F${target}: ${n} words is not within 5% of ${target}`);
  }
}

if (PROVE) {
  const brief = "goth woman mid 30s";
  const B = `${brief}\n\n${PRESET}`;
  const base: Composed = {
    brief,
    arms: {
      A: brief,
      B,
      C: `${brief}\n\nA striking woman with severe asymmetrical black hair. ${PRESET}`,
      Cr: `Photorealistic casting portrait of a striking goth woman in her mid-30s with severe asymmetrical black hair. ${PRESET}`,
      D: Array.from({ length: 8 }, (_, i) => `compile ${i} ${"x".repeat(50)}`),
      F: { "400": padToWords(B, 400), "800": padToWords(B, 800) },
    },
    systems: { C: MAX_BLOCK + HOUSE_RULES(300) + APPEND_RULE, Cr: MAX_BLOCK + HOUSE_RULES(400), B: LOW_SYSTEM(300) },
  };
  const bend = (fn: (d: Composed) => void) => { const d = JSON.parse(JSON.stringify(base)) as Composed; fn(d); assertArms(d); };
  const fixtures: Array<{ what: string; expect: RegExp; run: () => void }> = [
    { what: "arm A carries an addition", expect: /arm A is not the brief alone/, run: () => bend((d) => { d.arms.A = `${brief} smiling`; }) },
    { what: "arm B lost the verbatim opening", expect: /arm B: the user's words are NOT first/, run: () => bend((d) => { d.arms.B = `A goth woman. ${PRESET}`; }) },
    { what: "arm C added nothing", expect: /arm C: the author added NOTHING/, run: () => bend((d) => { d.arms.C = brief; }) },
    { what: "arm C repeats the request", expect: /arm C: the author repeated/, run: () => bend((d) => { d.arms.C = `${brief}\n\n${brief} with black hair`; }) },
    { what: "arm Cr is arm C", expect: /arm Cr equals arm C/, run: () => bend((d) => { d.arms.Cr = d.arms.C; }) },
    { what: "his §5 block missing from C", expect: /arm C's system prompt does not carry his §5/, run: () => bend((d) => { d.systems.C = HOUSE_RULES(300) + APPEND_RULE; }) },
    { what: "Cr wrongly told to append", expect: /arm Cr's system prompt carries the append rule/, run: () => bend((d) => { d.systems.Cr = MAX_BLOCK + HOUSE_RULES(400) + APPEND_RULE; }) },
    { what: "arm D holds seven", expect: /arm D holds 7 prompts/, run: () => bend((d) => { d.arms.D = d.arms.D.slice(0, 7); }) },
    { what: "arm F altered B's text", expect: /arm F400: it is not arm B plus filler/, run: () => bend((d) => { d.arms.F["400"] = padToWords(`${brief} smiling\n\n${PRESET}`, 400); }) },
    { what: "arm F padded with something visual", expect: /arm F800: the padding is not the neutral filler/, run: () => bend((d) => { d.arms.F["800"] = `${d.arms.B}\n\n${"She has bright red hair and green eyes. ".repeat(60)}`; }) },
    { what: "arm F off its target", expect: /arm F400: \d+ words is not within 5% of 400/, run: () => bend((d) => { d.arms.F["400"] = padToWords(B, 300); }) },
    { what: "NEGATIVE CONTROL — the real shape must not throw", expect: /^$/, run: () => assertArms(base) },
  ];
  let failures = 0;
  for (const f of fixtures) {
    let thrown: string | null = null;
    try { f.run(); } catch (e) { thrown = e instanceof Error ? e.message : String(e); }
    const wanted = f.expect.source === "^$";
    const ok = wanted ? thrown === null : thrown !== null && f.expect.test(thrown);
    if (!ok) failures += 1;
    console.log(`${ok ? "PROVEN " : "FAILED  "} ${f.what}\n         ${thrown ?? "(did not throw)"}`);
  }
  console.log(failures === 0 ? "\nall arms behaved. Nothing dispatched, nothing spent." : `\n${failures} ARM(S) MISBEHAVED`);
  process.exit(failures === 0 ? 0 : 1);
}

/* ─── ENGINES ─── */

if (!process.env.OPENROUTER_API_KEY) throw new Error("no OPENROUTER_API_KEY");
if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");
const text: TextEngine = createOpenRouterTextEngine({ apiKey: process.env.OPENROUTER_API_KEY });
const TEXT_OPTS = { maxOutputTokens: 5000, timeoutMs: 120_000, retries: 1 } as const;

let textCalls = 0;
async function ask(system: string, user: string, opts: { json?: boolean; temperature?: number; images?: Buffer[] } = {}): Promise<string> {
  textCalls += 1;
  const r = await text.complete({
    about: opts.images ? "verify" : "author",
    system, user, json: opts.json ?? false, temperature: opts.temperature ?? 0,
    ...(opts.images ? { images: opts.images.map((bytes) => ({ bytes, contentType: "image/png" })) } : {}),
    ...TEXT_OPTS,
  } as never);
  return r.text;
}
function parseJson<T>(raw: string): T {
  const m = raw.match(/\{[^]*\}/);
  if (!m) throw new Error(`no JSON object in reply: ${raw.slice(0, 200)}`);
  return JSON.parse(m[0]) as T;
}

/* ─── THE FIDELITY READER (text) — the instrument, and its controls ─── */

const LEDGER_SYSTEM = `You extract the STATED VISUAL FACTS of a casting brief. A fact is something the text explicitly says about the person, their styling, clothing, jewellery, tattoos, expression, pose, framing, background, lighting or image style. Do not infer, do not add, do not generalise. Each fact is one short atomic claim in the brief's own words. Reply with JSON only: {"facts": ["...", "..."]}.`;

const AUDIT_SYSTEM = `You audit whether an image PROMPT preserves each stated fact of the BRIEF it was written from. For every fact answer one of:
- "present": the prompt states it (same meaning; rewording is fine)
- "absent": the prompt says nothing about it
- "contradicted": the prompt states something incompatible with it
Quote the prompt phrase that decides it (empty string for absent). Reply with JSON only: {"results": [{"fact": "...", "verdict": "present|absent|contradicted", "quote": "..."}]}. Judge every fact; never skip one.`;

type Audit = { results: Array<{ fact: string; verdict: "present" | "absent" | "contradicted"; quote: string }> };

async function ledger(brief: string): Promise<string[]> {
  const raw = await ask(LEDGER_SYSTEM, brief, { json: true });
  const facts = parseJson<{ facts: string[] }>(raw).facts;
  if (!Array.isArray(facts) || facts.length === 0) throw new Error("the ledger came back empty");
  return facts;
}
async function auditText(facts: string[], prompt: string): Promise<Audit> {
  const raw = await ask(AUDIT_SYSTEM, `BRIEF FACTS:\n${facts.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\nPROMPT:\n${prompt}`, { json: true });
  const a = parseJson<Audit>(raw);
  if (!Array.isArray(a.results) || a.results.length !== facts.length) throw new Error(`audit judged ${a.results?.length} of ${facts.length} facts`);
  return a;
}

/* ─── THE FRAME POINTER (vision) — a pointer to look, law 9 ─── */

const POINTER_SYSTEM = `You look at ONE photograph and, for each listed fact, say whether it is VISIBLE in the picture: "yes", "no" or "unclear" (unclear = the picture does not show that part, e.g. hands out of frame). Judge only what is in the frame. Reply with JSON only: {"results": [{"fact": "...", "visible": "yes|no|unclear"}]}. Judge every fact.`;
type Pointer = { results: Array<{ fact: string; visible: "yes" | "no" | "unclear" }> };
async function pointer(facts: string[], png: Buffer): Promise<Pointer> {
  const raw = await ask(POINTER_SYSTEM, `FACTS:\n${facts.map((f, i) => `${i + 1}. ${f}`).join("\n")}`, { json: true, images: [png] });
  const p = parseJson<Pointer>(raw);
  if (!Array.isArray(p.results) || p.results.length !== facts.length) throw new Error(`pointer judged ${p.results?.length} of ${facts.length}`);
  return p;
}

/* ─── THE FRAMING READER — face + head boxes ─── */

const { createFalRegionReader } = await import("../server/castingV2/falRegionReader");
const { extentOf } = await import("../server/castingV2/inkReferenceCrop");
const region = createFalRegionReader({ apiKey: process.env.FAL_KEY! });
let regionReads = 0;
type Framing = { share: number; headroom: number; gap: number; headTop: number } | { noFace: true };
async function framing(png: Buffer): Promise<Framing> {
  const meta = await sharp(png).metadata();
  const H = meta.height!;
  regionReads += 2;
  const [face, head] = await Promise.all([
    region.region({ image: png, name: "face", absentIsAnswer: true }),
    region.region({ image: png, name: "head", absentIsAnswer: true }),
  ]);
  const f = extentOf(face).box; const h = extentOf(head).box;
  if (!f) return { noFace: true };
  const share = f.height / H;
  const headroom = f.top / f.height;
  const gap = h ? (f.top - h.top) / f.height : Number.NaN;
  return { share, headroom, gap, headTop: h ? h.top / H : Number.NaN };
}

/* ─── INSTRUMENT MODE — controls before a cent of rendering ─── */

if (INSTRUMENT) {
  const out: string[] = [];
  const say = (s = "") => { console.log(s); out.push(s); };
  say("INSTRUMENT CHECK (law 2) — nothing rendered");
  const facts = await ledger(BRIEF_II);
  say(`ledger of brief (ii): ${facts.length} facts`); facts.forEach((f) => say(`   · ${f}`));
  const idx = (re: RegExp) => { const i = facts.findIndex((f) => re.test(f)); if (i < 0) throw new Error(`no fact matching ${re}`); return i; };
  const skinIdx = idx(/porcelain|pale/i);
  const bgIdx = idx(/gray|grey|background/i);

  /* positive: the brief against itself → every fact present */
  const pos = await auditText(facts, BRIEF_II);
  const posBad = pos.results.filter((r) => r.verdict !== "present");
  say(`POSITIVE  brief vs itself: ${pos.results.length - posBad.length}/${facts.length} present ${posBad.length === 0 ? "✓" : "✗ " + JSON.stringify(posBad)}`);

  /* negative-drop: the background sentence deleted → that fact absent */
  const dropped = BRIEF_II.replace("Soft neutral gray studio background with seamless gradient. ", "");
  if (dropped === BRIEF_II) throw new Error("drop fixture did not change the brief");
  const neg1 = await auditText(facts, dropped);
  const caughtDrop = neg1.results[bgIdx]!.verdict === "absent";
  say(`NEGATIVE  background sentence deleted → fact ${bgIdx + 1} read "${neg1.results[bgIdx]!.verdict}" ${caughtDrop ? "✓ CAUGHT" : "✗ MISSED"}`);

  /* negative-contradict: porcelain → deep bronze → that fact contradicted */
  const flipped = BRIEF_II.replace("extremely pale porcelain skin", "deep bronze skin");
  if (flipped === BRIEF_II) throw new Error("contradiction fixture did not change the brief");
  const neg2 = await auditText(facts, flipped);
  const caughtFlip = neg2.results[skinIdx]!.verdict === "contradicted";
  say(`NEGATIVE  porcelain → deep bronze → fact ${skinIdx + 1} read "${neg2.results[skinIdx]!.verdict}" ${caughtFlip ? "✓ CAUGHT" : "✗ MISSED"}`);
  const otherFlipped = neg2.results.filter((r, i) => i !== skinIdx && r.verdict !== "present").length;
  say(`          collateral on the contradiction fixture: ${otherFlipped} other fact(s) not present (0 expected)`);

  /* frame pointer controls — his eye is the ground truth */
  say();
  const b216 = readFileSync("output/raw-prompt-reference/roll216-brief-verbatim.txt", "utf8").trim();
  const facts216 = await ledger(b216);
  /* Side-FREE on purpose: the first draft picked "ports above the RIGHT temple" and the reader
     answered "no" on a frame whose ports sit above his LEFT temple — my eye agreed with the
     reader. A side is the known weak reading; the control asks about the hardware itself. */
  const cyb = facts216.findIndex((f) => /cyber|implant|augment|plate|metal|port|seam/i.test(f) && !/(^|[^a-z])(left|right)([^a-z]|$)/i.test(f));
  say(`   216 ledger: ${facts216.length} facts; control fact chosen side-free`);
  if (cyb < 0) throw new Error("no cybernetic fact in the 216 ledger");
  const p217a = readFileSync("output/framing-live-roll-217/pos0-UNTRIMMED-1024x1536.png");
  const p217b = readFileSync("output/framing-live-roll-217/pos1-UNTRIMMED-1024x1536.png");
  const ptA = await pointer(facts216, p217a); const ptB = await pointer(facts216, p217b);
  say(`POINTER positive  roll 217 pos0/pos1, fact "${facts216[cyb]}" (his eye: landed 8/8): ${ptA.results[cyb]!.visible} / ${ptB.results[cyb]!.visible}`);
  const raw01 = readFileSync("output/raw-prompt-reference/founder-raw-01.png");
  const wom = facts.findIndex((f) => /woman|female/i.test(f));
  const ptN = await pointer(facts, raw01);
  say(`POINTER negative  founder-raw-01 (a bald man) vs brief (ii) fact "${facts[wom]}": ${ptN.results[wom]!.visible} (no expected)`);
  const pointerOk = ptA.results[cyb]!.visible === "yes" && ptB.results[cyb]!.visible === "yes" && ptN.results[wom]!.visible === "no";

  /* framing calibration on his reference frame */
  say();
  const ref = readFileSync(REFERENCE_FRAME);
  const refPng = await sharp(ref).png().toBuffer();
  const fr = await framing(refPng);
  if ("noFace" in fr) throw new Error("no face on the reference frame — the framing reader cannot be calibrated");
  say(`FRAMING reference (§3a "this framing is perfect"): headShare ${(fr.share * 100).toFixed(1)}%  headroom ${fr.headroom.toFixed(2)} face-heights  hair gap ${fr.gap.toFixed(2)}  top of head at ${(fr.headTop * 100).toFixed(1)}% of frame height (§3a read ~8%)`);
  say(`        trim target T = 31.6%; the reference's share is ${(fr.share / 0.316).toFixed(2)}× T`);

  const ok = posBad.length === 0 && caughtDrop && caughtFlip && pointerOk;
  say();
  say(ok ? "INSTRUMENT PROVEN — the court may spend." : "INSTRUMENT FAILED — the court must NOT spend until the reader is repaired.");
  say(`text calls ${textCalls} · region reads ${regionReads}`);
  mkdirSync(OUT_BASE, { recursive: true });
  writeFileSync(`${OUT_BASE}/instrument.log`, out.join("\n"), "utf8");
  writeFileSync(`${OUT_BASE}/reference-framing.json`, JSON.stringify(fr, null, 2), "utf8");
  process.exit(ok ? 0 : 1);
}

/* ─── COMPOSE ─── */

async function author(system: string, brief: string, temperature: number): Promise<string> {
  const reply = (await ask(system, brief, { temperature })).trim();
  return reply.replace(/^```[a-z]*\n?|```$/g, "").trim();
}

async function compose(brief: Brief): Promise<Composed & { authorWords: Record<string, number>; D_meta: unknown }> {
  const allowance = Math.max(40, WORD_BUDGET - words(brief.text));
  const sysB = LOW_SYSTEM(allowance);
  const sysC = MAX_BLOCK + HOUSE_RULES(allowance) + APPEND_RULE;
  const sysCr = MAX_BLOCK + HOUSE_RULES(WORD_BUDGET);
  const trimOnce = async (system: string, first: string, limit: number): Promise<string> => {
    if (words(first) <= limit * 1.1) return first;
    /* rule 14: the author trims itself first — one re-ask, then it stands as measured */
    return author(`${system}\n\nYour previous draft was ${words(first)} words; the allowance is ${limit}. Rewrite it within ${limit} words, cutting your own additions and never the user's facts.\n\nPREVIOUS DRAFT:\n${first}`, brief.text, 0.3);
  };
  const addB = ONLY_ARMS.includes("B") || ONLY_ARMS.includes("F") ? await trimOnce(sysB, await author(sysB, brief.text, 0.3), allowance) : "";
  const addC = ONLY_ARMS.includes("C") ? await trimOnce(sysC, await author(sysC, brief.text, 0.8), allowance) : "";
  const cr = ONLY_ARMS.includes("Cr") ? await trimOnce(sysCr, await author(sysCr, brief.text, 0.8), WORD_BUDGET) : "";
  let D: string[] = []; let D_meta: unknown = null;
  if (ONLY_ARMS.includes("D")) {
    try {
      const { castingBriefCompiler } = await import("../server/castingV2/briefCompiler");
      /* The dry run's compile of brief (i) came back `interpreted: false` once while the
         same brief driven alone read in 45.9 s — a second attempt is taken and BOTH are
         recorded, because a fallback compile is roll 219's own prompt (a 50-year-old man)
         and the D arm is meant to be today's compile when its reader answers. */
      const attempts: unknown[] = [];
      let r: any = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        r = await castingBriefCompiler({ briefText: brief.text, candidateCount: 8, rollSeed: `prompt-author-court-${brief.id}-${attempt}`, creativeRegister: true } as never);
        attempts.push({ attempt, interpreted: r.compiledBrief?.interpreted, register: r.compiledBrief?.register?.kind });
        if (r.compiledBrief?.interpreted) break;
      }
      D = (r.candidates ?? []).map((c: any) => String(c.prompt ?? ""));
      D_meta = { attempts, interpreted: r.compiledBrief?.interpreted, register: r.compiledBrief?.register, sex: r.compiledBrief?.intent?.sex, role: r.compiledBrief?.intent?.role, chars: D.map((p) => p.length) };
    } catch (e: any) {
      D = []; D_meta = { refusedAtCompile: true, reason: e?.reason ?? e?.message ?? String(e) };
    }
  }
  const B = addB ? `${brief.text}\n\n${addB}` : "";
  const C = addC ? `${brief.text}\n\n${addC}` : "";
  const F: Record<string, string> = {};
  if (ONLY_ARMS.includes("F") && B) {
    for (const t of [400, 800, 1600]) if (words(B) < t) F[String(t)] = padToWords(B, t);
  }
  return {
    brief: brief.text,
    arms: { A: brief.text, B, C, Cr: cr, D, F },
    systems: { B: sysB, C: sysC, Cr: sysCr },
    authorWords: { allowance, B: words(addB), C: words(addC), Cr: words(cr) },
    D_meta,
  };
}

/** assertArms wants every arm; with --arms narrowed, fill the missing ones with a passable shape and say so. */
function assertPresentArms(c: Composed): void {
  const full: Composed = {
    ...c,
    arms: {
      A: c.arms.A,
      B: c.arms.B || `${c.brief}\n\n${PRESET}`,
      C: c.arms.C || `${c.brief}\n\n(arm C not run) ${PRESET}`,
      Cr: c.arms.Cr || `(arm Cr not run) ${PRESET}`,
      D: c.arms.D,
      F: c.arms.F,
    },
  };
  assertArms(full);
}

/* ─── RUN ─── */

const briefs = loadBriefs().filter((b) => ONLY_BRIEFS.includes(b.id));
const dir = freeDir(OUT_BASE + (DRY ? "-dryrun" : ""));
mkdirSync(dir, { recursive: true });
const log: string[] = [];
const say = (s = "") => { console.log(s); log.push(s); };
say("THE PROMPT AUTHOR COURT (#125, ruling §8)");
say(`  briefs ${briefs.map((b) => b.id).join(", ")} · arms ${ONLY_ARMS.join(", ")} · out ${dir}`);
say();

type Cell = { brief: string; arm: string; prompt: string; perSlice?: readonly string[] };
const cells: Cell[] = [];
const composedAll: Record<string, unknown> = {};
const ledgers: Record<string, string[]> = {};
const textFidelity: Record<string, Record<string, { present: number; absent: number; contradicted: number; misses: string[] }>> = {};

for (const brief of briefs) {
  say(`════ brief ${brief.label} — ${words(brief.text)} words ════`);
  const c = await compose(brief);
  assertPresentArms(c);
  composedAll[brief.id] = c;
  say(`  author allowance ${c.authorWords.allowance} words · added B ${c.authorWords.B} · C ${c.authorWords.C} · Cr ${c.authorWords.Cr} words`);
  say(`  totals  A ${words(c.arms.A)} · B ${words(c.arms.B)} · C ${words(c.arms.C)} · Cr ${words(c.arms.Cr)} words · D ${JSON.stringify(c.D_meta)}`);
  if (Object.keys(c.arms.F).length) say(`  F ladder ${Object.entries(c.arms.F).map(([t, p]) => `${t}→${words(p)}w`).join(", ")}`);

  /* text fidelity, every authored arm */
  const facts = await ledger(brief.text);
  ledgers[brief.id] = facts;
  say(`  ledger: ${facts.length} stated facts`);
  textFidelity[brief.id] = {};
  const auditArm = async (arm: string, prompt: string) => {
    const a = await auditText(facts, prompt);
    const tally = { present: 0, absent: 0, contradicted: 0, misses: [] as string[] };
    for (const r of a.results) { tally[r.verdict] += 1; if (r.verdict !== "present") tally.misses.push(`${r.verdict}: ${r.fact}${r.quote ? ` ← "${r.quote}"` : ""}`); }
    textFidelity[brief.id]![arm] = tally;
    say(`  fidelity ${arm.padEnd(6)} ${tally.present}/${facts.length} present · ${tally.absent} absent · ${tally.contradicted} contradicted${tally.misses.length ? "\n      " + tally.misses.join("\n      ") : ""}`);
  };
  if (c.arms.B) await auditArm("B", c.arms.B);
  if (c.arms.C) await auditArm("C", c.arms.C);
  if (c.arms.Cr) await auditArm("Cr", c.arms.Cr);
  if (c.arms.D.length) await auditArm("D-s0", c.arms.D[0]!);
  for (const [t, p] of Object.entries(c.arms.F)) await auditArm(`F${t}`, p);

  if (ONLY_ARMS.includes("A")) cells.push({ brief: brief.id, arm: "A", prompt: c.arms.A });
  if (c.arms.B) cells.push({ brief: brief.id, arm: "B", prompt: c.arms.B });
  if (c.arms.C) cells.push({ brief: brief.id, arm: "C", prompt: c.arms.C });
  if (c.arms.Cr) cells.push({ brief: brief.id, arm: "Cr", prompt: c.arms.Cr });
  if (c.arms.D.length) cells.push({ brief: brief.id, arm: "D", prompt: c.arms.D[0]!, perSlice: c.arms.D });
  for (const [t, p] of Object.entries(c.arms.F)) cells.push({ brief: brief.id, arm: `F${t}`, prompt: p });
  say();
}

writeFileSync(`${dir}/prompts.json`, JSON.stringify({ composed: composedAll, ledgers, textFidelity, cells: cells.map((c) => ({ ...c, sha: sha(c.prompt) })) }, null, 2), "utf8");
const renderCount = cells.length * 8;
const expected = renderCount * RENDER_USD + renderCount * 2 * REGION_USD + renderCount * 0.01;
say(`  cells ${cells.length} → ${renderCount} renders · expected ≈ $${expected.toFixed(2)} · text calls so far ${textCalls}`);

if (DRY) {
  say("--dry-run: authored, compiled and audited; NOTHING rendered.");
  writeFileSync(`${dir}/court.log`, log.join("\n"), "utf8");
  process.exit(0);
}

const before = await readFalBalance();
say(`  fal balance before: ${before.ok ? "$" + before.remaining.toFixed(2) : "UNREAD — " + before.why}`);
if (before.ok && before.remaining < 5) throw new Error("fal balance under $5 — wait for the automatic top-up");
say();

/* ─── RENDER (a pool, the engine's own queue underneath) ─── */

const engine = createFalCreativeEngine({ apiKey: process.env.FAL_KEY });
type Frame = { brief: string; arm: string; slice: number; file: string | null; refused: string | null; ms: number };
const frames: Frame[] = [];
const jobs: Array<() => Promise<void>> = [];
for (const cell of cells) {
  for (let s = 0; s < 8; s += 1) {
    const prompt = cell.perSlice ? cell.perSlice[s]! : cell.prompt;
    jobs.push(async () => {
      const t0 = Date.now();
      const file = `${dir}/${cell.brief}-${cell.arm}-s${s}.png`;
      try {
        const r = await engine.generateCandidate({ prompt, size: "1024x1536", quality: "medium" } as never);
        writeFileSync(file, r.bytes);
        frames.push({ brief: cell.brief, arm: cell.arm, slice: s, file, refused: null, ms: Date.now() - t0 });
        say(`  ${cell.brief}-${cell.arm}-s${s}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      } catch (e) {
        const why = (e instanceof Error ? e.message : String(e)).slice(0, 240);
        frames.push({ brief: cell.brief, arm: cell.arm, slice: s, file: null, refused: why, ms: Date.now() - t0 });
        say(`  ${cell.brief}-${cell.arm}-s${s}  REFUSED — ${why}`);
      }
    });
  }
}
async function pool(tasks: Array<() => Promise<void>>, n: number): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < tasks.length) { const t = tasks[i++]!; await t(); } }));
}
await pool(jobs, RENDER_CONCURRENCY);
say();

/* ─── READ: framing + frame pointer ─── */

type Reading = Frame & { framing?: Framing; pointer?: Record<string, "yes" | "no" | "unclear"> };
const readings: Reading[] = frames.map((f) => ({ ...f }));
await pool(readings.filter((r) => r.file).map((r) => async () => {
  const png = readFileSync(r.file!);
  try { r.framing = await framing(png); } catch (e) { say(`  framing read failed ${r.brief}-${r.arm}-s${r.slice}: ${(e as Error).message}`); }
  try {
    const p = await pointer(ledgers[r.brief]!, png);
    r.pointer = Object.fromEntries(p.results.map((x) => [x.fact, x.visible]));
  } catch (e) { say(`  pointer failed ${r.brief}-${r.arm}-s${r.slice}: ${(e as Error).message}`); }
}), 4);

/* ─── REPORT ─── */

const after = await readFalBalance();
const armsOf = (b: string) => [...new Set(readings.filter((r) => r.brief === b).map((r) => r.arm))];
const stats = (xs: number[]) => {
  if (!xs.length) return "—";
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  return `mean ${(m * 100).toFixed(1)}% sd ${(sd * 100).toFixed(1)} [${(Math.min(...xs) * 100).toFixed(1)}–${(Math.max(...xs) * 100).toFixed(1)}]`;
};
const report: string[] = [];
const R = (s = "") => report.push(s);
R(`# THE PROMPT AUTHOR COURT — run ${dir}`);
R();
R(`fal balance ${before.ok ? "$" + before.remaining.toFixed(2) : "unread"} → ${after.ok ? "$" + after.remaining.toFixed(2) : "unread"} · renders ${frames.length} (${frames.filter((f) => f.refused).length} refused) · region reads ${regionReads} · text calls ${textCalls}`);
R(`settled-price actual: renders $${(frames.filter((f) => !f.refused).length * RENDER_USD).toFixed(2)} + reads $${(regionReads * REGION_USD).toFixed(2)}`);
R();
for (const b of briefs) {
  R(`## brief ${b.label} — ${words(b.text)} words · ${ledgers[b.id]!.length} stated facts`);
  R();
  R(`| arm | words | refused | text fidelity (present/absent/contradicted) | frame pointer: facts visible (mean over frames) | head share | headroom (face-h) |`);
  R(`|---|---|---|---|---|---|---|`);
  for (const arm of armsOf(b.id)) {
    const rs = readings.filter((r) => r.brief === b.id && r.arm === arm);
    const cell = cells.find((c) => c.brief === b.id && c.arm === arm)!;
    const tf = textFidelity[b.id]![arm === "D" ? "D-s0" : arm];
    const withPointer = rs.filter((r) => r.pointer);
    const visMean = withPointer.length
      ? withPointer.map((r) => Object.values(r.pointer!).filter((v) => v === "yes").length / ledgers[b.id]!.length).reduce((a, x) => a + x, 0) / withPointer.length
      : Number.NaN;
    const shares = rs.map((r) => r.framing).filter((f): f is Exclude<Framing, { noFace: true }> => !!f && !("noFace" in f));
    R(`| ${arm} | ${cell.perSlice ? cell.perSlice.map(words).join("/") : words(cell.prompt)} | ${rs.filter((r) => r.refused).length}/8 | ${tf ? `${tf.present}/${tf.absent}/${tf.contradicted}` : "—"} | ${Number.isNaN(visMean) ? "—" : (visMean * 100).toFixed(0) + "%"} (n=${withPointer.length}) | ${stats(shares.map((s) => s.share))} | ${shares.length ? (shares.reduce((a, s) => a + s.headroom, 0) / shares.length).toFixed(2) : "—"} |`);
  }
  R();
  /* per-fact visibility per arm — the pointer table his eye checks against */
  R(`per-fact pointer (frames answering "yes" out of delivered) — a pointer to look, never a verdict:`);
  R();
  R(`| fact | ${armsOf(b.id).join(" | ")} |`);
  R(`|---|${armsOf(b.id).map(() => "---").join("|")}|`);
  for (const fact of ledgers[b.id]!) {
    R(`| ${fact.slice(0, 70)} | ${armsOf(b.id).map((arm) => { const rs = readings.filter((r) => r.brief === b.id && r.arm === arm && r.pointer); return `${rs.filter((r) => r.pointer![fact] === "yes").length}/${rs.length}`; }).join(" | ")} |`);
  }
  R();
  for (const arm of armsOf(b.id)) {
    const tf = textFidelity[b.id]![arm === "D" ? "D-s0" : arm];
    if (tf?.misses.length) { R(`text misses, ${arm}:`); tf.misses.forEach((m) => R(`- ${m}`)); R(); }
  }
  const refusedRows = readings.filter((r) => r.brief === b.id && r.refused);
  if (refusedRows.length) { R(`refusals:`); refusedRows.forEach((r) => R(`- ${r.arm}-s${r.slice}: ${r.refused}`)); R(); }
}
writeFileSync(`${dir}/report.md`, report.join("\n"), "utf8");
writeFileSync(`${dir}/readings.json`, JSON.stringify(readings, null, 2), "utf8");

/* ─── STRIPS — one per brief, rows = arms, eight tiles each ─── */

const TILE_W = 300; const GUTTER = 230;
for (const b of briefs) {
  const arms = armsOf(b.id);
  const tileH = Math.round(TILE_W * 1.5);
  const composites: sharp.OverlayOptions[] = [];
  for (const [row, arm] of arms.entries()) {
    const svg = `<svg width="${GUTTER}" height="${tileH}"><rect width="100%" height="100%" fill="#141414"/><text x="14" y="${Math.round(tileH / 2)}" font-family="sans-serif" font-size="30" fill="#EBEBEB">${arm}</text></svg>`;
    composites.push({ input: Buffer.from(svg), left: 0, top: row * tileH });
    for (const r of readings.filter((x) => x.brief === b.id && x.arm === arm)) {
      if (!r.file) {
        const ref = `<svg width="${TILE_W}" height="${tileH}"><rect width="100%" height="100%" fill="#2a1414"/><text x="20" y="${Math.round(tileH / 2)}" font-family="sans-serif" font-size="22" fill="#EBEBEB">REFUSED</text></svg>`;
        composites.push({ input: Buffer.from(ref), left: GUTTER + r.slice * TILE_W, top: row * tileH });
        continue;
      }
      composites.push({ input: await sharp(readFileSync(r.file)).resize({ width: TILE_W, height: tileH, fit: "cover" }).toBuffer(), left: GUTTER + r.slice * TILE_W, top: row * tileH });
    }
  }
  const strip = await sharp({ create: { width: GUTTER + 8 * TILE_W, height: tileH * arms.length, channels: 3, background: "#0A0A0A" } })
    .composite(composites).png().toBuffer();
  writeFileSync(`${dir}/STRIP-${b.id}.png`, strip);
  say(`  strip ${dir}/STRIP-${b.id}.png (${arms.length} rows: ${arms.join(", ")})`);
}
say();
say(report.join("\n"));
writeFileSync(`${dir}/court.log`, log.join("\n"), "utf8");
