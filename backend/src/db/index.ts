import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";
import { env } from "../config.js";

// prepare: false — necesario contra el Transaction Pooler de Supabase (puerto
// 6543), el recomendado para funciones serverless. Ese modo no soporta
// prepared statements; con conexión directa esta opción es simplemente un no-op.
const client = postgres(env.DATABASE_URL, { prepare: false });

export { client };
export const db = drizzle(client, { schema });
