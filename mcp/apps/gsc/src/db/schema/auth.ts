import { defineRelationsPart, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("sessions_userId_idx").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("accounts_userId_idx").on(table.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const jwkss = pgTable("jwkss", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at"),
  alg: text("alg"),
  crv: text("crv"),
});

export const oauthClients = pgTable(
  "oauth_clients",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    clientDiscoveryId: text("client_discovery_id"),
    disabled: boolean("disabled").default(false),
    skipConsent: boolean("skip_consent"),
    enableEndSession: boolean("enable_end_session"),
    subjectType: text("subject_type"),
    scopes: text("scopes").array(),
    clientCredentialsScopes: text("client_credentials_scopes")
      .array()
      .default([]),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: text("contacts").array(),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("software_id"),
    softwareVersion: text("software_version"),
    softwareStatement: text("software_statement"),
    redirectUris: text("redirect_uris").array().notNull(),
    postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
    backchannelLogoutUri: text("backchannel_logout_uri"),
    backchannelLogoutSessionRequired: boolean(
      "backchannel_logout_session_required",
    ),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    applicationType: text("application_type"),
    jwks: text("jwks"),
    jwksUri: text("jwks_uri"),
    grantTypes: text("grant_types").array(),
    responseTypes: text("response_types").array(),
    requirePKCE: boolean("require_pkce"),
    dpopBoundAccessTokens: boolean("dpop_bound_access_tokens").default(false),
    referenceId: text("reference_id"),
    metadata: jsonb("metadata"),
  },
  (table) => [index("oauthClients_userId_idx").on(table.userId)],
);

export const oauthResources = pgTable("oauth_resources", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  identifier: text("identifier").notNull().unique(),
  name: text("name").notNull(),
  accessTokenTtl: integer("access_token_ttl"),
  refreshTokenTtl: integer("refresh_token_ttl"),
  signingAlgorithm: text("signing_algorithm"),
  signingKeyId: text("signing_key_id"),
  allowedScopes: text("allowed_scopes").array(),
  customClaims: jsonb("custom_claims"),
  dpopBoundAccessTokensRequired: boolean(
    "dpop_bound_access_tokens_required",
  ).default(false),
  disabled: boolean("disabled").default(false),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  policyVersion: integer("policy_version").default(1),
  metadata: jsonb("metadata"),
});

export const oauthClientResources = pgTable(
  "oauth_client_resources",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => oauthResources.identifier, { onDelete: "cascade" }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at"),
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

export const oauthRefreshTokens = pgTable(
  "oauth_refresh_tokens",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at"),
    revoked: timestamp("revoked"),
    rotatedAt: timestamp("rotated_at"),
    rotationReplayResponse: text("rotation_replay_response"),
    rotationReplayExpiresAt: timestamp("rotation_replay_expires_at"),
    authTime: timestamp("auth_time"),
    confirmation: jsonb("confirmation"),
    scopes: text("scopes").array().notNull(),
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

export const oauthAccessTokens = pgTable(
  "oauth_access_tokens",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    token: text("token").unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    refreshId: uuid("refresh_id").references(() => oauthRefreshTokens.id, {
      onDelete: "cascade",
    }),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at"),
    revoked: timestamp("revoked"),
    confirmation: jsonb("confirmation"),
    scopes: text("scopes").array().notNull(),
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

export const oauthConsents = pgTable(
  "oauth_consents",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    scopes: text("scopes").array().notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("oauthConsents_clientId_idx").on(table.clientId),
    index("oauthConsents_userId_idx").on(table.userId),
  ],
);

export const oauthClientAssertions = pgTable("oauth_client_assertions", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
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
