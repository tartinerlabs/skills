import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import type * as z from "zod";
import type { Auth } from "./auth.ts";
import type { Logger } from "./logger.ts";
import { escapeHtml, page, scriptHash } from "./pages.ts";
import { importP256PrivateKey } from "./signing.ts";

/** What `encryptSecret` and `decryptSecret` need from Better Auth. */
export type SecretAuth = Pick<Auth, "$context">;

/**
 * Encrypts like Better Auth's own OAuth tokens, so `BETTER_AUTH_SECRETS`
 * rotation covers stored keys too.
 */
export async function encryptSecret(
  auth: SecretAuth,
  plaintext: string,
): Promise<string> {
  const { secretConfig } = await auth.$context;
  return symmetricEncrypt({ key: secretConfig, data: plaintext });
}

export async function decryptSecret(
  auth: SecretAuth,
  ciphertext: string,
): Promise<string> {
  const { secretConfig } = await auth.$context;
  return symmetricDecrypt({ key: secretConfig, data: ciphertext });
}

/** A stored key: the app's form fields, with the secret field encrypted. */
export type KeyRecord<Fields extends Record<string, string>> = Fields & {
  id: string;
};

/** The app's own table; core owns none. Every call is scoped to one user. */
export interface KeyStore<Fields extends Record<string, string>> {
  list(userId: string): Promise<KeyRecord<Fields>[]>;
  insert(userId: string, record: KeyRecord<Fields>): Promise<void>;
  /** Resolves false when the user has no key with that id. */
  remove(userId: string, id: string): Promise<boolean>;
}

/** The secret field's value; a key listed in the schema always has one. */
function secretValue(record: Record<string, string>, field: string): string {
  return record[field] as string;
}

export interface KeyPagesOptions<
  Schema extends z.ZodObject<Record<string, z.ZodType<string>>>,
  SecretField extends keyof z.output<Schema> & string,
> {
  auth: Auth;
  logger: Logger;
  /** Shown on the page, e.g. "the App Store Connect MCP server". */
  serverName: string;
  store: KeyStore<z.output<Schema>>;
  /**
   * The key form's fields; a field's `.describe()` text is its label. A field
   * that accepts `undefined` (`.default("")`) is optional on the form. Give
   * every field a `.max()`: core only caps the whole body.
   */
  schema: Schema;
  /** The field holding the PEM private key: validated, then stored encrypted. */
  secretField: SecretField;
  /** A short non-secret label for the key list, e.g. "Key ABC123". */
  describe: (record: Omit<KeyRecord<z.output<Schema>>, SecretField>) => string;
}

const KEYS_PATH = "/keys";
const MAX_BODY_BYTES = 16 * 1024;
const MAX_KEYS = 20;

// One script for both states: sign in, add (reload to list) and remove.
const KEYS_SCRIPT = `
const error = document.getElementById("error");
async function call(url, init) {
  const buttons = document.querySelectorAll("button");
  for (const b of buttons) b.disabled = true;
  error.hidden = true;
  try {
    const response = await fetch(url, { credentials: "same-origin", ...init });
    const data = await response.json().catch(() => ({}));
    if (response.ok) return data;
    error.textContent = data.error ?? "Something went wrong. Try again.";
  } catch {
    error.textContent = "Something went wrong. Try again.";
  }
  error.hidden = false;
  for (const b of buttons) b.disabled = false;
}
const json = { "content-type": "application/json" };
document.querySelector("button[data-signin]")?.addEventListener("click", async () => {
  const data = await call("/api/auth/sign-in/social", {
    method: "POST",
    headers: json,
    body: JSON.stringify({ provider: "google", callbackURL: "${KEYS_PATH}", disableRedirect: true }),
  });
  if (typeof data?.url === "string") location.href = data.url;
});
document.getElementById("add")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = await call("${KEYS_PATH}", {
    method: "POST",
    headers: json,
    body: JSON.stringify(Object.fromEntries(new FormData(event.target))),
  });
  if (data) location.reload();
});
for (const button of document.querySelectorAll("button[data-remove]")) {
  button.addEventListener("click", async () => {
    const data = await call("${KEYS_PATH}/" + encodeURIComponent(button.dataset.remove), { method: "DELETE" });
    if (data) location.reload();
  });
}
`;

