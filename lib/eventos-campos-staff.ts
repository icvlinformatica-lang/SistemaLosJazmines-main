// Ida y vuelta de las columnas de eventos que agregó scripts/022: notas por
// oficio, cronograma, dietas con su tipo y origen del cliente. Lo usan
// app/api/eventos/route.ts y app/api/eventos/[id]/route.ts.
//
// Se LEEN con to_jsonb(eventos) (ver EXTRA_SELECT en las rutas), así que si el
// código se publica antes que la migración las lecturas siguen andando (dan
// null). Solo se devuelven cuando tienen algo: un campo vacío no viaja, y por
// eso un PATCH con el evento entero no intenta escribir columnas que quizás
// no existan.

import { normalizarNotasStaffPerfil, normalizarCronograma } from "./staff-evento"
import { normalizarDietasDetalle } from "./dietas-evento"
import { normalizarOrigen } from "./origen-cliente"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function camposStaffDesdeFila(r: Record<string, any>) {
  const notas = normalizarNotasStaffPerfil(r.notas_staff_perfil)
  const cronograma = normalizarCronograma(r.cronograma, r.horario)
  const dietas = normalizarDietasDetalle(r.dietas_detalle)
  const origen = normalizarOrigen(r.origen_cliente)
  return {
    ...(Object.keys(notas).length ? { notasStaffPerfil: notas } : {}),
    ...(cronograma.length ? { cronograma } : {}),
    ...(dietas.length ? { dietasDetalle: dietas } : {}),
    ...(origen ? { origenCliente: origen } : {}),
  }
}

/**
 * Columnas a escribir según lo que mandó el navegador. Solo las que vienen en
 * el pedido; vacío se guarda como null. El cronograma NO pasa por acá: tiene
 * su propia ruta (/api/eventos/[id]/cronograma) para que guardar el evento
 * entero no pise lo que Coordinación cargó mientras tanto.
 */
export function columnasStaffParaGuardar(ev: Record<string, unknown>): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  if ("notasStaffPerfil" in ev) {
    const notas = normalizarNotasStaffPerfil(ev.notasStaffPerfil)
    out.notas_staff_perfil = Object.keys(notas).length ? JSON.stringify(notas) : null
  }
  if ("dietasDetalle" in ev) {
    const dietas = normalizarDietasDetalle(ev.dietasDetalle)
    out.dietas_detalle = dietas.length ? JSON.stringify(dietas) : null
  }
  if ("origenCliente" in ev) {
    out.origen_cliente = normalizarOrigen(ev.origenCliente)
  }
  return out
}
