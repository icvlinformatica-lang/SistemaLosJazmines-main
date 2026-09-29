// Ayudas del lado del servidor para el módulo "Stock por salón". Ver la
// lógica pura en lib/stock-salones.ts.
import { sql } from "@/lib/db"
import { verifyToken, SESSION_COOKIE, SESSION_HEADER } from "@/lib/auth/server"
import {
  eventoPendienteDeCarga,
  VENTANA_AVISO_DIAS,
  type EventoParaStock,
  type SectorStock,
} from "@/lib/stock-salones"

/**
 * Perfil REAL de la sesión (firmado en el token), no el que diga la
 * pantalla. Mismo criterio que /api/auth/pins. El middleware ya garantiza
 * que hay sesión, pero no mira el perfil: los permisos por sector se
 * deciden acá.
 */
export async function perfilDesdeRequest(req: Request): Promise<string | null> {
  const cookieToken = (req.headers.get("cookie") || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1)
  const session = await verifyToken(cookieToken || req.headers.get(SESSION_HEADER))
  return session?.perfilId ?? null
}

/**
 * Salones configurados (configuracion_cajas.salones), con su nombre para
 * mostrar ("Salon 4" → "Multiespacio Beruti"). Se lee de la configuración,
 * no de una lista fija, para validar que el salón recibido exista.
 */
export async function salonesConfigurados(): Promise<Map<string, string>> {
  const filas = (await sql`SELECT salones FROM configuracion_cajas WHERE id = 'config' LIMIT 1`) as unknown as Array<{
    salones: unknown
  }>
  const raw = filas[0]?.salones
  const obj = (typeof raw === "string" ? JSON.parse(raw) : raw) as { salones?: Record<string, { nombre?: string }> } | null
  const salones = obj?.salones || {}
  const mapa = new Map<string, string>()
  for (const [id, cfg] of Object.entries(salones)) {
    mapa.set(id, (cfg?.nombre || "").trim() || id)
  }
  return mapa
}

// Movida a lib/stock-salones.ts (lógica pura) para poder usarla también en
// las pantallas; se re-exporta acá para no cambiar a quien ya la importa.
export { fechaHoraCortaArgentina } from "@/lib/stock-salones"

/**
 * Evento terminado que habilita la carga "por evento" de ese salón y sector,
 * leyendo la base. Es la MISMA respuesta que ve la pantalla en
 * /api/stock-salones/estado, calculada de nuevo en el servidor al guardar:
 * el cliente puede mentir sobre si tenía un evento pendiente, así que la
 * puerta se decide acá (ver app/api/stock-salones/sesiones/route.ts).
 *
 * La lógica de cuál evento es (cruce de medianoche, ventana de 7 días, ya
 * cargado o no) sigue en eventoPendienteDeCarga: acá solo se trae lo que
 * necesita.
 */
export async function eventoPendienteEnBase(
  salon: string,
  sector: SectorStock,
  ahora: Date = new Date(),
): Promise<{ evento: EventoParaStock; fin: Date } | null> {
  // Solo eventos recientes: la ventana del aviso más un margen (el fin puede
  // caer al día siguiente de la fecha).
  const desde = new Date(ahora.getTime() - (VENTANA_AVISO_DIAS + 2) * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const eventos = (await sql`
    SELECT id, nombre, nombre_pareja, fecha, horario, horario_fin, salon, estado
    FROM eventos
    WHERE deleted_at IS NULL AND salon = ${salon} AND fecha >= ${desde}
  `) as unknown as Array<{
    id: string
    nombre: string
    nombre_pareja: string | null
    fecha: string | null
    horario: string | null
    horario_fin: string | null
    salon: string | null
    estado: string | null
  }>

  const sesiones = (await sql`
    SELECT evento_id, salon, sector, cerrada_en
    FROM stock_sesiones
    WHERE salon = ${salon} AND sector = ${sector} AND cerrada_en IS NOT NULL
      AND cerrada_en >= now() - interval '15 days'
  `) as unknown as Array<{ evento_id: string | null; salon: string; sector: SectorStock; cerrada_en: Date }>

  return eventoPendienteDeCarga(
    eventos.map((e) => ({
      id: e.id,
      nombre: e.nombre_pareja || e.nombre,
      fecha: e.fecha,
      horario: e.horario,
      horarioFin: e.horario_fin,
      salon: e.salon,
      estado: e.estado,
    })),
    sesiones.map((s) => ({
      eventoId: s.evento_id,
      salon: s.salon,
      sector: s.sector,
      cerradaEn: new Date(s.cerrada_en),
    })),
    salon,
    sector,
    ahora,
  )
}
