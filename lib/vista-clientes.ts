// Vista de Clientes: el prototipo del simulador "Armá tu fiesta" dentro del
// sistema (perfil "clientes", pantalla /clientes). Es lo que en el futuro va a
// ver el público que llega desde Instagram, todavía detrás del login.
//
// Funciones chicas y puras: las usan components/app-shell.tsx (cliente) y
// las rutas /api/clientes/* (servidor). Test: scripts/test-clientes-simulador.cjs

/** Perfiles que pueden abrir la vista de Clientes y leer sus datos (solo
 *  precios y fechas ocupadas, nunca costos). Soporte, para revisarla y armar
 *  el link; "clientes", el perfil del prototipo. Administración no (pedido
 *  del 21/10/2026: solo entra Soporte). */
export const PERFILES_VISTA_CLIENTES = ["clientes", "soporte"] as const

export function puedeVerVistaClientes(perfil: string | null | undefined): boolean {
  return typeof perfil === "string" && (PERFILES_VISTA_CLIENTES as readonly string[]).includes(perfil)
}

/** ¿Es una pantalla de la vista de Clientes? Esas pantallas se muestran a
 *  pantalla completa, sin el menú del sistema ni la carga de datos internos
 *  (StoreProvider): son lo que vería un cliente. */
export function esRutaVistaClientes(pathname: string | null | undefined): boolean {
  const p = String(pathname ?? "")
  return p === "/clientes" || p.startsWith("/clientes/")
}

/** Qué rutas de la API puede usar una sesión del perfil "clientes": solo las
 *  del simulador (/api/clientes/*). Desde el 21/10/2026 esa sesión se puede
 *  abrir con un link sin PIN (lib/link-prototipo.ts), así que el middleware le
 *  cierra todo lo demás: /api/eventos (DNI y pagos), el proxy /api/db (cajas,
 *  personal) y cualquier otra. Las de login y logout son públicas y no pasan
 *  por acá. */
export function apiPermitidaParaClientes(pathname: string | null | undefined): boolean {
  const p = String(pathname ?? "")
  return p.startsWith("/api/clientes/")
}
