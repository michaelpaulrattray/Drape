/**
 * WHO MAY STAMP A CREATION RECORD — the token's signature, checked before it is
 * stored (N2d-1, #2311; the relay's finding 2 on PR #2317).
 *
 * The first version of this road stored any token whose imprint and nonce were
 * ours, and said in its docblock that the authority's CMS signature was "not
 * proven here". The relay's finding named what that cost: DigiCert is asked
 * over plain HTTP, so anyone on the path could echo our imprint and nonce with
 * a junk signature, and because a stamp only ever fills an EMPTY token column
 * the forgery would be stored for good — and fail the first `openssl ts
 * -verify` anybody ran on a certificate. So the signature is checked here,
 * in-process, and a token that fails it is a refusal like any other: nothing
 * is stored and the record keeps retrying.
 *
 * # What is checked (RFC 5652 §5.4 and RFC 3161 §2.3)
 *
 *   1. the signed attributes say the content is TSTInfo, and their
 *      messageDigest is the digest of the TSTInfo bytes actually carried;
 *   2. some certificate in the token verifies the signature over those
 *      attributes (re-tagged as a SET, the exact bytes that were signed);
 *   3. that certificate is marked for time-stamping (EKU 1.3.6.1.5.5.7.3.8);
 *   4. it chains — through CA certificates the token carries, each one valid
 *      at the stamp's own time — to one of the TWO ROOTS PINNED BELOW, and to
 *      nothing else. A root the token brings with it is never trusted for
 *      being there.
 *
 * NOT checked, and declared: revocation (no CRL or OCSP fetch on the Sign
 * road), and the ESS signing-certificate attribute binding. Both are what an
 * offline `openssl ts -verify` also leaves to its caller's configuration.
 *
 * # The pinned roots
 *
 * DigiCert Trusted Root G4 — the root Node's own Mozilla bundle carries, copied
 * here so the trust list cannot move under a runtime upgrade. FreeTSA's root
 * (RSA, valid to 2041) — fetched over HTTPS from freetsa.org on 2026-10-12;
 * `openssl ts -verify` against it returned OK on a real FreeTSA token that
 * day. Each is pinned by its SHA-256 fingerprint in the suite, so a changed
 * byte here reddens rather than quietly trusting someone else.
 */
import { X509Certificate, createHash, verify as verifySignature } from "node:crypto";

import type { SignedParts } from "./creationRecordTimestamp";

