// Qué eventos ve cada perfil en "Próximos eventos" (/eventos/staff).
//
// Pedido del dueño (14/10/2026): Pantalla, Vestido, Fotógrafo, Barra y DJ ven
// en el calendario solo los eventos donde su servicio está contratado. El
// resto (Coordinación, y Administración o Soporte si entran) sigue viendo
// todos.
//
// DJ por ahora sigue viendo todos: el catálogo tiene "DJ, SONIDO, LUCES Y
// HUMO" pero al 14/10/2026 ningún evento lo tiene cargado, así que filtrarlo
// le dejaría el calendario vacío. Para activarlo, sumar "dj" a
// PERFILES_FILTRADOS.
//
// Cocina no entra acá: su calendario es /eventos/produccion, que ya muestra
// solo los eventos con menú cargado.
//
// Es solo pantalla: esconder no es seguridad, la API sigue mandando todos
// los eventos (ver "Pendiente: permisos por perfil" en CLAUDE.md).

/**
 * El catálogo real tiene variantes versionadas por año para casi todos los
 * servicios (ej. "FOTOGRAFIA 2027", "VESTIDO 2028") y algo de inconsistencia
 * de formato ("FOTO  + VIDEO" con doble espacio, "FOTO-VIDEO 2027" con
 * guion en vez de "+"). Por eso se normaliza espacios/guiones/"+" antes de
 * comparar, y "empieza con" en vez de exacto.
 */
export function normalizarNombreServicio(s: string): string {
  return (s || "").trim().toUpperCase().replace(/[+\-]/g, " ").replace(/\s+/g, " ")
}

/** El servicio del evento es el que le toca al perfil (se resalta en el detalle). */
export function esServicioDelPerfil(perfilId: string | undefined, nombreServicio: string): boolean {
  const n = normalizarNombreServicio(nombreServicio)
  switch (perfilId) {
    case "fotografo":
      return n.startsWith("FOTOGRAFIA") || n.startsWith("FOTO VIDEO")
    case "vestido":
      return n.startsWith("VESTIDO")
    case "pantalla":
      return n.startsWith("PANTALLA LED")
    case "dj":
      // "DJ, SONIDO, LUCES Y HUMO" en el catálogo.
      return n.startsWith("DJ")
    default:
      return false
  }
}

/** Perfiles que ven solo los eventos donde están contratados. */
const PERFILES_FILTRADOS = new Set(["fotografo", "vestido", "pantalla", "barra"])

export function filtraPorContratacion(perfilId: string | undefined): boolean {
  return !!perfilId && PERFILES_FILTRADOS.has(perfilId)
}

type EventoParaFiltro = {
  servicios?: { nombre?: string }[] | null
  barras?: unknown[] | null
}

/**
 * ¿El perfil ve este evento en su calendario? Barra: el evento tiene alguna
 * barra contratada. Fotógrafo, Vestido y Pantalla: el evento tiene su
 * servicio. Cualquier otro perfil ve todos.
 */
export function eventoVisibleParaPerfil(perfilId: string | undefined, evento: EventoParaFiltro): boolean {
  if (!filtraPorContratacion(perfilId)) return true
  if (perfilId === "barra") return Array.isArray(evento.barras) && evento.barras.length > 0
  const servicios = Array.isArray(evento.servicios) ? evento.servicios : []
  return servicios.some((s) => esServicioDelPerfil(perfilId, s?.nombre || ""))
}
