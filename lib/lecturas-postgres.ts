// Lecturas de las 6 APIs propias que usa la carga inicial. Cada función es la
// parte de su GET que lee y transforma los datos, movida acá tal cual para que
// la usen tanto la ruta vieja (app/api/<x>/route.ts) como la carga unificada
// (app/api/carga-inicial). Así las dos responden exactamente lo mismo.
//
// Solo servidor (usa la conexión a Postgres de lib/db).
import { sql } from "@/lib/db"
import { fromRow } from "@/lib/eventos-fila"
import { filaACoctel, type FilaCoctel } from "@/lib/cocteles-api"

export async function leerInsumos() {
  const data = await sql`SELECT * FROM insumos ORDER BY descripcion ASC`

  return data.map((item) => ({
    id: item.id,
    codigo: item.codigo,
    descripcion: item.descripcion,
    unidad: item.unidad,
    stockActual: Number(item.stock_actual),
    precioUnitario: Number(item.precio_unitario),
    proveedor: item.proveedor || "",
    // Cuánto trae cada unidad (una lata de arvejas = 200 GRS). Sin esto,
    // una receta en gramos de un insumo por unidad no se puede convertir.
    contenidoCantidad: item.contenido_cantidad != null ? Number(item.contenido_cantidad) : undefined,
    contenidoUnidad: item.contenido_unidad || undefined,
  }))
}

export async function leerInsumosBarra() {
  const data = await sql`
      SELECT * FROM insumos_barra ORDER BY descripcion ASC
    `

  return data.map((item) => ({
    id: item.id,
    codigo: item.codigo,
    descripcion: item.descripcion,
    unidad: item.unidad,
    stockActual: Number(item.stock_actual),
    precioUnitario: Number(item.precio_unitario),
    contenidoCantidad: item.contenido_cantidad != null ? Number(item.contenido_cantidad) : undefined,
    contenidoUnidad: item.contenido_unidad || undefined,
    proveedor: item.proveedor || "",
    categoria: item.categoria,
  }))
}

export async function leerRecetas() {
  const recetasData = await sql`
      SELECT id, codigo, nombre, descripcion, imagen, categoria, factor_rendimiento
      FROM recetas ORDER BY nombre ASC
    `

  const insumosData = await sql`
      SELECT receta_id, insumo_id, detalle_corte, cantidad_base_por_persona, unidad_receta
      FROM receta_insumos
    `

  return recetasData.map((receta) => {
    const insumos = insumosData
      .filter((i) => i.receta_id === receta.id)
      .map((i) => ({
        insumoId: i.insumo_id,
        detalleCorte: i.detalle_corte || "",
        cantidadBasePorPersona: Number(i.cantidad_base_por_persona),
        unidadReceta: i.unidad_receta,
      }))

    return {
      id: receta.id,
      codigo: receta.codigo,
      nombre: receta.nombre,
      descripcion: receta.descripcion || "",
      imagen: receta.imagen || "",
      categoria: receta.categoria,
      factorRendimiento: Number(receta.factor_rendimiento) || 1,
      insumos,
    }
  })
}

export async function leerCocteles() {
  const coctelesData = await sql`
      SELECT * FROM cocteles ORDER BY nombre ASC
    `

  const insumosData = await sql`
      SELECT * FROM coctel_insumos
    `

  return coctelesData.map((coctel) => {
    const insumos = insumosData
      .filter((i) => i.coctel_id === coctel.id)
      .map((i) => ({
        insumoBarraId: i.insumo_barra_id,
        cantidadPorCoctel: Number(i.cantidad_por_coctel),
        unidadCoctel: i.unidad_coctel,
      }))

    return filaACoctel(coctel as FilaCoctel, insumos)
  })
}

export async function leerBarraTemplates() {
  const data = await sql`
      SELECT * FROM barra_templates ORDER BY nombre ASC
    `

  // Transform to app format
  return data.map((template) => ({
    id: template.id,
    nombre: template.nombre,
    coctelesIncluidos: template.cocteles_incluidos || [],
  }))
}

// Eventos activos (deleted_at IS NULL).
export async function leerEventos() {
  const rows = await sql`
      SELECT
        id, nombre, fecha, horario, horario_fin, salon, tipo_evento, nombre_pareja,
        dni_novio1, dni_novio2, adultos, adolescentes, ninos, personas_dietas_especiales,
        recetas_adultos, recetas_adolescentes, recetas_ninos, recetas_dietas_especiales,
        multipliers_adultos, multipliers_adolescentes, multipliers_ninos, multipliers_dietas_especiales,
        descripcion_personalizada, barras, servicios, paquetes_seleccionados, personal_evento,
        condicion_iva, contrato, plan_de_cuotas, estado, color_tag,
        precio_venta, precio_venta_fijo, cotizacion_id, costo_personal, costo_insumos, costo_servicios, costo_operativo,
        notas_internas, nota_staff, pagos, asignaciones, costos_calculados,
        stock_descontado, fecha_impresion, cocina_pagada, barra_pagada, fecha_pago_menu, fecha_pago_barra, comision_pagada, comision_pagada_fecha, created_at, updated_at,
        versiones_contrato, generaciones_contrato, servicios_contrato, servicios_libres_contrato
      FROM eventos
      WHERE deleted_at IS NULL
      ORDER BY fecha DESC NULLS LAST, created_at DESC
    `
  return rows.map(fromRow)
}
