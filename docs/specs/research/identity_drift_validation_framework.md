# Identity-Drift Testing and Validation Framework

**Status:** Final supporting technical specification  
**Research date:** 3 August 2026  
**Author:** Manus AI

## Executive decision

The platform should not measure “character consistency” with one face-similarity score. A face embedding cannot reliably verify body proportions, hair, wardrobe, tattoos, accessories, scene continuity or temporal stability, and a high average can hide a catastrophic identity swap in one frame. The release system should therefore use a **multi-axis scorecard with hard-failure gates**, calibrated against human judgments on the platform’s own characters and generation conditions.

Face Consistency Benchmark evaluates both reference-to-frame similarity and random frame-pair consistency using facial embeddings, while VBench separates video generation into dimensions such as subject identity, motion smoothness and temporal flicker.[1] [2] ArcFace and AdaFace provide useful face embeddings, with AdaFace specifically addressing quality variation.[3] [4] These are foundations, not ready-made product thresholds. NIST has documented algorithm- and application-dependent demographic differentials in face recognition, reinforcing the need to validate the selected embeddings and thresholds across the platform’s actual character distribution and image quality.[5] [6]

> **Recommended release principle:** a model version passes only when it meets all hard safety and identity gates, its lower-confidence-bound performance is not materially worse than the incumbent, and no tested demographic, visual-style or character-type slice falls below the approved floor.

## 1. Evaluation objects and terminology

The unit of evaluation is not merely a generated file. Every test result is tied to a versioned tuple:

`character_version × wardrobe_version × request_template × provider × model_version × model_parameters × reference_subset × seed/run × output`

**Reference fidelity** means similarity between the output and the approved master identity package. **Temporal consistency** means stability within one video. **Cross-shot consistency** means stability between independently generated shots. **Attribute fidelity** means preservation of locked hair, body, wardrobe, markings or accessories. **Prompt adherence** means successful execution of requested mutable changes. The framework keeps these quantities separate so a system is not rewarded for preserving identity by ignoring the pose, outfit or scene instruction.

## 2. Metric scorecard

| Dimension | Automatic measure | Human measure | Hard-fail examples |
|---|---|---|---|
| Face identity | Ensemble cosine similarity using at least two face-embedding families; reference-to-frame and pairwise frame comparisons | “Same character?” rating and forced-choice identification | Wrong face, identity swap, merged identities |
| Face acquisition | Face detection rate, landmark confidence, face crop size and quality | Face is visible enough for the intended shot | Missing or unrecognizable face in a face-required shot |
| Global subject identity | DINO- or comparable self-supervised visual similarity on segmented subject crops; CLIP-I as secondary | Overall resemblance independent of pose/style | Different species, silhouette or defining form |
| Body consistency | Keypoint- and segmentation-derived ratios; silhouette embedding; height/shoulder/hip/limb stability when visible | Body build and proportions rating | Material change to locked body type |
| Hair | Segmented hair shape, colour and texture descriptors | Hairstyle consistency rating | Wrong colour, length, parting or rear shape when locked |
| Wardrobe | Garment crop embedding, segmentation, dominant colour and pattern similarity to `wardrobe_id` | Outfit match and garment-detail rating | Wrong outfit, missing garment, cross-character wardrobe bleed |
| Accessories/markings | Object or region detectors; OCR/logo checks; tattoo/marking template or keypoint-relative region comparison | Per-item present/correct checklist | Missing mandatory glasses, prosthetic, tattoo or branded item |
| Pose/expression adherence | Pose-keypoint distance; gaze/expression classification; driving-performance alignment | Requested pose and expression rating | Identity preserved only by ignoring the requested action |
| Prompt/scene adherence | CLIP-T or vision-language rubric; structured object and camera checks | Instruction-fulfilment rating | Wrong number of characters, wrong scene or forbidden content |
| Temporal stability | Reference-to-frame distribution, pairwise embedding continuity, optical-flow warping error, flicker and landmark jitter | Visible morphing, flicker and continuity rating | Any identity swap, severe face melt or unrecoverable drift |
| Cross-shot continuity | Output-to-master and approved-shot-to-shot metrics | Blind sequence-level continuity rating | Character appears to become a different person between shots |
| Technical quality | Blur, exposure, compression, anatomy, frame corruption, audio/video sync | Artifact severity | Broken frames, unsafe output, unusable anatomy |

Automatic metrics should produce a **vector**, not one unqualified number. If the business requires a headline index for dashboards, learn its weights from blinded human pairwise preferences or a calibrated ordinal model; do not invent fixed weights in advance.

