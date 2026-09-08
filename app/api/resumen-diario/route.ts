export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { buildResumenDiario } from "@/lib/resumen-diario"
import { fechaResumenValida } from "@/lib/resumen-fecha"

// Resumen del día para la sección "Resumen diario" de Inicio.
export async function GET(request: Request) {
  const fecha = new URL(request.url).searchParams.get("fecha")
  if (fecha !== null && !fechaResumenValida(fecha)) {
    return NextResponse.json({ error: "La fecha debe ser válida y tener formato AAAA-MM-DD" }, { status: 400 })
  }
  try {
    const resumen = await buildResumenDiario(fecha ?? undefined)
    return NextResponse.json(resumen)
  } catch (err) {
    console.error("[ResumenDiario] Error construyendo resumen:", err)
    return NextResponse.json({ error: "No se pudo generar el resumen" }, { status: 500 })
  }
}
