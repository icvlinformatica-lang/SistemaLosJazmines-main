// Cotización del vendedor calculada en el SERVIDOR (Paso 2 del cotizador por
// salón). Solo servidor.
//
// Lee SOLO la configuración del salón (cotizador_salon, _receta, _barra,
// _servicio y cotizador_personal_regla, vía lib/cotizador-salon-servidor.ts)
// más los costos reales (recetas, cócteles, servicios, personal), arma los
// valores por unidad con costo Y precio, y hace la cuenta con
// armarCotizacion (lib/cotizador-salon.ts) — la misma función que usa la
// pantalla del vendedor. Nunca se confía en un precio que mande el navegador.
//
// Lo que el vendedor no puede elegir en ese salón (plato o barra no visible,
// servicio oculto, de otro año o de categoría Menú/Barra) se RECHAZA con un
// mensaje, no se ignora en silencio.
import { leerBarrasArmadas, leerCostosPlatos } from "@/lib/cotizador-config-servidor"
import { leerPreciosCocteles } from "@/lib/precio-barra-servidor"
import { leerConfigSalon, leerPersonalConTarifa, leerServiciosConCosto, type ConfigSalon } from "@/lib/cotizador-salon-servidor"
import { leerFechasEspeciales } from "@/lib/fechas-especiales-servidor"
import {
  CATEGORIAS_FUERA_DE_SERVICIOS,
  MAX_BARRAS,
  armarCotizacion,
  diaDeSemana,
  resolverDia,
  type DiaCotizado,
  esSalonCotizador,
  pasosMenuFaltantes,
  precioBarraSalon,
  precioConGanancia,
  tarifaDeRegla,
  type ResultadoCotizacionSalon,
} from "@/lib/cotizador-salon"
import { servicioCorrespondeAlAnio } from "@/lib/tarifario-cotizador"

export interface PedidoCotizacion {
  salon: string
  fechaEvento: string
  adultos: number
  ninos: number
  recetas: string[]
  barraId: string | null
  /** Hasta MAX_BARRAS barras. Si viene, manda sobre barraId. */
  barraIds?: string[]
  servicios: Array<{ servicioId: string; cantidad: number }>
}

export interface CotizacionCalculada {
  config: ConfigSalon
  /** Tipo de día y recargo que le tocó (sábado / fecha especial / ninguno). */
  dia: DiaCotizado
  resultado: ResultadoCotizacionSalon
  /** Con su categoría: el paso del menú (entrada, plato principal, postre...). */
  recetas: Array<{ id: string; nombre: string; categoria: string; costoPorcion: number; precioPorcion: number }>
  /** Pasos del menú que el salón ofrece y faltan elegir (pasosMenuFaltantes).
   *  Con alguno, la cotización se puede guardar pero no enviar. */
  pasosMenuFaltantes: string[]
  /** La primera barra (compatibilidad con lo que lee una sola). */
  barra: BarraCalculada | null
  barras: BarraCalculada[]
  /** Servicios con nombre/unidad/categoría (para guardar y para el evento). */
  servicios: Array<{ servicioId: string; nombre: string; categoria: string; unidad: string; cantidad: number; incluido: boolean }>
  /** Reglas de personal que se usaron, con su tarifa (para el evento al aprobar). */
  personal: Array<{ funcion: string; cantidad: number; tarifa: number; origenTarifa: string; ganancia: number }>
}

type BarraCalculada = { id: string; nombre: string; cocteles: string[]; costoPorAdulto: number; precioPorAdulto: number }

const entero = (n: unknown) => Math.max(0, Math.floor(Number(n) || 0))

