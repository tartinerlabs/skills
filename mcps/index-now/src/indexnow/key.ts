import type { IndexNowClient } from "./client.ts";

/** Where IndexNow looks for the key file: keyLocation, or `<key>.txt` at the root of the URL's host. */
export function keyFileUrl(
  url: string,
  key: string,
  keyLocation?: string,
): string {
  return keyLocation ?? new URL(`/${key}.txt`, url).href;
}

/** Whether a key file at `keyLocation` may vouch for `url`: same host, in its directory or below. */
export function isCoveredBy(url: string, keyLocation: string): boolean {
  const page = new URL(url);
  const file = new URL(keyLocation);
  const directory = file.pathname.slice(0, file.pathname.lastIndexOf("/") + 1);
  return page.host === file.host && page.pathname.startsWith(directory);
}

/** Fetches the key file and resolves why it would fail IndexNow's check, or undefined when it passes. */
export async function checkKeyFile(
  client: Pick<IndexNowClient, "fetchKeyFile">,
  location: string,
  key: string,
): Promise<string | undefined> {
  const { status, text } = await client.fetchKeyFile(location);
  if (status >= 300 && status < 400) {
    return `${location} redirects (HTTP ${status}). Serve the key file at that URL directly, or pass the final URL as keyLocation.`;
  }
  if (status === 404) {
    return `${location} was not found (HTTP 404). Deploy the project's key file first; until it is live, nothing can be submitted for this host.`;
  }
  if (status !== 200) {
    return `${location} answered HTTP ${status} instead of the key file.`;
  }
  if (text.trim() !== key) {
    return `${location} does not contain the key. The file's contents must be exactly the key, as in its name.`;
  }
  return undefined;
}
