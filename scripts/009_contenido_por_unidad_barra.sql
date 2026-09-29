-- Mismo campo de contenido por unidad, pero para los insumos de barra.
--
-- La barra tiene el problema todavía peor que la cocina: una botella de gin
-- está cargada en "UN" a $20.571 y el Martini pide 60 CC, así que el sistema
-- calcula 60 BOTELLAS por trago — $1.234.260 el Martini. Con el contenido
-- (700 CC) pasa a $1.763.
--
-- Aditiva y nula por defecto: un insumo sin el dato se calcula como antes.
-- Ver lib/diagnostico-costos.ts para el detector que ayuda a completarlos.

alter table insumos_barra add column if not exists contenido_cantidad numeric;
alter table insumos_barra add column if not exists contenido_unidad   text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'insumos_barra_contenido_unidad_valida') then
    alter table insumos_barra add constraint insumos_barra_contenido_unidad_valida
      check (contenido_unidad is null or contenido_unidad in ('GRS','CC'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'insumos_barra_contenido_completo') then
    alter table insumos_barra add constraint insumos_barra_contenido_completo
      check (
        (contenido_cantidad is null and contenido_unidad is null)
        or (contenido_cantidad is not null and contenido_cantidad > 0 and contenido_unidad is not null)
      );
  end if;
end $$;

comment on column insumos_barra.contenido_cantidad is
  'Cuánto contiene cada unidad (una botella de gin = 700 CC). Null = sin cargar, se calcula como antes.';
