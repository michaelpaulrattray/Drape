/**
 * THE ROT FIGURE FOR THE BRIEFING'S QUEUE LINE — read at the timeline (#516).
 *
 * Every shift that has written this number wrote a fresh disposable to compute
 * it, and every one of those disposables filtered on GitHub's `updatedAt`:
 *
 *     const rotting = rows.filter((r) => Date.parse(r.updatedAt) < weekAgo);
 *
 * `updatedAt` moves on ANY write to an issue, including a bulk relabel, so the
 * figure fell from nine to zero overnight with nobody re-reading a card. The
 * rule that decides what counts, and the reason a cross-reference does not, is
 * in `lib/queueRot.mts` — this file is the fetch and the printing.
 *
 * # Why it is tracked rather than another disposable
 *
 * The finding window for this class is the moment of repair. A reading that
 * lives on one shift's disk is rewritten from scratch by the next shift, which
 * is precisely how the same `updatedAt` filter was re-typed into a dozen
 * disposables over three weeks. The rule now has one home and one set of arms.
 *
 * # One GraphQL call, not one REST call per card
 *
 * The timeline is asked for inside the issue query, filtered to the four event
 * kinds that count, so ~85 open cards cost ONE request rather than 85. It reads
 * nothing else and writes nothing at all.
 *
 *     npx tsx scripts/queue-rot-read.mts [--days 7] [--json]
 *
 * Needs `gh` authenticated. Exits 1 if the queue cannot be read — an empty
 * ranking from an unauthenticated `gh` looks exactly like a queue with nothing
 * rotting in it, and the second one is the answer that ends the investigation.
 */
import { execFileSync } from "node:child_process";

import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";
import {
  ENGAGEMENT_FRAGMENTS, ENGAGEMENT_ITEM_TYPES, engagementPhrase, eventsFrom, quietCards,
  quietSentence, refuseIfTruncated, type QueueCard,
} from "./lib/queueRot.mts";

const args = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["days"],
  boolean: ["json"],
});

const WINDOW_DAYS = args.number("days", 7);


/*
  The timeline is asked for `last:` rather than `first:`, because what this
  reading needs is the NEWEST engagement and a card with three hundred comments
  would otherwise return its oldest twenty.
*/
const QUERY = `
query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    issues(states: OPEN, first: 100, after: $cursor, orderBy: {field: CREATED_AT, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        createdAt
        labels(first: 20) { nodes { name } }
        timelineItems(last: 20, itemTypes: [${ENGAGEMENT_ITEM_TYPES.join(", ")}]) {
          nodes {
            __typename
            ${ENGAGEMENT_FRAGMENTS}
          }
        }
      }
    }
  }
}`;

type GraphNode = {
  number: number;
  title: string;
  createdAt: string;
  labels: { nodes: { name: string }[] };
  timelineItems: { nodes: ({ __typename: string; createdAt: string } | Record<string, never>)[] };
};

function readQueue(): QueueCard[] {
  const cards: QueueCard[] = [];
  let cursor: string | null = null;
  do {
    const argv = [
      "api", "graphql",
      "-f", `query=${QUERY}`,
      "-F", "owner=michaelpaulrattray",
      "-F", "name=Drape",
      ...(cursor ? ["-F", `cursor=${cursor}`] : []),
    ];
    const raw = execFileSync("gh", argv, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const page = JSON.parse(raw).data.repository.issues as {
      pageInfo: { hasNextPage: boolean; endCursor: string };
      nodes: GraphNode[];
    };
    for (const node of page.nodes) {
      cards.push({
        number: node.number,
        title: node.title,
        createdAt: node.createdAt,
        labels: node.labels.nodes.map((label) => label.name),
        events: eventsFrom(node.timelineItems.nodes),
      });
    }
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    /* The decision lives in the lib so it can be driven without a subprocess. */
    refuseIfTruncated(cards.length, cursor !== null);
  } while (cursor !== null);
  return cards;
}

function main(): number {
  let cards: QueueCard[];
  try {
    cards = readQueue();
  } catch (error) {
    /* The message goes FIRST and the hint second — the truncation refusal above
       comes through here too, and "is `gh` authenticated?" is the wrong thing
       to read first when the real answer is "raise the paging ceiling". */
    console.error(`queue-rot-read REFUSING: ${String(error instanceof Error ? error.message : error)}`);
    console.error("(if that reads like a transport failure rather than a refusal: is `gh` authenticated?)");
    return 1;
  }
  if (cards.length === 0) {
    /* Working law 2's shape: a clean answer over no cards is not an answer, and
       "nothing is rotting" is exactly the reading a shift would act on. */
    console.error("queue-rot-read: the queue came back EMPTY. That is a read failure, not a clean queue.");
    return 1;
  }

  const now = new Date();
  const quiet = quietCards(cards, now, WINDOW_DAYS);

  if (args.flag("json")) {
    console.log(JSON.stringify({
      open: cards.length,
      windowDays: WINDOW_DAYS,
      sentence: quietSentence(quiet.length, WINDOW_DAYS),
      quiet: quiet.map((reading) => ({
        number: reading.card.number,
        title: reading.card.title,
        quietDays: reading.quietDays,
        lastEngagedAt: reading.lastEngagedAt,
        labels: reading.card.labels,
      })),
    }, null, 2));
    return 0;
  }

  /* The header names the signals from the same table the sentence does — it was
     the fourth hand-written copy of that list, and it had already drifted. */
  console.log(`THE ROT READING — no ${engagementPhrase()} in the window`);
  console.log(`read ${now.toISOString()} · ${cards.length} open · window ${WINDOW_DAYS}d\n`);
  console.log(`  FOR THE QUEUE LINE: ${quietSentence(quiet.length, WINDOW_DAYS)}\n`);
  for (const reading of quiet) {
    console.log(`  ${String(reading.quietDays).padStart(3)}d  #${reading.card.number}  ${reading.card.title.slice(0, 78)}`);
    console.log(`        last engaged ${reading.lastEngagedAt.slice(0, 10)}${reading.card.labels.length > 0 ? ` · ${reading.card.labels.join(", ")}` : ""}`);
  }
  if (quiet.length === 0) console.log("  (none)");
  console.log("\nA label, an assignment or a cross-reference does NOT reset this clock — that is");
  console.log("the whole repair (#516). It over-reports rather than under-reports on purpose.");
  return 0;
}

process.exit(main());
