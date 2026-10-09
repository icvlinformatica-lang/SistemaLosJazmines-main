-- 022 — Datos nuevos para el staff, las dietas y el origen del cliente.
-- (La 021 la usa el PR de "Revisión de errores": limpieza de políticas viejas.)
-- Sin aplicar.
--
-- SOLO ADITIVA: agrega columnas que quedan vacías (null) en las filas que ya
-- existen. No toca datos ni cambia ninguna cuenta.
--
-- En eventos:
--   notas_staff_perfil  jsonb  Nota para cada oficio del staff, además de la
--                              nota para todos (nota_staff), por ejemplo
--                              {"dj": "Entrada con …", "fotografo": "…"}.
--                              lib/staff-evento.ts (notasParaPerfil).
--   cronograma          jsonb  Cronograma de la noche:
--                              [{"id","hora":"22:30","momento":"Vals","perfiles":["dj"],"nota"?}]
--                              Lo guarda PATCH /api/eventos/[id]/cronograma
--                              (Administración, Soporte y Coordinación).
--   dietas_detalle      jsonb  Desglose de personas_dietas_especiales por tipo:
--                              [{"tipo":"celiaco","cantidad":3},{"tipo":"alergia","cantidad":1,"nota":"maní"}]
--                              El total sigue en personas_dietas_especiales (el
--                              costo de cocina no cambia). lib/dietas-evento.ts.
--   origen_cliente      text   "¿Cómo nos conoció?": instagram, facebook, google,
--                              recomendacion, ya_cliente, paso_por_salon, otro.
--                              lib/origen-cliente.ts. Se pueden agregar valores,
--                              no renombrar.
--
-- En cotizaciones y en su papelera espejo (cotizaciones_eliminadas, que copia
-- columnas): origen_cliente text. Las dietas de la cotización viajan dentro
-- del jsonb `invitados` (invitados.dietasDetalle), que ya existe.
--
-- El código lee las columnas nuevas con to_jsonb(...) para que nada se rompa
-- si se publica antes, pero GUARDARLAS falla hasta que esta migración esté
-- aplicada: aplicarla ANTES de publicar el código.
--
-- Verificar después:
--   select table_name, column_name, data_type from information_schema.columns
--   where column_name in ('notas_staff_perfil','cronograma','dietas_detalle','origen_cliente')
--   order by table_name, column_name;
--   → 6 filas: cotizaciones.origen_cliente, cotizaciones_eliminadas.origen_cliente
--     y las 4 de eventos.

begin;

alter table eventos
  add column if not exists notas_staff_perfil jsonb,
  add column if not exists cronograma jsonb,
  add column if not exists dietas_detalle jsonb,
  add column if not exists origen_cliente text;

alter table cotizaciones
  add column if not exists origen_cliente text;

alter table cotizaciones_eliminadas
  add column if not exists origen_cliente text;

commit;
