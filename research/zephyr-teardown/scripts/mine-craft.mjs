import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname.slice(1));
const txt = p => Array.isArray(p) ? p.join('\n') : (typeof p === 'string' ? p : '');
const jobs = [];
for (const f of ['raw/production.json', 'raw/iterations.json', 'raw2/special-all.json'])
  for (const it of JSON.parse(fs.readFileSync(path.join(HERE, f)))) if (it.type === 'job') jobs.push(it.job);
// distinct prompts only, keep run counts
const dp = new Map();
for (const j of jobs) { const t = txt(j.params?.prompt); if (!t) continue; const k = t.replace(/\s+/g,' ').trim(); const e = dp.get(k) || { t, runs: 0 }; e.runs++; dp.set(k, e); }
console.log('distinct prompts:', dp.size);

// TECHNIQUE FAMILIES — extract windowed specimens
const FAMS = {
  'UNSEEN SOURCE (off-frame light/sound/object acting on frame)': /[^.\n]{0,80}\b(unseen|off[- ]?frame|off[- ]?screen|never see[sn]?|not (visible|shown)|источник не виден)[^.\n]{0,110}\b(light|glow|blink|lamp|flare|shadow|reflection|beam|pulse|falls?|casts?)[^.\n]{0,60}/gi,
  'COUNTABLE EVENTS (numbered occurrences)': /[^.\n]{0,60}\b(blinks?|flashes?|flickers?|taps?|knocks?|beeps?|pulses?|bounces?|steps?|breaths?)\s+(once|twice|2|3|two|three|2–3|2-3)\b[^.\n]{0,80}/gi,
  'CAUSAL PHYSICS (because/since consequences)': /[^.\n]{0,90}\b(because|since|so that|as a result)\b[^.\n]{0,110}\b(gravity|inverted|upside|weight|hang|heat|cold|wind|wet|sweat|inertia)[^.\n]{0,50}/gi,
  'DELAYED / SECONDARY MOTION': /[^.\n]{0,70}\b(delayed|lag(s|ging)?|pendulum|settle[sd]?|residual|after[- ]?shake|inertia|whip[s]? (with|behind)|catch(es)? up)\b[^.\n]{0,100}/gi,
  'MICRO CAMERA REACTIONS (camera tied to beats)': /[^.\n]{0,70}\b(micro[- ](snap|push|jolt|zoom|drift)|snap[- ]?in on|loosen[s]? (for|to)|tightens? with|jolts? with|reframe[sd]? (up|down|with))[^.\n]{0,90}/gi,
  'GAZE CHOREOGRAPHY': /[^.\n]{0,70}\b(eyes? track(ing)?|eyeline (drift|shift|lock)|gaze (moves|shifts|drops|lifts)|looks? (up|down|off|away|toward)[^.\n]{0,30}(then|before|as)\b)[^.\n]{0,80}/gi,
  'MATERIAL/TEXTURE CALLOUTS (named weaves/grains)': /[^.\n]{0,50}\b(webbing weave|leather grain|pore[- ]level|vellus|knit texture|fabric weave|scuffed|brushed metal|grain of|stitch(es|ing)|frayed)\b[^.\n]{0,90}/gi,
  'CONTINUITY CALLBACKS (exactly the earlier X)': /[^.\n]{0,60}\b(exactly the earlier|same as (the )?(earlier|previous)|per the (earlier|established)|как (в|раньше)|matching the (earlier|established))[^.\n]{0,90}/gi,
  'ACTING CALIBRATION (NOT theatrical etc)': /[^.\n]{0,70}\b(not theatrical|no over[- ]?acting|understated|restrained|micro[- ]behaviou?r|NOT a (stiff|CG) puppet|subtle,? (not|never)|small,? (real|honest))[^.\n]{0,90}/gi,
  'EMOTION ARC IN ONE SHOT (baseline->crack)': /[^.\n]{0,80}\b(baseline|starts? (calm|neutral|flat))[^.\n]{0,90}\b(cracks?|breaks?|shifts?|flips?|gives? way|erupts?)[^.\n]{0,70}/gi,
  'WETNESS/TEMPERATURE STATES': /[^.\n]{0,60}\b(sweat[- ]?(damp|beads?|sheen|running)|rain[- ]?(soaked|wet)|damp (hair|skin|fabric)|steam(ing)? (off|rises)|breath (fogs?|visible)|condensation)\b[^.\n]{0,90}/gi,
  'FRAME EXCLUSIVITY (only X enters frame)': /[^.\n]{0,60}\b(only (her|his|their) own (hands?|arms?)|no other (people|characters|hands)|alone in (the )?frame|nobody else)[^.\n]{0,80}/gi,
  'SOUND-PER-BEAT MAPPING': /[^.\n]{0,50}\b(a (soft|firm|faint|dull|sharp) [a-z-]+ (click|beep|thud|creak|hiss|clack|snap|rattle))[^.\n]{0,80}/gi,
  'DIRECTED IMPERFECTION': /[^.\n]{0,70}\b(a (little|bit) off([- ]key)?|imperfect(ly)?|clumsy|slightly (wrong|late|early|missed)|off[- ]balance|not (clean|polished|perfect))\b[^.\n]{0,90}/gi,
  'LOCKS / FINAL RECAP BLOCK': /LOCKS\s*[—-]/gi,
};
const out = [];
for (const [fam, re] of Object.entries(FAMS)) {
  const specimens = new Map();
  for (const { t, runs } of dp.values()) {
    for (const m of t.replace(/\s+/g, ' ').matchAll(re)) {
      const s = m[0].trim();
      if (s.length < 25) continue;
      const e = specimens.get(s.toLowerCase()) || { s, runs: 0 };
      e.runs += runs; specimens.set(s.toLowerCase(), e);
    }
  }
  const top = [...specimens.values()].sort((a, b) => b.runs - a.runs);
  out.push(`\n## ${fam}  (${specimens.size} distinct specimens)\n`);
  for (const x of top.slice(0, 16)) out.push(`- [${x.runs}] ${x.s.slice(0, 210)}`);
  console.log(fam.split(' (')[0].padEnd(46), specimens.size);
}
fs.writeFileSync(path.join(HERE, 'craft-specimens.md'), out.join('\n'));
console.log('\nwrote craft-specimens.md');
