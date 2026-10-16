// De dónde vino cada cliente ("¿Cómo nos conoció?") y si ya hizo otro evento
// con Los Jazmines. Antes no quedaba registrado en ningún lado: no se podía
// saber qué red trae ventas.
//
// Los valores se guardan como texto en eventos.origen_cliente y
// cotizaciones.origen_cliente (scripts/022): se pueden AGREGAR, no renombrar.
//
// Funciones puras. Test: scripts/test-origen-cliente.cjs

export const ORIGENES_CLIENTE = [
  { valor: "instagram", etiqueta: "Instagram" },
  { valor: "facebook", etiqueta: "Facebook" },
  { valor: "google", etiqueta: "Google o web" },
  { valor: "recomendacion", etiqueta: "Recomendación" },
  { valor: "ya_cliente", etiqueta: "Ya fue cliente" },
  { valor: "paso_por_salon", etiqueta: "Pasó por el salón" },
  { valor: "otro", etiqueta: "Otro" },
] as const

export type OrigenCliente = (typeof ORIGENES_CLIENTE)[number]["valor"]

export function esOrigenValido(valor: unknown): valor is OrigenCliente {
  return ORIGENES_CLIENTE.some((o) => o.valor === valor)
}

/** El valor guardado si es válido; si no, null (no se guarda basura). */
export function normalizarOrigen(valor: unknown): OrigenCliente | null {
  return esOrigenValido(valor) ? valor : null
}

export function etiquetaOrigen(valor: string | null | undefined): string {
  return ORIGENES_CLIENTE.find((o) => o.valor === valor)?.etiqueta ?? "Sin dato"
}

// ---------------------------------------------------------------------------
// Ventas por origen
// ---------------------------------------------------------------------------

export interface FilaOrigen {
  /** Valor guardado, o null para "Sin dato". */
  origen: string | null | undefined
  /** "YYYY-MM-DD": fecha de alta del evento o de creación de la cotización. */
  fecha: string | null | undefined
}

export interface ConteoOrigen {
  origen: OrigenCliente | "sin_dato"
  etiqueta: string
  cantidad: number
}

/**
 * Cuántos hay de cada origen, opcionalmente solo en un mes ("YYYY-MM").
 * Ordenado de más a menos; "Sin dato" siempre al final.
 */
export function contarPorOrigen(filas: FilaOrigen[], mes?: string | null): ConteoOrigen[] {
  const conteo = new Map<string, number>()
  for (const f of filas) {
    if (mes && !(f.fecha ?? "").startsWith(mes)) continue
    const clave = esOrigenValido(f.origen) ? f.origen : "sin_dato"
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1)
  }
  const out: ConteoOrigen[] = [...conteo.entries()].map(([origen, cantidad]) => ({
    origen: origen as ConteoOrigen["origen"],
    etiqueta: origen === "sin_dato" ? "Sin dato" : etiquetaOrigen(origen),
    cantidad,
  }))
  return out.sort((a, b) => {
    if (a.origen === "sin_dato") return 1
    if (b.origen === "sin_dato") return -1
    return b.cantidad - a.cantidad || a.etiqueta.localeCompare(b.etiqueta)
  })
}

/** Meses ("YYYY-MM") que tienen al menos una fila, del más nuevo al más viejo. */
export function mesesConDatos(filas: FilaOrigen[]): string[] {
  const meses = new Set<string>()
  for (const f of filas) {
    const m = (f.fecha ?? "").slice(0, 7)
    if (/^\d{4}-\d{2}$/.test(m)) meses.add(m)
  }
  return [...meses].sort().reverse()
}

// ---------------------------------------------------------------------------
// "Ya fue cliente"
// ---------------------------------------------------------------------------

/** Solo dígitos; menos de 6 no identifica a nadie. */
export function claveDni(dni: string | null | undefined): string | null {
  const d = String(dni ?? "").replace(/\D/g, "")
  return d.length >= 6 ? d : null
}

/**
 * Los últimos 8 dígitos: los teléfonos se cargan a mano de mil formas ("011
 * 4444-5555", "+54 9 11 4444 5555", "15-4444-5555") y el final es lo único
 * que coincide entre todas.
 */
export function claveTelefono(tel: string | null | undefined): string | null {
  const d = String(tel ?? "").replace(/\D/g, "")
  return d.length >= 8 ? d.slice(-8) : null
}

export interface EventoParaCliente {
  id: string
  nombre: string
  fecha: string
  salon: string | null
  tipoEvento: string | null
  dnis: Array<string | null | undefined>
  telefono: string | null | undefined
}

export interface EventoDelCliente {
  id: string
  nombre: string
  fecha: string
  salon: string | null
  tipoEvento: string | null
  coincide: "dni" | "telefono"
}

/**
 * Otros eventos del mismo cliente: coincide el DNI (cualquiera de los del
 * evento) o, si no, el teléfono. Del más nuevo al más viejo.
 */
export function buscarEventosDelCliente(
  eventos: EventoParaCliente[],
  buscado: { dni?: string | null; telefono?: string | null; excluirId?: string | null },
): EventoDelCliente[] {
  const dni = claveDni(buscado.dni)
  const tel = claveTelefono(buscado.telefono)
  if (!dni && !tel) return []
  const out: EventoDelCliente[] = []
  for (const e of eventos) {
    if (buscado.excluirId && e.id === buscado.excluirId) continue
    const porDni = !!dni && e.dnis.some((d) => claveDni(d) === dni)
    const porTel = !porDni && !!tel && claveTelefono(e.telefono) === tel
    if (!porDni && !porTel) continue
    out.push({
      id: e.id,
      nombre: e.nombre,
      fecha: e.fecha,
      salon: e.salon,
      tipoEvento: e.tipoEvento,
      coincide: porDni ? "dni" : "telefono",
    })
  }
  return out.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
}
