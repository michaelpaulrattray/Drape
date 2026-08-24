import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname.slice(1));
const OUT = path.join(HERE, 'mined');
fs.mkdirSync(OUT, { recursive: true });
const txt = p => Array.isArray(p) ? p.join('\n') : (typeof p === 'string' ? p : '');

// ---------- load EVERY prompt from both productions, weighted by runs ----------
const prompts = []; // {text, runs, model, corpus}
const push = (t, runs, model, corpus) => { if (t && t.trim()) prompts.push({ text: t, runs, model, corpus }); };

for (const f of ['characters', 'production', 'iterations']) {
  const p = path.join(HERE, 'raw', `${f}.json`);
  if (!fs.existsSync(p)) continue;
  for (const it of JSON.parse(fs.readFileSync(p))) {
    if (it.type !== 'job') continue;
    push(txt(it.job.params?.prompt), 1, it.job.job_set_type, 'film1');
  }
}
for (const f of ['special-all']) {
  for (const it of JSON.parse(fs.readFileSync(path.join(HERE, 'raw2', `${f}.json`)))) {
    if (it.type !== 'job') continue;
    push(txt(it.job.params?.prompt), 1, it.job.job_set_type, 'special');
  }
}
console.log(`loaded ${prompts.length} prompted jobs`);

// distinct prompts, keeping run counts and model/corpus sets
const distinct = new Map();
for (const p of prompts) {
  const k = p.text.replace(/\s+/g, ' ').trim();
  let e = distinct.get(k);
  if (!e) { e = { text: p.text, runs: 0, models: new Set(), corpora: new Set() }; distinct.set(k, e); }
  e.runs++; e.models.add(p.model); e.corpora.add(p.corpus);
}
console.log(`distinct prompts: ${distinct.size}`);

// ---------- split into clauses ----------
// English: . ; — | newline    Chinese: 。 ； ， ——
const SPLIT = /[\n。；;]|——|\s—\s|\.\s+(?=[A-Z])/;
const clauses = new Map(); // normalised clause -> {raw, jobs, runs, models, corpora}
const VIDEO = new Set(['seedance_2_0', 'seedance_2_5', 'cinematic_studio_video_3_5', 'kling3_0_motion_control']);

