// Qué salones ya tienen un evento en una fecha, para marcarlos "Ocupado" en
// el alta/edición de evento. Es la misma regla que frena la base (scripts/019,
// índice eventos_un_evento_por_dia_y_salon, cuyo error traduce
// lib/salon-ocupado.ts): un evento por salón y por día entre los que no están
// en la papelera, sea cual sea su estado. Los eventos del store ya vienen sin
// los de la papelera. Solo pantalla: el que manda sigue siendo el servidor.
type EventoSalonFecha = { id: string; salon?: string; fecha?: string }

export function salonesOcupadosEnFecha(
  eventos: EventoSalonFecha[],
  fecha: string | undefined,
  idActual: string | undefined,
): Set<string> {
  const ocupados = new Set<string>()
  if (!fecha) return ocupados
  for (const e of eventos) {
    if (e.id === idActual || !e.salon || e.fecha !== fecha) continue
    ocupados.add(e.salon)
  }
  return ocupados
}