export const PINNED_TIMESTAMP_ROOTS: readonly string[] = [
  /* DigiCert Trusted Root G4 — SHA-256 55:2F:7B:DC:…:C8:99:88, valid to 2038-01-15. */
  `-----BEGIN CERTIFICATE-----
MIIFkDCCA3igAwIBAgIQBZsbV56OITLiOQe9p3d1XDANBgkqhkiG9w0BAQwFADBiMQswCQYD
VQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3d3cuZGlnaWNlcnQu
Y29tMSEwHwYDVQQDExhEaWdpQ2VydCBUcnVzdGVkIFJvb3QgRzQwHhcNMTMwODAxMTIwMDAw
WhcNMzgwMTE1MTIwMDAwWjBiMQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5j
MRkwFwYDVQQLExB3d3cuZGlnaWNlcnQuY29tMSEwHwYDVQQDExhEaWdpQ2VydCBUcnVzdGVk
IFJvb3QgRzQwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQC/5pBzaN675F1KPDAi
MGkz7MKnJS7JIT3yithZwuEppz1Yq3aaza57G4QNxDAf8xukOBbrVsaXbR2rsnnyyhHS5F/W
BTxSD1Ifxp4VpX6+n6lXFllVcq9ok3DCsrp1mWpzMpTREEQQLt+C8weE5nQ7bXHiLQwb7iDV
ySAdYyktzuxeTsiT+CFhmzTrBcZe7FsavOvJz82sNEBfsXpm7nfISKhmV1efVFiODCu3T6cw
2Vbuyntd463JT17lNecxy9qTXtyOj4DatpGYQJB5w3jHtrHEtWoYOAMQjdjUN6QuBX2I9YI+
EJFwq1WCQTLX2wRzKm6RAXwhTNS8rhsDdV14Ztk6MUSaM0C/CNdaSaTC5qmgZ92kJ7yhTzm1
EVgX9yRcRo9k98FpiHaYdj1ZXUJ2h4mXaXpI8OCiEhtmmnTK3kse5w5jrubU75KSOp493ADk
RSWJtppEGSt+wJS00mFt6zPZxd9LBADMfRyVw4/3IbKyEbe7f/LVjHAsQWCqsWMYRJUadmJ+
9oCw++hkpjPRiQfhvbfmQ6QYuKZ3AeEPlAwhHbJUKSWJbOUOUlFHdL4mrLZBdd56rF+NP8m8
00ERElvlEFDrMcXKchYiCd98THU/Y+whX8QgUWtvsauGi0/C1kVfnSD8oR7FwI+isX4KJpn1
5GkvmB0t9dmpsh3lGwIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIB
hjAdBgNVHQ4EFgQU7NfjgtJxXWRM3y5nP+e6mK4cD08wDQYJKoZIhvcNAQEMBQADggIBALth
2X2pbL4XxJEbw6GiAI3jZGgPVs93rnD5/ZpKmbnJeFwMDF/k5hQpVgs2SV1EY+CtnJYYZhsj
DT156W1r1lT40jzBQ0CuHVD1UvyQO7uYmWlrx8GnqGikJ9yd+SeuMIW59mdNOj6PWTkiU0Tr
yF0Dyu1Qen1iIQqAyHNm0aAFYF/opbSnr6j3bTWcfFqK1qI4mfN4i/RN0iAL3gTujJtHgXIN
wBQy7zBZLq7gcfJW5GqXb5JQbZaNaHqasjYUegbyJLkJEVDXCLG4iXqEI2FCKeWjzaIgQdfR
nGTZ6iahixTXTBmyUEFxPT9NcCOGDErcgdLMMpSEDQgJlxxPwO5rIHQw0uA5NBCFIRUBCOhV
Mt5xSdkoF1BN5r5N0XWs0Mr7QbhDparTwwVETyw2m+L64kW4I1NsBm9nVX9GtUw/bihaeSbS
pKhil9Ie4u1Ki7wb/UdKDd9nZn6yW0HQO+T0O/QEY+nvwlQAUaCKKsnOeMzV6ocEGLPOr0mI
r/OSmbaz5mEP0oUA51Aa5BuVnRmhuZyxm7EAHu/QD09CbMkKvO5D+jpxpchNJqU1/YldvIVi
HTLSoCtU7ZpXwdv6EM8Zt4tKG48BtieVU+i2iW1bvGjUI+iLUaJW+fCmgKDWHrO8Dw9TdSmq
6hN35N6MgSGtBxBHEa2HPQfRdbzP82Z+
-----END CERTIFICATE-----`,
  /* FreeTSA Root CA — SHA-256 A6:37:9E:7C:…:1D:18:AA:BC, valid to 2041-03-07. */
  `-----BEGIN CERTIFICATE-----
MIIH/zCCBeegAwIBAgIJAMHphhYNqOmAMA0GCSqGSIb3DQEBDQUAMIGVMREwDwYD
VQQKEwhGcmVlIFRTQTEQMA4GA1UECxMHUm9vdCBDQTEYMBYGA1UEAxMPd3d3LmZy
ZWV0c2Eub3JnMSIwIAYJKoZIhvcNAQkBFhNidXNpbGV6YXNAZ21haWwuY29tMRIw
EAYDVQQHEwlXdWVyemJ1cmcxDzANBgNVBAgTBkJheWVybjELMAkGA1UEBhMCREUw
HhcNMTYwMzEzMDE1MjEzWhcNNDEwMzA3MDE1MjEzWjCBlTERMA8GA1UEChMIRnJl
ZSBUU0ExEDAOBgNVBAsTB1Jvb3QgQ0ExGDAWBgNVBAMTD3d3dy5mcmVldHNhLm9y
ZzEiMCAGCSqGSIb3DQEJARYTYnVzaWxlemFzQGdtYWlsLmNvbTESMBAGA1UEBxMJ
V3VlcnpidXJnMQ8wDQYDVQQIEwZCYXllcm4xCzAJBgNVBAYTAkRFMIICIjANBgkq
hkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAtgKODjAy8REQ2WTNqUudAnjhlCrpE6ql
mQfNppeTmVvZrH4zutn+NwTaHAGpjSGv4/WRpZ1wZ3BRZ5mPUBZyLgq0YrIfQ5Fx
0s/MRZPzc1r3lKWrMR9sAQx4mN4z11xFEO529L0dFJjPF9MD8Gpd2feWzGyptlel
b+PqT+++fOa2oY0+NaMM7l/xcNHPOaMz0/2olk0i22hbKeVhvokPCqhFhzsuhKsm
q4Of/o+t6dI7sx5h0nPMm4gGSRhfq+z6BTRgCrqQG2FOLoVFgt6iIm/BnNffUr7V
DYd3zZmIwFOj/H3DKHoGik/xK3E82YA2ZulVOFRW/zj4ApjPa5OFbpIkd0pmzxzd
EcL479hSA9dFiyVmSxPtY5ze1P+BE9bMU1PScpRzw8MHFXxyKqW13Qv7LWw4sbk3
SciB7GACbQiVGzgkvXG6y85HOuvWNvC5GLSiyP9GlPB0V68tbxz4JVTRdw/Xn/XT
FNzRBM3cq8lBOAVt/PAX5+uFcv1S9wFE8YjaBfWCP1jdBil+c4e+0tdywT2oJmYB
BF/kEt1wmGwMmHunNEuQNzh1FtJY54hbUfiWi38mASE7xMtMhfj/C4SvapiDN837
gYaPfs8x3KZxbX7C3YAsFnJinlwAUss1fdKar8Q/YVs7H/nU4c4Ixxxz4f67fcVq
M2ITKentbCMCAwEAAaOCAk4wggJKMAwGA1UdEwQFMAMBAf8wDgYDVR0PAQH/BAQD
AgHGMB0GA1UdDgQWBBT6VQ2MNGZRQ0z357OnbJWveuaklzCBygYDVR0jBIHCMIG/
gBT6VQ2MNGZRQ0z357OnbJWveuakl6GBm6SBmDCBlTERMA8GA1UEChMIRnJlZSBU
U0ExEDAOBgNVBAsTB1Jvb3QgQ0ExGDAWBgNVBAMTD3d3dy5mcmVldHNhLm9yZzEi
MCAGCSqGSIb3DQEJARYTYnVzaWxlemFzQGdtYWlsLmNvbTESMBAGA1UEBxMJV3Vl
cnpidXJnMQ8wDQYDVQQIEwZCYXllcm4xCzAJBgNVBAYTAkRFggkAwemGFg2o6YAw
MwYDVR0fBCwwKjAooCagJIYiaHR0cDovL3d3dy5mcmVldHNhLm9yZy9yb290X2Nh
LmNybDCBzwYDVR0gBIHHMIHEMIHBBgorBgEEAYHyJAEBMIGyMDMGCCsGAQUFBwIB
FidodHRwOi8vd3d3LmZyZWV0c2Eub3JnL2ZyZWV0c2FfY3BzLmh0bWwwMgYIKwYB
BQUHAgEWJmh0dHA6Ly93d3cuZnJlZXRzYS5vcmcvZnJlZXRzYV9jcHMucGRmMEcG
CCsGAQUFBwICMDsaOUZyZWVUU0EgdHJ1c3RlZCB0aW1lc3RhbXBpbmcgU29mdHdh
cmUgYXMgYSBTZXJ2aWNlIChTYWFTKTA3BggrBgEFBQcBAQQrMCkwJwYIKwYBBQUH
MAGGG2h0dHA6Ly93d3cuZnJlZXRzYS5vcmc6MjU2MDANBgkqhkiG9w0BAQ0FAAOC
AgEAaK9+v5OFYu9M6ztYC+L69sw1omdyli89lZAfpWMMh9CRmJhM6KBqM/ipwoLt
nxyxGsbCPhcQjuTvzm+ylN6VwTMmIlVyVSLKYZcdSjt/eCUN+41K7sD7GVmxZBAF
ILnBDmTGJmLkrU0KuuIpj8lI/E6Z6NnmuP2+RAQSHsfBQi6sssnXMo4HOW5gtPO7
gDrUpVXID++1P4XndkoKn7Svw5n0zS9fv1hxBcYIHPPQUze2u30bAQt0n0iIyRLz
aWuhtpAtd7ffwEbASgzB7E+NGF4tpV37e8KiA2xiGSRqT5ndu28fgpOY87gD3ArZ
DctZvvTCfHdAS5kEO3gnGGeZEVLDmfEsv8TGJa3AljVa5E40IQDsUXpQLi8G+UC4
1DWZu8EVT4rnYaCw1VX7ShOR1PNCCvjb8S8tfdudd9zhU3gEB0rxdeTy1tVbNLXW
99y90xcwr1ZIDUwM/xQ/noO8FRhm0LoPC73Ef+J4ZBdrvWwauF3zJe33d4ibxEcb
8/pz5WzFkeixYM2nsHhqHsBKw7JPouKNXRnl5IAE1eFmqDyC7G/VT7OF669xM6hb
Ut5G21JE4cNK6NNucS+fzg1JPX0+3VhsYZjj7D5uljRvQXrJ8iHgr/M6j2oLHvTA
I2MLdq2qjZFDOCXsxBxJpbmLGBx9ow6ZerlUxzws2AWv2pk=
-----END CERTIFICATE-----`,
];

