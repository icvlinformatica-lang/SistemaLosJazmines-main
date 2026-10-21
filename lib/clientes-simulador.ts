// Simulador "Armá tu fiesta" — vista de Clientes (prototipo, perfil "clientes").
//
// La persona arma su fiesta paso a paso (festejo, salón, adentro o al aire
// libre si el salón tiene las dos, fecha, invitados, menú, barra y detalles) y
// ve el total en vivo. La cuenta es la MISMA del
// cotizador del vendedor: armarCotizacion (lib/cotizador-salon.ts) con los
// precios por unidad del catálogo por salón (lib/catalogo-cotizador-servidor.ts).
// El servidor recalcula con costos reales en /api/clientes/simular.
//
// Lógica pura (sin "use client" ni base): la usan la pantalla /clientes, las
// rutas /api/clientes/* y scripts/test-clientes-simulador.cjs.
//
// Reglas de lo que ve un cliente:
// - Nunca costos, ganancias, tarifas ni márgenes (clavesProhibidas lo controla
//   en cada respuesta de /api/clientes/*).
// - Solo salones listos: con precio de salón y capacidad cargados.
// - Nada en $0: un plato, una barra o un adicional sin precio no se muestra
//   (salvo lo que ya viene incluido con el salón, que se lista como "Incluido").
// - De las fechas ocupadas, solo la fecha: nada del evento.
// - Del precio, la pantalla muestra solo el total (pedido de Rodri del
//   19/10/2026): ni lo de cada cosa, ni los rubros, ni por invitado. Los
//   precios por unidad igual llegan al navegador, para sumar en vivo.

import {
  MAX_BARRAS,
  PASOS_MENU,
  armarCotizacion,
  esBebidaDeMesa,
  resolverDia,
  type AplicaRegla,
  type DiaCotizado,
  type EntradaCotizacionSalon,
  type FechaEspecial,
  type ReglaRecargo,
  type ResultadoCotizacionSalon,
} from "./cotizador-salon"
import { servicioCorrespondeAlAnio } from "./tarifario-cotizador"
import { numeroWhatsApp } from "./telefono-whatsapp"

/** Misma lista que el cotizador del vendedor (los textos se guardan tal cual). */
export const TIPOS_EVENTO_CLIENTE = ["Casamiento", "Cumpleaños de 15", "Empresarial", "Cumpleaños", "Bautismo", "Otro"] as const

/** Días que se congela el precio después de dejar los datos (decisión del 18/10/2026).
 *  Desde el 19/10/2026 la vista de Clientes no lo muestra (MOSTRAR_PRECIO_CONGELADO). */
export const DIAS_PRECIO_CONGELADO = 7

/** Las formas de pago que ofrece Los Jazmines (dicho por Rodri el 19/10/2026).
 *  La vista de Clientes las nombra junto al precio: es un precio sugerido y el
 *  final depende de cuál elija el cliente con un vendedor. */
export const FORMAS_DE_PAGO = ["Cuotas fijas", "Cuotas con IPC", "Pago total"] as const

/** "cuotas fijas, cuotas con IPC o pago total", para ir en medio de una frase. */
export function formasDePagoEnFrase(): string {
  const partes = FORMAS_DE_PAGO.map((f) => f.charAt(0).toLocaleLowerCase("es") + f.slice(1))
  return partes.length > 1 ? `${partes.slice(0, -1).join(", ")} o ${partes[partes.length - 1]}` : partes.join("")
}

/** Hasta cuándo se muestran fechas en el calendario. */
export const MESES_CALENDARIO = 24

export { MAX_BARRAS }

// ── Los pasos ───────────────────────────────────────────────────────────────

/** Todos los pasos, en orden. "lugar" (¿adentro o al aire libre?) va solo con
 *  un salón que tiene las dos cosas (hoy, la Casona): ver pasosCliente. */
