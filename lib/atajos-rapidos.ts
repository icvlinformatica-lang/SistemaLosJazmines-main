// Atajos rápidos de Inicio: botones a las pantallas que cada perfil usa más.
// Se arman solos: cada vez que alguien entra a una pantalla se anota (en ese
// navegador y por perfil) y los atajos se ordenan por cuántas veces se entró.
// Mientras no hay visitas suficientes se completan con unos de arranque por
// perfil. El historial de actividad de la base no sirve para esto: anota
// cambios (insumos, eventos, pagos), no a qué pantalla entra cada perfil.
// Funciones puras (sin window) para poder probarlas.

export interface Atajo {
  href: string
  label: string
  /** Nombre del ícono de lucide-react (el componente lo traduce). */
  icono: string
}

/** Pantallas que pueden ser atajo. Mismos nombres que el menú lateral. */
export const CATALOGO_ATAJOS: Atajo[] = [
  { href: "/eventos/lista", label: "Lista de eventos", icono: "List" },
  { href: "/eventos/calendario", label: "Calendario", icono: "Calendar" },
  { href: "/eventos/pagos", label: "Cobrar cuota", icono: "CreditCard" },
  { href: "/eventos/costos", label: "Costos del evento", icono: "Calculator" },
  { href: "/eventos/cotizaciones", label: "Cotizaciones", icono: "FileText" },
  { href: "/eventos/vendedores", label: "Vendedores", icono: "Users" },
  { href: "/eventos/finalizados", label: "Finalizados", icono: "Archive" },
  { href: "/eventos/produccion", label: "Guías de producción", icono: "ClipboardList" },
  { href: "/eventos/staff", label: "Próximos eventos", icono: "Calendar" },
  { href: "/admin/almacen", label: "Insumos Cocina", icono: "Warehouse" },
  { href: "/admin/barra", label: "Insumos Bebidas", icono: "GlassWater" },
  { href: "/admin/recetario", label: "Recetas", icono: "ChefHat" },
  { href: "/admin/cocteles", label: "Cocteles", icono: "Wine" },
  { href: "/stock", label: "Contar stock", icono: "ClipboardList" },
  { href: "/finanzas/caja-eventos", label: "Caja Eventos", icono: "Wallet" },
  { href: "/finanzas/caja-jazmines", label: "Caja Jazmines", icono: "Building2" },
  { href: "/finanzas/servicios", label: "Servicios", icono: "Briefcase" },
  { href: "/finanzas/personal", label: "Personal", icono: "Users" },
  { href: "/finanzas/ipc", label: "IPC", icono: "TrendingUp" },
  { href: "/vendedor/cotizar", label: "Cotizar", icono: "FileText" },
  { href: "/configuracion", label: "Configuración", icono: "Settings" },
]

// Cocina ve las guías como "Próximos eventos" en su menú: mismo nombre acá.
const LABEL_POR_PERFIL: Record<string, Record<string, string>> = {
  cocina: { "/eventos/produccion": "Próximos eventos", "/stock": "Stock por salón" },
}

/**
 * Atajos de arranque, en orden, para cuando todavía no hay visitas.
 * Administración: lo que más se mueve en el historial de actividad
 * (insumos de bebidas, eventos, cobros y cajas).
 */
export const ATAJOS_INICIALES: Record<string, string[]> = {
  administracion: [
    "/eventos/lista",
    "/eventos/pagos",
    "/finanzas/caja-eventos",
    "/finanzas/caja-jazmines",
    "/admin/recetario",
    "/admin/barra",
  ],
  soporte: [
    "/eventos/lista",
    "/eventos/pagos",
    "/finanzas/caja-eventos",
    "/finanzas/caja-jazmines",
    "/admin/recetario",
    "/configuracion",
  ],
  cobro: ["/eventos/pagos"],
  cocina: ["/eventos/produccion", "/stock"],
}

export const MAX_ATAJOS = 6

