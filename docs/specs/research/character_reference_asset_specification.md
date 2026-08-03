# Canonical Character Reference-Asset Specification

**Status:** Final supporting technical specification  
**Research date:** 3 August 2026  
**Author:** Manus AI

## Executive decision

The platform should **not treat a single character sheet as the canonical identity asset**. It should store a structured pack of separate, single-view source images and generate a contact sheet only as a model-specific derivative when an endpoint explicitly benefits from or requires one. Luma’s current official guidance is unusually explicit: one angle per image works better in its workflow, while a multi-angle sheet can introduce hallucinated details and artifact leakage.[1] Kling’s reusable Element format similarly constructs one character from a main image plus one to three supplemental single-view images.[2] Runway supports up to three separate active references and recommends distinct iterative pathways for character, wardrobe, and scene control.[3]

> **Recommendation:** adopt a **canonical eight-view identity pack**, supplemented by separately versioned expression, wardrobe, accessory, voice, and motion assets. At generation time, select only the views and control assets that the target model and shot require. Do not submit the entire pack by default.

There is no evidence for one universal “optimal” reference count. The correct distinction is between the **canonical repository**, which should be rich enough to support future models and fine-tuning, and the **runtime reference subset**, which should remain small, coherent, and model-specific. Current vendor limits range from a single Omni Reference in Midjourney V7, to three references in Runway Gen-4, two to four images in a Kling character Element, four or five character images in current Gemini image models, eight API references in FLUX.2, nine MiniMax H3 reference images, and larger multimodal capacities in other systems.[2] [3] [4] [5] [6] [7] These are endpoint capacities, not proof that filling every slot improves identity.

## 1. Required canonical package

The standard package should contain **eight identity stills**. Each still must depict only one character and one principal view. The pack deliberately separates face geometry, cranial/hair information, and body proportions so the runtime selector can build a model-appropriate subset.

| Asset role | Required framing | Purpose | Runtime priority |
|---|---|---|---|
| `identity.face.front` | Head and shoulders; frontal; neutral expression | Primary facial geometry, eye spacing, nose, mouth, jaw, hairline | Always first choice for face-led shots |
| `identity.face.three-quarter-left` | Head and shoulders; approximately 30–45° yaw | Cheek, nose projection, ear, hairline and depth | Preferred second identity view |
| `identity.face.three-quarter-right` | Mirrored three-quarter view | Bilateral asymmetry and opposite-side details | Preferred third identity view when supported |
| `identity.face.profile` | Clean left or right profile; neutral | Nose/chin silhouette, ear, skull and hairstyle depth | Add for profile or large-yaw shots |
| `identity.body.front` | Full body, front; relaxed A-pose; hands and feet visible | Height ratio, shoulder/hip width, limb proportions, baseline wardrobe silhouette | Always for full- or medium-body shots |
| `identity.body.three-quarter` | Full body, 30–45° yaw | Torso depth, body volume and garment drape | Add for oblique and action shots |
| `identity.body.side` | Full body profile | Posture, abdomen/back contour and limb depth | Add for lateral motion or profile framing |
| `identity.body.rear` | Full body rear | Hair back, shoulder/back shape and rear garment/accessory details | Add for rear or turning shots |

This eight-view standard is a **platform design conclusion**, not a vendor-mandated number. It is intentionally larger than the common runtime limits so the system can select the most informative subset. It also aligns with the core principle in Luma’s Master Reference Assets guidance: unseen geometry must otherwise be invented, and clean multi-angle views reduce that invention.[1]

### 1.1 Minimum and enhanced tiers

A low-friction onboarding flow may accept a **minimum viable set of three stills**: frontal face, three-quarter face, and full-body front. That tier must be labelled “basic references” and should not underpin a strong consistency promise for profile, rear, extreme-angle, or full-body generations. A four-image runtime set—front, three-quarter, profile, and full body—maps well to Kling’s multi-image Element capacity.[2]