## 3. Face identity protocol

### 3.1 Reference representation

Compute normalized embeddings for each approved face view and retain the embedding-model version. Build both a pack centroid and view-specific references. For an output face `f_t`, calculate:

1. `S_centroid(t) = cosine(f_t, centroid(reference_embeddings))`;
2. `S_view(t) = cosine(f_t, nearest_valid_view_reference)`;
3. `S_top2(t) = median(top_two cosine similarities to valid references)`.

The view-specific score reduces unfair penalties when a profile output is compared only with a frontal image; the centroid reduces sensitivity to one unusually flattering or poor reference; and the top-two score makes it harder for one lucky reference match to conceal drift. The system should not use the maximum similarity alone as its acceptance score.

For each image, report the ensemble score, embedding disagreement and face quality. For each video, report the median, 10th percentile, minimum, longest below-threshold run, and the exact timestamps of low scores. Face Consistency Benchmark demonstrates why both master-reference and within-video comparisons matter: the former measures fidelity, while the latter measures temporal coherence.[1]

### 3.2 Multi-character assignment

For a frame with multiple faces, create a similarity matrix between detected faces and expected character references, then use constrained bipartite assignment. Record identity swaps when the optimal assignment changes without a narrative reason or when two output faces both match the same character. Do not accept a frame on the basis of the best face alone.

### 3.3 Non-human and stylized characters

Face-recognition embeddings may fail on non-human, highly stylized or heavily occluded characters. For those subjects, switch the primary metric to a global or part-aware subject representation, including segmented silhouette, DINO-like embeddings, colour/pattern descriptors and manually defined landmarks. Maintain separate thresholds by **metric applicability class**—human face, stylized humanoid, animal, creature, object/mascot—rather than pretending one face model covers all characters.

## 4. Body, wardrobe and critical-detail protocol

Body comparison should use normalized ratios only when the relevant keypoints are visible. Track shoulder-to-height, hip-to-height, torso-to-leg, head-to-body and limb ratios, plus silhouette similarity. Pose differences must be factored out; a crouching character should not be penalized as a shorter character.

Wardrobe evaluation begins with segmentation or region extraction. Compare the output garment only with the active `wardrobe_id`, never with the immutable identity pack. Measure garment embedding, dominant and accent colours, pattern frequency and required detail presence. A character wearing the correct face but the wrong approved outfit fails a wardrobe-locked request.

Critical features should be registered as explicit assertions rather than left to a general similarity model. Examples include `glasses_present=true`, `tattoo_region=left_forearm`, `logo_text=ACME`, `prosthetic_side=right`, `earring_count=2`, or `eye_colour=green`. Each assertion has its own visibility condition and test. If the feature is not visible because the requested framing excludes it, the result is `not_observable`, not a failure or success.

## 5. Video temporal protocol

Sample video frames using both a fixed interval and event-driven points. Event-driven sampling should include the first and last usable frames, cuts, shot changes, large yaw/pitch transitions, expression peaks, occlusion entry and exit, reappearance after leaving frame, lighting transitions and frames with minimum face-detection confidence.

For every track, calculate:

| Metric | Definition | Interpretation |
|---|---|---|
| Reference fidelity distribution | Similarity of each frame to the master pack | Does the clip preserve the approved identity? |
| Pairwise local continuity | Similarity between nearby visible frames | Detects sudden morphs and flicker |
| Pairwise long-range continuity | Similarity between distant frames in the same shot | Detects gradual drift |
| Face dropout rate | Proportion of face-required frames without a valid face | Reveals turns, occlusion or degeneration |
| Identity-switch count | Assignment changes among expected characters | Any unexplained switch is severe |
| Landmark jitter | High-frequency facial landmark movement after motion compensation | Detects unstable facial geometry |
| Silhouette/body jitter | Frame-to-frame body-shape instability after pose normalization | Detects build and limb morphing |
| Wardrobe persistence | Garment/critical-detail checks over visible frames | Detects fabric, logo and accessory drift |
| Worst contiguous failure | Longest consecutive below-floor interval | Prevents an acceptable average from hiding a bad segment |

A clip must fail if any unapproved identity swap occurs, even when the mean identity score is high. The platform should retain machine-generated timestamp annotations so reviewers can jump directly to suspicious frames.

## 6. Test scenario matrix

The benchmark should include ordinary and adversarial conditions. The same prompt and reference package should be rendered across candidate models wherever their capabilities permit.

