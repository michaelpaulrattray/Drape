# CLAUDE.md

Drape — AI fashion studio: cast AI models (Gemini image generation), digitize garments, run virtual try-on (wardrobe/VTO), and iterate on an infinite canvas (boards). Originally scaffolded on the Manus WebDev platform; all Manus platform code has since been removed (see "Manus legacy" below for the one intentional remnant).

## Project context

Drape is a commercial product heading for public launch. Billing, credits, and auth code are production-critical — treat changes there conservatively.

Design taste: restrained, editorial, monochrome. Prefer simple, human-feeling solutions over clever or busy ones; avoid generic templated UI patterns. When in doubt on design decisions, less is more.

## THE DISAPPEARING-TECHNOLOGY LAW (founder ruling, 2026-09-03)

⚠ **THIS IS THE WHOLE PRODUCT'S LAW, NOT A CASTING ONE.** His clarification the
day he set it down: *"the philosophy i gave you isnt just for casting studio v2
its for the entire app any new features we add in the future the ai will need to
ask itself how this measures against the philosophy."* **Casting, wardrobe,
boards, canvas, billing, admin, whatever ships next — every one of them, and
every feature added to any of them from now on.**

**The founder's own sentence, and the one this whole product is built on:**

> **Users don't care how it was built. They care that it just works — without
> them having to learn the technology.**

He set it down with the four it descends from, and each carries a different
half of the rule:

> *"You've got to start with the customer experience and work backwards to the
> technology. You can't start with the technology and try to figure out where
> you're going to try to sell it."* — **Steve Jobs**
>
> *"Don't make me think."* — **Steve Krug**, *Don't Make Me Think*
>
> *"The most profound technologies are those that disappear."* — **Mark Weiser**
>
> *"When something exceeds your ability to understand how it works, it sort of
> becomes magical."* — **Jony Ive**

**This is the customer-facing half of the fidelity law below, and the two are
one rule read from two ends.** The fidelity law says *always reach for the tool
that is genuinely best at the job.* This says *the customer must never need to
know which tool that was, or that it changed.* **A product that names its
engines has moved its own homework onto the person paying for it.**

### What it obliges, and none of it is a preference

**1 · THE BEST MODEL FOR EACH JOB, AND "BEST" HAS AN EXPIRY.** His words filing
this: *"the ai landscape is changing fast so this is something we always will
need to be on top of."* A model chosen well eighteen months ago is not thereby
chosen well now. **Model choices carry a date and a reason, and a rung that
touches a road re-asks whether its engine is still the right one** — the
capability atlas is where that answer lives, not memory.

