-- Insumos de Cocina
CREATE TABLE IF NOT EXISTS insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL,
  cantidad DECIMAL(10,2) NOT NULL DEFAULT 0,
  unidad TEXT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  umbral_minimo DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insumos de Barra (Bebidas)
CREATE TABLE IF NOT EXISTS insumos_barra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL,
  cantidad DECIMAL(10,2) NOT NULL DEFAULT 0,
  unidad TEXT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  umbral_minimo DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recetas
CREATE TABLE IF NOT EXISTS recetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  porciones INTEGER NOT NULL DEFAULT 1,
  tiempo_preparacion INTEGER, -- en minutos
  categoria TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relacion Receta - Insumos
CREATE TABLE IF NOT EXISTS receta_insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receta_id UUID NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  cantidad DECIMAL(10,3) NOT NULL,
  unidad TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cocteles
CREATE TABLE IF NOT EXISTS cocteles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relacion Coctel - Insumos Barra
CREATE TABLE IF NOT EXISTS coctel_insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coctel_id UUID NOT NULL REFERENCES cocteles(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES insumos_barra(id) ON DELETE CASCADE,
  cantidad DECIMAL(10,3) NOT NULL,
  unidad TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates de Barra para eventos
CREATE TABLE IF NOT EXISTS barra_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  cocteles JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_insumos_categoria ON insumos(categoria);
CREATE INDEX IF NOT EXISTS idx_insumos_barra_categoria ON insumos_barra(categoria);
CREATE INDEX IF NOT EXISTS idx_recetas_categoria ON recetas(categoria);
CREATE INDEX IF NOT EXISTS idx_cocteles_categoria ON cocteles(categoria);
CREATE INDEX IF NOT EXISTS idx_receta_insumos_receta ON receta_insumos(receta_id);
CREATE INDEX IF NOT EXISTS idx_coctel_insumos_coctel ON coctel_insumos(coctel_id);

-- RLS deshabilitado inicialmente (sin auth)
-- Cuando se implemente auth, se agregaran policies

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_insumos_updated_at
  BEFORE UPDATE ON insumos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_insumos_barra_updated_at
  BEFORE UPDATE ON insumos_barra
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_recetas_updated_at
  BEFORE UPDATE ON recetas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_cocteles_updated_at
  BEFORE UPDATE ON cocteles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_barra_templates_updated_at
  BEFORE UPDATE ON barra_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
