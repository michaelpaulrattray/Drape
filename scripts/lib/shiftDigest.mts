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

/* ⚠ THE ONE IMPORT IN THIS FILE, AND IT IS A REUSE RATHER THAN A CONVENIENCE
   (#1094). This library is otherwise pure and self-contained. `findCardPull-
   Requests` is the judgement #1083 already built and drove — does an open pull
   request name this card, and where — and the whole point of the sweep card is
   that the answer arrives at the place the CHOICE is made, not only at the
   place it is declared. A second implementation of "does this PR name #N" is
   the mirror working law 4 forbids, and this one has a subtlety worth not
   re-deriving: the branch reading matches a maximal digit RUN, so `#10790` is
   not `#1079`. */
import { findCardPullRequests } from "../../shared/crewShiftState.js";

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

/**
 * The money/auth surfaces, DERIVED from the triage's own map in
 * `docs/REVIEWER_CHARTER.md` rather than typed a second time here.
 *
 * ⚠ **The word set above is not enough on its own, and the review that caught
 * it named the worst case exactly**: `server/routes/emailVerification.ts` is a
 * SESSION MINT SITE — invariant 9's own counterexample — and none of its words
 * (`email`, `verification`) is a money word, so the unconditional arm stayed
 * dark on the one class of file it exists for. Two files on the same line of
 * the charter's list were getting opposite treatment.
 *
 * The two nets are a UNION and that is deliberate: the charter enumerates the
 * paths the reviewer must see, the words catch a new file nobody has added to
 * it yet (`server/routes/refunds.ts` on its first day). Failing toward MORE law
 * is the only safe direction here.
 *
 * The map's first bullet is written in an alternation shorthand —
 * `server/routes/billing|credits|auth|emailAuth|googleAuth|emailVerification` —
 * which is expanded here against its own prefix.
 */
