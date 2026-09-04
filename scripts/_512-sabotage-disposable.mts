/**
 * DISPOSABLE (#512) — sabotage sweep over the design-law controls.
 *
 * Thirteen controls went green on their first run, which is exactly what a
 * vacuous instrument looks like. This breaks ONE reading inside `designLaws.mts`
 * at a time and asserts that precisely the controls aimed at that reading go
 * MISS, and no others. An arm that stays green under its own sabotage is
 * testing nothing; an arm that reddens under someone else's is not independent.
 *
 * Restores in `finally` and verifies the bytes at both ends (sha256), because a
 * driver that dies mid-sabotage leaves the tree sabotaged.
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const TARGET = path.resolve("scripts/lib/designLaws.mts");

type Sabotage = { name: string; edits: [string, string][]; expect: string[] };

/** `expect` holds the `breaks` line of every control that MUST go MISS. */
const SABOTAGES: Sabotage[] = [
  {
    /* BOTH outline-drawn offenders, and that is correct rather than a leak:
       the plain field and the search box break the law by the same road, so one
       reading holds them both. The search box's INDEPENDENCE is proven by the
       text-entry-population sabotage below, which fells it alone. */
    name: "law 1 — the outline reading",
    edits: [['const outlined = result.outlineStyle !== "none" && result.outlineWidth !== "0px";', "const outlined = false;"]],
    expect: [
      "a text field that draws a ring around its own text on focus",
      "a staff table search box — input[type=search] — wearing the accent ring",
    ],
  },
  {
    name: "law 1 — the box-shadow reading",
    edits: [["const shadowed = Boolean(result.boxShadow);", "const shadowed = false;"]],
    expect: ["a text field whose focus ring is a box-shadow rather than an outline"],
  },
  {
    /* The regression this card found: the selector back to an allow-list. Only
       the search-box arm may notice — the other two focus-ring offenders use a
       bare text input, which the old selector matched. */
    name: "law 1 — the text-entry population (back to the old allow-list)",
    edits: [
      [
        'export const TEXT_ENTRY_SELECTOR = [\n  "textarea",\n  `input${CONTROL_INPUT_TYPES.map((t) => `:not([type="${t}"])`).join("")}`,\n].join(", ");',
        'export const TEXT_ENTRY_SELECTOR = ".dp-input, input[type=text], input:not([type]), textarea";',
      ],
    ],
    expect: ["a staff table search box — input[type=search] — wearing the accent ring"],
  },
  {
    name: "law 2 — the dock is on screen at load",
    edits: [["    atLoad.onScreen,\n", "    true,\n"]],
    expect: ["a dock below the fold at load, which scrolling then brings into view"],
  },
  {
    name: "law 2 — the dock is still on screen at the bottom",
    edits: [["      atBottom.onScreen,\n", "      true,\n"]],
    expect: ["a dock on screen at load that scrolls away and is gone at the page bottom"],
  },
  {
    name: "the existential rule — a required subject that is absent",
    edits: [["if (requires?.includes(subject)) {", "if (false) {"]],
    expect: [
      "a surface that declares it holds a dock, and holds none",
      "a surface that declares it shows unsigned sheets, and shows none",
    ],
  },
  {
    name: "law 3 — the mono detection",
    edits: [['if (font.includes("mono")) bad.push(text.slice(0, 70));', "if (false) bad.push(text.slice(0, 70));"]],
    expect: ["a sentence of prose set in a monospace face"],
  },
  {
    /* Both paid offenders go uncaught, and correctly: "Cast it" and "Sign them"
       break the law by the same road. The Sign boundary's INDEPENDENCE is the
       next sabotage, which fells it alone. */
    name: "law 4 — the price detection",
    edits: [["if (!/\\d+\\s*cr\\b/i.test(label)) bad.push(label);", "if (false) bad.push(label);"]],
    expect: [
      "a paid button whose label does not carry its price",
      "the Sign boundary — a paid Sign with no price, beside Signed/sign-in/sign-out, which are not paid",
    ],
  },
  {
    /* The reviewer's finding on #522 restored: `sign\b` swallows "Sign in",
       "Sign in with Email", "Sign out" and "Sign up". Only the boundary
       control's COMPLIANT arm can notice, which is why that arm exists. */
    name: "law 4 — the Sign boundary (back to bare /^sign\\b/i)",
    edits: [["/^sign\\b(?!\\s*(in|out|up)\\b)/i", "/^sign\\b/i"]],
    expect: ["the Sign boundary — a paid Sign with no price, beside Signed/sign-in/sign-out, which are not paid"],
  },
  {
    /* The regression the FIRST repair introduced, pinned: dropping the word
       boundary for the lookahead made "Signed" — the roster filter pill — read
       as an unpriced paid button on two surfaces. Only the compliant arm can
       see this, which is what compliant arms are for. */
    name: "law 4 — the Sign boundary (boundary dropped, the way it broke)",
    edits: [["/^sign\\b(?!\\s*(in|out|up)\\b)/i", "/^sign(?!\\s*(in|out|up)\\b)/i"]],
    expect: ["the Sign boundary — a paid Sign with no price, beside Signed/sign-in/sign-out, which are not paid"],
  },
  {
    /* The regression a "faster" law 5 introduced: without the wait on a surface
       that CAN render the section, a late-arriving one reads as absent and the
       law reports not applicable on a page it had been passing. */
    name: "law 5 — the wait on a surface that may hold the section",
    edits: [
      [
        'const canRender = requires?.includes("retentionCopy") || mayHold?.includes("retentionCopy");',
        "const canRender = false;",
      ],
    ],
    expect: ["an unsigned-sheets section that arrives with a query and never says when the sheets expire"],
  },
  {
    /* Both retention offenders omit the expiry copy — the immediate one and the
       late one — so one reading holds them both, which is correct rather than a
       leak. The late arm's INDEPENDENCE is the wait sabotage above, which fells
       it alone. */
    name: "law 5 — the expiry-copy reading",
    edits: [["return /7 quiet days/i.test(text);", "return true;"]],
    expect: [
      "an unsigned-sheets section that never says when the sheets expire",
      "an unsigned-sheets section that arrives with a query and never says when the sheets expire",
    ],
  },
  {
    name: "law 6 — skeletons under failure copy",
    edits: [["    !(result.skeletons > 0 && result.hasFailureCopy),", "    true,"]],
    expect: ["loading skeletons sitting under copy that says the roll already failed"],
  },
  {
    name: "law 7 — the dark-glass reading",
    edits: [["light: r > 140 && g > 140 && b > 140,", "light: false,"]],
    expect: ["a translucent-WHITE over-media chip (the 2.5:1 fill), correctly named and reachable"],
  },
  {
    name: "law 7 — the reachability reading",
    edits: [
      [
        "const unreachable = result.filter((chip) => !chip.focusable || chip.label.length === 0);",
        "const unreachable = result.filter(() => false);",
      ],
    ],
    expect: ["a correctly dark over-media chip that is unnamed and out of the tab order"],
  },
  {
    name: "law 8 — the chip-clothing reading",
    edits: [
      [
        'return (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") || own.borderTopWidth !== "0px";',
        "return false;",
      ],
    ],
    expect: ["echo facts wearing chip clothing — a background and a border instead of an underline"],
  },
  {
    name: "law 8 — the clipping-ancestor reading",
    edits: [["clippedBy = node.className || node.tagName;", 'clippedBy = "none";']],
    expect: ["a popover whose box escapes the sentence's overflow, with every option still inside it"],
  },
  {
    name: "law 8 — the painted-option count",
    edits: [
      [
        "return r.height > 0 && r.top >= clip.top - 1 && r.bottom <= clip.bottom + 1;",
        "return r.height > 0;",
      ],
    ],
    expect: ["a popover pushed below the fold: every option in the DOM, none of them on screen"],
  },
];

