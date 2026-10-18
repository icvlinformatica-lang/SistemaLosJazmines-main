// Maqueta 3D del simulador "Armá tu fiesta" (vista de Clientes).
//
// Qué se dibuja según lo que va eligiendo la persona: cada elección suma algo
// a la maqueta (las mesas con los invitados, la barra, la pantalla LED…), y
// así arma su fiesta como en un juego. Es una ilustración: nunca lleva precios
// ni datos de nadie; los montos siguen en la pantalla, con la cuenta de siempre.
//
// Lógica pura (sin three.js ni "use client"): la usan la pantalla /clientes,
// el motor 3D (components/clientes/maqueta) y scripts/test-clientes-maqueta.cjs.

import { fechaLarga } from "./clientes-simulador"

/** Piezas que se pueden ver en la maqueta. Salen del nombre del servicio. */
export const PIEZAS = [
  "letras",
  "plataforma360",
  "shimmer",
  "fotografia",
  "invitacion",
  "maquillaje",
  "vestido",
  "mesaDulce",
  "neon",
  "pistaLed",
  "pantallaLed",
  "altar",
  "candelabros",
  "dj",
  "mesas",
  "decoracion",
  "suite",
] as const
export type Pieza = (typeof PIEZAS)[number]

/** Para el texto que describe la maqueta (lectores de pantalla). */
const NOMBRE_PIEZA: Record<Pieza, string> = {
  letras: "letras luminosas",
  plataforma360: "plataforma 360",
  shimmer: "pared brillante",
  fotografia: "fotógrafo",
  invitacion: "invitación digital",
  maquillaje: "maquillaje y peinado",
  vestido: "vestido",
  mesaDulce: "mesa dulce",
  neon: "cartel de neón",
  pistaLed: "pista LED",
  pantallaLed: "pantalla LED",
  altar: "altar",
  candelabros: "candelabros",
  dj: "DJ con luces",
  mesas: "mesas",
  decoracion: "decoración",
  suite: "suite",
}

/** Para el aviso "Sumaste…" (con artículo). */
const SUMADO: Record<Pieza, string> = {
  letras: "las letras luminosas",
  plataforma360: "la plataforma 360",
  shimmer: "el shimmer wall",
  fotografia: "la fotografía",
  invitacion: "la invitación digital",
  maquillaje: "maquillaje y peinado",
  vestido: "el vestido",
  mesaDulce: "la mesa dulce",
  neon: "el cartel de neón",
  pistaLed: "la pista LED",
  pantallaLed: "la pantalla LED",
  altar: "el altar",
  candelabros: "los candelabros",
  dj: "el DJ",
  mesas: "las mesas",
  decoracion: "la decoración",
  suite: "la suite",
}

