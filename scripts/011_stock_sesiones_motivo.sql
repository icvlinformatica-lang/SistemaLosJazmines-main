-- Por qué se cargó una sesión de stock.
--
-- Hasta ahora la carga estaba siempre abierta: el evento terminado solo
-- disparaba un aviso ("ya terminó, podés cargar"), no bloqueaba nada. Desde
-- este cambio hay dos puertas y conviene poder distinguirlas después:
--
--   · 'evento'        — había un evento terminado pendiente de carga en ese
--                       salón y sector. Sin PIN. La sesión queda atada a él.
--   · 'extraordinaria'— no había evento: se cargó con el PIN de acción
--                       (PIN_STOCK_EXTRA). evento_id queda en null.
--   · 'migracion'     — las dos sesiones que armó scripts/010, que cargaron
--                       toda la existencia como conteo de Casona. No son ni
--                       una cosa ni la otra.
--
-- Mirar si evento_id es null no alcanza para distinguirlas: una carga por
-- evento también puede quedar sin enlazar si el evento se borra después.
--
-- Migración aditiva: no toca datos, solo agrega la columna y rotula lo que
-- ya estaba. Idempotente.

alter table stock_sesiones
  add column if not exists motivo text;

do $$
begin
  -- Las dos sesiones de scripts/010, por su id fijo.
  update stock_sesiones set motivo = 'migracion'
   where motivo is null
     and id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');

  -- El resto de lo que ya existía se cargó cuando no había puerta: si quedó
  -- atada a un evento fue por evento, y si no, fue por fuera.
  update stock_sesiones set motivo = case when evento_id is null then 'extraordinaria' else 'evento' end
   where motivo is null;
end $$;

alter table stock_sesiones
  alter column motivo set default 'evento';

alter table stock_sesiones
  alter column motivo set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stock_sesiones_motivo_check') then
    alter table stock_sesiones
      add constraint stock_sesiones_motivo_check
      check (motivo in ('evento', 'extraordinaria', 'migracion'));
  end if;
end $$;

-- Para poder listar rápido las extraordinarias, que son las que se revisan.
create index if not exists stock_sesiones_motivo_idx on stock_sesiones (motivo);
