/**
 * THE PANEL V2 EVIDENCE PACK, BUILT FROM THE RUN RATHER THAN TYPED OUT.
 *
 * The UI milestone contract (CLAUDE.local.md) wants two things before a founder
 * gate: shots of the shipped surface in both themes, and a copy audit
 * classifying every user-visible string. The pack that existed
 * (`output/panel-v2/pack.html`, shift 27) was hand-written and described a
 * ONE-ROW panel — the world the scan retired — so re-typing it would have
 * carried its stale claims forward one more time.
 *
 * This derives instead (working law 4):
 *
 *   the check roster   from `checks.json`, which the driver writes as it runs,
 *                      so the pack cannot claim a verdict the run did not take
 *   the copy audit     from `FacePanel.tsx`'s own classification block, which is
 *                      the record of what was verified against his mock
 *   the cross-check    every classified string is looked for in the driver's own
 *                      saw lines — a copy audit listing words nobody shipped is
 *                      the same mirror-drift the law is about, and only this
 *                      column can catch it
 *
 * It asserts rather than assumes: no checks file, no shots, or a roster with a
 * failure in it and this refuses to build a pack that would read as a pass.
 *
 *   npx tsx scripts/build-panel-v2-pack.mts
 */
import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";

import { armedBornWornClasses } from "../server/castingV2/bornWornDetector";

const OUT = path.resolve("output/panel-v2");

type CheckRecord = { law: string; ok: boolean; saw: string; armed: boolean };

const records = JSON.parse(await readFile(path.join(OUT, "checks.json"), "utf8")) as CheckRecord[];
if (records.length === 0) throw new Error("checks.json is empty — drive the evidence script first");

/*
  THE ONE CLAIM IN THIS PACK THAT WAS STILL TYPED (shift 91).

  The header above says this file derives rather than re-types because the
  hand-written pack it replaced carried stale claims forward. Its "one thing
  this pack is not hiding" box was the exception: it stated, in the present
  tense, that earring detection is unarmed — and stayed that way after the
  per-side court passed and the class was armed, so a rebuild would have
  published a defect that no longer exists as a live one. Read from the same
  function the scan plan reads, so the box says what is true on the day it is
  built.
*/
const EARRING_ARMED = armedBornWornClasses().some((entry) => entry.region === "earring");

const failures = records.filter((record) => !record.ok);
const armed = records.filter((record) => record.armed);
const unarmed = records.filter((record) => !record.armed);

/*
  IT REFUSES RATHER THAN PACKAGING A RED RUN — and this earned itself on its
  first build. `checks.json` is overwritten by EVERY drive, including the
  sabotage runs that prove the checks can fail, so the file sitting on disk was
  the last SABOTAGED run's record and the pack rendered its two failures into a
  document whose whole job is to say the surface is sound. A pack is a claim
  about a passing run; a pack built from a failing one is the report-versus-
  artifact law with the artifact right there on disk.
*/
if (failures.length > 0) {
  throw new Error(
    `refusing to build a pack from a run with ${failures.length} failure(s) — `
    + `re-drive scripts/drive-face-panel-evidence.mts clean first. Failing: `
    + failures.map((record) => record.law).join(" | "),
  );
}

/**
 * THE COPY AUDIT, READ OFF THE COMPONENT THAT SHIPS IT.
 *
 * The block is prose, so the parse is deliberately narrow: a line holding a
 * quoted string followed by one of the three verdicts. Anything it cannot read
 * simply does not appear, and the count is printed beside the pack so a block
 * that grows a row this cannot see is visible as a number rather than silent.
 */