function normalizar(nombre: string | null | undefined): string {
  return String(nombre ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+20\d{2}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Qué pieza de la maqueta le corresponde a un servicio, por su nombre
 * ("PANTALLA LED 2027" → pantallaLed). El orden importa: "MESA DULCE" va antes
 * que "MESAS" y "PISTA LED" antes que "PANTALLA". Lo que no se reconoce no se
 * dibuja (igual suma en el total, como siempre).
 */
export function piezaDeServicio(nombre: string | null | undefined): Pieza | null {
  const n = normalizar(nombre)
  if (!n) return null
  if (/\bLETRAS?\b/.test(n)) return "letras"
  if (/\b360\b/.test(n)) return "plataforma360"
  if (/SHIM+ER|GLITTER|LENTEJUELA/.test(n)) return "shimmer"
  if (/FOTO|VIDEO/.test(n)) return "fotografia"
  if (/INVITACION/.test(n)) return "invitacion"
  if (/MAQUILL|PEINAD/.test(n)) return "maquillaje"
  if (/VESTIDO/.test(n)) return "vestido"
  if (/MESA DULCE|TORTA|CANDY/.test(n)) return "mesaDulce"
  if (/NEON/.test(n)) return "neon"
  if (/PISTA/.test(n)) return "pistaLed"
  if (/PANTALLA/.test(n)) return "pantallaLed"
  if (/ALTAR/.test(n)) return "altar"
  if (/CANDELABRO/.test(n)) return "candelabros"
  if (/\bDJ\b|SONIDO|LUCES|HUMO/.test(n)) return "dj"
  if (/\bMESAS\b|SILLAS|VAJILLA|MANTEL/.test(n)) return "mesas"
  if (/DECORACION/.test(n)) return "decoracion"
  if (/SUITE/.test(n)) return "suite"
  return null
}

// ── Festejo ─────────────────────────────────────────────────────────────────

/** Qué dicen las letras luminosas según el festejo (una letra por unidad). */
const PALABRA_LETRAS: Record<string, string> = {
  "Cumpleaños de 15": "XV",
  Casamiento: "LOVE",
  Cumpleaños: "FIESTA",
  Bautismo: "BABY",
  Empresarial: "EVENTO",
}
export const MAX_LETRAS = 8

/** La palabra del festejo (la de las letras y la de la pantalla LED). */
export function palabraFestejo(tipoEvento: string | null | undefined): string {
  return PALABRA_LETRAS[tipoEvento ?? ""] ?? "FIESTA"
}

/** Las letras que se ven: tantas como unidades. Si se piden más letras que las
 *  de la palabra, las que sobran son estrellas. */
export function letrasLuminosas(tipoEvento: string | null | undefined, cantidad: number): string[] {
  const n = Math.max(0, Math.min(MAX_LETRAS, Math.floor(Number(cantidad) || 0)))
  const palabra = [...palabraFestejo(tipoEvento)]
  return Array.from({ length: n }, (_, i) => palabra[i] ?? "★")
}

/** Colores de los globos y los detalles de la maqueta según el festejo. */
const PALETAS: Record<string, string[]> = {
  Casamiento: ["#f8f2e4", "#e9d8b4", "#c9a227"],
  "Cumpleaños de 15": ["#e8a3b5", "#f3cf7a", "#f8f2e4"],
  Cumpleaños: ["#f3cf7a", "#2f8f5b", "#e8a3b5", "#f8f2e4"],
  Empresarial: ["#2f8f5b", "#f8f2e4", "#c9a227"],
  Bautismo: ["#f8f2e4", "#b9d3e8", "#e9d8b4"],
}
const PALETA_FIESTA = ["#f3cf7a", "#f8f2e4", "#2f8f5b"]

export function paletaFestejo(tipoEvento: string | null | undefined): string[] {
  return PALETAS[tipoEvento ?? ""] ?? PALETA_FIESTA
}

const TITULO_CARTEL: Record<string, string> = {
  Casamiento: "Nuestra boda",
  "Cumpleaños de 15": "Mis XV",
  Cumpleaños: "Mi cumple",
  Bautismo: "Mi bautismo",
  Empresarial: "Nuestro evento",
}

/** Lo que dice el atril de la entrada. */
export function tituloCartel(tipoEvento: string | null | undefined): string {
  return TITULO_CARTEL[tipoEvento ?? ""] ?? "Bienvenidos"
}

// ── Mesas ───────────────────────────────────────────────────────────────────

export const PERSONAS_POR_MESA = 10
/** Lo que entra en la maqueta (la cuenta del total no tiene tope). */
export const MAX_MESAS = 16
export const MAX_MESAS_NINOS = 2

/** Gente sentada en cada mesa: mesas llenas de a 10 y la última con lo que
 *  queda ([10, 10, 3] para 23). Tiene tope de mesas: es solo el dibujo. */
export function personasPorMesa(personas: number, maxMesas: number): number[] {
  const p = Math.max(0, Math.floor(Number(personas) || 0))
  const mesas = Math.min(maxMesas, Math.ceil(p / PERSONAS_POR_MESA))
  return Array.from({ length: mesas }, (_, i) => Math.min(PERSONAS_POR_MESA, p - i * PERSONAS_POR_MESA))
}

// ── Estado de la maqueta ────────────────────────────────────────────────────

export interface EstadoMaqueta {
  /** Colores de los globos y los detalles (según el festejo). */
  paleta: string[]
  festejo: string | null
  /** Globos en la entrada: aparecen al elegir el festejo. */
  globos: boolean
  /** Atril de la entrada: título según el festejo y la fecha, si ya la eligió. */
  cartel: { titulo: string; fecha: string | null } | null
  /** Nombre del salón en el cartel de la casa. */
  salon: string | null
  /** Gente en cada mesa (una entrada por mesa; vacío = sin mesas). */
  mesas: number[]
  mesasNinos: number[]
  /** Se ve la gente sentada (desde el paso de invitados). */
  conInvitados: boolean
  /** Platos servidos en las mesas (eligió menú). */
  platos: boolean
  /** Botellas en las mesas (eligió la bebida de mesa). */
  bebidaDeMesa: boolean
  /** Barras, sin contar la bebida de mesa (de 0 a 2). */
  barras: number
  /** Piezas de la maqueta y su cantidad. */
  piezas: Partial<Record<Pieza, number>>
  /** Letras luminosas, en orden. */
  letras: string[]
  /** Qué parte de la guirnalda de la maqueta está prendida (de 0 a 1). */
  luces: number
  /** La fiesta está lista: festejo final. */
  completa: boolean
}

export interface EntradaMaqueta {
  tipoEvento: string | null
  salon: { nombre: string; barras: Array<{ id: string; bebidaDeMesa: boolean }> } | null
  /** Servicios que valen para la fecha: los incluidos y los adicionales. */
  servicios: Array<{ servicioId: string; nombre: string; incluido: boolean }>
  /** Adicionales elegidos: id → cantidad. */
  elegidos: Record<string, number>
  fecha: string | null
  adultos: number
  ninos: number
  conCatering: boolean
  recetas: string[]
  barraIds: string[]
  /** Último paso al que llegó (0 = festejo) y cuántos pasos hay. */
  alcanzado: number
  totalPasos: number
  /** Desde qué paso se ve la gente sentada (el de invitados). */
  pasoInvitados: number
  completa: boolean
}

/** Cuánto de la guirnalda está prendido: una parte por paso al que se llegó,
 *  y toda cuando la fiesta está lista. */
export function lucesPrendidas(alcanzado: number, totalPasos: number, completa: boolean): number {
  if (completa) return 1
  if (!(totalPasos > 0)) return 0
  return Math.max(0, Math.min(1, (Math.max(0, alcanzado) + 1) / (totalPasos + 1)))
}

export function estadoMaqueta(e: EntradaMaqueta): EstadoMaqueta {
  const piezas: Partial<Record<Pieza, number>> = {}
  if (e.salon) {
    for (const s of e.servicios) {
      const p = piezaDeServicio(s.nombre)
      if (!p) continue
      if (s.incluido) {
        piezas[p] = Math.max(piezas[p] ?? 0, 1)
      } else if (Object.prototype.hasOwnProperty.call(e.elegidos, s.servicioId)) {
        const cantidad = Math.max(1, Math.floor(Number(e.elegidos[s.servicioId]) || 1))
        piezas[p] = Math.max(piezas[p] ?? 0, cantidad)
      }
    }
  }
  const deMesa = new Set((e.salon?.barras ?? []).filter((b) => b.bebidaDeMesa).map((b) => b.id))
  const festejo = e.tipoEvento || null
  return {
    paleta: paletaFestejo(festejo),
    festejo,
    globos: !!festejo,
    cartel: festejo ? { titulo: tituloCartel(festejo), fecha: e.fecha ? fechaLarga(e.fecha, false) : null } : null,
    salon: e.salon?.nombre ?? null,
    mesas: e.salon ? personasPorMesa(e.adultos, MAX_MESAS) : [],
    mesasNinos: e.salon ? personasPorMesa(e.ninos, MAX_MESAS_NINOS) : [],
    conInvitados: !!e.salon && (e.completa || e.alcanzado >= e.pasoInvitados),
    platos: !!e.salon && e.conCatering && e.recetas.length > 0,
    bebidaDeMesa: e.barraIds.some((id) => deMesa.has(id)),
    barras: Math.min(2, e.barraIds.filter((id) => !deMesa.has(id)).length),
    piezas,
    letras: piezas.letras ? letrasLuminosas(festejo, piezas.letras) : [],
    luces: lucesPrendidas(e.alcanzado, e.totalPasos, e.completa),
    completa: e.completa,
  }
}

/** La fiesta de muestra de la portada: todo lo que se puede sumar. */
export function estadoMuestra(): EstadoMaqueta {
  return {
    paleta: PALETA_FIESTA,
    festejo: null,
    globos: true,
    cartel: { titulo: "Bienvenidos", fecha: null },
    salon: null,
    mesas: personasPorMesa(100, MAX_MESAS),
    mesasNinos: [],
    conInvitados: true,
    platos: true,
    bebidaDeMesa: true,
    barras: 1,
    piezas: { dj: 1, decoracion: 1, pantallaLed: 1, pistaLed: 1, shimmer: 1, mesaDulce: 1, plataforma360: 1, letras: 6 },
    letras: letrasLuminosas(null, 6),
    luces: 1,
    completa: false,
  }
}

function enLista(partes: string[]): string {
  if (partes.length <= 1) return partes.join("")
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`
}

/** Texto que describe la maqueta, para lectores de pantalla. */
export function descripcionMaqueta(m: EstadoMaqueta): string {
  const partes: string[] = []
  const mesas = m.mesas.length + m.mesasNinos.length
  if (mesas > 0) {
    const gente = [...m.mesas, ...m.mesasNinos].reduce((a, b) => a + b, 0)
    partes.push(`${mesas} ${mesas === 1 ? "mesa" : "mesas"}${m.conInvitados ? ` con ${gente} invitados` : ""}`)
  }
  if (m.platos) partes.push("el menú servido")
  if (m.barras > 0) partes.push(m.barras === 1 ? "una barra" : "dos barras")
  for (const p of PIEZAS) {
    if (!m.piezas[p] || p === "mesas" || p === "suite") continue
    partes.push(p === "letras" && m.letras.length ? `letras luminosas (${m.letras.join("")})` : NOMBRE_PIEZA[p])
  }
  if (partes.length === 0) return "Maqueta del jardín de Los Jazmines, todavía vacía."
  return `Maqueta de tu fiesta: ${enLista(partes)}.`
}

/** "Sumaste la pantalla LED" / "Sumaste el menú y la bebida de mesa". */
export function textoSumaste(nuevas: Novedad[]): string {
  return nuevas.length ? `Sumaste ${enLista(nuevas.map((n) => n.texto))}` : ""
}

/** Algo que se acaba de sumar: el texto del aviso y adónde mira la maqueta. */
export interface Novedad {
  texto: string
  /** Lo que la cámara va a mostrar (el nombre de la pieza, "mesa" o "barra"). */
  foco: string
}

/**
 * Qué se sumó entre dos estados (para avisar "Sumaste la pantalla LED" y
 * llevar la cámara hasta ahí). Solo lo que la persona eligió: piezas nuevas,
 * otra barra, el menú. Lo incluido aparece al elegir el salón y no se avisa.
 */
export function novedades(antes: EstadoMaqueta | null, ahora: EstadoMaqueta): Novedad[] {
  if (!antes || antes.salon !== ahora.salon) return []
  const nuevas: Novedad[] = []
  if (!antes.platos && ahora.platos) nuevas.push({ texto: "el menú", foco: "mesa" })
  if (!antes.bebidaDeMesa && ahora.bebidaDeMesa) nuevas.push({ texto: "la bebida de mesa", foco: "mesa" })
  if (ahora.barras > antes.barras) {
    nuevas.push(ahora.barras === 1 ? { texto: "la barra", foco: "barra" } : { texto: "otra barra", foco: "barra2" })
  }
  for (const p of PIEZAS) {
    if (p === "mesas" || p === "suite") continue
    const a = antes.piezas[p] ?? 0
    const b = ahora.piezas[p] ?? 0
    // Más horas de algo que ya estaba no es algo nuevo; una letra más, sí.
    if (b > a && (a === 0 || p === "letras")) {
      nuevas.push({ texto: p === "letras" && a > 0 ? "una letra más" : SUMADO[p], foco: p === "candelabros" ? "mesa" : p })
    }
  }
  return nuevas
}
