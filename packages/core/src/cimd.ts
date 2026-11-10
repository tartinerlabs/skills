import {
  classifyHost,
  isPublicRoutableHost,
} from "@better-auth/core/utils/host";
import type { ClientMetadataResourceFetch } from "@better-auth/oauth-provider";

const DOH_URL = "https://cloudflare-dns.com/dns-query";
const RECORD_TYPES = { A: 1, AAAA: 28 } as const;

/** A or AAAA answers for a hostname from Cloudflare's DNS-over-HTTPS JSON API. */
async function resolve(
  hostname: string,
  type: keyof typeof RECORD_TYPES,
  signal: AbortSignal | null | undefined,
): Promise<string[]> {
  const url = new URL(DOH_URL);
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", type);
  const response = await fetch(url, {
    headers: { accept: "application/dns-json" },
    signal,
  });
  if (!response.ok) throw new TypeError("metadata hostname lookup failed");
  const body = (await response.json()) as {
    Status?: number;
    Answer?: { type: number; data: string }[];
  };
  if (body.Status !== 0) throw new TypeError("metadata hostname lookup failed");
  return (body.Answer ?? [])
    .filter((answer) => answer.type === RECORD_TYPES[type])
    .map((answer) => answer.data);
}

/**
 * Runtime-neutral CIMD transport for Workers: HTTPS GET/HEAD only, every A and
 * AAAA answer (resolved over DNS-over-HTTPS) must be public-routable, and
 * redirects are rejected rather than followed.
 *
 * Unlike `@better-auth/cimd/node`, it cannot pin the connection to the checked
 * address, so a DNS rebinding window remains.
 */
export const fetchClientMetadataResource: ClientMetadataResourceFetch = async (
  input,
  init,
) => {
  // Not `new Request(input, init)`: Workers throws on the `redirect: "error"` CIMD passes.
  const request = input instanceof Request ? input : undefined;
  const url = new URL(request ? request.url : String(input));
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  const signal = init?.signal ?? request?.signal;
  if (url.protocol !== "https:") {
    throw new TypeError("CIMD transport requires an HTTPS URL");
  }
  if (method !== "GET" && method !== "HEAD") {
    throw new TypeError("CIMD transport supports only GET and HEAD");
  }
  if (!isPublicRoutableHost(url.hostname)) {
    throw new TypeError("metadata host must be public-routable");
  }
  if (classifyHost(url.hostname).literal === "fqdn") {
    const addresses = (
      await Promise.all([
        resolve(url.hostname, "A", signal),
        resolve(url.hostname, "AAAA", signal),
      ])
    ).flat();
    if (addresses.length === 0) {
      throw new TypeError("metadata hostname returned no DNS addresses");
    }
    if (!addresses.every(isPublicRoutableHost)) {
      throw new TypeError(
        "metadata hostname must resolve only to public-routable addresses",
      );
    }
  }

  const response = await fetch(url, {
    method,
    headers: init?.headers ?? request?.headers,
    signal,
    redirect: "manual",
  });
  if (
    response.type === "opaqueredirect" ||
    (response.status >= 300 && response.status < 400 && response.status !== 304)
  ) {
    throw new TypeError("metadata responses must not redirect");
  }
  return response;
};
