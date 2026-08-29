# THE LOBBY AS IT STANDS TODAY — the driven "before" reading (#228)

**What this is.** Every lobby segment ships with an evidence pack: side-by-side
screenshots against the mockup, **both themes**, plus a copy audit (founder law,
2026-08-01). The *after* half of that pack is written when a segment is built.
This is the **before** half, taken once, for every surface the six proposed
segments touch — so no segment shift has to re-photograph a page it is about to
replace, and so the founder can see what he is choosing between.

**It builds nothing.** No code moved, no capability changed, no founder decision
is pre-empted. `docs/specs/LOBBY_REDESIGN_SEGMENT_PROPOSAL.md` is still waiting
on his word for segment 1.

**Cost: $0.00.** No render, no credit, no provider call, no write of any kind.

## How it was taken

`scripts/_shift98-lobby-before-disposable.mts`, against the app running locally
on the **dev** database, as `verify-bot-local` — the repo's own drive recipe
(puppeteer-core → system Edge, a minted `app_session_id`, 1440×960 at
device-pixel-ratio 2). Twelve cells: five destinations × two themes, plus the
rail in both.

Three properties of the instrument are worth stating, because two of them were
wrong first:

1. **The theme is set the way the app sets it, and then READ BACK AND
   ASSERTED.** `data-theme` on `<html>` is the whole mechanism. Two drafts read
   back `dark` while asking for light — the first wrote the attribute after
   `ThemeProvider` had already claimed it; the second wrote storage at
   `domcontentloaded`, which fires *before* React mounts, so the provider's own
   mount wrote its default back over the key. The working shape is: load, wait
   for the app, write storage, **reload**. The first version RECORDED the
   mismatch and passed anyway — the mismatch now FAILS the cell, because a
   screenshot of the theme you meant to set is not evidence.
2. **A surface whose marker never arrives FAILS the run**, rather than being
   skipped. A "before" reading that quietly omits a page is how a segment ships
   against a screen nobody looked at.
3. **The first card counter returned `1` on every surface — including a page
   headed "Models 28".** It was scoped to `main`, and this shell has no `<main>`
   element at all, so the whole selector matched nothing and the survivor was an
   unrelated class hit. A number that is identical on a populated page and an
   empty one is not a reading. What is counted now is what a person would count:
   pictures on the page, and pressable things.

Artifacts: `output/lobby-before/` — twelve full-page PNGs, `readings.json`
(heading, subhead, section headers, picture count, button and link labels,
empty-state flag, time-to-marker for every cell) and `drive.log`.

## What is on the screen today, surface by surface

| Rail destination | URL | Heading | Subhead | Populated? |
|---|---|---|---|---|
| Home | `/app` | *Your studio* | *Your creative workspace. Resume recent work or start fresh.* | 8 recent cards |
| Canvas | `/app/boards` | *Canvas* — *13 canvases.* | (count line) | 13 canvases + a dashed **New canvas** tile |
| Library | `/app/models` | *Models 28* | *AI models you've cast — minted and still in progress.* | two sections, **In progress** and **Minted** |
| Library → garments | `/app/garments` | *Garments* | *Your digitized clothing items.* | **empty** — *No garments yet. Digitize one in Wardrobe* |
| Library → looks | `/app/looks` | *Looks* | *Styled outfits saved from wardrobe sessions.* | **empty** — *No looks yet. Dress a model in Wardrobe* |

**The rail** carries seven destinations. Four lead somewhere (Home, Canvas,
Casting, Library); **Create, Templates and Assets are drawn greyed and are not
links at all** — no `href`, no handler — which is the F1 ruling working exactly
as written: the rail never changes shape, and a place-name is not a capability
claim. That is worth seeing before segment 5 is cut, because "make Create and
Templates honest" is a change to something that is already honest; what it is
not is *useful*.

## Five things the frames say that the code alone did not

1. **Home today is a title, a grid, and three numbered text rows.** The
   proposal's one-line description of it is exact. TOOLS is `01 Casting Studio /
   02 Wardrobe / 03 New Canvas` — three rows of type, no cards, no picture. It
   is the smallest surface in the product and it is the landing page.
2. **The dark theme is complete on these surfaces.** Both Home shots are the
   same page on different paper — no light island, no unthemed card, no
   hardcoded white. Whatever a segment does here, it does not have to fix the
   theme first.
3. **The Library already has the provenance split the handoff asks for — in the
   breadcrumb, pointing the wrong way.** `/app/garments` renders as *Library /
   Garments*, and the handoff puts garments in **Assets** (customer-supplied)
   rather than Library (product-generated). Segment 4 is where that word moves;
   it is one breadcrumb and one rail destination, not a data change.
4. **Two of the three Library lists are empty on this fixture account**, so the
   *before* for garments and looks is an empty state. Their populated shape has
   not been photographed and should not be asserted from these frames.
5. ⚠ **One canvas thumbnail does not paint, and it is NOT a product defect.**
   On `/app/boards` the card *batchAsafe-ui-drive* renders its alt text. Read at
   the network rather than guessed: the response is
   `net::ERR_BLOCKED_BY_ORB` for
   `…r2.dev/drive-batchAsafe/141-frontClose.png`, `naturalWidth 0` — the browser
   refused it because the stored object is not served as an image.
   `storagePut`'s content type **defaults to `application/octet-stream`**, so an
   object written without one is invisible in a browser forever after. Every one
   of the 24 live server call sites passes a real type (read at each); the
   specimen is fixture litter from an old `drive-batchAsafe` script. **The next
   shift must not "fix" it, and it must not be read as a broken product** — it
   is dev data rot, and it will appear in any future *before* shot of this page.
   The one thing worth carrying forward is the default: a picture stored without
   saying it is a picture cannot be shown.

## What this does NOT establish

- **Nothing about production data.** These are dev-database rows on a fixture
  account. The counts (28 models, 13 canvases, 0 garments, 0 looks) describe
  `verify-bot-local`, not a customer.
- **Nothing about the mobile shape.** One viewport, 1440×960. The rail's
  collapsed state below 720px is untouched here.
- **No verdict on any segment.** The order and the recommendation are the
  proposal's; this is only what the pages look like the day before.

## Frames in the founder's eye gallery (edition 102)

`crew-eye/0db0e9d4…` Home light · `crew-eye/8013a65c…` Home dark ·
`crew-eye/4f70ed59…` Canvas · `crew-eye/c949e7ca…` Library ·
`crew-eye/08d06569…` the rail.

Taken by foreman-98, 2026-08-29.
