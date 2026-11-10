import { encryptSecret, type SecretAuth } from "@repo/core/keys";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { type AscKey, getUserAscClient, selectKey } from "../src/asc/client.ts";
import { keyFormSchema } from "../src/schemas/common.ts";
import {
  AscApiError,
  CredentialsError,
  NetworkError,
  UnexpectedResponseError,
} from "../src/utils/errors.ts";
import { createTestClient } from "./helpers.ts";

// Record what the app logs: vitest.config.ts sets LOG_LEVEL=silent, so the real logger would print nothing.
const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));
vi.mock("../src/utils/logger.ts", () => ({ logger }));

const auth = {
  $context: Promise.resolve({ secretConfig: "test-secret-for-encryption" }),
} as unknown as SecretAuth;
const KEYS_URL = "https://mcp.example.com/keys";
const ISSUER = "69a6de70-03db-47e3-e053-5b8c7c11a4d1";
const NOW = 1_800_000_000_000;

let pem: string;
let publicKey: CryptoKey;

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const der = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", pair.privateKey),
  );
  pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----\n`;
  publicKey = pair.publicKey;
});

async function storedKey(keyId: string, issuerId: string): Promise<AscKey> {
  return {
    id: `id-${keyId}`,
    keyId,
    issuerId,
    privateKey: await encryptSecret(auth, pem),
  };
}

function decode(part: string): Record<string, unknown> {
  return JSON.parse(
    atob(part.replaceAll("-", "+").replaceAll("_", "/")),
  ) as Record<string, unknown>;
}

function stubFetch(response: Response) {
  return vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
}

async function clientFor(
  keys: AscKey[],
  fetch: typeof globalThis.fetch,
  keyId?: string,
) {
  return getUserAscClient("user-1", keyId, {
    store: { list: async () => keys },
    auth,
    keysUrl: KEYS_URL,
    fetch,
    now: () => NOW,
  });
}

/** The bearer token the client sent on a request (the first by default). */
function sentToken(fetch: ReturnType<typeof stubFetch>, call = 0): string {
  const init = fetch.mock.calls[call]?.[1] as RequestInit;
  const header = (init.headers as Record<string, string>).authorization ?? "";
  expect(header).toMatch(/^Bearer /);
  return header.slice("Bearer ".length);
}

describe("getUserAscClient", () => {
  it("should sign a 2-minute ES256 team token with iss and kid", async () => {
    const fetch = stubFetch(Response.json({ data: [] }));
    const client = await clientFor(
      [await storedKey("TEAMKEY001", ISSUER)],
      fetch,
    );
    await client.get("/v1/apps", { limit: 1 });

    const token = sentToken(fetch);
    const [header = "", payload = "", signature = ""] = token.split(".");
    expect(decode(header)).toEqual({
      kid: "TEAMKEY001",
      typ: "JWT",
      alg: "ES256",
    });
    const claims = decode(payload);
    expect(claims).toEqual({
      iss: ISSUER,
      iat: NOW / 1000,
      exp: NOW / 1000 + 120,
      aud: "appstoreconnect-v1",
    });
    const raw = Uint8Array.from(
      atob(signature.replaceAll("-", "+").replaceAll("_", "/")),
      (char) => char.charCodeAt(0),
    );
    expect(
      await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        publicKey,
        raw,
        new TextEncoder().encode(`${header}.${payload}`),
      ),
    ).toBe(true);
  });

  it("should use sub: user and no iss for an individual key", async () => {
    const fetch = stubFetch(Response.json({ data: [] }));
    const client = await clientFor([await storedKey("SOLOKEY001", "")], fetch);
    await client.get("/v1/apps");
    const claims = decode(sentToken(fetch).split(".")[1] ?? "");
    expect(claims).toEqual({
      sub: "user",
      iat: NOW / 1000,
      exp: NOW / 1000 + 120,
      aud: "appstoreconnect-v1",
    });
  });

  it("should sign a fresh token for every request", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(async () => Response.json({ data: [] }));
    let now = NOW;
    const client = await getUserAscClient("user-1", undefined, {
      store: { list: async () => [await storedKey("TEAMKEY001", ISSUER)] },
      auth,
      keysUrl: KEYS_URL,
      fetch,
      now: () => (now += 1000),
    });
    await client.get("/v1/apps");
    await client.get("/v1/apps");
    const iats = [0, 1].map(
      (call) => decode(sentToken(fetch, call).split(".")[1] ?? "").iat,
    );
    expect(iats).toEqual([NOW / 1000 + 1, NOW / 1000 + 2]);
  });

  it("should call App Store Connect with comma-joined arrays and no undefined values", async () => {
    const fetch = stubFetch(Response.json({ data: [] }));
    const client = await clientFor(
      [await storedKey("TEAMKEY001", ISSUER)],
      fetch,
    );
    await client.get("/v1/builds", {
      "filter[app]": "123",
      "filter[processingState]": ["VALID", "PROCESSING"],
      "filter[version]": undefined,
      "exists[x]": false,
      limit: 5,
    });
    const url = fetch.mock.calls[0]?.[0] as URL;
    expect(url.origin + url.pathname).toBe(
      "https://api.appstoreconnect.apple.com/v1/builds",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      "filter[app]": "123",
      "filter[processingState]": "VALID,PROCESSING",
      "exists[x]": "false",
      limit: "5",
    });
  });

  it("should throw AscApiError with the body, and tolerate a non-JSON error body", async () => {
    const body = { errors: [{ status: "403", code: "FORBIDDEN_ERROR" }] };
    const key = await storedKey("TEAMKEY001", ISSUER);
    const forbidden = await (
      await clientFor([key], stubFetch(Response.json(body, { status: 403 })))
    )
      .get("/v1/apps")
      .catch((error: unknown) => error);
    expect(forbidden).toBeInstanceOf(AscApiError);
    expect(forbidden).toMatchObject({ status: 403, data: body });

    const notAcceptable = await (
      await clientFor(
        [key],
        stubFetch(new Response("Not Acceptable", { status: 406 })),
      )
    )
      .get("/v1/apps")
      .catch((error: unknown) => error);
    expect(notAcceptable).toMatchObject({ status: 406, data: undefined });
  });

  it("should reject a successful response that is not JSON", async () => {
    const client = await clientFor(
      [await storedKey("TEAMKEY001", ISSUER)],
      stubFetch(new Response("<html>")),
    );
    await expect(client.get("/v1/apps")).rejects.toBeInstanceOf(
      UnexpectedResponseError,
    );
  });

  it("should ask the user to re-add a key that cannot be decrypted", async () => {
    const key = {
      ...(await storedKey("TEAMKEY001", ISSUER)),
      privateKey: "00",
    };
    const error = await clientFor([key], stubFetch(Response.json({}))).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(CredentialsError);
    expect((error as Error).message).toContain(KEYS_URL);
  });

  it("should wrap a fetch rejection without a code, as Workers reports it, in NetworkError", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(new TypeError("Network connection lost."));
    const client = await clientFor(
      [await storedKey("TEAMKEY001", ISSUER)],
      fetch,
    );
    await expect(client.get("/v1/apps")).rejects.toBeInstanceOf(NetworkError);
  });

  it("should never put the token or the private key in a tool result or the logs", async () => {
    vi.clearAllMocks();
    const fetch = stubFetch(
      Response.json(
        { errors: [{ status: "401", code: "NOT_AUTHORIZED", detail: "x" }] },
        { status: 401 },
      ),
    );
    const key = await storedKey("TEAMKEY001", ISSUER);
    const { callTool } = createTestClient((keyId) =>
      getUserAscClient("user-1", keyId, {
        store: { list: async () => [key] },
        auth,
        keysUrl: KEYS_URL,
        fetch,
      }),
    );
    const result = await callTool("list_apps");
    const token = sentToken(fetch);
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/^\[auth\]/);
    const logged = Object.values(logger).flatMap((fn) => fn.mock.calls);
    expect(logged.length).toBeGreaterThan(0);
    const output = [result.text, JSON.stringify(logged)].join("\n");
    expect(output).not.toContain(token);
    expect(output).not.toContain("PRIVATE KEY");
    expect(output).not.toContain(key.privateKey);
  });
});

describe("selectKey", () => {
  const team = {
    id: "1",
    keyId: "TEAMKEY001",
    issuerId: ISSUER,
    privateKey: "c",
  };
  const solo = { id: "2", keyId: "SOLOKEY001", issuerId: "", privateKey: "c" };

  it("should tell a user with no key where to add one", () => {
    expect(() => selectKey([], undefined, KEYS_URL)).toThrow(
      new CredentialsError(
        `No App Store Connect API key is stored for your account. Add one at ${KEYS_URL}, then retry.`,
      ),
    );
  });

  it("should use the only key, with or without a matching key_id", () => {
    expect(selectKey([team], undefined, KEYS_URL)).toBe(team);
    expect(selectKey([team], "TEAMKEY001", KEYS_URL)).toBe(team);
  });

  it("should require key_id when there are several, listing them", () => {
    expect(() => selectKey([team, solo], undefined, KEYS_URL)).toThrow(
      "You have 2 App Store Connect keys: TEAMKEY001 (team), SOLOKEY001 (individual). Pass key_id to choose one.",
    );
    expect(selectKey([team, solo], "SOLOKEY001", KEYS_URL)).toBe(solo);
  });

  it("should reject a key_id the user has not stored", () => {
    expect(() => selectKey([team], "OTHERKEY01", KEYS_URL)).toThrow(
      CredentialsError,
    );
  });
});

describe("keyFormSchema", () => {
  const valid = { issuerId: ISSUER, keyId: "2X9R4HXF34", privateKey: "pem" };

  it.each([
    ["an empty issuer ID", { ...valid, issuerId: "" }, true],
    ["a missing issuer ID", { keyId: "2X9R4HXF34", privateKey: "pem" }, true],
    ["a team issuer ID", valid, true],
    [
      "a key ID with surrounding spaces",
      { ...valid, keyId: " 2X9R4HXF34 " },
      true,
    ],
    [
      "an issuer ID that is not a GUID",
      { ...valid, issuerId: "team-1" },
      false,
    ],
    ["a lowercase key ID", { ...valid, keyId: "2x9r4hxf34" }, false],
    ["a 9-character key ID", { ...valid, keyId: "2X9R4HXF3" }, false],
    [
      "an oversized private key",
      { ...valid, privateKey: "x".repeat(4097) },
      false,
    ],
  ])("should handle %s", (_, input, success) => {
    expect(keyFormSchema.safeParse(input).success).toBe(success);
  });

  it("should default a missing issuer ID to an empty string", () => {
    expect(
      keyFormSchema.parse({ keyId: "2X9R4HXF34", privateKey: "pem" }).issuerId,
    ).toBe("");
  });
});
