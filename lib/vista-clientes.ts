// Vista de Clientes: el prototipo del simulador "Armá tu fiesta" dentro del
// sistema (perfil "clientes", pantalla /clientes). Es lo que en el futuro va a
// ver el público que llega desde Instagram, todavía detrás del login.
//
// Funciones chicas y puras: las usan components/app-shell.tsx (cliente) y
// las rutas /api/clientes/* (servidor). Test: scripts/test-clientes-simulador.cjs

/** Perfiles que pueden abrir la vista de Clientes y leer sus datos (solo
 *  precios y fechas ocupadas, nunca costos). Administración y Soporte, para
 *  revisarla; "clientes", el perfil del prototipo. */
export const PERFILES_VISTA_CLIENTES = ["clientes", "administracion", "soporte"] as const

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
