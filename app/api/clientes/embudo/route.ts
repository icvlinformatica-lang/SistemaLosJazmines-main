export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { armarEmbudo, diasEmbudo, faltaTablaRecorridos, puedeVerEmbudo, type FilaRecorrido } from "@/lib/clientes-embudo"

/** Tope de visitas que se leen por período (consulta liviana: es la base real). */
const MAX_VISITAS = 20000

/**
 * GET /api/clientes/embudo?dias=7|30|90 — cuántas visitas del simulador
 * llegaron a cada etapa y dónde se fueron. Solo Soporte. No hay datos
 * personales que devolver: la tabla no los tiene.
 */
export async function GET(req: Request) {
  if (!puedeVerEmbudo(await perfilDesdeRequest(req))) {
    return NextResponse.json({ ok: false, error: "Sin permiso" }, { status: 403 })
  }
  const dias = diasEmbudo(new URL(req.url).searchParams.get("dias"))
  const sinCache = { headers: { "Cache-Control": "no-store" } }
  try {
    const filas = (await sql`
      SELECT etapas, tipo_evento, salon FROM simulador_recorridos
      WHERE creado >= now() - make_interval(days => ${dias})
      ORDER BY creado DESC
      LIMIT ${MAX_VISITAS}
    `) as unknown as FilaRecorrido[]
    return NextResponse.json({ ok: true, dias, ...armarEmbudo(filas) }, sinCache)
  } catch (err) {
    if (faltaTablaRecorridos(err)) {
      return NextResponse.json({ ok: true, dias, sinTabla: true, ...armarEmbudo([]) }, sinCache)
    }
    console.error("[API] Error en clientes/embudo:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
