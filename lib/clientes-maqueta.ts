// Maqueta 3D del simulador "Armá tu fiesta" (vista de Clientes).
//
// Qué se dibuja según lo que va eligiendo la persona: cada elección suma algo
// a la maqueta (las mesas con los invitados, la barra, la pantalla LED…), y
// así arma su fiesta como en un juego. El lugar es el del salón elegido: el
// jardín de la Casona (con pileta y la casa) o un salón cerrado; antes de
// elegirlo, el plano vacío. Es una ilustración: nunca lleva precios ni datos
// de nadie; los montos siguen en la pantalla, con la cuenta de siempre.
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

// ── El lugar: cada salón con lo suyo ────────────────────────────────────────

/**
 * Dónde es la fiesta en la Casona: en el jardín (al aire libre) o adentro. Lo
 * elige la persona en su propio paso, "¿Adentro o al aire libre?". No cambia
 * el precio: cambia el dibujo y se anota en el presupuesto y en el WhatsApp.
 */
export type VistaCasona = "jardin" | "adentro"

/** Cómo se dice en una frase ("en Casona al aire libre"). */
export const TEXTO_LUGAR: Record<VistaCasona, string> = { jardin: "al aire libre", adentro: "adentro" }

export interface Ambiente {
  /** "plano": todavía no eligió salón (la maqueta es el plano, para llenar).
   *  "jardin": la fiesta al aire libre (solo la Casona tiene).
   *  "interior": la fiesta en un salón cerrado. */
  lugar: "plano" | "jardin" | "interior"
  /** De qué salón es el dibujo (el piso, las paredes, las arañas). */
  estilo: "casona" | "quinta" | "salon" | null
  /** La Casona: la pileta y la casa para quedarse (se ven en las dos vistas). */
  casona: boolean
  /** El exterior de cada salón (dicho por el dueño el 18/10/2026): el Salón no
   *  tiene, la Quinta tiene uno chico (un patio al frente) y la Casona, uno
   *  amplio para eventos (el jardín). */
  exterior: "ninguno" | "chico" | "amplio"
  /** La Quinta y la Casona tienen estacionamiento (se dibuja al frente). */
  estacionamiento: boolean
}

/**
 * Qué lugar se dibuja según la clave del salón (la de la base: "Casona",
 * "Quinta", "Salon"…, que no cambia aunque en Configuración se le cambie el
 * nombre que se ve). Lo dijo el dueño el 18/10/2026:
 * - Casona: amplio exterior para eventos (la fiesta puede ser al aire libre),
 *   salón adentro, pileta, casa para quedarse y estacionamiento.
 * - Quinta: salón con un exterior chico y estacionamiento. La fiesta es
 *   adentro; el exterior es un patio al frente.
 * - Salón: salón cerrado, sin exterior.
 * Cualquier salón nuevo se dibuja cerrado y sin nada afuera.
 */
export function ambienteDeSalon(clave: string | null | undefined, vista: VistaCasona = "jardin"): Ambiente {
  if (!clave) return { lugar: "plano", estilo: null, casona: false, exterior: "ninguno", estacionamiento: false }
  if (clave === "Casona") {
    return { lugar: vista === "adentro" ? "interior" : "jardin", estilo: "casona", casona: true, exterior: "amplio", estacionamiento: true }
  }
  if (clave === "Quinta") return { lugar: "interior", estilo: "quinta", casona: false, exterior: "chico", estacionamiento: true }
  return { lugar: "interior", estilo: "salon", casona: false, exterior: "ninguno", estacionamiento: false }
}

/** Si el salón se puede ver en el jardín o adentro. */
export function tieneVistaAdentro(a: Ambiente): boolean {
  return a.casona
}

/** Si con ese salón se elige "¿adentro o al aire libre?" (por la clave, como
 *  el dibujo: solo la Casona tiene las dos cosas). */
export function salonConAireLibre(clave: string | null | undefined): boolean {
  return tieneVistaAdentro(ambienteDeSalon(clave))
}

