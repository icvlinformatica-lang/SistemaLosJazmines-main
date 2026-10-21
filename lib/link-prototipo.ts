// Link del prototipo de la vista de Clientes (pedido del 21/10/2026): un link
// que Administración o Soporte le pasa a alguien (por ejemplo a Diego) para
// que abra SOLO el simulador, sin PIN y sin entrar al sistema.
//
// Cómo funciona: el link lleva un acceso rápido del perfil "clientes" (el
// mismo token firmado de 30 días que guarda el login, signQuickToken). La
// página /prototipo lo guarda como acceso rápido y entra por el camino de
// siempre (POST /api/auth/login con quickToken). El perfil "clientes" solo
// tiene /clientes y sus rutas nunca mandan costos ni datos de eventos.
//
// El token va después del "#": el navegador no lo manda al servidor, así que
// no queda en los logs de Vercel.
// Test: scripts/test-link-prototipo.cjs

export const PERFIL_LINK_PROTOTIPO = "clientes"
export const RUTA_LINK_PROTOTIPO = "/prototipo"
/** Quién puede generar el link: Administración y Soporte. */
export const PERFILES_GENERAN_LINK = ["administracion", "soporte"] as const

export function puedeGenerarLinkPrototipo(perfil: string | null | undefined): boolean {
  return typeof perfil === "string" && (PERFILES_GENERAN_LINK as readonly string[]).includes(perfil)
}

/** El link a compartir: https://…/prototipo#t=<token>. */
export function urlLinkPrototipo(origen: string, token: string): string {
  return `${String(origen).replace(/\/+$/, "")}${RUTA_LINK_PROTOTIPO}#t=${encodeURIComponent(token)}`
}

/** El token que trae el link, o null si no es uno del perfil "clientes"
 *  (así el link nunca sirve para entrar a otro perfil, aunque alguien le
 *  pegue otro token). */
export function tokenDeLinkPrototipo(hash: string | null | undefined): string | null {
  const h = String(hash ?? "").replace(/^#/, "")
  let token: string | null = null
  for (const parte of h.split("&")) {
    const [clave, ...resto] = parte.split("=")
    if (clave !== "t") continue
    try {
      token = decodeURIComponent(resto.join("="))
    } catch {
      token = null
    }
  }
  if (!token) return null
  const partes = token.split(".")
  if (partes.length !== 3 || partes[0] !== PERFIL_LINK_PROTOTIPO) return null
  return token
}
