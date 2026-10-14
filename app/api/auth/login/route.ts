export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import {
  verifyPin,
  verifyToken,
  signToken,
  signQuickToken,
  signPaseAdmin,
  verifyPaseAdmin,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth/server"
import { chequearLimite, registrarFallo, registrarExito, obtenerIp } from "@/lib/auth/rate-limit"

const PERFILES_VALIDOS = [
  "cocina", "barra", "administracion", "soporte", "cobro",
  "dj", "fotografo", "vestido", "pantalla", "coordinacion",
  "vendedor",
]

// POST { perfilId, pin } — login con PIN
// POST { perfilId, quickToken } — acceso rápido con token firmado previamente
// POST { perfilId, paseAdmin } — cambio de perfil con el pase de Administración
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const perfilId = typeof body.perfilId === "string" ? body.perfilId : ""
    const pin = typeof body.pin === "string" ? body.pin : ""
    const quickToken = typeof body.quickToken === "string" ? body.quickToken : ""
    const paseAdmin = typeof body.paseAdmin === "string" ? body.paseAdmin : ""

    if (!PERFILES_VALIDOS.includes(perfilId)) {
      return NextResponse.json({ ok: false, error: "Perfil inválido" }, { status: 400 })
    }

    // Límite de intentos por IP+perfil para frenar fuerza bruta sobre el PIN.
    // Los quickToken y los pases firmados no cuentan: no son adivinables por fuerza bruta.
    const claveLimite = `login:${obtenerIp(req)}:${perfilId}`
    if (pin) {
      const { permitido, esperaSegundos } = chequearLimite(claveLimite)
      if (!permitido) {
        return NextResponse.json(
          { ok: false, error: `Demasiados intentos. Esperá ${Math.ceil(esperaSegundos / 60)} min.` },
          { status: 429 },
        )
      }
    }

    let autorizado = false
    let porPase = false
    if (pin) {
      autorizado = verifyPin(perfilId, pin)
    } else if (quickToken) {
      const payload = await verifyToken(quickToken)
      autorizado = payload !== null && payload.perfilId === perfilId
    } else if (paseAdmin) {
      // Pase de Administración: entra a cualquier perfil sin su PIN.
      autorizado = await verifyPaseAdmin(paseAdmin)
      porPase = autorizado
    }

    if (!autorizado) {
      if (pin) registrarFallo(claveLimite)
      return NextResponse.json({ ok: false, error: "PIN incorrecto" }, { status: 401 })
    }

    if (pin) registrarExito(claveLimite)

    const sessionToken = await signToken(perfilId)
    // Con el pase no se da acceso rápido: si no, ese navegador seguiría
    // entrando a ese perfil sin PIN por 30 días, más allá de la sesión de
    // Administración.
    const nuevoQuickToken = porPase ? undefined : await signQuickToken(perfilId)
    // El pase sale solo de un ingreso real de Administración (PIN o acceso
    // rápido), nunca de otro pase: así no se puede estirar más de 12 horas.
    const nuevoPase = perfilId === "administracion" && !porPase ? await signPaseAdmin() : undefined

    // sessionToken también se devuelve en el body: en la vista previa embebida
    // (iframe) las cookies pueden estar bloqueadas, y el cliente lo envía por header.
    const res = NextResponse.json({
      ok: true,
      perfilId,
      quickToken: nuevoQuickToken,
      sessionToken,
      paseAdmin: nuevoPase,
    })
    res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions())
    return res
  } catch (err) {
    console.error("[API] Error en login:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
