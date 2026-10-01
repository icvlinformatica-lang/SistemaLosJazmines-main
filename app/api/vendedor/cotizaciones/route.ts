export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { usuarioDesdeCookie } from "@/lib/usuario-cookie"
import {
  calcularCotizacion,
  type DiaTarifario,
  type ModalidadSalon,
  type ServicioParaCotizar,
} from "@/lib/tarifario-cotizador"
import { calcularBarraPersonalizada, ID_BARRA_PERSONALIZADA } from "@/lib/precio-barra"
import { leerPreciosCocteles } from "@/lib/precio-barra-servidor"

/**
 * Alta/edición de cotizaciones (perfil Vendedor). El precio de venta
 * sugerido y los costos internos SIEMPRE se recalculan acá, del lado del
 * servidor, a partir del catálogo real — nunca se confía en un precio que
 * mande el cliente. costos_internos se guarda pero nunca viaja de vuelta
 * en la respuesta.
 *
 * POST nunca toca el estado (tanto "Guardar borrador" como "Generar
 * paquete" en /vendedor/cotizar pegan acá): una cotización nueva nace en
 * "borrador", y una que ya estaba "rechazada" (Administración pidió un
 * ajuste) se puede seguir editando y guardando sin perder ese estado hasta
 * que el vendedor la reenvía. Mandar a revisión es una acción aparte, ver
 * [id]/enviar/route.ts, que se dispara desde la tarjeta en
 * /vendedor/paquetes ("Mis cotizaciones generadas"), no desde esta pantalla.
 * Para reabrir una cotización guardada, ver [id]/route.ts (GET).
 *
 * body: {
 *   id?: string                     // si viene, actualiza (solo si sigue en "borrador" o "rechazada")
 *   clienteNombre: string
 *   clienteTelefono?: string
 *   fechaEvento?: string
 *   salon?: string
 *   tipoEvento?: string
 *   invitados: { adultos, adolescentes, ninos, personasDietasEspeciales }
 *   recetasElegidas: { adultos: string[], adolescentes: string[], ninos: string[], dietasEspeciales: string[] }
 *   serviciosElegidos: { servicioId: string, cantidad: number }[]
 * }
 *
 * GET devuelve "Mis cotizaciones generadas": las cotizaciones del vendedor
 * que entró con esta sesión (por nombre, vía cookie lj_usuario), saneadas
 * (nunca costos_internos).
 */

interface ServicioCatalogo {
  id: string
  nombre: string
  categoria: string
  unidad: string
  precio_venta: number
  costo_para_caja_eventos: number
}

