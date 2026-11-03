// Qué le falta a un evento antes de finalizarlo (pedido de Rodrigo, 3/11/2026:
// "antes de finalizarlo decime si tengo que marcar como pago algo o cobrar
// algo para que quede realmente en la caja lo que corresponde").
//
// Es SOLO UN AVISO: no paga, no cobra ni frena el finalizar. Sale de la misma
// cuenta de Caja Eventos (`calcularCajaEventos`): las cuotas de "Por cobrar" y
// los egresos de "Por pagar" (menú, barra, señas y saldos de servicios y
// sueldos) de ese evento. Así el aviso dice lo mismo que esa pantalla.

export interface IngresoPendienteAviso {
  eventoId: string
  numeroCuota: number
  totalCuotas: number
  fechaVencimiento: string
  /** Saldo entero de la cuota (lo que trae el cliente, no la parte de Caja Eventos). */
  saldoRestante: number
  esVencida: boolean
}

export interface EgresoPendienteAviso {
  eventoId: string
  servicioNombre: string
  tipo: "seña" | "saldo" | "menu" | "barra" | "sueldo"
  persona?: string
  monto: number
}

export interface CuotaPorCobrar {
  numeroCuota: number
  totalCuotas: number
  fechaVencimiento: string
  monto: number
  vencida: boolean
}

export interface PagoPorMarcar {
  tipo: EgresoPendienteAviso["tipo"]
  /** Texto para mostrar: "Menú", "Barra", "Seña de DJ", "Sueldo de Juan"… */
  detalle: string
  monto: number
}

export interface PendientesAlFinalizar {
  porCobrar: CuotaPorCobrar[]
  porPagar: PagoPorMarcar[]
  totalPorCobrar: number
  totalPorPagar: number
  /** true si no falta nada: se puede finalizar sin aviso. */
  alDia: boolean
}

const redondear = (n: number) => Math.round(n * 100) / 100
const ORDEN_TIPO: Record<EgresoPendienteAviso["tipo"], number> = { menu: 0, barra: 1, seña: 2, saldo: 3, sueldo: 4 }

function detalleEgreso(e: EgresoPendienteAviso): string {
  const nombre = (e.servicioNombre || "").trim()
  switch (e.tipo) {
    case "menu":
      return "Menú (comida)"
    case "barra":
      return "Barra (bebida)"
    case "seña":
      return `Seña de ${nombre || "un servicio"}`
    case "saldo":
      return `Saldo de ${nombre || "un servicio"}`
    case "sueldo":
      return `Sueldo de ${nombre || (e.persona || "").trim() || "personal"}`
  }
}

export function pendientesAlFinalizar(
  data: { ingresosPendientes: IngresoPendienteAviso[]; egresosPendientes: EgresoPendienteAviso[] },
  eventoId: string,
): PendientesAlFinalizar {
  const porCobrar = (data.ingresosPendientes || [])
    .filter((i) => i.eventoId === eventoId && i.saldoRestante > 0.005)
    .map((i) => ({
      numeroCuota: i.numeroCuota,
      totalCuotas: i.totalCuotas,
      fechaVencimiento: i.fechaVencimiento,
      monto: redondear(i.saldoRestante),
      vencida: i.esVencida,
    }))
    .sort((a, b) => a.numeroCuota - b.numeroCuota)

  const porPagar = (data.egresosPendientes || [])
    .filter((e) => e.eventoId === eventoId && e.monto > 0.005)
    .map((e) => ({ tipo: e.tipo, detalle: detalleEgreso(e), monto: redondear(e.monto) }))
    .sort((a, b) => ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo] || a.detalle.localeCompare(b.detalle))

  const totalPorCobrar = redondear(porCobrar.reduce((t, c) => t + c.monto, 0))
  const totalPorPagar = redondear(porPagar.reduce((t, p) => t + p.monto, 0))
  return { porCobrar, porPagar, totalPorCobrar, totalPorPagar, alDia: porCobrar.length === 0 && porPagar.length === 0 }
}
