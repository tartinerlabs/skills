import {
  decryptSecret,
  type KeyRecord,
  type KeyStore,
  type SecretAuth,
} from "@repo/core/keys";
import { importP256PrivateKey, signEs256Jwt } from "@repo/core/signing";
import type { AscKeyFields } from "../schemas/common.ts";
import {
  AscApiError,
  CredentialsError,
  NetworkError,
  UnexpectedResponseError,
} from "../utils/errors.ts";

/** One JSON:API resource; `attributes` is shaped by the endpoint. */
export interface AscResource<Attributes = Record<string, unknown>> {
  type: string;
  id: string;
  attributes?: Attributes;
  relationships?: Record<
    string,
    { data?: { type: string; id: string } | null } | undefined
  >;
}

/** A paged App Store Connect collection response. */
export interface AscDocument<Attributes> {
  data: AscResource<Attributes>[];
  included?: AscResource[];
  links?: { self?: string; next?: string };
  meta?: { paging?: { total?: number; limit?: number } };
}

/** Query values; arrays are comma-joined and `undefined` is left out. */
export type AscQuery = Record<
  string,
  string | number | boolean | readonly string[] | undefined
>;

/** The App Store Connect operation the MCP tools depend on. */
export interface AscClient {
  get<T>(path: string, query?: AscQuery): Promise<T>;
}

/**
 * Resolves the client lazily, inside each tool call, so a missing key surfaces
 * as a tool error rather than an HTTP error.
 */
export type AscClientProvider = (
  keyId: string | undefined,
) => AscClient | Promise<AscClient>;

export type AscKey = KeyRecord<AscKeyFields>;

export interface UserKeyAccess {
  store: Pick<KeyStore<AscKeyFields>, "list">;
  auth: SecretAuth;
  /** The key management page, named in "add a key" errors. */
  keysUrl: string;
  fetch?: typeof fetch;
  /** @default Date.now */
  now?: () => number;
}

const ASC_API = "https://api.appstoreconnect.apple.com";
const AUDIENCE = "appstoreconnect-v1";
// Apple accepts up to 20 minutes; a fresh short-lived token is signed per request.
const TOKEN_LIFETIME_S = 120;
const TIMEOUT_MS = 30_000;

function describeKey(key: AscKey): string {
  return `${key.keyId} (${key.issuerId ? "team" : "individual"})`;
}

/** The key to use: the only one, or the one matching `keyId`. */
export function selectKey(
  keys: AscKey[],
  keyId: string | undefined,
  keysUrl: string,
): AscKey {
  if (keys.length === 0) {
    throw new CredentialsError(
      `No App Store Connect API key is stored for your account. Add one at ${keysUrl}, then retry.`,
    );
  }
  if (keyId !== undefined) {
    const key = keys.find((candidate) => candidate.keyId === keyId);
    if (key) return key;
    throw new CredentialsError(
      `No stored key has key ID ${keyId}. Your keys: ${keys.map(describeKey).join(", ")}. Manage them at ${keysUrl}.`,
    );
  }
  const [only] = keys;
  if (keys.length === 1 && only) return only;
  throw new CredentialsError(
    `You have ${keys.length} App Store Connect keys: ${keys.map(describeKey).join(", ")}. Pass key_id to choose one.`,
  );
}

/** A team key names its issuer; an individual key uses `sub: "user"` instead. */
export function tokenClaims(
  key: Pick<AscKey, "issuerId">,
  nowMs: number,
): Record<string, unknown> {
  const iat = Math.floor(nowMs / 1000);
  const subject = key.issuerId ? { iss: key.issuerId } : { sub: "user" };
  return { ...subject, iat, exp: iat + TOKEN_LIFETIME_S, aud: AUDIENCE };
}

/** Signs a fresh ES256 token for every request with the user's chosen key. */
export async function getUserAscClient(
  userId: string,
  keyId: string | undefined,
  { store, auth, keysUrl, fetch: fetchImpl, now = Date.now }: UserKeyAccess,
): Promise<AscClient> {
  const key = selectKey(await store.list(userId), keyId, keysUrl);
  let signingKey: CryptoKey;
  try {
    signingKey = await importP256PrivateKey(
      await decryptSecret(auth, key.privateKey),
    );
  } catch {
    throw new CredentialsError(
      `The stored key ${key.keyId} could not be read. Remove it and add it again at ${keysUrl}.`,
    );
  }
  // Not the bare global: Workers rejects `fetch` called with another `this`.
  const send = fetchImpl ?? ((input, init) => fetch(input, init));

  return {
    async get<T>(path: string, query: AscQuery = {}): Promise<T> {
      const url = new URL(path, ASC_API);
      for (const [name, value] of Object.entries(query)) {
        if (value === undefined) continue;
        url.searchParams.set(
          name,
          Array.isArray(value) ? value.join(",") : String(value),
        );
      }
      const token = await signEs256Jwt({
        header: { kid: key.keyId, typ: "JWT" },
        payload: tokenClaims(key, now()),
        key: signingKey,
      });
      const response = await send(url, {
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }).catch((error: unknown) => {
        if (error instanceof TypeError) {
          throw new NetworkError("fetch failed", { cause: error });
        }
        throw error;
      });
      // Some errors (e.g. 406) are plain text, not JSON:API.
      const data: unknown = await response.json().catch(() => undefined);
      if (!response.ok) throw new AscApiError(response.status, data);
      if (data === undefined) {
        throw new UnexpectedResponseError(
          "App Store Connect returned a response that is not JSON.",
        );
      }
      return data as T;
    },
  };
}

/** Paging summary for a single page; following `links.next` is not supported yet. */
export function pageInfo(document: AscDocument<unknown>): {
  total?: number;
  hasMore: boolean;
} {
  return {
    total: document.meta?.paging?.total,
    hasMore: document.links?.next !== undefined,
  };
}

/** The included resource a to-one relationship points at, if the response carries it. */
export function related<Attributes>(
  document: AscDocument<unknown>,
  resource: AscResource<unknown>,
  relationship: string,
): Attributes | undefined {
  const ref = resource.relationships?.[relationship]?.data;
  if (!ref) return undefined;
  return document.included?.find(
    (item) => item.type === ref.type && item.id === ref.id,
  )?.attributes as Attributes | undefined;
}
