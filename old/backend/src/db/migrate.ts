import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./index.js";
import { ensureLocalUser } from "./seed.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

migrate(db, { migrationsFolder: resolve(__dirname, "./migrations") });
await ensureLocalUser();

console.log("✅ Migrations applied successfully");
