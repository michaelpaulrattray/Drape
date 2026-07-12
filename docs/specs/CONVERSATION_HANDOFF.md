# Conversation Handoff — Drape / Michael Rattray

**Purpose:** this doc lets a fresh AI conversation (claude.ai chat or a Claude Code session) pick up mid-stride with full context of the project, the working patterns, and the founder's style. It was written at the end of a long-running strategy conversation that carried the project from "should I port this to Lovable?" through full platform independence and deep into Canvas Pass 1. Read this first, then the repo docs it points to.

---

## 1. Who you're working with

Michael Rattray, founder of **Drape** — an AI fashion casting and production platform. Solo founder, non-traditional developer background, learns fast by driving. Based in Brisbane, AU (note: ~300-600ms latency to the US-hosted stack — he feels every un-optimistic round trip; this has been deliberately used as free latency QA).

**How he works (calibrate to this):**
- **Feel-first, adversarial driver.** He tests by trying to break things and by noticing what "feels janky/clunky/off." His aesthetic reactions are load-bearing — several major architecture changes started as "honestly this looks shit." Take vague feel-complaints seriously and decompose them into specifics for him.
- **Rules by decree after evidence.** The established rhythm: he raises an instinct → it gets argued/stress-tested → becomes a RULING logged in the DECISION_LOG. Push back when his instinct conflicts with something he ratified earlier (he values being caught contradicting himself), but taste calls are his to win.
- **Direct, casual register.** Short messages, typos, no ceremony. Match with substance-dense, structured replies. He wants full copy-paste-ready prompts written FOR him to give to his Claude Code agent — that's the primary deliverable of the strategy conversation.
- **References by product:** ElevenLabs Flows is his north-star interaction reference (also Luma, Higgsfield). He screenshots competitor UI and asks "steal the pattern, not the skin."

## 2. The project in one paragraph

Drape was built on the Manus platform, then fully migrated to an independent stack (July 2026): Railway (app + MySQL prod; separate dev MySQL), Cloudflare R2 storage (drape-dev / drape-production buckets), Google+email auth, Stripe (test mode), Resend (no verified domain yet — email signup is owner-only until fixed), Gemini for generation. Repo: **github.com/michaelpaulrattray/Drape**, deploy branch **local-migration** (auto-deploys to Railway on push; `main` is the working branch, pushed main→local-migration to ship). He is currently the only production user; continuous deploy of rough milestones is sanctioned. Domain not yet purchased (Cloudflare recommended when the time comes).

## 3. Current state: Canvas Pass 1

The big build: a Luma/ElevenLabs-style infinite canvas where casting, wardrobe, image gen, and eventually video compose via typed nodes and lineage edges — with **identity lock** as the moat (cast once, stay the same person across all downstream generation). Full design docs live in `docs/specs/` — **DECISION_LOG.md is the law**; PASS_1_BUILD_PLAN.md carries the R-sequence.

**Shipped:** R1 (casting takeover — the full studio opens as an overlay from the board; minting lands the cast on the node), R2 (server-side NL parser, surfaced as prefill-never-bypass brief field), R3 (minted-edit sessions, D-11 identity ceremony), R3b (six-slot identity package incl. the ratified WALK slot; tiered mint Draft/Core/Production with no-penalty upgrades; back-view identityCheck gate, retry-then-refund), D-46 (stage-lock unification — one view system, legacy ungated endpoints removed), R4 (canvas grammar: type-scoped floating toolbar, fork/recast popover, variations, soft-delete+undo+Cmd+Z, full keyboard model, credit balance in takeover header).