const TIME_STAMPING_EKU = "1.3.6.1.5.5.7.3.8";
const TST_INFO_OID = "1.2.840.113549.1.9.16.1.4";

const DIGESTS: Record<string, string> = {
  "2.16.840.1.101.3.4.2.1": "sha256",
  "2.16.840.1.101.3.4.2.2": "sha384",
  "2.16.840.1.101.3.4.2.3": "sha512",
};

/** The hash a signature algorithm uses; rsaEncryption defers to the digest algorithm. */
function signatureHash(signatureOid: string, digestName: string): string | null {
  switch (signatureOid) {
    case "1.2.840.113549.1.1.1": return digestName;
    case "1.2.840.113549.1.1.11": case "1.2.840.10045.4.3.2": return "sha256";
    case "1.2.840.113549.1.1.12": case "1.2.840.10045.4.3.3": return "sha384";
    case "1.2.840.113549.1.1.13": case "1.2.840.10045.4.3.4": return "sha512";
    default: return null; // RSA-PSS and anything else: refused, never guessed
  }
}

function validAt(cert: X509Certificate, at: Date): boolean {
  return new Date(cert.validFrom) <= at && at <= new Date(cert.validTo);
}

function issuedBy(child: X509Certificate, parent: X509Certificate): boolean {
  try {
    return child.checkIssued(parent) && child.verify(parent.publicKey);
  } catch {
    return false;
  }
}

