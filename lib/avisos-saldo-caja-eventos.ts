// Avisos del saldo de Caja Eventos (pedido de Rodrigo, 2/11/2026: "quiero que
// al apretar saldo puedan ver todo esto"). Explican por qué el saldo que dice
// el sistema puede no ser la plata que hay en la caja:
//
//  1. Cuotas anotadas más de una vez en la caja (más filas que pagos de esa
//     cuota en el evento). Pasó en julio y agosto de 2026, ver el informe del
//     26/10/2026.
//  2. Eventos cuyos cobros fueron enteros a Caja Eventos y nada a Caja
//     Jazmines. Antes del 2/11/2026 el costo operativo contaba en el reparto y
//     muchos eventos mandaban el 100 %; los movimientos ya anotados no se
//     reparten de nuevo.
//  3. Eventos finalizados con menú o barra y sin ningún pago de eso en Caja
//     Eventos: la plata para pagarlos sigue figurando en el saldo.
//     Solo los que tienen algún cobro en Caja Eventos (pedido de Rodrigo,
//     3/11/2026): los viejos, de antes de que se anotaran los cobros en las
//     cajas, no dejaron plata acá y no hay nada que descontar.
//
// Es SOLO PARA MOSTRAR: no cambia montos, no escribe nada y no decide qué está
// mal. Cada aviso dice "revisar", no "corregir".

export interface MovimientoAviso {
  id: string
  fecha: string
  tipo: string
  concepto: string
  monto: number
  salon?: string | null
  eventoId?: string | null
  cajaDestino?: string | null
}

export interface EventoAviso {
  id: string
  nombre?: string
  nombrePareja?: string
  fecha?: string
  salon?: string
  estado?: string
  recetasAdultos?: string[]
  recetasAdolescentes?: string[]
  recetasNinos?: string[]
  recetasDietasEspeciales?: string[]
  barras?: unknown[]
  cocinaPagada?: boolean
  barraPagada?: boolean
  pagos?: Array<{ numeroCuota?: number }>
}

export interface CuotaRepetida {
  eventoId: string
  nombre: string
  fechaEvento: string
  numeroCuota: number
  /** Montos de cada fila de Caja Eventos de esa cuota, en orden de fecha. */
  montos: number[]
  /** Pagos de esa cuota que tiene el evento. */
  pagos: number
}

export interface CobroTodoACajaEventos {
  eventoId: string
  nombre: string
  fechaEvento: string
  /** Lo que entró a Caja Eventos (señas y cuotas). */
  monto: number
}

export interface FinalizadoSinPagar {
  eventoId: string
  nombre: string
  fechaEvento: string
  menu: boolean
  barra: boolean
}

export interface AvisosSaldo {
  cuotasRepetidas: CuotaRepetida[]
  todoACajaEventos: CobroTodoACajaEventos[]
  totalTodoACajaEventos: number
  finalizadosSinPagar: FinalizadoSinPagar[]
}

const esCobro = (concepto: string) => /^cuota\s+\d+/i.test(concepto) || /^se[ñn]a\b/i.test(concepto)
const numeroCuota = (concepto: string): number | null => {
  const m = /^cuota\s+(\d+)/i.exec(concepto)
  return m ? Number(m[1]) : null
}
const nombreEvento = (e: EventoAviso | undefined) => e?.nombrePareja?.trim() || e?.nombre?.trim() || "Evento"
const redondear = (n: number) => Math.round(n * 100) / 100

/**
 * Arma los avisos para un salón (o todos, con salon = null). Usa los
 * movimientos de las dos cajas: Caja Jazmines hace falta para saber si un
 * cobro se repartió.
 */
