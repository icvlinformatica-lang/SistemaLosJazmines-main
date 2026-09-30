export const dynamic = "force-dynamic"
// Carga inicial unificada: los 19 datos crudos que initializeData
// (lib/store-context.tsx) pedía en 19 viajes, en uno solo.
//
// - Mismas lecturas y mismo mapeo que las rutas de siempre: las 6 APIs propias
//   usan lib/lecturas-postgres.ts (igual que sus GET) y los 13 datos de
//   Supabase usan lib/supabase/lecturas.ts (igual que data-service.ts).
// - Éxito/error POR CLAVE: el navegador vuelve a pedir por el camino de
//   siempre solo las claves que fallaron, así el comportamiento ante errores
//   es idéntico al de antes.
// - Queda bajo el middleware de sesión (/api/*) como cualquier otra API.
// - No devuelve nada que no devolvieran ya esas 19 fuentes.
import { NextResponse } from "next/server"
import {
  leerInsumos,
  leerInsumosBarra,
  leerRecetas,
  leerCocteles,
  leerBarraTemplates,
  leerEventos,
} from "@/lib/lecturas-postgres"
import {
  leerServicios,
  leerPersonal,
  leerPagosPersonal,
  leerCostosOperativos,
  leerAsignaciones,
  leerMovimientosCaja,
  leerConfiguracionCajas,
  leerPreciosVenta,
  leerGastosArchivados,
  leerHistorialIPC,
  leerPaquetesSalones,
  leerTemporadas,
  leerVendedores,
} from "@/lib/supabase/lecturas"
import { clienteLecturaServidor } from "@/lib/supabase/servidor"

type Resultado = { ok: true; data: unknown } | { ok: false }

async function intentar(clave: string, leer: () => Promise<unknown>, esLista: boolean): Promise<[string, Resultado]> {
  try {
    const data = await leer()
    // Igual que fetchSafe: una API propia solo cuenta si devolvió una lista.
    if (esLista && !Array.isArray(data)) return [clave, { ok: false }]
    return [clave, { ok: true, data }]
  } catch (err) {
    console.error(`[carga-inicial] falló ${clave}:`, err)
    return [clave, { ok: false }]
  }
}

export async function GET() {
  const inicio = Date.now()
  const sb = clienteLecturaServidor()
  if (!sb) {
    // Sin credenciales de Supabase no se puede garantizar nada: el navegador
    // cae entero al camino de siempre.
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 })
  }

  // Todas las lecturas de Supabase lanzan ante un error (en vez de devolver
  // una lista vacía): esa clave queda fallida y el navegador la repide.
  const estricto = { lanzarErrores: true }
  const resultados = await Promise.all([
    intentar("insumos", leerInsumos, true),
    intentar("insumosBarra", leerInsumosBarra, true),
    intentar("recetas", leerRecetas, true),
    intentar("cocteles", leerCocteles, true),
    intentar("barraTemplates", leerBarraTemplates, true),
    intentar("eventos", leerEventos, true),
    intentar("servicios", () => leerServicios(sb), false),
    intentar("personal", () => leerPersonal(sb, false, estricto), false),
    intentar("pagosPersonal", () => leerPagosPersonal(sb), false),
    intentar("costosOperativos", () => leerCostosOperativos(sb, false, estricto), false),
    intentar("asignaciones", () => leerAsignaciones(sb, estricto), false),
    intentar("movimientosCaja", () => leerMovimientosCaja(sb), false),
    intentar("configuracionCajas", () => leerConfiguracionCajas(sb, estricto), false),
    intentar("preciosVenta", () => leerPreciosVenta(sb, estricto), false),
    intentar("gastosArchivados", () => leerGastosArchivados(sb, false, estricto), false),
    intentar("historialIPC", () => leerHistorialIPC(sb, estricto), false),
    intentar("paquetesSalones", () => leerPaquetesSalones(sb, estricto), false),
    intentar("temporadas", () => leerTemporadas(sb, estricto), false),
    intentar("vendedores", () => leerVendedores(sb, false, estricto), false),
  ])

  const claves = Object.fromEntries(resultados) as Record<string, Resultado>


  return NextResponse.json(
    { version: 1, claves },
    { headers: { "Cache-Control": "no-store", "Server-Timing": `total;dur=${Date.now() - inicio}` } },
  )
}
