export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { textoPasosFaltantes } from "@/lib/cotizador-salon"

// El driver a veces entrega jsonb como texto sin parsear: se aceptan los dos.
function listaDeTextos(valor: unknown): string[] {
  let v = valor
  if (typeof v === "string") {
    try {
      v = JSON.parse(v)
    } catch {
      return []
    }
  }
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
}

/**
 * Envía a revisión una cotización ya generada (botón directo en la tarjeta
 * de /vendedor/paquetes → "Mis cotizaciones generadas"). No recibe body:
 * solo cambia el estado, los datos ya quedaron guardados por
 * /api/vendedor/cotizaciones. Funciona desde "borrador" o "rechazada"
 * (Administración pidió un ajuste, el vendedor lo corrigió y la reenvía) —
 * nunca desde otro estado, para no reenviar algo que ya está en revisión o
 * ya fue procesado. Al reenviar se limpia comentario_admin: era sobre la
 * versión anterior, no sobre esta.
 *
 * Modelo nuevo (desglose_venta.version 2): si la cotización supera la
 * capacidad del salón NO se envía (mismo criterio que "Enviar a
 * Administración" en /vendedor/cotizar). Tampoco si tiene menú y le faltaba
 * un paso que el salón ofrece (desglose_venta.pasosMenuFaltantes, lo guarda
 * /api/vendedor/cotizaciones): hay que abrirla y completar el menú.
 * Tampoco sin "¿Cómo nos conoció?" (origen_cliente, scripts/022), que se
 * pide para enviar: hay que abrirla y elegirlo.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const filas = (await sql`
      UPDATE cotizaciones SET estado = 'lista_para_revisar', comentario_admin = NULL, updated_at = now()
      WHERE id = ${id} AND estado IN ('borrador', 'rechazada')
        AND NOT (
          jsonb_typeof(desglose_venta) = 'object'
          AND coalesce((desglose_venta ->> 'superaCapacidad')::boolean, false)
        )
        AND NOT coalesce(
          CASE WHEN jsonb_typeof(desglose_venta -> 'pasosMenuFaltantes') = 'array'
            THEN jsonb_array_length(desglose_venta -> 'pasosMenuFaltantes') > 0
          END,
          false
        )
        AND (to_jsonb(cotizaciones) ->> 'origen_cliente') IS NOT NULL
      RETURNING id, estado
    `) as unknown as Array<{ id: string; estado: string }>

    if (!filas.length) {
      const [fila] = (await sql`
        SELECT estado, (jsonb_typeof(desglose_venta) = 'object'
          AND coalesce((desglose_venta ->> 'superaCapacidad')::boolean, false)) AS supera,
          CASE WHEN jsonb_typeof(desglose_venta -> 'pasosMenuFaltantes') = 'array'
            THEN desglose_venta -> 'pasosMenuFaltantes' END AS faltantes,
          (to_jsonb(cotizaciones) ->> 'origen_cliente') AS origen
        FROM cotizaciones WHERE id = ${id}
      `) as unknown as Array<{ estado: string; supera: boolean | null; faltantes: unknown; origen?: string | null }>
      if (fila?.supera && ["borrador", "rechazada"].includes(fila.estado)) {
        return NextResponse.json(
          { ok: false, error: "Supera la capacidad del salón: abrila y bajá la cantidad de invitados o cambiá de salón" },
          { status: 400 },
        )
      }
      const faltantes = listaDeTextos(fila?.faltantes)
      if (fila && faltantes.length > 0 && ["borrador", "rechazada"].includes(fila.estado)) {
        return NextResponse.json(
          { ok: false, error: `Falta elegir ${textoPasosFaltantes(faltantes)} del menú: abrila y completala` },
          { status: 400 },
        )
      }
      if (fila && !fila.origen && ["borrador", "rechazada"].includes(fila.estado)) {
        return NextResponse.json(
          { ok: false, error: "Falta elegir cómo nos conoció: abrila y completalo" },
          { status: 400 },
        )
      }
      return NextResponse.json(
        { ok: false, error: "Esta cotización no se puede enviar en su estado actual" },
        { status: 409 },
      )
    }
    return NextResponse.json({ ok: true, id: filas[0].id, estado: filas[0].estado })
  } catch (err) {
    console.error("[API] Error en vendedor/cotizaciones/[id]/enviar:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
