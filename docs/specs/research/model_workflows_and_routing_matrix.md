# Character-Consistent Generation Workflows and Model Matrix

**Status:** Final supporting technical specification  
**Research date:** 3 August 2026  
**Author:** Manus AI

## Executive recommendation

A SaaS product should implement **one canonical identity system and multiple model-specific execution adapters**. It should never equate a vendor’s reference slot with the platform’s character record. The canonical character package remains provider-independent; each generation request compiles that package into the smallest coherent set of identity, wardrobe, pose, expression, style, and scene controls supported by the selected model.

The most reliable production strategy is **hierarchical**. First, use native multi-reference or reusable character controls for immediate generation. Second, use edit and keyframe workflows to preserve accepted pixels and motion rather than repeatedly generating from scratch. Third, add a version-pinned LoRA or comparable subject adapter for characters that repeatedly miss calibrated identity thresholds. DreamBooth showed that a subject could be bound from approximately three to five images through per-subject fine-tuning, while tuning-free systems such as IP-Adapter, InstantID and PuLID trade training cost for faster conditioning and varying degrees of editability.[1] [2] [3] [4]

> **Core operating rule:** every retry and every new shot re-anchors to the approved master references or registered character asset. A generated derivative may become an approved shot reference, but it must never silently replace the master identity source.

## 1. How models interpret the character

Current systems do not contain a single universal “identity” channel. They combine signals at different abstraction levels. Face-recognition embeddings emphasize facial geometry; general image encoders capture broader appearance, including hair, clothing, background and style; textual prompts describe semantic attributes; ControlNet-like inputs constrain pose, depth or edges; reusable character IDs and fine-tuned weights encode provider-specific representations; and video systems additionally infer motion, temporal correspondence and scene structure.[2] [3] [4] [5]

This architecture explains why stronger identity conditioning can reduce editability. PuLID’s primary research motivation is that identity insertion can disrupt the base model’s composition, lighting, background, style and prompt-following behaviour; its contrastive alignment is intended to retain identity while minimizing that contamination.[4] The same practical competition appears in vendor interfaces: Midjourney warns that stylization and Omni Reference weight compete, Runway recommends separate iterative reference paths, and Luma exposes independent face, body, pose and structure locks.[6] [7] [8]

| Character property | Typical model signal | Primary failure mode | Recommended control |
|---|---|---|---|
| Facial identity | Face embedding, facial landmarks, identity adapter, character ID | Genericized or blended face; age/ethnicity shift; profile collapse | Front plus three-quarter/profile references; face-specific adapter or registered ID |
| Body proportions | Global image features, silhouette, pose/depth conditioning | Height, build, shoulder/hip or limb drift | Full-body multi-view references plus body/structure lock |
| Hairstyle | Global appearance and text semantics | Length, colour, parting or rear shape changes | Separate hair metadata; include rear/side view; repeat short locked description |
| Wardrobe | Global image features and prompt tokens | Previous outfit bleeds into new outfit; logos/patterns mutate | Separate `wardrobe_id`; outfit references; masks/editing for localized change |
| Accessories/markings | Fine local texture and text | Freckles, jewellery, tattoo, logo or prop disappears | Detail references, explicit verification target, post-edit when exactness matters |
| Pose/gaze | Spatial landmarks, pose/depth maps, first frame or source video | Identity distorted to satisfy pose; hands/body deform | Separate pose input, matching-angle identity reference, lower motion complexity |
| Expression | Facial landmarks, performance video, prompt | Expression overwrites identity geometry or creates artifacts | Expression reference or driving performance; moderate expressiveness |
| Style/lighting | Style image, prompt, global visual features | Style conditioning changes face geometry or skin tone | Separate style control; calibrate identity/style weights; use approved still editing |
| Temporal identity | Frame-to-frame attention, source video, keyframes, character assets | Cumulative drift, flicker, identity swaps after occlusion | Short shots, first/last/keyframes, registered character, frame-level QC |

## 2. Image-generation workflow

