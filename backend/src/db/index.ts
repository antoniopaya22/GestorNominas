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

// Para funciones de servicio que a veces se llaman sueltas y a veces deben
// formar parte de una transacción más grande abierta por quien las llama
// (p. ej. actualizar una recurrente y regenerar sus ocurrencias como una
// sola unidad) — aceptan `db` o el `tx` que entrega `db.transaction(...)`.
export type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
