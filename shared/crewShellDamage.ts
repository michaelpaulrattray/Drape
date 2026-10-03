/**
 * A PRICE EATEN BY A SHELL — the one shape of it that leaves a mark (#1825).
 *
 * A shift filed card #1690 by typing its title inside a DOUBLE-quoted shell
 * string. A shell reads `$` as an instruction rather than as money, so both
 * prices in that title were expanded on the way to GitHub:
 *
 *   written    `(~$1 today, five NBP 2K views ~$0.75 of it)`
 *   landed     `(~ today, five NBP 2K views ~/usr/bin/bash.75 of it)`
 *
 * `$1` is "the first argument" and there was none, so it expanded to NOTHING.
 * `$0` is "the name of the program running", so it expanded to this machine's
 * shell — and the `.75` that followed the amount stayed welded to it.
 *
 * # ⚠ THIS FINDS THE LOUD HALF. THE SILENT HALF IS NOT FINDABLE BY ANY READER
 *
 * Measured on this machine rather than reasoned about: `$1` through `$9` expand
 * to nothing at all, and a two-digit amount loses only its first part —
 * **`$12` becomes `2` and `$24` becomes `4`**. So a card can say a top-up pack
 * costs 2 dollars when the agreed price is 12, and the sentence still reads
 * like English. **A text reader cannot find a number that was never written**,
 * and no addition to this file ever will. That is why the card this came from
 * says the PREVENTION matters more than the detection: a card is filed with
 * `--body-file`, or with its title passed through `execFileSync` with no shell,
 * or in single quotes.
 *
 * It matters on this board specifically, which is why a floor is still worth
 * having: the queue carries the spend threshold (50 dollars), the approved
 * top-up ladder (12 / 11 / 10 a pack), court costs and per-picture engine
 * prices. Money numbers in prose are this queue's house style.
 *
 * # WHAT IT LOOKS FOR, AND WHY IT IS WELDED TO A NUMBER
 *
 * A path WELDED to a number — `/usr/bin/bash.75`, `/c/Users/Admin.95` — never
 * occurs in prose and is exactly what an expansion leaves behind: the variable
 * is eaten and the digits that followed the amount are not. The looser reading
 * — any shell or home path standing in prose — was measured against the real
 * queue and REFUSED, because **the card that reports this fault names the path
 * in its own title**: *"your roadmap card read /usr/bin/bash where a price
 * belonged"*. A detector that fires on the card describing it prints the same
 * row at every shift close for ever, and a block with a permanent known-good
 * row in it is a block the next shift learns to skip. The sweep's own
 * stuck-pipeline comment states that rule about his page; it is true of a
 * shift's terminal too.
 *
 * # CODE AND QUOTED MATERIAL ARE STRIPPED FIRST, ON A PRECEDENT
 *
 * Fenced blocks, inline code spans and blockquotes come out before the test.
 * The team's quiet-entry detector already strips exactly those two for exactly
 * this reason — *"reporting on the mechanism must not trip it"* (standing
 * orders, #360) — and the measurement below is what that is worth here: the ten
 * body candidates the filing sweep found were all legitimate, and every one of
 * them was a shell transcript in a code block, a `~~strikethrough~~`, or a
 * correctly quoted file path.
 *
 * # THE POPULATION, READ RATHER THAN ASSERTED
 *
 * Over every OPEN card on 2026-10-03 — 42 titles and 42 bodies, read through
 * `gh issue list --state open --json number,title,body` and put through this
 * module's own `planShellDamage` with the loose variant run beside it. (The
 * runner was a card-named disposable and is swept; the reading is reproducible
 * from that one command, and the live half of it is the desk sweep itself,
 * which runs this reader over the open queue at every shift close.)
 *
 *   - **welded form — the shipped rule: 0.** #1690's title was repaired that
 *     morning, so a clean answer is the CORRECT answer today, and
 *     `server/crewShellDamage.test.ts` is what tells a clean reading apart from
 *     a blind one — it drives #1690's real damaged bytes as a positive control.
 *   - **loose form, measured for comparison and REFUSED: 1** — #1825's own
 *     title, which is legitimate prose about the fault. One permanent
 *     known-good row is what chose the welded rule over the loose one.
 *   - **loose form with the stripping removed: 4, across 2 fields.** So the
 *     stripping carries three of the four and the welded rule carries the last,
 *     and neither half is decoration. #1825's body quotes the damaged title in
 *     a blockquote and again in a table in backticks; all three come out.
 *
 * # THE CLASS SWEEP, AND WHY THE PREVENTION CANNOT BE A GUARD
 *
 * Working law 7 asks for the class rather than the instance, so the tree was
 * swept for every road that writes a card's title or body. **There is none.**
 * No tracked file in this repository runs `gh issue create`, and the only
 * `gh issue edit` calls — `crew-desk-sweep.mts` and `jev-card-category-file.mts`
 * — pass `--add-label` and nothing else. Both go through `execFileSync("gh",
 * args)` with an argv array, so no shell ever sees them; a grep for `execSync`,
 * `exec(` or `shell: true` around a `gh` call returns nothing in `scripts/`,
 * `server/` or `shared/`.
 *
 * ⚠ **So the damage can only enter where no suite can stand: a person or an
 * agent typing `gh issue create --title "…"` into a terminal.** A guard has
 * nothing to guard, which is exactly why this is a reader on the shift close
 * and why the report block prints the safe filing forms beside every finding
 * rather than leaving them in a document. The remainder is a FLOOR and the
 * reader is named: a grep over the three tracked source roots for the four
 * shell-mediated call shapes, 2026-10-03.
 *
 * # ⚠ IT REPORTS AND NEVER REPAIRS
 *
 * What a damaged title SHOULD say is a judgement — #1690's two numbers were
 * recovered from its own body, which had been filed separately and was intact,
 * and a different card might have nothing to recover from. A sweep that
 * rewrote a title on a guess would launder a wrong number into a confident one.
 */

