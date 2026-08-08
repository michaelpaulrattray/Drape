/**
 * A SENTENCE WE WROTE FOR A PERSON, MARKED AS ONE — on the wire.
 *
 * # The defect this closes, with a customer's name on it
 *
 * Run-15's step 2 was refused honestly at 293.0 seconds and the server wrote
 * her the true sentence: *"That one came back twice without fox eyes, so it
 * wasn't delivered and your credits have been returned."* At 323.6 seconds the
 * panel showed her *"We lost contact while that was rendering"* instead. The
 * honest answer existed thirty seconds before she was told the transport had
 * lost it, and it never reached her.
 *
 * The client is not at fault for dropping it. Its rule is right — *never show
 * the error's sentence, show ours* — and it decided ours by the tRPC code,
 * because a gateway cannot author a 400 or a 403. But an authored refusal was
 * being thrown as `INTERNAL_SERVER_ERROR`, which is the bucket every unhandled
 * crash lands in, so the one thing the client must never trust was carrying the
 * one thing it must always show. Five sentences rode that code; three of them
 * say **"Nothing was charged"** and were replaced by a sentence promising her
 * credits would come back — money language wrong in the other direction, on the
 * surface where she is working out whether she paid.
 *
 * # Why a marker and not a longer list of codes
 *
 * The list of authored codes is exactly what drifted. So this is the second
 * kind of evidence rather than a second copy of the first: the throw site says
 * *this message was written to be read*, structurally, and the error formatter
 * puts that on the outgoing payload. The client trusts `spoken` OR an authored
 * code — a new refusal that forgets the marker still works if its code is one
 * a gateway cannot forge, and a refusal that needs an unforgeable-looking code
 * for other reasons still reaches her if it is marked.
 */

/** The flag's name on the error payload. One spelling, both sides. */
export const SPOKEN_ERROR_FLAG = "spoken";

/**
 * Did our own server write this message for a person to read?
 *
 * Reads the serialized payload rather than an instance, because by the time the
 * client sees it there is no class left — only JSON.
 */
export function errorIsSpoken(error: unknown): boolean {
  const data = (error as { data?: Record<string, unknown> } | null | undefined)?.data;
  return data?.[SPOKEN_ERROR_FLAG] === true;
}