**Next: R5 — the character-sheet milestone** (the checkpoint the whole arc points at): root nodes render their package as a composite comp card (ElevenLabs-Huang posture), views pop out on demand, edges render with pin-initiated spawning, staleness at its post-immutability scope, D-30 payload composer wired. Then R6 (full environment restyle — the casting studio's warm legacy skin dies; plus first-run, empty states, accumulated style debts), R7 (hardening sweep — has a logged list of latent bugs), then dogfood. After pass 1: wardrobe-on-canvas (pass 2), image-gen/multi-engine/frames-as-export (pass 3), his prototyped angles + scene-composer tools (specs in TOOL_PROTOTYPES_NOTES.md), video/Seedance (pass 4, PASS_4_VIDEO_NOTES.md).

## 4. Load-bearing rulings (the ones that shape everything)

Read the full DECISION_LOG, but these govern daily judgment:
- **Minted casts are identity-immutable** — fork is the only identity operation; drafts edit freely. "v1/v2 on identity" was ruled incoherent.
- **Workspaces are never modals; choosers may be** (the refined no-modal rule). The casting environment is a takeover in the image-viewer pattern.
- **Canvas hosts no casting workflow** — nodes receive finished reference assets; creation/editing happens in the takeover.
- **No attribute chrome on nodes** — label row, image, control strip only.
- **D-38 optimism:** any interaction where the client already has the data renders instantly; server confirms reconcile, never gate. (Born from his AU latency.)
- **D-40:** feedback renders where the action happened — no success toasts where the surface shows the outcome.
- **D-15:** cost visible before every paid action; refunds exact and NAMED (silent refunds are a defect).
- **"Open"** is the canonical word for deliberately-unspecified fields (never "Engine's choice"/"AI's choice").
- **D-8 red scoping:** red appears only on delete-cascade confirms — one red mark in the app.
- **Spatial constancy** (zoom tiers retired) — nodes render the same at every zoom; status dots stay screen-legible always.
- **Six-slot package:** headshot, side, ¾, full-front, full-back, WALK (ratified as the deliberate sixth — fashion comp-card walk shot; motion poses need the identity gate most).

## 5. The working machinery (how sessions run)

- **Session-per-milestone** in Claude Code; fresh session each, opened by pointing at PASS_1_BUILD_PLAN.md + DECISION_LOG.md. Commit-per-step, gates green (typecheck, ~1,578 unit tests, canvas invariant drive A–L incl. paid legs on a funded verify-bot), push both branches.
- **Two-model architecture:** Opus executes milestones; Fable (when available/affordable) does design judgment and AUDIT sessions — plan-mode review of another model's commits against the DECISION_LOG. The first Fable audit caught a live security bypass; the pattern has tenure. Fable's included window ended ~July 12, 2026; he has ~$50 usage credits for Fable-shaped moments.
- **Checkpoint rhythm:** agent ships with a "what to drive" list → Michael drives production (hard-refresh first — stale bundles have burned him) → verdict prompt with numbered FIXES / RULINGS / CONFIRM / LOG-FOR-FUTURE sections → agent lands → next milestone. The strategy chat writes these verdict prompts for him.
- **Screenshot ritual:** competitor references and bug evidence get packaged as zips with item-prefixed filenames (fix2-, ruling1-, logitem-) and committed to `docs/specs/references/`.
- **Prod touches:** secrets live only in Railway; prod SQL is handed to the agent as reviewed one-offs (its permission classifier correctly blocks unsupervised prod writes). Schema changes: migrate prod BEFORE pushing code that reads new columns (the deploy-hold pattern).
- **Windows dev environment:** PowerShell + Windows Terminal; the orphaned-node-process plague is known (taskkill /F /IM node.exe is the broom); verify-drive infrastructure lives in .claude/skills/verify/.

## 6. Open threads at handoff

- R5 in flight or about to start (fresh Fable session; the sheet's internal interaction design is the flagged under-specified area — expect design-fork questions).
- R6 carries: full environment restyle, FailedSlot amber hue verdict, Save/Cast button placement, admin-panel style debts, first-run intro (Higgsfield-spirit), toast redesign shipped but placement audit continues.
- R7 carries a logged latent-bug list (createModel/createModelAsset $returningId, unlogged marker insert, marker-row leakage into models.get/registry, dead lock plumbing).
- Pre-launch (not scheduled): custom domain + Resend domain verification, live-mode Stripe + webhook, hero video replacement, R2 custom CDN domain, marker rows in the public registry.
- Walk-gate calibration loop pending real production walk generations.
- Future-pass log: board top-right cluster (profile/assets/comments, comment-click→zoom), board agent capability bar (read board, locate node, apply edits — boardState.getSnapshot is its API), cross-board paste (D-16 amendment).

## 7. How to get up to speed in a fresh conversation

1. Pull the repo (branch local-migration) — clone or fetch from github.com/michaelpaulrattray/Drape.
2. Read: this doc → DECISION_LOG.md (in full — it is the law) → PASS_1_BUILD_PLAN.md → skim CLAUDE.md and docs/specs/references/.
3. Ask Michael: "what milestone/checkpoint are you at right now?" — the log and plan date quickly; his answer is the truth.
4. Then behave per §1: write him ready-to-send prompts, decompose his feel-notes, guard the log against drift, and keep the gavel in his hand.
