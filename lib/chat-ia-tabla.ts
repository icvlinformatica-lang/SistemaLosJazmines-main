// Tablas del chat con IA: "¿cuántos eventos hay hasta fin de año, por salón
// y mes?", "¿cuánto falta cobrar por salón?", "¿qué hizo cada uno esta
// semana?". Las arma el servidor con los datos de la base (los números no
// salen del texto de la IA) y se guardan en el mensaje como las tarjetas de
// eventos ({…, tablas}).
//
// armarTabla es la cuenta genérica (filas × columnas, con totales);
// tablaEventos y tablaActividad dicen qué dimensiones y medidas hay.
// Solo tipos de chat-ia-datos (que es del servidor): esta tabla la lee también la pantalla.
import type { FilaEventoChat, ResumenEventoChat } from "@/lib/chat-ia-datos"

export const MAX_TABLAS_CHAT = 2
const MAX_MESES_TABLA = 13
/** Filas como máximo: el resto se suma en "Otros". */
export const MAX_FILAS_TABLA = 15
export const MAX_COLUMNAS_TABLA = 13

export type FormatoTabla = "numero" | "pesos"

export interface TablaChat {
  titulo: string
  subtitulo: string
  formato: FormatoTabla
  /** Qué son las filas y las columnas ("salon" → la pantalla muestra el nombre con salonLabel). */
  filasPor: string
  columnasPor: string | null
  columnas: { clave: string; etiqueta: string }[]
  filas: { clave: string; etiqueta: string; valores: number[]; total: number }[]
  totalPorColumna: number[]
  total: number
  nota?: string
}

export interface Dimension<T> {
  /** Nombre de la dimensión ("salon", "mes"…). */
  por: string
  /** Encabezado de la primera columna cuando va en filas ("Salón", "Mes"…). */
  titulo: string
  clave: (item: T) => string
  etiqueta: (clave: string) => string
  /** Orden fijo de claves (las que no estén van al final, por total). Sin orden: por total, de mayor a menor. */
  orden?: string[]
  /** Mostrar las claves del orden aunque den cero (los meses de un período). */
  conVacias?: boolean
  /** Claves que van siempre al final ("Sin dato de quién"). */
  alFinal?: string[]
}

const redondear = (n: number) => Math.round(n * 100) / 100

function ordenar<T>(dim: Dimension<T>, totales: Map<string, number>): string[] {
  const fijas = (dim.orden ?? []).filter((c) => dim.conVacias || totales.has(c))
  const resto = [...totales.keys()]
    .filter((c) => !fijas.includes(c) && !dim.alFinal?.includes(c))
    .sort((a, b) => (totales.get(b) ?? 0) - (totales.get(a) ?? 0) || a.localeCompare(b))
  return [...fijas, ...resto, ...(dim.alFinal ?? []).filter((c) => totales.has(c))]
}

/** Cuenta (o suma) los ítems en una tabla de filas × columnas, con totales. */
export function armarTabla<T>(
  items: T[],
  {
    filas,
    columnas,
    valor,
    formato,
    titulo,
    subtitulo,
    nota,
  }: {
    filas: Dimension<T>
    columnas?: Dimension<T> | null
    valor: (item: T) => number
    formato: FormatoTabla
    titulo: string
    subtitulo: string
    nota?: string
  },
): TablaChat {
  const sumar = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v)
  const totFila = new Map<string, number>()
  const totCol = new Map<string, number>()
  const celdas = new Map<string, number>()
  for (const it of items) {
    const v = valor(it)
    const f = filas.clave(it)
    sumar(totFila, f, v)
    if (columnas) {
      const c = columnas.clave(it)
      sumar(totCol, c, v)
      sumar(celdas, `${f}\u0000${c}`, v)
    }
  }
  const clavesCol = columnas ? ordenar(columnas, totCol).slice(0, MAX_COLUMNAS_TABLA) : []
  let notaFinal = nota
  const filasOut = ordenar(filas, totFila).map((f) => ({
    clave: f,
    etiqueta: filas.etiqueta(f),
    valores: clavesCol.map((c) => redondear(celdas.get(`${f}\u0000${c}`) ?? 0)),
    total: redondear(totFila.get(f) ?? 0),
  }))
  // Muchas filas sin un orden propio (por ejemplo, muchos tipos de evento): las más
  // chicas se juntan en "Otros". Los meses y días van todos, en orden.
  if (!filas.orden && filasOut.length > MAX_FILAS_TABLA) {
    const resto = filasOut.splice(MAX_FILAS_TABLA - 1)
    filasOut.push({
      clave: "__otros",
      etiqueta: `Otros (${resto.length})`,
      valores: clavesCol.map((_, i) => redondear(resto.reduce((s, r) => s + r.valores[i], 0))),
      total: redondear(resto.reduce((s, r) => s + r.total, 0)),
    })
    notaFinal = [nota, `Las filas más chicas se juntaron en "Otros".`].filter(Boolean).join(" ")
  }
  return {
    titulo,
    subtitulo,
    formato,
    filasPor: filas.por,
    columnasPor: columnas ? columnas.por : null,
    columnas: clavesCol.map((c) => ({ clave: c, etiqueta: columnas!.etiqueta(c) })),
    filas: filasOut,
    totalPorColumna: clavesCol.map((c) => redondear(totCol.get(c) ?? 0)),
    total: redondear([...totFila.values()].reduce((s, v) => s + v, 0)),
    ...(notaFinal ? { nota: notaFinal } : {}),
  }
}

