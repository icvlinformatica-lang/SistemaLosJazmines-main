// Etiquetas y estilos del estado de una cotización (tabla "cotizaciones"),
// compartidos entre app/vendedor/cotizar y app/vendedor/paquetes para que
// no queden desincronizados.

export type EstadoCotizacion = "borrador" | "lista_para_revisar" | "aprobada" | "rechazada" | "convertida"

export const ESTADO_COTIZACION_LABEL: Record<EstadoCotizacion, string> = {
  borrador: "Sin enviar",
  lista_para_revisar: "Enviada — esperando revisión",
  aprobada: "Aprobada",
  rechazada: "Rechazada — necesita ajustes",
  convertida: "Convertida en evento",
}

export const ESTADO_COTIZACION_CLASE: Record<EstadoCotizacion, string> = {
  borrador: "bg-muted text-muted-foreground border-border",
  lista_para_revisar: "bg-amber-50 text-amber-700 border-amber-300",
  aprobada: "bg-emerald-50 text-emerald-700 border-emerald-300",
  rechazada: "bg-red-50 text-red-700 border-red-300",
  convertida: "bg-blue-50 text-blue-700 border-blue-300",
}
