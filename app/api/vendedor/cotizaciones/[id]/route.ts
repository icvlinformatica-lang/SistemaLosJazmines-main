export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { usuarioDesdeCookie } from "@/lib/usuario-cookie"

/**
 * Trae una cotización completa para reabrirla en /vendedor/cotizar?id=...
 * (editar un borrador guardado, o corregir una que Administración rechazó).
 * Nunca devuelve costos_internos. El front decide si la deja editar según
 * el estado: "borrador"/"rechazada" son editables, el resto es solo lectura.
 */

interface CotizacionFila {
  id: string
  cliente_nombre: string
  cliente_telefono: string | null
  fecha_evento: string | null
  horario: string | null
  horario_fin: string | null
  salon: string | null
  tipo_evento: string | null
  nombre_festejados: string | null
  paquete_id: string | null
  invitados: unknown
  servicios_elegidos: unknown
  precio_venta_sugerido: number
  estado: string
  comentario_admin: string | null
}

function parseJson(raw: unknown): any {
  return typeof raw === "string" ? JSON.parse(raw) : raw
}

// Borra una cotización propia — pensado para "cargué mal esta cotización y
// no me sirve". Sin restricción de estado: incluso una ya aprobada
// ("convertida") se puede borrar del historial del vendedor sin que eso
// afecte al evento real ya creado (evento_id solo queda de referencia acá).
// No es un borrado definitivo: la fila se mueve a cotizaciones_eliminadas
// (misma info + eliminado_at/eliminado_por) para poder recuperarla después
// desde la papelera (ver /api/vendedor/papelera y .../papelera/cotizaciones).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const eliminadoPor = usuarioDesdeCookie(req)
    const filas = await sql`
      WITH movida AS (
        DELETE FROM cotizaciones WHERE id = ${id}
        RETURNING *
      )
      INSERT INTO cotizaciones_eliminadas (
        id, vendedor, cliente_nombre, cliente_telefono, fecha_evento, salon, tipo_evento,
        invitados, servicios_elegidos, paquete_id, precio_venta_sugerido, costos_internos,
        estado, comentario_admin, created_at, updated_at, nombre_festejados, horario, horario_fin,
        evento_id, eliminado_por
      )
      SELECT id, vendedor, cliente_nombre, cliente_telefono, fecha_evento, salon, tipo_evento,
        invitados, servicios_elegidos, paquete_id, precio_venta_sugerido, costos_internos,
        estado, comentario_admin, created_at, updated_at, nombre_festejados, horario, horario_fin,
        evento_id, ${eliminadoPor}
      FROM movida
      RETURNING id
    `
    if (!filas.length) {
      return NextResponse.json({ ok: false, error: "No se encontró la cotización" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[API] Error en vendedor/cotizaciones/[id] DELETE:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const filas = (await sql`
      SELECT id, cliente_nombre, cliente_telefono, fecha_evento, horario, horario_fin, salon, tipo_evento,
             nombre_festejados, paquete_id, invitados, servicios_elegidos, precio_venta_sugerido, estado, comentario_admin
      FROM cotizaciones
      WHERE id = ${id}
      LIMIT 1
    `) as unknown as CotizacionFila[]

    if (!filas.length) {
      return NextResponse.json({ ok: false, error: "No se encontró la cotización" }, { status: 404 })
    }

    const f = filas[0]
    const invitados = parseJson(f.invitados) || {}
    const serviciosElegidosData = parseJson(f.servicios_elegidos) || {}
    const recetasElegidas = serviciosElegidosData.recetas || {}
    const servicios = Array.isArray(serviciosElegidosData.servicios) ? serviciosElegidosData.servicios : []
    const personalSeleccionado = Array.isArray(serviciosElegidosData.personal) ? serviciosElegidosData.personal : []

    return NextResponse.json({
      ok: true,
      cotizacion: {
        id: f.id,
        clienteNombre: f.cliente_nombre,
        clienteTelefono: f.cliente_telefono || "",
        fechaEvento: f.fecha_evento || "",
        horario: f.horario || "",
        horarioFin: f.horario_fin || "",
        salon: f.salon || "",
        tipoEvento: f.tipo_evento || "",
        nombreFestejados: f.nombre_festejados || "",
        paqueteId: f.paquete_id,
        invitados: {
          adultos: Number(invitados.adultos) || 0,
          adolescentes: Number(invitados.adolescentes) || 0,
          ninos: Number(invitados.ninos) || 0,
          personasDietasEspeciales: Number(invitados.personasDietasEspeciales) || 0,
        },
        recetasElegidas: {
          adultos: Array.isArray(recetasElegidas.adultos) ? recetasElegidas.adultos : [],
          adolescentes: Array.isArray(recetasElegidas.adolescentes) ? recetasElegidas.adolescentes : [],
          ninos: Array.isArray(recetasElegidas.ninos) ? recetasElegidas.ninos : [],
          dietasEspeciales: Array.isArray(recetasElegidas.dietasEspeciales) ? recetasElegidas.dietasEspeciales : [],
        },
        serviciosElegidos: servicios.map((s: { servicioId: string; cantidad: number }) => ({
          servicioId: s.servicioId,
          cantidad: s.cantidad || 1,
        })),
        personalSeleccionado,
        precioVentaSugerido: Number(f.precio_venta_sugerido) || 0,
        estado: f.estado,
        comentarioAdmin: f.comentario_admin,
      },
    })
  } catch (err) {
    console.error("[API] Error en vendedor/cotizaciones/[id] GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
