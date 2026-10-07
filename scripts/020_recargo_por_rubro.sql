-- 020 — Recargo de sábado y de fechas especiales con un porcentaje por rubro
-- (Salón, Cocina, Barra y Servicios, cada uno con el suyo).
-- Aplicada el 6/10/2026.
--
-- SOLO ADITIVA: agrega una columna jsonb que puede quedar vacía (null) en
-- cotizador_salon (recargo de sábado de cada salón) y en
-- cotizador_fecha_especial (recargo propio de una fecha). No toca datos.
--
-- Guarda el % de cada rubro, por ejemplo
--   {"salon": 17, "cocina": 17, "barra": 0, "servicios": 10}
-- Las filas que ya existen quedan en null y el código las sigue leyendo como
-- antes (un solo % para los rubros tildados, de recargo_*_valor y
-- recargo_*_rubros): ningún precio cambia hasta que se edite el recargo.
-- Al guardar, el código completa también las columnas viejas con el % más
-- alto y los rubros que tienen recargo.
--
-- Cuentas en lib/cotizador-salon.ts (porcentajesPorRubro, montoRecargo).
-- Hay que aplicarla ANTES de publicar el código que la usa: el guardado de la
-- configuración por salón y de las fechas especiales manda la columna nueva.

alter table cotizador_salon
  add column if not exists recargo_sabado_porcentajes jsonb;

alter table cotizador_fecha_especial
  add column if not exists recargo_porcentajes jsonb;
