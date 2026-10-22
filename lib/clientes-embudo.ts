// Embudo del simulador "Armá tu fiesta" (pedido de Rodri del 22/10/2026:
// "ver dónde se quedan estancados al navegar"). Cada visita de quien entra
// con el link (perfil "clientes") anota hasta qué etapa llegó en
// simulador_recorridos (scripts/027_simulador_recorridos.sql), y Soporte ve
// cuántas visitas llegaron a cada etapa.
//
// SIN DATOS PERSONALES: se guardan solo las etapas, el festejo y la clave del
// salón. Nunca el nombre, el WhatsApp ni el mail de la hoja, ni la IP.
//
// Funciones puras: las usan app/clientes/page.tsx, /api/clientes/recorrido y
// /api/clientes/embudo. Test: scripts/test-clientes-embudo.cjs

import { PASOS_CLIENTE, TIPOS_EVENTO_CLIENTE } from "./clientes-simulador"

/** Las etapas, en el orden en que se recorren. "lugar" existe solo con la
 *  Casona (el paso "¿Adentro o al aire libre?"). */
export const ETAPAS_EMBUDO = [
  { id: "portada", nombre: "Abrió el simulador" },
  ...PASOS_CLIENTE.map((p) => ({ id: p.id as string, nombre: `Paso ${p.nombre}` })),
  { id: "precio", nombre: "Vio el precio" },
  { id: "datos", nombre: "Abrió la hoja de datos" },
  { id: "whatsapp", nombre: "Pidió el presupuesto por WhatsApp" },
] as const

export type IdEtapaEmbudo = (typeof ETAPAS_EMBUDO)[number]["id"]

const IDS = new Set<string>(ETAPAS_EMBUDO.map((e) => e.id))

/** Solo Soporte ve el embudo (el perfil "clientes" es quien lo llena). */
export const PERFILES_VEN_EMBUDO = ["soporte"] as const

export function puedeVerEmbudo(perfil: string | null | undefined): boolean {
  return typeof perfil === "string" && (PERFILES_VEN_EMBUDO as readonly string[]).includes(perfil)
}

/** Solo se anotan las visitas del perfil "clientes" (las del link): lo que
 *  mira Soporte para revisar el simulador no cuenta. */
export function seAnotaRecorrido(perfil: string | null | undefined): boolean {
  return perfil === "clientes"
}

export interface PasoRecorrido {
  id: string
  etapa: IdEtapaEmbudo
  tipoEvento: string | null
  salon: string | null
}

/**
 * Valida lo que manda el navegador. El id lo genera el navegador (uno por
 * visita), así un reintento no duplica la visita. Devuelve un texto con el
 * problema si algo no sirve.
 */
export function validarPasoRecorrido(body: unknown): PasoRecorrido | string {
  if (!body || typeof body !== "object") return "Falta el cuerpo"
  const b = body as Record<string, unknown>
  const id = typeof b.id === "string" ? b.id.trim() : ""
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return "id inválido"
  const etapa = typeof b.etapa === "string" ? b.etapa : ""
  if (!IDS.has(etapa)) return "etapa inválida"
  // El festejo, solo si es uno de la lista; el salón, una clave corta.
  const tipoEvento =
    typeof b.tipoEvento === "string" && (TIPOS_EVENTO_CLIENTE as readonly string[]).includes(b.tipoEvento) ? b.tipoEvento : null
  const salon = typeof b.salon === "string" && /^[\p{L}\p{N} ]{1,20}$/u.test(b.salon) ? b.salon : null
  return { id, etapa: etapa as IdEtapaEmbudo, tipoEvento, salon }
}

export interface FilaRecorrido {
  etapas: string[] | null
  tipo_evento: string | null
  salon: string | null
}

export interface EtapaEmbudo {
  id: string
  nombre: string
  visitas: number
  /** De cada 100 visitas, cuántas llegaron (0 a 100, redondeado). */
  porcentaje: number
}

export interface Embudo {
  visitas: number
  etapas: EtapaEmbudo[]
  /** Dónde se fueron: la última etapa a la que llegaron, para los que no pidieron presupuesto. */
  seFueronEn: Array<{ id: string; nombre: string; visitas: number }>
  porFestejo: Array<{ nombre: string; visitas: number; pidieron: number }>
  porSalon: Array<{ salon: string; visitas: number; pidieron: number }>
}

const ORDEN = new Map<string, number>(ETAPAS_EMBUDO.map((e, i) => [e.id, i]))

/** Arma el embudo con las visitas de un período. */
export function armarEmbudo(filas: FilaRecorrido[]): Embudo {
  const visitas = filas.length
  const cuenta = new Map<string, number>()
  const fueron = new Map<string, number>()
  const festejos = new Map<string, { visitas: number; pidieron: number }>()
  const salones = new Map<string, { visitas: number; pidieron: number }>()
  for (const f of filas) {
    const etapas = new Set((f.etapas ?? []).filter((e) => IDS.has(e)))
    for (const e of etapas) cuenta.set(e, (cuenta.get(e) ?? 0) + 1)
    const pidio = etapas.has("whatsapp")
    if (!pidio) {
      let ultima: string | null = null
      for (const e of etapas) if (ultima === null || (ORDEN.get(e) ?? 0) > (ORDEN.get(ultima) ?? 0)) ultima = e
      if (ultima) fueron.set(ultima, (fueron.get(ultima) ?? 0) + 1)
    }
    if (f.tipo_evento) {
      const x = festejos.get(f.tipo_evento) ?? { visitas: 0, pidieron: 0 }
      x.visitas++
      if (pidio) x.pidieron++
      festejos.set(f.tipo_evento, x)
    }
    if (f.salon) {
      const x = salones.get(f.salon) ?? { visitas: 0, pidieron: 0 }
      x.visitas++
      if (pidio) x.pidieron++
      salones.set(f.salon, x)
    }
  }
  const pct = (n: number) => (visitas ? Math.round((n / visitas) * 100) : 0)
  const nombre = (id: string) => ETAPAS_EMBUDO.find((e) => e.id === id)?.nombre ?? id
  return {
    visitas,
    etapas: ETAPAS_EMBUDO.map((e) => ({ id: e.id, nombre: e.nombre, visitas: cuenta.get(e.id) ?? 0, porcentaje: pct(cuenta.get(e.id) ?? 0) })),
    seFueronEn: [...fueron.entries()]
      .map(([id, n]) => ({ id, nombre: nombre(id), visitas: n }))
      .sort((a, b) => b.visitas - a.visitas || (ORDEN.get(a.id) ?? 0) - (ORDEN.get(b.id) ?? 0)),
    porFestejo: [...festejos.entries()].map(([n, x]) => ({ nombre: n, ...x })).sort((a, b) => b.visitas - a.visitas),
    porSalon: [...salones.entries()].map(([s, x]) => ({ salon: s, ...x })).sort((a, b) => b.visitas - a.visitas),
  }
}

/** Días que se pueden pedir en el embudo (por defecto, 30). */
export function diasEmbudo(valor: string | null | undefined): number {
  const n = Number(valor)
  return [7, 30, 90].includes(n) ? n : 30
}

/** ¿El error es porque todavía no se aplicó la migración 027? Así el
 *  simulador sigue andando sin la tabla. */
export function faltaTablaRecorridos(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null
  return e?.code === "42P01" || /simulador_recorridos.*does not exist/i.test(e?.message || "")
}
