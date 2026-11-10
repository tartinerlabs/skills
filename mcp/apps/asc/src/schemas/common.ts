import * as z from "zod";

/** Apple's API key IDs are 10 uppercase letters and digits, e.g. 2X9R4HXF34. */
const KEY_ID_PATTERN = /^[A-Z0-9]{10}$/;
const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const keyId = z
  .string()
  .trim()
  .max(10)
  .regex(KEY_ID_PATTERN, "Must be a 10-character key ID such as 2X9R4HXF34.");

/** The /keys form: Apple's issuer ID (team keys), key ID and `.p8` contents. */
export const keyFormSchema = z.object({
  issuerId: z
    .string()
    .trim()
    .max(36)
    .refine((value) => value === "" || GUID_PATTERN.test(value), {
      message: "Must be the issuer ID shown above the team's keys.",
    })
    .default("")
    .describe("Issuer ID (team keys only; leave empty for an individual key)"),
  keyId: keyId.describe("Key ID"),
  privateKey: z
    .string()
    .max(4096)
    .describe("Private key (the contents of the .p8 file)"),
});

export type AscKeyFields = z.output<typeof keyFormSchema>;

export const keyIdSchema = keyId
  .optional()
  .describe(
    "Key ID of the stored App Store Connect API key to use. Needed only when you have stored more than one.",
  );

export const appIdSchema = z
  .string()
  .trim()
  .regex(/^\d{1,20}$/, "Must be a numeric App Store Connect app ID.")
  .describe("App Store Connect app ID (the numeric id from list_apps).");

export const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(200)
  .default(50)
  .describe("Maximum number of results (1-200, default 50).");

export const PLATFORMS = ["IOS", "MAC_OS", "TV_OS", "VISION_OS"] as const;
