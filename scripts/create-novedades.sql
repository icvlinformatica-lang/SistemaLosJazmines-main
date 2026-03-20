-- Create novedades table
CREATE TABLE IF NOT EXISTS novedades (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  icono TEXT NOT NULL DEFAULT 'Sparkles',
  color TEXT NOT NULL DEFAULT 'bg-[#2d5a3d]',
  activa BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with initial novedades
INSERT INTO novedades (id, titulo, contenido, icono, color, activa, orden) VALUES
  ('nov-001', 'Sistema actualizado', 'Se mejoró la velocidad de carga de recetas e insumos desde la base de datos en la nube.', 'Zap', 'bg-[#2d5a3d]', true, 1),
  ('nov-002', 'Restaurar a la nube', 'Ahora podés cargar tu archivo de backup y sincronizarlo directamente con la base de datos desde Configuración.', 'Cloud', 'bg-[#4a7c59]', true, 2),
  ('nov-003', 'Estado de guardado', 'La sección de Configuración ahora muestra cuántos registros están guardados en la nube y cuándo fue el último guardado.', 'Database', 'bg-[#d4a533]', true, 3)
ON CONFLICT (id) DO NOTHING;
