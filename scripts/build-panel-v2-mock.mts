/**
 * PANEL v2 — the founder's chart interaction, mocked before it is built (D-101).
 *
 * His words, via fable-144: *"You cast a sheet, you select a cast — it should
 * auto-detect features (eyes, hair, glasses, tattoos, etc.), these populate the
 * segments; hovering over each shows a boundary box on the image; you can
 * directly edit each individual segment piece, or edit through the chatbox as
 * well."* Plus fable-141's layout: segments docked RIGHT, versions LEFT, only
 * the ask box at the bottom.
 *
 * # This is a MOCK, and one line of it is load-bearing
 *
 * fable-144 §3: per-segment editing in v2 is **tap scopes the ask box** — and
 * the full in-place ceremony (current-vs-proposed, edit inside the row) is M12
 * on this foundation. *The mock must not promise it.* So the row's tap target
 * says what it does, and there is no pencil, no inline field, no "apply".
 *
 * # Every string is classified, beside the thing it labels
 *
 * The UI milestone contract (founder, 2026-08-01): prototype content is
 * quotation, not requirement, and no UI milestone reaches him without a copy
 * audit classifying every user-visible string. So the audit is not a separate
 * document that can drift from the mock — it is rendered from the same table
 * that renders the mock, in a column beside it. A string with no classification
 * cannot appear.
 *
 * # The fixture is real, and where it is not, it says so
 *
 * Face, versions, segment names and bounding boxes are candidate `f9e9cb81`
 * ("Unfussed") out of production — variant 156, three real segments with their
 * real geometry. The rows with no stored box (eyes, brows, glasses) are the part
 * that does not exist yet: their real boxes come from a region read the scan has
 * not been built to cache. Here they are placed as fractions of the REAL
 * face-skin box rather than by eye — reproducible, and wrong in a stated
 * fraction rather than in a hand if they are wrong — and marked INVENTED on
 * every row of the audit. Nothing in the mock pretends they were measured.
 *
 *   npx tsx scripts/build-panel-v2-mock.mts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

const OUT = "output/pack/panel-v2-mock.html";
const FRAME = "output/founder-finding-4/v156-hoops.png";
/** The frame's own pixel size — every bbox below is in these coordinates. */
const FRAME_W = 1024;
const FRAME_H = 1536;

type Provenance = "anatomy" | "detected_born" | "edit_patch";
type Source = "verified" | "adapted" | "invented";
type Row = {
  name: string;
  from: string;
  provenance: Provenance;
  box: { x: number; y: number; w: number; h: number };
  /** Where the BOX came from, separately from where the words came from. */
  boxSource: Source;
  boxNote: string;
  nameSource: Source;
  nameNote: string;
};

/*
  THE INVENTED BOXES ARE DERIVED FROM A VERIFIED ONE, not drawn by eye.

  Three of this face's boxes are real stored geometry: face skin, hair and lips.
  The rows that have no stored box — eyes, brows, glasses — are placed as
  fractions of the REAL face-skin box rather than by my judgement of the
  photograph, so they are reproducible and so the error, if there is one, is in
  a stated fraction instead of in a hand.

  The fractions are the canonical face proportions, and the face-skin box itself
  checks them: her real lips box begins at (609 - 302) / 423 = **0.726** of the
  way down it, against the canonical 0.73. The anchor and the rule agree before
  either is used. They are still INVENTED — the real boxes come from the region
  read the scan will cache — and the audit says so on every row.
*/
const FACE = { x: 332, y: 302, w: 363, h: 423 };
const down = (fraction: number): number => Math.round(FACE.y + FACE.h * fraction);
const tall = (fraction: number): number => Math.round(FACE.h * fraction);
const DERIVED_NOTE =
  "derived as a fraction of the REAL face-skin box (canonical proportions, which that box's own "
  + "lips geometry confirms at 0.726 against 0.73) — the real box comes from the region read the scan will cache";

