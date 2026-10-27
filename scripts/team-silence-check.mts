/**
 * HAS THE TEAM STOPPED? — the command behind `.github/workflows/team-silence.yml`
 * (#2719, Retro recurrence R23).
 *
 * The reasoning, the threshold and every verdict live in
 * `scripts/lib/teamSilence.mts`, which is where they can be driven. This file
 * is the transport: it runs `gh`, reads the deployed briefing's ladder off
 * disk, prints the sentence, and exits.
 *
 * It is deliberately runnable BY HAND, for the knip nightly's reason one
 * directory over: a scheduled reading and a hand reading must not be able to
 * disagree, so there is one command and the workflow calls it.
 *
 *     npx tsx scripts/team-silence-check.mts
 *     npx tsx scripts/team-silence-check.mts --hours 6     # tighten for a look
 *
 * Exit codes, as the house uses them:
 *
 *     0   the team is running, or it is correctly parked with an empty board
 *     2   THE FINDING — main has stood still with work on offer
 *     1   one of the two facts could not be read, so a park and a stall cannot
 *         be told apart. It files nothing and fails, which is neither crying
 *         wolf nor going quiet.
 *
 * It opens no database and writes nothing anywhere.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { readTeamSilence, teamSilenceExitCode, TEAM_SILENCE_HOURS } from "./lib/teamSilence.mts";

/** The deployed briefing, which is where the ladder's current rung is read. */
const BRIEFING = "server/crew/crew-briefing.json";

/* A read that cannot hang the job. Everything it asks for is small. */
const GH_TIMEOUT_MS = 60_000;

const argv = process.argv.slice(2);
const hoursArg = argv.indexOf("--hours");
const thresholdHours = hoursArg >= 0 && argv[hoursArg + 1] !== undefined
  ? Number(argv[hoursArg + 1])
  : Number(process.env.TEAM_SILENCE_HOURS ?? TEAM_SILENCE_HOURS);

if (!Number.isFinite(thresholdHours) || thresholdHours <= 0) {
  console.error(`[team-silence] --hours must be a positive number, got ${JSON.stringify(argv[hoursArg + 1] ?? process.env.TEAM_SILENCE_HOURS)}`);
  process.exit(1);
}

/*
  THE LADDER IS READ OFF DISK AND A FAILURE IS `null`, WHICH HOLDS EVERY RUNG
  CARD — `focusRungFromLadder`'s own documented behaviour, and the reason there
  is no third "unreadable ladder" state. A caller that cannot read the ladder
  therefore agrees with `cutSeatBatches` in the same condition rather than
  inventing a kinder answer, and holding rung cards makes this reader QUIETER,
  never louder.
*/
let ladder: readonly { readonly key?: unknown; readonly state?: unknown }[] | null = null;
try {
  const briefing = JSON.parse(readFileSync(BRIEFING, "utf8")) as {
    program?: { ladder?: readonly { readonly key?: unknown; readonly state?: unknown }[] };
  };
  ladder = briefing.program?.ladder ?? null;
} catch (error) {
  console.error(`[team-silence] the ladder at ${BRIEFING} could not be read (${error instanceof Error ? error.message : String(error)}) — every rung card is held`);
}

const { verdict, sentence } = readTeamSilence({
  nowMs: Date.now(),
  gh: (args) => execFileSync("gh", [...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: GH_TIMEOUT_MS,
  }),
  ladder,
  thresholdHours,
});

console.log(`[team-silence] ${verdict.kind.toUpperCase()} — ${sentence}`);
if (verdict.kind === "stopped") {
  console.log(
    "[team-silence] every alarm the team owns keys on work IN FLIGHT, so none of them can see this. "
    + "Read: the newest `.agents/mailbox/foreman-*` entry, `.agents/shift-logs/`, whether `.agents/STOP` exists, "
    + "and whether the runner's lock names a live process that is not a runner (#2719's measured defect).",
  );
}

process.exit(teamSilenceExitCode(verdict));
