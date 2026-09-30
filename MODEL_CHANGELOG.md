# Model Changelog — FormaStudio

All Gemini model assignments are centralized in `shared/modelRegistry.ts`.
When upgrading, change the model ID in the registry and document the change here.

> ⚠ **THE WATCH LIST AT THE FOOT OF THIS FILE IS NOT WHERE STATUS LIVES ANY MORE
> — AND THE REASON IS THAT IT WAS WRONG FOR THREE MONTHS (#1537).** It carried
> `gemini-3-pro-image-preview` as **"Active · Monitor for deprecation"** while
> Google had shut that id down on 2026-06-25, along with
> `gemini-3.1-flash-image-preview`. Nobody was careless: the monitoring was a
> sentence in a document, and a sentence does not monitor.
>
> Vendor status now lives in **`shared/vendorModelStatus.ts`** — one dated,
> sourced row per id — and `server/vendorModelStatus.test.ts` fails the gate on
> an id the registry ships with no row, or a shut-down id nobody has
> acknowledged. **Status is recorded there and nowhere else**; this file keeps
> the decision framework and the history, which is what a changelog is for.

---

## Decision Framework

| Question | If Yes | If No |
|----------|--------|-------|
| Is our current model deprecated or shut down? | **Upgrade immediately** | Continue |
| Does the new model improve our quality-critical path (VTO/casting)? | Run 10-image A/B test, upgrade if wins | Hold |
| Is the new model >30% cheaper at same quality? | Upgrade economy/flash slots | Hold |
| Is the new model still in Preview (not GA)? | Wait for GA unless quality-critical | Evaluate |
| Does the new model add capabilities we need (e.g., new aspect ratios)? | Upgrade the relevant slot | Hold |

---

## Slot Definitions

| Slot | Purpose | Used By |
|------|---------|---------|
| `IMAGE_PRO` | Premium image generation | VTO gen, casting chat, refinement, views |
| `IMAGE_FLASH` | Fast/cheap image generation | Digitization, image fallback chains |
| `TEXT_PRO` | Premium text reasoning | Detection, master prompt generation |
| `TEXT_MID` | Mid-tier text reasoning | Suggestions, schema updates, prompt enhancement |
| `TEXT_ECONOMY` | Workhorse text analysis | Analysis, QC, tattoo, classifier, identity, compaction |

---

## Changelog

### 2026-03-25 — Initial Registry + Model Audit v1

| Slot | Previous (hardcoded) | Current (registry) | Reason |
|------|---------------------|--------------------|--------|
| `TEXT_PRO` | `gemini-3-pro-preview` | `gemini-3.1-pro-preview` | Old model shut down Mar 9, 2026; alias redirects silently |
| `IMAGE_FLASH` | `gemini-2.5-flash-image` | `gemini-3.1-flash-image-preview` | Generation behind; significant quality uplift, new resolutions |
| `IMAGE_PRO` | `gemini-3-pro-image-preview` | `gemini-3-pro-image-preview` | No change — still best for complex edits |
| `TEXT_MID` | `gemini-3-flash-preview` | `gemini-3-flash-preview` | No change — appropriate tier |
| `TEXT_ECONOMY` | `gemini-2.5-flash` | `gemini-2.5-flash` | No change — stable GA, no deprecation |

**Also:** Centralized 31 hardcoded model strings across 13 files into `shared/modelRegistry.ts`.

---

### 2026-09-30 — Every shipped id read at the vendor (#1537)

No slot changed. What changed is that the reading is now recorded in code with a
date on it, instead of in the Watch List below.

| Slot | Id | Read at Google's deprecations page, 2026-09-30 |
|------|----|-----------------------------------------------|
| `IMAGE_PRO` | `gemini-3-pro-image-preview` | **Shut down 2026-06-25** → `gemini-3-pro-image` |
| `IMAGE_FLASH` | `gemini-3.1-flash-image-preview` | **Shut down 2026-06-25** → `gemini-3.1-flash-image` |
| `TEXT_PRO` | `gemini-3.1-pro-preview` | **Deprecated**, no shutdown date announced |
| `TEXT_MID` | `gemini-3-flash-preview` | **Deprecated**, no shutdown date announced → `gemini-3.6-flash` |
| `TEXT_ECONOMY` | `gemini-2.5-flash` | Not on the deprecation table |

**Four of the five slots are on deprecated ids, two of them shut down.** #1537
was filed about the two image ids; the other two were found by reading all five
rather than only the ones the card named (working law 7 — fix the class, not the
instance).

⚠ **What to do about it is NOT decided here and is not this commit's to decide.**
Re-pointing a slot changes what the product renders — the changelog's own
framework asks for a 10-image A/B on the quality-critical path — and retiring
the wardrobe/VTO door is a product decision on the N8 road. Both are on #1537
for the founder. What this commit buys is that the next shutdown is a failing
suite instead of three quiet months.

⚠ **And "nobody has used it, so nothing has failed" is not evidence that it
works.** The 2026-03-25 entry above records the previous `TEXT_PRO` shutdown
with the words *"alias redirects silently"* — this vendor has silently
redirected a dead id before, so traffic is not a test either way.

---

## Watch List

⚠ **RETIRED AS A STATUS RECORD — see the note at the top of this file.** It said
"Active" about a shut-down model for three months. Live status is
`shared/vendorModelStatus.ts`, which the gate reads; what stays here is the
forward-looking candidate nobody has adopted.

| Model | Status | Notes |
|-------|--------|-------|
| `gemini-3.1-flash-lite-preview` | Preview (Mar 2026) | $0.25/1M input — potential TEXT_ECONOMY replacement when GA. Not shipped, so it has no row in `vendorModelStatus.ts` |
