// Mensaje de WhatsApp para recordarle a un cliente su cuota, desde
// "Vienen a pagar" de Inicio. Solo arma texto: no cobra ni guarda nada.
import { numeroWhatsApp } from "@/lib/telefono-whatsapp"

function pesos(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR")
}

// "2026-10-10" -> "10/10/2026", sin pasar por Date para no correr el día por zona horaria.
function fechaDiaMesAnio(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || "")
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ymd || ""
}

export interface DatosRecordatorio {
  nombre: string
  numeroCuota: number
  monto: number
  fechaVencimiento: string // YYYY-MM-DD
  /** true si la cuota ya está vencida: el mensaje dice "venció" en vez de "vence". */
  vencida: boolean
  /** Si el monto todavía está a definir (IPC pendiente) no se lo pone en el mensaje. */
  montoADefinir?: boolean
}

export function mensajeRecordatorioCuota(d: DatosRecordatorio): string {
  const cuota = d.montoADefinir ? `la cuota ${d.numeroCuota}` : `la cuota ${d.numeroCuota} de ${pesos(d.monto)}`
  const verbo = d.vencida ? "venció" : "vence"
  return `Hola ${d.nombre.trim()}, te escribimos de Los Jazmines para recordarte que ${cuota} ${verbo} el ${fechaDiaMesAnio(d.fechaVencimiento)}. ¡Gracias!`
}

/** Enlace wa.me (con el mensaje, si hay), o null si el teléfono no sirve: entonces no se muestra el botón. */
export function enlaceWhatsApp(telefono: string | null | undefined, mensaje?: string): string | null {
  const numero = numeroWhatsApp(telefono)
  if (!numero) return null
  return `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`
}