### 2.1 Stage A — compile the request

The request compiler loads the approved character version, verifies consent and provider eligibility, classifies the desired framing and angle, and selects the target `wardrobe_id`, `expression_id`, `pose_id`, `style_id`, and `environment_id`. It then chooses the identity mechanism in the following order:

| Priority | Mechanism | When to use | Principal trade-off |
|---|---|---|---|
| 1 | Native reusable character/element ID | Provider offers a persistent, reusable asset and the subject is eligible | Strong provider lock-in; asset may not be portable or available for human likeness |
| 2 | Native multi-reference generation/editing | Immediate generation, broad provider support, no training delay | Maximum slot count is not optimal count; reference fusion may be undocumented |
| 3 | Tuning-free identity adapter | Self-hosted stack or API supports PuLID, InstantID, IP-Adapter FaceID or equivalent | Identity weight can reduce style/prompt editability; licensing requires review |
| 4 | Version-pinned LoRA or DreamBooth-style fine-tune | High-value persistent character repeatedly fails zero-shot quality gates | Training cost, overfitting, base-model coupling, deletion/retraining obligations |
| 5 | Localized post-edit or identity repair | One region drifts after otherwise acceptable composition | May create seams or temporal mismatch; must be transparently logged |

### 2.2 Stage B — select references by shot

For a frontal close-up, select the frontal and matching three-quarter face views. For a profile, use profile, nearest three-quarter and frontal views. For a full-body scene, prioritize body front, body three-quarter and side, then add a face close-up if capacity permits. Do not fill unused slots with weak or contradictory images. When the target model allows only one identity reference, submit a purpose-built hero image that matches the requested shot rather than a generic collage.

The compiler should identify each reference by role where the API permits it. FLUX.2 supports indexed image references in prompts; current Gemini image models distinguish capacities for characters, objects and styles; Kling uses reusable element IDs; and Runway supports named references in its interface.[5] [7] [9] [10]

### 2.3 Stage C — compose independent conditioning blocks

The prompt payload should include a short immutable identity block, a mutable wardrobe block, the requested pose/action, camera and scene instructions, then style and lighting. The identity block should not become an exhaustive prose description of features already visible in the reference images; longer descriptions create opportunities for contradiction. For FLUX.2, place the identity subject and key action early because its official guide says word order matters and it does not support negative prompts.[11]

When weights are available, the system should begin from a provider-specific calibrated default rather than expose raw values as a universal “identity strength.” Midjourney’s Omni Reference weight spans 1–1000 and warns that values above 400 may be unpredictable in ordinary conditions; Adobe’s structure-reference strength spans 1–100; Kling exposes face-reference intensity on certain models; and Luma’s source adherence uses independent 1–9 motion and structure controls.[6] [8] [10] [12] These scales are not interchangeable.

### 2.4 Stage D — generate, score and approve

Generate multiple candidates from the same compiled request. Score every candidate against the selected identity references, prompt, pose, wardrobe and critical-detail targets. Reject candidates with a missing face, wrong character count, identity collision, unapproved wardrobe, or unsafe content before human presentation. The best candidates enter visual review; an accepted image is stored as an approved output with complete lineage, but the original character pack remains the source of truth.

If a candidate is close, perform a localized edit rather than regenerate the entire composition. OpenAI’s Responses API supports multi-turn image editing, Runway encourages element-by-element iteration, Adobe separates structure and style references, and FLUX.2 supports multi-reference editing.[7] [9] [12] [13] Each edit must re-submit or retain the master identity references whenever the endpoint permits it.

### 2.5 Stage E — escalate persistent failures

If a character fails a predefined cross-angle or cross-style test suite after a reasonable number of zero-shot attempts, route it to fine-tuning. The training set should be curated from approved, diverse, non-duplicate views and should exclude backgrounds, poses or wardrobe that the model must not bind to identity. Fine-tuning must be version-pinned to the exact base model. A new base-model release requires regression testing and usually new or adapted weights; “the same LoRA” should not be assumed portable across model families.

