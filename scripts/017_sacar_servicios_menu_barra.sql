-- 017 — Sacar los 7 servicios de categoría Menú/Barra (creados el 28/9/2026).
-- Aplicada el 3/10/2026.
--
-- Menú y barra se configuran desde Recetas y Cócteles (cotizador por salón),
-- no desde Servicios. Ninguno de los 7 lo usaba un evento, una cotización,
-- un paquete ni la configuración por salón (verificado por id y por nombre);
-- el único vínculo era MENÚ ASADO → receta "Asado Completo" en
-- servicio_recetas (la "premarca" del cotizador viejo; la receta no se toca).
-- Respaldo de lo borrado: respaldos/2026-10-03_servicios_menu_barra.json
-- (local, fuera del repo).
--
-- Idempotente: si ya no existen, no hace nada. Tiene un freno: si alguno
-- quedó en uso, corta sin borrar nada.
begin;

do $$
declare
  ids text[] := array[
    '306952cb-b277-4586-8be1-c7f0b3c849ed', -- MENÚ SUPREMA, BONDIOLA O PASTAS
    'da32901e-3fb5-49ea-a19b-8866af2f5d23', -- MENÚ ASADO
    'eaddf010-d67e-4dbb-8fd5-efe3fd7cdba2', -- MENÚ PIZZA PARTY
    '8dbf2ef0-25c2-466a-8b06-2e86b3aea3d4', -- BARRA CLÁSICA
    '88c7cadf-657c-4541-b891-a197dfa63748', -- BARRA FULL
    'fdc93031-7a89-4101-81e0-94bb7a56b158', -- BEBIDA DE MESA
    '93619a23-9599-4222-bf3f-3db6743e2cee'  -- BEBIDAS SIN ALCOHOL
  ];
  usados int;
begin
  select (select count(*) from eventos e where exists (select 1 from unnest(ids) i where e::text like '%'||i||'%'))
       + (select count(*) from cotizaciones c where exists (select 1 from unnest(ids) i where c::text like '%'||i||'%'))
       + (select count(*) from cotizaciones_eliminadas c where exists (select 1 from unnest(ids) i where c::text like '%'||i||'%'))
       + (select count(*) from paquetes_salones p where exists (select 1 from unnest(ids) i where p::text like '%'||i||'%'))
       + (select count(*) from cotizador_salon_servicio where servicio_id = any(ids))
    into usados;
  if usados > 0 then
    raise exception 'Hay % registros que usan alguno de los 7 servicios: no se borra nada', usados;
  end if;
end $$;

delete from servicio_recetas where servicio_id in (
  '306952cb-b277-4586-8be1-c7f0b3c849ed','da32901e-3fb5-49ea-a19b-8866af2f5d23','eaddf010-d67e-4dbb-8fd5-efe3fd7cdba2',
  '8dbf2ef0-25c2-466a-8b06-2e86b3aea3d4','88c7cadf-657c-4541-b891-a197dfa63748','fdc93031-7a89-4101-81e0-94bb7a56b158',
  '93619a23-9599-4222-bf3f-3db6743e2cee');
delete from servicio_barra_template where servicio_id in (
  '306952cb-b277-4586-8be1-c7f0b3c849ed','da32901e-3fb5-49ea-a19b-8866af2f5d23','eaddf010-d67e-4dbb-8fd5-efe3fd7cdba2',
  '8dbf2ef0-25c2-466a-8b06-2e86b3aea3d4','88c7cadf-657c-4541-b891-a197dfa63748','fdc93031-7a89-4101-81e0-94bb7a56b158',
  '93619a23-9599-4222-bf3f-3db6743e2cee');
-- Solo si siguen siendo de Menú/Barra (por si alguno se recategorizó a propósito).
delete from servicios where categoria in ('Menú','Barra') and id in (
  '306952cb-b277-4586-8be1-c7f0b3c849ed','da32901e-3fb5-49ea-a19b-8866af2f5d23','eaddf010-d67e-4dbb-8fd5-efe3fd7cdba2',
  '8dbf2ef0-25c2-466a-8b06-2e86b3aea3d4','88c7cadf-657c-4541-b891-a197dfa63748','fdc93031-7a89-4101-81e0-94bb7a56b158',
  '93619a23-9599-4222-bf3f-3db6743e2cee');

commit;
