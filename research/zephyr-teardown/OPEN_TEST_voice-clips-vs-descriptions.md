# OPEN TEST — do attached voice clips beat written voice descriptions?

**Status:** filed, not run (deferred like the baked-text test).
**Origin:** the founder's own ears on the finished ZEPHYR Special (2026-08-24):
*"there's actually plenty of dialogue in the film and they all sound like
themselves."* That observation is evidence the job records cannot provide, and
it pushes against the research's masking-heavy framing of voice consistency.
**Why it matters:** cast voices are planned development. If description-only
consistency is already strong, voice clips may only be needed for close
dialogue rather than every line — a large cost difference for the voice build.

---

## What is established vs open

**Established (measured):**
- No character-level voice asset exists anywhere in the three studied
  productions (0 of 9,460 card attachments carry audio).
- The **delivery lane for a real voice works**: the lip-sync lane attaches a
  clip (*"plays throughout, lip-synced"*) and one clip was honoured across
  716 generations. Clips are the only mechanism that *guarantees* identity,
  and the engine demonstrably obeys them.
- Dialogue voices are synthesized fresh per take from a written description
  (*"Voice: low, velvety, arrogant"*) — the mechanism, not the outcome.

**Open (the test):**
- **How much take-to-take voice variance does description-only actually
  produce?** The founder's ears say the finished film is consistent; the
  research never listened to takes side by side.
- **Does the face anchor the voice?** The unconsidered hypothesis: these
  engines condition audio on the video — the same attached face card may pull
  a similar voice every take, meaning the picture system quietly buys audio
  consistency for free.
- Whether post-production (ADR/voice conversion) contributed to the film's
  consistency is invisible to the records and cannot be settled here.

---

## Design

One shot, one cast/face card, one fixed dialogue line, N ≥ 8 takes per arm.

| Arm | Input | Question it answers |
|---|---|---|
| **A** | Face card + `Voice:` description only | The description-only variance baseline — the number the founder's observation is about |
| **B** | A + an attached clip of the line in a target voice, "plays throughout, lip-synced" | Does the clip pin identity, and at what quality cost/gain |
| **C** | Clip only, no `Voice:` description | Is the description redundant once a clip exists |
| **D** | Same description, **different face card** | The face-anchoring hypothesis: if D's voices differ from A's more than A's differ among themselves, the face is doing anchoring work |

**Judging:** ears, blind, pairwise ("same person?") — the founder's ears are
the instrument of record (law 9); a speaker-similarity model may rank pairs
for listening order but never returns the verdict.

**Pre-registered readings:**
- A consistent → description-only is sufficient for ordinary dialogue; clips
  reserved for close/leading dialogue. (Cheapest world.)
- A varies, B consistent → clips per line; the voice asset is load-bearing
  everywhere.
- D shifts voice → the face card is a voice anchor; cast-card consistency is
  doing double duty and must be protected for audio reasons too.
- B degrades lip/performance quality vs A → the clip lane has a quality tax
  to measure before adopting it wholesale.

---

## Drape consequence, either way

The planned cast voice pairs an **asset** (identity) with a **`Voice:` text
line** (performance style). This test decides *when* the asset must ride:
every line, or only where identity is exposed. It does not decide *whether*
to build the asset — that is already planned, and the delivery lane is proven.