function json(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

/**
 * The key management page and its JSON API, bound to one app's Better Auth
 * instance and key table. Mount one handler per route:
 *
 * - `keysPage`: `GET /keys`. Signed in, lists the user's keys (non-secret label
 *   only) with an add form and remove buttons; otherwise a "Sign in with
 *   Google" button that returns to `/keys`.
 * - `addKey`: `POST /keys`, a JSON body of the schema's fields.
 * - `removeKey(request, id)`: `DELETE /keys/{id}`, with `id` from the router.
 *
 * Both writes need a session and an `Origin` header equal to the origin of
 * Better Auth's base URL (`BETTER_AUTH_URL`), and a user holds at most 20 keys.
 * The private key must be a P-256 PKCS#8 PEM (an Apple `.p8`); it is encrypted
 * before `store.insert` and never returned, shown again or logged.
 */
export function createKeyPages<
  Schema extends z.ZodObject<Record<string, z.ZodType<string>>>,
  SecretField extends keyof z.output<Schema> & string,
>({
  auth,
  logger,
  serverName,
  store,
  schema,
  secretField,
  describe,
}: KeyPagesOptions<Schema, SecretField>) {
  type Fields = z.output<Schema>;

  function label(record: KeyRecord<Fields>): string {
    const { [secretField]: _secret, ...rest } = record;
    return describe(rest);
  }

  // Not the error message: a database error can quote the row.
  function failed(action: string, error: unknown): void {
    logger.error(
      { errorName: error instanceof Error ? error.name : typeof error },
      `${action} failed`,
    );
  }

  async function keysPage(request: Request): Promise<Response> {
    const session = await auth.api.getSession({ headers: request.headers });
    const hash = await scriptHash(KEYS_SCRIPT);
    if (!session) {
      return page(
        401,
        "Sign in",
        `<p>Sign in with Google to manage the keys ${escapeHtml(serverName)} uses.</p>
<div class="actions"><button type="button" class="primary" data-signin>Sign in with Google</button></div>
<p id="error" hidden></p>
<script>${KEYS_SCRIPT}</script>`,
        hash,
      );
    }

    let records: KeyRecord<Fields>[];
    try {
      records = await store.list(session.user.id);
    } catch (error) {
      failed("Listing keys", error);
      return page(
        500,
        "Keys",
        "<p>Your keys could not be loaded. Try again later.</p>",
      );
    }
    const fields = Object.entries(schema.shape)
      .map(([name, field]) => {
        const required = field.safeParse(undefined).success ? "" : " required";
        const control =
          name === secretField
            ? `<textarea name="${escapeHtml(name)}" rows="6"${required} spellcheck="false" autocomplete="off" placeholder="-----BEGIN PRIVATE KEY-----"></textarea>`
            : `<input name="${escapeHtml(name)}"${required} spellcheck="false" autocomplete="off">`;
        return `<label>${escapeHtml(field.description ?? name)}${control}</label>`;
      })
      .join("\n");
    const list = records.length
      ? `<ul>${records
          .map(
            (record) =>
              `<li><span>${escapeHtml(label(record))}</span><button type="button" data-remove="${escapeHtml(record.id)}">Remove</button></li>`,
          )
          .join("")}</ul>`
      : `<p class="muted">No keys yet.</p>`;
    return page(
      200,
      "Keys",
      `<p>Keys ${escapeHtml(serverName)} uses for ${escapeHtml(session.user.email)}. Private keys are stored encrypted and are never shown again.</p>
${list}
<form id="add">
${fields}
<div class="actions"><button type="submit" class="primary">Add key</button></div>
</form>
<p id="error" hidden></p>
<script>${KEYS_SCRIPT}</script>`,
      hash,
    );
  }

  /** The caller's user id, or the error response for a forged or signed-out write. */
  async function authorise(request: Request): Promise<string | Response> {
    const { baseURL } = await auth.$context;
    if (request.headers.get("origin") !== new URL(baseURL).origin) {
      return json(403, { error: "Forbidden." });
    }
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return json(401, { error: "Sign in to manage keys." });
    return session.user.id;
  }

  async function addKey(request: Request): Promise<Response> {
    const userId = await authorise(request);
    if (typeof userId !== "string") return userId;

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return json(415, { error: "Send a JSON body." });
    }
    const length = Number(request.headers.get("content-length"));
    if (length > MAX_BODY_BYTES) {
      return json(413, { error: "The request is too large." });
    }
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return json(413, { error: "The request is too large." });
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json(400, { error: "The body is not valid JSON." });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      // Field names only: an issue message could echo the submitted value.
      const names = [
        ...new Set(parsed.error.issues.map((issue) => issue.path.join("."))),
      ].filter(Boolean);
      return json(400, {
        error: `Check these fields: ${names.join(", ") || "the request"}.`,
      });
    }
    const fields: Fields = parsed.data;

    try {
      await importP256PrivateKey(secretValue(fields, secretField));
    } catch (error) {
      return json(400, {
        error: error instanceof Error ? error.message : "Invalid private key.",
      });
    }

    try {
      if ((await store.list(userId)).length >= MAX_KEYS) {
        return json(409, {
          error: `You can store up to ${MAX_KEYS} keys. Remove one first.`,
        });
      }
      const record: KeyRecord<Fields> = {
        ...fields,
        id: crypto.randomUUID(),
        [secretField]: await encryptSecret(
          auth,
          secretValue(fields, secretField),
        ),
      };
      await store.insert(userId, record);
      return json(201, { id: record.id, label: label(record) });
    } catch (error) {
      failed("Saving a key", error);
      return json(500, { error: "The key could not be saved." });
    }
  }

  async function removeKey(request: Request, id: string): Promise<Response> {
    const userId = await authorise(request);
    if (typeof userId !== "string") return userId;

    try {
      if (!(await store.remove(userId, id))) {
        return json(404, { error: "Not found." });
      }
    } catch (error) {
      failed("Removing a key", error);
      return json(500, { error: "The key could not be removed." });
    }
    return json(200, { ok: true });
  }

  return { keysPage, addKey, removeKey };
}