/** Cuántas veces entró este perfil a cada pantalla del catálogo. */
export type ConteoVisitas = Record<string, number>

export interface PermisosRutas {
  rutas: string[]
  rutasExcluidas?: string[]
}

/** Misma regla que components/app-shell.tsx: si no la deja entrar, no hay atajo. */
export function rutaPermitida(href: string, permisos: PermisosRutas): boolean {
  const excluidas = permisos.rutasExcluidas ?? []
  if (excluidas.some((r) => href === r || href.startsWith(r + "/"))) return false
  // OJO: `rutas: []` es acceso total, igual que "*".
  if (permisos.rutas.includes("*") || permisos.rutas.length === 0) return true
  return permisos.rutas.some((r) => href === r || href.startsWith(r + "/"))
}

/**
 * A qué atajo corresponde una pantalla. /eventos/pagos/123 cuenta como
 * "Cobrar cuota". Inicio, el login y las pantallas fuera del catálogo no cuentan.
 */
export function atajoDeRuta(pathname: string): string | null {
  let mejor: string | null = null
  for (const a of CATALOGO_ATAJOS) {
    if (pathname === a.href || pathname.startsWith(a.href + "/")) {
      if (!mejor || a.href.length > mejor.length) mejor = a.href
    }
  }
  return mejor
}

/** Suma una visita. Devuelve un objeto nuevo; si la pantalla no es atajo, el mismo. */
export function sumarVisita(conteo: ConteoVisitas, pathname: string): ConteoVisitas {
  const href = atajoDeRuta(pathname)
  if (!href) return conteo
  return { ...conteo, [href]: (conteo[href] ?? 0) + 1 }
}

/** Lee lo guardado tolerando basura (texto roto, números negativos, claves viejas). */
export function leerConteo(texto: string | null | undefined): ConteoVisitas {
  if (!texto) return {}
  try {
    const crudo = JSON.parse(texto)
    if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return {}
    const conteo: ConteoVisitas = {}
    for (const [href, n] of Object.entries(crudo)) {
      if (typeof n === "number" && Number.isFinite(n) && n > 0 && CATALOGO_ATAJOS.some((a) => a.href === href)) {
        conteo[href] = n
      }
    }
    return conteo
  } catch {
    return {}
  }
}

/**
 * Los atajos de un perfil: primero las pantallas a las que más entró (de más
 * a menos; si empatan, manda el orden de arranque y después el del catálogo),
 * y si faltan, los de arranque. Nunca uno al que el perfil no pueda entrar.
 */
export function armarAtajos(perfilId: string, permisos: PermisosRutas, conteo: ConteoVisitas, max: number = MAX_ATAJOS): Atajo[] {
  const iniciales = ATAJOS_INICIALES[perfilId] ?? []
  const orden = (href: string) => {
    const i = iniciales.indexOf(href)
    return i >= 0 ? i : iniciales.length + CATALOGO_ATAJOS.findIndex((a) => a.href === href)
  }
  const permitidos = CATALOGO_ATAJOS.filter((a) => rutaPermitida(a.href, permisos))
  const usados = permitidos
    .filter((a) => (conteo[a.href] ?? 0) > 0)
    .sort((a, b) => (conteo[b.href] ?? 0) - (conteo[a.href] ?? 0) || orden(a.href) - orden(b.href))
  const elegidos = usados.slice(0, max)
  for (const href of iniciales) {
    if (elegidos.length >= max) break
    const a = permitidos.find((p) => p.href === href)
    if (a && !elegidos.includes(a)) elegidos.push(a)
  }
  const labels = LABEL_POR_PERFIL[perfilId] ?? {}
  return elegidos.map((a) => (labels[a.href] ? { ...a, label: labels[a.href] } : a))
}

export const claveVisitas = (perfilId: string) => `lj_atajos_visitas_${perfilId}`
export const CLAVE_ATAJOS_PLEGADOS = "lj_atajos_plegados"
