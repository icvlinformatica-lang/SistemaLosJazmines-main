export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

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

function usuarioDesdeCookie(req: Request): string {
  const raw = req.headers.get("cookie") || ""
  const match = raw.match(/(?:^|;\s*)lj_usuario=([^;]+)/)
  if (!match) return "Vendedor"
  try {
    return decodeURIComponent(match[1]).trim() || "Vendedor"
  } catch {
    return "Vendedor"
  }
}

interface ServicioCatalogo {
  id: string
  nombre: string
  unidad: string
  precio_venta: number
  costo_para_caja_eventos: number
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
    } = body || {}

    if (typeof clienteNombre !== "string" || !clienteNombre.trim()) {
      return NextResponse.json({ ok: false, error: "Falta el nombre del cliente" }, { status: 400 })
    }

    const vendedor = usuarioDesdeCookie(req)

    // Traer el catálogo real de servicios (tabla chica) y calcular en base a
    // eso — el mismo criterio que usa app/evento/page.tsx: "Fijo"/"Por
    // Persona" cobran precioVenta tal cual, "Por Hora"/"Por Cantidad" lo
    // multiplican por la cantidad cargada (mínimo 1).
    const catalogoServicios = (await sql`
      SELECT id, nombre, unidad, precio_venta, costo_para_caja_eventos FROM servicios
    `) as unknown as ServicioCatalogo[]

    const seleccion: Array<{ servicioId: string; cantidad: number }> = Array.isArray(serviciosElegidos)
      ? serviciosElegidos
      : []

    let totalServicios = 0
    let totalCostoServicios = 0
    const serviciosDetalle: Array<{
      servicioId: string
      nombre: string
      unidad: string
      cantidad: number
      precioVenta: number
      precioTotal: number
    }> = []
    const costosServiciosDetalle: Array<{
      servicioId: string
      nombre: string
      cantidad: number
      costoTotal: number
    }> = []

    for (const item of seleccion) {
      const catalogo = catalogoServicios.find((s) => s.id === item.servicioId)
      if (!catalogo) continue
      const usaCantidad = catalogo.unidad === "Por Hora" || catalogo.unidad === "Por Cantidad"
      const cantidad = usaCantidad ? Math.max(1, Number(item.cantidad) || 1) : 1
      const precioVenta = Number(catalogo.precio_venta) || 0
      const costoBase = Number(catalogo.costo_para_caja_eventos) || 0
      const precioTotal = precioVenta * cantidad
      const costoTotal = costoBase * cantidad

      totalServicios += precioTotal
      totalCostoServicios += costoTotal

      serviciosDetalle.push({
        servicioId: catalogo.id,
        nombre: catalogo.nombre,
        unidad: catalogo.unidad,
        cantidad,
        precioVenta,
        precioTotal,
      })
      costosServiciosDetalle.push({
        servicioId: catalogo.id,
        nombre: catalogo.nombre,
        cantidad,
        costoTotal,
      })
    }

    // Precio base del salón para esa fecha (tabla precios_venta); si esa
    // fecha no tiene precio cargado, cae al precio base de respaldo por
    // salón (precios_base_salones, configurado en Eventos > Cotizaciones)
    // en vez de salir en $0.
    let precioBaseSalon = 0
    if (salon && fechaEvento) {
      const filas = (await sql`
        SELECT precio FROM precios_venta WHERE salon = ${salon} AND fecha = ${fechaEvento} LIMIT 1
      `) as unknown as Array<{ precio: number }>
      precioBaseSalon = filas.length ? Number(filas[0].precio) || 0 : 0
    }
    if (!precioBaseSalon && salon) {
      const filasBase = (await sql`
        SELECT precio FROM precios_base_salones WHERE salon = ${salon} LIMIT 1
      `) as unknown as Array<{ precio: number }>
      precioBaseSalon = filasBase.length ? Number(filasBase[0].precio) || 0 : 0
    }

    const precioVentaSugerido = precioBaseSalon + totalServicios

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
    })

    const costosInternosJson = JSON.stringify({
      precioBaseSalon,
      servicios: costosServiciosDetalle,
      totalCostoServicios,
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
      return NextResponse.json({ ok: true, id: filas[0].id, estado: filas[0].estado, precioVentaSugerido })
    }

    const filas = (await sql`
      INSERT INTO cotizaciones (
        vendedor, cliente_nombre, cliente_telefono, fecha_evento, salon, tipo_evento,
        nombre_festejados, horario, horario_fin, paquete_id,
        invitados, servicios_elegidos, precio_venta_sugerido, costos_internos
      ) VALUES (
        ${vendedor}, ${clienteNombre.trim()}, ${clienteTelefono || null}, ${fechaEvento || null}, ${salon || null}, ${tipoEvento || null},
        ${nombreFestejados || null}, ${horario || null}, ${horarioFin || null}, ${paqueteId || null},
        ${invitadosJson}::jsonb, ${serviciosElegidosJson}::jsonb, ${precioVentaSugerido}, ${costosInternosJson}::jsonb
      )
      RETURNING id, estado
    `) as unknown as Array<{ id: string; estado: string }>

    return NextResponse.json({ ok: true, id: filas[0].id, estado: filas[0].estado, precioVentaSugerido })
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
