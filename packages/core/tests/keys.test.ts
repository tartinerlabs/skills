import { describe, expect, it, vi } from "vitest";
import * as z from "zod";
import type { Auth } from "../src/auth.ts";
import {
  createKeyPages,
  decryptSecret,
  encryptSecret,
  type KeyRecord,
  type KeyStore,
  type SecretAuth,
} from "../src/keys.ts";
import { createLogger } from "../src/logger.ts";
import { generateP256Pem } from "./helpers.ts";

const ORIGIN = "https://asc.example.com";

const schema = z.object({
  keyId: z.string().min(1).describe("Key ID"),
  privateKey: z.string().min(1).describe("Private key (.p8)"),
  issuerId: z.string().default("").describe("Issuer ID"),
});
type Fields = z.output<typeof schema>;

const USERS: Record<string, { id: string; email: string }> = {
  alice: { id: "u-alice", email: "alice@example.com" },
  bob: { id: "u-bob", email: "bob@example.com" },
};

const secretConfig = "test-secret-test-secret-test-secret";

function fakeAuth() {
  return {
    $context: Promise.resolve({ secretConfig, baseURL: `${ORIGIN}/api/auth` }),
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        const user = USERS[headers.get("cookie")?.replace("as=", "") ?? ""];
        return user ? { user } : null;
      },
    },
  } as unknown as Auth;
}

function memoryStore() {
  const rows = new Map<string, KeyRecord<Fields>[]>();
  const store: KeyStore<Fields> = {
    list: async (userId) => rows.get(userId) ?? [],
    insert: async (userId, record) => {
      rows.set(userId, [...(rows.get(userId) ?? []), record]);
    },
    remove: async (userId, id) => {
      const list = rows.get(userId) ?? [];
      rows.set(
        userId,
        list.filter((row) => row.id !== id),
      );
      return list.some((row) => row.id === id);
    },
  };
  return { store, rows };
}

function setup() {
  const auth = fakeAuth();
  const { store, rows } = memoryStore();
  const logger = createLogger("test", { level: "silent" });
  const pages = createKeyPages({
    auth,
    logger,
    serverName: "the test MCP server",
    store,
    schema,
    secretField: "privateKey",
    describe: ({ keyId }) => `Key ${keyId}`,
  });
  return { auth, store, rows, pages, logger };
}

function request(
  method: string,
  path: string,
  {
    as,
    origin = ORIGIN,
    body,
    contentType = "application/json",
  }: {
    as?: string;
    origin?: string | null;
    body?: unknown;
    contentType?: string;
  } = {},
) {
  const headers = new Headers();
  if (as) headers.set("cookie", `as=${as}`);
  if (origin) headers.set("origin", origin);
  if (body !== undefined) headers.set("content-type", contentType);
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
}

describe("encryptSecret and decryptSecret", () => {
  it("round-trips through Better Auth's secretConfig", async () => {
    const auth: SecretAuth = {
      $context: Promise.resolve({ secretConfig }),
    } as unknown as SecretAuth;
    const ciphertext = await encryptSecret(auth, "-----BEGIN PRIVATE KEY-----");
    expect(ciphertext).not.toContain("BEGIN");
    expect(await decryptSecret(auth, ciphertext)).toBe(
      "-----BEGIN PRIVATE KEY-----",
    );
  });

  it("does not decrypt under another secret", async () => {
    const auth = (config: string) =>
      ({
        $context: Promise.resolve({ secretConfig: config }),
      }) as unknown as SecretAuth;
    const ciphertext = await encryptSecret(
      auth("one-one-one-one-one-one-one"),
      "x",
    );
    await expect(
      decryptSecret(auth("two-two-two-two-two-two-two"), ciphertext),
    ).rejects.toThrow();
  });
});

