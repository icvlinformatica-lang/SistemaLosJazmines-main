export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import {
  verifyPin,
  esPinMaestro,
  desbloqueaTodosLosPerfiles,
  verifyToken,
  signToken,
  signQuickToken,
  signPaseAdmin,
  verifyPaseAdmin,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth/server"
import { usuarioDesdeCookie } from "@/lib/usuario-cookie"
import { chequearLimite, registrarFallo, registrarExito, obtenerIp } from "@/lib/auth/rate-limit"

// "clientes" (prototipo del simulador) no tiene PIN propio: no está en
// getPins(), así que verifyPin lo rechaza siempre. Desde el 21/10/2026 se
// entra solo con el link que arma Soporte (un acceso rápido, ver
// lib/link-prototipo.ts): ni con el pase de Administración ni con los
// accesos rápidos que recibe Diego.
const PERFILES_SIN_PASE = ["clientes"]
const PERFILES_VALIDOS = [
  "cocina", "barra", "administracion", "soporte", "cobro",
  "dj", "fotografo", "vestido", "pantalla", "coordinacion",
  "vendedor", "mantenimiento", "clientes",
]

// POST { perfilId, pin } — login con PIN
// POST { perfilId, quickToken } — acceso rápido con token firmado previamente
// POST { perfilId, paseAdmin } — cambio de perfil con el pase de Administración
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const perfilId = typeof body.perfilId === "string" ? body.perfilId : ""
    const pin = typeof body.pin === "string" ? body.pin : ""
    const quickToken = typeof body.quickToken === "string" ? body.quickToken : ""
    const paseAdmin = typeof body.paseAdmin === "string" ? body.paseAdmin : ""
    // Quién ingresa (Diego, Leila…). Viene en el body y, si no, de la cookie
    // lj_usuario: en la vista previa embebida las cookies pueden no viajar.
    const quien = typeof body.quien === "string" && body.quien.trim() ? body.quien.trim() : usuarioDesdeCookie(req, "")

    if (!PERFILES_VALIDOS.includes(perfilId)) {
      return NextResponse.json({ ok: false, error: "Perfil inválido" }, { status: 400 })
    }

    // Límite de intentos por IP+perfil para frenar fuerza bruta sobre el PIN.
    // Los quickToken y los pases firmados no cuentan: no son adivinables por fuerza bruta.
    const claveLimite = `login:${obtenerIp(req)}:${perfilId}`
    if (pin) {
      const { permitido, esperaSegundos } = chequearLimite(claveLimite)
      if (!permitido) {
        return NextResponse.json(
          { ok: false, error: `Demasiados intentos. Esperá ${Math.ceil(esperaSegundos / 60)} min.` },
          { status: 429 },
        )
      }
    }

    let autorizado = false
    let porPase = false
    if (pin) {
      autorizado = verifyPin(perfilId, pin)
    } else if (quickToken) {
      const payload = await verifyToken(quickToken)
      autorizado = payload !== null && payload.perfilId === perfilId
    } else if (paseAdmin && !PERFILES_SIN_PASE.includes(perfilId)) {
      // Pase de Administración: entra a cualquier perfil sin su PIN.
      autorizado = await verifyPaseAdmin(paseAdmin)
      porPase = autorizado
    }

    if (!autorizado) {
      if (pin) registrarFallo(claveLimite)
      return NextResponse.json({ ok: false, error: "PIN incorrecto" }, { status: 401 })
    }

    if (pin) registrarExito(claveLimite)

    // Deja rastro en los logs de Vercel cada vez que se entra con la clave
    // maestra, para poder ver si la usa alguien más que el dueño.
    if (pin && esPinMaestro(pin)) {
      console.warn(`[auth] Ingreso con la clave maestra al perfil "${perfilId}" desde ${obtenerIp(req)}`)
    }

    const sessionToken = await signToken(perfilId)
    // Con el pase no se da acceso rápido: si no, ese navegador seguiría
    // entrando a ese perfil sin PIN por 30 días, más allá de la sesión de
    // Administración.
    const nuevoQuickToken = porPase ? undefined : await signQuickToken(perfilId)
    // El pase sale solo de un ingreso real de Administración (PIN o acceso
    // rápido), nunca de otro pase: así no se puede estirar más de 12 horas.
    const nuevoPase = perfilId === "administracion" && !porPase ? await signPaseAdmin() : undefined

    // Si entra alguien de DESBLOQUEAN_TODO (Diego en Administración), se le
    // devuelve el acceso rápido de TODOS los perfiles: el navegador los guarda
    // y después entra a cualquiera tocándolo, sin PIN.
    // Nunca con el pase: si no, alguien que pasó a Administración con el pase
    // (que dura lo que la pestaña) y tocó "Diego" se llevaría accesos de 30 días
    // a todos los perfiles sin haber puesto el PIN de Administración.
    let accesosRapidos: Record<string, string> | undefined
    if (!porPase && desbloqueaTodosLosPerfiles(perfilId, quien)) {
      accesosRapidos = {}
      for (const id of PERFILES_VALIDOS.filter((id) => !PERFILES_SIN_PASE.includes(id))) {
        accesosRapidos[id] = id === perfilId && nuevoQuickToken ? nuevoQuickToken : await signQuickToken(id)
      }
    }

    // sessionToken también se devuelve en el body: en la vista previa embebida
    // (iframe) las cookies pueden estar bloqueadas, y el cliente lo envía por header.
    const res = NextResponse.json({
      ok: true,
      perfilId,
      quickToken: nuevoQuickToken,
      sessionToken,
      paseAdmin: nuevoPase,
      accesosRapidos,
    })
    res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions())
    return res
  } catch (err) {
    console.error("[API] Error en login:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
