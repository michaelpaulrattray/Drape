# N2d — the Klieg ID becomes a record of creation (design, 2026-10-12)

**Card: #2134.** Written by the escalated Fable design shift (foreman-20261012-1248), on his
word opening the rung (Desk reply #280, 2026-10-12, verbatim and entire: *"N2d"*) and on the
plan he pasted onto the card. This document is the design the card points at; the build cards
are cut from its §7 slice order and nothing else is in the rung.

**Settled before this design and not re-asked:** every customer string says **"evidence of
creation"**, never "proof of ownership". His advisor's reading stands: prompts alone earn no
US copyright, Australia has no AI ruling, so a product promising ownership would promise what
it cannot deliver.

---

## 1 · What a customer gets, in their terms

Every signed cast already carries a Klieg ID (`KI-…`), drawn on the master's lock with his
sentence as its tooltip: *"A unique identifier for this character. It records when and by whom
this character was made."* Today that sentence is a promise the product keeps only in its own
database. N2d makes it checkable:

- **Behind each ID, a signed and independently timestamped record** — who made the cast, when,
  a fingerprint of the master picture, and the steps taken (rolled → refined → chosen →
  signed). Made automatically. The customer does nothing.
- **A downloadable Certificate of Creation** — one button on a signed cast's page. A restrained,
  editorial document carrying the ID, the maker, the dates, the master picture, the fingerprint
  and the steps, headed with the honest sentence: *"This certifies that this character was
  created in Klieg. It is evidence of creation, not a registration of ownership."*
- **An optional public check page, OFF by default** — the owner may turn on a page where anyone
  with the ID can confirm it is real and when it was made, and see nothing else.

None of the competitors on the card's reading offer a per-character certificate; this is a
differentiator built almost entirely from facts the product already holds.

## 2 · The disappearing-technology gate, answered in this body

**Q1 — What must the customer learn to use this?** Nothing. The record is made inside the Sign
they already perform (and made on first request for casts signed before this ships). The
certificate is one button. The check page is one toggle. There is no step where a customer
meets a hash, a signature, a token or a service name; the certificate says what happened in
plain words ("independently timestamped on 12 October 2026") and the one technical artifact it
shows — the fingerprint — is presented the way a passport number is: a fact to quote, not a
concept to understand.

**Q2 — What decision does it put in front of them, and have they any basis for it?** Exactly
one: whether the public check page is on. The default is OFF (his 2026-07-25 ruling: no one
should be able to steal or copy their work). The toggle's copy states the whole consequence in
one sentence — *"Anyone with this ID can confirm it is real and when this character was made.
They never see the picture, your brief, or your account."* — and shows the page before it goes
on. A yes/no whose consequence is stated and shown is a decision with a basis. Nothing else is
asked: no format choice, no "which service", no settings.

**Q3 — Where does the technology show?** On no path a customer must walk. The main surfaces
carry customer vocabulary only: *evidence of creation*, *independently timestamped*,
*fingerprint of the master picture*. No vendor name, no algorithm name, no token anywhere a
customer reads. The downloadable file carries, as an appendix nobody must open, the signed
record and timestamp token that make independent verification possible — that appendix is the
one place the machinery is visible, it is inert to the reading experience, and it exists
because a certificate that cannot be verified would be decoration. (The engine half, clauses
1–4, is §5.)

## 3 · The record — what it holds, and the bound on what it may ever show

Read at the schema this shift (law 7c): `models.agencyId` (the ID), `userId` (by whom),
`createdAt`/`mintedAt` (when), `sourceRollId` + `sourceCandidateId` (the lineage), and the
sealed identity snapshot already written inside the Sign transaction. **The rung is mostly
signing and presenting facts the product already holds.** One fact is NOT held anywhere:
**no hash of the master image bytes exists** — the sha256 digests in the tree are the ink
crops' (`signService.ts:846`) and the identity text's (`castingV2Sign.ts:520`), never the
anchor's. The record adds it.

The record is a canonical JSON document, one per signed cast (`cast_creation_records`,
additive migration):

| field | source | note |
|---|---|---|
| the Klieg ID | `models.agencyId` | legacy `MOD-…` ids equally |
| who | the owning account's display name + account id | never the email |
| when | `createdAt`, `mintedAt` | plus the record's own stamp time |
| master fingerprint | sha256 of the anchor asset's bytes | computed at mint; backfilled on first request |
| the steps | event dates and counts derived from the roll → candidate → refinement rows | **events only — never the brief, never a refine's words** |
| record version | constant | the recipe-version pattern the Sign already uses |

**THE BOUND, the rung's most important sentence:** `masterPrompt`, `technicalSchema` and
`preferences` are together the complete recipe for reproducing a cast (his 2026-07-25 ruling,
CLAUDE.md's *"A customer's cast is their work"*). **Not one of them — and not the brief, the
refine asks, the identity text, or any other creative content — ever appears in the record, on
a certificate, or on a public page.** The steps record carries the human-authorship story as
*events* (what was done, when, how many times), which is what the legal argument needs, with
the creative content itself staying sealed in the account where it already lives.

**Deletion:** a deleted cast's record dies with it — the tombstone already scrubs the model,
the join drops the candidate, and the same deletion turns the public page off and the
certificate road dark. Gone stays gone (his standing rule).

## 4 · Signing — Klieg's own signature

The record is signed with an Ed25519 key (`jose` is already in the tree and speaks EdDSA;
`JWT_SECRET`'s HS256 is symmetric and therefore unsuitable — a signature anyone can verify
must come from a key pair whose private half never leaves the service). New production secret
`CREATION_RECORD_PRIVATE_KEY`, set by his or the relay's hand (a Railway variable is never a
shift's). The boot rule follows the house pattern (`R7_EVIDENCE_INGEST_SCOPE`'s shape): the
scope flag on with the key absent **refuses boot and names the variable** — a signing feature
with no key must refuse, not improvise (invariant 7's spirit). The public half is served on
the check page and embedded in the certificate's appendix.

## 5 · The timestamp — a capability choice under clauses 1–4, measured this shift

**The job:** fix the record's existence at a point in time attested by someone who is not
Klieg, cheaply, at Sign-time latency, verifiable years later without a subscription.

**Measured 2026-10-12, real requests from this machine** (RFC 3161 query over the record-hash
shape, sha256, `openssl ts` both ends, both replies parsed `Status: Granted`):

| option | price | latency (measured) | verdict |
|---|---|---|---|
| **DigiCert public TSA** (`timestamp.digicert.com`) | $0 | 0.43–0.46 s warm, 1.6 s cold | **the default** — CA-operated and audited, token verifiable offline forever |
| **FreeTSA** (`freetsa.org/tsr`) | $0 | ~1.0 s | **the fallback** — community-run; new P-384 chain valid to 2040 |
| OpenTimestamps | $0 | stamp instant, **final proof hours** (Bitcoin confirmation); verification needs chain access | declined — wrong latency and wrong verification story for a customer document |
| paid TSAs (SSL.com et al.) | contract | comparable | declined — adds a contract without adding trust for this job |

**Chosen:** RFC 3161, DigiCert primary, FreeTSA fallback, the DER token stored beside the
record; which authority answered is recorded internally and **never named to the customer** —
every surface says *"independently timestamped"*. A TSA that refuses or times out never fails
the Sign (the ink-plate rule): the record retries, and until a token lands the certificate
simply does not offer itself. **Dated 2026-10-12; like every engine choice this one carries an
expiry — a rung touching this road re-asks it.**

**Honesty rule for backfilled records:** the timestamp proves the *record* existed when
stamped, not when the cast was made. A cast signed before this ships gets its record on first
request, and its certificate says both dates plainly: *"Created 3 September 2026 · recorded
and timestamped 14 October 2026."* New Signs stamp at mint, so the two dates ride together.

## 6 · The terms — a lawyer's, and what this shift read so the pack is ready

**No shift publishes a terms change, and no customer-visible string asserts "we don't train on
your characters" until (a) the lawyer signs the terms and (b) the provider positions below are
set and read back.** What was read this shift, at the primary sources, each with its date:

- **fal** (Terms, updated 2026-09-08): the customer owns and retains the Customer Input
  (§6(b)); inputs and outputs are the customer's Confidential Information (§7(a)); no clause
  trains on customer content. ⚠ **One clause for the lawyer:** §6(c) lets fal use "Usage
  Data" — anonymized or aggregated data that *"may include data based on or derived from
  Customer Input"* — *"to design, develop, and offer Company products, services, and AI
  models."* Whether that clause is compatible with the sentence we want to publish is
  precisely a lawyer's question. Outputs are not expressly assigned by fal, which the terms
  change (Klieg hands its output rights to the customer) must account for.
- **Google Gemini API** (additional terms effective 2026-03-23, updated 2026-04-28), which
  still receives pictures on the wardrobe/VTO road: **paid tier** — *"Google doesn't use your
  prompts (including … files such as images …) or responses to improve our products"*; unpaid
  tier trains. **A build card confirms the account stands on the paid tier** — the sentence is
  only true on one of the two.
- **OpenRouter**, which receives customer pictures (the judge/describe calls send base64
  images — read at `server/providers/openrouterText.ts:84`): OpenRouter is a router, so the
  true answer lives in the account's own settings — an account-level opt-out stops routing to
  providers that train, and per-request data-policy restriction exists. **Setting that
  position on the production account and reading it back is a hand act in this rung** (his or
  the relay's — it is his account).

The three terms changes from his plan (rights in outputs handed to the customer; each
character's ID and master look private to the account; no training on their characters) go to
the lawyer as a pack: the plan, this section's quotes and dates, and the provider-position
receipts. That handoff is his, batched on the Desk.

## 7 · Build cards, in slice order

1. **N2d-1 — the record, signed and timestamped, dark.** The table (additive), the canonical
   record builder with the §3 bound, Ed25519 signing, RFC 3161 stamping with fallback, minted
   inside Sign without ever failing it, backfill-on-first-request for existing signed casts.
   Dark behind `CASTING_CREATION_RECORD_SCOPE` (child of the casting chain); boot refusal when
   scoped on without the key. Capability-atlas entry rides the commit. No UI.
2. **N2d-2 — the Certificate of Creation** (builds on N2d-1). The owner-only download road on
   the character-sheet route's shape — owner re-proved in the statement that loads the cast,
   **added to CLAUDE.md's enumerated authenticated-Express list in the same commit that
   creates it** — and the certificate document itself: restrained, editorial, monochrome,
   print-faithful; the signed record + token as the appendix. The one button on the signed
   cast's page. Customer-visible → the relay's eye on the rendered document.
3. **N2d-3 — the public check page, off by default** (builds on N2d-1). The owner toggle with
   the consequence sentence and preview; the public route keyed on the ID — **a deliberate
   addition to the public-endpoint allowlist in the same commit**, rate-limited, strict input,
   and **no existence oracle**: an ID whose page is off and an ID that does not exist answer
   identically. Shows: ID validity, the cast's name, the maker's display name, the dates.
   Never the picture, never any creative content.
4. **N2d-4 — provider positions and the lawyer pack** (independent; hand acts). Set the
   OpenRouter account's no-training position and read it back; confirm the Gemini account's
   paid tier; assemble §6 into the lawyer pack on his Desk. Blocked on him by nature and says
   so.

Order: 1, then 2 and 3 (either order), 4 any time. A finding made while building any of these
is its own card, never folded in (his 2026-09-24 ruling).

## 8 · What is deliberately absent

- No blockchain, no registry, no third-party verification SaaS — the record is a file Klieg
  signs and a standard token anyone can check; everything else was declined in §5.
- No "verified" badges in the library, no certificate upsell, no watermark (his standing word).
- No public registry of IDs — the check page is per-cast, owner-opted, and blind to absence;
  the deleted public registry (CLAUDE.md) is not being rebuilt by a side door.
- No change to what Sign costs or how it behaves when the record road fails — the cast and the
  views are worth having; the record catches up.
