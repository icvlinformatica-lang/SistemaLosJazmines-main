// Cotizador por salón — modelo COSTO + GANANCIA (scripts/015).
//
// Cada salón funciona como una empresa aparte y tiene 5 rubros, cada uno
// con su costo y su % de ganancia:
//   1. Salón:     costo fijo cargado a mano (no depende de invitados ni día).
//   2. Cocina:    costo por porción de cada receta (lib/precio-menu.ts).
//   3. Barra:     barras armadas; por adulto = 1 trago de cada cóctel
//                 (lib/precio-barra-cotizador.ts).
//   4. Servicios: costoParaCajaEventos de cada servicio.
//   5. Personal:  reglas por función, cada una con su propia ganancia.
//
// Precio = costo × (1 + ganancia / 100), redondeado a pesos POR UNIDAD
// (por porción, por trago, por persona), igual que la Parte 1.
//
// Lógica pura (sin "use client" ni base): la usan la pantalla de
// Configuración, el servidor y scripts/test-cotizador-salon.cjs.

import { precioBarraDesdeCostos, type PrecioBarraArmada } from "./precio-barra-cotizador"

/** Misma lista y orden que SALONES de lib/store.ts (que es de cliente y no
 *  se puede importar desde el servidor). Una prueba verifica que coincidan. */
export const SALONES_COTIZADOR = ["Quinta", "Casona", "Salon", "Salon 4", "Salon 5"] as const

export function esSalonCotizador(salon: unknown): salon is (typeof SALONES_COTIZADOR)[number] {
  return typeof salon === "string" && (SALONES_COTIZADOR as readonly string[]).includes(salon)
}

/** Precio de una unidad: costo × (1 + ganancia%), redondeado a pesos. */
export function precioConGanancia(costo: number, gananciaPct: number): number {
  return Math.round((Number(costo) || 0) * (1 + (Number(gananciaPct) || 0) / 100))
}

// ── Cocina y barra ──────────────────────────────────────────────────────────

/** Precio de cocina para un evento: precio por porción × comensales. */
export function precioCocina(costoPorcion: number, gananciaPct: number, comensales: number): number {
  return precioConGanancia(costoPorcion, gananciaPct) * Math.max(0, Math.floor(Number(comensales) || 0))
}

/** Precio por adulto de una barra armada con la ganancia de barra del salón. */
export function precioBarraSalon(
  coctelesIds: string[],
  costosPorTrago: Record<string, number>,
  gananciaPct: number,
): PrecioBarraArmada {
  return precioBarraDesdeCostos(coctelesIds, costosPorTrago, (Number(gananciaPct) || 0) / 100)
}

// ── Personal ────────────────────────────────────────────────────────────────

export type AplicaRegla = "siempre" | "con_menu" | "con_barra"

export const APLICA_OPCIONES: Array<{ valor: AplicaRegla; etiqueta: string }> = [
  { valor: "siempre", etiqueta: "Siempre" },
  { valor: "con_menu", etiqueta: "Si hay menú" },
  { valor: "con_barra", etiqueta: "Si hay barra" },
]

export interface ReglaPersonalSalon {
  funcion: string
  /** "Uno cada N invitados". 0 = personal fijo: siempre el mínimo. */
  cadaNInvitados: number
  minimo: number
  /** Tarifa escrita a mano. null = la tarifa base más alta de esa función. */
  tarifa: number | null
  /** % de ganancia propio de esta función. */
  ganancia: number
  aplica: AplicaRegla
}

export interface PersonaConTarifa {
  id: string
  nombre: string
  apellido: string
  funcion: string
  tarifaBase: number
}

/** Cantidad = max(mínimo, ⌈invitados / N⌉). N = 0 → siempre el mínimo. */
export function cantidadPersonal(regla: Pick<ReglaPersonalSalon, "cadaNInvitados" | "minimo">, invitados: number): number {
  const minimo = Math.max(0, Math.floor(Number(regla.minimo) || 0))
  const n = Math.max(0, Math.floor(Number(regla.cadaNInvitados) || 0))
  const inv = Math.max(0, Number(invitados) || 0)
  return n > 0 ? Math.max(minimo, Math.ceil(inv / n)) : minimo
}

/** La tarifa base más alta del personal activo con esa función (texto exacto),
 *  y de quién es. null si nadie tiene esa función. */
