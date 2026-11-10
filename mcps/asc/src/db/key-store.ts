import type { KeyStore } from "@repo/core/keys";
import { and, eq } from "drizzle-orm";
import type { AscKeyFields } from "../schemas/common.ts";
import { db } from "./index.ts";
import { ascKeys } from "./schema/keys.ts";

const columns = {
  id: ascKeys.id,
  issuerId: ascKeys.issuerId,
  keyId: ascKeys.keyId,
  privateKey: ascKeys.privateKey,
};

/** The user's App Store Connect keys in D1; every query is scoped to one user. */
export const keyStore: KeyStore<AscKeyFields> = {
  list(userId) {
    return db
      .select(columns)
      .from(ascKeys)
      .where(eq(ascKeys.userId, userId))
      .orderBy(ascKeys.createdAt);
  },
  async insert(userId, record) {
    await db.insert(ascKeys).values({ ...record, userId });
  },
  async remove(userId, id) {
    const removed = await db
      .delete(ascKeys)
      .where(and(eq(ascKeys.id, id), eq(ascKeys.userId, userId)))
      .returning({ id: ascKeys.id });
    return removed.length > 0;
  },
};
