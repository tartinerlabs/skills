import { defineRelationsPart, sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("sessions_userId_idx").on(table.userId)],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("accounts_userId_idx").on(table.userId)],
);

export const verifications = sqliteTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const jwkss = sqliteTable("jwkss", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  alg: text("alg"),
  crv: text("crv"),
});

export const oauthClients = sqliteTable(
  "oauth_clients",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    clientDiscoveryId: text("client_discovery_id"),
    disabled: integer("disabled", { mode: "boolean" }).default(false),
    skipConsent: integer("skip_consent", { mode: "boolean" }),
    enableEndSession: integer("enable_end_session", { mode: "boolean" }),
    subjectType: text("subject_type"),
    scopes: text("scopes", { mode: "json" }),
    clientCredentialsScopes: text("client_credentials_scopes", {
      mode: "json",
    }).default([]),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: text("contacts", { mode: "json" }),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("software_id"),
    softwareVersion: text("software_version"),
    softwareStatement: text("software_statement"),
    redirectUris: text("redirect_uris", { mode: "json" }).notNull(),
    postLogoutRedirectUris: text("post_logout_redirect_uris", { mode: "json" }),
    backchannelLogoutUri: text("backchannel_logout_uri"),
    backchannelLogoutSessionRequired: integer(
      "backchannel_logout_session_required",
      { mode: "boolean" },
    ),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    applicationType: text("application_type"),
    jwks: text("jwks"),
    jwksUri: text("jwks_uri"),
    grantTypes: text("grant_types", { mode: "json" }),
    responseTypes: text("response_types", { mode: "json" }),
    requirePKCE: integer("require_pkce", { mode: "boolean" }),
    dpopBoundAccessTokens: integer("dpop_bound_access_tokens", {
      mode: "boolean",
    }).default(false),
    referenceId: text("reference_id"),
    metadata: text("metadata", { mode: "json" }),
  },
  (table) => [index("oauthClients_userId_idx").on(table.userId)],
);

export const oauthResources = sqliteTable("oauth_resources", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  name: text("name").notNull(),
  accessTokenTtl: integer("access_token_ttl"),
  refreshTokenTtl: integer("refresh_token_ttl"),
  signingAlgorithm: text("signing_algorithm"),
  signingKeyId: text("signing_key_id"),
  allowedScopes: text("allowed_scopes", { mode: "json" }),
  customClaims: text("custom_claims", { mode: "json" }),
  dpopBoundAccessTokensRequired: integer("dpop_bound_access_tokens_required", {
    mode: "boolean",
  }).default(false),
  disabled: integer("disabled", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  policyVersion: integer("policy_version").default(1),
  metadata: text("metadata", { mode: "json" }),
});

export const oauthClientResources = sqliteTable(
  "oauth_client_resources",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => oauthResources.identifier, { onDelete: "cascade" }),
    metadata: text("metadata", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("oauthClientResources_clientId_resourceId_uidx").on(
      table.clientId,
      table.resourceId,
    ),
    index("oauthClientResources_clientId_idx").on(table.clientId),
    index("oauthClientResources_resourceId_idx").on(table.resourceId),
  ],
);

export const oauthRefreshTokens = sqliteTable(
  "oauth_refresh_tokens",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources", { mode: "json" }),
    requestedUserInfoClaims: text("requested_user_info_claims", {
      mode: "json",
    }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    revoked: integer("revoked", { mode: "timestamp_ms" }),
    rotatedAt: integer("rotated_at", { mode: "timestamp_ms" }),
    rotationReplayResponse: text("rotation_replay_response"),
    rotationReplayExpiresAt: integer("rotation_replay_expires_at", {
      mode: "timestamp_ms",
    }),
    authTime: integer("auth_time", { mode: "timestamp_ms" }),
    confirmation: text("confirmation", { mode: "json" }),
    scopes: text("scopes", { mode: "json" }).notNull(),
  },
  (table) => [
    index("oauthRefreshTokens_clientId_idx").on(table.clientId),
    index("oauthRefreshTokens_sessionId_idx").on(table.sessionId),
    index("oauthRefreshTokens_userId_idx").on(table.userId),
    index("oauthRefreshTokens_authorizationCodeId_idx").on(
      table.authorizationCodeId,
    ),
  ],
);

