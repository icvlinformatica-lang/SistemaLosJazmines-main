"use client"

// Data Store for Los Jazmines Catering System
// Uses localStorage for persistence

export type Unidad = "CC" | "KG" | "UN" | "LT" | "GR" | "GRS" | "L" | "M"

export type UnidadReceta = "GRS" | "KG" | "CC" | "L" | "UN" | "M"

export type CategoriaInsumoBarra =
  | "Alcoholes"
  | "Licores"
  | "Mixers"
  | "Jugos"
  | "Garnish"
  | "Otros"

export interface BarraTemplate {
  id: string
  nombre: string
  coctelesIncluidos: string[] // coctel IDs
}

export interface InsumoBarra {
  id: string
  codigo: string
  descripcion: string
  unidad: Unidad
  stockActual: number
  precioUnitario: number
  proveedor?: string
  categoria: CategoriaInsumoBarra
}

export interface InsumoCoctel {
  insumoBarraId: string
  cantidadPorCoctel: number
  unidadCoctel?: UnidadReceta
  detallePreparacion?: string
}

export type CategoriaCoctel = "Con Alcohol" | "Sin Alcohol"

export interface Coctel {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  imagen?: string
  categoria?: CategoriaCoctel
  insumos: InsumoCoctel[]
  preparacion?: string
}

export interface BarraEvento {
  id: string
  barraTemplateId: string
  coctelesIncluidos: string[]
  tragosPorPersona: number
}

export type RecetaCategoria =
  | "Recepción"
  | "Entrada"
  | "Plato Principal"
  | "Guarnición"
  | "Postre"
  | "Menú para Niños"
  | "Menú Adolescente"
  | "Celiaco"
  | "Vegano"
  | "Vegetariano"
  | "Sin Sal"

export interface Insumo {
  id: string
  codigo: string
  descripcion: string
  unidad: Unidad
  stockActual: number
  precioUnitario: number
  proveedor?: string
}

export interface InsumoReceta {
  insumoId: string
  detalleCorte: string
  cantidadBasePorPersona: number
  unidadReceta?: UnidadReceta
}

export interface Receta {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  imagen?: string
  categoria: RecetaCategoria
  insumos: InsumoReceta[]
  factorRendimiento: number // Default 1 — divide ingredient quantities per person
}

export interface DishSelection {
  recetaId: string
  portionMultiplier: number // Default 1, can be 2, 3, etc. for empanadas
}

export interface Evento {
  id: string
  nombre: string
  fecha: string
  horario?: string
  salon?: string
  tipoEvento?: "Casamiento" | "Cumpleaños de 15" | "Empresarial" | "Cumpleaños" | "Bautismo" | "Otro"
  nombrePareja?: string
  dniNovio1?: string
  dniNovio2?: string
  adultos: number
  adolescentes: number
  ninos: number
  personasDietasEspeciales: number
  recetasAdultos: string[] // Keep for backwards compatibility - array of recipe IDs
  recetasAdolescentes: string[]
  recetasNinos: string[]
  recetasDietasEspeciales: string[] // New array for special diets
  multipliersAdultos: Record<string, number>
  multipliersAdolescentes: Record<string, number>
  multipliersNinos: Record<string, number>
  multipliersDietasEspeciales: Record<string, number>
  descripcionPersonalizada: string
  barras?: BarraEvento[]
  servicios?: ServicioEvento[]
  paquetesSeleccionados?: string[] // IDs de PaqueteSalon seleccionados

  horarioFin?: string
  condicionIVA?: "Consumidor Final" | "Responsable Inscripto" | "Monotributista" | "Exento"

  // Datos del contrato
  contrato?: {
    nombreCompleto?: string
    direccion?: string
    telefono?: string
    email?: string
    dni?: string
    fechaNacimiento?: string
  }

  // Plan de cuotas
  planDeCuotas?: {
    numeroCuotas: number
    montoCuota: number
    montoTotal: number
    diaVencimiento: number
    fechaInicioPlan: string
    cuotasPagadas?: number[]
    modalidadPago?: "completo" | "sena" | "cuotas"
    montoSena?: number
    porcentajeRecargo?: number
  }
}

// --- Pagos ---

export interface PagoEvento {
  id: string
  monto: number
  fecha: string
  pagadoPor: string
  porcentajeIPC: number
  notas?: string
  montoRecibido?: number
  vuelto?: number
}

// --- Asignaciones de Personal ---

/**
 * Tracking de asignación de personal a un evento/servicio específico.
 * Permite saber quién trabaja en cada evento y comparar costos planeados vs reales.
 */
export interface AsignacionPersonal {
  id: string
  eventoId: string
  /** ID del ServicioEvento dentro del evento */
  servicioEventoId: string
  /** Rol que se requiere cubrir (ej: "Mozo", "Bartender") */
  rolRequerido: string
  /** ID del personal asignado (null si aún no se asignó) */
  personalAsignadoId: string | null
  /** Nombre del personal para visualización rápida */
  personalNombre?: string
  /** Costo planeado según el servicio */
  costoPlaneado: number
  /** Costo real según la tarifa del personal asignado */
  costoReal: number
  /** Si el personal confirmó su asistencia */
  confirmado: boolean
  /** Fecha en que se realizó la asignación (ISO string) */
  fechaAsignacion: string
  /** Notas adicionales sobre esta asignación */
  notas?: string
}

// --- Servicios ---

export type CategoriaServicio =
  | "Salon y Espacio"
  | "Fotografia y Video"
  | "Decoracion"
  | "Entretenimiento"
  | "Pasteleria"
  | "Transporte"
  | "Papeleria"
  | "Otros"

export interface Servicio {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  categoria: CategoriaServicio

  /** Porcentaje de margen de ganancia sobre el costo base (ej: 30 para 30%).
   *  precioInterno se calcula sumando tarifaBase del personal vinculado.
   *  precioOficial = precioInterno * (1 + margenGanancia / 100). */
  margenGanancia: number

  unidad: "Fijo" | "Por Persona" | "Por Hora"
  proveedor?: string
  notas?: string
  activo: boolean
}

export interface ServicioEvento {
  servicioId: string
  nombre: string
  cantidad: number
  // precioUnitario se obtiene dinámicamente con obtenerPreciosServicio()
  unidad: "Fijo" | "Por Persona" | "Por Hora"
  notas?: string
  proveedor?: string
  pagado?: boolean
  fechaLimitePago?: string // YYYY-MM-DD - auto-calculated or manually set
}

// --- Costos Operativos ---

export type TipoCostoOperativo =
  | "Servicios Basicos"
  | "Alquiler"
  | "Mantenimiento"
  | "Personal Fijo"
  | "Impuestos y Tasas"
  | "Seguros"
  | "Otros"

export interface CostoOperativo {
  id: string
  concepto: string
  tipo: TipoCostoOperativo
  monto: number
  frecuencia: "Por Evento" | "Mensual" | "Anual"
  esPorPersona: boolean
  montoPorPersona?: number
  salon?: string
  activo: boolean
  notas?: string
  fechaVencimiento?: string // YYYY-MM-DD
}

export const SALONES = ["Quinta", "Casona", "Salon"] as const
export type SalonNombre = (typeof SALONES)[number]

export type EstadoEvento = "borrador" | "pendiente" | "en_preparacion" | "completado" | "cancelado"

export interface EventoGuardado extends Evento {
  estado: EstadoEvento
  colorTag?: string
  precioVenta?: number
  costoPersonal?: number
  costoInsumos?: number
  costoServicios?: number
  costoOperativo?: number
  notasInternas?: string
  pagos?: PagoEvento[]
  planCuotas?: number
  montoTotalPlan?: number
  stockDescontado?: boolean       // true si el stock ya fue descontado al imprimir
  fechaImpresion?: string | null  // ISO string de cuando se imprimio por primera vez

  // --- Extensiones para asignaciones y costos calculados ---
  /** Asignaciones de personal a los servicios de este evento */
  asignaciones?: AsignacionPersonal[]
  /** Resumen de costos calculados automáticamente */
  costosCalculados?: {
    /** Suma de costos planeados (según servicios) */
    costoPlaneado: number
    /** Suma de costos reales (según personal asignado) */
    costoReal: number
    /** Diferencia entre planeado y real (positivo = ahorro, negativo = exceso) */
    diferencia: number
  }
}

export interface EventoHistorial {
  id: string
  eventoId: string
  nombre: string
  fecha: string
  totalPersonas: number
  costoTotal: number
  fechaCierre: string
  snapshot: string // JSON stringified snapshot of the event and calculations
}

// --- Calendario de Precios ---
// preciosVenta[salon][fecha "YYYY-MM-DD"] = precio
export type PreciosVentaMap = Record<string, Record<string, number>>
// ==========================================
// NUEVOS TIPOS: PAQUETES POR SALÓN
// ==========================================

export interface PaqueteSalon {
  id: string
  salon: "Quinta" | "Casona" | "Salon"
  nombre: string
  descripcion: string

  // SERVICIOS INCLUIDOS
  serviciosIncluidos: Array<{
    servicioId: string
    nombre: string
    categoria: CategoriaServicio
    precioInterno: number
    precioOficial: number
    unidad: "Fijo" | "Por Persona" | "Por Hora"
    cantidad?: number
    notas?: string
  }>

  // TOTALES CALCULADOS
  costoTotal: number           // Suma de preciosInternos
  precioOficial: number        // Lo que ve el cliente
  ganancia: number             // precioOficial - costoTotal
  margenPorcentaje: number     // (ganancia / costoTotal) * 100

  // CAPACIDAD
  capacidadMinima: number
  capacidadMaxima: number

  // ESTADO
  activo: boolean
  notas?: string
}

// ==========================================
// NUEVOS TIPOS: TEMPORADAS DE PRECIOS
// ==========================================

export type TipoTemporada = "Bronce" | "Plata" | "Oro"

export interface TemporadaPrecio {
  id: string
  nombre: string
  tipo: TipoTemporada

  // RANGO DE FECHAS
  fechaInicio: string          // YYYY-MM-DD
  fechaFin: string             // YYYY-MM-DD

  // MODIFICADORES POR SALÓN
  modificadores: {
    Quinta: {
      multiplicador: number    // Ej: 0.85 = 15% descuento, 1.20 = 20% incremento
      ajusteFijo?: number      // Ej: -500000 = restar 500k
    }
    Casona: {
      multiplicador: number
      ajusteFijo?: number
    }
    Salon: {
      multiplicador: number
      ajusteFijo?: number
    }
  }

  activo: boolean
  notas?: string
}

// ==========================================
// PERSONAL Y PAGOS
// ==========================================

export interface PersonalEvento {
  id: string
  nombre: string
  apellido: string
  dni: string
  telefono: string
  email?: string
  funcion: string // "Fotógrafo", "DJ", "Decorador", etc.
  servicioVinculadoId: string // ID del servicio del catálogo
  tarifaBase: number
  cuentaBancaria?: {
    banco: string
    cbu: string
    alias: string
  }
  activo: boolean
  notas?: string
}

export type TipoPago = "transferencia" | "efectivo" | "otro"
export type EstadoPago = "pendiente" | "pagado" | "vencido"

