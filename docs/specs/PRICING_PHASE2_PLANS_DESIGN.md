# Pricing Phase 2 — the plan surface redesigned

**Card #1774. Design-first: nothing here is built, and nothing here may be built
until Phase 1 closes and he sets the focus (THE MILESTONE GATE).**

**His word, 2026-10-02 (terminal), verbatim:**

> *"i think we should also re-design our plans like higgsfield does e.g 3
> individual plans the biggest one has a slider for credits and we need way
> better copy based on future development not just what exists today. we dont
> need to show $1 per credit on our plans here its better shown on the adding of
> credits design. our bigger plans could be business plans priced per seat
> rather than redicidualous amounts of credits at a rediculous price no one
> would pay? and anything really high would be a sale department chat. … also
> our compare features needs a way better design … our current is pretty
> pathetic."*

and, on the relay's reading of it: *"yes i like this"*.

**Prototype:** `docs/specs/pricing-phase2-plans/prototype.html`
**Frames:** the eleven PNGs beside it, both themes, desktop and phone.

---

## 0 · What he has to decide, in four lines

1. **The slider's price.** One extra 5,000 credits a month on the top plan —
   **$9** is the recommendation, with the arithmetic in §5. This is the only
   number in this brief that is not already in the product.
2. **Team's seat price.** **$68 a seat** is the recommendation (§6) — the same
   price as Pro, so a seat is a name he already uses. Team does not ship until
   there is a workspace, so this can wait.
3. **The frames.** Law 9 — his eye closes this, and no build card is cut first.
4. **Who writes the final copy.** Every new string in §8 is owed Yuna's pass.

Everything else below is derived, read at the code, or his own earlier ruling.

---

## 1 · What the surface is today, read at the code

One surface: `client/src/features/billing/ChangePlanModal.tsx`, opened from
Settings and from the Add credits cross-sell. There is no pricing *page* and no
public pricing route — `#1773`'s sweep established that, and it still holds.

It draws **seven rungs** (`PLAN_TIERS`, minus the hidden `ultimate`) through a
sliding window of three (`cardTrio`) with a five-column compare mode
(`compareWindow`). The ladder:

| rung | credits a month (display) | price | what it makes |
|---|---|---|---|
| Free | 2,700 *(one-time grant)* | — | about 1 finished character |
| Starter | 14,000 | $27 | about 5 |
| Pro | 36,000 | $68 | about 15 |
| Studio | 86,000 | $159 | about 36 |
| Business | 470,000 | $840 | about 190 |
| Scale | 2,750,000 | $4,800 | about 1,100 |
| Enterprise | 8,700,000 | $15,000 | about 3,600 |

Every figure above is **derived, not transcribed**: display credits are
`PLAN_TIERS[t].monthlyCredits ÷ 5` (`shared/creditDisplay.ts`), and the
character counts are `charactersFor()` over
`CASTING_V2_ONE_CHARACTER_CREDITS` (11,850 ledger = Roll 1,600 + Refine 1,750
+ Sign 8,500).

⚠ **Note the Business row: 190, not the 200 the #1607 card body quoted.**
`charactersFor` takes two significant figures *downward* past 100. A count of
what a plan covers may never exceed what it covers, and that asymmetry is a
safety property rather than a formatting choice. It is why no figure in this
brief was typed from an older document.

### The three rungs he is objecting to

His *"redicidualous amounts of credits at a rediculous price no one would pay"*
is Scale and Enterprise, and arguably Business. **He is right at the numbers:**
production has six accounts, all free, no subscriber. Nobody has ever been
offered $4,800 a month and taken it, and a ladder whose top half has never been
sold is a ladder that is mostly decoration.

---

## 2 · THE FINDING THAT SHAPES THE COMPARE TABLE, AND IT IS THE MOST USEFUL
## THING IN THIS DOCUMENT

**Four facts differ between plans. That is the entire list, read at the code.**