## 3. Video-generation workflow

Video requires the image workflow **plus temporal control**. A model can match the opening frame and still drift after a head turn, occlusion, cut, rapid movement or lighting transition. Separate generations generally do not share memory unless the platform re-submits a character asset, references or prior video.

### 3.1 Stage A — create an approved hero frame

Before generating motion, create or select an identity-approved still that matches the planned first shot. This hero frame should already pass face, body, wardrobe, accessory and composition checks. Image-to-video from an approved frame is usually more controllable than unconstrained text-to-video because it fixes the initial appearance and composition. Sora, Midjourney Video, Veo, Runway and MiniMax all provide first-frame or image-to-video modes, although their character controls differ.[5] [14] [15] [16] [17]

### 3.2 Stage B — choose the correct video mode

| Video mode | Best use | Identity strategy |
|---|---|---|
| Reusable character-to-video | Repeated non-human mascots or supported character assets | Provider character ID plus matching name/prompt and optional first frame |
| Reference-to-video | New scenes with one or more known subjects | Submit model-approved identity views or reusable elements every call |
| Image-to-video | Animate an approved still | Hero frame carries identity; keep early motion modest; use endpoint-specific aspect match |
| First-and-last-frame | Controlled transition or turn | Both anchors must depict the same approved character and wardrobe |
| Performance transfer | Dialogue, acting and gesture | Character image/video supplies appearance; driving video supplies expression/motion |
| Video-to-video transform | Preserve timing, camera and physical performance | Source video plus face/body locks and edited keyframes |
| Extension | Continue a good shot | Prefer extension when it preserves context; confirm whether character assets remain supported |
| Keyframe-guided editing | Repair or art-direct specific moments | Insert identity-approved frames at drift-prone timestamps |

### 3.3 Stage C — shot planning and duration

The default product workflow should generate **short, single-beat shots**, usually 3–8 seconds, then edit them into a sequence. This is a platform risk-control recommendation rather than a vendor limit. Longer clips, rapid rotations, occlusions, crowds, outfit transformations and high-motion camera moves increase the number of opportunities for identity drift. Midjourney explicitly warns that high motion may be unrealistic or glitchy, and Runway notes that higher facial expressiveness can increase artifacts.[15] [18]

Use a separate continuity record for every shot: character version, wardrobe, hair, makeup, props, scene time, camera, lighting direction, reference subset, model version, provider asset IDs, seed where meaningful, and previous approved ending frame. For a multi-shot scene, generate the hero stills first, approve them as a set, and then animate. Do not ask a video model to discover the cast design and the performance simultaneously when identity is contractual.

### 3.4 Stage D — bind identity and motion separately

For dialogue and performance transfer, keep the character appearance input and the driving performance separate. Runway Act-Two accepts a performance video plus a character image or video; a character image enables gesture transfer, while a character video preserves the source camera and body motion and transfers primarily facial motion and expression.[18] Luma Ray 3.2 starts from an existing source video, allows up to 64 keyframes and provides independent controls for faces, bodies, motion, structure, poses and blocking.[8]

For multi-character scenes, use models with explicit per-character elements or generate subjects separately and composite when exact identity matters. Similar-looking characters, overlapping bodies and face-size changes make identity swaps more likely. Kling’s Element Library supports multiple reusable elements, but the platform must maintain a mapping between prompt labels, screen positions and element IDs.[10]

### 3.5 Stage E — frame-level validation and repair

Sample the generated clip at the beginning, end, every cut, every major yaw or expression change, every occlusion boundary, and a fixed temporal interval. Measure reference-to-frame identity, pairwise temporal consistency, face detectability, body and wardrobe consistency, and critical accessory persistence. A clip with a good average but one severe identity swap must fail.

Repair the smallest possible scope. First try a provider edit, keyframe, inpainting or localized video-to-video pass. If that fails, regenerate the affected shot from the master references and an approved neighbouring frame. Never repeatedly extend from a drifting endpoint, because the drift becomes the next segment’s conditioning context.