const SOURCES = [
  "client/src/features/castingV2/components/FacePanel.tsx",
  /* Added shift 79. This surface shipped unclassified and the gap was found by
     this audit rather than by reading the file — so the audit now reads it. */
  "client/src/features/castingV2/components/FaceRegions.tsx",
];
const classified: { text: string; verdict: string; note: string; source: string }[] = [];
for (const source of SOURCES) {
  const component = await readFile(path.resolve(source), "utf8");
  let found = 0;
  /*
    SPLIT ON EITHER ENDING. This checkout holds both: `.gitattributes` hands
    some files back with CRLF, and a trailing `\r` is a LINE TERMINATOR in
    JavaScript — so `(.*)$` cannot reach the end of the string and every line
    of a CRLF file fails to match. FaceRegions.tsx parsed as ZERO classified
    strings on its first run for exactly that reason, and the only thing that
    caught it was the `found === 0` guard below: a copy audit reporting nothing
    is shaped precisely like a surface with nothing to report.
  */
  for (const line of component.split(/\r?\n/)) {
    const match = line.match(/^\s*\*\s+(".+?")\s+(VERIFIED|ADAPTED|INVENTED)\s+—\s*(.*)$/);
    if (!match) continue;
    classified.push({ text: match[1], verdict: match[2], note: match[3].trim(), source: path.basename(source) });
    found += 1;
  }
  /* A surface that stops classifying its copy must not quietly leave the audit:
     the whole finding this file exists to prevent is a string nobody looked at. */
  if (found === 0) throw new Error(`no classified copy in ${source} — the block moved or its shape changed`);
}

/**
 * DID IT ACTUALLY REACH THE SCREEN? The saw lines are the driver's record of
 * what it read out of the live DOM, so a string the run never saw is either
 * unshipped or unasserted — both worth a mark rather than a silent row.
 *
 * A templated string ("Reading {possessive} features…", "her lips — ") is
 * matched on its literal stem, because the shipped form derives the rest.
 */
const seen = records.map((record) => `${record.law} ${record.saw}`).join("\n");
/**
 * EVERY LITERAL RUN, with the derived parts cut out.
 *
 * Two wrong versions preceded this one, in opposite directions, and both are
 * worth the lines it takes to say so. Taking the FIRST fragment made
 * "{Her left eye}. Edit it here." an empty stem, so every templated string on
 * the new surface reported NOT SEEN — an instrument failing in the direction
 * that looks like a finding. Taking the LONGEST then made "possessive" the stem
 * of "Reading {possessive} features…" — a placeholder's own name, the one
 * string guaranteed never to ship — and reported as unseen a line the run had
 * plainly read. Falling back to single WORDS would have been the third and
 * worst: "credits" or "features" appears somewhere in almost any run, so the
 * audit would agree with itself forever.
 *
 * So: cut what the product derives, and require every remaining run.
 */
const literalRuns = (text: string) => text.replace(/^"|"$/g, "")
  .split(/\{[^}]*\}|…/)
  .map((part) => part.trim())
  .filter((part) => part.length > 2);
/*
  ONE ROW PER STRING, not per line. A line documenting a PAIR — "she came with
  it" · "from an edit" — collapses two different facts into one verdict, and on
  the first build it read as a single NOT SEEN when one half is on screen in
  every run and the other has never been seen at all. Which half is the whole
  finding.
*/
const audit = classified.flatMap((entry) => entry.text.split(/\s+·\s+/).map((text) => {
  const runs = literalRuns(text);
  return { ...entry, text, found: runs.length > 0 && runs.every((run) => seen.includes(run)) };
}));

/** The shots this pack shows, and it refuses to reference one that is not there. */
const SHOTS: { file: string; caption: string }[] = [
  { file: "sheet-dark.png", caption: "The whole surface, dark — three columns: versions left, the photograph centre, the panel right. Nine rows, twelve rectangles on her face." },
  { file: "sheet-light.png", caption: "The same, light. The theme that once shipped white-on-white; the panel's ink is measured against a blanked copy of itself on every run." },
  { file: "panel-dark.png", caption: "The panel alone, dark. Every row carries a masked cutout of its own feature — her lips' is a minted crop, the rest are windows onto the frame already on screen." },
  { file: "panel-light.png", caption: "The panel alone, light." },
  { file: "region-open-dark.png", caption: "Clicking her lips ON the photograph opens the scoped ask AT the feature, carrying the opening of her sentence. The price is beside the button, never on it." },
  { file: "region-closeup-dark.png", caption: "The picture with its regions, close. Each rectangle is a fraction of the frame — never a proportion, never screen pixels." },
  { file: "refine-dark.png", caption: "Tapping a row writes the same opening into the ask box below: one edit, two doors." },
  { file: "thumb-live-dark.png", caption: "One cutout as it paints." },
  { file: "thumb-control-blocked.png", caption: "The same tile with its stencil refused at the network layer — the negative control. The two differ by 23.04 mean absolute difference; identical would mean the tile paints nothing and the reading proves nothing." },
];
const shots: typeof SHOTS = [];
for (const shot of SHOTS) {
  try {
    await access(path.join(OUT, shot.file));
    shots.push(shot);
  } catch {
    console.warn(`[pack] MISSING and omitted: ${shot.file}`);
  }
}

