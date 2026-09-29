-- El conteo por salón pasa a ser el stock real.
--
-- Hasta ahora convivían dos números independientes a propósito:
--   · insumos.stock_actual / insumos_barra.stock_actual — el stock global,
--     que se edita a mano desde /admin/almacen y /admin/barra;
--   · stock_salones — el conteo físico por salón que cargan Cocina y Barra.
--
-- A partir de este cambio el stock real de un insumo es la SUMA de lo que hay
-- en cada salón, y el conteo que carga un salón actualiza ese total solo (ver
-- app/api/stock-salones/sesiones/route.ts).
--
-- PARA QUE EL ARRANQUE NO MUEVA NINGÚN NÚMERO, esta migración carga toda la
-- existencia de hoy como conteo de Casona. Así, el primer día, la suma por
-- salón da exactamente el stock_actual que ya estaba. Recién cuando un salón
-- carga su conteo real el total empieza a moverse.
--
-- Los insumos con stock_actual = 0 TAMBIÉN reciben su fila en Casona, con 0.
-- Si no, quedarían como "nadie contó acá", que no es lo mismo que "no hay", y
-- al recalcular el total se comportarían distinto que el resto.
--
-- Es idempotente: si ya corrió (existe la sesión de migración de ese sector),
-- no vuelve a hacer nada.

do $$
declare
  ses_cocina constant uuid := '00000000-0000-4000-8000-000000000001';
  ses_barra  constant uuid := '00000000-0000-4000-8000-000000000002';
  ahora      constant timestamptz := now();
  n_cocina   integer;
  n_barra    integer;
begin
  -- ── Cocina ────────────────────────────────────────────────────────────
  if not exists (select 1 from stock_sesiones where id = ses_cocina::text) then
    select count(*) into n_cocina from insumos;

    insert into stock_sesiones (id, salon, sector, cargado_por, evento_id, iniciada_en, cerrada_en, cantidad_items)
    values (ses_cocina::text, 'Casona', 'cocina', 'Migración inicial', null, ahora, ahora, n_cocina);

    -- Detalle: de dónde salió cada fila. cantidad_anterior = 0 porque antes
    -- de esto no había ningún conteo por salón.
    insert into stock_sesion_items (sesion_id, insumo_tipo, insumo_id, descripcion, unidad, cantidad_anterior, cantidad_nueva)
    select ses_cocina::text, 'cocina', i.id, i.descripcion, i.unidad, 0, coalesce(i.stock_actual, 0)
    from insumos i;

    insert into stock_salones (insumo_tipo, insumo_id, salon, cantidad, ultima_sesion_id, actualizado_por, actualizado_en)
    select 'cocina', i.id, 'Casona', coalesce(i.stock_actual, 0), ses_cocina::text, 'Migración inicial', ahora
    from insumos i
    on conflict (insumo_tipo, insumo_id, salon) do update set
      cantidad = excluded.cantidad,
      ultima_sesion_id = excluded.ultima_sesion_id,
      actualizado_por = excluded.actualizado_por,
      actualizado_en = excluded.actualizado_en;

    insert into activity_log (id, tipo, accion, nombre, detalle)
    values (ses_cocina, 'stock_sesion', 'modificado', 'Casona — cocina',
            'Migración inicial · toda la existencia de cocina se cargó como conteo de Casona · ' || n_cocina || ' insumos');
  end if;

  -- ── Barra ─────────────────────────────────────────────────────────────
  if not exists (select 1 from stock_sesiones where id = ses_barra::text) then
    select count(*) into n_barra from insumos_barra;

    insert into stock_sesiones (id, salon, sector, cargado_por, evento_id, iniciada_en, cerrada_en, cantidad_items)
    values (ses_barra::text, 'Casona', 'barra', 'Migración inicial', null, ahora, ahora, n_barra);

    insert into stock_sesion_items (sesion_id, insumo_tipo, insumo_id, descripcion, unidad, cantidad_anterior, cantidad_nueva)
    select ses_barra::text, 'barra', ib.id, ib.descripcion, ib.unidad, 0, coalesce(ib.stock_actual, 0)
    from insumos_barra ib;

    insert into stock_salones (insumo_tipo, insumo_id, salon, cantidad, ultima_sesion_id, actualizado_por, actualizado_en)
    select 'barra', ib.id, 'Casona', coalesce(ib.stock_actual, 0), ses_barra::text, 'Migración inicial', ahora
    from insumos_barra ib
    on conflict (insumo_tipo, insumo_id, salon) do update set
      cantidad = excluded.cantidad,
      ultima_sesion_id = excluded.ultima_sesion_id,
      actualizado_por = excluded.actualizado_por,
      actualizado_en = excluded.actualizado_en;

    insert into activity_log (id, tipo, accion, nombre, detalle)
    values (ses_barra, 'stock_sesion', 'modificado', 'Casona — barra',
            'Migración inicial · toda la existencia de barra se cargó como conteo de Casona · ' || n_barra || ' insumos');
  end if;
end $$;