**2 · IT IS RE-ASKED WITH A MEASUREMENT, NEVER A LEADERBOARD.** ⚠ **A benchmark
rank does not predict this product's job.** Measured twice already: the reader
court (#231) put a top-tier model against the shipped one on his own fixtures
and it **invented an age on a creature that had none** and dropped his goth's
eyepiece; the author bench (#466) had both arms keep every stated fact and
separate entirely on register. **His own standing method decides it — proof on
his fixtures, not theory** (#190-era rule), and **his eye closes it** (law 9).

**3 · COST IS PART OF THE JUDGEMENT, STATED OUT LOUD.** His words: *"but then
that costs us money."* **A better engine that costs more, or takes longer, is a
trade and not a free win** — the author bench's verdict turned on 40–120 seconds
per roll, not on quality. ⚠ **Name the price and the latency beside the quality
finding, or the finding is not decision-grade.**

**4 · READ WHAT THE ENGINE ALREADY GIVES YOU BEFORE REACHING FOR A BETTER ONE.**
⚠ **The first instance is recorded the day this law landed**: SAM 3 ships a
presence head built for exactly the absent-feature defect #246 measured, the
request already sends `include_scores: true`, and **the reader discards every
score.** *"Are we using the best models?"* was answered by finding the right
model's own answer thrown away. **A signal bought and unread is the cheapest
finding available, and it is checked before any swap is proposed.**

**5 · THE DEFAULT IS NEVER A QUESTION. THE PICKER IS A FEATURE.** ⚠ **He
corrected this clause TWICE on the day it was written, both times because it was
drafted too rigidly, and the second correction is the one that matters:**

> *"people who use ai will use our software and probably want to experiment with
> different models etc so we cant just hide the model details from them all the
> time this cant be a hard rigid . pickers will exist in the future purely
> because that in itself is something we are offering the user"*

**So the reframe, and it is his:** ⚠ **for an AI studio the model is not
plumbing, it is MATERIAL.** A different engine gives a different look the way a
different lens or a different film stock does. **Choosing it is a creative
decision, not an implementation detail leaking out** — and offering that choice
is a feature this product intends to sell, judged like any other feature rather
than tolerated as an exception.

**What this law actually forbids is narrow, and it is not model names:**

- ⚠ **NOBODY IS EVER FORCED TO CHOOSE.** A correct default exists for every job,
  it is the best engine for that job under clauses 1–4, and a customer who never
  opens the picker gets the product's best work. **That is the whole durable
  rule. Everything else is design.**
- ⚠ **NO ENGINE NAME ON A PATH SOMEONE MUST WALK** to reach their picture — not
  the primary button, not a loader, not an error, not a required step. **The
  honest loader's stage names** (#55) show the line: they name what is HAPPENING
  to their picture, never what is doing it. **A refusal says what was refused and
  what to do.**

**And when a picker IS the offering, build it as a first-class feature:** ✅ **name
the models plainly** — an experimenting customer wants the real name, and hiding
it is the disrespect, not the leak; ✅ **say what each one is good at in their
terms**, because that is what makes it usable rather than a guess; ✅ **let them
compare**, since comparison is the point of experimenting at all.

⚠ **The failure this clause guards is a picker with no default and no guidance
— a list of slugs that makes the customer solve our problem.** **A picker with a
right default and a real basis is a feature.** That is the difference, and it is
the only line here.

**6 · WHEN THE MACHINERY IS VISIBLE, THAT IS THE DEFECT.** A control the
customer must understand to use, a number they must interpret, a choice they
have no basis to make — each is this law failing, and each is fixed by removing
the decision rather than explaining it better. ⚠ **His own rulings already run
this way and are the precedent**: the candidate-count selector refused because
*"every decision placed before the button is a reason not to press it"*; the
wardrobe/basics path retired; *"tools should just refer to was an image
generated?"* — the customer's vocabulary, not the pipeline's.

**7 · EVERY NEW FEATURE IS MEASURED AGAINST IT, BEFORE IT IS BUILT.** His
instruction, verbatim: *"any new features we add in the future the ai will need
to ask itself how this measures against the philosophy."* ⚠ **So this is a GATE
on new work, not a review note after it.** A brief, a design, or a card that
adds something a customer will touch answers three questions in its own body,
and a shift that cannot answer them says so rather than proceeding:

  1. **What must the customer learn to use this?** The honest answer, not the
     hoped-for one. **If it is anything, that is the thing to remove.**
  2. **What decision does it put in front of them, and do they have any basis
     for making it?** A choice offered without a basis is the machinery showing
     through — his own candidate-count ruling is the worked example.
  3. **Where does the technology show?** A model name, a percentage nobody can
     act on, a term of art from the pipeline, a control that mirrors an
     implementation rather than an intention.

⚠ **"It works and it's fast" does not pass this gate** — a feature can be both
and still make someone learn the machine. **And a feature that fails it is not
blocked; it is REDESIGNED**, because the failure is almost always a decision
that should never have reached the customer.

⚠ **This law is not a style note and it outranks convenience.** Where it and a
simpler implementation disagree, it wins, and the simpler one is named in the
report as the thing that was declined.

## The fidelity law (founder ruling, 2026-08-06)

Never take the path of least resistance on quality. When a capability
exists as a dedicated, proven tool — a segmentation model instead of
hand-drawn shapes, a matting model instead of a binary outline, a real
library instead of an approximation — use the dedicated one, even when
the approximation is nearer to hand. The convenient substitute silently
caps the ceiling of everything built on top of it.

Shortcuts are permitted only when **declared**: scaffolding-first is
legitimate engineering, but the report must say "this is scaffolding,
the real source lands next," and the real source must be on the board.
A lesser path taken *silently* — shipped as if it were the real thing —
is the violation. Origin: the maskGeometry incident (masks built from
authored shapes when segmentation models were the obvious source; the
founder's "not just blocks and squares?" caught it mid-build). When you
notice you are about to approximate, name the tradeoff out loud and let
it be challenged before it ships, not after.

## Working laws (founder-ratified, each from a real incident)

1. **Reports are claims; artifacts are facts.** Never assert what a
   file, image, log, or database row contains from memory or from
   another report — open the artifact itself, at the resolution the
   claim needs. A deploy reporting SUCCESS is a claim; the health check
   and the changed bytes are the fact. (D-164, D-202.)
2. **Verify the instrument before believing its finding.** A new
   metric, reader, or checker gets a negative control and a positive
   control before its verdicts count for anything. A green suite proves
   nothing if the checker cannot fail. (D-147, D-203.)
3. **A backstop needs a test the model cannot rescue.** If the only
   test of a guard runs through an LLM that usually behaves, the guard
   is untested. Drive it directly.
4. **Derive, never mirror.** A second list shadowing a source of truth
   always drifts from it. Build derived views, not parallel copies.
5. **Assert at the wire.** Contracts about what gets sent are proven on
   the outgoing request, not on a constant near it.
6. **Render before shipping anything visual.** No visual change ships
   without being looked at in the running app first. (D-101.)
7. **Fix the class, not the instance.** (Founder, 2026-08-07.) A bug
   found once is a pattern until proven unique. Before declaring any
   defect fixed: name its class (the shape of the mistake, not the
   symptom), sweep the rest of the feature — and any code sharing the
   shape — for siblings, and fix or explicitly file every one found.
   The sweep is part of the fix; a fix without its sweep is half done.
   Evidence this pays: the nose/rose typo fix swept 46 sentences and
   caught two more latent hits before any user did; the "earring"
   default was one of a class of quiet dispatch fallbacks; the
   wrong-boundary measurement error took four appearances before its
   class was named — each earlier sweep would have prevented the later
   instances.

   **The same law pointed at rulings instead of bugs (2026-08-19):
   WHEN A RULING CLOSES A PATH, THE SWEEP ASKS WHAT WAS BOLTED TO IT.**
   Asked at the closing commit, not later. Three controls have now died
   this way and none of them by carelessness: the credit-velocity caps
   (a product removing its topup checkout, `41a765ea`), the site-wide
   login-attack detector (the Manus OAuth removal, `b1f5187d`, which
   deleted the file the call sites lived in), and the founder-approved
   refused-frame camera — killed by his own catastrophic-only refund
   ruling (`5c5a1f3f`), which was CORRECT and still took a control with
   it. That is the harshest form, because there is no mistake to find in
   the change itself. Each would have been caught on the day for the
   cost of one grep along the dying branch. A control that stops being
   reachable leaves no failing test and no error — only a green suite
   and a document that still describes it.

   ⚠ **THE SENSITIVE-ACTION GATE WAS ON THIS LIST AND CAME OFF IT
   2026-08-23 — read at the bytes, and the correction runs the OTHER
   way for once.** `server/routers.ts` mentioned `isSensitiveAction`
   exactly ONCE, on its import line, from the commit that created it
   (`8d6531ba`) to the commit that dropped it (`3cb0cdee`); `git log -S
   "isSensitiveAction("` changes count at the declaration and never
   again, so nothing outside `adminSecurity.ts` ever called it. **It was
   a dead import, and the file split removing it was correct.** The gate
   is a path-ONE control — written, documented, wired never — which is
   the gentlest road and is where the earlier record had it before a
   confident "correction" moved it here. The other three above were
   re-read the same way in the same sitting and all three hold, with
   their call sites quoted: `createTopupCheckout` in `server/routes/billing.ts`, `oauth.ts` at both
   failed-login exits, and `await captureRefusedRender({`.

   **The type specimen is still 2026-02-07, and it is now a different
   lesson.** One security control died that morning — the
   credit-velocity caps at 09:13, in a product removal — and it was then
   described, in code comments and in this file, as a control whose call
   site was never added. Six months of confident documentation, from one
   ordinary morning's tidying. **Its neighbour at 03:35 is the mirror
   image and the sharper warning: a road corrected from path one to path
   three on the strength of an IMPORT that nobody opened.** An import is
   not a call site. Both errors are the same error — a road asserted
   from a graph instead of read at the bytes — and this one had a
   celebrated instrument standing behind it.
7c. **YOU ALWAYS CHECK AGAINST THE CODEBASE.** (Founder, 2026-08-30, verbatim
   and in capitals, said to the relay after it read a list of "things needing
   you" off the Crew briefing and passed it to him unchecked — **three of the
   five were questions he had already answered days earlier**, one of them
   settled in this very file.) Law 7b bans guessing; **this bans the subtler
   thing, which is CITING**. Quoting a document is not checking. A card title,
   a Crew card, a briefing, a design doc, a plan, a mailbox entry, a commit
   message, **and CLAUDE.md itself** are all REPORTS in law 1's sense —
   **the code is the artifact, and it is the only thing that settles what the
   product does.** Before telling him what exists, what is open, what is built
   or what a rule is: open the file. A grep is thirty seconds; a confident
   answer off a stale document costs him a decision he already made.
   **The measured proof is the day this law was written**: four separate
   documents were found governing live work while contradicting the code — the
   redesign running order, `PROGRAM.md`'s standing-exceptions ranking (eight
   cards, **all closed**), the issue queue (a spot-check of twelve found four
   wrong), and this file's own MAX ruling, four days superseded while
   `promptAuthor.ts` had been right the whole time. **In every one of the four
   the code was correct and the document was not**, which is the direction this
   law exists to exploit: when a document and the tree disagree, the tree wins
   and the document is the bug.
7b. **Never guess — test or confirm before stating.** (Founder, 2026-08-22,
   verbatim: *"why do you always guess put it in stone that you should never
   guess and always test or confirm."*) Law 1 binds reports; this binds
   EVERY factual claim about the product, wherever it is said — a mailbox
   report, a ruling, or an answer to the founder in chat. Before asserting
   what the product does, refuses, or contains: cite a driven artifact (a
   census row, a court, a read at the rows), or run the check in that same
   turn (a grep is thirty seconds), or say plainly "unverified" and then
   verify. An answer to the founder deserves the same evidence bar as a
   report — the origin incident is three chat claims in one week, each
   confidently wrong, each disproven by his own test or an instrument:
   "wardrobe edits exist today" (the census measured wall_stage), "your
   signed casts render without their tattoos" (the rows showed no signed
   cast had ink), and "our walls don't know fictional names" (his own
   "inspired by goku" test met `briefCompiler.ts`'s `unsupported_cohort` wall the same hour).
   The capability atlas exists to make the citation cheap; a claim that
   cannot cite it and was not checked is not said.

8. **This is a visual studio, not a maths class.** (Founder, 2026-08-06.)
   The user's ontology governs design: edits are scoped and named the
   way a stylist, photographer, or casting director thinks — a fringe
   is part of a haircut, a tan covers all visible skin, earrings come
   in matching pairs. Pixel deltas, masks, and metrics are the
   implementation and verification layer — they serve the stylist's
   promise and never frame the product. Origin: the fringe was built as
   strands painted onto a forehead patch (the minimal-diff framing)
   when it was always a cut change (the user's framing) — the founder
   had assumed the obvious ontology while engineering optimized the
   mathematical one, and nobody put the two in one room. When scoping
   any edit, ask first: how would the user describe what changes? That
   description is the spec; the math proves it happened.
9. **The founder's eyes are king — always.** (Founder, 2026-08-16,
   verbatim: "do NOT trust the engine my eyes are king. ALWAYS. the
   engine lies and cannot be trusted.") A model's reading of an image
   — describer, verification reader, any vision judge — is never the
   final word on what a frame shows. A reader's output is a pointer to
   look, not a fact to file: no claim about a visible surface closes
   on reader prose alone; frames go in front of eyes, and reports
   quote what was seen. Where a reader and his eye have ever
   disagreed on a class, the reader is presumed wrong on that class
   until re-proven with a control he has seen. Origin: the freckle
   court — both arms overturned at the frames in one sitting
   (fable-714/715/716): the reader called freckles absent on frames
   that visibly held them, after the tan-drift figure had already
   fallen to a moving-mask measurement artifact.

## Advisor protocol

This protocol applies only to the top-level primary executor. The advisor and other subagents never invoke or spawn another advisor.

Determine eligibility from the top-level primary model:

- **Opus primary:** use the proactive advisor protocol below.
- **Fable primary** (`fable` or `claude-fable-5`): do not invoke the advisor through the routine protocol; the executor is already using the advisor model. Perform the same architecture and risk review directly as a self-review. Invoke a separate advisor only if the user explicitly requests an additional advisor/Fable review in the current task.
- **Any other primary model:** invoke the advisor only when the user explicitly requests an advisor/Fable review in the current task.
- **Unknown primary model:** treat it as “other” and do not invoke automatically.

For an eligible Opus primary, call the read-only `advisor` BEFORE substantive work — before writing code or committing to an interpretation on a non-trivial task. Orientation (reading files, grep) is not substantive work; do that first, then consult. Also call it when stuck (recurring errors or a non-converging approach) and before declaring a milestone chunk complete. Give its advice serious weight; if evidence contradicts it, surface the conflict in one more consult rather than silently switching. When it flags a founder ruling, stop and ask rather than deciding.

For coding under an eligible Opus primary: milestone plans and DECISION_LOG rulings are pre-made judgment, so executing them needs no consult. Consult when the plan leaves implementation shape open and the choice is architectural, after the FIRST failed fix attempt on any bug (not the third), and as a brief review before reporting a milestone chunk complete.

## The night-shift team (founder-ordered, 2026-08-25)

The program is executed by an autonomous agent team; any session doing build
work is either one of its shifts or must behave like one. The binding pieces:

- **`.agents/foreman/PROGRAM.md` is the campaign pointer** — mission (V2
  replaces the legacy studio), the CURRENT FOCUS (set only by the founder's
  word), the design north star, and two founder laws: **THE MILESTONE GATE**
  (completing a milestone never authorizes starting the next; every boundary
  ships a completion card + test-drive list to the founder and the focus
  clears) and **MAINTENANCE MODE** (with no confirmed focus, only
  agent-detected bugs and inside-existing-behavior improvements run — the
  team NEVER selects the next feature). A brief that cannot trace to the
  focus, a standing exception, or a founder instruction is not cut.
- **GitHub Issues is the sole system of record for work.** Nothing is built
  outside the queue. The mailbox (`.agents/mailbox/`) is receipts and
  handoffs, never state — a fact that lives only in a message does not exist.
- **The gate** (`.github/workflows/gate.yml`, `review.yml`): every PR runs
  the four instruments; substantial or money-path diffs get a Fable review
  (under 50 changed code lines skips it; `needs-fable` forces it). Money/auth
  diffs are labelled `founder-review` for visibility and always reviewed but
  do NOT block on founder approval (his ruling, 2026-08-25). Product code
  goes branch → PR → gate; direct pushes to main are the deploy rite's alone.
  ⚠ **A `review` CHECK REPORTS WHETHER A VERDICT EXISTS, NEVER WHETHER THE
  DIFF PASSED** (#219, 2026-08-29). The action exits 0 whatever it finds, so
  **findings ride a GREEN check's sticky comment — read it before merging —
  and a RED `review` means NO REVIEW WAS PRODUCED**: the reviewer cannot run
  on its own change (#165), it failed to complete, or **the run was CANCELLED
  by a newer one on the same trigger (#434)**. Read the
  wrong way round on PR #218, where the founder's Fable allowance was
  exhausted, the job died in ~1s on `is_error: true`, and a red check looked
  like a reviewer verdict for two shifts until the result JSON was dug out of
  the action log. The review job's last step now names which of the three
  states it is, on the PR's own checks page and in the run summary; it runs
  on `always()` with `continue-on-error`, so it can neither rescue a failure
  nor break a pass. ⚠ **A CANCELLED run is the one it cannot always narrate,
  and that is stated rather than discovered**: `always()` covers a
  cancellation mid-review, but a run cancelled while still QUEUED never
  reaches a runner, so no step of it executes and the PR carries a red check
  with no annotation at all. **The concurrency key is what stops the common
  cause** — until 2026-09-04 every event on a PR shared the slot
  `review-<pr>`, so a `labeled` event that was going to skip (triage reviews a
  label only for `needs-fable`) could cancel the real review and then skip
  itself, which is what PR #433 showed. The group is keyed on the event and
  the label now, so an `opened` run and a `labeled` run cannot see each other
  while two runs of the same kind still supersede. ⚠ **And the card's
  headline number was wrong in the direction that matters — read at the
  artifact, the last 100 review runs are 46 success, 45 skipped, 8 failure and
  ONE cancelled. The 45 skipped are the design working**; #502's "27 of the
  last 60 were skipped" counts the reviewer doing its job, not the bug.
- **The founder steers from the Desk** (a claude.ai artifact page): his
  replies and journal entries there are rulings — quoted verbatim when acted
  on. Desk cards lead with product impact and a worked example, flags second.
- The continuous runner and its watchdog task are deliberately persistent
  processes — never swept as leftovers. `.agents/STOP` halts the team.

## Commands

- `pnpm dev` — start dev server (Express + Vite middleware, single process on http://localhost:3000; auto-increments port if busy)
- `pnpm check` — TypeScript typecheck (no emit)
- `pnpm test` — vitest run (server unit tests; green out of the box — env-dependent suites skip with a console message)
- `pnpm test:integration` — HTTP tests against a live server (`server/**/*.integration.test.ts`); start `pnpm dev` first
- `pnpm build` — vite build (client → `dist/public`) + esbuild (server → `dist`)
- `pnpm db:push` — drizzle-kit generate + migrate (needs `DATABASE_URL`)
- `pnpm architecture:generate` — regenerate the Drape Atlas (`docs/architecture/`)
- `pnpm architecture:check` — verify the Atlas is fresh, schema-valid and deterministic (also runs inside `pnpm test`)
- `npx tsx seed.ts` — dev helper: marks every user approved + emailVerified + admin

## Architecture Atlas

After changing routes, schemas, database access, ownership rules, billing, workers, queues, providers, storage, feature flags, product-domain boundaries or legacy-module status, review the Atlas diff as part of the change; before completing work, run `pnpm architecture:check`. Generated architecture files are reviewed with the code change and never edited manually; annotations live in `docs/architecture/annotations.yaml`.

⚠ **AND YOU NO LONGER RUN `pnpm architecture:generate` BY HAND — THE COMMIT DOES IT (#501, 2026-09-04), because remembering was measurably not working.** Of the last 60 `gate.yml` runs, **5 failed, and all 5 failed on the single step `Architecture Atlas freshness`** — each one a red at ~3½ minutes, a local regenerate, a re-push and a second seven-minute gate, for a change that was otherwise fine. `.githooks/atlas-stage` (ARM 3 of `pre-commit`) regenerates **both** maps and stages them whenever a commit touches a path they are built from, so a branch pushes the map of its own tree; a generator that fails REFUSES the commit rather than letting a map that could not be built ship as fresh. It costs ~9s (measured: architecture 7.6s + capability 1.6s) and **only on those commits** — a docs-only or workflow-only commit pays nothing. It needs no new per-clone config: `core.hooksPath=.githooks` already arms it, and the deploy rite already refuses to run without that. ⚠ **ONE CASE STILL NEEDS YOUR EYE AND THE HOOK SAYS SO OUT LOUD: A PARTIAL STAGE.** The generators hash the bytes **on disk**, not the index, so committing `server/foo.ts` while `server/bar.ts` carries unstaged work ships a map built from a tree that is not the one committed — and the gate, which rebuilds from the COMMITTED tree, reddens exactly as before. This is not new (a hand-run generator read the same disk) and it is not refused, because committing part of a working tree is a legitimate thing to do; the hook **names the offending files and tells you the map may not match**, instead of printing that the commit carries the map of its own tree. Stage them or stash them if you want the freshness check to agree. ⚠ **The path filter is a mirror of the generator's own `SCANNED_ROOTS` and mirrors drift (working law 4), so it is not left to hold** — `server/atlasCommitHook.test.ts` reads that constant out of `scripts/generate-architecture.mts` and reddens if a root the generator scans is not covered, and the same suite drives the hook against real temporary repositories in both directions. ⚠ **`docs/architecture/annotations.yaml` is on the filter and #501's own body would have dropped it**: the card said "skip when only `docs/` is staged", and that file lives under `docs/` and is hashed into the architecture fingerprint — editing it alone is precisely the commit that goes stale.

**They are never MERGED by hand either** (Retro guard R1, #100, 2026-08-26): `.gitattributes` gives the three generated files `merge=atlas`, and `.githooks/merge-atlas` — registered per clone by `git config merge.atlas.driver '.githooks/merge-atlas %O %A %B %P'`, which the deploy rite refuses to run without — accepts a placeholder and queues a regeneration that `pre-merge-commit`/`pre-commit` perform on the MERGED tree. An automatic merge therefore stops with the map regenerated and staged and asks for `git commit --no-edit` (git does not re-read the index after `pre-merge-commit`; measured), a broken generator refuses the commit, and GitHub still computes conflicts its own way — a CONFLICTING PR still needs `git merge main` locally, which is now one command.

The Atlas (`docs/architecture/drape-architecture.json`, with a filterable `index.html` derived from it) is mechanically extracted from source — it never runs app code, opens a database, reads an env *value*, or touches R2. It is the deletion authority for the legacy-retirement program: nothing is removed while its retirement view still shows live callers.

⚠ **AND UNTIL 2026-08-23 THAT VIEW COULD NOT SEE TWO OF THE THREE WAYS ONE MODULE REACHES ANOTHER, WHICH IS THE ONE DEFECT THIS PARAGRAPH CANNOT AFFORD.** The edge graph was built from static `import … from "…"` alone; a re-export (`export … from "./x"`, the barrel shape) and a dynamic `await import("./x")` produced no edge at all. So **65 modules showed ZERO inbound edges while being genuinely reached** — and zero callers is precisely the reading that says *safe to remove*. Among them: `server/routes/emailAuth.ts` and `server/routes/googleAuth.ts`, **both login routes**, reached only by `await import(…)` in `server/_core/index.ts` and holding four of invariant 9's five session mints between them; all three background workers, which the Atlas's own `workers` list names, so the artifact contradicted itself; `server/db/ipBlocking.ts`, `server/db/billing.ts`, `server/db/security.ts`; and most of the client's feature directories. Six modules under a `retire` lifecycle read as removable and were not. Fixed at `d614320f` — all three shapes now count as `imports`, edges 3363 → 3540, modules with no inbound edge 146 → 81 — and guarded by a reader that resolves against the FILE SYSTEM while the generator resolves through the TypeScript compiler, so neither inherits the other's blind spot (`server/architectureAtlas.test.ts`). **A retirement verdict read before that commit is not evidence and must be re-taken.**

It was one of four collectors found reading at a SHAPE where a DECLARATION already existed, in one sitting: the procedure walker held seven inline nested routers as seven procedures where there are fourteen, and recorded **every boards write operation as a `query`** (`dbcfd0ee`); the operation-kind reader scraped dotted string literals and held 16 of 29, inventing 3, with all three `castingV2.*` kinds missing because `castingV2` contains a digit (`398defe3`); the env-var and flag inventories were two readers of one source with different shape coverage, so 25 of 29 flags — including `CASTING_V2_SCOPE` — were absent from the env list the flags are drawn from (`56755371`). **The class is worth more than the four instances: a regex standing in for something the code already states is working law 4 inverted, and it reports a complete list either way.** Every collector that can now come up empty THROWS rather than returning a short list, and each has a second reader that does not share its resolver.

⚠ **AND THE FOURTH OF THOSE COLLECTORS WAS MEASURED THAT SITTING AND NOT FIXED — the sentence above named three and closed with a clause that was false of the one it did not name.** The price reader was `/(\w+)\s*:\s*(\d+)\s*,/g` over ONE file, and it held **10 rows against the 32 the product declares across five modules**. Absent: `CASTING_V2_REFINE_PRICE_CREDITS` (a top-level const, and the most-charged operation there is), `CASTING_V2_ROLL_PRICE_CREDITS` (160) and `CASTING_V2_SIGN_PRICE_CREDITS` (450) — **the two numbers this program quotes most, both of them arithmetic** — the entire eight-price wardrobe table, `INK_ADD_PRICE_CREDITS`, and `flashMultiplier: 0.5`, which `\d+` followed by a comma never matched. Present and not a price: `rollCandidateCount: 8`. Present and unattributable: `cost:view` said 50 and never said 50 of WHAT. **It was left because the fix appeared to need a rule for what counts as a price, and inventing a taxonomy is not a mechanical act — the repair is that the question is DISSOLVED rather than answered**: every number is emitted keyed by its declaring constant and its module (`cost:server/casting/castingCreditCosts.ts:CASTING_V2_COSTS.rollCandidate`), so the reader sees the provenance and judges, and nothing is dropped for failing a definition nobody wrote down. Fixed 2026-08-23; the second reader IMPORTS the cost modules and compares the values TypeScript evaluates against the artifact, because a fold and a parse must not share a resolver (`server/architectureCreditCosts.test.ts`). Two things it now refuses rather than skips: an empty price list, and **two rows claiming one id** — the first shape of the fix keyed on the constant alone and silently attributed the SERVER's `CREDIT_COSTS.castingImage` to the client file, because `client/` sorts first. **The client's own `CREDIT_COSTS` copy is in the price list on purpose** (`client/src/features/casting/constants.ts`): a price list that cannot show you a second copy of the prices cannot show you the thing about prices that most matters, which is working law 4.

## The Capability Atlas — kept current after every change (founder law, 2026-08-22)

> *"as we develop the studio … this atlas must be kept up to date after every
> change"* — verbatim, ratified fable-1359.

`docs/architecture/capability-atlas.{json,md}` is the map an agent reads to
understand how the casting studio works — the roads, the doors (every refusal,
gate and free answer, each with its extracted `file:line`), the flags, the laws,
and a driven corpus recording what the real refine entrance actually does with
canonical asks. **A capability change ships with its map entry in the same
commit**: a new door gets a corpus row, an `UNREACHABLE_DOORS` reason, or (a
founder-visible act) a `KNOWN_DEBTS` line; moved copy, routing or flags get
their rows re-driven or their beliefs corrected.

**This is enforced, not remembered**: `pnpm capability:check` runs inside the
deploy rite on every push and inside `pnpm test`, and an unmapped door is an
ERROR — the push does not fire (proven able to fail by sabotage the day the law
landed: one deleted debt line, exactly one refusing error). `KNOWN_DEBTS`
(`scripts/capability-atlas-corpus.mts`) is the enumerated remainder and it only
shrinks — a debt that becomes reached or documented errors until its line is
deleted. The roads' prose is hand-written but its citations are validated
against source at generate time; a road citing a door, flag or entrance the
code does not have refuses to generate. Regenerate with
`pnpm capability:generate` (static) or `--drive` (re-drives the corpus through
the real entrance, cents of text calls, never a credit — the ledger arm refuses
a run that spends).

## Architecture

Single Express server serves both the tRPC API and the client (Vite middleware in dev, static `dist/public` in prod). Entry: `server/_core/index.ts`.

- `client/src/` — React 19, wouter routing (patched via `patches/`), TanStack Query + tRPC v11 client (`lib/trpc.ts`), Zustand stores, Tailwind v4, framer-motion, React Flow (`@xyflow/react`) canvas, three.js hero
  - `pages/` — route components (routes defined in `App.tsx`)
  - `features/<domain>/` — feature modules (casting, wardrobe, boards, studio, admin, moderator, billing…) with `hooks/`, `stores/` (Zustand, named `useXxxStore`), `components/`
- `server/` — Express + tRPC
  - `_core/` — bootstrap (`index.ts`), env access (`env.ts`), session cookies (`cookies.ts`), JWT session sign/verify (`sdk.ts`), Vite integration (`vite.ts`), tRPC setup (`trpc.ts`, `context.ts`)
  - `routers.ts` — combines feature routers from `routes/` (admin sub-routers in `routes/admin/`)
  - `routes/` — tRPC feature routers + plain Express routes for auth (cookie-setting: `emailAuth.ts`, `googleAuth.ts`, `emailVerification.ts`) and `imageProxy.ts`
  - `db/` — Drizzle ORM queries per domain; shared pool in `connection.ts` (MySQL via mysql2)
  - `casting/` — Gemini image-generation pipeline (queue, circuit breaker, prompts)
  - `wardrobe/` — garment digitization / VTO pipeline
  - `storage.ts` — file storage on Cloudflare R2 via the S3 SDK (`storagePut`/`storageGet`/`storageDelete`; callers pass relative keys). Served URLs are public bucket URLs (`R2_PUBLIC_URL`), **not** presigned — they are persisted in DB records, so they must never expire. Static app assets (logos, swatches) live under `assets/` in the bucket, referenced via `ASSETS_BASE_URL` in `shared/const.ts`.

Tests live next to server code as `*.test.ts` and run with vitest against a node environment. `vitest.setup.ts` loads `.env` for tests but **strips `DATABASE_URL`** so unit tests can never touch the live Railway database — suites that need a DB skip unless a disposable `TEST_DATABASE_URL` is provided. Suites that hit a running server over HTTP are named `*.integration.test.ts`, excluded from `pnpm test`, and run via `pnpm test:integration` (config: `vitest.integration.config.ts`).

### Auth

Two login paths, both ending in a JWT (jose, HS256, signed with `JWT_SECRET`) set as the `app_session_id` cookie (`shared/const.ts`):

- Email/password (`routes/emailAuth.ts`): register requires a beta/invite code, then email verification via Resend (`routes/emailVerification.ts`), then admin approval (`approved` column) gates login.
- Google OAuth (`routes/googleAuth.ts`): needs `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.

`sdk.ts` handles session JWT sign/verify only (no external OAuth server). `verifySession` requires a non-empty `appId` in the JWT payload, which is why `VITE_APP_ID` must be set. A session whose user is missing from the DB is rejected outright. Owner notifications (`_core/notification.ts`) go to the Slack webhooks (#admin-actions, falling back to #security-alerts) and log a warning when none is configured.

## Access control — expected behaviour

Who may do what, and **where that must be enforced**. Current findings: `docs/specs/SECURITY_AUDIT_2026-07-25.md`.

### Capability grid

| Resource | Anonymous | Signed in, unapproved | Signed in, approved | Moderator | Admin |
|---|---|---|---|---|---|
| Models / casts | none | none | read/write/delete own | generation metadata only¹ | same as moderator¹ |
| Boards, items, edges | none | none | read/write/delete own | none | aggregate counts only |
| Wardrobe | none | none | read/write/delete own | none | aggregate counts only |
| Credits / billing | price lists only | none | read own, checkout own | read any transactions (support) | adjust any |
| Registry (minted casts) | none — route deleted² | none | none | none | none |
| Audit logs | none | none | none | read any | read any |
| Admin actions | none | none | none | none | write any |

¹ Admins pass the moderator middleware (`moderatorProcedure`, `server/_core/trpc.ts`), so they inherit the entire moderator surface — there are no separate admin content endpoints for casts, boards or wardrobe. The generation history and its CSV export carry `hasResult`, never the image URL (closed 2026-07-30, `b186bff`; guarded by `server/staffImageBoundary.test.ts`).
² The former `registry.lookup` / `registry.verify` namespace has been deleted from the root router. Absence tests prevent it from being silently restored.

Resources not in the grid (profile, referrals, bug reports, invite codes, announcements…) default to **owner-only for users, none for staff**; anything broader is a deliberate, documented exception.

⚠ **AND THERE IS NOW EXACTLY ONE SUCH EXCEPTION, ENUMERATED HERE THE DAY IT SHIPPED: BUG REPORTS ARE READABLE BY AN ADMIN** (2026-08-30, #255). It was asked for and granted rather than assumed — his ruling, verbatim and entire: *"D is the right long-term answer probably in the admin panel first not the moderator panel yet. no point taking shortcuts."* The road it corrects is a **path-ONE** death read at the bytes (`git log -S`: `getBugReports`, `listBugReports`, `from(bugReports` have never appeared in this repository's history on any branch): `bug_reports` was written by the lobby's *Send feedback* / *Report a bug* menu and had **no `select` anywhere in the product** — no procedure, no surface, no export — while the Slack notification that was meant to be its read path pointed at a webhook production has never had. A customer typed what went wrong, was told *"Bug report submitted. Thank you!"*, and it reached nobody. Live population at the fix: **zero rows, all time** — nobody had been failed yet, which is luck rather than design and is why he took the long answer over the one-variable Slack patch. **The exception is ADMIN and its narrowness is structural rather than promised**: `moderatorProcedure` would have shipped the moderator surface he DEFERRED while looking like obedience, because admins inherit that middleware and no admin account could tell the difference — so the declaration is the whole control and `server/bugReportInbox.test.ts` pins it with a positive control. **Three things are deliberately absent** and each is its own second decision: no moderator surface (his *"first"*, not *"only"* — the db reader takes no role argument, so it is a second procedure later rather than a rewrite), **no delete** (`resolved` and `dismissed` both KEEP what she said; removing a person's words is a founder decision, not a queue button), and **no export** (where a customer's prose may travel was not what he was asked). ⚠ **The audit row names the id and the transition and NEVER the `description`** — the audit log is a staff-wide surface with its own MODERATOR readers, so copying the prose there would widen this exception through a side door to the exact role he deferred, with nothing on the bug-report surface looking wrong. That is the arm most worth keeping.

Unapproved accounts are *intended* to be able to sign in and redeem an access code, and nothing else — no generation, no board writes, no billing. **Enforced on the API since 2026-07-30.** `protectedProcedure` is `requireUser` (auth, suspension, lockout) plus `requireApproved`; an unapproved account gets `FORBIDDEN` from every protected procedure in real time, the same way suspension works.

The exemptions are enumerated, and adding one is a deliberate decision like adding a public endpoint: `access.redeem` and `access.status` use `onboardingProcedure` (signed in, approval not required) — gating those would make approval unreachable, since the account could never redeem the code that approves it. `auth.me` and `auth.logout` are `publicProcedure` and were never behind this gate. `server/approvalGate.test.ts` proves both the block and every exemption, and pins the exempt list; the Atlas reports them as `onboarding-endpoint` findings.

Still true, and now the reason it matters is narrower: `/api/auth/verify-email` mints a session without an approval check (invariant 9's counterexample). That session is now inert for everything but the onboarding surface, but the issuance site is still an unenumerated one.

**"Metadata only" is a boundary, not a convenience.** Staff roles may see that a generation happened — kind, timestamp, credit cost, status — for support, billing and abuse work. They must not be given the creative content: `masterPrompt`, `technicalSchema`, `preferences`, or the images. Do not add those fields to a moderator or admin projection. Both halves hold as of 2026-07-30: the moderator generation history carries `hasResult` rather than `resultUrl`, and the URL is never selected in the first place, so reintroducing it takes a deliberate edit. `server/staffImageBoundary.test.ts` guards it.

### A customer's cast is their work — founder ruling, 2026-07-25

> *"If a marketing team or content creator comes on the platform and makes a model that's theirs, no one should be able to steal or copy that work."*

This is a product commitment, and it governs anything that could expose a cast:

- **Never expose `masterPrompt`, `technicalSchema` or `preferences` outside the owning account.** Together they are the complete recipe for reproducing the cast. This is the single most sensitive field group in the product — treat it the way you would treat a password, not the way you would treat a caption.
- **The former public Cast registry is deleted.** `registry.lookup`, `registry.verify`, their root-router namespace, and the projection that exposed identity documents are gone. Do not reinstate a public registry without an explicit founder decision on shape.
- **Generated images sit at permanently public R2 URLs.** By design (`server/storage.ts`'s header, *"not presigned"*), because URLs are persisted in database records. In practice a cast's images are protected only by the URL being hard to guess, and anyone who ever obtains one keeps access until the object is deleted. Every current `storagePut` writer uses `crypto.randomUUID()` and a repository-wide guard rejects `Math.random()` in storage writers. See M7 — whether images move behind authentication is still an open decision.

### Enforcement invariants

The grid says *what*; these say *where*. The grid alone would not have caught any of the defects found in July 2026 — every one of those procedures "knew" the rule and applied it in the wrong place.

1. **Scope the owner in the statement that reads or writes.** A `SELECT` to check ownership followed by a write keyed on id alone is insufficient — it leaves a check-then-write race and it is what went wrong. Pass `ownerId` into the db helper and put it in the `WHERE`, or scope through the parent with a join or subquery. (D-64's *"Deletion boundary"* paragraph, `docs/specs/DECISION_LOG.md`.)
2. **Re-anchor child ids to the owned parent in that same statement.** Verifying `boardId` does not validate the `itemIds` sent alongside it.
3. **`userId` always comes from `ctx.user.id`** — never from procedure input. Applies to record scoping, credit spend, quota, and rate-limit keys.
4. **`.strict()` on every input schema**, so unknown fields are rejected rather than silently dropped. ⚠ **THE PAIR OF NUMBERS THAT LIVED HERE WAS MEASURED BY AN INSTRUMENT THAT COULD NOT SEE FOURTEEN OF THE PROCEDURES IT WAS COUNTING, AND TOLD 32 OTHERS A SENTENCE THAT WAS FALSE OF THEM** (2026-08-23, `server/architectureProcedureShapes.test.ts`). Read now at a fixed extractor: **270 procedures — 99 closed, 132 open, 39 with no `.input()` at all**, and the Atlas raises `non-strict-input` for the **132** that are open and not public. (The figures before these were 89/142/39 with 137 findings, true of the tree one commit earlier: closing the public five moved five, and closing the billing five below moved five more.) What moved and why: an inline nested router (`applyModelEdit: router({ plan, execute })`) was collected as ONE procedure whose type, auth and input state came from whichever child appeared first in the source, so seven of `boardOps.ts`'s properties stood in for fourteen real procedures and **every boards WRITE was recorded as a `query`**; `strictInput` was `/\.strict\(\)/` over the whole chain, so a named schema (`.input(operationIdInput)`, strict one file away) read as open in five places and `.strict()` on a nested field would have read as closed; and `false` was answering two questions, so 32 procedures with NO input schema were told *"unknown fields are silently dropped"* when tRPC never hands a handler an input it has no parser for. The field is three states now — `strict` / `open` / `none` — and only `open` is a finding. ⚠ **AND THE CLAUSE THAT USED TO OPEN THIS BULLET — *"required on all new code and all public/auth/billing schemas now"* — IS NOT A DESCRIPTION OF THE PRODUCT AND WAS READ AS ONE.** It is the rule going forward; the measured state was that **five of the twelve public endpoints were open** (`access.validate`, `newsletter.subscribe`, `referral.validate`, `system.health`, `waitlist.join`) — ✅ **ALL FIVE ARE CLOSED as of 2026-08-23** (ruled fable-1435 §2: *invariant 4 already mandates strict on public surfaces; this is enforcement, not policy*), each one read at its CALL SITES first, because tightening a schema can reject an in-flight client: three of the five have no client caller at all, `access.validate`'s single caller sends `{ code }` alone, and all four `waitlist.join` callers send a subset of the declared fields. `server/publicInputStrictness.test.ts` proves it by PARSING an undeclared field through the real routers rather than grepping for the token — the Atlas's own `strictInput` was a substring test for months, so a second reader looking for the same string learns nothing the first one did not already believe. ✅ **AND THE BILLING FIVE ARE CLOSED TOO as of 2026-08-23** (`changePlan`, `createSubscriptionCheckout`, `previewPlanChange`, `getInvoices`, `getAllInvoices`; ruled fable-1446 on opus-1104's reading). ⚠ **The sentence that held them open was `changePlan`'s own deploy-skew comment, and it argues the other way once read**: it describes a field being ADDED and made optional so an older bundle that omits it still works, and **`.strict()` rejects an UNKNOWN key — it says nothing about a MISSING optional one.** Only one direction of skew exists (an old bundle against a new server), and it bites only when a field is REMOVED; this change removes nothing, and all five call sites were read before it landed. `.strict()` sits INSIDE the `.optional()` on the two invoice readers, because `ZodOptional` has no `.strict` in zod 4 — the tempting repair is to drop the `.optional()`, and `BillingTab` calls `getAllInvoices` with no input at all. `server/publicInputStrictness.test.ts` proves both halves by parsing through the real routers, and the arm that matters is the POSITIVE one: strict on the wrong object passes a rejection arm by rejecting customers. **Still open** are `auth.deleteAccount` and `access.redeem`. ⚠ **AND CLOSING THEM CHANGED THE REMOVAL CONTRACT, which is the real content of that commit and is the rule going forward: A BILLING INPUT FIELD IS REMOVED ONLY AFTER CLIENTS HAVE STOPPED SENDING IT FOR ONE FULL DEPLOY, NEVER IN THE COMMIT THAT STOPS SENDING IT.** Until now an unknown key was silently dropped, so deleting a field an in-flight bundle still sent cost nothing; with `.strict()` on, it is a BAD_REQUEST on a money surface mid-deploy. The tolerance was accidental and nobody had ever had to think about it — that is an argument for writing the rule down at the same moment, not against the strictness. The two numbers before these were "82 of 263" and "56 of 237"; each was true of the instrument that produced it and neither was true of the product. `pnpm architecture:generate` reports the current figure. See M4.)
5. **Public endpoints are an enumerated allowlist.** Each is rate-limited, `.strict()`-validated, and structurally unable to mutate another user's data. Adding one is a deliberate decision, not a default. The current list (mechanically verified by the Atlas, 2026-07-30 — `pnpm architecture:generate` reports it as `public-endpoint` findings): tRPC `system.health`, `auth.me`/`logout`, `billing.getPlans`, `credits.getCosts`, `generation.costs`, `announcements.getActive`, `waitlist.join`/`getStats`, `newsletter.subscribe`, `access.validate`, `referral.validate` — twelve, matching this list exactly. (`generation.costs` was documented here as `generation.castingExport.costs`; that is the file it is declared in, but `castingExportRouter` is merged into `generation` by procedure spread, so the callable id has no `castingExport` segment.) Express: the auth routes, `/api/auth/verify-email`, `/api/health` (IP-rate-limited), `/api/hero/*`, `/api/webhooks/stripe`, `/api/slack/interactions`. **SIX** Express routes are **authenticated and user-rate-limited** rather than public, and this is the enumerated list of those too — `/api/image-proxy`, `/api/evidence/:kind/:entityId`, `/api/cast/:castId/sheet`, `/api/ink-design/:designId`, `/api/reference/:referenceId` and `/api/crew/eye-frame/:frameName`. The evidence route additionally re-proves the child, live Cast, and owner in one database statement; the sheet route re-proves owner and liveness in the statement that loads the Cast; the ink-design route re-proves the owner on both sides of the design→candidate join and additionally refuses to serve bytes whose sha256 is not the one its row records. **`/api/reference/:referenceId` is the fifth and it was added to this sentence in the same commit that created it** (2026-08-22, countersigned fable-1423 §2) — it serves a photograph the CUSTOMER attached, on the ink-design route's shape clause for clause, with the owner in the WHERE beside the public id and the same sha256 refusal. It exists because there is no public address for a customer's photograph and there should not be: `askReference` returns a storage key and never a URL, so the Use chip drew a broken glyph until this route did. It serves the ATTACHMENT and never the carrier cut from it — the carrier is minted under a cleanup manifest and swept, so a thumbnail pointing at it goes broken with age. **Two of the first four were absent from this sentence until 2026-08-20** — the character sheet since it shipped, and the ink-design route would have been on the day it landed — which is the failure the list exists to prevent (fable-1138 §2b: a route that exists but is not on the list is how the list stops being the list), and it is why the fifth arrived on the list and in the code together. **`/api/crew/eye-frame/:frameName` is the sixth and arrived the same way** (2026-08-25, issue #75 — the founder's eye gallery on `/admin/crew`): admin-role-only, inside `CREW_TAB_SCOPE` (outside it the answer is 404, the same does-not-exist the page itself gives), and its servable keys are EXACTLY those the deployed briefing's `eyeItems` name — the briefing ships inside the bundle, so the allowlist changes only by a deploy, and a request for any other key under the prefix is 404 whatever the bucket holds. The former registry namespace is absent.
6. **Rate limits return a real `TOO_MANY_REQUESTS`**, not a 200 carrying an error field the client cannot distinguish from a validation failure.
7. **A control that is not invoked does not exist.** If you add a protection, something must call it on the request path, a test must prove it *blocks*, and it must refuse — not allow — when a dependency is missing or unconfigured.
8. **Read paths return an explicit projection.** Never let a bare `select()` or a spread DB row cross the serialization boundary — that is how `passwordHash` reached `auth.me` and image URLs reached the moderator surface. Sensitive field groups stay out by construction, not by callers remembering to omit them.
9. **Every route that mints a session cookie enforces the same gates as login.** `/api/auth/verify-email` issuing sessions without the approval check (M8) is the counterexample. A new issuance site is an enumerated decision, like a new public endpoint. ⚠ **AND IT WAS CALLED ENUMERATED WHILE NO LIST EXISTED AND NOTHING COUNTED THEM** — the public-endpoint list this sentence compares itself to is written out name by name; invariant 9's was neither written nor checked, so a `res.cookie(COOKIE_NAME, …)` in a new module would have shipped green. Read at the code and armed in the same commit (2026-08-23, `server/sessionIssuanceSites.test.ts` — the population derived from the writes, the count and the module names read back out of this sentence): **there are FIVE, in three modules**, and the gates each applies at the mint are these. `emailAuth.ts` mints twice — at **login**, behind the suspension/lockout check, `emailVerified` for email-provider accounts, and `approved` with admins exempt; and at **register in development only** (`NODE_ENV === "development"`), where the account is already approved because the beta code was redeemed two statements earlier and it is the EMAIL check alone that is skipped. `googleAuth.ts` mints twice — for a **returning user** behind suspension/lockout and `approved`, an unapproved account with a valid code having it redeemed on the spot (which approves it); and for a **new user** whose beta code is validated and redeemed before the mint, a failed redeem redirecting instead, so approval holds by construction. `emailVerification.ts` mints once, on `/api/auth/verify-email`, behind a valid unexpired token **and nothing else** — that is the counterexample above, and it is why the session it issues is inert for everything but the onboarding surface. A sixth site, or a mint from a module not named here, reddens the suite; a gate moving *inside* one of the five does not, which the guard's own docblock says rather than leaving to be assumed.

### Currently not enforced — do not rely on these

Documented and believed working; verified inert. Fixes are queued post-R7:

Each now carries the ROAD it took, read off the git history 2026-08-19 rather than assumed — because "never finished" and "demolished by accident" argue for different answers, and this list had them all filed as the first:

- **Admin allowlist** (`server/security/adminSecurity.ts`) — admits everyone when empty, and it is empty in production. Admin access is role-only. **Road: invoked, inert by configuration.** `isOnAdminAllowlist` IS called on every admin request, through `validateAdminAccess` in `adminProcedure` (`server/_core/trpc.ts`) — it is the empty-list early return that admits everyone. This is the only one of the three whose entry here was already right.
- **Slack approval for sensitive admin actions** — the sensitive procedures in `server/routes/admin/users.ts` execute directly, and the approval flow self-approves when Slack is unconfigured. ⚠ **Road: NEVER WIRED — and this bullet said "WIRED AND LOST TO A REFACTOR" from 2026-08-19 until 2026-08-23, which was the wrong road told confidently.** It claimed `isSensitiveAction` "had a live call site in `server/routers.ts`" that `3cb0cdee` (2026-02-07 03:35) dropped in the 4,209-line file split. Read at the bytes instead of at the import graph: `routers.ts` mentioned the symbol **exactly once, on its import line**, from `8d6531ba` (2026-02-06, the commit that created it) to `3cb0cdee`; `git log -S "isSensitiveAction("` changes count at the declaration and never again, so nothing outside `adminSecurity.ts` has ever called it. **The file split removed a dead import and was correct.** What made the mistake possible is worth more than the correction: an importer COUNT fell 1 → 0 and nobody opened the importer — the un-wiring differ's own stated bias (3), firing on the specimen the differ was celebrated for. The reader no longer counts a dead import (2026-08-23); the other three path-three deaths were re-read the same day with their call sites quoted, and all three hold. **The rest of the approval flow is untouched by this correction and is wired**: `getApprovalStatus`, `markExecuted` and `markFailed` each have two live consumers under an alias. What is missing has always been the same one thing — something on the request path asking whether an action is sensitive.
- **IP blocking** (`server/db/ipBlocking.ts`) — blocks are recorded, never checked during a request. **Road: never wired**, confirmed at birth: in `098de49d` the only non-test caller of `isIpBlocked` was `blockIp` itself checking for a duplicate, and `docs/RATE_LIMITING.md` was updated in that same commit to describe the request-path check that was never written.
- **The "immutable" audit log** (`adminSecurity.ts`) — invoked, but the hash chain is in-memory (resets every deploy) and its Slack backup no-ops when Slack is unconfigured. There is currently no tamper evidence.

Most of these followed the same path: helper or rule written, docs written, todo ticked, call site never added — and the last is the nastier variant, invoked but inert under the current configuration. **There is a third path, and it is the hardest of the three to catch, because at no point did anyone skip a step: written, wired, live — and then orphaned by a change aimed at something else entirely.** **THREE** instances are on the record and none of them was carelessness — the credit-velocity caps (killed by removing the topup product, `41a765ea`; call site read inside `createTopupCheckout`), the refused-frame diagnostic capture (killed by the founder's own catastrophic-only refund ruling, `5c5a1f3f` — a CORRECT ruling that took a control with it, which is the harshest form), and **the site-wide login-attack detector — killed 2026-04-03 by `b1f5187d`, the commit that removed the Manus OAuth platform, and NOT FOUND UNTIL 2026-08-22** (see the paragraph below, whose road this corrects). That third one is the one this list should be most uncomfortable about: it sat here for months described as a control that was *never wired*, which is the gentlest of the three roads, when it had in fact run in production for two months and been demolished. ⚠ **And a FOURTH sat on this list from 2026-08-19 to 2026-08-23 that never belonged on it at all — the sensitive-action gate, moved here from *never wired* on the strength of an importer count that fell 1 → 0 while `server/routers.ts` mentioned the symbol only on its import line.** It is back where it started. **The two errors are mirror images and the same mistake: a road asserted from a graph instead of read at the bytes.** One under-read the history, one over-read a number; the repair for both is `git log -S` and opening the file. **A list that files a path-three death as a path-one death is not merely incomplete — it is pointing every future repair at the wrong question.** **An import-graph reading that only asks "does anything call this" cannot tell a control that was never wired from one that was UN-wired, and only the second kind has a commit that can be found and read.** ✅ **THAT WAS THE LIMIT FOR SIX MONTHS AND IT IS SOLVED — 2026-08-22.** The sentence stays because it is what stood while all three deaths above went unnoticed; what has changed is the tense and the tool. The missing ingredient was never cleverness, it was **TIME**: read the import graph at TWO trees — one checked out in a `git worktree` — and a symbol that had production importers then and has none now was UN-wired, with `git log -S` naming the commit. `scripts/diff-importer-count-across-time.mts` is that reading, and the retirement program runs it over its own window before any sitting closes (fable-1349 §3): the Atlas answers *"does anything call this"*, the differ answers *"did something STOP"*. It counts **importers**, not the uncalled-export sweep's flagged set, because a self-consulted symbol's self-use count never moves and that sweep therefore excludes it at both ends. ⚠ **The example that sentence used to carry was `isSensitiveAction`, and it was the wrong example — corrected 2026-08-23.** Its importer count did fall 1 → 0, and the importer was a DEAD IMPORT, so the fall meant nothing; **the reader no longer counts one**, with the specimen kept as a NEGATIVE control on both entrypoints (it must not be reported). Its proof is REAL controls rather than fixtures: given the February window it rediscovers `addTopupCredits` and `getRecentTopupCredits` — each with its call site quoted before it was believed — refuses to report `logAdminAction`, which kept its importers (1 → 4), and refuses to report the dead import. Its limits are stated in its own docblock and they all point the same way — a call site that still exists but sits after an early return is invisible to it too (`recordInkFormDemand`), so **a clean run is a floor and not coverage.** ⚠ **AND ONE OF THOSE STATED LIMITS WAS A HOLE THE SIZE OF THE DATABASE LAYER — CLOSED 2026-08-23.** The docblock listed namespace imports among the things it did not resolve, in one clause beside dynamic specifiers, as though it were an edge case; `import * as db from "../db"` is the house style of every database call this product makes. Measured at the real tree the hour it was fixed: **33 production-wired server exports counted ZERO importers** — among them `isAccountLocked`, `recordFailedLogin` and `resetFailedLogins`, which are **the account lockout that both login routes call and that invariant 9's own sentence names**, plus 28 board operations reached through a single `ops.` alias. **A symbol already counted at zero can never be seen to FALL to zero**, so on the day that lockout died this instrument would have reported silence — the "toward silence" direction, on the control that stops credential stuffing. The reader resolves the hop now (a RELATIVE binding, the member declared in that module or one it re-exports from, ONE hop; a barrel of barrels still reads as no importer and has its own arm), proven by seven arms in `server/unwiringDiffer.test.ts` that redden exactly and only under deletion of the line the reading cannot exist without. **No verdict on the record moves, and that is the honest shape of THAT repair**: a full-history re-read at stride 10 returns the same 26 un-wired symbols before and after, so nothing namespace-wired has ever actually died here — the hole had not yet been paid for and now cannot be. ⚠ **The dead-import repair the same day is the opposite, and it is why the sensitive-action gate above changed roads**: 38 dead imports across 36 symbols at HEAD and 11 rows changed class — `checkUserRateLimit` losing a four-month "dark window" it never had, `isSensitiveAction` losing its death, and **six symbols the reader called WIRED that nothing calls at all**. **A reader may be wrong toward noise as well as toward silence, and only one of those two errors gets written into a document as a fact.** **It was in exactly one of the three import-graph readings, which is why it survived**: the uncalled-export sweep classifies a `barrel` reach explicitly, and the Atlas's edges are module-granular, so an `import * as` has always been an edge to it. Invariants 7 and 8 exist because of them. The grid above was re-verified cell-by-cell against the code on 2026-07-25.

**One has left this list — and it was never on it, which is the part worth noticing.** The site-wide login-attack detector (`recordGlobalFailedLogin` / `shouldSendGlobalAttackAlert` / `markGlobalAttackAlertSent`) had no call site anywhere in the product for months, and **this list did not name it** while `docs/RATE_LIMITING.md` carried a worked example of the wiring that had never been done. So the honest record was incomplete and the dishonest one was confident. ⚠ **THAT LAST CLAUSE WAS WRONG, AND IT WAS WRONG IN THE DIRECTION THAT MATTERS — CORRECTED 2026-08-22.** The wiring HAD been done. `8830fc95` wired it on 2026-02-05 and it ran on the request path for nearly two months: `server/_core/index.ts` imported `registerOAuthRoutes` from `server/_core/oauth.ts`, which called all three symbols at **both** failed-login exits, notified the owner and wrote an `ABUSE_GLOBAL_ATTACK` audit row. It was killed on 2026-04-03 by `b1f5187d` — *"Removed all Manus OAuth references: deleted `server/_core/oauth.ts` (343 lines) … **All 64 auth tests passing**"* — a commit aimed at the Manus platform, correct on its own terms, which deleted the file the control lived in and left no failing test and no error. **So this is a path-THREE death, not a path-one**, and the four-and-a-half months of silence that followed (2026-04-03 → the re-wire on 2026-08-19) are what the "for months" sentence was actually describing. The honest record was not merely incomplete: **it had the road wrong, which is worse, because "never wired" invites you to write the wiring while "un-wired" hands you a commit to read.** Found by `scripts/diff-importer-count-across-time.mts` on its first full pass over the product's history — the instrument named three paragraphs above, doing the one thing that paragraph used to say could not be done. **Wired 2026-08-19** by founder ruling (*"wire and explain in plain english"*): `server/security/loginAttackAlert.ts` is the call site, and the login route calls it from **both** failed-login exits — including the unknown-email exit, which is the one credential stuffing mostly hits. **It lands on the admin and moderator panels, not in Slack** — his own follow-up ruling the same day (*"slack isnt connected needs to eb wired into admin /mod panels"*), and he was right: production has no Slack webhook, so the first version of this wire was itself an inert control of exactly the kind this list names. It writes an `abuse.global_attack_detected` audit row — no new surface, no widening of the grid above, no migration — and that action is added to the panel's abuse CATEGORY in the same commit, without which every row it writes would have been filtered away unseen. Its limit is stated rather than shipped quietly: **the counter is in memory and resets on every deploy**, so it catches a fast, loud attack and would miss a slow, patient one. `server/security/loginAttackAlert.test.ts` drives it directly, including the concurrent case that a sequential test cannot see.

**A second has left this list, by the other door: the credit-purchase velocity pair is DELETED (2026-08-19), not wired.** The founder was asked for one word — *wire* or *bin* — and the recommendation put to him was bin, with a deliberate pause afterwards so that *"I didn't get a chance to say"* could not be true; he did not object, and the stated default landed. `getRecentTopupCount`, `getRecentTopupCredits`, `SlackAlerts.velocityLimitHit` and `server/velocityLimits.test.ts` are gone, and `BILLING_ALERTS.md`, `SECURITY_OVERVIEW.md` and the audit's H5 say so. The reason is a product one: blocking a paying customer's top-up is a decision about how we treat paying people — what counts as too fast, what happens when someone hits it — and half of that is unanswered, so it deserves its own design rather than a wire-up. **There is now no application-side fraud cap on credit purchases, which is the honest state and is the point.**

**And the deletion turned up the fact that named the third path above.** The caps were not written-and-never-wired: they were live from `a3abdf8b` (2026-02-06) to `41a765ea` (2026-02-07), when removing the one-time topup system took `createTopupCheckout` — the only call site — with it. The helpers stayed, the docs stayed, and so did a test suite that compared local constants to themselves and therefore **could not go red when its own subject was deleted**. Its docblock even recorded that the topup packages were gone and called itself *"relevant for any future credit purchase flow"*. **A suite that cannot fail when its subject is deleted is how a dead control keeps a live reputation** — invariant 7's sibling, and worth asking of H2/H3/H4 rather than assuming their road was the first one.

## Design system conventions

- Design tokens in `client/src/styles/tokens.css`: monochrome palette (black `#0A0A0A`, surface `#EBEBEB`, white), 4px spacing grid, Inter font. Reference via `var(--token-name)`; don't hardcode colors/spacing.
- Dark theme is the default (`ThemeProvider defaultTheme="dark"` in `App.tsx`).
- App UI (studio, admin, boards): shadcn/ui primitives from `@/components/ui`, composed inside `features/<domain>/components`.
- Marketing/home pages: use `@/components/design-system` (Section, Card, Button, Typography, Grid) — these encode the Home.tsx look.
- Icons: lucide-react. Toasts: sonner. Class merging: `cn()` from `@/lib/utils`.
- Client state: Zustand stores per feature; server state: tRPC + TanStack Query only.

## Local dev setup (Windows)

1. `pnpm install` (pnpm 10; patched deps + native builds: sharp, esbuild, @tailwindcss/oxide)
2. Database is a hosted Railway MySQL — there is no local MySQL install. Get `DATABASE_URL` (the public `mysql://` URL) from the Railway dashboard.
3. Create `.env` in the repo root (loaded via dotenv; Vite reads the same file — `envDir` is repo root)
4. `pnpm db:push` to create/update tables (runs against the Railway database)
5. `pnpm dev` → http://localhost:3000

### Required .env vars (server exits at boot if missing)

- `DATABASE_URL` — Railway MySQL public connection URL (from the Railway dashboard)
- `JWT_SECRET` — session-cookie signing secret (any long random string)
- `VITE_APP_ID` — any non-empty string; embedded in the session JWT and required by `verifySession` (empty value = every login silently rejected)
- `GEMINI_API_KEY` — Google AI Studio key (all image generation)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe (test-mode keys fine locally)
- `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — Cloudflare R2 (S3 API) for all file storage (generated images, garments, avatars)
- `R2_PUBLIC_URL` — the bucket's public URL (`https://pub-….r2.dev` or a custom domain); used to build served image URLs, the CSP `img-src`, and the image-proxy SSRF allowlist

### Optional .env vars (feature-gated)

- `R7_EVIDENCE_INGEST_SCOPE` — `off`/absent, `all`, or `users:<ids>`; any non-off value fails startup unless the cleanup worker and private evidence adapter are fully configured
- `ENABLE_STORAGE_CLEANUP_WORKER=true` — required before evidence ingest can be enabled
- `R2_EVIDENCE_BUCKET`, `R2_EVIDENCE_ACCESS_KEY_ID`, `R2_EVIDENCE_SECRET_ACCESS_KEY` — dedicated private evidence bucket and least-privilege credential; uses `R2_ENDPOINT` but never `R2_PUBLIC_URL`

⚠ **THE THIRTY-THREE SCOPE FLAGS BELOW ARE INDEXED HERE AND GOVERNED IN
[`docs/architecture/FEATURE_FLAGS.md`](docs/architecture/FEATURE_FLAGS.md).**
Their entries — 122,893 bytes, two thirds of this file as it stood — moved
there on 2026-08-31 under the founder's own card (#330: *"why are simple code changes
and edits taking so long like up to an hour?"*), **byte for byte, not one word
rewritten**. Every correction and every ⚠ reversal moved with its own
paragraph, because a summary that loses a correction re-opens the mistake.

⚠ **THE CLAUSES BELOW ARE LOCATORS, NOT RULES.** Each says only which road its
flag governs, so you can find the one you need. **Never plan a flip, quote a
position, widen a scope, or answer a question about what a flag does or
refuses from this index — open its entry in the catalogue.** Where a flag
actually stands on production is in neither file: that is
`scripts/lib/productionFlagPositions.mts`, which the deploy rite compares to
the live service on every push.

| flag | the road it governs |
|---|---|
| `CASTING_V2_SCOPE` | the whole `castingV2.*` namespace — the root of every scope chain below, and spendable surface |
| `CASTING_SEGMENTS_SCOPE` | the segment store (segment permanence) |
| `CASTING_SEGMENTS_DELIVERED_SCOPE` | cutting a segment from the delivered frame's own extent rather than the master's |
| `CASTING_REFERENCE_LIBRARY_SCOPE` | the compositor swap's reference library |
| `CASTING_REPAINT_SCOPE` | the compositor swap itself — repaint instead of paste |
| `CASTING_SIDE_PHRASING_SCOPE` | whether a per-side ask also says where that side is |
| `CASTING_FACE_SCAN_SCOPE` | the face panel's auto-scan |
| `CASTING_SCAN_TABLE_SCOPE` | whether a finished scan is kept |
| `CASTING_OPEN_LANE_SCOPE` | the open lane — an ask naming its own kind |
| `CASTING_INK_STUDIO_SCOPE` | the ink studio's door — attaching a tattoo design to a Cast |
| `CASTING_INK_CUT_SCOPE` | whether an uploaded design is cut out of its picture before it is stored |
| `CASTING_INK_REGION_CROP_SCOPE` | whether the named surface, rather than the patch inside it, is what is cut |
| `CASTING_REFERENCE_ATTACH_SCOPE` | the door that takes her picture at all |
| `CASTING_HAIR_REFERENCE_SCOPE` | taking her hair from an attached picture |
| `CASTING_INK_REFERENCE_SCOPE` | whether an attached picture may be the document for a tattoo |
| `CASTING_INK_TRANSFORM_SCOPE` | whether she may change a tattoo she already has |
| `CASTING_INK_WORDS_SCOPE` | where a tattoo invented from words may land |
| `CASTING_BORN_INK_SCOPE` | whether a cast may be born with tattoos the product knows about |
| `CASTING_BRIEF_FIDELITY_SCOPE` | whether a customer's own words are rationed on the way into her sheet |
| `CASTING_CREATIVE_REGISTER_SCOPE` | whether a roll takes the author road |
| `CASTING_CONCEPT_UPLOAD_SCOPE` | upload a concept — a picture in, a description of the being out |
| `CASTING_REFINE_DISPATCH_SCOPE` | whether the paid half of a refine stops holding the request |
| `CASTING_RETRY_SCOPE` | the Retry button on a failed tile |
| `CASTING_TWO_PATHS_SCOPE` | the Wardrobe / Basics path choice — a road the founder has ruled RETIRED |
| `CASTING_DIAGNOSTIC_CAPTURE_SCOPE` | keeping the frame from a refused render for diagnosis |
| `R7_SNAPSHOT_READ_SCOPE` | the R7-7B snapshot reader rollout |
| `R7_SNAPSHOT_RESTORE_SCOPE` | the restore half of it |
| `R7_EVIDENCE_COMPOSER_SCOPE` | the evidence composer's runtime door |
| `R7_EVIDENCE_COMPOSER_RECIPE` | which recipe the composer runs |
| `R7_EVIDENCE_PACKAGE_SCOPE` | the evidence-aware package sync |
| `ENABLE_EVIDENCE_CANDIDATE_WORKER` | the composer's candidate worker |
| `ENABLE_FINAL_MODEL_DELETE` | permanent Cast deletion, for every account — a boolean with no per-user narrowing |
| `CREW_TAB_SCOPE` | the Crew tab at `/admin/crew` — his briefing and his reply box |

- `FAL_KEY` — fal.ai credential; the casting image transport (GPT Image 2 for rolls, Nano Banana Pro for identity work). `OPENROUTER_API_KEY` — text transport (brief interpreter, treatment stage) and image fallback
- `FAL_ACCOUNT_CEILING` (default 20) — the provider account's own concurrent-request ceiling, quoted from its 429. Five paths spend it and `assertFalBudget()` REFUSES TO BOOT if their sum exceeds it, or if any of them is set to zero: `ROLL_IMAGE_CONCURRENCY` 8 + `SIGN_VIEW_CONCURRENCY` 3 + `REFINE_EDIT_CONCURRENCY` 3 + `FAL_CONCURRENCY` 5 + `INK_PLATE_CONCURRENCY` 1 = 20. The plate mint's slot came out of the **courtesy** pool (region reads 6 → 5, 2026-08-18) rather than any paid path, and it costs the panel nothing at the size the reader actually runs: a face scan is 20 segmenter calls, and `ceil(20/6)` and `ceil(20/5)` are both four waves
- `FAL_CONCURRENCY` (default 5, was 6 until the plate mint was wired) — how many fal calls the segmenter may have in flight at once. The account's ceiling is **20 concurrent requests**, and one panel scan asks eleven questions with every bilateral one becoming two more, so an ungated reader spends the whole allowance on one face: measured 2026-08-14, eight panels opened at once returned no rows at all on five of them, with the provider answering `429 concurrent_requests_limit`. Below 20 on purpose — roll dispatch spends from the same allowance
- `ROLL_IMAGE_CONCURRENCY` (default 8), `ROLL_IMAGE_MAX_QUEUE_DEPTH` (default 64) — casting provider budget; roll creation refuses with a real `TOO_MANY_REQUESTS` when a whole roll would not fit
- `RESEND_API_KEY` — verification emails (signup breaks without it unless dev-mode skip applies)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth login
- `VITE_STRIPE_PUBLISHABLE_KEY` — client-side Stripe
- `OWNER_OPEN_ID`, `OWNER_NAME` — bootstrap owner/admin account
- `SLACK_WEBHOOK_URL` (+ `SLACK_ADMIN_ACTIONS_WEBHOOK_URL`, `SLACK_AUDIT_LOG_WEBHOOK_URL`, `SLACK_BILLING_ALERTS_WEBHOOK_URL`, `SLACK_SYSTEM_ALERTS_WEBHOOK_URL`, `SLACK_SIGNING_SECRET`) — alerting
- `KLAVIYO_PRIVATE_KEY` — marketing email flows
- `PORT` (default 3000), `LOG_LEVEL`, `DAILY_GENERATION_LIMIT`, `GEMINI_TEXT_CONCURRENCY`, `GEMINI_IMAGE_CONCURRENCY`, `GEMINI_MAX_QUEUE_DEPTH`

### Windows notes

- The dev script uses `cross-env` so `NODE_ENV=development` works under cmd/PowerShell.
- Shell is PowerShell; prefer `pnpm` scripts over raw shell one-liners from docs.

## Deploying while a paid roll is in flight

Production deploys when `local-migration` moves, and the founder dogfoods paid
rolls while that happens. A deploy that lands mid-roll kills the process holding
its candidates.

⚠ **THIS SENTENCE READ *"Every push to `main` deploys"* UNTIL IT WAS CORRECTED
ON 2026-09-06 — the founder's local date; the commit's UTC stamp reads a day
earlier, which is this paragraph's own point in miniature — AND IT
WAS FALSE IN THE DIRECTION THAT LETS A SHIFT REPORT A LIE** (#296, measured by
driving it: PR #294 merged at `09:46Z` and twenty-five minutes later production
was still serving the previous build — **no deployment was ever created for the
merge commit**, not failed, not building, never started). Railway watches
**`local-migration`**, and a squash merge only moves `main`, so **a merged PR has
not shipped anything.** `scripts/deploy-rite.mts` is the only thing that pushes
both refs, which makes the rite — not the merge — the act that deploys. ⚠ **And
every reading a shift naturally reaches for agrees with the merge**: `gh pr view`
says `MERGED`, `git log origin/main` carries the commit, and `/api/health`
returns `200` **from the OLD process**. That last one is the trap, and it is why
the rite prints an `UPTIME ANCHOR` beside the `200`: an old process cannot pass
as a new one silently. The production URL a health check must actually use is
`https://drape-production-0232.up.railway.app` (`deploy-rite.mts`, and the
`deploy-railway` skill) — `klieglabs.com` returns no connection and reads as an
outage that does not exist. `server/deployTriggerClaims.test.ts` keeps this
sentence and its two siblings honest, deriving the deploying ref from
`DEPLOY_SOURCE_REF` rather than restating it.

**This is a known and accepted collision class, not a bug.** Per-slice billing
plus the recovery sweep is the designed answer: a roll is eight independently
refundable units, so losing the process midway costs the user only what they
did not receive. Do NOT build drain infrastructure for it (founder ruling,
2026-08-01). `server/castingV2/deployCollision.test.ts` asserts the contract
end to end — every candidate terminal, money conserved, settled in one pass.

**What it costs the user: up to ~6 minutes.** A `running` operation only
becomes eligible for the sweep once `leaseExpiresAt` passes, so the window is
the remaining lease plus up to one 60s sweep. The lease is 5 minutes
(`DEFAULT_GENERATION_OPERATION_LEASE_MS`) with a 30s heartbeat — ten renewals
of tolerance for a live operation, which is the only thing that constrains how
short it can be.

It was 15 minutes until 2026-08-01, and the real incident (production roll
`78041664`) settled **937 seconds** after creation, six seconds after expiry.
Shortened by founder ruling D-85: a live operation renews every 30s, so the
length only ever governed how long a DEAD one kept its rows non-terminal and
its credits held.

During the window the money is safe and the recovery is correct — it is the
WAIT that is visible. Past ~2 minutes a still-casting tile says so and names
the outcome, so the wait reads as supervised rather than broken.

Full deployment procedure (services, rollback, production env vars, migrations, external registrations, known gaps): see the `deploy-railway` skill.

## Manus legacy

All Manus platform code (OAuth flow, Forge proxies, runtime/debug plugins, dead modules, deps) has been removed. The one intentional remnant: `files.manuscdn.com` / `*.cloudfront.net` stay in the CSP `img-src` (`server/security/securityHeaders.ts`) and SSRF allowlist (`server/security/urlValidator.ts`) because old DB records still reference those hosts — they go when `scripts/migrate-storage-urls.ts` is run against production at final cutover.

Gotchas that remain relevant:

- Session cookie: `sameSite` must be `lax` (not `none`) on plain-HTTP localhost — handled in `server/_core/cookies.ts`.
- `VITE_APP_ID` empty → `verifySession` rejects every session with no visible error. Keep it set.
