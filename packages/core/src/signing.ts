const PEM_PATTERN =
  /-----BEGIN PRIVATE KEY-----([^-]*)-----END PRIVATE KEY-----/;

/**
 * Imports an unencrypted PKCS#8 PEM (Apple's `.p8`) as a non-extractable
 * ECDSA P-256 signing key. Tolerates CRLF, surrounding whitespace and literal
 * `\n` sequences (keys pasted into an env var or a form).
 */
export async function importP256PrivateKey(pem: string): Promise<CryptoKey> {
  const body = PEM_PATTERN.exec(pem.replaceAll("\\n", "\n"))?.[1];
  try {
    if (body === undefined) throw new Error("not a PKCS#8 PEM");
    const der = Uint8Array.from(atob(body.replace(/\s+/g, "")), (char) =>
      char.charCodeAt(0),
    );
    return await crypto.subtle.importKey(
      "pkcs8",
      der,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
  } catch {
    // No cause and no input in the message: it must never carry key material.
    throw new Error(
      "Invalid private key: expected an unencrypted PKCS#8 PEM (-----BEGIN PRIVATE KEY-----) holding a P-256 key",
    );
  }
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

const encoder = new TextEncoder();

export interface Es256JwtOptions {
  /** `alg` is always `ES256`; add `kid`, `typ` and so on. */
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  key: CryptoKey;
}

/** A compact JWS signed with ES256: WebCrypto's ECDSA output is already the raw `r || s` JWS wants. */
export async function signEs256Jwt({
  header,
  payload,
  key,
}: Es256JwtOptions): Promise<string> {
  const signingInput = `${base64url(encoder.encode(JSON.stringify({ ...header, alg: "ES256" })))}.${base64url(encoder.encode(JSON.stringify(payload)))}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(signingInput),
  );
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}
