import fs from 'node:fs';

const FOLDERS = [
  { id: 'fd830c2c-3303-4cd0-bd10-53e4d37c2efc', name: 'characters', expect: 54 },
  { id: '284025b8-cf65-4c32-99b2-df06b0c31637', name: 'production', expect: 275 },
  { id: '5d8d20bc-9399-41e0-ae69-f1871ffb0a41', name: 'iterations', expect: 18673 },
];
const BASE = 'https://fnf-api-gw.higgsfield.ai/fnf/folders';
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.mkdirSync('raw', { recursive: true });

for (const f of FOLDERS) {
  const all = [];
  let cursor = null, page = 0;
  for (;;) {
    const url = `${BASE}/${f.id}/items/v2?size=100${cursor ? `&cursor=${cursor}` : ''}`;
    let res, body;
    for (let attempt = 0; attempt < 5; attempt++) {
      res = await fetch(url);
      if (res.ok) { body = await res.json(); break; }
      await sleep(1500 * (attempt + 1));
    }
    if (!body) { console.error(`FAILED ${f.name} page ${page} (last status ${res && res.status})`); process.exit(1); }
    all.push(...body.items);
    page++;
    if (page % 20 === 0) console.log(`${f.name}: page ${page}, ${all.length} items`);
    if (!body.cursor || body.items.length === 0) break;
    cursor = body.cursor;
    await sleep(120);
  }
  fs.writeFileSync(`raw/${f.name}.json`, JSON.stringify(all));
  console.log(`${f.name}: DONE ${all.length} items (folder count said ${f.expect})`);
}
