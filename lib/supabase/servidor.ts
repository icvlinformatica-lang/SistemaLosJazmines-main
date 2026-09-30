// Cliente de Supabase SOLO para el servidor y SOLO para leer.
//
// Lo usa la carga inicial unificada (app/api/carga-inicial) para correr las
// mismas lecturas que el navegador hace vía el proxy /api/db, pero sin salir
// del servidor. Usa la service role key, igual que ese proxy: por eso
// "server-only" hace fallar el build si alguien lo importa desde el
// navegador, y la key se lee de una variable que no es NEXT_PUBLIC_.
//
// Solo lectura: el fetch que le damos rechaza cualquier método que no sea
// GET o HEAD, así ninguna escritura puede salir por acá aunque alguien use
// este cliente para otra cosa.
import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Mismas variables que el proxy app/api/db/[...path]/route.ts.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

const soloLectura: typeof fetch = (input, init) => {
  const metodo = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase()
  if (metodo !== "GET" && metodo !== "HEAD") {
    return Promise.reject(new Error(`Cliente de solo lectura: ${metodo} no permitido`))
  }
  return fetch(input, init)
}

let cliente: SupabaseClient | null = null

/** null si faltan las variables de entorno (la carga unificada cae entera al camino viejo). */
export function clienteLecturaServidor(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_KEY) return null
  if (!cliente) {
    cliente = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: soloLectura },
    })
  }
  return cliente
}