The recommended production tier is the eight-view pack above. An enhanced pack may add the opposite profile, overhead/top view for non-human or product-like characters, a neutral T-pose for rig-like transformations, close details of identity-critical markings, and a short multi-angle video. Luma lists bilateral profiles and three-quarter views, rear, overhead, full-body, and T-pose references for its broad consistency workflow.[1] The platform should make those additions conditional on character type rather than impose them on every human cast member.

| Tier | Assets | Appropriate promise |
|---|---|---|
| Basic | 3 stills | Improved consistency in conventional frontal and three-quarter views |
| Standard | 8 stills | Production reference package for varied shot selection and multi-model routing |
| Enhanced | 8–12 stills plus short reference video and detail assets | Strongest available input package; still not a visual-outcome guarantee |
| Fine-tuned | Curated training set derived from approved sources, sized per base model and training recipe | Highest persistence within a pinned model family, with greater cost and portability risk |

## 2. Separate mutable controls from identity

Identity drift often begins when one image is asked to represent too many concepts. The platform should model conditioning as independent slots. This reflects the architecture of modern controls: IP-Adapter separates image and text conditioning through decoupled cross-attention; structure controls can be added separately; Runway encourages separate reference pathways; Adobe exposes distinct structure and style references; and Luma Ray 3.2 provides separate locks for faces, bodies, and pose/blocking.[3] [8] [9] [10]

| Conditioning slot | What belongs in it | What must not be inferred from it |
|---|---|---|
| Identity | Stable facial geometry, skin/marking pattern, ears, eye shape, hairline, skull shape, stable body proportions | Outfit, pose, lighting, environment or visual style |
| Hairstyle | Cut, length, texture, parting, colour and back-of-head shape | Core facial geometry |
| Wardrobe | One named outfit, footwear and garment-specific accessories | Permanent identity unless explicitly locked |
| Signature accessories | Glasses, jewellery, prosthetics, tattoos, props or logos that must persist | General scene composition |
| Pose/blocking | Skeleton, body pose, gaze and hand placement | Identity or wardrobe |
| Expression/performance | Neutral, smile, speech visemes, anger, surprise, subtle reaction | Baseline face shape |
| Style | Medium, texture, palette, rendering or cinematography | Character identity or wardrobe content |
| Scene/environment | Location, background, set dressing and lighting context | Subject identity |
| Voice | Consent-cleared voice asset or provider voice ID | Facial identity unless the provider binds both into one character asset |

The platform should permit each attribute to be marked **locked**, **preferred**, or **mutable**. Hair, age presentation, body type, makeup, and wardrobe cannot be assumed to be either permanently identifying or freely editable; that decision belongs in the character definition. The immutable identity block should remain concise and structured rather than become a long prose prompt that competes with scene instructions.

## 3. Expression, wardrobe, and accessory modules

Expression references should be stored as separate stills, not a single expression sheet. The standard optional expression module should include neutral, natural smile, speech/open-mouth, and one high-intensity expression relevant to the character. For dialogue video, a short, well-lit performance clip is more useful than a dense facial collage because current performance-transfer systems accept a driving video and character image/video as distinct inputs.[11]

Every approved outfit should be a versioned `wardrobe_id` with front, three-quarter, rear, and detail stills when the garment has identity-critical motifs, logos, closures, footwear, or asymmetry. The wardrobe should never be silently baked into the immutable identity embedding unless the product intentionally defines an inseparable “character + costume” persona. Midjourney’s legacy Character Weight distinction illustrates this problem: low character weight focused more on the face, while high weight carried hair and clothing; current Omni Reference instead offers a single overall weight and warns that intricate details may not match.[12] A platform that wants outfit changes must therefore maintain a face-led identity source separately from wardrobe sources.

Signature accessories require explicit metadata and at least one clean detail image. Small tattoos, freckles, jewellery, logos, and patterned fabrics should be treated as **verification targets**, because vendors explicitly acknowledge that intricate details may not be reproduced exactly.[12]

## 4. File and colour specification

