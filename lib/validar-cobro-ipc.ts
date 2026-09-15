import type { EventoGuardado, HistorialIPCEntry } from "./store"
import { aplicaIPC, calcularIPCPeriodo, fechaNegocio, numeroCuotaPago, resolverCalculoCobro, type CalculoIPC, type EventoIPC } from "./ipc-cuotas"
import { estadoDeCuota, saldoRestanteCuota } from "./estado-cuotas"

const TOLERANCIA_CENTAVOS = 0.01

export function validarCobroIPC(actual: EventoIPC, updates: Partial<EventoGuardado>, historial: HistorialIPCEntry[]): string | null {
  if (!aplicaIPC(actual)) return null
  const siguiente = { ...actual, ...updates }
  const pagosNuevos = (updates.pagos ?? []).filter(p => !(actual.pagos ?? []).some(a => a.id === p.id))
  if (!pagosNuevos.length) return null
  if (pagosNuevos.length !== 1 || !aplicaIPC(siguiente)) return "Registrá un pago por operación, sin cambiar la modalidad del plan."
  if ((actual.pagos ?? []).some(p => JSON.stringify(p) !== JSON.stringify((updates.pagos ?? actual.pagos)?.find(n => n.id === p.id)))) {
    return "No se pueden modificar pagos anteriores mientras se registra un pago nuevo."
  }
  const pago = pagosNuevos[0]
  const numero = numeroCuotaPago(pago)
  if (!numero) return "El pago no indica a qué cuota corresponde."
  const cuota = siguiente.planDeCuotas?.cuotas?.find(c => c.numero === numero)
  if (!cuota || numero < 1 || numero > actual.planDeCuotas!.numeroCuotas) return "Cuota inválida."

  const cuotaActual = actual.planDeCuotas?.cuotas?.find(c => c.numero === numero)
  const acumuladoPrevio = cuotaActual?.montoPagadoNeto ?? 0
  const estadoPrevio = cuotaActual ? estadoDeCuota(cuotaActual) : "pendiente"
  if (estadoPrevio === "pagada") return "Esa cuota ya está paga."

  const fecha = pago.fecha
  if (!fecha || fecha > fechaNegocio()) return "Indicá la fecha real de cobro; no puede ser futura."

  let calculo: CalculoIPC
  if (estadoPrevio === "parcial") {
    // Esta cuota ya tuvo un pago antes: su cifra oficial (montoCuota +
    // calculoIPC) quedó fijada entonces y el servidor NO la vuelve a
    // auditar ni recalcular acá. Es justamente el invariante pedido: la
    // base de la cuota SIGUIENTE siempre usa esa cifra fija, nunca lo que
    // efectivamente entró en los pagos parciales.
    const oficial = cuotaActual!.calculoIPC
    if (!oficial || cuotaActual!.montoCuota !== oficial.monto) {
      return "La cuota cambió. Actualizá el desglose antes de confirmar el cobro."
    }
    if (
      cuota.montoCuota !== cuotaActual!.montoCuota ||
      cuota.calculoIPC?.monto !== oficial.monto ||
      cuota.calculoIPC?.base !== oficial.base
    ) {
      return "No se puede modificar la cifra ya fijada de una cuota parcial."
    }
    calculo = oficial
  } else {
    // Primer pago contra esta cuota: se resuelve y se fija su cifra oficial.
    const enviado = pago.calculoIPC ?? cuota.calculoIPC
    const aplicarIPC = !enviado?.ipcOmitido
    const automatico = calcularIPCPeriodo(actual, historial, fecha)
    if (automatico.estado === "pendiente" && enviado?.origen !== "manual") return automatico.motivo
    const baseManual = enviado?.origen === "manual" && Number.isFinite(enviado.base) && enviado.base > 0 ? enviado.base : undefined
    const resuelto = resolverCalculoCobro(actual, historial, fecha, { aplicarIPC, baseManual })
    if ("error" in resuelto) return resuelto.error
    if (!resuelto.calculo) return "No se pudo calcular la cuota."
    calculo = resuelto.calculo
    if (cuota.montoCuota !== calculo.monto) return "La cuota cambió. Actualizá el desglose antes de confirmar el cobro."
  }

  const saldoRestante = saldoRestanteCuota({ montoCuota: calculo.monto, montoPagadoNeto: acumuladoPrevio })
  const netoPago = pago.montoCuotaNeto
  if (!Number.isFinite(netoPago) || netoPago! <= 0) return "El pago no indica el neto de la cuota (sin mora)."
  if (netoPago! > saldoRestante + TOLERANCIA_CENTAVOS) return "El pago no puede superar el saldo pendiente de la cuota."
  // La mora nunca se paga en partes: siempre completa junto con la porción de cuota del día.
  if (!Number.isFinite(pago.montoMora) || pago.montoMora! < 0 || pago.monto !== netoPago! + pago.montoMora!) {
    return "El importe debe separar cuota neta y mora."
  }

  const acumuladoNuevo = Math.round((acumuladoPrevio + netoPago!) * 100) / 100
  const quedaCompleta = acumuladoNuevo >= calculo.monto - TOLERANCIA_CENTAVOS

  if (!quedaCompleta) {
    // Con saldo pendiente, la decisión sobre qué pasa con ese resto es de
    // quien cobra (no la calcula el servidor): acumular a la cuota
    // siguiente o dejarla aparte, y si sigue generando IPC o queda
    // congelada. Se pueden cambiar más adelante mientras siga sin cerrarse.
    if (cuota.saldoDecision !== "acumular" && cuota.saldoDecision !== "aparte") {
      return "Elegí qué hacer con el saldo que queda pendiente de esta cuota."
    }
    if (cuota.recargoSaldo !== "acumula" && cuota.recargoSaldo !== "congelado") {
      return "Elegí si el saldo pendiente de esta cuota sigue generando IPC o queda congelado."
    }
  }

  cuota.calculoIPC = calculo
  cuota.montoCuota = calculo.monto
  cuota.montoPagadoNeto = acumuladoNuevo
  cuota.fechaPagoReal = fecha
  cuota.pagada = quedaCompleta
  cuota.estado = quedaCompleta ? "pagada" : "parcial"
  if (quedaCompleta) {
    cuota.saldoDecision = undefined
    cuota.recargoSaldo = undefined
  }
  pago.calculoIPC = calculo
  pago.porcentajeIPC = calculo.ipcOmitido ? 0 : calculo.porcentaje
  pago.numeroCuota = numero
  return null
}