| Scenario family | Required cases | Primary risk tested |
|---|---|---|
| Baseline views | Front close-up, three-quarter, profile, full-body front, full-body rear | Basic geometry coverage |
| Camera and pose | Low/high angle, overhead, crouch, seated, running, hands near face, partial crop | View and body generalization |
| Expression | Neutral, smile, speech, surprise/anger, eyes closed, teeth visible | Identity–expression trade-off |
| Lighting | Soft studio, hard side light, backlight, low light, coloured light, mixed temperature | Skin tone and face-geometry stability |
| Environment | Plain, interior, exterior, crowded, reflective surfaces, complex background | Background and feature contamination |
| Wardrobe | Baseline outfit, new approved outfit, similar-colour competing outfit, patterned fabric | Outfit bleed and identity separation |
| Accessories | Add/remove glasses, hat, jewellery, tattoo visibility, prop handoff | Fine-detail persistence and editability |
| Style | Photoreal, illustration, anime, clay/3D, monochrome, high stylization | Identity–style competition |
| Multi-character | Dissimilar pair, similar-looking pair, crossing positions, occlusion, conversation, embrace | Identity bleed and swaps |
| Video motion | Static dialogue, head turn, walk, fast action, spin, exit/re-enter, camera orbit | Temporal drift and re-identification |
| Editing | Background-only edit, wardrobe-only edit, colour change, object removal, extension | Unintended identity changes during edits |
| Adversarial inputs | Contradictory references, duplicate views, low resolution, compression, collage, wrong aspect | Input-quality and orchestration robustness |

### 6.1 Benchmark tiers

| Tier | Purpose | Suggested workload per character/model | Use |
|---|---|---|---|
| Smoke | Detect obvious regressions | 8 still scenarios × 2 runs; 4 short video scenarios × 2 runs | Every deployment and provider configuration change |
| Release | Validate production readiness | 36 still scenarios × 4 runs; 16 video scenarios × 3 runs | New model or major version approval |
| Migration | Compare incumbent and candidate deeply | Release tier plus multi-character, style and reference-ablation sweeps | Default-model change |
| Incident | Reproduce a reported failure | Exact lineage replay plus neighbouring conditions | Root-cause analysis and corrective test addition |

These counts are starting points. After the pilot, use observed variance and desired confidence intervals to determine the final sample size. Do not reduce the benchmark to one character or one seed; stochastic variance is part of the product risk.

## 7. Benchmark cast design

Maintain a consent-cleared internal benchmark containing multiple character classes. A practical starting cast is 24 human or human-like identities, eight stylized/non-human identities, and four pairs of deliberately similar-looking characters for collision testing. Stratify human-like identities across skin tone, age presentation, gender expression, facial shape, facial hair, hairstyle, glasses, makeup, body build and visible disability or prosthetic characteristics where representation and consent permit.

Report results per character and per slice in addition to the aggregate. NIST found that face-recognition performance depends on the algorithm, application and data, with demographic differentials in the majority of algorithms it studied.[5] NIST also notes that image capture and under-exposure can contribute to false non-matches for some groups.[6] The platform should therefore use a single globally governed acceptance policy while examining worst-slice performance and capture quality; it should not secretly apply weaker identity standards to harder demographic groups.

## 8. Threshold calibration

### 8.1 Build labelled calibration data

Create human-labelled positive and negative pairs under the same conditions as the product. Positives include approved source–output and output–output pairs of the same character across views and styles. Negatives must include near-neighbour characters, not only obviously different people. For non-human characters, include same-species and similarly coloured negatives.

At least three trained reviewers should label borderline samples independently. Use identity labels, attribute checklists and a five-point fidelity rubric. Resolve disagreement through adjudication and retain both the final label and disagreement rate.

### 8.2 Fit operating points

For each applicable metric family, estimate ROC and precision–recall curves, confidence intervals and calibration error. Select a hard identity floor that prioritizes precision—wrong identities must rarely pass—and a review band above that floor where automation is uncertain. Evaluate one global threshold across demographic and visual slices; if one slice has materially poorer recall, improve references, capture, model selection or metric choice rather than silently lowering the bar.

Thresholds must be versioned by embedding model and applicability class. A change from ArcFace to AdaFace, a new cropper, a new face detector or a model update requires recalibration. Raw cosine values from different embedding systems are not comparable.

## 9. Provisional release gates

The following gates are intentionally expressed as calibrated or incumbent-relative criteria rather than unsupported universal cosine cutoffs.

