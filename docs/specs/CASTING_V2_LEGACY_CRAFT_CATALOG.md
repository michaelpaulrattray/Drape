# Casting V2 — Legacy Craft Catalog (mining checklist)

> **Purpose (founder-directed, 2026-07-30):** the exhaustive inventory of engineered prompt/generation craft in the legacy casting system. This is the **checklist the V2 compiler work is audited against** — M4/M5 (photoreal adapter: sections A, B, C, D, E, G), M7 (E: per-angle directives → view-conformance), M12 (F: edit protocols), interpreter design (H7–H16 parser philosophy). Every item is ported, consciously superseded (say where), or explicitly dropped (say why) — never silently lost. Superseded already-known: B7 chat-session memory (replaced by reference images), E9 gendered undergarment wardrobe (replaced by the wardrobe-baseline law).



# DRAPE LEGACY CASTING — ENGINEERED PROMPT/GENERATION CRAFT CATALOG

---

## A) PHOTOREALISM / SKIN / ANTI-AI-LOOK CRAFT

**A1. BASE_STUDIO_SETTINGS — "VISUAL DIRECTIVES (NON-NEGOTIABLE)"** — `server/casting/geminiPrompts.ts:210`
Six numbered non-negotiable blocks appended to every casting/view/body generation: background, lighting, camera, color grade, quality, macro facial features. Injected via `getStudioSettings()` into headshot, full-body, view, and inpaint prompts.
> "RAW REALISM with high micro-contrast — skin pores, vellus hair, and fine textures must have tactile, three-dimensional local contrast that makes surfaces feel physical. No CGI smoothness, no painterly softness, no excessive symmetry."
Solves: the CGI-plastic / airbrushed-render look; guarantees a consistent "studio" across every image of the same model.

**A2. Camera & sensor physics spec** — `geminiPrompts.ts:214`
Names a specific sensor class, focal length, aperture, aspect ratio, and grain character.
> "Medium format sensor (Hasselblad class). 85mm equivalent, f/5.6–f/8. Sensor ratio 3:4. Fine luminance-dominant noise — barely visible, like fine sand. No color noise."
Solves: AI images that have no lens/sensor signature; controls DOF and grain so it reads as a real photograph, not a render.

**A3. Direct-flash lighting doctrine with skin-response deferral** — `geminiPrompts.ts:213`
Fixes the light (bare direct/near-axis flash, shadows behind, no gels/diffusion) but explicitly hands off *how skin responds* to the casting spec's finish value.
> "How the skin RESPONDS to this light (specular, matte, dewy) is defined by the casting spec's skin finish — defer to that."
Solves: the studio block silently overriding a user's Matte/Dewy choice; keeps the honest, unflattering "true casting polaroid" light.

**A4. Neutral grade + subsurface scattering** — `geminiPrompts.ts:215`
> "Neutral daylight (5500K-5800K). Skin tones warm and dimensional with visible subsurface scattering. No stylized grading."
Solves: Instagram-filter / teal-orange AI grading; dead, opaque-looking skin.

**A5. EYES macro-rendering protocol (5 sub-rules)** — `geminiPrompts.ts:218-224`
Iris striations, limbal ring, catchlights, corneal gloss, pupil size, sclera vascularity — each named individually.
> "The iris is NOT a flat color disc… A distinct dark ring where the iris meets the sclera. This is what makes eyes 'pop'… Without catchlights, eyes look dead… A perfectly white sclera looks synthetic."
Solves: the #1 AI tell — flat, dead, glassy doll eyes; casting directors scrutinize eyes first.

**A6. EYELASHES protocol** — `geminiPrompts.ts:225-228`
> "Render individual lash strands — not a solid dark mass… clump in irregular groups… cast micro-shadows on the skin below the eye. No mascara-heavy uniformity unless the spec explicitly requests it. Default is bare, natural lashes."
Solves: the black-smear lash blob; enforces the bare-face casting rule at the lash level.

**A7. LIPS protocol** — `geminiPrompts.ts:229-232`
> "Render vertical lip lines (plicae) and natural moisture gradients — wetter and glossier at the center… The lip border itself should be organic — slightly irregular, not a vector-sharp line."
Solves: vector-outlined, flat-fill "lipstick decal" mouths.

**A8. EYEBROWS protocol** — `geminiPrompts.ts:233-236`
> "Render individual hair strands with visible growth direction… upward near the nose, arching laterally, tapering at the tail."
Solves: solid-block "drawn on" brows; the sharpest AI tell after eyes.

**A9. `getSkinDescription(texture, finish)` — the texture/finish matrix** — `geminiPrompts.ts:296`
Five texture presets × four finish presets composed into one sentence, each written in photographic/dermatological vocabulary.
> Textured/Acneic: "visible micro-comedones, slight acne scarring, active texture bumps, hyper-realistic teenage skin, redness, zero smoothing"
> Matte: "velvet matte finish — skin absorbs light rather than reflecting it. NO specular hotspots, NO oil sheen, NO wet or dewy appearance anywhere on the face"
> Closing clamp: "No beauty retouching or surface smoothing."
Solves: the model's default retouch instinct; lets a *deliberate* imperfect skin be ordered without the model "fixing" it.

**A10. Vellus-fuzz disambiguation clause** — `geminiPrompts.ts:67`
Inside the master system instruction's SKIN section, a negative-definition clamp on peach fuzz.
> "Skin-level vellus fuzz: translucent, near-invisible, catches light only at extreme angles — NOT terminal hair, NOT stubble, NOT dark, NOT pigmented"
Solves: "vellus hair" being rendered as a visible moustache/beard shadow on female casts.

**A11. Age↔skin-texture reconciliation** — `server/casting/geminiGeneration.ts:178-183`
Server silently downgrades `Mature` texture to `Raw / Standard` when age < 35 before building the prompt.
> `// Young skin can't have collagen loss and crow's feet`
Solves: biologically incoherent casts (23-year-old with age spots) from randomizer or careless input.

**A12. Universal `technicalConstraints` negative list** — `geminiGeneration.ts:635-646`
> "PHOTOREALISTIC ONLY. Real photograph from a real full-frame DSLR sensor with physical noise. NO open mouth, NO showing teeth, NO laughing… NO: PERFECT SYMMETRY, CGI, CARTOON, ANIME, 3D RENDER, PLASTIC SKIN, DOLL LOOK"
Solves: stock-photo grins (unusable as casting material), CGI/plastic output, and the AI symmetry tell.

**A13. Anti-symmetry / bold-feature directives in the master spec** — `geminiPrompts.ts:91-96`
> "Be BOLD with feature choices… At least 2-3 features should be pushed beyond average." + "VARIETY: Each cast should feel like a DIFFERENT PERSON… Two casts with the same brand + ethnicity should NOT produce similar feature sets."
Solves: the "same beautiful AI face every time" convergence; sameface across a casting board.

**A14. Anti-mood-word / executability rules** — `geminiPrompts.ts:35-42, 84-93`
The text model is told the image model is literal, with worked examples.
> "If you write 'editorially magnetic' it produces nothing. If you write 'wide-set almond eyes with monolids' it produces exactly that." / "NO marketing fluff. NO 'stunning', 'beautiful', 'gorgeous'."
Solves: prompt bloat that the image model ignores → generic faces; forces every feature to be a renderable spec.

**A15. Raw-number leakage ban** — `geminiPrompts.ts:164-165`
> "The natural_description must NEVER contain raw numbers, percentages, or control signal language. Physical features only."
Solves: vibe weights / blend percentages leaking into the image prompt (image models render text artifacts / mis-weight).

---

## B) IDENTITY CONSISTENCY MECHANISMS

**B1. `buildIdentityAnchor(masterPrompt, schema)`** — `server/casting/geminiClient.ts:242`
Flattens `technical_schema` into a labelled 12-field identity block prepended to the full spec; used by full-body, all view generators, iteration prompts, and the payload composer.
> "IDENTITY — THIS PERSON MUST MATCH THE REFERENCE IMAGE EXACTLY:\nSex… Ethnicity… Skin tone… Face shape… Jawline… Cheekbones…"
Solves: identity drift when generating derived views from a headshot; gives the model a structured recall list rather than prose.

**B2. Ethnicity phenotype lock (`ethLock`)** — `geminiGeneration.ts:683-701`
Placed FIRST in the new-generation prompt (before all other rules), naming the bone-structure loci and defending mixed heritage and independence from styling.
> "These features are determined by BONE and GENETICS — they do NOT change regardless of hair color, skin tone, or styling choices." / "A platinum blonde East Asian person still has East Asian bone structure and eyes."
Solves: ethnicity washing — the model defaulting to a Eurocentric face when given pale skin or blonde hair; mixed-heritage collapse to one parent.

