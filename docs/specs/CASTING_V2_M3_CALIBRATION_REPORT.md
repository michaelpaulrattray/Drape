# Casting V2 — M3 provider calibration report

**Status:** complete, awaiting Fable review then the founder's go/no-go and data-retention sign-off.
**Run date:** 2026-07-30. **Executor:** Opus. **Authorization:** §O-8, extended to ~$22.50 by the founder.
**Artifacts:** `.calibration/` (gitignored — 205 images, `manifest.json`, intents, treatments, `voice-probe.json`).

This report exists to answer one question — *should the program continue?* — with measurements rather than vendor marketing. It also states plainly what it does not establish.

---

## 1. Verdict

**Go, with two design consequences for M7 and one for M5.**

The identity engine holds a signed face across the full canonical package and through three revisions. That was the gate, and it passes. Two weaknesses found alongside it change how M7's package orchestrator and its validator must be built. The creative engine produces excellent framing consistency but, on its own, poor character diversity — which promotes the §E.1 treatment stage from optional optimisation to something closer to required.

---

## 2. Transport

Founder decision mid-milestone: **images run through fal**, because that billing can be topped up reliably. §H.9 had already sanctioned this as the contingency ("a single-transport variant exists if OpenRouter disappoints"). It is now the leading production candidate.

| Role | Provider | Model |
|---|---|---|
| Creative (rolls) | fal | `openai/gpt-image-2` |
| Identity (views, revisions) | fal | `fal-ai/nano-banana-pro/edit` |
| Text — interpreter | OpenRouter | `anthropic/claude-sonnet-5` |
| Text — treatments | OpenRouter | `moonshotai/kimi-k3` |
| Image fallback | OpenRouter | `openai/gpt-image-2` (adapter retained, untested this run) |

Consolidating images onto one vendor collapses real operational surface: one balance, one queue protocol, one cancellation story, one retention conversation. The adapter boundary made the switch a config change, which is what it was designed for.

**Kimi K3 availability — verified.** §E.1 listed this as an open M3 question. `moonshotai/kimi-k3` is listed and served on OpenRouter. The A/B ran the model the plan specifies, not a stand-in. (The first A/B attempt was started against K2 by mistake, stopped ~30s in, and restarted on K3; wasted spend ≈ $0.02.)

---

## 3. The gate: does the identity engine hold a face?

**Yes.** One anchor → six canonical views at 2K → three revisions. 10/10 landed. Reviewed against the anchor: the same man throughout — face shape, hairline, stubble pattern, eye set. All three revisions applied correctly (forearm tattoo, denim jacket, greyer hair) without disturbing identity.

**Three defects that are design inputs, not blockers:**

1. **`threeQuarter` is not a three-quarter view.** It came back near-frontal. `side` produced a correct profile, so angle control is *inconsistent* rather than absent.
2. **`motion` is not motion.** Effectively a duplicate of `front`.
3. **Wardrobe drift.** `front` returned a button-up shirt while every other view kept the anchor's tee. Within a package that is a coherence failure — six views are supposed to be one shoot.

**Consequence for M7.** The cohort validator cannot only ask *"is this the same person?"*. It must also ask *"is this the requested view, in the established wardrobe?"* A package that passes identity but contains a mislabelled angle and a wardrobe change is not shippable, and nothing in the current design would catch it. §I's `identityValidationPolicy()` needs a view-conformance component.

**Resolution note.** Package views returned 1686×2528 (the 2K tier at 2:3), against a 1024×1536 anchor. Record this alongside the D-74 supersession — "2K" is a tier name, not a pixel count.

---

## 4. The sheet: diversity and framing

**Framing: excellent.** Eight candidates from one brief were consistently cropped, lit and backed. The normalized framing block works.

**Diversity on the interpreter-only path: poor.** The eight candidates read as one man photographed eight times.

### 4.1 The A/B (§E.1), full 12-brief matrix

Decision rule, **pre-registered before the run**: path B ships only if it beats A on diversity and duplication *without* losing lock fidelity or quality, and within +5s median latency.

| | mean spread | duplicate pairs | closest pair |
|---|---|---|---|
| Path A (Claude only) | 26.35 | 0 | 10.2 |
| Path B (Claude → Kimi K3 treatments) | **35.36** | 0 | 13.3 |
| change | **+34.2%** | — | +30% |

Path B improved spread on 10 of 12 briefs. Largest gains were exactly where the plan needs them most: `nonhuman-1` 17.6 → 45.9 (+161%), `loose-4` 25.5 → 45.2 (+77%). Two briefs regressed slightly (`loose-3`, `nonhuman-4`).