export const PASOS_CLIENTE = [
  { id: "festejo", nombre: "Festejo" },
  { id: "salon", nombre: "Salón" },
  { id: "lugar", nombre: "Lugar" },
  { id: "fecha", nombre: "Fecha" },
  { id: "invitados", nombre: "Invitados" },
  { id: "menu", nombre: "Menú" },
  { id: "barra", nombre: "Barra" },
  { id: "detalles", nombre: "Detalles" },
] as const
export type IdPasoCliente = (typeof PASOS_CLIENTE)[number]["id"]
export type PasoCliente = (typeof PASOS_CLIENTE)[number]

/** Los pasos que se recorren: sin "lugar" si el salón no tiene aire libre
 *  (o todavía no se eligió salón). */
export function pasosCliente(conLugar: boolean): PasoCliente[] {
  return PASOS_CLIENTE.filter((p) => conLugar || p.id !== "lugar")
}

/**
 * En qué lugar de `pasos` está el paso `id`. Si no está (el paso "lugar" con
 * un salón cerrado), el del último paso anterior que sí está: así, al cambiar
 * de salón, lo ya recorrido sigue prendido en la guirnalda.
 */
export function indicePaso(pasos: ReadonlyArray<{ id: string }>, id: IdPasoCliente): number {
  const orden = PASOS_CLIENTE.findIndex((p) => p.id === id)
  for (let i = orden; i >= 0; i--) {
    const j = pasos.findIndex((p) => p.id === PASOS_CLIENTE[i].id)
    if (j >= 0) return j
  }
  return 0
}

/** Si el paso `a` va después que `b` en el recorrido completo. */
export function pasoDespuesDe(a: IdPasoCliente, b: IdPasoCliente): boolean {
  return PASOS_CLIENTE.findIndex((p) => p.id === a) > PASOS_CLIENTE.findIndex((p) => p.id === b)
}

// ── Catálogo para clientes ──────────────────────────────────────────────────

export interface SalonCliente {
  /** Clave guardada ("Quinta", "Casona"…). */
  salon: string
  /** Nombre para mostrar (Configuración de cajas, o la clave). */
  nombre: string
  capacidadMaxima: number
  precioSalon: number
  recargoSabado: ReglaRecargo
  menu: Array<{ recetaId: string; nombre: string; categoria: string | null; precioPorPorcion: number }>
  barras: Array<{
    id: string
    nombre: string
    /** Nombres de los tragos (sin precio por trago). */
    cocteles: string[]
    precioPorAdulto: number
    tragosPorAdulto: number
    bebidaDeMesa: boolean
  }>
  servicios: Array<{ servicioId: string; nombre: string; categoria: string; unidad: string; precio: number; incluido: boolean }>
  personal: Array<{ funcion: string; cadaNInvitados: number; minimo: number; aplica: AplicaRegla; precioPorPersona: number }>
}

export interface CatalogoClientes {
  salones: SalonCliente[]
  fechasEspeciales: FechaEspecial[]
}

/** Lo que arma armarCotizadorPorSalon (solo precios). Tipo propio para no
 *  depender de un archivo de servidor desde la pantalla. */
export interface SalonConPreciosEntrada {
  salon: string
  capacidadMaxima: number | null
  precioSalon: number
  recargoSabado: ReglaRecargo
  menu: Array<{ recetaId: string; nombre: string; categoria?: string | null; precioPorPorcion: number }>
  barras: Array<{ id: string; nombre: string; coctelesIncluidos: string[]; precioPorAdulto: number; tragosPorAdulto: number }>
  servicios: Array<{ servicioId: string; precio: number; incluido: boolean }>
  personal: Array<{ funcion: string; cadaNInvitados: number; minimo: number; aplica: AplicaRegla; precioPorPersona: number }>
}

/** Un salón se muestra solo si tiene precio de salón y capacidad cargados.
 *  (Hoy, 18/10/2026: Casona y Quinta. Los otros tres no tienen ni costo de
 *  salón ni capacidad, así que cotizarían de menos.) */
export function salonListoParaClientes(s: { precioSalon: number; capacidadMaxima: number | null }): boolean {
  return (Number(s.precioSalon) || 0) > 0 && (Number(s.capacidadMaxima) || 0) > 0
}

