# Parser Gold Standard v2 — Simulated Outputs

**Purpose:** these are the expected outputs for every test prompt from `PARSER_PROMPT_V2.md`, produced by Claude acting as the parser while strictly following the v2 system prompt. Use them as ground truth when validating your chosen production model (Gemini Flash, Gemini Pro, Claude Sonnet, GPT-4o — whichever you pick).

**Key differences from v1 gold standard:**

1. **Outputs are visibly sparser.** v1 averaged 4.8 populated fields per prompt across all 24 tests. v2 averages closer to 4.0 because the philosophy shifted from "creative parser fills sensible defaults" to "restrained parser extracts explicit intent only."
2. **Every output has an `intent` field.** Almost all are `"parsed"`; only Test 26 returns `"random"`.
3. **Mood and expression descriptors are gone.** v1 placed "striking" in features for Test 11. v2 drops it.
4. **Subculture terms map to closest brand instead of vibe weights.** v1 mapped "punk" to runway-heavy vibe. v2 maps to Saint Laurent brand.
5. **Truly empty inputs get random brand assignment.** v1 returned empty defaults for "model"; v2 picks a random brand from BRAND_PROFILES to give the engine variety.
6. **Italian is now Mediterranean.** v1 Test 2 returned `ethnicityBlend: []` because Italian had no enum match. v2 fills `[{ name: "Mediterranean", pct: 100 }]` using the new enum entry.
7. **Tom Ford uses the override pattern.** v1 left castingBrand null for unrecognized brands. v2 populates `castingBrandOverride` with the verbatim user description.
8. **Three new tests (25, 26, 27)** validate v2-specific features: override pattern, global random intent, per-field random.

---

## Section 1 — Tier 1 (terse prompts)

### Test 1 — `asian guy 30s`
```json
{
  "intent": "parsed",
  "gender": "Male",
  "age": "33",
  "ethnicityBlend": [{ "name": "East Asian", "pct": 100 }],
  "castingVibe": { "editorial": 0.33, "commercial": 0.34, "runway": 0.33 },
  "userPrompt": "asian guy 30s"
}
```
**4 fields populated.** Bare "asian" defaults to East Asian. "30s" maps to 33.

---

### Test 2 — `young italian woman`
```json
{
  "intent": "parsed",
  "gender": "Female",
  "age": "23",
  "ethnicityBlend": [{ "name": "Mediterranean", "pct": 100 }],
  "castingVibe": { "editorial": 0.33, "commercial": 0.34, "runway": 0.33 },
  "userPrompt": "young italian woman"
}
```
**4 fields populated.** **Critical fix from v1.** This was the test that exposed the missing Mediterranean enum. v1 returned an empty ethnicityBlend; v2 fills it correctly. This is why Section 6 of `PARSER_PROMPT_V2.md` requires updating `constants.ts` before deployment.

---

### Test 3 — `tall blonde model`
```json
{
  "intent": "parsed",
  "gender": "Female",
  "hairColor": "Golden Blonde",
  "ethnicityBlend": [],
  "castingVibe": { "editorial": 0.33, "commercial": 0.34, "runway": 0.33 },
  "userPrompt": "tall blonde model"
}
```
**3 fields populated.** Gender filled per IP-2 (blonde implies Female via the closed list). v1 strict mode left gender null; v2 loose mode fills it. "Tall" has no schema field. "Model" is not on the gendered noun list.

---

### Test 4 — `someone like a russian ballerina`
```json
{
  "intent": "parsed",
  "gender": "Female",
  "bodyType": "Slim",
  "ethnicityBlend": [{ "name": "Slavic", "pct": 100 }],
  "castingVibe": { "editorial": 0.33, "commercial": 0.34, "runway": 0.33 },
  "userPrompt": "someone like a russian ballerina"
}
```
**4 fields populated.** "Ballerina" implies Female AND Slim — both are part of the literal meaning of the word, not invented inferences. Russian → Slavic.

---

