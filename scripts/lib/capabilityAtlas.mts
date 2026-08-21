/**
 * THE STUDIO CAPABILITY CENSUS — the library. (Founder order 2026-08-21,
 * fable-1315 §3; built by the reviewer seat on a branch, fable-1316.)
 *
 * # What it answers
 *
 * *"Does the studio already do this, and where?"* — as a LOOKUP rather than a
 * memory. One week's evidence for why that needed an instrument: a second
 * removal road nearly built beside the one that exists (opus-967); the sign-view
 * ink carry wired and inert for weeks (opus-956); an auto-discovery analyzer
 * "sized" while it was already on the roadmap (§5c); a refusal sentence recorded
 * CLOSED that no ask could reach (`inkRemovalNotYet`). Every one was a code read
 * standing in for a drive.
 *
 * # Two halves, joined
 *
 *   STATIC  — what the source DECLARES: every service refusal id (`refusal("…")`),
 *             every interpreter refusal reason, every `CANNOT_SAY_COPY` member
 *             and whether it is free, every scope flag, every subject card; and
 *             for each id, the test files that name it (a refusal nobody tests is
 *             a finding). Deterministic, no network, runs inside `pnpm test`.
 *
 *   DRIVEN  — what the product DOES: the corpus in `capability-atlas-corpus.mts`
 *             put through the REAL entrance, `refineCandidate`, with the claim
 *             door shut (`admit: () => false`). Real interpreter, real routing,
 *             every pre-claim door, and nothing charged — reaching the claim
 *             throws `busy`, which the census reads as WOULD-RENDER. Text calls
 *             on OpenRouter only; cents per run; never inside `pnpm test`.
 *
 * The join is the point: a declared refusal that no corpus row reaches is
 * `unreached` — exactly the `inkRemovalNotYet` class — and a corpus row whose
 * observed route differs from what its author believed is `belief-mismatch`.
 *
 * # Why the harness is the production caller's shape, and nothing more
 *
 * opus-967 §2: a `mode: "edit"` copied from a sibling script switched off the
 * very lane under audit, and every removal read as broken. This driver passes
 * exactly what the tRPC route passes — user, request id, candidate, sentence,
 * and a scope when the row has one — and records every interpreter call the
 * service makes so the route is evidence, not inference.
 *
 * # What it never does
 *
 * Never spends credits (the ledger is read at both ends and must not move),
 * never renders, never writes a row the product would not write for a free
 * refusal (the service's own `casting.refusal` audit seam runs as it would for
 * any customer), and never runs the driven half unless asked by flag — so
 * invoking the generator to LOOK at it cannot spend (memory law:
 * spending-script-never-inspected).
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CORPUS, type CorpusRow, type CorpusState } from "../capability-atlas-corpus.mts";
import { CANNOT_SAY_COPY, cannotSaySentence, type CannotSayReason } from "../../server/castingV2/cannotSayCopy";
import { FREE_SUBJECT_KEYS } from "../../server/castingV2/subjectCards";
import { refusalTagOf } from "../../server/castingV2/refusalTag";

export const CAPABILITY_SCHEMA_VERSION = "1.0.0";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CAPABILITY_OUT_DIR = path.join(repoRoot, "docs", "architecture");
export const CAPABILITY_JSON = path.join(CAPABILITY_OUT_DIR, "capability-atlas.json");
export const CAPABILITY_MD = path.join(CAPABILITY_OUT_DIR, "capability-atlas.md");

/* ═══════════════════════════════════════════════════════════ static half */

export type DeclaredId = {
  id: string;
  /** Where the id comes from. */
  kind: "service-refusal" | "interpreter-refusal" | "cannot-say";
  /** For a `cannot-say` member: whether the sentence is free or after a refund. */
  charge?: "free" | "refunded";
  /** Test files that name the id as a quoted literal. */
  pinnedBy: string[];
};