for (const e of distinct.values()) {
  const isVideo = [...e.models].some(m => VIDEO.has(m));
  // strip JSON syntax so structured prompts contribute their VALUES
  const flat = e.text
    .replace(/<<<[^>]+>>>/g, '<REF>')
    .replace(/^[\s{}\[\],]*"[a-z_]+"\s*:\s*/gim, '')
    .replace(/["{}\[\]]/g, ' ');
  for (let c of flat.split(SPLIT)) {
    c = c.replace(/\s+/g, ' ').trim().replace(/[,.;:]+$/, '');
    if (c.length < 6 || c.length > 190) continue;
    const key = c.toLowerCase();
    let x = clauses.get(key);
    if (!x) { x = { raw: c, jobs: 0, runs: 0, video: 0, film1: 0, special: 0 }; clauses.set(key, x); }
    x.jobs++; x.runs += e.runs;
    if (isVideo) x.video += e.runs;
    if (e.corpora.has('film1')) x.film1 += e.runs;
    if (e.corpora.has('special')) x.special += e.runs;
  }
}
console.log(`distinct clauses: ${clauses.size}`);

// ---------- categorise ----------
const CATS = {
  'LENS & OPTICS': /\b(\d{2,3}\s?mm|focal|anamorphic|telephoto|wide[- ]angle|spherical|angle of view|fov|depth of field|shallow focus|bokeh|shutter|lens breathing|flare|halation|fisheye|distortion|prime|super[- ]?35|large[- ]format|imax|macro)\b|毫米|变形镜头|景深|镜头耀斑/i,
  'CAMERA MOVE': /\b(handheld|hand[- ]held|dolly|push[- ]?in|pull[- ]?back|pan\b|tilt|orbit|arc\b|crane|track(ing)?|whip|static|locked[- ]off|drift|jitter|zoom|steadicam|gimbal|roam|follow(s|ing)? (her|him|them)|circle)\b|手持|推镜|拉镜|摇镜|跟拍|运镜|环绕/i,
  'SHOT SIZE & ANGLE': /\b(close[- ]?up|\bcu\b|extreme close|medium shot|wide shot|two[- ]shot|waist[- ]up|chest[- ]up|full[- ]body|over[- ]the[- ]shoulder|\bpov\b|dutch|low angle|high angle|eye[- ]level|three[- ]quarter|3\/4|top[- ]down|bird|worm|profile|establishing|insert|cutaway)\b|特写|近景|中景|全景|远景|仰角|俯角|低角度|高角度|荷兰/i,
  'MOTION & TIME': /\b(slow[- ]?mo(tion)?|real[- ]?time|speed ?ramp|freeze|24\s?fps|motion blur|frame rate|time ?lapse|ultra slow|hyper ?lapse|no slow)\b|慢动作|升格|实时|动态模糊/i,
  'LIGHTING': /\b(key light|fill light|rim light|backlit|back ?light|motivated|practical|hard light|soft light|low[- ]key|high[- ]key|contrast|golden hour|overcast|volumetric|god ?ray|haze|silhouette|shadow|bounce|ambient|no fill)\b|布光|光源|逆光|补光|硬光|柔光|阴影|反差/i,
  'COLOUR & GRADE': /\b(desaturat|saturat|teal|orange|crushed black|lifted black|grade|palette|colour|color|warm|cool|monochrome|muted|vivid|tint|lut)\b|色调|调色|饱和|冷色|暖色/i,
  'SKIN & FACE': /\b(pore|skin texture|vellus|blemish|freckle|sweat|no smoothing|retouch|asymmetry|matte skin|waxy|plastic|airbrush|uncanny|doll|mannequin)\b|皮肤|毛孔|真实皮肤/i,
  'PHYSICS & MATERIALS': /\b(gravity|inertia|mass|weight|momentum|cloth|fabric|hair (whip|fly|move)|contact shadow|float|slide|bounce|recoil|impact|rebound|compress)\b|重量|重力|惯性|物理/i,
  'ACTING & PERFORMANCE': /\b(blink|micro[- ]expression|eyeline|eye[- ]line|brow|forehead|breath|gaze|glance|dead eyes|mask[- ]face|emotion|expression|reaction|looking (at|off|toward))\b|表情|微表情|眨眼|视线|情绪/i,
  'NEGATIVE CONSTRAINTS': /\b(no |not |never |avoid|without|omit|forbidden|do not|don't|zero )/i,
  'AUDIO & VOICE': /\b(sfx|foley|no music|sound effect|lip[- ]?sync|diegetic|room tone|voice|dialogue|sing|speak|say|whisper|shout|bpm|audio|subtitle)\b|音效|无音乐|台词|声音|配音/i,
  'REFERENCE SCOPING': /\b(only|strictly|solely|exactly|100% match|identical|keep|preserve|maintain|match(es|ing)?|layout only|from (this|the) (input|reference|image)|per <REF>|<REF>)\b|仅|严格|保持|一致|完全相同/i,
  'SHOT STRUCTURE': /\b(shot \d|hard cut|cut to|continuous take|one take|single take|no cut|segment \d|first frame|beat|opens on|ends on)\b|第[一二三四五六七八九十]镜|切镜|硬切|一镜到底|首帧/i,
  'FORMAT & TECHNICAL': /\b(\d+:\d+|16:9|21:9|2\.39|aspect|resolution|4k|8k|1080p|720p|\d+\s?seconds?|\d+s\b|grain|photoreal|cinematic|film still|8k)\b|秒|画幅|写实|电影感|颗粒/i,
  'STYLE ANCHOR': /\b(shot on|arri|alexa|red\b|kodak|portra|van hoytema|deakins|lubezki|doyle|fincher|villeneuve|nolan|wes anderson|a24|k-?pop|music video|documentary|hollywood|anime|studio ghibli)\b|好莱坞|韩流|动画|纪录片/i,
};

const buckets = {};
for (const [k, v] of clauses) {
  for (const [cat, re] of Object.entries(CATS)) {
    if (re.test(v.raw)) (buckets[cat] ||= []).push(v);
  }
}

// ---------- emit ----------
const lines = [];
lines.push(`# Mined clause catalogue — every prompt, both productions`);
lines.push(``);
lines.push(`Source: ${prompts.length} prompted jobs, ${distinct.size} distinct prompts, ${clauses.size} distinct clauses.`);
lines.push(`Counts are RUNS (job-weighted). \`video\` counts runs on a video model.`);
lines.push(``);
for (const [cat, arr] of Object.entries(buckets)) {
  arr.sort((a, b) => b.runs - a.runs);
  lines.push(`\n## ${cat}  (${arr.length} distinct clauses)`);
  lines.push(``);
  lines.push(`| runs | video | f1 | sp | clause |`);
  lines.push(`|---:|---:|---:|---:|---|`);
  for (const c of arr.slice(0, 120)) {
    lines.push(`| ${c.runs} | ${c.video} | ${c.film1} | ${c.special} | ${c.raw.replace(/\|/g, '\\|').slice(0, 170)} |`);
  }
}
fs.writeFileSync(path.join(OUT, 'clause-catalogue.md'), lines.join('\n'));
console.log('wrote mined/clause-catalogue.md');
for (const [cat, arr] of Object.entries(buckets)) console.log(`  ${cat.padEnd(24)} ${arr.length}`);
