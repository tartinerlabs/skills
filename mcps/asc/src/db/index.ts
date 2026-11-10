import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { authRelations } from "./schema/auth.ts";

export const db = drizzle(env.DB, { relations: authRelations });
