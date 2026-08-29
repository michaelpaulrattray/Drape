# THE LOBBY REDESIGN — segment proposal (#228, 2026-08-29)

**Status: a PROPOSAL. Nothing here is built, and nothing is built until the
founder names segment 1** (#228: *"we will work through the whole lobby
re-design piece by piece in segments"* — his eye between each).

This is the first deliverable of the founder-authorised side lane. It answers
one question: **what are the pieces, in what order, and what would a customer
actually see change.**

## The three things that bound it

1. **The Desk's milestone stays N1.** The lobby is a side lane; when his Fable
   credits refresh the milestone review outranks anything in flight here.
2. **The casting road is FROZEN in this lane.** A segment that finds itself
   needing a casting-road change stops and cards it. That is what keeps N1's
   diff clean for the milestone review.
3. **Money and auth surfaces do not appear in this lane at all** (#228). That
   rules out the settings/billing consolidation the handoff draws — see
   "out of this lane" below.

Governing design: `docs/specs/Casting-ui-ux-design/design_handoff_studio/`
(docs 01–10 + `Klieg Studio.dc.html` + screenshots), under the UI authority
order — ratified ruling > foundation README > vision docs > prototype HTML —
and under the founder's standing law that **prototype content is quotation,
not requirement**: every string re-derived against what the product honestly
does today.

## What is ALREADY the handoff, and needs no work

Read at the code, not remembered — M2 landed the shell:

| Handoff (doc 01) | In the product today |
|---|---|
| 76px rail, brand orb, 7 destinations | `client/src/foundation/Rail.tsx` — Home, Create, Canvas, Templates, Casting, Assets, Library |
| 56px glass topbar, breadcrumb | `client/src/foundation/Topbar.tsx` |
| Theme = one attribute on `<body>` | `foundation/theme.ts`, toggle owned by the shell |
| Token system, no raw hex | `foundation/tokens.css` + `token-guard.test.ts` |
| Account chip → menu | `Rail.tsx` foot + `UserCard` |

So the lobby's **chrome** is already the design. What is not the design is
**every surface inside it**. Four of the seven rail destinations lead
somewhere (Home, Canvas, Casting, Library); three are inert stubs by
deliberate ruling (Create, Templates, Assets — F1, 2026-07-31: the rail never
changes shape, and a place-name is not a capability claim).

## The capability audit — read at the code before any segment was written

The handoff is a complete product vision; large parts of it describe
capabilities this product does not have. Naming them now is what stops a
segment from quietly shipping a lie.

| Handoff asks for | Does it exist? | Read at |
|---|---|---|
| Live job list ("ON THE WIRE") | **Yes** | `generation.activeOperations` |
| Cast roster ("YOUR CAST") | **Yes** | `models.list`, `wardrobe.model.listMinted` |
| Resume feed | **Yes** | `lobby.recentWork` (boards + wardrobe sessions + named casts) |
| Canvases | **Yes** | `boards.*`, `BoardsView` |
| Garments, looks | **Yes** | `wardrobe.garments.list`, `wardrobe.looks.listAll` |
| Credits meter | **Yes** | `credits.getBalance` |
| Composer modes: **Video, UGC, Upscale, Voice** | **No** — no procedure, no worker, no engine | `server/routers.ts` (26 namespaces; none of them) |
| Composer mode: Try-on | Exists as the wardrobe road, not as a lobby composer | `wardrobe.*` |
| Composer mode: Image → Create | Exists **only** as the casting road — a second entrance to it, which this lane is frozen out of | `castingV2.createRoll` |
| **Templates** (doc 06, 12 of them) | **No** — no table, no procedure, no runner | schema + `routers.ts` |
| **Project scope switcher** (doc 01, "build scope as a global") | **No** — no project concept anywhere in the schema | `drizzle/schema.ts` |
| Team / members / invites, 2FA, notification prefs (doc 09) | **No** | — |
| Rail notifications (his own seed L4) | **No** notifications capability | — |
| Library "Kept / All" + 30-day unkept clearing (doc 08) | **No** retention rule to be honest about | — |

**The single biggest thing on the Home mock — the composer — is the one thing
this lane cannot honestly build.** Five of its six modes are not capabilities
we have, and the sixth is the casting entrance, which is frozen here. That is
stated up front rather than discovered in segment 1.

## The proposed segments, in landing order

Each is its own card, its own PR, its own evidence pack (side-by-side vs the
mockup, both themes) and his eye before the next one starts.

### Segment 1 — HOME *(recommended first)*

**What a customer sees:** `/app` stops being a page title, a grid of recent
work and three numbered text rows, and becomes the designed landing: a
greeting, **what is running right now**, **what just landed**, and **who you
can cast** — each section reachable in one click.

- Hero greeting + subhead (doc 02).
- **ON THE WIRE** — live and just-finished jobs, from `generation.activeOperations`.
  This is the piece the product has and has never shown on the lobby.
- **JUST LANDED** — the most recent finished frames, from what the lobby
  already reads.
- **YOUR CAST** — roster with the dashed "New cast member" tile FIRST.
- **QUICK START** — reduced to the two routes that exist: *Cast a model* →
  Casting, *Wire it yourself* → a new canvas. The other two mock cards are
  template-dependent and are not drawn.
- The **shared grammar** (doc 10: section header, media card, dashed create
  tile, hover-reveal action row, toast, segmented control) lands here as
  foundation primitives — Home is the smallest surface that exercises all of
  it, which is the handoff's own build order and what stops segments 2–4 from
  each inventing their own card.

**Not built, declared:** the composer (above). Home therefore opens with the
hero and QUICK START where the mock has hero → composer → QUICK START.

**Casting road:** untouched. Every source above already exists and is read-only.

### Segment 2 — LIBRARY, and the provenance split

**What a customer sees:** one Library organised by **when you made it**
(TODAY / YESTERDAY / EARLIER THIS WEEK / EARLIER) with search and kind
filters, instead of three separate rail-reached lists.

The handoff splits Library and Assets by **provenance** — Library is what the
product generated, Assets is what the customer supplied — and our data already
knows which is which. So this segment also settles where each list belongs:
**looks and casts are Library; garments are Assets** (segment 4).

**Not built, declared:** the Kept / All lens and "unkept frames clear after 30
days" — there is no retention rule, and a lens that claims one would be a
promise about deletion we do not keep.

### Segment 3 — CANVAS TAB

**What a customer sees:** `/app/boards` reads as a designed collection — a
dashed **New canvas** tile first, then 16:10 board cards with a real
thumbnail, node count and last-run line.

This is where his own seed **L3** gets answered: what a canvas card's picture
actually is (a mosaic of the board's contents, or one frame), and where
archived canvases go — **both are his calls, and the segment brings him the
options rather than choosing.**

**Not built, declared:** the template marquee (no templates) and the "wire it"
composer (no agent that builds a board from a sentence).

### Segment 4 — ASSETS (the first stub made real)

**What a customer sees:** the Assets rail item stops being inert. It holds
what the customer supplied: garments today, with the Upload tile first and
smart-set chips with real counts.

**Open question inside it:** the reference pictures a customer attaches to a
Cast are also "supplied material", but they live behind a casting flag and
belong to a Cast. Pulling them into a lobby tab is a casting-road read — so
**v1 is garments only**, and the reference question is carded, not guessed.

### Segment 5 — CREATE and TEMPLATES made honest

**What a customer sees:** clicking Create or Templates lands on a page that
says in one line what will live there, instead of an icon that does nothing.

Declared scaffolding under his own 2026-08-25 amendment (placeholders
permitted for mockup surfaces whose capability is not built, honest or dark,
never a control that looks live). Each page links the real capability's card.

### Segment 6 — THE RAIL'S ICONS (his seed L5)

**What a customer sees:** the seven rail icons become drawn-for-us marks in
the house language instead of the off-the-shelf set they are today — his own
words, *"explicitly not generic AI-slop icons"*.

Pure taste, zero capability, entirely his eye. Small enough to be a single
sitting; it is last only because it is the least functional, not the least
wanted.

## Out of this lane entirely — named, with the reason

- **The composer + model picker** (docs 02, 04) — capability we do not have,
  plus a second entrance to the frozen casting road.
- **Templates** (doc 06) — an entire product feature, not a lobby redesign.
- **The project scope switcher** (doc 01) — projects do not exist in the
  schema; it is a data-model decision, not chrome.
- **Settings / Billing / Usage / Members** (doc 09) — money and auth, which
  #228 excludes from this lane by name. His seed **L6** (profile popout in the
  house language) is the part of it that is not money; it can be carded on its
  own if he wants it.
- **Rail notifications** (seed L4) — needs a notifications capability first.
- **The Create tab's feed and image viewer** (doc 03) — needs a unified
  generations feed the product does not have. The viewer itself is worth
  having later and is worth a card.

## The recommendation

**Segment 1 = HOME.**

It is the surface he lands on every time he opens the app; it is the largest
visible change per unit of work; and it establishes the card grammar that
segments 2–4 are assembled from, so building it first is what stops a
reconciliation pass later. It is also the largest of the six.

**If he wants a faster first look instead**, segment 6 (rail icons) or
segment 5 (the honest stub pages) are one-sitting pieces and neither blocks
anything else.

**He picks; the shift builds nothing until he has.**
