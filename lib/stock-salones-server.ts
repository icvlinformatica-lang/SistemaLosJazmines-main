// Ayudas del lado del servidor para el módulo "Stock por salón". Ver la
// lógica pura en lib/stock-salones.ts.
import { sql } from "@/lib/db"
import { verifyToken, SESSION_COOKIE, SESSION_HEADER } from "@/lib/auth/server"

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