## 4. Model-specific recommendations: image systems

The following matrix describes **control surfaces**, not a universal quality ranking. “Confirmed” means the listed input/control is documented by the vendor or original project. Claims of best visual quality remain model-, prompt- and dataset-dependent.

| Model/platform, current as of 3 Aug 2026 | Confirmed identity inputs and controls | Recommended SaaS role | Principal limitations | Evidence confidence |
|---|---|---|---|---|
| **Google Gemini 3.1 Flash Image / Gemini 3 Pro Image** | Up to four character images on 3.1 Flash Image and up to five on 3 Pro Image; Pro also supports up to three style references; multi-turn editing and up to 4K output.[5] | **Primary multi-reference still engine.** Compile 2–4 coherent identity views, then add wardrobe/style only in their own slots. | Slot limits are capacities, not an optimal-count study; results still require calibrated testing. | High, official API docs |
| **OpenAI GPT Image 2** | One or more reference images; all image inputs are processed at high fidelity; multi-turn editing through Responses API. Runway’s current wrapper documents up to 16 tagged references.[13] [19] | **Primary edit-oriented engine.** Strong for iterative composition and localized correction while retaining context. | Direct docs do not publish a universal optimal reference count; no adjustable input-fidelity parameter; transparent output unsupported; OpenAI acknowledges occasional recurring-character inconsistency.[13] | High for controls; unbenchmarked for this product |
| **Black Forest Labs FLUX.2 [pro]/[max]** | Multi-reference editing: up to eight images via API and ten in playground; indexed reference prompting; no negative prompts.[9] [11] | **Primary compositional multi-reference engine.** Use numbered identity, wardrobe and scene refs with explicit roles. | Hidden fusion weights; too many conflicting references can reduce clarity; no native video continuity. | High for controls |
| **Runway Gen-4 Image / Turbo** | One to three references; named character/scene references; separate iterative pathways; official API availability.[7] [20] | **Fast still-to-video bridge.** Create approved character and scene frames in the same ecosystem before Gen-4.5/Act-Two. | Persistent provider character ID is not the core Gen-4 Image mechanism; repeated independent generations still need references. | High |
| **Kling Image 3.0/Omni + Element Library** | Reusable multi-image Element built from two to four views; API supports element IDs and reference images with a combined cap of ten; 1K/2K output.[10] [21] | **Primary reusable cross-media character system.** Create and cache an Element per character version; keep wardrobe as a separate element where practical. | Some face-fidelity parameters apply only to older model versions; asset lifecycle and API element-management details require integration testing. | High for documented fields |
| **ByteDance Seedream 5 Pro/Lite via Runway API** | Pro supports up to ten references; Lite up to fourteen; multi-image fusion and interactive editing.[19] | **Secondary high-capacity still engine** and diversification route. | Access may be via an aggregator; identity-specific semantics and weighting are less explicit than raw reference capacity. | High for Runway API limits; medium for identity behaviour |
| **Adobe Firefly Image + Custom Models** | Separate structure and style references; structure strength 1–100; enterprise Custom Models can encode a subject/style.[12] | **Enterprise brand-safe route.** Use subject custom model for persistent cast, structure for pose/composition, style separately. | Custom Models access and training requirements vary by enterprise programme; no public universal identity guarantee. | High for documented controls |
| **Open diffusion stack: PuLID / InstantID / IP-Adapter / LoRA** | Single-image tuning-free face conditioning; multi-reference embedding averaging in InstantID; compatible structure controls; per-subject fine-tuning when needed.[1] [2] [3] [4] | **Maximum-control self-hosted tier.** Zero-shot adapter for onboarding, LoRA for persistent premium characters, pose/depth controls independently. | Compute and MLOps burden; base-model and licence compatibility; identity–editability trade-off; some face backbones have commercial-use restrictions. | High for papers; implementation-specific |
| **Midjourney V7 Omni Reference** | Exactly one Omni Reference, weight 1–1000; separate style references. Current default V8.2 does not support Omni Reference and automatically falls back to V7.[6] [22] | **Concepting and art-direction only**, or human-reviewed still creation. | No official production API documented; one identity image; intricate details not exact; character workflow uses older V7 rather than default V8.2. | High for official product controls |

