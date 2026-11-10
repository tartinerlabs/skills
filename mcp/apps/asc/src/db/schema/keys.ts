import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { users } from "./auth.ts";

/** App Store Connect API keys users add at /keys; never generated. */
export const ascKeys = sqliteTable(
  "asc_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Empty for an individual key. */
    issuerId: text("issuer_id").notNull(),
    keyId: text("key_id").notNull(),
    /** The `.p8` PEM, encrypted with `encryptSecret`. */
    privateKey: text("private_key").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("ascKeys_userId_keyId_uidx").on(table.userId, table.keyId),
  ],
);
