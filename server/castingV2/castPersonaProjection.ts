/**
 * WHO SHE IS ON CAMERA AND HOW SHE SOUNDS, AS HER ROOM READS IT — N2b (#1242).
 *
 * His brief stores two text columns and three timestamps, and says the badge is
 * DERIVED rather than stored. This is that derivation, in one exported function,
 * so the room, the edit's reply and `castPersonaProjection.test.ts` all read one
 * rule. A boolean `isDraft` column would be a second fact about the same thing
 * and would outlive the edit that was supposed to clear it — working law 4 on a
 * customer's own words.
 *
 *     a line is a DRAFT  <=>  it was drafted and has not since been edited
 *
 * ⚠ **ABSENT IS NOT EMPTY.** A Cast signed before N2b has no lines at all, and
 * so does a Cast whose read failed. Both answer `null` here and the room draws
 * NO CARD — never an empty card with a badge on it, which is the "feature that
 * looks broken" his brief rules out.
 *
 * ⚠ **THESE ARE THE CUSTOMER'S OWN WORDS AND NOBODY ELSE'S.** The two lines are
 * the same family as `masterPrompt` under his ruling of 2026-07-25: owner-only.
 * This function is reached from `projectSignedCast`, which only ever runs behind
 * an owner-scoped read — no staff projection calls it and none may.
 */

/** What the room is handed for one of the two lines. */
export type CastPersonaFieldProjection = {
  text: string;
  /** Ours until she touches it. The room badges a draft and nothing else. */
  drafted: boolean;
};

export type CastPersonaProjection = {
  personality: CastPersonaFieldProjection | null;
  voice: CastPersonaFieldProjection | null;
};

/** The five columns, by the names the row carries them under. */
export type CastPersonaRow = {
  personality: string | null;
  voice: string | null;
  personaDraftedAt: Date | null;
  personalityEditedAt: Date | null;
  voiceEditedAt: Date | null;
};

/**
 * ⚠ **THE WHOLE THING IS NULL ONLY WHEN BOTH LINES ARE, and that matters for
 * one real case**: a Cast drafted both lines, she rewrote one to nothing — the
 * edit entrance forbids an empty line, so this cannot happen today — or a row
 * was written by a road that set one column. Returning a half-object lets the
 * room draw the card it has and say nothing about the one it does not, which is
 * strictly more honest than hiding both because one is missing.
 */
export function projectCastPersona(row: CastPersonaRow): CastPersonaProjection | null {
  const personality = line(row.personality, row.personaDraftedAt, row.personalityEditedAt);
  const voice = line(row.voice, row.personaDraftedAt, row.voiceEditedAt);
  if (!personality && !voice) return null;
  return { personality, voice };
}

function line(
  text: string | null,
  draftedAt: Date | null,
  editedAt: Date | null,
): CastPersonaFieldProjection | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  /*
    DRAFTED, AND NOT SINCE EDITED. Both halves are load-bearing:

    - no `personaDraftedAt` means nothing ever drafted this line, so it is hers
      however it got there and wears no badge;
    - an `…EditedAt` means she has rewritten it, so the badge is gone even
      though the draft stamp is still on the row — the stamp is WHEN we drafted,
      not WHOSE the words are now.
  */
  return { text: trimmed, drafted: Boolean(draftedAt) && !editedAt };
}
