export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { soloAdministracion } from "@/lib/solo-administracion"
import {
  borrarFechaEspecial,
  guardarFechaEspecial,
  leerFechasEspeciales,
  validarFechaEspecial,
} from "@/lib/fechas-especiales-servidor"

/**
 * Fechas especiales del cotizador (Eventos > Cotizaciones > Configuración,
 * scripts/018). Solo Administración y Soporte (chequeo por PERFIL; sin
 * sesión el middleware ya corta con 401).
 *
 * GET                       → todas, ordenadas por fecha (pasadas incluidas)
 * POST   { ...fecha }       → alta
 * PUT    { id, ...fecha }   → edición
 * DELETE ?id=...            → borrar
 *
 * Dos fechas especiales el mismo día para el mismo salón → 400 con mensaje.
 */
export async function GET(req: Request) {
  const corte = await soloAdministracion(req)
  if (corte) return corte
  try {
    return NextResponse.json({ ok: true, fechas: await leerFechasEspeciales() })
  } catch (err) {
    console.error("[API] Error en administracion/fechas-especiales GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

async function guardar(req: Request, edicion: boolean) {
  const corte = await soloAdministracion(req)
  if (corte) return corte
  try {
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const id = edicion ? (typeof body.id === "string" && body.id ? body.id : null) : null
    if (edicion && !id) return NextResponse.json({ ok: false, error: "Falta el id." }, { status: 400 })
    const fe = validarFechaEspecial(body)
    if (typeof fe === "string") return NextResponse.json({ ok: false, error: fe }, { status: 400 })
    const r = await guardarFechaEspecial(fe, id)
    if (typeof r === "string") return NextResponse.json({ ok: false, error: r }, { status: 400 })
    return NextResponse.json({ ok: true, id: r.id, fechas: await leerFechasEspeciales() })
  } catch (err) {
    console.error("[API] Error en administracion/fechas-especiales:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

export const POST = (req: Request) => guardar(req, false)
export const PUT = (req: Request) => guardar(req, true)

export async function DELETE(req: Request) {
  const corte = await soloAdministracion(req)
  if (corte) return corte
  try {
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return NextResponse.json({ ok: false, error: "Falta el id." }, { status: 400 })
    if (!(await borrarFechaEspecial(id))) {
      return NextResponse.json({ ok: false, error: "Esa fecha especial ya no existe." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, fechas: await leerFechasEspeciales() })
  } catch (err) {
    console.error("[API] Error en administracion/fechas-especiales DELETE:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
