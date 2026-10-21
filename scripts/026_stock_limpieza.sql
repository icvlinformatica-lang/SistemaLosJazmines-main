-- 026 — Stock de limpieza (tercer sector del stock por salón).
--
-- SOLO ADITIVA: crea una tabla nueva y amplía tres controles para aceptar un
-- valor nuevo ('limpieza'). No modifica ni borra ninguna fila existente.
-- Aplicada el 21/10/2026 (la corrió el dueño en el SQL Editor de Supabase;
-- verificado en information_schema: tabla, columnas, RLS y los tres controles).
--
-- Pedido de Diego (21/10/2026): un stock aparte de cocina y barra para
-- limpieza, papelería y mantenimiento (bolsas, papel higiénico, rollo de
-- cocina, alcohol, esponjas, jabón para la ropa, perfumes del baño, resmas de
-- la oficina...). Funciona igual que cocina y barra: se cuenta lo que hay en
-- cada salón y el total es la suma de los salones.
--
-- 1) insumos_limpieza: el catálogo de artículos. Lo arma Administración en
--    /admin/limpieza. Tiene precio por unidad y cuánto trae cada unidad (en
--    gramos o cc, como Almacén y Barra), pedido de Rodrigo el 21/10/2026: por
--    ahora solo se cargan; NO entran en ningún costo de eventos ni en las
--    cajas (más adelante se sumarán a Caja Eventos). No tiene stock_actual:
--    el total se calcula en vivo como la suma de stock_salones.
--    Si ya corriste una versión anterior de este script (sin precio), volvé
--    a correrlo entero: los "add column if not exists" suman lo que falta.
--
-- 2) stock_sesiones, stock_sesion_items y stock_salones (scripts/005) aceptan
--    'limpieza' como sector. Lo de cocina y barra sigue igual.
--
-- Acceso solo por el servidor (app/api/insumos-limpieza y
-- app/api/stock-salones/**): RLS activado, sin políticas y sin permisos para
-- anon ni authenticated.

begin;

create table if not exists insumos_limpieza (
  id          text primary key,
  descripcion text not null,
  -- UN, PAQ, ROLLO, LT, KG... texto libre en mayúsculas.
  unidad      text not null default 'UN',
  -- Limpieza, Papelería, Baño, Mantenimiento u otra (agrupa la lista de carga).
  categoria   text,
  -- Precio de una unidad, en pesos. 0 = sin cargar.
  precio_unitario    numeric not null default 0,
  -- Cuánto trae cada unidad (ej. 5000 + 'CC' = bidón de 5 litros). Vacío = sin cargar.
  contenido_cantidad numeric,
  contenido_unidad   text check (contenido_unidad in ('GRS', 'CC')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Por si la tabla ya existía de una versión anterior de este script.
alter table insumos_limpieza add column if not exists precio_unitario numeric not null default 0;
alter table insumos_limpieza add column if not exists contenido_cantidad numeric;
alter table insumos_limpieza add column if not exists contenido_unidad text check (contenido_unidad in ('GRS', 'CC'));

alter table insumos_limpieza enable row level security;
revoke all on insumos_limpieza from anon, authenticated;

-- Los tres controles de sector de scripts/005 (nombres verificados en la base
-- el 21/10/2026). Se reemplazan por uno que además acepta 'limpieza'.
alter table stock_sesiones drop constraint if exists stock_sesiones_sector_check;
alter table stock_sesiones
  add constraint stock_sesiones_sector_check check (sector in ('cocina', 'barra', 'limpieza'));

alter table stock_sesion_items drop constraint if exists stock_sesion_items_insumo_tipo_check;
alter table stock_sesion_items
  add constraint stock_sesion_items_insumo_tipo_check check (insumo_tipo in ('cocina', 'barra', 'limpieza'));

alter table stock_salones drop constraint if exists stock_salones_insumo_tipo_check;
alter table stock_salones
  add constraint stock_salones_insumo_tipo_check check (insumo_tipo in ('cocina', 'barra', 'limpieza'));

commit;

-- Verificación:
--   1) Tiene que dar 0 filas:
--      select grantee, privilege_type from information_schema.role_table_grants
--      where table_name = 'insumos_limpieza' and grantee in ('anon', 'authenticated');
--   2) Las tres tienen que decir 'limpieza':
--      select conname, pg_get_constraintdef(oid) from pg_constraint
--      where conname in ('stock_sesiones_sector_check', 'stock_sesion_items_insumo_tipo_check',
--                        'stock_salones_insumo_tipo_check');
--   3) Tienen que salir las tres columnas:
--      select column_name from information_schema.columns where table_name = 'insumos_limpieza'
--      and column_name in ('precio_unitario', 'contenido_cantidad', 'contenido_unidad');