The platform should retain the user’s original upload unchanged, then create normalized archival and delivery derivatives. The normalized master should use an opaque background and a widely interoperable colour space.

| Property | Canonical normalized master | API delivery derivative | Rationale |
|---|---|---|---|
| File format | PNG, 8-bit per channel, lossless | PNG by default; high-quality JPEG or WebP when a provider or latency target favours it | PNG avoids generational recompression; OpenAI, Sora, Midjourney, MiniMax and other reviewed systems accept PNG, while several also accept JPEG/WebP.[5] [7] [12] [13] |
| Alpha | No alpha in the identity image; store segmentation mask separately | Opaque unless endpoint explicitly needs transparency | Alpha edges can damage hair/detail and transparency is not universal; GPT Image 2 does not support transparent output.[13] |
| Colour profile | sRGB IEC 61966-2-1; embedded or consistently tagged | sRGB | Avoid CMYK, Display-P3, HDR and unmanaged profile differences across providers |
| Bit depth | 8-bit RGB | 8-bit RGB | Maximum cross-vendor interoperability |
| Orientation | Pixels physically rotated; EXIF orientation normalized | Same | Prevent provider-dependent rotation |
| Metadata | Preserve provenance internally; strip unnecessary EXIF/GPS from delivery copy | Minimum required metadata | Protect privacy while retaining lineage in the platform database |
| Compression | Lossless master | JPEG quality approximately 92–95 or WebP quality approximately 90–95 when needed; never repeatedly recompress | A practical platform default to be benchmarked, not a vendor rule |
| File size | Prefer under 25 MB master; no arbitrary quality loss to meet this internally | Target under 10 MB per still for broad provider compatibility | Kling documents a 10 MB image limit; MiniMax permits 30 MB, so 10 MB is a conservative routing target.[7] [14] |

No reviewed evidence shows an intrinsic identity advantage for PNG over a visually indistinguishable high-quality JPEG. The recommendation to retain PNG is an engineering choice: it preserves a clean canonical source, simplifies hashing, and prevents cumulative compression. The delivery layer should convert to the smallest provider-accepted format that survives a perceptual-difference check. WebP is efficient and accepted by OpenAI Sora, MiniMax and Midjourney, but not by every reviewed endpoint; therefore it should not be the only stored format.[5] [7] [12]

## 5. Dimensions, crop, and aspect ratio

The canonical source should be large enough to preserve identity details but not so large that providers downsample unpredictably or token costs rise without benefit. A **2048-pixel long edge** is the recommended normalized default, with originals retained up to their native resolution. Do not upscale low-resolution inputs merely to satisfy the target size.

| Asset class | Recommended normalized canvas | Composition rule |
|---|---|---|
| Face close-up | 2048 × 2048, 1:1 | Entire hair and chin visible; head centred; minimal perspective distortion; shoulders included |
| Portrait/three-quarter | 2048 × 2560, 4:5 | Head and upper torso; both eyes visible for three-quarter views |
| Full body | 2048 × 3072, 2:3, or 2304 × 3072, 3:4 | Hands, footwear, hair and silhouette fully visible with modest margin |
| Detail/accessory | 2048 px long edge; aspect matched to object | Sharp, isolated, scale-indicating context where useful |

These dimensions are platform defaults rather than universal API requirements. Current models expose heterogeneous output and input rules: GPT Image 2 accepts flexible output dimensions within documented pixel and aspect constraints; Gemini image models support resolution tiers up to 4K; Kling accepts reference dimensions from 300 px with aspect ratios between 1:2.5 and 2.5:1; MiniMax accepts 256–5760 px reference dimensions; and Sora requires a first-frame image to match the requested video resolution.[5] [7] [13] [14] The delivery service must therefore resize and letterbox or crop only after selecting the target endpoint.

## 6. Background and lighting specification

The default identity capture background should be **plain, matte, neutral light grey**, not transparent and not environmental. Clean or white backgrounds are endorsed by Luma for master references, while Runway recommends even, natural lighting and a neutral expression.[1] [3] Light grey is a platform refinement: it preserves separation for light hair, white clothing and translucent edges better than pure white.