/** One card, as `gh issue list --json number,title,body` answers it. */
export type ShellDamageCard = {
  readonly issueNumber: number;
  readonly title: string;
  readonly body: string;
};

/** Where the mark was found. A title and a body are repaired differently. */
export type ShellDamageField = "title" | "body";

/** One mark, with the text around it so a reader can judge without opening the card. */
export type ShellDamageFinding = {
  readonly issueNumber: number;
  readonly field: ShellDamageField;
  /** The welded run itself, e.g. `/usr/bin/bash.75`. */
  readonly matched: string;
  /** The matched run with a little prose either side, whitespace collapsed. */
  readonly excerpt: string;
};

/**
 * The shells `$0` can expand to, and the home and working directories `$HOME`,
 * `$PWD` and `$OLDPWD` can.
 *
 * ⚠ **`bash` ALONE IS DELIBERATELY ABSENT AND THAT IS A STATED HOLE.** Under
 * `bash -c` — the form a script uses — `$0` expands to the bare word `bash`,
 * measured on this machine. A bare `bash` welded to `.75` would read as damage,
 * but `bash` is also an ordinary English noun on this board, and the welded
 * rule is the only thing keeping this detector quiet enough to be read. A card
 * filed through `bash -c` with an eaten `$0.75` is therefore MISSED. The
 * prevention above is what covers it.
 */
const EXPANSION_PATHS: readonly string[] = [
  /* `$0` from an interactive shell — this machine answers `/usr/bin/bash`. */
  "/usr/bin/bash",
  "/usr/bin/sh",
  "/usr/bin/zsh",
  "/usr/bin/dash",
  "/bin/bash",
  "/bin/sh",
  "/bin/zsh",
  "/bin/dash",
  /* `$HOME`, `$PWD`, `$OLDPWD` — the MSYS, POSIX and Windows spellings of a
     home directory. The user segment is matched by the pattern, not listed. */
  "/c/Users",
  "/home",
  "/Users",
  "C:/Users",
  "C:\\Users",
];