// ---- Fechas y meses ----

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

/** "2026-10" → "Octubre 2026". */
export function nombreMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number)
  return `${MESES[(m ?? 1) - 1] ?? mes} ${a}`
}

export function mesesEntre(desde: string, hasta: string): string[] {
  const out: string[] = []
  let [a, m] = desde.slice(0, 7).split("-").map(Number)
  const fin = hasta.slice(0, 7)
  while (out.length < MAX_MESES_TABLA) {
    const mes = `${a}-${String(m).padStart(2, "0")}`
    out.push(mes)
    if (mes >= fin) break
    m += 1
    if (m > 12) {
      m = 1
      a += 1
    }
  }
  return out
}

const fechaCorta = (iso: string) => {
  const [a, m, d] = iso.split("-")
  return `${Number(d)}/${Number(m)}/${a}`
}

/** Valida el período: fechas AAAA-MM-DD, en orden y de hasta 13 meses. */
export function periodoTablaValido(desde: string, hasta: string): string | null {
  const ok = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && Number.isFinite(new Date(`${f}T12:00:00Z`).getTime())
  if (!ok(desde) || !ok(hasta)) return "Las fechas van como AAAA-MM-DD."
  if (hasta < desde) return "La fecha de fin es anterior a la de inicio."
  if (mesesEntre(desde, hasta).slice(-1)[0] < hasta.slice(0, 7)) return `Como máximo ${MAX_MESES_TABLA} meses por tabla.`
  return null
}

// ---- Tabla de eventos ----

export const DIMENSIONES_EVENTOS = ["salon", "mes", "estado", "tipo"] as const
export type DimensionEventos = (typeof DIMENSIONES_EVENTOS)[number]
export const MEDIDAS_EVENTOS = ["cantidad", "invitados", "total", "cobrado", "saldo", "atrasado"] as const
export type MedidaEventos = (typeof MEDIDAS_EVENTOS)[number]

/** Lo que la tabla necesita de cada evento (sin nombres ni DNI). */
export interface EventoParaTabla {
  fecha: string
  /** Clave del salón ("Salon", "Casona"…). */
  salon: string
  estado: string
  tipo: string
  invitados: number
  total: number
  cobrado: number
  saldo: number
  atrasado: number
}

/** Mismo orden que SALONES_CHAT (lib/chat-ia-datos.ts). */
const ORDEN_SALONES = ["Quinta", "Casona", "Salon", "Salon 4", "Salon 5"]
const ESTADOS: Record<string, string> = {
  borrador: "Borrador",
  pendiente: "Pendiente",
  en_preparacion: "En preparación",
  completado: "Completado",
  cancelado: "Cancelado",
}

