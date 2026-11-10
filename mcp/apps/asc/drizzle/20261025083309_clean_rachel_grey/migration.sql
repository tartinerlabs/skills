CREATE TABLE `accounts` (
	`id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `jwkss` (
	`id` text PRIMARY KEY,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`alg` text,
	`crv` text
);
--> statement-breakpoint
CREATE TABLE `oauth_access_tokens` (
	`id` text PRIMARY KEY,
	`token` text UNIQUE,
	`client_id` text NOT NULL,
	`session_id` text,
	`user_id` text,
	`reference_id` text,
	`authorization_code_id` text,
	`resources` text,
	`requested_user_info_claims` text,
	`refresh_id` text,
	`expires_at` integer,
	`created_at` integer,
	`revoked` integer,
	`confirmation` text,
	`scopes` text NOT NULL,
	CONSTRAINT `fk_oauth_access_tokens_client_id_oauth_clients_client_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_oauth_access_tokens_session_id_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_oauth_access_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_oauth_access_tokens_refresh_id_oauth_refresh_tokens_id_fk` FOREIGN KEY (`refresh_id`) REFERENCES `oauth_refresh_tokens`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `oauth_client_assertions` (
	`id` text PRIMARY KEY,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_client_resources` (
	`id` text PRIMARY KEY,
	`client_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`metadata` text,
	`created_at` integer,
	CONSTRAINT `fk_oauth_client_resources_client_id_oauth_clients_client_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_oauth_client_resources_resource_id_oauth_resources_identifier_fk` FOREIGN KEY (`resource_id`) REFERENCES `oauth_resources`(`identifier`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `oauth_clients` (
	`id` text PRIMARY KEY,
	`client_id` text NOT NULL UNIQUE,
	`client_secret` text,
	`client_discovery_id` text,
	`disabled` integer DEFAULT false,
	`skip_consent` integer,
	`enable_end_session` integer,
	`subject_type` text,
	`scopes` text,
	`client_credentials_scopes` text DEFAULT '[]',
	`user_id` text,
	`created_at` integer,
	`updated_at` integer,
	`name` text,
	`uri` text,
	`icon` text,
	`contacts` text,
	`tos` text,
	`policy` text,
	`software_id` text,
	`software_version` text,
	`software_statement` text,
	`redirect_uris` text NOT NULL,
	`post_logout_redirect_uris` text,
	`backchannel_logout_uri` text,
	`backchannel_logout_session_required` integer,
	`token_endpoint_auth_method` text,
	`application_type` text,
	`jwks` text,
	`jwks_uri` text,
	`grant_types` text,
	`response_types` text,
	`require_pkce` integer,
	`dpop_bound_access_tokens` integer DEFAULT false,
	`reference_id` text,
	`metadata` text,
	CONSTRAINT `fk_oauth_clients_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `oauth_consents` (
	`id` text PRIMARY KEY,
	`client_id` text NOT NULL,
	`user_id` text,
	`reference_id` text,
	`resources` text,
	`requested_user_info_claims` text,
	`scopes` text NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	CONSTRAINT `fk_oauth_consents_client_id_oauth_clients_client_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_oauth_consents_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `oauth_refresh_tokens` (
	`id` text PRIMARY KEY,
	`token` text NOT NULL UNIQUE,
	`client_id` text NOT NULL,
	`session_id` text,
	`user_id` text NOT NULL,
	`reference_id` text,
	`authorization_code_id` text,
	`resources` text,
	`requested_user_info_claims` text,
	`expires_at` integer,
	`created_at` integer,
	`revoked` integer,
	`rotated_at` integer,
	`rotation_replay_response` text,
	`rotation_replay_expires_at` integer,
	`auth_time` integer,
	`confirmation` text,
	`scopes` text NOT NULL,
	CONSTRAINT `fk_oauth_refresh_tokens_client_id_oauth_clients_client_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_oauth_refresh_tokens_session_id_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_oauth_refresh_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `oauth_resources` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL UNIQUE,
	`name` text NOT NULL,
	`access_token_ttl` integer,
	`refresh_token_ttl` integer,
	`signing_algorithm` text,
	`signing_key_id` text,
	`allowed_scopes` text,
	`custom_claims` text,
	`dpop_bound_access_tokens_required` integer DEFAULT false,
	`disabled` integer DEFAULT false,
	`created_at` integer,
	`updated_at` integer,
	`policy_version` integer DEFAULT 1,
	`metadata` text
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	CONSTRAINT `fk_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `asc_keys` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`issuer_id` text NOT NULL,
	`key_id` text NOT NULL,
	`private_key` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_asc_keys_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `accounts_userId_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessTokens_clientId_idx` ON `oauth_access_tokens` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessTokens_sessionId_idx` ON `oauth_access_tokens` (`session_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessTokens_userId_idx` ON `oauth_access_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessTokens_authorizationCodeId_idx` ON `oauth_access_tokens` (`authorization_code_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessTokens_refreshId_idx` ON `oauth_access_tokens` (`refresh_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauthClientResources_clientId_resourceId_uidx` ON `oauth_client_resources` (`client_id`,`resource_id`);--> statement-breakpoint
CREATE INDEX `oauthClientResources_clientId_idx` ON `oauth_client_resources` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauthClientResources_resourceId_idx` ON `oauth_client_resources` (`resource_id`);--> statement-breakpoint
CREATE INDEX `oauthClients_userId_idx` ON `oauth_clients` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauthConsents_clientId_idx` ON `oauth_consents` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauthConsents_userId_idx` ON `oauth_consents` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauthRefreshTokens_clientId_idx` ON `oauth_refresh_tokens` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauthRefreshTokens_sessionId_idx` ON `oauth_refresh_tokens` (`session_id`);--> statement-breakpoint
CREATE INDEX `oauthRefreshTokens_userId_idx` ON `oauth_refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauthRefreshTokens_authorizationCodeId_idx` ON `oauth_refresh_tokens` (`authorization_code_id`);--> statement-breakpoint
CREATE INDEX `sessions_userId_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);--> statement-breakpoint
CREATE UNIQUE INDEX `ascKeys_userId_keyId_uidx` ON `asc_keys` (`user_id`,`key_id`);