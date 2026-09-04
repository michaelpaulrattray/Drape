/**
 * THE SHIFT DIGEST — what a shift reads instead of the book (#510).
 *
 * Founder-ordered 2026-09-04 (terminal), verbatim: *"id like to file everything
 * as its all important."* His context in the same sitting: *"we are in the
 * process of still designing iterating and building our SaaS we have many more
 * features planned before launch and design work to go through."*
 *
 * # The measurement that filed it
 *
 * A shift reads ~294 KB before it may change a line — `CLAUDE.md` 84 KB,
 * `PROGRAM.md` 53 KB, `prompt.md` 48 KB, `FEATURE_FLAGS.md` 116 KB — at 12–26
 * shifts a day, paid before the card is even chosen. The law-file split (#330)
 * cut it by a third; this is the next step, and it changes what is READ, never
 * what is written.
 *
 * # ⚠ WHAT IS HONESTLY SAVEABLE, WHICH IS NOT THE 294 KB THE CARD COUNTS
 *
 * `CLAUDE.md` is loaded by the harness as project instructions before a shift
 * takes its first breath. No generator can stop that, and pretending otherwise
 * would put a false number on his page. **The saveable population is
 * `PROGRAM.md` + `FEATURE_FLAGS.md` — 169 KB** — and the digest's own footer
 * quotes both numbers so the claim is checkable rather than asserted.
 * `CLAUDE.md` is still INDEXED here, because the on-demand half (below) answers
 * *"which law section covers the file I am about to touch"*, which is a
 * different question from *"was it in context"*.
 *
 * # The two halves
 *
 * **1 · The state.** The standing orders' step list (headings only), the
 * PROGRAM's law sections, the queue's NEXT UP band, the patrol clocks, and what
 * changed since the previous shift. Derived every time, never hand-typed.
 *
 * **2 · Law on demand, by section.** A card names the paths and flags it
 * touches; the digest carries only the law sections that name those paths or
 * flags. The index is MECHANICAL — headings and flag bullets read out of the
 * law surfaces themselves (`LAW_SURFACES`, declared once in `lawText.mts`), not
 * a table anybody maintains. Working law 4: derive, never mirror.
 *
 * # What the PROGRAM keeps in full, and why the rule is a heading match
 *
 * A section whose heading names a LAW, a GATE, a RULE, a MODE, the focus, the
 * exceptions or the parked list is carried VERBATIM however long it is. Every
 * other section — the mission, the governing-plan pointers, the design north
 * star, the lane narratives — is NAMED with its line range instead.
 *
 * The failure direction is deliberate and is the whole reason it is a heading
 * match rather than a curated list: **a new section nobody classified is
 * NAMED, never dropped**, so the worst case is a shift opening the file, and
 * the best case is it never has to. A truncated law would be the unacceptable
 * shape, so nothing here truncates a section: it is in full or it is a pointer.
 *
 * # It refuses rather than coming up short
 *
 * Every collector here throws on an empty answer (CLAUDE.md's collector class):
 * a law surface with no sections, a `--paths` money/auth request that cannot
 * find the access-control section, a PROGRAM with no `Current focus`. A digest
 * that quietly omits a law reads exactly like a law that does not exist — and
 * the reader is on the path every shift takes, so a silent omission would
 * propagate to every card worked afterwards.
 *
 * ⚠ **An UNREADABLE input is never rendered as an EMPTY one.** A `gh` that is
 * not authenticated prints nothing, and nothing looks exactly like an empty
 * queue — the same trap #504 names on the park gate. Every read that can fail
 * carries its failure into the digest as a named line the shift can act on.
 */

/** A heading- or bullet-delimited chunk of a law surface. */
export type Section = {
  /** The surface it came from, repo-relative: `CLAUDE.md`. */
  readonly surface: string;
  /** The heading text without its `#` marks, or the flag name for a flag entry. */
  readonly heading: string;
  /** 2 for `##`, 3 for `###`; 0 for a flag bullet entry. */
  readonly level: number;
  /** 1-indexed first line of the section, the heading line itself. */
  readonly startLine: number;
  /** 1-indexed last line. */
  readonly endLine: number;
  /** The section verbatim, heading line included. */
  readonly text: string;
};

