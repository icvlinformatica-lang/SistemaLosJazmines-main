export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { verifyPin } from "@/lib/auth/server"
import { chequearLimite, registrarFallo, registrarExito, obtenerIp } from "@/lib/auth/rate-limit"

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
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[API] Error verificando PIN:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
