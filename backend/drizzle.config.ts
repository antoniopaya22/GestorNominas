import { defineConfig } from "drizzle-kit";

// DATABASE_URL debe estar ya exportada en el entorno (igual que el resto de
// variables de este proyecto — no se usa dotenv en ningún otro sitio).
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