/** Los tres salones de fiesta, como los conocen los clientes y en el orden en
 *  que los nombró el dueño el 18/10/2026. Solo para la vista de Clientes:
 *  adentro del sistema el nombre sigue saliendo de Configuración. */
const SALONES_COMERCIALES: ReadonlyArray<{ clave: string; nombre: string }> = [
  { clave: "Salon", nombre: "Jazmines Salón" },
  { clave: "Casona", nombre: "Jazmines Casona" },
  { clave: "Quinta", nombre: "Jazmines Quinta" },
]

/** Nombre visible de un salón para un cliente: el de Configuración de cajas si
 *  le pusieron uno propio; si no, su nombre comercial ("Jazmines Casona"), o
 *  el de siempre para un salón nuevo. */
export function nombreSalonCliente(salon: string, nombres?: Map<string, string> | Record<string, string> | null): string {
  const custom = nombres instanceof Map ? nombres.get(salon) : nombres?.[salon]
  // salonesConfigurados() devuelve la clave cuando no hay nombre propio.
  if (typeof custom === "string" && custom.trim() && custom.trim() !== salon) return custom.trim()
  const comercial = SALONES_COMERCIALES.find((s) => s.clave === salon)
  if (comercial) return comercial.nombre
  return salon === "Salon" ? "Salón" : salon
}

/** En qué lugar va el salón en la lista para clientes: primero los tres de
 *  fiesta, en ese orden; cualquier otro, después (en el orden en que vino). */
export function ordenSalonCliente(salon: string): number {
  const i = SALONES_COMERCIALES.findIndex((s) => s.clave === salon)
  return i < 0 ? SALONES_COMERCIALES.length : i
}

const SIGLAS = /\b(dj|led|vip|xv)\b/gi

/** Nombre prolijo para un cliente: sin el año del final ("FOTOGRAFIA 2026" →
 *  "Fotografia"), en minúscula con la primera letra en mayúscula, y las siglas
 *  conocidas (DJ, LED) en mayúscula. Los acentos quedan como estén cargados. */