## 5. Model-specific recommendations: video systems

| Model/platform, current as of 3 Aug 2026 | Confirmed identity/continuity controls | Recommended SaaS role | Principal limitations | Evidence confidence |
|---|---|---|---|---|
| **Google Gemini Omni Flash** | Google recommends it as the default video model for coherence, multi-input reasoning, character consistency and multi-turn editing.[23] Runway’s API implementation supports first-frame and video-to-video modes, with up to five reference images for V2V.[19] | **Primary conversational video generation/editing pilot.** Use approved stills and iterative corrections. | New surface; model and API behaviour require a live benchmark before any customer claim. | High for documented controls |
| **Google Veo 3.1** | Up to three reference images for a character, object or scene; first/last frame; scene extension; native audio.[14] | **Primary cinematic reference-to-video route.** Use 2–3 selected identity/wardrobe refs and approved first frame. | No cross-request guarantee; extension uses previous video context, so drift must be gated before continuing. | High |
| **OpenAI Sora 2 / Sora 2 Pro** | First-frame image; reusable character assets created from 2–4 second video; character ID reused across generations; character name must appear in prompt.[16] | **Strong reusable route for non-human characters and eligible enterprise human-likeness cases.** | Human-likeness character uploads blocked by default; input images with human faces rejected; extensions do not support character assets.[16] | High |
| **Kling Video 3.0 / 3.0 Omni** | Reusable 2–4 image Elements or 3–8 second video character elements; voice binding; multiple elements; up to three bound elements alongside start/end-frame workflows.[10] | **Primary reusable human/virtual-cast route** when consent and API support are confirmed. Excellent for cross-shot element reuse. | Multi-character prompts and motion still require spatial mapping and QC; marketing language is not a benchmark. | High for controls |
| **MiniMax H3** | Up to nine images, three videos and three audio references, maximum twelve mixed assets; first/last frame; 4–15 seconds; broad formats.[17] | **High-capacity multimodal reference route.** Select identity, motion, camera and voice inputs explicitly. | More inputs can conflict; no documented persistent character object across calls; re-submit references every generation. | High |
| **Runway Gen-4.5 + Act-Two + Aleph 2.0** | Gen-4.5 text/image-to-video 2–10 seconds; Act-Two performance transfer up to 30 seconds; Aleph 2.0 editing with up to five timestamped keyframes.[18] [19] | **Production orchestration and performance route.** Generate approved still, animate with Gen-4.5 or Act-Two, repair with Aleph 2.0. | Gen-4.5’s still input is not a persistent character registry; high facial expressiveness may add artifacts. | High |
| **Luma Ray 3.2** | Source-video transformation only; up to 64 keyframes; independent face, body, pose/blocking, motion and structure controls; source duration preserved up to 20 seconds.[8] | **Best-documented V2V identity-preserving transformation control surface.** Use for a known performance or shot that must retain timing and body motion. | Not text-to-video or image-to-video; requires source footage and careful lock settings. | High |
| **ByteDance Seedance 2.0 via Runway API** | Text-, image- and video-to-video; keyframes, reference images/videos and generated audio; 4–15 seconds; up to 4K on the full model.[19] | **Secondary high-resolution multi-input route** after benchmark qualification. | Exact identity weighting and optimal reference composition are not fully documented in the reviewed API changelog. | High for availability; medium for identity behaviour |
| **Midjourney Video** | One start image, optional end frame, 5-second base clip extendable to 21 seconds; low/high motion. Image, style and Omni References are not compatible with video generation.[15] | **Animate an already approved still for concept work.** | No independent persistent identity input during video; 480p/720p; high motion may glitch; not appropriate as sole engine behind a consistency promise. | High |
| **Pika 2.5 web / Pika 2.2 via fal.ai API** | The documented API provides Pikascenes with character, object, wardrobe and setting references, Pikaframes with up to five keyframes, and single-image I2V.[26] | **Secondary stylized-shot route** after an approved hero frame; qualify Pikascenes through the benchmark before production use. | No reviewed official source confirms a persistent reusable character ID across independent shots; web and API versions differ. | High for API controls; provisional for identity persistence |
| **Adobe Firefly Video** | Image-to-video and enterprise creative workflow; can animate an approved still and integrate with Firefly asset controls. | **Enterprise-safe secondary route** for short branded motion where an accepted image is the anchor. | Public documentation offers less explicit reusable-character control than Kling, Sora or Veo; validate before positioning. | Medium-High |
| **Open-source Wan/VACE/Hunyuan custom stacks** | Research and repositories expose reference-to-video, masked editing, audio/pose controls and self-hosted customization.[24] [25] | **R&D or private-deployment tier** when portability and data control justify infrastructure cost. | Heavy compute, rapidly changing checkpoints, licence and API maturity variance, and greater operational burden. | Medium-High for research; deployment-specific |

