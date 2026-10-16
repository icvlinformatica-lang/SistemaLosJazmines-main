export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { usuarioDesdeCookie } from "@/lib/usuario-cookie"
import { cotizarEnServidor } from "@/lib/cotizacion-servidor"
import { textoPasosFaltantes } from "@/lib/cotizador-salon"
import { normalizarDietasDetalle } from "@/lib/dietas-evento"
import { normalizarOrigen } from "@/lib/origen-cliente"

/** jsonb de verdad (no texto). El tipo de sql.json no acepta objetos con
 *  campos opcionales/null anidados, así que se convierte en un solo lugar. */
const jsonb = (valor: unknown) => sql.json(valor as Parameters<typeof sql.json>[0])

/**
 * Alta/edición de cotizaciones (perfil Vendedor), modelo COSTO + GANANCIA
 * por salón (Paso 2, scripts/015 y 016). El precio SIEMPRE se recalcula acá
 * con lib/cotizacion-servidor.ts — nunca se confía en un precio que mande el
 * navegador.
 *
 * Al vendedor se le devuelve SOLO precios (total, precio por rubro, avisos
 * con su texto de vendedor). Costos y ganancias quedan en costos_internos y
 * desglose_venta, que el vendedor nunca recibe.
 *
 * accion:
 *   - "guardar" (default): guarda sin tocar el estado (nace en "borrador";
 *     una "rechazada" sigue rechazada hasta que se reenvía).
 *   - "enviar": guarda y pasa a "lista_para_revisar" en el mismo UPDATE. Si
 *     se supera la capacidad del salón, o si hay menú y falta un paso que el
 *     salón ofrece (entrada, plato principal o postre), se RECHAZA (400).
 *     Guardar el borrador con el menú incompleto sí se puede.
 * Una cotización solo se puede editar en "borrador" o "rechazada".
 *
 * body: {
 *   id?, accion?, clienteNombre, clienteDni?, clienteTelefono?, tipoEvento?, fechaEvento?,
 *   salon, adultos, ninos, recetas: string[], barraId: string | null,
 *   servicios: { servicioId, cantidad }[],
 *   dietasDetalle?: DietaDetalle[],   // parte de los adultos; no cambia el precio
 *   origenCliente?: string | null,    // "¿Cómo nos conoció?"; obligatorio para enviar
 * }
 *
 * Los JSON se guardan con sql.json (jsonb de verdad, no texto). Los que leen
 * cotizaciones aceptan los dos formatos (las viejas quedaron como texto).
 *
 * GET devuelve "Mis cotizaciones generadas" (sin costos).
 */
/** Enviar una cotización guardada sin "¿Cómo nos conoció?": se deshace todo. */
class FaltaOrigen extends Error {}

