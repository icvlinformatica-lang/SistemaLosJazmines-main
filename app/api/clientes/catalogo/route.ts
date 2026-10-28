export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { perfilDesdeRequest, salonesConfigurados } from "@/lib/stock-salones-server"
import { leerPreciosCocteles } from "@/lib/precio-barra-servidor"
import { leerFechasEspeciales } from "@/lib/fechas-especiales-servidor"
import { armarCotizadorPorSalon } from "@/lib/catalogo-cotizador-servidor"
import { hoyArgentina } from "@/lib/cotizador-salon"
import { armarCatalogoClientes, clavesProhibidas } from "@/lib/clientes-simulador"
import { puedeVerVistaClientes } from "@/lib/vista-clientes"

/**
 * GET /api/clientes/catalogo — catálogo del simulador "Armá tu fiesta"
 * (vista de Clientes, prototipo).
 *
 * Usa la MISMA cuenta que el cotizador del vendedor (armarCotizadorPorSalon)
 * y la sanea con armarCatalogoClientes: solo salones listos, nada en $0, sin
 * nombres del personal ni ids de cócteles. Antes de responder, clavesProhibidas
 * revisa que no viaje ninguna clave de costo, ganancia, margen ni tarifa.
 *
 * Solo lo pueden pedir los perfiles de PERFILES_VISTA_CLIENTES (lo chequea
 * acá el servidor; el middleware ya exige sesión).
 */
export async function GET(req: Request) {
  if (!puedeVerVistaClientes(await perfilDesdeRequest(req))) {
    return NextResponse.json({ ok: false, error: "Sin permiso" }, { status: 403 })
  }
  try {
    // En tandas chicas por el pooler de Supabase (ver /api/vendedor/catalogo).
    const [servicios, preciosCocteles] = (await Promise.all([
      sql`SELECT id, nombre, categoria, unidad FROM servicios WHERE activo = true ORDER BY orden ASC NULLS LAST, nombre ASC`,
      leerPreciosCocteles(),
    ])) as unknown as [
      Array<{ id: string; nombre: string; categoria: string; unidad: string | null }>,
      Awaited<ReturnType<typeof leerPreciosCocteles>>,
    ]
    const salones = await armarCotizadorPorSalon(preciosCocteles)
    // Si fallan, el simulador sigue: sin fechas especiales (se cotiza por día
    // de la semana) y con los nombres de siempre.
    const [fechasEspeciales, nombresSalones] = await Promise.all([
      leerFechasEspeciales({ desde: hoyArgentina() }).catch((err) => {
        console.error("[API] clientes/catalogo: sin fechas especiales:", err)
        return []
      }),
      salonesConfigurados().catch(() => new Map<string, string>()),
    ])

    const catalogo = armarCatalogoClientes({
      salones,
      servicios: servicios.map((s) => ({ id: s.id, nombre: s.nombre, categoria: s.categoria, unidad: s.unidad || "Fijo" })),
      cocteles: preciosCocteles.map((c) => ({ id: c.id, nombre: c.nombre })),
      nombresSalones,
      fechasEspeciales,
    })
    const cuerpo = { ok: true, ...catalogo }
    const prohibidas = clavesProhibidas(cuerpo)
    if (prohibidas.length) {
      console.error("[API] clientes/catalogo: se frenó una respuesta con datos internos:", prohibidas)
      return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
    }
    return NextResponse.json(cuerpo, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[API] Error en clientes/catalogo:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
