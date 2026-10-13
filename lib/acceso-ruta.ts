// Si un perfil puede entrar a una pantalla. Es la misma regla con la que
// components/app-shell.tsx rebota a quien entra donde no le corresponde:
// sirve para no ofrecer links que después lo devolverían a su inicio.
// Ojo: `rutas: []` es acceso total, igual que "*".
type PerfilRutas = { rutas: string[]; rutasExcluidas?: string[] }

export function puedeEntrarARuta(perfil: PerfilRutas | null | undefined, ruta: string): boolean {
  if (!perfil) return false
  const coincide = (r: string) => ruta === r || ruta.startsWith(r + "/")
  if ((perfil.rutasExcluidas ?? []).some(coincide)) return false
  return perfil.rutas.includes("*") || perfil.rutas.length === 0 || perfil.rutas.some(coincide)
}