export const oauthAccessTokens = sqliteTable(
  "oauth_access_tokens",
  {
    id: text("id").primaryKey(),
    token: text("token").unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources", { mode: "json" }),
    requestedUserInfoClaims: text("requested_user_info_claims", {
      mode: "json",
    }),
    refreshId: text("refresh_id").references(() => oauthRefreshTokens.id, {
      onDelete: "cascade",
    }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    revoked: integer("revoked", { mode: "timestamp_ms" }),
    confirmation: text("confirmation", { mode: "json" }),
    scopes: text("scopes", { mode: "json" }).notNull(),
  },
  (table) => [
    index("oauthAccessTokens_clientId_idx").on(table.clientId),
    index("oauthAccessTokens_sessionId_idx").on(table.sessionId),
    index("oauthAccessTokens_userId_idx").on(table.userId),
    index("oauthAccessTokens_authorizationCodeId_idx").on(
      table.authorizationCodeId,
    ),
    index("oauthAccessTokens_refreshId_idx").on(table.refreshId),
  ],
);

export const oauthConsents = sqliteTable(
  "oauth_consents",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    resources: text("resources", { mode: "json" }),
    requestedUserInfoClaims: text("requested_user_info_claims", {
      mode: "json",
    }),
    scopes: text("scopes", { mode: "json" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("oauthConsents_clientId_idx").on(table.clientId),
    index("oauthConsents_userId_idx").on(table.userId),
  ],
);

export const oauthClientAssertions = sqliteTable("oauth_client_assertions", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const authRelations = defineRelationsPart(
  {
    users,
    sessions,
    accounts,
    verifications,
    jwkss,
    oauthClients,
    oauthResources,
    oauthClientResources,
    oauthRefreshTokens,
    oauthAccessTokens,
    oauthConsents,
    oauthClientAssertions,
  },
  (r) => ({
    users: {
      sessions: r.many.sessions({
        from: r.users.id,
        to: r.sessions.userId,
      }),
      accounts: r.many.accounts({
        from: r.users.id,
        to: r.accounts.userId,
      }),
      oauthClients: r.many.oauthClients({
        from: r.users.id,
        to: r.oauthClients.userId,
      }),
      oauthRefreshTokens: r.many.oauthRefreshTokens({
        from: r.users.id,
        to: r.oauthRefreshTokens.userId,
      }),
      oauthAccessTokens: r.many.oauthAccessTokens({
        from: r.users.id,
        to: r.oauthAccessTokens.userId,
      }),
      oauthConsents: r.many.oauthConsents({
        from: r.users.id,
        to: r.oauthConsents.userId,
      }),
    },
    sessions: {
      user: r.one.users({
        from: r.sessions.userId,
        to: r.users.id,
      }),
      oauthRefreshTokens: r.many.oauthRefreshTokens({
        from: r.sessions.id,
        to: r.oauthRefreshTokens.sessionId,
      }),
      oauthAccessTokens: r.many.oauthAccessTokens({
        from: r.sessions.id,
        to: r.oauthAccessTokens.sessionId,
      }),
    },
    accounts: {
      user: r.one.users({
        from: r.accounts.userId,
        to: r.users.id,
      }),
    },
    oauthClients: {
      user: r.one.users({
        from: r.oauthClients.userId,
        to: r.users.id,
      }),
      oauthClientResources: r.many.oauthClientResources({
        from: r.oauthClients.clientId,
        to: r.oauthClientResources.clientId,
      }),
      oauthRefreshTokens: r.many.oauthRefreshTokens({
        from: r.oauthClients.clientId,
        to: r.oauthRefreshTokens.clientId,
      }),
      oauthAccessTokens: r.many.oauthAccessTokens({
        from: r.oauthClients.clientId,
        to: r.oauthAccessTokens.clientId,
      }),
      oauthConsents: r.many.oauthConsents({
        from: r.oauthClients.clientId,
        to: r.oauthConsents.clientId,
      }),
    },
    oauthResources: {
      oauthClientResources: r.many.oauthClientResources({
        from: r.oauthResources.identifier,
        to: r.oauthClientResources.resourceId,
      }),
    },
    oauthClientResources: {
      oauthClient: r.one.oauthClients({
        from: r.oauthClientResources.clientId,
        to: r.oauthClients.clientId,
      }),
      oauthResource: r.one.oauthResources({
        from: r.oauthClientResources.resourceId,
        to: r.oauthResources.identifier,
      }),
    },
    oauthRefreshTokens: {
      oauthClient: r.one.oauthClients({
        from: r.oauthRefreshTokens.clientId,
        to: r.oauthClients.clientId,
      }),
      session: r.one.sessions({
        from: r.oauthRefreshTokens.sessionId,
        to: r.sessions.id,
      }),
      user: r.one.users({
        from: r.oauthRefreshTokens.userId,
        to: r.users.id,
      }),
      oauthAccessTokens: r.many.oauthAccessTokens({
        from: r.oauthRefreshTokens.id,
        to: r.oauthAccessTokens.refreshId,
      }),
    },
    oauthAccessTokens: {
      oauthClient: r.one.oauthClients({
        from: r.oauthAccessTokens.clientId,
        to: r.oauthClients.clientId,
      }),
      session: r.one.sessions({
        from: r.oauthAccessTokens.sessionId,
        to: r.sessions.id,
      }),
      user: r.one.users({
        from: r.oauthAccessTokens.userId,
        to: r.users.id,
      }),
      oauthRefreshToken: r.one.oauthRefreshTokens({
        from: r.oauthAccessTokens.refreshId,
        to: r.oauthRefreshTokens.id,
      }),
    },
    oauthConsents: {
      oauthClient: r.one.oauthClients({
        from: r.oauthConsents.clientId,
        to: r.oauthClients.clientId,
      }),
      user: r.one.users({
        from: r.oauthConsents.userId,
        to: r.users.id,
      }),
    },
  }),
);
