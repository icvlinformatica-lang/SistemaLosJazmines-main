-- 028 — Vajilla y utensilios de cocina (cuarto sector del stock por salón).
--
-- SOLO ADITIVA: crea una tabla nueva y amplía tres controles para aceptar un
-- valor nuevo ('vajilla'). No modifica ni borra ninguna fila existente.
-- Sin aplicar todavía: la corre el dueño en el SQL Editor de Supabase ANTES
-- de publicar el código que la usa.
--
-- Pedido de Rodrigo (27/10/2026): llevar el inventario de lo que la cocina
-- tiene guardado para trabajar (platos, cubiertos, tazas, ollas, sartenes,
-- utensilios...). Es SOLO stock: no tiene precio, no entra en el costo de los
-- eventos ni en Caja Eventos ni en Caja Jazmines. Lo cuenta y lo arma la
-- gente de Cocina; Administración y Soporte lo ven (y pueden corregirlo,
-- como todo el stock). Funciona igual que limpieza: se cuenta lo que hay en
-- cada salón y el total es la suma de los salones.
--
-- 1) insumos_vajilla: la lista de artículos. Se arma en /admin/vajilla. No
--    tiene precio ni stock_actual: el total se calcula en vivo como la suma
--    de stock_salones.
--
-- 2) stock_sesiones, stock_sesion_items y stock_salones (scripts/005 y 026)
--    aceptan 'vajilla' como sector. Cocina, barra y limpieza siguen igual.
--
-- Acceso solo por el servidor (app/api/insumos-vajilla y
-- app/api/stock-salones/**): RLS activado, sin políticas y sin permisos para
-- anon ni authenticated.

begin;

create table if not exists insumos_vajilla (
  id          text primary key,
  descripcion text not null,
  -- UN, JUEGO, DOCENA... texto libre en mayúsculas.
  unidad      text not null default 'UN',
  -- Vajilla, Cubiertos, Cristalería, Ollas y sartenes, Utensilios u otra
  -- (agrupa la lista de carga).
  categoria   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table insumos_vajilla enable row level security;
revoke all on insumos_vajilla from anon, authenticated;

-- Los tres controles de sector (los mismos que reemplazó la 026). Se
-- reemplazan por uno que además acepta 'vajilla'.
alter table stock_sesiones drop constraint if exists stock_sesiones_sector_check;
alter table stock_sesiones
  add constraint stock_sesiones_sector_check check (sector in ('cocina', 'barra', 'limpieza', 'vajilla'));

alter table stock_sesion_items drop constraint if exists stock_sesion_items_insumo_tipo_check;
alter table stock_sesion_items
  add constraint stock_sesion_items_insumo_tipo_check check (insumo_tipo in ('cocina', 'barra', 'limpieza', 'vajilla'));

alter table stock_salones drop constraint if exists stock_salones_insumo_tipo_check;
alter table stock_salones
  add constraint stock_salones_insumo_tipo_check check (insumo_tipo in ('cocina', 'barra', 'limpieza', 'vajilla'));

commit;

-- Verificación:
--   1) Tiene que dar 0 filas:
--      select grantee, privilege_type from information_schema.role_table_grants
--      where table_name = 'insumos_vajilla' and grantee in ('anon', 'authenticated');
--   2) Las tres tienen que decir 'vajilla':
--      select conname, pg_get_constraintdef(oid) from pg_constraint
--      where conname in ('stock_sesiones_sector_check', 'stock_sesion_items_insumo_tipo_check',
--                        'stock_salones_insumo_tipo_check');
--   3) Tiene que dar true:
--      select relrowsecurity from pg_class where relname = 'insumos_vajilla';
