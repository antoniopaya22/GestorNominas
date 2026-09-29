import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";
import { env } from "../config.js";

const client = postgres(env.DATABASE_URL);

export { client };
export const db = drizzle(client, { schema });
