-- 021: limpia restos viejos de seguridad en la base (punto 17 de la revisión
-- del 8/10/2026). NO está aplicada: la corre el dueño en el SQL Editor de
-- Supabase.
--
-- 1. Borra las políticas viejas "abrir todo" (USING true) de paquetes_salones,
--    precios_venta y temporadas. Hoy no abren nada porque anon y authenticated
--    no tienen permisos sobre esas tablas, pero lo harían si alguien se los
--    devolviera. La app no las necesita: entra con la service role, que no
--    pasa por RLS. RLS sigue activado en las tres tablas.
-- 2. Fija el search_path de update_updated_at_column, que es lo que pide el
--    aviso de seguridad de Supabase (nivel WARN). La función solo usa now(),
--    que está en pg_catalog, así que sigue andando igual.
--
-- Solo quita permisos que no se usan: no toca datos.

begin;

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('paquetes_salones', 'precios_venta', 'temporadas')
      and coalesce(qual, 'true') = 'true'
      and coalesce(with_check, 'true') = 'true'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    raise notice 'Borrada la política % de %', p.policyname, p.tablename;
  end loop;
end $$;

alter function public.update_updated_at_column() set search_path = '';

commit;

-- Para verificar después (tiene que dar 0 filas):
--   select tablename, policyname from pg_policies
--   where schemaname = 'public' and tablename in ('paquetes_salones', 'precios_venta', 'temporadas');
