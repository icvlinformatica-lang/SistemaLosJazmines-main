/**
 * Regla única de Caja Jazmines para saber si un gasto fijo está pagado.
 *
 * Antes había dos criterios: la tira de meses y la pastilla de monto miraban
 * el historial del mes calendario (historialMontos), mientras que Próximos
 * vencimientos y "Gastos a 30 días" miraban el campo `pagado` del gasto, que
 * no se reinicia al cambiar de mes: un gasto pagado en agosto seguía contando
 * como pagado en octubre. Queda una sola regla, la de la tira de meses:
 *
 * - Un gasto fijo está pagado en el mes M solo si su historial tiene un
 *   registro de M con `pagado !== false` (los registros viejos sin ese dato
 *   cuentan como pagados, como los leyó siempre la tira). Excepción: el
 *   registro "Alta del gasto" sin ese dato NO es un pago, es solo el alta
 *   (antes del 13/10/2026 el alta no anotaba `pagado: false`).
 * - Gasto repartido visto desde UN salón: en el período vigente (el último
 *   registro del historial) manda la parte de ese salón (`distribucion`).
 * - Gastos anuales: pagados si hay un registro pagado en el año.
 *
 * El campo `pagado` del gasto se sigue escribiendo como antes, pero ya no se
 * usa para leer el estado del mes. No se migran datos: solo cambia la lectura.
 */

import { salonLabel, type CostoOperativo, type DistribucionSalon, type RegistroMonto } from "./store"
import { formatCurrency } from "./utils-financieros"

/** Parte de un gasto repartido que le toca a un salón. */
export interface ParteSalon {
  salon: string
  porcentaje: number
}

type GastoLeido = Pick<CostoOperativo, "monto"> &
  Partial<Pick<CostoOperativo, "historialMontos" | "distribucion" | "frecuencia">>

