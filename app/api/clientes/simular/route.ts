export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { cotizarEnServidor } from "@/lib/cotizacion-servidor"
import { precioConGanancia } from "@/lib/cotizador-salon"
import { clavesProhibidas, resumenParaCliente, salonListoParaClientes } from "@/lib/clientes-simulador"
import { puedeVerVistaClientes } from "@/lib/vista-clientes"

/**
 * POST /api/clientes/simular — recalcula en el SERVIDOR lo que armó la
 * persona en el simulador, con los costos reales y la misma función que el
 * cotizador del vendedor (cotizarEnServidor). El número que se muestra en el
 * presupuesto sale de acá: nunca se confía en el total del navegador.
 *
 * NO guarda nada: no hay tabla de leads todavía (prototipo). Tampoco recibe
 * los datos de contacto de la persona.
 *
 * Responde solo precios (resumenParaCliente) y, antes de mandar, revisa con
 * clavesProhibidas que no salga ninguna clave de costo, ganancia ni tarifa.
 *
 * body: { salon, fechaEvento, adultos, ninos, recetas: string[], barraIds: string[],
 *         servicios: { servicioId, cantidad }[] }
 */
export async function POST(req: Request) {
  if (!puedeVerVistaClientes(await perfilDesdeRequest(req))) {
    return NextResponse.json({ ok: false, error: "Sin permiso" }, { status: 403 })
  }
  try {
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const textos = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : [])
    const servicios = Array.isArray(body.servicios)
      ? (body.servicios as unknown[])
          .map((s) => (s ?? {}) as Record<string, unknown>)
          .filter((s) => typeof s.servicioId === "string" && s.servicioId)
          .map((s) => ({ servicioId: s.servicioId as string, cantidad: Math.max(1, Math.floor(Number(s.cantidad) || 1)) }))
      : []

    const calculo = await cotizarEnServidor({
      salon: typeof body.salon === "string" ? body.salon : "",
      fechaEvento: typeof body.fechaEvento === "string" ? body.fechaEvento : "",
      adultos: Math.max(0, Math.floor(Number(body.adultos) || 0)),
      ninos: Math.max(0, Math.floor(Number(body.ninos) || 0)),
      recetas: textos(body.recetas),
      barraId: null,
      barraIds: textos(body.barraIds),
      servicios,
    })
    if (typeof calculo === "string") return NextResponse.json({ ok: false, error: calculo }, { status: 400 })

    const listo = salonListoParaClientes({
      precioSalon: precioConGanancia(calculo.config.costoSalon, calculo.config.gananciaSalon),
      capacidadMaxima: calculo.config.capacidadMaxima,
    })
    if (!listo) {
      return NextResponse.json({ ok: false, error: "Ese salón todavía no se puede cotizar desde acá." }, { status: 400 })
    }

    const cuerpo = {
      ok: true,
      resumen: resumenParaCliente(calculo.resultado, calculo.dia),
      pasosMenuFaltantes: calculo.pasosMenuFaltantes,
    }
    const prohibidas = clavesProhibidas(cuerpo)
    if (prohibidas.length) {
      console.error("[API] clientes/simular: se frenó una respuesta con datos internos:", prohibidas)
      return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
    }
    return NextResponse.json(cuerpo, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[API] Error en clientes/simular:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
