import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { logger } from "../utils/logger.ts";
import { authRelations } from "./schema/auth.ts";

export const db = drizzle(process.env.DATABASE_URL as string, {
  relations: authRelations,
});

// Close idle connections before Fluid Compute suspends the instance.
attachDatabasePool(db.$client);
// Without a listener, an idle connection dropped by Neon crashes the process.
db.$client.on("error", (error) =>
  logger.error(
    { errorName: error.name, errorMessage: error.message },
    "database pool error",
  ),
);
