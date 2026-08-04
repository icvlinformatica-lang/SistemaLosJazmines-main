"use client"

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Cliente Supabase del navegador que NO habla directo con Supabase:
 * apunta al proxy autenticado /api/db, que corre en el servidor con la
 * service role key. El acceso directo con la anon key está bloqueado
 * (REVOKE + RLS) como medida de seguridad, y el middleware exige sesión
 * para todo /api/*, así que solo usuarios logueados llegan a los datos.
 *
 * La "key" acá es un placeholder: el proxy la ignora y usa la real del
 * lado del servidor.
 */

let client: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  if (client) return client
  const base = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  client = createSupabaseClient(`${base}/api/db`, "proxy-key-placeholder", {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}
