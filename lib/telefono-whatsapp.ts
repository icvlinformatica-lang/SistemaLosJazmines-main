// Número para abrir WhatsApp (https://wa.me/<número>) a partir del teléfono
// que se cargó a mano, con la costumbre argentina: "011 15-1234-5678",
// "+54 9 11 1234 5678", "11 1234-5678"... wa.me necesita solo dígitos con el
// código de país y, para celulares de Argentina, el 9 después del 54.
//
// Regla (simple a propósito): solo dígitos, se saca el 0 inicial (prefijo de
// larga distancia) y, si no empieza con 54, se antepone 549. Si quedan menos
// de 10 dígitos no alcanza para un número completo: null (no se muestra el
// botón, mejor que abrir un chat con un número equivocado).
export function numeroWhatsApp(tel: string | null | undefined): string | null {
  let digitos = String(tel ?? "").replace(/\D/g, "")
  digitos = digitos.replace(/^0+/, "")
  if (!digitos) return null
  if (!digitos.startsWith("54")) digitos = `549${digitos}`
  return digitos.length >= 10 ? digitos : null
}