export function tarifaMasAlta(funcion: string, roster: PersonaConTarifa[]): { tarifa: number; de: string } | null {
  let mejor: PersonaConTarifa | null = null
  for (const p of roster) {
    if (p.funcion !== funcion) continue
    if (!mejor || (Number(p.tarifaBase) || 0) > (Number(mejor.tarifaBase) || 0)) mejor = p
  }
  return mejor ? { tarifa: Number(mejor.tarifaBase) || 0, de: `${mejor.nombre} ${mejor.apellido}`.trim() } : null
}

export interface TarifaResuelta {
  tarifa: number
  origen: "manual" | "personal" | "sin_costo"
  /** Nombre de la persona con la tarifa más alta (solo origen "personal"). */
  de?: string
}

/** Tarifa que usa una regla: la escrita a mano, o la más alta de su función.
 *  Sin ninguna de las dos (o en $0) → "sin_costo", que la pantalla marca. */
export function tarifaDeRegla(regla: Pick<ReglaPersonalSalon, "funcion" | "tarifa">, roster: PersonaConTarifa[]): TarifaResuelta {
  if (regla.tarifa != null && Number.isFinite(Number(regla.tarifa))) {
    const t = Number(regla.tarifa)
    return { tarifa: t, origen: t > 0 ? "manual" : "sin_costo" }
  }
  const alta = tarifaMasAlta(regla.funcion, roster)
  if (!alta || alta.tarifa <= 0) return { tarifa: 0, origen: "sin_costo" }
  return { tarifa: alta.tarifa, origen: "personal", de: alta.de }
}

/** ¿La regla se suma en este evento? */
export function reglaAplica(aplica: AplicaRegla, evento: { conMenu: boolean; conBarra: boolean }): boolean {
  if (aplica === "con_menu") return evento.conMenu
  if (aplica === "con_barra") return evento.conBarra
  return true
}

export interface LineaPersonal {
  funcion: string
  cantidad: number
  tarifa: TarifaResuelta
  /** Precio de UNA persona: tarifa × (1 + ganancia%). */
  precioUnitario: number
  costoTotal: number
  precioTotal: number
}

/** Simulación del personal de un evento: solo las reglas que aplican y que
 *  dan al menos una persona. */
export function simularPersonal(
  reglas: ReglaPersonalSalon[],
  roster: PersonaConTarifa[],
  evento: { invitados: number; conMenu: boolean; conBarra: boolean },
): { lineas: LineaPersonal[]; costoTotal: number; precioTotal: number } {
  const lineas: LineaPersonal[] = []
  for (const regla of reglas) {
    if (!reglaAplica(regla.aplica, evento)) continue
    const cantidad = cantidadPersonal(regla, evento.invitados)
    if (cantidad <= 0) continue
    const tarifa = tarifaDeRegla(regla, roster)
    const precioUnitario = precioConGanancia(tarifa.tarifa, regla.ganancia)
    lineas.push({
      funcion: regla.funcion,
      cantidad,
      tarifa,
      precioUnitario,
      costoTotal: tarifa.tarifa * cantidad,
      precioTotal: precioUnitario * cantidad,
    })
  }
  return {
    lineas,
    costoTotal: lineas.reduce((s, l) => s + l.costoTotal, 0),
    precioTotal: lineas.reduce((s, l) => s + l.precioTotal, 0),
  }
}

// ── Cotización completa (Paso 2) ────────────────────────────────────────────
//
// UNA sola cuenta para el precio de una cotización. Trabaja con valores POR
// UNIDAD (por porción, por adulto, por persona, por servicio):
//   - el SERVIDOR le pasa costo y precio de cada cosa (precio calculado con
//     precioConGanancia y la config del salón) y guarda el resultado;
//   - la pantalla del VENDEDOR le pasa solo los precios del catálogo (sin
//     costos) para mostrar el total en vivo.
// Así el número que ve el vendedor y el que queda guardado salen de la misma
// función. El servidor recalcula siempre: nunca se confía en el navegador.

/** Unidades de servicio que se cobran por cantidad (+/−). Fijo y Por Persona
 *  van × 1 (regla confirmada: "Por Persona" NO multiplica por invitados). */
export const UNIDADES_CON_CANTIDAD = ["Por Hora", "Por Cantidad"]

/** Categorías de servicio que NO son adicionales en el modelo nuevo: la
 *  comida sale de Cocina (recetas) y la bebida de Barra (barras armadas). */