/*
  ANATOMY, ALWAYS PRESENT — his ruling: "everything editable by default, even on
  the untouched original". These need no detection: they are the region
  vocabulary the masked path already segments by, so every face has them by
  construction. The names use the same possessive shape `segmentsOnFace` already
  produces for a "hers" facet, so nothing new is invented to say them.
*/
const ANATOMY: Row[] = [
  {
    name: "Her eyes", from: "part of her", provenance: "anatomy",
    box: { x: 346, y: down(0.42), w: 335, h: tall(0.09) }, boxSource: "invented",
    boxNote: DERIVED_NOTE,
    nameSource: "adapted",
    nameNote: "`nameForFacet`'s existing possessive shape over the region vocabulary; the panel says \"Her freckles\" the same way today",
  },
  {
    name: "Her hair", from: "part of her", provenance: "anatomy",
    box: { x: 344, y: 289, w: 354, h: 187 }, boxSource: "verified",
    boxNote: "the REAL hair region box — segment #9's stored geometry on this face",
    nameSource: "adapted", nameNote: "as above",
  },
  {
    name: "Her brows", from: "part of her", provenance: "anatomy",
    box: { x: 356, y: down(0.35), w: 315, h: tall(0.055) }, boxSource: "invented",
    boxNote: DERIVED_NOTE, nameSource: "adapted", nameNote: "as above",
  },
  {
    name: "Her lips", from: "part of her", provenance: "anatomy",
    box: { x: 456, y: 609, w: 114, h: 39 }, boxSource: "verified",
    boxNote: "the REAL lips region box — segment #10's stored geometry on this face",
    nameSource: "adapted", nameNote: "as above",
  },
  {
    name: "Her skin", from: "part of her", provenance: "anatomy",
    box: { x: 332, y: 302, w: 363, h: 423 }, boxSource: "verified",
    boxNote: "the REAL face-skin region box — segment #8's stored geometry on this face",
    nameSource: "adapted", nameNote: "as above",
  },
];

/*
  BORN-WORN, DETECTED — the row that makes `bornWornCatalogue` earn its keep.
  Glasses is the one class courted today; ink and earrings are the expansion
  path. The provenance wording is the one already written and deliberately
  unreachable in `segmentsOnFace`: "she came with it".
*/
const DETECTED: Row[] = [
  {
    name: "Her glasses", from: "she came with it", provenance: "detected_born",
    box: { x: 336, y: down(0.34), w: 356, h: tall(0.20) }, boxSource: "invented",
    boxNote: `${DERIVED_NOTE}. For glasses the catalogue's own read is the real source, and it has no callers yet.`,
    nameSource: "adapted",
    nameNote: "`provenanceWording('detected_born')` — the exact string already in `segmentsOnFace`, unreachable until the catalogue is wired",
  },
];

/*
  EDITS — the rows the panel already shows today, unchanged, with their real
  stored geometry and their real delivered names.
*/
const EDITS: Row[] = [
  {
    name: "Her freckles", from: "from an edit", provenance: "edit_patch",
    box: { x: 332, y: 302, w: 363, h: 423 }, boxSource: "verified",
    boxNote: "segment #8 marks@v1, filed by variant 153 \"give her freckles\"",
    nameSource: "verified",
    nameNote: "produced by the shipped projection from the chain's own delivered value",
  },
  {
    name: "Nude lip gloss", from: "from an edit", provenance: "edit_patch",
    box: { x: 456, y: 609, w: 114, h: 39 }, boxSource: "verified",
    boxNote: "segment #10 makeup@v1, filed by variant 155 \"add nude lip gloss\"",
    nameSource: "verified", nameNote: "as above",
  },
];

const VERSIONS = [
  { label: "Original", sub: "as cast" },
  { label: "1", sub: "give her freckles" },
  { label: "2", sub: "add nude lip gloss" },
  { label: "3", sub: "gold hoop earrings", selected: true },
  { label: "4", sub: "remove her glasses" },
];

