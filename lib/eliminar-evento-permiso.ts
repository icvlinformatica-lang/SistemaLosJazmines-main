// Quién puede mandar un evento a la papelera (DELETE /api/eventos/[id]).
// Solo servidor.
//
// Administración y Soporte, como siempre (Lista, Calendario, aviso de la
// semana). Desde el 30/10/2026 (pedido del dueño) también se borra desde el
// Perfil del evento de Cobrar cuota poniendo el PIN de Administración (o la
// clave maestra): con eso, cualquier perfil que vea esa pantalla puede
// borrarlo. El PIN viaja en un encabezado y se verifica acá, no en la
// pantalla: sin el PIN correcto, un perfil que no es de Administración sigue
// recibiendo 403, aunque le pegue a la ruta directo.
import { NextResponse } from "next/server"
import { verifyPin } from "@/lib/auth/server"
import { chequearLimite, registrarFallo, registrarExito, obtenerIp } from "@/lib/auth/rate-limit"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { PERFILES_ADMINISTRACION } from "@/lib/solo-administracion"
import { HEADER_PIN_ELIMINAR_EVENTO } from "@/lib/eliminar-evento-pin"

/** null si puede borrar; si no, la respuesta para devolver. */
export async function permisoEliminarEvento(req: Request): Promise<NextResponse | null> {
  const perfil = await perfilDesdeRequest(req)
  if (perfil && PERFILES_ADMINISTRACION.includes(perfil)) return null

  const pin = req.headers.get(HEADER_PIN_ELIMINAR_EVENTO) ?? ""
  if (!perfil || !pin) {
    return NextResponse.json({ ok: false, error: "Solo Administración, o con el PIN de Administración" }, { status: 403 })
  }

  // Mismo límite de intentos que /api/auth/verificar-pin (la misma clave):
  // probar PINs acá no da más intentos que probarlos allá.
  const claveLimite = `verificar-pin:${obtenerIp(req)}`
  const { permitido, esperaSegundos } = chequearLimite(claveLimite)
  if (!permitido) {
    return NextResponse.json(
      { ok: false, error: `Demasiados intentos. Esperá ${Math.ceil(esperaSegundos / 60)} min.` },
      { status: 429 },
    )
  }
  if (!verifyPin("administracion", pin)) {
    registrarFallo(claveLimite)
    return NextResponse.json({ ok: false, error: "PIN incorrecto" }, { status: 401 })
  }
  registrarExito(claveLimite)
  return null
}