| Gate | Release requirement |
|---|---|
| Wrong identity / identity swap | Zero accepted incidents in the release suite; any incident blocks release pending investigation |
| Reference fidelity | Lower 95% confidence bound meets the calibrated production floor and is not worse than the incumbent beyond the approved non-inferiority margin |
| Worst-case frames | 10th percentile and longest-failure-run metrics meet their floors; average score alone cannot pass |
| Face acquisition | Meets the shot-specific visibility floor; face-required failures enter review or rejection |
| Body and locked attributes | All hard assertions pass when observable; no material body-type change |
| Prompt adherence | Meets calibrated task floor so identity is not preserved by ignoring the requested change |
| Human review | Median identity rating at least 4/5 for production candidates, with no adjudicated “different character” result |
| Slice performance | Every approved demographic, style and character-type slice meets its minimum floor; uncertainty is reported |
| Safety and consent | 100% valid consent/eligibility, moderation and provenance records |
| Reproducibility | Full request and asset lineage recorded; provider response can be traced to a model/configuration version |

The initial 4/5 human-review target is a product proposal and should be validated against user expectations. Automatic thresholds must be learned from the labelled calibration set.

## 10. Human evaluation rubric

Reviewers should see the master reference pack, the generation request and the output, but should be blinded to provider and model. They score:

| Score | Identity anchor |
|---|---|
| 5 | Unambiguously the same character; locked face/body/hair details are preserved; no meaningful drift |
| 4 | Clearly the same character with small non-critical variation |
| 3 | Probably the same character, but one or more noticeable identity cues have drifted; review required |
| 2 | Weak resemblance; likely a different interpretation or identity |
| 1 | Clearly a different character or a severe identity failure |

Reviewers separately rate body, hair, wardrobe, accessories, prompt adherence, temporal stability and artifacts. They should not collapse “beautiful image” into “same identity.” Pairwise A/B preference is preferable for model migration because humans are more consistent when comparing two outputs than assigning absolute scores.

## 11. Reference and control ablation tests

Every candidate model should be tested with controlled ablations:

1. one hero image versus two, three, four and the maximum coherent references;
2. separate images versus a generated contact sheet where supported;
3. front-only versus front + three-quarter versus front + three-quarter + profile/full-body;
4. plain versus environmental backgrounds;
5. PNG versus high-quality JPEG at matched visual quality;
6. identity-only versus identity + wardrobe + style;
7. low, default and high provider-specific identity weight;
8. native character ID versus raw images;
9. tuning-free adapter versus LoRA/fine-tune;
10. master re-anchoring versus chained derivative references.

Use paired prompts and the same seeds where the provider makes seeds meaningful. The experiment should report marginal gain, cost, latency and failure rate. The “optimal number of references” should be selected per model from this ablation, not copied from a vendor’s maximum input count.

## 12. Production monitoring

Run automatic scoring on every generation and persist the score vector, model version, reference subset and rejection reason. Monitor identity score distributions, automatic rejection rate, human override rate, regeneration count, repair rate, latency, cost per accepted output, provider moderation failure, and drift incidents per thousand accepted assets.

Use rolling canary tests for every provider release. If the provider changes a model behind an unversioned alias, automatically route a percentage of internal benchmark traffic to the new behaviour and compare it against the pinned or previous baseline. Alert on distribution shift, not only mean decline. A small group of severe failures can be more important than an average improvement.

Customer-reported failures should enter a closed loop: freeze lineage, reproduce, classify the failure, add the case to the incident benchmark, adjust routing or references, and re-test before closing. Never overwrite or delete the evidence needed to understand an identity incident.

## 13. Reporting template

Each benchmark report should contain the model/API version, research date, asset-package version, number of characters, scenarios, outputs and videos; automatic metrics with 95% bootstrap confidence intervals; human review agreement; per-slice results; hard-failure counts; latency and cost per accepted asset; known capability gaps; and a clear release, restricted-release or reject decision.

## References

[1]: https://arxiv.org/html/2505.11425v1 "Podstawski et al. — Face Consistency Benchmark for GenAI Video"
[2]: https://vchitect.github.io/VBench-project/ "Huang et al. — VBench and VBench++"
[3]: https://arxiv.org/abs/1801.07698 "Deng et al. — ArcFace"
[4]: https://arxiv.org/abs/2204.00964 "Kim et al. — AdaFace"
[5]: https://www.nist.gov/news-events/news/2019/12/nist-study-evaluates-effects-race-age-sex-face-recognition-software "NIST — Demographic Effects in Face Recognition"
[6]: https://pages.nist.gov/frvt/reports/demographics/nistir_8429.pdf "NISTIR 8429 — Summarizing Demographic Differentials"
