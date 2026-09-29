import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  integrations: [react()],
  server: { port: 4321 },
  vite: {
    plugins: [tailwindcss()],
    // El único .env.example/.env.local del proyecto vive en la raíz del
    // monorepo (variables de backend y frontend juntas) — sin esto, Vite solo
    // busca .env aquí en frontend/ y el build falla con "supabaseUrl is required".
    envDir: "..",
    server: {
      proxy: {
        "/api": "http://localhost:3001",
      },
    },
  },
});
