// Quién puede disparar los crons de resumen (mandan mail). Vercel manda
// "Authorization: Bearer <CRON_SECRET>" en cada corrida programada.
// Si falta CRON_SECRET no se deja pasar a nadie: antes, sin la variable,
// cualquiera que conociera la dirección podía disparar los mails.
export function cronAutorizado(authorization: string | null, secreto: string | undefined): boolean {
  if (!secreto) return false
  return authorization === `Bearer ${secreto}`
}
