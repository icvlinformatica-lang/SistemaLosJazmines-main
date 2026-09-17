export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"

/**
 * Ruta pública (sin sesión, ver middleware.ts): devuelve SOLO id, nombre y
 * emoji de la tabla "vendedores", para el paso "¿quién ingresa?" del perfil
 * Vendedor en /login. Nunca sueldo ni comision_pct (datos sensibles) — a
 * diferencia del data-service normal, esta ruta pega directo a Supabase con
 * la service role key (mismo criterio que app/api/db/[...path]/route.ts)
 * porque se llama ANTES de tener sesión.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

export async function GET() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase no configurado" }, { status: 500 })
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/vendedores?select=id,nombre,emoji&order=nombre.asc`,
      {
        headers: {
          apikey: SERVICE_KEY,
          authorization: `Bearer ${SERVICE_KEY}`,
        },
        cache: "no-store",
      },
    )
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "Error al consultar vendedores" }, { status: 502 })
    }
    const data = (await res.json()) as Array<{ id: string; nombre: string; emoji: string | null }>
    const vendedores = data.map((v) => ({ id: v.id, nombre: v.nombre, emoji: v.emoji || "" }))
    return NextResponse.json({ ok: true, vendedores })
  } catch (err) {
    console.error("[API] Error en vendedores-nombres:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