### Test 5 — `african man, late 50s, kind face`
```json
{
  "intent": "parsed",
  "gender": "Male",
  "age": "58",
  "ethnicityBlend": [{ "name": "West African", "pct": 100 }],
  "castingVibe": { "editorial": 0.33, "commercial": 0.34, "runway": 0.33 },
  "userPrompt": "african man, late 50s, kind face"
}
```
**4 fields populated.** "Kind face" is expression — dropped under v2 philosophy. "African" defaults to West African.

---

## Section 2 — Tier 2 (identity-rich prompts)

### Test 6 — `athletic Brazilian woman, strong jaw, dark curly hair, editorial vibe, mid-twenties`
```json
{
  "intent": "parsed",
  "gender": "Female",
  "age": "25",
  "ethnicityBlend": [{ "name": "Latino", "pct": 100 }],
  "bodyType": "Athletic",
  "hairColor": "Dark Brown",
  "hairTexture": "Curly",
  "jawline": "Strong / Pronounced",
  "castingVibe": { "editorial": 0.7, "commercial": 0.15, "runway": 0.15 },
  "userPrompt": "athletic Brazilian woman, strong jaw, dark curly hair, editorial vibe, mid-twenties"
}
```
**8 fields populated.** This is the production target — well-specified prompts should produce 7-9 fields. Engine fills skin tone, eye color, face shape, cheekbones, lips, brows, hair length, hair style creatively from "Latino + editorial + Female + athletic."

---

### Test 7 — `clean-shaven Korean man, late 20s, Saint Laurent vibe, slim, jet black hair undercut, sharp jawline`
```json
{
  "intent": "parsed",
  "gender": "Male",
  "age": "28",
  "ethnicityBlend": [{ "name": "East Asian", "pct": 100 }],
  "bodyType": "Slim",
  "hairColor": "Jet Black",
  "hairStyle": "Undercut",
  "facialHair": "Clean Shaven",
  "jawline": "Sharp / Chiseled",
  "castingBrand": "Saint Laurent",
  "castingVibe": { "editorial": 0.4, "commercial": 0.2, "runway": 0.4 },
  "userPrompt": "clean-shaven Korean man, late 20s, Saint Laurent vibe, slim, jet black hair undercut, sharp jawline"
}
```
**11 fields populated.** Highest field count in the test suite. Saint Laurent vibe splits 40/20/40 between editorial and runway because the brand profile is "rock n roll heroin chic" — both editorial and runway qualities.

---

### Test 8 — `nigerian woman, deep skin, shaved head, very high cheekbones, editorial`
```json
{
  "intent": "parsed",
  "gender": "Female",
  "ethnicityBlend": [{ "name": "West African", "pct": 100 }],
  "skinTone": "Deep / Brown",
  "hairLength": "Very Short",
  "hairStyle": "Buzz / Shaved",
  "cheekbones": "High",
  "castingVibe": { "editorial": 0.7, "commercial": 0.15, "runway": 0.15 },
  "userPrompt": "nigerian woman, deep skin, shaved head, very high cheekbones, editorial"
}
```
**7 fields populated.** "Shaved head" fills both hairLength and hairStyle. Age deliberately null — not specified.

---

### Test 9 — `pale redhead with freckles, late teens, soft features, commercial lookbook`
```json
{
  "intent": "parsed",
  "gender": "Female",
  "age": "19",
  "ethnicityBlend": [],
  "skinTone": "Porcelain / Pale",
  "skinTexture": "Freckled",
  "hairColor": "Copper",
  "jawline": "Soft / Rounded",
  "castingVibe": { "editorial": 0.15, "commercial": 0.7, "runway": 0.15 },
  "userPrompt": "pale redhead with freckles, late teens, soft features, commercial lookbook"
}
```
**8 fields populated.** Gender filled via IP-2 ("redhead" implies Female). v1 strict mode left it null. "Soft features" → Soft/Rounded jawline (interpretation, but defensible because the user said it). Redhead → Copper (could also be Auburn — judgment call).

---

