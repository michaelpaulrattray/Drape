# Cinema research dossier — findings only

**Compiled 2026-10-12 on the founder's order, for his product engineer.** This document contains **no design recommendations**. Every entry is a measurement, an observation, or a direct quote, with its source. Where the underlying documents also contain design proposals (ours), those are deliberately not restated here — the UX/UI conclusions are yours to draw. Appendix A lists the constraints the founder has already ruled, which bind any design; Appendix B indexes the sources. Pointers are repo-relative; the repository is public.

**How to read the sources.** Four independent corpora: (1) **ZEPHYR** — a 13-person studio's full production records, 18,918 generation jobs mined plus the makers' own written post-mortems (`research/zephyr-teardown/`); (2) **Kaye Creatives** — a top Higgsfield creator's prompt library and her frame-by-frame film breakdown (`research/cinedance-block-library/`); (3) **Joey / @joeysnoisygroup** — five published Claude skills plus his workflow video (`research/joey-cinema-skills/`); (4) **competitor documentation** — Runway and Higgsfield, read from their own pages (`docs/specs/COMPETITOR_WORKFLOW_ANALYSIS.md`). Every finding is tagged [Z], [K], [J], [C], or [D] (Drape's own measured incidents).

**Expiry warning.** Findings are engine-version-bound where marked. One major finding in this record has already died of model progress (§3.6). The ZEPHYR corpus is Seedance 2.0-era (2026-03/04); Kaye and Joey are Seedance 2.5-era (2026-08+).

---

## 1 · How real creators actually work

1.1 **Three independent creators built the same five-layer pipeline by hand on Claude**: canon/bible → character tool → place tool → shot-prompt compiler → external edit. ZEPHYR ran "an acting system and CINEDANCE, the video-prompt writer" plus a diagram skill [Z: MAKERS-BRIEFS]; Kaye runs CINEDANCE-descended block library as an installable skill [K]; Joey ships story-bible-builder, castkit, scenecraft, shotcaller, motiondojo [J]. None of them met; the decomposition converged.

1.2 **The order of operations is constant across all three**: story told in plain language first → identity and place assets built and locked → scenes prompted one at a time with assets attached → assembled in an external editor (Premiere / "T cut") [Z][K][J].

1.3 **The story brief precedes everything and is written in plain words.** Kaye: "I typed the whole idea in very plain language, like the way I would tell it to my friend… that is called a director's brief and it's the reason why everything after it turned out so well"; she warns that beginners "move straight to writing prompts for designated scenes" and lose continuity [K]. Joey's session opener is one plain-prose paragraph; his skit brief is story prose with POV beats and sound effects, no technical vocabulary [J: video frames].

1.4 **The storytelling layer is entirely human.** In ZEPHYR's records no script, beat sheet, or story artifact exists anywhere in the platform (`cs_chat_ids` empty on all folders); shot breakdown was human; the engines only rendered [Z: narrative-and-continuity §5].

1.5 **Creators teach their audiences the machinery because the tools don't carry it.** Kaye's film needed a 17-minute tutorial and a 39KB block library to reproduce; Joey's needed an 18-minute video and five skills. Both distribute these for free as their channel's main value [K][J].

1.6 **ZEPHYR's own self-assessment**: "Team Zephyr's main strength lies in planning, teamwork, and structuring the story through editing. These are fundamental skills in traditional filmmaking as well" [Z: MAKERS-BRIEFS].

## 2 · Identity and consistency