/** Copy that is not a row, still classified. */
const COPY: Array<{ text: string; where: string; source: Source; note: string }> = [
  {
    text: "On her face", where: "panel heading", source: "verified",
    note: "founder-cleared verbatim 2026-08-09 (\"KEEP as mocked\"); the possessive is derived per face",
  },
  {
    text: "Everything here can be changed. Tap one to talk about it.",
    where: "panel sub", source: "adapted",
    note: "the shipped sub is \"Things this version is keeping. Tap one to talk about it.\" — v2's list is no longer only what it KEEPS, so the first clause had to change or it would be false. Second clause verbatim.",
  },
  {
    text: "Versions", where: "left rail heading", source: "invented",
    note: "no prototype string existed for the rail; plainest available word",
  },
  {
    text: "Describe a change…", where: "ask box placeholder", source: "verified",
    note: "the shipped placeholder on the refine field",
  },
  {
    text: "her freckles — ", where: "ask box after tapping a row", source: "verified",
    note: "the shipped `prefill` shape, lowercased opening of her own sentence",
  },
  {
    text: "~25 credits", where: "the ask button", source: "verified",
    note: "the shipped price; a paid button states its price (browser-asserted law)",
  },
];

if (!existsSync(FRAME)) { console.error(`fixture frame missing: ${FRAME}`); process.exit(1); }
const frameUri = `data:image/jpeg;base64,${
  (await sharp(readFileSync(FRAME)).resize({ width: 720 }).jpeg({ quality: 86 }).toBuffer()).toString("base64")
}`;

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const rowsHtml = (rows: Row[], group: string): string => `
  <li class="grp">${escapeHtml(group)}</li>
  ${rows.map((row, index) => `
  <li>
    <button type="button" class="row" data-box="${row.box.x},${row.box.y},${row.box.w},${row.box.h}"
            data-prefill="${escapeHtml(row.name.charAt(0).toLowerCase() + row.name.slice(1))} — "
            aria-label="${escapeHtml(`${row.name}, ${row.from}. Talk about it.`)}">
      <span class="thumb thumb--${row.provenance}" aria-hidden="true"></span>
      <span class="rbody">
        <span class="rname">${escapeHtml(row.name)}</span>
        ${row.provenance === "anatomy" ? "" : `<span class="rfrom">${escapeHtml(row.from)}</span>`}
      </span>
    </button>
  </li>`).join("")}`;

const auditRow = (label: string, text: string, source: Source, note: string): string => `
  <tr>
    <td class="a-where">${escapeHtml(label)}</td>
    <td class="a-text">${escapeHtml(text)}</td>
    <td><span class="tag tag--${source}">${source}</span></td>
    <td class="a-note">${escapeHtml(note)}</td>
  </tr>`;

const allRows = [...ANATOMY, ...DETECTED, ...EDITS];
const counts = {
  verified: allRows.filter((r) => r.nameSource === "verified").length + COPY.filter((c) => c.source === "verified").length,
  adapted: allRows.filter((r) => r.nameSource === "adapted").length + COPY.filter((c) => c.source === "adapted").length,
  invented: allRows.filter((r) => r.nameSource === "invented").length + COPY.filter((c) => c.source === "invented").length,
};
const boxCounts = {
  verified: allRows.filter((r) => r.boxSource === "verified").length,
  invented: allRows.filter((r) => r.boxSource === "invented").length,
};

const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Panel v2 — mock</title>
<style>
:root {
  --surface:#FFFFFF; --raised:#FAFAFB; --page:#FCFCFD; --media:#F1F1F3;
  --rule:#F0F0F2; --border:#ECECEE; --borderMedia:#E8E8EB; --borderCard:#E4E4E7;
  --muted:#B4B4BA; --faint:#A0A0A6; --meta:#8E8E94; --metaStrong:#6B6B70;
  --secondary:#3E3E42; --ink:#111112;
  --accentSolid:#E2685A; --accentInk:#A23E33; --accentWash:#FEF2F0; --accentLine:#F1CDC6;
  --onWash:#FFFFFF; --well:#F6F6F8;
}
[data-theme="dark"] {
  --surface:#1C1C1F; --raised:#1A1A1D; --page:#141416; --media:#232326;
  --rule:#2A2A2E; --border:#2C2C30; --borderMedia:#303036; --borderCard:#33333A;
  --muted:#6E6E77; --faint:#8A8A92; --meta:#9A9AA2; --metaStrong:#9A9AA2;
  --secondary:#B4B4BA; --ink:#EDEDEF;
  --accentSolid:#E2685A; --accentInk:#E88778;
  --accentWash:rgba(226,104,90,.14); --accentLine:rgba(226,104,90,.32);
  --onWash:#FFFFFF; --well:#202024;
}
* { box-sizing:border-box; }
body {
  margin:0; background:var(--page); color:var(--ink);
  font:400 15px/1.55 Inter, -apple-system, "Segoe UI", system-ui, sans-serif;
  -webkit-font-smoothing:antialiased;
}
.wrap { max-width:1320px; margin:0 auto; padding:56px 32px 96px; }
h1 { font-size:30px; font-weight:500; letter-spacing:-0.02em; margin:0 0 10px; }
.sub { color:var(--metaStrong); max-width:70ch; margin:0 0 6px; }
.themebtn {
  position:fixed; top:20px; right:20px; z-index:9; background:var(--surface);
  color:var(--secondary); border:1px solid var(--borderCard); border-radius:8px;
  padding:8px 14px; font:inherit; font-size:13px; cursor:pointer;
}

