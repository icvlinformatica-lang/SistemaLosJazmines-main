export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { signQuickToken, verifyToken } from "@/lib/auth/server"
import { PERFIL_LINK_PROTOTIPO, puedeGenerarLinkPrototipo, urlLinkPrototipo } from "@/lib/link-prototipo"

/**
 * POST /api/clientes/link-prototipo — arma el link para compartir el
 * simulador (ver lib/link-prototipo.ts). Solo Administración y Soporte.
 * Devuelve el link y hasta cuándo vale (30 días, lo que dura un acceso
 * rápido). No guarda nada: el link es un token firmado del perfil "clientes".
 */
export async function POST(req: Request) {
  if (!puedeGenerarLinkPrototipo(await perfilDesdeRequest(req))) {
    return NextResponse.json({ ok: false, error: "Sin permiso" }, { status: 403 })
  }
  try {
    const token = await signQuickToken(PERFIL_LINK_PROTOTIPO)
    const datos = await verifyToken(token)
    const url = urlLinkPrototipo(new URL(req.url).origin, token)
    return NextResponse.json({ ok: true, url, vence: datos ? new Date(datos.exp).toISOString() : null })
  } catch (err) {
    console.error("[API] Error al armar el link del prototipo:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
