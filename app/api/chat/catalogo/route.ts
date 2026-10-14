// Cargar (o cancelar) el insumo de cocina o la receta nuevos que propuso el
// chat con IA. SOLO Administración y Soporte, y solo en su propio chat.
// POST { mensajeId, tipo: "insumo" | "receta", accion: "confirmar" | "cancelar" }
//
// La IA nunca carga nada: esta ruta lo hace cuando la persona toca "Sí,
// cargar" en la tarjeta. Lee la propuesta del mensaje guardado (no lo que
// mande el navegador) y la vuelve a validar con el Almacén y el Recetario de
// este momento (lib/chat-ia-catalogo.ts): si mientras tanto alguien cargó uno
// con el mismo nombre o borró un ingrediente, no carga. Inserta con las mismas
// columnas que /api/insumos y /api/recetas, con el id de la propuesta y
// ON CONFLICT: un doble toque o un reintento no lo duplica. Deja el
// activity_log como las pantallas, aclarando que vino del chat.
import { verifyToken, SESSION_COOKIE, SESSION_HEADER } from "@/lib/auth/server"
import { PERFILES_CHAT_IA, adjuntosConPropuesta, leerAdjuntos, usuarioChat } from "@/lib/chat-ia-historial"
import {
  armarPropuestaInsumo,
  armarPropuestaReceta,
  insumoDesdeFila,
  type PropuestaInsumoChat,
  type PropuestaRecetaChat,
} from "@/lib/chat-ia-catalogo"
import { RECETA_CODIGO_PREFIX, generateNextCodigo } from "@/lib/codigos"
import { permisoInsumo } from "@/lib/insumos-permisos"
import { puedeEditarRecetas } from "@/lib/recetas-permisos"
import { usuarioDesdeCookie } from "@/lib/usuario-cookie"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

class Problema extends Error {
  constructor(
    mensaje: string,
    public status: number,
  ) {
    super(mensaje)
  }
}

export async function POST(req: Request) {
  const cookieToken = (req.headers.get("cookie") || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1)
  const session = await verifyToken(cookieToken || req.headers.get(SESSION_HEADER))
  if (!session || !PERFILES_CHAT_IA.includes(session.perfilId)) {
    return Response.json({ error: "Disponible solo para Administración y Soporte" }, { status: 403 })
  }

  let body: { mensajeId?: unknown; tipo?: unknown; accion?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 })
  }
  const mensajeId = typeof body.mensajeId === "string" ? body.mensajeId : ""
  const tipo = body.tipo === "insumo" || body.tipo === "receta" ? body.tipo : null
  const accion = body.accion === "confirmar" || body.accion === "cancelar" ? body.accion : null
  if (!mensajeId || mensajeId.length > 80 || !tipo || !accion) {
    return Response.json({ error: "Falta el mensaje, el tipo o la acción" }, { status: 400 })
  }
  // Los mismos permisos que las pantallas de Almacén y Recetario.
  if (accion === "confirmar") {
    const permitido =
      tipo === "insumo"
        ? permisoInsumo({ perfilId: session.perfilId, sector: "cocina", accion: "crear" }).ok
        : puedeEditarRecetas(session.perfilId)
    if (!permitido) return Response.json({ error: "Tu perfil no puede cargar esto." }, { status: 403 })
  }

  const usuario = usuarioChat(session.perfilId, usuarioDesdeCookie(req, ""))
  try {
    const resultado = await sql.begin(async (trx) => {
      const tx = trx as unknown as typeof sql
      // Solo el chat de quien confirma: Soporte mirando el chat de otro no puede.
      const filas = (await tx`
        SELECT acciones FROM chat_ia_mensajes
        WHERE id = ${mensajeId} AND usuario = ${usuario} AND rol = 'assistant'
        FOR UPDATE
      `) as unknown as { acciones: unknown }[]
      if (filas.length === 0) throw new Problema("No encontré ese mensaje en tu chat.", 404)
      const adjuntos = leerAdjuntos(filas[0].acciones)
      const propuesta = tipo === "insumo" ? adjuntos.insumo : adjuntos.receta
      if (!propuesta) throw new Problema(tipo === "insumo" ? "Ese mensaje no tiene un insumo." : "Ese mensaje no tiene una receta.", 404)
      // Ya resuelto (por ejemplo, un doble toque): se devuelve como quedó.
      if (propuesta.estado !== "pendiente") return propuesta

      const resueltoEn = new Date().toISOString()
      let resuelto: PropuestaInsumoChat | PropuestaRecetaChat
      if (accion === "cancelar") {
        resuelto = { ...propuesta, estado: "cancelado", resueltoPor: usuario, resueltoEn }
      } else if (tipo === "insumo") {
        resuelto = await cargarInsumo(tx, propuesta as PropuestaInsumoChat, usuario, resueltoEn)
      } else {
        resuelto = await cargarReceta(tx, propuesta as PropuestaRecetaChat, usuario, resueltoEn)
      }
      const nuevosAdjuntos = adjuntosConPropuesta(adjuntos, { [tipo]: resuelto })
      await tx`UPDATE chat_ia_mensajes SET acciones = ${nuevosAdjuntos}::jsonb WHERE id = ${mensajeId}`
      return resuelto
    })
    return Response.json({ [tipo]: resultado })
  } catch (error) {
    if (error instanceof Problema) return Response.json({ error: error.message }, { status: error.status })
    console.error("[chat-ia] No se pudo cargar desde el chat:", error)
    return Response.json({ error: "No se pudo cargar. Probá de nuevo." }, { status: 500 })
  }
}

