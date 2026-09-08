import { calcularProporcionCajaEventos, repartirEntreCajas } from "./cobrar-cuota"
import { calcularCajaEventos } from "./hooks/use-caja-eventos"
import {
  calcularCostoServiciosContratados, PORCENTAJE_COMISION_VENDEDOR, SALONES,
  type AppState, type CajaDestino, type CostoOperativo, type GastoArchivado,
} from "./store"

export const CAJAS_RESUMEN = ["caja_eventos", "caja_jazmines"] as const
export const GENERAL = "general"
export const METRICAS_RESUMEN = ["cuotasPrevistas", "cuotasCobradas", "cuotasPendientes", "egresosPrevistos", "pagosRegistrados", "egresosPendientes", "egresosSinConfirmar"] as const
export type MetricaResumen = typeof METRICAS_RESUMEN[number]
export type ImportesResumen = Record<MetricaResumen, number>
export interface LineaResumen {
  referencia: string
  concepto: string
  caja: CajaDestino
  salon: string
  metrica: MetricaResumen
  monto: number
}
export interface ResumenMensual {
  mes: string
  salones: string[]
  cajas: Record<CajaDestino, Record<string, ImportesResumen>>
  totales: Record<CajaDestino, ImportesResumen>
  lineas: LineaResumen[]
  advertencias: string[]
}

