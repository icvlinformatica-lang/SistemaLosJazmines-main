// Tabla por evento del "Desglose del saldo" de Caja Eventos (pedido de
// Rodrigo, 2/11/2026): nombre del evento, a cuánto se vendió, cuánto lleva
// pagado el cliente, cuánto cuesta el evento y cuánto de eso entró a Caja
// Eventos, con una fila de totales.
//
// Es SOLO PARA MOSTRAR: no cambia montos ni escribe nada.
//  - Vendido: el total del plan de cuotas (o el precio de venta si no hay plan).
//  - Pagado: las señas y cuotas que entraron a las DOS cajas por ese evento
//    (lo que dejó el cliente, según los movimientos de caja de ese salón).
//  - Costo: lo calcula quien llama, con la misma cuenta de Costos del evento
//    (`calcularCostoEventoCajaEventos(...).costoTotalEvento`).
//  - Entró a Caja Eventos: la parte de esas señas y cuotas que fue a Caja
//    Eventos.

export interface MovimientoTabla {
  tipo: string
  concepto: string
  monto: number
  salon?: string | null
  eventoId?: string | null
  cajaDestino?: string | null
}

export interface EventoTabla {
  id: string
  nombre?: string
  nombrePareja?: string
  fecha?: string
  precioVenta?: number | null
  planDeCuotas?: { montoTotal?: number } | null
}

export interface FilaTablaSaldo {
  eventoId: string
  nombre: string
  fechaEvento: string
  vendido: number
  pagado: number
  costo: number
  entroCajaEventos: number
}

export interface TablaSaldo {
  filas: FilaTablaSaldo[]
  totales: { vendido: number; pagado: number; costo: number; entroCajaEventos: number }
}

const esCobro = (concepto: string) => /^cuota\s+\d+/i.test(concepto) || /^se[ñn]a\b/i.test(concepto)
const redondear = (n: number) => Math.round(n * 100) / 100

/**
 * Una fila por evento con algún cobro en Caja Eventos del salón (o de todos,
 * con salon = null). Un evento borrado (sin datos) no tiene fila: su plata
 * sigue en la lista de movimientos del desglose.
 */
export function tablaSaldoCajaEventos(
  movimientos: MovimientoTabla[],
  eventos: EventoTabla[],
  salon: string | null,
  costoDe: (evento: EventoTabla) => number,
): TablaSaldo {
  const eventosPorId = new Map((eventos || []).map((e) => [e.id, e]))
  const cobros = new Map<string, { pagado: number; entro: number }>()
  for (const m of movimientos || []) {
    if (salon && m.salon !== salon) continue
    if (m.tipo !== "ingreso" || !m.eventoId || !esCobro(m.concepto || "")) continue
    if (m.cajaDestino !== "caja_eventos" && m.cajaDestino !== "caja_jazmines") continue
    const c = cobros.get(m.eventoId) ?? { pagado: 0, entro: 0 }
    c.pagado += m.monto
    if (m.cajaDestino === "caja_eventos") c.entro += m.monto
    cobros.set(m.eventoId, c)
  }

  const filas: FilaTablaSaldo[] = []
  for (const [eventoId, c] of cobros) {
    if (c.entro <= 0.005) continue
    const ev = eventosPorId.get(eventoId)
    if (!ev) continue
    const costo = costoDe(ev)
    filas.push({
      eventoId,
      nombre: ev.nombrePareja?.trim() || ev.nombre?.trim() || "Evento",
      fechaEvento: ev.fecha ?? "",
      vendido: redondear(ev.planDeCuotas?.montoTotal ?? ev.precioVenta ?? 0),
      pagado: redondear(c.pagado),
      costo: redondear(Number.isFinite(costo) ? costo : 0),
      entroCajaEventos: redondear(c.entro),
    })
  }
  filas.sort((a, b) => a.fechaEvento.localeCompare(b.fechaEvento) || a.nombre.localeCompare(b.nombre))

  const totales = filas.reduce(
    (t, f) => ({
      vendido: t.vendido + f.vendido,
      pagado: t.pagado + f.pagado,
      costo: t.costo + f.costo,
      entroCajaEventos: t.entroCajaEventos + f.entroCajaEventos,
    }),
    { vendido: 0, pagado: 0, costo: 0, entroCajaEventos: 0 },
  )
  return {
    filas,
    totales: {
      vendido: redondear(totales.vendido),
      pagado: redondear(totales.pagado),
      costo: redondear(totales.costo),
      entroCajaEventos: redondear(totales.entroCajaEventos),
    },
  }
}