/**
 * A flag entry in the catalogue is a BULLET, not a heading — measured at the
 * file: `docs/architecture/FEATURE_FLAGS.md` has exactly one `##` and one
 * `###`, and its 30-odd flag entries all live under them as
 * `- `FLAG_NAME` — …`. Splitting on headings alone would hand a lobby card the
 * entire casting catalogue as one section, which is the bar this card sets.
 */
const FLAG_BULLET = /^- {1,3}`([A-Z][A-Z0-9_]{3,})`/;

const HEADING = /^(#{1,6}) +(.*\S)\s*$/;

/**
 * A PROGRAM section carried VERBATIM rather than named — a vocabulary of the
 * words a heading uses when it is stating a RULE.
 *
 * ⚠ **PROVENANCE WORDS ARE DELIBERATELY ABSENT, and that is the correction the
 * first run bought.** `founder-ordered` and `founder-authorised` appear in the
 * headings of the two longest NARRATIVE sections in the file — the lobby lane
 * (72 lines) and the run order after section 02 (189 lines), both of them
 * history rather than law — so matching on them carried 261 lines of finished
 * work and left the digest at 48 KB against a 165 KB source. Who said a thing
 * does not make the section a law; what the heading NAMES does.
 *
 * The two that would otherwise fall out of the vocabulary are in it by their own
 * nouns: `clause` (the founder-ordered-work clause, which is a standing rule)
 * and `review` (the milestone-close review, which is a procedure a closing shift
 * must run).
 */
const LAW_HEADING =
  /\b(law|laws|gate|rule|rules|clause|mode|focus|exception|exceptions|parked|threshold|invariant|invariants|contract|discipline|protocol|review|access control)\b/i;

/**
 * A path whose law is never optional — matched on the path's own WORDS, never
 * as a substring.
 *
 * ⚠ **The substring version called `server/casting/promptAuthor.ts` a money
 * path**, because `auth` lives inside `Author`. That is the noisy direction of
 * the same mistake the quiet direction makes: a rule that fires on everything
 * teaches a shift to skim §5, and a §5 that gets skimmed is where the
 * access-control section it exists to deliver goes unread. The path is split on
 * `/ . - _` and at camel-case humps, and a WORD must match.
 */
const MONEY_AUTH_WORDS = new Set([
  "billing",
  "bill",
  "credit",
  "credits",
  "stripe",
  "payment",
  "payments",
  "invoice",
  "invoices",
  "subscription",
  "subscriptions",
  "checkout",
  "refund",
  "refunds",
  "auth",
  "session",
  "sessions",
  "password",
  "oauth",
  "token",
  "tokens",
  "cookie",
  "cookies",
  "webhook",
  "webhooks",
  "admin",
  "moderator",
  "security",
  "ledger",
]);

export function pathWords(requested: string): string[] {
  return requested
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.toLowerCase());
}

/** The CLAUDE.md section a money/auth path always receives, matched by heading. */
const ACCESS_CONTROL_HEADING = /access control/i;

/** A read that failed, carried into the digest instead of being rendered as empty. */
export type Unreadable = { readonly unreadable: string };

export function isUnreadable(value: unknown): value is Unreadable {
  return typeof value === "object" && value !== null && "unreadable" in value;
}

export class DigestRefusal extends Error {}

/**
 * Split a markdown surface into sections: every heading starts one, and inside
 * the flag catalogue every flag bullet starts one too.
 *
 * A flag entry is nested INSIDE its heading section, so both are emitted — the
 * heading section keeps its own text (which holds the catalogue's own reading
 * rules) and each flag entry is separately addressable. A caller selecting by
 * flag gets the entry; a caller selecting by path gets whichever names the path.
 */