`planTier` is consulted in exactly three kinds of place —
`server/routes/billing.ts` (the plan's own facts), `server/db/admin.ts` and the
admin overview (staff reporting), and `topupEligibility`
(`shared/creditTopups.ts`). **Nowhere in the product does a plan rung gate a
capability.** There is no per-plan refine cap, no per-plan concurrency, no
per-plan view count, no per-plan feature. The four:

| what differs | where it is declared |
|---|---|
| the credit allowance | `PLAN_TIERS[t].monthlyCredits` |
| what that allowance makes | derived from it |
| what happens to unspent credits | `PLAN_TIERS[t].rolloverPercent` |
| whether credit packs may be bought | `topupEligibility` — on a plan, yes; Free, no |

plus the price itself.

**So a compare table with rows headed *views per cast*, *refines a month* or
*rolls at once* would be inventing differences.** That is the trap this
redesign has to walk past, because a table organised by what a customer makes
*looks* like it wants those rows. His own avoid-list on #1607 says the same
thing from the other side: no unlimited, no seat claims, no SLAs, no priority
support.

**The redesign's actual answer, and it is why the new table is better rather
than merely bigger:** the table is organised into **groups** — What you make ·
Credits · Cinema · Help · Price — and **a fact every column shares is stated
ONCE under its group instead of being drawn four identical times.** Today's
table repeats agreement across five columns, which is exactly what reads as
"pretty pathetic": a wall of cells that mostly say the same thing. The groups
are also the slots his #425 ruling asked for — *"eventually i need to make
benefits between each plan which will be a reminder for me"* — and a group with
one honest line in it today is a visible, labelled place for that difference to
land.

---

## 3 · The shipping surface

Frames `01`, `02`, `06`, `07`.

```
  You are on Free.                              2,700 credits left
  [Monthly | Yearly 2 MONTHS FREE]                   Compare plans

  ┌ Starter ────┐  ┌ Pro ─────────┐  ┌ Studio ──────────────┐
  │ $27 / month │  │ $68 / month  │  │ $159 / month         │
  │ who it's for│  │ who it's for │  │ who it's for         │
  │ [Upgrade]   │  │ [Upgrade]    │  │ [Upgrade]            │
  │ 14,000 …    │  │ 36,000 …     │  │ 86,000 …             │
  │             │  │              │  │ ──o───────────────   │  ← the slider
  │ about 5     │  │ about 15     │  │ about 36             │
  │ half expires│  │ ¼ expires    │  │ nothing expires      │
  │ ✓ every …   │  │ ✓ every …    │  │ ✓ every …            │
  └─────────────┘  └──────────────┘  └──────────────────────┘

  ON EVERY PLAN   Casting studio · Boards · Wardrobe · Credit packs
  [COMING]        The cinema studio … and the image and video generators.

  ┌ Enterprise ─────────────────────────────── [Let's talk] ┐
  └──────────────────────────────────────────────────────────┘

  See the price before you make anything. …
  Just need more credits?                        [Add credits]
```

**Three decisions in that layout, each with its reason:**

1. **Three cards, and the sliding window is DELETED.** `cardTrio` /
   `compareWindow` exist because seven rungs do not fit; three rungs are the
   whole individual ladder and there is nothing left to window. A mechanism
   whose reason has gone is removed, not left pointing at itself.
2. **Free is not one of the three.** It is the state you are in, not a plan you
   buy, and the reason block at the top already says so with your balance
   beside it. It keeps its column in the compare table, where a like-for-like
   read is the whole point.
3. **Enterprise is a full-width band under the three, not a fourth column.**
   Four cards at 880px is 205px each and a comparison between three priced
   things and one unpriced one is not a comparison. The band sits exactly where
   today's quiet *"Need a higher limit? Write to support@…"* line sits, and
   replaces it.

### The slider, and where it sits

⚠ **It sits BELOW the action, inside the credits block, and that was changed
after looking at the first render.** Put above the action it pushed Studio's
button out of line with the other two — and the grid is `auto-fill` rather than
a flex row precisely so the three read like-for-like. The first frame showed it
immediately; the fix is in the prototype. (Working law 6, on a prototype.)

What moves when the thumb moves: the **price at the top**, the **credits
figure** directly above the slider, and the **"about N finished characters"**
line directly below it. Frame `03` is the same card at 34 steps — 256,000
credits a month for $465, about 100 finished characters.

### Where the four retired rungs go

`business`, `scale`, `enterprise` and `ultimate` **stay in `PLAN_TIERS`**. Two
reasons, and the first is not optional: the column still accepts those values
and `ownPlanFacts` is the only road by which an account on a hand-sold rung
learns its own plan's name — removing them would caption a paying customer
"Free", which #583's finding 1 already caught once. They leave the *offered*
ladder, not the table.

**An account on one of them** sees no card marked current, its own plan named
in the reason block from `ownPlanFacts`, and the Enterprise band as its door.
Nobody is in that state today (six accounts, all free) but the state is
reachable the moment he hand-sells one, which is what the band is for.

---

## 4 · The compare table

Frames `04`, `05`, `08`, `09`.

Four columns — **Free · Starter · Pro · Studio** — and five groups:

| group | rows that differ | what is said once |
|---|---|---|
| **What you make** | Finished characters a month | what a finished character is; the same five views on every plan |
| **Credits** | Credits · Unspent credits · Buy extra credits | one pool; purchased credits never expire |
| **Cinema** | — | `COMING` — the cinema studio and the generators |
| **Help** | — | the help centre on every plan; Enterprise arranged directly |
| **Price** | Price a month | — |

**Value before price**, unchanged from §6d — the gain is established before the
number. **No rate row**, per #1773: the rate lives on Add credits and nowhere
else. **No Enterprise column**: it has no published price, and a column of
dashes is worse than a sentence. The footnote points at it and at the slider.

**On a phone the table TRANSPOSES** (frames `08`, `09`): one block per plan,
current first, rows as label/value pairs. Four columns in 390px is not a
comparison, it is a row of truncations. The group notes collect below the
blocks, and §6e's footer primary stays — on a phone the per-plan actions are
four screens down, so the argument for it is stronger than on desktop.

---

## 5 · THE SLIDER'S PRICE — the one number he owes

**Recommendation: $9 for each extra 5,000 credits a month.**

**The step is not a choice.** `TOPUP_UNIT_DISPLAY_CREDITS` is 5,000, which is
Add credits' slider step and its smallest pack. His brief asks for the same
control and the same unit so a customer learns one slider and meets it twice.
One step is worth about two finished characters, which is a real unit to think
in.

**The ceiling is derived, not chosen.** The slider replaces the Business rung,
so it runs as far as that rung went: `floor((470,000 − 86,000) ÷ 5,000)` =
**76 steps**, ending at **466,000 credits a month**. Past it the answer is the
Enterprise card — which is what *"anything really high would be a sales
department chat"* means.

**Where $9 comes from.** The exact marginal rate between the two rungs it spans
is `($840 − $159) ÷ 76.8 = $8.87`. $9 is that, to the dollar. What it produces:

| | credits a month | price | credits per $1 |
|---|---|---|---|
| slider at 0 (plain Studio) | 86,000 | $159 | 540.9 |
| slider at 38 | 276,000 | $501 | 550.9 |
| slider at 76 (the top) | 466,000 | $843 | 552.8 |
| *marginal rate of the slider itself* | | | *555.6* |

**The three properties that make it safe, each checkable:**

1. **Credits per dollar rises all the way along it** (540.9 → 552.8), so the
   ladder's own invariant — the one the relay verified across all seven rungs
   on 2026-10-01 — survives into the slider. It holds because the marginal rate
   (555.6) is above the base rate (540.9), and for no other reason.
2. **It never beats a sales conversation.** Today's Enterprise rung is 580.0
   credits per $1. The slider tops out at 552.8, so *talk to us for more* stays
   a true statement rather than a polite fiction.
3. **It never loses to a top-up.** The best credit pack is 500 credits per $1
   (`creditTopups.ts`, held against `PLAN_TIERS` by its own suite), so Add
   credits' *a bigger plan gives more for the money* line stays true at every
   slider position.

**What was considered and declined:** $8.50 tops out at 578.9, within 0.2% of
Enterprise's own rate, which would hollow out the band the sales conversation
is for. $8 tops out at 607.6 — better value than any plan we have ever
published, bought on a slider with no conversation.

**And one honest consequence:** at the top the slider is $843 for 466,000 where
today's Business is $840 for 470,000 — within half a percent of the same offer,
which is the point. It is the Business rung, bought without an email.

### What it costs to BUILD, named now rather than discovered later

This is the one part of Phase 2 that is not a screen. A plan whose allowance is
a dial is a **variable-quantity subscription**: the Stripe side becomes a base
price plus a metered line item with a quantity, `changePlan` and
`previewPlanChange` grow a quantity alongside `interval`, and the monthly
refresh has to grant `base + units × 5,000` rather than `PLAN_TIERS[t]
.monthlyCredits`. **Invariant 4 applies to the quantity exactly as
`creditTopups.ts`'s `TOPUP_MAX_UNITS` applies to the pack size** — an unbounded
unit count composed from a request body is an unbounded charge. The 76 is that
bound and it is derived from the ladder, so the screen and the server read one
number.

---

## 6 · Team — designed, and it does not ship

Frames `10`, `11`.

⚠ **Per seat means nothing until a team can exist.** An account is one login:
there is no membership table, no invite, no shared balance, no roles. A Team
plan shipped onto today's product would sell a seat count that buys nothing —
the machinery showing through at its worst, because the customer would be the
one to discover it.

**So Team ships WITH the workspace or not at all, and the workspace is its own
card, sequenced first — #1788, filed with this brief.** Until then the surface shows the individual plans and
the Enterprise band, exactly as §3 draws it. The Team frames exist so the shape
is agreed now and the workspace card knows what it is building toward.

**The card's shape:** price per seat · a seat stepper (minimum 2) · the total
beneath it · the pooled allowance as the credits figure · *everyone works from
the same credits, and you can see who spent what*.

**Recommendation: $68 a seat, carrying Pro's 36,000 credits into the shared
pool.** A seat is then a name he already uses, and three seats is 108,000
credits for $204. ⚠ **It is deliberately NOT cheaper per credit than Studio**
(529.4 against 540.9): what Team sells is the workspace — one pool, one bill,
who-spent-what — and a per-credit discount on top would make it the cheap way
to buy credits rather than the right way to buy a team. That is a judgement and
it is his to overturn.

**#1788's own scope, so it is not discovered inside this one:**
members and invites, one balance per workspace rather than per user, a spend
view by member, and what happens to work when a member leaves. Every one of
those touches ownership, which `ownerId`-in-the-WHERE governs across the whole
product — it is a real feature, not a billing detail.

---

## 7 · The law's three questions (clause 7 — answered in this body, as required)

**1 · What must the customer learn to use this?** One slider, and they have
already met it on Add credits — same step, same unit, same readout shape. That
is the whole answer, and it is why the step was not allowed to be a different
number.

**2 · What decision does it put in front of them, and do they have a basis?**
Which plan — decided by who they are and what they make, stated on the card in
their words, with *about N finished characters* as the basis. On the top plan,
how many credits — with the price and the character count both moving under
their thumb, which is the basis. On Team, how many seats — with the pool and
the total stated. **No decision on this surface is offered without the number
that answers it.**

**3 · Where does the technology show?** Nowhere. No model name, no rate chip
(#1773), no pipeline word. *Finished character* is the customer's noun and
`charactersPhrase` already owns it. The `COMING` marks are the one place the
future is named, and they name a studio and a generator — things a customer
wants — never an engine.

⚠ **One clause of the law needed real work here, and it is worth naming:** *"it
works and it's fast" does not pass.* The thing that nearly failed was the
compare table. A grouped table organised by what a customer makes **invites**
rows like *views per cast* and *refines a month*, and those rows would be
machinery dressed as benefits — numbers a customer has no basis to act on,
describing differences that do not exist. §2 is the answer and it was reached
by reading the code, not by taste.

---

## 8 · Every string, classified

**`[shipped]` — the product renders this today, verbatim, and it is unchanged:**

| string | where it lives |
|---|---|
| the four audience lines (Free, Starter, Pro, Studio) | `planBlurbs.ts` |
| `Every model and every tool` | `ChangePlanModal.tsx` — `EVERY_PLAN_PERK` |
| `See the price before you make anything. Credits back if a result doesn't arrive.` | `TRUST_LINE` |
| `… credits a month, one pool for everything.` | `planLadder.ts` — `creditsTail` |
| `For example, about N finished characters.` | `exampleSentence` |
| the four rollover sentences | `rolloverSentence` |
| `Just need more credits` / `Buy a one-off pack instead — your plan stays exactly as it is.` | `ChangePlanModal.tsx` |
| `Having a problem? Go to the help centre.` | `ChangePlanModal.tsx` |

⚠ **The per-card tick stays on every card, on his #425 word** — *"The tick
reading 'Every model and every tool' bring it back because eventually i need to
make benefits between each plan which will be a reminder for me."* Moving it
into the shared block below would have been tidier and would have undone a
ruling of his, so it was not done.

**`[adapted]` — a shipped string with a named edit:**

| new | from | the edit |
|---|---|---|
| the Enterprise card's body | `Need a higher limit? Write to support@klieglabs.com — larger plans are arranged personally.` | the same promise, as a card with an action instead of a line with a mailto |
| `Back to plans` | `Back to the nearest three` | the compare control's return label named the §3 mechanism this brief deletes. It was literal while `compareWindow` showed the five rungs nearest the account and `cardTrio` showed three of seven; with three rungs the whole ladder there is no window and no nearest, and the label told a customer their cards were a moving selection out of something longer. **It was missed by #1832 and found on PR #1849 — #1850.** |

**`[new]` — written for this brief, and every one is owed Yuna's pass:**

| string | why it is safe to render while it waits |
|---|---|
| `You are on Free.` + `Your free credits arrived once when you signed up. A plan tops you up every month.` | states the grant's one-time nature, which `FREE_SIGNUP_GRANT_CREDITS`' own declaration says and which the plan card got wrong before #1607 |
| `Casting studio · Boards · Wardrobe · Credit packs whenever you need them` | the first three are routes a signed-in customer can open today (`App.tsx`: `/app/casting`, `/app/canvas`, `/app/garments`); the fourth is the Add credits checkout, live since #1606, and the heading is `ON EVERY PLAN` — Free is not a plan, which is what `topupEligibility` enforces |
| `The cinema studio — write the script, direct the takes, add voice, cut the film — and the image and video generators. We'll say when they land.` | marked `COMING`; the description is `CLAUDE.md`'s own sentence for the cinema studio. *"We'll say when"* is the house voice for an unshipped thing — `CastSettingsModal.tsx`: *"Not available yet — we'll say when it lands."* |
| `For studios where casting never stops.` | it is `planBlurbs.ts`'s existing `enterprise` line, moved onto the card |
| `A pool built around your volume, invoiced, and arranged with us directly. Tell us what you are making and we will price it.` | invoices exist (`getInvoices`); *arranged directly* is what the mailto already promised |
| `Let's talk` | his own word for it |
| `A finished character is a roll to find her, a refine to correct her, and a sign that fixes her face.` | the exact composition of `CASTING_V2_ONE_CHARACTER_CREDITS` |
| `Every signed cast comes with the same five views, on every plan.` | `CAST_PACKAGE_VIEWS.length` is 5 and no plan changes it |
| `One pool. Every tool spends the same credits, and credits you have paid for never expire.` | one `points.balance`; #1660 made the never-expire half true |
| `The help centre, on every plan. Enterprise is arranged with us directly.` | claims no SLA and no priority — #1607's avoid-list |
| Team's three lines | they describe the workspace, which is why Team waits for it |

⚠ **No string in this brief claims a capability that is not in the tree, and
each claim above was read at the code rather than assumed.** That is #1607's
own rule — *"re-derive every string against present capability before
shipping"* — and it is the rule most easily lost when copy gets "better".

---

## 9 · Numbers: every one derived

The prototype declares its figures in one `FROM_THE_CODE` block naming the file
each came from, and computes the rest with the same arithmetic the client uses
(`displayBalance`, `formatCredits`, `charactersFor`, `rolloverSentence`,
`creditsTail`, `priceAMonth`).

⚠ **A copy of a constant is not a derivation** — so
`client/src/features/settings/pricingPhase2Prototype-guard.test.ts` reads that
block out of the prototype and compares it to the real `PLAN_TIERS`, the real
`CASTING_V2_ONE_CHARACTER_CREDITS` and the real `TOPUP_UNIT_DISPLAY_CREDITS`. A
price move in the tree reddens rather than leaving a stale picture on a card he
is being asked to judge. The same suite drives the slider ladder's three safety
properties from §5 over the real constants, so the proposal cannot quietly stop
being true either.

---

## 10 · What happens next, in order

1. **His eye on the eleven frames** (law 9). Nothing is cut before it.
2. **The workspace card (#1788)** — filed with this brief, sequenced before Team.
3. **His word on the slider's $9** and, when Team's turn comes, on the seat
   price.
4. **Yuna's pass** on §8's `[new]` strings.
5. **Then build cards, one per surface**, each a money surface and each held
   for the relay's hand verdict:
   - the three-card ladder + the Enterprise band (deletes the sliding window),
   - the credit slider (the only one with a server and Stripe half — §5),
   - the grouped compare table + its phone transposition,
   - Team, behind the workspace.

⚠ **THE MILESTONE GATE HOLDS over all of it.** Phase 1 still has #1601, #1606
and #1609 open. This brief is filed on his word and the design may proceed;
no Phase 2 build starts until Phase 1 closes and he sets the focus.