const MEDIDAS: Record<MedidaEventos, { titulo: string; formato: FormatoTabla; valor: (e: EventoParaTabla) => number }> = {
  cantidad: { titulo: "Cantidad de eventos", formato: "numero", valor: () => 1 },
  invitados: { titulo: "Invitados", formato: "numero", valor: (e) => e.invitados },
  total: { titulo: "Total vendido", formato: "pesos", valor: (e) => e.total },
  cobrado: { titulo: "Cobrado", formato: "pesos", valor: (e) => e.cobrado },
  saldo: { titulo: "Falta cobrar", formato: "pesos", valor: (e) => e.saldo },
  atrasado: { titulo: "Cuotas atrasadas", formato: "pesos", valor: (e) => e.atrasado },
}

/** De la fila de la base y su resumen (lib/chat-ia-datos.ts) a lo que usa la tabla. */
export function eventoParaTabla(fila: FilaEventoChat, r: ResumenEventoChat): EventoParaTabla {
  return {
    fecha: r.fecha,
    salon: String(fila.salon ?? "").trim(),
    estado: r.estado,
    tipo: r.tipoEvento.trim(),
    invitados: r.invitados,
    total: r.montoTotal ?? 0,
    cobrado: r.cobrado,
    saldo: r.saldoPendiente ?? 0,
    atrasado: r.montoAtrasado,
  }
}

function dimensionEventos(por: DimensionEventos, meses: string[]): Dimension<EventoParaTabla> {
  switch (por) {
    case "salon":
      // La pantalla cambia la clave por el nombre configurado (salonLabel).
      return { por, titulo: "Salón", clave: (e) => e.salon || "Sin salón", etiqueta: (c) => (c === "Salon" ? "Salón" : c), orden: ORDEN_SALONES }
    case "mes": {
      const variosAnios = new Set(meses.map((m) => m.slice(0, 4))).size > 1
      return {
        por,
        titulo: "Mes",
        clave: (e) => e.fecha.slice(0, 7),
        etiqueta: (c) => {
          const [a, m] = c.split("-").map(Number)
          return `${MESES_CORTOS[(m ?? 1) - 1] ?? c}${variosAnios ? ` ${String(a).slice(2)}` : ""}`
        },
        orden: meses,
        conVacias: true,
      }
    }
    case "estado":
      return { por, titulo: "Estado", clave: (e) => e.estado || "sin_estado", etiqueta: (c) => ESTADOS[c] ?? "Sin estado", orden: Object.keys(ESTADOS) }
    case "tipo":
      return {
        por,
        titulo: "Tipo",
        clave: (e) => e.tipo.toLowerCase() || "sin_tipo",
        etiqueta: (c) => (c === "sin_tipo" ? "Sin tipo" : c.charAt(0).toUpperCase() + c.slice(1)),
      }
  }
}

/**
 * Tabla de eventos con fecha entre desde y hasta: filas y columnas por salón,
 * mes, estado o tipo; cada celda es la cantidad de eventos o una suma
 * (invitados, total vendido, cobrado, falta cobrar, atrasado).
 */
export function tablaEventos(
  eventos: EventoParaTabla[],
  {
    desde,
    hasta,
    filas,
    columnas,
    medida,
    salon,
  }: { desde: string; hasta: string; filas: DimensionEventos; columnas: DimensionEventos | null; medida: MedidaEventos; salon?: string },
): TablaChat {
  const meses = mesesEntre(desde, hasta)
  const enPeriodo = eventos.filter((e) => e.fecha >= desde && e.fecha <= hasta && (!salon || e.salon === salon))
  const m = MEDIDAS[medida]
  const borradores = enPeriodo.filter((e) => e.estado === "borrador").length
  const sinPrecio = medida === "total" || medida === "saldo" ? enPeriodo.filter((e) => e.total === 0).length : 0
  const nota = [
    borradores > 0 && filas !== "estado" && columnas !== "estado" ? `Incluye ${borradores} ${borradores === 1 ? "borrador" : "borradores"}.` : "",
    sinPrecio > 0 ? `${sinPrecio} ${sinPrecio === 1 ? "evento no tiene" : "eventos no tienen"} precio cargado (cuentan $0).` : "",
  ]
    .filter(Boolean)
    .join(" ")
  return armarTabla(enPeriodo, {
    filas: dimensionEventos(filas, meses),
    columnas: columnas ? dimensionEventos(columnas, meses) : null,
    valor: m.valor,
    formato: m.formato,
    titulo: `${m.titulo} por ${dimensionEventos(filas, meses).titulo.toLowerCase()}${columnas ? ` y ${dimensionEventos(columnas, meses).titulo.toLowerCase()}` : ""}`,
    subtitulo: `Eventos del ${fechaCorta(desde)} al ${fechaCorta(hasta)}${salon ? `, solo ${salon === "Salon" ? "Salón" : salon}` : ""}`,
    nota: nota || undefined,
  })
}

