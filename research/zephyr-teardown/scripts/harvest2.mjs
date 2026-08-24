import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname.slice(1));
const OUT = path.join(HERE, 'raw2');
fs.mkdirSync(OUT, { recursive: true });

const FOLDERS = [
  { id: '03f15fb6-c85c-427d-b030-c509b967d4ba', name: 'special-all', sub: true, expect: 4838 },
  { id: 'e80a9c8b-c7ea-47a1-8661-65e7352f6dcb', name: 'special-regenerations', sub: false, expect: 90 },
];
const BASE = 'https://fnf-api-gw.higgsfield.ai/fnf/folders';
const sleep = ms => new Promise(r => setTimeout(r, ms));

for (const f of FOLDERS) {
  const all = []; let cursor = null, page = 0;
  for (;;) {
    const url = `${BASE}/${f.id}/items/v2?size=100${f.sub ? '&include_subfolders=true' : ''}${cursor ? `&cursor=${cursor}` : ''}`;
    let res, body;
    for (let a = 0; a < 5; a++) {
      res = await fetch(url);
      if (res.ok) { body = await res.json(); break; }
      await sleep(1500 * (a + 1));
    }
    if (!body) { console.error(`FAILED ${f.name} page ${page}`); process.exit(1); }
    all.push(...body.items);
    page++;
    if (page % 20 === 0) console.log(`${f.name}: page ${page}, ${all.length}`);
    if (!body.cursor || !body.items.length) break;
    cursor = body.cursor;
    await sleep(120);
  }
  fs.writeFileSync(path.join(OUT, `${f.name}.json`), JSON.stringify(all));
  console.log(`${f.name}: DONE ${all.length} (folder said ${f.expect})`);
}