/** Mes calendario YYYY-MM de una fecha, en la hora del navegador. */
function mesLocalISO(fecha = new Date()): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`
}

/** "2026-10" → "octubre de 2026" */
export function nombreMesLargo(mes: string): string {
  const [y, m] = mes.split("-").map(Number)
  if (!y || !m) return mes
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" })
}

/** Período vigente: el último registro del historial (mismo criterio que la tira). */
function mesVigenteDe(hist: RegistroMonto[]): string | null {
  return hist.length > 0 ? hist[hist.length - 1].mes : null
}

/** Partes reales del reparto: las mismas que usa el resto de Caja Jazmines. */
export function partesDelReparto(gasto: Partial<Pick<CostoOperativo, "distribucion">>): DistribucionSalon[] {
  return (gasto.distribucion || []).filter((d) => d && d.salon && d.porcentaje > 0)
}

/** Parte de un salón en un gasto repartido; undefined si el gasto no se reparte con ese salón. */
export function parteDelSalon(
  gasto: Partial<Pick<CostoOperativo, "distribucion">>,
  salon: string,
): ParteSalon | undefined {
  const d = partesDelReparto(gasto).find((x) => x.salon === salon)
  return d ? { salon: d.salon, porcentaje: d.porcentaje } : undefined
}

/**
 * ¿El registro del mes dice que se pagó? Los registros viejos sin el dato
 * `pagado` cuentan como pagados, salvo el de "Alta del gasto": hasta el
 * 13/10/2026 dar de alta un gasto fijo dejaba el primer mes sin ese dato, y la
 * tira lo mostraba en verde sin que nadie lo hubiera pagado (pasó con
 * "alquiler salon", septiembre 2026). Un alta no es un pago.
 */
export function registroMarcadoPagado(registro: Pick<RegistroMonto, "pagado" | "nota">): boolean {
  if (registro.pagado === undefined || registro.pagado === null) return registro.nota !== "Alta del gasto"
  return registro.pagado !== false
}

/**
 * ¿Está pagado este registro? Con `parte`, en el período vigente manda la
 * parte de ese salón; para el resto, el dato del registro.
 */
function registroPagado(
  gasto: GastoLeido,
  registro: RegistroMonto,
  mesVigente: string | null,
  parte?: ParteSalon,
): boolean {
  if (parte && registro.mes === mesVigente) {
    const d = gasto.distribucion?.find((x) => x.salon === parte.salon)
    if (d) return d.pagado === true
  }
  return registroMarcadoPagado(registro)
}

/**
 * Monto y estado de pago de un MES de un gasto fijo, con las mismas reglas
 * que la tira de meses. Sin registro del mes, el gasto está "a pagar" aunque
 * el período anterior haya quedado saldado. Con `parte`, el monto devuelto es
 * la porción del salón. Por defecto mira el mes en curso del navegador; Caja
 * Jazmines le pasa el mes del reloj del sistema.
 */
export function pagoDelMesActual(
  gasto: GastoLeido,
  parte?: ParteSalon,
  mesISO: string = mesLocalISO(),
): { monto: number; pagado: boolean } {
  const hist = gasto.historialMontos || []
  const registro = hist.find((r) => r.mes === mesISO)
  const factor = parte ? parte.porcentaje / 100 : 1
  const montoGeneral = registro?.monto ?? gasto.monto
  const pagado = registro ? registroPagado(gasto, registro, mesVigenteDe(hist), parte) : false
  return { monto: Math.round(montoGeneral * factor), pagado }
}

export interface DeudaDelPeriodo {
  /** Mes (YYYY-MM) donde se anota el pago: el pedido o, si es anual, el ya cargado en el año. */
  mes: string
  /** true si el período ya está pagado (mirado desde el salón, si hay `parte`). */
  pagado: boolean
  /** Monto general del período: el del registro del mes si existe; si no, el vigente. */
  montoGeneral: number
  /**
   * Lo que falta pagar, con centavos: la parte del salón, lo que deben los
   * salones que todavía no pagaron o el total. 0 si ya está pagado.
   */
  monto: number
  /** Gasto repartido sin salón elegido: las partes que se pagan al registrar el pago. */
  partes: DistribucionSalon[]
}

/**
 * Lo que se debe de un gasto fijo en el período del mes pedido (regla única).
 * Es lo que muestran Próximos vencimientos y "Gastos a 30 días".
 */
export function deudaDelPeriodo(gasto: GastoLeido, mesISO: string, parte?: ParteSalon): DeudaDelPeriodo {
  const hist = gasto.historialMontos || []
  const vigente = mesVigenteDe(hist)
  let registro: RegistroMonto | undefined
  if (gasto.frecuencia === "Anual") {
    // Anual: alcanza con un registro pagado en el año. Si el año ya tiene un
    // registro sin pagar, el pago se anota en ese mismo mes.
    const anio = mesISO.slice(0, 4)
    const delAnio = hist.filter((r) => r.mes.slice(0, 4) === anio)
    registro = delAnio.find((r) => registroPagado(gasto, r, vigente, parte)) ?? delAnio[delAnio.length - 1]
  } else {
    registro = hist.find((r) => r.mes === mesISO)
  }
  const mes = registro?.mes ?? mesISO
  const pagado = registro ? registroPagado(gasto, registro, vigente, parte) : false
  const montoGeneral = registro?.monto ?? gasto.monto
  const deuda = (monto: number, partes: DistribucionSalon[] = []) => ({ mes, pagado, montoGeneral, monto, partes })

  if (pagado) return deuda(0)
  if (parte) return deuda(Math.round((montoGeneral * parte.porcentaje) / 100))
  const dist = partesDelReparto(gasto)
  if (dist.length === 0) return deuda(montoGeneral)
  // Repartido visto desde "Todos los salones": en el período vigente, lo que
  // ya pagó un salón no se debe más. Sin registro del mes, deben todos.
  const faltan = registro && registro.mes === vigente ? dist.filter((d) => d.pagado !== true) : dist
  if (faltan.length === 0 || faltan.length === dist.length) return deuda(montoGeneral, dist)
  return deuda(
    faltan.reduce((s, d) => s + Math.round((montoGeneral * d.porcentaje) / 100), 0),
    faltan,
  )
}

export interface OpcionesPagoDelMes {
  /** Mes (YYYY-MM) que se paga o se deshace. */
  mes: string
  /** Monto GENERAL del mes (no la parte del salón). */
  montoGeneral: number
  /** true = pagar, false = deshacer el pago (o dejar el monto anotado sin pagar). */
  pagado: boolean
  /** Gasto repartido pagado desde un salón: solo se marca la parte de ese salón. */
  parte?: ParteSalon
  /** Fecha y hora del registro (ISO). */
  fechaISO: string
  /** Id del registro nuevo, si el mes todavía no tenía. */
  nuevoId: string
}

/**
 * Cambios que deja el pago (o el deshacer) de un mes de un gasto fijo. Es la
 * cuenta del botón "Pagar" de la tira de meses y la usa también Próximos
 * vencimientos, así los dos lugares escriben lo mismo:
 * - Si el mes ya tenía registro, se actualizan su monto y su estado de pago.
 * - Si no lo tenía, se crea (montoAnterior = monto vigente).
 * - Si el mes es el período más reciente del historial, pasa a ser el vigente:
 *   su monto queda como monto del gasto, junto con el estado de las partes.
 * - Con `parte`, solo se marca la parte de ese salón y el mes queda pagado
 *   cuando pagaron todos. En un mes nuevo, las partes guardadas son del
 *   período anterior: los demás salones vuelven a deber la suya.
 * - Con `parte` en un mes que no es el vigente, el registro queda como se
 *   pidió: las partes guardadas son del vigente y no dicen nada de ese mes.
 * - Sin `parte`, en un gasto repartido se pagan (o se deshacen) todas las partes.
 * Devuelve null si el monto no es válido.
 */
export function cambiosPagoDelMes(
  gasto: Pick<CostoOperativo, "monto"> & Partial<Pick<CostoOperativo, "historialMontos" | "distribucion">>,
  { mes, montoGeneral, pagado, parte, fechaISO, nuevoId }: OpcionesPagoDelMes,
): Pick<CostoOperativo, "historialMontos"> & Partial<Pick<CostoOperativo, "monto" | "pagado" | "distribucion">> | null {
  if (!mes || !Number.isFinite(montoGeneral) || montoGeneral <= 0) return null
  const hist = gasto.historialMontos || []
  const registro = hist.find((r) => r.mes === mes)

  // ¿El mes será el período más reciente del historial? → pasa a ser el vigente.
  const meses = [...new Set([...hist.map((r) => r.mes), mes])].sort()
  const esVigente = meses[meses.length - 1] === mes

  let distribucion = gasto.distribucion
  let pagadoGasto = pagado
  if (gasto.distribucion && gasto.distribucion.length > 0) {
    if (parte) {
      const base =
        esVigente && !registro ? gasto.distribucion.map((d) => ({ ...d, pagado: false })) : gasto.distribucion
      distribucion = base.map((d) => (d.salon === parte.salon ? { ...d, pagado } : d))
      pagadoGasto = distribucion.every((d) => d.pagado === true)
    } else {
      distribucion = gasto.distribucion.map((d) => ({ ...d, pagado }))
    }
  }
  const pagadoRegistro = parte && esVigente ? pagadoGasto : pagado

  const historialMontos: RegistroMonto[] = registro
    ? hist.map((r) => (r === registro ? { ...r, monto: montoGeneral, pagado: pagadoRegistro, fecha: fechaISO } : r))
    : [
        ...hist,
        {
          id: nuevoId,
          mes,
          monto: montoGeneral,
          montoAnterior: gasto.monto,
          fecha: fechaISO,
          pagado: pagadoRegistro,
        },
      ].sort((a, b) => a.mes.localeCompare(b.mes))

  return {
    historialMontos,
    ...(esVigente
      ? {
          monto: montoGeneral,
          pagado: pagadoGasto,
          ...(distribucion ? { distribucion } : {}),
        }
      : {}),
  }
}

/** "Quinta", "Quinta y Casona", "Quinta, Casona y Salón" */
function unirConY(items: string[]): string {
  if (items.length <= 1) return items.join("")
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`
}

/** Texto de la confirmación al pagar un gasto fijo desde Próximos vencimientos. */
export function descripcionPagoFijo(concepto: string, deuda: DeudaDelPeriodo, parte?: ParteSalon): string {
  const mes = nombreMesLargo(deuda.mes)
  const monto = formatCurrency(deuda.monto)
  if (parte) {
    return `Se registra el pago de ${mes} de "${concepto}", solo la parte de ${salonLabel(parte.salon)} (${parte.porcentaje}%, ${monto}).`
  }
  if (deuda.partes.length > 0) {
    const salones = unirConY(deuda.partes.map((d) => salonLabel(d.salon)))
    const partes = deuda.partes.length === 1 ? "Se paga la parte" : "Se pagan las partes"
    return `${partes} de ${salones} de "${concepto}" de ${mes} (${monto}).`
  }
  return `Se registra el pago de ${mes} de "${concepto}" (${monto}).`
}
