/**
 * #262 item 3 — the `.dpc-signm` block is the shared MODAL SHELL's prefix, and
 * six components use it. This splits its 16,572 bytes by WHICH component names
 * each class, so the promote/stay line can be drawn at the bytes rather than
 * guessed. A class named by CastingModal.tsx alone is shell; one named only by
 * SignConfirm.tsx is sign content; one named by both is shell used by content.
 */
import { readFileSync, readdirSync } from "node:fs";

const dir = "client/src/features/castingV2/components";
const css = readFileSync("client/src/features/castingV2/castingV2.css", "utf8");
const users = new Map<string, Set<string>>(); // class -> files naming it
for (const f of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
  const src = readFileSync(`${dir}/${f}`, "utf8");
  for (const m of src.matchAll(/dpc-signm__[a-zA-Z0-9-]+|dpc-signm\b/g)) {
    if (!users.has(m[0])) users.set(m[0], new Set());
    users.get(m[0])!.add(f);
  }
}

// Attribute each .dpc-signm rule block's bytes to the set of files naming its class.
const byOwner = new Map<string, number>();
let i = 0, totalSignm = 0, unclaimed = 0;
while (i < css.length) {
  const open = css.indexOf("{", i);
  if (open === -1) break;
  const selector = css.slice(i, open);
  let depth = 1, j = open + 1;
  while (j < css.length && depth > 0) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; j++; }
  const block = css.slice(i, j);
  const m = selector.match(/\.(dpc-signm__[a-zA-Z0-9-]+|dpc-signm)\b/);
  if (m && !/^\s*@/.test(selector)) {
    const bytes = Buffer.byteLength(block, "utf8");
    totalSignm += bytes;
    const set = users.get(m[1]);
    if (!set) { unclaimed += bytes; }
    else {
      const key = [...set].sort().join(" + ");
      byOwner.set(key, (byOwner.get(key) ?? 0) + bytes);
    }
  }
  i = j;
}
console.log(`.dpc-signm total ${totalSignm} bytes; unclaimed by any component ${unclaimed}`);
console.log("");
for (const [k, b] of [...byOwner.entries()].sort((a, b2) => b2[1] - a[1])) {
  console.log(`${String(b).padStart(6)}  ${k}`);
}
process.exit(0);