export function mesCalendario(fecha?: string | null) { return fecha?.slice(0, 7) || "" }
export function mesDeFecha(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`
}
export function cambiarMes(mes: string, salto: number) {
  const [anio, numero] = mes.split("-").map(Number)
  return mesDeFecha(new Date(anio, numero - 1 + salto, 1, 12))
}
export function vencimientoMensual(fecha: string | undefined, mes: string, anual = false) {
  const [anio, numero] = mes.split("-").map(Number)
  if (anual && (!fecha || fecha.slice(5, 7) !== mes.slice(5, 7))) return null
  const dia = Math.min(Number(fecha?.slice(8, 10)) || 1, new Date(anio, numero, 0).getDate())
  return `${mes}-${String(dia).padStart(2, "0")}`
}
const dinero = (n: number) => Math.round((Number(n) || 0) * 100) / 100
const vacio = (): ImportesResumen => Object.fromEntries(METRICAS_RESUMEN.map((k) => [k, 0])) as ImportesResumen
const sumar = <T extends { monto: number }>(items: T[]) => dinero(items.reduce((n, x) => n + x.monto, 0))

interface PagoConciliable {
  id: string
  ref?: string | null
  costoId?: string
  eventoId?: string | null
  caja: CajaDestino
  salon: string
  fecha: string
  periodo?: string
  monto: number
  concepto: string
  confirmado: boolean
  archivo?: GastoArchivado
}

/** Vista de consulta: no modifica entidades, no genera movimientos ni reconstruye saldos bancarios. */
export function calcularResumenMensual(state: AppState, mes: string, ahora = new Date()): ResumenMensual {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error("Mes inválido")
  const actual = mesDeFecha(ahora)
  const advertencias = new Set<string>()
  const lineas: LineaResumen[] = []
  const eventos = (state.eventos || []).filter((e) => !(e as typeof e & { deleted_at?: string }).deleted_at)
  const idsEventos = new Set(eventos.map((e) => e.id))
  const visible = (id?: string | null) => !id || idsEventos.has(id)
  const movimientos = (state.movimientosCaja || []).filter((m) => visible(m.eventoId))
  const archivos = (state.gastosArchivados || []).filter((g) => visible(g.eventoId))
  const estado = { ...state, eventos, movimientosCaja: movimientos, gastosArchivados: archivos }
  const salonDe = (salon?: string | null) => salon && salon !== "admin" ? salon : GENERAL
  const agregar = (metrica: MetricaResumen, caja: CajaDestino, salon: string | null | undefined, monto: number, referencia: string, concepto: string) => {
    if (monto > 0) lineas.push({ metrica, caja, salon: salonDe(salon), monto: dinero(monto), referencia, concepto })
  }

  const cobros = movimientos.filter((m) => m.tipo === "ingreso" && /^Cuota\s+\d+\b/i.test(m.concepto || ""))
  for (const m of cobros) {
    if (mesCalendario(m.fecha) !== mes) continue
    if (!m.cajaDestino) { advertencias.add("Hay cuotas históricas sin caja identificada; no se repartieron arbitrariamente."); continue }
    agregar("cuotasCobradas", m.cajaDestino, m.salon, m.monto, m.id, m.concepto)
  }
  for (const evento of eventos) {
    const plan = evento.planDeCuotas
    if (!plan) continue
    const proporcion = calcularProporcionCajaEventos(evento, estado)
    for (const cuota of plan.cuotas || []) {
      if (mesCalendario(cuota.fechaVencimiento) !== mes) continue
      const registros = cobros.filter((m) => m.eventoId === evento.id && Number(m.concepto.match(/^Cuota\s+(\d+)\b/i)?.[1]) === cuota.numero)
      const pagada = cuota.pagada || plan.cuotasPagadas?.includes(cuota.numero)
      const activo = evento.estado !== "cancelado" && evento.estado !== "completado"
      if (!activo && !pagada && !registros.length) continue
      const monto = dinero(cuota.montoCuota)
      const registrado = sumar(registros)
      const ref = `${evento.id}-cuota-${cuota.numero}`
      const concepto = `Cuota ${cuota.numero} · ${evento.nombrePareja || evento.nombre || "Evento"}`
      const reparto = repartirEntreCajas(monto, proporcion)
      const historicoCompleto = registros.length > 0 && registros.every((m) => m.cajaDestino) && (pagada || Math.abs(registrado - monto) < 0.01)
      if (historicoCompleto) {
        for (const m of registros) agregar("cuotasPrevistas", m.cajaDestino!, m.salon, m.monto, ref, concepto)
      } else {
        agregar("cuotasPrevistas", "caja_eventos", evento.salon, reparto.montoEventos, ref, concepto)
        agregar("cuotasPrevistas", "caja_jazmines", evento.salon, reparto.montoJazmines, ref, concepto)
        if (pagada || registros.length) advertencias.add("Algunas cuotas no tienen reparto histórico completo: su previsto se estima con la regla vigente. Cobradas incluye únicamente movimientos registrados.")
      }
      if (activo && !pagada) {
        const saldo = repartirEntreCajas(Math.max(0, monto - registrado), proporcion)
        agregar("cuotasPendientes", "caja_eventos", evento.salon, saldo.montoEventos, ref, concepto)
        agregar("cuotasPendientes", "caja_jazmines", evento.salon, saldo.montoJazmines, ref, concepto)
      }
    }
  }

  const pagos: PagoConciliable[] = movimientos.filter((m) => m.tipo === "egreso" && m.cajaDestino).map((m) => ({
    id: m.id, ref: m.id, costoId: m.costoOperativoId, eventoId: m.eventoId,
    caja: m.cajaDestino!, salon: salonDe(m.salon), fecha: m.fecha, monto: m.monto,
    concepto: m.concepto, confirmado: true,
  }))
  const movIds = new Set(movimientos.map((m) => m.id))
  for (const g of archivos) {
    if (g.refId && movIds.has(g.refId)) continue
    const duplicado = pagos.some((p) => g.refId && p.costoId === g.refId && mesCalendario(p.fecha) === mesCalendario(g.fecha))
    if (duplicado) continue
    const costo = state.costosOperativos?.find((c) => c.id === g.refId)
    // El archivo de variables/comisiones también admite archivar sin pagar.
    const confirmado = g.origen === "caja_jazmines_fijo" || g.origen === "caja_eventos" || costo?.pagado === true
    pagos.push({ id: g.id, ref: g.refId, eventoId: g.eventoId, caja: g.origen === "caja_eventos" ? "caja_eventos" : "caja_jazmines", salon: salonDe(g.salon), fecha: g.fecha, monto: g.monto, concepto: g.concepto, confirmado, archivo: g })
  }
  for (const costo of state.costosOperativos || []) {
    for (const h of costo.historialMontos || []) {
      if (h.pagado !== true) continue
      const existe = pagos.some((p) => (p.ref === costo.id || p.costoId === costo.id) && mesCalendario(p.fecha) === h.mes)
      if (!existe) pagos.push({ id: `historial-${costo.id}-${h.id}`, ref: costo.id, periodo: h.mes, fecha: h.fecha, monto: h.monto, caja: "caja_jazmines", salon: salonDe(costo.distribucion?.length ? null : costo.salon), concepto: costo.concepto, confirmado: true })
    }
  }
  const usados = new Set<string>()
  const duplicados = new Set<string>()
  const pagosSinteticos: PagoConciliable[] = []
  const registrarEstado = (id: string, caja: CajaDestino, salon: string | null | undefined, fecha: string | undefined, monto: number, concepto: string) => {
    if (fecha) {
      pagosSinteticos.push({ id, caja, salon: salonDe(salon), fecha, monto, concepto, confirmado: true })
      if (mesCalendario(fecha) === mes) advertencias.add("Algunos pagos provienen de estados con fecha, sin un movimiento o archivo con importe histórico. Esos importes se reconstruyen desde la entidad y pueden ser estimados.")
    } else if (monto > 0) advertencias.add("Hay gastos marcados pagados sin fecha de pago: se consideran cubiertos, pero no se inventa un pago fechado en este mes.")
  }

  const completas = calcularCajaEventos(estado, undefined, ahora, true)
  const pendientes = new Map(calcularCajaEventos(estado, undefined, ahora).egresosPendientes.map((g) => [g.id, g.monto]))
  const coincide = (p: PagoConciliable, g: typeof completas.egresosPendientes[number]) => {
    if (p.caja !== "caja_eventos" || p.eventoId !== g.eventoId) return false
    const historico = completas.pagosRealizados.find((m) => m.id === p.id)
    const tipo = historico?.tipoPago || p.archivo?.categoria
    const nombre = historico?.servicioNombre || p.archivo?.concepto
    return tipo === g.tipo && (["menu", "barra"].includes(g.tipo) || nombre === g.servicioNombre)
  }
  for (const g of completas.egresosPendientes) {
    const evento = eventos.find((e) => e.id === g.eventoId)!
    const registros = pagos.filter((p) => !usados.has(p.id) && coincide(p, g) && completas.egresosPendientes.filter((otro) => coincide(p, otro)).length === 1)
    registros.forEach((p) => usados.add(p.id))
    const pagado = sumar(registros.filter((p) => p.confirmado))
    const compromiso = state.pagosPersonal?.find((p) => `${evento.id}-compromiso-${p.id}` === g.id)
    const anticipo = compromiso?.montoSeña || 0
    if (compromiso && anticipo > 0) {
      const depositos = pagos.filter((p) => p.eventoId === evento.id && p.caja === "caja_eventos" && p.concepto.startsWith(`Pago seña ${compromiso.nombrePersonal}`))
      depositos.forEach((p) => usados.add(p.id))
      if (mesCalendario(compromiso.fechaSeña || g.fechaVencimiento) === mes) agregar("egresosPrevistos", "caja_eventos", g.salon, anticipo, `${g.id}-anticipo`, `Anticipo · ${g.servicioNombre}`)
      if (!depositos.length) registrarEstado(`${g.id}-anticipo`, "caja_eventos", g.salon, compromiso.fechaSeña, anticipo, `Anticipo · ${g.servicioNombre}`)
    }
    const pendienteModelo = pendientes.get(g.id) || 0
    const cubierto = !pendientes.has(g.id)
    const monto = cubierto && pagado > 0 ? pagado : Math.max(g.monto - anticipo, pagado)
    if (mesCalendario(g.fechaVencimiento) === mes) {
      agregar("egresosPrevistos", "caja_eventos", g.salon, monto, g.id, g.servicioNombre)
      agregar("egresosPendientes", "caja_eventos", g.salon, cubierto ? 0 : Math.min(pendienteModelo, Math.max(0, monto - pagado)), g.id, g.servicioNombre)
    }
    if (cubierto && !registros.length) {
      const srv = evento.servicios?.find((s) => s.servicioId === g.servicioId)
      const pp = state.pagosPersonal?.find((p) => `${evento.id}-compromiso-${p.id}` === g.id)
      const fecha = g.tipo === "seña" ? srv?.fechaPagoSeña : g.tipo === "saldo" ? srv?.fechaPagoSaldo : pp?.fechaPago
      // Un evento completado no demuestra por sí solo que sus proveedores estén pagados.
      const marcado = g.tipo === "menu" ? evento.cocinaPagada : g.tipo === "barra" ? evento.barraPagada : g.tipo === "sueldo" ? (pp?.estado === "pagado" || evento.personalEvento?.find((p) => p.id === g.servicioId)?.pagado) : g.tipo === "seña" ? (srv?.estadoPago && srv.estadoPago !== "sin_seña") : srv?.estadoPago === "pagado_total"
      if (marcado) registrarEstado(g.id, "caja_eventos", g.salon, fecha, monto, g.servicioNombre)
      else if (mesCalendario(g.fechaVencimiento) === mes) agregar("egresosSinConfirmar", "caja_eventos", g.salon, monto, g.id, g.servicioNombre)
    }
  }

  for (const evento of eventos) {
    const vendedor = state.vendedores?.find((v) => v.nombre.toLowerCase() === evento.contrato?.vendedor?.toLowerCase())
    if (!vendedor) continue
    const ref = `comision-${vendedor.id}-${evento.id}`
    const candidatos = pagos.filter((p) => p.ref === ref || (p.caja === "caja_jazmines" && p.eventoId === evento.id && /comisi[oó]n/i.test(p.concepto)))
    const tieneMovimiento = candidatos.some((p) => !p.archivo)
    const registros = candidatos.filter((p) => {
      if (tieneMovimiento && p.archivo) { duplicados.add(p.id); return false }
      return true
    })
    if (evento.estado === "cancelado" && !registros.length && !evento.comisionPagada) continue
    if (evento.contrato?.comisionOculta && !registros.length && !evento.comisionPagada) continue
    registros.forEach((p) => { usados.add(p.id); if (evento.comisionPagada) p.confirmado = true })
    const total = evento.planDeCuotas?.montoTotal || evento.precioVenta || 0
    const monto = registros.length ? sumar(registros) : Math.round(Math.max(0, total - calcularCostoServiciosContratados(evento, estado)) * PORCENTAJE_COMISION_VENDEDOR / 100)
    const concepto = `Comisión · ${vendedor.nombre}`
    const cubierto = evento.comisionPagada || registros.some((p) => p.confirmado)
    if (mesCalendario(evento.fecha) === mes) {
      agregar("egresosPrevistos", "caja_jazmines", evento.salon, monto, ref, concepto)
      agregar(cubierto ? "egresosPendientes" : registros.length ? "egresosSinConfirmar" : "egresosPendientes", "caja_jazmines", evento.salon, cubierto ? 0 : monto, ref, concepto)
    }
    if (evento.comisionPagada) {
      if (!registros.length) registrarEstado(ref, "caja_jazmines", evento.salon, evento.comisionPagadaFecha, monto, concepto)
      else if (evento.comisionPagadaFecha) registros.filter((p) => p.archivo).forEach((p) => { p.fecha = evento.comisionPagadaFecha! })
    }
  }

  const costos: CostoOperativo[] = [...(state.costosOperativos || [])]
  for (const v of state.vendedores || []) {
    if (v.sueldo > 0) costos.push({ id: `sueldo-vendedor-${v.id}`, concepto: `Sueldo vendedor · ${v.nombre}`, monto: v.sueldo, frecuencia: "Mensual", fechaVencimiento: v.sueldoFechaPago, activo: true, tipo: "Personal Fijo", esPorPersona: false })
  }
  for (const costo of costos) {
    const anual = costo.frecuencia === "Anual"
    const recurrente = !costo.esVariable && ["Mensual", "Anual"].includes(costo.frecuencia)
    const historial = costo.historialMontos?.find((h) => h.mes === mes)
    const registros = pagos.filter((p) => !usados.has(p.id) && (p.costoId === costo.id || p.ref === costo.id) && (recurrente ? (p.periodo || mesCalendario(p.fecha)) === mes : true))
    const fecha = recurrente ? vencimientoMensual(costo.fechaVencimiento, mes, anual) : costo.fechaVencimiento
    if (mesCalendario(fecha) !== mes && !historial && !registros.length) continue
    if (!costo.activo && !historial && !registros.length) continue
    if (recurrente && mes < actual && !historial && !registros.length) {
      advertencias.add("Los meses pasados solo incluyen gastos fijos con respaldo histórico. No se reconstruyen boletas ni sueldos antiguos con valores actuales.")
      continue
    }
    if (mesCalendario(fecha) !== mes && !recurrente) continue
    registros.forEach((p) => usados.add(p.id))
    const monto = registros.length ? Math.max(sumar(registros), historial?.monto || (mes >= actual && !registros.some((p) => p.archivo) ? costo.monto : 0)) : historial?.monto ?? costo.monto
    const dist = (costo.distribucion || []).filter((d) => d.salon && d.porcentaje > 0)
    const historico = mes < actual || registros.some((p) => p.archivo || p.periodo)
    let partes: { salon: string; monto: number; pagado: boolean; desconocido: boolean }[]
    if (historico && registros.length) {
      partes = registros.map((p) => ({ salon: p.salon, monto: p.monto, pagado: p.confirmado, desconocido: !p.confirmado }))
      if (dist.length && partes.some((p) => p.salon === GENERAL)) advertencias.add("Algunos gastos compartidos se archivaron sin reparto histórico; permanecen en General / Sin asignar.")
    } else if (dist.length && mes >= actual && !historial) {
      const porcentaje = dist.reduce((n, d) => n + d.porcentaje, 0)
      if (Math.abs(porcentaje - 100) > 0.01) {
        advertencias.add("Hay gastos con distribución distinta de 100%: se muestran en General / Sin asignar para no duplicar importes.")
        partes = [{ salon: GENERAL, monto, pagado: mes === actual && !!costo.pagado, desconocido: false }]
      } else {
        let resto = dinero(monto)
        partes = dist.map((d, i) => {
          const parte = i === dist.length - 1 ? resto : dinero(monto * d.porcentaje / 100)
          resto = dinero(resto - parte)
          return { salon: d.salon, monto: parte, pagado: mes === actual && !!(costo.pagado || d.pagado), desconocido: false }
        })
      }
    } else {
      partes = [{ salon: salonDe(dist.length && mes < actual ? null : costo.salon), monto, pagado: historial ? historial.pagado === true : (mes === actual || !recurrente) && !!costo.pagado, desconocido: !!historial && historial.pagado === undefined }]
    }
    for (const parte of partes) {
      agregar("egresosPrevistos", "caja_jazmines", parte.salon, parte.monto, costo.id, costo.concepto)
      const abonado = historico ? 0 : sumar(registros.filter((p) => p.confirmado && p.salon === parte.salon))
      if (!parte.pagado) agregar(parte.desconocido ? "egresosSinConfirmar" : "egresosPendientes", "caja_jazmines", parte.salon, Math.max(0, parte.monto - abonado), costo.id, costo.concepto)
      if (parte.pagado && !registros.length) registrarEstado(`${costo.id}-${mes}-${parte.salon}`, "caja_jazmines", parte.salon, historial?.pagado === true ? historial.fecha : undefined, parte.monto, costo.concepto)
    }
    if (historial?.pagado === undefined && historial) advertencias.add("Hay períodos con monto histórico pero sin confirmación de pago. Se muestran como estado sin confirmar, no como pagados.")
  }

  for (const pago of pagos) {
    if (duplicados.has(pago.id) || mesCalendario(pago.fecha) !== mes) continue
    if (!usados.has(pago.id) && (!pago.periodo || pago.periodo === mes)) {
      // Los egresos sin obligación conciliable no se añaden a un presupuesto ya estimado del mismo evento.
      if (!pago.eventoId || !completas.egresosPendientes.some((g) => g.eventoId === pago.eventoId)) {
        agregar("egresosPrevistos", pago.caja, pago.salon, pago.monto, pago.id, pago.concepto)
        if (!pago.confirmado) agregar("egresosSinConfirmar", pago.caja, pago.salon, pago.monto, pago.id, pago.concepto)
      } else advertencias.add("Hay pagos de eventos sin correspondencia única con una obligación; se muestran en pagos registrados sin duplicar el presupuesto del evento.")
    }
    if (!pago.confirmado) advertencias.add("Algunos archivos no conservan confirmación de pago. Su importe previsto se incluye, pero no se considera un pago confirmado.")
    if (pago.confirmado) agregar("pagosRegistrados", pago.caja, pago.salon, pago.monto, pago.id, pago.concepto)
  }
  for (const pago of pagosSinteticos) {
    if (mesCalendario(pago.fecha) === mes) agregar("pagosRegistrados", pago.caja, pago.salon, pago.monto, pago.id, pago.concepto)
  }
  const salones = [...new Set<string>([...SALONES, ...Object.keys(state.configuracionCajas?.salones || {}), ...lineas.map((l) => l.salon)])]
  const cajas = Object.fromEntries(CAJAS_RESUMEN.map((c) => [c, Object.fromEntries(salones.map((s) => [s, vacio()]))])) as ResumenMensual["cajas"]
  const totales = { caja_eventos: vacio(), caja_jazmines: vacio() }
  for (const l of lineas) {
    cajas[l.caja][l.salon][l.metrica] = dinero(cajas[l.caja][l.salon][l.metrica] + l.monto)
    totales[l.caja][l.metrica] = dinero(totales[l.caja][l.metrica] + l.monto)
  }
  return { mes, salones, cajas, totales, lineas, advertencias: [...advertencias] }
}