export const CATEGORIAS_FUERA_DE_SERVICIOS = ["Menú", "Barra"]

export interface ValorUnitario {
  /** Costo por unidad. undefined en la pantalla del vendedor (no lo recibe). */
  costo?: number
  /** Precio por unidad para el cliente. */
  precio: number
}

export interface EntradaCotizacionSalon {
  adultos: number
  ninos: number
  /** null = el salón no tiene capacidad cargada: no se limita. */
  capacidadMaxima: number | null
  salon: ValorUnitario
  /** Recetas elegidas, por porción. */
  recetas: Array<ValorUnitario & { id: string; nombre: string }>
  /** Barra elegida, por adulto. null = sin barra. */
  barra: (ValorUnitario & { id: string; nombre: string; tragosPorAdulto: number }) | null
  /** Servicios elegidos, por unidad. Los incluidos se listan pero no suman. */
  servicios: Array<ValorUnitario & { servicioId: string; nombre: string; unidad: string; cantidad: number; incluido: boolean }>
  /** Reglas de personal del salón, con el valor de UNA persona. */
  personal: Array<ValorUnitario & { funcion: string; cadaNInvitados: number; minimo: number; aplica: AplicaRegla }>
}

export type ClaveRubro = "salon" | "cocina" | "barra" | "servicios" | "personal"

export interface RubroCotizacion {
  clave: ClaveRubro
  nombre: string
  /** null cuando la cuenta se hizo sin costos (pantalla del vendedor). */
  costo: number | null
  precio: number
}

export interface AvisoCotizacion {
  codigo: string
  nivel: "ambar" | "rojo"
  /** Para Administración (puede hablar de costos). */
  texto: string
  /** Para el vendedor: nunca dice costo, ganancia ni margen. */
  textoVendedor: string
}

export interface LineaPersonalCotizacion {
  funcion: string
  cantidad: number
  costoUnitario: number | null
  precioUnitario: number
}

export interface LineaServicioCotizacion {
  servicioId: string
  nombre: string
  unidad: string
  cantidad: number
  incluido: boolean
  costoUnitario: number | null
  precioUnitario: number
  /** 0 si viene incluido en el salón. */
  precioTotal: number
}

export interface ResultadoCotizacionSalon {
  comensales: number
  rubros: RubroCotizacion[]
  total: number
  /** null cuando la cuenta se hizo sin costos. */
  costoTotal: number | null
  servicios: LineaServicioCotizacion[]
  personal: LineaPersonalCotizacion[]
  avisos: AvisoCotizacion[]
  superaCapacidad: boolean
  /** Derivada, para no romper lo que la lea: hay menú → "con_catering". */
  modalidad: "solo_salon" | "con_catering"
}

const enteroNoNegativo = (n: unknown) => Math.max(0, Math.floor(Number(n) || 0))
const sinValor = (v: ValorUnitario) =>
  v.costo !== undefined ? (Number(v.costo) || 0) <= 0 : (Number(v.precio) || 0) <= 0

/** Cantidad que se cobra de un servicio: × cantidad solo Por Hora / Por Cantidad. */
export function cantidadServicio(unidad: string, cantidad: number): number {
  return UNIDADES_CON_CANTIDAD.includes(unidad) ? Math.max(1, enteroNoNegativo(cantidad)) : 1
}