export function nombreParaCliente(nombre: string | null | undefined): string {
  const sinAnio = String(nombre ?? "")
    .replace(/\s+20\d{2}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
  if (!sinAnio) return ""
  const minuscula = sinAnio.toLocaleLowerCase("es")
  return (minuscula.charAt(0).toLocaleUpperCase("es") + minuscula.slice(1)).replace(SIGLAS, (m) => m.toUpperCase())
}

/** Igual que nombreParaCliente, pero para ir en medio de una frase
 *  ("Incluye mesas…; DJ, sonido…"): la primera letra en minúscula, salvo que
 *  la primera palabra sea una sigla. */
export function nombreEnFrase(nombre: string | null | undefined): string {
  const n = nombreParaCliente(nombre)
  const primera = n.split(/[\s,]/)[0] ?? ""
  if (new RegExp(`^${SIGLAS.source}$`, "i").test(primera)) return n
  return n.charAt(0).toLocaleLowerCase("es") + n.slice(1)
}

/**
 * Catálogo saneado para la vista de Clientes. Recibe lo mismo que usa el
 * vendedor (solo precios) más los nombres de servicios y cócteles, y devuelve
 * solo salones listos, sin nada en $0 y sin ids de cócteles.
 */
export function armarCatalogoClientes(entrada: {
  salones: SalonConPreciosEntrada[]
  servicios: Array<{ id: string; nombre: string; categoria: string; unidad: string }>
  cocteles: Array<{ id: string; nombre: string }>
  nombresSalones?: Map<string, string> | Record<string, string> | null
  fechasEspeciales?: FechaEspecial[]
}): CatalogoClientes {
  const coctel = new Map(entrada.cocteles.map((c) => [c.id, c.nombre]))
  const servicio = new Map(entrada.servicios.map((s) => [s.id, s]))
  const salones: SalonCliente[] = []
  for (const s of entrada.salones) {
    if (!salonListoParaClientes(s)) continue
    const barras = s.barras
      .filter((b) => (Number(b.precioPorAdulto) || 0) > 0)
      .map((b) => ({
        id: b.id,
        nombre: nombreParaCliente(b.nombre),
        cocteles: esBebidaDeMesa(b.nombre)
          ? []
          : b.coctelesIncluidos
              .map((id) => coctel.get(id))
              .filter((n): n is string => !!n)
              .map(nombreParaCliente),
        precioPorAdulto: Math.round(Number(b.precioPorAdulto) || 0),
        tragosPorAdulto: Math.max(0, Number(b.tragosPorAdulto) || 0),
        bebidaDeMesa: esBebidaDeMesa(b.nombre),
      }))
    // La bebida de mesa va primero (como en el cotizador del vendedor).
    barras.sort((a, b) => Number(b.bebidaDeMesa) - Number(a.bebidaDeMesa))
    salones.push({
      salon: s.salon,
      nombre: nombreSalonCliente(s.salon, entrada.nombresSalones),
      capacidadMaxima: Math.floor(Number(s.capacidadMaxima) || 0),
      precioSalon: Math.round(Number(s.precioSalon) || 0),
      recargoSabado: s.recargoSabado,
      menu: s.menu
        .filter((m) => (Number(m.precioPorPorcion) || 0) > 0)
        .map((m) => ({
          recetaId: m.recetaId,
          nombre: nombreParaCliente(m.nombre),
          categoria: m.categoria ?? null,
          precioPorPorcion: Math.round(Number(m.precioPorPorcion) || 0),
        })),
      barras,
      servicios: s.servicios
        .map((sv) => {
          const info = servicio.get(sv.servicioId)
          if (!info) return null
          return {
            servicioId: sv.servicioId,
            // El nombre ORIGINAL: servicioCorrespondeAlAnio lee el año del final.
            nombre: info.nombre,
            categoria: info.categoria,
            unidad: info.unidad || "Fijo",
            precio: Math.round(Number(sv.precio) || 0),
            incluido: !!sv.incluido,
          }
        })
        .filter((sv): sv is NonNullable<typeof sv> => !!sv && (sv.incluido || sv.precio > 0)),
      personal: s.personal.map((p) => ({
        funcion: p.funcion,
        cadaNInvitados: Number(p.cadaNInvitados) || 0,
        minimo: Number(p.minimo) || 0,
        aplica: p.aplica,
        precioPorPersona: Math.round(Number(p.precioPorPersona) || 0),
      })),
    })
  }
  // En el orden en que el dueño nombra los salones (sort es estable: los demás
  // quedan como vinieron).
  salones.sort((a, b) => ordenSalonCliente(a.salon) - ordenSalonCliente(b.salon))
  return { salones, fechasEspeciales: entrada.fechasEspeciales ?? [] }
}

/** Servicios del salón que se pueden ofrecer para esa fecha (los que terminan
 *  en un año, solo para ese año: ver servicioCorrespondeAlAnio). */
export function serviciosParaFecha(salon: SalonCliente, fecha: string | null | undefined): SalonCliente["servicios"] {
  return salon.servicios.filter((s) => servicioCorrespondeAlAnio(s.nombre, fecha || ""))
}

// ── Lo que elige la persona y la cuenta ─────────────────────────────────────

export interface SeleccionCliente {
  adultos: number
  ninos: number
  /** Un plato por paso del menú (ver elegirPlato). */
  recetas: string[]
  /** Hasta MAX_BARRAS. */
  barraIds: string[]
  /** servicioId → cantidad (1 para los fijos). */
  servicios: Record<string, number>
}

/** La entrada de armarCotizacion, armada IGUAL que en /vendedor/cotizar:
 *  solo precios, servicios del año del evento y los incluidos del salón. */
export function entradaCotizacionCliente(
  salon: SalonCliente,
  sel: SeleccionCliente,
  fecha: string | null | undefined,
  dia: DiaCotizado | null,
): EntradaCotizacionSalon {
  const servicios = serviciosParaFecha(salon, fecha)
  return {
    adultos: sel.adultos,
    ninos: sel.ninos,
    capacidadMaxima: salon.capacidadMaxima,
    salon: { precio: salon.precioSalon },
    recetas: salon.menu
      .filter((m) => sel.recetas.includes(m.recetaId))
      .map((m) => ({ id: m.recetaId, nombre: m.nombre, categoria: m.categoria, precio: m.precioPorPorcion })),
    barra: null,
    barras: salon.barras
      .filter((b) => sel.barraIds.includes(b.id))
      .map((b) => ({ id: b.id, nombre: b.nombre, tragosPorAdulto: b.tragosPorAdulto, precio: b.precioPorAdulto })),
    servicios: servicios
      .filter((s) => s.incluido || s.servicioId in sel.servicios)
      .map((s) => ({
        servicioId: s.servicioId,
        nombre: s.nombre,
        unidad: s.unidad,
        cantidad: sel.servicios[s.servicioId] ?? 1,
        incluido: s.incluido,
        precio: s.precio,
      })),
    personal: salon.personal.map((p) => ({
      funcion: p.funcion,
      cadaNInvitados: p.cadaNInvitados,
      minimo: p.minimo,
      aplica: p.aplica,
      precio: p.precioPorPersona,
    })),
    dia,
  }
}

/** Día y total de lo elegido, con la misma cuenta que el vendedor. */
export function cotizarCliente(
  salon: SalonCliente,
  sel: SeleccionCliente,
  fecha: string | null | undefined,
  fechasEspeciales: FechaEspecial[],
): { dia: DiaCotizado; resultado: ResultadoCotizacionSalon } {
  const dia = resolverDia(fecha, salon.salon, salon.recargoSabado, fechasEspeciales)
  return { dia, resultado: armarCotizacion(entradaCotizacionCliente(salon, sel, fecha, dia)) }
}

/** Pasos del menú del salón, en orden (entrada, plato principal, postre y
 *  después cualquier otra categoría), con sus platos. */
export function pasosDelMenu(menu: SalonCliente["menu"]): Array<{ categoria: string; titulo: string; platos: SalonCliente["menu"] }> {
  const grupos = new Map<string, SalonCliente["menu"]>()
  for (const m of menu) {
    const clave = m.categoria || "Otros platos"
    grupos.set(clave, [...(grupos.get(clave) ?? []), m])
  }
  const orden = PASOS_MENU.map((p) => p.categoria as string)
  const titulo = (c: string) => PASOS_MENU.find((p) => p.categoria === c)?.titulo ?? c
  return [...grupos.entries()]
    .sort(([a], [b]) => {
      const ia = orden.indexOf(a)
      const ib = orden.indexOf(b)
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      return a.localeCompare(b, "es")
    })
    .map(([categoria, platos]) => ({ categoria, titulo: titulo(categoria), platos }))
}

/** Los platos elegidos en el orden del menú (entrada, principal, postre…),
 *  no en el orden en que se tocaron. */
export function platosEnOrden(menu: SalonCliente["menu"], elegidos: string[]): SalonCliente["menu"] {
  return pasosDelMenu(menu).flatMap((p) => p.platos.filter((m) => elegidos.includes(m.recetaId)))
}

/** Elegir un plato: reemplaza al otro plato del mismo paso; tocar el elegido
 *  lo saca. (El vendedor puede promediar varias opciones por paso; acá, para
 *  que sea simple, va uno por paso.) */
export function elegirPlato(elegidos: string[], recetaId: string, menu: SalonCliente["menu"]): string[] {
  if (elegidos.includes(recetaId)) return elegidos.filter((id) => id !== recetaId)
  const plato = menu.find((m) => m.recetaId === recetaId)
  if (!plato) return elegidos
  const mismoPaso = new Set(menu.filter((m) => (m.categoria || "") === (plato.categoria || "")).map((m) => m.recetaId))
  return [...elegidos.filter((id) => !mismoPaso.has(id)), recetaId]
}

/** Elegir o sacar una barra, respetando el máximo. */
export function elegirBarra(elegidas: string[], barraId: string): string[] {
  if (elegidas.includes(barraId)) return elegidas.filter((id) => id !== barraId)
  if (elegidas.length >= MAX_BARRAS) return elegidas
  return [...elegidas, barraId]
}

// ── Lo que se le devuelve al cliente después de calcular ────────────────────

export interface ResumenSimulacion {
  total: number
  comensales: number
  /** Total / comensales, redondeado. 0 sin invitados. */
  porInvitado: number
  rubros: Array<{ clave: string; nombre: string; precio: number }>
  servicios: Array<{ servicioId: string; nombre: string; unidad: string; cantidad: number; incluido: boolean; precioTotal: number }>
  personal: Array<{ funcion: string; cantidad: number }>
  recargo: { nombre: string; monto: number } | null
  dia: { tipo: string; etiqueta: string }
  /** Avisos con el texto que puede leer un cliente (el "de vendedor"). */
  avisos: string[]
  superaCapacidad: boolean
}

/** "Plataforma 360 (2 horas)", "Letras luminosas (3)" o solo el nombre. */
export function servicioConCantidad(s: { nombre: string; unidad: string; cantidad: number }, enFrase = false): string {
  const nombre = enFrase ? nombreEnFrase(s.nombre) : nombreParaCliente(s.nombre)
  if (s.unidad === "Por Hora") return `${nombre} (${s.cantidad} ${s.cantidad === 1 ? "hora" : "horas"})`
  if (s.unidad === "Por Cantidad" && s.cantidad > 1) return `${nombre} (${s.cantidad})`
  return nombre
}

/** Solo precios: saca costos y tarifas de un resultado de armarCotizacion. */
export function resumenParaCliente(resultado: ResultadoCotizacionSalon, dia: Pick<DiaCotizado, "tipo" | "etiqueta">): ResumenSimulacion {
  const comensales = resultado.comensales
  return {
    total: resultado.total,
    comensales,
    porInvitado: comensales > 0 ? Math.round(resultado.total / comensales) : 0,
    rubros: resultado.rubros.map((r) => ({ clave: r.clave, nombre: r.nombre, precio: r.precio })),
    servicios: resultado.servicios.map((s) => ({
      servicioId: s.servicioId,
      nombre: nombreParaCliente(s.nombre),
      unidad: s.unidad,
      cantidad: s.cantidad,
      incluido: s.incluido,
      precioTotal: s.precioTotal,
    })),
    personal: resultado.personal.map((p) => ({ funcion: p.funcion, cantidad: p.cantidad })),
    recargo: resultado.recargo ? { nombre: resultado.recargo.nombre, monto: resultado.recargo.monto } : null,
    dia: { tipo: dia.tipo, etiqueta: dia.etiqueta },
    avisos: resultado.avisos.map((a) => a.textoVendedor),
    superaCapacidad: resultado.superaCapacidad,
  }
}

const CLAVE_PROHIBIDA = /costo|ganancia|margen|tarifa/i

/** Claves que NUNCA pueden llegarle a un cliente (costos, ganancias, tarifas,
 *  márgenes), con su ruta. Vacío = respuesta limpia. Mira solo las claves,
 *  no los valores (un servicio puede llamarse como quiera). */
export function clavesProhibidas(valor: unknown, ruta = "$"): string[] {
  if (Array.isArray(valor)) return valor.flatMap((v, i) => clavesProhibidas(v, `${ruta}[${i}]`))
  if (!valor || typeof valor !== "object") return []
  const out: string[] = []
  for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
    if (CLAVE_PROHIBIDA.test(clave)) out.push(`${ruta}.${clave}`)
    out.push(...clavesProhibidas(v, `${ruta}.${clave}`))
  }
  return out
}

