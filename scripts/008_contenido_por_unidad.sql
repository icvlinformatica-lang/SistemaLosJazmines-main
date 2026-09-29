-- Cuánto contiene cada unidad de un insumo que se compra por unidad.
--
-- EL PROBLEMA: cuando una receta pide gramos pero el insumo está cargado en
-- unidades (una lata, una bolsa, un paquete), normalizeToStockUnit() no sabía
-- convertir y devolvía la cantidad tal cual — o sea, trataba los gramos como
-- si fueran unidades. La Ensalada Rusa pide 30 grs de arvejas por persona y
-- el sistema calculaba 30 LATAS por persona: $117.000 de arvejas por cubierto
-- en vez de $585. Por eso hay eventos con costo_insumos de cientos de
-- millones.
--
-- LA SOLUCIÓN: guardar cuánto contiene cada unidad (una lata de arvejas =
-- 200 grs) para poder convertir. 30 grs / 200 grs por lata = 0,15 latas.
--
-- Migración aditiva: dos columnas nuevas, ambas nulas. Un insumo SIN
-- contenido cargado se calcula exactamente como hasta ahora, así que ningún
-- costo cambia solo: solo cambian los insumos que se vayan completando a mano.

alter table insumos add column if not exists contenido_cantidad numeric;
alter table insumos add column if not exists contenido_unidad   text;

-- Solo gramos y centímetros cúbicos: son las dos unidades a las que hace
-- falta convertir desde una unidad suelta.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'insumos_contenido_unidad_valida'
  ) then
    alter table insumos add constraint insumos_contenido_unidad_valida
      check (contenido_unidad is null or contenido_unidad in ('GRS','CC'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'insumos_contenido_completo'
  ) then
    -- O están los dos datos, o ninguno: media carga no sirve para convertir.
    alter table insumos add constraint insumos_contenido_completo
      check (
        (contenido_cantidad is null and contenido_unidad is null)
        or (contenido_cantidad is not null and contenido_cantidad > 0 and contenido_unidad is not null)
      );
  end if;
end $$;

comment on column insumos.contenido_cantidad is
  'Cuánto contiene cada unidad (ej: 200 para una lata de 200 grs). Null = sin cargar, se calcula como antes.';
comment on column insumos.contenido_unidad is
  'Unidad de contenido_cantidad: GRS o CC. Solo tiene sentido en insumos cuya unidad es UN.';