/* ── the mock itself ─────────────────────────────────────────────── */
.mock {
  margin:32px 0 8px; border:1px solid var(--borderCard); border-radius:14px;
  background:var(--surface); overflow:hidden;
  display:grid; grid-template-columns:104px 1fr 292px;
}
.rail { border-right:1px solid var(--rule); padding:16px 12px; background:var(--raised); }
.rail h2, .seg h2 {
  font-size:11px; font-weight:500; letter-spacing:.08em; text-transform:uppercase;
  color:var(--meta); margin:0 0 12px;
}
.ver {
  display:block; width:100%; margin:0 0 10px; padding:0; cursor:pointer;
  background:none; border:none; text-align:left; font:inherit; color:inherit;
}
.ver .chip {
  display:block; aspect-ratio:2/3; border-radius:8px; background:var(--media);
  border:1px solid var(--borderMedia); background-size:cover; background-position:center 18%;
}
.ver[aria-current="true"] .chip { border-color:var(--accentSolid); box-shadow:0 0 0 2px var(--accentWash); }
.ver .vlabel { display:block; font-size:11px; color:var(--metaStrong); margin-top:5px; }
.ver .vsub {
  display:block; font-size:10px; color:var(--muted); margin-top:1px;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}

.stage { position:relative; background:var(--media); display:flex; align-items:center; justify-content:center; }
.stage img { display:block; width:100%; height:auto; }
.boxes { position:absolute; inset:0; pointer-events:none; }
.bbox {
  position:absolute; border:1.5px solid var(--accentSolid);
  background:rgba(226,104,90,.10); border-radius:3px;
  opacity:0; transition:opacity .12s ease;
}
.bbox.on { opacity:1; }

.seg { border-left:1px solid var(--rule); padding:16px 14px; background:var(--raised); }
.seg .head p { margin:0 0 3px; }
.seg .title { font-size:14px; font-weight:500; }
.seg .subline { font-size:12px; color:var(--meta); margin-bottom:14px !important; }
.seg ul { list-style:none; margin:0; padding:0; }
.grp {
  font-size:10px; font-weight:500; letter-spacing:.08em; text-transform:uppercase;
  color:var(--muted); padding:14px 2px 6px;
}
.row {
  display:flex; align-items:center; gap:10px; width:100%; padding:7px 8px;
  background:none; border:1px solid transparent; border-radius:9px;
  font:inherit; color:inherit; text-align:left; cursor:pointer;
}
.row:hover, .row:focus-visible { background:var(--well); border-color:var(--border); outline:none; }
.thumb { width:34px; height:34px; border-radius:7px; flex:0 0 auto; background:var(--media); border:1px solid var(--borderMedia); }
.thumb--anatomy { background:linear-gradient(135deg, var(--media), var(--border)); }
.thumb--detected_born { background:linear-gradient(135deg, var(--accentWash), var(--media)); border-color:var(--accentLine); }
.thumb--edit_patch { background:linear-gradient(135deg, var(--border), var(--media)); }
.rbody { display:flex; flex-direction:column; min-width:0; }
.rname { font-size:13px; }
.rfrom { font-size:11px; color:var(--meta); }

