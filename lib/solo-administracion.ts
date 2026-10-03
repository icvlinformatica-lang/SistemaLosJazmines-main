// Corte por PERFIL para los endpoints de Administración (/api/administracion/*).
// Solo servidor.
//
// El middleware ya exige sesión (sin sesión → 401). Esto agrega el chequeo
// del perfil de esa sesión: solo Administración y Soporte pasan; el resto
// (Vendedor, Cocina, Barra, staff...) recibe 403 aunque tenga sesión.
import { NextResponse } from "next/server"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"

export const PERFILES_ADMINISTRACION = ["administracion", "soporte"]

/** null si el perfil puede pasar; si no, la respuesta 403 para devolver. */
export async function soloAdministracion(req: Request): Promise<NextResponse | null> {
  const perfil = await perfilDesdeRequest(req)
  if (perfil && PERFILES_ADMINISTRACION.includes(perfil)) return null
  return NextResponse.json({ ok: false, error: "Solo Administración" }, { status: 403 })
}
