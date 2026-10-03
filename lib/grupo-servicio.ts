// Agrupa los nombres de servicio del catálogo que en realidad son "el mismo"
// servicio con distinto año o escritura ("VESTIDO 2027", "vestido 2025",
// "VESTIDO") para que el filtro de Por pagar muestre una sola pastilla por
// servicio. Solo visual: no cambia nombres ni montos guardados.

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")

/** Variantes conocidas que se escriben distinto pero son el mismo servicio. */
const ALIAS: [RegExp, string][] = [
  [/^ALTAR PERSONALIZADO$/, "ALTAR"],
  [/^FOTO ?[-+] ?VIDEO$/, "FOTOGRAFIA"], // Foto + Video va junto con Fotografía
  [/^MAQUILLA PEINADO$/, "MAQUILLAJE PEINADO"],
]

/** Clave de grupo: mayúsculas, sin acentos, sin el año del final y con los alias aplicados. */
export function grupoServicio(nombre: string): string {
  let clave = sinAcentos(nombre || "")
    .toUpperCase()
    .replace(/\s+(19|20)\d{2}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
  for (const [re, destino] of ALIAS) if (re.test(clave)) clave = destino
  return clave
}

/** Nombre para mostrar del grupo: la clave, pero con los acentos de algún
 *  nombre original que los tenga ("INVITACIÓN DIGITAL"). */
export function etiquetaGrupo(clave: string, nombres: string[]): string {
  for (const n of nombres) {
    const base = n.toUpperCase().replace(/\s+(19|20)\d{2}\s*$/, "").replace(/\s+/g, " ").trim()
    if (base !== clave && sinAcentos(base) === clave) return base
  }
  return clave
}