The character should be photographed with diffuse frontal or slightly off-axis light, low shadow contrast, accurate white balance, and no coloured gels. Avoid beauty filters, shallow depth of field that blurs ears or hair, wide-angle facial distortion, heavy makeup changes, strong rim light, sunglasses, hats, occlusion, motion blur, and environmental reflections. A separate environmental reference may be stored for scene or style control, but it should not be mixed into the identity core.

The quality pipeline should reject or flag images with clipped facial features, occluded eyes, motion blur, severe JPEG artifacts, multiple faces, extreme perspective, inconsistent hair or costume between supposedly immutable views, or background elements that overlap the silhouette. It should also detect near-duplicates so a nominal eight-image pack does not contain eight almost identical frontal frames.

## 7. Short reference video

The enhanced package should include an optional **3–8 second single-character reference clip** with neutral lighting, a static or gently moving camera, and a slow head/body turn that reveals frontal, three-quarter and profile geometry. Kling specifies 3–8 seconds for video character elements, while OpenAI recommends 2–4 second character source clips for Sora and notes that source and output aspect ratios should match to avoid stretching.[2] [5]

The platform should retain the full consent-cleared clip and create provider-specific trims. It should not assume one clip can serve motion, voice and identity equally well. If voice is captured, bind it only after explicit voice consent; otherwise create a silent identity clip and store voice separately.

## 8. Runtime subset selection

The asset pack is a library, not a payload template. For every generation, the selector should rank references against the requested shot and the target model’s documented controls.

| Requested shot | Preferred identity subset | Additional controls |
|---|---|---|
| Frontal close-up | Front face + matching three-quarter | Expression or driving performance; style separate |
| Three-quarter portrait | Matching three-quarter + front face + optional full-body front | Wardrobe front/three-quarter |
| Profile | Matching profile + nearest three-quarter + front face | Pose/profile guide |
| Full-body action | Full-body front + three-quarter + side + front face if capacity permits | Pose/depth guide and wardrobe set |
| Rear/turnaround | Rear body + side + three-quarter + front face | Start/end frame or keyframes |
| Outfit change | Face-led identity refs + target wardrobe refs; exclude old outfit-heavy refs | Pose and style separate |
| Stylized rendering | Face/front + three-quarter at moderate identity strength | Separate style reference; test identity–style trade-off |
| Video dialogue | Approved hero still or character asset + driving performance | Keep motion moderate; use shorter shots and facial consistency gate |

When a model accepts only one identity reference, the platform should submit a **single, purpose-built hero image** rather than a multi-angle collage unless the vendor explicitly calls for a grid. The hero image should match the requested framing and reveal the most important locked features. Midjourney V7 accepts only one Omni Reference and warns that it is inspiration rather than exact copying; the platform should therefore use Midjourney for concepting or carefully bounded still workflows rather than as the only identity engine behind a hard persistence promise.[12]

## 9. Metadata schema

Each asset requires machine-readable metadata so selection does not depend on filenames or manual memory.

| Field group | Required fields |
|---|---|
| Identity | `character_id`, `character_version_id`, `asset_id`, `asset_role`, `identity_scope`, `locked_attributes`, `mutable_attributes` |
| View | `yaw_class`, `pitch_class`, `roll_degrees`, `framing`, `body_visibility`, `gaze_direction`, `expression_id`, `pose_id` |
| Appearance | `hairstyle_id`, `wardrobe_id`, `accessory_ids`, `makeup_id`, `age_presentation`, `style_id`, `environment_id` |
| Technical | `mime_type`, `width`, `height`, `bit_depth`, `colour_profile`, `alpha_present`, `file_size`, `sha256`, `perceptual_hash`, `quality_scores` |
| Provenance | `source_type`, `capture_or_generation_model`, `source_asset_ids`, `prompt_hash`, `seed`, `edit_lineage`, `created_at`, `approved_at` |
| Rights and safety | `subject_type`, `consent_record_id`, `permitted_uses`, `voice_consent`, `retention_policy`, `revoked_at`, `moderation_status` |
| Machine features | `face_detection_version`, `face_embedding_version`, `face_embedding_ref`, `body_embedding_version`, `body_embedding_ref`, `segmentation_mask_ref` |
| Provider mappings | `provider`, `provider_asset_id`, `provider_character_id`, `provider_model_version`, `expires_at`, `eligibility_status` |

