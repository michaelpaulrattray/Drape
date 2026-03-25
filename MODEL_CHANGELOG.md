# Model Changelog — FormaStudio

All Gemini model assignments are centralized in `shared/modelRegistry.ts`.
When upgrading, change the model ID in the registry and document the change here.

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

## Watch List

| Model | Status | Notes |
|-------|--------|-------|
| `gemini-3.1-flash-lite-preview` | Preview (Mar 2026) | $0.25/1M input — potential TEXT_ECONOMY replacement when GA |
| `gemini-3-pro-image-preview` | Active | Monitor for deprecation; migration path → Flash Image with quality testing |
| `gemini-3-flash-preview` | Active | Monitor for 3.1 Flash successor |
