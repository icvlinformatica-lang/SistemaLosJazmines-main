// Ayudas del lado del servidor para las reglas de lib/permisos-escritura.ts.
// Solo servidor.
import { NextResponse } from "next/server"
import { verifyPaseContrato, PASE_CONTRATO_COOKIE } from "@/lib/auth/server"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"

/** Valor crudo de una cookie del pedido, o null si no vino. */
export function cookieDelPedido(req: Request, nombre: string): string | null {
  const valor = (req.headers.get("cookie") || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${nombre}=`))
    ?.slice(nombre.length + 1)
  return valor || null
}

/** ¿Trae el pedido un pase de contrato válido para este perfil? (ver signPaseContrato) */
export async function tienePaseContrato(req: Request, perfil: string | null): Promise<boolean> {
  return verifyPaseContrato(cookieDelPedido(req, PASE_CONTRATO_COOKIE), perfil)
}

/**
 * Deja una línea en los logs (Vercel) cada vez que se frena una escritura:
 * si alguna pantalla legítima quedó afuera, ahí se ve qué perfil, qué ruta y
 * qué tabla. No se loguean datos del pedido.
 */
export function avisarEscrituraRechazada(detalle: { perfil: string | null; metodo: string; ruta: string; tabla?: string; campo?: string }) {
  console.warn("[permisos] escritura rechazada", JSON.stringify(detalle))
}

/** 403 en el formato de las rutas de la app ({ error }), con el aviso en los logs. */
export function rechazarEscritura(
  motivo: string,
  detalle: { perfil: string | null; metodo: string; ruta: string; tabla?: string; campo?: string },
): NextResponse {
  avisarEscrituraRechazada(detalle)
  return NextResponse.json({ ok: false, error: motivo }, { status: 403 })
}

/**
 * null si el perfil de la sesión pasa `permitido`; si no, el 403 con el motivo
 * (y el aviso en los logs). Para rutas que escriben con una sola regla.
 */
export async function exigirPerfil(
  req: Request,
  permitido: (perfil: string | null) => boolean,
  motivo: string,
  ruta: string,
): Promise<NextResponse | null> {
  const perfil = await perfilDesdeRequest(req)
  if (permitido(perfil)) return null
  return rechazarEscritura(motivo, { perfil, metodo: req.method, ruta })
}