export function splitSections(surface: string, text: string): Section[] {
  const lines = text.split(/\r?\n/);
  const sections: Section[] = [];

  type Open = { heading: string; level: number; startLine: number };
  const openHeadings: Open[] = [];
  let openFlag: Open | null = null;

  const close = (open: Open, endLine: number) => {
    sections.push({
      surface,
      heading: open.heading,
      level: open.level,
      startLine: open.startLine,
      endLine,
      text: lines.slice(open.startLine - 1, endLine).join("\n"),
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    const headingMatch = HEADING.exec(line);
    const flagMatch = FLAG_BULLET.exec(line);

    if (headingMatch) {
      const level = headingMatch[1].length;
      if (openFlag) {
        close(openFlag, lineNumber - 1);
        openFlag = null;
      }
      while (openHeadings.length > 0 && openHeadings[openHeadings.length - 1].level >= level) {
        close(openHeadings.pop() as Open, lineNumber - 1);
      }
      openHeadings.push({ heading: headingMatch[2], level, startLine: lineNumber });
      continue;
    }

    if (flagMatch) {
      if (openFlag) close(openFlag, lineNumber - 1);
      openFlag = { heading: flagMatch[1], level: 0, startLine: lineNumber };
    }
  }

  if (openFlag) close(openFlag, lines.length);
  while (openHeadings.length > 0) close(openHeadings.pop() as Open, lines.length);

  sections.sort((a, b) => a.startLine - b.startLine || a.level - b.level);
  if (sections.length === 0) {
    throw new DigestRefusal(`${surface} yielded no sections — a law surface that reads as empty is a refusal, not a short list`);
  }
  return sections;
}

/**
 * Every repo-relative path a section names.
 *
 * `roots` is the repository's own top-level directory list, passed in by the
 * caller from the file system rather than hard-coded — a constant list of roots
 * is the mirror that stops matching the day a directory is added.
 */
export function mentionedPaths(sectionText: string, roots: readonly string[]): string[] {
  const found = new Set<string>();
  /* ⚠ THE BACKTICK MUST BE AN ACCEPTABLE PRECEDING CHARACTER, and leaving it out
     of this class was a real defect caught by driving the reader rather than
     reading it: almost every path in these documents is written as
     `server/routes/billing.ts`, so a boundary that refused a leading backtick
     found nothing at all. The money/auth arm still fired, which is exactly how
     it would have shipped — the bar the card names passed while the general
     path index was inert. */
  const candidate = /(?:^|[^A-Za-z0-9_./-])((?:\.?[A-Za-z0-9_@-]+\/)+[A-Za-z0-9_.*-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = candidate.exec(sectionText)) !== null) {
    const raw = match[1];
    const root = raw.split("/")[0];
    if (!roots.includes(root)) continue;
    found.add(raw.replace(/[.,;:)]+$/, ""));
  }
  return [...found];
}

/** Every flag-shaped name a section states. */
export function mentionedFlags(sectionText: string): string[] {
  const found = new Set<string>();
  const candidate = /\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+){1,6})\b/g;
  let match: RegExpExecArray | null;
  while ((match = candidate.exec(sectionText)) !== null) found.add(match[1]);
  return [...found];
}

const normalise = (value: string) => value.replace(/\\/g, "/").replace(/\/+$/, "");

/**
 * Does a mentioned path cover a requested one?
 *
 * Three ways, and each is a real reading: the same file; the mention is a
 * DIRECTORY the request lives under (`server/routes/` covers
 * `server/routes/billing.ts`); the mention is a file INSIDE a requested
 * directory (`server/casting/x.ts` answers a request for `server/casting`).
 */
export function pathCovers(mention: string, requested: string): boolean {
  const a = normalise(mention);
  const b = normalise(requested);
  if (a === b) return true;
  /* ⚠ A WHOLE TOP-LEVEL DIRECTORY IS NOT A CITATION OF YOUR FILE. Measured:
     `CLAUDE.md`'s Atlas section says `client/`, so before this rule every card
     touching anything under `client/` inherited it — and a §5 that answers every
     question the same way is a §5 nobody reads, which is how an on-demand law
     stops being read at all. Either side must name at least two segments to
     cover the other by prefix; an exact match always counts. */
  const segments = (value: string) => value.split("/").filter(Boolean).length;
  if (b.startsWith(`${a}/`)) return segments(a) >= 2;
  if (a.startsWith(`${b}/`)) return segments(b) >= 2;
  return false;
}

export function isMoneyAuthPath(requested: string): boolean {
  return pathWords(requested).some((word) => MONEY_AUTH_WORDS.has(word));
}

export type LawRequest = {
  readonly paths: readonly string[];
  readonly flags: readonly string[];
};

export type LawSelection = {
  readonly section: Section;
  /** Why it is here, printed beside the heading so a shift can judge the match. */
  readonly because: string;
};

/**
 * The law sections a card's paths and flags call for.
 *
 * ⚠ **The money/auth arm is unconditional and REFUSES if it cannot be served.**
 * The access-control section is selected by heading; if no law surface has one,
 * that is a refusal rather than a short list — an absent section and an
 * unmatched one are indistinguishable to a shift reading the output, and this
 * is the arm protecting the surfaces the standing orders will not let a shift
 * guess about.
 */
