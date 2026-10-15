# Joey's five-skill cinema pipeline — teardown

**Filed 2026-10-12 on the founder's word.** Sources, all studied in full: the five skill packages the founder supplied (`shotcaller-v1` 53KB — the Seedance video-prompt director; `castkit-v1` 40KB — character builder; `scenecraft-v1` 30KB — scene-plate builder; `motiondojo-v1` 36KB — Genjutsu motion transfer; `story-bible-builder` 32KB across four files — the canon layer, §below; all by "Joey" / @joeysnoisygroup, distributed free via his Higgsfield blog, which itself serves no readable body); his 18-minute breakdown video (`youtube.com/watch?v=5dWgZDka3Ww`, "Prompt Like a Director, Not a Prompt Engineer") — full transcript plus ~100 frames eye-read, including his actual Claude chats and generated prompts on screen. Skill text summarized in our words with short quotes; the originals are third-party documents and are not committed.

## The headline: a second independent studio converged on our architecture

Joey's four skills decompose exactly the way Klieg's engine does: a **character tool** (castkit ↔ casting studio), a **place tool** (scenecraft ↔ minted places/plates), a **shot compiler** (shotcaller ↔ the take compiler), and a **performance-transfer tool** (motiondojo ↔ a future direction lane). This is now the THIRD practitioner corpus with the same shape — ZEPHYR ran Claude skills (CINEDANCE + acting system + diagram skill), Kaye runs her block library as a Claude skill, Joey ships four. The market's best workflow *is* our product's internal architecture, maintained by hand because no product carries it. His own framing seals the competitive story: his whole video is a tutorial on machinery his audience must learn — the thing Klieg exists to delete.

His session opener, read off the screen: *"use banana pro director skill in this chat, and the cinema director v3 skill and the character builder skill in this chat"* — then a scene-plate ask in plain words, then a comedic-skit brief told exactly like telling a friend (POV beats, a bell sound effect, a sneeze reveal — pure story prose). The skills do the rest. That is our assistant-plus-studio, operated manually across two products.

## What CHANGES our record (not just adds)

1. **The no-chaining law now has a dated carve-out.** The zephyr record measured video-to-video continuation as absent (1 of 275 shots) and our `FILM_ENGINE_DESIGN` §6 rules "no shot-to-shot memory — islands + assets + hard cuts." That was Seedance 2.0-era truth. **Seedance 2.5's Extend Video works and a top creator calls it "one of the biggest ways to get video consistency"**: it ingests up to 30s of an existing clip, analyzes placement and identity, and continues as sequel or prequel; he cut the join into his film and "couldn't even tell." Shotcaller formalizes the craft: a continuity paragraph that names the exact final frame, the held moment breaking within the first quarter second, light stated as continuous across the join, six extension types. **Islands remain the right default between shots; extension is now a real road for continuity inside a scene** — and it is exactly the mechanism our whole-scene staging and "direct one shot, it replaces its moment" ideas would ride on. The model-expiry law (disappearing-tech clause 1) did its job here: a measured 2026-08 truth died within months.
2. **Reference-slot arithmetic superseded again.** Seedance 2.5 takes 50 image references and 30s (vs 9/15s on 2.0), and Higgsfield Elements is the ZEPHYR Special's named registry productized — his prompts cite semantic tags (`@gorilla-tae`, `@gorilla-tae-resting`, `@gorilla-laundromat-plate-1`), not slot numbers. Note the **pose/staging element**: `@gorilla-tae-resting = "his position in the room and the lean pose"` — a staging state saved as a named asset. And shotcaller's step zero is capability-aware compilation: **the compiler asks which engine version before writing, because the prompt's shape derives from the target's caps** — our take compiler must read the capability atlas the same way.
3. **The baked-text question gains a practitioner on our side.** ZEPHYR baked text into sheets and shipped; Drape's rule is text-free exports; castkit's sheets rule **"No text, no labels, no numbering anywhere in the image."** Two of three mature practitioners now agree with our rule. The open test (`OPEN_TEST_baked-text-on-references.md`) still decides it, but the weight moved.

## New craft worth taking (by engine layer)

