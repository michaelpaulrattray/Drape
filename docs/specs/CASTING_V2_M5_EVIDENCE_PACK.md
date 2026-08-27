# Casting V2 — M5 evidence pack

> **Status: dated record.** A measurement/evidence/court document from the date it states — it records what was true then; individual verdicts may since have been superseded. Current law: CLAUDE.md, the capability atlas, `DECISION_LOG.md` (#69 stamping sweep, 2026-08-28).


Produced under the UI milestone completion contract (founder, 2026-08-01):
side-by-sides per surface in both themes, plus a copy audit classifying every
user-visible string, posted to Fable for a law skim **before** the founder
dogfoods.

Surfaces in scope: the casting tab (`/casting`), the casting sheet
(`/casting/s/:sessionId`), and the primitive gallery (`/casting/foundation`,
unlinked reference).

---

## 1. Mechanized design laws

These no longer depend on review memory. `scripts/drive-casting-design-laws.mts`
asserts them across three surfaces × two themes and exits non-zero on any
violation.

| Law | Why it exists |
|---|---|
| No focus outline on a text field's inner element | The token layer draws a blanket `:focus-visible` ring so nothing can be focus-invisible. On a text field that lands around the *text* rather than the control. Focus belongs to the wrapper: caret + border shift. |
| Dock visible without scrolling, and at page bottom | A dock you have to scroll to find is not a dock. |
| No mono type on sentences | Mono is the machine register — counts, ids, timestamps, eyebrows. A sentence in mono reads as output, not as writing. `.dp-eyebrow` / `.dp-chrome` are exempt by class: they *are* the machine register. |
| Every paid button states its price | D-15. Cost on the affordance, never behind a confirm step. Pending labels ("Rolling…", "Casting…") are exempt — they have been paid for and are reporting, not offering. |

**Current result: ALL DESIGN LAWS HOLD** (3 surfaces × 2 themes).

Running it caught four genuine violations on first pass, all on the primitive
gallery: three sentences set in `.dp-metadata` (mono) and two unpriced demo
"Cast it" buttons. Both were fixed on the page rather than exempted — the
reference page has to model the laws it teaches.

---

## 2. Copy audit

Every user-visible string on the casting surfaces, classified:

- **prototype-verified** — taken from the design prototype and honoured exactly.
- **adapted** — prototype structure kept, wording changed to match what the
  product can actually do today.
- **invented** — written for this build; no prototype source.

### Casting tab

| String | Class | Note |
|---|---|---|
| "Say who you need. / Meet eight of them." | prototype-verified | The copy law's own exemplar — never a numeral. |
| "A cast member is a face, a voice and a way of talking — signed once, reusable in every campaign. Describe one and pick from a sheet, or start from photos of a real person." | prototype-verified | Kept verbatim under F5. Note the standing tension: it names voice, which is M8b. Retained because F5 makes prototype *structure and copy* binding and the founder confirmed the blurb; flagged here rather than silently altered. |
| "Cast it · N cr" | adapted | Prototype had no price; D-15 requires one. Price from `castingV2.config`, never hardcoded. |
| "N candidates · about a minute · you're charged once, when the roll starts" | invented | Honest-capability: states the real wait measured at M3 (66–82s) and the charge model. |
| Seed chips (4) | adapted | See §3 — two prototype seeds retired under the seed law. |
| "Upload a real person" / "Casting from your own photos is coming. For now, describe the person and cast them." | adapted | Card ships as drawn (F5); the prototype's "Six photos or one 20-second clip. Likeness locks in about four minutes." is a promise about a feature that does not exist. |
| "Browse the signed roster" / "No one signed yet. Cast a sheet and sign the one you want to keep." | adapted | Prototype's "184 performers already cleared for paid ads" is invented data. Real count, which is zero. |
| "Search cast by name or look" | adapted | Prototype said "name, voice, or vibe". Voice does not exist yet. |
| "All / Signed / Unsigned" | adapted | Sentence case in a filter row; uppercase UNSIGNED is reserved for the mono status pill on cards. |
| "Unsigned sheets" / "pick up where you left off" | invented | Resume affordance; no prototype source. Sessions are durable 7-day objects and were otherwise unreachable after a tab close. |
| "No one signed yet — cast a sheet, then sign the candidate you want to keep working with." | invented | Empty-state truth. Archivo, not mono (law 3). |
| "Not open on this account yet." + body | invented | Flag-off state. The rail links here for every signed-in user. |

### Casting sheet

| String | Class | Note |
|---|---|---|
| "Roll N · X of Y" | prototype-verified | Mono, and legitimately so — counts are machine facts. |
| "Roll again · N cr" / "Rolling…" | adapted | Price per D-15; the pending label is the single-flight state. |
| "Keep" / "Kept" / "Follow" | prototype-verified | |
| "Keep the ones worth a second look" | prototype-verified | |
| "Cancel · refunds what you haven't seen" | invented | The founder's late-landing generosity ruling, said in the user's terms. |
| "Cancelled · N credits back so far" | invented | Deliberately "so far": in-flight candidates refund minutes later, so a total stated as final would be wrong. |
| "Cancelled — part of the refund could not be recorded. Support has the details." | invented | A refund that failed to record is never reported as "you weren't charged". |
| "Discarded" / "Discarded — undo is only available on the latest roll" | invented | The second form is the history case: the undo CAS is anchored to the active roll and would refuse. |
| "Restored — not kept" | invented | Undo restores the candidate but not its kept state; says so rather than letting the user discover it. |
| "Didn't arrive · refunded" / "Cancelled · refunded" | invented | One projection status, two honest readings, chosen by the roll's own status. |
| "N unpinned — applies to your next roll" | invented | Rolls are immutable; chip removal can only affect the next one. |
| "Back to the latest roll" | invented | Roll-history navigation; no prototype source. |
| Look captions ("Commanding glamour", "Severe minimal", …) | invented | Replaces the prototype's placeholder dispositional captions for category briefs — see §4. |
| "Nothing cast on this sheet yet" / "Describe who you need in the box below and roll." | invented | Empty sheet is a real state; eight skeletons that never resolve would be worse. |
| "Undo discard" | invented | |
| "Removed from kept" | invented | |
| "That roll could not start." | invented | Generic dispatch failure; refusals from this path are always free. |
| "Untitled sheet" | invented | A session whose roll has no brief text yet. |
| "Loading…" | invented | |
| "New cast member" | prototype-verified | Dashed create tile. |
| "Roll N · casting 8" | invented | The optimistic header while a dispatched roll has not appeared. |
| "N signed and ready to use in any campaign." | invented | Currently unreachable (signedCount is always 0 until M7). Flagged as dead copy rather than left undocumented. |
| aria/alt: "Discard candidate 0X", "Rolls in this sheet", "still casting", "Stop pinning X on the next roll", "A cast member, portrait", "The same cast member in a second frame", "Casting brief", "Search cast" | invented | Assistive-only strings; none claim a capability. |
| "Follow · N cr" | adapted | Prototype's Follow is unpriced; D-15 outranks it — Follow dispatches a paid roll. |

---

## 3. Seed law

**Four clauses (founder, 2026-07-31 and 2026-08-01).** Each was learned from a
seed that broke it:

1. **Honest** — the compiler must fully honour it today.
2. **A tiny story** — archetype plus one vivid detail, in the register of
   "Bodega owner, Brooklyn, gravelly". Would a stranger tap it out of
   curiosity? A demographic description nobody would touch is
   capability-honest and useless.
3. **Rest-state and permanent** — the detail must be structural and visible in
   a still, closed-mouth frame. Never a performed expression.
4. **Verified** — a seed ships only once a sample tile confirms the detail
   renders.

Cut by clause 3: "gap-toothed grin" (a grin is performance, and mouth-closed
framing would hide the gap). Cut by clause 4: "scar through one eyebrow",
which came back as a faint brow break rather than a scar. "Shaved head"
rendered unambiguously and shipped in its place.

**Shipped set:** Runway model / early 20s / shaved head · Blacksmith in her
50s / silver crew cut / soot in the creases · Skincare founder / 40s /
freckles she never covered · Oncology nurse at the end of a double shift.

The original clause, still governing: A seed is a promise about what the product can do; a seed the
system silently strips is worse than no seed, because the user taps it, pays,
and gets something that ignored half of what they clicked.

Two of the prototype's four broke it and were retired:

| Retired seed | Why | Returns when |
|---|---|---|
| "Night-routine voice, almost whispering" | Voice-only concept. M3 found prompt-based voice design is not reachable through either router. | Voice ships (M8b) |
| "Gen-Z gym rat, ring light, fast talker" | "ring light" is a lighting instruction; the framing law strips presentation words by design. | Never as written — lighting is adapter-owned |

**Proposed replacement set — awaiting the founder's pick.** One per axis the
compiler actually varies:

| Seed | Shows |
|---|---|
| "Editorial fashion model, early 20s" | Casting category + age lock; look variation |
| "Skincare founder, 40s, unbothered" | Character brief; disposition variation |
| "Nigerian-British woman, mid 30s, close-cropped hair" | Heritage lock |
| "A retired fisherman in his 60s, weathered face" | Age band + skin texture, older-age guard |

Seeds are **capability-versioned** in code (`requires`), so re-enabling one is a
deliberate edit rather than an act of memory.

Composer placeholders were audited the same way: the prototype's "a dad in his
30s in a cluttered garage, dry humour, explains things like he's talking to a
mate" promised a scene the framing law strips and a speaking manner that is
M8b. Now "a dad in his 30s, dry humour, hands that have done some work".

---

## 4. Variation vocabulary — the C-block port

The eight fixed reads ("Warm, unhurried", "Dry and flat", …) were the
prototype's placeholder captions, never a ruling, and for a modelling brief
they vary the wrong thing: eight editorial models do not differ by mood.

`LOOKS` is legacy's `BRAND_PROFILES` finished properly — a casting thesis, its
anti-pattern, and a quiet expression whisper (catalog C1 + C3), under
descriptive names because captions are client-visible and the archetype ruling
keeps real house names internal.

The interpreter picks the axis: **look** for a kind of face (model, editorial,
runway, beauty), **disposition** for a kind of person (character, occupation,
UGC). A stated look locks across the sheet per the archetype law.

---

## 5. Fable law skim — findings and disposition

Skim performed before the founder gate, per the contract. Findings:

| Finding | Disposition |
|---|---|
| **Follow is a paid affordance with no price, and the suite's PAID list did not include it** — so "all laws hold" was true of the assertion and false of the surface. On the exact affordance that cost the founder 640 credits. | **Fixed.** Follow now reads "Follow · N cr" on all eight tiles; the suite matches `/^follow/` and rejects a zero price. |
| "Nigerian-British" seed: the heritage enum is the ported legacy ten and has no value British maps to, so half the hyphenation would be silently dropped — the seed law's own failure mode. | **Fixed** by swapping to "West African woman, mid 30s". Extending the enum is a plan-level question (line 209), parked below. |
| `varyByLook`'s docstring described a keyword fallback that was never implemented. | **Fixed** — the comment now matches the code, and says so. |
| "Skincare founder, 40s, unbothered" was annotated "disposition variation", but a stated energy *locks* flat. | **Fixed** — annotation corrected. |
| Suite could pass vacuously when `--session` was omitted; Law 1 saw only `outline`, not box-shadow rings; Law 4 accepted "0 cr". | **Fixed** — missing session is now a hard failure; box-shadow rings are caught; a zero price is rejected. |
| Law 3 skips elements with children, so a mono sentence split across `<br>`/`<span>` fragments would pass. | **Known limitation, not fixed.** Recorded rather than hidden. |
| Copy audit was missing ~14 strings including all aria/alt. | **Fixed** — added above. |
| LOOKS vocabulary checked clean: no house names in keys, theses, avoids or whispers; nothing brand-shaped reaches a projection. | No action. |

## 6. Founder rulings parked

1. **The hero blurb** says "a face, a voice and a way of talking … or start from
   photos of a real person". Both are capability claims the product cannot meet
   today (voice is M8b; upload is the inert coming-soon card). F5 makes
   prototype copy binding and the founder confirmed this blurb; the
   honest-capability law points the other way, and the audit is internally
   inconsistent — voice was adapted *out* of the search placeholder but kept
   here. **Recommendation: adapt the blurb until M8b**, matching the precedent
   already set one field away. Whichever way it goes, blurb and placeholder
   must agree.
2. **Heritage enum**: extend the ported legacy ten to cover hyphenated
   nationalities, or keep seeds inside the vocabulary? Kept inside for now.
3. **Seed set**: four proposed, awaiting the pick.
4. The natural-language brief echo (gate item 5) is **not built** — a treatment
   proposal is owed before rebuilding the chip row.
5. Multi-subject identity gate (pre-M7 condition) is approved but not yet run.