const escape = (value: string) => value
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const verdictClass = (verdict: string) => (verdict === "VERIFIED" ? "v" : verdict === "ADAPTED" ? "a" : "i");

const html = `<!doctype html>
<meta charset="utf-8">
<title>Panel v2 — evidence pack (shift 79)</title>
<style>
  :root {
    --ink:#F4F4F5; --meta:#A9A9AE; --metaStrong:#C9C9CE; --rule:#2A2A2E;
    --page:#0E0E10; --card:#161618; --good:#5FBF7F; --bad:#E2685A; --warn:#D9A441;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--page); color:var(--ink);
    font:15px/1.6 ui-sans-serif,-apple-system,"Segoe UI",Inter,system-ui,sans-serif; }
  .wrap { max-width:1180px; margin:0 auto; padding:56px 32px 120px; }
  h1 { font-size:30px; margin:0 0 8px; letter-spacing:-0.01em; }
  h2 { font-size:20px; margin:56px 0 4px; letter-spacing:-0.01em; }
  p { margin:0 0 12px; max-width:78ch; color:var(--metaStrong); }
  .lede { color:var(--meta); }
  figure { margin:20px 0 0; }
  figure img { display:block; width:100%; border-radius:10px; border:1px solid var(--rule); background:#000; }
  figcaption { margin-top:8px; font-size:13px; color:var(--meta); max-width:78ch; }
  .two { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  table { width:100%; border-collapse:collapse; margin-top:14px; font-size:13.5px; }
  th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--rule); vertical-align:top; }
  th { color:var(--meta); font-weight:520; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
  code { font-family:ui-monospace,"Cascadia Mono",Consolas,monospace; font-size:12.5px; color:var(--metaStrong); }
  .tag { display:inline-block; padding:1px 7px; border-radius:999px; font-size:11px; letter-spacing:.04em; }
  .v { background:rgba(95,191,127,.16); color:var(--good); }
  .a { background:rgba(217,164,65,.16); color:var(--warn); }
  .i { background:rgba(226,104,90,.16); color:var(--bad); }
  .ok { color:var(--good); } .no { color:var(--bad); } .off { color:var(--meta); }
  .box { background:var(--card); border:1px solid var(--rule); border-radius:12px; padding:18px 20px; margin-top:18px; }
</style>
<div class="wrap">
<h1>Panel v2 — evidence pack</h1>
<p class="lede">Shift 79. The panel as it is on the founder's own flags, driven in a real browser in both themes, with every verdict below taken from that run rather than written beside it.</p>

<h2>What the run said</h2>
<div class="box">
  <p><strong class="${failures.length === 0 ? "ok" : "no"}">${failures.length === 0 ? "ALL CHECKS HELD" : `${failures.length} FAILURE(S)`}</strong>
  — ${armed.length} armed of ${records.length} declared.</p>
  <p>The ${unarmed.length} unarmed ${unarmed.length === 1 ? "record is" : "records are"} declared and <em>not counted as a pass</em>: a check that cannot fire is recorded as absent with its reason, never as a green.</p>
</div>
<table>
  <tr><th>Verdict</th><th>The law</th><th>What it saw</th></tr>
  ${records.map((record) => `<tr>
    <td class="${record.ok ? (record.armed ? "ok" : "off") : "no"}">${record.armed ? (record.ok ? "ok" : "FAIL") : "not armed"}</td>
    <td>${escape(record.law)}</td>
    <td>${escape(record.saw)}</td>
  </tr>`).join("\n  ")}
</table>

<h2>The copy, classified</h2>
<p>Read out of <code>FacePanel.tsx</code>'s own classification block — the record of what was checked against his mock — and each string then looked for in the driver's saw lines. <strong>Shipped</strong> means this run actually read it off the live DOM; a classified string nobody shipped is the drift this column exists to catch.</p>
<table>
  <tr><th>String</th><th>Surface</th><th>Class</th><th>Shipped</th><th>Why it is what it is</th></tr>
  ${audit.map((entry) => `<tr>
    <td><code>${escape(entry.text)}</code></td>
    <td class="off">${escape(entry.source)}</td>
    <td><span class="tag ${verdictClass(entry.verdict)}">${entry.verdict}</span></td>
    <td class="${entry.found ? "ok" : "no"}">${entry.found ? "seen in the run" : "NOT SEEN"}</td>
    <td>${escape(entry.note)}</td>
  </tr>`).join("\n  ")}
</table>
<p class="lede">${audit.length} strings parsed from the block${audit.some((entry) => !entry.found)
  ? `, and ${audit.filter((entry) => !entry.found).length} of them has never been seen on screen by any run of this driver: `
    + audit.filter((entry) => !entry.found).map((entry) => `<code>${escape(entry.text)}</code>`).join(", ")
    + ". It is shipped copy with no evidence behind it — on this fixture every library row was minted by an edit, so the provenance line for a feature the face ARRIVED with has no row to appear on. A fixture that cannot show a string cannot audit it"
  : ", every one of them read off the live DOM by the run above"}.
${SOURCES.length > 1 ? `Read from ${SOURCES.length} surfaces: <code>${SOURCES.map((source) => path.basename(source)).join("</code>, <code>")}</code>. The second one shipped with no classification block at all until this audit reported its strings as unclassified — the audit finding its own blind spot is the only reason it is here.` : ""}</p>

<h2>The surface</h2>
${shots.map((shot) => `<figure>
  <img src="${shot.file}" alt="${escape(shot.caption)}">
  <figcaption>${escape(shot.caption)}</figcaption>