### Character plates (castkit → our sheet/view rendering)
- **Zero lighting baked into reference plates.** Every plate renders on a flat 18% neutral gray field, shadowless, no cast shadow, no background falloff: "the plate carries zero lighting; the scene does the lighting later." Gray, not white, because maximum edge contrast is where models bake halos. Worth a court against our own signed-view and sheet exports.
- **The identity firewall**, verbatim-shipped on every change: "everything other than [the change] is identical to the attached reference… only [the change] is different" — our refine discipline, stated as a reusable block, with the rule that face-at-rest changes force a re-lock.
- **Stations with prerequisites** — no outfit on an unlocked face, no sheet before an approved outfit ("fixing a face in text is free; fixing it after twelve outfits is not") — the economic argument for our sign gate, from the market.
- **Sheets are measuring tools**: every panel dead-on orthographic (never a three-quarter turn), 3-panel default because six panels starve the face's pixel budget, headless front panel chosen by a neckline test (ghost-mannequin hollow vs clean neck cut), a mandatory skin-tone-consistency line because rear panels drift darker.
- **Locks are versioned** (`lock-01`, `lock-02-red-hair`) — the state axis again, filed as versions.

### Scene plates (scenecraft → our places)
- **Model routing by job**: Seedream for plates (cheap, and its *imperfection* is the point — "it's overexposed, you can see halation… looks exactly like what I'd be filming on set; the better input, the better output"), Nano Banana Pro for faces. An engine's flaws can be a look — material, not defect.
- **Coverage sets**: master plate approved first; every other angle attaches the master, states its vantage *relative to the master*, and **rewrites the light physically for the new vantage** (the sun that was camera-right is camera-left on the reverse) while holding surfaces and dressing. This is the concrete recipe for "the same place from several angles" our scenes need.
- **Plate edits as target / change / protected** — never a re-description; the protected list is why the rest of the frame survives. Maps to our refine grammar.
- **The resolution filter**: describe only what this lens at this distance in this light could resolve — "a car at 60 metres at speed is silhouette, color blocks, and headlight bloom, not badge lettering." Detail is earned by proximity, stillness, and light.
- His project hygiene, visible on screen: folders named **Characters + Props / Location Locks / Video Gens**, and the plate annotated with red circles marking the machines that must recur — spatial geometry as the #1 consistency concern.

