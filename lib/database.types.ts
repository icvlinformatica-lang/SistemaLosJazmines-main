// Database types for Supabase
// Auto-generated from schema, keep in sync with SQL migrations

export interface DbInsumo {
  id: string
  nombre: string
  categoria: string
  cantidad: number
  unidad: string
  precio_unitario: number
  umbral_minimo: number
  created_at: string
  updated_at: string
}

export interface DbInsumoBarra {
  id: string
  nombre: string
  categoria: string
  cantidad: number
  unidad: string
  precio_unitario: number
  umbral_minimo: number
  created_at: string
  updated_at: string
}

export interface DbReceta {
  id: string
  nombre: string
  descripcion: string | null
  porciones: number
  tiempo_preparacion: number | null
  categoria: string | null
  created_at: string
  updated_at: string
}

export interface DbRecetaInsumo {
  id: string
  receta_id: string
  insumo_id: string
  cantidad: number
  unidad: string
  created_at: string
}

export interface DbCoctel {
  id: string
  nombre: string
  descripcion: string | null
  categoria: string | null
  created_at: string
  updated_at: string
}

export interface DbCoctelInsumo {
  id: string
  coctel_id: string
  insumo_id: string
  cantidad: number
  unidad: string
  created_at: string
}

export interface DbBarraTemplate {
  id: string
  nombre: string
  descripcion: string | null
  cocteles: string[] // JSON array of coctel IDs
  created_at: string
  updated_at: string
}

// Helper type for Supabase insert operations (without auto-generated fields)
export type InsertInsumo = Omit<DbInsumo, 'id' | 'created_at' | 'updated_at'>
export type InsertInsumoBarra = Omit<DbInsumoBarra, 'id' | 'created_at' | 'updated_at'>
export type InsertReceta = Omit<DbReceta, 'id' | 'created_at' | 'updated_at'>
export type InsertCoctel = Omit<DbCoctel, 'id' | 'created_at' | 'updated_at'>
export type InsertBarraTemplate = Omit<DbBarraTemplate, 'id' | 'created_at' | 'updated_at'>
