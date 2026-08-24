import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname.slice(1));
const txt = p => Array.isArray(p) ? p.join('\n') : (typeof p === 'string' ? p : '');
const all = JSON.parse(fs.readFileSync(path.join(HERE, 'raw2', 'special-all.json')))
  .filter(it => it.type === 'job').map(it => it.job).sort((a, b) => a.created_at - b.created_at);
const parse = j => { try { return JSON.parse(txt(j.params?.prompt)); } catch { return null; } };

// the choke scene: prompts mentioning choke / lemonade glass element
const scene = all.filter(j => /chok(e|es|ing)|lemonade/i.test(txt(j.params?.prompt)));
console.log(`jobs touching the choke/lemonade scene: ${scene.length}`);
console.log(`span: ${new Date(scene[0].created_at*1000).toISOString().slice(0,16)} -> ${new Date(scene[scene.length-1].created_at*1000).toISOString().slice(0,16)}`);
const m = {}; for (const j of scene) m[j.job_set_type]=(m[j.job_set_type]||0)+1;
console.log('models:', JSON.stringify(m));

// distinct setups in time order, classified
const setups = new Map();
for (const j of scene) {
  const k = txt(j.params.prompt).replace(/\s+/g,' ').trim();
  const e = setups.get(k) || { first: j.created_at, runs: 0, model: j.job_set_type, o: parse(j), t: k };
  e.runs++; setups.set(k, e);
}
console.log(`distinct setups: ${setups.size}\n`);
console.log('=== THE SCENE CHAIN, in creation order ===');
let i = 0;
for (const e of [...setups.values()].sort((a,b)=>a.first-b.first)) {
  i++;
  const o = e.o;
  const purpose = o?.scene_summary?.purpose || '';
  const shotType = o?.shot?.type || (o?.shots ? `${o.shots.length}-shot doc` : '');
  let cls = 'prose';
  if (/blocking test|placement/i.test(purpose)) cls = 'BLOCKING TEST';
  else if (/test/i.test(purpose)) cls = 'ACTING TEST';
  else if (e.model !== 'seedance_2_0' && e.model !== 'seedance_2_5') cls = `ASSET MINT (${e.model})`;
  else if (shotType) cls = 'SHOT';
  else cls = 'SHOT (prose)';
  const label = purpose || shotType || e.t.slice(0, 90);
  console.log(`${String(i).padStart(2)}. ${new Date(e.first*1000).toISOString().slice(5,16)}  [${String(e.runs).padStart(3)} runs] ${cls.padEnd(24)} ${String(label).replace(/\s+/g,' ').slice(0,110)}`);
}

// what does what_we_do_not_show / what_we_read hold for this scene?
console.log('\n=== the scene document fields (distinct) ===');
const fields = { purpose: new Set(), what_we_read: new Set(), what_we_do_not_show: new Set(), tone: new Set() };
for (const e of setups.values()) {
  const ss = e.o?.scene_summary; if (!ss) continue;
  for (const f of Object.keys(fields)) if (ss[f]) fields[f].add(String(ss[f]).replace(/\s+/g,' ').slice(0,180));
}
for (const [f, set] of Object.entries(fields)) {
  console.log(`\n${f}:`);
  for (const v of [...set].slice(0, 4)) console.log('  • ' + v);
}