2.1 **The face is byte-identical everywhere (ZEPHYR's deepest rule).** "The original close-up portrait stays untouched. It never runs through a model again; the assembly happens in editing tools around it… the face stays the same set of pixels. Which is why in any world Adil reads as Adil, even when he's the villain there" [Z: MAKERS-BRIEFS, Adiliada].

2.2 **A character sheet, as shipped by ZEPHYR**: one composite plate per character — text block (name, height, voice, character line), full body front+back, face at three angles, two costume detail crops — attached whole to every shot [Z: implications §"founder's question"]. Joey's castkit sheets: 3-panel default (headless front / rear with head / tight face), every panel dead-on orthographic, "a sheet is a measuring tool — a rotated torso… kills the panel's value"; 6-panel only on request because "six panels cuts the pixel budget per cell" [J: castkit].

2.3 **Plate lighting**: Joey renders every character plate on a flat 18% neutral **gray** field, shadowless — "the plate carries zero lighting; the scene does the lighting later"; gray because "pure white or black backgrounds create maximum edge contrast, which is exactly where image and video models bake in halos" [J: castkit]. ZEPHYR's sheets are on white [Z].

2.4 **Baked-in text on sheets — the practitioners disagree.** ZEPHYR bakes name/height/voice text into pixels and ships; but their own verdict: "those little descriptions under the detail are almost useless for the video generation" [Z: MAKERS-BRIEFS]. Joey's sheets: "No text, no labels, no numbering anywhere in the image" [J: castkit]. Drape's own export rule is text-free (founder-ruled) with a designed open test not yet run: `research/zephyr-teardown/OPEN_TEST_baked-text-on-references.md`.

2.5 **Numbers anchor identity.** Kaye: "specifics are what consistency is made of — when you specify the exact number like weight, height or age, you give the model strict parameters to anchor to" (her dog: "5 years old, 35 kilos, 65 cm at the withers") [K]. Joey's asset lines open with height ("@image1 = 177cm…") [J: shotcaller].

2.6 **Locks ship with exclusions.** Joey: known drift gets inline negation ("BROWN eyes, never blue"); his bible interview asks the user *what the wrong drift would be* and writes it as a never-clause ("warm fair skin — never pale porcelain, never tan"); "what's excluded is as important as what's included" [J: castkit, story-bible]. ZEPHYR hand-typed the same shape ("BROWN eyes (never blue/green)") [Z].

2.7 **Changes ride an identity firewall.** Joey's addition prompts state everything that is NOT changing, exhaustively, then "only [the specific change] is different"; changes to the face at rest force a full re-lock; locks are versioned (`lock-01`, `lock-02-red-hair`) [J: castkit].

2.8 **The state axis is universal.** ZEPHYR's bible holds per-state files: `Mira (Episode 1 Base) (After shower)`, `Tank (injured)`, `Alex (Battle Mode) [KIA]`; "we recommend taking the extra step to create multiple character sheets for different scenarios, even if the differences seem minor" [Z: MAKERS-BRIEFS]. Kaye made two sheets of herself (clean flashback / wounded present) and two of the dog (healthy / infected), proving the time-jump in-frame: "same cap, same goggles pushed up, same mole, and nothing drifted between the present and the past" [K]. Joey versions locks per state [J].

2.9 **"If it sees a detail, it will try to show it."** ZEPHYR's costliest lesson: sheets that showed everything (open cockpit hatch, extended weapons) made "most generations fail"; they erased those states from all sheets and now "upload a sheet with extended weapons only when it actually exists in the scene" [Z: MAKERS-BRIEFS]. A reference is a demand, not a menu.

2.10 **Names drift models.** Joey bans character names in every prompt body ("visual handles and @image tags only") [J: all skills]; his bible: "never use the character's name inside the quoted descriptors — names drift models" [J: story-bible]. The miko ad-factory skill likewise: "text alone does not guarantee identical casting across independent generations" [C: appendix]. ZEPHYR, by contrast, used names inside prompts with a written glossary per shot [Z].

2.11 **Restating identity in words beside the image is class-dependent — Drape's own measurement.** ZEPHYR restates hair/height/garment colour beside the picture in every disciplined prompt [Z]; Drape measured the opposite for *marks*: restating a tattoo in words beside its crop asks the engine to paint a second one (fable-1399 §3; `slotWordsRefusal` exists for this) [D]. The two bodies of evidence split by class: identity (hold constant) vs marks (place exactly once).

## 3 · Places, space, and continuity

3.1 **Location sheets are treated as the step most people skip.** Kaye: "the next step is the one 90% of people get wrong — skipping locations. Without it, you'll have a different setting in each scene"; her location prompts included lighting and camera gear [K]. Joey: "get the scene plate right first, everything else is going to look better" [J: video].

3.2 **Imperfection in a plate is valued as a look.** Joey chose a plate because "it's not perfect. It is overexposed. You can see some halation… looks exactly like what I'd be filming when I'm filming on sets. The better input you can give to your video generation model, the better output you're going to get" [J: video].

3.3 **Coverage of one place from several angles (Joey's method)**: the widest "master" plate is approved first; every other angle attaches the master, states its vantage *relative to the master* in plain words, holds surfaces/dressing/time identically, and **rewrites the light physically for the new vantage** ("the sun that was camera-right in the master is camera-left on the reverse") [J: scenecraft].

3.4 **Spatial anchors**: ZEPHYR planted "visual anchors" in locations ("the chair a character sits in, the window two of them talk by") to hold scenes steady [Z: MAKERS-BRIEFS]. Joey annotates his plate with circles marking the machines that must recur, and organizes his project as folders named "Characters + Props / Location Locks / Video Gens" [J: video frames]. His stated #1 concern: "consistent spatial geometry so that each video generation looks like it was filmed… in the same setting" [J: video].

3.5 **Continuity is a filing system, not a model feature (Seedance 2.0 era).** Measured: `job_set_parent_id` null on all 18,918 jobs; 275 finished shots in 275 size-1 job sets; zero prompts referencing a previous shot. Continuity held because every shot re-attached references: 1,011 attachments from 353 distinct images, mean 2.86 shots/reference, 39.4% used exactly once — a reused core plus a long bespoke tail [Z: narrative-and-continuity §§1–2].

3.6 ⚠ **The continuation finding has EXPIRED (dated carve-out).** On Seedance 2.0, video-to-video was measured absent (1 of 275 shots) [Z]. On Seedance 2.5 (2026-08+), **Extend Video works**: up to 30s ingested, continues as sequel or prequel; Joey: "one of the biggest ways to get video consistency… it's seamless, I couldn't even tell" at the join [J: video]. His formalized craft: a continuity paragraph naming the exact final frame; the held moment breaks within the first quarter-second or the extension opens frozen; light stated as continuous across the join; extensions chain one at a time, each naming the final frame of the clip it continues [J: shotcaller].

3.7 **Per-reference scoping**: each ZEPHYR reference is told what it owns and what it must not contribute — "do not use a single pixel of the background from this input image" — and the scoping sentence is derived from what the reference image actually contains (a cockpit plate with studio-white edges needs the exclusion; a clean plate doesn't) [Z: implications #3]. Kaye's contamination ban runs per asset: do not inherit "lighting, depth of field, colour scheme, sheet layout" [K]. Measured caveat: scoped prompts showed **no reroll advantage** — the argument for scoping is compositional, not statistical [Z].

3.8 **Named asset registries ride outside attachment slots.** ZEPHYR Special used saved Elements with zero image attachments on 620 shots [Z: implications, superseded note]; Higgsfield productized this, and Joey's prompts cite semantic tags (`@gorilla-tae`, `@gorilla-tae-resting` — the latter a saved *pose/staging* state, "his position in the room and the lean pose") [J: video frames]. Raw caps also moved: Seedance 2.0 = 9 refs/15s; 2.5 = 50 refs/30s [J: shotcaller].

3.9 **Reference images reach engines as attached bytes, never URLs** [Z: implications, confirmed at Drape's code].

## 4 · Shot-level prompt craft (what working prompts contain)

4.1 **All three corpora compile prompts from a fixed block order.** ZEPHYR/CINEDANCE publish 12 blocks ("SCENE CONTEXT / ACTIVE REFERENCES / LOCATION MAP / GAZE-EYELINES / FIRST FRAME AND BLOCKING / SEGMENTS / DIALOGUE / AUDIO / PHYSICS / LIGHTING / STYLE-FORMAT / POSITIVE LOCKS") [Z: MAKERS-BRIEFS]; Kaye's library assembles 21 [K]; Joey's spine is 16, locked ("header → style → no-on-screen-text → critical blocks → assets → geometry map → first frame → optics → camera → light/colour → atmosphere → action timing → physics → acting → audio → locks") [J: shotcaller].

4.2 **Position in the prompt matters.** Joey: "the things that are at the top of a prompt in any image or video model, it's going to hold true to that" — headers, text bans and music bans go first [J: video, shotcaller].

4.3 **Numbers instead of adjectives.** Kaye: "'beautiful', 'slightly', 'a little' — the generator cannot execute these"; sizes get three independent body-unit cross-checks plus one physical contact test, and size drift is banned in both directions [K]. Joey's table: "she looks stressed → shoulders lift, jaw locks, exhales through the nose"; speeds in km/h, mass in tons [J: shotcaller].

4.4 **One trick per video; the rule then its consequences; inversion-derived negatives.** Kaye: build each shot around one mechanical technique, state it as a rule, derive 3–4 consequences; then ban 8–10 ways of reversing the trick — "half the ban list should concern this specific video" [K].

4.5 **Fail conditions and count locks are written before generation.** Kaye: "IF [the predicted failure] HAPPENS, THE SHOT IS WRONG"; "exactly [N] of [X]… in every single frame" [K]. Joey's population locks name the likely intruders for that place ("no sunbathers, no crew, no third dancer") with an exact count [J: motiondojo].

4.6 **First frame is already in motion.** Joey: "I never want a scene to start… with a character starting to do something. I want them to already have been in motion so that it feels organic"; the block kills "the empty establishing hold" [J]. Kaye's NO-FREEZING block: "the last second of the piece has as much life in it as the first" [K].

4.7 **The small task.** Kaye: give the character one mundane task never abandoned during the main event ("a giant hand lifts the girl — she keeps scrolling on her phone"); "her reaction to the event is smaller than her commitment to the task"; the task produces the emotion [K]. ZEPHYR's acting grammar is the same family: scene direction / motive / goal / obstacle / tactic; "the whole performance is in the eyes" [K: acting block][Z].

4.8 **Acting instructions that practitioners report highest-yield**: brow matched to the line; eyelines as targets; emotional arcs as slides not states; "no mask-face, no dead eyes"; gaze never into the lens except timecoded events; head and eyes agree [J: shotcaller][K].

4.9 **Restrained register**: "a shout becomes a quiet exhale; shock becomes a physical recoil that happens BEFORE any expression"; bans on theatrical expressions [K].

4.10 **Camera and optics as fixed vocabularies.** Joey: four handheld registers with cant ranges and cut rates; lens locks in **degrees first** ("the model snaps to degrees"), mm in brackets, per shot, with a "defense battery" on unusual FOVs; dialogue defaults to locked-off or gentle "because a moving camera competes with the mouth" [J: shotcaller]. Kaye's handheld is specified numerically (8–14px wander, 2–4px tremble at 6–9Hz, breath cycle, late reframes that overshoot, focus that hunts) [K].

4.11 **Atmosphere is density, never fog.** Both Joey and Kaye ban fog/mist/shafts/rays as scene dressing; air is a full-frame scattering gradient with named depth planes; visible vapor only with a named in-frame source; "low macro contrast, high micro contrast, grain heaviest in lifted shadows" [J: scenecraft/shotcaller][K].

4.12 **Light by direction, quality, temperature — never a fixture name**; every colour band names an in-frame source (Joey's ~70/20/10 rule) [J]; grade locked across shots **with named exceptions that keep their force** [K: GRADE-LOCK].

4.13 **Physics as a chain**: mass → contact → deformation → rebound → secondary lag → contact shadow → "nothing floats, nothing slides"; rewritten per surface ("loose pebbles shift and roll under every plant") [J][K].

4.14 **Fiction framing**: the model is told what a thing *is*, not only what it looks like — "THE SUIT IS A COSTUME — CRITICAL: the gorilla is unmistakably a human wearing a shaggy faux-fur mascot costume… never a real gorilla" [J: shotcaller, video].

4.15 **Negative handling is engine-convention-specific.** ZEPHYR's matured rule: failure-mode bans in the dedicated negative field, prompt body positive — "the words you write are the words you summon, including the ones sitting inside a 'no'" [Z: MAKERS-BRIEFS]. Joey on Seedance 2.5: "never a negative prompt block — every negation lives inline in the prose of its slot" [J: shotcaller].

4.16 **Capability-aware compilation**: Joey's skill asks the target engine version before writing anything, because reference caps, runtime, and anti-drift weighting all derive from it [J: shotcaller step zero].

4.17 **Repair is symptom-keyed.** Every Joey skill ends in a symptom→fix table ("model invents lines → THE SCRIPT isn't first"; "extension resets → continuity paragraph doesn't name the final frame"; "air reads as fog → a vapor has no source") [J].

4.18 **When prompting fails, change the input.** ZEPHYR's impossible upside-down shot was solved by inverting the character sheet, not by better words: "by baking the required physics directly into the input stage… this freed us to prompt more casually" [Z: MAKERS-BRIEFS]. Deliberate loosening is also a tool: "less strict prompting… dictating only key anchor points," then harvest variations in the edit [Z].

## 5 · Dialogue, voice, and audio

5.1 **Whole conversations fit in one generation.** 73 of 275 ZEPHYR shots (27%) carry spoken dialogue; shot 162 holds five lines of two-hander dialogue in one 15s generation [Z: narrative-and-continuity §4].

5.2 **Generated speech fails four ways** — invented lines, paraphrase, wrong mouth, flat delivery — and the working fix separates *what is said* from *how it is said*: every line appears **verbatim three times** (a SCRIPT block of words only; its timecoded beat bound to the speaker's body with every listener given "says nothing in this beat" plus an action; an AUDIO block restating the line with a delivery spec — volume, pace, pitch, stressed word, emotion-in-voice, breath, distance, room) [J: shotcaller dialogue system].

5.3 **Word budget**: natural conversation ≈ 2.5–3 words/second; scripts are counted against runtime before building, and speech is never compressed to fit [J].

5.4 **Punctuation is performance data** — an ellipsis trails off, a dash cuts off — and stays exactly as written; delivery is never expressed by altering the text [J].

5.5 **Mouth mechanics help only for attached-track lipsync** (matching existing audio); on generated speech they cause overarticulation [J: lipsync protocol].

5.6 **Audio defaults diegetic with an explicit music-suppression tail** ("no music, no score, no singing, no humming, no ambient pad, no swell…"); song titles/lyrics never appear in prompts; an attached track, when used, is declared the sole audio source and owns all timing [J][Z: the 716× reused audio anchor; the unheard-metronome lane].

5.7 **Delivery direction syntax observed at scale**: ZEPHYR wrote direction-for-how + quoted-words-for-what ("…the stutter driven entirely by fear, her voice smaller than she wants it to be: 'Girls… I think I need some backup.'") [Z §4].

5.8 **Open test, not yet run**: whether every line needs a voice clip or description suffices for background lines — `research/zephyr-teardown/OPEN_TEST_voice-clips-vs-descriptions.md`.

## 6 · Iteration, selection, and economics

6.1 **A keeper shot costs a median of 5 attempts** (p95 34, max 75), measured per-prompt across 267 of ZEPHYR's 275 keepers. The crude 36.6:1 ratio includes exploration of the whole film [Z: implications #4].

6.2 **Rerolls are identical resubmits, not edits**: of prompts run more than once, 1,053 kept an identical reference set, 70 varied it; the most-rerolled prompt ran 75× unchanged. The learning curve across two weeks is flat. Prompt discipline showed **no measured reroll advantage** (median 7 across scoped/slot-syntax/plain groups). Feeding a generated still back in showed no advantage either [Z: implications #4 and caveat].

6.3 **Draft-then-finalize, same take**: Kaye generates every scene at 480p draft (15 credits/5s), and one button re-renders **the exact liked generation** at 1080p (90 credits) — "you don't have to go around regenerating again in higher quality and looking for the right version" [K: video].

6.4 **Both major competitors put a cheap image step before expensive video** (Runway Aleph previews an edit as an image; Higgsfield Popcorn storyboards 4–8 frames before Cinema Studio shoots) [C]. ZEPHYR's layer 2 was exactly this: 2,157 still shot-plate jobs between bible and motion [Z: pipeline table]. The studied crew storyboarded because "it becomes clear how good a scene really is, as opposed to how good it was in our heads" [Z: MAKERS-BRIEFS].

6.5 **Counter-nuance on image-starts**: Joey deliberately did *not* use his character-in-place plate as the video's starter frame — "when we do things like that, we end up getting a little bit more plastic image creation"; the plate served as a consistency element instead [J: video].

6.6 **Edit from the wreckage**: "there are some failed generations in this project… what I'm able to do is grab bits and pieces of each video generation and put it together in the edit… just like if we were filming on set, capturing a bunch of different takes" [J: video]. ZEPHYR Special shipped its bloopers openly [Z].

6.7 **Cost benchmarks (2026)**: Kaye's 9-scene film: 790.25 credits total (assets 40.25; ~75/finished scene) [K]. Joey's ~1-minute skit project: ~800 credits ≈ **$32**; his overlay shows the conversion [J: video]. Seedream for plates is "literally 20 times cheaper" than the face-grade model [K]. Soul ID requires 20–80 training photos before a novice sees anything [C]. Higgsfield runs an unlimited-but-slow free queue tier for Seedance 2.5 ("it's going to take a lot longer… and it's one at a time, but that's free") [J: video].

6.8 **The market's price pain is loud**: "and then what you're going to find out is, 'Holy crap, this is expensive'… nothing is free… so many different platforms have so many different ways to charge" [J: video]. ZEPHYR: "on an AI film a weak scene costs real money: you find out it doesn't work only after you've generated it" — their answer was writing every scene out in drama terms before generating [Z: MAKERS-BRIEFS].

6.9 **Post-production is a named pipeline**: assembly → rough cut → "generation supervision" (regenerating broken shots) → fine cut → picture lock ("after lock there are no new generations") → cleanup, colour ("every generation arrives with its own grade baked in, so the colorist's job is unification"), sound [Z: MAKERS-BRIEFS].

## 7 · Multi-character scenes and staging

7.1 **Prose is worst at staging; diagrams solve it.** ZEPHYR's Diagram Skill: "in shots with several of us in frame, text alone won't hold the staging. The skill turns a frame into a schematic color-coded diagram, and Seedance reads exact positions, poses and facing directions off it" — sometimes attached, sometimes used only by the humans writing the prompt; generated from the location asset for one image call [Z: MAKERS-BRIEFS, implications]. Depth maps serve as "the depth skeleton of the scene… without it the space drifts" [Z].

7.2 **Geometry maps in prose**: absolute lateral positions with off-frame noted, depth plane per subject, vertical relationships, directions always labelled ("she turns to her OWN right is not screen-left"), figures scattered at depths "never in a row" [J: shotcaller].

7.3 **Motion/choreography transfer**: roles assigned by labelled screen position; performer count must equal character count; an individuality block prevents cloning ("never synchronised where the reference isn't… the silhouettes never match at the same moment"); physics rewritten for the new ground [J: motiondojo]. Runway's Act-Two (perform the shot on webcam; the performance drives the character) is the competitor expression of the same lane [C].

7.4 **Ensemble dynamics are written canon**: "who leads what, who fills silence, who watches; which pairings are calm, which are charged" ("Maren and Wren are the quietest room in the house") — short and "disproportionately valuable" for ensemble scenes [J: story-bible].

## 8 · The canon layer (what persists about a story)

8.1 **Structure of a working bible** [J: story-bible]: one-line premise · thesis ("the question every scene answers") · timeline with **aesthetic-per-era** blocks (palette/light/texture per era, each line paste-ready) · factions (public face vs actual behaviour) · locations (visual tags + one feel line) · world rules · characters · ensemble dynamics · structural engines (recurring chapter *shapes*, stackable) · production rules (the creator's own hard-earned prompt rules, in their phrasing).

8.2 **Character sections carry three quoted prompt-ready descriptors — Speech, Movement, and Stillness** — plus visual lock, function ("not their job — their function: The Heart, The Watcher"), backstory, and present-tense psychology ("the thing they're doing versus the thing they're actually feeling — that gap is where the drama lives"). Stillness is interviewed separately: "often more revealing than movement… what do their hands do? Where's their weight? Their breath?" [J: story-bible].

8.3 **Interview discipline observed**: one character at a time, never batched; function before looks; push on the vague ("'dark and moody' isn't an aesthetic lock — what colors specifically?"); read back and iterate until the user locks it; **never invent — `[TBD]` beats a guess** ("invented canon becomes locked canon becomes prompt drift"); keep the user's phrasing verbatim ("this is their bible") [J: story-bible].

8.4 **Small specific details beat grand summaries**: "she used to fix the sink in their apartment herself at 3am because the plumber would have asked questions" vs "she had a hard childhood" [J: story-bible].

8.5 **The completeness test**: "could a stranger who has never heard of this story write a scene in it, using only this bible, and get it right?" [J: story-bible].

8.6 **The canon layer feeds the shot layer through declared pipes**: voice → dialogue/sound block; movement/stillness → identity locks; aesthetic era → grade; production rules → every render; "the director skill reads reference images for wardrobe, hair, identity. It cannot read voice, movement, stillness, era, or production rules — those come from the bible" [J: story-bible mode 2; shotcaller house rules].

## 9 · Competitor facts (from their own documentation, 2026-09)

9.1 **Neither Runway nor Higgsfield holds a film as a first-class object.** Runway's own help docs: "For longer films or projects requiring advanced editing features, consider a local video editor." Higgsfield's recommended short-film pipeline hops four tools with shot order held in a chat agent's memory [C].

9.2 **Both teach prompt grammar as the product**: Runway's prompting guides ("The camera [motion] as the subject [action]"); Higgsfield's presets-as-tokens [C].

9.3 **Consistency is user-operated at both**: Runway documents it as craft ("change one variable at a time", 3-reference cap, last-frame chaining); Higgsfield's Soul ID is honest about producing "clearly the same person rather than a pixel-identical face" [C].

9.4 **Things both shipped early**: price on the generate button, automatic refunds on failure (Higgsfield); editable outline as a spend gate (Runway Agent); cheap image step before video (both, §6.4); preset galleries with looping previews ("nobody knows what 'snorricam' means; everyone knows it when the loop plays") [C].

9.5 **Direction of travel**: Cinema Studio 4.0 generates up to 30s with native audio and "Montage Pacing" (the model edits inside one generation); long-clip engines compress multi-shot scenes into one generation [C]; Seedance 2.5 Extend (§3.6) continues existing clips. Higgsfield's public projects with visible prompts are their most effective marketing — it is literally how two of these corpora were researchable [C][J].

## 10 · The market's psychology (who this is for, in their words)

10.1 **What buyers pay for**: "they weren't buying simple AI content. They were buying the three hardest things in making AI videos: real emotion, realism, and character consistency" — Kaye, after companies paid influencers to recreate her film; she quotes brand-deal rates "up to a couple of thousands of dollars" per video [K].

10.2 **Two creator temperaments coexist.** Kaye: "we never write our prompts by hand. We are lazy creative directors." [K]. Joey: "AI is the tool, not the brain… if we just want to generate a shot list without doing the work… we're not really building anything that is really coming from us"; "when you're prompting for video generations, you are the director… you have to know which side of the frame you want the character to come from" [J: video]. ZEPHYR sits between: heavy tooling, human story, "direct, don't describe — directing is the one part the model still won't invent for you" [Z: MAKERS-BRIEFS].

10.3 **Stolen feelings are the method**: "you are not supposed to invent the note; you're supposed to play it your way. Every filmmaker you love stole a feeling and filtered it through their own head" (Kaye, building her saddest beat from I Am Legend) [K].

10.4 **Assistant-in-the-loop behaviours observed**: Joey drags a finished clip into Claude — "analyze each frame, understand what's happening, where everything is in scene, and then build me the prompt to continue this sequence" [J: video]; he also pastes screenshots of his Elements with explanations of what each is *for* ("this one is just for you to understand exactly where I want the gorilla to end up") [J: video frames].

## 11 · Open questions and expiry register

- **Baked text on references** — helps, harms, or neutral? Designed test not yet run (§2.4).
- **Voice clips vs descriptions** for background lines — designed test not yet run (§5.8).
- **Engine-version-bound findings**: §3.5/§6.2 (no chaining; reroll statistics) measured on Seedance 2.0 — the chaining half already superseded (§3.6); reference caps (§3.8) move per version; negative-handling conventions (§4.15) differ per engine and era.
- **ZEPHYR's post-production is invisible** in the records (edit, grade, upscale, mix all off-platform); cut order ≠ creation order is unestablished [Z].
- Anything that is a taste call (what looks right) is outside this record by definition; the founder's eyes rule those (Appendix A).

---

## Appendix A — constraints already ruled by the founder (not research; binding)

These are not recommendations and not findings; they are the rulings any design must fit. Full text in `docs/specs/Casting-ui-ux-design/drape-redesign/12-cinema-full.md` §16.10 and `CLAUDE.md`.

1. **The disappearing-technology law** governs every feature: nothing a customer must learn; no decision without a basis; no engine names on a required path; every new feature answers the three gate questions before build.
2. **§16.10 point 2** — the prompt leaves the main road: plain-words "How this was made"; exact text one click deeper; editing it affects only new takes ("Changing this only affects new takes. Your current takes stay." / "Edit for new takes"); the words "setup" and "version" never appear in customer copy.
3. **§16.10 point 3** — take count is the customer's choice starting at 1, nothing remembered, + capped (~4) server-side; the price on the button is always the price charged (server refuses a mismatched total); each failed take refunds itself; no invented wait numbers.
4. **§16.10 point 4** — "planned" not "intended"; "characters" on screens; paid buttons read "Make · N credits"; no watermark line anywhere; nothing priced on screen before shot-list approval; staleness copy names the count.
5. **§16.10 point 5** — an uncast character gates the take ("Cast her first" → casting studio); places and props never gate; the script derives the needs list as it is typed; gaps fill backwards; approval never blocks on completeness.
6. **§16.10 point 1** — the shell as ruled 2026-10-08 (three centre modes; Script(Write·Board)/Shots/Watch; cards assembled never generated, free; framing as grey labels; writer's words never rewritten; typed line kinds from day one). ⚠ The founder's eye on a working build of this shell (2026-10-12) judged it unintuitive; the shell is an open design question again — the sub-rules above it are not.
7. **Thinking free, rendering paid** (founder, 2026-09-02): script help, proposals, read-backs free; credits spent where frames are drawn.
8. **Keeper picked by eye, never auto** (law 9); **no auto-casting**; **no silent rewrites of drawn work**; **masters immutable, states derived**; **dashed = doesn't exist**; **one list of materials**.
9. Voice (cinema side): generate free then convert to the cast's voice on keep — ruled lane, feature not yet built.

## Appendix B — source index

| Tag | Corpus | Where |
|---|---|---|
| [Z] | ZEPHYR teardown: 18,918 jobs + makers' briefs + craft playbook + clause catalogue + reference samples (opened, not inferred) | `research/zephyr-teardown/` — start with `FOUNDER-REPORT.md`, then `MAKERS-BRIEFS.md`, `narrative-and-continuity.md`, `implications-for-drape.md`, `THE-CRAFT-PLAYBOOK.md` |
| [K] | Kaye Creatives: CINEDANCE block library v1 + "GOOD BOY" film breakdown video | `research/cinedance-block-library/` (both files) |
| [J] | Joey: shotcaller, castkit, scenecraft, motiondojo, story-bible-builder + workflow video | `research/joey-cinema-skills/README.md` (the five skill files themselves are third-party documents, summarized there; originals distributed free via his Higgsfield blog) |
| [C] | Runway + Higgsfield official docs, read 2026-09-03/04, URLs in appendix | `docs/specs/COMPETITOR_WORKFLOW_ANALYSIS.md` |
| [D] | Drape's own measured incidents (courts, fenced classes) | cited inline (fable-1399 §3 via `CLAUDE.md`/catalogue) |

*The repository also holds design documents built from this research (`FILM_ENGINE_DESIGN.md`, `SCRIPT_ROOM_DESIGN.md`, `CINEMA_DESIGN_RESEARCH_AUDIT.md`, prototype artifacts). They contain design opinions by construction and are deliberately not part of this dossier.*