export function selectLawSections(
  surfaces: readonly { readonly path: string; readonly text: string }[],
  request: LawRequest,
  roots: readonly string[],
): LawSelection[] {
  const all = surfaces.flatMap((surface) => splitSections(surface.path, surface.text));
  const chosen = new Map<string, LawSelection>();
  const key = (section: Section) => `${section.surface}:${section.startLine}`;

  const add = (section: Section, because: string) => {
    const existing = chosen.get(key(section));
    if (existing) {
      if (!existing.because.includes(because)) {
        chosen.set(key(section), { section, because: `${existing.because}; ${because}` });
      }
      return;
    }
    chosen.set(key(section), { section, because });
  };

  for (const section of all) {
    /* A heading section that CONTAINS flag entries is not itself selected by a
       path its entries mention — that is how a lobby card would inherit the
       whole casting catalogue. Its entries are separately addressable. */
    const holdsEntries = all.some(
      (other) =>
        other.level === 0 &&
        other.surface === section.surface &&
        other.startLine > section.startLine &&
        other.endLine <= section.endLine,
    );
    if (holdsEntries) continue;

    const paths = mentionedPaths(section.text, roots);
    for (const requested of request.paths) {
      if (paths.some((mention) => pathCovers(mention, requested))) {
        add(section, `names ${requested}`);
      }
    }
    if (section.level === 0) {
      if (request.flags.includes(section.heading)) add(section, `is ${section.heading}`);
    } else {
      const flags = mentionedFlags(section.text);
      for (const flag of request.flags) {
        if (flags.includes(flag)) add(section, `names ${flag}`);
      }
    }
  }

  const moneyAuth = request.paths.filter(isMoneyAuthPath);
  if (moneyAuth.length > 0) {
    const accessControl = all.filter(
      (section) => section.level === 2 && ACCESS_CONTROL_HEADING.test(section.heading),
    );
    if (accessControl.length === 0) {
      throw new DigestRefusal(
        `a money/auth path was named (${moneyAuth.join(", ")}) and no law surface has an "access control" section — refusing rather than handing back a digest that silently drops it`,
      );
    }
    for (const section of accessControl) {
      add(section, `money/auth path ${moneyAuth[0]} — carried in full, unconditionally`);
    }
  }

  return [...chosen.values()].sort(
    (a, b) =>
      a.section.surface.localeCompare(b.section.surface) || a.section.startLine - b.section.startLine,
  );
}

/** How the PROGRAM's sections are treated: carried verbatim, or named. */
export type ProgramSplit = {
  readonly carried: Section[];
  readonly named: Section[];
};

/** Where the PROGRAM lives, named once so the digest's pointers cannot drift. */
export const PROGRAM_PATH = ".agents/foreman/PROGRAM.md";

export function splitProgram(programMd: string): ProgramSplit {
  const sections = splitSections(PROGRAM_PATH, programMd).filter(
    (section) => section.level === 2,
  );
  if (sections.length === 0) {
    throw new DigestRefusal("PROGRAM.md yielded no `##` sections — refusing rather than printing a digest with no program in it");
  }
  const carried = sections.filter((section) => LAW_HEADING.test(section.heading));
  if (!carried.some((section) => /current focus/i.test(section.heading))) {
    throw new DigestRefusal(
      "PROGRAM.md has no `Current focus` section — that block decides what a shift may cut, and a digest without it is worse than no digest",
    );
  }
  const named = sections.filter((section) => !carried.includes(section));
  /* THE INVARIANT THAT MAKES THE HEADING VOCABULARY SAFE, asserted rather than
     promised: every section is carried or named, so the worst a word the
     vocabulary has never heard of can do is cost a shift one file-open. A
     section that fell out of BOTH lists would be a law that silently ceased to
     exist for every shift after it — which is the one failure this generator
     must not be able to have. */
  if (carried.length + named.length !== sections.length) {
    throw new DigestRefusal(
      `the PROGRAM split lost a section: ${sections.length} read, ${carried.length} carried, ${named.length} named`,
    );
  }
  return { carried, named };
}

export type NextUpRow = {
  readonly number: number;
  readonly title: string;
  readonly labels: readonly string[];
  readonly createdAt: string;
};

