import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, client } from "./index.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

await migrate(db, { migrationsFolder: resolve(__dirname, "./migrations") });
await client.end();

console.log("✅ Migrations applied successfully");
