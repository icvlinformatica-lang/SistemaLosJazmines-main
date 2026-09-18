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
 *
 * Anti-duplicados: antes de crear el evento se "reserva" la cotización
 * pasándola de "lista_para_revisar" a "aprobada" en un solo UPDATE
 * condicional (atómico en Postgres). Si dos aprobaciones llegan juntas (dos
 * pestañas, dos personas), solo una gana la reserva; la otra recibe 409 y no
 * crea nada. "aprobada" es el estado transitorio "se está aprobando" — no se
 * puede usar evento_id como reserva porque tiene FK a eventos. Si la creación
 * del evento falla (y el evento de verdad no quedó creado), se devuelve a
 * "lista_para_revisar" para poder reintentar.
 */

function parseJson(raw: unknown): any {
  if (raw === null || raw === undefined) return null
  return typeof raw === "string" ? JSON.parse(raw) : raw
}

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
  invitados: unknown
  servicios_elegidos: unknown
  precio_venta_sugerido: number
  costos_internos: unknown
  estado: string
}

interface PersonalEventoBody {
  personalId: string
  nombre: string
  funcion: string
  monto: number
}

interface PersonalRosterFila {
  id: string
  tarifa_base: number
}

// Devuelve la cotización a revisión cuando la aprobación no llegó a crear el
// evento. Si el evento sí quedó creado (ej. la respuesta de /api/eventos se
// cortó pero el INSERT entró), NO se devuelve — así no se puede aprobar de
// nuevo y duplicarlo; queda enlazada a ese evento como "convertida".
async function liberarReserva(id: string, eventoId: string) {
  try {
    const existe = (await sql`SELECT 1 FROM eventos WHERE id = ${eventoId} LIMIT 1`) as unknown as unknown[]
    if (existe.length) {
      await sql`
        UPDATE cotizaciones SET estado = 'convertida', evento_id = ${eventoId}, updated_at = now()
        WHERE id = ${id} AND estado = 'aprobada'
      `
      return
    }
    await sql`
      UPDATE cotizaciones SET estado = 'lista_para_revisar', updated_at = now()
      WHERE id = ${id} AND estado = 'aprobada'
    `
  } catch (err) {
    console.error("[API] No se pudo liberar la reserva de la cotización", id, err)
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let reservada: { id: string; eventoId: string } | null = null
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const vendedor = typeof body.vendedor === "string" ? body.vendedor.trim() : ""
    const personalEventoBody: PersonalEventoBody[] = Array.isArray(body.personalEvento) ? body.personalEvento : []
    // Corrección opcional de la fecha antes de crear el evento — para cuando
    // el vendedor la dejó vacía o la tipeó mal (año fuera de rango) y
    // Administración la arregla acá mismo en vez de tener que rechazar la
    // cotización solo por eso. Si viene, también se guarda en la cotización.
    const fechaEventoOverride = typeof body.fechaEvento === "string" ? body.fechaEvento.trim() : undefined

    if (!vendedor) {
      return NextResponse.json({ ok: false, error: "Elegí el vendedor para la comisión" }, { status: 400 })
    }

    // Reserva atómica: solo una aprobación puede pasar de acá (ver cabecera).
    const filas = (await sql`
      UPDATE cotizaciones SET estado = 'aprobada', updated_at = now()
      WHERE id = ${id} AND estado = 'lista_para_revisar'
      RETURNING id, cliente_nombre, cliente_telefono, fecha_evento, horario, horario_fin, salon, tipo_evento,
                nombre_festejados, invitados, servicios_elegidos, precio_venta_sugerido, costos_internos, estado
    `) as unknown as CotizacionFila[]

    if (!filas.length) {
      const existe = (await sql`SELECT 1 FROM cotizaciones WHERE id = ${id} LIMIT 1`) as unknown as unknown[]
      if (!existe.length) {
        return NextResponse.json({ ok: false, error: "No se encontró la cotización" }, { status: 404 })
      }
      return NextResponse.json(
        { ok: false, error: "Esta cotización ya no está en revisión (puede que otra persona la esté aprobando)" },
        { status: 409 },
      )
    }
    const c = filas[0]
    const eventoId = crypto.randomUUID()
    reservada = { id, eventoId }

    const invitados = parseJson(c.invitados) || {}
    const serviciosElegidos = parseJson(c.servicios_elegidos) || {}
    const recetas = serviciosElegidos.recetas || {}
    const servicios = Array.isArray(serviciosElegidos.servicios) ? serviciosElegidos.servicios : []
    const costosInternos = parseJson(c.costos_internos) || {}

    // El vendedor solo eligió ROLES (sin montos, ver /api/vendedor/catalogo).
    // Acá Administración ya definió el monto de cada uno en el body — se
    // compara contra la tarifa vigente del roster para decidir si queda
    // "personalizado" (fijo) o sigue la tarifa base en vivo, mismo criterio
    // que usa app/evento/page.tsx (togglePersonalEvento/updateMontoPersonalEvento).
    let personalEvento: Array<{
      id: string
      personalId: string
      nombre: string
      funcion: string
      monto: number
      montoPersonalizado: boolean
    }> = []
    if (personalEventoBody.length > 0) {
      const roster = (await sql`
        SELECT id, tarifa_base FROM personal WHERE id = ANY(${personalEventoBody.map((p) => p.personalId)})
      `) as unknown as PersonalRosterFila[]
      personalEvento = personalEventoBody.map((p) => {
        const tarifaVigente = Number(roster.find((r) => r.id === p.personalId)?.tarifa_base) || 0
        return {
          id: crypto.randomUUID(),
          personalId: p.personalId,
          nombre: p.nombre,
          funcion: p.funcion,
          monto: Number(p.monto) || 0,
          montoPersonalizado: Number(p.monto) !== tarifaVigente,
        }
      })
    }

    const fechaEvento = fechaEventoOverride !== undefined ? fechaEventoOverride : c.fecha_evento || ""

    const eventoPayload = {
      id: eventoId,
      nombre: c.nombre_festejados || c.cliente_nombre,
      nombrePareja: c.nombre_festejados || "",
      fecha: fechaEvento,
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
      personalEvento,
      contrato: { vendedor, telefono: c.cliente_telefono || undefined },
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
      await liberarReserva(id, eventoId)
      reservada = null
      const mensaje: string = eventoData?.error || "No se pudo crear el evento (revisá que la cotización tenga fecha válida)"
      const esErrorDeFecha = /año|fecha/i.test(mensaje)
      return NextResponse.json({ ok: false, error: mensaje, errorDeFecha: esErrorDeFecha }, { status: eventosRes.status })
    }

    // A partir de acá el evento YA existe: pase lo que pase, la cotización
    // no vuelve a revisión (liberarReserva detecta el evento y la cierra).
    if (fechaEventoOverride !== undefined) {
      await sql`UPDATE cotizaciones SET fecha_evento = ${fechaEvento || null}, updated_at = now() WHERE id = ${id}`
    }

    await sql`
      UPDATE cotizaciones SET estado = 'convertida', evento_id = ${eventoId}, updated_at = now()
      WHERE id = ${id} AND estado = 'aprobada'
    `
    reservada = null

    return NextResponse.json({ ok: true, eventoId, eventoNombre: eventoData.nombre })
  } catch (err) {
    console.error("[API] Error en administracion/cotizaciones/[id]/aprobar:", err)
    if (reservada) await liberarReserva(reservada.id, reservada.eventoId)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