</figure>`).join("\n")}

<h2>One thing this pack is not hiding</h2>
<div class="box">
${EARRING_ARMED ? `  <p><strong>The earrings row is back, and this box is kept rather than deleted.</strong> When this pack was first built, a face wearing gold hoops had no earrings row: two correct rules met at a wrong outcome — a row appears only when it has a place on the photograph (his own rule), and earring <em>detection</em> was unarmed until its court had run, so nothing measured where they were.</p>
  <p>The per-side court has since passed and the class is armed, so the scan asks and the row has its rectangles. The paragraph stays because a pack that quietly drops the thing it promised not to hide is a pack nobody can check twice.</p>`
: `  <p><strong>She is wearing gold hoop earrings and there is no earrings row.</strong> The library holds <code>"a slim gold hoop"</code> for both sides, from a real edit. Two correct rules meet at a wrong outcome: a row appears only when it has a place on the photograph (his own rule), and earring <em>detection</em> is unarmed until its court is run — so nothing ever measures where they are, and the row leaves the panel.</p>
  <p>It is recorded in the run above as an <em>absent</em> rather than a passing check, because a green saying "no earrings row, as expected" is a pin holding a defect in place. The earring court is the next build.</p>`}
</div>
</div>
`;

await writeFile(path.join(OUT, "pack.html"), html);
console.log(`[pack] ${path.join(OUT, "pack.html")}`);
console.log(`[pack] ${records.length} checks (${failures.length} failing, ${unarmed.length} unarmed) · ${audit.length} classified strings (${audit.filter((entry) => !entry.found).length} not seen in the run) · ${shots.length} of ${SHOTS.length} shots`);

process.exit(0);
