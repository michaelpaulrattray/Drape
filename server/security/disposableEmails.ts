/**
 * Disposable Email Domain Blocklist
 *
 * Blocks known temporary/throwaway email providers to prevent
 * referral fraud via disposable accounts.
 *
 * Maintained server-side — easy to update without client changes.
 */

const DISPOSABLE_DOMAINS = new Set([
  // Major disposable providers
  "guerrillamail.com", "guerrillamail.de", "guerrillamail.net", "guerrillamail.org",
  "guerrillamailblock.com", "grr.la", "sharklasers.com", "guerrilla.ml",
  "tempmail.com", "temp-mail.org", "temp-mail.io", "temp-mail.de",
  "mailinator.com", "mailinator2.com", "mailinater.com",
  "yopmail.com", "yopmail.fr", "yopmail.net",
  "throwaway.email", "throwaway.com",
  "10minutemail.com", "10minutemail.net", "10minutemail.org",
  "minutemail.com",
  "trashmail.com", "trashmail.net", "trashmail.org", "trashmail.me",
  "mailnesia.com", "mailnesia.net",
  "dispostable.com",
  "maildrop.cc", "maildrop.ml",
  "fakeinbox.com", "fakemail.net",
  "tempail.com",
  "getnada.com", "nada.email",
  "mohmal.com", "mohmal.in",
  "burnermail.io",
  "mailsac.com",
  "harakirimail.com",
  "discard.email",
  "mailcatch.com",
  "tempr.email",
  "emailondeck.com",
  "33mail.com",
  "mytemp.email",
  "tempinbox.com",
  "sharklasers.com",
  "spam4.me",
  "binkmail.com",
  "bobmail.info",
  "chammy.info",
  "devnullmail.com",
  "letthemeatspam.com",
  "mailexpire.com",
  "mailforspam.com",
  "mailmoat.com",
  "mailnull.com",
  "mailshell.com",
  "mailzilla.com",
  "nomail.xl.cx",
  "nowmymail.com",
  "pookmail.com",
  "shortmail.net",
  "spambob.com",
  "spambob.net",
  "spambob.org",
  "spamcero.com",
  "spamday.com",
  "spamfree24.org",
  "spamgourmet.com",
  "spamhole.com",
  "spamify.com",
  "spaminator.de",
  "spammotel.com",
  "spamspot.com",
  "trash-mail.at",
  "trash-mail.com",
  "trashymail.com",
  "trashymail.net",
  "wegwerfmail.de",
  "wegwerfmail.net",
  "wh4f.org",
  "yopmail.gq",
  "jetable.org",
  "mailtemp.info",
  "tempmailo.com",
  "tempmailaddress.com",
  "tmpmail.net",
  "tmpmail.org",
  "tempmails.net",
  "emailfake.com",
  "crazymailing.com",
  "mailnator.com",
  "inboxkitten.com",
  "guerrillamail.biz",
  "guerrillamail.info",
  "emkei.cz",
  "anonymbox.com",
  "anonbox.net",
  "dropmail.me",
  "mailhazard.com",
  "mailhazard.us",
  "mailquack.com",
  "receiveee.com",
]);

/**
 * Check if an email address uses a known disposable domain.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.toLowerCase().split("@")[1];
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Get the domain from an email address.
 */
export function getEmailDomain(email: string): string {
  return email.toLowerCase().split("@")[1] || "";
}