## 6. Routing recommendation

The platform should maintain a capability registry and route by **required control**, not by a single global “best model.” A practical first production portfolio is:

| Workload | Primary route | Secondary route | Escalation |
|---|---|---|---|
| Photorealistic still with 2–5 identity views | Gemini 3.1 Flash Image or 3 Pro Image | GPT Image 2 or FLUX.2 Pro | Fine-tuned LoRA/open stack |
| Complex multi-reference composition | FLUX.2 Pro/Max | GPT Image 2, Seedream 5 | Localized edit/composite |
| Reusable cross-media character | Kling Element | Sora character for eligible subjects | Fine-tuned open stack |
| Cinematic reference-to-video | Veo 3.1 | MiniMax H3 or Kling 3.0 | Shorter shots plus keyframe repair |
| Performance/dialogue | Runway Act-Two | Kling video character element | Luma Ray 3.2 from source footage |
| Preserve existing performance and camera | Luma Ray 3.2 | Aleph 2.0 | Conventional VFX/compositing |
| Non-human mascot continuity | Sora character asset | Kling Element | Fine-tuned image model plus I2V |
| Exact logos, tattoos or patterned wardrobe | Approved still plus localized editing/compositing | Multi-reference still engine | Human post-production; do not rely on generation alone |

The platform should run a **shadow benchmark** whenever a model version changes. Only after the new version meets or exceeds the incumbent on the platform’s own cast and shot matrix should it become the default. Provider marketing announcements are useful for discovering controls, but they are not evidence that the new model meets the product’s acceptance thresholds.

## 7. Common causes of identity drift and mitigation

| Cause | Mechanism | Mitigation |
|---|---|---|
| Unseen geometry | Model invents profile, rear, body or accessory details absent from references | Multi-view master pack; shot-matched selection |
| Reference contamination | Background, pose, lighting or outfit is encoded as identity | Clean references; separate conditioning slots; diverse training data |
| Conflicting references | Different ages, hair, outfits, proportions or edits compete | Versioned assets; reject contradictions; submit fewer coherent images |
| Excessive identity weight | Identity signal overwhelms prompt/style and freezes pose or clothing | Calibrate per provider; separate pose/style; use edit rather than brute force |
| Insufficient identity weight | Prompt, style or scene replaces defining features | Add matching view, raise provider-specific weight, or use a stronger identity mechanism |
| Chained derivatives | Each generated output becomes the next reference and errors accumulate | Re-anchor to master pack on every shot and retry |
| Cross-model translation | Different encoders interpret identity, colour and body differently | Provider-specific derivatives and validation; do not assume portable character IDs |
| Model/version update | Provider changes encoder, reference semantics or default aesthetics | Pin versions; regression suite; model migration approval |
| High motion or occlusion | Face/body landmarks disappear and temporal attention loses correspondence | Short shots, moderate motion, visible face, keyframes at reappearance |
| Multi-character ambiguity | Features or identities bleed between nearby subjects | Explicit element IDs and labels; spatial prompts; separate generation/compositing if necessary |
| Resolution/aspect mismatch | Cropping, stretch or tiny face removes identity evidence | Match provider requirements; maintain face size; use correct first-frame ratio |
| Stochastic sampling | Different noise trajectories alter local features | Candidate generation and selection; seeds aid repeatability but do not encode identity |