/** Lo que tiene el salón además de lo incluido (va en su tarjeta). Lo dijo el
 *  dueño el 18/10/2026; un salón nuevo no dice nada hasta que se sepa. */
const RASGOS: Record<string, string> = {
  Casona: "Amplio exterior para eventos: la fiesta puede ser al aire libre o adentro. Con pileta, una casa para quedarse y estacionamiento.",
  Quinta: "Con un exterior chico y estacionamiento.",
  Salon: "Salón cerrado, sin exterior.",
}
export function rasgosSalon(clave: string | null | undefined): string | null {
  return RASGOS[clave ?? ""] ?? null
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
  /** Dónde es la fiesta: el plano vacío, el jardín de la Casona o un salón cerrado. */
  ambiente: Ambiente
  /** Colores de los globos y los detalles (según el festejo). */
  paleta: string[]
  festejo: string | null
  /** Globos en la entrada: aparecen al elegir el festejo. */
  globos: boolean
  /** Atril de la entrada: título según el festejo y la fecha, si ya la eligió. */
  cartel: { titulo: string; fecha: string | null } | null
  /** Nombre del salón (el que se ve) en su cartel. */
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
  /** `clave` es la de la base (decide el lugar); `nombre`, el que se ve. */
  salon: { clave: string; nombre: string; barras: Array<{ id: string; bebidaDeMesa: boolean }> } | null
  /** Solo para la Casona: la fiesta en el jardín (si todavía no eligió) o adentro. */
  vistaCasona?: VistaCasona
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
    ambiente: ambienteDeSalon(e.salon?.clave, e.vistaCasona ?? "jardin"),
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

/** La fiesta de muestra de la portada: todo lo que se puede sumar, en el
 *  jardín de la Casona (con la pileta y la casa). */
export function estadoMuestra(): EstadoMaqueta {
  return {
    ambiente: ambienteDeSalon("Casona", "jardin"),
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

/** Dónde es la fiesta, para la descripción ("en Casona, en el jardín…"). */
function dondeEs(m: EstadoMaqueta): string {
  const { lugar, casona, exterior, estacionamiento } = m.ambiente
  if (lugar === "plano") return ""
  const en = m.salon ? ` en ${m.salon}` : ""
  const afuera = [casona ? "la pileta" : "", casona ? "la casa" : "", exterior === "chico" ? "el patio" : "", estacionamiento ? "el estacionamiento" : ""].filter(Boolean)
  const con = afuera.length ? ` con ${enLista(afuera)}` : ""
  if (lugar === "jardin") return `${en}, en el jardín${con}`
  return `${en}, adentro${con}`
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
  if (partes.length === 0) return `Maqueta de tu fiesta${dondeEs(m)}, todavía vacía.`
  return `Maqueta de tu fiesta${dondeEs(m)}: ${enLista(partes)}.`
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
  if (!antes || antes.salon !== ahora.salon || antes.ambiente.estilo !== ahora.ambiente.estilo) return []
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

/**
 * Un aviso del lugar (no de algo que se suma): al elegir la Casona, que la
 * cámara vaya a mostrar la pileta y la casa; al elegir la Quinta, su patio y
 * el estacionamiento; al pasar del jardín a adentro (o al revés), que se vea
 * entero el cambio. Nada para el Salón.
 */
export function avisoLugar(antes: EstadoMaqueta | null, ahora: EstadoMaqueta): Novedad | null {
  if (!antes) return null
  const a = antes.ambiente
  const b = ahora.ambiente
  if (b.casona && !a.casona) return { texto: "Tiene pileta, una casa para quedarse y estacionamiento", foco: "casona" }
  if (b.estilo !== a.estilo && b.exterior === "chico") return { texto: "Tiene un patio al frente y estacionamiento", foco: "frente" }
  if (a.casona && b.casona && a.lugar !== b.lugar) {
    return { texto: b.lugar === "interior" ? "Así queda adentro" : "Así queda en el jardín", foco: "isla" }
  }
  return null
}