export interface PagoPersonal {
  id: string
  personalId: string
  eventoId: string
  nombrePersonal: string
  servicioNombre: string
  montoTotal: number
  fechaEvento: string // YYYY-MM-DD
  fechaLimitePago: string // YYYY-MM-DD (7 días antes del evento)
  estado: EstadoPago
  tipoPago?: TipoPago
  fechaPago?: string // YYYY-MM-DD
  firmaPersonal?: string // base64 de la firma
  firmaEmpresa?: string // base64 de la firma
  comprobanteFirmado?: boolean
  notasPago?: string

  // --- Extensión para vincular con asignación ---
  /** ID de la AsignacionPersonal relacionada (si existe) */
  asignacionId?: string
}

export interface AppState {
  insumos: Insumo[]
  insumosBarra: InsumoBarra[]
  recetas: Receta[]
  cocteles: Coctel[]
  barrasTemplates: BarraTemplate[]
  servicios: Servicio[]
  costosOperativos: CostoOperativo[]
  eventoActual: Evento | null
  eventos: EventoGuardado[]
  historial: EventoHistorial[]
  preciosVenta: PreciosVentaMap
  // AGREGAR ESTAS DOS LÍNEAS DENTRO DE AppState:
  paquetesSalones: PaqueteSalon[]
  temporadas: TemporadaPrecio[]
  // NUEVAS LÍNEAS PARA PERSONAL Y PAGOS:
  personal: PersonalEvento[]
  pagosPersonal: PagoPersonal[]
  // Asignaciones globales de personal a eventos
  asignaciones: AsignacionPersonal[]
}

export interface CalculoCompra {
  insumoId: string
  insumo: Insumo
  cantidadNecesaria: number
  cantidadAComprar: number
  costoEstimado: number
  detalleCorte: string
}

export interface CalculoCompraSegmentado {
  insumoId: string
  insumo: Insumo
  cantidadNecesaria: number
  cantidadAComprar: number
  costoEstimado: number // This is now "cash needed now" (what to buy)
  costoMateriaPrima: number // NEW: Real cost of ingredients used (regardless of stock)
  detalleCorte: string
  // Track which segments use this ingredient
  usadoEnAdultos: boolean
  usadoEnAdolescentes: boolean
  usadoEnNinos: boolean
  usadoEnDietasEspeciales: boolean
  usadoEnBarras?: boolean
}

const STORAGE_KEY = "los-jazmines-data"