/** `.` and `\` and friends, so a path can be dropped into a pattern literally. */
function quoteForPattern(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A path from the list above, immediately followed by a number.
 *
 * The trailing shape is `.` + digits (`$0.75` eaten) or digits alone
 * (`$0` welded to a bare amount). A path followed by a SPACE is not a finding —
 * see the docblock on why the loose reading was refused.
 */
const WELDED_SOURCE =
  `(?:${EXPANSION_PATHS.map(quoteForPattern).join("|")})`
  + `(?:[/\\\\][A-Za-z0-9._-]*)*`
  + `\\.?\\d[\\d.,]*`;

/**
 * A FRESH matcher per field, and that is the whole reason this is a function.
 *
 * ⚠ **A module-level `/g` regex carries `lastIndex` between callers**, so one
 * shared instance plus an early exit anywhere would read the first card and
 * scan every later one from a stale offset — a detector that silently examines
 * one card, whose clean run looks exactly like a correct one. The first draft
 * guarded that with a `lastIndex = 0` reset and an arm that claimed to cover
 * it; **deleting the reset left all thirteen arms green**, because `exec`
 * zeroes `lastIndex` itself on the null that ends the loop, so the line could
 * never matter and the arm proved nothing. A new object per call removes the
 * hazard instead of guarding it, and leaves no dead line for a later reader to
 * believe in.
 */
function weldedMatcher(): RegExp {
  return new RegExp(WELDED_SOURCE, "g");
}

/**
 * Markdown that is QUOTING rather than asserting: fenced blocks, inline code
 * spans, and blockquote lines.
 *
 * ⚠ **Replaced with a space rather than deleted**, so stripping cannot weld two
 * neighbours together and manufacture a match out of two innocent halves.
 */
function prose(markdown: string): string {
  return markdown
    /* Fenced blocks first — a fence may contain backticks and `>` lines. */
    .replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1[ \t]*$/gm, " ")
    /* An unterminated fence runs to the end of the body; treat the rest as code
       rather than scanning a half-open block as prose. */
    .replace(/^[ \t]*(?:`{3,}|~{3,})[\s\S]*$/m, " ")
    /* Inline spans, longest run of backticks first. */
    .replace(/(`+)[^`]*?\1/g, " ")
    /* Blockquote lines, including a nested `> >`. */
    .replace(/^[ \t]*>[ \t]?.*$/gm, " ");
}

/** The matched run with ~40 characters of prose either side, whitespace collapsed. */
function excerptAround(text: string, index: number, length: number): string {
  const from = Math.max(0, index - 40);
  const to = Math.min(text.length, index + length + 40);
  const slice = `${from > 0 ? "…" : ""}${text.slice(from, to)}${to < text.length ? "…" : ""}`;
  return slice.replace(/\s+/g, " ").trim();
}

/** Every mark in one field, scanned to the end with a matcher nobody else holds. */
function findIn(card: ShellDamageCard, field: ShellDamageField): ShellDamageFinding[] {
  const text = prose(field === "title" ? card.title : card.body);
  const matcher = weldedMatcher();
  const found: ShellDamageFinding[] = [];
  for (let hit = matcher.exec(text); hit !== null; hit = matcher.exec(text)) {
    found.push({
      issueNumber: card.issueNumber,
      field,
      matched: hit[0],
      excerpt: excerptAround(text, hit.index, hit[0].length),
    });
  }
  return found;
}

/**
 * Every mark on every card given, title before body, oldest card first.
 *
 * ⚠ **The caller owns the population and an unread one is never a clean one.**
 * This returns an empty list for an empty input, which is indistinguishable
 * from "nothing is damaged" — so a `gh` read that failed is reported as unread
 * by the caller rather than passed through here as no cards.
 */
export function planShellDamage(
  cards: readonly ShellDamageCard[],
): readonly ShellDamageFinding[] {
  const found: ShellDamageFinding[] = [];
  for (const card of [...cards].sort((a, b) => a.issueNumber - b.issueNumber)) {
    found.push(...findIn(card, "title"), ...findIn(card, "body"));
  }
  return found;
}