async function cargarInsumo(
  tx: typeof sql,
  propuesta: PropuestaInsumoChat,
  usuario: string,
  resueltoEn: string,
): Promise<PropuestaInsumoChat> {
  const filas = (await tx`
    SELECT id, codigo, descripcion, unidad, precio_unitario, proveedor, contenido_cantidad, contenido_unidad
    FROM insumos
  `) as unknown as Record<string, unknown>[]
  const yaCargado = filas.find((f) => f.id === propuesta.id)
  if (!yaCargado) {
    // Se vuelve a armar con el Almacén de ahora: mismo precio, y frena si alguien cargó uno igual.
    const r = armarPropuestaInsumo(
      {
        descripcion: propuesta.descripcion,
        unidad: propuesta.unidad,
        cantidadComprada: propuesta.compra.cantidad,
        montoPagado: propuesta.compra.monto,
        contenidoCantidad: propuesta.contenidoCantidad,
        contenidoUnidad: propuesta.contenidoUnidad,
        seUsaPorUnidad: propuesta.unidad === "UN" && !propuesta.contenidoCantidad,
        proveedor: propuesta.proveedor,
        sinProveedor: !propuesta.proveedor,
      },
      { id: propuesta.id, existentes: filas.map(insumoDesdeFila) },
    )
    if (!r.ok) throw new Problema(`No se cargó: ${r.motivo}`, 409)
    const p = r.propuesta
    const codigo = generateNextCodigo(
      filas.map((f) => f.codigo as string | null),
      "INS",
    )
    await tx`
      INSERT INTO insumos (id, codigo, descripcion, unidad, stock_actual, precio_unitario, proveedor,
                           contenido_cantidad, contenido_unidad)
      VALUES (${p.id}, ${codigo}, ${p.descripcion}, ${p.unidad}, 0, ${p.precioUnitario}, ${p.proveedor || null},
              ${p.contenidoCantidad ?? null}, ${p.contenidoUnidad ?? null})
      ON CONFLICT (id) DO NOTHING
    `
    // Precio inicial en el historial de evolución, como /api/insumos.
    await tx`
      INSERT INTO insumos_precio_historial (insumo_id, precio_anterior, precio)
      VALUES (${p.id}, NULL, ${p.precioUnitario})
      ON CONFLICT (insumo_id, fecha) DO UPDATE SET precio = EXCLUDED.precio
    `
    await tx`
      INSERT INTO activity_log (tipo, accion, nombre, detalle)
      VALUES ('insumo', 'creado', ${p.descripcion}, ${`Código: ${codigo} · Desde el asistente con IA · Por ${usuario}`})
    `
    return { ...propuesta, precioUnitario: p.precioUnitario, estado: "cargado", codigo, resueltoPor: usuario, resueltoEn }
  }
  // Ya estaba (un toque anterior que no llegó a marcar la tarjeta): solo se marca.
  return { ...propuesta, estado: "cargado", codigo: String(yaCargado.codigo ?? ""), resueltoPor: usuario, resueltoEn }
}