describe("key page", () => {
  it("shows a Google sign-in button without a session", async () => {
    const { pages } = setup();
    const response = await pages.keysPage(request("GET", "/keys"));
    const html = await response.text();
    expect(response.status).toBe(401);
    expect(html).toContain("Sign in with Google");
    expect(html).toContain("data-signin");
    expect(html).not.toContain('id="add"');
  });

  it("lists the signed-in user's keys by non-secret label only", async () => {
    const { pages, auth, store } = setup();
    const { pem } = await generateP256Pem();
    const ciphertext = await encryptSecret(auth, pem);
    await store.insert("u-alice", {
      id: "id-1",
      keyId: "ALICEKEY",
      issuerId: "",
      privateKey: ciphertext,
    });
    await store.insert("u-bob", {
      id: "id-2",
      keyId: "BOBKEY",
      issuerId: "",
      privateKey: ciphertext,
    });

    const response = await pages.keysPage(
      request("GET", "/keys", { as: "alice" }),
    );
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Key ALICEKEY");
    expect(html).toContain('data-remove="id-1"');
    expect(html).toContain("alice@example.com");
    expect(html).toContain("Private key (.p8)");
    expect(html).not.toContain("BOBKEY");
    expect(html).not.toContain(ciphertext);
    expect(html).not.toContain(pem.split("\n")[1] as string);
  });

  it("marks only fields without a default as required", async () => {
    const { pages } = setup();
    const html = await (
      await pages.keysPage(request("GET", "/keys", { as: "alice" }))
    ).text();
    expect(html).toMatch(/<input name="keyId" required/);
    expect(html).toMatch(/<textarea name="privateKey"[^>]* required/);
    expect(html).toMatch(/<input name="issuerId" spellcheck/);
  });

  it("escapes labels", async () => {
    const { pages, store } = setup();
    await store.insert("u-alice", {
      id: "1",
      keyId: "<img src=x>",
      issuerId: "",
      privateKey: "c",
    });
    const html = await (
      await pages.keysPage(request("GET", "/keys", { as: "alice" }))
    ).text();
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;img src=x&gt;");
  });

  it("sends a strict CSP with the hash of its inline script", async () => {
    const { pages } = setup();
    for (const as of [undefined, "alice"]) {
      const response = await pages.keysPage(request("GET", "/keys", { as }));
      const html = await response.text();
      const start = html.indexOf("<script>") + "<script>".length;
      const script = html.slice(start, html.indexOf("</script>", start));
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(script),
      );
      const hash = btoa(String.fromCharCode(...new Uint8Array(digest)));
      const csp = response.headers.get("content-security-policy") ?? "";
      expect(csp).toContain(`script-src 'sha256-${hash}'`);
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("form-action 'none'");
      expect(csp).toContain("default-src 'none'");
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });
});

