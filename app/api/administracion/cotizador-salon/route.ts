export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { esSalonCotizador } from "@/lib/cotizador-salon"
import { leerBarrasArmadas, leerCostosCocteles, leerCostosPlatos } from "@/lib/cotizador-config-servidor"
import {
  copiarConfigSalon,
  funcionesPermitidas,
  guardarConfigSalon,
  leerConfigSalon,
  leerPersonalConTarifa,
  leerServiciosConCosto,
  validarConfigSalon,
} from "@/lib/cotizador-salon-servidor"

/**
 * Configuración del cotizador POR SALÓN (Eventos > Cotizaciones >
 * Configuración), CON costos y ganancias. Solo Administración y Soporte: se
 * chequea el PERFIL de la sesión, no solo que haya sesión. El vendedor ve
 * únicamente precios ya calculados en /api/vendedor/catalogo.
 *
 * GET  ?salon=Quinta                     → config del salón + catálogos con costo
 * PUT  { salon, ...config }              → guarda TODO el salón (transacción)
 * POST { accion: "copiar", desde, hacia } → copia un salón entero sobre otro
 */
const PERFILES_PERMITIDOS = ["administracion", "soporte"]

async function autorizado(req: Request) {
  return PERFILES_PERMITIDOS.includes((await perfilDesdeRequest(req)) ?? "")
}

const prohibido = () => NextResponse.json({ ok: false, error: "Solo Administración" }, { status: 403 })

export async function GET(req: Request) {
  if (!(await autorizado(req))) return prohibido()
  const salon = new URL(req.url).searchParams.get("salon")
  if (!esSalonCotizador(salon)) {
    return NextResponse.json({ ok: false, error: "Salón inválido." }, { status: 400 })
  }
  try {
    // En tandas chicas por el pooler de Supabase (ver /api/vendedor/catalogo).
    const config = await leerConfigSalon(salon)
    const [platos, cocteles] = await Promise.all([leerCostosPlatos(), leerCostosCocteles()])
    const [barras, servicios, personal] = await Promise.all([
      leerBarrasArmadas(),
      leerServiciosConCosto(),
      leerPersonalConTarifa(),
    ])
    return NextResponse.json({
      ok: true,
      config,
      platos,
      cocteles,
      barras: barras.map((b) => ({ id: b.id, nombre: b.nombre, coctelesIncluidos: b.coctelesIncluidos })),
      servicios,
      personal,
    })
  } catch (err) {
    console.error("[API] Error en administracion/cotizador-salon GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  if (!(await autorizado(req))) return prohibido()
  try {
    const body = await req.json().catch(() => null)
    const salon = (body as Record<string, unknown> | null)?.salon
    if (!esSalonCotizador(salon)) {
      return NextResponse.json({ ok: false, error: "Salón inválido." }, { status: 400 })
    }
    const cfg = validarConfigSalon(body, await funcionesPermitidas(salon))
    if (typeof cfg === "string") return NextResponse.json({ ok: false, error: cfg }, { status: 400 })
    await guardarConfigSalon(cfg)
    return NextResponse.json({ ok: true, config: await leerConfigSalon(cfg.salon) })
  } catch (err) {
    console.error("[API] Error en administracion/cotizador-salon PUT:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!(await autorizado(req))) return prohibido()
  try {
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    if (body.accion !== "copiar") {
      return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 })
    }
    const { desde, hacia } = body
    if (!esSalonCotizador(desde) || !esSalonCotizador(hacia) || desde === hacia) {
      return NextResponse.json({ ok: false, error: "Elegí dos salones distintos." }, { status: 400 })
    }
    await copiarConfigSalon(desde, hacia)
    return NextResponse.json({ ok: true, config: await leerConfigSalon(hacia) })
  } catch (err) {
    console.error("[API] Error en administracion/cotizador-salon POST:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