**The duplicate metric did not discriminate.** The pre-registered near-duplicate threshold (mean absolute difference < 6 on a 16×16 greyscale signature) caught nothing in either path — the closest pair anywhere was 10.2. Reporting the threshold as set rather than moving it: duplication *as defined* was not observed, and spread is the signal that carried information.

**The metric and the eye disagree, and the eye is right.** The perceptual signature measures whether images *look* different in layout and tone. It cannot see identity. My own read of the path-A grids is that the eight candidates are the same person in different shirts — which the metric scores as adequately spread. Any future automated diversity check must compare *faces*, not pixels.

### 4.2 A confound I introduced, stated plainly

Path A's interpreter prompt asked Claude for "one vivid, concrete description". It obliged — inventing a plaid shirt and a mug captioned *"World's Okayest Handyman"* — and every one of the eight candidates inherited both. Two problems follow:

- The invented props became invisible constants, which is a large part of why path A looks uniform.
- The mug's text **overrode the framing block's "no text, no logos" rule.** Interpreter output outranked a framing constraint that was supposed to be adapter-owned (§E.1 is explicit that the deterministic adapter owns framing, camera, crop and neutral wardrobe).

So this A/B compares *these two prompt designs*, not the two architectures in their best form. A path A whose interpreter is forbidden from specifying props, wardrobe and scene would likely close some of the gap. **The honest reading: path B wins as run, and part of path A's deficit is fixable prompt design.** The independent finding — that interpreter output can override framing rules — is arguably more valuable than the A/B result itself, and needs fixing either way before M5.

---

## 5. Measured performance

| Metric | Value |
|---|---|
| Per-call latency (all image calls, n=205) | p50 **54s**, p90 74s, min 31s, max 94s |
| 8 parallel candidates, wall clock | **66–82s** |
| Effective concurrency achieved | 8 (no throttling observed) |
| Failure rate | 5 / 234 calls (2.1%) |

**Throughput consequence for §H.8.** Eight parallel candidates complete in roughly the time of the slowest single call, so fal did not serialise us at concurrency 8. `ROLL_IMAGE_CONCURRENCY=8` is supportable on this transport. This was measured on the transport we actually run; OpenRouter's Tier-1 5 IPM ceiling — the reason §H.9 flagged this — does not apply to fal and was **not** tested.

**Product consequence.** A roll of eight takes **over a minute**. The sheet must render eight skeletons instantly and stream each tile as it lands; there is no version of this that feels acceptable as a blocking wait. The queue-pill and progress patterns added in the design handoff update apply directly.

---

## 6. Cost

Measured by reading the fal account balance around a clean run:

| Item | Measured | List estimate | Delta |
|---|---|---|---|
| GPT Image 2, medium, 1024×1536 | **$0.099** | $0.084 | +18% |
| Nano Banana Pro, 2K | **$0.124** | $0.150 | −17% |
| OpenRouter text (24 calls) | **$0.3526** exact | $0.24 | +47% |

**Run total ≈ $21.8** of the ~$22.50 authorized (fal ≈ $21.4 across 205 images, OpenRouter $0.35, plus ~$0.89 on a first attempt whose artifacts I discarded — my error).

**Balance-delta accounting failed for the A/B leg** and should not be trusted in this report: the fal balance *rose* during the run, indicating a concurrent top-up, and fal's billing appears to settle with a lag. The per-image rates above come from the clean, uncontaminated first run. A future harness should record per-call provider-reported cost where available rather than relying on balance deltas.

**Unit economics against §H.10's ratified prices.** Roll of 8 = 160 credits against ≈$0.79 COGS. Sign = 500 credits against ≈$0.74 COGS for six 2K views. Both prices hold with comfortable margin at these rates.

---

## 7. Failure taxonomy — observed, and a bug it exposed

Five calls failed, all at the result-fetch step, all classified `content_policy`.

**That classification was wrong, and the bug is instructive.** Re-running one of the five prompts afterwards succeeded immediately, so they were transient. The classifier matched on a word list containing the bare token `content` — which appears in innocuous bodies (`content_type`). Because `content_policy` is *non-retryable*, five candidates that the retry policy would have absorbed were instead permanently failed and refunded.

The asymmetry matters: a genuine refusal retried twice wastes pennies; a transient error marked terminal loses a candidate the user paid for. Fixed to specific phrases, with regression tests, and unrecognised bodies now fall through to a retryable class. Failure messages now carry the HTTP status and a body excerpt — diagnosing this cost a live re-probe because the original log said only "result fetch failed".

**Observed mapping after the fix:** `429 → rate_limit` (retry), `5xx → transport` (retry), deadline → `timeout` (retry, with cancel), `400/422` + specific refusal phrases → `content_policy` (terminal), other `400/422` → `capability` (terminal), anything else → `unknown` (terminal, fails closed).

