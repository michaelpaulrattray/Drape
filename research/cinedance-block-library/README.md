# CINEDANCE block library — what we take for the cinema studio

**Filed 2026-10-12, on the founder's word ("add to our research everything we can take to improve our cinema when we start building it"). Cinema design is PAUSED; this is research intake only — nothing here changes the build truth (`docs/specs/Casting-ui-ux-design/drape-redesign/12-cinema-full.md` §16.10), it waits for the build.**

## Provenance

A packaged prompt library ("CINEDANCE — BLOCK LIBRARY v1", ~39KB) maintained by the Higgsfield creator behind the Kaye Creatives account, supplied by the founder 2026-10-12 alongside their blog post (`higgsfield.ai/@kaye_creatives/blogs/zombie-dog-prompts` — the post itself serves no readable body, only metadata). It is a working creator's hand-built version of a **take compiler**: they write a nine-line brief (TRICK / FORMAT / ASSETS / MAIN / FAIL / COUNT / TASK / ACTING / BLOCKS) plus a list of block codes, and an assistant assembles the full Seedance/Higgsfield video prompt from ~40 named blocks in a tested order. Their consistent character ("Karima") is locked with a ~3,000-character face description — what our signed cast carries invisibly.

The same creator's full film-breakdown video (how the library's techniques were used to make a real 9-scene film) is studied in **`film-breakdown-good-boy.md`** beside this file — the `.skill` package turns out to be that video's companion giveaway.

The original document is **not** committed here: it is a third party's working document and this repository is public. These notes carry every technique in our own words, with short quotes where the wording is the finding. The verdict below was written against our own research record (`docs/specs/CASTING_TAKES_DESIGN.md`, the zephyr teardown, `COMPETITOR_WORKFLOW_ANALYSIS.md`).

## What it confirms (second source, no change needed)

1. **Camera-visible words over psychology adjectives.** Their rule 4 is "Numbers instead of adjectives" — `"Beautiful", "slightly", "a little" — the generator cannot execute these`. Their acting register is restrained, played through the body and eyes ("a shout becomes a quiet exhale; shock becomes a physical recoil that happens BEFORE any expression"). A shipping creator independently arrived at the craft rules we ruled for N2b personality: visible facts, never mood labels.
2. **The engine should do this homework.** The library exists because Higgsfield makes the customer maintain it by hand — 40 blocks, a face-lock paragraph, a pre-send checklist. It is the disappearing-technology law's counterexample made flesh, and the clearest competitive confirmation yet that Klieg's bet (this whole library lives inside the engine, never in front of the customer) is the right one.
3. **Identity lock = our signed cast.** Their face block pins features in both directions (bans on Westernising drift AND on idol-styling drift), locks age ("she is 20, not a teenager and not thirty"), and deliberately preserves asymmetry ("No AI-typical symmetry — one brow marginally higher, one eye marginally narrower"). Same shape as our masterPrompt/technicalSchema discipline; the asymmetry-preservation clause is worth copying into our identity vocabulary.

## Techniques to take (new to our record)

### 1. The small task — their strongest directing trick
Give the character one mundane, ongoing physical task she never abandons, **including during the main event**: "A giant hand lifts the girl — she keeps scrolling on her phone." Their claim: this makes a character feel more alive than any description of the face, and **the task produces the emotion** — "her reaction to the event is smaller than her commitment to the task." For our take engine: compose a take as stored personality + one small task derived from the scene, rather than an emotion instruction. Pairs exactly with our personality shape (baseline + one break): the task IS the baseline under pressure.

### 2. One trick per shot; the rule, then its consequences
Build each shot around ONE mechanical technique, state it as a rule, then derive 3–4 consequences from it in the prompt ("the device is never visible → so there is no outside view, no table with a phone, no hand holding a phone"). Never describe the picture; state the rule and its entailments.

### 3. Inversion-derived negatives
Take the shot's one rule and mechanically ban 8–10 ways of reversing it: if the rule is "the object stays still, the world moves", ban "the object moves", "the world stays still", "the camera follows it from outside", "the camera orbits it", "the object leaves frame"… Their principle: **half the ban list must be specific to this shot**, not generic hygiene. Our take compiler should derive this automatically from the shot's rule — one idea, ten negative formulations, zero customer homework.