.ask {
  grid-column:1 / -1; border-top:1px solid var(--rule); padding:14px 16px;
  display:flex; gap:10px; align-items:center; background:var(--surface);
}
.ask input {
  flex:1; padding:11px 14px; border-radius:10px; font:inherit; font-size:14px;
  background:var(--page); color:var(--ink); border:1px solid var(--borderInput, var(--borderCard));
}
.ask input::placeholder { color:var(--meta); }
.ask input:focus { outline:none; border-color:var(--lineStrong, var(--secondary)); }
.ask button {
  padding:11px 18px; border-radius:10px; border:none; cursor:pointer;
  background:var(--accentSolid); color:var(--onWash); font:inherit; font-size:14px;
}
.hint { font-size:12px; color:var(--meta); margin:10px 2px 0; }

/* ── the audit ───────────────────────────────────────────────────── */
h3 { font-size:19px; font-weight:500; margin:56px 0 6px; letter-spacing:-0.01em; }
table { width:100%; border-collapse:collapse; margin-top:14px; font-size:13px; }
th { text-align:left; font-weight:500; color:var(--meta); font-size:11px;
     letter-spacing:.06em; text-transform:uppercase; padding:0 10px 8px 0; }
td { padding:9px 10px 9px 0; border-top:1px solid var(--rule); vertical-align:top; }
.a-where { color:var(--metaStrong); white-space:nowrap; }
.a-text { color:var(--ink); }
.a-note { color:var(--meta); font-size:12px; }
.tag { font-size:11px; padding:2px 8px; border-radius:999px; white-space:nowrap; border:1px solid var(--border); color:var(--metaStrong); }
.tag--verified { border-color:var(--accentLine); color:var(--accentInk); background:var(--accentWash); }
.tag--invented { border-style:dashed; }
.tally { color:var(--metaStrong); font-size:13px; margin-top:12px; }
.note { max-width:74ch; color:var(--metaStrong); }
.note strong { color:var(--ink); font-weight:500; }
</style>
</head>
<body>
<button class="themebtn" id="theme">Light</button>
<div class="wrap">
  <h1>Panel v2 — mock</h1>
  <p class="sub">Segments docked right, versions left, only the ask box at the bottom. Every row is
  present on every face: the anatomy rows need no detection, the born-worn rows come from the
  catalogue. Hover a row to see its boundary on the picture. Tapping one scopes the ask box — and
  that is all it does.</p>

  <div class="mock">
    <div class="rail">
      <h2>Versions</h2>
      ${VERSIONS.map((version) => `
      <button class="ver" type="button"${version.selected ? ' aria-current="true"' : ""}>
        <span class="chip" style="background-image:url('${frameUri}')"></span>
        <span class="vlabel">${escapeHtml(version.label)}</span>
        <span class="vsub">${escapeHtml(version.sub)}</span>
      </button>`).join("")}
    </div>

    <div class="stage">
      <img src="${frameUri}" alt="the selected version of this face">
      <div class="boxes" id="boxes"></div>
    </div>

    <div class="seg">
      <div class="head">
        <p class="title">On her face</p>
        <p class="subline">Everything here can be changed. Tap one to talk about it.</p>
      </div>
      <ul>
        ${rowsHtml(ANATOMY, "Her features")}
        ${rowsHtml(DETECTED, "She came with")}
        ${rowsHtml(EDITS, "From your edits")}
      </ul>
    </div>

    <div class="ask">
      <input id="ask" type="text" placeholder="Describe a change…">
      <button type="button">Ask · ~25 credits</button>
    </div>
  </div>
  <p class="hint">Hover any row. Tap one to see it scope the ask box.</p>

  <h3>What this mock deliberately does not do</h3>
  <p class="note">There is no pencil on a row, no field inside a row, and no apply button beside
  one. <strong>Tapping a row writes the opening of a sentence into the ask box and stops.</strong>
  The in-place per-segment ceremony — current against proposed, edited where it sits — is M12 on
  this foundation, and a mock that hinted at it would be promising a thing that is not being
  built yet.</p>
  <p class="note">The anatomy rows are shown for a face whose original was never edited too: that
  is the point of them. They are derived from the region vocabulary, so they cost no detection
  and exist before anything has been asked for.</p>

  <h3>Copy audit — every user-visible string</h3>
  <p class="note">Prototype content is quotation, not requirement. <span class="tag tag--verified">verified</span>
  is a string the founder cleared or the product already ships; <span class="tag tag--adapted">adapted</span>
  is a cleared string changed for a stated reason; <span class="tag tag--invented">invented</span>
  had no prototype and is mine.</p>
  <table>
    <thead><tr><th>Where</th><th>String</th><th>Source</th><th>Why</th></tr></thead>
    <tbody>
      ${COPY.map((copy) => auditRow(copy.where, copy.text, copy.source, copy.note)).join("")}
      ${allRows.map((row) => auditRow(
        row.provenance === "anatomy" ? "anatomy row" : row.provenance === "detected_born" ? "born-worn row" : "edit row",
        `${row.name} · ${row.from}`, row.nameSource, row.nameNote,
      )).join("")}
    </tbody>
  </table>
  <p class="tally">${counts.verified} verified · ${counts.adapted} adapted · ${counts.invented} invented.</p>

  <h3>Boundary boxes — which are real</h3>
  <p class="note">The hover overlay is a draw, not a derivation: an edit row already carries its
  own <code>bboxX/Y/W/H</code>. An ANATOMY row does not — its box comes from a region read the
  scan has not been built to cache — so those are drawn from face proportions here and marked
  accordingly. <strong>None of them is a measurement presented as one.</strong></p>
  <table>
    <thead><tr><th>Row</th><th>Box</th><th>Source</th><th>Why</th></tr></thead>
    <tbody>
      ${allRows.map((row) => auditRow(
        row.name, `${row.box.x},${row.box.y} ${row.box.w}×${row.box.h}`, row.boxSource, row.boxNote,
      )).join("")}
    </tbody>
  </table>
  <p class="tally">${boxCounts.verified} real stored geometry · ${boxCounts.invented} drawn for this mock.</p>

  <h3>The fixture</h3>
  <p class="note">Candidate <code>f9e9cb81</code> (“Unfussed”), variant 156 (“gold hoop earrings”),
  out of production. Its three real segments and their real geometry are the rows marked verified
  above. She wears glasses in this frame, which is why the born-worn row has something to detect.</p>