async function cargarReceta(
  tx: typeof sql,
  propuesta: PropuestaRecetaChat,
  usuario: string,
  resueltoEn: string,
): Promise<PropuestaRecetaChat> {
  const recetas = (await tx`SELECT id, codigo, nombre FROM recetas`) as unknown as { id: string; codigo: string | null; nombre: string }[]
  const yaCargada = recetas.find((r) => r.id === propuesta.id)
  if (yaCargada) return { ...propuesta, estado: "cargado", codigo: yaCargada.codigo ?? "", resueltoPor: usuario, resueltoEn }

  const insumos = (
    (await tx`
      SELECT id, codigo, descripcion, unidad, precio_unitario, proveedor, contenido_cantidad, contenido_unidad
      FROM insumos
    `) as unknown as Record<string, unknown>[]
  ).map(insumoDesdeFila)
  // Se vuelve a armar con el Almacén de ahora: frena si se borró un ingrediente o cambió su unidad.
  const r = armarPropuestaReceta(
    {
      nombre: propuesta.nombre,
      categoria: propuesta.categoria,
      descripcion: propuesta.descripcion,
      rindePara: propuesta.rindePara,
      ingredientes: propuesta.ingredientes.map((i) => ({
        insumoId: i.insumoId,
        cantidad: i.cantidad,
        unidad: i.unidadReceta,
        detalleCorte: i.detalleCorte,
      })),
    },
    { id: propuesta.id, insumos, recetasExistentes: recetas },
  )
  if (!r.ok) throw new Problema(`No se cargó: ${r.motivo}`, 409)
  const p = r.propuesta
  const codigo = generateNextCodigo(
    recetas.map((x) => x.codigo),
    RECETA_CODIGO_PREFIX[p.categoria],
  )
  await tx`
    INSERT INTO recetas (id, codigo, nombre, descripcion, imagen, categoria, factor_rendimiento)
    VALUES (${p.id}, ${codigo}, ${p.nombre}, ${p.descripcion || null}, NULL, ${p.categoria}, ${p.rindePara})
    ON CONFLICT (id) DO NOTHING
  `
  for (const [n, ing] of p.ingredientes.entries()) {
    await tx`
      INSERT INTO receta_insumos (id, receta_id, insumo_id, detalle_corte, cantidad_base_por_persona, unidad_receta)
      VALUES (${`${p.id}-${n + 1}`}, ${p.id}, ${ing.insumoId}, ${ing.detalleCorte || null}, ${ing.cantidad}, ${ing.unidadReceta})
      ON CONFLICT (id) DO NOTHING
    `
  }
  await tx`
    INSERT INTO activity_log (tipo, accion, nombre, detalle)
    VALUES ('receta', 'creado', ${p.nombre}, ${`Categoria: ${p.categoria} · Código: ${codigo} · Desde el asistente con IA · Por ${usuario}`})
  `
  // El costo se guarda como quedó con los precios de este momento.
  return { ...p, estado: "cargado", codigo, resueltoPor: usuario, resueltoEn }
}
