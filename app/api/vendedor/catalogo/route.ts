export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * Catálogo saneado para la pantalla del vendedor (/vendedor/cotizar):
 * nombre/categoría/precio de venta de servicios y recetas, NUNCA
 * costo_para_caja_eventos ni nada de insumos (eso es costo interno).
 * Protegida por el middleware normal (requiere sesión, no es pública).
 *
 * "personal" viene SIN tarifa_base ni ningún otro dato de sueldo — el
 * vendedor solo puede marcar qué roles hacen falta para el evento, nunca
 * ver ni cargar montos (eso lo decide Administración al aprobar, ver
 * /api/administracion/cotizaciones/[id]/aprobar).
 */
export async function GET() {
  try {
    // Las consultas van en dos tandas y no todas juntas: el pooler de
    // Supabase (modo transaction) toma una conexión por consulta simultánea,
    // y esta ruta la piden varias pantallas a la vez. Con las nueve en
    // paralelo aparecían CONNECT_TIMEOUT y "prepared statement does not
    // exist" bajo carga. Las cuatro tablas del tarifario son chicas, así que
    // van después, en su propia tanda.
    const [servicios, recetas, preciosVenta, preciosBase, personal] = await Promise.all([
      sql`
        SELECT id, nombre, categoria, unidad, precio_venta
        FROM servicios
        WHERE activo = true
        ORDER BY orden ASC NULLS LAST, nombre ASC
      `,
      sql`
        SELECT id, nombre, categoria
        FROM recetas
        ORDER BY categoria ASC, nombre ASC
      `,
      sql`SELECT salon, fecha, precio FROM precios_venta`,
      sql`SELECT salon, precio FROM precios_base_salones`,
      sql`
        SELECT id, nombre, apellido, funcion
        FROM personal
        WHERE activo = true
        ORDER BY orden ASC NULLS LAST, apellido ASC
      `,
    ])

    const [tarifario, reglasPersonal, vinculosRecetas, vinculosBarra] = await Promise.all([
      sql`
        SELECT salon, invitados_min, invitados_max, dia, modalidad, precio
        FROM tarifario_salon
        ORDER BY salon ASC, modalidad ASC, dia ASC, invitados_min ASC
      `,
      sql`
        SELECT funcion, cada_n_invitados, minimo, activo
        FROM tarifario_personal_regla
        WHERE activo = true
        ORDER BY funcion ASC
      `,
      sql`SELECT servicio_id, receta_id FROM servicio_recetas`,
      sql`SELECT servicio_id, barra_template_id FROM servicio_barra_template`,
    ])

    const preciosVentaMap: Record<string, Record<string, number>> = {}
    for (const row of preciosVenta as unknown as Array<{ salon: string; fecha: string; precio: number }>) {
      preciosVentaMap[row.salon] = preciosVentaMap[row.salon] || {}
      preciosVentaMap[row.salon][row.fecha] = Number(row.precio) || 0
    }

    const preciosBaseSalonMap: Record<string, number> = {}
    for (const row of preciosBase as unknown as Array<{ salon: string; precio: number }>) {
      preciosBaseSalonMap[row.salon] = Number(row.precio) || 0
    }

    return NextResponse.json({
      ok: true,
      servicios: (servicios as unknown as Array<Record<string, unknown>>).map((s) => ({
        id: s.id,
        nombre: s.nombre,
        categoria: s.categoria,
        unidad: (s.unidad as string) || "Fijo",
        precioVenta: Number(s.precio_venta) || 0,
      })),
      recetas: (recetas as unknown as Array<Record<string, unknown>>).map((r) => ({
        id: r.id,
        nombre: r.nombre,
        categoria: r.categoria,
      })),
      preciosVenta: preciosVentaMap,
      preciosBaseSalon: preciosBaseSalonMap,
      personal: (personal as unknown as Array<Record<string, unknown>>).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        apellido: p.apellido,
        funcion: p.funcion,
      })),
      // Grilla de precio del salón y regla de personal: lo único del
      // cotizador que NO es un servicio (ver lib/tarifario-cotizador.ts).
      tarifario: (tarifario as unknown as Array<Record<string, unknown>>).map((t) => ({
        salon: t.salon,
        invitadosMin: Number(t.invitados_min) || 0,
        invitadosMax: Number(t.invitados_max) || 0,
        dia: t.dia,
        modalidad: t.modalidad,
        precio: Number(t.precio) || 0,
      })),
      reglasPersonal: (reglasPersonal as unknown as Array<Record<string, unknown>>).map((r) => ({
        funcion: r.funcion,
        cadaNInvitados: Number(r.cada_n_invitados) || 0,
        minimo: Number(r.minimo) || 0,
        activo: !!r.activo,
      })),
      // servicioId -> recetas que premarca al elegirlo / template de barra.
      recetasPorServicio: (vinculosRecetas as unknown as Array<Record<string, string>>).reduce(
        (acc: Record<string, string[]>, v) => {
          ;(acc[v.servicio_id] = acc[v.servicio_id] || []).push(v.receta_id)
          return acc
        },
        {},
      ),
      barraTemplatePorServicio: (vinculosBarra as unknown as Array<Record<string, string>>).reduce(
        (acc: Record<string, string>, v) => {
          acc[v.servicio_id] = v.barra_template_id
          return acc
        },
        {},
      ),
    })
  } catch (err) {
    console.error("[API] Error en vendedor/catalogo:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
