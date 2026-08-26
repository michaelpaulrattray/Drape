# Retry with softer wording — the rewrite road (#93, #122 shape 2)

**Status:** DESIGN, 2026-08-27 (foreman-33). Nothing built, nothing spent.
The court (§6) is priced on #93 and runs under THE SPEND THRESHOLD; the build
(§3–§5) waits on the court's numbers and on the founder's answer to the two
questions in §7. Dark behind `CASTING_SOFTEN_SCOPE` when it lands.

## 0. His words, verbatim, in date order

- #93 (2026-08-26, judging the register court): *"issue is we need to work
  around refusal also by changing our language we use so the engine doesnt
  trigger its NSFW guards."*
- Ruling rule 16 (`PROMPT_AUTHOR_RULING_2026-08-26.md`): *"let the engine
  itself refuse and refund because we dont know what will pass the engine and
  what wont. additionally our author should sanitize/re-word prompts to ensure
  they pass."*
- Crew reply #8 (#129): *"measured word→replacement pairs into the author's
  rewrite list, visible on the expanded prompt."*
- #122 (2026-08-26 evening), the LATEST and the one that shapes the surface:
  *"(2) 'Retry with softer wording' on content-filter/copyright tiles — the
  rewrite road (#129/#93) rewords the flagged phrases, shows the change on the
  expanded prompt, re-renders the one slice; refused again → the chip says so
  and the button withdraws (one manual retry per slice, never a loop that
  charges to be refused). … Both per slice, never per roll; a retry is a paid
  render and is never automatic beyond the loop's own single built-in retry."*

The register design's §1c-pre (2026-08-25) described an AUTOMATIC rewrite
retry *before any refund*. His #122 sentence a day later says **manual, per
slice, paid, never automatic**. This design follows the later word; §1c-pre's
grammar (rename by construction, drop exposure claims, never change the
objects, disclosed never silent) survives as the rewrite's RULES.

## 1. What the customer sees

A tile that wears **CONTENT FILTER** (*Refused by the engine's content filter
· refunded*) gains one quiet button beside the class: **Softer wording**.

Tapping it costs nothing and renders nothing. The studio writes a softened
copy of that sheet's prompt (§3) and opens it on the tile in the expanded-
prompt view **with every change marked** — a removed phrase struck through,
a replacement underlined, in the customer's own paragraph and in the author's
content. Under it, one line says what was done in plain words (*"Renamed 2
garments by how they're made; dropped 1 phrase about skin showing."*) and one
button: **Cast this · 20 credits**. The prompt is editable there (ruling rule
5: *the expanded prompt is shown on the cast, editable*), so she can put a
word back before it rides.

She taps Cast: 20 credits, the tile goes back to *casting*, ONE render with
the softened words, landing in the same slot. Refused again: the 20 come
back, the chip reads *Refused again with softer wording · refunded*, and the
button is gone from that tile — one softened attempt per slice, his rule.
Delivered: the tile carries a small **SOFTENED** mark, and its expanded
prompt shows the softened text with the changes still marked, forever — the
record of what this face was actually painted from.

Worked example — his own specimen (`output/raw-prompt-reference/`). Roll the
Grok cyber-goth description at LOW: the engine refuses it (63/64 in court
#125, 4/4 in his own test). Tap *Softer wording* on tile 03. The view shows
his paragraph with *"complex black leather cybernetic eye ~~harness~~
covering"*, *"~~sheer~~ black lace ~~mesh~~ top ~~that reveals the skin
underneath~~"*, *"~~fingerless long glove~~"* struck, *"cyber-goth →
cyberpunk"* — the same edits he made by hand, which passed 3/4. He taps *Cast
this · 20 credits*; tile 03 casts; the sheet is 6/8 instead of 5/8.

**Why two taps, not one.** #122 reads as one tap (*rewords … shows the change
… re-renders*). Splitting it costs one tap and buys the thing §1c-pre and
reply #8 both insist on: the softening DROPS words she typed (exposure claims
are removed, not renamed — that is what made his rewrite pass), and a paid
render from words she has not yet seen is the silent change, only delayed by
sixty seconds. The rewrite is cents of house text; showing it first is free.
This is §7 question 1 — one tap is buildable if he prefers it.

## 2. What the product knows today (measured, not guessed)

- **Every failed candidate on production is `content_policy`** (13 of 13;
  patrol #129, 2026-08-27). The class this road serves is the only failure
  class a customer has ever met.
- **The checker is a coin per render.** Roll 222: one prompt, 5 refused, 3
  delivered; the numeric framing sentence went 2/8 one night and 0/8 the
  next (#129 §2–3). So any rewrite is measured only against a SAME-TEXT
  control in the same sitting, never against the rows.
- **fal names no word** — its 422 body is one generic sentence. The words
  that trip it are found by swap courts, never read off the wire.
- **One measured pair exists**: *"the crop just below the sternum"* (8/8
  refused) → *"collarbones"* (0/56 passed). It lives in `NEVER_WRITTEN`
  (`promptAuthor.ts`) as refuse-and-re-ask on the AUTHOR's draft. LOW makes
  no author call, so a customer's own word rides verbatim (#129 §4).
- **His rewrite is the one measured REWRITE**: refused 4/4 → passed 3/4,
  same objects. Its grammar: construction nouns for fetish-adjacent material
  words (*harness → covering*), exposure claims deleted (*sheer, reveals the
  skin underneath, fingerless glove, skin-tight*), the register word softened
  (*cyber-goth → cyberpunk*, *porcelain → pale*), decorative hardware thinned
  (*spikes, charms, chains → subtle metal details*). No body word was
  removed; nothing was euphemised.
- **A refused render costs the house nothing** (court #125: 152 refusals,
  $0). A court on refusals is priced by its PASSES.
- **The copyright class does not exist on this wire.** His orc *"Rejected
  due to copyright restrictions"* was the LEGACY studio (Gemini). fal's
  transport tells a content refusal from every other 4xx and nothing finer
  (`shared/candidateFailure.ts`). Whether fal refuses *orc / tusks / warrior*
  at all is a court cell (§6), not an assumption.
- `SAFETY_TERM_MAP` (`server/wardrobe/utils.ts`) is the wardrobe road's
  20-pair construction-noun map — the same grammar, a different engine
  (Gemini), never measured on fal. It is a SEED for the court's word list,
  not a rewrite list.

## 3. The softener — what rewrites, and how

Input: the sheet's prompt as sent (`candidate.internalPrompt.prompt`), split
into its three paragraphs by the author road's own composition (brief →
author content → locked house block; `composeFinalPrompt`). On the house
road (a follow, a chip edit, an unflagged account) the whole candidate prompt
is one paragraph and is treated as the customer's.

**The house block is never softened.** It is a tested constant, measured
0/56 on every collarbones-line arm, and a trigger inside it is #129/#130's
finding about the block, not a per-slice rewrite. If a court ever shows the
block itself refusing, the block changes for everyone at one site.

Two passes, in order:

1. **The measured-pair list, by code, free.** `NEVER_WRITTEN` grows a
   `replacement` field on the pairs that have one (today: *sternum →
   collarbones*; the pipeline-note entries have no customer-facing
   replacement and are skipped). Applied word-bounded, longest key first —
   `sanitizeDescription`'s shape, with its two proven guards (the boundary,
   the tail absorption). #129 feeds this list from swap courts only; this
   road READS it and never adds to it. **One owner** (working law 4): the
   author's draft check and the softener derive from the same array.
2. **The author, once, for the rest.** A text call (Sonnet 5 through the
   shared engine, `about: "soften"`, the interpreter's deadline) given the
   customer paragraph and the author content separately, with §1c-pre's
   rules as its instruction: rename material/garment words by how they are
   made; DELETE claims about skin showing, sheerness, tightness and
   fetish-adjacent hardware; soften register words the checker reads as a
   genre (*goth-fetish → gothic*, *cyber-goth → cyberpunk*) only where the
   court measured them; never remove a body part, a piercing, a tattoo, a
   hairstyle, an age, a sex, a heritage; never add anything. Output: the two
   paragraphs rewritten, nothing else.

**The fact reader stands between the author and the customer** (ruling
rule 4: *facts must survive; a rewording that drops or contradicts one is
refused*). Two things make this road different from the author's first
draft and both are stated here rather than slipped in: (a) EXPOSURE claims
are ALLOWED to be dropped — that is the point of the road, and his specimen
dropped four of them — so the reader's fact list is taken with exposure
claims excluded, and the dropped ones are reported to her as *"dropped N
phrases about skin showing"*; (b) everything else is held exactly. A draft
that drops or contradicts a held fact is refused and re-asked once with the
fact named; a second failure falls back to pass 1 alone. If pass 1 changed
nothing either, there is no softer wording to offer — the button is not
drawn, and the tile's line says *"No softer wording found for this one."*
Never a button that opens onto an unchanged prompt.

**The diff is computed by code** from the two texts (word-level), never
asked of the model — what is shown is what was sent.

## 4. The render — the Retry road with a different prompt

Shape 1 (`CASTING_V2_RETRY_DESIGN.md`, PR #151) already owns everything the
money needs: the failed row goes `failed → queued` by CAS, one render through
`dispatchCandidate`, operation kind `castingV2.retry`, candidate lock as the
double-tap cover, refund keyed on the retry's own reference, recovery through
the lock, fail closed. This road is that operation with THREE differences:

- **The prompt is the softened text**, written to the row's `internalPrompt`
  as `{ prompt: <softened>, resolved, softened: { from: <original>, changes,
  summary, by: "list" | "author" } }` — per candidate, so tile 03's record is
  tile 03's and the other seven keep the sheet's prompt. `promptOfInternal`
  is unchanged (it reads `prompt`); the projection reads `softened` for the
  mark and the diff.
- **Admission is the mirror of shape 1's**: `content_filter` kind only,
  `softened` absent on the row (one per slice), the softened prompt supplied
  by the client FROM THE PREVIEW (so an edit she made in the view is what
  rides) and re-checked server-side against the same softener output's
  bounds — the house block byte-identical, length inside
  `BRIEF_TEXT_MAX_AUTHOR_ROAD`, and `neverWrittenIn` clean.
- **The refund class is kept honest**: refused again → `failureClass:
  content_policy` with `softened` on the row → the projection's line reads
  *Refused again with softer wording · refunded* and `isRetryableFailure`
  stays false, so no plain Retry appears either (the coin-per-render question
  is his, #122).

Kind: reuse `castingV2.retry` with `payload.softened: true` rather than a
new operation kind — one money path, one recovery road, one census line;
the payload flag is what the ledger reads. (§7 question 2 if he wants the
softened retries counted apart.)

Price: `CASTING_V2_RETRY_PRICE_CREDITS` (20). Nothing new to
`assertFalBudget`: one render on the roll road's own allowance, one text call
on the interpreter's transport.

## 5. Flags, walls, what does not change

- `CASTING_SOFTEN_SCOPE` — `off`/absent, `all`, or `users:<ids>`. Off, the
  button is not drawn and `castingV2.soften` (the free preview) answers
  NOT_FOUND. Parent `CASTING_RETRY_SCOPE`: the render IS a retry, and an
  account that cannot retry has no operation to soften into. Production
  `off`; `users:1` on his word, after the court.
- The first send is untouched: LOW rides verbatim (ruling rule 1); MAX's
  `FILTER_RULE` and `NEVER_WRITTEN` already guard the author's draft (#129
  step 4). This road only ever runs AFTER the engine has refused.
- No wall is added and none removed. The engine stays the judge (rule 16).
- The rewrite is never applied to a roll, a sheet, or a sibling tile —
  per slice, his word — and never automatically.

## 6. THE COURT — before the build (his order: "Court first")

**Question:** does the softener raise the pass rate, and by how much, against
a same-sitting same-text control? Secondary: which of the specimen's phrases
carry the refusal (the swap map #129 needs), and does fal refuse creature
wording (*orc, tusks, warrior*) at all.

**Arms per brief** (8 renders each, brief and block byte-identical, the
render unchanged from production's):

| arm | text |
|---|---|
| O | the prompt as refused (control, measures the coin) |
| L | pass 1 only (the measured-pair list — on most briefs identical to O, which is itself a finding) |
| A | pass 1 + the author's softening (§3), fact reader passed |
| H | his own hand rewrite, where one exists (the specimen; calibrates A against the one rewrite known to pass) |

**Briefs:** (i) the Grok cyber-goth description (63/64 refused; H exists);
(ii) roll 222's prompt (5/8, LOW, the live specimen); (iii) roll 220's
cyborg brief (2/8); (iv) the thin brief *"goth woman mid 30s"* (17/18 raw);
(v) the orc brief from his legacy test (*"powerful male orc warrior… tusks…
bone necklace… bare-chested"*) — O and A only, to learn whether fal has a
creature/copyright refusal at all.

**Then the swap map on (i)**: A's changes applied ONE AT A TIME to O (each
change alone, 4 renders per cell), which is the only way a word gets
attributed on this checker — the #125 sternum probe's shape. Cells are
capped at the eight largest changes.

**Size and price.** Main: 4 briefs × 4 arms + 1 brief × 2 arms = 18 cells ×
8 = 144 renders; swap map ≤ 8 × 4 = 32; **≤ 176 renders**. A refused render
is free; a delivered one is **$0.0557** at the roll's size (court #125 §5:
62 delivered = $3.45, read off the fal balance). Worst case (everything
passes) ≈ $9.80; expected (the control arms refuse most of theirs) ≈ $5–6.
Text: ≤ 30 author calls, cents. **Estimate: ≤ $10 house, 0 credits — under
the threshold; runs without asking, actual recorded on #93.** Fixture-level arms first (law 2): the harness's refusal counter
must see a known-refused prompt refuse and a known-passing one pass before a
verdict counts.

**Bars, stated before firing:** the road is worth building if A passes at
least 4/8 more than O on brief (i) OR (ii) (a coin-flip control can pass 3/8
on its own — roll 222 did); a swap cell is a PAIR for #129's list only at the
patrol's own bar (refused n ≥ 2 → passed n ≥ 2 in the same sitting). If A is
not better than O anywhere, the road is not built and the button becomes a
plain same-text Retry on content-filter tiles — which is the coin-per-render
question already on his desk.

## 7. Two questions for his word (on the card)

1. **One tap or two?** Recommendation: two — show the softened prompt with
   the changes marked, then *Cast this · 20 credits*. It is his own
   sentence's "shows the change" moved before the charge, and the rewrite
   drops words the customer typed.
2. **Does a softened retry count as its own operation kind** in the ledger
   and census (`castingV2.softRetry`) or as a retry with a flag?
   Recommendation: a retry with a flag — one money path, one recovery road.

## 8. What this design does NOT do

- It does not touch the first send. The author's own filter-safe writing
  (rule 16, `FILTER_RULE`) and the measured-pair list at draft time are
  #129's; a customer's LOW brief rides verbatim by ruling.
- It does not loop. One softened attempt per slice, manual, paid.
- It does not invent a copyright chip or class. That lands the day the
  transport can tell the two apart, and cell (v) is the first reading.
- It does not rewrite the house block.