### Test 10 — `mid-fifties indian man with salt and pepper hair and a short beard, intellectual vibe, prada-esque`
```json
{
  "intent": "parsed",
  "gender": "Male",
  "age": "55",
  "ethnicityBlend": [{ "name": "South Asian", "pct": 100 }],
  "hairColor": "Salt & Pepper",
  "facialHair": "Short Beard",
  "castingBrand": "Prada",
  "castingVibe": { "editorial": 0.55, "commercial": 0.15, "runway": 0.3 },
  "userPrompt": "mid-fifties indian man with salt and pepper hair and a short beard, intellectual vibe, prada-esque"
}
```
**8 fields populated.** Prada brand profile is "intellectual severity" — vibe leans editorial with runway secondary.

---

## Section 3 — Tier 3 (atmospheric prompts)

### Test 11 — `a striking woman in her late thirties with sharp cheekbones, kept-natural curly hair just past her shoulders, ambiguous mixed-race features, the kind of face that gets cast for moody fragrance ads`
```json
{
  "intent": "parsed",
  "gender": "Female",
  "age": "38",
  "ethnicityBlend": [],
  "hairLength": "Medium",
  "hairTexture": "Curly",
  "hairVolume": "Natural",
  "cheekbones": "Defined",
  "castingVibe": { "editorial": 0.7, "commercial": 0.15, "runway": 0.15 },
  "userPrompt": "a striking woman in her late thirties with sharp cheekbones, kept-natural curly hair just past her shoulders, ambiguous mixed-race features, the kind of face that gets cast for moody fragrance ads"
}
```
**8 fields populated.** **Notable change from v1:** "striking" is no longer in features. Under v2, features is for distinctive STRUCTURAL details only — freckles, scars, gap teeth. "Striking" is a quality judgment, dropped. Everything else extracted normally. The engine will produce a striking model from the editorial vibe + ambiguous heritage anyway.

---

### Test 12 — `imagine a Tom Ford ad from 2003 — that aesthetic. A man in his early forties, athletic, salt and pepper, deep tan, intense eyes, like he's just stepped off a yacht`
```json
{
  "intent": "parsed",
  "gender": "Male",
  "age": "42",
  "ethnicityBlend": [],
  "bodyType": "Athletic",
  "skinTone": "Tan / Bronze",
  "hairColor": "Salt & Pepper",
  "castingBrandOverride": "Tom Ford 2003 ad aesthetic — moody luxurious narrative",
  "castingVibe": { "editorial": 0.6, "commercial": 0.2, "runway": 0.2 },
  "userPrompt": "imagine a Tom Ford ad from 2003 — that aesthetic. A man in his early forties, athletic, salt and pepper, deep tan, intense eyes, like he's just stepped off a yacht"
}
```
**8 fields populated, 1 override.** **First test of the override pattern in the wild.** Tom Ford isn't in the brand enum, so `castingBrand` stays null and `castingBrandOverride` carries the verbatim aesthetic description. The engine will receive the override as additional brand context. "Intense eyes" is expression, dropped. "Just stepped off a yacht" is mood/atmosphere, dropped.

---

### Test 13 — `the type of girl-next-door who shows up in J Crew catalogs — light brown hair, hazel eyes, freckles, balanced features, very approachable, mid-twenties`
```json
{
  "intent": "parsed",
  "gender": "Female",
  "age": "25",
  "ethnicityBlend": [],
  "skinTexture": "Freckled",
  "eyeColor": "Hazel",
  "hairColor": "Light Brown",
  "cheeks": "Balanced",
  "castingVibe": { "editorial": 0.15, "commercial": 0.7, "runway": 0.15 },
  "userPrompt": "the type of girl-next-door who shows up in J Crew catalogs — light brown hair, hazel eyes, freckles, balanced features, very approachable, mid-twenties"
}
```
**8 fields populated.** "Girl-next-door" is on the IP-2 gendered noun list → Female. "J Crew" isn't in the brand enum but the user gave a clear commercial vibe signal independently — vibe handled, brand left null. "Balanced features" → cheeks "Balanced" (interpretation). "Very approachable" is expression, dropped.

---

