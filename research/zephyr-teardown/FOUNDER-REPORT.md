# The whole research, in plain English

*Written for the founder, 2026-08-24. Everything below is backed by the
detailed documents in this folder — this is the simple version.*

---

## What we did

We reverse-engineered how a professional studio makes AI films. We pulled
**35,000+ generation records** from three of their productions — every prompt
they wrote, every reference image they attached, every setting they used. We
downloaded their character sheets and looked at them. We downloaded their
finished videos and measured them. We listened to their audio files. Nothing
here is guessed.

---

## The big picture: how they make a film

It works like a normal film production, not like magic:

1. **Write the story** (humans do this — no AI involved).
2. **Build a small library of pictures**: one card per character, one per
   outfit, one per location, one per important object. Maybe 30–50 images
   for a whole film.
3. **Break the story into scenes**, and each scene into shots (a shot = one
   camera setup, 4–15 seconds).
4. **For each shot**: write a paragraph describing it, attach the 3–4 relevant
   library cards, and generate. Pull the handle about **5 times** until one
   take is good. Keep it.
5. **Cut the keepers together** in a normal video editor. Done.

The AI is the camera and the actors. It is never the writer, director, or
editor — people do those jobs, and that's the part Drape would automate.

---

## The ten most important things we learned

**1. Nothing remembers anything — the library is the memory.**
Every generation starts from zero. Characters look the same across 275 shots
for one reason only: the same picture is attached every time. Consistency is
a filing system, not an AI feature.

**2. One face per picture — everywhere, always.**
Their character cards show a headless body (front + back) next to ONE big
face photo. We proved this is deliberate: a later production literally orders
"cleanly headless cut at the base of the neck" in its prompts. Even special
pose references get the head cropped out. Your theory is the best explanation:
more than one face on a reference confuses the engine about who the person is.
So: **the face lives in exactly one image, at maximum size.**

**3. Cards carry rules, not just looks.**
Written on the character card: "BROWN eyes (never blue/green)" — because the
engine once drifted her eyes and they never wanted to fix it twice. "PERMANENT
horns — keep in every frame." And scenes can override: "NO horns in this
scene (for continuity with the burger shots)." The fix lives on the character,
forever, instead of being retyped in every prompt.

**4. Every reference is told what it's allowed to contribute.**
"This cockpit picture: interior only — do not use a single pixel of its
background." "This city picture: everything behind the glass comes from here,
without exception." Without these fences, four references melt into a collage.

**5. You cannot beat the slot machine — so they don't try.**
A good shot takes ~5 tries (sometimes 30+). We proved three separate ways
that better prompt-writing does NOT reduce the number of tries — a retry is
literally the same input resubmitted; the variation is the engine's. The pros
just pull again and pick with their eyes. **Design for this: sell takes in
fans of 4, let people pick, price it honestly.**

**6. Shots never "hand off" to each other.**
No shot continues from the previous one — that would break every time you
retry. Instead: nail down how a shot OPENS (subject position to the percent),
end on a HOLD (like a real camera operator), and join with HARD CUTS. What
carries across the cut: everyone's eyelines agree (via a top-down blocking
map), the sound continues (a voice carries over the cut), and the light stays
the same. Continuity lives in geometry and sound — never in matched pixels.

**7. Voices are faked, not stored.**
There is no voice technology in their stack. Each take, the engine invents new
voices matching a written description ("soprano, playful" / "low, velvety").
It sounds consistent because the words and tempo are fixed, the singing is
deliberately sloppy (sloppy hides differences), and the edit never puts two
versions of a voice side by side. Lesson for Drape: **pictures solve faces;
voices need their own saved asset one day.**

**8. Most of the prompt is telling the engine what NOT to do.**
"NOT a 3D render, NOT a game engine, NOT a cartoon. No plastic skin. No dead
eyes. No music. No subtitles. Nothing floats." Thirteen people typed these
bans thousands of times. A backend that adds them automatically removes the
single biggest chunk of manual prompt labour.

**9. The craft is learnable — we catalogued 40 tricks.**
The best ones: light the actor from something OFF-screen (a button that blinks
red 2–3 times but is never shown); give physics a *reason* ("sweat runs toward
her hairline because she is upside down"); direct the camera like a person
with reflexes ("a micro snap-in on the choke"); ask for imperfection on
purpose (off-key singing, messy hair — flaws read as real); state what the
VIEWER should feel ("the camera must make you think: how do two people even
fit in there?"). All 40 are written up with their exact wording.

**10. The everyday-person interface already exists — the scene document.**
Every scene starts from six plain-English fields anyone can fill in: who's
there, what happens, what's the mood, what should the viewer understand,
what's NOT shown, and what this generation is for. Everything downstream —
picking references, minting missing props (they made a lemonade glass
mid-scene in six minutes), camera coverage, all 40 tricks — is mechanical
from there. **The user says WHAT; the engine knows HOW.** That's the whole
product thesis, and it's the same thesis as the casting studio.

---

## How this connects to the casting studio

The mapping is almost one-to-one:

| Their film pipeline | Casting studio |
|---|---|
| Designing a character (iterate until right) | Roll → refine |
| The finished character card ("the bible") | **The signed Cast** |
| Shooting scenes against fixed characters | **Takes** (post-Sign — your call, and it matches their practice exactly) |
| The keepers folder | What lands in a campaign |

Concrete things already filed for the casting build:

- **Takes** = re-run an unchanged setup, shown as a contact sheet of 4, pick
  by eye, keep any number, sweep the rest. Never an edit — editing starts a
  new setup. (Full design: `docs/specs/CASTING_TAKES_DESIGN.md`.)
- **The cast's engine-facing card**: compose it from the six views Sign
  already bought — never generate it (their generated sheets drifted from
  their own recipe). Layout question flagged: probably **2–3 panels with ONE
  face**, not all six views — that's the one-face rule landing on us.
- **Drift locks**: "her eyes are brown — never blue," saved on the cast once,
  applied to every future render, overridden automatically whenever you
  explicitly ask for the change.
- **Outfit cards on demand**: a new outfit = one person-x-garment generation
  (which is basically what wardrobe/VTO already does), saved and reused.
  Where that artifact lives (Casting vs Wardrobe) is a decision only you can
  make — it touches the D-62 boundary.
- **A Voice field at Sign**: costs nothing to record now, matters the day
  casts appear in video.

---

## What Drape's future film engine would be

Take the scene document (the six plain fields), and build the machine
underneath it:

1. Resolve names to cards (the cast, the place, the props).
2. Mint anything missing, on the spot.
3. Add the fences, the bans, and the craft automatically.
4. Generate takes in fans; the user picks with their eyes.
5. Hard-cut keepers in scene order — a rough film assembles itself from the
   act of picking favourites.

Everything needed to spec this is written down: the framework
(`THE-FRAMEWORK.md`), the 40 tricks (`THE-CRAFT-PLAYBOOK.md`), the full
prompt vocabulary (`PROMPT-TECHNIQUE-REFERENCE.md`), and the build-shaped
version (`DRAPE-IMPLEMENTATION-SPEC.md`). Nothing is scheduled — it's all
research waiting for your go.

---

## Decisions that are yours (parked, not forgotten)

1. **The baked-text test** — their cards have text printed on them (name,
   height, voice — even style instructions) and ship anyway; ours are
   textless by your ruling. One cheap test settles whether text on a
   reference helps, hurts, or does nothing. Deferred at your instruction.
2. **Where outfit cards live** — Casting or Wardrobe (the D-62 line).
3. **Takes pricing** and whether scenes ship with takes v1 or later.

That's everything. Three films, 35,000 records, read to the bottom.