## 8. Guarantee boundary

No reviewed model documentation supports a blanket guarantee that a character will remain identical across arbitrary poses, lighting, styles, outfits, scenes and video shots. The platform can credibly guarantee the **process**—approved references are used, model versions are tracked, outputs are tested, and failed outputs are rejected or repaired. It cannot credibly guarantee every stochastic first-pass visual outcome.

## References

[1]: https://dreambooth.github.io/ "DreamBooth Project Page"
[2]: https://ip-adapter.github.io/ "IP-Adapter Project Page"
[3]: https://instantid.github.io/ "InstantID Project Page"
[4]: https://arxiv.org/html/2404.16022 "PuLID Paper"
[5]: https://ai.google.dev/gemini-api/docs/image-generation "Google AI — Gemini Image Generation"
[6]: https://docs.midjourney.com/hc/en-us/articles/36285124473997-Omni-Reference "Midjourney — Omni Reference"
[7]: https://help.runwayml.com/hc/en-us/articles/40042718905875-Creating-with-Gen-4-Image-References "Runway — Gen-4 Image References"
[8]: https://lumalabs.ai/learning-center/articles/ray-3-2-introduction-and-core-concepts "Luma — Ray 3.2 Core Concepts"
[9]: https://docs.bfl.ml/flux_2/flux2_image_editing "BFL — FLUX.2 Image Editing"
[10]: https://kling.ai/quickstart/klingai-element-library-3-user-guide "Kling — Element Library User Guide"
[11]: https://docs.bfl.ml/guides/prompting_guide_flux2 "BFL — FLUX.2 Prompting Guide"
[12]: https://developer.adobe.com/firefly-services/docs/firefly-api/guides/concepts/structure-image-reference/ "Adobe — Structure Reference Images"
[13]: https://developers.openai.com/api/docs/guides/image-generation "OpenAI — Image Generation"
[14]: https://developers.googleblog.com/introducing-veo-3-1-and-new-creative-capabilities-in-the-gemini-api/ "Google Developers Blog — Veo 3.1"
[15]: https://docs.midjourney.com/hc/en-us/articles/37460773864589-Video "Midjourney — Video"
[16]: https://developers.openai.com/api/docs/guides/video-generation "OpenAI — Video Generation with Sora"
[17]: https://platform.minimax.io/docs/guides/video-generation "MiniMax — Video Generation"
[18]: https://help.runwayml.com/hc/en-us/articles/42311337895827-Performance-Capture-with-Act-Two "Runway — Act-Two"
[19]: https://docs.dev.runwayml.com/api-details/api_changelog/ "Runway API Changelog"
[20]: https://runway.com/research/introducing-runway-gen-4 "Runway Research — Introducing Gen-4"
[21]: https://kling.ai/document-api/api/image/3-0-omni/image-generation "Kling API — Image Generation"
[22]: https://docs.midjourney.com/hc/en-us/articles/32199405667853-Version "Midjourney — Version"
[23]: https://ai.google.dev/gemini-api/docs/video "Google AI — Video Generation in Gemini API"
[24]: https://arxiv.org/abs/2503.07598 "VACE Paper"
[25]: https://github.com/Tencent-Hunyuan/HunyuanCustom "Tencent HunyuanCustom Repository"
[26]: https://blog.fal.ai/pika-api-is-now-powered-by-fal/ "fal.ai — Pika API Is Now Powered by fal"
