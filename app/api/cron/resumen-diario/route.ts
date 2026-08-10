export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { buildResumenDiario, sendResumenDiarioEmail } from "@/lib/resumen-diario"

// Cron de Vercel: corre a las 00:00 UTC = 21:00 hora argentina (ver vercel.json).
// Construye el resumen del día y lo envía por mail a NOTIFICATION_EMAIL.
export async function GET(request: Request) {
  // Si hay CRON_SECRET configurado, exigirlo (Vercel lo manda automáticamente)
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
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