export function avisosSaldoCajaEventos(
  movimientos: MovimientoAviso[],
  eventos: EventoAviso[],
  salon: string | null,
): AvisosSaldo {
  const delSalon = (movimientos || []).filter((m) => !salon || m.salon === salon)
  const eventosPorId = new Map((eventos || []).map((e) => [e.id, e]))

  // ---- 1. Cuotas repetidas en Caja Eventos ----
  const filasPorCuota = new Map<string, MovimientoAviso[]>()
  for (const m of delSalon) {
    if (m.tipo !== "ingreso" || m.cajaDestino !== "caja_eventos" || !m.eventoId) continue
    const n = numeroCuota(m.concepto || "")
    if (!n) continue
    const clave = `${m.eventoId}#${n}`
    const lista = filasPorCuota.get(clave)
    if (lista) lista.push(m)
    else filasPorCuota.set(clave, [m])
  }
  const cuotasRepetidas: CuotaRepetida[] = []
  for (const [clave, filas] of filasPorCuota) {
    if (filas.length < 2) continue
    const [eventoId, n] = clave.split("#")
    const ev = eventosPorId.get(eventoId)
    const numero = Number(n)
    // Un cobro en partes deja un pago por parte: solo avisa si hay más filas
    // que pagos (una cuota marcada con el botón rápido viejo no tiene pago y
    // cuenta como uno).
    const pagos = (ev?.pagos ?? []).filter((p) => p.numeroCuota === numero).length
    if (filas.length <= Math.max(1, pagos)) continue
    cuotasRepetidas.push({
      eventoId,
      nombre: nombreEvento(ev),
      fechaEvento: ev?.fecha ?? "",
      numeroCuota: numero,
      montos: [...filas].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "")).map((f) => redondear(f.monto)),
      pagos,
    })
  }
  cuotasRepetidas.sort((a, b) => a.fechaEvento.localeCompare(b.fechaEvento) || a.numeroCuota - b.numeroCuota)

  // ---- 2. Cobros que fueron enteros a Caja Eventos ----
  const cobros = new Map<string, { eventos: number; jazmines: number }>()
  for (const m of delSalon) {
    if (m.tipo !== "ingreso" || !m.eventoId || !esCobro(m.concepto || "")) continue
    const c = cobros.get(m.eventoId) ?? { eventos: 0, jazmines: 0 }
    if (m.cajaDestino === "caja_eventos") c.eventos += m.monto
    else if (m.cajaDestino === "caja_jazmines") c.jazmines += m.monto
    cobros.set(m.eventoId, c)
  }
  const todoACajaEventos: CobroTodoACajaEventos[] = []
  for (const [eventoId, c] of cobros) {
    if (c.eventos <= 0.005 || c.jazmines > 0.005) continue
    const ev = eventosPorId.get(eventoId)
    todoACajaEventos.push({ eventoId, nombre: nombreEvento(ev), fechaEvento: ev?.fecha ?? "", monto: redondear(c.eventos) })
  }
  todoACajaEventos.sort((a, b) => b.monto - a.monto)
  const totalTodoACajaEventos = redondear(todoACajaEventos.reduce((s, x) => s + x.monto, 0))

  // ---- 3. Finalizados con menú o barra sin pago en Caja Eventos ----
  const pagosEvento = new Map<string, { menu: boolean; barra: boolean }>()
  for (const m of movimientos || []) {
    if (m.tipo !== "egreso" || m.cajaDestino !== "caja_eventos" || !m.eventoId) continue
    const c = (m.concepto || "").toLowerCase()
    const p = pagosEvento.get(m.eventoId) ?? { menu: false, barra: false }
    // "Pago menú - …", y por proveedor "Pago menú (X) - …" / "… a cuenta - …".
    if (c.startsWith("pago menú") || c.startsWith("pago menu")) p.menu = true
    if (c.startsWith("pago barra")) p.barra = true
    pagosEvento.set(m.eventoId, p)
  }
  const conCobroEnCajaEventos = new Set(
    (movimientos || [])
      .filter((m) => m.tipo === "ingreso" && m.cajaDestino === "caja_eventos" && m.eventoId)
      .map((m) => m.eventoId as string),
  )
  const finalizadosSinPagar: FinalizadoSinPagar[] = []
  for (const ev of eventos || []) {
    if (ev.estado !== "completado" || (salon && ev.salon !== salon)) continue
    if (!conCobroEnCajaEventos.has(ev.id)) continue
    const tieneMenu =
      (ev.recetasAdultos?.length ?? 0) +
        (ev.recetasAdolescentes?.length ?? 0) +
        (ev.recetasNinos?.length ?? 0) +
        (ev.recetasDietasEspeciales?.length ?? 0) >
      0
    // Una barra sin cócteles no cuesta nada: no hay qué pagar.
    const tieneBarra =
      Array.isArray(ev.barras) &&
      ev.barras.some((b) => ((b as { coctelesIncluidos?: unknown[] } | null)?.coctelesIncluidos?.length ?? 0) > 0)
    const p = pagosEvento.get(ev.id) ?? { menu: false, barra: false }
    const menu = tieneMenu && !ev.cocinaPagada && !p.menu
    const barra = tieneBarra && !ev.barraPagada && !p.barra
    if (!menu && !barra) continue
    finalizadosSinPagar.push({ eventoId: ev.id, nombre: nombreEvento(ev), fechaEvento: ev.fecha ?? "", menu, barra })
  }
  finalizadosSinPagar.sort((a, b) => a.fechaEvento.localeCompare(b.fechaEvento))

  return { cuotasRepetidas, todoACajaEventos, totalTodoACajaEventos, finalizadosSinPagar }
}
