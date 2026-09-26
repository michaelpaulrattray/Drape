# The Sign engine court — GPT Image 2.5 Sunburst's edit door against Nano Banana Pro

**Card #1394. Run 2026-09-26 on his word, verbatim: _"switch out nano banana to
gpt image 2.5 sunburst and re-run the court"_ — and, the same evening, _"on the
edit door with sunburst does max reduce degradation more than high?"_.**

Driver `scripts/court-sign-engine.mts` (`--help`, `--dry-run`, refuses to spend
without `--run`, refuses a word it does not know) · frames under
`output/1394-sign-engine/` · raw rows `output/1394-sign-engine/rows-*.json` ·
every table below printed by `--phase report`, never typed by hand.

**Spent: about $28 of house money on fal, across 101 renders that arrived.** No
customer credits, no database write of any kind, no production read. The
fixtures are the DEV database's own signed casts.

⚠ **THERE IS NO VERDICT ON QUALITY IN THIS DOCUMENT, AND THAT IS DELIBERATE.**
Working law 9: *"do NOT trust the engine my eyes are king. ALWAYS."* The
conformance judge is a pointer to look, never the finding. What follows is what
the numbers say and nothing more; the contact sheets are in his gallery and the
verdict is his.

---

## Method

Every arm is handed **one string**, composed exactly once per (anchor, angle):
`composePackageViewPrompt(angle, wardrobeLine, brief)` — the product's own view
directive — plus the `\n\nView: <angle>.` line that `falQueue.ts`'s own
`generateView` appends before dispatch. The engines differ and nothing else
does. A court that compares two engines on two prompts answers a question nobody
asked.