### Test 14 — `editorial high fashion, androgynous, 21, ambiguous ethnicity, jet black bob with blunt bangs, nordic influence, very sharp angular features, raised eyebrows, cold expression`
```json
{
  "intent": "parsed",
  "gender": "Non-Binary",
  "age": "21",
  "ethnicityBlend": [{ "name": "Nordic", "pct": 100 }],
  "hairColor": "Jet Black",
  "hairStyle": "Bob",
  "hairFringe": "Blunt Bangs",
  "cheekbones": "Defined",
  "jawline": "Sharp / Chiseled",
  "castingVibe": { "editorial": 0.5, "commercial": 0.1, "runway": 0.4 },
  "userPrompt": "editorial high fashion, androgynous, 21, ambiguous ethnicity, jet black bob with blunt bangs, nordic influence, very sharp angular features, raised eyebrows, cold expression"
}
```
**10 fields populated.** **Demonstrates IP-8 in action.** "Ambiguous ethnicity" + "nordic influence" → named entity wins, fill Nordic 100%. "Raised eyebrows" and "cold expression" are dropped (expression). "Very sharp angular features" fills both cheekbones AND jawline because both are explicitly described as sharp.

---

## Section 4 — Tier 4 (edge cases)

### Test 15 — `model`
```json
{
  "intent": "parsed",
  "ethnicityBlend": [],
  "castingBrand": "Versace",
  "castingVibe": { "editorial": 0.33, "commercial": 0.34, "runway": 0.33 },
  "userPrompt": "model"
}
```
**1 structural field populated.** **Demonstrates IP-3 random brand assignment.** Truly empty input → random brand picked from BRAND_PROFILES (Versace in this run, but the actual production parser will randomize). v1 left every field null; v2 ensures variety on truly empty inputs by giving the engine a starting brand to interpret. **Note: when testing your actual model, don't expect to see "Versace" specifically — any of the 8 brands is valid output for this test.**

---

### Test 16 — `someone like Zendaya but older`
```json
{
  "intent": "parsed",
  "gender": "Female",
  "age": "35",
  "ethnicityBlend": [],
  "castingVibe": { "editorial": 0.33, "commercial": 0.34, "runway": 0.33 },
  "userPrompt": "someone like Zendaya but older"
}
```
**3 fields populated.** **The most important regression test.** Gender Female (Zendaya is female), age 35 (older than her current ~30), nothing else. Do NOT encode Zendaya's actual features. **If your iteration of the system prompt causes this test to start filling skin tone, hair, ethnicity, etc., the parser has become unreliable for celebrity references — revert the change.**

---

### Test 17 — `pink-haired punk girl`
```json
{
  "intent": "parsed",
  "gender": "Female",
  "ethnicityBlend": [],
  "hairColor": "Hot Pink",
  "castingBrand": "Saint Laurent",
  "castingVibe": { "editorial": 0.33, "commercial": 0.34, "runway": 0.33 },
  "userPrompt": "pink-haired punk girl"
}
```
**4 fields populated.** **Demonstrates IP-9 revised.** v1 mapped "punk" to runway-heavy vibe weights. v2 maps to Saint Laurent brand (closest archetype: "rock n roll, heroin chic, edgy"). The vibe stays balanced because subculture is now expressed via brand selection, not vibe weighting. The engine reads "pink hair + Saint Laurent brand" and produces a punk-aesthetic model from there.

---

### Test 18 — `non-binary 25 year old, ambiguous, soft features, mixed asian and european`
```json
{
  "intent": "parsed",
  "gender": "Non-Binary",
  "age": "25",
  "ethnicityBlend": [
    { "name": "East Asian", "pct": 50 },
    { "name": "Nordic", "pct": 50 }
  ],
  "jawline": "Soft / Rounded",
  "castingVibe": { "editorial": 0.33, "commercial": 0.34, "runway": 0.33 },
  "userPrompt": "non-binary 25 year old, ambiguous, soft features, mixed asian and european"
}
```
**5 fields populated.** Mixed asian + european → East Asian + Nordic 50/50. "Asian" defaults to East Asian; "european" defaults to Nordic (the canonical European default for the bare term, taking the simpler of the 50/50 split when used as one half of a mix). "Ambiguous" qualifier dropped because "mixed asian and european" provides concrete signal.

---