// ── Fechas ──────────────────────────────────────────────────────────────────

const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/

function aFecha(fecha: string): Date | null {
  const m = FORMATO_FECHA.exec(fecha)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 ? d : null
}

function aTexto(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

/** "YYYY-MM-DD" + días, sin pasar por la zona horaria. "" si la fecha no vale. */
export function sumarDias(fecha: string, dias: number): string {
  const d = aFecha(fecha)
  if (!d) return ""
  d.setUTCDate(d.getUTCDate() + Math.trunc(Number(dias) || 0))
  return aTexto(d)
}

/** "YYYY-MM-DD" + meses (si el día no existe en ese mes, el último del mes). */
export function sumarMeses(fecha: string, meses: number): string {
  const d = aFecha(fecha)
  if (!d) return ""
  const objetivo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + Math.trunc(Number(meses) || 0), 1))
  const ultimo = new Date(Date.UTC(objetivo.getUTCFullYear(), objetivo.getUTCMonth() + 1, 0)).getUTCDate()
  objetivo.setUTCDate(Math.min(d.getUTCDate(), ultimo))
  return aTexto(objetivo)
}

/** Desde hoy hasta MESES_CALENDARIO meses: el rango de fechas que se ofrecen. */
export function rangoCalendario(hoy: string, meses = MESES_CALENDARIO): { desde: string; hasta: string } {
  return { desde: hoy, hasta: sumarMeses(hoy, meses) }
}