Embeddings are derived biometric-like representations and should be access-controlled separately from ordinary thumbnails. Provider character IDs, LoRAs and embeddings must be versioned and revocable; none should replace the immutable source package.

## 10. Quality gates and acceptance criteria

A Standard package is accepted only when every required role is present or explicitly waived for the character type, the same identity is verified across views, and no supposedly immutable feature conflicts. Face-led human packs should have exactly one detectable primary face in the four face views. Full-body views must show the complete silhouette, hands and feet where anatomically relevant. At least one image must show each identity-critical feature unobstructed.

The system should compute blur, exposure, face detectability, pose/yaw coverage, duplicate similarity, background complexity, crop completeness and cross-view identity similarity. Thresholds must be calibrated on the platform’s own consenting validation set; they should not be copied directly from face-recognition verification thresholds because generation references and demographic conditions differ from surveillance-style recognition datasets. ArcFace and AdaFace provide useful embedding families, while Face Consistency Benchmark demonstrates both reference-to-frame and pairwise frame comparisons, but production thresholds remain application-specific.[15] [16] [17]

## 11. Acceptance statement

A character package conforming to this specification provides the **best available conditioning basis** for repeatable generation. It does not make every model capable of preserving every attribute in every shot. The platform should describe the package as a controlled identity source and should separately qualify each model/shot combination through the drift-testing framework.

## References

[1]: https://lumalabs.ai/learning-center/articles/character-and-object-consistency "Luma AI — Character and Object Consistency"
[2]: https://kling.ai/quickstart/klingai-element-library-3-user-guide "Kling AI — Element Library User Guide"
[3]: https://help.runwayml.com/hc/en-us/articles/40042718905875-Creating-with-Gen-4-Image-References "Runway — Creating with Gen-4 Image References"
[4]: https://ai.google.dev/gemini-api/docs/image-generation "Google AI — Gemini API Image Generation"
[5]: https://developers.openai.com/api/docs/guides/video-generation "OpenAI — Video Generation with Sora"
[6]: https://docs.bfl.ml/flux_2/flux2_image_editing "Black Forest Labs — FLUX.2 Image Editing"
[7]: https://platform.minimax.io/docs/guides/video-generation "MiniMax — Video Generation"
[8]: https://ip-adapter.github.io/ "IP-Adapter Project Page"
[9]: https://developer.adobe.com/firefly-services/docs/firefly-api/guides/concepts/structure-image-reference/ "Adobe Firefly Services — Structure Reference Images"
[10]: https://lumalabs.ai/learning-center/articles/ray-3-2-introduction-and-core-concepts "Luma AI — Ray 3.2 Introduction and Core Concepts"
[11]: https://help.runwayml.com/hc/en-us/articles/42311337895827-Performance-Capture-with-Act-Two "Runway — Performance Capture with Act-Two"
[12]: https://docs.midjourney.com/hc/en-us/articles/36285124473997-Omni-Reference "Midjourney — Omni Reference"
[13]: https://developers.openai.com/api/docs/guides/image-generation "OpenAI — Image Generation"
[14]: https://kling.ai/document-api/api/image/3-0-omni/image-generation "Kling AI API — Image Generation"
[15]: https://arxiv.org/abs/1801.07698 "Deng et al. — ArcFace"
[16]: https://arxiv.org/abs/2204.00964 "Kim et al. — AdaFace"
[17]: https://arxiv.org/html/2505.11425v1 "Podstawski et al. — Face Consistency Benchmark for GenAI Video"
