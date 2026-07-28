// Módulo de autenticación del lado del servidor.
// Los PINs NUNCA deben estar en código del cliente: viven aquí (solo servidor)
// y pueden sobreescribirse con variables de entorno (PIN_COCINA, PIN_BARRA,
// PIN_ADMINISTRACION, PIN_SOPORTE, PIN_COBRO) sin tocar el código.
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
  }
}

export function verifyPin(perfilId: string, pin: string): boolean {
  const pins = getPins()
  const expected = pins[perfilId]
  if (!expected || !pin) return false
  // Comparación de longitud constante para evitar timing attacks básicos
  if (expected.length !== pin.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ pin.charCodeAt(i)
  }
  return diff === 0
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

// Token con formato: perfilId.exp.firma
export async function signToken(perfilId: string, durationMs: number = SESSION_DURATION_MS): Promise<string> {
  const exp = Date.now() + durationMs
  const data = `${perfilId}.${exp}`
  const sig = await hmac(data)
  return `${data}.${sig}`
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
  const expectedSig = await hmac(`${perfilId}.${exp}`)
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
