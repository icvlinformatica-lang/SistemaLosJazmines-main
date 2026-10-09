// Número de teléfono argentino listo para un enlace de WhatsApp (wa.me).
// Los teléfonos del contrato se cargan a mano y vienen de mil formas
// ("011 4444-5555", "+54 9 11 ...", "(0221) 15..."): acá se los lleva al
// formato internacional que pide WhatsApp. Si no queda algo razonable se
// devuelve null y la pantalla no muestra el botón (mejor nada que un enlace
// que abre un chat con un número equivocado).
export function numeroWhatsApp(tel: string | null | undefined): string | null {
  // Solo dígitos: se van espacios, guiones, paréntesis y el "+".
  let digitos = String(tel ?? "").replace(/\D/g, "")
  // El 0 inicial es el prefijo de larga distancia nacional: WhatsApp no lo usa.
  digitos = digitos.replace(/^0+/, "")
  // Menos de 10 dígitos no alcanza para código de área + número.
  if (digitos.length < 10) return null
  // Sin código de país: se asume celular argentino (54 + 9).
  return digitos.startsWith("54") ? digitos : `549${digitos}`
}
