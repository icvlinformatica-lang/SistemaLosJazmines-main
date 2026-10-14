export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { cronAutorizado } from "@/lib/cron-auth"
import { buildResumenDiario, sendResumenDiarioEmail } from "@/lib/resumen-diario"

// Cron de Vercel: corre a las 00:00 UTC = 21:00 hora argentina (ver vercel.json).
// Construye el resumen del día y lo envía por mail a NOTIFICATION_EMAIL.
export async function GET(request: Request) {
  // Sin CRON_SECRET cargado no se manda nada (ver lib/cron-auth.ts).
  if (!cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    if (!process.env.CRON_SECRET) console.error("[cron] Falta CRON_SECRET: no se manda el resumen")
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const resumen = await buildResumenDiario()
    const enviado = await sendResumenDiarioEmail(resumen)
    return NextResponse.json({
      ok: true,
      enviado,
      fecha: resumen.fecha,
      movimientos: resumen.cantidadMovimientos,
      cuotas: resumen.cuotasDelDia.length,
    })
  } catch (err) {
    console.error("[ResumenDiario] Error en cron:", err)
    return NextResponse.json({ error: "Fallo el resumen diario" }, { status: 500 })
  }
}
