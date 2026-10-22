export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { puedeVerVistaClientes } from "@/lib/vista-clientes"
import { faltaTablaRecorridos, seAnotaRecorrido, validarPasoRecorrido } from "@/lib/clientes-embudo"

/**
 * POST /api/clientes/recorrido — anota hasta qué etapa del simulador llegó una
 * visita (pedido de Rodri del 22/10/2026: ver dónde se quedan). Lo llama la
 * página sin esperar la respuesta: si falla, el simulador sigue igual.
 *
 * Solo guarda las visitas del perfil "clientes" (las del link); las de Soporte
 * responden ok sin guardar. SIN DATOS PERSONALES: solo la etapa, el festejo y
 * la clave del salón (ver scripts/027_simulador_recorridos.sql).
 *
 * Idempotente: el id lo genera el navegador (uno por visita) y la etapa se
 * agrega solo si no estaba, así un reintento no cuenta dos veces.
 */
export async function POST(req: Request) {
  const perfil = await perfilDesdeRequest(req)
  if (!puedeVerVistaClientes(perfil)) {
    return NextResponse.json({ ok: false, error: "Sin permiso" }, { status: 403 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido" }, { status: 400 })
  }
  const paso = validarPasoRecorrido(body)
  if (typeof paso === "string") return NextResponse.json({ ok: false, error: paso }, { status: 400 })
  if (!seAnotaRecorrido(perfil)) return NextResponse.json({ ok: true, guardado: false })

  try {
    await sql`
      INSERT INTO simulador_recorridos (id, etapas, ultima_etapa, tipo_evento, salon, whatsapp)
      VALUES (${paso.id}, ARRAY[${paso.etapa}]::text[], ${paso.etapa}, ${paso.tipoEvento}, ${paso.salon}, ${paso.etapa === "whatsapp"})
      ON CONFLICT (id) DO UPDATE SET
        etapas = CASE WHEN ${paso.etapa} = ANY(simulador_recorridos.etapas)
                      THEN simulador_recorridos.etapas
                      ELSE array_append(simulador_recorridos.etapas, ${paso.etapa}) END,
        ultima_etapa = EXCLUDED.ultima_etapa,
        tipo_evento = COALESCE(EXCLUDED.tipo_evento, simulador_recorridos.tipo_evento),
        salon = COALESCE(EXCLUDED.salon, simulador_recorridos.salon),
        whatsapp = simulador_recorridos.whatsapp OR EXCLUDED.whatsapp,
        actualizado = now()
    `
    return NextResponse.json({ ok: true, guardado: true })
  } catch (err) {
    if (faltaTablaRecorridos(err)) return NextResponse.json({ ok: true, guardado: false, sinTabla: true })
    console.error("[API] Error en clientes/recorrido:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
