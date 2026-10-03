/**
 * Cálculo del precio de venta del cotizador VIEJO (grilla + Calendario de
 * Precios). SIN USO desde el Paso 2 del cotizador por salón (el precio sale
 * de lib/cotizador-salon.ts → armarCotizacion). Queda para el PR de limpieza;
 * servicioCorrespondeAlAnio() sí se sigue usando.
 *
 * Lo de abajo describe cómo funcionaba:
 * Una sola función para las dos puntas: el preview en vivo de
 * app/vendedor/cotizar/page.tsx y el recálculo del servidor al guardar
 * (app/api/vendedor/cotizaciones). Si las dos usan esto, el vendedor nunca
 * ve un número distinto del que queda guardado.
 *
 * OJO — no confundir con calcularVentaServicios() de lib/store.ts, que es el
 * cálculo del PLANIFICADOR y de los eventos ya cargados. Son distintos a
 * propósito y no se tocan entre sí:
 *   - Acá "Por Persona" se multiplica por el total de invitados.
 *   - En el planificador "Por Persona" se cobra una sola vez (decisión del
 *     negocio ya confirmada, ver CLAUDE.md). Cambiar eso movería el precio de
 *     los eventos que ya existen.
 * El puente entre los dos mundos es el precio FIJO: cuando Administración
 * aprueba una cotización, el evento se queda con el número que salió de acá y
 * deja de recalcularse (eventos.precio_venta_fijo).
 */


export type ModalidadSalon = "solo_salon" | "con_catering"
export type DiaTarifario = "viernes" | "sabado"

/** Categorías de servicio que el paquete "con catering y bebidas" ya incluye. */
export const CATEGORIAS_INCLUIDAS_EN_CATERING = ["Menú", "Barra"] as const

export interface FilaTarifario {
  salon: string
  invitadosMin: number
  invitadosMax: number
  dia: DiaTarifario
  modalidad: ModalidadSalon
  precio: number
}

export interface ServicioParaCotizar {
  id: string
  nombre: string
  categoria: string
  unidad: "Fijo" | "Por Persona" | "Por Hora" | "Por Cantidad"
  precioVenta: number
}

export interface EntradaCotizacion {
  salon: string
  /** YYYY-MM-DD. Vacío = todavía no eligió fecha. */
  fechaEvento: string
  modalidad: ModalidadSalon
  totalInvitados: number
  serviciosElegidos: Array<{ servicioId: string; cantidad: number }>
  catalogoServicios: ServicioParaCotizar[]
  tarifario: FilaTarifario[]
  /** Calendario de Precios: salon -> fecha -> precio. */
  preciosVenta: Record<string, Record<string, number>>
  /**
   * Servicios que el precio del salón ya incluye (mesas y sillas, DJ,
   * decoración, suite…). Solo dejan de cobrarse si el salón se está
   * vendiendo a precio de lista — ver origenEsPrecioDeLista().
   */
  serviciosIncluidosSalon?: string[]
}

export interface LineaVenta {
  servicioId: string
  nombre: string
  categoria: string
  unidad: string
  cantidad: number
  precioUnitario: number
  precioTotal: number
  /** true = ya está incluido en algún paquete, así que no suma. */
  incluidoEnPaquete: boolean
  /** Por qué no suma: lo trae el salón o lo trae el catering. */
  motivoIncluido?: "salon" | "catering"
}

export type OrigenPrecioSalon =
  | "calendario"
  | "tarifario"
  | "tarifario_aproximado"
  | "sin_precio"

export interface ResultadoCotizacion {
  precioSalon: number
  origenPrecioSalon: OrigenPrecioSalon
  servicios: LineaVenta[]
  totalServicios: number
  total: number
  avisos: string[]
  /** Administración tiene que mirar esta cotización antes de aprobarla. */
  fueraDeTarifario: boolean
}

export const AVISO_FUERA_DE_TARIFARIO = "Fuera de tarifario — confirmar con Administración"

/**
 * ¿El salón se está vendiendo a precio de lista? Solo entonces el paquete
 * viene completo y lo que incluye no se cobra aparte.
 *
 * Sin precio de salón no hay paquete: lo que el salón "incluye" se cobra
 * como cualquier otro adicional.
 */
