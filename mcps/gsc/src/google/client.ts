import {
  searchconsole,
  type searchconsole_v1,
} from "@googleapis/searchconsole";
import { isAPIError } from "better-auth/api";
import { OAuth2Client } from "google-auth-library";
import { auth, READ_SCOPE, WRITE_SCOPE } from "../lib/auth.ts";
import { CredentialsError } from "../utils/errors.ts";
import { logger } from "../utils/logger.ts";

type SearchAnalyticsRequest =
  searchconsole_v1.Schema$SearchAnalyticsQueryRequest;
export type SearchAnalyticsResponse =
  searchconsole_v1.Schema$SearchAnalyticsQueryResponse;
type InspectUrlRequest = searchconsole_v1.Schema$InspectUrlIndexRequest;
type InspectUrlResponse = searchconsole_v1.Schema$InspectUrlIndexResponse;
type SitesListResponse = searchconsole_v1.Schema$SitesListResponse;
type SitemapsListResponse = searchconsole_v1.Schema$SitemapsListResponse;

/** The Search Console operations the MCP tools depend on. */
export interface GscClient {
  listSites(): Promise<SitesListResponse>;
  listSitemaps(siteUrl: string): Promise<SitemapsListResponse>;
  querySearchAnalytics(
    siteUrl: string,
    body: SearchAnalyticsRequest,
  ): Promise<SearchAnalyticsResponse>;
  inspectUrl(body: InspectUrlRequest): Promise<InspectUrlResponse>;
  submitSitemap(siteUrl: string, feedpath: string): Promise<void>;
}

/**
 * Resolves the client lazily, inside each tool call, so the server starts
 * without credentials and auth failures surface as tool errors.
 */
export type GscClientProvider = () => GscClient | Promise<GscClient>;

function createGscClient(auth: OAuth2Client, granted: Set<string>): GscClient {
  const api = searchconsole({ version: "v1", auth });
  return {
    async listSites() {
      return (await api.sites.list()).data;
    },
    async listSitemaps(siteUrl) {
      return (await api.sitemaps.list({ siteUrl })).data;
    },
    async querySearchAnalytics(siteUrl, body) {
      return (await api.searchanalytics.query({ siteUrl, requestBody: body }))
        .data;
    },
    async inspectUrl(body) {
      return (await api.urlInspection.index.inspect({ requestBody: body }))
        .data;
    },
    async submitSitemap(siteUrl, feedpath) {
      if (!granted.has(WRITE_SCOPE)) {
        throw new CredentialsError(
          "Submitting sitemaps needs write access to Search Console, which this sign-in did not grant. Reconnect to approve it.",
        );
      }
      await api.sitemaps.submit({ siteUrl, feedpath });
    },
  };
}

/** A Search Console client acting as the given Better Auth user. */
export async function getUserGscClient(userId: string): Promise<GscClient> {
  const { internalAdapter } = await auth.$context;
  const account = (await internalAdapter.findAccounts(userId)).find(
    (candidate) => candidate.providerId === "google",
  );
  if (!account) {
    throw new CredentialsError("No Google account is linked to this sign-in.");
  }

  // Google's granular consent lets the user untick the Search Console permission.
  const granted = new Set((account.scope ?? "").split(/[\s,]+/));
  if (!granted.has(READ_SCOPE) && !granted.has(WRITE_SCOPE)) {
    throw new CredentialsError(
      "Google did not grant access to Search Console data (the permission was not ticked on Google's consent screen).",
    );
  }

  let accessToken: string | undefined;
  try {
    // Refreshes the token first when it has expired.
    ({ accessToken } = await auth.api.getAccessToken({
      body: { accountId: account.id, userId },
    }));
  } catch (error) {
    if (isAPIError(error)) {
      // The same error class covers a revoked token, a missing account and an
      // undecryptable token, so record which one it was.
      logger.warn(
        { statusCode: error.statusCode, code: error.body?.code },
        "Google access token unavailable",
      );
      throw new CredentialsError(
        "Google access could not be renewed: the sign-in may have expired or been revoked. " +
          "Refresh tokens for OAuth apps in 'Testing' publishing status expire after 7 days.",
      );
    }
    throw error;
  }
  if (!accessToken) {
    throw new CredentialsError("No Google access token is stored.");
  }

  const client = new OAuth2Client();
  client.setCredentials({ access_token: accessToken });
  return createGscClient(client, granted);
}