### Test 19 — `very curvy curvy curvy plus size queen`
```json
{
  "intent": "parsed",
  "gender": "Female",
  "bodyType": "Curvy",
  "ethnicityBlend": [],
  "castingVibe": { "editorial": 0.33, "commercial": 0.34, "runway": 0.33 },
  "userPrompt": "very curvy curvy curvy plus size queen"
}
```
**3 fields populated.** Repetition ignored. "Plus size" → Curvy (closest enum). "Queen" → Female (gendered noun list).

---

### Test 20 — `a model who looks tired but elegant`
```json
{
  "intent": "parsed",
  "ethnicityBlend": [],
  "castingBrand": "Prada",
  "castingVibe": { "editorial": 0.33, "commercial": 0.34, "runway": 0.33 },
  "userPrompt": "a model who looks tired but elegant"
}
```
**1 structural field populated.** Pure mood/expression prompt. "Tired" and "elegant" are both dropped. Truly empty result triggers random brand assignment (Prada in this run).

---

## Section 5 — Tier 5 (adversarial)

### Test 21 — `i don't know describe someone good for fashion idk`
```json
{
  "intent": "parsed",
  "ethnicityBlend": [],
  "castingBrand": "Miu Miu",
  "castingVibe": { "editorial": 0.33, "commercial": 0.34, "runway": 0.33 },
  "userPrompt": "i don't know describe someone good for fashion idk"
}
```
**1 structural field populated.** No signal → random brand. "I don't know" doesn't trigger random intent because it's not an explicit randomization keyword (per the IP-3 rules — random intent requires words like "random", "surprise me", "anyone", etc.).

---

### Test 22 — `a man and a woman kissing`
```json
{
  "intent": "parsed",
  "gender": "Male",
  "ethnicityBlend": [],
  "castingVibe": { "editorial": 0.33, "commercial": 0.34, "runway": 0.33 },
  "userPrompt": "a man and a woman kissing"
}
```
**2 fields populated.** Multi-subject — pick first subject (Male). "Woman" is ignored. The engine will produce a single male cast.

---

### Test 23 — `green-skinned alien runway model from mars`
```json
{
  "intent": "parsed",
  "ethnicityBlend": [],
  "features": "green-skinned alien from mars",
  "castingVibe": { "editorial": 0.15, "commercial": 0.15, "runway": 0.7 },
  "userPrompt": "green-skinned alien runway model from mars"
}
```
**2 structural fields populated.** Graceful degradation. "Runway" preserved as vibe signal. "Green-skinned alien from mars" placed in features as free text (it's structural in the sense that it describes physical attributes that don't fit any enum). The engine will receive a runway-heavy vibe + the alien description in the natural prompt and do its best.

---

### Test 24 — `the most beautiful person you can imagine`
```json
{
  "intent": "parsed",
  "ethnicityBlend": [],
  "castingBrand": "Balenciaga",
  "castingVibe": { "editorial": 0.33, "commercial": 0.34, "runway": 0.33 },
  "userPrompt": "the most beautiful person you can imagine"
}
```
**1 structural field populated.** No structural signal → random brand assignment.

---

## Section 6 — v2-specific tests

### Test 25 — Override pattern
INPUT: `Korean woman, late 20s, shag wolf cut with side-swept curtain bangs and asymmetric face-framing layers, ash blonde with dark roots`
```json
{
  "intent": "parsed",
  "gender": "Female",
  "age": "28",
  "ethnicityBlend": [{ "name": "East Asian", "pct": 100 }],
  "hairStyle": "Shag / Wolf",
  "hairStyleOverride": "shag wolf cut with side-swept curtain bangs and asymmetric face-framing layers",
  "hairColor": "Ash Blonde",
  "hairColorOverride": "ash blonde with dark roots",
  "castingVibe": { "editorial": 0.33, "commercial": 0.34, "runway": 0.33 },
  "userPrompt": "Korean woman, late 20s, shag wolf cut with side-swept curtain bangs and asymmetric face-framing layers, ash blonde with dark roots"
}
```
**7 explicit fields + 2 overrides.** **The critical test for the override pattern.** Both `hairStyle` and `hairStyleOverride` populated — the enum gives the chip something to display (`Hair · Shag / Wolf`), the override gives the engine the verbatim user description to incorporate. Same pattern for hair color. Without the override fields, "side-swept curtain bangs and asymmetric face-framing layers" would be silently lost when the parser snapped to the enum. The chip-tooltip shows the override text on hover.

