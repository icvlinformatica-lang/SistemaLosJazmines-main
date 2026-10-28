export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { verifyPin, signPaseContrato, sessionCookieOptions, PASE_CONTRATO_COOKIE, PASE_CONTRATO_DURATION_MS } from "@/lib/auth/server"
import { chequearLimite, registrarFallo, registrarExito, obtenerIp } from "@/lib/auth/rate-limit"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"

// POST { pin } — verifica el PIN de administración SIN modificar la sesión
// actual. Se usa para proteger acciones sensibles (ej: editar contrato)
// sin cambiar el perfil con el que se está trabajando.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const pin = typeof body.pin === "string" ? body.pin : ""

    // Límite de intentos por IP para frenar fuerza bruta sobre el PIN.
    const claveLimite = `verificar-pin:${obtenerIp(req)}`
    const { permitido, esperaSegundos } = chequearLimite(claveLimite)
    if (!permitido) {
      return NextResponse.json(
        { ok: false, error: `Demasiados intentos. Esperá ${Math.ceil(esperaSegundos / 60)} min.` },
        { status: 429 },
      )
    }

    if (!verifyPin("administracion", pin)) {
      registrarFallo(claveLimite)
      return NextResponse.json({ ok: false, error: "PIN incorrecto" }, { status: 401 })
    }

    registrarExito(claveLimite)
    const res = NextResponse.json({ ok: true })
    // Pase de contrato: con él, el servidor acepta los cambios del contrato
    // que guarda Cobrar cuota (ver signPaseContrato en lib/auth/server.ts).
    const perfil = await perfilDesdeRequest(req)
    if (perfil) {
      res.cookies.set(PASE_CONTRATO_COOKIE, await signPaseContrato(perfil), sessionCookieOptions(PASE_CONTRATO_DURATION_MS / 1000))
    }
    return res
  } catch (err) {
    console.error("[API] Error verificando PIN:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
