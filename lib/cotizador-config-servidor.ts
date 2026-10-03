// Configuración del cotizador rápido leída de la base. Solo servidor.
//
// La usan /api/administracion/cotizador-config (con costos, solo
// Administración/Soporte) y /api/vendedor/catalogo (solo precios).
// Tablas: scripts/014_cotizador_config.sql.
import { sql } from "@/lib/db"
import { costoPorPorcion } from "@/lib/precio-menu"
import { leerPreciosCocteles } from "@/lib/precio-barra-servidor"
import type { Insumo, InsumoReceta, Unidad, UnidadReceta } from "@/lib/store"

export interface ConfigCotizador {
  margenMenu: number
  margenBarra: number
  /** Platos que aparecen como botón, en orden. */
  recetasMenu: string[]
  /** Servicios apagados en el cotizador (el resto aparece). */
  serviciosOcultos: string[]
}

export interface PlatoConCosto {
  id: string
  nombre: string
  categoria: string
  costoPorPorcion: number
}

export interface BarraArmada {
  id: string
  nombre: string
  coctelesIncluidos: string[]
  enCotizador: boolean
}

const numero = (v: unknown, porDefecto: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : porDefecto
}

export async function leerConfigCotizador(): Promise<ConfigCotizador> {
  const [filas, ocultos] = (await Promise.all([
    sql`SELECT clave, valor FROM cotizador_config`,
    sql`SELECT servicio_id FROM cotizador_servicio_oculto`,
  ])) as unknown as [Array<{ clave: string; valor: unknown }>, Array<{ servicio_id: string }>]
  // Un valor guardado como texto JSON dentro del jsonb (string) se desarma:
  // pasó con la primera versión del guardado.
  const valor = (clave: string) => {
    const v = filas.find((f) => f.clave === clave)?.valor
    if (typeof v !== "string") return v
    try {
      return JSON.parse(v)
    } catch {
      return v
    }
  }
  const recetas = valor("recetas_menu")
  return {
    // Sin fila guardada el margen vale 0 y la pantalla lo muestra: nunca se
    // inventa un número que nadie cargó.
    margenMenu: numero(valor("margen_menu"), 0),
    margenBarra: numero(valor("margen_barra"), 0),
    recetasMenu: Array.isArray(recetas) ? recetas.filter((x): x is string => typeof x === "string") : [],
    serviciosOcultos: ocultos.map((o) => o.servicio_id),
  }
}

/** Todas las recetas con su costo por porción (lib/precio-menu.ts). */
export async function leerCostosPlatos(): Promise<PlatoConCosto[]> {
  const [recetas, recetaInsumos, insumos] = (await Promise.all([
    sql`SELECT id, nombre, categoria, factor_rendimiento FROM recetas ORDER BY nombre ASC`,
    sql`SELECT receta_id, insumo_id, cantidad_base_por_persona, unidad_receta FROM receta_insumos`,
    sql`SELECT id, unidad, precio_unitario, contenido_cantidad, contenido_unidad FROM insumos`,
  ])) as unknown as [
    Array<{ id: string; nombre: string; categoria: string | null; factor_rendimiento: number | null }>,
    Array<{ receta_id: string; insumo_id: string; cantidad_base_por_persona: number; unidad_receta: string | null }>,
    Array<{ id: string; unidad: string; precio_unitario: number; contenido_cantidad: number | null; contenido_unidad: string | null }>,
  ]

  // Mismas conversiones que /api/recetas y /api/insumos.
  const catalogo: Pick<Insumo, "id" | "unidad" | "precioUnitario" | "contenidoCantidad" | "contenidoUnidad">[] =
    insumos.map((i) => ({
      id: i.id,
      unidad: i.unidad as Unidad,
      precioUnitario: Number(i.precio_unitario),
      contenidoCantidad: i.contenido_cantidad != null ? Number(i.contenido_cantidad) : undefined,
      contenidoUnidad: (i.contenido_unidad || undefined) as "GRS" | "CC" | undefined,
    }))

  return recetas.map((r) => {
    const ingredientes: InsumoReceta[] = recetaInsumos
      .filter((ri) => ri.receta_id === r.id)
      .map((ri) => ({
        insumoId: ri.insumo_id,
        detalleCorte: "",
        cantidadBasePorPersona: Number(ri.cantidad_base_por_persona),
        unidadReceta: (ri.unidad_receta || undefined) as UnidadReceta | undefined,
      }))
    return {
      id: r.id,
      nombre: r.nombre,
      categoria: r.categoria || "",
      costoPorPorcion: costoPorPorcion(
        { insumos: ingredientes, factorRendimiento: Number(r.factor_rendimiento) || 1 },
        catalogo,
      ),
    }
  })
}

/** Barras armadas (barra_templates). en_cotizador se lee con to_jsonb para
 *  no romper si la migración 014 todavía no se aplicó (vale false). */
export async function leerBarrasArmadas(): Promise<BarraArmada[]> {
  const filas = (await sql`
    SELECT id, nombre, cocteles_incluidos, (to_jsonb(barra_templates) ->> 'en_cotizador') AS en_cotizador
    FROM barra_templates
    ORDER BY nombre ASC
  `) as unknown as Array<{ id: string; nombre: string; cocteles_incluidos: string[] | null; en_cotizador: string | null }>
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    coctelesIncluidos: f.cocteles_incluidos || [],
    enCotizador: f.en_cotizador === "true",
  }))
}

/** Costo por trago de cada cóctel de la carta (id → costo). */
export async function leerCostosCocteles(): Promise<Array<{ id: string; nombre: string; categoria: string; costoPorTrago: number }>> {
  return (await leerPreciosCocteles()).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    categoria: c.categoria,
    costoPorTrago: c.costoPorTrago,
  }))
}
