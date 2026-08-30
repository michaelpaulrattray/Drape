/**
 * #262 item 3 — how much of castingV2.css moves with a promoted component.
 * Reads the file, attributes every byte of every rule block to the FIRST
 * `.dpc-<prefix>` in its selector, and reports per prefix. Unattributed bytes
 * (comments, @media wrappers, keyframes, non-dpc selectors) are reported too,
 * because a split that silently loses them is the failure this is measuring.
 */
import { readFileSync } from "node:fs";

const css = readFileSync("client/src/features/castingV2/castingV2.css", "utf8");
const total = Buffer.byteLength(css, "utf8");

const weight = new Map<string, number>();
let attributed = 0;
// Walk top-level-ish rule blocks: selector up to `{`, then to matching `}`.
let i = 0;
while (i < css.length) {
  const open = css.indexOf("{", i);
  if (open === -1) break;
  const selector = css.slice(i, open);
  let depth = 1;
  let j = open + 1;
  while (j < css.length && depth > 0) {
    if (css[j] === "{") depth++;
    else if (css[j] === "}") depth--;
    j++;
  }
  const block = css.slice(i, j);
  const m = selector.match(/\.dpc-([a-z0-9]+)/);
  if (m && !/^\s*@/.test(selector)) {
    const key = m[1];
    weight.set(key, (weight.get(key) ?? 0) + Buffer.byteLength(block, "utf8"));
    attributed += Buffer.byteLength(block, "utf8");
  }
  i = j;
}

const rows = [...weight.entries()].sort((a, b) => b[1] - a[1]);
console.log(`total ${total} bytes; attributed to a .dpc- prefix: ${attributed} (${((attributed / total) * 100).toFixed(1)}%)`);
console.log(`unattributed: ${total - attributed} bytes (${(((total - attributed) / total) * 100).toFixed(1)}%) — comments, @media, keyframes, non-dpc selectors`);
console.log("");
for (const [k, b] of rows) console.log(`${String(b).padStart(7)}  ${((b / total) * 100).toFixed(1).padStart(5)}%  .dpc-${k}`);
process.exit(0);
