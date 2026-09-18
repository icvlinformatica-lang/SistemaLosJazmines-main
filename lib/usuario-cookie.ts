// Nombre de quien entró (Diego, Leila, Ricky, Aylin, Salón, o un vendedor
// individual), leído del lado del servidor desde la cookie `lj_usuario` que
// setea el login (ver usuarioActivo() en lib/profile-context.tsx, la versión
// para el cliente). Mismo criterio en todas las rutas del módulo vendedor.
export function usuarioDesdeCookie(req: Request, porDefecto = "Vendedor"): string {
  const raw = req.headers.get("cookie") || ""
  const match = raw.match(/(?:^|;\s*)lj_usuario=([^;]+)/)
  if (!match) return porDefecto
  try {
    return decodeURIComponent(match[1]).trim() || porDefecto
  } catch {
    return porDefecto
  }
}
