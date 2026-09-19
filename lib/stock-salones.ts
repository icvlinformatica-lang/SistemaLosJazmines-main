// Lógica pura del módulo "Stock por salón" (conteo físico de insumos que
// cargan Cocina / Barra al terminar un evento). Sin dependencias de React ni
// de la base, para poder usarla igual en el servidor y en la pantalla, y
// probarla sola. NUNCA toca stock_actual (stock global): ver
// scripts/005_stock_por_salon.sql.

export type SectorStock = "cocina" | "barra"

/** Días hacia atrás en los que un evento terminado todavía muestra el aviso de carga. */
export const VENTANA_AVISO_DIAS = 7

/** Hora de fin supuesta (día siguiente) para eventos sin horario_fin cargado. */
export const FIN_POR_DEFECTO = "06:00"

// Argentina no tiene horario de verano desde 2009: UTC-3 fijo todo el año.
const OFFSET_ARGENTINA = "-03:00"

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/
const RE_HORA = /^\d{2}:\d{2}$/

function sumarUnDia(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Momento real en que termina un evento, en hora argentina.
 *
 * Los eventos terminan de madrugada: si horario_fin <= horario (ej. 21:00 →
 * 05:00), el fin cae AL DÍA SIGUIENTE. Sin eso, la carga se desbloquearía
 * 24 horas antes de tiempo.
 * - Sin horario_fin: se toma el día siguiente a las 06:00.
 * - Con horario_fin pero sin horario: se asume evento nocturno (cruza la
 *   medianoche) si el fin es antes del mediodía.
 * Devuelve null si la fecha no tiene formato válido.
 */
export function finRealEvento(fecha: string | null | undefined, horario: string | null | undefined, horarioFin: string | null | undefined): Date | null {
  if (!fecha || !RE_FECHA.test(fecha)) return null
  const inicio = horario && RE_HORA.test(horario) ? horario : null
  const fin = horarioFin && RE_HORA.test(horarioFin) ? horarioFin : null

  let dia = fecha
  let hora: string
  if (!fin) {
    dia = sumarUnDia(fecha)
    hora = FIN_POR_DEFECTO
  } else {
    hora = fin
    const cruza = inicio ? fin <= inicio : fin < "12:00"
    if (cruza) dia = sumarUnDia(fecha)
  }
  const d = new Date(`${dia}T${hora}:00${OFFSET_ARGENTINA}`)
  return Number.isFinite(d.getTime()) ? d : null
}

export interface EventoParaStock {
  id: string
  nombre: string
  fecha: string | null
  horario: string | null
  horarioFin: string | null
  salon: string | null
  estado: string | null
}

export interface SesionCerradaParaStock {
  eventoId: string | null
  salon: string
  sector: SectorStock
  cerradaEn: Date
}

/**
 * Evento que habilita el aviso "ya terminó, podés cargar el stock" para un
 * salón y sector:
 * - el ÚLTIMO evento terminado de ese salón (fin real <= ahora), que haya
 *   terminado hace VENTANA_AVISO_DIAS días o menos;
 * - sin contar borradores ni cancelados;
 * - y que todavía no tenga carga de ese sector: ni una sesión cerrada con su
 *   evento_id, ni una sesión cerrada en ese salón después de que terminó.
 * Si no hay ninguno, devuelve null (la carga igual se puede hacer, solo no
 * se muestra el aviso).
 */
export function eventoPendienteDeCarga(
  eventos: EventoParaStock[],
  sesiones: SesionCerradaParaStock[],
  salon: string,
  sector: SectorStock,
  ahora: Date = new Date(),
): { evento: EventoParaStock; fin: Date } | null {
  const desde = ahora.getTime() - VENTANA_AVISO_DIAS * 24 * 60 * 60 * 1000
  let ultimo: { evento: EventoParaStock; fin: Date } | null = null
  for (const ev of eventos) {
    if (ev.salon !== salon) continue
    if (ev.estado === "borrador" || ev.estado === "cancelado") continue
    const fin = finRealEvento(ev.fecha, ev.horario, ev.horarioFin)
    if (!fin) continue
    const t = fin.getTime()
    if (t > ahora.getTime() || t < desde) continue
    if (!ultimo || t > ultimo.fin.getTime()) ultimo = { evento: ev, fin }
  }
  if (!ultimo) return null

  const yaCargado = sesiones.some(
    (s) =>
      s.sector === sector &&
      (s.eventoId === ultimo!.evento.id || (s.salon === salon && s.cerradaEn.getTime() >= ultimo!.fin.getTime())),
  )
  return yaCargado ? null : ultimo
}

/**
 * Sectores que puede cargar cada perfil. Administración y Soporte cargan los
 * dos; Cocina solo cocina y Barra solo barra. El resto, ninguno.
 */
export function sectoresPermitidos(perfilId: string | null | undefined): SectorStock[] {
  if (perfilId === "administracion" || perfilId === "soporte") return ["cocina", "barra"]
  if (perfilId === "cocina") return ["cocina"]
  if (perfilId === "barra") return ["barra"]
  return []
}

/** Perfiles que pueden ver la vista consolidada y el detalle de las sesiones. */
export function puedeVerConsolidado(perfilId: string | null | undefined): boolean {
  return perfilId === "administracion" || perfilId === "soporte"
}

/** "21/10 05:40" en hora argentina. */
export function fechaHoraCortaArgentina(d: Date): string {
  const partes = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d)
  // padStart: algunos motores devuelven el mes sin cero ("9") aun con "2-digit".
  const p = (t: string) => (partes.find((x) => x.type === t)?.value ?? "").padStart(2, "0")
  return `${p("day")}/${p("month")} ${p("hour")}:${p("minute")}`
}

export interface FilaStockSalon {
  insumoId: string
  salon: string
  cantidad: number
  actualizadoPor: string | null
  actualizadoEn: string
}

export interface ResumenStockInsumo {
  insumoId: string
  /** Suma de lo efectivamente contado (parcial si no contaron todos los salones). */
  total: number
  /** Cuántos salones tienen conteo (un 0 contado cuenta; "sin fila" no). */
  salonesContados: number
  detalle: Array<{ salon: string; cantidad: number; por: string | null; en: string }>
}

/**
 * Agrupa las filas de stock_salones por insumo. Solo aparecen los insumos
 * con al menos un conteo. Tres estados distintos por salón:
 * - fila con cantidad > 0 → hay esa cantidad;
 * - fila con cantidad 0 → contaron y no queda nada (se muestra 0);
 * - sin fila → nadie contó todavía (se muestra "—", NUNCA 0).
 * Por eso el total es la suma de lo contado, y hay que presentarlo como
 * parcial cuando salonesContados < cantidad de salones.
 */
export function resumirStockPorInsumo(filas: FilaStockSalon[]): ResumenStockInsumo[] {
  const porInsumo = new Map<string, ResumenStockInsumo>()
  for (const f of filas) {
    let r = porInsumo.get(f.insumoId)
    if (!r) {
      r = { insumoId: f.insumoId, total: 0, salonesContados: 0, detalle: [] }
      porInsumo.set(f.insumoId, r)
    }
    r.total += f.cantidad
    r.salonesContados += 1
    r.detalle.push({ salon: f.salon, cantidad: f.cantidad, por: f.actualizadoPor, en: f.actualizadoEn })
  }
  return [...porInsumo.values()]
}
