export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { verifyPinStockExtra } from "@/lib/auth/server"
import { chequearLimite, registrarFallo, registrarExito, obtenerIp } from "@/lib/auth/rate-limit"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { sectoresPermitidos } from "@/lib/stock-salones"

/**
 * POST { pin } — ¿es correcto el PIN de carga extraordinaria de stock?
 *
 * Existe solo para que la pantalla pueda abrir la lista recién cuando el PIN
 * está bien, en vez de dejar contar todo y recién fallar al guardar. NO
 * habilita nada por sí solo: el candado real está en
 * /api/stock-salones/sesiones, que vuelve a pedir y verificar el PIN al
 * guardar. Saltear esta llamada no sirve de nada.
 *
 * Mismo patrón que /api/auth/verificar-pin: límite de intentos por IP para
 * que no se pueda adivinar a fuerza bruta, y el PIN nunca vuelve en la
 * respuesta — solo se dice si coincide.
 */
export async function POST(req: Request) {
  try {
    // Solo quien podría cargar stock puede siquiera probar el PIN.
    const perfil = await perfilDesdeRequest(req)
    if (sectoresPermitidos(perfil).length === 0) {
      return NextResponse.json({ ok: false, error: "Este perfil no puede cargar stock" }, { status: 403 })
    }

    const claveLimite = `stock-pin:${obtenerIp(req)}`
    const { permitido, esperaSegundos } = chequearLimite(claveLimite)
    if (!permitido) {
      return NextResponse.json(
        { ok: false, error: `Demasiados intentos. Esperá ${Math.ceil(esperaSegundos / 60)} min.` },
        { status: 429 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const pin = typeof body.pin === "string" ? body.pin : ""
    if (!verifyPinStockExtra(pin)) {
      registrarFallo(claveLimite)
      return NextResponse.json({ ok: false, error: "PIN incorrecto" }, { status: 403 })
    }

    registrarExito(claveLimite)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[API] Error en stock-salones/pin:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
