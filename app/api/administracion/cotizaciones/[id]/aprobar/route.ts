export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { soloAdministracion } from "@/lib/solo-administracion"
import { ID_BARRA_PERSONALIZADA } from "@/lib/precio-barra"

/**
 * tragosPorPersona de la barra del evento: el valor que usa el planificador
 * por defecto (y 114 de los 117 eventos con barra). El costo de la barra NO
 * lo usa: calcularComprasBarras() cuenta 1 trago de cada cóctel por adulto,
 * que es la misma regla de "paquete" con la que se cotizó la barra.
 */
const TRAGOS_POR_PERSONA_EVENTO = 2

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
 * Modelo nuevo (servicios_elegidos.version 2, cotizador costo + ganancia
 * por salón):
 *   - la barra armada elegida pasa con sus cócteles reales (los de la
 *     plantilla al momento de cotizar), así el planificador calcula el costo
 *     de insumos como en cualquier evento;
 *   - las recetas del menú van a adultos Y a niños (la cocina se cotizó por
 *     adultos + niños). PENDIENTE de revisar con el negocio;
 *   - el DNI y el nombre del cliente van a evento.contrato.
 * Las cotizaciones viejas se aprueban como antes, con su precio guardado.
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
  cliente_dni: string | null
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
  const prohibido = await soloAdministracion(req)
  if (prohibido) return prohibido
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
                nombre_festejados, cliente_dni, invitados, servicios_elegidos, precio_venta_sugerido, costos_internos, estado
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
    const modeloNuevo = Number(serviciosElegidos.version) === 2
    // La línea "Barra personalizada" no es un servicio del catálogo: no se
    // copia a evento.servicios; sus cócteles pasan a evento.barras (abajo).
    const servicios = (Array.isArray(serviciosElegidos.servicios) ? serviciosElegidos.servicios : []).filter(
      (s: { servicioId?: string }) => s.servicioId !== ID_BARRA_PERSONALIZADA,
    )
    const costosInternos = parseJson(c.costos_internos) || {}
    // Barra personalizada: el evento nace con esos cócteles cargados, así el
    // costo, la lista de compras, Caja Eventos y la 🍺 de Barra funcionan como
    // en cualquier evento. La clásica queda como servicio BARRA CLÁSICA y sin
    // cócteles: Administración los agrega después en el planificador.
    // Cotizaciones viejas (sin `barra`) se aprueban igual que antes.
    const coctelesBarra: string[] =
      serviciosElegidos.barra?.tipo === "personalizada" && Array.isArray(serviciosElegidos.barra.cocteles)
        ? serviciosElegidos.barra.cocteles.filter((x: unknown) => typeof x === "string")
        : []
    // Modelo nuevo: barra armada → sus cócteles y la plantilla de la que salen.
    const barraArmada =
      modeloNuevo && serviciosElegidos.barra?.tipo === "armada" && Array.isArray(serviciosElegidos.barra.cocteles)
        ? {
            barraTemplateId: String(serviciosElegidos.barra.barraTemplateId || ""),
            cocteles: serviciosElegidos.barra.cocteles.filter((x: unknown) => typeof x === "string") as string[],
          }
        : null
    // Mismo formato que cualquier evento (BarraEvento de lib/store.ts); POST
    // /api/eventos lo guarda igual que a todos (JSON.stringify).
    const barrasEvento = barraArmada?.cocteles.length
      ? [
          {
            id: crypto.randomUUID(),
            barraTemplateId: barraArmada.barraTemplateId,
            coctelesIncluidos: barraArmada.cocteles,
            tragosPorPersona: TRAGOS_POR_PERSONA_EVENTO,
          },
        ]
      : coctelesBarra.length
        ? [{ id: crypto.randomUUID(), barraTemplateId: "", coctelesIncluidos: coctelesBarra, tragosPorPersona: TRAGOS_POR_PERSONA_EVENTO }]
        : []

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

    // Precio de venta del evento = EXACTAMENTE el precio que se le cotizó al
    // cliente (precio_venta_sugerido, calculado por lib/tarifario-cotizador.ts
    // al guardar la cotización). Ya no se recalcula acá: lo que se firmó con
    // el cliente es lo que entra al evento, y el evento queda marcado con
    // precio_venta_fijo para que tampoco se recalcule después al editarlo
    // (ver app/evento/page.tsx). Si Administración quiere otro número, lo
    // cambia a mano a propósito desde el planificador.
    const precioVentaCotizado = Number(c.precio_venta_sugerido) || 0

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
      // Modelo nuevo: el menú elegido va también a niños (ver cabecera).
      recetasNinos: modeloNuevo
        ? Array.isArray(recetas.adultos) ? recetas.adultos : []
        : Array.isArray(recetas.ninos) ? recetas.ninos : [],
      recetasDietasEspeciales: Array.isArray(recetas.dietasEspeciales) ? recetas.dietasEspeciales : [],
      servicios: servicios.map((s: { servicioId: string; nombre: string; unidad: string; cantidad: number }) => ({
        servicioId: s.servicioId,
        nombre: s.nombre,
        unidad: s.unidad,
        cantidad: s.cantidad || 1,
      })),
      barras: barrasEvento,
      precioVenta: precioVentaCotizado,
      precioVentaFijo: true,
      cotizacionId: id,
      costoServicios: Number(costosInternos.totalCostoServicios) || 0,
      personalEvento,
      contrato: {
        vendedor,
        telefono: c.cliente_telefono || undefined,
        // Solo modelo nuevo: las viejas se aprueban exactamente como antes.
        nombreCompleto: modeloNuevo ? c.cliente_nombre || undefined : undefined,
        dni: modeloNuevo ? c.cliente_dni || undefined : undefined,
      },
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
