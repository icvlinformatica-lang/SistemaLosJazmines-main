import type { EventoGuardado, HistorialIPCEntry } from "./store"
import { aplicaIPC, calcularIPCPeriodo, fechaNegocio, numeroCuotaPago, numerosPagados, type EventoIPC } from "./ipc-cuotas"

export function validarCobroIPC(actual: EventoIPC, updates: Partial<EventoGuardado>, historial: HistorialIPCEntry[]): string | null {
  if (!aplicaIPC(actual)) return null
  const siguiente = { ...actual, ...updates }
  const anteriores = numerosPagados(actual)
  const nuevas = numerosPagados(siguiente).filter(n => !anteriores.includes(n))
  const pagosNuevos = (updates.pagos ?? []).filter(p => !(actual.pagos ?? []).some(a => a.id === p.id))
  if (pagosNuevos.length && nuevas.length !== 1) return "Cada cobro debe corresponder a una única cuota pendiente."
  if (!nuevas.length) return null
  if (nuevas.length !== 1 || !aplicaIPC(siguiente)) return "Registrá una cuota por operación, sin cambiar la modalidad del plan."
  if ((actual.pagos ?? []).some(p => JSON.stringify(p) !== JSON.stringify((updates.pagos ?? actual.pagos)?.find(n => n.id === p.id)))) {
    return "No se pueden modificar pagos anteriores mientras se registra una cuota nueva."
  }
  const numero = nuevas[0]
  const cuota = siguiente.planDeCuotas?.cuotas?.find(c => c.numero === numero)
  if (!cuota || numero < 1 || numero > actual.planDeCuotas!.numeroCuotas) return "Cuota inválida."
  const pago = pagosNuevos.find(p => numeroCuotaPago(p) === numero)
  if (pagosNuevos.length && !pago) return "El pago no corresponde a la cuota indicada."
  const fecha = pago?.fecha ?? cuota.fechaPagoReal
  if (!fecha || fecha > fechaNegocio()) return "Indicá la fecha real de cobro; no puede ser futura."
  const resultado = calcularIPCPeriodo(actual, historial, fecha)
  if (resultado.estado === "pendiente") return resultado.motivo
  if (resultado.estado !== "listo") return "No se pudo calcular la cuota."
  const calculo = resultado.calculo
  const neto = pago?.montoCuotaNeto ?? cuota.montoPagadoNeto
  if (neto !== calculo.monto || cuota.montoCuota !== calculo.monto) return "La cuota cambió. Actualizá el desglose antes de confirmar el cobro."
  if (pago && (!Number.isFinite(pago.montoMora) || pago.montoMora! < 0 || pago.monto !== neto + pago.montoMora!)) return "El importe debe separar cuota neta y mora."
  // El servidor genera la auditoría; no confía en la base ni en el porcentaje enviados por el navegador.
  cuota.calculoIPC = calculo
  cuota.montoPagadoNeto = calculo.monto
  cuota.fechaPagoReal = fecha
  cuota.pagada = true
  if (pago) {
    pago.calculoIPC = calculo
    pago.porcentajeIPC = calculo.porcentaje
    pago.numeroCuota = numero
  }
  return null
}
