// Módulo de autenticación del lado del servidor.
// Los PINs NUNCA deben estar en código del cliente: viven aquí (solo servidor)
// y pueden sobreescribirse con variables de entorno (PIN_COCINA, PIN_BARRA,
// PIN_ADMINISTRACION, PIN_SOPORTE, PIN_COBRO, PIN_DJ, PIN_FOTOGRAFO,
// PIN_VESTIDO, PIN_PANTALLA, PIN_COORDINACION, PIN_VENDEDOR) sin tocar el código.
// También vive acá PIN_STOCK_EXTRA, que no es de un perfil sino de una acción
// (la carga extraordinaria de stock): ver verifyPinStockExtra.
// Y PIN_MAESTRO, la clave general del dueño: ver esPinMaestro.
// Usa Web Crypto (crypto.subtle) para que funcione tanto en Node como en Edge middleware.

export const SESSION_COOKIE = "lj_session"
// Header alternativo para entornos donde las cookies no viajan (ej: vista previa en iframe)
export const SESSION_HEADER = "x-lj-session"
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12 // 12 horas
const QUICK_TOKEN_DURATION_MS = 1000 * 60 * 60 * 24 * 30 // 30 días (acceso rápido)

function getSecret(): string {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.POSTGRES_URL
  if (!secret) {
    throw new Error("No hay secreto disponible para firmar sesiones (configure AUTH_SECRET)")
  }
  return secret
}

// PINs del lado del servidor. Se pueden cambiar via env vars sin redeploy de código.
export function getPins(): Record<string, string> {
  return {
    cocina: process.env.PIN_COCINA || "1234",
    barra: process.env.PIN_BARRA || "1234",
    administracion: process.env.PIN_ADMINISTRACION || "112233",
    soporte: process.env.PIN_SOPORTE || "5757",
    cobro: process.env.PIN_COBRO || "4321",
    dj: process.env.PIN_DJ || "9001",
    fotografo: process.env.PIN_FOTOGRAFO || "9002",
    vestido: process.env.PIN_VESTIDO || "9003",
    pantalla: process.env.PIN_PANTALLA || "9004",
    coordinacion: process.env.PIN_COORDINACION || "9005",
    vendedor: process.env.PIN_VENDEDOR || "9006",
  }
}

/** Comparación de tiempo constante, para no filtrar el PIN por lo que tarda. */
function coincide(esperado: string, recibido: string): boolean {
  if (!esperado || !recibido) return false
  if (esperado.length !== recibido.length) return false
  let diff = 0
  for (let i = 0; i < esperado.length; i++) {
    diff |= esperado.charCodeAt(i) ^ recibido.charCodeAt(i)
  }
  return diff === 0
}

/** Largo mínimo de la clave maestra. Si es más corta, no se acepta. */
export const LARGO_MINIMO_PIN_MAESTRO = 8

/**
 * Clave general ("maestra"): abre CUALQUIER perfil en el login y también los
 * PINs de acción (el de administración para acciones sensibles y el de carga
 * extraordinaria de stock). Es para el dueño.
 *
 * Vive SOLO en la variable de entorno PIN_MAESTRO y, a diferencia de los otros
 * PINs, NO tiene valor de reserva: si la variable no está cargada, o tiene
 * menos de LARGO_MINIMO_PIN_MAESTRO caracteres, no hay clave maestra. El
 * repositorio es público, así que un valor por defecto acá abriría todo.
 * Tampoco se muestra en Configuración > Contraseñas (no está en getPins).
 */
export function esPinMaestro(pin: string): boolean {
  const maestro = (process.env.PIN_MAESTRO ?? "").trim()
  if (maestro.length < LARGO_MINIMO_PIN_MAESTRO) return false
  return coincide(maestro, pin)
}

export function verifyPin(perfilId: string, pin: string): boolean {
  const pins = getPins()
  const expected = pins[perfilId]
  if (!expected) return false
  return coincide(expected, pin) || esPinMaestro(pin)
}

/**
 * PIN de ACCIÓN para la carga extraordinaria de stock (la que se hace sin un
 * evento terminado detrás). No es un perfil: no crea sesión, no cambia el
 * perfil activo, no habilita ninguna pantalla más. Solo abre esa carga.
 *
 * Se cambia con la variable de entorno PIN_STOCK_EXTRA, sin redeploy, igual
 * que los PINs de los perfiles. La clave maestra (PIN_MAESTRO) también la abre.
 */
export function verifyPinStockExtra(pin: string): boolean {
  return coincide(process.env.PIN_STOCK_EXTRA || "9999", pin) || esPinMaestro(pin)
}

/**
 * Personas que, al entrar a su perfil, dejan abiertos TODOS los perfiles en
 * ese dispositivo (reciben el acceso rápido de cada uno, sin tener que poner
 * el PIN de cada perfil). Pedido del dueño el 8/10/2026 para Diego.
 *
 * No abre nada que esa persona no tenga ya: Administración ve todo, incluidos
 * los PINs de cada perfil en Configuración > Contraseñas. Para entrar igual
 * hace falta el PIN de Administración (o la clave maestra).
 */
const DESBLOQUEAN_TODO: Record<string, string[]> = {
  administracion: ["Diego"],
}

export function desbloqueaTodosLosPerfiles(perfilId: string, quien: string | null | undefined): boolean {
  const nombre = (quien ?? "").trim()
  if (!nombre) return false
  return (DESBLOQUEAN_TODO[perfilId] ?? []).includes(nombre)
}

// --- Firma HMAC-SHA256 con Web Crypto (Edge + Node) ---

function toBase64Url(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function hmac(data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data))
  return toBase64Url(new Uint8Array(sig))
}

export interface SessionPayload {
  perfilId: string
  exp: number
}

/**
 * Lo que se firma: perfil, vencimiento y el PIN VIGENTE de ese perfil. El PIN
 * no viaja en el token (solo entra en la firma), pero ata la sesión a él: si
 * se cambia la variable PIN_* de un perfil, todas sus sesiones y accesos
 * rápidos dejan de valer y hay que volver a entrar con el PIN nuevo. Antes un
 * acceso rápido se renovaba solo y seguía entrando aunque se cambiara el PIN.
 */
function datosFirmados(perfilId: string, exp: number): string {
  return `${perfilId}.${exp}.${getPins()[perfilId] ?? ""}`
}

// Token con formato: perfilId.exp.firma
export async function signToken(perfilId: string, durationMs: number = SESSION_DURATION_MS): Promise<string> {
  const exp = Date.now() + durationMs
  const sig = await hmac(datosFirmados(perfilId, exp))
  return `${perfilId}.${exp}.${sig}`
}

export async function signQuickToken(perfilId: string): Promise<string> {
  return signToken(perfilId, QUICK_TOKEN_DURATION_MS)
}

export async function verifyToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [perfilId, expStr, sig] = parts
  const exp = Number(expStr)
  if (!perfilId || !Number.isFinite(exp)) return null
  if (Date.now() > exp) return null
  const expectedSig = await hmac(datosFirmados(perfilId, exp))
  if (sig.length !== expectedSig.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i)
  }
  if (diff !== 0) return null
  return { perfilId, exp }
}

export function sessionCookieOptions(maxAgeSeconds: number = SESSION_DURATION_MS / 1000) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  }
}
