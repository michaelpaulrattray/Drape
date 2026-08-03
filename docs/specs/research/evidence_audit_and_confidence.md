# Evidence Audit and Confidence Assessment

**Research cut-off:** 3 August 2026  
**Author:** Manus AI

## Grading method

| Grade | Meaning | Permitted use |
|---|---|---|
| **A — Confirmed** | Current official API/product documentation, original peer-reviewed or primary research, or direct technical specification supports the factual claim | May be stated as a current documented capability, with date and scope |
| **B — Strong inference** | Multiple primary sources support the mechanism, but the recommendation or comparative conclusion is the analyst’s synthesis | State as a recommendation or likely implication, not a vendor fact |
| **C — Provisional** | Vendor marketing, API host announcement, practitioner report, or limited research suggests the conclusion without controlled validation | Use to identify a candidate for benchmarking; do not make a customer promise |
| **D — Unknown** | No reliable public evidence or evidence is contradictory, stale or materially incomplete | Treat as an explicit research gap and test before product use |

## Key conclusions and confidence

| Conclusion | Grade | Basis and qualification |
|---|---|---|
| Store separate, single-view source images rather than only one multi-angle sheet | **A/B** | Luma explicitly recommends one angle per image in its workflow and warns that multi-angle sheets can create artifacts; Kling and Runway accept separate views. The platform-wide rule is an analyst synthesis. |
| Maintain an eight-view canonical identity pack | **B** | The number is a platform design standard built from view-coverage requirements, not a universal vendor optimum. A three-view minimum and model-specific runtime subset remain necessary. |
| More reference slots do not necessarily mean better identity | **B** | Vendor limits vary from one to many inputs, while no reviewed controlled study establishes that filling every slot improves identity. Conflicting references plausibly increase ambiguity. Benchmark per model. |
| Separate identity, wardrobe, pose, expression, style, scene and voice controls | **A/B** | Modern methods and products expose separate attention paths, references, structure controls, face/body locks or performance inputs. The exact platform schema is a design recommendation. |
| Re-anchor every independent generation to the approved master or provider character asset | **B** | Models do not generally share cross-request memory; chained derivatives compound errors. This is a strong workflow inference that should be verified by the proposed ablation. |
| Fine-tuning can improve persistent subject binding but reduces portability and adds overfitting/deletion risk | **A/B** | DreamBooth/LoRA and identity-adapter research establish the mechanism; production superiority is model- and dataset-dependent. |
| Image and video need separate workflows | **A** | Video introduces frame-to-frame, motion, occlusion and re-identification failure modes; providers expose first/last frames, keyframes, character assets and performance transfer not present in ordinary still generation. |
| Face similarity alone is insufficient for character consistency | **A/B** | Face-consistency research covers only facial identity; VBench and the product requirements add temporal, body, wardrobe and prompt dimensions. The multi-axis scorecard is a system recommendation. |
| A universal cosine threshold is not defensible | **A** | Embedding scores depend on model, crop, image quality and population; NIST documents algorithm/application/data dependence and demographic differentials. Calibrate on the product distribution. |
| No current model supports an unconditional perfect-consistency guarantee | **A** | Reviewed vendor documentation describes controls and limitations, not universal deterministic identity preservation; some explicitly note imperfect detail or consistency. |
| Process-based customer claims are defensible when implemented and audited | **B** | Claims about reference use, testing, rejection and lineage can be objectively verified. Legal review remains required for wording and jurisdiction. |

## Resolved evidence conflicts

| Apparent conflict | Resolution |
|---|---|
| Some tutorials recommend a turnaround sheet; Luma advises one angle per image | Preserve individual images as canonical. Generate a contact sheet only as a disposable provider-specific derivative when a target model has one-image capacity and empirical tests show a benefit. |
| DreamBooth cites approximately 3–5 images; the proposed Standard pack has eight | DreamBooth’s count is a method-specific fine-tuning observation. The canonical pack serves multi-model routing, quality control and multiple shot classes; its runtime or training subset can be smaller. |
| Vendors advertise high maximum reference counts | Maximum accepted inputs are capacity limits, not evidence of an optimal operating point. Select references by marginal information gain and run reference-count ablations. |
| Strong identity weight can increase resemblance but reduce editability | Identity, pose, wardrobe and style compete for generation capacity. Calibrate provider-specific weights and use localized editing or separate controls instead of maximizing identity strength. |
| Clean background references versus contextual scene references | Use clean background images for the identity core; store contextual examples separately for scene/style conditioning. Do not blend the roles in the canonical identity asset. |
| Current default Midjourney version versus character workflow | Midjourney’s current default is V8.2, but official documentation says Omni Reference is V7-only and invoking it uses V7. The report therefore treats Midjourney as concepting or bounded still generation, not a default production identity engine. |
| OpenAI data controls appear uniform across its API | Endpoint treatment differs. Image endpoints are documented as eligible for Zero Data Retention, while the video endpoint is not and has distinct processing and abuse-monitoring retention. Evaluate at endpoint level. |
| Google Gemini API appears to have one data policy | Current terms distinguish unpaid and paid services. Production likenesses should use approved paid/enterprise configurations and the applicable data-processing terms. |