// ---- Tabla del Historial de Actividad ----

export const DIMENSIONES_ACTIVIDAD = ["persona", "tema", "dia"] as const
export type DimensionActividad = (typeof DIMENSIONES_ACTIVIDAD)[number]

/** Un registro del historial ya leído (lib/chat-ia-actividad.ts), con su día de Argentina. */
export interface ActividadParaTabla {
  /** AAAA-MM-DD en Argentina. */
  dia: string
  quien: string
  tipo: string
}

function dimensionActividad(por: DimensionActividad, dias: string[]): Dimension<ActividadParaTabla> {
  switch (por) {
    case "persona":
      return { por, titulo: "Quién", clave: (a) => a.quien, etiqueta: (c) => c, alFinal: ["Sin dato de quién"] }
    case "tema":
      return { por, titulo: "Tema", clave: (a) => a.tipo, etiqueta: (c) => c }
    case "dia":
      return {
        por,
        titulo: "Día",
        clave: (a) => a.dia,
        etiqueta: (c) => {
          const [, m, d] = c.split("-")
          return `${Number(d)}/${Number(m)}`
        },
        orden: dias,
        conVacias: true,
      }
  }
}

function diasEntre(desde: string, hasta: string): string[] {
  const out: string[] = []
  for (let t = new Date(`${desde}T12:00:00Z`).getTime(); out.length < 31; t += 86_400_000) {
    const d = new Date(t).toISOString().slice(0, 10)
    if (d > hasta) break
    out.push(d)
  }
  return out
}

/** Cantidad de registros del historial por persona, tema o día. */
export function tablaActividad(
  registros: ActividadParaTabla[],
  { desde, hasta, filas, columnas }: { desde: string; hasta: string; filas: DimensionActividad; columnas: DimensionActividad | null },
): TablaChat {
  const dias = diasEntre(desde, hasta)
  const f = dimensionActividad(filas, dias)
  const c = columnas ? dimensionActividad(columnas, dias) : null
  return armarTabla(registros, {
    filas: f,
    columnas: c,
    valor: () => 1,
    formato: "numero",
    titulo: `Actividad por ${f.titulo.toLowerCase()}${c ? ` y ${c.titulo.toLowerCase()}` : ""}`,
    subtitulo: desde === hasta ? `Historial de Actividad del ${fechaCorta(desde)}` : `Historial de Actividad del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`,
    nota: registros.some((r) => r.quien === "Sin dato de quién") ? 'El historial no guarda el perfil: "Sin dato de quién" son registros que no anotaron nombre.' : undefined,
  })
}

// ---- Lectura del historial del chat ----

const esNumero = (n: unknown) => typeof n === "number" && Number.isFinite(n)

/** Tablas leídas del historial; descarta lo que no tenga la forma esperada. */
export function tablasValidas(valor: unknown): TablaChat[] {
  if (!Array.isArray(valor)) return []
  return valor
    .filter((t): t is TablaChat => {
      if (!t || typeof t !== "object") return false
      const x = t as TablaChat
      return (
        typeof x.titulo === "string" &&
        typeof x.subtitulo === "string" &&
        (x.formato === "numero" || x.formato === "pesos") &&
        typeof x.filasPor === "string" &&
        Array.isArray(x.columnas) &&
        x.columnas.every((c) => c && typeof c.clave === "string" && typeof c.etiqueta === "string") &&
        Array.isArray(x.filas) &&
        x.filas.every(
          (f) =>
            f &&
            typeof f.clave === "string" &&
            typeof f.etiqueta === "string" &&
            Array.isArray(f.valores) &&
            f.valores.length === x.columnas.length &&
            f.valores.every(esNumero) &&
            esNumero(f.total),
        ) &&
        Array.isArray(x.totalPorColumna) &&
        x.totalPorColumna.length === x.columnas.length &&
        esNumero(x.total)
      )
    })
    .slice(0, MAX_TABLAS_CHAT)
}