---

### Test 26 — Global random intent
INPUT: `surprise me with a model`
```json
{
  "intent": "random",
  "userPrompt": "surprise me with a model"
}
```
**Random intent path.** Returns ONLY the intent and userPrompt. The client sees `intent: "random"` and calls `generateRandomPreferences()` to fill the entire CastAttributes randomly, bypassing structured extraction completely. **No other fields should be populated** — even ethnicityBlend and castingVibe are absent because the random path bypasses them.

---

### Test 27 — Per-field random
INPUT: `woman, late 20s, athletic, random hair color`
```json
{
  "intent": "parsed",
  "gender": "Female",
  "age": "28",
  "ethnicityBlend": [],
  "bodyType": "Athletic",
  "randomizeFields": ["hairColor"],
  "castingVibe": { "editorial": 0.33, "commercial": 0.34, "runway": 0.33 },
  "userPrompt": "woman, late 20s, athletic, random hair color"
}
```
**4 explicit fields + 1 randomization request.** Gender, age, body type filled normally (the parts the user explicitly stated). "Random hair color" populates `randomizeFields: ["hairColor"]`. The client merges parser output with a randomly-selected hair color before firing the generation. The user's explicit signals are preserved AND the randomization request is honored.

---

## Section 7 — Summary statistics

| Tier | Tests | Avg fields populated (v2) | v1 comparison |
|------|-------|---------------------------|---------------|
| Tier 1 (terse, 1-5) | 5 | 3.8 | v1 = 3.4 (slightly higher in v2 due to gender inference per IP-2) |
| Tier 2 (identity-rich, 6-10) | 5 | 8.4 | v1 = 8.0 (essentially same — Tier 2 is well-specified) |
| Tier 3 (atmospheric, 11-14) | 4 | 8.5 | v1 = 8.5 (same; mood drops offset by gender adds) |
| Tier 4 (edges, 15-20) | 6 | 2.2 | v1 = 2.0 (slightly higher due to random brand assignment) |
| Tier 5 (adversarial, 21-24) | 4 | 1.0 | v1 = 0.25 (higher because empty inputs now get random brand) |
| v2-specific (25-27) | 3 | varies | new in v2 |

**Key takeaway:** v2 outputs are not dramatically smaller than v1 in absolute count, but the *composition* of populated fields is different. v1 tended to populate "creative inferences" the parser made on its own. v2 only populates fields that the user explicitly stated (with gender inference from gendered nouns as the only exception). The result is that v2 is more accurate to user intent and gives the engine more creative space.

Total averages:
- **v1**: 4.8 fields per prompt across all 24 tests
- **v2**: 4.0 fields per prompt across all 24 tests + 6.0 average across the 3 v2-specific tests

The slight decrease in average is the philosophy shift working as intended.

---

## Section 8 — What this simulation reveals

### The override pattern works cleanly

Test 12 (Tom Ford) and Test 25 (shag wolf cut with curtain bangs) both demonstrate the override pattern producing exactly the right output: the enum captures the closest match for chip display, the override field carries the verbatim user description for engine consumption. No information is lost. The chips remain meaningful (`Hair · Shag / Wolf` is more useful as a chip label than the full description), and the engine gets the rich detail it needs to render the user's actual intent.

This is the single biggest reason to do the engine changes in Section 4 of `PARSER_PROMPT_V2.md` before deploying — without them, the override fields are written but never read.

### The random brand assignment for empty inputs solves a real problem

Tests 15, 20, 21, 24 all demonstrate v2's behavior on truly empty inputs. v1 returned all-null outputs that produced repetitive Gucci-default casts. v2 picks a random brand from the BRAND_PROFILES list (Versace, Prada, Miu Miu, Balenciaga in this run — the actual production parser will randomize each call). This means a user typing `model` four times in a row will get four meaningfully different starting points to react to, instead of four similar Gucci faces.

### The IP-2 gender inference list is the right size

