export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { respuestaSalonOcupado } from "@/lib/salon-ocupado"
import { logActivity } from "@/lib/activity-logger"
import { soloAdministracion } from "@/lib/solo-administracion"
import { CLAVE_PLATA_AL_ELIMINAR, SUFIJO_EVENTO_ELIMINADO } from "@/lib/plata-al-eliminar"

/** Ids de movimientos que se desvincularon al eliminar, leídos de la copia de la papelera (JSON real o texto dentro de jsonb). */
function movimientosDesvinculados(fila: any): string[] {
  const leer = (v: unknown) => {
    if (typeof v === "string") { try { return JSON.parse(v) } catch { return null } }
    return v && typeof v === "object" ? v : null
  }
  const copia = leer(fila?.evento_json) ?? leer(fila?.data)
  const ids = copia?.[CLAVE_PLATA_AL_ELIMINAR]?.movimientos
  return Array.isArray(ids) ? ids.filter((x: unknown) => typeof x === "string") : []
}

// El soft delete conserva la fila original completa, incluidos sus pagos y cuotas.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Igual que la papelera: solo Administración y Soporte.
  const prohibido = await soloAdministracion(req)
  if (prohibido) return prohibido
  try {
    const { id } = await params
    // Al eliminar, los movimientos de caja del evento se desvincularon para
    // que siguieran contando en las cajas (lib/plata-al-eliminar.ts). Al
    // restaurar se vuelven a vincular, así Caja Eventos vuelve a ver qué se
    // cobró y qué se pagó de este evento. Las devoluciones no se tocan: esa
    // plata salió de verdad.
    const result = await sql.begin(async (tx: any) => {
      const [copia] = await tx`SELECT to_jsonb(eventos_eliminados) AS fila FROM eventos_eliminados WHERE id = ${id}`
      const [restaurado] = await tx`
        UPDATE eventos SET deleted_at = NULL, updated_at = NOW()
        WHERE id = ${id} AND deleted_at IS NOT NULL
        RETURNING id, nombre, fecha, estado
      `
      if (!restaurado) return null
      const ids = movimientosDesvinculados(copia?.fila)
      if (ids.length > 0) {
        await tx`
          UPDATE movimientos_caja
          SET evento_id = ${id},
              concepto = CASE WHEN concepto LIKE ${"%" + SUFIJO_EVENTO_ELIMINADO}
                THEN left(concepto, length(concepto) - ${SUFIJO_EVENTO_ELIMINADO.length}) ELSE concepto END
          WHERE id::text = ANY(${ids}::text[]) AND evento_id IS NULL
        `
      }
      await tx`DELETE FROM eventos_eliminados WHERE id = ${id}`
      return restaurado
    })
    if (!result) {
      return NextResponse.json({ error: "El evento no está eliminado o su fila original ya no existe." }, { status: 404 })
    }
    await logActivity("evento", "modificado", result.nombre || "Sin nombre", "Restaurado desde la papelera")
    return NextResponse.json({ success: true, evento: { id: result.id } })
  } catch (err) {
    console.error("[API] Error restoring evento:", err)
    const ocupado = respuestaSalonOcupado(err)
    if (ocupado) return ocupado
    return NextResponse.json({ error: "No se pudo restaurar el evento." }, { status: 500 })
  }
}
