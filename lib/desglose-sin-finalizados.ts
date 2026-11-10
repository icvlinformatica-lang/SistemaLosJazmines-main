// Desglose del saldo de Caja Eventos (pedido del dueño, 10/11/2026: "una vez
// que finalizo un evento y cubro los costos, no quiero que siga apareciendo en
// el desglose"). Las pestañas Tabla y Cuotas listan solo los eventos que no
// están finalizados (estado "completado").
//  - Lo que dejaron los finalizados en la caja sigue en el saldo: se devuelve
//    cuántos son y cuánto suman, para decirlo en una línea debajo de la lista.
//  - Los eventos borrados (sin datos) siguen como hasta ahora.
// Solo ordena lo que se muestra: no cambia montos ni escribe nada.

export function sinFinalizados<T extends { eventoId: string; ingresos: number; egresos: number }>(
  filas: T[],
  estadoPorEvento: Map<string, string | undefined>,
): { visibles: T[]; finalizados: number; netoFinalizados: number } {
  const visibles: T[] = []
  let finalizados = 0
  let neto = 0
  for (const f of filas) {
    if (estadoPorEvento.get(f.eventoId) === "completado") {
      finalizados += 1
      neto += f.ingresos - f.egresos
    } else visibles.push(f)
  }
  return { visibles, finalizados, netoFinalizados: Math.round(neto * 100) / 100 }
}

/** Solo los eventos que no están finalizados (para la pestaña Tabla). */
export function eventosNoFinalizados<T extends { estado?: string }>(eventos: T[]): T[] {
  return (eventos || []).filter((e) => e.estado !== "completado")
}
