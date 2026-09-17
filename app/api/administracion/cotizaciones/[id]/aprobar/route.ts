export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * "Aprobar" (Etapa 5): crea el evento real a partir de la cotización.
 *
 * A propósito NO reimplementa el INSERT a "eventos": arma el mismo payload
 * camelCase que usa app/evento/page.tsx y pega contra el POST /api/eventos
 * que ya existe y ya está probado (valida el año, registra actividad y
 * manda el mail de "evento creado") — así el evento nuevo se crea
 * exactamente igual que si Administración lo hubiera cargado a mano.
 *
 * Solo trae del lado del servidor lo que hace falta para completar el
 * evento (recetas/servicios ya elegidos, costo de servicios ya calculado)
 * — nunca confía en nada que no sea el "vendedor" elegido a mano en el body.
 *
 * Deja la cotización en "convertida" con evento_id apuntando al nuevo
 * evento — no se borra, queda como historial.
 */

function parseJson(raw: unknown): any {
  if (raw === null || raw === undefined) return null
  return typeof raw === "string" ? JSON.parse(raw) : raw
}

interface CotizacionFila {
  id: string
  cliente_nombre: string
  fecha_evento: string | null
  horario: string | null
  horario_fin: string | null
  salon: string | null
  tipo_evento: string | null
  nombre_festejados: string | null
  invitados: unknown
  servicios_elegidos: unknown
  precio_venta_sugerido: number
  costos_internos: unknown
  estado: string
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const vendedor = typeof body.vendedor === "string" ? body.vendedor.trim() : ""

    if (!vendedor) {
      return NextResponse.json({ ok: false, error: "Elegí el vendedor para la comisión" }, { status: 400 })
    }

    const filas = (await sql`
      SELECT id, cliente_nombre, fecha_evento, horario, horario_fin, salon, tipo_evento,
             nombre_festejados, invitados, servicios_elegidos, precio_venta_sugerido, costos_internos, estado
      FROM cotizaciones
      WHERE id = ${id}
    `) as unknown as CotizacionFila[]

    if (!filas.length) {
      return NextResponse.json({ ok: false, error: "No se encontró la cotización" }, { status: 404 })
    }
    const c = filas[0]
    if (c.estado !== "lista_para_revisar") {
      return NextResponse.json({ ok: false, error: "Esta cotización ya no está en revisión" }, { status: 409 })
    }

    const invitados = parseJson(c.invitados) || {}
    const serviciosElegidos = parseJson(c.servicios_elegidos) || {}
    const recetas = serviciosElegidos.recetas || {}
    const servicios = Array.isArray(serviciosElegidos.servicios) ? serviciosElegidos.servicios : []
    const costosInternos = parseJson(c.costos_internos) || {}

    const eventoId = crypto.randomUUID()
    const eventoPayload = {
      id: eventoId,
      nombre: c.nombre_festejados || c.cliente_nombre,
      nombrePareja: c.nombre_festejados || "",
      fecha: c.fecha_evento || "",
      horario: c.horario || "",
      horarioFin: c.horario_fin || "",
      salon: c.salon || undefined,
      tipoEvento: c.tipo_evento || undefined,
      adultos: Number(invitados.adultos) || 0,
      adolescentes: Number(invitados.adolescentes) || 0,
      ninos: Number(invitados.ninos) || 0,
      personasDietasEspeciales: Number(invitados.personasDietasEspeciales) || 0,
      recetasAdultos: Array.isArray(recetas.adultos) ? recetas.adultos : [],
      recetasAdolescentes: Array.isArray(recetas.adolescentes) ? recetas.adolescentes : [],
      recetasNinos: Array.isArray(recetas.ninos) ? recetas.ninos : [],
      recetasDietasEspeciales: Array.isArray(recetas.dietasEspeciales) ? recetas.dietasEspeciales : [],
      servicios: servicios.map((s: { servicioId: string; nombre: string; unidad: string; cantidad: number }) => ({
        servicioId: s.servicioId,
        nombre: s.nombre,
        unidad: s.unidad,
        cantidad: s.cantidad || 1,
      })),
      precioVenta: Number(c.precio_venta_sugerido) || 0,
      costoServicios: Number(costosInternos.totalCostoServicios) || 0,
      contrato: { vendedor },
      notasInternas: `Convertido desde una cotización generada por ${vendedor}.`,
    }

    // Reusa el POST /api/eventos ya probado (valida año, activity log, mail) en
    // vez de reimplementar el INSERT — misma sesión del admin que aprueba.
    const eventosRes = await fetch(new URL("/api/eventos", req.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") || "",
        "x-lj-session": req.headers.get("x-lj-session") || "",
      },
      body: JSON.stringify(eventoPayload),
    })
    const eventoData = await eventosRes.json().catch(() => ({}))
    if (!eventosRes.ok) {
      return NextResponse.json(
        { ok: false, error: eventoData?.error || "No se pudo crear el evento (revisá que la cotización tenga fecha válida)" },
        { status: eventosRes.status },
      )
    }

    await sql`
      UPDATE cotizaciones SET estado = 'convertida', evento_id = ${eventoId}, updated_at = now()
      WHERE id = ${id}
    `

    return NextResponse.json({ ok: true, eventoId, eventoNombre: eventoData.nombre })
  } catch (err) {
    console.error("[API] Error en administracion/cotizaciones/[id]/aprobar:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