function sha(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/** Run the controls in a FRESH process and return the `breaks` lines that missed. */
function missedControls(): { missed: string[]; total: number } {
  let out = "";
  try {
    out = execFileSync("npx", ["tsx", "scripts/drive-design-laws.mts", "--controls"], {
      encoding: "utf8",
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    /* Exit 1 is the expected outcome of a sabotaged run — the output is on the
       error object, and reading it is the whole point. */
    out = String((error as { stdout?: string }).stdout ?? "");
  }
  const missed = [...out.matchAll(/^ {2}MISS \S+ — (.+)$/gm)].map((m) => m[1].trim());
  const total = Number(/(\d+) control\(s\)/.exec(out)?.[1] ?? 0);
  if (total === 0) throw new Error(`controls run produced no control count. Output:\n${out}`);
  return { missed, total };
}

/*
  Anchors are written with \n, and a tool that rewrites this file on Windows can
  leave it CRLF — at which point every multi-line anchor stops matching and the
  sweep dies mid-run rather than reporting a miss. So matching and patching
  happen on a normalised copy; the RESTORE writes the original bytes back, so
  the sha check at both ends still compares like with like.
*/
const originalRaw = fs.readFileSync(TARGET, "utf8");
const original = originalRaw.replace(/\r\n/g, "\n");
const originalHash = sha(originalRaw);
console.log(`target ${TARGET}\nsha256(head) ${originalHash}\n`);

let caught = 0;
let missedByTheSweep = 0;

try {
  const clean = missedControls();
  console.log(`clean tree: ${clean.total} control(s), ${clean.missed.length} miss(es)`);
  if (clean.missed.length !== 0) {
    console.log("  REFUSING: the clean-tree control is not green, so no sabotage verdict means anything.");
    for (const m of clean.missed) console.log(`    · ${m}`);
    process.exit(1);
  }

  for (const sabotage of SABOTAGES) {
    let patched = original;
    for (const [from, to] of sabotage.edits) {
      if (!patched.includes(from)) {
        throw new Error(`anchor not found for "${sabotage.name}":\n  ${from}`);
      }
      const before = patched;
      patched = patched.replace(from, to);
      if (patched === before) throw new Error(`replacement was a no-op for "${sabotage.name}"`);
    }
    fs.writeFileSync(TARGET, patched, "utf8");

    const { missed } = missedControls();
    const expected = new Set(sabotage.expect);
    const got = new Set(missed);
    const missing = [...expected].filter((e) => !got.has(e));
    const extra = [...got].filter((g) => !expected.has(g));
    const ok = missing.length === 0 && extra.length === 0;
    if (ok) caught += 1;
    else missedByTheSweep += 1;

    console.log(`${ok ? "  ok  " : "  BAD "} ${sabotage.name} — ${missed.length} miss(es)`);
    for (const m of missing) console.log(`        NOT caught (arm is inert): ${m}`);
    for (const e of extra) console.log(`        also reddened (arm not independent): ${e}`);
  }
} finally {
  /* The ORIGINAL bytes, not the normalised copy the patches were built from —
     on a CRLF tree those differ, and restoring the copy would leave every line
     of the file rewritten by a driver that is supposed to leave no trace. */
  fs.writeFileSync(TARGET, originalRaw, "utf8");
  const restored = fs.readFileSync(TARGET, "utf8");
  console.log(`\nrestored: sha256(head) ${sha(restored)} ${sha(restored) === originalHash ? "= original" : "!= ORIGINAL"}`);
}

console.log(`\n${caught} sabotage(s) behaved exactly, ${missedByTheSweep} did not.`);
process.exit(missedByTheSweep === 0 ? 0 : 1);