- **The Nano Banana arms go through the product's own path**:
  `createFalIdentityEngine` → `fal-ai/nano-banana-pro/edit`, `resolution: "2K"`
  (today) and `"4K"` (#1387).
- **The Sunburst arms go through `runFalImageJob`**, which is the function
  `createFalMaskedEditEngine` itself calls. That factory pins `quality: "high"`
  and this court had to ask for `"max"` as well, so the body is the factory's
  body field for field — references as `data:` URIs, `image_size` as exact
  pixels, `num_images: 1`, `output_format: "png"` — with `quality` opened up.
- **Renders run one at a time inside a process.** A picture waiting behind two
  others reports the queue rather than the engine. The court was split across
  two processes (Nano Banana arms, Sunburst arms) against a provider that allows
  twenty concurrent requests, so neither measured the other's queue.

### What the fixtures do NOT carry, said rather than left to be found

A real Sign also appends an ink-crop clause and a feature-words clause when the
Cast has them (`packageOrchestrator.ts`). No fixture here has a selected variant
and none carries delivered ink, so both clauses compose to the empty string and
the prompt this court sends is byte-identical to the one a real retried view
would send for these Casts. It is **not** byte-identical to what a tattooed Cast
would send, and no arm here says anything about how either engine carries ink.

## Fixtures — real signed anchors from the DEV database

Read through the same rows the product's own Try again reader
(`readCastViewRenderSource`) reads: the `role: "anchor"` 1K `frontClose`, the
cast's wardrobe line off `technicalSchema` through `castWardrobeLine`, and the
source roll's `briefText`.

| key | cast | owner | anchor | wardrobe line | brief |
|---|---|---|---|---|---|
| `jericho` | model #248 "Jericho" | `verify-bot@local.test` | 1024×1536, 2.0 MB | none | *"a street casting, mid 20s"* |
| `caveman` | model #251 "Court — caveman, wardrobe path" | `outside-scope-bot@local.invalid` | 1024×1536, 2.8 MB | *"a rough animal-hide wrap draped over one shoulder, a plain hide loincloth, bare feet"* | 307 chars |
| `basics` | model #253 "Court — basics path" | `outside-scope-bot@local.invalid` | 1024×1536 | *"a plain black scoop-neck sports top … plain black fitted shorts, barefoot"* | 176 chars |

The first two carry every arm. **The third joined for the degradation chain
only**, because Sunburst refused the caveman's chain outright (below); the
default `--anchors 2` keeps every other arm exactly as it was run.

---

## CONTROLS FIRST — both pass, so the judge's verdicts are worth reading

### Positive — the judge CAN tell these people apart

A rendered view judged against a **different person's** anchor. The identity
axis must fail. **2 of 2:**

| anchor given | frame judged | identity | the judge's own words |
|---|---|---|---|
| caveman | jericho | **FAIL — as required** | *"IMAGE 1 shows a bearded man with long dreadlocks and dark skin, while IMAGE 2 shows a woman with short curly hair and lighter skin, clearly different individuals."* |
| jericho | caveman | **FAIL — as required** | *"IMAGE 2 shows a bearded man with different facial structure, while IMAGE 1 shows a clean-shaven woman; not the same person."* |

Had either passed, every identity number here would have been struck.

### Negative — the judge's noise floor is ZERO on these frames

The same anchor beside the same rendered frame, judged twice. **12
axis-judgements, 12 agreements, 0 disagreements** — including the caveman's
`angle` axis, which fails both times for the same stated reason. At
`temperature: 0` the judge repeats itself exactly.

**So a gap between arms is not noise in the READER.** It remains a fresh draw
either side; that is the other noise term and it is a stated limit, not a
measured-away one.

---

## ⚠ THE CONTROL THAT TURNED UP A DEFECT IN THE PRODUCT

Building the instrument measured the product's own judge, and the answer is a
finding of its own. `viewConformance` posts the anchor and the candidate to
OpenRouter at **full resolution** — `openrouterText.ts` does not resize — and
above roughly 8–9 MB of payload the call does not come back inside the judge's
75-second deadline.

| arm | anchor | frame MB | the product's judge read it? | how it ended | seconds |
|---|---|---|---|---|---|
| today (2K) | jericho | 6.1 | **YES** | a real verdict | 8.5 |
| **today (2K)** | **caveman** | **7.7** | **NO** | could not be reached | 149.3 |
| 4K | jericho | 19.6 | **NO** | deadline exceeded | 150.5 |
| 4K | caveman | 22.4 | **NO** | deadline exceeded | 150.5 |
| Sunburst high | jericho | 11.3 | **NO** | deadline exceeded | 150.5 |
| Sunburst high | caveman | 13.9 | **NO** | deadline exceeded | 150.5 |
| Sunburst max | jericho | 10.2 | **NO** | could not be reached | 142.3 |
| Sunburst max | caveman | 13.8 | **NO** | deadline exceeded | 150.5 |

⚠ **The second row is the one that matters most: that is TODAY'S engine at
TODAY'S tier.** A view whose judge cannot be reached is delivered `unjudged` and
charged (D-246), so this is not a hypothetical about #1387 — **it is a live risk
on the shipped path whenever the anchor and the frame are large enough
together.** The judge's own docblock sizes its 75-second deadline on *"7,578
prompt tokens measured"* and *"23.3 s and 36.3 s on his own two frames"*; these
payloads are several times that. **#1387's 4K makes it certain rather than
occasional**, on both anchors, every view.

**What the court does about it, declared rather than quietly done.** Three of
four arms would have had no quality reading at all, which is an instrument that
cannot fail. So **every arm is judged on a downscaled copy — 1,568 px on the
longest edge, JPEG q92, identical for every arm including today's 2K** — and the
product's real behaviour is measured separately by the probe above. That
deviation is a stated limit: it is the comparison the court was asked for, and
it is not what a Sign does today.

---

## THE RESULTS

### Per arm

| arm | renders | identity | angle | wardrobe | all three | mean s | p95 s | MB | pixels | $/picture | $/Sign of 5 | s/Sign |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **today (2K)** | 20 | **20/20 (100%)** | 16/20 (80%) | **20/20 (100%)** | 16/20 (80%) | **28.8** | 31.1 | 5.9 | 1696×2528 | $0.15 | $0.75 | **58** |
| **4K** (#1387) | 20 | 19/20 (95%) | 15/20 (75%) | 18/20 (90%) | 13/20 (65%) | 44.3 | 50.3 | 19.6 | **3392×5056** | $0.30 | $1.50 | 89 |
| **Sunburst high** | 18 | **18/18 (100%)** | **16/18 (89%)** | **18/18 (100%)** | **16/18 (89%)** | 52.0 | 68.1 | 11.1 | 2352×3504 | **$0.14** | **$0.70** | 104 |
| **Sunburst max** | 18 | 17/18 (94%) | 14/18 (78%) | 15/18 (83%) | 12/18 (67%) | 99.1 | 134.9 | 11.0 | 2352×3504 | $0.49 | $2.45 | 198 |

*`s/Sign` is two mean renders, because `SIGN_VIEW_CONCURRENCY` runs five views
three at a time — two waves.*

### All three axes, per arm per angle

| angle | today (2K) | 4K | Sunburst high | Sunburst max |
|---|---|---|---|---|
| closeUp | 2/4 (50%) | 2/4 (50%) | **4/4 (100%)** | 3/4 (75%) |
| threeQuarter | 2/4 (50%) | 0/4 (0%) | 2/4 (50%) | 1/4 (25%) |
| frontFull | 4/4 | 4/4 | 4/4 | 4/4 |
| sideClose | 4/4 | 3/4 (75%) | 3/3 | 3/3 |
| backFull | 4/4 | 4/4 | 3/3 | 1/3 (33%) |

### ⚠ Sunburst's edit door has a ceiling the schema does not state, and it is BELOW 4K

fal's published schema for `openai/gpt-image-2.5/sunburst/edit` (read 2026-09-26)
accepts `image_size` as `{width, height}` with each side `<= 14142`. **Asked for
3392×5056 it returned 2352×3504** — 8.24 megapixels, aspect kept, which is the
same ~8.29 MP ceiling `falImages.ts` already records for this engine family. The
sheet ask of 4688×1760 came back **3840×1440**, so there is a 3,840-pixel edge
cap as well.

| | pixels | megapixels |
|---|---|---|
| Nano Banana Pro 2K — today | 1696×2528 | 4.3 |
| **Sunburst edit, either tier** | **2352×3504** | **8.2** |
| Nano Banana Pro 4K — #1387 | 3392×5056 | 17.2 |

**Sunburst cannot be asked for #1387's frame at all.** It sits between the two
Nano Banana tiers — about twice today's, about half of 4K.

### ⚠ Sunburst REFUSED 7 renders on content policy. Nano Banana refused none.

`fal.ai … (422) content_policy_violation` — *"The content could not be processed
because it contained material flagged by a content checker."*

| where | fixture | refused |
|---|---|---|
| main phase, `sideClose` and `backFull` | caveman | 4 of 8 asks |
| degradation chain, step 1, both tiers | caveman | 2 of 2 |
| degradation chain, step 5, high | basics | 1 |
| **every Nano Banana ask, same words, same anchors** | — | **0 of 40** |

**Both refused fixtures have a wardrobe line about bare skin** — the caveman's
*"hide loincloth, bare feet"* and the basics cast's *"cut well below the
collarbones so the whole upper chest and sternum are bare"*. The refusal is on
the PROMPT, and the prompt is the product's own composed directive. Stated as a
number and not interpreted: **7 of 68 Sunburst asks were refused, 0 of 40 Nano
Banana asks were.**

### The price and the clock, measured off the account balance

`--phase price`, one render per tier, a **settled** balance either side (two
consecutive equal reads after a move, which is `falSpend.mts`'s own discipline).
**The balance fell in both windows — no top-up masked either.**

| tier | $ per picture | seconds | file | returned pixels |
|---|---|---|---|---|
| Sunburst **high** | **$0.14** (14.77 → 14.63) | 46.4 s | 11.04 MB | 2352×3504 |
| Sunburst **max** | **$0.49** (14.63 → 14.14) | 104.8 s | 10.65 MB | 2352×3504 |

⚠ **Max costs 3.5× high and takes 2.26× as long, for the SAME number of
pixels.** Beside them: Nano Banana Pro **$0.15** at 1K/2K (fal's own published
figure, read from its pricing endpoint the same hour) and **$0.30** at 4K
(`falQueue.ts`'s table).

These are **n=1 per tier**, this court's own readings at 2352×3504, and not a
constant anything else should quote.

---

## THE DEGRADATION CHAIN — his question, measured

Five successive edits, each step's output becoming the next step's reference, on
the package's own `threeQuarter` directive. The judge is asked at **every step
against the ORIGINAL anchor**, never against the previous step, because the
question is how far she has drifted from the woman who was signed.

| anchor | tier | step 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| jericho | high | id ✓ | ✓ | ✓ | ✓ | ✓ |
| jericho | max | id ✓ | ✓ | ✓ | ✓ | ✓ |
| basics | high | id ✓ | ✓ | ✓ | ✓ | **refused (content)** |
| basics | max | id ✓ | ✓ | ✓ | ✓ | ✓ |
| caveman | high / max | **refused at step 1, both tiers** | | | | |

**What the numbers say, and only that: the identity axis passed at every one of
the 19 chained edits that arrived, on both tiers.** The judge found no
identity drift it could name after five chained edits at either setting, so
**it cannot separate `high` from `max` on the founder's question.** The angle
axis drifts instead — `basics` fails it at every step on both tiers, `jericho`
fails it on 2 of 5 at high and 3 of 5 at max — which is framing, not identity.

⚠ **The eye closes this, not the judge** (law 9). The chain sheets are eye items
below: steps 0–5 in a row per tier, and the two tiers' step 5 beside the anchor.

---

## THE SHEET ARM (#1278 part 2 — his ruled preference, Crew reply 221)

One Sunburst render per anchor per tier, four columns — front, left profile,
right profile, back, full length — cut into four with sharp on equal columns.

- **Asked 4688×1760; returned 3840×1440 every time.** Cut geometry: 4 columns of
  **960×1440**, left edges at 0 / 960 / 1920 / 2880.
- ⚠ **So a cut column is 960×1440 against today's delivered view at 1696×2528 —
  about a third of the pixels.** One frame cannot hold four full-length figures
  at the resolution four frames give each one. That is the other half of the
  trade and it is not a choice this court made.

| | one sheet, cut four ways | four renders one by one |
|---|---|---|
| calls | **1** | 4 |
| $ at high | **$0.14** | $0.56 |
| $ at max | **$0.49** | $1.96 |
| seconds at high | **42.6 – 47.2** | ~208 |
| seconds at max | **60.8 – 62.6** | ~396 |
| pixels per view | 960×1440 | 2352×3504 |

**The judge on the sixteen cut views**, stated and not interpreted: identity
passes 11 of 16; **the angle axis passes 16 of 16**; wardrobe passes 11 of 16.
Per tier — high: identity 5/8, wardrobe 6/8. Max: identity 6/8, wardrobe 5/8.

⚠ **The column-to-slot mapping is this court's own choice.** #1278 names four
full-length columns; the package promises `frontFull` and `backFull` at full
length and `sideClose` at a CLOSE framing. Columns 1 and 4 are judged against
the slot they are; columns 2 and 3 are judged against `sideClose`, which asks
for a closer frame than the sheet was asked for. Every one of them passed the
angle axis anyway, so nothing here turns on it — but it is named rather than
discovered in the table.

**What the wardrobe axis says about consistency across the four, which is the
whole point of the shape:** the four cut columns come from one render, so the
outfit, hem, footwear, scale and light are the same by construction. The judge's
wardrobe failures are all on the profile columns, where its stated reason is what
the profile does or does not show rather than a difference between the columns.
**Whether the sheet's consistency is worth a third of the pixels is his eye's**,
and the side-by-side sheet is an eye item below.

---

## Stated limits

1. **Two anchors for the main arms, three for the chain.** All photoreal humans.
   Nothing here says anything about a creature, a stylised cohort, or a Cast that
   carries ink.
2. **Fresh draws are not a controlled A/B on pose.** Every render is a new draw,
   so two frames of the same arm differ for reasons that are not the engine. The
   negative control bounds the READER's contribution at zero; it does not bound
   the engine's.
3. **The judge is a pointer, never the finding** (law 9). Where the judge and his
   eye disagree on a class, the judge is presumed wrong on that class.
4. **The Sunburst per-picture prices are n=1 each.**
5. **The arms are judged on a downscaled copy, which is a deviation from the
   product** — applied identically to every arm, including today's 2K.
6. **Two draws per arm, not three.** Four arms instead of two doubled the main
   phase; at three draws the Nano Banana half alone was $13.50 against a fal
   balance that read $14.77 at the start.
7. ⚠ **The total spend could not be read off the balance.** It was $14.77 before
   and **$26.08 after** — it went UP, so an auto top-up landed mid-run and the
   window is UNMEASURED rather than cheap (`falSpend.mts`'s own warning). The
   ~$28 figure is arithmetic over the per-picture prices above, not a balance
   reading; only the $0.63 price probe is a settled measurement. The OpenRouter
   judge spend is not measured at all — **125 judge calls is exact, the dollars
   are not**, because no before-reading was taken.

## The frames

All under `C:\Users\Admin\drape-shift-sign-engine-court-1394\output\1394-sign-engine\`
(gitignored — they are artifacts, not repository content):

- `<anchor>/<angle>/<arm>-<draw>.png` — every main-phase render, 76 of them
- `<anchor>/chain-<tier>/step-<n>.png` — the chain, step 0 being the anchor
- `<anchor>/sheet-<tier>/sheet.png` and `cut-<n>-<name>.png` — the sheet arm
- `price/high.png`, `price/max.png` — the price probe
- `contact/1394-*.png` — the contact sheets that went up as eye items
- `rows-*.json` — every row this document quotes

## The eye items — uploaded to the production bucket, 2026-09-26

Thirteen contact sheets are in the bucket. **A frame is not visible to him until
a briefing edition names its key inside an `eyeItems` entry and deploys** — the
deployed briefing IS the serving route's allowlist, so uploading publishes
nothing on its own. The relay's edition names these.

| what it shows | key |
|---|---|
| Jericho close-up — anchor + all four arms | `crew-eye/2c2c8ef5-ab32-428b-b9d3-605b58ecf24b.jpg` |
| Jericho close-up — the same region of her face out of each, matched scale | `crew-eye/e2263ac8-11d7-4859-a068-858fb95d6787.jpg` |
| Caveman close-up — anchor + all four arms | `crew-eye/8d06febb-5947-4fb2-b521-6d473fef9558.jpg` |
| Caveman close-up — face detail, matched scale | `crew-eye/645030cb-7d9c-4c17-bcd6-2f58230c8fd2.jpg` |
| Jericho three-quarter — the angle every arm struggles with | `crew-eye/61c25ca0-fbce-4132-b015-09eba03877c3.jpg` |
| Jericho front full-length — all four arms | `crew-eye/c72834b7-5b04-4023-bd00-d732a218ab02.jpg` |
| **The chain at `high`** — anchor then five successive edits | `crew-eye/ed133071-89be-4daa-be1e-0828870d3d46.jpg` |
| **The chain at `max`** — anchor then five successive edits | `crew-eye/70d2e0fb-84cb-42b4-bfc8-7e2557484b95.jpg` |
| **The chain's two endpoints** — the anchor beside five edits on each tier | `crew-eye/f0def0bc-ea04-4e68-875f-a1eb38394de7.jpg` |
| The chain at `max` on the third cast | `crew-eye/7136b0f0-5861-4457-bd99-b7ea3bdf17f6.jpg` |
| **#1278 part 2 at `high`** — one sheet cut four ways beside four renders made one by one | `crew-eye/c4bb9cc2-dc15-4022-8231-ba66309176e0.jpg` |
| **#1278 part 2 at `max`** — the same | `crew-eye/e4ed69d0-f16a-4084-b546-73d0ee9d3a88.jpg` |
| #1278 part 2 at `high`, the caveman | `crew-eye/a94d2eeb-a11c-4cd4-a0d3-ad9d59daa1ae.jpg` |

**The question for his eye, and it is the only thing this court does not
answer:** on those frames, is Sunburst's picture the one he wants the Sign views
made of — and is `max` worth 3.5× the money and 2.26× the wait for the same
pixels?