export type StaticAtlas = {
  declared: DeclaredId[];
  flags: string[];
  subjects: string[];
  corpus: Array<Pick<CorpusRow, "id" | "ask" | "scope" | "subject" | "verb" | "state" | "expect" | "why">>;
  findings: Finding[];
};

export type Finding = {
  id: string;
  severity: "info" | "warn" | "error";
  kind:
    | "unpinned-refusal"      // an id no test file names
    | "unreached"             // an id no corpus row expects OR observed
    | "belief-mismatch"       // observed ≠ expect
    | "route-changed"         // observed ≠ the committed observation
    | "drive-error"           // the service threw something that was not a refusal
    | "not-driven"            // a corpus row whose state the fixture cannot supply
    | "ledger-moved";         // the fixture's balance changed — the census spent
  subject: string;
  message: string;
};

const SOURCE_DIR = path.join(repoRoot, "server", "castingV2");

const listFiles = (dir: string, match: (name: string) => boolean): string[] => {
  const out: string[] = [];
  const walk = (at: string) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) { if (entry.name !== "node_modules") walk(full); }
      else if (match(entry.name)) out.push(full);
    }
  };
  walk(dir);
  return out.sort();
};

const rel = (file: string): string => path.relative(repoRoot, file).split(path.sep).join("/");