**A second bug, caught before it caused a false verdict.** The first identity run failed all nine calls and opened the circuit breaker — indistinguishable from "Nano Banana Pro cannot hold a face". It was mine: fal returns `status_url`/`response_url`/`cancel_url` in the submit response, and for sub-path endpoints those **drop the trailing segment** (`/edit` submits are polled at the base path). I was constructing the poll URL, so every poll 405'd. Had I believed the first run, this report would have recommended abandoning the identity engine. Fixed to use the returned URLs, with a regression test.

---

## 8. Voice (M8b input)

**Prompt-based voice design is not reachable through either router.**

- fal: `fal-ai/elevenlabs/voice-design` → **404**. `fal-ai/elevenlabs/tts/multilingual-v2` and `fal-ai/elevenlabs/sound-effects` are published.
- OpenRouter: **no ElevenLabs models at all** (367 models enumerated). The only audio-capable entries are `openai/gpt-audio` and `openai/gpt-audio-mini`, which synthesise speech in preset voices — not design a reusable voice from a description.
- No `ELEVENLABS_API_KEY` is configured, so the direct API was not tested.

**M8b needs a direct ElevenLabs key.** Credits are not the constraint; the capability is not on either router. The fallback — preset voices via GPT Audio or fal TTS — is "pick from a list", not "design from a sentence", and would break the sentence-first grammar the rest of Casting V2 is built on. Per the honest-capability law, if voice design cannot be delivered the room simply renders no Voice card.

---

## 9. Data retention — documented, not observed

**This is the part the founder is signing, and I cannot measure it.** What follows is documented terms, read 2026-07-30. It is not observed behaviour, and no test in this run verified it.

- **fal.ai** — terms: https://fal.ai/terms · privacy: https://fal.ai/privacy . Generated outputs are served from `v3b.fal.media` URLs that are publicly reachable without authentication. Our adapter downloads bytes once and never persists or exposes a fal URL, but **the object exists on their CDN independently of us**, and no expiry is documented.
- **OpenAI (GPT Image 2, upstream of fal)** — https://openai.com/policies/api-data-usage-policies . API content is not used for training by default; 30-day abuse-monitoring retention applies unless a zero-retention arrangement exists.
- **Google (Gemini 3 Pro Image, upstream of Nano Banana Pro)** — https://ai.google.dev/gemini-api/terms . Paid-tier terms state prompts and responses are not used to improve products.
- **OpenRouter** — https://openrouter.ai/docs/features/privacy-and-logging . Per-account logging and per-model data-policy controls.

**Account toggles to set before any non-founder scope:**
1. OpenRouter → Settings → Privacy: disable prompt logging; enable the "only use providers that do not train on inputs" data policy.
2. fal → confirm in writing whether generated-media URLs expire, and whether object deletion is available via API. *This is the open item that matters most* — customer images on an unauthenticated third-party CDN with no documented expiry sits uneasily beside the founder ruling that a customer's cast is their work.
3. Obtain OpenAI/Google retention position **as applied through fal**, which is not covered by our direct relationship with either.

**Disposal.** `.calibration/` holds 205 generated images and is gitignored. It should be deleted after review; it is not customer data, but it is the only copy and serves no purpose afterwards.

---

## 10. What this does NOT establish

- **Not tested: OpenRouter as image transport.** The adapter exists and is unit-tested against recorded shapes, but no live OpenRouter image call was made. Its Tier-1 5 IPM ceiling remains unverified, so the fallback is untested in practice.
- **Not tested: `n>1` batching, streaming/partial previews, GPT Image 2 edit-mode reference limits.** All deliberately out of scope; the design uses none of them.
- **Not tested: webhooks.** The harness polls. M4's roll dispatch may want webhooks, which this run says nothing about.
- **Not established: cohort quality.** Non-human briefs were run for *diversity* measurement only. Nobody has judged whether the anime, humanlike-fantasy or android outputs meet a quality bar — M9's certification is untouched by this run.
- **Not established: identity retention beyond one subject.** The gate ran **one** anchor. A single photoreal adult male held across six views is evidence, not proof. Retention across cohorts, ages, and skin tones is unmeasured, and a single-subject result should not be generalised.
- **Not established: sustained throughput.** One roll of eight, once. No sustained-load, rate-limit or breaker behaviour under real concurrency.
- **Not established: any retention claim.** See §9 — documented terms only.
- **The A/B is confounded** by the interpreter prompt design described in §4.2.

---

## 11. Recommendations

