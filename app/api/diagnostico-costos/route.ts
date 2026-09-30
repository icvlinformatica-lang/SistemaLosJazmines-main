export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  detectarProblemas,
  detectarPendientes,
  agruparPorInsumo,
  type LineaDiagnostico,
  type InsumoDiagnostico,
} from "@/lib/diagnostico-costos"
import { puedeEditarCatalogo } from "@/lib/insumos-permisos"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"

/**
 * Costos mal calculados por unidades que no se pueden convertir (ver
 * lib/diagnostico-costos.ts). Lo consume el diálogo "Costos a revisar" que
 * aparece en Recetario, Almacén, Cócteles y Barra.
 *
 * GET  — la lista de insumos a corregir, ordenada por cuánta plata infla.
 * POST — carga el contenido de un insumo ({ insumoId, sector, cantidad, unidad }),
 *        que es lo que resuelve el problema para todas sus recetas de una vez.
 *
 * Solo lee y escribe el contenido por unidad: no toca precios, ni recetas, ni
 * eventos. El costo de los eventos se recalcula solo, porque se calcula en vivo.
 *
 * Solo Administración y Soporte: el contenido por unidad es parte del catálogo
 * de insumos (mueve costos) y ningún otro perfil tiene esas pantallas.
 */

async function negar(request: Request) {
  const perfilId = await perfilDesdeRequest(request)
  if (puedeEditarCatalogo(perfilId)) return null
  return NextResponse.json({ ok: false, error: "Los costos a revisar los maneja Administración." }, { status: 403 })
}

export async function GET(request: Request) {
  const sinPermiso = await negar(request)
  if (sinPermiso) return sinPermiso
  try {
    // Dos tandas en vez de seis consultas en paralelo: el pooler de Supabase
    // toma una conexión por consulta simultánea (ver /api/vendedor/catalogo).
    const [recetaLineas, insumosCocina] = await Promise.all([
      sql`
        SELECT ri.receta_id, r.nombre AS receta_nombre, ri.insumo_id,
               ri.cantidad_base_por_persona, ri.unidad_receta
        FROM receta_insumos ri
        JOIN recetas r ON r.id = ri.receta_id
        WHERE ri.unidad_receta IS NOT NULL
      `,
      sql`SELECT id, descripcion, unidad, precio_unitario, contenido_cantidad, contenido_unidad FROM insumos`,
    ])

    const [coctelLineas, insumosBarra] = await Promise.all([
      sql`
        SELECT ci.coctel_id, c.nombre AS coctel_nombre, ci.insumo_barra_id,
               ci.cantidad_por_coctel, ci.unidad_coctel
        FROM coctel_insumos ci
        JOIN cocteles c ON c.id = ci.coctel_id
        WHERE ci.unidad_coctel IS NOT NULL
      `,
      sql`SELECT id, descripcion, unidad, precio_unitario, contenido_cantidad, contenido_unidad FROM insumos_barra`,
    ])

    const aInsumo = (filas: unknown): InsumoDiagnostico[] =>
      (filas as Array<Record<string, unknown>>).map((i) => ({
        id: String(i.id),
        descripcion: String(i.descripcion ?? ""),
        unidad: i.unidad as InsumoDiagnostico["unidad"],
        precioUnitario: Number(i.precio_unitario) || 0,
        contenidoCantidad: i.contenido_cantidad != null ? Number(i.contenido_cantidad) : undefined,
        contenidoUnidad: (i.contenido_unidad as "GRS" | "CC") || undefined,
      }))

    const lineasCocina: LineaDiagnostico[] = (recetaLineas as unknown as Array<Record<string, unknown>>).map((l) => ({
      contenedorId: String(l.receta_id),
      contenedorNombre: String(l.receta_nombre ?? ""),
      insumoId: String(l.insumo_id),
      cantidad: Number(l.cantidad_base_por_persona) || 0,
      unidadPedida: l.unidad_receta as LineaDiagnostico["unidadPedida"],
    }))

    const lineasBarra: LineaDiagnostico[] = (coctelLineas as unknown as Array<Record<string, unknown>>).map((l) => ({
      contenedorId: String(l.coctel_id),
      contenedorNombre: String(l.coctel_nombre ?? ""),
      insumoId: String(l.insumo_barra_id),
      cantidad: Number(l.cantidad_por_coctel) || 0,
      unidadPedida: l.unidad_coctel as LineaDiagnostico["unidadPedida"],
    }))

    const problemas = [
      ...detectarProblemas("cocina", lineasCocina, aInsumo(insumosCocina)),
      ...detectarProblemas("barra", lineasBarra, aInsumo(insumosBarra)),
    ]
    const porInsumo = agruparPorInsumo(problemas).sort((a, b) => b.impactoTotal - a.impactoTotal)

    // Los que todavía no dan un costo mal, pero les falta el dato igual.
    const yaSonProblema = new Set(porInsumo.map((p) => p.insumoId))
    const pendientes = [
      ...detectarPendientes("cocina", lineasCocina, aInsumo(insumosCocina), yaSonProblema),
      ...detectarPendientes("barra", lineasBarra, aInsumo(insumosBarra), yaSonProblema),
    ]

    return NextResponse.json({
      ok: true,
      total: porInsumo.length,
      urgentes: porInsumo.filter((p) => p.urgente).length,
      cocina: porInsumo.filter((p) => p.sector === "cocina").length,
      barra: porInsumo.filter((p) => p.sector === "barra").length,
      insumos: porInsumo,
      pendientes,
      totalPendientes: pendientes.length,
    })
  } catch (err) {
    console.error("[API] Error en diagnostico-costos GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const sinPermiso = await negar(req)
  if (sinPermiso) return sinPermiso
  try {
    const body = await req.json().catch(() => ({}))
    const insumoId = typeof body.insumoId === "string" ? body.insumoId : ""
    const sector = body.sector === "barra" ? "barra" : "cocina"
    const cantidad = Number(body.cantidad)
    const unidad = body.unidad === "GRS" || body.unidad === "CC" ? body.unidad : null

    if (!insumoId) {
      return NextResponse.json({ ok: false, error: "Falta el insumo" }, { status: 400 })
    }
    if (!(cantidad > 0) || !unidad) {
      return NextResponse.json(
        { ok: false, error: "Cargá cuánto trae cada unidad y en qué unidad (gramos o cc)." },
        { status: 400 },
      )
    }

    const filas =
      sector === "barra"
        ? await sql`
            UPDATE insumos_barra SET contenido_cantidad = ${cantidad}, contenido_unidad = ${unidad}, updated_at = now()
            WHERE id = ${insumoId} RETURNING id, descripcion
          `
        : await sql`
            UPDATE insumos SET contenido_cantidad = ${cantidad}, contenido_unidad = ${unidad}, updated_at = now()
            WHERE id = ${insumoId} RETURNING id, descripcion
          `

    const lista = filas as unknown as Array<{ id: string; descripcion: string }>
    if (!lista.length) {
      return NextResponse.json({ ok: false, error: "No se encontró el insumo" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, insumoId: lista[0].id, descripcion: lista[0].descripcion })
  } catch (err) {
    console.error("[API] Error en diagnostico-costos POST:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
