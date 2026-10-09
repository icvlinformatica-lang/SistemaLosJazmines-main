// Fecha de un evento para mostrar en pantalla: "2026-11-14" -> "14/11/2026".
// Es el mismo formato que usa Eventos → Lista; se usa en las pantallas que
// antes mostraban el texto tal cual viene de la base (eventos.fecha es texto).
export function fechaEventoCorta(fecha: string | null | undefined): string {
  if (!fecha) return "-"
  const [year, month, day] = fecha.split("-")
  if (!year || !month || !day) return fecha
  return `${day}/${month}/${year}`
}
