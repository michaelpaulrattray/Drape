import { Clapperboard, Plus } from "lucide-react";

/**
 * AFTER A SIGN, ONE OFFER TO FILE THE NEW CAST — rung N2c, slice S7, card #2253.
 *
 * His rulings, from the rung's parent card: *"never shown to an account with no
 * shoots — with none, its only offer is 'create a shoot', a setup step wearing a
 * question"* (the noun is Campaign since 2026-09-29), and the brief's refusals:
 * *"dismissible, don't-ask-again, never blocks Sign, never silent auto-filing."*
 *
 * HOW EACH OF THOSE IS HELD, so a reader can check it rather than trust it:
 *
 * - NEVER BLOCKS THE SIGN. The sheet's Sign success only writes a marker into
 *   memory before it navigates exactly as it always did (`markJustSigned`); the
 *   offer is drawn later, on the cast page, inside the IN CAMPAIGNS panel. A
 *   customer who ignores it loses nothing and waits on nothing.
 * - NEVER FOR AN ACCOUNT WITH NO CAMPAIGNS. `postSignOfferState` answers "gone"
 *   the moment the campaign list arrives empty, and that answer is final for
 *   this visit — making a campaign afterwards does not make the offer appear.
 * - NEVER FILES BY ITSELF. Nothing here calls the store; a row is a button, and
 *   only its press files, through the panel's own `addCastsToCampaign` road.
 * - ONCE. The marker lives in memory and is taken on first read, so a reload, a
 *   second visit or another cast's page never sees it again.
 * - "DON'T ASK AGAIN" IS KEPT in this browser, PER ACCOUNT (#2274), under a
 *   versioned key. Storage that throws (a private window, blocked site data)
 *   reads as "not silenced" and the write is a no-op — the offer then simply
 *   asks again next Sign.
 */

/* ---------------------------------------------------------------- the marker */

const justSigned = new Set<string>();

/** Called by the Sign's success, before it navigates. Memory only; cannot fail. */
export function markJustSigned(castId: string): void {
  if (castId) justSigned.add(castId);
}

/** Whether this cast was just signed in this tab, without using the marker up. */
export function peekJustSigned(castId: string): boolean {
  return justSigned.has(castId);
}

/** True once per Sign: the marker is removed as it is read. */
export function takeJustSigned(castId: string): boolean {
  return justSigned.delete(castId);
}

/* ------------------------------------------------------- "don't ask again" */

/*
  ONE ACCOUNT'S CHOICE IS THAT ACCOUNT'S — #2274. Until then the choice sat
  under one fixed key, so a second account signing in on the same browser never
  saw the offer and was never told why.

  WHY THE KEY CARRIES THE EMAIL'S FINGERPRINT, NOT THE ACCOUNT ID. The card
  asked for the id, and the client does not have one: `auth.me` is a positive
  projection that deliberately leaves `id` out (`server/routes/auth.ts`, pinned
  by `server/auth.me.test.ts`), and widening that boundary for a UI preference
  is a decision of its own. The email IS in that projection, is one per
  account, and nothing in the product changes it. It is kept only as a short
  one-way fingerprint, so a shared machine holds no address in its site data
  after the person signs out. This is not a secret from anyone — the same page
  can read the email from `auth.me` — it is simply not left lying about.
*/

/** The pre-#2274 key. Read once, by the first account to ask, and then removed. */
export const POST_SIGN_OFFER_SILENCED_KEY = "drape_postsign_campaign_offer_v1";

type OfferStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** FNV-1a over the lower-cased address: stable, synchronous, and not the address. */
export function accountFingerprint(email: string): string {
  let hash = 0x811c9dc5;
  for (const char of email.trim().toLowerCase()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** The key one account's choice is kept under. */
export function postSignOfferSilencedKey(email: string): string {
  return `${POST_SIGN_OFFER_SILENCED_KEY}:${accountFingerprint(email)}`;
}

/**
 * Whether THIS account said "don't ask again". The old unscoped key is honoured
 * once: the first account to read it takes it over and it is removed, so it can
 * never silence a second account. Storage that throws reads as not silenced.
 */
export function isPostSignOfferSilenced(
  email: string,
  storage: Partial<OfferStorage> | undefined = safeStorage(),
): boolean {
  if (!email) return false;
  try {
    if (storage?.getItem?.(postSignOfferSilencedKey(email)) === "never") return true;
    if (storage?.getItem?.(POST_SIGN_OFFER_SILENCED_KEY) !== "never") return false;
  } catch {
    return false;
  }
  /* The legacy choice: kept for this account, then retired. */
  silencePostSignOffer(email, storage);
  try {
    storage?.removeItem?.(POST_SIGN_OFFER_SILENCED_KEY);
  } catch {
    /* Could not remove it; it is read again next time, which is no worse than before. */
  }
  return true;
}

export function silencePostSignOffer(
  email: string,
  storage: Partial<OfferStorage> | undefined = safeStorage(),
): void {
  if (!email) return;
  try {
    storage?.setItem?.(postSignOfferSilencedKey(email), "never");
  } catch {
    /* Nowhere to keep it: the offer asks again after the next Sign, which is the honest fallback. */
  }
}

function safeStorage(): OfferStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/* -------------------------------------------------------------- the decision */

/** "pending": waiting on the campaign list or the account. "showing": drawn. "gone": never again this visit. */
export type PostSignOfferState = "pending" | "showing" | "gone";

/**
 * The offer's next state. Pure, so every refusal above is driven directly.
 * `campaigns` is the customer's whole list (`undefined` while it loads);
 * `silenced` is this account's "don't ask again" (`undefined` until the
 * signed-in account is known, so no account is ever read as another's).
 */
export function postSignOfferState(
  current: PostSignOfferState,
  campaigns: readonly unknown[] | undefined,
  silenced: boolean | undefined,
): PostSignOfferState {
  if (current !== "pending") return current;
  if (silenced === true) return "gone";
  if (campaigns === undefined || silenced === undefined) return "pending";
  return campaigns.length > 0 ? "showing" : "gone";
}

/* -------------------------------------------------------------- the drawing */

export type PostSignCampaignOfferProps = {
  castName: string;
  /** The campaigns the cast could go into — never one it is already in. */
  campaigns: { campaignId: string; name: string; castCount: number }[];
  busy: boolean;
  refusal: string | null;
  onFile: (campaignId: string) => void;
  onNotNow: () => void;
  onNever: () => void;
};

function castCountLine(count: number): string {
  return count === 1 ? "1 cast" : `${count} casts`;
}

/**
 * A CAMPAIGN ROW'S MARK — card #2308, his word 2026-10-12: *"build D"*, the
 * clapperboard option, chosen over face previews because faces on these rows
 * would compete with the Siblings panel below them (*"doesnt a Conflict with
 * siblings design though"*). A campaign has no picture of its own, so the row
 * carries a mark rather than a thumbnail. It is decoration only — the name
 * beside it carries the meaning — so it is hidden from assistive technology.
 * One component for every campaign row (the panel's memberships, its picker,
 * and this offer), so the lists cannot drift apart.
 */
export function CampaignRowIcon() {
  return (
    <span className="dpc-camp__icon" aria-hidden="true">
      <Clapperboard size={18} strokeWidth={1.6} aria-hidden="true" />
    </span>
  );
}

export function PostSignCampaignOffer({
  castName,
  campaigns,
  busy,
  refusal,
  onFile,
  onNotNow,
  onNever,
}: PostSignCampaignOfferProps) {
  return (
    <div className="dpc-camp__offer" role="group" aria-label="Add to a campaign">
      <p className="dpc-camp__offer-q">
        Add <span className="dpc-camp__offer-name" title={castName}>{castName}</span> to a campaign?
      </p>
      <ul className="dpc-camp__list" aria-label="Your campaigns">
        {campaigns.map((row) => (
          <li key={row.campaignId}>
            <button
              type="button"
              className="dpc-camp__row dpc-camp__row--pick"
              disabled={busy}
              onClick={() => onFile(row.campaignId)}
            >
              <CampaignRowIcon />
              <span className="dpc-camp__text">
                <span className="dpc-camp__name" title={row.name}>{row.name}</span>
                <span className="dpc-camp__meta">{castCountLine(row.castCount)}</span>
              </span>
              <Plus size={12} strokeWidth={2} aria-hidden="true" className="dpc-camp__chev" />
            </button>
          </li>
        ))}
      </ul>
      {refusal ? (
        <p className="dpc-camp__refusal dpc-camp__offer-refusal" role="alert">{refusal}</p>
      ) : null}
      <div className="dpc-camp__offer-foot">
        <button type="button" className="dpc-camp__offer-no" onClick={onNotNow}>
          Not now
        </button>
        <button type="button" className="dpc-camp__offer-no" onClick={onNever}>
          Don&rsquo;t ask again
        </button>
      </div>
    </div>
  );
}
