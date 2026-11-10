/** A real P-256 key as a PKCS#8 PEM, like Apple's `.p8`. */
export async function generateP256Pem() {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const der = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", pair.privateKey),
  );
  const base64 = btoa(String.fromCharCode(...der));
  const pem = `-----BEGIN PRIVATE KEY-----\n${base64.match(/.{1,64}/g)?.join("\n")}\n-----END PRIVATE KEY-----\n`;
  return { pem, base64, publicKey: pair.publicKey };
}