**B3. `buildEthnicityHint` dominance bands** — `server/casting/promptReinforcement.ts:66`
Converts a numeric blend into one of four prose bands.
> 85%+ → "X with subtle Y traits"; 65%+ → "predominantly X with visible Y features"; else → "evenly mixed X-Y, both heritages clearly visible"
Solves: 90/10 and 50/50 blends rendering identically; percentages never reach the image model.

**B4. `formatEthnicityBlend` (text-model twin, different bands)** — `geminiGeneration.ts:259`
Four bands at 85/70/55 thresholds for the *casting-spec writer* (vs B3's image-model bands).
> "Predominantly X with visible Y influence" / "Equal X-Y biracial heritage"
Solves: same problem at the spec-authoring stage; deliberately separate wording tuned per model role.

**B5. `buildReinforcedPrompt` — CASTING OVERRIDES prefix** — `promptReinforcement.ts:85-155`
Prepends a bracketed override header only for *non-default* eye/hair/facial-hair/hair-design values, with an anti-default assertion.
> "[CASTING OVERRIDES — deliberate choices, not defaults: EYE COLOR: Mint. HAIR COLOR: Platinum]"
> HAIR DESIGN: "every named property is a deliberate casting choice. Match it literally; never shorten it, simplify it, or substitute a buzz cut"
> FACIAL HAIR: "…Do not remove it or substitute a clean-shaven face" / "None — …Keep the face clean-shaven"
Solves: the image model regressing rare choices to statistical priors (dark eyes, black hair, short hair, clean-shaven); the default-value filter avoids over-constraining ordinary casts.

**B6. `buildIdentityEditReinforcedPrompt` — suppression of stale reinforcement** — `promptReinforcement.ts:164`
On an authorized identity edit, the just-changed fields **and their reviewed physical dependents** are removed from the override reinforcement.
> "Never reinforce an old value for a field the server has just authorized (or a reviewed physical dependent of that field)."
Solves: the old value fighting the new one in the same prompt (user asks for blonde, prompt still shouts HAIR COLOR: Jet Black).

**B7. Chat-session visual memory (3-path architecture)** — `geminiGeneration.ts:55-152, 733-826`
Persistent Gemini chat keyed `userId:modelId`, TTL 30 min, 200-session cap; iterations replay through the same conversation so the model retains visual memory. Falls back chat-NEW → stateless.
> "The model retains visual memory of what it generated, reducing identity drift… A user's models must never share visual chat history: a fork/variation is a different person."
Solves: cumulative identity drift across many iterations; cross-model identity bleed.

**B8. `checkIdentityConsistency` (post-hoc same-person check)** — `geminiClient.ts:279`
Two-image JSON verdict on a fast text model; fails OPEN.
> "Are they the SAME PERSON? Check: face shape, skin tone, eye color, hair color/style, distinguishing marks… { \"same_person\": true/false, \"confidence\": …, \"differences\": … }"
Solves: silently shipping a drifted image; surfaces an identity warning without blocking a paid run.

**B9. `verifyIdentityEdit` — fail-closed multi-dimension identity gate** — `server/casting/identity/editGate.ts:156-190`
Per-dimension (every unauthorized identity leaf + overall face + permanent marks) four-state verdict with a provider-side `responseSchema` mirror; unobservable-but-expected ⇒ violation.
> "You are the fail-closed identity authority… AUTHORIZED CHANGES (expected; do not count these exact fields as differences)… Do not assume two people are the same merely because they share demographic traits."
Solves: an "authorized change" edit quietly rewriting the whole face; distinguishes honest not-observable from drift.

**B10. `identityRetryDirective` — verdict-fed retry** — `server/casting/identity/editGateFlow.ts:25`
The failed dimensions are named back to the image model on attempt 2, with a forced fresh session.
> "RETRY CORRECTION — the previous candidate was rejected because {dims} drifted. Start again from the original source image. Apply only the authorized change and preserve the face, bone structure, skin, and every other protected trait exactly."
Solves: blind retries that repeat the same drift; poisoned chat context reseeding the failure.

**B11. `runGatedIdentityGeneration` — generate-in-memory, persist only on pass** — `editGateFlow.ts:55`
Candidate never touches storage until the gate passes; unavailable checker ⇒ refuse (fail closed), session reset on every rejection.
Solves: drifted images entering the model's canonical asset history.

**B12. `verifyViewIdentity` / GATE_PROMPTS — per-angle rotation gate** — `server/casting/backViewGate.ts:38-58`
Separate prompts for `backFull` and `sideFull` that only judge what that angle can express; one auto-retry then named-and-refunded; fails open on infra error.
> "The face is not visible from behind — judge ONLY what a back view can show: body silhouette and build… hair mass, length, texture, and color… any visible tattoos or marks (the back view must not INVENT new ones)."
> Explicit design note: replaced the old text plea "No new back tattoos".
Solves: rotation hallucination past ~120° producing a different build/hair/marks; walk views have rotation *and* motion drift room.

**B13. `composeIdentityPayload` — headshot + intent view + identity text** — `server/casting/composeIdentityPayload.ts:88`
The single server-owned identity payload strategy for downstream consumers: 2 images max + verbatim `buildIdentityAnchor` text, with a D-12 reproducibility manifest.
> "Two images + text avoids multi-ref dilution" — stale unpinned intent views flagged, pinned accepted silently.
Solves: multi-reference dilution weakening identity; irreproducible generations.

**B14. `selectIdentityAnchor` vs `selectDisplayedHeadshot`** — `server/casting/identity/anchorSelector.ts:78, 87`
Separates the *displayed* newest headshot from the *anchor-eligible* newest headshot; identity revisions (`identityRevisionId`) + legacy fingerprint (verbatim identity text) determine membership.
> "an image-only headshot refinement is display-only and must never silently become the identity reference."
Solves: a cosmetic retouch silently becoming the identity source for all future views.

**B15. `checkIdentityMatch` (wardrobe)** — `server/wardrobe/identityCheck.ts:15`
> "Small changes in lighting or pose are okay, but the IDENTITY must be preserved… 'NO' if the identity has drifted significantly (different face, different ethnicity, different body shape)."
Solves: VTO silently returning a different person wearing the clothes.

---

## C) CREATIVE DIRECTION (BRANDS / VIBES / ARCHETYPES)

**C1. `BRAND_PROFILES` — eight casting-house descriptors** — `geminiPrompts.ts:176-201`
Each entry: aesthetic thesis + explicit anti-pattern + EXPRESSION clause, written as castable physical direction.
> Balenciaga: "Push bone structure to extreme, almost alien proportions… EXPRESSION: Blank, confrontational, thousand-yard stare… Like a passport photo from a dystopian state."
> Saint Laurent: "Gaunt, angular faces… The bones should suggest late nights and no sleep."
> Miu Miu: "Do NOT default to severe or angular… pick 2-3 features and make them bold and specific, let the rest be natural."
Solves: generic "high fashion" faces; gives each brand a recognizable casting type without naming real models.

**C2. `DEFAULT_BRAND_DESCRIPTOR`** — `geminiPrompts.ts:203`
> "High fashion editorial. Pick bold, specific, distinctive features for every part of the face."
Solves: an unbranded cast falling back to averageness.

**C3. `getBrandExpression` — casting-photo expression whisper** — `geminiPrompts.ts:278-290`
A *second*, much quieter expression set for the image prompt (vs the descriptor's dramatic prose), all mouth-closed and lens-direct.
> Header comment: "Brand flavor is a whisper, not a pose." Prada: "Mouth closed, flat. Eyes direct into lens, cool and measured. No warmth, no intensity."
Solves: performative/acted expressions that make bone structure unreadable — while keeping brand flavour.

**C4. Vibe intensity bands (`describeWeight`)** — `geminiGeneration.ts:322-345`
Three axes (editorial/commercial/runway) × three intensity bands (≥0.6 / ≥0.3 / ≥0.1), each written as a *relative amplifier of the brand*, never an absolute style.
> "DOMINANT EDITORIAL: Push the brand's OWN aesthetic to its most extreme… Do NOT default to 'weird' or 'alien' — amplify what the BRAND already is."
> "DOMINANT RUNWAY: …dramatic IN THE WAY THE BRAND DEFINES IT. A brutal brand gets more angular. A glamorous brand gets more statuesque."
Solves: every high-editorial cast converging on the same "weird alien" face regardless of brand.

**C5. SIGNAL PRIORITY HIERARCHY (P1/P2/P3)** — `geminiPrompts.ts:142-163`
Three-level conflict resolution written into the system instruction, with a worked cross-signal example.
> "PRIORITY 1 — USER EXPLICIT FEATURES (ABSOLUTE)… 'Porcelain / Pale' skin on a West African heritage subject means pale-skinned with West African bone structure." / "HARD RULE: Vibe NEVER overrides P1 user explicit features."
Solves: brand archetype or ethnicity overwriting an explicit user choice — the top trust-violation failure mode.

**C6. ORIGINAL CREATIVE BRIEF block + ARCHETYPE FIDELITY GATE** — `geminiGeneration.ts:454-470`
The user's free text is passed JSON-quoted as creative direction, with a self-check the writer must pass before returning JSON.
> "Preserve the brief's recognizable subculture, character, energy, and social archetype… without sanitizing it into a generic luxury-fashion face."
> "A named cultural or social archetype (for example K-pop star, punk musician, skater, or corporate lawyer) may never be replaced by a generic fashion-brand type. If the output would fit the same brief after removing that phrase, it is not specific enough and must be rewritten before returning JSON."
Also: `context.casting_for` MUST retain the user's archetype in plain language; and it must be achieved "without clothing, accessories, or makeup".
Solves: "punk drummer" → generic Balenciaga model; the bare-face studio can't use costume, so archetype must live in the face/hair/bearing.

**C7. `castingBrandOverride` ride-along** — `geminiGeneration.ts:312-314`
Out-of-enum brand archetypes (Tom Ford, Margiela) appended to the brand descriptor as primary direction.
> "ADDITIONAL BRAND CONTEXT (user-specified, treat as primary aesthetic direction): …"
Solves: snapping an unusual house to the nearest of eight and losing the reference.

**C8. `bodyTypeHeadshotHint`** — `geminiGeneration.ts:289-298`
Translates body type into features actually visible in a head-and-shoulders crop.
> Ultra thin: "reflect in narrow neck, visible collarbones and tendons, leaner face." Athletic: "thicker neck, defined traps and shoulders visible in frame."
Solves: body type being ignored entirely in a headshot (all casts get the same neck/shoulders).

**C9. `physiqueDirective` in full body** — `server/casting/geminiViews.ts:68-70`
> "PHYSIQUE: {bodyType} build. The subject's body proportions MUST reflect this — it is a deliberate casting choice."
Solves: the model defaulting every full-body to a slim runway physique.

**C10. `qualityBaseline` composition block** — `geminiGeneration.ts:355-365`
Brand brief + vibe intensity + a re-statement of literalness + wardrobe rule, in a fixed layout with `──` section rules.
> "Remember: pick SPECIFIC values for every facial feature. The image model is literal… Wardrobe: BARE SKIN ONLY. NO CLOTHING OR STRAPS VISIBLE."
Solves: prompt sections blurring into each other; keeps the bare-face rule adjacent to the creative direction.

---

## D) CURATED VOCABULARIES

**D1. `irisDescriptions` — 15 engineered iris renders** — `geminiPrompts.ts:346-362`
Each eye-colour label expands to an optical description (inner/outer zoning, striations, warmth split).
> Hazel: "multi-tonal: amber-brown near pupil blending to green-grey at the outer iris, warm center cool edge"
> Black: "iris and pupil nearly indistinguishable, extremely dark with faint brown micro-texture only visible at macro distance"
Solves: "Hazel"/"Amber"/"Honey" all rendering as generic brown; makes 15 options actually distinguishable.

**D2. Natural-colour framing rule** — `geminiPrompts.ts:97-101`
> "If the user specifies an unusual color (e.g. mint eyes on East Asian, platinum hair on dark skin), describe it as NATURAL. Never write 'artificial', 'colored contacts', 'dyed-looking', or 'unnatural.' … Write 'mint green irises' not 'artificial mint green irises.'"
Solves: the image model rendering visible contact lens rings / obvious dye jobs.

**D3. `SKIN_TONE_VALUES` (6) + client `SKIN_TONES` swatches** — `shared/castingOptions.ts:30`, `client/src/features/casting/constants.ts:49`
Six closed labels, each with base + shadow hex for the picker (`Porcelain #ffe0d6 / shadow #eac0b0` … `Ebony #593b2b / #3d2316`).
Solves: an unbounded skin-tone space; the shadow hex makes the swatch read as skin, not paint.

**D4. Skin-tone P1 anti-stereotype clause** — `geminiGeneration.ts:429`
> "Skin Tone: {v} — this is a DELIBERATE casting choice. The model's skin must match this tone regardless of ethnicity. Do NOT default to the darkest or lightest shade for this heritage."
Solves: heritage overriding chosen tone (the single most common ethnicity/skin conflict).

**D5. `EYE_COLORS` (15) + `EYE_PRESETS` with real iris photos** — `castingOptions.ts:38`, `constants.ts:60`
Each preset carries a hex *and* a photographic iris image asset (`/eye-colors/hazel.png`).
Solves: hex swatches misrepresenting what an iris looks like at that colour.

**D6. `CORE_FACE_SHAPES` (5) + client `FACE_SHAPES` + "Random"** — `castingOptions.ts:43`, `constants.ts:81`
"Random" is a client-only affordance, deliberately not in the shared enum.
Solves: a UI convenience value leaking into the parser/engine enum contract.

**D7. `CHAR_OPTIONS` — seven closed feature vocabularies** — `castingOptions.ts:45-54`
jawline (incl. "Snatched"), cheekbones, cheeks, eyeShape (incl. "Monolids"), noseShape, lipShape, eyebrows (incl. "Bleached"), facialHair — vocabulary drawn from casting/beauty language rather than anatomical jargon.
Solves: free text producing incomparable casts; gives chips a stable label set.

**D8. Eyebrow style expansions** — `geminiGeneration.ts:414-421`
Two enum values get secretly expanded into full prompt prose.
> 'Brushed Up' → "Natural fluffy brushed up texture, individual hairs visible, not laminated"; 'Bleached' → "Bleached blonde (invisible), high fashion editorial look"
Solves: "Brushed Up" rendering as glossy laminated brows; "Bleached" rendering as white-painted brows.

**D9. Hair family system: `HAIR_FAMILIES_FEMALE` (12) / `HAIR_FAMILIES_MALE` (15)** — `castingOptions.ts:56-67`
Gendered closed style families, with the male list carrying barbering vocabulary (Fade, Undercut, Quiff, Caesar, French Crop).
Solves: nonsense gender/style pairings; gives the parser an exact enum.

**D10. Hair sub-selector axes** — `castingOptions.ts:69-78`
Seven orthogonal axes: LENGTHS(5), TEXTURES(5, incl. "Coily / Afro"), FRINGES(6), PARTINGS(5), VOLUMES(5), TUCKS(3), FADES(5), FLYAWAYS(3).
Solves: hair as one blob string; makes hair independently addressable by the structured editor.

**D11. `HAIR_STYLE_CONFIG` — per-style legal sub-option matrix** — `client/src/features/casting/hairStyleConfig.ts:19-44`
Each of the 24 families declares which lengths/textures/fringes/partings/volumes are physically possible plus defaults and applicable genders.
> `'Shag / Wolf': lengths ['Medium','Long','Very Long'], defaultFringe 'Curtain Bangs', textures ['Wavy','Curly','Slight Wave']`
Solves: impossible combos (a Pixie at Very Long, a Bob with a skin fade) reaching the prompt.

**D12. Buzz/shaved sub-selector suppression (server twin of D11)** — `geminiGeneration.ts:368-381`
> `const isBuzzShaved = baseStyle.includes('buzz') || baseStyle.includes('shaved')` — length/fringe/parting/volume/flyaways/tuck are dropped from `hairDetails`.
Solves: "Buzz cut, Very Long, Curtain Bangs" contradictions confusing the image model.

**D13. `NATURAL_HAIR_COLORS` (16) / `DYED_HAIR_COLORS` (19) split** — `castingOptions.ts:80-90`
Two vocabularies (Salt & Pepper, Strawberry, Ash Blonde vs Lilac, Teal, Burgundy) so the UI and parser can treat dye as a distinct act.
Solves: dye colours polluting the natural palette and vice versa.

**D14. `RANDOM_HAIR_WEIGHTS` — weighted randomizer distribution** — `castingOptions.ts:118-127`
Non-uniform 8-colour distribution (Dark Brown 26, Jet Black 22 … Platinum 4, Silver 3) explicitly to model a real casting pool.
> "the old uniform pick over eight colors gave Silver+Platinum a combined 25% — every fourth randomized cast read grey/white."
Solves: randomized boards looking implausible; keeps rare colours rare but possible.

**D15. `generateRandomPreferences` — full-cast randomizer, shared client/server** — `castingOptions.ts:139`
Gender-aware hair family pick, 30% chance of a 60/40 ethnicity blend, three-axis vibe from a normalized random split, age 18–37, gendered fade/facial-hair gating.
Solves: divergent randomization between the Randomize button and the parser's random-intent path.

**D16. `BODY_TYPE_VALUES` (6) + `BRAND_OPTIONS` desc labels** — `castingOptions.ts:92`, `constants.ts:36-45`
Brand chips carry a two-word aesthetic gloss ("Saint Laurent — Heroin Chic / Edgy", "Miu Miu — Subversive / Youthful").
Solves: brand names alone being uninterpretable to non-fashion users.

**D17. `ETHNICITIES` (10) closed enum** — `castingOptions.ts:20`
Includes "Mediterranean" added specifically because Italian/Spanish/Greek prompts had no enum home.
Solves: nationality prompts falling through to nothing.

---

## E) FRAMING / POSE / VIEW CONTROL

**E1. Fixed POSE & FRAMING + LIGHTING & CAMERA sections ("always the same")** — `geminiPrompts.ts:72-83`
> "Straight-on, square to camera, head straight with no tilt or turn. Shoulders level, spine straight… Light grey seamless background fills the entire frame — no black borders"
Solves: comp-card views that can't be compared because every cast is posed differently.

**E2. Standardized `prefix`** — `geminiGeneration.ts:649`
> "HIGH FASHION CASTING HEADSHOT. Face directly front-on, symmetrical in frame. Eyes looking straight into the camera lens. Light grey seamless background fills the entire frame — no black borders, no vignettes. BARE SHOULDERS."
Solves: letterboxing/vignetting, off-axis heads, background drift between casts.

**E3. STRICT VISUAL ENFORCEMENT numbered block + explicit portrait clamp** — `geminiGeneration.ts:706-712`
> "1. WARDROBE: STRICTLY BARE SKIN ONLY… 4. OUTPUT MUST BE PORTRAIT 3:4 ASPECT RATIO. Taller than wide. Do NOT output landscape or square."
Solves: clothing appearing (which biases the face read and collides with the Wardrobe studio); wrong aspect ratio breaking comp-card layout.

**E4. `ITERATION_FRAME_DIRECTIVES` — six per-angle orientation-preservation directives** — `server/casting/iterationFraming.ts:54-67`
Every canonical angle gets its own directive naming its orientation and forbidding the specific rotation the model would drift toward; deliberately kept free of other views' vocabulary so tests can assert exclusion.
> sideClose: "…IN EXACT SIDE PROFILE… DO NOT ROTATE THE HEAD TOWARD THE CAMERA. MAINTAIN EXACT CAMERA DISTANCE."
> backFull: "PRESERVE THE SOURCE IMAGE'S REAR, BACK-FACING BODY ORIENTATION EXACTLY — DO NOT TURN THE SUBJECT AROUND."
Solves: the era-0 binary that told every close view "STRAIGHT-ON HEADSHOT" and rotated side/three-quarter edits to face camera.

**E5. `ITERATION_CROP_BY_VIEW` + `iterationFramingForView` fail-closed** — `iterationFraming.ts:38, 76`
Exhaustive Record (a new angle fails compilation); non-canonical legacy view types throw PRECONDITION_FAILED before any generation record, deduction, or image call.
> "This image uses a legacy view format that can't be edited safely — regenerate the view from the comp card first."
Solves: guessing a frame for a legacy row and charging for a wrong-crop result.

**E6. `framingLock` — CRITICAL GEOMETRY ENFORCEMENT (headshot inpaint)** — `geminiGeneration.ts:857-865`
Four rules including the "top sliver" crop rule.
> "2. CROP RULE: If the user adds a feature on the body (e.g. 'chest tattoo', 'necklace', 'cleavage') that is below the bottom edge of the current frame, RENDER ONLY THE TOP SLIVER that is visible. CUT THE REST OFF."
> "4. …IGNORE the reference image dimensions — the reference is for attribute extraction only, not framing."
Solves: the model zooming out to fit a requested item (destroying the headshot crop and the identity match); the attribute reference dictating output dimensions.

**E7. `SINGLE_VIEW_PROMPTS` — four per-angle view tasks** — `server/casting/geminiViews.ts:246-252`
Frame-relative direction language (not "left/right of the subject"), true-90° enforcement, mirroring ban.
> sideClose: "The subject's nose points toward the RIGHT EDGE OF THE OUTPUT FRAME; show one eye and a true 90-degree profile, never a three-quarter view."
> threeQuarter: "at a 45-degree turn; both eyes remain visible. Never mirror the direction." (comment: "~45° is the safest person-rotation (angles research)")
Solves: side views coming back as three-quarters; views mirroring so the comp card faces inconsistent directions.

**E8. Back view "walking away" + legacy anti-invention line** — `geminiViews.ts:249`
> "FULL BODY FROM BEHIND. Walking away. …Same subject. No new back tattoos."
Solves: static back shots reading as a different photo session; the tattoo clause is the vestigial precursor to the B12 gate.

**E9. Gendered wardrobe constraints for body/views** — `geminiViews.ts:60-66, 162-168, 272-275`
> Male: "Attire: Simple black boxer briefs. BARE CHEST." Female: "Minimalist form-fitting black activewear (sports bra and shorts)." Non-binary: "Minimalist black tank top and fitted black shorts."
Solves: clothing hiding the physique on a body-evaluation view; keeps the frame safe-for-work and consistent.

**E10. Mark-visibility rule in view prompts** — `geminiViews.ts:185, 278`
> "Render a mark only when its recorded anatomical location is visible from this requested angle; never move or mirror it onto another body surface."
Solves: a left-forearm tattoo appearing on the right arm in the mirrored side view, or on the back.

**E11. Parallel remaining-views generation** — `geminiViews.ts:222-223`
All three secondary views fired concurrently from the same source image with the same identity anchor.
Solves: sequential drift (view 3 generated from view 2's output).

---

## F) ITERATION / EDIT PROTOCOLS

**F1. `buildIterationImagePrompt` — the assembled inpaint prompt** — `geminiGeneration.ts:833-1007`
Fixed order: task header → INPUT VISUALS map → user instruction → SERVER AUTHORIZATION → VISUAL RULES (frame directive + framing lock) → surgical instructions → attribute transfer → global freeze → identity anchor.
> Closing clamp: "CRITICAL GLOBAL CONSTRAINTS: FREEZE lighting/identity/camera. MODIFY ONLY what is requested within the EXISTING BOUNDARIES."
Solves: an edit becoming a regeneration.

**F2. INPUT VISUALS image-role map** — `geminiGeneration.ts:653-673`
Numbered role labels built in lockstep with the actual parts array.
> "- IMAGE 1: TARGET SOURCE (The base image to edit. Identity and Lighting source).\n- IMAGE 2: GUIDE OVERLAY (Red highlighted region marks target area).\n- IMAGE 3: ATTRIBUTE REFERENCE (Use the visual content/design from this image)."
Solves: the model confusing which image is the person and which is the reference — the single biggest multi-image failure.

**F3. CRITICAL INK REALISM PROTOCOL (ANTI-STICKER)** — `geminiGeneration.ts:880-886`
Five physics rules for masked tattoo application.
> "1. PHYSICS: Ink must sit *in* the dermis, not on top. Reduce black density to ~85% to match healed pigment. 2. TEXTURE: Skin pores, vellus hair, and skin grain MUST be visible ON TOP of the ink. 3. EDGES: Simulate ink diffusion/bleeding. No sharp vector edges. 4. NEEDLEWORK: Simulate fine-line needle texture and slight unevenness. 5. LIGHTING: Specular highlights from the studio flash must reflect off the SKIN above the tattoo."
Solves: tattoos rendering as flat decals/stickers pasted on the skin — the defining failure of AI tattoos.

**F4. CRITICAL SKIN FEATURE PROTOCOL (SCARS/BIRTHMARKS/SPOTS)** — `geminiGeneration.ts:892-899`
Triggered by a keyword scan of the request (`scar|mark|mole|spot|freckle|acne|blemish|pimple|pore|texture`, line 868).
> "1. BIOLOGY: Features must originate from the dermis. No 'painted on' look. 2. TEXTURE: Skin texture (pores) must continue OVER the feature, but may be disrupted (e.g. scar tissue smoothness)… 4. …scar tissue is often shinier. 5. LIMITS: CONFINE STRICTLY to the requested area/mask. Do not hallucinate similar features elsewhere."
Solves: painted-on marks; and the "add one freckle → get freckles everywhere" spread.

**F5. SEMANTIC INPAINTING mode block** — `geminiGeneration.ts:902-908`
> "TASK: SEMANTIC INPAINTING. Modify the content inside the red masked area based strictly on the USER INSTRUCTION… MODES: REMOVAL or MODIFICATION."
Solves: masked edits bleeding outside the mask.

**F6. ATTRIBUTE TRANSFER — TRANSFER FIDELITY** — `geminiGeneration.ts:917-928`
> "The reference image IS the specification… If transferring hairstyle, match the EXACT cut, layering, length, parting, bang style, and texture… Be precise — vague approximations are a failure."
Plus PARTIAL TRANSFER: "bangs only", "just the color", "brow arch but keep thickness" → transfer only that subset.
Solves: reference transfers landing as a vague gesture toward the reference.

**F7. ATTRIBUTE TRANSFER — IDENTITY LOCK** — `geminiGeneration.ts:930-941`
> "Image 1 IS the model. Their face, bone structure, skin tone, skin texture, freckles, moles, eye color, and every physical feature are SACRED… The reference contains a COMPLETELY DIFFERENT PERSON whose identity must NOT bleed into the output… If there is ANY conflict between the requested change and preserving identity, IDENTITY WINS. Always."
Solves: identity bleed — the output drifting toward the reference person's face.

**F8. ALLOWED TRANSFERS list (9 entries with paired KEEP clauses)** — `geminiGeneration.ts:943-959`
Each allowed attribute names exactly what crosses and what must not, disambiguating English.
> "HAIR STYLE: …KEEP hair COLOR from Image 1 unless user explicitly says 'hair color' or 'colour'. 'Hairstyle' means shape, not color."
> "EYE SHAPE: Transfer lid structure, crease depth, eye axis. KEEP iris color. 'Eye shape' means the shape of the eye, NOT the iris color."
> "EXPRESSION: …Expression is FACIAL MUSCLES ONLY — do NOT transfer head angle or pose."
Solves: the model over-transferring — one requested attribute dragging colour, pose, or geometry with it.

**F9. BLOCKED + REJECT lists** — `geminiGeneration.ts:961-972`
> BLOCKED (handled by other studios): "Makeup… Jewelry, accessories, piercings, earrings… Pose, body position, head angle, gaze direction… Lighting, mood, color grade, background"
> REJECT (never transfer regardless of instruction): "Face shape, bone structure, jawline, cheekbones, chin… Skin tone, skin texture, freckles, moles, scars… Any attribute NOT explicitly named in the USER INSTRUCTION"
Solves: product-boundary leakage into the Wardrobe/Makeup studios and identity-destroying geometry transfers.

**F10. SERVER AUTHORIZATION block — the single unlock channel** — `geminiGeneration.ts:976-988`
Only server-side field handlers may emit directives; scoped override of the REJECT/BLOCKED lists for exactly one named attribute.
> "SERVER AUTHORIZATION (highest priority for the named attribute ONLY — overrides any REJECT/BLOCKED entry for that one attribute, nothing else)"
> Comment: "no other channel (including the user sentence and any reference analysis) may override the default identity lock"
Solves: the raw user sentence acting as its own authorization (prompt injection into the identity lock).

**F11. `unlockDirective` — lock/unlock directive pair** — `server/casting/identity/identityFieldHandlers.ts:127-132`
Every authorized field emits exactly two lines: one unlock + one blanket lock.
> "AUTHORIZED IDENTITY CHANGE — {label} only: {value}."
> "LOCKED CONTEXT — preserve every trait outside the authorized {label} change exactly. Every other facial feature, hair trait, skin trait, body trait, demographic trait, and permanent mark must stay identical to the source person."
Solves: an authorized change licensing a general re-roll of the face.

**F12. `dependentPromptDirectives` — expected physical consequences** — `server/casting/identity/identityDependencies.ts:71-78`
Static, non-transitive, closed list of hair-geometry leaves that may adapt to a style/length change, plus an anti-spillover clamp.
> "EXPECTED PHYSICAL CONSEQUENCES — these hair-geometry details may adapt only as required by the authorized change: {fields}."
> "Do not change hair color, hair texture, hairline, face, skin, demographics, permanent marks, or overall facial identity as a consequence."
Solves: "make it longer" also changing colour/face; and the gate flagging legitimate coupled geometry as drift.

**F13. `buildIteratePromptContent` — spec-level iteration rules** — `geminiGeneration.ts:507-533`
Six rules against the previous master prompt.
> "4. BIOLOGICAL REALISM: Handle eye color changes as pigment shifts, not lens swaps. Describe the new color as NATURAL."
> "5. GEOMETRIC LOCKING: If adding tattoos, scars, birthmarks, or moles, you MUST define their EXACT location relative to bone structure (e.g., 'left temple, 2cm from hairline'). Do not use vague terms like 'on face'."
Solves: contact-lens-look eye changes; marks wandering position between views/regenerations.

**F14. LOCATION BOUNDARIES & GEOMETRY (system-instruction twin)** — `geminiPrompts.ts:103-105`
> "When describing tattoos, scars, or birthmarks, specify precise limits AND geometric orientation relative to bone structure."
Solves: same problem at spec-authoring time — a mark with no anchor drifts every generation.

**F15. `enhanceUserPrompt` — intent clarifier that adds no style** — `geminiGeneration.ts:543-585`
> "CRITICAL RULE: The image generator already has a master style prompt. DO NOT add stylistic directives. GOAL: Clarify the INTENT (Action + Target + Constraints)."
Falls back to the original prompt on failure.
Solves: prompt-enhancement models injecting competing style language into an edit.

**F16. `updateSchemaForIteration` — minimal-diff schema update** — `server/casting/geminiSchemaUpdater.ts:71-91`
> "1. ONLY modify the field(s) directly affected… 2. Copy ALL other fields exactly as they are — do not rephrase, do not reinterpret. 3. If the change doesn't map to any schema field (e.g. 'add a scar'), return the schema unchanged."
Fails safe (returns current schema).
Solves: an LLM rewriting the entire character sheet on a one-field edit.

**F17. `reconcileSchemaWithImage` — image-as-ground-truth reconciliation** — `geminiSchemaUpdater.ts:143-200`
After each iteration, the *image* corrects the spec, not vice versa; structure locked; brand/mood language explicitly out of scope.
> "1. The IMAGE is truth. If schema says 'thin lips' but image shows full lips, correct it."
> "6. PRESERVE all brand, vibe, and casting direction language… You are correcting PHYSICAL FEATURE descriptions only… Do NOT rewrite mood, lighting, camera, brand aesthetic, or casting tone language."
> Also strips "APPLIED MODIFICATION:" lines and "[CASTING OVERRIDES…]" prefixes.
Solves: the spec and the actual image diverging over iterations (so later generations regress to a stale description).

**F18. Ink composer prompts — role-labelled 3/4-image edit** — `server/casting/evidence/composer/inkComposer.ts:229-260, 294-349`
Explicit ROLE OF IMAGE 1/2/3/4 sections (immutable pixel canvas, placement guide, identity anchor, design reference) + AUTHORIZED CHANGE + IMMUTABLE IDENTITY + HARD RULES.
> "ROLE OF IMAGE 1 - CLEAN ORIGINAL TARGET AND IMMUTABLE PIXEL CANVAS: Use this exact image as the output canvas… Copy it exactly outside the one requested tattoo; do not reinterpret or regenerate unrelated pixels."
> "The translucent guide is instruction-only and must not appear in the output."
> "Add exactly one healed tattoo described as {descriptor}… Preserve realistic skin pores, texture, lighting, and skin highlights over the ink."
> Circumferential: "Author only the portion of this circumferential tattoo visible in this {angle} source image. Never transfer or mirror it onto the opposite limb or body side."
> "ANATOMICAL LATERALITY - SERVER AUTHORITY: … 'Left' and 'right' always mean the subject's own anatomy, never the viewer's side of the image."
> "output only the final photorealistic image, with no guide, mask, border, caption, diagram, or before/after layout."
Solves: sticker tattoos, mask overlay bleeding into output, mirrored laterality, before/after collage outputs, whole-image regeneration.

**F19. Ink `RETRY_DIRECTIVES` — six named correction strings** — `inkComposer.ts:109-116`
> prior_ink: "Restore every tattoo or permanent mark already visible in the original target exactly; do not move, mirror, resize, recolour, erase, or duplicate it."
> unexpected_ink: "Remove every newly invented mark outside the highlighted region."
Solves: retry attempts that fix one defect and introduce another; each probe failure maps to one corrective sentence.

**F20. `buildInkInstructionPlanningRequest` — closed anatomy classifier prompt** — `server/casting/evidence/inkInstructionPlanner.ts:144-182`
Classify-don't-perform, with explicit anatomical mapping laws and a no-guessing clause.
> "A single full sleeve on one arm is one feature. Tattoos on two limbs… must be refused."
> "left/right are anatomical, from the person's perspective"
> "Set ambiguousAnatomy=true when the body location, surface, or laterality needed for a supported tuple is missing or contradictory. Do not guess from gender, pose, image orientation, or tattoo design."
Plus deterministic pre-refusal regexes (prompt-control, remove/change existing ink, person/body change, clothing, vague copy, multiple tattoos, intimate placement) at lines 79-116, and a min-confidence of 82.
Solves: charging for an ambiguous placement that lands on the wrong body part; scope creep from a tattoo request into a body edit.

**F21. `CLASSIFIER_PROMPT_HEADER` — closed edit taxonomy** — `server/casting/identity/editAuthority.ts:182-205`
Every edit sentence is bucketed into identity/presentation/imageOnly leaves; mixed requests take the most severe bucket; fail-closed on uncertainty.
> "'kind' is then the most severe bucket present: 'identity' if ANY identity category applies"
> "Temporary blemish cleanup / photo retouching is image.retouch; permanent natural skin texture is person.skin.texture."
> "If you cannot place the request confidently, output {\"kind\":\"unknown\"…}. Never guess."
Solves: an identity change slipping through as a cosmetic edit (and therefore skipping the gate/commit).

**F22. `NORMALIZER_PROMPT_HEADER` — durable, non-relational values** — `editAuthority.ts:208-219`
> "Values are CONCRETE and durable ('chin-length layered wolf cut with wispy curtain fringe'), NEVER relational ('like the reference', 'same as the image')."
> "If a reference image is attached, describe the requested attribute AS SEEN in the reference, in durable physical terms."
Solves: storing "like the reference" as the character sheet's permanent value — unreproducible once the reference is gone.

**F23. Deterministic hair-length band derivation** — `editAuthority.ts:128-161`
Idiom→band table (waist/hip/tailbone/rapunzel → Very Long; chest/bra/mid-back/shoulder-blade → Long; collarbone → Medium; pixie/buzz → Very Short), most-extreme-first, with match consumption, "long layers" stripped as a style not a length, and conflicting matches → null.
> "the normalizer can never make the committed length more (or less) extreme than what was requested"
Solves: "a bit longer" committing an extreme length the user never asked for.

**F24. Hair-length clarification card** — `shared/castingClarification.ts`
A vague length request returns a free, server-owned follow-up with the five canonical choices instead of failing.
> "How long should the hair be?" / "Choose one final length. Nothing was charged."
Solves: dead-end refusals on ambiguous edits; keeps the paid door behind a precise instruction.

**F25. `hairStyle` change resets its sub-selectors** — `identityFieldHandlers.ts:261-270`
A style change clears length/fringe/parting/volume/tuck/flyaways/fade so the engine re-derives them; a gender change clears hairStyle/hairFade/facialHair (`:320-328`).
Solves: a bob inheriting the previous long-layer's parting and volume.

**F26. `FIELD_AVAILABILITY` — per-modality edit capability ledger** — `identityFieldHandlers.ts:393-432`
Each of 28 fields declares `text` / `reference` / `structured` availability; e.g. skin texture is text-only because "the live prompt rejects it"; person-level fields (build/age/gender/skinTone/ethnicity) refuse at every free-text door.
Solves: offering an edit modality the prompt can't actually execute — i.e. charging for a guaranteed failure.

---

## G) SAFETY / QUALITY GATES IN THE GENERATION PATH

**G1. `SAFETY_SETTINGS = BLOCK_NONE` (documented rationale)** — `geminiClient.ts:57-62`
> "Fashion casting requires generating bare skin (shoulders, arms, legs), clinical anatomical descriptions (jawline, cheekbones, sub-malar hollows), and industry terminology that triggers overly cautious safety filters. …this setting should be preserved for Casting workflows and NOT unified with other apps' BLOCK_ONLY_HIGH setting."
Solves: the studio refusing to produce ordinary casting imagery.

**G2. `diagnoseResponse` — failure-mode triage** — `geminiClient.ts:140-160`
Distinguishes prompt-level block, missing candidates, and finish reasons (`SAFETY|BLOCKED|RECITATION|PROHIBITED_CONTENT`).
> "Prompt blocked by safety filter: {reason}. Try rephrasing the casting specification."
Solves: opaque "generation failed" errors.

**G3. `isPlaceholderImage` / `validateNotPlaceholder` — silent-refusal detector** — `server/casting/placeholderDetection.ts:28, 139`
Pixel-sampling variance + unique-colour check (64 samples, variance <150, <8 unique colours, <5KB), run after extraction but before storage/credit finalization → triggers the atomic refund path.
> "Detects blank/gray/solid-color images returned by Gemini when its internal safety filters silently refuse to generate a person but still return finishReason: STOP with image data."
> "Generation produced a blank image… Credits have been refunded."
Solves: charging for a grey rectangle.

**G4. `canonicalGeneratedImageDataUrl` — byte-magic MIME declaration** — `geminiClient.ts:101-137`
Base64 round-trip validation, 20 MB cap, MIME derived from magic bytes not provider label.
> "Provider MIME labels are advisory: the returned data URL is declared from byte magic"
Solves: malformed/spoofed image payloads entering storage.

**G5. `withTimeout` + `withSingleRetry503`** — `geminiClient.ts:167, 191`
30s text / 60s image labelled timeouts; single retry after 3s on 500/503 only, deliberately never on 429.
> "Does NOT retry 429 (rate limit) — in a multi-user environment, retrying rate limits amplifies the problem."
Solves: hung requests; retry storms making a shared-quota outage worse.

**G6. Model fallback ladders** — `geminiGeneration.ts:226, 805`, `geminiViews.ts:116, 204, 306`
Every generator loops a registry-defined fallback array (`TEXT_HEAVY_FALLBACK`, `IMAGE_FALLBACK`, `TEXT_LIGHT_FALLBACK`) with a 1s inter-model pause, throwing a `PublicError` only after the last.
Solves: a single model's outage taking the whole studio down.

**G7. `formatGeminiError` — sanitized user-facing errors** — `geminiClient.ts:219-232`
Fixed wording per branch; raw provider text (which can carry payloads/URLs/key details) never travels.
> "Customers never provide or manage the server's Gemini key — an auth failure is OUR outage, never something the user can fix." → 403 maps to "The generation service is temporarily unavailable."
Solves: leaking internals; blaming the user for a house outage.

**G8. `geminiQueue` — two-lane concurrency limiter + depth cap** — `server/casting/geminiQueue.ts:31-45, 67`
Image and text lanes (5 each, env-tunable), FIFO overflow, MAX_QUEUE_DEPTH 50 hard reject, queue-position callbacks.
> "All users share one Gemini API key. Without server-side throttling, concurrent users exhaust the quota and everyone gets 429s."
Solves: one user's batch starving everyone; unbounded queue latency.

**G9. `geminiCircuitBreaker`** — `server/casting/geminiCircuitBreaker.ts:20-22`
5 consecutive failures in a 60s window trips; 30s cooldown before a probe; checked before entering the queue.
Solves: hammering a dead provider and burning user time/credits.

**G10. `validateCreationIntent` — creation-time intake boundary** — `server/casting/identity/creationIntake.ts:64`
Scans EVERY string channel (brief, features, every descriptor/override, arbitrary Canvas attributes) before any save or charge; refuses presentation/styling language, cosmetic-lash language, relational-reference wording, creation reference images, and off-list gender/age/blend/vibe. Brand channels excluded because house archetypes legitimately use garment language.
> "NO SILENT STRIPPING — refuse honestly and route styling downstream."
Solves: wardrobe/makeup language contaminating the identity document and the bare-face imagery.

**G11. Suggestion guardrails — "BARE FACE casting studio"** — `server/casting/geminiSuggestions.ts:148-155, 286-296`
Both the suggestion generator and the reference analyzer carry a NEVER SUGGEST / EXCLUDE list.
> "NEVER SUGGEST: Makeup of any kind… Permanent marks of any kind: tattoos, ink, scars, freckles, moles, beauty marks, birthmarks, piercings — mark editing is not available… Skin tone, apparent age, gender, build, or ethnicity changes… Eyelash changes of any kind."
Solves: the UI suggesting edits the system will refuse (a trust break) and off-product suggestions.

**G12. Silent-fail + hardcoded `FALLBACK_SUGGESTIONS`** — `geminiSuggestions.ts:31-38, 190-195`
> "Slightly narrower jawline", "More prominent cheekbones", "Messier windswept hair texture" …
Solves: a non-critical enhancement breaking the studio UI.

**G13. `checkImageQuality` — VTO reference gatekeeper** — `server/wardrobe/qualityCheck.ts:56-71`
Eight named issue codes (MIRROR_SELFIE, FACE_OBSCURED, LOW_RESOLUTION, HEAVY_ANGLE, CLUTTERED_BG, MULTIPLE_PEOPLE, SCREENSHOT, PARTIAL_BODY), confidence-gated.
Solves: garbage-in garbage-out on the dressing path.

---

## H) OTHER ENGINEERED MECHANISMS

**H1. Master prompt as dual-output contract** — `geminiPrompts.ts:30-141`
One JSON with `natural_description` (prose for the image model) + `technical_schema` (structured recall for identity anchoring/edits/reconciliation), with a lettered prose skeleton (a–g) and a schema-field-must-be-specific rule.
> "Every facial_features field MUST have a specific, descriptive value… No vague values like 'natural' or 'normal' — be specific"
Solves: prose-only specs that can't be diffed, edited, or anchored; schema-only specs that render flat.

**H2. Three-state mark prompt selection (`markPromptStateFor`)** — `server/casting/identity/marksVocabulary.ts:58-70`, consumed at `geminiPrompts.ts:261` and `geminiGeneration.ts:643`
ink → TATTOO_PERSISTENCE_RULE; non-ink mark → NEITHER rule; mark-free → CLEAN_SKIN_RULE + the "TATTOOS, INK, BODY ART, PIERCINGS" negative list.
> Persistence: "Subject features permanent body art. RENDER WITH HIGH FIDELITY. DO NOT REMOVE. INK MUST SIT IN DERMIS AND BE VISIBLE."
> Clean: "STRICTLY CLEAN SKIN. NO TATTOOS, NO INK, NO BODY ART unless explicitly mandated"
> Rationale: "a freckled document could receive the CLEAN_SKIN rule and be erased"
Solves: the pipeline erasing a freckled/scarred/pierced model's own defining marks; and hallucinated ink on clean models.

**H3. `MARK_VOCABULARY` — five word-boundary categories** — `marksVocabulary.ts:22-33`
ink / scar / pigmentation / piercing / structural, each a curated regex.
> "Word-boundary matched so 'scarf' / 'molecular' / 'branding iron' prose and 'inking a deal' don't false-positive."
Solves: false positives flipping a whole model into tattoo-persistence mode; one shared vocabulary replacing two disagreeing detectors.

**H4. `hasBodyArt` — legacy ink detector** — `geminiPrompts.ts:243-248`
Padded-string word-boundary matcher incl. `wax seal`, `body branding`, `calligraphy tattoo`.
Solves: (superseded by H2/H3) the original ink-persistence trigger; retained for compatibility.

**H5. `protectedMarkLanguageIntact` — compaction guard** — `marksVocabulary.ts:76-78`
Every mark category present in the original must still be detectable in the rewrite, or the rewrite is rejected and raw text kept.
Solves: compaction quietly deleting a tattoo from the character sheet, which then erases it from every future generation.

**H6. `compactMasterPrompt` — what compaction preserves vs discards** — `server/casting/geminiPromptCompactor.ts:37-96`
Discards: "APPLIED MODIFICATION:" headers, superseded contradictions (latest amendment wins). **Preserves**: all brand/vibe/expression/mood language and unoverridden detail.
> "6. PRESERVE all brand aesthetic language, vibe descriptions, expression direction, and casting mood from the original. These are NOT redundant — they guide the image model. Do not simplify 'deadpan, quietly observing, unbothered' to just 'neutral expression.'"
> Guards: reject any output <100 chars; on total failure return the bloated prompt unchanged.
Solves: prompt bloat degrading generations after 3-5 iterations — while proving that brand/expression prose is considered load-bearing, not filler.

**H7. `PARSER_SYSTEM_PROMPT` — restrained extraction philosophy** — `server/casting/promptParser.ts:229-443`
Explicitly tells the parser the downstream engine is the creative one and to leave fields null.
> "When the user says 'Brazilian woman, mid 20s, editorial vibe,' your job is to fill gender, age, ethnicityBlend, and castingVibe — and STOP… If you fill them with plausible defaults, you constrain the engine and produce a generic Brazilian cast every time."
> "Empty fields become creative opportunities for the engine; wrong fields become user-trust violations."
Solves: parser over-extraction flattening every cast into the same face.

**H8. Parser override mechanism ("the core innovation")** — `promptParser.ts:337-346`
Six paired enum+override fields; enum for chip display, verbatim prose for the engine.
> "shag wolf with side-swept curtain bangs and asymmetric face-framing layers → hairStyle: 'Shag / Wolf' AND hairStyleOverride: '<verbatim>'"
Solves: snapping rich user descriptions to the nearest enum and losing the detail; keeps chips coherent while the engine gets the full text.

**H9. Parser intent routing (3 paths)** — `promptParser.ts:259-292`
random / parsed / per-field-random, with a closed randomization-keyword list and a field-phrase→internal-name map; ambiguous phrases ("random vibes overall") deliberately not routed.
> Empty-but-not-random prompts get a randomly picked brand: "This prevents the 'every empty prompt produces a Gucci face' problem."
Solves: brand-default monoculture; unhandled "surprise me" intents.

**H10. Nationality mapping table** — `promptParser.ts:352-373`
~60 nationality terms → 10 enum values, plus ambiguity defaults.
> Bare "asian" → East Asian 100%; bare "european" → 50/50 Nordic+Slavic ("produces the 'general European' look… without committing to a specific subregion"); bare "african" → West African 100%; bare "mixed" → `[]`; "ambiguous + named ethnicity" → named wins, "ambiguous" treated as noise.
Solves: "Brazilian" or "Persian" landing nowhere; silent Eurocentric defaults.

**H11. Gender inference closed lists + guardrail** — `promptParser.ts:382-394`
Female-implying (`blonde`, `ballerina`, `it girl`, `bombshell`…) and male-implying (`dude`, `lad`, `gent`…) noun lists, overridden by any explicit gender word or pronoun.
> "If the user types 'blonde guy', the word 'guy' wins (Male)… Nothing defaults to Non-Binary — users who want NB cast always say it explicitly."
Solves: mis-gendering from a hair-colour noun; stereotype-driven guesses.

**H12. Age idiom table** — `promptParser.ts:396-412`
"Late teens"→19 … "Mid-forties"→45, "Young"→23, "Mature"→50, always emitted as a string.
Solves: inconsistent age interpretation between runs.

**H13. Vibe interpretation table + 0.7 ceiling** — `promptParser.ts:414-425`
Keyword clusters → three-axis weights; mixed signals bias the dominant axis to ~0.55.
> "Don't exceed 0.7 in any axis unless the prompt is emphatic."
Solves: a single adjective pinning the engine to a maximal, monotonous vibe.

**H14. Parser CRITICAL DON'TS** — `promptParser.ts:427-433`
> "Don't encode mood or expression. 'Tired but elegant', 'kind face', 'intense eyes' — drop these. The engine handles expression via the brand profile."
> "Don't encode celebrity features. 'Looks like Zendaya' → fill gender Female and maybe age, then stop."
> "Don't refuse to generate. Every prompt produces a CastAttributes object."
Solves: mood words entering physical fields (dead prompt tokens); celebrity likeness fabrication; hard refusals on the free path.

**H15. Merge precedence chain + `resolveEngineChoices`** — `promptParser.ts:103-165`
`defaults < parser < per-field randomization < locked values`; absence IS the default; brand absence resolves to a random pick of the eight on the PAID path only, recorded in preferences for reproducibility.
> "an absent brand resolves to a random pick from the eight — never the old silent Gucci fallback… prefill must leave brand open as Engine's choice"
Solves: silent Gucci monoculture; irreproducible casts.

**H16. `ALLOWED_FIELDS` + `sanitizeParsed`** — `promptParser.ts:40-101`
Invented fields dropped; blend capped at 2 with pct clamped 0-100; vibe clamped 0-1; age coerced to string. Parse failure is fail-open (passthrough prefs) — "The parser NEVER blocks a paid run".
Solves: hallucinated schema fields corrupting preferences; a parser outage killing generation.

**H17. Engine's-choice sentinels** — `geminiGeneration.ts:473-474`
Absent gender/age are passed as directives, not blanks.
> "Gender: ENGINE'S CHOICE — cast whoever best serves the brand direction" / "Age: ENGINE'S CHOICE — pick an age that suits the brand direction and vibe"
Solves: empty fields producing a default 25-year-old woman every time.

**H18. EXPLICIT vs UNSET feature partitioning** — `geminiGeneration.ts:388-449`
Every face field is sorted into a PRIORITY-1 block or a derive-from-archetype block, with `Auto`/`Any`/empty treated as unset.
> "USER EXPLICIT FEATURES (PRIORITY 1 — ABSOLUTE, DO NOT OVERRIDE)" / "UNSET FEATURES (derive from brand archetype + ethnicity heritage)"
Solves: the writer treating a user choice and an engine default as equally negotiable.

**H19. HAIR FIDELITY DIRECTIVE** — `geminiGeneration.ts:487-492`
> "Every named hair selector above is a deliberate requirement, not inspiration… NEVER shorten Very Long or Long hair, replace locs or braids with cropped hair, or remove a requested beard. Adapt freely ONLY where a detail is genuinely missing."
Solves: the well-documented tendency of image models to shorten long hair and substitute simple cuts.

**H20. `analyzeReferenceForTransfer` — understatement doctrine** — `geminiSuggestions.ts:213-300`
Reference attributes must be described with intensity words matched to the reference; explicit GOOD/BAD example pairs.
> "Understatement is critical: if the reference has subtle freckles, say 'subtle' or 'faint.' If the hair is slightly wavy, say 'slight wave.'"
> BAD: "'Change the eyebrows' (no description of what they look like)"
Solves: reference transfers being exaggerated into caricature (the classic "make brows like this" → giant brows).

**H21. Suggestion view-awareness + model-profile relevance** — `geminiSuggestions.ts:109-133`
Suggestions are scoped to the active canonical view and to this model's actual features.
> "Appropriate for a {headshot|full body front|side profile} (don't suggest full body changes for a headshot)"
Solves: suggestions that can't be executed on the current view.

**H22. Resilient JSON parsers** — `geminiSuggestions.ts:65-86`, `geminiSchemaUpdater.ts:36-58`
3-stage array parser (clean → strip fences → regex string extraction from truncated JSON) and 3-stage object parser (clean → fences → outermost-brace substring).
Solves: truncated/fenced vision-model output discarding an otherwise usable result.

**H23. `analyzeTattoos` → `promptFragment` (VTO tattoo map)** — `server/wardrobe/tattooAnalysis.ts:52-135`
Per-body-area TATTOO/CLEAN/HIDDEN classification; HIDDEN areas are omitted rather than claimed; the fragment carries an explicit adjacency rule.
> "Areas covered by clothing are unknown — if a garment change exposes previously hidden skin, default to CLEAN skin unless the exposed area is adjacent to a confirmed tattoo area AND the tattoo visibly extends to the edge of the clothing line in Image 1."
> No-tattoo case: "Do not hallucinate tattoos on hands, arms, chest, or neck."
Solves: VTO inventing tattoos on newly exposed skin, or extending arm sleeves onto hands.

**H24. VTO "locked layer" identity language** — `server/wardrobe/vtoGeneration.ts:220`
> "Image 1 is the model. This person's face, body, skin, tattoos, pose, and background are sacred — reproduce them exactly. Do not alter, regenerate, or reinterpret anything about this person. Think of Image 1 as a locked layer that you are dressing."
Solves: the dressing pass regenerating the model as a different person.

**H25. VTO garment fidelity + physics + framing clauses** — `vtoGeneration.ts:224-234`
> "Every garment listed above MUST be visible in the output. Do not omit any garment… Never choose one garment over another."
> "same fabric weight and drape, same construction (buttons, zippers, lapels, pockets, seams)… A heavy wool coat must look heavy, not thin… Do not simplify garments."
> "Pant hems drape over footwear. Tucked shirts bunch naturally at the waistband… No floating gaps between garment zones."
> "If any garment reference image contains a person or other clothing items, extract ONLY the target garment described in the instructions above."
> "Frame the output as a full-body shot from head to toe… Match the framing and camera distance of Image 1."
Solves: dropped garments, simplified/generic garments, floating clothing, reference-person bleed, crop drift.

**H26. VTO layering narrative + preserved-slot sentences** — `vtoGeneration.ts:95-145`
Auto-generated per-garment layer notes ("as the outer layer (worn OVER the …)"), preserved-slot instruction, and an overlap rule.
> "Where layers overlap, the inner layer should only peek through at necklines, hems, cuffs, and openings — not sit on top of the outer layer."
Solves: inverted layering (jacket under shirt); unchanged slots being silently re-invented.

**H27. VTO refinement prompt variants** — `vtoGeneration.ts:311-330, 383-401`
Style-refresh ("only change HOW garments are worn") vs slot-swap ("replace the {slots}, keep all others exactly as they appear in Image 2"), both re-anchoring identity/pose to Image 1 and re-injecting the tattoo fragment.
> "If a style note says 'Tuck in', show the garment tucked into the waistband… Do not alter fabric, color, fit, or garment identity — only the physical arrangement."
Solves: a styling tweak turning into a wardrobe change.

**H28. `CREDIT_COSTS` — per-operation pricing constants** — `client/src/features/casting/constants.ts:96-103`
castingImage 350 / fullBody 300 / multiView 300 / iteration 350 / eraser 350; masterPrompt 0 (bundled).
Solves: the text spec generation being separately billable (it's part of the image door).

**H29. Founder test hooks for gate flows** — `backViewGate.ts:74`, `editGate.ts:157-164`, `editGateFlow.ts:62`
`BACK_VIEW_GATE_FORCE_FAIL=1`, `IDENTITY_GATE_FORCE_FAIL=1`, `IDENTITY_GATE_FORCE_UNAVAILABLE=1`, `IDENTITY_GATE_FORCE_FAIL_FIRST=1`.
> "set BACK_VIEW_GATE_FORCE_FAIL=1 … to watch the named-and-refunded flow live, then remove it. Never ships enabled."
Solves: refund/refusal flows being untestable in production.

**H30. Fail-open vs fail-closed house policy (explicit and asymmetric)**
Fail-OPEN (never block a paid run): `checkIdentityConsistency` (`geminiClient.ts:333`), `backViewGate` on infra error (`:96-99`), `analyzeTattoos` (`:141`), `checkIdentityMatch` (`:53`), parser (`promptParser.ts:14`), suggestions, compactor, schema updater, reconciler.
Fail-CLOSED: identity edit gate (`editGate.ts:242`), `iterationFramingForView` (`iterationFraming.ts:78`), edit classifier `unknown`, `validateCreationIntent`, ink instruction planner.
Solves: the correct trade in each place — checkers must never cost the user a paid run, but identity authority must never guess.

---

### Cross-cutting notes worth porting deliberately

- **`getStudioSettings(context)` is called with `masterPrompt + iterationRequest` combined** (`geminiGeneration.ts:628`) so a mark named in the *edit sentence* — not just the document — flips the studio rule state.
- **Two separate brand voices exist on purpose**: `BRAND_PROFILES.descriptor` (dramatic, for the spec writer) and `getBrandExpression` (restrained, for the image model). Losing the split reintroduces performative faces.
- **Two separate ethnicity band tables exist on purpose**: `formatEthnicityBlend` (text model, 85/70/55) and `buildEthnicityHint` (image model, 85/65). Wording is tuned per consumer.
- **The whole `technicalSchema` exists mainly to feed `buildIdentityAnchor`** — it is not decorative metadata; every derived view depends on it.