export async function POST(req: Request) {
  try {
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const { id, clienteNombre, clienteDni, tipoEvento, fechaEvento } = body
    const enviar = body.accion === "enviar"

    if (typeof clienteNombre !== "string" || !clienteNombre.trim()) {
      return NextResponse.json({ ok: false, error: "Falta el nombre del cliente" }, { status: 400 })
    }

    const adultos = Math.max(0, Math.floor(Number(body.adultos) || 0))
    const ninos = Math.max(0, Math.floor(Number(body.ninos) || 0))
    const calculo = await cotizarEnServidor({
      salon: typeof body.salon === "string" ? body.salon : "",
      fechaEvento: typeof fechaEvento === "string" ? fechaEvento : "",
      adultos,
      ninos,
      recetas: Array.isArray(body.recetas) ? (body.recetas as string[]) : [],
      barraId: typeof body.barraId === "string" && body.barraId ? body.barraId : null,
      barraIds: Array.isArray(body.barraIds) ? (body.barraIds as string[]) : undefined,
      servicios: Array.isArray(body.servicios) ? (body.servicios as Array<{ servicioId: string; cantidad: number }>) : [],
    })
    if (typeof calculo === "string") return NextResponse.json({ ok: false, error: calculo }, { status: 400 })
    const { resultado: r, config } = calculo

    if (enviar && r.superaCapacidad) {
      const aviso = r.avisos.find((a) => a.codigo === "capacidad")
      return NextResponse.json({ ok: false, error: aviso?.textoVendedor ?? "Supera la capacidad del salón" }, { status: 400 })
    }
    // "¿Cómo nos conoció?" (lib/origen-cliente.ts, scripts/022): se pide para
    // enviar. Si el pedido no lo trae (una pantalla abierta antes de este
    // cambio), al editar se conserva el guardado.
    const traeOrigen = "origenCliente" in body
    const origen = normalizarOrigen(body.origenCliente)
    if (enviar && traeOrigen && !origen) {
      return NextResponse.json({ ok: false, error: "Para enviarla falta elegir cómo nos conoció" }, { status: 400 })
    }
    // Dietas especiales por tipo: son parte de los adultos y se cobran igual,
    // así que no entran al cálculo. Viajan dentro de `invitados` hasta que se
    // aprueba (ver separarDietasDeAdultos en el aprobar).
    const dietasDetalle = normalizarDietasDetalle(body.dietasDetalle)
    if (dietasDetalle.reduce((s, d) => s + d.cantidad, 0) > adultos) {
      return NextResponse.json({ ok: false, error: "Las dietas especiales suman más que los adultos" }, { status: 400 })
    }

    if (enviar && calculo.pasosMenuFaltantes.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Para enviarla falta elegir ${textoPasosFaltantes(calculo.pasosMenuFaltantes)} del menú` },
        { status: 400 },
      )
    }

    const vendedor = usuarioDesdeCookie(req)
    const dni = typeof clienteDni === "string" && clienteDni.trim() ? clienteDni.trim() : null
    // Teléfono del cliente (opcional). Si el pedido no lo trae (una pantalla
    // abierta antes de este cambio), al editar se conserva el guardado en vez
    // de borrarlo; si lo trae vacío, se borra.
    const traeTelefono = typeof body.clienteTelefono === "string"
    const telefono = traeTelefono && (body.clienteTelefono as string).trim() ? (body.clienteTelefono as string).trim().slice(0, 40) : null
    const fecha = typeof fechaEvento === "string" && fechaEvento ? fechaEvento : null
    const tipo = typeof tipoEvento === "string" && tipoEvento ? tipoEvento : null

    const invitados = {
      adultos,
      adolescentes: 0,
      ninos,
      personasDietasEspeciales: 0,
      ...(dietasDetalle.length ? { dietasDetalle } : {}),
    }

    // Lo elegido, SIN costos (lo lee el vendedor al reabrir la cotización).
    const serviciosElegidos = {
      version: 2,
      recetas: { adultos: calculo.recetas.map((x) => x.id), adolescentes: [], ninos: [], dietasEspeciales: [] },
      // "barra" = la primera (lo que leen las pantallas viejas); "barras" = todas.
      barra: calculo.barra ? { tipo: "armada", barraTemplateId: calculo.barra.id, cocteles: calculo.barra.cocteles } : null,
      barras: calculo.barras.map((b) => ({ tipo: "armada", barraTemplateId: b.id, cocteles: b.cocteles })),
      servicios: calculo.servicios.map((s) => {
        const l = r.servicios.find((x) => x.servicioId === s.servicioId)!
        return {
          servicioId: s.servicioId,
          nombre: s.nombre,
          categoria: s.categoria,
          unidad: s.unidad,
          cantidad: s.cantidad,
          precioVenta: l.precioUnitario,
          precioTotal: l.precioTotal,
          incluidoEnPaquete: s.incluido,
        }
      }),
      personal: [] as string[],
      personalLineas: r.personal.map((l) => ({ funcion: l.funcion, cantidad: l.cantidad })),
    }

    // Para Administración: de dónde salió cada número (costo, ganancia y
    // precio de cada rubro). Nunca viaja al vendedor.
    const ganancias: Record<string, number | null> = {
      salon: config.gananciaSalon,
      cocina: config.gananciaCocina,
      barra: config.gananciaBarra,
      servicios: config.gananciaServicios,
      personal: null, // cada función tiene la suya (ver "personal")
      recargo: null, // ganancia pura: costo 0 (ver "recargo")
    }
    const personal = calculo.personal.map((p) => ({
      ...p,
      precioUnitario: r.personal.find((l) => l.funcion === p.funcion)?.precioUnitario ?? 0,
    }))
    const desgloseVenta = {
      version: 2,
      salon: config.salon,
      adultos,
      ninos,
      comensales: r.comensales,
      capacidadMaxima: config.capacidadMaxima,
      superaCapacidad: r.superaCapacidad,
      modalidad: r.modalidad,
      rubros: r.rubros.map((x) => ({ ...x, ganancia: ganancias[x.clave] })),
      recetas: calculo.recetas,
      barra: calculo.barra,
      barras: calculo.barras,
      servicios: r.servicios,
      personal,
      // Día cotizado y recargo aplicado (scripts/018). Queda fijo: si después
      // cambia el recargo o la fecha especial, esta cotización no se recalcula
      // (salvo que el vendedor la vuelva a guardar).
      dia: { tipo: calculo.dia.tipo, etiqueta: calculo.dia.etiqueta, fechaEspecial: calculo.dia.fechaEspecial },
      recargo: r.recargo,
      // Pasos del menú que faltaban al guardar: con alguno, el botón "Enviar"
      // de la lista (/api/vendedor/cotizaciones/[id]/enviar) no la manda.
      pasosMenuFaltantes: calculo.pasosMenuFaltantes,
      avisos: r.avisos,
      costoTotal: r.costoTotal,
      total: r.total,
    }
    // Costo de los servicios CON los incluidos (igual se le pagan al
    // proveedor): es lo que pasa a evento.costoServicios al aprobar.
    const costosServicios = r.servicios.map((l) => ({
      servicioId: l.servicioId,
      nombre: l.nombre,
      cantidad: l.cantidad,
      costoTotal: (l.costoUnitario ?? 0) * l.cantidad,
    }))
    const costosInternos = {
      version: 2,
      costoTotal: r.costoTotal,
      servicios: costosServicios,
      totalCostoServicios: costosServicios.reduce((s, c) => s + c.costoTotal, 0),
      personal,
    }
    const avisosAdmin = r.avisos.map((a) => a.texto)

    const respuesta = (fila: { id: string; estado: string }) =>
      NextResponse.json({
        ok: true,
        id: fila.id,
        estado: fila.estado,
        total: r.total,
        rubros: r.rubros.map((x) => ({ clave: x.clave, nombre: x.nombre, precio: x.precio })),
        avisos: r.avisos.map((a) => ({ nivel: a.nivel, texto: a.textoVendedor })),
      })

    if (typeof id === "string" && id) {
      // Festejados y horarios no están en la pantalla nueva: no se tocan (una
      // cotización vieja reabierta los conserva). El teléfono sí (ver arriba).
      const filas = await sql.begin(async (tx) => {
      const db = tx as unknown as typeof sql
      const actualizadas = (await db`
        UPDATE cotizaciones SET
          cliente_nombre = ${clienteNombre.trim()},
          cliente_dni = ${dni},
          cliente_telefono = CASE WHEN ${traeTelefono} THEN ${telefono} ELSE cliente_telefono END,
          fecha_evento = ${fecha},
          salon = ${config.salon},
          tipo_evento = ${tipo},
          invitados = ${jsonb(invitados)},
          servicios_elegidos = ${jsonb(serviciosElegidos)},
          precio_venta_sugerido = ${r.total},
          costos_internos = ${jsonb(costosInternos)},
          modalidad_salon = ${r.modalidad},
          desglose_venta = ${jsonb(desgloseVenta)},
          fuera_de_tarifario = false,
          avisos = ${jsonb(avisosAdmin)},
          estado = CASE WHEN ${enviar} THEN 'lista_para_revisar' ELSE estado END,
          comentario_admin = CASE WHEN ${enviar} THEN NULL ELSE comentario_admin END,
          updated_at = now()
        WHERE id = ${id} AND estado IN ('borrador', 'rechazada')
        RETURNING id, estado
      `) as unknown as Array<{ id: string; estado: string }>
      // Aparte y en la misma transacción: así guardar sin el dato no nombra la
      // columna nueva. Enviar sin origen guardado no se permite (la fila
      // vuelve atrás entera).
      if (actualizadas.length && traeOrigen) {
        await db`UPDATE cotizaciones SET origen_cliente = ${origen} WHERE id = ${id}`
      }
      if (actualizadas.length && enviar && !traeOrigen) {
        const [fila] = (await db`
          SELECT (to_jsonb(cotizaciones) ->> 'origen_cliente') AS origen FROM cotizaciones WHERE id = ${id}
        `) as unknown as Array<{ origen: string | null }>
        if (!normalizarOrigen(fila?.origen)) throw new FaltaOrigen()
      }
      return actualizadas
      })
      if (!filas.length) {
        return NextResponse.json(
          { ok: false, error: "Esta cotización ya no se puede editar (Administración ya la está revisando o ya fue procesada)" },
          { status: 409 },
        )
      }
      return respuesta(filas[0])
    }

    if (enviar && !origen) {
      return NextResponse.json({ ok: false, error: "Para enviarla falta elegir cómo nos conoció" }, { status: 400 })
    }
    const estado = enviar ? "lista_para_revisar" : "borrador"
    const filas = await sql.begin(async (tx) => {
    const db = tx as unknown as typeof sql
    const nuevas = (await db`
      INSERT INTO cotizaciones (
        vendedor, cliente_nombre, cliente_dni, fecha_evento, salon, tipo_evento,
        invitados, servicios_elegidos, precio_venta_sugerido, costos_internos,
        modalidad_salon, desglose_venta, fuera_de_tarifario, avisos, cliente_telefono, estado
      ) VALUES (
        ${vendedor}, ${clienteNombre.trim()}, ${dni}, ${fecha}, ${config.salon}, ${tipo},
        ${jsonb(invitados)}, ${jsonb(serviciosElegidos)}, ${r.total}, ${jsonb(costosInternos)},
        ${r.modalidad}, ${jsonb(desgloseVenta)}, false, ${jsonb(avisosAdmin)}, ${telefono}, ${estado}
      )
      RETURNING id, estado
    `) as unknown as Array<{ id: string; estado: string }>
    if (origen) await db`UPDATE cotizaciones SET origen_cliente = ${origen} WHERE id = ${nuevas[0].id}`
    return nuevas
    })
    return respuesta(filas[0])
  } catch (err) {
    if (err instanceof FaltaOrigen) {
      return NextResponse.json({ ok: false, error: "Para enviarla falta elegir cómo nos conoció" }, { status: 400 })
    }
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