export type DigestInputs = {
  readonly now: Date;
  /** The standing orders, for their step headings only. */
  readonly promptMd: string | Unreadable;
  readonly programMd: string;
  readonly lawSurfaces: readonly { readonly path: string; readonly text: string }[];
  readonly roots: readonly string[];
  readonly nextUp: NextUpRow[] | Unreadable;
  /** `patrol-clocks.mts`'s own output, embedded rather than reimplemented. */
  readonly patrolClocks: string | Unreadable;
  readonly since: { readonly label: string; readonly iso: string } | Unreadable;
  readonly commits: string[] | Unreadable;
  readonly closedCards: string[] | Unreadable;
  readonly request: LawRequest;
  /** Byte sizes of the sources this digest stands in for, for the footer. */
  readonly sourceBytes: readonly { readonly path: string; readonly bytes: number }[];
};

const line = (label: string, value: string | Unreadable): string =>
  isUnreadable(value) ? `${label}: UNREADABLE — ${value.unreadable}` : `${label}: ${value}`;

/** The step list: the standing orders' own headings, nothing else. */
function stepList(promptMd: string | Unreadable): string {
  if (isUnreadable(promptMd)) return `UNREADABLE — ${promptMd.unreadable}`;
  const steps = promptMd
    .split(/\r?\n/)
    .filter((row) => /^## /.test(row))
    .map((row) => `  ${row.replace(/^## /, "")}`);
  if (steps.length === 0) {
    throw new DigestRefusal("the standing orders yielded no `##` steps — refusing rather than printing a digest with no step list");
  }
  return `\n${steps.join("\n")}`;
}

export function buildDigest(inputs: DigestInputs): string {
  const out: string[] = [];
  const stamp = inputs.now.toISOString().replace("T", " ").slice(0, 16);
  const program = splitProgram(inputs.programMd);

  out.push("# THE SHIFT DIGEST — read this instead of the book (#510)");
  out.push("");
  out.push(
    `Generated ${stamp} UTC, every line derived. It replaces READING \`PROGRAM.md\` and`,
  );
  out.push(
    "`FEATURE_FLAGS.md` end to end; both are still on disk and named beside every section that",
  );
  out.push("is summarised rather than carried. Nothing here is hand-typed, and nothing is truncated:");
  out.push("a section is present in full or it is a pointer with its line range.");
  out.push("");

  out.push("## 1 · YOUR STEPS — the standing orders' own headings");
  out.push(stepList(inputs.promptMd));
  out.push("");
  out.push(
    "The orders themselves are on stdin above/below this digest; this list is here so you can see the",
  );
  out.push("shape of the shift without re-reading them.");
  out.push("");

  out.push("## 2 · THE QUEUE AND THE CLOCKS");
  out.push("");
  if (isUnreadable(inputs.nextUp)) {
    out.push(`NEXT UP: UNREADABLE — ${inputs.nextUp.unreadable}`);
    out.push(
      "⚠ Read it yourself before you decide anything: `gh issue list --label founder-ordered --state open`.",
    );
    out.push("An unreadable queue is NOT an empty one, and it does not open the one-quiet-shift road (#504).");
  } else if (inputs.nextUp.length === 0) {
    out.push("NEXT UP: EMPTY — no open `founder-ordered` card.");
  } else {
    out.push(`NEXT UP: ${inputs.nextUp.length} open \`founder-ordered\` card(s), oldest first:`);
    for (const row of [...inputs.nextUp].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const labels = row.labels.filter((label) => label !== "founder-ordered");
      out.push(
        `  #${row.number}  ${row.createdAt.slice(0, 10)}  ${row.title}${labels.length > 0 ? `  [${labels.join(", ")}]` : ""}`,
      );
    }
  }
  out.push("");
  out.push("PATROL CLOCKS:");
  out.push(
    isUnreadable(inputs.patrolClocks)
      ? `  UNREADABLE — ${inputs.patrolClocks.unreadable} · run \`npx tsx scripts/patrol-clocks.mts\``
      : inputs.patrolClocks
          .split(/\r?\n/)
          .map((row) => `  ${row}`)
          .join("\n"),
  );
  out.push("");
  out.push(
    "⚠ HIS SWITCHES ARE NOT IN HERE AND CANNOT BE: they are a production database row, and this",
  );
  out.push(
    "generator touches no database and no network beyond `gh`. The shift-start sequence still runs",
  );
  out.push(
    "`crew-work-switches.mts` (read), `crew-count-queue.mts` (write) and the card-intents reader itself.",
  );
  out.push("");

  out.push("## 3 · WHAT CHANGED SINCE THE LAST SHIFT");
  out.push("");
  out.push(line("Previous entry", isUnreadable(inputs.since) ? inputs.since : `${inputs.since.label} (${inputs.since.iso})`));
  out.push("");
  out.push("Commits on main since then:");
  if (isUnreadable(inputs.commits)) {
    out.push(`  UNREADABLE — ${inputs.commits.unreadable}`);
  } else if (inputs.commits.length === 0) {
    out.push("  none");
  } else {
    for (const commit of inputs.commits) out.push(`  ${commit}`);
  }
  out.push("");
  out.push("Cards closed since then:");
  if (isUnreadable(inputs.closedCards)) {
    out.push(`  UNREADABLE — ${inputs.closedCards.unreadable}`);
  } else if (inputs.closedCards.length === 0) {
    out.push("  none");
  } else {
    for (const card of inputs.closedCards) out.push(`  ${card}`);
  }
  out.push("");
  out.push(
    "His replies are NOT in here — they are a production table and they are INPUT, so you read them",
  );
  out.push("yourself with `crew-read-replies.mts` at start and again before you ship.");
  out.push("");

  out.push("## 4 · THE PROGRAM — its law sections, carried verbatim");
  out.push("");
  for (const section of program.carried) {
    out.push(`--- ${PROGRAM_PATH} L${section.startLine}–${section.endLine}`);
    out.push(section.text.trimEnd());
    out.push("");
  }

  out.push("### The PROGRAM sections NOT carried above");
  out.push("");
  out.push(
    "Narrative and pointers rather than binding law — open `.agents/foreman/PROGRAM.md` at the line if",
  );
  out.push("your brief touches one. A casting UI brief in particular reads the design north star.");
  out.push("");
  for (const section of program.named) {
    out.push(`  L${section.startLine}–${section.endLine}  ${section.heading}`);
  }
  out.push("");

  out.push("## 5 · LAW ON DEMAND — the sections for what you are about to touch");
  out.push("");
  if (inputs.request.paths.length === 0 && inputs.request.flags.length === 0) {
    out.push("No paths or flags were named, so no law sections are carried.");
    out.push(
      "Once your card is chosen, run it again with what it touches and read only what comes back:",
    );
    out.push("");
    out.push(
      "  npx tsx scripts/shift-digest.mts --paths server/routes/billing.ts --flags CASTING_V2_SCOPE",
    );
    out.push("");
    out.push(
      "The full surfaces stay where they are: " +
        inputs.lawSurfaces.map((surface) => `\`${surface.path}\``).join(" and ") +
        ".",
    );
  } else {
    const selected = selectLawSections(inputs.lawSurfaces, inputs.request, inputs.roots);
    const asked = [...inputs.request.paths, ...inputs.request.flags].join(", ");
    if (selected.length === 0) {
      out.push(
        `Nothing in the law names ${asked}. That is an ANSWER, not an omission — the surfaces were read and`,
      );
      out.push(
        "no section covers it. If that surprises you, the law may be silent about the thing you are changing,",
      );
      out.push("which is worth a line in your report.");
    } else {
      out.push(`${selected.length} section(s) name ${asked}:`);
      out.push("");
      for (const choice of selected) {
        out.push(
          `--- ${choice.section.surface} L${choice.section.startLine}–${choice.section.endLine} · ${choice.because}`,
        );
        out.push(choice.section.text.trimEnd());
        out.push("");
      }
    }
  }
  out.push("");

  const digestBytes = Buffer.byteLength(out.join("\n"), "utf8");
  const sourceTotal = inputs.sourceBytes.reduce((sum, source) => sum + source.bytes, 0);
  out.push("## 6 · WHAT THIS COST AND WHAT IT SAVED");
  out.push("");
  out.push(
    `  this digest        ~${Math.round(digestBytes / 1024)} KB (${digestBytes} bytes, measured before this line)`,
  );
  for (const source of inputs.sourceBytes) {
    out.push(`  ${source.path.padEnd(34)} ${Math.round(source.bytes / 1024)} KB`);
  }
  out.push(`  ${"stands in for".padEnd(34)} ${Math.round(sourceTotal / 1024)} KB`);
  out.push("");
  out.push(
    "⚠ `CLAUDE.md` is deliberately NOT in that arithmetic: the harness loads it as project instructions",
  );
  out.push(
    "before a shift starts, so no generator can save it. It is INDEXED here (§5) rather than replaced.",
  );

  return out.join("\n");
}