### The take compiler (shotcaller — CINEDANCE's vocabulary, matured)
- **A locked 16-slot spine** (header → style quad → no-on-screen-text → max-4 critical blocks → assets with voice → geometry map → first frame → optics → camera → light/colour → atmosphere → timecoded action → physics → acting → audio → locks). Position matters: "things at the top of a prompt hold true" — suppression and headers go first.
- **Degrees-first lenses** ("the model snaps to degrees": 47° (50mm) dialogue two-shot, 18° (120mm) held close-up), four named handheld registers with cant ranges, unusual lenses shipped with a "defense battery."
- **The dialogue system** — the deepest new material: what-is-said and how-it-is-said are separated or the model blends them. Every line appears **verbatim three times** (THE SCRIPT block, its timecoded beat bound to a body, and AUDIO with a per-line delivery spec — volume/pace/pitch/stressed word/breath/distance/room); every listener gets "says nothing in this beat" plus an action or the model gives them words; a **word budget** of ~2.5–3 words/second against the runtime, flagged before building; punctuation is performance data; cuts fall between lines, never inside a word. This is the blueprint for our dialogue takes and the voice lane's delivery grammar.
- **Fiction framing**: "THE SUIT IS A COSTUME — CRITICAL: unmistakably a human wearing a shaggy faux-fur mascot costume… never a real gorilla" — the model must be told what a thing *is*, not just what it looks like, or it renders the wrong ontology.
- **Atmosphere without fog** (air as a full-frame density gradient, vapor only with a named source), **three sourced colour bands** (~70/20/10, every band naming an in-frame source), **no negative-prompt block** on this engine — negations inline (an engine-convention fork from zephyr's negative-field rule: the compiler owns per-engine conventions).
- **Symptom-keyed repair tables** in every skill (model invents lines → THE SCRIPT isn't first; extension resets → continuity paragraph doesn't name the final frame…). Our checker and retry flow should key repairs by symptom the same way.

### Motion transfer (motiondojo → a future direction lane)
Genjutsu motion transfer with three forms (copy body+camera / copy camera only / copy body, rebuild camera), role assignment by screen position, an individuality block so two performers are never clones, population locks with exact counts, physics rewritten for the *new* ground. Competitor analysis already filed Runway's Act-Two as this lane; motiondojo is its prompt-level craft. Not for now; filed for the take engine's choreography future.

## Design-facing notes (for the prototype and the gates)

- **The still is an anchor, not necessarily the first frame.** He deliberately did *not* image-init his video from the Tay plate — "when we do things like that we end up getting more plastic image creation"; the plate is a consistency element while the video generates free. Our stills-first spend gate stays (judge blocking cheap), but the build keeps still-as-anchor vs still-as-init an engine decision, never a promise that take 1 starts on your picked frame pixel-for-pixel.
- **His philosophy is the control ladder's market echo**: "AI is the tool, not the brain… if we just send what we want and have it do it on its own, we're not building anything that comes from us," and "you are the director — you have to know which side of the frame the character comes from." The lazy-director law stands — but laziness must never remove the director's hand. Our ladder (fields → notes → exact instructions → blank page) is the right answer to the segment that thinks like him.
- **Costs**: the laundromat project ran ~800 credits ≈ **$32** on Seedance 2.5 (his own overlay); Higgsfield is running an **unlimited-but-slow free queue tier** for 2.5 — a pricing shape (patience as the price) worth remembering when Pricing Phase 1 returns.
- His Claude-native extend move: drag the clip into Claude, "analyze each frame, understand where everything is, build me the prompt to continue" — the assistant *watches a take and writes its continuation*. Our assistant should be able to do this against kept takes when cinema is built.

## The fifth skill — story-bible-builder (the canon layer)

Supplied the same day; it completes the architecture. The other four skills render; this one holds **what is true about the world** — and shotcaller names the split exactly: "a story bible supplies who and what world (voice, movement, palette, era); this skill supplies how it's shot." That is casting-feeds-cinema, said by the market: the bible pipes character voice into the audio block, movement/stillness into the subject lock, era aesthetics into the grade, production rules into every render — precisely how a signed cast's stored personality, voice and drift locks ride into our takes.

What it is: an **interview** that turns a creator's loose story into one dense canon document (premise · thesis · timeline · aesthetic-per-era · factions · locations · world rules · characters · ensemble dynamics · structural engines · production rules), installed as a persistent skill so "future Claude sessions know their world." Creators hand-maintain canon files because no product holds canon. Klieg's Production/Campaign *is* this bible, derived from the script and ratified — nothing to install, nothing to maintain.

What's genuinely new for our record:

1. **The Speech / Movement / Stillness triple.** Every character carries three quoted prompt-ready descriptors, and **Stillness is its own axis** — "often more revealing than movement: what do they look like at rest? Hands, weight, expression, breath." Our N2b personality (posture+gaze line, timing line) and voice line converge with this independently; the movement-vs-stillness split is a sharper taxonomy worth holding beside ours. His quality bar is also ours: "if a descriptor can't be pasted verbatim into a prompt block, it's written wrong."
2. **The interview method is our capture doors, validated.** One character at a time, never batched; **function before looks** ("not their job — their function: The Heart, The Watcher"); push on the vague ("'dark and moody' isn't an aesthetic lock — what colors specifically?"); read back and iterate until locked; **never invent — `[TBD]` over guessing** ("invented canon becomes locked canon becomes prompt drift"); keep the user's own phrasing verbatim — our words-never-rewritten law as interview discipline.
3. **Locks exclude as much as they include.** Every lock ships with its never-clause ("warm fair skin — never pale porcelain, never tan"), captured by asking the user *what the wrong drift would be*. Our drift-lock capture should ask that question in those words.
4. **Aesthetic-per-era blocks** — one palette/light/texture signature per timeline era, each line "copy-paste-ready as the environmental anchor for a scene prompt in that era." The time-jump look (Kaye's two sheets, zephyr's state axis) as first-class canon: a film's look is per-era, not singular.
5. **Ensemble dynamics as canon** — "who fills silence, who leads, who watches; which pairings are calm, which are charged" ("Maren and Wren are the quietest room in the house"). Short, and his own note says it: disproportionately valuable for ensemble scenes. Our cinema design holds nothing about relationships between casts; this is the cheapest-to-add missing layer, and it feeds multi-character staging directly.
6. **Structural engines** — the story's recurring chapter *shapes* (the council meeting, the tide night, the confession), stackable, "a menu of story shapes to pull from." A scene-proposal vocabulary for our script room's dramaturgy pass.
7. **Present-tense psychology** — where the character is *right now*, with the internal contradiction named ("the thing they're doing versus the thing they're actually feeling — that gap is where the drama lives"). Story-state on the character, which our takes could read per scene.
8. **The small-detail doctrine** — one formative, small, specific detail beats grand backstory ("she fixed the sink herself at 3am because the plumber would have asked questions").
9. **The completeness test for canon**, worth adopting as the test for our Production data model: *"could a stranger who has never heard of this story write a scene in it, using only this bible, and get it right?"*

## Scorecard against the existing record

| Finding | Status vs our record |
|---|---|
| Four-skill decomposition = our engine layers | **Confirms** (third independent corpus) |
| Plain-words brief in, skills do the rest | **Confirms** Kaye + our brief-first design |
| Scene plate before everything ("get the plate right first") | **Confirms** scenecraft ↔ our places; strengthens plate-first |
| Extend video as a continuity road | **CHANGES** the islands law — carve-out filed above |
| 50-ref cap + named Elements registry | **Supersedes** slot arithmetic (second supersession) |
| Sheets text-free | **Shifts weight** in the open baked-text question |
| Flat-gray zero-lighting plates | **New** — court our own exports |
| Dialogue system (verbatim ×3, delivery specs, word budget) | **New** — blueprint for dialogue takes + voice lane |
| Coverage sets with physically rewritten light | **New** — the same-place-many-angles recipe |
| Fiction framing (costume ≠ animal) | **New** class of compiler declaration |
| Degrees-first lenses, repair tables, no-negative-block on 2.5 | **New** engine-convention detail for the compiler |
| Bible feeds director skill (voice→audio, movement→locks, era→grade) | **Confirms** casting-feeds-cinema, from the market's side |
| Speech/Movement/**Stillness** triple, quoted and prompt-ready | **Converges** with N2b; stillness as its own axis is new |
| Never-clause capture ("what would the wrong drift be?") | **New** question for our drift-lock capture |
| Ensemble dynamics + structural engines + per-era aesthetics as canon | **New** layers for the Production data model |

---

# Second video: "the AI video explainer you were looking for" (filed 2026-10-15)

`youtube.com/watch?v=fMU7Ku8ma4A`, 29:13, published 2026-08-02 — his first long-form process film, made in the **Seedance 2.0 era** (15s ceiling, 9 refs; it pre-dates the Extend carve-out above, so nothing in it weakens that finding). He builds a complete docu-style short ("DJ Ravena") from nothing on camera: character builder → outfit plates → Cinema Studio elements → AI-director generations → edit → voice. Full transcript read; 9 contact sheets eye-read, with two verbatim prompts recovered off the screen.

## The ElevenLabs ADR lane — demonstrated, not just testified (22:54)

The record until now held the generate-then-dub order as *testimony* (Gossip Goblin, logged in `OPEN_TEST_voice-clips-vs-descriptions.md`). This video is a second practitioner **demonstrating it end to end** on a finished film:

- Every take generates with the engine's own synthesized voice; the character's written voice/personality (his story-bible "Zara" example: "she's got a specific kind of voice… we deliver that every time we talk about Zara") rides in the prompt as text.
- The finished edit exports as one `.wav`/`.mp3`, goes to ElevenLabs, converts to the chosen voice, and swaps back in: *"we're going to give her her own specific voice that is true to her and stays consistent throughout the whole video… it came across perfectly."*
- **The generation's non-dialogue audio is kept underneath** — laughs, footsteps, room SFX — *"so it feels like something you're watching and not just a voiceover."* (The split/convert/remix order, from the market.)
- Persistence, his words: *"you can also get those voices saved in Eleven Labs itself, and you'll never lose them."* He **picks** from the community voice library rather than designing one — the browsing step a design-from-description door dissolves.
- His review ear for converted audio: **pacing and structure — "make sure it doesn't sound like they're performing."**

## The music lip-sync protocol (24:14) — NEW, with exact numbers

Nothing in the five skills carried this precision. For a character lip-syncing to real music on Seedance:

1. Cut the song section to **4–10 seconds, exactly** — *"has to be 5 seconds exactly, 5.00"* — matched to the shot length you'll ask for.
2. **Extract the vocal stem** (he names moises.ai) and attach **a cappella vocals only**; the instrumental misleads the engine.
3. Upload the clip **as a video file, not an .mp3** — an ingestion quirk of the platform/engine.
4. Declare it the sole audio source with the clip length stated in the prompt.

Skipping any step: *"Seedance begins to hallucinate… makes the song sound completely different entirely, and your characters are not going to be singing it."* This extends the dossier's §5.6 (attached track owns all timing) with the sizing, stem, and container rules — and it is engine-convention-dated like everything else (Seedance 2.0).

## Verbatim artifacts recovered from the frames

- **The Mode 5 outfit-replacement prompt**, complete: *"Replace the character in @image1 with the character in @image2. Keep the outfit and pose from @image1 exactly. Match the face, bone structure, body type, skin tone, and hair from @image2. Clean mid-gray seamless studio background, even neutral mid-gray with no seam line, soft large-source studio lighting, skin and outfit rendering at their true natural tone against the neutral gray, natural film grain, full body framing."* With the operating rule: *"Attach in this exact order: @image1 = the outfit plate, @image2 = your character face card. **Order matters — reversing it breaks the transfer.** The prompt is deliberately lean; the two references carry the photographic load, so don't add stack language on top."* — lean-prompt-plus-heavy-references as an explicit philosophy.
- **The assistant managing the audio contract itself**: Claude's on-screen reply to a music-video ask — *"you didn't mention a clip upload for this one, so I've written it with @video1 as the driver in line with the other lipsync shots. If there's no clip, say so and I'll swap the Sound Bed to diegetic with silent mouthing."* The assistant tracks which shots carry an audio driver and offers the fallback unprompted — a behaviour spec for our assistant.
- **Interview-scene direction observed**: camera locked off, eye-line past the lens ("never looks at the camera directly… talking to the director"), and the suppression rule with its cost stated: *"no music at all, only dialogue and sound design… otherwise you're fighting random music that's going to be baked into your video literally, and you can't do anything about it."*

## Confirmations and economics

- **Why 18% gray** (the castkit rule's missing *why*): white backgrounds + hard studio lighting produce "plastic" video generations; flat gray + flat light survives the handoff.
- **Start frames read as plastic too**: he avoids image-init shots; uses a start frame only to pin an exact placement, and then opens the take from a different angle for depth — the origin statement of the still-as-anchor vs still-as-init distinction.
- **Credit economics**: with the skills, **1–2 generations per scene**; the bell-curve line: *"prompt boxes are not linear — more detail helps until it doesn't, and then it breaks. The skill is a map of where that peak sits so you're not finding out by burning credits."*
- **"Get it to 70, not 100"**: grain, grade, warped edges added in the editor; *"an AI video generation doesn't stop right when you generate… the real sauce comes in the editing."* (His deliberate honesty aesthetic; a taste position, filed as his.)
- **His Cinema Studio read** [C-corpus relevance]: folders + element tags + an in-tool AI director; he calls it "an enhanced video generation project bank file structure" — organization, not direction, which is the gap our cinema fills.
- Joey's own ensemble includes a character named **Mira** (platinum bob; "CORPS FAN-OUT, MIRA REVEAL" in his shot plan) — no relation to ZEPHYR's Mira; two corpora each carry a Mira, so cite which when quoting.
