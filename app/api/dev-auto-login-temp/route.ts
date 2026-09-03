export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { signToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/server"

// Ruta temporal SOLO para verificación en el preview de desarrollo.
// Se elimina apenas termina la verificación manual del agente.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const perfilId = url.searchParams.get("perfil") || "administracion"
  const redirectTo = url.searchParams.get("to") || "/eventos/lista"
  const sessionToken = await signToken(perfilId)
  const res = NextResponse.redirect(new URL(redirectTo, req.url))
  res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions())
  return res
}
