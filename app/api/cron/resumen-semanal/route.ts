export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { cronAutorizado } from "@/lib/cron-auth"
import { buildResumenSemanal, sendResumenSemanalEmail } from "@/lib/resumen-semanal"

// Cron de Vercel: corre los sábados 00:00 UTC = viernes 21:00 hora
// argentina (ver vercel.json). Construye el resumen de la semana
// (lunes a viernes) y lo envía por mail a NOTIFICATION_EMAIL.
export async function GET(request: Request) {
  // Sin CRON_SECRET cargado no se manda nada (ver lib/cron-auth.ts).
  if (!cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    if (!process.env.CRON_SECRET) console.error("[cron] Falta CRON_SECRET: no se manda el resumen")
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const resumen = await buildResumenSemanal()
    const enviado = await sendResumenSemanalEmail(resumen)
    return NextResponse.json({
      ok: true,
      enviado,
      rango: resumen.rangoLegible,
      movimientos: resumen.cantidadMovimientos,
      salones: resumen.porSalon.length,
    })
  } catch (err) {
    console.error("[ResumenSemanal] Error en cron:", err)
    return NextResponse.json({ error: "Fallo el resumen semanal" }, { status: 500 })
  }
}
