// Catálogo del cotizador por salón ya convertido a PRECIO. Solo servidor.
//
// Antes vivía adentro de /api/vendedor/catalogo. Se movió acá, sin cambios,
// para que la vista de Clientes (/api/clientes/catalogo) use exactamente la
// misma cuenta que el vendedor: lo que ve un cliente tiene que dar igual que
// lo que cotiza un vendedor.
import { leerBarrasArmadas, leerCostosPlatos } from "@/lib/cotizador-config-servidor"
import { leerConfigTodosLosSalones, leerPersonalConTarifa, leerServiciosConCosto } from "@/lib/cotizador-salon-servidor"
import { CATEGORIAS_FUERA_DE_SERVICIOS, precioBarraSalon, precioConGanancia, tarifaDeRegla } from "@/lib/cotizador-salon"

/**
 * El cotizador por salón ya convertido a PRECIO para el vendedor: por cada
 * salón, precio del salón, platos, barras visibles, servicios visibles y
 * reglas de personal con su precio por persona. Costos, tarifas y ganancias
 * se usan acá adentro y NO salen (ni siquiera los nombres de esos campos).
 */
export async function armarCotizadorPorSalon(preciosCocteles: Array<{ id: string; costoPorTrago: number }>) {
  const salones = await leerConfigTodosLosSalones()
  const [platos, barras] = await Promise.all([leerCostosPlatos(), leerBarrasArmadas()])
  const [servicios, personal] = await Promise.all([leerServiciosConCosto(), leerPersonalConTarifa()])
  const deCoctel = Object.fromEntries(preciosCocteles.map((c) => [c.id, c.costoPorTrago]))

  return salones.map((cfg) => ({
    salon: cfg.salon,
    capacidadMaxima: cfg.capacidadMaxima,
    precioSalon: precioConGanancia(cfg.costoSalon, cfg.gananciaSalon),
    // Recargo al cliente un sábado: monto fijo o % sobre el PRECIO de rubros.
    recargoSabado: cfg.recargoSabado,
    menu: cfg.recetas
      .map((id) => platos.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      // La categoría es el paso del menú (entrada, plato principal, postre):
      // con ella la pantalla agrupa los platos y pide los pasos que faltan.
      .map((p) => ({
        recetaId: p.id,
        nombre: p.nombre,
        categoria: p.categoria,
        precioPorPorcion: precioConGanancia(p.costoPorPorcion, cfg.gananciaCocina),
      })),
    barras: barras
      .filter((b) => cfg.barras.includes(b.id))
      .map((b) => {
        const precio = precioBarraSalon(b.coctelesIncluidos, deCoctel, cfg.gananciaBarra)
        return {
          id: b.id,
          nombre: b.nombre,
          coctelesIncluidos: b.coctelesIncluidos.filter((id) => id in deCoctel),
          precioPorAdulto: precio.precioPorAdulto,
          tragosPorAdulto: precio.tragosPorAdulto,
        }
      }),
    // Sin los de categoría Menú/Barra: la comida y la bebida salen de los
    // rubros Cocina y Barra (no se cobran dos veces).
    servicios: servicios
      .filter((sv) => !cfg.servicios.find((e) => e.servicioId === sv.id)?.oculto)
      .filter((sv) => !CATEGORIAS_FUERA_DE_SERVICIOS.includes(sv.categoria))
      .map((sv) => ({
        servicioId: sv.id,
        precio: precioConGanancia(sv.costo, cfg.gananciaServicios),
        incluido: !!cfg.servicios.find((e) => e.servicioId === sv.id)?.incluido,
      })),
    personal: cfg.reglasPersonal.map((r) => ({
      funcion: r.funcion,
      cadaNInvitados: r.cadaNInvitados,
      minimo: r.minimo,
      aplica: r.aplica,
      precioPorPersona: precioConGanancia(tarifaDeRegla(r, personal).tarifa, r.ganancia),
    })),
  }))
}

/** Un salón del catálogo de precios, tal como lo arma armarCotizadorPorSalon. */
export type SalonConPrecios = Awaited<ReturnType<typeof armarCotizadorPorSalon>>[number]