1. **Proceed to M4.** The gate passes.
2. **Adopt path B (the Kimi K3 treatment stage)** — but fix the interpreter prompt first so path A is a fair fallback, and keep `ROLL_TREATMENT_STAGE` per-roll fail-safe as designed.
3. **Forbid the interpreter from specifying props, wardrobe and scene.** It overrode a framing rule in this run. Deterministic adapter owns framing; enforce it rather than trusting it.
4. **Add view-conformance to the cohort validator** (§I) — angle and wardrobe, not just identity.
5. **Re-run the identity gate across cohorts before M9**, and across more than one subject before trusting retention generally.
6. **Resolve the fal media-URL retention question** before any scope beyond the founder.
7. **Set `ROLL_IMAGE_CONCURRENCY=8`** for the fal transport; leave the OpenRouter budget unset until measured.
8. **Get a direct ElevenLabs key** when M8b approaches.

---

## 12. For the reviewer

Fable: the claims most worth attacking are §3's "the gate passes" (one subject, one cohort), §4.1's diversity conclusion (a pixel metric that cannot see faces, plus the §4.2 confound), and §6's cost figures (balance-delta accounting was contaminated for the largest leg). §10 is where I have tried to be honest about the limits; tell me what belongs there that I have left out.

---

# Addendum — the A/B's remaining pre-registered conditions

**Added 2026-07-30 after Fable review (condition 1).** §E.1's decision rule has four parts; the main report closed only the first. These three are answered from the artifacts already on disk, before Path B becomes M5's default.

## Condition 2 — lock fidelity: **FAILS on one brief, and the failure is instructive**

Do Kimi's treatments violate facts the brief stated? Checked literally, against only what each brief actually pinned.

| brief | treatments | violations |
|---|---|---|
| tight-1, tight-2, tight-4, nonhuman-1…4 | 8 each | **0** |
| **tight-3** ("a wiry cyclist in **her** 20s, freckled, mid-laugh") | 8 | **7** |

Seven of eight treatments silently changed the subject's sex — *"laughter detonating out of **him**"*, *"**he** nearly clips"*, *"**his** own"*. Overall 7 / 64 = **10.9%**, entirely concentrated in one brief where it is 87.5%.

**This is the exact failure §E.1 anticipated, and its fail-safe handles it**: treatments are validated against the CastingIntent's locked facts, violators dropped, and a roll falls back to Path A entirely if fewer than eight survive. For tight-3 one treatment survives, so that roll would fall back — correctly.

**But that validator does not exist yet.** It is M5 work. Until it ships, Path B would put a male cyclist on a sheet for a brief that said "her" — a lock violation reaching the customer. **Path B must not become the default before its validator lands**, and the validator needs a test using this exact brief.

## Condition 3 — quality parity: **not established; the metric is confounded**

| | sharpness (edge energy) | contrast |
|---|---|---|
| Path A | 13.31 | 43.46 |
| Path B | 10.69 | 47.19 |
| change | **−19.7%** | +8.6% |

Read naively this says Path B is blurrier. It probably does not. Path A's candidates were full of high-edge content — cluttered garages, workbenches, plaid, mug lettering — while Path B's were plainer studio portraits. Edge energy cannot separate *"softer rendering"* from *"less background clutter"*, and here the two are confounded by exactly the difference the A/B created.

**Conclusion: this metric cannot answer the quality question.** It is reported so the number is not later mistaken for evidence either way. Quality parity needs the founder's side-by-side grade — which the cohort quality law now makes the standard anyway.

*(Correcting a defect in my own analysis: the first version of this measurement reported sharpness and contrast as identical figures. `sharp.stats()` computes on the input image, not the result of the pipeline it is chained to, so the convolution was silently ignored. The convolution is now materialised before measurement. Had I not noticed the two columns matching, this table would have been nonsense presented as evidence.)*

## Condition 4 — latency delta: **not measured**

The manifest records latency for image calls only, so the treatment stage's contribution is unknown. What is known: both text stages are single completions issued once per roll before any image dispatch, and 24 text calls sat inside a run whose wall clock was dominated by 187 image calls at p50 54s. §E.1's "+5s median" budget can be neither confirmed nor refuted. Recording per-call text latency is a one-line harness change for the next run.

## Revised recommendation on Path B

The main report recommended adopting Path B. That stands **with a sequencing condition**:

1. **Path B ships together with §E.1's lock validator, not before it.** The validator is required by the plan regardless; this makes it a blocker rather than a companion. Its test suite should include tight-3, where 7 of 8 treatments break a stated lock.
2. **Quality is graded by eye, not by this metric** — consistent with the cohort quality law.
3. **Record text-stage latency** in the next run so the +5s condition can actually be evaluated.

Diversity — the one condition that is unambiguously met — remains a strong result: +34.2% spread, biggest gains on exactly the non-human briefs M9 depends on.