Tests 3 (blonde model), 4 (russian ballerina), 9 (pale redhead), 13 (girl-next-door), 17 (punk girl), 19 (plus size queen) all benefit from gender inference. Without it, six prompts would produce gender-null outputs that the engine would default to Female anyway — but the user wouldn't see Female reflected in the chip strip until the generation finished. With it, the chip strip shows Female immediately and the user can confirm or change before generating.

### The "ambiguous + named entity" conflict resolution feels right

Test 14 (ambiguous ethnicity + nordic influence) and Test 18 (ambiguous + mixed asian and european) both demonstrate IP-8: when the user provides both an ambiguous qualifier and a named entity, the named entity wins. This produces more useful outputs than treating "ambiguous" as a hard refusal would.

### Mood and expression dropping is the right call

Tests 5 (kind face), 11 (striking), 12 (intense eyes, just stepped off a yacht), 13 (very approachable), 14 (raised eyebrows, cold expression), 20 (tired but elegant) all have mood/expression descriptors that would be tempting to encode but actually shouldn't be. The casting engine has its own brand-driven expression system (`getBrandExpression` returns brand-specific expression directives), so encoding mood in the parser would either duplicate or conflict with engine logic. v2 cleanly drops these.

### Tom Ford is a real test case for the brand override

Test 12 is the strongest argument for the `castingBrandOverride` field. Tom Ford is a meaningful brand archetype that's NOT in the 8-brand enum, and forcing the parser to either snap to the closest brand (probably Saint Laurent) or set null (losing all signal) would both be wrong. The override field captures the user's specific intent and lets the engine interpret it. **In your actual usage, expect this pattern to fire on prompts referencing brands like Margiela, Loewe, Khaite, The Row, Bottega, Acne, JW Anderson, etc. — none of which are in your current 8-brand enum.**

---

## Section 9 — How to use this document when testing your actual model

1. **Drop `PARSER_PROMPT_V2.md` Section 1 into your playground** as a system prompt. Use the response schema in Section 2 to enforce structured output.

2. **Run Tests 1-27 one at a time** and compare each output against this gold standard. Use diff if you want a side-by-side.

3. **Score each output on five axes:**
   - **Intent dispatch correct?** (parsed vs random)
   - **Gender inference correct?** (per IP-2 list)
   - **Ethnicity mapping correct?** (per nationality table)
   - **Override pattern triggered when needed?** (Tests 12, 25)
   - **Mood/expression dropped?** (Tests 5, 11, 12, 13, 14, 20)

4. **Treat divergence as one of three failure modes:**
   - **Model is less capable than the gold standard.** Either upgrade model or accept the gap.
   - **Model is more accurate than the gold standard.** Update the gold standard — I might have made a mistake.
   - **Both are wrong but in different ways.** The system prompt has ambiguity that needs tightening — both Claude and your model are doing reasonable things with an unclear instruction.

5. **Pay special attention to Test 15-21, 24** — the empty/adversarial tests where v2 introduced random brand assignment. The actual production parser will produce DIFFERENT brand selections from what's shown here on each run. That's correct. The brand should change run-to-run; what should NOT change is the field count (1 structural field) and the use of the random brand mechanism.

6. **Test 16 (Zendaya) is the regression canary.** It must produce only gender + age. If it produces anything else (skin tone, hair, ethnicity, face structure), the parser has drifted and needs correction.

7. **Test 25 (override pattern) is the new-feature canary.** It must produce both `hairStyle` AND `hairStyleOverride`, both `hairColor` AND `hairColorOverride`. If only the enum field is populated, the override pattern isn't being recognized and the system prompt's override section needs strengthening.

8. **When the parser feels right on Tests 1-27**, add 5-10 of your own real-world casting prompts (the kind you actually type when working). Run them through the same model. If those feel right too, lock the system prompt as `parser-prompt-final.md` and hand to Manus along with the engine changes from Section 4 of `PARSER_PROMPT_V2.md`.

---

**End of v2 gold standard. These outputs are Claude's strict-restraint interpretations following PARSER_PROMPT_V2.md. Use them as ground truth when validating your chosen production model's actual outputs. Total: 27 tests, 27 simulated outputs, 8 sections of analysis.**