export const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

/** "sábado 14 de noviembre de 2026" (sin la zona horaria de por medio). */
export function fechaLarga(fecha: string | null | undefined, conAnio = true): string {
  const d = aFecha(String(fecha ?? ""))
  if (!d) return ""
  const base = `${DIAS_SEMANA[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
  return conAnio ? `${base} de ${d.getUTCFullYear()}` : base
}

/** Celdas de un mes para un calendario que arranca el LUNES (así el fin de
 *  semana queda junto, a la derecha). null = celda vacía antes del día 1. */
export function celdasDelMes(anio: number, mes0: number): Array<string | null> {
  const primero = new Date(Date.UTC(anio, mes0, 1))
  const dias = new Date(Date.UTC(anio, mes0 + 1, 0)).getUTCDate()
  const corrimiento = (primero.getUTCDay() + 6) % 7 // lunes = 0
  const celdas: Array<string | null> = Array.from({ length: corrimiento }, () => null)
  for (let d = 1; d <= dias; d++) celdas.push(aTexto(new Date(Date.UTC(anio, mes0, d))))
  return celdas
}

// ── Fechas ocupadas ─────────────────────────────────────────────────────────

/** Fechas ocupadas de cada salón pedido (ordenadas y sin repetir). De los
 *  eventos llega solo salón y fecha; acá ni siquiera eso sale del servidor
 *  más que como lista de fechas. */
export function ocupadasPorSalon(
  filas: Array<{ salon: string | null; fecha: string | null }>,
  salones: string[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const s of salones) out[s] = []
  for (const f of filas) {
    if (!f.salon || !(f.salon in out) || !FORMATO_FECHA.test(String(f.fecha ?? ""))) continue
    out[f.salon].push(String(f.fecha))
  }
  for (const s of salones) out[s] = [...new Set(out[s])].sort()
  return out
}

/** Otros salones listos que están libres ese día (para sugerir un cambio). */
export function salonesLibresEseDia(
  fecha: string,
  salones: string[],
  ocupadas: Record<string, string[]>,
  excepto?: string | null,
): string[] {
  return salones.filter((s) => s !== excepto && !(ocupadas[s] ?? []).includes(fecha))
}

// ── Plata y WhatsApp ────────────────────────────────────────────────────────

const PESOS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 })

export function formatoPesos(n: number): string {
  return PESOS.format(Math.round(Number(n) || 0))
}

/** El WhatsApp de Los Jazmines, adonde el cliente manda su fiesta (dicho por
 *  Rodri el 19/10/2026). linkWhatsAppLosJazmines lo pasa al formato de wa.me. */
export const WHATSAPP_LOS_JAZMINES = "11 4060-8208"

/** "a, b y c". (clientes-maqueta tiene uno igual, pero importa de acá.) */
function enFrase(partes: string[]): string {
  if (partes.length <= 1) return partes.join("")
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`
}