export function origenEsPrecioDeLista(origen: OrigenPrecioSalon): boolean {
  return origen === "calendario" || origen === "tarifario" || origen === "tarifario_aproximado"
}

/**
 * Día de tarifario de una fecha. Sábado tiene precio propio; domingo a
 * viernes se cotizan todos como viernes (regla del negocio).
 *
 * La fecha se parte a mano en vez de usar new Date("2026-09-28"), que el
 * navegador interpreta como UTC y en Argentina (UTC-3) devuelve el día
 * anterior — un sábado se cotizaría como viernes.
 */
export function diaTarifario(fechaISO: string): DiaTarifario {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaISO || "")
  if (!m) return "viernes"
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return fecha.getDay() === 6 ? "sabado" : "viernes"
}

/** Año de la fecha del evento; si no hay fecha, el año actual. */
export function anioDeReferencia(fechaISO: string): number {
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(fechaISO || "")
  return m ? Number(m[1]) : new Date().getFullYear()
}

/**
 * ¿Este servicio corresponde a la fecha del evento?
 * Los servicios cuyo nombre termina en un año (VESTIDO 2027, FOTOGRAFIA 2026,
 * ALTAR PERSONALIZADO 2028) solo se ofrecen para eventos de ese año. Los que
 * no llevan año se ofrecen siempre.
 */
export function servicioCorrespondeAlAnio(nombre: string, fechaISO: string): boolean {
  const m = /\b(20\d{2})\s*$/.exec(nombre || "")
  if (!m) return true
  return Number(m[1]) === anioDeReferencia(fechaISO)
}

/**
 * Busca el precio del salón en la grilla. Si ningún rango contiene a los
 * invitados, devuelve el rango más cercano marcado como aproximado (mejor un
 * número con aviso que un $0 que el vendedor no sabe interpretar).
 */
export function buscarEnTarifario(
  tarifario: FilaTarifario[],
  salon: string,
  totalInvitados: number,
  dia: DiaTarifario,
  modalidad: ModalidadSalon,
): { precio: number; aproximado: boolean; fila: FilaTarifario } | null {
  const candidatas = tarifario.filter((f) => f.salon === salon && f.dia === dia && f.modalidad === modalidad)
  if (!candidatas.length) return null

  const exacta = candidatas.find((f) => totalInvitados >= f.invitadosMin && totalInvitados <= f.invitadosMax)
  if (exacta) return { precio: exacta.precio, aproximado: false, fila: exacta }

  // Rango más cercano: distancia al borde del rango. Ante un empate (ej. 85
  // invitados está a 5 de 70-80 y a 5 de 90-100) gana el rango de ARRIBA: el
  // salón tiene que dar abasto para esa gente, y subcotizar es peor error que
  // pasarse. Igual sale marcado como fuera de tarifario para que lo confirmen.
  const distancia = (f: FilaTarifario) =>
    totalInvitados < f.invitadosMin ? f.invitadosMin - totalInvitados : totalInvitados - f.invitadosMax
  const cercana = candidatas.reduce((mejor, f) => {
    const d = distancia(f)
    const dMejor = distancia(mejor)
    if (d !== dMejor) return d < dMejor ? f : mejor
    return f.invitadosMin > mejor.invitadosMin ? f : mejor
  }, candidatas[0])
  return { precio: cercana.precio, aproximado: true, fila: cercana }
}

/**
 * Precio del salón, en orden: Calendario de Precios (fecha exacta) →
 * grilla del tarifario → $0 con aviso.
 */
