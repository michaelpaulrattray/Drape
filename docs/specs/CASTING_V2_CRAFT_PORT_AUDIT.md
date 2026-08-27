# Craft-port audit — V2 photoreal cohort constant vs. the legacy catalog

> **Status: dated record.** A measurement/evidence/court document from the date it states — it records what was true then; individual verdicts may since have been superseded. Current law: CLAUDE.md, the capability atlas, `DECISION_LOG.md` (#69 stamping sweep, 2026-08-28).


**Founder-directed, 2026-08-01.** Item 14 found that legacy's A5 eye protocol had
been compressed from six named sub-rules into a single line, losing the catchlight
count, the iris gradient direction and the pupil sizing rules. The founder's
question was the right one: *what else got compressed?*

This is the answer. Every item in catalog sections **A** (all 15), **B**
(reinforcement and anchor language), **C** (mixer whispers, priority hierarchy)
and **D** (curated vocabularies, including the iris descriptions) is placed in one
of three columns. **There is no fourth column and no silence.** An item that turned
out to be silently compressed was either restored or explicitly ruled out with a
reason.

Audited against: `server/castingV2/cohortPhotorealHuman.ts`,
`server/castingV2/interpreter.ts`, `server/castingV2/castingIntent.ts`.
Reference: `docs/specs/CASTING_V2_LEGACY_CRAFT_CATALOG.md`.

Per the craft-reference law this is an audit **against reference, not for verbatim
compliance** — V2 is allowed to solve a problem differently, and several items are
better solved here than in legacy. What it is not allowed to do is lose the
problem.

---

## Summary

Forty-eight catalog items: A1–A15, B1–B6, C1–C10, D1–D17. Every item has exactly
one verdict, so these sum to 48.

| Verdict | Items |
|---|---|
| Ported at full strength | 7 |
| Consciously adapted | 9 |
| Deliberately dropped | 16 |
| **Silently compressed — found and fixed by this audit** | **10** |
| **Silently absent — found and fixed by this audit** | **6** |
| | **48** |

*(The first version of this table read 21/12/9/11/4 and summed to 57. It was
written before the rows were finished and never reconciled against them — which,
in an audit whose entire subject is "is this whole?", is worth leaving on the
record rather than quietly correcting. Caught by Fable's skim. The row count is
44 rather than 48 because D9–D13 share one row.)*

The compressions and absences are the reason the audit was worth running. Three
of the absences are load-bearing: **B2** (ethnicity phenotype lock), **C5**
(in-prompt priority hierarchy) and **A13** (specificity over averageness). All
are now in the constant.

---

## A) Photorealism / skin / anti-AI-look

| Item | Verdict | Detail |
|---|---|---|
| **A1** studio directives | **Compressed → restored** | The structure ported (FRAMING/CAPTURE/REALISM/NEGATIVES, with an AUTHORITY paragraph stronger than legacy's "NON-NEGOTIABLE" header). But the operative half of the micro-contrast rule was cut: legacy explains what micro-contrast *produces* — "tactile, three-dimensional local contrast that makes surfaces feel physical". Without that sentence "high micro-contrast" reads as a quality adjective and is treated as one. Restored. |
| **A2** camera & sensor physics | **Compressed → restored** | Sensor class, focal length, aperture and grain character all ported. The **sensor ratio was dropped, and the framing block asserted 4:5 while every roll requests 1024×1536 — which is 2:3.** The prompt was describing a frame the image was never going to be, on the same milestone whose founder gate was clipped crowns. Both now say 2:3. |
| **A3** flash + skin-response deferral | **Compressed → restored** | The deferral sentence ported verbatim — and pointed at nothing. Legacy deferred to "the casting spec's skin finish", a field the user picked (A9); V2 has no such field, so the instruction had a dangling referent, which a model resolves by ignoring. The deferral is kept (the light block must not decide the sheen) and given a real referent: the subject's own age, condition and character description. |
| **A4** neutral grade + subsurface scattering | Ported at full strength | Plus two negatives legacy did not carry (no teal-orange, no cool clinical cast). |
| **A5** eyes macro protocol | **Compressed → restored** (item 14) | The finding that triggered this audit. Six sub-rules had become one line. Iris gradient direction, limbal ring, catchlight count and placement, corneal gloss, pupil sizing and sclera vascularity are each named again, plus a new ocular-symmetry clause legacy never had. |
| **A6** eyelashes | **Compressed → restored** | Headline kept, anti-uniformity half cut: varying length, slight curl variation, strands catching light individually, and the explicit ban on mascara-heavy uniformity. Restored. |
| **A7** lips | **Compressed → restored** | Plicae and moisture gradient kept; colour variation from the vermillion border inward and "topography, not a flat matte fill" cut. Restored. |
| **A8** eyebrows | **Compressed → restored** | Growth direction kept; natural gaps, overlapping strands and root-to-tip colour variation cut. Restored. |
| **A9** skin texture/finish matrix | **PARTLY RESTORED 2026-08-01** | The finish half is back, re-homed. Dropping the matrix was right — V2 has no form — but the *engineered prose* behind each value was the craft, and without it A3's deferral had nothing to defer to and every sheet came back with the same generic studio skin. Six finishes now carry their legacy-strength expansions (`FINISH_RENDER`), a stated finish in the brief expands like an idiom, and the archetype owns the sheet's default, chosen once per roll because a casting call is one lighting setup. The texture half of the matrix stays dropped, covered by the REALISM clamp and the structural-features enumeration below. |
| **A9** *(original ruling, retained for the record)* | Deliberately dropped | V2 has no texture or finish field — the user writes a brief, not a form. The five-by-four matrix has nothing to attach to. **Two consequences handled.** Its A3 dependency was dangling (above). And its deeper purpose — letting *deliberately bad* skin be ordered without the model fixing it — was only half covered: the anti-retouch clamp survives in the REALISM block, but the structural-features clause enumerated scars and freckling without naming skin conditions, and the broken-nose evidence shows a named-but-unenumerated feature loses to the prior every time. Active acne, acne scarring and weathered or sun-damaged skin are now named in that enumeration. |
| **A10** vellus disambiguation | **Compressed → restored** | Kept "NOT stubble, NOT pigmented"; dropped "NOT terminal hair, NOT dark". Both restored — the clause exists to stop peach fuzz rendering as a moustache shadow, and it needs all four negatives to do it. |
| **A11** age ↔ skin-texture reconciliation | Consciously adapted | Legacy silently downgraded a Mature texture below age 35. With no texture field there is nothing to downgrade, but the *problem* — a face whose skin contradicts its stated age — is solved better here: `describeAge` names exact years and then names the physiology that must not be present ("no nasolabial depth, no crow's feet"), in both directions. |
| **A12** universal negative list | Ported at full strength | Plus two additions this milestone's evidence demanded: no text of any kind, and no scene. |
| **A13** bold features / anti-sameface | **Absent → restored** | **Load-bearing.** V2 had nothing. Its answer to sameface was structural variation (cycling heritage, energy, look), which is a different mechanism and does not stop any individual face converging on the smooth attractive average. Ported in the only form a per-candidate prompt can honestly carry: two or three features beyond average, and an explicit ban on the conventionally attractive average face. **Limitation stated:** legacy's cross-cast clause ("two casts with the same brand and ethnicity should not produce similar feature sets") cannot port — each candidate is generated without sight of the other seven, so a cross-candidate instruction would be a promise the prompt cannot keep. |
| **A14** anti-mood-word / executability | **Compressed → restored** | Structurally superseded for most fields — closed vocabularies mean mood words cannot reach the image model. But `role` and `characterNotes` are free text that reach it directly, and nothing told the interpreter that the image model is literal. Restored in the interpreter prompt with legacy's worked contrast ("wide-set almond eyes with monolids" vs "editorially magnetic"). |
| **A15** raw-number leakage ban | **Compressed → restored** | `describeHeritage` correctly converts percentages to dominance language, and the file comment cites A15 for it — but the ban was never stated to the interpreter, so a number could still arrive inside `characterNotes` and be rendered as a text artefact. Now stated. |

## B) Identity consistency — reinforcement and anchor language

Scoped as the founder directed. B7–B15 are identity *gates and verification*
(chat memory, edit gates, view gates, wardrobe checks) rather than reinforcement
language; they belong to M7 and M12 and are untouched by this audit.

| Item | Verdict | Detail |
|---|---|---|
| **B1** `buildIdentityAnchor` | Consciously adapted — **scheduled M7** | The 12-field identity block exists to hold identity across *derived views*. V2 has no derived views until M7's package orchestrator, and M7 owes a view-conformance validator besides. Not a compression: there is nothing yet for it to anchor. |
| **B2** ethnicity phenotype lock | **Absent → restored** | **The audit's most consequential finding.** Legacy placed this FIRST in every generation prompt. V2 had *nothing*, while making heritage its primary diversity axis — so the failure mode it was most exposed to was the one it was least defended against. Restored as `IDENTITY_INTEGRITY`: heritage is defended as bone, named locus by locus, explicitly independent of hair colour, skin tone and styling, with legacy's own example (a platinum-blonde East Asian person still has East Asian bone structure). Mixed heritage must show both parents and must not resolve to a generic ambiguous face. |
| **B3** dominance bands (image model) | Consciously adapted | Legacy needed four bands across a continuous 0–100 blend. V2 only ever produces 100 or 60/40, so two bands cover the whole value space exactly. Adding two unreachable bands would be theatre. |
| **B4** `formatEthnicityBlend` (text-model twin) | Deliberately dropped | Legacy ran a spec-writing text model that needed its own differently-tuned bands. V2 has no spec-writing stage — the interpreter emits structured facts and the adapter composes. There is no second consumer to tune for. |
| **B5** CASTING OVERRIDES prefix | Consciously adapted | The mechanism defends *non-default* values against the image model's statistical priors. V2 has no eye/hair/facial-hair fields for it to guard, and the principle — a deliberate choice must assert itself as deliberate — is carried per-lock instead: age states "an absolute casting requirement, not an approximation" with corroborating negatives, build states "a deliberate casting choice", heritage is defended as bone by the restored B2, and `PRIORITY` adds the unusual-combination clause. **An earlier draft of this row claimed `validateLocks` supersedes B5. It does not, and the claim is exactly the failure this audit is about.** The validator compares the *resolved identity object* to the lock contract before any image exists, and under Path A the adapter composes from those locks — so it is a CI tripwire for adapter bugs, not a drift catcher. **Image-level regression to priors is unverified in V2 and stays unverified until M7's view-conformance gate.** |
| **B6** stale-reinforcement suppression | Deliberately dropped — **scheduled M12** | Solves an *edit* problem (an old value shouting while a new one is authorized). V2 has no identity edit path until M12. |

## C) Creative direction — whispers and priority

| Item | Verdict | Detail |
|---|---|---|
| **C1** `BRAND_PROFILES` (8) | Ported at full strength | All eight ported into `LOOKS` with thesis + anti-pattern + expression whisper intact, renamed descriptively — the archetype-library ruling forbids naming real houses. |
| **C2** default brand descriptor | Consciously adapted | Legacy fell back to a generic descriptor; V2's `resolveArchetype` always resolves to a named direction and records which, so a roll can say what it was cast under. Stronger, not weaker. |
| **C3** expression whisper | Ported at full strength | `LOOKS[].whisper`, and the founder's "presence, not performance" correction is the same craft arriving twice. On disposition sheets the whisper's role is played by the `ENERGIES` strings, which are written in the same register. |
| **C4** vibe intensity bands | Deliberately dropped | V2 has no editorial/commercial/runway sliders and no intensity concept. Nothing to amplify relative to. |
| **C5** signal priority hierarchy | **Absent → restored** | **Load-bearing, and the audit's sharpest lesson about reading code comments.** This file claimed C5 was ported "in four lines" because `resolveCandidateIdentity` fills only the gaps. That is *code* precedence — it decides what goes into the prompt and says nothing about how the image model resolves a conflict between two things both already in it. DIRECTION could pull a face off a stated heritage or build and nothing forbade it. Now stated in-prompt as a `PRIORITY` block, carrying legacy's worked example verbatim in substance: pale skin on a West African subject means a pale-skinned person *with* West African bone structure, not a different person. |
| **C6** brief block + archetype fidelity gate | Ported at full strength | The CASTING CATEGORY block carries the fidelity requirement ("keep the user's own words; never substitute a generic type"), and the interpreter carries legacy's self-check ("if the brief would produce the same casting after deleting this phrase, it is not specific enough"). |
| **C7** out-of-enum brand ride-along | Deliberately dropped — **scheduled** | `ARCHETYPES` is closed, so a house outside it has nowhere to land. The replacement is the archetype-composition path already queued: the interpreter composes a thesis and anti-pattern in the archetype grammar when no shelf entry fits. Named here so it is not mistaken for an oversight. |
| **C8** body-type headshot hint | **Absent → restored** | Build was reaching the prompt as a bare adjective ("a slim woman"), which a model is free to read as styling and ignore. Legacy translated it into named anatomy — neck, collarbones, tendons, trapezius. Restored as `BUILD_ANATOMY`, one line per build. V2's frame is waist-up rather than legacy's headshot, so this matters more here, not less. |
| **C9** physique directive | **Absent → restored** | Restored with C8, including legacy's operative clause: this is a deliberate casting choice, and do not default to a slim runway physique. |
| **C10** `qualityBaseline` layout | Consciously adapted | Legacy separated sections with `──` rules. V2 joins named blocks with newlines and closes with an authority paragraph legacy had no equivalent of. Formatting, not craft. |

## D) Curated vocabularies

The founder named the iris descriptions specifically, so the ruling on them is
stated first and the rest follow from the same reasoning.

| Item | Verdict | Detail |
|---|---|---|
| **D1** 15 engineered iris descriptions | **RESTORED 2026-08-01** | Was "deliberately dropped — partial port", on the reasoning that per-colour optical renders have nothing to attach to without an eye-colour field. The row also predicted the consequence: "with no direction at all, every candidate defaults to mid-brown". It did, in production, on most casts — the founder confirmed it. An accepted loss that turns out to be visible on every sheet is not a loss, it is a defect. Eye colour is now a realized per-candidate axis with a heritage-conditioned weighted palette, and the engineered renders are injected for the realized value, composing with A5. |
| **D2** natural-colour framing rule | **Absent → restored** | This row first read "folded into the same clause", and Fable's skim showed it was not. The colour clause resolves *whether* an unusual combination is allowed; D2's craft is *how it renders* — as this person's own born pigment, never as contact lenses, a visible dye job or a wig. Nothing said that, and the surrounding sentence leaned the wrong way: "follow plausibly from their heritage and age" is prior-reinforcing language that invites reconciling a stated mint eye back to brown. Both halves now stated, split on whether the description names a colour. |
| **D3** `SKIN_TONE_VALUES` + swatches | Deliberately dropped | A picker vocabulary for a UI V2 does not have. V2's user writes a sentence. |
| **D4** skin-tone P1 anti-stereotype clause | **Absent → restored** | The *rule* survives its field. "Do not default to the darkest or lightest shade for this heritage" is a statement about the model's priors, not about the picker, and it is restored in `IDENTITY_INTEGRITY` alongside B2 where it belongs. |
| **D5** `EYE_COLORS` + photographic presets | Deliberately dropped | Same reason as D3 — picker assets. |
| **D6** `CORE_FACE_SHAPES` + client "Random" | Deliberately dropped | No face-shape field; the enum-hygiene lesson (a UI convenience value must not leak into the engine contract) is already structural in V2, where the wire schema is the only contract. |
| **D7** `CHAR_OPTIONS` seven feature vocabularies | **PARTLY RESTORED 2026-08-01** | The architectural point stands: the brief carries features as prose and V2 has no form. But "no form" was doing double duty as "no assignment", and an axis nobody assigns collapses to the model default rather than varying. Four of the seven are now realized per candidate — facial hair, hair texture, brow character, skin character — as weighted conditioned vocabularies rather than pickers. The user still never sees a dropdown. |
| **D8** eyebrow style expansions | **RESTORED 2026-08-01** | Was dropped as "expansions for enum values V2 does not have" — true then, false once brow character became a realized axis. Both legacy expansions are ported for the values that need them: brushed-up renders laminated and glossy without "natural fluffy texture, individual hairs visible, not laminated", and bleached renders as painted white without its own. |
| **D9–D13** hair families, sub-axes, legality matrix, buzz suppression, colour split | **RESTORED 2026-08-01** | Dropped as "form-vocabulary and form-legality machinery", which mistook the picker for the craft. The realized hair axis varied over six coarse silhouettes, so eight candidates could all be "mid-length brown" and arrive as one haircut. D9's named cuts are ported as sex-, heritage- and age-conditioned weighted lists (`server/castingV2/hairStyles.ts`), composed with the texture axis from D7. D11's legality guarantee is kept and made structural: each entry is authored as an already-coherent length and, where the cut dictates it, texture, so "buzz cut, very long" is unsayable rather than rejected. D13's colour split is ported by widening the palette to colourist resolution — chestnut, copper, strawberry, ash and golden blonde, platinum where it occurs — because "auburn" had been carrying three colours. Two sheet-level taste rules ride on top (at most one statement cut, at least five distinct cuts), which legacy never had and which the founder set at the M5 gate. |
| **D14** weighted randomizer distribution | Ported at full strength (as principle) | The *lesson* is what ports, and it is cited at `weightedPick`: a casting pool uniform over rare options does not look like a casting pool. Applied to age and build weights. |
| **D15** full-cast randomizer | Consciously adapted | Superseded by per-candidate resolution from weighted vocabularies. Its 30% blend chance carries over verbatim in `varyHeritage`. |
| **D16** body-type values + brand gloss labels | Consciously adapted | `BUILDS` (6) ports one-for-one. The two-word brand gloss is a UI affordance for a chip row V2 is replacing with the brief echo. |
| **D17** `ETHNICITIES` (10) incl. Mediterranean | Ported at full strength | Ported and extended — British Isles and Western European were added because European briefs had the same nowhere-to-land problem Mediterranean was originally added to solve. |

---

## What this audit says about the process

Every one of the eleven compressions passed review. They passed because a
compressed clause reads as a *shorter version of the same rule*, and at review
time the question asked is "is this right?" rather than "is this whole?" — and it
is right, as far as it goes.

Three of the four absences are worse, because two of them were covered by comments
asserting they were present. The file said C5 was ported "in four lines" and it
was not; the header comment lists A5–A8 as adopted and three of the four were
half there. **A comment claiming a port is not evidence of one** — the same
failure this codebase already named once, when a comment described a keyword
fallback that had never been implemented.

The mechanical guard that follows from this: `COHORT_CONSTANT_MARKERS` now covers
every block, so a block cannot be dropped from the composed prompt without the
contract test failing. That catches deletion. It does not catch compression, and
nothing mechanical will — which is why the catalog exists and why this audit had
to be read rather than run.

**That paragraph was false when first written, in the exact way it warns about.**
The markers array omitted `SKIN_AND_FEATURES` — the most craft-dense block in the
file, holding A1, A5–A10 and the structural-features clause. The one block the
guard did not cover was the block the audit was triggered by, and the audit
declared the guard working anyway. Fable's skim caught it; the array now covers
all seven blocks. Left on the record because an audit that quietly corrects its
own false claim has learned nothing from finding everyone else's.
