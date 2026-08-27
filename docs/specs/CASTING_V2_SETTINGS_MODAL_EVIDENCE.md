# THE MINIMAL SETTINGS MODAL (#142) — evidence pack and copy audit

> **Status: dated record.** A measurement/evidence/court document from the date it states — it records what was true then; individual verdicts may since have been superseded. Current law: CLAUDE.md, the capability atlas, `DECISION_LOG.md` (#69 stamping sweep, 2026-08-28).


Built 2026-08-27 (foreman-27) on the founder's word (2026-08-26 evening,
verbatim: *"do it - add the minimal settings modal to N1"*), as the creative
register's LAST slice before the milestone gate. Design inputs:
`CASTING_SETTINGS_MODAL_DESIGN.md` §10 (his six rulings) read against
`PROMPT_AUTHOR_RULING_2026-08-26.md` §3 (settings are defaults; the prompt
overrides; a style is a bundle), and his Higgsfield reference
`docs/specs/references/settings-modal-higgsfield-reference.png`.

**Handoff surface served**: none of the north-star casting handoff files
(`docs/specs/Casting-ui-ux-design/design_handoff_studio/07-casting.md`,
`03-create.md`) carries a settings gear or modal — verified by grep on the day.
The mockup this pack compares against is therefore the founder's own reference
screenshot, and the bones it takes from it are: a title, a Reset, a close, one
line under each setting saying what it does, and a default that names itself
on the surface ("Lighting · Auto" → "SETTINGS Photoreal · Low"). The
picture-per-option carousel does NOT transfer (design §7: a style is only
picturable when closed and there is one).

Flag: `CASTING_CREATIVE_REGISTER_SCOPE` (`users:1` on production). Off, the
entrance is byte-identical — the gear is absent, never disabled.

## Frames — `docs/specs/evidence/settings-modal-142/`

Drive: worktree dev server on `:3142` with the flag `all`, verify-bot-local
(dev user 823), Playwright, 1280×900, both themes, each frame opened and
looked at by the shift before it was filed (law 6).

| # | file | what it shows |
|---|---|---|
| 1 | `hero-{dark,light}-closed.png` | the start page at rest: the gear where the meter's pills stood — `SETTINGS Photoreal · Low` — hugging its content under the brief field |
| 2 | `hero-{dark,light}-modal-default.png` | the panel open at its defaults: STYLE Photoreal (the only pill), its line, two COMING SOON rows, IMAGINATION Low/Max with Low's line, the override sentence; no Reset (nothing to reset) |
| 3 | `hero-dark-modal-max.png` | Max chosen: Max's line beneath, RESET appears; Escape closes and the gear reads `Photoreal · Max` |
| 4 | `sheet-dark-record.png` | dev roll 99, cast through this build at Low: the SETTINGS record line above the prompt record — `Photoreal · Low imagination` — and the dock's gear for the next roll |
| 5 | `sheet-light-modal.png` | the same panel opened from the sheet's dock, light theme |
| 6 | `sheet-light-old-row.png` | ⚠ **CONTROL** — dev roll 98, an author row from BEFORE the style was recorded: the record line reads `Low imagination` alone; nothing is back-filled |

The scrim measures the viewport (`getBoundingClientRect` = 0,0,1274,900 on a
1280×900 window with a 6px scrollbar — `CastingModal`'s own definition of done).

## At the row (working law 1)

Dev roll **99** (`45e1c41a…`, user 823, LOW, brief *"a fitness creator in
their 30s, close-cropped hair"*), read at `casting_rolls.compiledBrief`:
`register.kind = "author"`, `register.imagination = "low"`,
`register.style = "photoreal"`. Zero `about: "author"` calls in the server log
(LOW makes none). Dev rolls 94–98 (before this build) read
`register.style = NULL` — the control the sheet shows as frame 6.
Cost: one dev roll, ~$0.8 house (8 renders, no text call), no customer credits.

## Copy audit — every user-visible string

Per the UI completion contract (founder, 2026-08-01): prototype content is
quotation, not requirement. Classes: **verified** (his words / the ruling),
**adapted** (from the reference or the ruling, re-derived against capability
truth), **invented** (new, honest about today).

| string | where | class | source / why honest |
|---|---|---|---|
| `SETTINGS` (eyebrow, gear label, record line) | gear, panel, sheet | adapted | the reference's "Film setup" title; his own word for the surface ("settings modal") |
| `How the next cast is made` | panel title | invented | says what the panel governs: the NEXT roll (rolls are immutable) |
| `Reset` | panel head | adapted | the reference's "Reset all"; drawn only when something is not default |
| `Close settings` | aria-label | invented | — |
| `STYLE` · `Photoreal` | style row | verified | ruling §3 rule 11a: "photoreal is our only and default style" |
| `A photographic casting portrait: chest-up, studio light, grey seamless. Anything your brief says about the look, light or setting overrides it.` | style line | adapted | the block's own contents (chest-up per §3a, `LIGHTING_LINE`, the grey seamless) + rule 8 in customer words |
| `Painted realism — Illustrative realism with visible brushwork.` | coming row | adapted | rule 9's "painted-illustrative realism", described, no IP named |
| `Glossy poster — A high-gloss animated-poster finish.` | coming row | adapted | rule 9's "glossy anime-poster", described, no IP named |
| `COMING SOON` | coming rows | verified | design §10b, his phrase |
| `Styles coming soon` | aria-label | invented | — |
| `IMAGINATION` · `Low` · `Max` + both lines | meter row | verified | slice E (#138), unchanged |
| `These are the studio's defaults. Anything you type in the brief overrides them.` | panel foot | adapted | rule 8, verbatim sense: "anything in the settings outlined in the prompt is overriden by the user prompt" |
| `Photoreal · Low` | gear value | invented | derived from state through one owner (`castSettingsCopy.ts`) |
| `Photoreal · Low imagination` / `Low imagination` | sheet record line | invented | the row's own facts; style omitted where the row never stated one |

Nothing in the panel names framing, lighting or background controls — those
are advanced and N3 (#142's own bounds) — and the panel never shows the
block's text.

## What is NOT in this build, declared

- No second style. `houseBlockForStyle` is exhaustive over a one-member list;
  the coming-soon rows are announcements and leave only by going live or by
  his word (`shared/castStyles.ts`).
- No persistence. The values are page state; leaving resets them (§10 ruling
  4). The sheet's dock preselects the SHOWN sheet's own recorded settings for
  the next roll, the meter's existing rule.
- ~~The `follow` mutation still takes no settings — a follow composes house
  under the flag (#131 open item, unchanged).~~ **Superseded 2026-08-27 (#154):**
  the author carries a follow as the family clause, `follow` takes
  `imagination` and `style`, and the gear is drawn on a standing follow.