/** Calcula una cotización. Devuelve un string con el error si el pedido no es válido. */
export async function cotizarEnServidor(p: PedidoCotizacion): Promise<CotizacionCalculada | string> {
  if (!esSalonCotizador(p.salon)) return "Elegí un salón."
  const adultos = entero(p.adultos)
  const ninos = entero(p.ninos)
  if (adultos + ninos <= 0) return "Cargá la cantidad de invitados."
  const fecha = p.fechaEvento || ""
  if (fecha && diaDeSemana(fecha) == null) return "La fecha del evento no es válida."

  // En tandas chicas por el pooler de Supabase (ver /api/vendedor/catalogo).
  const config = await leerConfigSalon(p.salon)
  const [platos, cocteles] = await Promise.all([leerCostosPlatos(), leerPreciosCocteles()])
  const [barras, serviciosCat, roster] = await Promise.all([leerBarrasArmadas(), leerServiciosConCosto(), leerPersonalConTarifa()])
  // Recargo del día: fecha especial de ese salón > sábado > como viernes.
  const dia = resolverDia(fecha, p.salon, config.recargoSabado, fecha ? await leerFechasEspeciales({ fecha }) : [])

  // ── Recetas: solo las visibles del salón ──
  const recetasPedidas = [...new Set((p.recetas || []).filter((x) => typeof x === "string"))]
  const recetas: CotizacionCalculada["recetas"] = []
  for (const id of recetasPedidas) {
    const plato = platos.find((x) => x.id === id)
    if (!plato || !config.recetas.includes(id)) return `"${plato?.nombre ?? id}" no está en el menú de este salón.`
    recetas.push({
      id,
      nombre: plato.nombre,
      categoria: plato.categoria,
      costoPorcion: plato.costoPorPorcion,
      precioPorcion: precioConGanancia(plato.costoPorPorcion, config.gananciaCocina),
    })
  }

  // ── Barras: hasta MAX_BARRAS, distintas, solo las visibles del salón ──
  const idsBarra = [
    ...new Set(Array.isArray(p.barraIds) ? p.barraIds.filter((x) => typeof x === "string" && x) : p.barraId ? [p.barraId] : []),
  ]
  if (idsBarra.length > MAX_BARRAS) return `Se pueden elegir hasta ${MAX_BARRAS} barras.`
  const costos = Object.fromEntries(cocteles.map((c) => [c.id, c.costoPorTrago]))
  const barrasElegidas: BarraCalculada[] = []
  for (const idBarra of idsBarra) {
    const b = barras.find((x) => x.id === idBarra)
    if (!b || !config.barras.includes(b.id)) return "Esa barra no está disponible en este salón."
    barrasElegidas.push({
      id: b.id,
      nombre: b.nombre,
      // Los cócteles que ya no existen en la carta no se cobran ni pasan al evento.
      cocteles: b.coctelesIncluidos.filter((id) => id in costos),
      costoPorAdulto: precioBarraSalon(b.coctelesIncluidos, costos, 0).precioPorAdulto,
      precioPorAdulto: precioBarraSalon(b.coctelesIncluidos, costos, config.gananciaBarra).precioPorAdulto,
    })
  }
  const barra = barrasElegidas[0] ?? null

  // ── Servicios: los elegidos + TODOS los incluidos del salón ──
  const ocultos = new Set(config.servicios.filter((s) => s.oculto).map((s) => s.servicioId))
  const incluidos = new Set(config.servicios.filter((s) => s.incluido).map((s) => s.servicioId))
  const disponible = (sv: (typeof serviciosCat)[number]) =>
    !ocultos.has(sv.id) &&
    !CATEGORIAS_FUERA_DE_SERVICIOS.includes(sv.categoria) &&
    servicioCorrespondeAlAnio(sv.nombre, p.fechaEvento || "")
  const pedidos = new Map<string, number>()
  for (const s of p.servicios || []) {
    if (s && typeof s.servicioId === "string") pedidos.set(s.servicioId, Number(s.cantidad) || 1)
  }
  for (const id of pedidos.keys()) {
    const sv = serviciosCat.find((x) => x.id === id)
    if (!sv || !disponible(sv)) return `"${sv?.nombre ?? id}" no se puede cotizar en este salón o para esa fecha.`
  }
  const serviciosElegidos = serviciosCat.filter((sv) => disponible(sv) && (pedidos.has(sv.id) || incluidos.has(sv.id)))

  // ── Personal: reglas del salón con su tarifa ──
  const reglas = config.reglasPersonal.map((r) => {
    const tarifa = tarifaDeRegla(r, roster)
    return { regla: r, tarifa, precio: precioConGanancia(tarifa.tarifa, r.ganancia) }
  })

  const resultado = armarCotizacion({
    adultos,
    ninos,
    capacidadMaxima: config.capacidadMaxima,
    salon: { costo: config.costoSalon, precio: precioConGanancia(config.costoSalon, config.gananciaSalon) },
    recetas: recetas.map((r) => ({ id: r.id, nombre: r.nombre, categoria: r.categoria, costo: r.costoPorcion, precio: r.precioPorcion })),
    barra: null,
    barras: barrasElegidas.map((b) => ({
      id: b.id,
      nombre: b.nombre,
      tragosPorAdulto: b.cocteles.length,
      costo: b.costoPorAdulto,
      precio: b.precioPorAdulto,
    })),
    servicios: serviciosElegidos.map((sv) => ({
      servicioId: sv.id,
      nombre: sv.nombre,
      unidad: sv.unidad,
      cantidad: pedidos.get(sv.id) ?? 1,
      incluido: incluidos.has(sv.id),
      costo: sv.costo,
      precio: precioConGanancia(sv.costo, config.gananciaServicios),
    })),
    personal: reglas.map(({ regla, tarifa, precio }) => ({
      funcion: regla.funcion,
      cadaNInvitados: regla.cadaNInvitados,
      minimo: regla.minimo,
      aplica: regla.aplica,
      costo: tarifa.tarifa,
      precio,
    })),
    dia,
  })

  // Pasos del menú que faltan: contra los platos VISIBLES del salón (los mismos
  // que ve el vendedor en /api/vendedor/catalogo).
  const platosDelSalon = config.recetas
    .map((id) => platos.find((x) => x.id === id))
    .filter((x): x is NonNullable<typeof x> => !!x)

  return {
    config,
    dia,
    resultado,
    recetas,
    pasosMenuFaltantes: pasosMenuFaltantes(platosDelSalon, recetas),
    barra,
    barras: barrasElegidas,
    servicios: resultado.servicios.map((l) => {
      const sv = serviciosElegidos.find((x) => x.id === l.servicioId)!
      return { servicioId: l.servicioId, nombre: l.nombre, categoria: sv.categoria, unidad: l.unidad, cantidad: l.cantidad, incluido: l.incluido }
    }),
    personal: resultado.personal.map((l) => {
      const r = reglas.find((x) => x.regla.funcion === l.funcion)!
      return { funcion: l.funcion, cantidad: l.cantidad, tarifa: r.tarifa.tarifa, origenTarifa: r.tarifa.origen, ganancia: r.regla.ganancia }
    }),
  }
}