</div>
<script>
  const stage = document.querySelector(".stage img");
  const layer = document.getElementById("boxes");
  const ask = document.getElementById("ask");
  const FRAME = { w: ${FRAME_W}, h: ${FRAME_H} };
  let current = null;

  function draw(spec) {
    layer.replaceChildren();
    if (!spec) return;
    const [x, y, w, h] = spec.split(",").map(Number);
    const box = document.createElement("div");
    box.className = "bbox on";
    box.style.left = (x / FRAME.w * 100) + "%";
    box.style.top = (y / FRAME.h * 100) + "%";
    box.style.width = (w / FRAME.w * 100) + "%";
    box.style.height = (h / FRAME.h * 100) + "%";
    layer.appendChild(box);
  }

  for (const row of document.querySelectorAll(".row")) {
    const spec = row.getAttribute("data-box");
    row.addEventListener("mouseenter", () => draw(spec));
    row.addEventListener("focus", () => draw(spec));
    row.addEventListener("mouseleave", () => { if (current !== spec) draw(current); });
    row.addEventListener("blur", () => draw(current));
    row.addEventListener("click", () => {
      current = spec;
      draw(spec);
      /* Scopes the sentence. Never submits it — see "what this mock does not do". */
      ask.value = row.getAttribute("data-prefill");
      ask.focus();
    });
  }

  const button = document.getElementById("theme");
  const root = document.documentElement;
  button.addEventListener("click", () => {
    const dark = root.getAttribute("data-theme") === "dark";
    root.setAttribute("data-theme", dark ? "light" : "dark");
    button.textContent = dark ? "Dark" : "Light";
  });
</script>
</body>
</html>`;

mkdirSync("output/pack", { recursive: true });
writeFileSync(OUT, html);
console.log(`${OUT}  ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
console.log(`  rows: ${allRows.length} (${ANATOMY.length} anatomy · ${DETECTED.length} born-worn · ${EDITS.length} edits)`);
console.log(`  copy: ${counts.verified} verified · ${counts.adapted} adapted · ${counts.invented} invented`);
console.log(`  boxes: ${boxCounts.verified} real · ${boxCounts.invented} drawn for the mock`);
process.exit(0);
