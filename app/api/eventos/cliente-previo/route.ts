export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { soloAdministracion } from "@/lib/solo-administracion"
import { buscarEventosDelCliente, claveDni, claveTelefono, type EventoParaCliente } from "@/lib/origen-cliente"

function parseJson(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return raw as Record<string, unknown>
}

/**
 * "Ya fue cliente": otros eventos (no borrados) con el mismo DNI o teléfono.
 * GET ?dni=…&telefono=…&excluir=<id del evento que se está editando>
 *
 * Solo Administración y Soporte: muestra datos de otros eventos, así que no
 * va al vendedor ni al staff. Devuelve lo mínimo para el aviso (nombre,
 * fecha, salón y tipo), nunca plata ni DNI.
 *
 * Los DNI están en el contrato (texto JSON dentro de jsonb) y en
 * dni_novio1/dni_novio2; el teléfono, en el contrato. Se comparan en el
 * servidor con lib/origen-cliente.ts (solo dígitos; teléfono por los últimos 8).
 */
export async function GET(req: Request) {
  const prohibido = await soloAdministracion(req)
  if (prohibido) return prohibido
  try {
    const url = new URL(req.url)
    const dni = url.searchParams.get("dni")
    const telefono = url.searchParams.get("telefono")
    const excluirId = url.searchParams.get("excluir")
    if (!claveDni(dni) && !claveTelefono(telefono)) return NextResponse.json({ ok: true, eventos: [] })

    const filas = (await sql`
      SELECT id, nombre, nombre_pareja, fecha, salon, tipo_evento, dni_novio1, dni_novio2, contrato
      FROM eventos WHERE deleted_at IS NULL
    `) as unknown as Array<{
      id: string
      nombre: string | null
      nombre_pareja: string | null
      fecha: string | null
      salon: string | null
      tipo_evento: string | null
      dni_novio1: string | null
      dni_novio2: string | null
      contrato: unknown
    }>
    const eventos: EventoParaCliente[] = filas.map((f) => {
      const contrato = parseJson(f.contrato)
      return {
        id: f.id,
        nombre: f.nombre_pareja || f.nombre || "Sin nombre",
        fecha: f.fecha || "",
        salon: f.salon,
        tipoEvento: f.tipo_evento,
        dnis: [f.dni_novio1, f.dni_novio2, typeof contrato?.dni === "string" ? contrato.dni : null],
        telefono: typeof contrato?.telefono === "string" ? contrato.telefono : null,
      }
    })
    return NextResponse.json({ ok: true, eventos: buscarEventosDelCliente(eventos, { dni, telefono, excluirId }) })
  } catch (err) {
    console.error("[API] Error en eventos/cliente-previo:", err)
    return NextResponse.json({ ok: false, error: "No se pudo buscar" }, { status: 500 })
  }
}
