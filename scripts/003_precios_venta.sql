CREATE TABLE IF NOT EXISTS precios_venta (
  id TEXT PRIMARY KEY,
  salon TEXT NOT NULL,
  fecha TEXT NOT NULL,
  precio NUMERIC(12,2) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_precios_venta_salon
  ON precios_venta(salon);
