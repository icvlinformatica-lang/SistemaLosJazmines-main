export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import {
  leerBarrasArmadas,
  leerConfigCotizador,
  leerCostosCocteles,
  leerCostosPlatos,
} from "@/lib/cotizador-config-servidor"

/**
 * Configuración del cotizador rápido (Eventos > Cotizaciones > Configuración):
 * márgenes, platos del menú, servicios visibles y barras armadas, CON costos.
 * Solo Administración y Soporte — el vendedor ve los precios ya calculados
 * en /api/vendedor/catalogo (bloque cotizadorRapido), nunca costos ni márgenes.
 */
const PERFILES_PERMITIDOS = ["administracion", "soporte"]

async function autorizado(req: Request) {
  return PERFILES_PERMITIDOS.includes((await perfilDesdeRequest(req)) ?? "")
}

export async function GET(req: Request) {
  if (!(await autorizado(req))) {
    return NextResponse.json({ ok: false, error: "Solo Administración" }, { status: 403 })
  }
  try {
    // En dos tandas por el pooler de Supabase (ver /api/vendedor/catalogo).
    const [config, platos] = await Promise.all([leerConfigCotizador(), leerCostosPlatos()])
    const [cocteles, barras] = await Promise.all([leerCostosCocteles(), leerBarrasArmadas()])
    return NextResponse.json({ ok: true, config, platos, cocteles, barras })
  } catch (err) {
    console.error("[API] Error en administracion/cotizador-config GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

/** Guarda márgenes, platos del menú (en orden) y servicios ocultos, todo junto. */
export async function POST(req: Request) {
  if (!(await autorizado(req))) {
    return NextResponse.json({ ok: false, error: "Solo Administración" }, { status: 403 })
  }
  try {
    const body = await req.json().catch(() => ({}))
    const margenMenu = Number(body?.margenMenu)
    const margenBarra = Number(body?.margenBarra)
    for (const [nombre, m] of [["menú", margenMenu], ["barra", margenBarra]] as const) {
      if (!Number.isFinite(m) || m < 0 || m > 10) {
        return NextResponse.json({ ok: false, error: `Margen de ${nombre} inválido.` }, { status: 400 })
      }
    }
    const recetasMenu: string[] = Array.isArray(body?.recetasMenu)
      ? [...new Set<string>(body.recetasMenu.filter((x: unknown) => typeof x === "string"))]
      : []
    const serviciosOcultos: string[] = Array.isArray(body?.serviciosOcultos)
      ? [...new Set<string>(body.serviciosOcultos.filter((x: unknown) => typeof x === "string"))]
      : []

    await sql.begin(async (tx) => {
      const db = tx as unknown as typeof sql
      const guardar = (clave: string, valor: unknown) => db`
        INSERT INTO cotizador_config (clave, valor, updated_at)
        VALUES (${clave}, ${JSON.stringify(valor)}::jsonb, now())
        ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor, updated_at = now()
      `
      await guardar("margen_menu", margenMenu)
      await guardar("margen_barra", margenBarra)
      await guardar("recetas_menu", recetasMenu)

      await db`DELETE FROM cotizador_servicio_oculto`
      for (const servicioId of serviciosOcultos) {
        await db`INSERT INTO cotizador_servicio_oculto (servicio_id) VALUES (${servicioId}) ON CONFLICT DO NOTHING`
      }
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[API] Error en administracion/cotizador-config POST:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
