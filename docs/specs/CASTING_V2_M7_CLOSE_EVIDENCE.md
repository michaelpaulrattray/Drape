# M7 close — evidence pack

**Closing Sign:** `KI-QNW6-37KK-RVS9-XMKD` ("Jericho"), 2026-08-02.
**Five of five landed. 450 charged, nothing refunded.** The flagship six-tile
room, in one Sign.

Signed 11.8s · close-up and full front +91s · profile and back +131s ·
three-quarter +142s.

---

## The run validated three fixes at once

| | last run | this run |
|---|---|---|
| **Side profile** | refunded — `pass:false` beside *"it satisfies the 90-degree side profile requirement"* | **passed** |
| **Full back** | refunded — *"dark leather dress shoes instead of plain neutral shoes"* against a chest-up anchor | **passed** |
| package | 3 of 5, 100 refunded | **5 of 5, nothing refunded** |

Both failures last time were the judge, not the images. Both are closed.

---

## (1) One field for one fact

The judge no longer emits a boolean. It answers with a single **verdict** —
`matches` / `differs` / `unsure` — and `pass` is derived from it. The note
explains and has no authority: a note that disagrees is a badly-written
sentence, not a second opinion the code has to arbitrate.

**The old shape no longer parses**, so a reply carrying a bare boolean fails
closed rather than being read as an authority. `unsure` is explicit rather than
inferred, because fail-closed is only honest if the judge can *say* it could not
tell instead of being forced to pick a side and hedge in prose.

Regression: `viewConformance.test.ts` replays the exact specimen — the passing
sentence now lands as a pass — and asserts the old contradiction is
**unrepresentable**, not merely absent.

---

## (2) The tripwire

`checkCandidateInvariants` runs **before** each retention sweep — before, so it
is never checking the sweep's own output, and a guard lost inside the sweep is
never reported as pre-existing. It alarms in the roll alarm's shape ("stop and
look at the plumbing") and **repairs nothing**: a row in a forbidden state is
evidence, and tidying it away would destroy the only trace of whatever wrote it.
Pinned by test, including that the module contains no `update` or `delete`.

The two dev rows are left in place as archaeology. They are inert — the purge
feed refuses any signed candidate — and both affected Casts render normally.

---

## (3) Founder findings on Jericho's room

**(a) Pronouns come from the record.** Derived server-side from
`technicalSchema` and projected as three words plus plural agreement. Verified
live on two Casts from the same build:

```
Package Three One  →  he / him / his
Jericho            →  she / her / her
```

Rendered proof in `m7he-room-dark.png`: *"the ones **he** appears in are listed
here."*

`they` is the fallback and the correct English for an unstated sex. All three
conjugations tested for all three cases — the bug was not "the wrong word" but
"one word everywhere", and a fix that got `subject` right while leaving
`possessive` hardcoded would have read as fixed on the one surface that was
checked.

**Swept, and the sweep found more than the report did:** the Siblings card, the
"Open the sheet … came from" link, the campaigns card, the sibling third-case
caption, the delete ceremony, the roster rename dialog, and the Sign confirm.
A lint (`pronounGrammar.test.ts`) now scans every casting surface with comments
stripped — prose explaining the rule necessarily contains the words it forbids,
and a lint that cannot survive its own documentation is one the next person
deletes rather than obeys.

The Sign confirm says **"them"**, and there that is not a fallback: a candidate
has no signed record to derive from, and at that moment the customer has not
told us who this is — they are about to, by naming them.

**(b) The magnifier is gone.** `cursor: pointer` on every image that opens the
viewer. `zoom-in` promised a zoom the viewer does not perform — it opens the
picture rather than magnifying in place — and the pointer is the standard
signal, invisible through familiarity, making no claim the surface does not
keep. No hover treatment beside it. Pinned: no `zoom-in` or `zoom-out` anywhere
in casting.

**(c) The viewer closes on anything that is not the picture or the chrome.**
`target === currentTarget` closed only on the scrim itself, so the figure's
padding and the caption's whitespace swallowed the click and the dialog felt
stuck for a reason nothing on screen explained.

---

## Screens

`m7-room-dark.png` / `m7-room-light.png` — the flagship room, five of five.
`m7he-room-dark.png` / `m7he-room-light.png` — the male Cast, pronouns correct.
`m7-strip.png` — the v3.1 package strip.

Measured on the live room: 9 media frames, all `<button>`; 0 hover action rows;
0 download anchors outside the viewer; "Download package" present.

---

## Suite

3,992 passing, typecheck clean, build green, Atlas fresh. Commit `23c8f3d3`,
deployed dark.

**M7 has nothing left owed.**