/** Every `refusal("id"` in the service modules — the door's own name. */
export function declaredServiceRefusals(): string[] {
  const ids = new Set<string>();
  for (const file of listFiles(SOURCE_DIR, (n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/\brefusal\(\s*"([a-z][a-z0-9_]*)"/g)) ids.add(match[1]!);
  }
  return [...ids].sort();
}

/** Every `reason: "id"` the interpreter can hand back, plus the gate ids. */
export function declaredInterpreterRefusals(): string[] {
  const ids = new Set<string>();
  const interpreter = path.join(SOURCE_DIR, "refineInterpreter.ts");
  const text = fs.readFileSync(interpreter, "utf8");
  for (const match of text.matchAll(/\breason:\s*"([a-z][a-z0-9_]*)"/g)) ids.add(match[1]!);
  for (const file of listFiles(SOURCE_DIR, (n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
    for (const match of fs.readFileSync(file, "utf8").matchAll(/"(gate_[a-z_]+)"/g)) ids.add(match[1]!);
  }
  return [...ids].sort();
}

/** The scope flags, read off their own `_SCOPE_ENV` constants. */
export function declaredFlags(): string[] {
  const text = fs.readFileSync(path.join(SOURCE_DIR, "castingV2Scope.ts"), "utf8");
  const ids = new Set<string>();
  /* `[A-Z0-9_]` — the first cut read `[A-Z_]` and silently dropped
     CASTING_V2_SCOPE, the parent of every other flag, on its digit. */
  for (const match of text.matchAll(/_SCOPE_ENV\s*=\s*"(CASTING_[A-Z0-9_]+_SCOPE)"/g)) ids.add(match[1]!);
  return [...ids].sort();
}

/**
 * Which test files name an id — as a QUOTED literal, so `busy` in prose does not
 * count as a pin. A refusal with no pin is a door nobody has proven can shut.
 */
export function pinningTests(ids: string[]): Map<string, string[]> {
  const tests = listFiles(path.join(repoRoot, "server"), (n) => n.endsWith(".test.ts"));
  /*
    THE CENSUS'S OWN TEST IS NOT A PIN. Its positive control has to NAME an
    unpinned id, and the first run of this scan counted that mention as the pin
    and declared the door proven — the instrument publishing its own control
    into the corpus it searches (memory: specimen-joins-the-vocabulary, fourth
    instance). Excluded structurally, by what the file imports, not by name.
  */
  const texts = tests
    .map((file) => [file, fs.readFileSync(file, "utf8")] as const)
    .filter(([, text]) => !text.includes("lib/capabilityAtlas.mts"));
  const out = new Map<string, string[]>();
  for (const id of ids) {
    const quoted = [`"${id}"`, `'${id}'`, `\`${id}\``];
    out.set(id, texts.filter(([, text]) => quoted.some((q) => text.includes(q))).map(([file]) => rel(file)));
  }
  return out;
}

export function buildStaticAtlas(corpus: readonly CorpusRow[] = CORPUS): StaticAtlas {
  const service = declaredServiceRefusals();
  const interpreter = declaredInterpreterRefusals().filter((id) => !service.includes(id));
  const cannot = Object.keys(CANNOT_SAY_COPY).sort() as CannotSayReason[];
  const pins = pinningTests([...service, ...interpreter, ...cannot]);
  const declared: DeclaredId[] = [
    ...service.map((id) => ({ id, kind: "service-refusal" as const, pinnedBy: pins.get(id) ?? [] })),
    ...interpreter.map((id) => ({ id, kind: "interpreter-refusal" as const, pinnedBy: pins.get(id) ?? [] })),
    ...cannot.map((id) => ({
      id, kind: "cannot-say" as const, charge: CANNOT_SAY_COPY[id].charge, pinnedBy: pins.get(id) ?? [],
    })),
  ].sort((a, b) => a.id.localeCompare(b.id));

  const findings: Finding[] = [];
  for (const entry of declared) {
    if (entry.pinnedBy.length === 0) {
      findings.push({
        id: `unpinned:${entry.id}`, severity: "warn", kind: "unpinned-refusal", subject: entry.id,
        message: `${entry.kind} "${entry.id}" is named by no test file — a door nobody has proven can shut`,
      });
    }
  }
  const expectedIds = new Set(corpus.map((row) => outcomeId(row.expect)).filter((x): x is string => x !== null));
  for (const entry of declared) {
    if (!expectedIds.has(entry.id)) {
      findings.push({
        id: `unreached:${entry.id}`, severity: "info", kind: "unreached", subject: entry.id,
        message: `no corpus row expects "${entry.id}" — the census cannot say whether any ask reaches it`,
      });
    }
  }
  return {
    declared,
    flags: declaredFlags(),
    subjects: [...FREE_SUBJECT_KEYS].sort(),
    corpus: corpus.map(({ id, ask, scope, subject, verb, state, expect, why }) => ({ id, ask, scope, subject, verb, state, expect, why })),
    findings: findings.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/** `refused:x` / `free:x` → `x`; `would-render` etc. → null. */
export const outcomeId = (outcome: string): string | null => {
  const match = /^(?:refused|free):([a-zA-Z_]+)$/.exec(outcome);
  return match ? match[1]! : null;
};

/* ═══════════════════════════════════════════════════════════ driven half */

export type InterpreterCall = { mode: string; answer: string };

export type Observation = {
  id: string;
  /** The census's outcome vocabulary. */
  observed: string;
  /** The facet the door named, when it named one. */
  facet: string | null;
  /** The sentence the customer would have read, for free answers and questions. */
  said: string | null;
  /** Every interpreter call the service made, in order — the route's evidence. */
  calls: InterpreterCall[];
  /** Wall-clock for the drive, so a slow door is a number. */
  ms: number;
};

export type DrivenAtlas = {
  profile: { name: string; flags: Record<string, string>; fixture: string };
  observations: Observation[];
  /** Rows whose state the fixture could not supply — listed, never hidden. */
  notDriven: Array<{ id: string; state: CorpusState }>;
  ledger: { before: number; after: number };
};

export type CapabilityAtlas = {
  schemaVersion: string;
  static: StaticAtlas;
  driven: DrivenAtlas | null;
  findings: Finding[];
};

/**
 * Which `CANNOT_SAY_COPY` member wrote this sentence — matched by rendering every
 * member with the row's own context and comparing. A sentence no member renders
 * is `free:unmatched`, which is itself worth reading: it means the product said
 * something the table does not own.
 */
/**
 * EVERY SET OF WORDS A CAST CAN BE SPOKEN ABOUT (§5e).
 *
 * These sentences stopped being constants on 2026-08-22 — the refine surface
 * called every Cast "her" and now says what the Cast's own schema says. So the
 * matcher tries all three, exactly as it already tries both money states and
 * three nouns: the census reads a sentence off a fixture whose sex it does not
 * carry, and a matcher that only knew one set would file the other two as
 * `unmatched` — the product saying something the table does not own, which is
 * a real finding and would here be an artifact of the reader.
 */
const PRONOUN_SETS = [
  { subject: "she", object: "her", possessive: "her", plural: false },
  { subject: "he", object: "him", possessive: "his", plural: false },
  { subject: "they", object: "them", possessive: "their", plural: true },
] as const;

export function reasonOfNote(note: string, context: { facet: string | null; scopeNoun: string | null }): string {
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const wanted = normalize(note);
  for (const reason of Object.keys(CANNOT_SAY_COPY) as CannotSayReason[]) {
    for (const words of [null, "it", "that"]) {
      for (const moneySafe of [true, false]) {
        for (const pronouns of PRONOUN_SETS) {
          let rendered: string;
          try {
            rendered = cannotSaySentence(reason, {
              words, facet: context.facet, scopeNoun: context.scopeNoun, moneySafe, pronouns,
            });
          } catch {
            continue;
          }
          if (normalize(rendered) === wanted) return reason;
        }
      }
    }
  }
  /* Second pass: a shared opening clause long enough to be this table's voice. */
  for (const reason of Object.keys(CANNOT_SAY_COPY) as CannotSayReason[]) {
    for (const pronouns of PRONOUN_SETS) {
      try {
        const rendered = normalize(cannotSaySentence(reason, {
          words: null, facet: context.facet, scopeNoun: context.scopeNoun, moneySafe: true, pronouns,
        }));
        const head = rendered.slice(0, 40);
        if (head.length >= 30 && wanted.startsWith(head)) return reason;
      } catch { /* a member that needs a noun it was not given */ }
    }
  }
  return "unmatched";
}

type RefineModule = typeof import("../../server/castingV2/refineService");
type InterpreterModule = typeof import("../../server/castingV2/refineInterpreter");

/** Drive one row through the real entrance with the claim door shut. */
export async function driveRow(input: {
  row: CorpusRow;
  userId: number;
  candidatePublicId: string;
  refine: RefineModule["refineCandidate"];
  interpret: InterpreterModule["interpretRefinement"];
}): Promise<Observation> {
  const calls: InterpreterCall[] = [];
  const interpret = (async (request: Parameters<InterpreterModule["interpretRefinement"]>[0]) => {
    const answer = await input.interpret(request);
    const shape = request as Record<string, unknown>;
    calls.push({
      mode: typeof shape.mode === "string" ? shape.mode : "(default)",
      answer: answer.ok
        /* The WHOLE delta, not a slice: the ink gate classifies the model's
           filed item, not her sentence, so the item is the evidence. */
        ? ("delta" in answer ? `served ${JSON.stringify((answer as { delta: unknown }).delta).slice(0, 600)}` : `ok:${(answer as { intent?: string }).intent ?? "?"}`)
        : `refused:${(answer as { refusal: { reason: string } }).refusal.reason}`,
    });
    return answer;
  }) as InterpreterModule["interpretRefinement"];

  const started = Date.now();
  const scopeNoun = input.row.scope ? input.row.scope.replace(/^ink:/, "").replace("@", " ") : null;
  try {
    const result = await input.refine({ interpret, admit: () => false }, {
      userId: input.userId,
      clientRequestId: randomUUID(),
      candidatePublicId: input.candidatePublicId,
      instruction: input.row.ask,
      ...(input.row.scope ? { scope: input.row.scope } : {}),
    });
    const ms = Date.now() - started;
    if (result.reask) {
      return { id: input.row.id, observed: `asked:${result.reask.kind}`, facet: null, said: result.reask.question, calls, ms };
    }
    if ((result as { offer?: unknown }).offer) {
      return { id: input.row.id, observed: "offered", facet: null, said: null, calls, ms };
    }
    if (result.note) {
      /* The NAVIGATE answers are the removal road's own copy, not the
         cannot-say table's — a display label so the table reads as what
         happened. If the product's sentence drifts, the observed string
         drifts with it and the route-change finding says so. */
      if (/^That takes (it back to the original|off ["'“])/.test(result.note)) {
        return { id: input.row.id, observed: "free:navigate", facet: null, said: result.note, calls, ms };
      }
      const reason = reasonOfNote(result.note, { facet: input.row.subject === "guard" ? null : input.row.subject, scopeNoun });
      return { id: input.row.id, observed: `free:${reason}`, facet: null, said: result.note, calls, ms };
    }
    return { id: input.row.id, observed: `returned:${result.kind ?? "unknown"}`, facet: null, said: null, calls, ms };
  } catch (error) {
    const ms = Date.now() - started;
    const tag = refusalTagOf(error);
    if (tag) {
      const message = error instanceof Error ? error.message : null;
      if (tag.reason === "busy") return { id: input.row.id, observed: "would-render", facet: null, said: null, calls, ms };
      return { id: input.row.id, observed: `refused:${tag.reason}`, facet: tag.facet, said: message, calls, ms };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { id: input.row.id, observed: `error:${message.slice(0, 120)}`, facet: null, said: null, calls, ms };
  }
}

/** Findings that only exist once a drive has happened. */
export function drivenFindings(input: {
  staticAtlas: StaticAtlas;
  driven: DrivenAtlas;
  corpus: readonly CorpusRow[];
  committed?: CapabilityAtlas | null;
}): Finding[] {
  const findings: Finding[] = [];
  const byId = new Map(input.corpus.map((row) => [row.id, row]));
  const reached = new Set<string>();
  for (const obs of input.driven.observations) {
    const row = byId.get(obs.id)!;
    const id = outcomeId(obs.observed);
    if (id) reached.add(id);
    if (obs.observed.startsWith("error:")) {
      findings.push({ id: `drive-error:${obs.id}`, severity: "error", kind: "drive-error", subject: obs.id, message: `"${row.ask}" → ${obs.observed}` });
    } else if (obs.observed !== row.expect) {
      findings.push({
        id: `belief:${obs.id}`, severity: "warn", kind: "belief-mismatch", subject: obs.id,
        message: `"${row.ask}" — believed ${row.expect}, observed ${obs.observed}`,
      });
    }
    const prior = input.committed?.driven?.observations.find((o) => o.id === obs.id);
    if (prior && prior.observed !== obs.observed) {
      findings.push({
        id: `changed:${obs.id}`, severity: "error", kind: "route-changed", subject: obs.id,
        message: `"${row.ask}" — committed ${prior.observed}, now ${obs.observed}`,
      });
    }
  }
  for (const entry of input.staticAtlas.declared) {
    const expected = input.corpus.some((row) => outcomeId(row.expect) === entry.id);
    if (expected && !reached.has(entry.id)) {
      findings.push({
        id: `unreached-driven:${entry.id}`, severity: "warn", kind: "unreached", subject: entry.id,
        message: `a corpus row expects "${entry.id}" and the drive never produced it — the door may be unreachable`,
      });
    }
  }
  for (const nd of input.driven.notDriven) {
    findings.push({ id: `not-driven:${nd.id}`, severity: "info", kind: "not-driven", subject: nd.id, message: `needs state "${nd.state}", which this fixture cannot supply` });
  }
  if (input.driven.ledger.before !== input.driven.ledger.after) {
    findings.push({
      id: "ledger-moved", severity: "error", kind: "ledger-moved", subject: "fixture",
      message: `the fixture's ledger moved ${input.driven.ledger.before} → ${input.driven.ledger.after}: the census SPENT, which it must never do`,
    });
  }
  return findings.sort((a, b) => a.id.localeCompare(b.id));
}

/* ═══════════════════════════════════════════════════════════ the page */

export function renderCapabilityPage(atlas: CapabilityAtlas): string {
  const lines: string[] = [];
  lines.push("# What the studio can do today — the Capability Census");
  lines.push("");
  lines.push("Derived, never typed. Regenerate with `pnpm capability:generate --drive`; check with `pnpm capability:check`.");
  lines.push("A row's **observed** column is what the real refine entrance did with that sentence, claim door shut (nothing charged).");
  lines.push("");
  const d = atlas.driven;
  if (d) {
    lines.push(`Profile **${d.profile.name}** on fixture \`${d.profile.fixture}\`; flags: ${Object.entries(d.profile.flags).map(([k, v]) => `\`${k}=${v}\``).join(", ")}.`);
    lines.push("");
  } else {
    lines.push("_No drive recorded — static half only._");
    lines.push("");
  }
  lines.push("## The asks");
  lines.push("");
  lines.push("| id | ask | state | believed | observed | what the customer reads |");
  lines.push("|---|---|---|---|---|---|");
  const obs = new Map((d?.observations ?? []).map((o) => [o.id, o]));
  const notDriven = new Set((d?.notDriven ?? []).map((n) => n.id));
  for (const row of atlas.static.corpus) {
    const o = obs.get(row.id);
    const observed = o ? (o.observed === row.expect ? o.observed : `**${o.observed}**`) : (notDriven.has(row.id) ? "_not driven_" : "_—_");
    const said = o?.said ? o.said.replace(/\|/g, "\\|").slice(0, 140) : "";
    const ask = row.scope ? `${row.ask} _(scope ${row.scope})_` : row.ask;
    lines.push(`| ${row.id} | ${ask.replace(/\|/g, "\\|")} | ${row.state} | ${row.expect} | ${observed} | ${said} |`);
  }
  lines.push("");
  lines.push("## Every door the source declares");
  lines.push("");
  lines.push("| id | kind | charge | pinned by |");
  lines.push("|---|---|---|---|");
  for (const entry of atlas.static.declared) {
    lines.push(`| ${entry.id} | ${entry.kind} | ${entry.charge ?? ""} | ${entry.pinnedBy.length ? entry.pinnedBy.map((f) => f.replace("server/castingV2/", "")).join(", ") : "**none**"} |`);
  }
  lines.push("");
  lines.push(`## Flags (${atlas.static.flags.length})`);
  lines.push("");
  lines.push(atlas.static.flags.map((f) => `\`${f}\``).join(" · "));
  lines.push("");
  lines.push(`## Findings (${atlas.findings.length})`);
  lines.push("");
  if (atlas.findings.length === 0) lines.push("_none_");
  for (const f of atlas.findings) lines.push(`- **${f.severity}** \`${f.kind}\` ${f.subject} — ${f.message}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

/* ═══════════════════════════════════════════════════════════ io */

export function readCommittedAtlas(): CapabilityAtlas | null {
  if (!fs.existsSync(CAPABILITY_JSON)) return null;
  return JSON.parse(fs.readFileSync(CAPABILITY_JSON, "utf8")) as CapabilityAtlas;
}

export function writeAtlas(atlas: CapabilityAtlas): void {
  fs.mkdirSync(CAPABILITY_OUT_DIR, { recursive: true });
  fs.writeFileSync(CAPABILITY_JSON, `${JSON.stringify(atlas, null, 2)}\n`);
  fs.writeFileSync(CAPABILITY_MD, renderCapabilityPage(atlas));
}
