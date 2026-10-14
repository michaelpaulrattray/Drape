# N4b — Voice: listen, pick, keep (design, 2026-10-13)

**Cards: #499 (the rung) and #2140 (Listen and pick).** Written by a relay design agent on his
word opening the rung (chat, 2026-10-13, verbatim): *"Yes we will begin n4b"*. This document is
the design the rung points at; the build cards are cut from its §8 slice order and nothing else
is in the rung.

**Settled before this design and not re-asked:**

- **One engine: ElevenLabs, for creatures and humans alike.** His ear on six creature pairs,
  2026-10-13 (chat, verbatim): *"okay ellevenlabs is clearly better and converting it to inworld
  is a hit and a miss. This is because inworld is great at human voices but also so is
  ellevenlabs."* This supersedes the 2026-09-03 two-engine split (`CASTING_V2_PLAN_REBASELINE.md`
  §6) that #499's body still describes. **Inworld is dropped**: no provider, no key on Railway,
  no fallback.
- **The surface is his approved Desk design** (#2140, from the Notion item *"Voice card: editing
  redesign (casting room)"*, part 3): the voice text stays on top as the main editable field;
  under it a few voices made from that text, each with play and a waveform; *"Make new voices
  from this text · <credits>"*; **Keep "Voice 2"**; no vendor or engine names on screen.
- **The labels are "Voice", never "Take"** — his written design, to avoid confusion with film
  takes (#2140's note: the words win over frame `06`, which draws `Take 1`…`Take 4`).
- **The storage design is clip-on-profile**, his paste from the cinema research lane (#499,
  2026-10-13): Keep saves the voice; the saved voice reads a ~90 s audition passage; that clip is
  the cast's asset, stored beside the voice sentence; the engine's saved-voice slot is a cache.

---

## 1 · What a customer gets, in their terms

Every signed cast already has a **VOICE** card in the casting room with a written line — how
they sound, then how they use it (N2b, #1242/#2139/#2205; `models.voice`, edited in place or
said "your way"). Below that line today sits a drawn player skeleton and the words *"No voice
yet — A designed voice and an audition clip arrive with voice."* (`client/src/pages/CastingRoom.tsx`,
the `dpc-voice__player` block). N4b keeps that promise:

- **Voices made from their words.** Under the voice line, three voices made from it, labelled
  **Voice 1**, **Voice 2**, **Voice 3**, each with play and a waveform. They pick by ear.
- **Keep "Voice 2".** One press. The card then plays the cast's own voice: a ~90 second
  audition in that voice, which is what the card holds from then on.
- **Make new voices from this text · <credits>.** A fresh three from the same words, or from
  words they have just changed. The price is a placeholder (§7).

What they never meet: an engine name, a slot, a clone, a quota, a file format, a seed.

⚠ **Three, not four — and the engine settles the count, not a preference.** His design writes
*"Voice 1 to 4"*. Every design call the spike made returned **exactly 3 previews** (ten
designs, 2026-10-13, `text-to-voice/design`). Four would mean a second design call per press —
double the cost and the wait — to fill a label count. This design draws **Voice 1–3** and names
the difference here for his eye rather than leaving a builder to meet it.

## 2 · The disappearing-technology gate, answered in this body

**Q1 — What must the customer learn to use this?** Nothing new. They already write or edit the
voice line (N2b). The voices appear under it; they press play, listen, and press Keep. The
saved voice, the audition passage, the stored clip and the cache behind it all happen inside
Keep. There is no step where a customer meets a voice id, a slot, a clone or a vendor.

**Q2 — What decision does it put in front of them, and have they any basis for it?** One: which
of three voices is this cast. The basis is their own ear on the thing they are choosing —
exactly the basis a casting director has. The second, optional, is whether to hear a fresh
three, and its price is on the button. **The number of voices is not a choice** (his
candidate-count ruling: *"every decision placed before the button is a reason not to press
it"*), nor the length of the audition, nor the passage it reads.

**Q3 — Where does the technology show?** Nowhere on the path, by construction. The points where
it most easily leaks, each closed in this design: the **loader** names what is happening to
their cast (*"Making voices from your words"*, *"Recording {name}'s audition"*), never what does
it (#55's honest-loader line); a **refusal** says what was refused and what to do, never
"quota", "slot" or "voice limit" (§6); and the **labels** are Voice 1–3, never a provider id.
*Declined, and named as the simpler road*: drawing the engine's raw preview text or its
`generated_voice_id` as a caption.

## 3 · The engine, read at the wire (the spike, 2026-10-13, scratch only)

Every number below is measured by the spike on #499 (receipts in its comments; the request log
is `drape-scratch/n4b-spike/out/log.txt`, not committed). Nothing here comes from a leaderboard.

| Step | Road | Measured |
|---|---|---|
| Design (sentence → 3 previews) | `POST /v1/text-to-voice/design`, model `eleven_ttv_v3` | **6.4–9.9 s** over ten designs; **about $0.01** per design; previews **13.6–16.9 s** long |
| Speak with an unsaved preview | `POST /v1/text-to-speech/{generated_voice_id}` | **404 `voice_not_found`** — a preview cannot speak a new line until saved |
| Save a preview (Keep) | `POST /v1/text-to-voice` with the preview's id | **1.6–1.7 s**; uses **1 slot** and **1 voice operation** |
| Speak a line with a saved voice | `POST /v1/text-to-speech/{voice_id}`, `eleven_v3` | **1.4–5.3 s**; **about $0.001** per line |
| Delete a saved voice | `DELETE /v1/voices/{voice_id}` | frees the slot; **does NOT refund the voice operation** (counter stayed at 1 after the delete) |
| Save a preview later | the same save call on preview 2's id | worked **~53 s** after its design; how long a preview id stays saveable is **unmeasured** |

**The account, read live** (`GET /v1/user/subscription`): tier **pay-as-you-go**; **3** voice
slots; **54** voice operations a month (`max_voice_add_edits`), of which the spike itself used
**9** on 2026-10-13; character allowance **37,472**, of which the spike used **3,702**;
**`can_use_instant_voice_cloning: false`** (#499, his card). A design does not touch the
voice-operation counter (it read 0 after the first design and 1 after the first save).

**Format.** Inworld's previews arrived as WAV; that no longer applies. ElevenLabs returned every
preview and every spoken line as **MP3** (`media_type: "audio/mpeg"`), because the spike asked
for `output_format=mp3_44100_128` on every call; a preview was 217–270 KB. The format is a
request parameter, so the provider asks for it explicitly rather than inheriting a default, and
the stored clip is MP3 at that setting.

**Unmeasured, and measured inside slice 1 rather than assumed:** the cost, wait and size of a
~90 s audition clip; how long a preview id stays saveable; whether `eleven_v4` (now listed) is
the better speaking model on his ear; and the six unexplained 350-character "Voice Generation"
charges on #499 (02:08–02:15 UTC), which must be accounted for before money is reckoned per
design.

## 4 · Storage — the clip is the asset, the slot is a cache

**At Keep, in this order, and Keep is not done until all three are:**

1. **Save** the chosen preview to a slot → a `voice_id`. One voice operation.
2. **Record the audition**: the saved voice reads a fixed house passage of about 90 seconds.
   One passage for every cast, so every clip is comparable and is a good source for a re-mint;
   its text is written once, in slice 1, and kept in the repository.
3. **Store the clip** beside the cast's voice line, with its sha256, its length and the voice
   line **as it read when the voices were made** — the design history, because the same words
   give a different voice every run (#499: the spike confirmed it even with the same seed).

**A new owner-scoped table, `cast_voices`** (the M8b plan's name; an additive migration):
the cast, the owner, the design sentence, the clip's storage key, sha256 and length, the
`voice_id` while it is resident (nullable), `lastUsedAt` for the cache, and when it was kept.
Its creative fields are the same family as `masterPrompt` and the voice line: owner-only, on
`REFUSING_KEYS`, in no staff projection, in the GDPR export, and released by the deletion
tombstone — which deletes the slot (when resident) and the clip with the cast.

⚠ **The clip is a cloning source, so it gets no public address.** Anyone holding 90 seconds of a
voice can clone it once cloning is on any account, which makes the clip closer to the recipe
than to a picture. It is never projected as a URL: it is served by an owner-only authenticated
route on the `/api/reference/:referenceId` shape (owner in the `WHERE`, sha256 refused on
mismatch), **added to CLAUDE.md's enumerated authenticated-Express list in the same commit that
creates it**. Whether the object itself belongs in the private evidence bucket rather than the
public one under a random key is read at `server/storage.ts` in slice 2 and stated on its PR.

**The previews** (three MP3s and their ids) are held under the cleanup-manifest pattern for the
life of a preview id, so a reload does not lose a paid design, and are swept after.

**The cache, and what it waits on.** With slots as a cache, a Keep on a full account evicts the
least-recently-used voice, and a later need for an evicted voice re-mints it by instant-cloning
the stored clip. **Both halves need instant voice cloning, which is OFF on his pay-as-you-go
plan.** Until he upgrades, nothing is evicted: on his account, dark, every kept voice stays in
its slot, and a fourth Keep while three slots are full **refuses** in plain words (§6). That is
declared scaffolding under the fidelity law — the real source (eviction and re-mint) is slice 4
and is on the board, blocked.

⚠ **And the re-mint court comes before the eviction code, because it decides whether eviction
is allowed at all** (#499, his paste): design a voice, save it, record the 90 s clip, delete it,
clone it back from the clip, and play the original and the re-mint side by side to **his ear**
(law 9). If they match, slots stop mattering. If they drift, signed casts keep pinned slots, and
the plan tier becomes the product's ceiling on kept voices.

⚠ **Both waits above are over, and the paragraph is kept as the record (2026-10-14, #2472).** His
plan was upgraded to Creator on 2026-10-13 (instant cloning on), and the court passed by his ear
the same day, verbatim: *"remint actually sounds better in some cases both 90s clips were great
though."* Eviction and re-mint are built in `server/castingV2/voiceService.ts`
(`makeRoomForOneVoice`, `ensureCastVoiceResident`): a full plan evicts the least-recently-used
voice instead of refusing, and still refuses on a plan that cannot clone, read live.

## 5 · Rations — the voice-operation quota is the scarce thing, not slots

**54 voice operations a month on this account** (290 on Pro, 1,040 on Scale, #499). Every save
and every clone spends one, and a delete gives none back (measured). A design spends none.

- **Spend only at Keep.** Previews, playback and "Make new voices" never touch the quota.
- **Read before spending.** Keep reads the counter first; if this month's operations are spent,
  Keep refuses before anything is saved or charged. The refusal is a real error the client can
  tell apart, never a 200 carrying a message (invariant 6), and it refuses — not allows — when
  the read itself fails (invariant 7).
- **The cache must genuinely cache** (slice 4): a re-mint spends an operation, so a voice is
  re-minted only when something is about to speak with it, never to keep a slot warm.
- **It is per account, not per customer.** 54 a month is the whole product's ceiling on Keeps
  while the plan stands, which is why the scope is his account until the plan changes and why
  the house sees the month's remaining operations on the admin panel (slice 3).

## 6 · Words on the card

The voice line keeps its place on top, as #2140 asks. Copy below is a starting point for the
builder and his eye, never the vendor's:

- Making: *"Making voices from your words"* (about 7–10 s, measured).
- Keeping: *"Recording {name}'s audition"* (wait unmeasured; slice 1 measures it).
- After Keep: the player plays the clip; the foot names it *"{name}'s voice"* and replaces
  *"No voice yet"*.
- A full account (dark phase only) or a spent month: *"Voices can't be kept right now. The ones
  you made will still be here — try Keep again later."* Then the previews stay playable for as
  long as their ids live.
- A failed design: *"Those voices didn't come through. Nothing was charged — try again."*

No string names a model, a provider, a slot, a quota or a clone. A name falls back to
"their" / "this character" when the cast has none, and no string genders anyone.

## 7 · Price — a placeholder, priced later

**"Make new voices from this text · <credits>"** carries a placeholder figure, priced under the
pricing laws by the pricing rung (#2140: *"The price is an example; Cid prices it."*). The
measured cost it will be priced against: **about $0.01 per design** (three voices) and **about
$0.001 per spoken line**. The first three voices are made without a press when the card first
opens with voice on — *"a text-to-voice design step that runs alongside the text, not later"*
— and whether that first design is house-paid or charged is part of the same pricing question.
The cost of Keep's 90 s clip is **unmeasured** and is measured in slice 1 before anything is
priced.

## 8 · Build cards, in slice order

1. **N4b-1 — the voice road, dark.** An ElevenLabs provider in `server/providers/` implementing
   `VoiceEngine` (`server/providers/types.ts`, today a stub with no implementation): design →
   three MP3 previews, save, speak, delete; MP3 asked explicitly. Behind its key
   (`ELEVENLABS_API_KEY`, read from `.env` locally and set on Railway by his hand) and a new
   scope flag `CASTING_VOICE_SCOPE` (child of `CASTING_V2_SCOPE`; boot refusal when on without
   the key; catalogued in `docs/architecture/FEATURE_FLAGS.md` and indexed in CLAUDE.md in the
   same commit). The `cast_voices` table (additive), the Keep sequence of §4 with the quota read
   of §5, the house audition passage, deletion and GDPR handling. Capability-atlas doors ride
   the commit. No UI. **Done when:** driven on his account through the real entrance — a design
   returns three MP3 previews, a Keep saves, records and stores the clip with its sha256 and
   writes the row, and the counter is read before and after; Keep with the key absent, with the
   quota read failing and with three slots full each refuse cleanly (driven directly, not
   through a model); deleting the cast releases the slot and the clip; and the slice's receipt
   states the measured cost, wait and size of a 90 s clip, how long a preview id stayed
   saveable, and what the six unexplained "Voice Generation" charges were.
2. **N4b-2 — Listen and pick on the Voice card, dark on his account** (builds on N4b-1). The
   first three made when the card opens; Voice 1–3 with play and a waveform under the voice
   line; *"Make new voices from this text · <credits>"* with the placeholder price; **Keep
   "Voice N"**; the kept clip in the existing player in place of *"No voice yet"*. The
   owner-only route serving previews and the clip, added to CLAUDE.md's enumerated
   authenticated-Express list in the same commit; the bucket question of §4 answered on the PR.
   **Done when:** rendered in the running app in both themes and passed by the relay's eye, his
   ear has picked and kept a voice on a real signed cast, and no customer string names the
   technology (a test reads every string on the card for vendor and pipeline words).
3. **N4b-3 — ready to widen** (builds on N4b-2). The price from the pricing rung in place of the
   placeholder; the month's remaining voice operations on the admin panel (a count, staff-only,
   no creative content); the refusals of §6 driven in the running app; the briefing ladder and
   `CASTING_V2_PLAN_REBASELINE.md` §4/§6 carrying N4b with one engine. **Done when:** the button
   carries a real price, the house can see the month's ration before a customer meets its end,
   and every refusal has been seen in both themes. Widening beyond his account stays his word.
4. **N4b-4 — the cache: re-mint court, then eviction and re-mint — BLOCKED on his plan
   upgrade** (instant voice cloning is off on pay-as-you-go). First the court of §4 to his ear,
   on his account through the real entrance. Then, only if he hears a match: least-recently-used
   eviction when slots run short, and re-mint by instant-cloning the stored clip on a miss,
   spending an operation only when something is about to speak. If he hears drift: signed casts
   keep pinned slots and this slice closes on that ruling instead. **Done when:** the court's
   frames-equivalent — the original and the re-mint, side by side — is in front of his ear and
   his verdict is quoted; and, on a match, a fourth Keep on a three-slot account evicts, a later
   use re-mints, and the counter moves by exactly the operations spent.

Order: 1, then 2, then 3; 4 waits on his upgrade and its court runs before any of its code. A
finding made while building any of these is its own card, never folded in (his 2026-09-24
ruling).

## 9 · What is deliberately absent

- **Cinema's convert-on-keep.** Speaking a take in the engine's own scratch voice, then
  converting the dialogue speech-to-speech into the cast's voice and remixing, is **cinema's
  work**, not N4b's. N4b's job is that the cast has a voice to convert into.
- **Inworld, and any second engine.** Dropped by his ear (the settled list at the top). No fallback provider.
- **A model picker.** Voice is a casting door, not a generator; the default is the only path.
- **The voice line driving the voice.** Editing the line after Keep does not replace the kept
  voice; it only changes what the next "Make new voices" is made from. A kept voice is changed
  only by keeping another.
- **Voice cloning from a customer's own recording.** Not asked for, and a consent question of
  its own.
