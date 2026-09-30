// Fila de la tabla `eventos` → objeto de la app. Movido tal cual desde
// app/api/eventos/route.ts (lo usan su GET y su POST, y la carga inicial
// unificada). Movimiento puro: el cuerpo no cambió.
/* eslint-disable @typescript-eslint/no-explicit-any */

// DB row → camelCase for app
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Helper to safely parse JSON fields that might come as strings from PostgreSQL
function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value === "string") {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return value as T
}

export function fromRow(r: Record<string, any>) {
  return {
    id: r.id,
    nombre: r.nombre,
    fecha: r.fecha,
    horario: r.horario,
    horarioFin: r.horario_fin,
    salon: r.salon,
    tipoEvento: r.tipo_evento,
    nombrePareja: r.nombre_pareja,
    dniNovio1: r.dni_novio1,
    dniNovio2: r.dni_novio2,
    adultos: r.adultos ?? 0,
    adolescentes: r.adolescentes ?? 0,
    ninos: r.ninos ?? 0,
    personasDietasEspeciales: r.personas_dietas_especiales ?? 0,
    recetasAdultos: parseJsonField(r.recetas_adultos, []),
    recetasAdolescentes: parseJsonField(r.recetas_adolescentes, []),
    recetasNinos: parseJsonField(r.recetas_ninos, []),
    recetasDietasEspeciales: parseJsonField(r.recetas_dietas_especiales, []),
    multipliersAdultos: parseJsonField(r.multipliers_adultos, {}),
    multipliersAdolescentes: parseJsonField(r.multipliers_adolescentes, {}),
    multipliersNinos: parseJsonField(r.multipliers_ninos, {}),
    multipliersDietasEspeciales: parseJsonField(r.multipliers_dietas_especiales, {}),
    descripcionPersonalizada: r.descripcion_personalizada ?? "",
    barras: parseJsonField(r.barras, []),
    servicios: parseJsonField(r.servicios, []),
    paquetesSeleccionados: r.paquetes_seleccionados ?? [],
    personalEvento: parseJsonField(r.personal_evento, []),
    condicionIva: r.condicion_iva,
    contrato: parseJsonField(r.contrato, null),
    planDeCuotas: parseJsonField(r.plan_de_cuotas, null),
    estado: r.estado ?? "pendiente",
    colorTag: r.color_tag,
    precioVenta: r.precio_venta != null ? Number(r.precio_venta) : undefined,
    precioVentaFijo: !!r.precio_venta_fijo,
    cotizacionId: r.cotizacion_id ?? undefined,
    costoPersonal: r.costo_personal != null ? Number(r.costo_personal) : undefined,
    costoInsumos: r.costo_insumos != null ? Number(r.costo_insumos) : undefined,
    costoServicios: r.costo_servicios != null ? Number(r.costo_servicios) : undefined,
    costoOperativo: r.costo_operativo != null ? Number(r.costo_operativo) : undefined,
    notasInternas: r.notas_internas,
    notaStaff: r.nota_staff,
    pagos: parseJsonField(r.pagos, []),
    asignaciones: parseJsonField(r.asignaciones, []),
    costosCalculados: parseJsonField(r.costos_calculados, null),
    stockDescontado: r.stock_descontado ?? false,
    fechaImpresion: r.fecha_impresion,
    versionesContrato: parseJsonField(r.versiones_contrato, []),
    generacionesContrato: parseJsonField(r.generaciones_contrato, []),
    serviciosContrato: parseJsonField(r.servicios_contrato, undefined),
    serviciosLibresContrato: parseJsonField(r.servicios_libres_contrato, undefined),
    cocinaPagada: r.cocina_pagada ?? false,
    barraPagada: r.barra_pagada ?? false,
    fechaPagoMenu: r.fecha_pago_menu ?? undefined,
    fechaPagoBarra: r.fecha_pago_barra ?? undefined,
    comisionPagada: r.comision_pagada ?? false,
    comisionPagadaFecha: r.comision_pagada_fecha
      ? new Date(r.comision_pagada_fecha).toISOString().slice(0, 10)
      : undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}
