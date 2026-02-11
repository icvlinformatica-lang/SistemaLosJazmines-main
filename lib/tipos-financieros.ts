// ==========================================
// TIPOS FINANCIEROS UNIFICADOS
// ==========================================

/**
 * Representa un egreso unificado (gasto fijo, servicio de evento, o pago a personal).
 * Normalizados para ser mostrados en una sola vista.
 */
export interface EgresoUnificado {
  id: string
  tipo: "gasto-fijo" | "servicio-evento" | "personal"
  concepto: string
  descripcion?: string
  monto: number
  estado: "pendiente" | "urgente" | "vencido" | "pagado" | "archivado"
  fechaVencimiento: string
  diasRestantes?: number

  // Vinculación a evento (opcional para gastos fijos)
  eventoId?: string
  eventoNombre?: string
  eventoFecha?: string

  // Personal (solo para tipo "personal")
  personalId?: string

  // Información de pago (si ya fue pagado)
  fechaPago?: string
  pago?: {
    tipoPago: "transferencia" | "efectivo" | "otro"
    notas?: string
  }

  // Si se archiva automáticamente al pagar
  archivaAutomatico: boolean

  // Detalles específicos según el tipo
  detalles: {
    // Gasto fijo
    salon?: string
    gastoFijoId?: string
    frecuencia?: string
    // Servicio evento
    proveedor?: string
    servicioIdx?: number
    // Personal
    nombrePersonal?: string
    telefonoPersonal?: string
    cuentaBancaria?: {
      banco: string
      cbu?: string
      alias?: string
    }
  }
}

/**
 * Representa un ingreso esperado (pago de cliente).
 */
export interface IngresoEsperado {
  id: string
  eventoId: string
  eventoNombre: string
  concepto: string
  monto: number
  fechaVencimiento: string
  estado: "pendiente" | "cobrado" | "vencido"
  tipoCuota?: {
    numeroCuota: number
    totalCuotas: number
  }
}

/**
 * Resumen financiero calculado.
 */
export interface ResumenFinanciero {
  egresos: {
    total: { count: number; total: number }
    pendientes: { count: number; total: number }
    urgentes: { count: number; total: number }
    vencidos: { count: number; total: number }
    pagados: { count: number; total: number }
  }
  ingresos: {
    total: { count: number; total: number }
    estaSemana: IngresoEsperado[]
    pendientes: { count: number; total: number }
    cobrados: { count: number; total: number }
  }
  balance: {
    cashflowEstaSemana: number
    totalPendiente: number
  }
}

/**
 * Filtros aplicables a la lista de egresos.
 */
export interface FiltrosEgresos {
  tipo?: ("gasto-fijo" | "servicio-evento" | "personal")[]
  estado?: ("pendiente" | "urgente" | "vencido" | "pagado" | "archivado")[]
  mostrarArchivados: boolean
  ordenarPor: "urgencia" | "monto" | "fecha"
  ordenDireccion: "asc" | "desc"
  periodo?: "esta-semana" | "este-mes" | "este-trimestre"
  busqueda?: string
}
