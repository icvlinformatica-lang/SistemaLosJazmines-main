export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { verifyPin } from "@/lib/auth/server"

// POST { pin } — verifica el PIN de administración SIN modificar la sesión
// actual. Se usa para proteger acciones sensibles (ej: editar contrato)
// sin cambiar el perfil con el que se está trabajando.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const pin = typeof body.pin === "string" ? body.pin : ""

    if (!verifyPin("administracion", pin)) {
      return NextResponse.json({ ok: false, error: "PIN incorrecto" }, { status: 401 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[API] Error verificando PIN:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
