-- Drop existing tables to recreate with correct schema
DROP TABLE IF EXISTS coctel_insumos CASCADE;
DROP TABLE IF EXISTS receta_insumos CASCADE;
DROP TABLE IF EXISTS cocteles CASCADE;
DROP TABLE IF EXISTS recetas CASCADE;
DROP TABLE IF EXISTS barra_templates CASCADE;
DROP TABLE IF EXISTS insumos_barra CASCADE;
DROP TABLE IF EXISTS insumos CASCADE;

-- Insumos (Cocina) - TEXT IDs, correct columns
CREATE TABLE IF NOT EXISTS insumos (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  descripcion TEXT NOT NULL,
  unidad TEXT NOT NULL,
  stock_actual NUMERIC NOT NULL DEFAULT 0,
  precio_unitario NUMERIC NOT NULL DEFAULT 0,
  proveedor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insumos Barra - TEXT IDs, correct columns
CREATE TABLE IF NOT EXISTS insumos_barra (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  descripcion TEXT NOT NULL,
  unidad TEXT NOT NULL,
  stock_actual NUMERIC NOT NULL DEFAULT 0,
  precio_unitario NUMERIC NOT NULL DEFAULT 0,
  proveedor TEXT,
  categoria TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recetas - TEXT IDs
CREATE TABLE IF NOT EXISTS recetas (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL,
  porciones_base INTEGER NOT NULL DEFAULT 1,
  instrucciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receta Insumos - with detalle_corte field
CREATE TABLE IF NOT EXISTS receta_insumos (
  id TEXT PRIMARY KEY,
  receta_id TEXT NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  insumo_id TEXT NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  detalle_corte TEXT,
  cantidad_base_por_persona NUMERIC NOT NULL,
  unidad_receta TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cocteles - TEXT IDs
CREATE TABLE IF NOT EXISTS cocteles (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL,
  instrucciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coctel Insumos
CREATE TABLE IF NOT EXISTS coctel_insumos (
  id TEXT PRIMARY KEY,
  coctel_id TEXT NOT NULL REFERENCES cocteles(id) ON DELETE CASCADE,
  insumo_barra_id TEXT NOT NULL REFERENCES insumos_barra(id) ON DELETE CASCADE,
  cantidad NUMERIC NOT NULL,
  unidad TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Barra Templates - TEXT IDs
CREATE TABLE IF NOT EXISTS barra_templates (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  cocteles JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_receta_insumos_receta ON receta_insumos(receta_id);
CREATE INDEX IF NOT EXISTS idx_receta_insumos_insumo ON receta_insumos(insumo_id);
CREATE INDEX IF NOT EXISTS idx_coctel_insumos_coctel ON coctel_insumos(coctel_id);
CREATE INDEX IF NOT EXISTS idx_coctel_insumos_insumo ON coctel_insumos(insumo_barra_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_insumos_updated_at ON insumos;
CREATE TRIGGER update_insumos_updated_at BEFORE UPDATE ON insumos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_insumos_barra_updated_at ON insumos_barra;
CREATE TRIGGER update_insumos_barra_updated_at BEFORE UPDATE ON insumos_barra FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recetas_updated_at ON recetas;
CREATE TRIGGER update_recetas_updated_at BEFORE UPDATE ON recetas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cocteles_updated_at ON cocteles;
CREATE TRIGGER update_cocteles_updated_at BEFORE UPDATE ON cocteles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_barra_templates_updated_at ON barra_templates;
CREATE TRIGGER update_barra_templates_updated_at BEFORE UPDATE ON barra_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