function resolverPrecioSalon(entrada: EntradaCotizacion): {
  precio: number
  origen: OrigenPrecioSalon
  avisos: string[]
} {
  const { salon, fechaEvento, modalidad, totalInvitados, tarifario, preciosVenta } = entrada
  const avisos: string[] = []
  if (!salon) return { precio: 0, origen: "sin_precio", avisos: ["Elegí un salón para calcular el precio."] }

  const delCalendario = preciosVenta[salon]?.[fechaEvento]
  if (typeof delCalendario === "number" && delCalendario > 0) {
    return { precio: delCalendario, origen: "calendario", avisos }
  }

  const enGrilla = buscarEnTarifario(tarifario, salon, totalInvitados, diaTarifario(fechaEvento), modalidad)
  if (enGrilla) {
    if (enGrilla.aproximado) {
      avisos.push(
        `${totalInvitados} invitados no entra en ningún rango del tarifario: se usó el rango ${enGrilla.fila.invitadosMin}-${enGrilla.fila.invitadosMax}. ${AVISO_FUERA_DE_TARIFARIO}`,
      )
      return { precio: enGrilla.precio, origen: "tarifario_aproximado", avisos }
    }
    return { precio: enGrilla.precio, origen: "tarifario", avisos }
  }

  // Sin grilla el salón vale $0 y se avisa. A propósito NO hay fallback al
  // precio base por salón (precios_base_salones): era un número de respaldo
  // que tapaba el problema real — que a ese salón le falta cargar la grilla —
  // y hacía que la cotización saliera con un precio que nadie fijó. Ese
  // editor sigue existiendo en Eventos > Cotizaciones, plegado y marcado
  // como no usado, para no perder lo que hubiera cargado.
  avisos.push(
    `${salon} no tiene grilla de tarifario cargada para esta fecha: el salón se cotiza en $0. ${AVISO_FUERA_DE_TARIFARIO}`,
  )
  return { precio: 0, origen: "sin_precio", avisos }
}

/**
 * Precio de venta sugerido = salón + todos los servicios elegidos.
 *
 * Con modalidad "con_catering", los servicios de Menú y Barra se siguen
 * eligiendo (cocina los necesita) pero no suman: ya están adentro del precio
 * del paquete.
 */
export function calcularCotizacion(entrada: EntradaCotizacion): ResultadoCotizacion {
  const { modalidad, totalInvitados, serviciosElegidos, catalogoServicios } = entrada
  const incluidosSalon = entrada.serviciosIncluidosSalon ?? []
  const avisos: string[] = []

  const { precio: precioSalon, origen, avisos: avisosSalon } = resolverPrecioSalon(entrada)
  avisos.push(...avisosSalon)
  const salonAPrecioDeLista = origenEsPrecioDeLista(origen)

  const servicios: LineaVenta[] = []
  for (const elegido of serviciosElegidos) {
    const cat = catalogoServicios.find((s) => s.id === elegido.servicioId)
    if (!cat) continue

    // Dos motivos para no cobrar un servicio:
    //  1. el paquete con catering y bebidas ya trae menú y barra;
    //  2. el precio de lista del salón ya trae mesas, DJ, decoración, etc.
    // Si el salón no se vende a precio de lista, lo incluido se cobra como
    // cualquier otro adicional.
    const incluidoPorCatering =
      modalidad === "con_catering" &&
      (CATEGORIAS_INCLUIDAS_EN_CATERING as readonly string[]).includes(cat.categoria)
    const incluidoPorSalon = salonAPrecioDeLista && incluidosSalon.includes(cat.id)
    const incluidoEnPaquete = incluidoPorCatering || incluidoPorSalon

    let cantidad = 1
    if (cat.unidad === "Por Hora" || cat.unidad === "Por Cantidad") {
      cantidad = Math.max(1, Number(elegido.cantidad) || 1)
    } else if (cat.unidad === "Por Persona") {
      // Diferencia clave con el planificador: acá sí se multiplica por gente.
      cantidad = Math.max(0, totalInvitados)
    }

    const precioUnitario = Number(cat.precioVenta) || 0
    const precioTotal = incluidoEnPaquete ? 0 : precioUnitario * cantidad

    if (!incluidoEnPaquete && precioUnitario === 0) {
      avisos.push(`"${cat.nombre}" está en $0 en Finanzas > Servicios. ${AVISO_FUERA_DE_TARIFARIO}`)
    }
    if (!incluidoEnPaquete && cat.unidad === "Por Persona" && totalInvitados === 0) {
      avisos.push(`"${cat.nombre}" se cobra por persona y todavía no cargaste invitados.`)
    }

    servicios.push({
      servicioId: cat.id,
      nombre: cat.nombre,
      categoria: cat.categoria,
      unidad: cat.unidad,
      cantidad,
      precioUnitario,
      precioTotal,
      incluidoEnPaquete,
      motivoIncluido: incluidoPorSalon ? "salon" : incluidoPorCatering ? "catering" : undefined,
    })
  }

  // Un mismo servicio ofrecido dos veces para el mismo año (ej. el VESTIDO
  // 2026 duplicado en el catálogo) es un error de carga, no una elección:
  // que Administración lo vea antes de aprobar.
  const nombresRepetidos = servicios
    .map((s) => s.nombre)
    .filter((nombre, i, todos) => todos.indexOf(nombre) !== i)
  for (const nombre of [...new Set(nombresRepetidos)]) {
    avisos.push(`Hay más de un servicio llamado "${nombre}" en el catálogo. ${AVISO_FUERA_DE_TARIFARIO}`)
  }

  const totalServicios = servicios.reduce((sum, s) => sum + s.precioTotal, 0)

  return {
    precioSalon,
    origenPrecioSalon: origen,
    servicios,
    totalServicios,
    total: precioSalon + totalServicios,
    avisos,
    fueraDeTarifario: avisos.some((a) => a.includes(AVISO_FUERA_DE_TARIFARIO)),
  }
}