### 4. Fail conditions and count locks written at compose time
Every prompt carries "IF [the predicted failure] HAPPENS, THE SHOT IS WRONG" lines plus an exact count lock ("exactly 1 of X, exactly 3 of Y — in every single frame; no duplicates, no extra appearing at a cut"). Two uses for us: (a) in the prompt itself, addressing failure before generation; (b) as the compose-time source for our catastrophic-only checker (#1903's vocabulary: not her / broken / wrong count) — the checker gets a concrete per-take list instead of a general question.

### 5. Measurements in body units, cross-checked three ways
Any size claim gets at least THREE independent cross-checks against the character's body ("taller than her torso; wider than three of her shoulder-widths; its edge at her mid-thigh") plus ONE physical contact test ("her fingers wrap it and the tips do not meet"). Ban size drift in both directions. Also their scale inversion: never describe her as small — describe the world as enormous, measured in units of her.

### 6. Per-reference contamination bans
For every reference image: take ONLY what is named and nothing else — explicitly not its people, hands, clothing, **lighting, colour temperature, grade, depth of field, framing, aspect ratio, sheet layout**, or any unrequested object. Plus one global people-law overriding all assets ("there is only one person in this entire piece, and she comes only from [asset]; every hand seen is hers"). This sharpens our "skeleton for ads, ingredient for film" reference law with the missing half: the per-asset DO-NOT-TAKE list, stated per reference, not globally.

### 7. A tested assembly order for the final prompt
Their 21-slot order, kept verbatim as data (it is their tested result, not prose): scene context (the trick, one sentence) → format in numbers (duration, shots, cuts with timecodes, aspect) → people-law → the 1–2 unbreakable rules + fail lines → active references + contamination → body/scale → face → spatial layout by depth → action timing moment-by-moment with timecodes → acting block → camera → optics → world (wind/water/rain/living background) → physics + anatomy → lighting → integration → materials → grade + grade-lock → no-freezing + count + coverage → sound → shot-specific inversions + base negatives. The shape to keep: **identity and unbreakable rules high, timing in timecodes mid, negatives last, and priorities stated explicitly** ("THESE TWO RULES ARE THE MOST IMPORTANT IN THE SHOT").

### 8. The acting-task block (Stanislavski, machine-readable)
Per shot: scene direction (what she is trying to do in these seconds, unspoken) / motive (why now) / goal (the concrete want) / obstacle / tactic ("how she works around it — this is what we actually see"), then beats mapped to timecodes where **the eyes carry the performance** ("the face is a side effect of the eyes, never the point of the beat"). Gaze safety rails: never into the lens except designated timecoded moments; head and eyes always agree; irregular blinks, micro-movements, no fixed stare. This is the per-take layer that sits ON TOP of our stored two-line personality — personality is permanent, the acting task is composed per take from the script.

### 9. A named camera-treatment vocabulary with numeric specs
~10 treatments, each a reusable block: handheld specified in numbers (8–14px low-frequency wander, 2–4px tremble at 6–9 Hz, breathing cycle, late reframes that overshoot, breath-holds on the key beat, focus that hunts); "living tripod" (locked but barely alive, 2–3px); rig-mount ("the object does not move in frame — the WORLD moves"); POV ("no device is ever visible; everything that happens to the object happens to the frame"); a three-stage pullback-turn (macro hold → walking pull-back → pivot onto the face with overshoot and late focus); over-shoulder with a slow sidestep and a rack that passes through a real unsharp beat; high plan shot; hand-operated zoom with overshoot-and-correct. For our storyboard: the grey framing labels on shot cards are the customer-visible end; a library of this grade is what they compile to inside the engine.

### 10. World and physics blocks, layered by depth and speed
Wind with every organic layer on its own frequency and "nothing distant moves at the speed of something near"; rain in five depth zones (on the lens → near drops → mid curtain → far haze → impact zone), with the ban "no rain that exists only as water running down the character while the background stays dry"; living background with designated bird events ("one or two only, never a flock") and a still anchor ("the most distant elements do not move at all"); water with one consistent current direction and standing riffles. And the **integration lock**: cast shadow on real ground, ground marked by weight and staying marked, occlusion by foreground geometry, reflection in every reflective surface, bounce light filling the shadow side, airborne matter passing in FRONT as well as behind, shared exposure/grain/softness at her depth plane — "if any frame shows her sharper, brighter, cleaner or flatter than her depth plane, that frame is wrong."

### 11. Grade lock with named exceptions
One grade across every shot, no drift at cuts — plus an explicit exceptions list: "BUT THE FOLLOWING KEEP THEIR FORCE: [the one saturated object, the costume colour, whatever must not go grey]." The exceptions-that-keep-force pattern is the detail our record lacked: a lock always ships with its enumerated exemptions.

### 12. Sound as a first-class block
Diegetic only, layered by distance (room tone with correct reverb → body/clothing/contact → mid location → distant at the edge of audibility), "no sound exists without a visible cause", breathing always present; and the sound field **swings with the camera** — at a hard cut the soundscape flips instantly and completely on the exact frame, no crossfade.

### 13. No-freezing
Continuous movement from a shot's first frame to its last — hands, breathing, weight, fabric, hair; "the last second of the piece has as much life in it as the first." A one-block cure for the dead-start/dead-end failure every image-to-video pipeline shows.

## Where this lands when cinema is built

- **Take compiler:** techniques 1–8 and 11–13 are compile-time rules — composed by the engine from the script, the shot and the cast's stored personality. None of them is a customer control.
- **Checker:** technique 4 feeds the catastrophic-only checker its per-take "wrong" list (counts, the predicted failure, the trick's inversion).
- **Storyboard:** technique 9 sits behind the framing labels (§16.10: framing as grey labels on the shot) — label on the card, treatment block in the prompt.
- **References:** technique 6 extends the ads-skeleton/film-ingredient law with per-asset do-not-take lists.
- **Register warning:** everything here is engine-side prompt-engineer shorthand — the same register as the ~90-character keyword lines in the casting corpus study. It never reaches a customer surface; the customer's vocabulary stays the one §16.10 and CASTING_TAKES_DESIGN.md already rule.