// Sample data for initial setup
const initialInsumos: Insumo[] = [
  { id: "INS001", codigo: "INS001", descripcion: "ACEITE GIRASOL", unidad: "CC", stockActual: 1000, precioUnitario: 0 },
  {
    id: "INS002",
    codigo: "INS002",
    descripcion: "ACEITE DE OLIVA",
    unidad: "CC",
    stockActual: 1000,
    precioUnitario: 0,
  },
  { id: "INS003", codigo: "INS003", descripcion: "ACEITUNAS", unidad: "UN", stockActual: 1000, precioUnitario: 0 },
  {
    id: "INS004",
    codigo: "INS004",
    descripcion: "ACETO BALSAMICO",
    unidad: "CC",
    stockActual: 1000,
    precioUnitario: 0,
  },
  { id: "INS005", codigo: "INS005", descripcion: "HARINA", unidad: "KG", stockActual: 1000, precioUnitario: 0 },
  { id: "INS006", codigo: "INS006", descripcion: "LEVADURA", unidad: "GRS", stockActual: 1000, precioUnitario: 0 },
  { id: "INS007", codigo: "INS007", descripcion: "PALMITOS", unidad: "GRS", stockActual: 1000, precioUnitario: 0 },
  { id: "INS008", codigo: "INS008", descripcion: "PAN RALLADO", unidad: "KG", stockActual: 1000, precioUnitario: 0 },
  { id: "INS009", codigo: "INS009", descripcion: "REBOZADOR", unidad: "KG", stockActual: 1000, precioUnitario: 0 },
  { id: "INS010", codigo: "INS010", descripcion: "SABORIZANTES", unidad: "UN", stockActual: 1010, precioUnitario: 0 },
  { id: "INS011", codigo: "INS011", descripcion: "SAL", unidad: "GRS", stockActual: 1010, precioUnitario: 0 },
  { id: "INS012", codigo: "INS012", descripcion: "SALSA DE SOJA", unidad: "CC", stockActual: 1010, precioUnitario: 0 },
  { id: "INS013", codigo: "INS013", descripcion: "TAPAS COPETIN", unidad: "UN", stockActual: 1010, precioUnitario: 0 },
  {
    id: "INS014",
    codigo: "INS014",
    descripcion: "TAPAS CRIOLLAS HOGAREÑA",
    unidad: "UN",
    stockActual: 1010,
    precioUnitario: 0,
  },
  {
    id: "INS015",
    codigo: "INS015",
    descripcion: "TAPAS OJALDRE HOGAREÑA",
    unidad: "UN",
    stockActual: 1010,
    precioUnitario: 0,
  },
  { id: "INS016", codigo: "INS016", descripcion: "TOMATE BOTELLA", unidad: "CC", stockActual: 1010, precioUnitario: 0 },
  { id: "INS017", codigo: "INS017", descripcion: "TOMATE PURÉ", unidad: "CC", stockActual: 1010, precioUnitario: 0 },
  { id: "INS018", codigo: "INS018", descripcion: "TOMATE SECO", unidad: "GRS", stockActual: 1010, precioUnitario: 0 },
  { id: "INS019", codigo: "INS019", descripcion: "VINAGRE", unidad: "CC", stockActual: 1010, precioUnitario: 0 },
  { id: "INS020", codigo: "INS020", descripcion: "PAN", unidad: "KG", stockActual: 1020, precioUnitario: 0 },
  { id: "INS021", codigo: "INS021", descripcion: "FIGAZAS", unidad: "UN", stockActual: 1020, precioUnitario: 0 },
  { id: "INS022", codigo: "INS022", descripcion: "MIGNONES", unidad: "UN", stockActual: 1020, precioUnitario: 0 },
  { id: "INS023", codigo: "INS023", descripcion: "FLAUTITAS", unidad: "UN", stockActual: 1020, precioUnitario: 0 },
  { id: "INS024", codigo: "INS024", descripcion: "LECHE", unidad: "L", stockActual: 1020, precioUnitario: 0 },
  { id: "INS025", codigo: "INS025", descripcion: "CREMA DE LECHE", unidad: "L", stockActual: 1020, precioUnitario: 0 },
  { id: "INS026", codigo: "INS026", descripcion: "QUESO BARRA", unidad: "KG", stockActual: 1020, precioUnitario: 0 },
  { id: "INS027", codigo: "INS027", descripcion: "QUESO CREMOSO", unidad: "KG", stockActual: 1020, precioUnitario: 0 },
  {
    id: "INS028",
    codigo: "INS028",
    descripcion: "QUESO ROQUEFORT",
    unidad: "KG",
    stockActual: 1020,
    precioUnitario: 0,
  },
  { id: "INS029", codigo: "INS029", descripcion: "QUESO SARDO", unidad: "KG", stockActual: 1020, precioUnitario: 0 },
  { id: "INS030", codigo: "INS030", descripcion: "BONDIOLA", unidad: "KG", stockActual: 1030, precioUnitario: 0 },
  {
    id: "INS031",
    codigo: "INS031",
    descripcion: "BONDIOLA DE CERDO",
    unidad: "KG",
    stockActual: 1030,
    precioUnitario: 0,
  },
  { id: "INS032", codigo: "INS032", descripcion: "CARNE ASADO", unidad: "KG", stockActual: 1030, precioUnitario: 0 },
  {
    id: "INS033",
    codigo: "INS033",
    descripcion: "CARNE BOLA DE LOMO",
    unidad: "KG",
    stockActual: 1030,
    precioUnitario: 0,
  },
  { id: "INS034", codigo: "INS034", descripcion: "CARNE CUADRADA", unidad: "KG", stockActual: 1030, precioUnitario: 0 },
  { id: "INS035", codigo: "INS035", descripcion: "CARNE LOMO", unidad: "KG", stockActual: 1030, precioUnitario: 0 },
  { id: "INS036", codigo: "INS036", descripcion: "CARNE MATAMBRE", unidad: "KG", stockActual: 1030, precioUnitario: 0 },
  { id: "INS037", codigo: "INS037", descripcion: "CARNE NALGA", unidad: "KG", stockActual: 1030, precioUnitario: 0 },
  { id: "INS038", codigo: "INS038", descripcion: "CARNE PALETA", unidad: "KG", stockActual: 1030, precioUnitario: 0 },
  { id: "INS039", codigo: "INS039", descripcion: "CARNE PECETO", unidad: "KG", stockActual: 1030, precioUnitario: 0 },
  { id: "INS040", codigo: "INS040", descripcion: "CARNE PICADA", unidad: "KG", stockActual: 1040, precioUnitario: 0 },
  {
    id: "INS041",
    codigo: "INS041",
    descripcion: "CARNE ROAST BEEF",
    unidad: "KG",
    stockActual: 1040,
    precioUnitario: 0,
  },
  { id: "INS042", codigo: "INS042", descripcion: "CARNE VACIO", unidad: "KG", stockActual: 1040, precioUnitario: 0 },
  { id: "INS043", codigo: "INS043", descripcion: "CARRÉ", unidad: "KG", stockActual: 1040, precioUnitario: 0 },
  { id: "INS044", codigo: "INS044", descripcion: "CHORIZO", unidad: "KG", stockActual: 1040, precioUnitario: 0 },
  { id: "INS045", codigo: "INS045", descripcion: "MORCILLA", unidad: "KG", stockActual: 1040, precioUnitario: 0 },
  { id: "INS046", codigo: "INS046", descripcion: "PATA MUSLO", unidad: "KG", stockActual: 1040, precioUnitario: 0 },
  { id: "INS047", codigo: "INS047", descripcion: "PECHITO", unidad: "KG", stockActual: 1040, precioUnitario: 0 },
  { id: "INS048", codigo: "INS048", descripcion: "POLLO ENTERO", unidad: "KG", stockActual: 1040, precioUnitario: 0 },
  { id: "INS049", codigo: "INS049", descripcion: "SUPREMA", unidad: "KG", stockActual: 1040, precioUnitario: 0 },
  { id: "INS050", codigo: "INS050", descripcion: "AJO", unidad: "GRS", stockActual: 1050, precioUnitario: 0 },
  { id: "INS051", codigo: "INS051", descripcion: "BATATA", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS052", codigo: "INS052", descripcion: "BERENJENAS", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS053", codigo: "INS053", descripcion: "CEBOLLA", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS054", codigo: "INS054", descripcion: "CEBOLLA MORADA", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS055", codigo: "INS055", descripcion: "CHAMPIÑONES", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS056", codigo: "INS056", descripcion: "DURAZNO", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS057", codigo: "INS057", descripcion: "ESPINACA", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS058", codigo: "INS058", descripcion: "HUEVOS", unidad: "UN", stockActual: 1050, precioUnitario: 0 },
  {
    id: "INS059",
    codigo: "INS059",
    descripcion: "LECHUGA CAPUCHINA",
    unidad: "KG",
    stockActual: 1050,
    precioUnitario: 0,
  },
  {
    id: "INS060",
    codigo: "INS060",
    descripcion: "LECHUGA CRIOLLA",
    unidad: "KG",
    stockActual: 1050,
    precioUnitario: 0,
  },
  {
    id: "INS061",
    codigo: "INS061",
    descripcion: "LECHUGA MANTECA",
    unidad: "KG",
    stockActual: 1050,
    precioUnitario: 0,
  },
  { id: "INS062", codigo: "INS062", descripcion: "LIMON", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS063", codigo: "INS063", descripcion: "MANDARINA", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS064", codigo: "INS064", descripcion: "MANZANA", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  {
    id: "INS065",
    codigo: "INS065",
    descripcion: "MORRON AMARILLO",
    unidad: "KG",
    stockActual: 1050,
    precioUnitario: 0,
  },
  { id: "INS066", codigo: "INS066", descripcion: "MORRON ROJO", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS067", codigo: "INS067", descripcion: "MORRON VERDE", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS068", codigo: "INS068", descripcion: "NARANJA", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS069", codigo: "INS069", descripcion: "PAPAS", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS070", codigo: "INS070", descripcion: "PEREJIL", unidad: "GRS", stockActual: 1050, precioUnitario: 0 },
  { id: "INS071", codigo: "INS071", descripcion: "PERA", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS072", codigo: "INS072", descripcion: "PUERRO", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS073", codigo: "INS073", descripcion: "RADICHETA", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS074", codigo: "INS074", descripcion: "REMOLACHA", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS075", codigo: "INS075", descripcion: "REPOLLO BLANCO", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  {
    id: "INS076",
    codigo: "INS076",
    descripcion: "REPOLLO COLORADO",
    unidad: "KG",
    stockActual: 1050,
    precioUnitario: 0,
  },
  { id: "INS077", codigo: "INS077", descripcion: "VERDEO", unidad: "GRS", stockActual: 1050, precioUnitario: 0 },
  { id: "INS078", codigo: "INS078", descripcion: "ZANAHORIA", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS079", codigo: "INS079", descripcion: "ZAPALLO", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS080", codigo: "INS080", descripcion: "ZAPALLITO", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS081", codigo: "INS081", descripcion: "CREMA DE LECHE", unidad: "L", stockActual: 1050, precioUnitario: 0 },
  {
    id: "INS082",
    codigo: "INS082",
    descripcion: "PIMIENTA NEGRA",
    unidad: "GRS",
    stockActual: 1050,
    precioUnitario: 0,
  },
  { id: "INS083", codigo: "INS083", descripcion: "VINO BLANCO", unidad: "L", stockActual: 1050, precioUnitario: 0 },
  { id: "INS084", codigo: "INS084", descripcion: "VINO TINTO", unidad: "L", stockActual: 1050, precioUnitario: 0 },
  { id: "INS085", codigo: "INS085", descripcion: "CALDO DE CARNE", unidad: "L", stockActual: 1050, precioUnitario: 0 },
  { id: "INS086", codigo: "INS086", descripcion: "ROMERO", unidad: "GRS", stockActual: 1050, precioUnitario: 0 },
  {
    id: "INS087",
    codigo: "INS087",
    descripcion: "PIMIENTON DULCE",
    unidad: "GRS",
    stockActual: 1050,
    precioUnitario: 0,
  },
  { id: "INS088", codigo: "INS088", descripcion: "LAUREL", unidad: "UN", stockActual: 1050, precioUnitario: 0 },
  { id: "INS089", codigo: "INS089", descripcion: "OREGANO", unidad: "GRS", stockActual: 1050, precioUnitario: 0 },
  {
    id: "INS090",
    codigo: "INS090",
    descripcion: "PIMIENTON DULCE",
    unidad: "GRS",
    stockActual: 1050,
    precioUnitario: 0,
  },
  { id: "INS091", codigo: "INS091", descripcion: "AJI MOLIDO", unidad: "GRS", stockActual: 1050, precioUnitario: 0 },
  { id: "INS092", codigo: "INS092", descripcion: "MOSTAZA", unidad: "GRS", stockActual: 1050, precioUnitario: 0 },
  { id: "INS093", codigo: "INS093", descripcion: "MIEL", unidad: "GRS", stockActual: 1050, precioUnitario: 0 },
  { id: "INS094", codigo: "INS094", descripcion: "AZUCAR NEGRA", unidad: "KG", stockActual: 1050, precioUnitario: 0 },
  { id: "INS095", codigo: "INS095", descripcion: "CERVEZA NEGRA", unidad: "L", stockActual: 1050, precioUnitario: 0 },
  { id: "INS096", codigo: "INS096", descripcion: "TOMILLO", unidad: "GRS", stockActual: 1050, precioUnitario: 0 },
  { id: "INS097", codigo: "INS097", descripcion: "HILO CHORICERO", unidad: "M", stockActual: 1050, precioUnitario: 0 },
  { id: "INS098", codigo: "INS098", descripcion: "PAPEL ALUMINIO", unidad: "M", stockActual: 1050, precioUnitario: 0 },
]

const initialRecetas: Receta[] = [
  // PLATOS PRINCIPALES
  { id: "P001", codigo: "P001", nombre: "Suprema Verdeo", descripcion: "", categoria: "Plato Principal", insumos: [] },
  {
    id: "P002",
    codigo: "P002",
    nombre: "Bondiola Breseada",
    descripcion: "",
    categoria: "Plato Principal",
    insumos: [],
  },
  { id: "P003", codigo: "P003", nombre: "Asado Completo", descripcion: "", categoria: "Plato Principal", insumos: [] },
  {
    id: "P004",
    codigo: "P004",
    nombre: "Suprema al Champiñon",
    descripcion: "",
    categoria: "Plato Principal",
    insumos: [],
  },
  {
    id: "P005",
    codigo: "P005",
    nombre: "Milanesas Ternera Napo",
    descripcion: "",
    categoria: "Plato Principal",
    insumos: [],
  },
  {
    id: "P006",
    codigo: "P006",
    nombre: "Pastas Rellenas c/Salsa",
    descripcion: "",
    categoria: "Plato Principal",
    insumos: [],
  },
  {
    id: "P007",
    codigo: "P007",
    nombre: "Bondiola a la Parrilla",
    descripcion: "",
    categoria: "Plato Principal",
    insumos: [],
  },
  { id: "P008", codigo: "P008", nombre: "Suprema Rellena", descripcion: "", categoria: "Plato Principal", insumos: [] },
  { id: "P009", codigo: "P009", nombre: "Pizza Party", descripcion: "", categoria: "Plato Principal", insumos: [] },
  {
    id: "P010",
    codigo: "P010",
    nombre: "Hamburguesas Full",
    descripcion: "",
    categoria: "Plato Principal",
    insumos: [],
  },
  // Dietas Especiales
  { id: "P011", codigo: "P011", nombre: "Menú Celíacos 1", descripcion: "", categoria: "Plato Principal", insumos: [] },
  { id: "P012", codigo: "P012", nombre: "Menú Celíacos 2", descripcion: "", categoria: "Plato Principal", insumos: [] },
  { id: "P013", codigo: "P013", nombre: "Menú Vegano 1", descripcion: "", categoria: "Plato Principal", insumos: [] },
  { id: "P014", codigo: "P014", nombre: "Menú Vegano 2", descripcion: "", categoria: "Plato Principal", insumos: [] },
  { id: "P015", codigo: "P015", nombre: "Menú Vegano 3", descripcion: "", categoria: "Plato Principal", insumos: [] },

  // ENTRADAS
  { id: "E001", codigo: "E001", nombre: "Chorizo y Morcilla", descripcion: "", categoria: "Entrada", insumos: [] },
  { id: "E002", codigo: "E002", nombre: "Cazuela Pollo", descripcion: "", categoria: "Entrada", insumos: [] },
  { id: "E003", codigo: "E003", nombre: "Cazuela Bondiola", descripcion: "", categoria: "Entrada", insumos: [] },
  { id: "E004", codigo: "E004", nombre: "Cazuela Risotto", descripcion: "", categoria: "Entrada", insumos: [] },
  { id: "E005", codigo: "E005", nombre: "Cazuela Strogonoff", descripcion: "", categoria: "Entrada", insumos: [] },
  {
    id: "E006",
    codigo: "E006",
    nombre: "Tacos Carne/Pollo/Verdura",
    descripcion: "",
    categoria: "Entrada",
    insumos: [],
  },
  { id: "E007", codigo: "E007", nombre: "Tabla de Fiambres", descripcion: "", categoria: "Entrada", insumos: [] },
  { id: "E008", codigo: "E008", nombre: "Arrollado de Pollo", descripcion: "", categoria: "Entrada", insumos: [] },
  { id: "E009", codigo: "E009", nombre: "Matambre Arrollado", descripcion: "", categoria: "Entrada", insumos: [] },

  // RECEPCIÓN
  {
    id: "R001",
    codigo: "R001",
    nombre: "Empanaditas Copetín Carne",
    descripcion: "",
    categoria: "Recepción",
    insumos: [],
  },
  {
    id: "R002",
    codigo: "R002",
    nombre: "Empanaditas Copetín Pollo",
    descripcion: "",
    categoria: "Recepción",
    insumos: [],
  },
  {
    id: "R003",
    codigo: "R003",
    nombre: "Canastita Muza y Jamón",
    descripcion: "",
    categoria: "Recepción",
    insumos: [],
  },
  {
    id: "R004",
    codigo: "R004",
    nombre: "Canastita Muza y Cebolla",
    descripcion: "",
    categoria: "Recepción",
    insumos: [],
  },
  {
    id: "R005",
    codigo: "R005",
    nombre: "Canastita Muza y Roquefort",
    descripcion: "",
    categoria: "Recepción",
    insumos: [],
  },
  {
    id: "R006",
    codigo: "R006",
    nombre: "Canastita Muza y Panceta",
    descripcion: "",
    categoria: "Recepción",
    insumos: [],
  },
  {
    id: "R007",
    codigo: "R007",
    nombre: "Canastita Muza y Choclo",
    descripcion: "",
    categoria: "Recepción",
    insumos: [],
  },
  { id: "R008", codigo: "R008", nombre: "Canastita Verdura", descripcion: "", categoria: "Recepción", insumos: [] },
  { id: "R009", codigo: "R009", nombre: "Canastita Capresse", descripcion: "", categoria: "Recepción", insumos: [] },
  {
    id: "R010",
    codigo: "R010",
    nombre: "Canastita Muza, Jamón y Morrón",
    descripcion: "",
    categoria: "Recepción",
    insumos: [],
  },
  { id: "R011", codigo: "R011", nombre: "Canastita Muzarella", descripcion: "", categoria: "Recepción", insumos: [] },
  { id: "R012", codigo: "R012", nombre: "Albondiguitas", descripcion: "", categoria: "Recepción", insumos: [] },
  { id: "R013", codigo: "R013", nombre: "Salchichas Envueltas", descripcion: "", categoria: "Recepción", insumos: [] },
  { id: "R014", codigo: "R014", nombre: "Brusqueta Salmón", descripcion: "", categoria: "Recepción", insumos: [] },
  { id: "R015", codigo: "R015", nombre: "Brusqueta Serrano", descripcion: "", categoria: "Recepción", insumos: [] },
  { id: "R016", codigo: "R016", nombre: "Brusqueta Brie", descripcion: "", categoria: "Recepción", insumos: [] },
  {
    id: "R017",
    codigo: "R017",
    nombre: "Brusqueta Crema Ciboulette",
    descripcion: "",
    categoria: "Recepción",
    insumos: [],
  },
  { id: "R018", codigo: "R018", nombre: "Chip Jamón y Queso", descripcion: "", categoria: "Recepción", insumos: [] },
  { id: "R019", codigo: "R019", nombre: "Chip Crudo y Queso", descripcion: "", categoria: "Recepción", insumos: [] },
  { id: "R020", codigo: "R020", nombre: "Chip Caprese", descripcion: "", categoria: "Recepción", insumos: [] },
  {
    id: "R021",
    codigo: "R021",
    nombre: "Pinchos Carne y Verdura",
    descripcion: "",
    categoria: "Recepción",
    insumos: [],
  },
  {
    id: "R022",
    codigo: "R022",
    nombre: "Pinchos Pollo y Verduras",
    descripcion: "",
    categoria: "Recepción",
    insumos: [],
  },
  {
    id: "R023",
    codigo: "R023",
    nombre: "Pinchos Bondiola y Verduras",
    descripcion: "",
    categoria: "Recepción",
    insumos: [],
  },
  {
    id: "R024",
    codigo: "R024",
    nombre: "Pinchos Langostino Rebozado",
    descripcion: "",
    categoria: "Recepción",
    insumos: [],
  },
  { id: "R025", codigo: "R025", nombre: "Pinchos Caprese", descripcion: "", categoria: "Recepción", insumos: [] },
  {
    id: "R026",
    codigo: "R026",
    nombre: "Pinchos Caprese Bocconcino",
    descripcion: "",
    categoria: "Recepción",
    insumos: [],
  },

  // MENÚ NIÑOS
  {
    id: "K001",
    codigo: "K001",
    nombre: "Patitas de Pollo",
    descripcion: "",
    categoria: "Menú para Niños",
    insumos: [],
  },
  { id: "K002", codigo: "K002", nombre: "Milanesitas", descripcion: "", categoria: "Menú para Niños", insumos: [] },
  { id: "K003", codigo: "K003", nombre: "Ñoquis", descripcion: "", categoria: "Menú para Niños", insumos: [] },
]

const initialInsumosBarra: InsumoBarra[] = [
  // Alcoholes
  { id: "BAR001", codigo: "BAR001", descripcion: "VODKA", unidad: "CC", stockActual: 0, precioUnitario: 0, categoria: "Alcoholes" },
  { id: "BAR002", codigo: "BAR002", descripcion: "GIN", unidad: "CC", stockActual: 0, precioUnitario: 0, categoria: "Alcoholes" },
  { id: "BAR003", codigo: "BAR003", descripcion: "RON BLANCO", unidad: "CC", stockActual: 0, precioUnitario: 0, categoria: "Alcoholes" },
  { id: "BAR004", codigo: "BAR004", descripcion: "RON AÑEJO", unidad: "CC", stockActual: 0, precioUnitario: 0, categoria: "Alcoholes" },
  { id: "BAR005", codigo: "BAR005", descripcion: "TEQUILA", unidad: "CC", stockActual: 0, precioUnitario: 0, categoria: "Alcoholes" },
  { id: "BAR006", codigo: "BAR006", descripcion: "WHISKY", unidad: "CC", stockActual: 0, precioUnitario: 0, categoria: "Alcoholes" },
  { id: "BAR007", codigo: "BAR007", descripcion: "FERNET", unidad: "CC", stockActual: 0, precioUnitario: 0, categoria: "Alcoholes" },
  // Licores
  { id: "BAR010", codigo: "BAR010", descripcion: "TRIPLE SEC", unidad: "CC", stockActual: 0, precioUnitario: 0, categoria: "Licores" },
  { id: "BAR011", codigo: "BAR011", descripcion: "AMARETTO", unidad: "CC", stockActual: 0, precioUnitario: 0, categoria: "Licores" },
  // Mixers
  { id: "BAR020", codigo: "BAR020", descripcion: "COCA COLA", unidad: "CC", stockActual: 0, precioUnitario: 0, categoria: "Mixers" },
  { id: "BAR021", codigo: "BAR021", descripcion: "SPRITE", unidad: "CC", stockActual: 0, precioUnitario: 0, categoria: "Mixers" },
  { id: "BAR022", codigo: "BAR022", descripcion: "AGUA TÓNICA", unidad: "CC", stockActual: 0, precioUnitario: 0, categoria: "Mixers" },
  { id: "BAR023", codigo: "BAR023", descripcion: "AGUA CON GAS", unidad: "CC", stockActual: 0, precioUnitario: 0, categoria: "Mixers" },
  // Jugos
  { id: "BAR030", codigo: "BAR030", descripcion: "JUGO DE LIMÓN", unidad: "CC", stockActual: 0, precioUnitario: 0, categoria: "Jugos" },
  { id: "BAR031", codigo: "BAR031", descripcion: "JUGO DE NARANJA", unidad: "CC", stockActual: 0, precioUnitario: 0, categoria: "Jugos" },
  { id: "BAR032", codigo: "BAR032", descripcion: "JARABE SIMPLE", unidad: "CC", stockActual: 0, precioUnitario: 0, categoria: "Jugos" },
  // Garnish
  { id: "BAR040", codigo: "BAR040", descripcion: "LIMÓN", unidad: "UN", stockActual: 0, precioUnitario: 0, categoria: "Garnish" },
  { id: "BAR041", codigo: "BAR041", descripcion: "LIMA", unidad: "UN", stockActual: 0, precioUnitario: 0, categoria: "Garnish" },
  { id: "BAR042", codigo: "BAR042", descripcion: "MENTA FRESCA", unidad: "GRS", stockActual: 0, precioUnitario: 0, categoria: "Garnish" },
  { id: "BAR043", codigo: "BAR043", descripcion: "HIELO", unidad: "KG", stockActual: 0, precioUnitario: 0, categoria: "Garnish" },
  { id: "BAR044", codigo: "BAR044", descripcion: "AZÚCAR", unidad: "GRS", stockActual: 0, precioUnitario: 0, categoria: "Garnish" },
]

const initialCocteles: Coctel[] = [
  {
    id: "COC001",
    codigo: "COC001",
    nombre: "Mojito",
    descripcion: "Clásico cubano con ron, menta y lima",
    categoria: "Con Alcohol",
    insumos: [
      { insumoBarraId: "BAR003", cantidadPorCoctel: 60, unidadCoctel: "CC" },
      { insumoBarraId: "BAR030", cantidadPorCoctel: 30, unidadCoctel: "CC" },
      { insumoBarraId: "BAR044", cantidadPorCoctel: 10, unidadCoctel: "GRS" },
      { insumoBarraId: "BAR042", cantidadPorCoctel: 5, unidadCoctel: "GRS" },
      { insumoBarraId: "BAR023", cantidadPorCoctel: 100, unidadCoctel: "CC" },
      { insumoBarraId: "BAR041", cantidadPorCoctel: 1, unidadCoctel: "UN" },
      { insumoBarraId: "BAR043", cantidadPorCoctel: 0.1, unidadCoctel: "KG" },
    ],
  },
  {
    id: "COC002",
    codigo: "COC002",
    nombre: "Gin Tonic",
    descripcion: "Gin con tónica y limón",
    categoria: "Con Alcohol",
    insumos: [
      { insumoBarraId: "BAR002", cantidadPorCoctel: 70, unidadCoctel: "CC" },
      { insumoBarraId: "BAR022", cantidadPorCoctel: 200, unidadCoctel: "CC" },
      { insumoBarraId: "BAR040", cantidadPorCoctel: 1, unidadCoctel: "UN" },
      { insumoBarraId: "BAR043", cantidadPorCoctel: 0.1, unidadCoctel: "KG" },
    ],
  },
  {
    id: "COC003",
    codigo: "COC003",
    nombre: "Fernet con Cola",
    descripcion: "Clásico argentino",
    categoria: "Con Alcohol",
    insumos: [
      { insumoBarraId: "BAR007", cantidadPorCoctel: 50, unidadCoctel: "CC" },
      { insumoBarraId: "BAR020", cantidadPorCoctel: 200, unidadCoctel: "CC" },
      { insumoBarraId: "BAR043", cantidadPorCoctel: 0.1, unidadCoctel: "KG" },
    ],
  },
  {
    id: "COC004",
    codigo: "COC004",
    nombre: "Vodka Tonic",
    descripcion: "Vodka con tónica y lima",
    categoria: "Con Alcohol",
    insumos: [
      { insumoBarraId: "BAR001", cantidadPorCoctel: 60, unidadCoctel: "CC" },
      { insumoBarraId: "BAR022", cantidadPorCoctel: 200, unidadCoctel: "CC" },
      { insumoBarraId: "BAR041", cantidadPorCoctel: 1, unidadCoctel: "UN" },
      { insumoBarraId: "BAR043", cantidadPorCoctel: 0.1, unidadCoctel: "KG" },
    ],
  },
  {
    id: "COC005",
    codigo: "COC005",
    nombre: "Whisky on the Rocks",
    descripcion: "Whisky servido con hielo",
    categoria: "Con Alcohol",
    insumos: [
      { insumoBarraId: "BAR006", cantidadPorCoctel: 60, unidadCoctel: "CC" },
      { insumoBarraId: "BAR043", cantidadPorCoctel: 0.15, unidadCoctel: "KG" },
    ],
  },
  {
    id: "COC006",
    codigo: "COC006",
    nombre: "Margarita",
    descripcion: "Tequila, triple sec y lima",
    categoria: "Con Alcohol",
    insumos: [
      { insumoBarraId: "BAR005", cantidadPorCoctel: 50, unidadCoctel: "CC" },
      { insumoBarraId: "BAR010", cantidadPorCoctel: 25, unidadCoctel: "CC" },
      { insumoBarraId: "BAR030", cantidadPorCoctel: 25, unidadCoctel: "CC" },
      { insumoBarraId: "BAR041", cantidadPorCoctel: 1, unidadCoctel: "UN" },
      { insumoBarraId: "BAR043", cantidadPorCoctel: 0.1, unidadCoctel: "KG" },
    ],
  },
  {
    id: "COC007",
    codigo: "COC007",
    nombre: "Destornillador",
    descripcion: "Vodka con jugo de naranja",
    categoria: "Con Alcohol",
    insumos: [
      { insumoBarraId: "BAR001", cantidadPorCoctel: 50, unidadCoctel: "CC" },
      { insumoBarraId: "BAR031", cantidadPorCoctel: 150, unidadCoctel: "CC" },
      { insumoBarraId: "BAR043", cantidadPorCoctel: 0.1, unidadCoctel: "KG" },
    ],
  },
]

const initialCostosOperativos: CostoOperativo[] = [
  // Quinta
  { id: "CO_Q_LUZ", concepto: "Luz - Quinta", tipo: "Servicios Basicos", monto: 0, frecuencia: "Mensual", esPorPersona: false, salon: "Quinta", activo: true, notas: "" },
  { id: "CO_Q_AGUA", concepto: "Agua - Quinta", tipo: "Servicios Basicos", monto: 0, frecuencia: "Mensual", esPorPersona: false, salon: "Quinta", activo: true, notas: "" },
  { id: "CO_Q_GAS", concepto: "Gas - Quinta", tipo: "Servicios Basicos", monto: 0, frecuencia: "Mensual", esPorPersona: false, salon: "Quinta", activo: true, notas: "" },
  { id: "CO_Q_ALQ", concepto: "Alquiler - Quinta", tipo: "Alquiler", monto: 0, frecuencia: "Mensual", esPorPersona: false, salon: "Quinta", activo: true, notas: "" },
  // Casona
  { id: "CO_C_LUZ", concepto: "Luz - Casona", tipo: "Servicios Basicos", monto: 0, frecuencia: "Mensual", esPorPersona: false, salon: "Casona", activo: true, notas: "" },
  { id: "CO_C_AGUA", concepto: "Agua - Casona", tipo: "Servicios Basicos", monto: 0, frecuencia: "Mensual", esPorPersona: false, salon: "Casona", activo: true, notas: "" },
  { id: "CO_C_GAS", concepto: "Gas - Casona", tipo: "Servicios Basicos", monto: 0, frecuencia: "Mensual", esPorPersona: false, salon: "Casona", activo: true, notas: "" },
  { id: "CO_C_ALQ", concepto: "Alquiler - Casona", tipo: "Alquiler", monto: 0, frecuencia: "Mensual", esPorPersona: false, salon: "Casona", activo: true, notas: "" },
  // Salon
  { id: "CO_S_LUZ", concepto: "Luz - Salon", tipo: "Servicios Basicos", monto: 0, frecuencia: "Mensual", esPorPersona: false, salon: "Salon", activo: true, notas: "" },
  { id: "CO_S_AGUA", concepto: "Agua - Salon", tipo: "Servicios Basicos", monto: 0, frecuencia: "Mensual", esPorPersona: false, salon: "Salon", activo: true, notas: "" },
  { id: "CO_S_GAS", concepto: "Gas - Salon", tipo: "Servicios Basicos", monto: 0, frecuencia: "Mensual", esPorPersona: false, salon: "Salon", activo: true, notas: "" },
  { id: "CO_S_ALQ", concepto: "Alquiler - Salon", tipo: "Alquiler", monto: 0, frecuencia: "Mensual", esPorPersona: false, salon: "Salon", activo: true, notas: "" },
]

const initialBarrasTemplates: BarraTemplate[] = [
  {
    id: "BT_CLASICA",
    nombre: "Barra Clasica",
    coctelesIncluidos: ["COC003", "COC002", "COC007"],
    // Fernet con Coca, Campari con Naranja, Gancia Batido, Cuba Libre, Gin Tonic, Destornillador, Cynar Julep
  },
  {
    id: "BT_BOSTON",
    nombre: "Barra Boston",
    coctelesIncluidos: ["COC006"],
    // Caipirinha, Caipiroska, Sex on the Beach, Daiquiris Frutales, Tequila Sunrise, Cosmopolitan, Margarita
  },
  {
    id: "BT_FRANCESA",
    nombre: "Barra Francesa",
    coctelesIncluidos: [],
    // Kir Royal, Bellini, Mimosa, French 75, Dry Martini, Copa de Champagne
  },
  {
    id: "BT_ALEMANA",
    nombre: "Barra Alemana",
    coctelesIncluidos: [],
    // Cerveza Tirada Rubia, Roja, Negra, IPA, Radler
  },
  {
    id: "BT_PREMIUM",
    nombre: "Barra Premium",
    coctelesIncluidos: ["COC001", "COC005"],
    // Negroni, Aperol Spritz, Old Fashioned, Whisky Sour, Gin Tonic de Autor, Whisky Importado
  },
  {
    id: "BT_SINALCOHOL",
    nombre: "Barra Sin Alcohol",
    coctelesIncluidos: [],
    // Mojito Virgin, Piña Colada Virgin, Limonada con Menta y Jengibre, etc.
  },
]

export function loadState(): AppState {
  const defaultState: AppState = {
    insumos: initialInsumos,
    insumosBarra: initialInsumosBarra,
    recetas: initialRecetas,
    cocteles: initialCocteles,
    barrasTemplates: initialBarrasTemplates,
    servicios: [],
    costosOperativos: initialCostosOperativos,
    eventoActual: null,
    eventos: [],
    historial: [],
    preciosVenta: {},
    paquetesSalones: [],
    temporadas: [],
    personal: [],
    pagosPersonal: [],
    asignaciones: [],
  }

  if (typeof window === "undefined") {
    return defaultState
  }

  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      return {
        ...parsed,
        historial: parsed.historial || [],
        eventos: parsed.eventos || [],
        insumosBarra: parsed.insumosBarra || initialInsumosBarra,
        cocteles: parsed.cocteles || initialCocteles,
        barrasTemplates: parsed.barrasTemplates || initialBarrasTemplates,
        servicios: parsed.servicios || [],
        costosOperativos: parsed.costosOperativos && parsed.costosOperativos.length > 0 ? parsed.costosOperativos : initialCostosOperativos,
        preciosVenta: parsed.preciosVenta || {},
        paquetesSalones: parsed.paquetesSalones || [],
        temporadas: parsed.temporadas || [],
        personal: parsed.personal || [],
        pagosPersonal: parsed.pagosPersonal || [],
        asignaciones: parsed.asignaciones || [],
      }
    } catch {
      return defaultState
    }
  }
  return defaultState
}

export function getPrecioVenta(preciosVenta: PreciosVentaMap, salon: string, fecha: string): number | null {
  const salonPrecios = preciosVenta[salon]
  if (!salonPrecios) return null
  return salonPrecios[fecha] ?? null
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// Helper functions
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export function calcularCostoServicios(servicios: ServicioEvento[], state?: AppState): number {
  if (!state) return 0
  return servicios.reduce((sum, s) => {
    const servicioCatalogo = state.servicios.find(srv => srv.id === s.servicioId)
    if (!servicioCatalogo) return sum
    const { precioOficial } = obtenerPreciosServicio(servicioCatalogo, state)
    return sum + precioOficial * s.cantidad
  }, 0)
}

export function calcularCostosOperativos(
  evento: Evento,
  costosOperativos: CostoOperativo[],
): number {
  const totalPersonas = evento.adultos + evento.adolescentes + evento.ninos + (evento.personasDietasEspeciales || 0)
  let total = 0

  const costosAplicables = costosOperativos.filter(
    (c) => c.activo && (!c.salon || c.salon === evento.salon),
  )

  for (const costo of costosAplicables) {
    if (costo.frecuencia === "Por Evento") {
      if (costo.esPorPersona && costo.montoPorPersona) {
        total += costo.montoPorPersona * totalPersonas
      } else {
        total += costo.monto
      }
    } else if (costo.frecuencia === "Mensual") {
      total += costo.monto / 4
    } else if (costo.frecuencia === "Anual") {
      total += costo.monto / 48
    }
  }

  return total
}

export function normalizeToStockUnit(qty: number, recipeUnit: UnidadReceta | undefined, stockUnit: Unidad): number {
  // If no recipe unit specified, assume same as stock
  if (!recipeUnit) return qty

  // Normalize unit names (GR = GRS, LT = L)
  const normalizedRecipe = recipeUnit === "GRS" ? "GRS" : recipeUnit
  const normalizedStock = stockUnit === "GR" ? "GRS" : stockUnit === "LT" ? "L" : stockUnit

  // If same unit, return as-is
  if (normalizedRecipe === normalizedStock) return qty

  // MASS conversions
  if (normalizedRecipe === "GRS" && normalizedStock === "KG") {
    return qty / 1000 // 300 GRS -> 0.3 KG
  }
  if (normalizedRecipe === "KG" && normalizedStock === "GRS") {
    return qty * 1000 // 0.3 KG -> 300 GRS
  }

  // VOLUME conversions
  if (normalizedRecipe === "CC" && normalizedStock === "L") {
    return qty / 1000 // 500 CC -> 0.5 L
  }
  if (normalizedRecipe === "L" && normalizedStock === "CC") {
    return qty * 1000 // 0.5 L -> 500 CC
  }

  // Incompatible units - return as-is and log warning
  console.warn(`[v0] Incompatible units: recipe=${recipeUnit}, stock=${stockUnit}`)
  return qty
}

export function getCompatibleRecipeUnits(stockUnit: Unidad): UnidadReceta[] {
  const normalizedStock = stockUnit === "GR" ? "GRS" : stockUnit === "LT" ? "L" : stockUnit

  switch (normalizedStock) {
    case "KG":
    case "GRS":
      return ["GRS", "KG"]
    case "L":
    case "CC":
      return ["CC", "L"]
    case "UN":
      return ["UN"]
    case "M":
      return ["M"]
    default:
      return ["UN"]
  }
}

export function getDefaultRecipeUnit(stockUnit: Unidad): UnidadReceta {
  const normalizedStock = stockUnit === "GR" ? "GRS" : stockUnit === "LT" ? "L" : stockUnit

  switch (normalizedStock) {
    case "KG":
      return "GRS" // Default to grams for easier input
    case "GRS":
      return "GRS"
    case "L":
      return "CC" // Default to CC for easier input
    case "CC":
      return "CC"
    case "UN":
      return "UN"
    case "M":
      return "M"
    default:
      return "UN"
  }
}

export function calcularCostoReceta(receta: Receta, insumos: Insumo[]): number {
  const factor = receta.factorRendimiento || 1
  return receta.insumos.reduce((total, ir) => {
    const insumo = insumos.find((i) => i.id === ir.insumoId)
    if (!insumo) return total
    const normalizedQty = normalizeToStockUnit(ir.cantidadBasePorPersona, ir.unidadReceta, insumo.unidad)
    return total + (normalizedQty / factor) * insumo.precioUnitario
  }, 0)
}

export function calcularComprasSegmentadas(
  evento: Evento,
  recetas: Receta[],
  insumos: Insumo[],
): CalculoCompraSegmentado[] {
  const comprasMap: Record<
    string,
    {
      cantidadNecesaria: number
      detalleCorte: string
      usadoEnAdultos: boolean
      usadoEnAdolescentes: boolean
      usadoEnNinos: boolean
      usadoEnDietasEspeciales: boolean
    }
  > = {}

  // Helper to process a segment
  const processSegment = (
    recetaIds: string[],
    paxCount: number,
    multipliers: Record<string, number>,
    segment: "adultos" | "adolescentes" | "ninos" | "dietas",
  ) => {
    recetaIds.forEach((recetaId) => {
      const receta = recetas.find((r) => r.id === recetaId)
      if (!receta) return

      const portionMultiplier = multipliers[recetaId] || 1
      const factor = receta.factorRendimiento || 1

      receta.insumos.forEach((ir) => {
        const insumo = insumos.find((i) => i.id === ir.insumoId)
        if (!insumo) return

        const normalizedQty = normalizeToStockUnit(ir.cantidadBasePorPersona, ir.unidadReceta, insumo.unidad)
        const cantidad = (normalizedQty / factor) * paxCount * portionMultiplier

        if (!comprasMap[ir.insumoId]) {
          comprasMap[ir.insumoId] = {
            cantidadNecesaria: 0,
            detalleCorte: ir.detalleCorte,
            usadoEnAdultos: false,
            usadoEnAdolescentes: false,
            usadoEnNinos: false,
            usadoEnDietasEspeciales: false,
          }
        }
        comprasMap[ir.insumoId].cantidadNecesaria += cantidad
        if (ir.detalleCorte && !comprasMap[ir.insumoId].detalleCorte.includes(ir.detalleCorte)) {
          comprasMap[ir.insumoId].detalleCorte = ir.detalleCorte
        }

        // Track which segment uses this ingredient
        if (segment === "adultos") comprasMap[ir.insumoId].usadoEnAdultos = true
        if (segment === "adolescentes") comprasMap[ir.insumoId].usadoEnAdolescentes = true
        if (segment === "ninos") comprasMap[ir.insumoId].usadoEnNinos = true
        if (segment === "dietas") comprasMap[ir.insumoId].usadoEnDietasEspeciales = true
      })
    })
  }

  // Process each segment
  processSegment(evento.recetasAdultos || [], evento.adultos, evento.multipliersAdultos || {}, "adultos")
  processSegment(
    evento.recetasAdolescentes || [],
    evento.adolescentes,
    evento.multipliersAdolescentes || {},
    "adolescentes",
  )
  processSegment(evento.recetasNinos || [], evento.ninos, evento.multipliersNinos || {}, "ninos")
  processSegment(
    evento.recetasDietasEspeciales || [],
    evento.personasDietasEspeciales || 0,
    evento.multipliersDietasEspeciales || {},
    "dietas",
  )

  const resultado = Object.entries(comprasMap)
    .map(([insumoId, item]) => {
      const insumo = insumos.find((i) => i.id === insumoId)
      if (!insumo) return null

      // Variable A: COSTO TOTAL DE MATERIA PRIMA (real cost regardless of stock)
      const costoMateriaPrima = item.cantidadNecesaria * insumo.precioUnitario

      // Variable B: PRESUPUESTO DE COMPRA (cash needed now - only what needs to be purchased)
      const cantidadAComprar = Math.max(0, item.cantidadNecesaria - insumo.stockActual)
      const costoEstimado = cantidadAComprar * insumo.precioUnitario

      return {
        insumoId,
        insumo,
        cantidadNecesaria: item.cantidadNecesaria,
        cantidadAComprar,
        costoEstimado,
        costoMateriaPrima,
        detalleCorte: item.detalleCorte,
        usadoEnAdultos: item.usadoEnAdultos,
        usadoEnAdolescentes: item.usadoEnAdolescentes,
        usadoEnNinos: item.usadoEnNinos,
        usadoEnDietasEspeciales: item.usadoEnDietasEspeciales,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  return resultado
}

export function calcularCompras(
  receta: Receta,
  insumos: Insumo[],
  adultos: number,
  adolescentes: number,
  ninos: number,
  factorAdolescentes: number,
  factorNinos: number,
): CalculoCompra[] {
  return receta.insumos
    .map((item) => {
      const insumo = insumos.find((i) => i.id === item.insumoId)
      if (!insumo) return null

      const cantidadNecesaria =
        adultos * item.cantidadBasePorPersona +
        adolescentes * item.cantidadBasePorPersona * factorAdolescentes +
        ninos * item.cantidadBasePorPersona * factorNinos

      const cantidadAComprar = Math.max(0, cantidadNecesaria - insumo.stockActual)
      const costoEstimado = cantidadAComprar * insumo.precioUnitario

      return {
        insumoId: item.insumoId,
        insumo,
        cantidadNecesaria,
        cantidadAComprar,
        costoEstimado,
        detalleCorte: item.detalleCorte,
      }
    })
    .filter(Boolean) as CalculoCompra[]
}

export interface CalculoCompraBarra {
  insumoBarraId: string
  insumoBarra: InsumoBarra
  cantidadNecesaria: number
  cantidadAComprar: number
  costoEstimado: number
  costoMateriaPrima: number
}

export function calcularComprasBarras(
  evento: Evento,
  cocteles: Coctel[],
  insumosBarra: InsumoBarra[],
): CalculoCompraBarra[] {
  // Parsear barras si viene como string JSON desde la DB
  let barras = evento.barras
  if (typeof barras === "string") {
    try {
      barras = JSON.parse(barras)
    } catch {
      barras = []
    }
  }
  if (!barras || !Array.isArray(barras) || barras.length === 0) return []

  const comprasMap: Record<string, { cantidadNecesaria: number }> = {}

  barras.forEach((barra) => {
    const personas = evento.adultos + evento.adolescentes
    const totalTragos = personas * barra.tragosPorPersona
    const coctelesCount = barra.coctelesIncluidos.length
    if (coctelesCount === 0) return
    const tragosPorCoctel = totalTragos / coctelesCount

    barra.coctelesIncluidos.forEach((coctelId) => {
      const coctel = cocteles.find((c) => c.id === coctelId)
      if (!coctel) return

      coctel.insumos.forEach((insumoCoctel) => {
        const insumo = insumosBarra.find((i) => i.id === insumoCoctel.insumoBarraId)
        if (!insumo) return

        const normalizedQty = normalizeToStockUnit(
          insumoCoctel.cantidadPorCoctel,
          insumoCoctel.unidadCoctel,
          insumo.unidad,
        )
        const cantidad = normalizedQty * tragosPorCoctel

        if (!comprasMap[insumoCoctel.insumoBarraId]) {
          comprasMap[insumoCoctel.insumoBarraId] = { cantidadNecesaria: 0 }
        }
        comprasMap[insumoCoctel.insumoBarraId].cantidadNecesaria += cantidad
      })
    })
  })

  return Object.entries(comprasMap)
    .map(([insumoId, item]) => {
      const insumo = insumosBarra.find((i) => i.id === insumoId)
      if (!insumo) return null

      const cantidadAComprar = Math.max(0, item.cantidadNecesaria - insumo.stockActual)
      const costoEstimado = cantidadAComprar * insumo.precioUnitario
      const costoMateriaPrima = item.cantidadNecesaria * insumo.precioUnitario

      return {
        insumoBarraId: insumoId,
        insumoBarra: insumo,
        cantidadNecesaria: item.cantidadNecesaria,
        cantidadAComprar,
        costoEstimado,
        costoMateriaPrima,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}

// ==================== CUOTAS HELPER FUNCTIONS ====================

/**
 * Calcula la fecha de vencimiento de una cuota especifica
 * @param fechaInicio - Fecha de la primera cuota (YYYY-MM-DD)
 * @param numeroCuota - Numero de cuota (1, 2, 3...)
 * @param diaVencimiento - Dia del mes para vencimiento (1-31)
 * @returns Fecha en formato "DD/MM/YYYY"
 */
export function calcularFechaCuota(
  fechaInicio: string,
  numeroCuota: number,
  diaVencimiento: number
): string {
  if (!fechaInicio) return ""

  const [year, month, day] = fechaInicio.split("-").map(Number)
  const inicio = new Date(year, month - 1, day)

  // Sumar meses (numeroCuota - 1) porque la cuota 1 es el mes inicial
  const mesVencimiento = inicio.getMonth() + (numeroCuota - 1)
  const añoVencimiento = inicio.getFullYear() + Math.floor(mesVencimiento / 12)
  const mesAjustado = mesVencimiento % 12

  // Ajustar dia si el mes no tiene suficientes dias (ej: 31 en febrero -> 28/29)
  const ultimoDia = new Date(añoVencimiento, mesAjustado + 1, 0).getDate()
  const diaAjustado = Math.min(diaVencimiento, ultimoDia)

  const fechaVencimiento = new Date(añoVencimiento, mesAjustado, diaAjustado)

  return fechaVencimiento.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/**
 * Genera array con todas las fechas de cuotas de un evento
 */
export function generarCalendarioCuotas(evento: EventoGuardado): Array<{
  numeroCuota: number
  fechaVencimiento: string // YYYY-MM-DD
  monto: number
  pagada: boolean
}> {
  if (
    !evento.planDeCuotas ||
    !evento.planDeCuotas.numeroCuotas ||
    evento.planDeCuotas.numeroCuotas <= 0 ||
    !evento.planDeCuotas.fechaInicioPlan
  ) {
    return []
  }

  const { numeroCuotas, montoCuota, montoTotal, fechaInicioPlan, diaVencimiento, cuotasPagadas = [] } = evento.planDeCuotas

  // Fallback: if montoCuota is 0 but montoTotal exists, calculate it
  const montoReal = montoCuota > 0 ? montoCuota : (montoTotal > 0 && numeroCuotas > 0 ? montoTotal / numeroCuotas : 0)

  return Array.from({ length: numeroCuotas }).map((_, idx) => {
    const cuotaNum = idx + 1
    const fechaStr = calcularFechaCuota(fechaInicioPlan, cuotaNum, diaVencimiento || 10)

    if (!fechaStr) {
      return {
        numeroCuota: cuotaNum,
        fechaVencimiento: "",
        monto: montoReal,
        pagada: cuotasPagadas.includes(cuotaNum),
      }
    }

    const [dia, mes, año] = fechaStr.split("/")
    const fechaISO = `${año}-${mes}-${dia}`

    return {
      numeroCuota: cuotaNum,
      fechaVencimiento: fechaISO,
      monto: montoReal,
      pagada: cuotasPagadas.includes(cuotaNum),
    }
  })
}

// ==================== EVENTO MANAGEMENT FUNCTIONS ====================

export function addEvento(state: AppState, evento: Evento): EventoGuardado {
  const nuevoEvento: EventoGuardado = {
    ...evento,
    estado: "pendiente",
  }
  state.eventos.push(nuevoEvento)
  saveState(state)
  return nuevoEvento
}

export function updateEvento(state: AppState, eventoId: string, eventoActualizado: Partial<EventoGuardado>): boolean {
  const index = state.eventos.findIndex((e) => e.id === eventoId)
  if (index === -1) return false

  state.eventos[index] = {
    ...state.eventos[index],
    ...eventoActualizado,
  }
  saveState(state)
  return true
}

export function getEventoById(state: AppState, eventoId: string): EventoGuardado | null {
  return state.eventos.find((e) => e.id === eventoId) || null
}

export function deleteEvento(state: AppState, eventoId: string): boolean {
  const index = state.eventos.findIndex((e) => e.id === eventoId)
  if (index === -1) return false

  state.eventos.splice(index, 1)
  saveState(state)
  return true
}

export function confirmarEvento(state: AppState, eventoId: string): boolean {
  return updateEvento(state, eventoId, { estado: "confirmado" })
}

export function cancelarEvento(state: AppState, eventoId: string): boolean {
  return updateEvento(state, eventoId, { estado: "cancelado" })
}

// ==========================================
// FUNCIONES HELPER: PAQUETES Y TEMPORADAS
// ==========================================

/**
 * Calcula totales de un paquete de salón
 */
export function calcularTotalesPaquete(
  serviciosIncluidos: PaqueteSalon["serviciosIncluidos"] | PaqueteSalon,
  _servicios?: Servicio[]
): {
  costoTotal: number
  precioOficial: number
  ganancia: number
  margenPorcentaje: number
} {
  // Si recibimos un PaqueteSalon completo, extraemos serviciosIncluidos
  const servicios = Array.isArray(serviciosIncluidos) 
    ? serviciosIncluidos 
    : (serviciosIncluidos as PaqueteSalon).serviciosIncluidos || []

  // Validación: asegurarse de que servicios sea un array
  if (!Array.isArray(servicios)) {
    console.warn("calcularTotalesPaquete: servicios no es un array", servicios)
    return { costoTotal: 0, precioOficial: 0, ganancia: 0, margenPorcentaje: 0 }
  }

  const costoTotal = servicios.reduce((sum, s) => sum + (s.precioInterno * (s.cantidad || 1)), 0)
  const precioOficial = servicios.reduce((sum, s) => sum + (s.precioOficial * (s.cantidad || 1)), 0)
  const ganancia = precioOficial - costoTotal
  const margenPorcentaje = costoTotal > 0 ? (ganancia / costoTotal) * 100 : 0

  return { costoTotal, precioOficial, ganancia, margenPorcentaje }
}

/**
 * Calcula precio final aplicando temporada
 */
export function calcularPrecioConTemporada(
  paquete: PaqueteSalon,
  fecha: string,
  temporadas: TemporadaPrecio[]
): {
  precioBase: number
  temporada: TemporadaPrecio | null
  modificador: number
  precioFinal: number
  ganancia: number
} {
  const precioBase = paquete.precioOficial

  // Buscar temporada activa para esta fecha
  const temporada = temporadas.find(t =>
    t.activo &&
    fecha >= t.fechaInicio &&
    fecha <= t.fechaFin
  ) || null

  if (!temporada) {
    return {
      precioBase,
      temporada: null,
      modificador: 1,
      precioFinal: precioBase,
      ganancia: paquete.ganancia
    }
  }

  const mod = temporada.modificadores[paquete.salon]
  const multiplicador = mod?.multiplicador || 1
  const ajusteFijo = mod?.ajusteFijo || 0

  const precioFinal = (precioBase * multiplicador) + ajusteFijo
  const ganancia = precioFinal - paquete.costoTotal

  return {
    precioBase,
    temporada,
    modificador: multiplicador,
    precioFinal,
    ganancia
  }
}

// ==========================================
// FUNCIONES CRUD: PERSONAL
// ==========================================

export function addPersonal(state: AppState, personal: Omit<PersonalEvento, "id">): PersonalEvento {
  const nuevoPersonal: PersonalEvento = {
    ...personal,
    id: generateId(),
  }
  state.personal.push(nuevoPersonal)
  saveState(state)
  return nuevoPersonal
}

export function updatePersonal(state: AppState, personalId: string, personalActualizado: Partial<PersonalEvento>): boolean {
  const index = state.personal.findIndex((p) => p.id === personalId)
  if (index === -1) return false

  state.personal[index] = {
    ...state.personal[index],
    ...personalActualizado,
  }
  saveState(state)
  return true
}

export function deletePersonal(state: AppState, personalId: string): boolean {
  const index = state.personal.findIndex((p) => p.id === personalId)
  if (index === -1) return false

  state.personal.splice(index, 1)
  saveState(state)
  return true
}

export function getPersonalById(state: AppState, personalId: string): PersonalEvento | null {
  return state.personal.find((p) => p.id === personalId) || null
}

export function getPersonalByServicio(state: AppState, servicioId: string): PersonalEvento[] {
  return state.personal.filter((p) => p.servicioVinculadoId === servicioId && p.activo)
}

// ==========================================
// FUNCIONES CRUD: PAGOS PERSONAL
// ==========================================

export function addPagoPersonal(state: AppState, pago: Omit<PagoPersonal, "id">): PagoPersonal {
  const nuevoPago: PagoPersonal = {
    ...pago,
    id: generateId(),
  }
  state.pagosPersonal.push(nuevoPago)
  saveState(state)
  return nuevoPago
}

export function updatePagoPersonal(state: AppState, pagoId: string, pagoActualizado: Partial<PagoPersonal>): boolean {
  const index = state.pagosPersonal.findIndex((p) => p.id === pagoId)
  if (index === -1) return false

  state.pagosPersonal[index] = {
    ...state.pagosPersonal[index],
    ...pagoActualizado,
  }
  saveState(state)
  return true
}

export function deletePagoPersonal(state: AppState, pagoId: string): boolean {
  const index = state.pagosPersonal.findIndex((p) => p.id === pagoId)
  if (index === -1) return false

  state.pagosPersonal.splice(index, 1)
  saveState(state)
  return true
}

export function getPagoPersonalById(state: AppState, pagoId: string): PagoPersonal | null {
  return state.pagosPersonal.find((p) => p.id === pagoId) || null
}

export function getPagosPorEvento(state: AppState, eventoId: string): PagoPersonal[] {
  return state.pagosPersonal.filter((p) => p.eventoId === eventoId)
}

export function getPagosPendientes(state: AppState): PagoPersonal[] {
  return state.pagosPersonal.filter((p) => p.estado === "pendiente" || p.estado === "vencido")
}

/**
 * Genera automáticamente pagos pendientes para eventos próximos (7-15 días).
 * Prioriza asignaciones confirmadas; cae al flujo legacy para eventos sin asignaciones.
 * Debe ejecutarse periódicamente o al cargar la app.
 */
export function generarPagosPendientesAutomaticos(state: AppState): void {
  const hoy = new Date()
  const en7Dias = new Date(hoy)
  en7Dias.setDate(en7Dias.getDate() + 7)
  const en15Dias = new Date(hoy)
  en15Dias.setDate(en15Dias.getDate() + 15)

  state.eventos.forEach((evento) => {
    const fechaEvento = new Date(evento.fecha)

    // Solo eventos entre 7 y 15 días en el futuro, no cancelados/completados
    if (fechaEvento < en7Dias || fechaEvento > en15Dias) return
    if (evento.estado === "cancelado" || evento.estado === "completado") return

    // --- Flujo basado en asignaciones (nuevo) ---
    if (evento.asignaciones && evento.asignaciones.length > 0) {
      evento.asignaciones.forEach((asignacion) => {
        // Solo procesar asignaciones con personal asignado y confirmado
        if (!asignacion.personalAsignadoId || !asignacion.confirmado) return

        // Verificar si ya existe un pago con mismo personalId + eventoId + asignacionId
        const pagoExistente = state.pagosPersonal.find(
          (p) =>
            p.eventoId === evento.id &&
            p.personalId === asignacion.personalAsignadoId &&
            p.asignacionId === asignacion.id
        )

        if (!pagoExistente) {
          // Buscar nombre del servicio vinculado
          const servicioEvento = evento.servicios?.find(
            (s) => s.servicioId === asignacion.servicioEventoId
          )
          const servicioNombre = servicioEvento
            ? `${servicioEvento.nombre} (${asignacion.rolRequerido})`
            : asignacion.rolRequerido

          const fechaLimite = new Date(fechaEvento)
          fechaLimite.setDate(fechaLimite.getDate() - 7)

          const nuevoPago: PagoPersonal = {
            id: generateId(),
            personalId: asignacion.personalAsignadoId,
            eventoId: evento.id,
            nombrePersonal: asignacion.personalNombre || "Personal",
            servicioNombre,
            montoTotal: asignacion.costoReal,
            fechaEvento: evento.fecha,
            fechaLimitePago: fechaLimite.toISOString().split("T")[0],
            estado: fechaLimite < hoy ? "vencido" : "pendiente",
            asignacionId: asignacion.id,
          }

          state.pagosPersonal.push(nuevoPago)
        }
      })
    } else {
      // --- Flujo legacy para eventos sin asignaciones (backwards compatible) ---
      if (!evento.servicios || evento.servicios.length === 0) return

      evento.servicios.forEach((servicioEvento) => {
        const personalVinculado = state.personal.filter(
          (p) => p.servicioVinculadoId === servicioEvento.servicioId && p.activo
        )

        personalVinculado.forEach((personal) => {
          const pagoExistente = state.pagosPersonal.find(
            (p) =>
              p.eventoId === evento.id &&
              p.personalId === personal.id &&
              !p.asignacionId // Legacy: sin asignacionId
          )

          if (!pagoExistente) {
            const fechaLimite = new Date(fechaEvento)
            fechaLimite.setDate(fechaLimite.getDate() - 7)

            const nuevoPago: PagoPersonal = {
              id: generateId(),
              personalId: personal.id,
              eventoId: evento.id,
              nombrePersonal: `${personal.nombre} ${personal.apellido}`,
              servicioNombre: servicioEvento.nombre,
              montoTotal: personal.tarifaBase,
              fechaEvento: evento.fecha,
              fechaLimitePago: fechaLimite.toISOString().split("T")[0],
              estado: fechaLimite < hoy ? "vencido" : "pendiente",
            }

            state.pagosPersonal.push(nuevoPago)
          }
        })
      })
    }
  })

  saveState(state)
}

/**
 * Sincroniza pagos con asignaciones para TODOS los eventos activos.
 * - Genera pagos faltantes para asignaciones confirmadas.
 * - Marca pagos huérfanos (cuya asignación fue eliminada o desasignada) como "obsoleto".
 * Ideal para ejecutar al migrar datos o como corrección periódica.
 */
export function sincronizarPagosConAsignaciones(state: AppState): {
  pagosCreados: number
  pagosObsoletos: number
} {
  const hoy = new Date()
  let pagosCreados = 0
  let pagosObsoletos = 0

  // 1. Generar pagos faltantes para asignaciones confirmadas
  state.eventos.forEach((evento) => {
    if (evento.estado === "cancelado" || evento.estado === "completado") return
    if (!evento.asignaciones || evento.asignaciones.length === 0) return

    evento.asignaciones.forEach((asignacion) => {
      if (!asignacion.personalAsignadoId || !asignacion.confirmado) return

      const pagoExistente = state.pagosPersonal.find(
        (p) =>
          p.eventoId === evento.id &&
          p.personalId === asignacion.personalAsignadoId &&
          p.asignacionId === asignacion.id
      )

      if (!pagoExistente) {
        const fechaEvento = new Date(evento.fecha)
        const fechaLimite = new Date(fechaEvento)
        fechaLimite.setDate(fechaLimite.getDate() - 7)

        const servicioEvento = evento.servicios?.find(
          (s) => s.servicioId === asignacion.servicioEventoId
        )
        const servicioNombre = servicioEvento
          ? `${servicioEvento.nombre} (${asignacion.rolRequerido})`
          : asignacion.rolRequerido

        const nuevoPago: PagoPersonal = {
          id: generateId(),
          personalId: asignacion.personalAsignadoId,
          eventoId: evento.id,
          nombrePersonal: asignacion.personalNombre || "Personal",
          servicioNombre,
          montoTotal: asignacion.costoReal,
          fechaEvento: evento.fecha,
          fechaLimitePago: fechaLimite.toISOString().split("T")[0],
          estado: fechaLimite < hoy ? "vencido" : "pendiente",
          asignacionId: asignacion.id,
        }

        state.pagosPersonal.push(nuevoPago)
        pagosCreados++
      }
    })
  })

  // 2. Marcar pagos huérfanos como obsoletos
  // Un pago es huérfano si tiene asignacionId pero la asignación ya no existe
  // o la asignación ya no está confirmada/asignada
  state.pagosPersonal.forEach((pago) => {
    if (!pago.asignacionId) return // Legacy, no tocar
    if (pago.estado === "pagado") return // Ya pagado, no tocar

    // Buscar el evento y la asignación
    const evento = state.eventos.find((e) => e.id === pago.eventoId)
    if (!evento) {
      // El evento fue eliminado: marcar obsoleto
      pago.estado = "vencido" as EstadoPago
      pago.notasPago = (pago.notasPago || "") + " [OBSOLETO: evento eliminado]"
      pagosObsoletos++
      return
    }

    const asignacion = evento.asignaciones?.find(
      (a) => a.id === pago.asignacionId
    )

    if (!asignacion) {
      // La asignación fue eliminada
      pago.estado = "vencido" as EstadoPago
      pago.notasPago = (pago.notasPago || "") + " [OBSOLETO: asignación eliminada]"
      pagosObsoletos++
      return
    }

    if (!asignacion.personalAsignadoId || !asignacion.confirmado) {
      // La asignación fue desasignada o desconfirmada
      pago.estado = "vencido" as EstadoPago
      pago.notasPago =
        (pago.notasPago || "") + " [OBSOLETO: personal desasignado]"
      pagosObsoletos++
    }
  })

  saveState(state)
  return { pagosCreados, pagosObsoletos }
}

/**
 * Actualiza el estado de pagos vencidos
 */
export function actualizarEstadoPagos(state: AppState): void {
  const hoy = new Date()
  let cambios = false

  state.pagosPersonal.forEach((pago) => {
    if (pago.estado === "pendiente") {
      const fechaLimite = new Date(pago.fechaLimitePago)
      if (fechaLimite < hoy) {
        pago.estado = "vencido"
        cambios = true
      }
    }
  })

  if (cambios) {
    saveState(state)
  }
}

// ==========================================
// FUNCIONES HELPER: CÁLCULO AUTOMÁTICO DE COSTOS
// ==========================================

/**
 * Calcula el costo base (precioInterno) de un servicio.
 * Suma las tarifas de todo el personal activo vinculado a este servicio.
 *
 * @param servicioId - ID del servicio
 * @param state - Estado global de la app
 * @returns Costo interno del servicio basado en tarifas del personal
 */
export function calcularPrecioInternoServicio(servicioId: string, state: AppState): number {
  const personalVinculado = state.personal.filter(
    (p) => p.activo && p.servicioVinculadoId === servicioId
  )

  return personalVinculado.reduce((total, p) => total + p.tarifaBase, 0)
}

/**
 * Calcula el precio de venta (precioOficial) de un servicio.
 * Aplica el margen de ganancia al precio interno.
 *
 * @param servicio - El servicio a calcular
 * @param state - Estado global de la app
 * @returns Precio oficial con margen aplicado
 */
export function calcularPrecioOficialServicio(servicio: Servicio, state: AppState): number {
  const precioInterno = calcularPrecioInternoServicio(servicio.id, state)
  const multiplicador = 1 + (servicio.margenGanancia / 100)
  return precioInterno * multiplicador
}

/**
 * Obtiene los precios calculados de un servicio.
 * Uso: const { precioInterno, precioOficial } = obtenerPreciosServicio(servicio, state)
 *
 * @param servicio - El servicio a consultar
 * @param state - Estado global de la app
 * @returns Objeto con precioInterno y precioOficial calculados dinámicamente
 */
export function obtenerPreciosServicio(servicio: Servicio, state: AppState): {
  precioInterno: number
  precioOficial: number
} {
  const precioInterno = calcularPrecioInternoServicio(servicio.id, state)
  const precioOficial = calcularPrecioOficialServicio(servicio, state)

  return { precioInterno, precioOficial }
}

// ==========================================
// FUNCIONES DE GESTIÓN DE ASIGNACIONES DE PERSONAL
// ==========================================

/**
 * Genera asignaciones vacías (sin personal asignado) para un servicio
 * a partir del personal activo vinculado al servicio.
 *
 * @param evento - El evento al que pertenece el servicio
 * @param servicioEvento - El ServicioEvento dentro del evento
 * @param state - Estado global para buscar personal vinculado
 * @returns Array de AsignacionPersonal sin personal asignado
 */
export function generarAsignacionesParaServicio(
  evento: EventoGuardado,
  servicioEvento: ServicioEvento,
  state: AppState
): AsignacionPersonal[] {
  const asignaciones: AsignacionPersonal[] = []

  const servicioCatalogo = state.servicios.find(
    (s) => s.id === servicioEvento.servicioId
  )

  if (!servicioCatalogo) return asignaciones

  // Obtener personal vinculado al servicio
  const personalVinculado = state.personal.filter(
    (p) => p.activo && p.servicioVinculadoId === servicioCatalogo.id
  )

  // Generar una asignación por cada miembro del personal vinculado
  for (const personal of personalVinculado) {
    const asignacion: AsignacionPersonal = {
      id: generateId(),
      eventoId: evento.id,
      servicioEventoId: servicioEvento.servicioId,
      rolRequerido: personal.funcion,
      personalAsignadoId: null, // Sin asignar inicialmente
      costoPlaneado: personal.tarifaBase,
      costoReal: 0,
      confirmado: false,
      fechaAsignacion: new Date().toISOString(),
    }

    asignaciones.push(asignacion)
  }

  return asignaciones
}

/**
 * Asigna un miembro del personal a una asignación existente en un evento.
 * Actualiza costos, estado de confirmación y recalcula costos del evento.
 *
 * @param state - Estado global mutable
 * @param eventoId - ID del evento
 * @param asignacionId - ID de la asignación a cubrir
 * @param personalId - ID del personal a asignar
 * @returns true si la asignación fue exitosa, false en caso de error
 */
export function asignarPersonalAEvento(
  state: AppState,
  eventoId: string,
  asignacionId: string,
  personalId: string
): boolean {
  // Buscar el evento
  const evento = state.eventos.find((e) => e.id === eventoId)
  if (!evento) return false

  // Buscar la asignación dentro del evento
  const asignacion = evento.asignaciones?.find((a) => a.id === asignacionId)
  if (!asignacion) return false

  // Buscar el personal
  const personal = state.personal.find((p) => p.id === personalId)
  if (!personal) return false

  // Actualizar la asignación
  asignacion.personalAsignadoId = personalId
  asignacion.personalNombre = `${personal.nombre} ${personal.apellido}`
  asignacion.costoReal = personal.tarifaBase
  asignacion.confirmado = true
  asignacion.fechaAsignacion = new Date().toISOString()

  // Recalcular costos del evento
  evento.costosCalculados = calcularCostosEvento(evento)

  saveState(state)
  return true
}

/**
 * Desasigna un miembro del personal de una asignación en un evento.
 * Si existe un pago asociado pendiente, lo elimina. Recalcula costos.
 *
 * @param state - Estado global mutable
 * @param eventoId - ID del evento
 * @param asignacionId - ID de la asignación a liberar
 * @returns true si la desasignación fue exitosa, false en caso de error
 */
export function desasignarPersonalDeEvento(
  state: AppState,
  eventoId: string,
  asignacionId: string
): boolean {
  // Buscar el evento
  const evento = state.eventos.find((e) => e.id === eventoId)
  if (!evento) return false

  // Buscar la asignación dentro del evento
  const asignacion = evento.asignaciones?.find((a) => a.id === asignacionId)
  if (!asignacion) return false

  // Eliminar pago asociado si existe y está pendiente
  const indicePago = state.pagosPersonal.findIndex(
    (p) =>
      p.asignacionId === asignacionId &&
      p.eventoId === eventoId &&
      (p.estado === "pendiente" || p.estado === "vencido")
  )
  if (indicePago !== -1) {
    state.pagosPersonal.splice(indicePago, 1)
  }

  // Limpiar la asignación
  asignacion.personalAsignadoId = null
  asignacion.personalNombre = undefined
  asignacion.costoReal = 0
  asignacion.confirmado = false

  // Recalcular costos del evento
  evento.costosCalculados = calcularCostosEvento(evento)

  saveState(state)
  return true
}

/**
 * Calcula el resumen de costos de un evento basado en sus asignaciones.
 *
 * @param evento - El evento con asignaciones
 * @returns Objeto con costoPlaneado, costoReal y diferencia
 */
export function calcularCostosEvento(
  evento: EventoGuardado
): { costoPlaneado: number; costoReal: number; diferencia: number } {
  const asignaciones = evento.asignaciones || []

  const costoPlaneado = asignaciones.reduce(
    (sum, a) => sum + a.costoPlaneado,
    0
  )
  const costoReal = asignaciones.reduce(
    (sum, a) => sum + a.costoReal,
    0
  )

  return {
    costoPlaneado,
    costoReal,
    diferencia: costoPlaneado - costoReal,
  }
}

/**
 * Agrega un servicio a un evento y genera automáticamente las asignaciones
 * de personal según los recursosNecesarios del servicio en catálogo.
 *
 * @param state - Estado global mutable
 * @param eventoId - ID del evento al que agregar el servicio
 * @param servicioEvento - El ServicioEvento a agregar
 * @returns true si se agregó correctamente, false en caso de error
 */
export function addServicioAEvento(
  state: AppState,
  eventoId: string,
  servicioEvento: ServicioEvento
): boolean {
  // Buscar el evento
  const evento = state.eventos.find((e) => e.id === eventoId)
  if (!evento) return false

  // Inicializar arrays si no existen
  if (!evento.servicios) {
    evento.servicios = []
  }
  if (!evento.asignaciones) {
    evento.asignaciones = []
  }

  // Agregar el servicio al evento
  evento.servicios.push(servicioEvento)

  // Generar asignaciones automáticas para este servicio
  const nuevasAsignaciones = generarAsignacionesParaServicio(
    evento,
    servicioEvento,
    state
  )

  // Agregar las asignaciones al evento
  evento.asignaciones.push(...nuevasAsignaciones)

  // Recalcular costos del evento
  evento.costosCalculados = calcularCostosEvento(evento)

  saveState(state)
  return true
}

// ==========================================
// MIGRACIÓN: Servicios con precios fijos → precios dinámicos
// ==========================================

/**
 * Migra servicios que aún tienen precioInterno/precioOficial hardcodeados
 * al nuevo modelo basado en margenGanancia calculado dinámicamente.
 * Ejecutar UNA VEZ al cargar la app si hay datos legacy.
 */
export function migrarServiciosAPreciosDinamicos(state: AppState): void {
  let cambios = false

  state.servicios.forEach((servicio) => {
    const s = servicio as Record<string, unknown>

    if ("precioInterno" in s && "precioOficial" in s) {
      const precioInterno = Number(s.precioInterno) || 0
      const precioOficial = Number(s.precioOficial) || 0

      if (precioInterno > 0) {
        const margen = ((precioOficial - precioInterno) / precioInterno) * 100
        servicio.margenGanancia = Math.round(margen)
      } else {
        servicio.margenGanancia = 30
      }

      delete s.precioInterno
      delete s.precioOficial
      delete s.recursosNecesarios
      delete s.modoCalculoCosto
      cambios = true
    }

    if (servicio.margenGanancia === undefined || servicio.margenGanancia === null) {
      servicio.margenGanancia = 30
      cambios = true
    }
  })

  if (cambios) {
    saveState(state)
  }
}
