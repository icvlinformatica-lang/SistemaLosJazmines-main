export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { verifyToken, getPins, SESSION_COOKIE, SESSION_HEADER } from "@/lib/auth/server"

// Devuelve los PINs actualmente activos (ya resueltos desde las variables
// de entorno si están seteadas) — SOLO para administración y soporte.
// Se usa en la carpeta "Contraseñas" de Configuración.
export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie") || ""
  const cookieToken = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1)
  const token = cookieToken || req.headers.get(SESSION_HEADER)
  const session = await verifyToken(token)
  if (!session || !["administracion", "soporte"].includes(session.perfilId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  return NextResponse.json(getPins())
}