// ─── Regla de personal ───────────────────────────────────────────────────

export interface ReglaPersonal {
  funcion: string
  cadaNInvitados: number
  minimo: number
  activo: boolean
}

export interface PersonaRoster {
  id: string
  nombre: string
  apellido: string
  funcion: string
}

export interface SugerenciaPersonal {
  funcion: string
  necesarios: number
  /** Personas del roster que se pueden asignar (puede ser menos que las necesarias). */
  personalIds: string[]
  faltan: number
}

/**
 * Cuánta gente hace falta por función según la regla ("1 cada N invitados",
 * con un mínimo). Solo tiene sentido si el evento lleva menú: sin cocina no
 * hay personal que precargar.
 *
 * Si el roster no tiene suficientes personas activas con esa función, se
 * devuelven las que hay y "faltan" dice cuántas quedaron sin cubrir — la
 * pantalla avisa y el vendedor ajusta.
 */
/**
 * El personal que ya viene con el salón, según el día del evento. El sábado
 * tiene su propia gente; domingo a viernes usan el juego de viernes, igual
 * que la grilla de precios.
 *
 * Devuelve ids del roster. No suma al precio de venta: es costo, y sigue
 * calculándose en vivo como cualquier otro personal del evento.
 */
export function personalIncluidoDelSalon(
  incluidos: Array<{ personalId: string; dia: DiaTarifario }>,
  fechaISO: string,
): string[] {
  const dia = diaTarifario(fechaISO)
  return incluidos.filter((p) => p.dia === dia).map((p) => p.personalId)
}

/**
 * Deja en la selección el personal del salón que corresponde al día del
 * evento: entra el del día nuevo y sale el del otro día. Lo que el vendedor
 * haya agregado por su cuenta no se toca.
 *
 * Vive acá y no dentro del componente para poder probarlo: es la regla que
 * hace que cambiar la fecha de un sábado a un viernes cambie el juego de
 * portero, limpieza y coordinación.
 */
export function ajustarPersonalDelSalonPorDia(
  seleccionActual: string[],
  incluidos: Array<{ personalId: string; dia: DiaTarifario }>,
  fechaISO: string,
): string[] {
  const dia = diaTarifario(fechaISO)
  const delDia = incluidos.filter((p) => p.dia === dia).map((p) => p.personalId)
  const deOtroDia = incluidos.filter((p) => p.dia !== dia).map((p) => p.personalId)
  const sinElOtroDia = seleccionActual.filter((id) => !deOtroDia.includes(id))
  const faltantes = delDia.filter((id) => !sinElOtroDia.includes(id))
  return faltantes.length ? [...sinElOtroDia, ...faltantes] : sinElOtroDia
}

export function calcularPersonalSugerido(
  reglas: ReglaPersonal[],
  totalInvitados: number,
  roster: PersonaRoster[],
): SugerenciaPersonal[] {
  return reglas
    .filter((r) => r.activo)
    .map((regla) => {
      const porInvitados = regla.cadaNInvitados > 0 ? Math.ceil(totalInvitados / regla.cadaNInvitados) : 0
      const necesarios = Math.max(regla.minimo, porInvitados)
      const disponibles = roster.filter((p) => p.funcion === regla.funcion)
      const asignados = disponibles.slice(0, necesarios)
      return {
        funcion: regla.funcion,
        necesarios,
        personalIds: asignados.map((p) => p.id),
        faltan: Math.max(0, necesarios - asignados.length),
      }
    })
    .filter((s) => s.necesarios > 0)
}