interface FilaTarifarioDB {
  salon: string
  invitados_min: number
  invitados_max: number
  dia: DiaTarifario
  modalidad: ModalidadSalon
  precio: number
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      id,
      clienteNombre,
      clienteTelefono,
      fechaEvento,
      salon,
      tipoEvento,
      nombreFestejados,
      horario,
      horarioFin,
      paqueteId,
      invitados,
      recetasElegidas,
      serviciosElegidos,
      personalSeleccionado,
      modalidadSalon,
      barra,
    } = body || {}

    if (typeof clienteNombre !== "string" || !clienteNombre.trim()) {
      return NextResponse.json({ ok: false, error: "Falta el nombre del cliente" }, { status: 400 })
    }

    const vendedor = usuarioDesdeCookie(req)

    // El precio se recalcula SIEMPRE acá, con lib/tarifario-cotizador.ts —
    // la misma función que usa el preview de /vendedor/cotizar, así el
    // vendedor nunca ve un número distinto del que queda guardado. Nunca se
    // confía en un precio que mande el cliente.
    const [catalogoServicios, tarifarioDB, preciosVentaDB, incluidosDB] = (await Promise.all([
      sql`SELECT id, nombre, categoria, unidad, precio_venta, costo_para_caja_eventos FROM servicios`,
      sql`SELECT salon, invitados_min, invitados_max, dia, modalidad, precio FROM tarifario_salon`,
      sql`SELECT salon, fecha, precio FROM precios_venta`,
      sql`SELECT servicio_id FROM salon_incluye_servicio`,
    ])) as unknown as [
      ServicioCatalogo[],
      FilaTarifarioDB[],
      Array<{ salon: string; fecha: string; precio: number }>,
      Array<{ servicio_id: string }>,
    ]

    const seleccion: Array<{ servicioId: string; cantidad: number }> = Array.isArray(serviciosElegidos)
      ? serviciosElegidos
      : []

    const totalInvitados =
      (Number(invitados?.adultos) || 0) +
      (Number(invitados?.adolescentes) || 0) +
      (Number(invitados?.ninos) || 0) +
      (Number(invitados?.personasDietasEspeciales) || 0)

    const modalidad: ModalidadSalon = modalidadSalon === "con_catering" ? "con_catering" : "solo_salon"

    const preciosVentaMap: Record<string, Record<string, number>> = {}
    for (const row of preciosVentaDB) {
      preciosVentaMap[row.salon] = preciosVentaMap[row.salon] || {}
      preciosVentaMap[row.salon][row.fecha] = Number(row.precio) || 0
    }

    // Barra: "clasica" es el servicio BARRA CLÁSICA (ya viene en la selección
    // de servicios); "personalizada" son cócteles elegidos, con precio que se
    // recalcula acá con la carta real (lib/precio-barra.ts). Solo se aceptan
    // cócteles que existen en la carta.
    const tipoBarra: "clasica" | "personalizada" | null =
      barra?.tipo === "clasica" || barra?.tipo === "personalizada" ? barra.tipo : null
    const pedidos: string[] = Array.isArray(barra?.cocteles) ? barra.cocteles.filter((x: unknown) => typeof x === "string") : []
    const cartaBarra = tipoBarra === "personalizada" ? await leerPreciosCocteles() : []
    const coctelesBarra = cartaBarra.filter((c) => pedidos.includes(c.id))
    const adultos = Number(invitados?.adultos) || 0

    const calculo = calcularCotizacion({
      salon: salon || "",
      fechaEvento: fechaEvento || "",
      modalidad,
      totalInvitados,
      serviciosElegidos: seleccion,
      catalogoServicios: catalogoServicios.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        categoria: s.categoria,
        unidad: s.unidad,
        precioVenta: Number(s.precio_venta) || 0,
      })) as ServicioParaCotizar[],
      tarifario: tarifarioDB.map((t) => ({
        salon: t.salon,
        invitadosMin: Number(t.invitados_min) || 0,
        invitadosMax: Number(t.invitados_max) || 0,
        dia: t.dia,
        modalidad: t.modalidad,
        precio: Number(t.precio) || 0,
      })),
      preciosVenta: preciosVentaMap,
      serviciosIncluidosSalon: incluidosDB.map((r) => r.servicio_id),
      barraPersonalizada:
        tipoBarra === "personalizada"
          ? { cocteles: coctelesBarra.map((c) => ({ id: c.id, nombre: c.nombre, precioPorTrago: c.precioPorTrago })), adultos }
          : undefined,
    })

    const serviciosDetalle = calculo.servicios.map((s) => ({
      servicioId: s.servicioId,
      nombre: s.nombre,
      categoria: s.categoria,
      unidad: s.unidad,
      cantidad: s.cantidad,
      precioVenta: s.precioUnitario,
      precioTotal: s.precioTotal,
      incluidoEnPaquete: s.incluidoEnPaquete,
      motivoIncluido: s.motivoIncluido,
    }))

    // Costo interno con la MISMA cantidad que la venta (un menú por persona
    // cuesta por persona). Es solo informativo para Administración: el costo
    // real del evento se sigue calculando en vivo (Caja Eventos).
    // La barra personalizada no es un servicio del catálogo: su costo va
    // aparte (costoBarraPersonalizada), porque totalCostoServicios se copia al
    // evento al aprobar y ahí el costo de la barra ya sale de sus cócteles.
    const costosServiciosDetalle = calculo.servicios
      .filter((s) => s.servicioId !== ID_BARRA_PERSONALIZADA)
      .map((s) => {
        const cat = catalogoServicios.find((c) => c.id === s.servicioId)
        return {
          servicioId: s.servicioId,
          nombre: s.nombre,
          cantidad: s.cantidad,
          costoTotal: (Number(cat?.costo_para_caja_eventos) || 0) * s.cantidad,
        }
      })
    const totalCostoServicios = costosServiciosDetalle.reduce((sum, c) => sum + c.costoTotal, 0)
    // Costo interno de la barra personalizada con la MISMA cantidad de tragos
    // que el precio (informativo, para la ganancia estimada de la bandeja).
    const costoBarraPersonalizada =
      tipoBarra === "personalizada" && coctelesBarra.length > 0
        ? Math.round(
            calcularBarraPersonalizada(coctelesBarra.map((c) => c.costoPorTrago), adultos).total,
          )
        : 0

    const precioBaseSalon = calculo.precioSalon
    const precioVentaSugerido = calculo.total

    const invitadosJson = JSON.stringify({
      adultos: Number(invitados?.adultos) || 0,
      adolescentes: Number(invitados?.adolescentes) || 0,
      ninos: Number(invitados?.ninos) || 0,
      personasDietasEspeciales: Number(invitados?.personasDietasEspeciales) || 0,
    })

    // "personal" acá son solo IDs del roster (Finanzas → Personal) que el
    // vendedor marcó como necesarios — nunca un monto, eso lo define
    // Administración al aprobar (ver [id]/aprobar/route.ts).
    const personalIds: string[] = Array.isArray(personalSeleccionado)
      ? personalSeleccionado.filter((x: unknown) => typeof x === "string")
      : []

    const serviciosElegidosJson = JSON.stringify({
      recetas: {
        adultos: Array.isArray(recetasElegidas?.adultos) ? recetasElegidas.adultos : [],
        adolescentes: Array.isArray(recetasElegidas?.adolescentes) ? recetasElegidas.adolescentes : [],
        ninos: Array.isArray(recetasElegidas?.ninos) ? recetasElegidas.ninos : [],
        dietasEspeciales: Array.isArray(recetasElegidas?.dietasEspeciales) ? recetasElegidas.dietasEspeciales : [],
      },
      servicios: serviciosDetalle,
      personal: personalIds,
      // Qué barra eligió y, si es personalizada, qué cócteles (al aprobar se
      // cargan como la barra del evento).
      barra: tipoBarra ? { tipo: tipoBarra, cocteles: coctelesBarra.map((c) => c.id) } : null,
    })

    // Desglose de venta: de dónde salió cada peso del precio sugerido, para
    // que Administración lo vea tal cual al revisar la cotización.
    const desgloseVentaJson = JSON.stringify({
      modalidad,
      totalInvitados,
      precioSalon: calculo.precioSalon,
      origenPrecioSalon: calculo.origenPrecioSalon,
      servicios: serviciosDetalle,
      totalServicios: calculo.totalServicios,
      total: calculo.total,
    })

    const costosInternosJson = JSON.stringify({
      precioBaseSalon,
      servicios: costosServiciosDetalle,
      totalCostoServicios,
      costoBarraPersonalizada,
      // Nota: no incluye costo de insumos/recetas (comida) — esta etapa
      // solo calcula el costo interno de los servicios contratados.
    })

    if (id) {
      const filas = (await sql`
        UPDATE cotizaciones SET
          cliente_nombre = ${clienteNombre.trim()},
          cliente_telefono = ${clienteTelefono || null},
          fecha_evento = ${fechaEvento || null},
          salon = ${salon || null},
          tipo_evento = ${tipoEvento || null},
          nombre_festejados = ${nombreFestejados || null},
          horario = ${horario || null},
          horario_fin = ${horarioFin || null},
          paquete_id = ${paqueteId || null},
          invitados = ${invitadosJson}::jsonb,
          servicios_elegidos = ${serviciosElegidosJson}::jsonb,
          precio_venta_sugerido = ${precioVentaSugerido},
          costos_internos = ${costosInternosJson}::jsonb,
          modalidad_salon = ${modalidad},
          desglose_venta = ${desgloseVentaJson}::jsonb,
          fuera_de_tarifario = ${calculo.fueraDeTarifario},
          avisos = ${JSON.stringify(calculo.avisos)}::jsonb,
          updated_at = now()
        WHERE id = ${id} AND estado IN ('borrador', 'rechazada')
        RETURNING id, estado
      `) as unknown as Array<{ id: string; estado: string }>

      if (!filas.length) {
        return NextResponse.json(
          { ok: false, error: "Esta cotización ya no se puede editar (Administración ya la está revisando o ya fue procesada)" },
          { status: 409 },
        )
      }
      return NextResponse.json({ ok: true, id: filas[0].id, estado: filas[0].estado, precioVentaSugerido, fueraDeTarifario: calculo.fueraDeTarifario, avisos: calculo.avisos })
    }

    const filas = (await sql`
      INSERT INTO cotizaciones (
        vendedor, cliente_nombre, cliente_telefono, fecha_evento, salon, tipo_evento,
        nombre_festejados, horario, horario_fin, paquete_id,
        invitados, servicios_elegidos, precio_venta_sugerido, costos_internos,
        modalidad_salon, desglose_venta, fuera_de_tarifario, avisos
      ) VALUES (
        ${vendedor}, ${clienteNombre.trim()}, ${clienteTelefono || null}, ${fechaEvento || null}, ${salon || null}, ${tipoEvento || null},
        ${nombreFestejados || null}, ${horario || null}, ${horarioFin || null}, ${paqueteId || null},
        ${invitadosJson}::jsonb, ${serviciosElegidosJson}::jsonb, ${precioVentaSugerido}, ${costosInternosJson}::jsonb,
        ${modalidad}, ${desgloseVentaJson}::jsonb, ${calculo.fueraDeTarifario}, ${JSON.stringify(calculo.avisos)}::jsonb
      )
      RETURNING id, estado
    `) as unknown as Array<{ id: string; estado: string }>

    return NextResponse.json({ ok: true, id: filas[0].id, estado: filas[0].estado, precioVentaSugerido, fueraDeTarifario: calculo.fueraDeTarifario, avisos: calculo.avisos })
  } catch (err) {
    console.error("[API] Error en vendedor/cotizaciones:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

interface CotizacionFila {
  id: string
  cliente_nombre: string
  cliente_telefono: string | null
  fecha_evento: string | null
  salon: string | null
  tipo_evento: string | null
  nombre_festejados: string | null
  invitados: unknown
  precio_venta_sugerido: number
  estado: string
  comentario_admin: string | null
  updated_at: string
}

// El driver a veces entrega jsonb como string sin parsear (ver mismo caso
// en /api/vendedor/paquetes) — se parsea defensivamente.
function parseInvitados(raw: unknown): { adultos: number; adolescentes: number; ninos: number; personasDietasEspeciales: number } {
  const obj = typeof raw === "string" ? JSON.parse(raw) : raw
  return {
    adultos: Number(obj?.adultos) || 0,
    adolescentes: Number(obj?.adolescentes) || 0,
    ninos: Number(obj?.ninos) || 0,
    personasDietasEspeciales: Number(obj?.personasDietasEspeciales) || 0,
  }
}

export async function GET(req: Request) {
  try {
    const vendedor = usuarioDesdeCookie(req)
    const filas = (await sql`
      SELECT id, cliente_nombre, cliente_telefono, fecha_evento, salon, tipo_evento, nombre_festejados,
             invitados, precio_venta_sugerido, estado, comentario_admin, updated_at
      FROM cotizaciones
      WHERE vendedor = ${vendedor}
      ORDER BY updated_at DESC
    `) as unknown as CotizacionFila[]

    return NextResponse.json({
      ok: true,
      cotizaciones: filas.map((f) => {
        const invitados = parseInvitados(f.invitados)
        return {
          id: f.id,
          clienteNombre: f.cliente_nombre,
          clienteTelefono: f.cliente_telefono,
          fechaEvento: f.fecha_evento,
          salon: f.salon,
          tipoEvento: f.tipo_evento,
          nombreFestejados: f.nombre_festejados,
          totalPersonas: invitados.adultos + invitados.adolescentes + invitados.ninos + invitados.personasDietasEspeciales,
          precioVentaSugerido: Number(f.precio_venta_sugerido) || 0,
          estado: f.estado,
          comentarioAdmin: f.comentario_admin,
          updatedAt: f.updated_at,
        }
      }),
    })
  } catch (err) {
    console.error("[API] Error en vendedor/cotizaciones GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
