// Cómo se ve un evento eliminado en la pestaña Eliminados de Finalizados.
// La copia de `eventos_eliminados` (evento_json o, en las viejas, data) está
// guardada como texto dentro de jsonb, igual que los JSON de `eventos`: hay
// que desenvolverla. Antes la ruta la esparcía tal cual y la pantalla no
// veía ni el salón ni los invitados ni cuándo se eliminó.
// Solo viajan los datos que muestra la tabla: nada de DNI, pagos ni contrato.

export interface EventoEliminadoFila {
  id: string
  nombre: string
  fecha: string | null
  estado: string
  eliminado_at: string | null
  motivo: string | null
  data: {
    adultos?: number
    adolescentes?: number
    ninos?: number
    personasDietasEspeciales?: number
    salon?: string
    tipoEvento?: string
    nombrePareja?: string
  }
}

function desenvolver(valor: unknown): Record<string, unknown> {
  let v = valor
  // Puede venir como texto (una o, por las dudas, dos veces).
  for (let i = 0; i < 2 && typeof v === "string"; i++) {
    try {
      v = JSON.parse(v)
    } catch {
      return {}
    }
  }
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function numero(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

function texto(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined
}

function fechaHora(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString()
  return typeof v === "string" && v !== "" ? v : null
}

export function filaPapeleraEvento(row: Record<string, unknown>): EventoEliminadoFila {
  const d = desenvolver(row.evento_data)
  return {
    id: String(row.id ?? ""),
    nombre: texto(row.nombre) ?? texto(d.nombre) ?? "",
    fecha: texto(row.fecha) ?? texto(d.fecha) ?? null,
    estado: texto(row.estado) ?? texto(d.estado) ?? "pendiente",
    eliminado_at: fechaHora(row.eliminado_at),
    motivo: texto(row.motivo) ?? null,
    data: {
      adultos: numero(d.adultos),
      adolescentes: numero(d.adolescentes),
      ninos: numero(d.ninos),
      personasDietasEspeciales: numero(d.personasDietasEspeciales),
      salon: texto(d.salon),
      tipoEvento: texto(d.tipoEvento),
      nombrePareja: texto(d.nombrePareja),
    },
  }
}
