# Evidence pack — the Retry button (#122 shape 1), 2026-08-27

Frames in `docs/specs/evidence/retry-122/`, captured on the worktree dev
server (`:3122`, `CASTING_RETRY_SCOPE=all`, `verify-bot-local`, dev database),
every one opened and read by the shift before filing. Design:
`CASTING_V2_RETRY_DESIGN.md`. No handoff surface in `Casting-ui-ux-design/`
draws a failed tile's action, so there is no prototype to compare against —
the structure quoted is the failed tile's own (chip, line) plus one quiet
button in the tile's action row's register.

| Frame | What it shows |
|---|---|
| `tile-before-dark.png` / `-light.png` | The failed tile: chip **ENGINE ERROR**, line *Engine error · refunded*, and the new button **Retry · 20 credits** (127 px, not stretched). |
| `sheet-casting-dark.png` / `-light.png` | 5.1 s after the tap: slot 08 back on its skeleton, *CASTING 08* / *Casting…* — NOT the roll's overdue caption. Button gone. |
| `sheet-after-dark.png` / `-light.png` | 52 s after the tap: slot 08 landed (*No-nonsense drive 08*) with Keep / Follow / discard like its siblings; no failed tile, no button, no toast. |

## Copy audit — every user-visible string this change adds

| String | Where | Class | Truth it rests on |
|---|---|---|---|
| `Retry · 20 credits` | tile button | adapted (D-15 price-on-the-button; the number is server-derived `retryPriceCredits`) | `CASTING_V2_RETRY_PRICE_CREDITS = rollCandidate` (20) |
| `Retry` | tile button, price unknown | invented (fallback only while `config` has not answered) | never shown after config loads |
| `That tile didn't arrive again. Your credits are back.` | toast fallback | invented | the server's own sentence is preferred through `readableFailure`; this shows only when the error has no readable message |
| `That tile didn't arrive again. 20 credits were refunded.` | server, second failure | adapted from the roll's refund sentence | `dispatchCandidate` refunded the slice under the retry reference |
| `The refund could not be recorded — quote operation … and support will restore the balance.` | server | quoted from the roll road | `refundUnrecorded` |
| `Not enough credits. Retrying a tile costs 20 credits.` | server | adapted from the roll's | the deduct refused |
| `That tile changed while you tapped — nothing was charged. Refresh the sheet.` | server, lost reset CAS | invented | free failure at the claimed finalizer |
| `That tile is already casting.` | server | invented | row `queued`/`dispatched` |
| `That tile isn't one that failed, so there is nothing to retry.` | server | invented | row not `failed` |
| `This tile was refused by the engine's filter, not by an engine error — retrying the same words isn't offered here. Softer wording is coming.` | server, content-filter tile | invented; honest about shape two being unbuilt | his word puts content-filter tiles on the rewrite road (#93/#129) |
| `That tile isn't one a retry can serve.` | server, render-fault / unpaid | invented | not on his list |
| `That roll was cancelled, so its tiles can't be retried.` | server | invented | roll `cancelled` |
| `The sheet is still casting — retry a tile once it has finished.` | server | invented | roll not terminal |
| `That tile has no recorded prompt to retry with.` | server | invented | `internalPrompt.prompt` absent (never seen on production: 144/144 have one) |
| `Retrying a tile isn't available for this account yet.` | server, off the flag | adapted (the ink studio's shape) | `CASTING_RETRY_SCOPE` |
| `That retry didn't make it. Your credits are back.` | recovery receipt | adapted from `RECOVERED_REFINE_SENTENCE` | a swept retry, refunded |
| `That retry didn't start. You were not charged.` | recovery receipt | adapted from the roll's | a swept retry that never charged |

Mechanizable laws touched: the price is on the paid button (D-15); no
control that refuses is drawn (`retryEnabled` + roll terminal + kind on the
shared list); no success toast (D-110) — the tile landing is the answer.