/** Qué se festeja, dicho por quien escribe: "mi casamiento", "un bautismo"… */
export function queSeFesteja(tipoEvento: string | null | undefined): string {
  switch (tipoEvento) {
    case "Casamiento":
      return "mi casamiento"
    case "Cumpleaños":
      return "mi cumpleaños"
    // Estos los suelen escribir los padres: sin "mi".
    case "Cumpleaños de 15":
      return "un cumpleaños de 15"
    case "Bautismo":
      return "un bautismo"
    case "Empresarial":
      return "un evento empresarial"
    default:
      return "una fiesta"
  }
}

/**
 * El mensaje que el cliente le manda a Los Jazmines por WhatsApp con todo lo
 * que armó (pedido de Rodri del 19/10/2026): quién es, qué festeja, cuándo,
 * dónde y para cuántos, con o sin catering (y qué platos), la barra, los
 * servicios que sumó y el precio sugerido. Nunca el precio de cada cosa. Cierra
 * preguntando por las formas de pago, porque de eso depende el precio final.
 */
export function textoWhatsAppCliente(d: {
  /** El de "Nombre y apellido", tal cual lo escribió. */
  nombre?: string | null
  tipoEvento?: string | null
  fecha?: string | null
  salon?: string | null
  /** "al aire libre" / "adentro", si el salón tiene las dos. */
  lugar?: string | null
  adultos?: number | null
  ninos?: number | null
  conCatering?: boolean | null
  /** Los platos elegidos, como se ven en la pantalla. */
  platos?: string[]
  barras?: string[]
  /** Los adicionales que sumó (no lo que ya viene con el salón), con su cantidad. */
  servicios?: string[]
  total?: number | null
}): string {
  const lineas: string[] = []
  const nombre = (d.nombre ?? "").trim().replace(/\s+/g, " ")
  lineas.push(nombre ? `Hola, soy ${nombre}.` : "Hola.")

  const adultos = Math.max(0, Math.round(d.adultos ?? 0))
  const ninos = Math.max(0, Math.round(d.ninos ?? 0))
  const invitados = adultos + ninos
  const cuantos =
    invitados === 0
      ? ""
      : ninos > 0
        ? `para ${invitados} invitados (${adultos} ${adultos === 1 ? "adulto" : "adultos"} y ${ninos} ${ninos === 1 ? "chico" : "chicos"})`
        : `para ${invitados} ${invitados === 1 ? "invitado" : "invitados"}`
  let fiesta = `Quiero festejar ${queSeFesteja(d.tipoEvento)}`
  if (d.fecha && fechaLarga(d.fecha)) fiesta += ` el ${fechaLarga(d.fecha)}`
  if (d.salon) fiesta += ` en ${d.salon}${d.lugar ? `, ${d.lugar}` : ""}`
  if (cuantos) fiesta += `${d.salon && d.lugar ? "," : ""} ${cuantos}`
  lineas.push(`${fiesta}.`)

  const platos = (d.platos ?? []).filter(Boolean)
  if (d.conCatering === false) lineas.push("Me gustaría sin catering.")
  else if (d.conCatering) {
    lineas.push(
      platos.length ? `Me gustaría con catering: ${enFrase(platos.map(nombreEnFrase))}.` : "Me gustaría con catering (todavía no elegí los platos).",
    )
  }
  const barras = (d.barras ?? []).filter(Boolean)
  if (barras.length) lineas.push(`Barra: ${enFrase(barras.map(nombreEnFrase))}.`)
  // Uno por renglón: los nombres pueden traer comas ("DJ, sonido y luces").
  const servicios = (d.servicios ?? []).filter(Boolean)
  if (servicios.length) lineas.push(["Y los siguientes servicios:", ...servicios.map((s) => `- ${s}`)].join("\n"))

  if (d.total) lineas.push(`El simulador me dio un precio sugerido de ${formatoPesos(d.total)}.`)
  lineas.push("¿Me cuentan las formas de pago para avanzar? ¡Gracias!")
  return lineas.join("\n")
}

/** Link de WhatsApp. Sin número abre WhatsApp para elegir a quién mandarlo. */
export function linkWhatsApp(texto: string, numero?: string | null): string {
  const n = String(numero ?? "").replace(/\D/g, "")
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`
}

/** Link de WhatsApp al número de Los Jazmines, con el mensaje ya escrito. */
export function linkWhatsAppLosJazmines(texto: string): string {
  return linkWhatsApp(texto, numeroWhatsApp(WHATSAPP_LOS_JAZMINES))
}
