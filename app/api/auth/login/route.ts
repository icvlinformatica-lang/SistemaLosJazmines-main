export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { verifyPin, verifyToken, signToken, signQuickToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/server"

const PERFILES_VALIDOS = ["cocina", "barra", "administracion", "soporte"]

// POST { perfilId, pin } — login con PIN
// POST { perfilId, quickToken } — acceso rápido con token firmado previamente
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const perfilId = typeof body.perfilId === "string" ? body.perfilId : ""
    const pin = typeof body.pin === "string" ? body.pin : ""
    const quickToken = typeof body.quickToken === "string" ? body.quickToken : ""

    if (!PERFILES_VALIDOS.includes(perfilId)) {
      return NextResponse.json({ ok: false, error: "Perfil inválido" }, { status: 400 })
    }

    let autorizado = false
    if (pin) {
      autorizado = verifyPin(perfilId, pin)
    } else if (quickToken) {
      const payload = await verifyToken(quickToken)
      autorizado = payload !== null && payload.perfilId === perfilId
    }

    if (!autorizado) {
      return NextResponse.json({ ok: false, error: "PIN incorrecto" }, { status: 401 })
    }

    const sessionToken = await signToken(perfilId)
    const nuevoQuickToken = await signQuickToken(perfilId)

    // sessionToken también se devuelve en el body: en la vista previa embebida
    // (iframe) las cookies pueden estar bloqueadas, y el cliente lo envía por header.
    const res = NextResponse.json({ ok: true, perfilId, quickToken: nuevoQuickToken, sessionToken })
    res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions())
    return res
  } catch (err) {
    console.error("[API] Error en login:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