export function armarCotizacion(e: EntradaCotizacionSalon): ResultadoCotizacionSalon {
  const adultos = enteroNoNegativo(e.adultos)
  const comensales = adultos + enteroNoNegativo(e.ninos)
  const conCostos = e.salon.costo !== undefined
  const c = (n: number | undefined) => (conCostos ? Math.round(Number(n) || 0) : null)
  const avisos: AvisoCotizacion[] = []
  const avisoSinValor = (codigo: string, que: string) =>
    avisos.push({
      codigo,
      nivel: "ambar",
      texto: `${que}: sin costo cargado, va a cotizar $0`,
      textoVendedor: `${que}: sin precio cargado, va a cotizar $0`,
    })

  // 1. Salón
  const salonPrecio = Math.round(Number(e.salon.precio) || 0)
  if (sinValor(e.salon)) avisoSinValor("salon", "Salón")

  // 2. Cocina: comensales × promedio del precio por porción de las recetas.
  let cocinaPrecio = 0
  let cocinaCosto = 0
  if (e.recetas.length > 0 && comensales > 0) {
    const n = e.recetas.length
    cocinaPrecio = Math.round((comensales * e.recetas.reduce((s, r) => s + (Number(r.precio) || 0), 0)) / n)
    cocinaCosto = (comensales * e.recetas.reduce((s, r) => s + (Number(r.costo) || 0), 0)) / n
  }
  for (const r of e.recetas) if (sinValor(r)) avisoSinValor(`receta:${r.id}`, r.nombre)

  // 3. Barra: adultos × precio por adulto de la barra elegida.
  const barraPrecio = e.barra ? adultos * Math.round(Number(e.barra.precio) || 0) : 0
  const barraCosto = e.barra ? adultos * (Number(e.barra.costo) || 0) : 0
  if (e.barra && sinValor(e.barra)) avisoSinValor(`barra:${e.barra.id}`, e.barra.nombre)

  // 4. Servicios: los incluidos se listan y no suman.
  const servicios: LineaServicioCotizacion[] = e.servicios.map((s) => {
    const cantidad = cantidadServicio(s.unidad, s.cantidad)
    const precioUnitario = Math.round(Number(s.precio) || 0)
    if (!s.incluido && sinValor(s)) avisoSinValor(`servicio:${s.servicioId}`, s.nombre)
    return {
      servicioId: s.servicioId,
      nombre: s.nombre,
      unidad: s.unidad,
      cantidad,
      incluido: !!s.incluido,
      costoUnitario: c(s.costo),
      precioUnitario,
      precioTotal: s.incluido ? 0 : precioUnitario * cantidad,
    }
  })
  const serviciosPrecio = servicios.reduce((sum, s) => sum + s.precioTotal, 0)
  const serviciosCosto = servicios
    .filter((s) => !s.incluido)
    .reduce((sum, s) => sum + (s.costoUnitario ?? 0) * s.cantidad, 0)

  // 5. Personal: reglas del salón con adultos + niños, respetando "aplica".
  const evento = { conMenu: e.recetas.length > 0, conBarra: !!e.barra }
  const personal: LineaPersonalCotizacion[] = []
  for (const r of e.personal) {
    if (!reglaAplica(r.aplica, evento)) continue
    const cantidad = cantidadPersonal(r, comensales)
    if (cantidad <= 0) continue
    if (sinValor(r)) {
      avisos.push({
        codigo: `personal:${r.funcion}`,
        nivel: "ambar",
        texto: `Personal ${r.funcion}: sin tarifa cargada, va a cotizar $0`,
        textoVendedor: `Personal ${r.funcion}: sin precio cargado, va a cotizar $0`,
      })
    }
    personal.push({
      funcion: r.funcion,
      cantidad,
      costoUnitario: c(r.costo),
      precioUnitario: Math.round(Number(r.precio) || 0),
    })
  }
  const personalPrecio = personal.reduce((s, l) => s + l.precioUnitario * l.cantidad, 0)
  const personalCosto = personal.reduce((s, l) => s + (l.costoUnitario ?? 0) * l.cantidad, 0)

  // Capacidad: rojo y no se puede enviar (lo chequea también el servidor).
  const superaCapacidad = e.capacidadMaxima != null && e.capacidadMaxima > 0 && comensales > e.capacidadMaxima
  if (superaCapacidad) {
    const texto = `Supera la capacidad del salón: ${comensales} invitados y entran ${e.capacidadMaxima}`
    avisos.unshift({ codigo: "capacidad", nivel: "rojo", texto, textoVendedor: texto })
  }

  const rubros: RubroCotizacion[] = [
    { clave: "salon", nombre: "Salón", costo: c(e.salon.costo), precio: salonPrecio },
    { clave: "cocina", nombre: "Cocina", costo: c(cocinaCosto), precio: cocinaPrecio },
    { clave: "barra", nombre: "Barra", costo: c(barraCosto), precio: barraPrecio },
    { clave: "servicios", nombre: "Servicios", costo: c(serviciosCosto), precio: serviciosPrecio },
    { clave: "personal", nombre: "Personal", costo: c(personalCosto), precio: personalPrecio },
  ]
  return {
    comensales,
    rubros,
    total: rubros.reduce((s, r) => s + r.precio, 0),
    costoTotal: conCostos ? rubros.reduce((s, r) => s + (r.costo ?? 0), 0) : null,
    servicios,
    personal,
    avisos,
    superaCapacidad,
    modalidad: e.recetas.length > 0 ? "con_catering" : "solo_salon",
  }
}
