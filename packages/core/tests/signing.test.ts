import { describe, expect, it } from "vitest";
import { importP256PrivateKey, signEs256Jwt } from "../src/signing.ts";
import { generateP256Pem } from "./helpers.ts";

function bytes(part: string): Uint8Array<ArrayBuffer> {
  const base64 = part.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function decode(part: string): unknown {
  return JSON.parse(new TextDecoder().decode(bytes(part)));
}

describe("importP256PrivateKey", () => {
  it("imports a PEM as a non-extractable sign-only ECDSA key", async () => {
    const { pem } = await generateP256Pem();
    const key = await importP256PrivateKey(pem);
    expect(key.type).toBe("private");
    expect(key.extractable).toBe(false);
    expect(key.usages).toEqual(["sign"]);
    expect(key.algorithm).toMatchObject({
      name: "ECDSA",
      namedCurve: "P-256",
    });
  });

  it("tolerates CRLF, surrounding whitespace and literal \\n sequences", async () => {
    const { pem } = await generateP256Pem();
    const variants = [
      pem.replaceAll("\n", "\r\n"),
      `  \n\t${pem}\n  `,
      pem.trim().replaceAll("\n", "\\n"),
      pem.trim().replaceAll("\n", ""),
    ];
    for (const variant of variants) {
      await expect(importP256PrivateKey(variant)).resolves.toBeDefined();
    }
  });

  it("rejects an invalid PEM without key material in the message", async () => {
    const { pem, base64 } = await generateP256Pem();
    const truncated = pem.replace(base64.slice(-40), "AAAA");
    const inputs = [
      "not a key",
      "",
      "-----BEGIN PRIVATE KEY-----\n!!!notbase64!!!\n-----END PRIVATE KEY-----",
      truncated,
      pem.replace("BEGIN PRIVATE KEY", "BEGIN EC PRIVATE KEY"),
    ];
    for (const input of inputs) {
      const error = await importP256PrivateKey(input).catch((e) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch(/Invalid private key/);
      expect(error.message).not.toContain(base64.slice(0, 20));
      expect(error.message).not.toContain(input.slice(0, 30) || "\u0000");
      expect(error.cause).toBeUndefined();
    }
  });

  it("rejects a PKCS#8 key on another curve", async () => {
    const pair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-384" },
      true,
      ["sign"],
    );
    const der = new Uint8Array(
      await crypto.subtle.exportKey("pkcs8", pair.privateKey),
    );
    const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----`;
    await expect(importP256PrivateKey(pem)).rejects.toThrow(
      /Invalid private key/,
    );
  });
});

describe("signEs256Jwt", () => {
  it("signs a compact JWS that verifies with the public key", async () => {
    const { pem, publicKey } = await generateP256Pem();
    const key = await importP256PrivateKey(pem);
    const jwt = await signEs256Jwt({
      header: { kid: "ABC123", typ: "JWT" },
      payload: { iss: "issuer", aud: "appstoreconnect-v1", exp: 1234, n: "é" },
      key,
    });

    const [header, payload, signature, ...rest] = jwt.split(".") as string[];
    expect(rest).toEqual([]);
    expect(jwt).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(decode(header as string)).toEqual({
      kid: "ABC123",
      typ: "JWT",
      alg: "ES256",
    });
    expect(decode(payload as string)).toEqual({
      iss: "issuer",
      aud: "appstoreconnect-v1",
      exp: 1234,
      n: "é",
    });

    const raw = bytes(signature as string);
    expect(raw).toHaveLength(64);
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      raw,
      new TextEncoder().encode(`${header}.${payload}`),
    );
    expect(valid).toBe(true);
  });

  it("always sets alg to ES256", async () => {
    const { pem } = await generateP256Pem();
    const key = await importP256PrivateKey(pem);
    const jwt = await signEs256Jwt({
      header: { alg: "none" },
      payload: {},
      key,
    });
    expect(decode(jwt.split(".")[0] as string)).toEqual({ alg: "ES256" });
  });
});
