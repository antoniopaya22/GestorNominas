import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, client } from "./index.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// `vercel.json` ejecuta este script como buildCommand del servicio backend —
// eso incluye cada preview deploy, no solo producción. Como solo hay una
// base de datos (Supabase), un preview migraría la BBDD de producción. Solo
// se salta automáticamente en Vercel cuando el entorno no es "production";
// en local (VERCEL_ENV no está definida) y en CI sigue ejecutándose siempre.
if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
  console.log(
    `⏭️  Saltando migraciones automáticas: VERCEL_ENV="${process.env.VERCEL_ENV}" (no es "production"). ` +
      `Ejecuta "npm run db:migrate" a mano si este preview necesita su propia base de datos.`,
  );
  await client.end();
  process.exit(0);
}

await migrate(db, { migrationsFolder: resolve(__dirname, "./migrations") });
await client.end();

console.log("✅ Migrations applied successfully");