describe("key api", () => {
  it("rejects a write without a session with 401", async () => {
    const { pages, rows } = setup();
    const { pem } = await generateP256Pem();
    const response = await pages.addKey(
      request("POST", "/keys", { body: { keyId: "K", privateKey: pem } }),
    );
    expect(response.status).toBe(401);
    expect(rows.size).toBe(0);
    expect(
      (await pages.removeKey(request("DELETE", "/keys/x"), "x")).status,
    ).toBe(401);
  });

  it("rejects a missing or foreign Origin with 403", async () => {
    const { pages, rows } = setup();
    const { pem } = await generateP256Pem();
    for (const origin of ["https://evil.example", null]) {
      const response = await pages.addKey(
        request("POST", "/keys", {
          as: "alice",
          origin,
          body: { keyId: "K", privateKey: pem },
        }),
      );
      expect(response.status).toBe(403);
      expect(
        (
          await pages.removeKey(
            request("DELETE", "/keys/x", { as: "alice", origin }),
            "x",
          )
        ).status,
      ).toBe(403);
    }
    expect(rows.size).toBe(0);
  });

  it("rejects an invalid body with 400 and never echoes the secret", async () => {
    const { pages, rows } = setup();
    const secret = "super-secret-not-a-pem";
    const cases: unknown[] = [
      { keyId: "", privateKey: secret },
      { privateKey: secret },
      { keyId: "K", privateKey: secret },
      `{not json${secret}`,
      { keyId: "K", privateKey: 5 },
    ];
    for (const body of cases) {
      const response = await pages.addKey(
        request("POST", "/keys", { as: "alice", body }),
      );
      expect(response.status).toBe(400);
      expect(await response.text()).not.toContain(secret);
    }
    expect(rows.size).toBe(0);
  });

  it("rejects a non-JSON content type with 415", async () => {
    const { pages } = setup();
    const response = await pages.addKey(
      request("POST", "/keys", {
        as: "alice",
        body: "keyId=K",
        contentType: "application/x-www-form-urlencoded",
      }),
    );
    expect(response.status).toBe(415);
  });

  it("encrypts the private key before inserting and never returns it", async () => {
    const { pages, auth, rows } = setup();
    const { pem } = await generateP256Pem();
    const response = await pages.addKey(
      request("POST", "/keys", {
        as: "alice",
        body: { keyId: "KEY123", privateKey: pem },
      }),
    );
    const text = await response.text();
    expect(response.status).toBe(201);
    expect(text).not.toContain("PRIVATE KEY");
    expect(text).not.toContain(pem.split("\n")[1] as string);
    expect(JSON.parse(text)).toEqual({
      id: expect.any(String),
      label: "Key KEY123",
    });

    const [stored] = rows.get("u-alice") as KeyRecord<Fields>[];
    expect(stored?.keyId).toBe("KEY123");
    expect(stored?.privateKey).not.toContain("PRIVATE KEY");
    expect(await decryptSecret(auth, stored?.privateKey as string)).toBe(pem);

    const html = await (
      await pages.keysPage(request("GET", "/keys", { as: "alice" }))
    ).text();
    expect(html).toContain("Key KEY123");
    expect(html).not.toContain(pem.split("\n")[1] as string);
    expect(html).not.toContain(stored?.privateKey as string);
  });

  it("returns the invalid-key error for a non-P-256 PEM", async () => {
    const { pages, rows } = setup();
    const response = await pages.addKey(
      request("POST", "/keys", {
        as: "alice",
        body: {
          keyId: "K",
          privateKey:
            "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----",
        },
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/P-256/);
    expect(rows.size).toBe(0);
  });

  it("answers 500 without logging the row when the store fails", async () => {
    const { pages, store, logger } = setup();
    const { pem } = await generateP256Pem();
    store.insert = async () => {
      throw new Error(`UNIQUE constraint failed: ${pem}`);
    };
    const error = vi.spyOn(logger, "error");
    const response = await pages.addKey(
      request("POST", "/keys", {
        as: "alice",
        body: { keyId: "K", privateKey: pem },
      }),
    );
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("PRIVATE KEY");
    expect(JSON.stringify(error.mock.calls)).not.toContain("PRIVATE KEY");
  });

  it("rejects an oversize body with 413", async () => {
    const { pages, rows } = setup();
    const { pem } = await generateP256Pem();
    const body = { keyId: "K", privateKey: pem, issuerId: "x".repeat(20_000) };
    const declared = await pages.addKey(
      request("POST", "/keys", { as: "alice", body }),
    );
    expect(declared.status).toBe(413);
    // Multi-byte text is counted in bytes, not UTF-16 units.
    const bytes = await pages.addKey(
      request("POST", "/keys", {
        as: "alice",
        body: JSON.stringify({
          keyId: "K",
          privateKey: pem,
          issuerId: "\u20ac".repeat(6000),
        }),
      }),
    );
    expect(bytes.status).toBe(413);
    expect(rows.size).toBe(0);
  });

  it("stops at 20 keys per user", async () => {
    const { pages, rows, store } = setup();
    const { pem } = await generateP256Pem();
    for (let i = 0; i < 20; i++) {
      await store.insert("u-alice", {
        id: String(i),
        keyId: `K${i}`,
        privateKey: "c",
        issuerId: "",
      });
    }
    const response = await pages.addKey(
      request("POST", "/keys", {
        as: "alice",
        body: { keyId: "K", privateKey: pem },
      }),
    );
    expect(response.status).toBe(409);
    expect(rows.get("u-alice")).toHaveLength(20);
  });

  it("answers 500 when the store fails to list, encrypt or remove", async () => {
    const { pages, store, logger } = setup();
    const { pem } = await generateP256Pem();
    store.list = async () => {
      throw new Error(`boom ${pem}`);
    };
    store.remove = async () => {
      throw new Error("boom");
    };
    const error = vi.spyOn(logger, "error");
    const add = await pages.addKey(
      request("POST", "/keys", {
        as: "alice",
        body: { keyId: "K", privateKey: pem },
      }),
    );
    expect(add.status).toBe(500);
    expect(((await add.json()) as { error: string }).error).toBeTruthy();
    const remove = await pages.removeKey(
      request("DELETE", "/keys/x", { as: "alice" }),
      "x",
    );
    expect(remove.status).toBe(500);
    const list = await pages.keysPage(request("GET", "/keys", { as: "alice" }));
    expect(list.status).toBe(500);
    expect(await list.text()).not.toContain("PRIVATE KEY");
    expect(JSON.stringify(error.mock.calls)).not.toContain("PRIVATE KEY");
  });

  it("removes only the caller's key", async () => {
    const { pages, rows, store } = setup();
    await store.insert("u-alice", {
      id: "a1",
      keyId: "A",
      privateKey: "c",
      issuerId: "",
    });
    await store.insert("u-bob", {
      id: "b1",
      keyId: "B",
      privateKey: "c",
      issuerId: "",
    });

    const foreign = await pages.removeKey(
      request("DELETE", "/keys/b1", { as: "alice" }),
      "b1",
    );
    expect(foreign.status).toBe(404);
    expect(rows.get("u-bob")).toHaveLength(1);

    const own = await pages.removeKey(
      request("DELETE", "/keys/a1", { as: "alice" }),
      "a1",
    );
    expect(own.status).toBe(200);
    expect(rows.get("u-alice")).toEqual([]);
    expect(rows.get("u-bob")).toHaveLength(1);
  });
});
