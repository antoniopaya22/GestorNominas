import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Sin esto, un despliegue o un `npm run build` local sin estas variables
  // falla con el mensaje críptico de supabase-js ("supabaseUrl is required").
  throw new Error(
    "Faltan PUBLIC_SUPABASE_URL o PUBLIC_SUPABASE_ANON_KEY — defínelas en el .env.local de la raíz del monorepo (ver .env.example) o en las variables de entorno del servicio frontend en Vercel.",
  );
}

export const supabase = createClient(url, anonKey);