export function parseMoneyAuthMap(charterText: string): string[] {
  const heading = /^##.*money\/auth path map.*$/im.exec(charterText);
  if (!heading) {
    throw new DigestRefusal(
      "docs/REVIEWER_CHARTER.md has no money/auth path map section — refusing rather than falling back to a word list, which is how the mirror this reads instead of would come back",
    );
  }
  const rest = charterText.slice(heading.index + heading[0].length);
  const section = rest.split(/^## /m)[0] ?? "";
  const paths: string[] = [];
  for (const bullet of section.split(/\r?\n/).filter((row) => /^\s*-\s/.test(row))) {
    /* ⚠ THE MAP'S OWN SHORTHAND PUTS THE DIRECTORY ON THE FIRST TOKEN ONLY:
       "`server/_core/sdk.ts`, `cookies.ts`, `trpc.ts`, `env.ts`". Skipping the
       bare names dropped THREE auth surfaces including `env.ts` and the session
       cookie module — measured against the real charter, which is why this is
       read at the file rather than assumed to be one path per token. */
    let directory = "";
    for (const quoted of bullet.matchAll(/`([^`]+)`/g)) {
      const token = quoted[1].trim();
      if (!token.includes("/")) {
        if (directory && /\.[a-z]+$/.test(token)) paths.push(`${directory}${token}`);
        continue;
      }
      directory = token.slice(0, token.lastIndexOf("/") + 1);
      if (!token.includes("|")) {
        paths.push(token.replace(/\/+$/, ""));
        continue;
      }
      /* `a/b/x|y|z` -> a/b/x, a/b/y, a/b/z. A bare `x|y` with no prefix is not
         a path and is skipped by the slash test above. */
      const cut = token.lastIndexOf("/");
      const prefix = token.slice(0, cut + 1);
      for (const leaf of token.slice(cut + 1).split("|")) {
        if (leaf.trim().length > 0) paths.push(`${prefix}${leaf.trim()}`);
      }
    }
  }
  if (paths.length === 0) {
    throw new DigestRefusal(
      "the money/auth path map yielded no paths — a collector that can come up empty must throw (CLAUDE.md's collector class)",
    );
  }
  return [...new Set(paths)];
}

/**
 * Is a requested path one the charter's map names?
 *
 * The map writes some members WITHOUT an extension (`server/routes/billing`),
 * so a bare stem matches the file that stem names as well as the directory.
 */
export function isOnMoneyAuthMap(requested: string, mapPaths: readonly string[]): boolean {
  const target = normalise(requested);
  return mapPaths.some((entry) => {
    const mapped = normalise(entry);
    if (target === mapped) return true;
    if (target.startsWith(`${mapped}/`)) return true;
    return /\.(ts|tsx|mts|js|sql)$/.test(target) && target.replace(/\.[a-z]+$/, "") === mapped;
  });
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

  /*
    ⚠ A `#` INSIDE A FENCED BLOCK IS A SHELL COMMENT, NOT A HEADING, and reading
    it as one is a SILENT-LOSS road rather than a cosmetic one: a phantom level-1
    section truncates the `##` law section it sits in (breaking this module's
    "nothing is truncated" promise) and everything after it until the next `##`
    lands in a level-1 section that `splitProgram`'s level-2 filter discards — so
    it is carried nowhere and named nowhere, which is the one failure the
    partition check declares impossible. That check guards the FILTERED list, so
    it would have stayed green. `PROGRAM.md` carries fenced command examples
    today; that they hold no `#` line today is luck, not a property.
  */
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
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

/**
 * Names that carry no information about WHICH file is meant, so a section
 * mentioning one is not citing your file. Kept short and stated rather than
 * grown: every addition is a citation the index stops seeing.
 */
const GENERIC_FILE_NAMES = new Set([
  "index.ts",
  "index.tsx",
  "types.ts",
  "utils.ts",
  "constants.ts",
  "schema.ts",
  "env.ts",
]);

export const baseName = (value: string): string =>
  normalise(value).split("/").pop() ?? normalise(value);

/**
 * Bare file names a section cites in backticks — `emailVerification.ts`.
 *
 * The generic ones are excluded: `index.ts` names nothing in particular, and
 * matching on it would attach the same sections to every card in the product.
 */
export function mentionedFileNames(sectionText: string): string[] {
  const found = new Set<string>();
  for (const quoted of sectionText.matchAll(/`([A-Za-z0-9_.-]+\.(?:ts|tsx|mts|js|mjs|sql|css|yml|yaml|json|md))`/g)) {
    const name = quoted[1];
    if (!GENERIC_FILE_NAMES.has(name)) found.add(name);
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
  moneyAuthMap: readonly string[] = [],
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
    /* ⚠ A LEVEL-1 HEADING IS THE DOCUMENT'S TITLE, and its "section" is the
       whole file — handing that back is exactly what §5 exists not to do. It
       never surfaced on the real law surfaces only because both of them happen
       to hold bullet entries and were skipped by the rule below; a surface
       without them would have shipped the entire document as one answer. */
    if (section.level === 1) continue;

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
    const fileNames = mentionedFileNames(section.text);
    for (const requested of request.paths) {
      if (paths.some((mention) => pathCovers(mention, requested))) {
        add(section, `names ${requested}`);
      } else if (fileNames.includes(baseName(requested))) {
        /* The law often cites a file by its NAME alone — `emailVerification.ts`
           at CLAUDE.md's invariant 9 — and a path index that insists on a slash
           reads those citations as silence. Same class as the backtick defect
           this file already carries: a real citation the index could not see. */
        add(section, `names ${baseName(requested)} by file name`);
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

  const moneyAuth = request.paths.filter(
    (requested) => isMoneyAuthPath(requested) || isOnMoneyAuthMap(requested, moneyAuthMap),
  );
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

  /* ⚠ A `###` CHILD AND ITS `##` PARENT ARE NOT TWO ANSWERS. A path cited
     inside a child matches the child and the parent whose text contains it, and
     carrying both prints the child twice — wrong in bytes only, in a tool whose
     entire justification is bytes. The parent wins: it is the fuller answer. */
  const selections = [...chosen.values()];
  const kept = selections.filter(
    (choice) =>
      !selections.some(
        (other) =>
          other !== choice &&
          other.section.surface === choice.section.surface &&
          other.section.startLine <= choice.section.startLine &&
          other.section.endLine >= choice.section.endLine &&
          (other.section.startLine !== choice.section.startLine ||
            other.section.endLine !== choice.section.endLine),
      ),
  );

  return kept.sort(
    (a, b) =>
      a.section.surface.localeCompare(b.section.surface) || a.section.startLine - b.section.startLine,
  );
}

/**
 * Sections that MATCH a request but are deliberately not carried — the level-1
 * document body, and a heading section whose flag entries are the real answer.
 *
 * ⚠ **WITHOUT THIS, §5 TELLS A LIE WITH A STRAIGHT FACE.** A card touching
 * `docs/architecture/FEATURE_FLAGS.md` — which every flag change does, since the
 * catalogue entry rides the same commit — is cited in `CLAUDE.md` exactly once,
 * inside an entry-holding section, and the catalogue's own reading rules sit in
 * its level-1 preamble. Both skip rules fire, nothing is selected, and §5 prints
 * *"the surfaces were read and no section covers it"* about a file the law
 * plainly covers. This module's own doctrine is fail toward a POINTER, never a
 * silence; the skip rules were the one place that doctrine was not applied.
 *
 * The NARROWEST match wins here, the opposite of the parent-wins rule for
 * carried sections: a pointer is a place to look, and the whole document is not
 * a place.
 */
export function pointerSections(
  surfaces: readonly { readonly path: string; readonly text: string }[],
  request: LawRequest,
  roots: readonly string[],
): Section[] {
  const all = surfaces.flatMap((surface) => splitSections(surface.path, surface.text));
  const matched = all.filter((section) => {
    const skipped =
      section.level === 1 ||
      all.some(
        (other) =>
          other.level === 0 &&
          other.surface === section.surface &&
          other.startLine > section.startLine &&
          other.endLine <= section.endLine,
      );
    if (!skipped) return false;
    const paths = mentionedPaths(section.text, roots);
    const fileNames = mentionedFileNames(section.text);
    return request.paths.some(
      (requested) =>
        paths.some((mention) => pathCovers(mention, requested)) ||
        fileNames.includes(baseName(requested)),
    );
  });

  return matched
    .filter(
      (section) =>
        !matched.some(
          (other) =>
            other !== section &&
            other.surface === section.surface &&
            other.startLine >= section.startLine &&
            other.endLine <= section.endLine &&
            (other.startLine !== section.startLine || other.endLine !== section.endLine),
        ),
    )
    .sort((a, b) => a.surface.localeCompare(b.surface) || a.startLine - b.startLine);
}

/** How the PROGRAM's sections are treated: carried verbatim, or named. */
export type ProgramSplit = {
  readonly carried: Section[];
  readonly named: Section[];
};

/** Where the PROGRAM lives, named once so the digest's pointers cannot drift. */
export const PROGRAM_PATH = ".agents/foreman/PROGRAM.md";

export function splitProgram(programMd: string): ProgramSplit {
  const all = splitSections(PROGRAM_PATH, programMd);
  const sections = all.filter((section) => section.level === 2);
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
  /* THE PARTITION CHECK ABOVE ONLY GUARDS THE FILTERED LIST, and the reviewer
     was right that this is where its blind spot lives: a level-1 heading
     appearing AFTER the file's first `##` takes text out of every list at once.
     Fence handling stops the known cause; this refuses the symptom whatever
     caused it, so the guard does not depend on the fix being complete. */
  const firstSection = sections[0].startLine;
  const stray = all.find((section) => section.level === 1 && section.startLine > firstSection);
  if (stray) {
    throw new DigestRefusal(
      `PROGRAM.md has a level-1 heading at line ${stray.startLine} ("${stray.heading}") after its first section — text under it would be carried nowhere and named nowhere`,
    );
  }
  return { carried, named };
}

/**
 * One mailbox entry as the CLI reads it off disk — the input to the reader
 * below, so the DECISION is pure and CI can drive it without a `.agents/`.
 */
export type MailboxEntry = {
  readonly name: string;
  /**
   * The filesystem's own write time, epoch ms. ⚠ **This is the authoritative
   * reader and the reason is not convenience**: it is written by the operating
   * system rather than typed by a shift at 3am, and it is an absolute instant,
   * so the local/UTC question that produced #960 cannot be asked of it.
   */
  readonly mtimeMs: number;
  /** The `YYYYMMDDHHMM` stamp in the FILENAME, or null when the name has none. */
  readonly filenameStamp: string | null;
};

export type PreviousShift = {
  readonly label: string;
  /**
   * The instant handed to `git log --since=` and to the `gh` card query, always
   * UTC. ⚠ **ONE string goes to both.** The old road computed a naive local ISO
   * for git and a UTC one for `gh`, which is two answers to one question.
   */
  readonly iso: string;
  /** Said out loud in §3. Empty when the two readers agree. */
  readonly notes: readonly string[];
};

/**
 * WHICH ENTRY WAS THE PREVIOUS SHIFT — read by `mtime`, cross-examined by the
 * FILENAME, and REFUSED rather than dated in the future (#960).
 *
 * The road it replaces took the maximum FILENAME stamp and parsed it as LOCAL
 * time. Measured over the 377 timestamped entries on the machine that filed the
 * card: the two orderings disagree at **38 positions**, the filename winner sat
 * **8th** in mtime order, and **one** stamp was in the future of local now —
 * `…-1032`'s stamp is UTC, `…-2345`'s own header says it opened `01:52Z`, so it
 * is neither UTC nor local. The names have drifted into at least two
 * conventions plus one that matches nothing.
 *
 * ⚠ **WHY THE REFUSAL IS THE ACTUAL GUARD AND THE MTIME SWITCH ONLY STOPS IT
 * FIRING.** A `--since` that is ahead of now returns zero rows *by
 * construction* — not "nothing changed", but nothing CAN be returned — and §3
 * then prints a confident `none / none` that no shift can tell from a genuinely
 * quiet interval. It fails silently and always in the same direction: toward
 * the tree having stood still. So a future instant is refused here whatever
 * produced it, including a skewed clock that mtime cannot protect against.
 *
 * ⚠ **The filename is kept as a SECOND READER rather than deleted.** It is the
 * reading the handoff chain and the entry titles are written in, so when it
 * names a different entry a shift needs telling — the digest says which and
 * does not pick (the same shape as the atlas hook naming a partial stage
 * instead of claiming the map matches). It is never used to choose.
 *
 * ⚠ **And it is NOT repaired by renaming the entries or tightening the naming
 * convention in the standing orders.** 377 files exist, 38 orderings already
 * disagree, and a convention is a thing a shift can get wrong again next week —
 * working law 4, a second list shadowing a source of truth. The filesystem
 * already knows.
 */
export function choosePreviousShift(
  entries: readonly MailboxEntry[],
  nowMs: number,
): PreviousShift | Unreadable {
  const timestamped = entries.filter((entry) => entry.filenameStamp !== null);
  if (timestamped.length === 0) return { unreadable: "no timestamped entry in the mailbox" };

  /* Ties broken by name so two entries written in the same millisecond cannot
     make the digest non-deterministic between runs. */
  const byMtime = [...timestamped].sort((a, b) =>
    b.mtimeMs - a.mtimeMs || (a.name < b.name ? 1 : a.name > b.name ? -1 : 0),
  );
  const picked = byMtime[0];

  if (picked.mtimeMs > nowMs) {
    const ahead = Math.round((picked.mtimeMs - nowMs) / 60000);
    return {
      unreadable:
        `${picked.name} was written ${ahead} minute(s) in the FUTURE — a --since ahead of now ` +
        `returns nothing by construction, and "none" would be a lie rather than a reading`,
    };
  }

  const notes: string[] = [];
  const byName = [...timestamped].sort((a, b) =>
    (a.filenameStamp as string) < (b.filenameStamp as string) ? 1 : (a.filenameStamp as string) > (b.filenameStamp as string) ? -1 : 0,
  );
  const nameWinner = byName[0];
  if (nameWinner.name !== picked.name) {
    const rank = byMtime.findIndex((entry) => entry.name === nameWinner.name) + 1;
    notes.push(
      `⚠ the newest FILENAME stamp is a DIFFERENT entry — ${nameWinner.name}, which sits ${rank} of ` +
        `${byMtime.length} by write time. The filenames are not one clock (#960), so this reading is ` +
        `by mtime; if a handoff names that other entry, open both.`,
    );
    const nameIso = isoFromStamp(nameWinner.filenameStamp as string);
    if (nameIso !== null && new Date(nameIso).getTime() > nowMs) {
      notes.push(
        `⚠ and that filename stamp is in the FUTURE of now — the old reader would have asked git for ` +
          `changes since ${nameIso} and printed "none" because nothing can be returned.`,
      );
    }
  }

  return { label: picked.name, iso: new Date(picked.mtimeMs).toISOString(), notes };
}

/** `YYYYMMDDHHMM` read as LOCAL time — the convention the filenames CLAIM. */
function isoFromStamp(stamp: string): string | null {
  if (!/^\d{12}$/.test(stamp)) return null;
  const iso = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:00`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

/**
 * An open pull request as the digest needs it — the same shape
 * `scripts/lib/cardClaimWarning.mts` reads out of `gh`, declared here so this
 * library's one import stays the JUDGEMENT and not a type graph.
 */
export type OpenPullRequestLike = {
  readonly number?: number;
  readonly title?: string;
  readonly url?: string;
  readonly body?: string;
  readonly isDraft?: boolean;
  readonly headRefName?: string;
};

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
  /**
   * THE OPEN PULL REQUESTS, so a NEXT UP row can say whether somebody is
   * already building it (#1094, the sweep remainder of #1083).
   *
   * ⚠ **IT IS REQUIRED, NOT OPTIONAL, AND THAT IS THE POINT.** #1083's finding
   * is that "is it open" and "is somebody building it" are two questions and
   * only the first was ever asked; an optional field would let a caller ask
   * neither and render exactly like a caller that asked and found a clean
   * board. Three states, kept apart in the output: claimed, read-and-clean,
   * and UNREAD — the third being the one this file's header is about.
   *
   * ⚠ **The digest WARNS and never refuses.** #1083 ruled that before it was
   * built: an open PR naming a card may be the shift's own follow-up, a
   * finished half, or somebody else mid-build, and a reader that stops a shift
   * finishing its own card's second half costs more than the duplicate it
   * prevents. The line names the PR; the shift decides.
   */
  readonly openPullRequests: OpenPullRequestLike[] | Unreadable;
  /** `patrol-clocks.mts`'s own output, embedded rather than reimplemented. */
  readonly patrolClocks: string | Unreadable;
  readonly since: PreviousShift | Unreadable;
  readonly commits: string[] | Unreadable;
  readonly closedCards: string[] | Unreadable;
  readonly request: LawRequest;
  /**
   * The money/auth path map, parsed out of `docs/REVIEWER_CHARTER.md`. Empty is
   * legal (the word set still fires) but the CLI always passes it, and its
   * parser refuses an empty read.
   */
  readonly moneyAuthMap?: readonly string[];
  /**
   * A `gh --limit` that came back FULL. The collector doctrine here refuses an
   * empty answer; a TRUNCATED one is the other half of the same question, and
   * silently dropping a card is how a queue stops being the queue.
   *
   * ⚠ **The two fields measure different populations and the difference is not
   * cosmetic** (#774, PR #775 review finding 2). `closedCards` is the read of
   * closed cards itself. `nextUp` is **NOT** the band — it is the WHOLE OPEN
   * QUEUE the band is filtered out of, so a true value means the band may be
   * short because the read never reached it, not because the band is long.
   * This clause used to describe a 60-row cap on the band, which is the rule
   * that was retired; a comment left describing a retired rule re-opens the
   * mistake it documented.
   */
  readonly truncated?: { readonly nextUp?: boolean; readonly closedCards?: boolean };
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
    /* ⚠ IT POINTS AT THE WIDE READ, NOT THE NARROW ONE (#774, PR #775 review
       round 2, observation 2). This line used to say `--label founder-ordered`
       — the very read whose empty answer this collector now rules unbelievable.
       A shift told the queue is unreadable would have run it during the same
       blip, got `[]`, and believed it: the original harm, with a person walking
       the retired road on the digest's own advice. */
    out.push(
      "⚠ Read it yourself before you decide anything, and read it WIDE:",
    );
    out.push("  `gh issue list --state open --limit 200 --json number,title,labels`");
    out.push("  An empty answer to the narrow `--label founder-ordered` query proves nothing — that is what");
    out.push("  this refusal is about. A band is empty only when the queue it sits in answered too.");
    out.push("An unreadable queue is NOT an empty one, and it does not open the one-quiet-shift road (#504).");
  } else if (inputs.nextUp.length === 0) {
    /* Since #774 this line is only ever reached when the collector's own
       whole-queue witness AGREED the band is empty; a `gh` blip comes back
       UNREADABLE above and says so. The clause is here because the difference
       is invisible from the outside — the old line looked exactly like this
       one and was printed with the same confidence on a blip. */
    out.push("NEXT UP: EMPTY — no open `founder-ordered` card, and the open queue was read to confirm it.");
  } else {
    out.push(`NEXT UP: ${inputs.nextUp.length} open \`founder-ordered\` card(s), oldest first:`);
    const prs = inputs.openPullRequests;
    let claimedAny = false;
    for (const row of [...inputs.nextUp].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const labels = row.labels.filter((label) => label !== "founder-ordered");
      out.push(
        `  #${row.number}  ${row.createdAt.slice(0, 10)}  ${row.title}${labels.length > 0 ? `  [${labels.join(", ")}]` : ""}`,
      );
      if (isUnreadable(prs)) continue;
      const claimed = findCardPullRequests(prs, `#${row.number}`);
      if (claimed.length === 0) continue;
      claimedAny = true;
      for (const { pr, where } of claimed) {
        out.push(
          `    ⚠ ALREADY BEING BUILT? PR #${pr.number ?? "?"}${pr.isDraft ? " (draft)" : ""}`
          + ` is open and names this card in its ${where.join(" and ")} — ${pr.url ?? "no url"}`,
        );
      }
    }
    /* ⚠ THE THREE ANSWERS ARE KEPT APART, WHICH IS THE WHOLE OF #1083's FINDING
       CARRIED ONE STEP EARLIER. A claimed card, a board read and clean, and a
       board NOBODY READ are three different facts, and the last two look
       identical to any renderer that says nothing when it has nothing to say —
       the same trap this file's header names at #504 and the queue read. So the
       clean case costs one line on purpose. */
    if (isUnreadable(prs)) {
      out.push(
        "  ⚠ THE OPEN PULL REQUESTS COULD NOT BE READ, so nobody checked whether any card above is",
      );
      out.push(`    already being built — ${prs.unreadable}`);
      out.push(
        "    That is not a clean board, it is an unread one (`gh auth status`). Check by hand before",
      );
      out.push("    you cut a branch: `gh pr list --state open`.");
    } else if (!claimedAny) {
      out.push(
        `  ✓ No open pull request names any card above (${prs.length} open PR(s) read).`,
      );
    } else {
      out.push(
        "  ⚠ An open PR naming a card is a WARNING, never a refusal (#1083): it may be your own",
      );
      out.push(
        "    follow-up, a finished half, or another seat mid-build. READ IT before you cut a branch.",
      );
    }
    if (inputs.truncated?.nextUp) {
      /* ⚠ The cap is on the POPULATION, not on the band (#774): the band is
         filtered out of a whole-open-queue read, and `gh` returns the NEWEST
         rows while ordered cards skew OLD — so a full window is precisely the
         case where an ordered card can sit outside it. Saying "there may be
         more" without saying more of WHAT would read as a long band. */
      out.push(
        "  ⚠ TRUNCATED — the whole-queue read this band was filtered from came back at its limit,",
      );
      out.push(
        "    so an older `founder-ordered` card may sit outside the window. Run the query yourself.",
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
  /* The instant is the entry's WRITE time, which is why it is labelled as one:
     a reader who sees a bare ISO beside a filename carrying a different stamp
     has no way to tell which of the two it is (#960). */
  out.push(
    line(
      "Previous entry",
      isUnreadable(inputs.since) ? inputs.since : `${inputs.since.label} (written ${inputs.since.iso})`,
    ),
  );
  /* The second reader speaks when it disagrees and is silent when it does not.
     A disagreement is NAMED rather than resolved: the mtime read is the one
     used, and the shift is told which other entry a handoff might mean. */
  if (!isUnreadable(inputs.since)) {
    for (const note of inputs.since.notes) out.push(`  ${note}`);
  }
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
  } else if (inputs.closedCards.length === 0 && inputs.truncated?.closedCards) {
    /* An EMPTY list that came off a read which hit its limit is the worst of the
       two: every returned row was filtered out, so "none" is the one thing it is
       certainly not. */
    out.push("  none survived the filter — ⚠ but the read came back AT ITS LIMIT, so there may be more.");
  } else if (inputs.closedCards.length === 0) {
    out.push("  none");
  } else {
    for (const card of inputs.closedCards) out.push(`  ${card}`);
    if (inputs.truncated?.closedCards) {
      out.push("  ⚠ TRUNCATED — the read came back at its limit, so there may be more.");
    }
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
    const selected = selectLawSections(
      inputs.lawSurfaces,
      inputs.request,
      inputs.roots,
      inputs.moneyAuthMap ?? [],
    );
    const asked = [...inputs.request.paths, ...inputs.request.flags].join(", ");
    const pointers = pointerSections(inputs.lawSurfaces, inputs.request, inputs.roots);
    if (selected.length === 0 && pointers.length === 0) {
      out.push(
        `Nothing in the law names ${asked}. That is an ANSWER, not an omission — the surfaces were read and`,
      );
      out.push(
        "no section covers it. If that surprises you, the law may be silent about the thing you are changing,",
      );
      out.push("which is worth a line in your report.");
    } else if (selected.length === 0) {
      out.push(
        `${asked} is cited only inside sections this reader does not carry whole — a document preamble, or a`,
      );
      out.push("section whose bullet entries are the real answer. OPEN THESE, they are not silence:");
      out.push("");
      for (const section of pointers) {
        out.push(`  ${section.surface} L${section.startLine}–${section.endLine}  ${section.heading}`);
      }
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
