import * as z from "zod";

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** A public site's URL: http(s), a dotted host name, no IP literal or credentials. */
export function parsePublicUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    const isNamedHost =
      url.hostname.includes(".") &&
      !IPV4.test(url.hostname) &&
      !url.hostname.startsWith("[") &&
      !url.hostname.endsWith(".localhost");
    return isHttp && isNamedHost && !url.username && !url.password
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

export const publicUrlSchema = z
  .string()
  .trim()
  .refine((value) => parsePublicUrl(value) !== undefined, {
    message:
      "Must be an absolute http:// or https:// URL on a public host name (no IP address or localhost).",
  });

/** IndexNow keys: 8 to 128 characters of a-z, A-Z, 0-9 and dashes. */
export const keySchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9-]{8,128}$/, {
    message:
      "key must be 8 to 128 characters of letters, digits and dashes: the name of the project's <key>.txt file without .txt.",
  })
  .describe(
    "The IndexNow key: the name of the key file in the project (e.g. public/<key>.txt), whose contents are the same key.",
  );

export const keyLocationSchema = publicUrlSchema
  .optional()
  .describe(
    "Full URL of the key file when it is not at the site root. It covers only URLs in its own directory and below. " +
      "Omit when the file is served at https://<host>/<key>.txt.",
  );