## Current platform capability facts retained after verification

| Platform | Verified fact | Confidence |
|---|---|---|
| Google Gemini image | Current docs publish distinct character and style reference capacities for Gemini 3.1 Flash Image and Gemini 3 Pro Image | **A** |
| Google Veo / Gemini video | Current docs provide image/video generation and reference or edit workflows; exact mode limits are model-specific | **A** |
| OpenAI GPT Image 2 | Current docs support one or more input images, high-fidelity input processing and iterative editing | **A** |
| OpenAI Sora 2/Pro | Current docs support first-frame images and reusable character assets, with substantial human-likeness restrictions and extension limitations | **A** |
| Midjourney | Current default is V8.2; Omni Reference accepts one image, supports weight 1–1000, and is V7-only; video uses start/end frames but not Omni Reference | **A** |
| Runway | Gen-4 image references accept up to three references; Gen-4.5, Act-Two and Aleph 2.0 provide complementary video generation, performance and edit routes | **A** |
| Luma Ray 3.2 | Source-video transformation supports up to 64 keyframes and separate face/body/pose/motion/structure controls | **A** |
| Kling | Reusable Elements use multi-view image or short video inputs; API exposes reusable element IDs and reference controls | **A** |
| MiniMax H3 | Current API documentation supports multimodal reference input, including multiple images, videos and audio items | **A** |
| FLUX.2 | Current BFL docs support indexed multi-image editing and publish separate API/playground reference limits | **A** |
| Adobe Firefly | Official API documentation separates structure and style controls; enterprise Custom Models require programme-specific review | **A/B** |
| Pika | Pika’s site shows version 2.5; its documented fal.ai API offering remains Model 2.2 with Pikascenes, up to five Pikaframes and single-image I2V. No reviewed official source establishes a persistent reusable character ID across independent shots | **A/C** |
| Open diffusion methods | DreamBooth, IP-Adapter, InstantID and PuLID establish fine-tuned and tuning-free subject-conditioning mechanisms | **A** |

## Open uncertainties and required validation

| Uncertainty | Required action before customer commitment |
|---|---|
| Optimal reference count, order and weighting per endpoint | Run the reference-count and ordering ablations in the test framework |
| Comparative visual quality of current vendor versions | Benchmark on the platform’s own consent-cleared cast and shot matrix; do not rely on marketing rankings |
| Persistence of undocumented or unversioned model aliases | Pin snapshots where offered and run canary tests on every observed change |
| Provider-side character-asset deletion and retention | Contract and API review; integration test deletion and acknowledgements |
| Human-likeness eligibility by geography and account tier | Legal and vendor-policy review in each launch market |
| Commercial licensing of open weights and face encoders | Model-by-model licence review, including dependencies and training data restrictions |
| Threshold fairness and failure rates across demographic and style slices | Calibrate and publish internal worst-slice performance with confidence intervals |
| Small details such as tattoos, jewellery and logos | Treat as explicit assertions and expect post-editing/compositing for contractual exactness |
| Voice identity consistency | Separate voice evaluation and consent workstream; do not infer from visual controls |
| Full cost and latency per accepted asset | Measure accepted-output economics, including retries, repairs and human review |

## Source-health audit

The draft set contains 53 reference definitions covering 37 unique URLs. All in-text citations have matching definitions, and every definition is cited. The NIST report link was corrected to its verified live official publication URL. Nine automated HTTP checks received access-control responses from live Zendesk-based official documentation pages, but those pages were independently extracted successfully during research and are retained as valid official sources; no unresolved reference returned a genuine not-found error. The machine-readable audit is supplied as `source_audit.csv` and `source_audit.json`.