export type TimestampSignatureVerdict = { ok: true } | { ok: false; reason: string };

/** Verify a token's CMS signature and chain at its own stamp time. Never throws. */
export function verifyTimestampSignature(
  signed: SignedParts,
  stampedAt: Date,
  roots: readonly string[] = PINNED_TIMESTAMP_ROOTS,
): TimestampSignatureVerdict {
  let anchors: X509Certificate[];
  let bag: X509Certificate[];
  try {
    anchors = roots.map((pem) => new X509Certificate(pem));
    bag = signed.certificates.map((der) => new X509Certificate(der));
  } catch {
    return { ok: false, reason: "unreadable certificate" };
  }
  if (signed.signers.length === 0) return { ok: false, reason: "no signer" };
  for (const signer of signed.signers) {
    const digestName = DIGESTS[signer.digestOid];
    if (!digestName) continue;
    if (signer.contentTypeOid !== TST_INFO_OID) continue;
    if (!signer.messageDigest?.equals(createHash(digestName).update(signed.content).digest())) continue;
    const hash = signatureHash(signer.signatureOid, digestName);
    if (!hash) continue;
    for (const candidate of bag) {
      let signs = false;
      try {
        signs = verifySignature(hash, signer.signedAttributes, candidate.publicKey, signer.signature);
      } catch {
        signs = false;
      }
      if (!signs) continue;
      if (!(candidate.keyUsage ?? []).includes(TIME_STAMPING_EKU)) continue;
      if (!validAt(candidate, stampedAt)) continue;
      if (chainsToAnchor(candidate, bag, anchors, stampedAt)) return { ok: true };
    }
  }
  return { ok: false, reason: "no certificate in the token signs it and chains to a pinned root" };
}

function chainsToAnchor(
  start: X509Certificate,
  bag: readonly X509Certificate[],
  anchors: readonly X509Certificate[],
  at: Date,
): boolean {
  let current = start;
  for (let depth = 0; depth < 6; depth += 1) {
    if (anchors.some((anchor) => validAt(anchor, at) && issuedBy(current, anchor))) return true;
    const parent = bag.find((cert) =>
      cert !== current && cert.ca && validAt(cert, at) && issuedBy(current, cert)
      /* a self-signed certificate the token brings is never an anchor */
      && !issuedBy(cert, cert));
    if (!parent) return false;
    current = parent;
  }
  return false;
}
