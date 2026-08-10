export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { buildResumenDiario } from "@/lib/resumen-diario"

// Resumen del día para la sección "Resumen diario" de Inicio.
export async function GET() {
  try {
    const resumen = await buildResumenDiario()
    return NextResponse.json(resumen)
  } catch (err) {
    console.error("[ResumenDiario] Error construyendo resumen:", err)
    return NextResponse.json({ error: "No se pudo generar el resumen" }, { status: 500 })
  }
}
